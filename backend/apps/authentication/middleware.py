"""Audit Middleware"""

import logging
from .models import AuditLog

logger = logging.getLogger(__name__)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PATHS = {"/api/auth/login", "/api/auth/refresh", "/api/mpesa/callback"}


class AuditLogMiddleware:
    """Auto-log write operations for audit trail"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if (
            request.method in WRITE_METHODS
            and request.path not in SKIP_PATHS
            and hasattr(request, "user")
            and request.user.is_authenticated
            and response.status_code < 400
        ):
            try:
                AuditLog.objects.create(
                    user=request.user,
                    action=f"{request.method} {request.path}",
                    resource_type=request.path.split("/")[3] if len(request.path.split("/")) > 3 else "",
                    ip_address=request.META.get("REMOTE_ADDR"),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                    station=getattr(request.user, "station", None),
                )
            except Exception as e:
                logger.warning(f"AuditLog error: {e}")

        return response
