from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def check_tank_levels():
    """Periodic: Check all tanks and alert if low"""
    from .models import Tank
    from django.db.models import F

    low_tanks = Tank.objects.filter(
        status="operational",
        current_stock__lte=F("reorder_level"),
    )

    for tank in low_tanks:
        from apps.notifications.tasks import alert_low_tank_level
        alert_low_tank_level.delay(str(tank.id))
        logger.info(f"Low stock alert queued for {tank.name}")

    return f"Checked {low_tanks.count()} low tanks"
