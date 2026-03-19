from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.deps import get_current_team_session
from app.models.team import Team
from app.models.event import Event

router = APIRouter()


class ReadmeOut(BaseModel):
    readme_markdown: Optional[str]
    runbook_markdown: Optional[str]
    event_title: str


@router.get("", response_model=ReadmeOut)
async def get_readme(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    return ReadmeOut(
        readme_markdown=event.readme_markdown,
        runbook_markdown=event.runbook_markdown,
        event_title=event.title,
    )
