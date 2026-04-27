from django.urls import path
from . import views

urlpatterns = [
    path("", views.StationListView.as_view(), name="station-list"),
    path("<uuid:pk>/", views.StationDetailView.as_view(), name="station-detail"),
    path("fuel-types/", views.FuelTypeListView.as_view(), name="fuel-types"),
    path("fuel-prices/", views.FuelPriceListCreateView.as_view(), name="fuel-prices"),
]
