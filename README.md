# 🔥 Cahayo FMS — Petrol Station Management System

> **Production-ready Forecourt Management System for Kenyan petrol stations**

Cahayo FMS is a full-stack system for managing petrol stations in Kenya — built for multi-station operations, real-time shift tracking, M-Pesa integration, and financial reconciliation.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80/443)                   │
│          Rate limiting · SSL termination · Static files      │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
    ┌────────▼───────┐     ┌──────────▼──────────┐
    │  Django + DRF  │     │    Next.js App       │
    │  Port 8000     │     │    Port 3000         │
    │  JWT Auth      │     │    Zustand + RQ      │
    └────────┬───────┘     └─────────────────────┘
             │
    ┌────────┴────────────────────────┐
    │              Services           │
    │   PostgreSQL 16 · Redis 7       │
    │   Celery Worker · Celery Beat   │
    └─────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/yourorg/cahayo-fms.git
cd cahayo-fms

# Copy and edit environment variables
cp .env.example .env
nano .env
```

### 2. Start all services

```bash
docker compose up -d
```

### 3. Initialize database

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py loaddata initial_fuel_types
```

### 4. Access the system

| Service     | URL                          |
|-------------|------------------------------|
| Frontend    | http://localhost             |
| API         | http://localhost/api/        |
| Admin       | http://localhost/admin/      |
| API Docs    | http://localhost/api/schema/ |

---

## 🔐 User Roles

| Role        | Permissions                                      |
|-------------|--------------------------------------------------|
| **Admin**   | Full system access, all stations                 |
| **Manager** | Operations, reports, staff management            |
| **Attendant** | Shift operations, sales recording only         |
| **Accountant** | Financial reports, expenses, reconciliation   |

---

## ⚙️ Core Modules

### 1. Shift Management
- Open shift → record nozzle opening readings
- Real-time transaction recording during shift
- Close shift → capture closing readings
- Automatic calculation of litres sold, expected revenue, variance
- Auto-flag shifts with >1% variance

### 2. Pump & Nozzle Management
- Multi-pump, multi-nozzle support
- Cumulative meter (totalizer) tracking
- Per-nozzle fuel type assignment

### 3. Tank Management (Wet Stock)
- Tank capacity and reorder level monitoring
- Fuel delivery recording with variance detection
- Manual dip stick readings
- Low stock SMS alerts

### 4. M-Pesa Integration (Safaricom Daraja)
- **STK Push** — send payment prompt to customer's phone
- **C2B** — receive paybill/till payments
- Async callback processing via Celery
- Automatic retry for failed transactions
- Receipt confirmation SMS to customer

### 5. Sales Recording (POS)
- Cash, M-Pesa, Card, Credit sales
- Vehicle registration capture
- Real-time shift transaction feed
- M-Pesa push status polling (3-second intervals)

### 6. Accounting
- Expense tracking by category
- Bank deposit recording
- Credit account management (fleet/corporate)
- Daily reconciliation (cash variance)

### 7. Reports & Analytics
- **Dashboard KPIs** — real-time revenue, litres, active shifts
- **Daily Sales** — fuel breakdown, payment methods, attendant performance
- **Shift Performance** — 7/14/30-day revenue and litres trends
- **Fuel Variance** — tank dip vs book stock analysis
- **Attendant Performance** — per-staff revenue, variance, flag rates

### 8. Notifications
- SMS via Africa's Talking
- Email reports via SMTP
- Low stock alerts, shift variance alerts, daily reports

---

## 🌐 API Reference

### Authentication
```
POST /api/auth/login/          → Get JWT tokens
POST /api/auth/refresh/        → Refresh access token
POST /api/auth/logout/         → Blacklist refresh token
POST /api/auth/pin-login/      → 4-digit PIN login (attendants)
GET  /api/auth/me/             → Current user profile
POST /api/auth/change-password/
POST /api/auth/set-pin/
GET  /api/auth/users/          → List staff (manager+)
GET  /api/auth/audit-logs/     → Audit trail (manager+)
```

### Shifts
```
GET  /api/shifts/              → List shifts (filterable)
POST /api/shifts/open/         → Open new shift
GET  /api/shifts/current/      → Get my open shift
GET  /api/shifts/summary/      → Daily shift summary
GET  /api/shifts/{id}/         → Shift detail + readings
POST /api/shifts/{id}/close/   → Close shift
```

### M-Pesa
```
POST /api/mpesa/stk-push/             → Initiate STK Push
POST /api/mpesa/callback/             → Safaricom STK callback (public)
POST /api/mpesa/c2b/validate/         → C2B validation
POST /api/mpesa/c2b/confirm/          → C2B confirmation
GET  /api/mpesa/transactions/         → List M-Pesa transactions
GET  /api/mpesa/status/{checkout_id}/ → Check STK status
```

### Reports
```
GET /api/reports/dashboard/            → KPI dashboard
GET /api/reports/daily/?date=YYYY-MM-DD
GET /api/reports/shift-performance/?days=7
GET /api/reports/fuel-variance/?date=YYYY-MM-DD
GET /api/reports/attendant-performance/?days=30
```

---

## 🧪 Running Tests

```bash
# All tests
docker compose exec backend python manage.py test --verbosity=2

# Specific test module
docker compose exec backend python manage.py test tests.ShiftTestCase

# With coverage
docker compose exec backend coverage run manage.py test
docker compose exec backend coverage report
```

---

## 🔧 M-Pesa Setup

1. Register at [Safaricom Daraja](https://developer.safaricom.co.ke)
2. Create an app and get **Consumer Key** and **Consumer Secret**
3. Get your **Passkey** from the Daraja portal
4. Set `MPESA_ENVIRONMENT=sandbox` for testing
5. For production, register your callback URL on Daraja

```env
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your-passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback/
```

> **Note**: The callback URL must be publicly accessible. Use [ngrok](https://ngrok.com) for local development.

---

## 🏗️ Production Deployment

```bash
# Build and push images
docker compose -f docker-compose.yml build

# Deploy
docker compose up -d

# Run migrations
docker compose exec backend python manage.py migrate

# Check logs
docker compose logs -f backend celery_worker
```

### Environment checklist for production:
- [ ] `DEBUG=False`
- [ ] Strong `SECRET_KEY` (50+ chars)
- [ ] `MPESA_ENVIRONMENT=production`
- [ ] Valid SSL certificate in `nginx/ssl/`
- [ ] `ALLOWED_HOSTS` set to your domain
- [ ] Email SMTP configured
- [ ] Africa's Talking production credentials

---

## 📁 Project Structure

```
cahayo/
├── backend/
│   ├── cahayo/              # Django project config
│   │   ├── settings.py      # All settings
│   │   ├── urls.py          # Root URLs
│   │   └── celery.py        # Celery config + beat schedule
│   ├── apps/
│   │   ├── authentication/  # Custom user, JWT, roles, audit
│   │   ├── stations/        # Station, FuelType, Prices
│   │   ├── pumps/           # Pump, Nozzle, Readings
│   │   ├── tanks/           # Tank, Delivery, DipReading
│   │   ├── shifts/          # Shift lifecycle
│   │   ├── transactions/    # Sales recording
│   │   ├── mpesa/           # Daraja integration
│   │   ├── accounting/      # Expenses, deposits, credit
│   │   ├── reports/         # Analytics views
│   │   └── notifications/   # SMS + email tasks
│   ├── tests.py             # Comprehensive test suite
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/login/  # Login page
│   │   │   └── dashboard/   # All dashboard pages
│   │   ├── components/      # Shared UI components
│   │   ├── lib/api.ts       # Axios API client
│   │   ├── lib/utils.ts     # Formatting utilities
│   │   ├── store/           # Zustand stores
│   │   └── types/index.ts   # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf           # Reverse proxy + rate limiting
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/ci.yml     # CI/CD pipeline
```

---

## 🛡️ Security

- JWT access tokens (8hr) + refresh tokens (7 days) with blacklisting
- Role-based permissions enforced on every endpoint
- Station-scoped data access (attendants can only see their station)
- Rate limiting on auth (10/min) and M-Pesa (30/min) endpoints
- Audit log for all write operations
- HTTPS enforced in production
- Secure cookie settings (HttpOnly, SameSite, Secure)

---

## 📞 Support

Built for Kenyan petrol stations. For questions, open an issue or contact the development team.

**Cahayo** — *Kiswahili for "light" — illuminating your forecourt operations* 🔦
