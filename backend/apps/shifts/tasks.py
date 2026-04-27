from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_shift_close_reminders():
    """Alert managers about shifts open for more than 12 hours"""
    from apps.shifts.models import Shift
    from apps.authentication.models import User
    from apps.notifications.tasks import send_sms
    from django.utils import timezone
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(hours=12)
    long_shifts = Shift.objects.filter(
        status="open",
        opened_at__lt=cutoff,
    ).select_related("attendant", "station")

    for shift in long_shifts:
        managers = User.objects.filter(
            station=shift.station,
            role__in=["admin", "manager"],
            is_active=True,
        ).exclude(phone="")

        message = (
            f"⚠️ SHIFT REMINDER - {shift.station.name}\n"
            f"Shift {shift.shift_number} has been open for "
            f"{shift.duration_hours:.1f} hours.\n"
            f"Attendant: {shift.attendant.get_full_name() if shift.attendant else 'Unknown'}\n"
            f"Please close the shift."
        )

        for manager in managers:
            send_sms.delay(manager.phone, message)

    return f"Sent reminders for {long_shifts.count()} long-running shifts"
