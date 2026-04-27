from django.urls import path
from . import views

urlpatterns = [
    path("", views.TankListView.as_view(), name="tank-list"),
    path("<uuid:pk>/", views.TankDetailView.as_view(), name="tank-detail"),
    path("<uuid:tank_id>/deliveries/", views.DeliveryListCreateView.as_view(), name="tank-deliveries"),
    path("deliveries/", views.DeliveryListCreateView.as_view(), name="delivery-list"),
    path("dip-readings/", views.DipReadingCreateView.as_view(), name="dip-reading-create"),
]
