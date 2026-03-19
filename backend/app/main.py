from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import auth, events, teams, modules, score_events, scoreboard, readme, admin, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    import redis.asyncio as aioredis
    from app.services.websocket_manager import manager
    from app.database import AsyncSessionLocal
    from app.models.admin_user import AdminUser
    from app.services.auth_service import hash_password
    from sqlalchemy import select

    manager.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    # Auto-create default admin if none exists
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AdminUser).limit(1))
        if result.scalar_one_or_none() is None:
            db.add(AdminUser(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                display_name=settings.DEFAULT_ADMIN_NAME,
                role="super_admin",
                is_active=True,
            ))
            await db.commit()

    yield
    # Shutdown
    if manager.redis:
        await manager.redis.aclose()


app = FastAPI(
    title="GameDay Platform",
    version="1.0.0",
    description="AWS GameDay-style infrastructure challenge platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(modules.router, prefix="/api/modules", tags=["modules"])
app.include_router(score_events.router, prefix="/api/score-events", tags=["score-events"])
app.include_router(scoreboard.router, prefix="/api/scoreboard", tags=["scoreboard"])
app.include_router(readme.router, prefix="/api/readme", tags=["readme"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(ws.router, tags=["websocket"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
