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
)
celery_app.autodiscover_tasks(["api"])
