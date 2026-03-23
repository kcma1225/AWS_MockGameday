"""
Scoring worker: evaluates team endpoints and generates score events.
"""
import asyncio
import time
import logging
from uuid import UUID

import httpx
from sqlalchemy import select

from app.workers.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.score_event import ScoreEvent
from app.models.team import Team
from app.services.scoring_service import build_http_score_event, apply_score_event

logger = logging.getLogger(__name__)


async def _check_and_score(
    team_id: str,
    module_id: str,
    event_id: str,
    url: str | None,
    module_name: str,
    challenge_token: str,
    timeout_ms: int = 5000,
):
    """Perform HTTP check and write score event to database."""
    latency_ms = None
    status_code = None
    error = None

    if not url:
        error = "No endpoint submitted"
    else:
        try:
            start = time.monotonic()
            async with httpx.AsyncClient(
                timeout=timeout_ms / 1000,
                follow_redirects=False,
            ) as client:
                response = await client.get(
                    url,
                    headers={"X-Gameday-Token": challenge_token},
                )
                latency_ms = (time.monotonic() - start) * 1000
                status_code = response.status_code
        except httpx.TimeoutException:
            error = f"Request timeout after {timeout_ms} ms"
        except httpx.ConnectError as e:
            error = f"Connection error: {str(e)[:100]}"
        except Exception as e:
            error = f"Unexpected error: {str(e)[:100]}"

    score_fields = build_http_score_event(
        event_id=UUID(event_id),
        team_id=UUID(team_id),
        module_id=UUID(module_id),
        module_name=module_name,
        latency_ms=latency_ms,
        status_code=status_code,
        error=error,
    )

    async with AsyncSessionLocal() as db:
        try:
            se = ScoreEvent(**score_fields)
            db.add(se)
            await db.flush()

            updated_team = await apply_score_event(se, db)
            await db.commit()

            logger.info(
                f"Scored team {team_id} module {module_name}: {score_fields['points']} pts | {score_fields['reason']}"
            )

            # Push WebSocket notification
            from app.services.websocket_manager import manager
            await manager.publish(
                f"team:{team_id}",
                {
                    "type": "team.score.updated",
                    "score_total": updated_team.score_total,
                    "trend_value": updated_team.trend_value,
                    "rank": updated_team.rank_cache,
                    "score_event": {
                        "id": str(se.id),
                        "points": se.points,
                        "source": se.source,
                        "reason": se.reason,
                        "category": se.category,
                        "timestamp_ms": se.timestamp_ms,
                    },
                },
            )
            await manager.publish(
                f"event:{event_id}",
                {"type": "scoreboard.updated"},
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"Error saving score event: {e}")
            raise


@celery_app.task(name="app.workers.scoring_worker.check_endpoint", bind=True, max_retries=2)
def check_endpoint(
    self,
    team_id: str,
    module_id: str,
    event_id: str,
    url: str | None,
    module_name: str,
    challenge_token: str,
    timeout_ms: int = 5000,
):
    """Celery task: check a team's endpoint and record a score event."""
    try:
        asyncio.run(
            _check_and_score(
                team_id=team_id,
                module_id=module_id,
                event_id=event_id,
                url=url,
                module_name=module_name,
                challenge_token=challenge_token,
                timeout_ms=timeout_ms,
            )
        )
    except Exception as exc:
        logger.error(f"Scoring task failed for team {team_id}: {exc}")
        try:
            raise self.retry(exc=exc, countdown=5)
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for team {team_id} module {module_name}")
