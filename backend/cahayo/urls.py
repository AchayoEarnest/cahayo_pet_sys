"""Cahayo FMS - Root URL Configuration"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/stations/", include("apps.stations.urls")),
    path("api/shifts/", include("apps.shifts.urls")),
    path("api/pumps/", include("apps.pumps.urls")),
    path("api/tanks/", include("apps.tanks.urls")),
    path("api/transactions/", include("apps.transactions.urls")),
    path("api/mpesa/", include("apps.mpesa.urls")),
    path("api/accounting/", include("apps.accounting.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "Cahayo FMS Admin"
admin.site.site_title = "Cahayo FMS"
admin.site.index_title = "Petrol Station Management"
