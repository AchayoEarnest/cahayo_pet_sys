FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Python optimizations
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/media /app/staticfiles

# Create non-root user
RUN addgroup --system cahayo && adduser --system --group cahayo
RUN chown -R cahayo:cahayo /app
USER cahayo

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/auth/login/ || exit 1

CMD ["gunicorn", "cahayo.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "gevent", \
     "--worker-connections", "1000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--log-level", "info", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
