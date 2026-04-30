#!/usr/bin/env bash
# ─── Cahayo FMS — Local Dev Setup ─────────────────────────────────────────────
# Run once after cloning or when you hit "database cahayo does not exist":
#   chmod +x setup_dev.sh && ./setup_dev.sh
set -e

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BACKEND_DIR"

echo "▶ Creating .env from .env.example (if missing)…"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✓ .env created — edit it if your Postgres credentials differ from the defaults"
else
  echo "  ✓ .env already exists"
fi

# Load only the DB vars we need from .env.
# We do NOT use xargs/export on the whole file because values like
#   DEFAULT_FROM_EMAIL=Cahayo Dev <dev@cahayo.local>
# contain angle brackets and spaces that break shell export.
_env_get() { grep -m1 "^${1}=" .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'"; }
DB_NAME="$(_env_get DB_NAME)";  DB_NAME="${DB_NAME:-cahayo}"
DB_USER="$(_env_get DB_USER)";  DB_USER="${DB_USER:-postgres}"
DB_HOST="$(_env_get DB_HOST)";  DB_HOST="${DB_HOST:-localhost}"
DB_PORT="$(_env_get DB_PORT)";  DB_PORT="${DB_PORT:-5432}"

echo ""
echo "▶ Creating PostgreSQL database \"$DB_NAME\" (if it doesn't exist)…"
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -lqt | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  echo "  ✓ Database \"$DB_NAME\" already exists"
else
  createdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$DB_NAME"
  echo "  ✓ Database \"$DB_NAME\" created"
fi

echo ""
echo "▶ Activating virtual environment…"
if [ -d venv ]; then
  source venv/bin/activate
elif [ -d .venv ]; then
  source .venv/bin/activate
else
  echo "  ⚠  No venv found. Create one first:"
  echo "      python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

echo ""
echo "▶ Running migrations…"
python manage.py migrate

echo ""
echo "▶ (Optional) Load fixtures…"
if [ -d fixtures ] && ls fixtures/*.json 1>/dev/null 2>&1; then
  for f in fixtures/*.json; do
    python manage.py loaddata "$f" && echo "  ✓ Loaded $f" || echo "  ⚠  Failed to load $f (skipping)"
  done
fi

echo ""
echo "✅  Setup complete! Start the server with:"
echo "    source venv/bin/activate && python manage.py runserver"
