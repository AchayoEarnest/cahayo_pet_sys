from django.urls import path
from . import views

urlpatterns = [
    path("", views.PumpListView.as_view(), name="pump-list"),
    path("<uuid:pk>/", views.PumpDetailView.as_view(), name="pump-detail"),
    path("<uuid:pump_id>/nozzles/", views.NozzleListView.as_view(), name="nozzle-list"),
]
