# apps/pumps/urls.py
from django.urls import path
from . import views as pump_views

pumps_urlpatterns = [
    path("", pump_views.PumpListView.as_view(), name="pump-list"),
    path("<uuid:pk>/", pump_views.PumpDetailView.as_view(), name="pump-detail"),
    path("<uuid:pump_id>/nozzles/", pump_views.NozzleListView.as_view(), name="nozzle-list"),
]
