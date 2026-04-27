"""
Authentication Models
Custom User model with role-based access control for Cahayo FMS
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        ATTENDANT = "attendant", "Attendant"
        ACCOUNTANT = "accountant", "Accountant"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATTENDANT)

    # Station assignment (attendants/managers belong to a station)
    station = models.ForeignKey(
        "stations.Station",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="staff"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # Profile
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    pin = models.CharField(max_length=128, blank=True, help_text="Hashed 4-digit PIN for quick access")

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
            models.Index(fields=["station"]),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_manager(self):
        return self.role in [self.Role.ADMIN, self.Role.MANAGER]

    @property
    def is_accountant(self):
        return self.role in [self.Role.ADMIN, self.Role.ACCOUNTANT]

    def can_access_station(self, station):
        """Check if user has access to a specific station"""
        if self.role == self.Role.ADMIN:
            return True
        return self.station == station


class AuditLog(models.Model):
    """Immutable audit trail for critical actions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=100, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    station = models.ForeignKey(
        "stations.Station",
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "timestamp"]),
            models.Index(fields=["resource_type", "resource_id"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.timestamp}"
