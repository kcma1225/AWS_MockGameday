from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.services.websocket_manager import manager
from app.database import AsyncSessionLocal
from app.models.session import Session as TeamSession
from app.models.team import Team
from uuid import UUID
from datetime import datetime, timezone

router = APIRouter()


async def authenticate_ws(token: str) -> tuple[str, str] | None:
    """Validate a team JWT token and return (team_id, event_id) or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

    if payload.get("type") != "team":
        return None

    session_id = payload.get("session_id")
    if not session_id:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TeamSession).where(
                TeamSession.id == UUID(session_id),
                TeamSession.revoked_at.is_(None),
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            return None

        if session.expires_at < datetime.now(timezone.utc):
            return None

        team_result = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_result.scalar_one_or_none()
        if not team:
            return None

        return str(team.id), str(team.event_id)


@router.websocket("/ws/team")
async def team_ws(websocket: WebSocket, token: str = Query(...)):
    result = await authenticate_ws(token)
    if not result:
        await websocket.close(code=4001)
        return

    team_id, event_id = result
    await manager.connect_team(websocket, team_id, event_id)

    try:
        while True:
            # Keep connection alive, handle ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.websocket("/ws/scoreboard")
async def scoreboard_ws(websocket: WebSocket, token: str = Query(...)):
    result = await authenticate_ws(token)
    if not result:
        await websocket.close(code=4001)
        return

    team_id, event_id = result
    # Register as event-level connection for scoreboard updates
    await manager.connect_team(websocket, team_id, event_id)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
