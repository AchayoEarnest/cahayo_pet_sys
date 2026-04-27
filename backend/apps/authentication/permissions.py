"""Role-based permissions for Cahayo FMS"""

from rest_framework.permissions import BasePermission
from .models import User


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.ADMIN


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [User.Role.ADMIN, User.Role.MANAGER]
        )


class IsAccountantOrAbove(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [User.Role.ADMIN, User.Role.ACCOUNTANT, User.Role.MANAGER]
        )


class IsAttendantOrAbove(BasePermission):
    """All authenticated users with a station role"""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [
                User.Role.ADMIN, User.Role.MANAGER,
                User.Role.ATTENDANT, User.Role.ACCOUNTANT
            ]
        )


class StationAccessPermission(BasePermission):
    """Ensure user can only access their assigned station's data"""
    message = "You do not have access to this station."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == User.Role.ADMIN:
            return True
        # Get station from object (works for Station, Shift, Pump etc.)
        station = getattr(obj, "station", None)
        return station == user.station
