import json
from typing import Dict, Set
from fastapi import WebSocket
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # team_id -> set of WebSocket connections
        self._team_connections: Dict[str, Set[WebSocket]] = {}
        # event_id -> set of WebSocket connections (scoreboard watchers)
        self._event_connections: Dict[str, Set[WebSocket]] = {}
        self.redis = None
        self._pubsub_task = None

    async def connect_team(self, websocket: WebSocket, team_id: str, event_id: str):
        await websocket.accept()
        if team_id not in self._team_connections:
            self._team_connections[team_id] = set()
        self._team_connections[team_id].add(websocket)
        if event_id not in self._event_connections:
            self._event_connections[event_id] = set()
        self._event_connections[event_id].add(websocket)

    def disconnect(self, websocket: WebSocket):
        for connections in self._team_connections.values():
            connections.discard(websocket)
        for connections in self._event_connections.values():
            connections.discard(websocket)

    async def send_to_team(self, team_id: str, message: dict):
        connections = self._team_connections.get(team_id, set())
        dead = set()
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.discard(ws)

    async def broadcast_to_event(self, event_id: str, message: dict):
        connections = self._event_connections.get(event_id, set())
        dead = set()
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        for ws in dead:
            connections.discard(ws)

    async def publish(self, channel: str, message: dict):
        """Publish a message to Redis pub/sub for fan-out across instances."""
        if self.redis:
            try:
                await self.redis.publish(channel, json.dumps(message))
            except Exception as e:
                logger.error(f"Redis publish error: {e}")
        # Also deliver locally
        await self._dispatch_local(channel, message)

    async def _dispatch_local(self, channel: str, message: dict):
        """Route message to local WebSocket connections based on channel."""
        if channel.startswith("team:"):
            team_id = channel.split(":", 1)[1]
            await self.send_to_team(team_id, message)
        elif channel.startswith("event:"):
            event_id = channel.split(":", 1)[1]
            await self.broadcast_to_event(event_id, message)

    async def start_redis_subscriber(self):
        """Start listening to Redis pub/sub in the background."""
        if not self.redis:
            return

        async def _listen():
            import redis.asyncio as aioredis
            pubsub = self.redis.pubsub()
            await pubsub.psubscribe("team:*", "event:*")
            async for message in pubsub.listen():
                if message["type"] not in ("pmessage", "message"):
                    continue
                try:
                    channel = message.get("channel", b"")
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    data = json.loads(message["data"])
                    await self._dispatch_local(channel, data)
                except Exception as e:
                    logger.error(f"Redis subscriber error: {e}")

        self._pubsub_task = asyncio.create_task(_listen())


manager = ConnectionManager()
