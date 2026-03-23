import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from uuid import UUID
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.deps import get_current_admin
from app.models.event import Event, EventStatus, default_testing_rounds
from app.models.team import Team
from app.models.module import Module
from app.models.score_event import ScoreEvent
from app.models.admin_user import AdminUser
from app.schemas.admin import (
    AdminEventCreate,
    AdminEventUpdate,
    AdminTeamBulkCreate,
    AdminTeamOut,
    AdminModuleCreate,
    AdminModuleUpdate,
    AdminScoreEventCreate,
    AdminChallengeRoundCreate,
    AdminChallengeRoundTrigger,
    AdminEventOut,
    AdminUserCreate,
)
from app.services.auth_service import hash_code, generate_team_code, hash_password
from app.services.scoring_service import apply_score_event, recalculate_event_rankings
from app.services.websocket_manager import manager

router = APIRouter()


async def _generate_unique_challenge_token(db: AsyncSession) -> str:
    while True:
        candidate = secrets.token_hex(24)
        existing = await db.execute(select(Team.id).where(Team.challenge_token == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate


def _public_event_id(title: str, event_id: str) -> str:
    suffix = str(event_id)[:8].upper()
    prefix = "".join(c for c in title.upper() if c.isalnum())[:8]
    return f"{prefix}-{suffix}"


def _normalize_testing_rounds(rounds: list[dict] | None) -> list[dict[str, int | str]]:
    if not rounds:
        return default_testing_rounds()

    normalized = []
    for idx, round_cfg in enumerate(rounds):
        try:
            validated = AdminChallengeRoundCreate.model_validate(round_cfg)
            normalized.append(validated.model_dump())
        except Exception:
            normalized.append(
                {
                    "name": f"Round {idx + 1}",
                    "requests_per_second": 1,
                    "duration_seconds": 1,
                }
            )
    return normalized


def _resolve_trigger_round(
    rounds: list[dict[str, int | str]],
    body: AdminChallengeRoundTrigger | None,
) -> dict[str, int | str]:
    if body and body.round_index is not None:
        if body.round_index >= len(rounds):
            raise HTTPException(status_code=400, detail="Invalid round_index")
        return rounds[body.round_index]

    if body and (body.requests_per_second is not None or body.duration_seconds is not None):
        if body.requests_per_second is None or body.duration_seconds is None:
            raise HTTPException(
                status_code=400,
                detail="Both requests_per_second and duration_seconds are required for a custom trigger",
            )
        validated = AdminChallengeRoundCreate(
            name="Custom",
            requests_per_second=body.requests_per_second,
            duration_seconds=body.duration_seconds,
        )
        return validated.model_dump()

    # Backward-compatible default trigger behavior.
    return {"name": "Single Shot", "requests_per_second": 1, "duration_seconds": 1}


# -------------------------
# Admin user management
# -------------------------

@router.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    body: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Bootstrap endpoint: create first admin. Subsequent admins require auth."""
    count_result = await db.execute(select(func.count()).select_from(AdminUser))
    count = count_result.scalar()

    existing = await db.execute(select(AdminUser).where(AdminUser.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    admin = AdminUser(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        role=body.role,
    )
    db.add(admin)
    await db.flush()
    return {"id": str(admin.id), "email": admin.email, "display_name": admin.display_name}


# -------------------------
# Event management
# -------------------------

@router.get("/events", response_model=List[AdminEventOut])
async def list_events(
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).order_by(desc(Event.created_at)))
    events = result.scalars().all()

    out = []
    for ev in events:
        count_result = await db.execute(
            select(func.count()).select_from(Team).where(Team.event_id == ev.id)
        )
        team_count = count_result.scalar() or 0
        out.append(
            AdminEventOut(
                id=str(ev.id),
                public_event_id=ev.public_event_id,
                title=ev.title,
                slug=ev.slug,
                description=ev.description,
                status=ev.status.value,
                start_time=ev.start_time,
                end_time=ev.end_time,
                timezone=ev.timezone,
                scoreboard_public=ev.scoreboard_public,
                root_url_detection_enabled=ev.root_url_detection_enabled,
                shared_folder_enabled=ev.shared_folder_enabled,
                show_aws_console_button=ev.show_aws_console_button,
                show_ssh_key_button=ev.show_ssh_key_button,
                readme_markdown=ev.readme_markdown,
                runbook_markdown=ev.runbook_markdown,
                testing_rounds=_normalize_testing_rounds(ev.testing_rounds),
                created_at=ev.created_at,
                updated_at=ev.updated_at,
                team_count=team_count,
            )
        )
    return out


@router.post("/events", response_model=AdminEventOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: AdminEventCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check slug uniqueness
    existing = await db.execute(select(Event).where(Event.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already in use")

    event = Event(
        title=body.title,
        slug=body.slug,
        public_event_id="",  # Will be set after flush
        description=body.description,
        status=EventStatus.draft,
        start_time=body.start_time,
        end_time=body.end_time,
        timezone=body.timezone,
        readme_markdown=body.readme_markdown or "# Challenge\n\nAdmin will provide a default binary server file for setup.\nAfter deployment, submit one service URL and keep it healthy with low latency.\n\nScoring:\n- Failed request: -5 points\n- Success: points based on latency (lower is better)",
        runbook_markdown=None,
        scoreboard_public=body.scoreboard_public,
        root_url_detection_enabled=body.root_url_detection_enabled,
        shared_folder_enabled=body.shared_folder_enabled,
        show_aws_console_button=body.show_aws_console_button,
        show_ssh_key_button=body.show_ssh_key_button,
        created_by_admin_id=admin.id,
    )
    db.add(event)
    await db.flush()
    event.public_event_id = _public_event_id(body.title, str(event.id))

    # Simplified game model: one default challenge module per event.
    default_module = Module(
        event_id=event.id,
        name="Service Endpoint",
        key="service_endpoint",
        description="Submit one URL for request/response validation and latency scoring.",
        evaluator_type="http",
        display_order=0,
        is_active=True,
    )
    db.add(default_module)

    return AdminEventOut(
        id=str(event.id),
        public_event_id=event.public_event_id,
        title=event.title,
        slug=event.slug,
        description=event.description,
        status=event.status.value,
        start_time=event.start_time,
        end_time=event.end_time,
        timezone=event.timezone,
        scoreboard_public=event.scoreboard_public,
        root_url_detection_enabled=event.root_url_detection_enabled,
        shared_folder_enabled=event.shared_folder_enabled,
        show_aws_console_button=event.show_aws_console_button,
        show_ssh_key_button=event.show_ssh_key_button,
        readme_markdown=event.readme_markdown,
        runbook_markdown=event.runbook_markdown,
        testing_rounds=_normalize_testing_rounds(event.testing_rounds),
        created_at=event.created_at,
        updated_at=event.updated_at,
        team_count=0,
    )


@router.get("/events/{event_id}", response_model=AdminEventOut)
async def get_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.event_id == event.id)
    )
    team_count = count_result.scalar() or 0

    return AdminEventOut(
        id=str(event.id),
        public_event_id=event.public_event_id,
        title=event.title,
        slug=event.slug,
        description=event.description,
        status=event.status.value,
        start_time=event.start_time,
        end_time=event.end_time,
        timezone=event.timezone,
        scoreboard_public=event.scoreboard_public,
        root_url_detection_enabled=event.root_url_detection_enabled,        shared_folder_enabled=event.shared_folder_enabled,        show_aws_console_button=event.show_aws_console_button,
        show_ssh_key_button=event.show_ssh_key_button,
        readme_markdown=event.readme_markdown,
        runbook_markdown=event.runbook_markdown,
        testing_rounds=_normalize_testing_rounds(event.testing_rounds),
        created_at=event.created_at,
        updated_at=event.updated_at,
        team_count=team_count,
    )


@router.patch("/events/{event_id}", response_model=AdminEventOut)
async def update_event(
    event_id: UUID,
    body: AdminEventUpdate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(event, field, value)
    event.updated_at = datetime.now(timezone.utc)

    await db.flush()

    count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.event_id == event.id)
    )

    return AdminEventOut(
        id=str(event.id),
        public_event_id=event.public_event_id,
        title=event.title,
        slug=event.slug,
        description=event.description,
        status=event.status.value,
        start_time=event.start_time,
        end_time=event.end_time,
        timezone=event.timezone,
        scoreboard_public=event.scoreboard_public,
        root_url_detection_enabled=event.root_url_detection_enabled,
        shared_folder_enabled=event.shared_folder_enabled,
        show_aws_console_button=event.show_aws_console_button,
        show_ssh_key_button=event.show_ssh_key_button,
        readme_markdown=event.readme_markdown,
        runbook_markdown=event.runbook_markdown,
        testing_rounds=_normalize_testing_rounds(event.testing_rounds),
        created_at=event.created_at,
        updated_at=event.updated_at,
        team_count=count_result.scalar() or 0,
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    import shutil
    from pathlib import Path

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Delete shared folder if it exists
    shared_folder = Path("shared_folders") / str(event_id)
    if shared_folder.exists():
        shutil.rmtree(shared_folder)

    await db.delete(event)
    await db.flush()
    return None


async def _change_event_status(event_id: UUID, new_status: EventStatus, db: AsyncSession, admin) -> dict:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.status = new_status
    event.updated_at = datetime.now(timezone.utc)

    # Broadcast event status change via WebSocket
    await manager.publish(
        f"event:{str(event_id)}",
        {"type": "event.status.changed", "status": new_status.value},
    )

    return {"id": str(event.id), "status": new_status.value}


@router.post("/events/{event_id}/start")
async def start_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _change_event_status(event_id, EventStatus.live, db, admin)


@router.post("/events/{event_id}/pause")
async def pause_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _change_event_status(event_id, EventStatus.paused, db, admin)


@router.post("/events/{event_id}/resume")
async def resume_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _change_event_status(event_id, EventStatus.live, db, admin)


@router.post("/events/{event_id}/end")
async def end_event(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _change_event_status(event_id, EventStatus.ended, db, admin)


# -------------------------
# Content management
# -------------------------

@router.post("/events/{event_id}/content/readme")
async def upload_readme(
    event_id: UUID,
    body: dict,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.readme_markdown = body.get("content", "")
    event.updated_at = datetime.now(timezone.utc)
    return {"status": "updated"}


@router.post("/events/{event_id}/content/runbook")
async def upload_runbook(
    event_id: UUID,
    body: dict,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.runbook_markdown = body.get("content", "")
    event.updated_at = datetime.now(timezone.utc)
    return {"status": "updated"}


# -------------------------
# Team management
# -------------------------

@router.post("/events/{event_id}/teams/bulk", response_model=List[AdminTeamOut], status_code=status.HTTP_201_CREATED)
async def create_teams_bulk(
    event_id: UUID,
    body: AdminTeamBulkCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get current team count for numbering
    count_result = await db.execute(
        select(func.count()).select_from(Team).where(Team.event_id == event_id)
    )
    existing_count = count_result.scalar() or 0

    created_teams = []
    for i, team_name in enumerate(body.team_names, start=existing_count + 1):
        login_code = generate_team_code()
        public_team_id = f"TEAM-{i:03d}"
        encoded = Team.make_encoded_id(public_team_id)

        team = Team(
            event_id=event_id,
            public_team_id=public_team_id,
            encoded_team_id_base64=encoded,
            team_code_hash=hash_code(login_code),
            team_code_plaintext=login_code,
            challenge_token=await _generate_unique_challenge_token(db),
            team_name=team_name,
        )
        db.add(team)
        await db.flush()

        created_teams.append(
            AdminTeamOut(
                id=str(team.id),
                public_team_id=team.public_team_id,
                team_name=team.team_name,
                encoded_team_id_base64=team.encoded_team_id_base64,
                login_code=login_code,
                score_total=team.score_total,
                trend_value=team.trend_value,
                rank_cache=team.rank_cache,
                is_active=team.is_active,
                created_at=team.created_at,
            )
        )

    return created_teams


@router.get("/events/{event_id}/teams", response_model=List[AdminTeamOut])
async def list_teams(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).where(Team.event_id == event_id).order_by(Team.created_at)
    )
    teams = result.scalars().all()

    return [
        AdminTeamOut(
            id=str(t.id),
            public_team_id=t.public_team_id,
            team_name=t.team_name,
            encoded_team_id_base64=t.encoded_team_id_base64,
            login_code=t.team_code_plaintext,
            score_total=t.score_total,
            trend_value=t.trend_value,
            rank_cache=t.rank_cache,
            is_active=t.is_active,
            created_at=t.created_at,
        )
        for t in teams
    ]


@router.post("/events/{event_id}/teams/{team_id}/regenerate-code")
async def regenerate_team_code(
    event_id: UUID,
    team_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.event_id == event_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    new_code = generate_team_code()
    team.team_code_hash = hash_code(new_code)
    team.team_code_plaintext = new_code

    return {"team_id": str(team.id), "new_login_code": new_code, "login_code": new_code}


@router.patch("/events/{event_id}/teams/{team_id}")
async def update_team(
    event_id: UUID,
    team_id: UUID,
    body: dict,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.event_id == event_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if "is_active" in body:
        team.is_active = body["is_active"]
    if "team_name" in body:
        team.team_name = body["team_name"]

    return {"id": str(team.id), "is_active": team.is_active}


@router.delete("/events/{event_id}/teams/{team_id}")
async def delete_team(
    event_id: UUID,
    team_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.event_id == event_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    await db.delete(team)

    return {"status": "deleted", "id": str(team_id)}


# -------------------------
# Module management
# -------------------------

@router.post("/events/{event_id}/modules", status_code=status.HTTP_201_CREATED)
async def create_module(
    event_id: UUID,
    body: AdminModuleCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    module = Module(
        event_id=event_id,
        name=body.name,
        key=body.key,
        description=body.description,
        evaluator_type=body.evaluator_type,
        display_order=body.display_order,
        input_schema_json=body.input_schema_json,
    )
    db.add(module)
    await db.flush()

    return {
        "id": str(module.id),
        "name": module.name,
        "key": module.key,
        "evaluator_type": module.evaluator_type,
    }


@router.patch("/events/{event_id}/modules/{module_id}")
async def update_module(
    event_id: UUID,
    module_id: UUID,
    body: AdminModuleUpdate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Module).where(Module.id == module_id, Module.event_id == event_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(module, field, value)

    return {"id": str(module.id), "name": module.name}


# -------------------------
# Scoring controls
# -------------------------

@router.get("/events/{event_id}/challenge-rounds")
async def list_challenge_rounds(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rounds = _normalize_testing_rounds(event.testing_rounds)
    if event.testing_rounds != rounds:
        event.testing_rounds = rounds

    return {"rounds": rounds}


@router.post("/events/{event_id}/challenge-rounds", status_code=status.HTTP_201_CREATED)
async def create_challenge_round(
    event_id: UUID,
    body: AdminChallengeRoundCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rounds = _normalize_testing_rounds(event.testing_rounds)
    if len(rounds) >= 50:
        raise HTTPException(status_code=400, detail="Maximum 50 testing rounds per event")

    rounds.append(body.model_dump())
    event.testing_rounds = rounds
    event.updated_at = datetime.now(timezone.utc)

    return {"rounds": rounds, "added": body.model_dump()}


@router.patch("/events/{event_id}/challenge-rounds/{round_index}")
async def update_challenge_round(
    event_id: UUID,
    round_index: int,
    body: AdminChallengeRoundCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if round_index < 0:
        raise HTTPException(status_code=400, detail="round_index must be 0 or greater")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rounds = _normalize_testing_rounds(event.testing_rounds)
    if round_index >= len(rounds):
        raise HTTPException(status_code=404, detail="Challenge round not found")

    rounds[round_index] = body.model_dump()
    event.testing_rounds = rounds
    event.updated_at = datetime.now(timezone.utc)

    return {"rounds": rounds, "updated": body.model_dump(), "round_index": round_index}


@router.delete("/events/{event_id}/challenge-rounds/{round_index}")
async def delete_challenge_round(
    event_id: UUID,
    round_index: int,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if round_index < 0:
        raise HTTPException(status_code=400, detail="round_index must be 0 or greater")

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rounds = _normalize_testing_rounds(event.testing_rounds)
    if round_index >= len(rounds):
        raise HTTPException(status_code=404, detail="Challenge round not found")
    if len(rounds) <= 1:
        raise HTTPException(status_code=400, detail="At least one testing round is required")

    removed = rounds.pop(round_index)
    event.testing_rounds = rounds
    event.updated_at = datetime.now(timezone.utc)

    return {"rounds": rounds, "deleted": removed, "round_index": round_index}

@router.post("/events/{event_id}/challenge-round")
async def trigger_challenge_round(
    event_id: UUID,
    body: AdminChallengeRoundTrigger | None = None,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a challenge round: dispatch checks at configured RPS for a configured duration."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status not in (EventStatus.live,):
        raise HTTPException(status_code=400, detail="Event must be live to trigger a challenge round")

    # Get active modules
    modules_result = await db.execute(
        select(Module).where(Module.event_id == event_id, Module.is_active == True)
    )
    modules = modules_result.scalars().all()

    # Get active teams
    teams_result = await db.execute(
        select(Team).where(Team.event_id == event_id, Team.is_active == True)
    )
    teams = teams_result.scalars().all()

    rounds = _normalize_testing_rounds(event.testing_rounds)
    if event.testing_rounds != rounds:
        event.testing_rounds = rounds

    round_cfg = _resolve_trigger_round(rounds, body)
    requests_per_second = int(round_cfg["requests_per_second"])
    duration_seconds = int(round_cfg["duration_seconds"])
    per_endpoint_requests = requests_per_second * duration_seconds

    # Dispatch tasks
    from app.workers.celery_app import celery_app
    from app.models.submission import Submission

    latest_submission_map: dict[tuple[UUID, UUID], str | None] = {}
    for module in modules:
        for team in teams:
            sub_result = await db.execute(
                select(Submission)
                .where(
                    Submission.team_id == team.id,
                    Submission.module_id == module.id,
                    Submission.validation_status == "accepted",
                )
                .order_by(Submission.submitted_at.desc())
                .limit(1)
            )
            submission = sub_result.scalar_one_or_none()
            latest_submission_map[(module.id, team.id)] = (
                submission.normalized_value if submission else None
            )

    dispatched = 0
    for second_offset in range(duration_seconds):
        for _ in range(requests_per_second):
            for module in modules:
                for team in teams:
                    celery_app.send_task(
                        "app.workers.scoring_worker.check_endpoint",
                        kwargs={
                            "team_id": str(team.id),
                            "module_id": str(module.id),
                            "event_id": str(event_id),
                            "url": latest_submission_map[(module.id, team.id)],
                            "module_name": module.name,
                            "challenge_token": team.challenge_token,
                        },
                        queue="scoring",
                        countdown=second_offset,
                    )
                    dispatched += 1

    return {
        "round_name": str(round_cfg["name"]),
        "requests_per_second": requests_per_second,
        "duration_seconds": duration_seconds,
        "per_endpoint_requests": per_endpoint_requests,
        "tasks_dispatched": dispatched,
        "dispatched_tasks": dispatched,
        "teams": len(teams),
        "modules": len(modules),
    }


@router.post("/score-events/manual")
async def create_manual_score_event(
    body: AdminScoreEventCreate,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually award or deduct points for a team."""
    import time
    from datetime import datetime, timezone

    team_result = await db.execute(select(Team).where(Team.id == UUID(body.team_id)))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    se = ScoreEvent(
        event_id=team.event_id,
        team_id=team.id,
        module_id=UUID(body.module_id) if body.module_id else None,
        timestamp_ms=int(time.time() * 1000),
        occurred_at=datetime.now(timezone.utc),
        points=body.points,
        source=body.source,
        reason=body.reason,
        category=body.category,
    )
    db.add(se)
    await db.flush()

    updated_team = await apply_score_event(se, db)

    await manager.publish(
        f"team:{str(team.id)}",
        {
            "type": "team.score.updated",
            "score_total": updated_team.score_total,
            "trend_value": updated_team.trend_value,
            "rank": updated_team.rank_cache,
        },
    )
    await manager.publish(
        f"event:{str(team.event_id)}",
        {"type": "scoreboard.updated"},
    )

    return {"id": str(se.id), "points": se.points, "source": se.source}


# -------------------------
# Admin Event Scoreboard
# -------------------------

@router.get("/events/{event_id}/scoreboard")
async def admin_get_event_scoreboard(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return ranked teams for an event (admin view, no team auth needed)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    teams_result = await db.execute(
        select(Team)
        .where(Team.event_id == event_id, Team.is_active == True)
        .order_by(desc(Team.score_total))
    )
    teams = teams_result.scalars().all()

    from app.models.score_event import ScoreEvent as SE
    rows = []
    for rank_idx, t in enumerate(teams, start=1):
        last_result = await db.execute(
            select(SE.occurred_at)
            .where(SE.team_id == t.id)
            .order_by(desc(SE.occurred_at))
            .limit(1)
        )
        last_score_at = last_result.scalar_one_or_none()
        rows.append({
            "rank": t.rank_cache or rank_idx,
            "team_id": str(t.id),
            "team_name": t.team_name,
            "public_team_id": t.public_team_id,
            "score_total": t.score_total,
            "trend_value": t.trend_value,
            "is_active": t.is_active,
            "last_score_at": last_score_at.isoformat() if last_score_at else None,
        })

    return {"updated_at": datetime.now(timezone.utc).isoformat(), "rows": rows}


# -------------------------
# Admin Event Score Events
# -------------------------

@router.get("/events/{event_id}/score-events")
async def admin_get_event_score_events(
    event_id: UUID,
    page: int = 1,
    page_size: int = 100,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return all score events for all teams in an event (admin view)."""
    from app.models.score_event import ScoreEvent as SE

    base_query = (
        select(SE, Team.team_name)
        .join(Team, SE.team_id == Team.id)
        .where(SE.event_id == event_id)
    )

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    items_result = await db.execute(
        base_query.order_by(desc(SE.occurred_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = items_result.all()

    return {
        "items": [
            {
                "id": str(e.id),
                "team_id": str(e.team_id),
                "team_name": team_name,
                "timestamp_ms": e.timestamp_ms,
                "points": e.points,
                "source": e.source,
                "reason": e.reason,
                "category": e.category,
            }
            for e, team_name in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
    }
