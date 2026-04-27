"""
Notification Tasks
SMS via Africa's Talking, Email via SMTP
"""

import logging
from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_sms_client():
    import africastalking
    africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
    return africastalking.SMS


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_sms(self, phone_number: str, message: str):
    """Send SMS via Africa's Talking"""
    try:
        sms = get_sms_client()
        response = sms.send(message, [phone_number])
        logger.info(f"SMS sent to {phone_number}: {response}")
        return response
    except Exception as exc:
        logger.error(f"SMS failed to {phone_number}: {exc}")
        raise self.retry(exc=exc)


@shared_task
def send_mpesa_confirmation_sms(phone_number: str, amount: float, receipt: str):
    """Send M-Pesa payment confirmation to customer"""
    message = (
        f"Cahayo FMS: Payment of KES {amount:,.0f} received. "
        f"Ref: {receipt}. Thank you for fueling with us!"
    )
    send_sms.delay(phone_number, message)


@shared_task
def alert_low_tank_level(tank_id: str):
    """Alert managers when tank stock hits reorder level"""
    from apps.tanks.models import Tank
    from apps.authentication.models import User

    try:
        tank = Tank.objects.select_related("station", "fuel_type").get(id=tank_id)
        managers = User.objects.filter(
            station=tank.station,
            role__in=["admin", "manager"],
            is_active=True,
            phone__isnull=False,
        ).exclude(phone="")

        message = (
            f"⚠️ LOW STOCK ALERT - {tank.station.name}\n"
            f"Tank: {tank.name} ({tank.fuel_type.name})\n"
            f"Current Stock: {tank.current_stock:,.0f}L "
            f"({tank.fill_percentage:.1f}% full)\n"
            f"Reorder Level: {tank.reorder_level:,.0f}L\n"
            f"Action required immediately."
        )

        for manager in managers:
            send_sms.delay(manager.phone, message)

        logger.info(f"Low stock alerts sent for {tank.name}")

    except Exception as e:
        logger.error(f"Low stock alert error: {e}", exc_info=True)


@shared_task
def alert_shift_variance(shift_id: str):
    """Alert managers about significant shift variance"""
    from apps.shifts.models import Shift
    from apps.authentication.models import User

    try:
        shift = Shift.objects.select_related("station", "attendant").get(id=shift_id)
        managers = User.objects.filter(
            station=shift.station,
            role__in=["admin", "manager"],
            is_active=True,
            phone__isnull=False,
        ).exclude(phone="")

        message = (
            f"🚨 SHIFT VARIANCE ALERT - {shift.station.name}\n"
            f"Shift: {shift.shift_number}\n"
            f"Attendant: {shift.attendant.get_full_name() if shift.attendant else 'Unknown'}\n"
            f"Variance: KES {shift.revenue_variance:,.2f} ({shift.variance_percentage:.2f}%)\n"
            f"Reason: {shift.flag_reason}\n"
            f"Please investigate immediately."
        )

        for manager in managers:
            send_sms.delay(manager.phone, message)

        logger.info(f"Variance alert sent for shift {shift.shift_number}")

    except Exception as e:
        logger.error(f"Shift variance alert error: {e}", exc_info=True)


@shared_task
def send_daily_report_email(station_id: str, report_date: str):
    """Email daily report to managers and accountants"""
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string
    from apps.stations.models import Station
    from apps.authentication.models import User

    try:
        station = Station.objects.get(id=station_id)
        recipients = User.objects.filter(
            station=station,
            role__in=["admin", "manager", "accountant"],
            is_active=True,
        ).exclude(email="").values_list("email", flat=True)

        if not recipients:
            return

        # Build report data
        from apps.shifts.models import Shift
        from django.db.models import Sum, Count
        shifts = Shift.objects.filter(station=station, shift_date=report_date)
        summary = shifts.aggregate(
            total_revenue=Sum("actual_revenue"),
            total_litres=Sum("total_litres_sold"),
            total_shifts=Count("id"),
            flagged=Count("id", filter={"is_flagged": True}),
        )

        subject = f"Cahayo Daily Report - {station.name} - {report_date}"
        text_content = (
            f"Daily Sales Report: {station.name}\n"
            f"Date: {report_date}\n"
            f"Total Revenue: KES {summary.get('total_revenue') or 0:,.2f}\n"
            f"Total Litres: {summary.get('total_litres') or 0:,.3f}L\n"
            f"Total Shifts: {summary.get('total_shifts') or 0}\n"
            f"Flagged Shifts: {summary.get('flagged') or 0}\n"
        )

        email = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            list(recipients),
        )
        email.send()
        logger.info(f"Daily report emailed for {station.name} on {report_date}")

    except Exception as e:
        logger.error(f"Daily report email error: {e}", exc_info=True)


@shared_task
def check_tank_levels():
    """Periodic task: Check all tank levels and alert if low"""
    from apps.tanks.models import Tank

    low_tanks = Tank.objects.filter(
        status="operational",
        current_stock__lte=models.F("reorder_level"),
    ).select_related("station", "fuel_type")

    for tank in low_tanks:
        alert_low_tank_level.delay(str(tank.id))
