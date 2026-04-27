from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("stations", "0001_initial"),
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="stationfuelprice",
            name="set_by",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]