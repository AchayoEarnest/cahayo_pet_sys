"""
M-Pesa Celery Tasks
Async processing of M-Pesa callbacks, retries, and status checks
"""

import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger("apps.mpesa")


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_stk_callback_task(self, payload: dict, station_id: str):
    """
    Process STK Push callback asynchronously
    Celery handles retries on failure
    """
    from apps.mpesa.models import MpesaTransaction
    from apps.mpesa.services import daraja_service, MpesaCallbackError

    try:
        result = daraja_service.process_stk_callback(payload)

        # Find the pending transaction
        try:
            txn = MpesaTransaction.objects.get(
                checkout_request_id=result["checkout_request_id"]
            )
        except MpesaTransaction.DoesNotExist:
            logger.error(f"MpesaTransaction not found for checkout_request_id: {result.get('checkout_request_id')}")
            return {"error": "Transaction not found"}

        txn.callback_payload = payload
        txn.result_code = result["result_code"]
        txn.result_desc = result["result_desc"]
        txn.completed_at = timezone.now()

        if result["success"]:
            txn.status = MpesaTransaction.Status.SUCCESS
            txn.mpesa_receipt_number = result["mpesa_receipt_number"]
            txn.save()

            # Link to sale transaction if exists
            link_mpesa_to_transaction.delay(str(txn.id))

            # Send SMS confirmation
            from apps.notifications.tasks import send_mpesa_confirmation_sms
            send_mpesa_confirmation_sms.delay(
                txn.phone_number,
                float(txn.amount),
                txn.mpesa_receipt_number,
            )

            logger.info(f"M-Pesa payment confirmed: {txn.mpesa_receipt_number} KES {txn.amount}")
        else:
            txn.status = MpesaTransaction.Status.FAILED
            txn.save()
            logger.warning(f"M-Pesa payment failed: code={result['result_code']} desc={result['result_desc']}")

        return {"status": txn.status, "receipt": txn.mpesa_receipt_number}

    except MpesaCallbackError as exc:
        logger.error(f"Callback processing error: {exc}")
        raise self.retry(exc=exc, countdown=60)
    except Exception as exc:
        logger.error(f"Unexpected error in STK callback task: {exc}", exc_info=True)
        raise


@shared_task
def link_mpesa_to_transaction(mpesa_transaction_id: str):
    """Link M-Pesa payment to a sales transaction"""
    from apps.mpesa.models import MpesaTransaction
    from apps.transactions.models import Transaction

    try:
        mpesa_txn = MpesaTransaction.objects.get(id=mpesa_transaction_id)
        # Find pending transaction for this shift/amount
        pending_txn = Transaction.objects.filter(
            shift=mpesa_txn.shift,
            amount=mpesa_txn.amount,
            payment_method="mpesa",
            mpesa_transaction__isnull=True,
            status=Transaction.Status.PENDING,
        ).first()

        if pending_txn:
            pending_txn.mpesa_transaction = mpesa_txn
            pending_txn.status = Transaction.Status.COMPLETED
            pending_txn.save()
            logger.info(f"Linked M-Pesa {mpesa_txn.mpesa_receipt_number} to transaction {pending_txn.reference}")

    except Exception as e:
        logger.error(f"Error linking M-Pesa to transaction: {e}", exc_info=True)


@shared_task
def retry_failed_transactions():
    """Retry failed M-Pesa transactions that are eligible for retry"""
    from apps.mpesa.models import MpesaTransaction
    from apps.mpesa.services import daraja_service

    cutoff = timezone.now() - timedelta(hours=1)
    failed = MpesaTransaction.objects.filter(
        status__in=[MpesaTransaction.Status.FAILED, MpesaTransaction.Status.TIMEOUT],
        retry_count__lt=3,
        created_at__gte=cutoff,
    )

    for txn in failed:
        try:
            result = daraja_service.query_stk_status(txn.checkout_request_id)
            result_code = result.get("ResultCode")

            if result_code == 0:
                txn.status = MpesaTransaction.Status.SUCCESS
                txn.result_desc = result.get("ResultDesc", "")
            else:
                txn.retry_count += 1
                txn.last_retry_at = timezone.now()

            txn.save()
            logger.info(f"Retried M-Pesa txn {txn.checkout_request_id}: result={result_code}")

        except Exception as e:
            logger.error(f"Retry error for {txn.checkout_request_id}: {e}")


@shared_task
def check_pending_stk_transactions():
    """Check transactions that are stuck in PENDING status"""
    from apps.mpesa.models import MpesaTransaction
    from apps.mpesa.services import daraja_service

    # Transactions pending for more than 5 minutes
    cutoff = timezone.now() - timedelta(minutes=5)
    pending = MpesaTransaction.objects.filter(
        status=MpesaTransaction.Status.PENDING,
        created_at__lt=cutoff,
    )

    for txn in pending:
        try:
            result = daraja_service.query_stk_status(txn.checkout_request_id)
            result_code = result.get("ResultCode")

            if result_code == 0:
                txn.status = MpesaTransaction.Status.SUCCESS
            elif result_code == 1032:
                txn.status = MpesaTransaction.Status.CANCELLED  # User cancelled
            else:
                txn.status = MpesaTransaction.Status.TIMEOUT

            txn.result_code = str(result_code)
            txn.result_desc = result.get("ResultDesc", "")
            txn.completed_at = timezone.now()
            txn.save()

        except Exception as e:
            logger.error(f"Status check error: {e}")
