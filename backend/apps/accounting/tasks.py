from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def run_daily_reconciliation():
    """Auto-generate daily reconciliation for all active stations"""
    from apps.stations.models import Station
    from django.utils import timezone

    yesterday = (timezone.now() - timezone.timedelta(days=1)).date()
    stations = Station.objects.filter(is_active=True)

    for station in stations:
        try:
            from apps.notifications.tasks import send_daily_report_email
            send_daily_report_email.delay(str(station.id), str(yesterday))
            logger.info(f"Daily reconciliation triggered for {station.code} on {yesterday}")
        except Exception as e:
            logger.error(f"Reconciliation error for {station.code}: {e}")

    return f"Reconciliation run for {stations.count()} stations on {yesterday}"
