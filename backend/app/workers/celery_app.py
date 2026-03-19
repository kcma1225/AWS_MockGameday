from celery import Celery
from app.config import settings

celery_app = Celery(
    "gameday",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.scoring_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.scoring_worker.*": {"queue": "scoring"},
    },
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
