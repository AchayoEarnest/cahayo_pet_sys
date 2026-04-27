from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def generate_daily_report():
    """Nightly task: trigger daily report emails for all stations"""
    from apps.stations.models import Station
    from apps.notifications.tasks import send_daily_report_email
    from django.utils import timezone

    today = str(timezone.localdate())
    stations = Station.objects.filter(is_active=True)

    for station in stations:
        send_daily_report_email.delay(str(station.id), today)
        logger.info(f"Daily report queued for {station.code}")

    return f"Daily reports queued for {stations.count()} stations"
