from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.schemas.auth import CodeLoginRequest, CodeLoginResponse, MeResponse, AdminLoginRequest, AdminLoginResponse
from app.services.auth_service import login_with_code, admin_login
from app.deps import get_current_team_session, get_current_admin
from app.models.team import Team
from app.models.event import Event

router = APIRouter()


@router.post("/code-login", response_model=CodeLoginResponse)
async def code_login(
    body: CodeLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    try:
        token, session, team, event = await login_with_code(
            body.code, db, ip_address=ip, user_agent=ua
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return CodeLoginResponse(
        access_token=token,
        event={
            "id": str(event.id),
            "public_event_id": event.public_event_id,
            "title": event.title,
            "status": event.status.value,
        },
        team={
            "id": str(team.id),
            "public_team_id": team.public_team_id,
            "team_name": team.team_name,
            "encoded_team_id_base64": team.encoded_team_id_base64,
        },
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone

    session.revoked_at = datetime.now(timezone.utc)
    await db.commit()


@router.get("/me", response_model=MeResponse)
async def me(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    return MeResponse(
        session_id=str(session.id),
        team_id=str(team.id),
        event_id=str(event.id),
        public_team_id=team.public_team_id,
        team_name=team.team_name,
        encoded_team_id_base64=team.encoded_team_id_base64,
        public_event_id=event.public_event_id,
        event_title=event.title,
        event_status=event.status.value,
    )


@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login_endpoint(
    body: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        token, admin = await admin_login(body.login, body.password, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        email=admin.email,
        display_name=admin.display_name,
        role=admin.role,
    )
