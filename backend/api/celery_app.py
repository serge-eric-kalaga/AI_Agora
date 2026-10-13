"""Configuration du worker réservé aux orchestrations IA longues."""

from celery import Celery

from api.configs import get_settings

settings = get_settings()
celery_app = Celery("ai_agora", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "recover-active-rooms": {
            "task": "api.tasks.recover_active_rooms",
            "schedule": settings.room_recovery_interval_seconds,
        }
    },
)
celery_app.autodiscover_tasks(["api"])
