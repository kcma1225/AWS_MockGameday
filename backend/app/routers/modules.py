from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.database import get_db
from app.deps import get_current_team_session
from app.models.module import Module
from app.models.submission import Submission, ValidationStatus
from app.models.team import Team
from app.models.event import Event
from app.schemas.module import ModuleOut
from app.schemas.submission import SubmissionIn, SubmissionOut, ModuleStatusOut
from app.services.url_validator import validate_submission_url

router = APIRouter()


@router.get("", response_model=List[ModuleOut])
async def list_modules(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    result = await db.execute(
        select(Module)
        .where(Module.event_id == team.event_id, Module.is_active == True)
        .order_by(Module.display_order)
    )
    modules = result.scalars().all()

    return [
        ModuleOut(
            id=str(m.id),
            name=m.name,
            key=m.key,
            description=m.description,
            input_schema_json=m.input_schema_json,
            evaluator_type=m.evaluator_type,
            display_order=m.display_order,
            is_active=m.is_active,
        )
        for m in modules
    ]


@router.post("/{module_id}/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_module(
    module_id: UUID,
    body: SubmissionIn,
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    # Verify module belongs to the team's event
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    module_result = await db.execute(
        select(Module).where(
            Module.id == module_id,
            Module.event_id == team.event_id,
            Module.is_active == True,
        )
    )
    module = module_result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    # Validate URL for safety (SSRF protection) and event-specific root-only rules.
    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    is_valid, error_msg, normalized = validate_submission_url(
        body.url,
        enforce_root_only=event.root_url_detection_enabled,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid URL: {error_msg}",
        )

    # Replace any existing submission for this team+module with the new one
    # This allows teams to update their URL without restrictions
    existing_result = await db.execute(
        select(Submission).where(
            Submission.team_id == team.id,
            Submission.module_id == module_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        # Update the existing submission with new URL
        existing.input_value = body.url
        existing.normalized_value = normalized
        existing.validation_status = ValidationStatus.accepted
        submission = existing
    else:
        # Create new submission if none exists
        submission = Submission(
            team_id=team.id,
            module_id=module_id,
            input_value=body.url,
            normalized_value=normalized,
            validation_status=ValidationStatus.accepted,
        )
        db.add(submission)
    
    await db.flush()

    return SubmissionOut(
        id=str(submission.id),
        module_id=str(submission.module_id),
        input_value=submission.input_value,
        normalized_value=submission.normalized_value,
        validation_status=submission.validation_status.value,
        submitted_at=submission.submitted_at,
    )


@router.get("/{module_id}/status", response_model=ModuleStatusOut)
async def get_module_status(
    module_id: UUID,
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    result = await db.execute(
        select(Submission)
        .where(Submission.team_id == team.id, Submission.module_id == module_id)
        .order_by(Submission.submitted_at.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    latest_out = None
    if latest:
        latest_out = SubmissionOut(
            id=str(latest.id),
            module_id=str(latest.module_id),
            input_value=latest.input_value,
            normalized_value=latest.normalized_value,
            validation_status=latest.validation_status.value,
            submitted_at=latest.submitted_at,
        )

    return ModuleStatusOut(
        module_id=str(module_id),
        latest_submission=latest_out,
        validation_status=latest.validation_status.value if latest else "none",
    )
