from celery import Celery
import os
from app.core.config import settings

# Configure Celery
# If REDIS_URL isn't set, default to a local redis for dev
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "jarvis_worker",
    broker=redis_url,
    backend=redis_url,
    include=['app.tasks.import_tasks', 'app.tasks.daily_tasks']
)

from celery.schedules import crontab

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_max_tasks_per_child=100,
    beat_schedule={
        'initialize-daily-targets-midnight': {
            'task': 'app.tasks.daily_tasks.initialize_daily_targets',
            'schedule': crontab(hour=0, minute=0), # runs daily at midnight UTC
        },
        'dynamic-cleanup-and-deduplication': {
            'task': 'app.tasks.daily_tasks.dynamic_cleanup_and_deduplication',
            'schedule': crontab(hour=2, minute=0), # runs at 2 AM
        },
        'generate-eod-reports': {
            'task': 'app.tasks.daily_tasks.generate_eod_reports',
            'schedule': crontab(hour=23, minute=30), # runs at 11:30 PM
        }
    }
)

if __name__ == "__main__":
    celery_app.start()
