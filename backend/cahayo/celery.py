"""Cahayo Celery Configuration"""

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cahayo.settings")

app = Celery("cahayo")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Periodic tasks
app.conf.beat_schedule = {
    # Generate nightly reports at 23:55 Nairobi time
    "nightly-report": {
        "task": "apps.reports.tasks.generate_daily_report",
        "schedule": crontab(hour=23, minute=55),
    },
    # Check tank levels every 2 hours
    "tank-level-check": {
        "task": "apps.tanks.tasks.check_tank_levels",
        "schedule": crontab(minute=0, hour="*/2"),
    },
    # Retry failed M-Pesa transactions every 10 minutes
    "mpesa-retry": {
        "task": "apps.mpesa.tasks.retry_failed_transactions",
        "schedule": crontab(minute="*/10"),
    },
    # Shift auto-close reminder at shift end
    "shift-reminder": {
        "task": "apps.shifts.tasks.send_shift_close_reminders",
        "schedule": crontab(minute="*/30"),
    },
    # Daily reconciliation at 1 AM
    "daily-reconciliation": {
        "task": "apps.accounting.tasks.run_daily_reconciliation",
        "schedule": crontab(hour=1, minute=0),
    },
}

app.conf.timezone = "Africa/Nairobi"
