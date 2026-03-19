import secrets
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.config import settings
from app.models.team import Team
from app.models.session import Session
from app.models.event import Event
from app.models.admin_user import AdminUser


def hash_code(code: str) -> str:
    """Hash a login code using SHA-256 (fast enough for codes, bcrypt is for passwords)."""
    return hashlib.sha256(code.encode()).hexdigest()


def generate_team_code() -> str:
    """Generate a human-readable random login code."""
    part1 = secrets.token_hex(3).upper()
    part2 = secrets.token_hex(3).upper()
    part3 = secrets.token_hex(3).upper()
    return f"{part1}-{part2}-{part3}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_team_access_token(session_id: UUID, team_id: UUID, event_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "type": "team",
        "session_id": str(session_id),
        "team_id": str(team_id),
        "event_id": str(event_id),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_admin_access_token(admin_id: UUID, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_TOKEN_EXPIRE_HOURS)
    payload = {
        "type": "admin",
        "admin_id": str(admin_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.ADMIN_SECRET_KEY, algorithm=settings.ALGORITHM)


async def login_with_code(
    code: str,
    db: AsyncSession,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, Session, Team, Event]:
    """
    Validate a team login code and issue a session.
    Returns (access_token, session, team, event).
    """
    code_upper = code.strip().upper()
    code_hash = hash_code(code_upper)

    # Find the team matching this code hash
    result = await db.execute(
        select(Team).where(Team.team_code_hash == code_hash, Team.is_active == True)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise ValueError("Invalid or expired login code")

    # Load event
    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one_or_none()

    if not event:
        raise ValueError("Event not found")

    now = datetime.now(timezone.utc)

    if event.status == "ended":
        raise ValueError("This event has ended")

    if event.status == "draft":
        raise ValueError("This event has not started yet")

    # Create session record
    session = Session(
        team_id=team.id,
        token_hash="",  # Will be updated after token creation
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    )
    db.add(session)
    await db.flush()  # Get session.id

    token = create_team_access_token(session.id, team.id, event.id)
    # Store hash of token for lookup/revocation
    session.token_hash = hashlib.sha256(token.encode()).hexdigest()

    return token, session, team, event


async def admin_login(
    login: str, password: str, db: AsyncSession
) -> tuple[str, AdminUser]:
    login_normalized = login.strip().lower()
    if not login_normalized:
        raise ValueError("Invalid username/email or password")

    lookup = or_(
        func.lower(AdminUser.email) == login_normalized,
        func.lower(AdminUser.display_name) == login_normalized,
    )

    if login_normalized == settings.DEFAULT_ADMIN_USERNAME.lower():
        lookup = or_(lookup, func.lower(AdminUser.email) == settings.DEFAULT_ADMIN_EMAIL.lower())

    result = await db.execute(select(AdminUser).where(lookup))
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(password, admin.password_hash):
        raise ValueError("Invalid username/email or password")

    if not admin.is_active:
        raise ValueError("Admin account is disabled")

    admin.last_login_at = datetime.now(timezone.utc)
    token = create_admin_access_token(admin.id, admin.email, admin.role)
    return token, admin
