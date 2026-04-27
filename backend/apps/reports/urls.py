from django.urls import path
from . import views

urlpatterns = [
    path("dashboard/", views.KPIDashboardView.as_view(), name="kpi-dashboard"),
    path("daily/", views.DailySalesReportView.as_view(), name="daily-report"),
    path("shift-performance/", views.ShiftPerformanceView.as_view(), name="shift-performance"),
    path("fuel-variance/", views.FuelVarianceReportView.as_view(), name="fuel-variance"),
    path("attendant-performance/", views.AttendantPerformanceView.as_view(), name="attendant-performance"),
]
