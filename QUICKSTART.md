# QUICK START GUIDE - BusinessOS AI Backend

Get the backend running in 5 minutes! 🚀

---

## Prerequisites

- **Python 3.11+** installed
- **PostgreSQL 13+** installed and running
- **Git** (optional, for cloning)
- **Postman or curl** (for testing endpoints)

---

## Step 1: Set Up PostgreSQL Database (2 minutes)

### On macOS:
```bash
# Install if needed
brew install postgresql@15
brew services start postgresql@15

# Create database and user
psql postgres
```

### On Linux:
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Connect as postgres user
sudo -u postgres psql
```

### On Windows:
- Download from https://www.postgresql.org/download/windows/
- Install with default settings
- Remember the password you set!
- Open "SQL Shell (psql)" from Start menu

### Create Database:
```sql
-- In psql or pgAdmin Query Tool, run:
CREATE DATABASE businessos_core_erp;
CREATE USER businessos_admin WITH PASSWORD 'your_strong_password_123';
GRANT ALL PRIVILEGES ON DATABASE businessos_core_erp TO businessos_admin;
\q
```

---

## Step 2: Set Up Python Environment (2 minutes)

```bash
# Navigate to project
cd /path/to/BusinessOSAI

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

---

## Step 3: Configure Environment Variables (1 minute)

```bash
cd backend

# Copy template
cp .env.example .env

# Edit .env with your values
# You can use any text editor:
nano .env        # macOS/Linux
code .env        # VS Code
# On Windows, just open in Notepad

# Key settings to update:
# POSTGRES_PASSWORD=your_strong_password_123
# SECRET_KEY=<generate using command below>
```

### Generate SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy the output and paste into `.env` as `SECRET_KEY` value.

### Example `.env`:
```
APP_NAME=BusinessOS AI
APP_ENV=development
APP_DEBUG=true
APP_PORT=8000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=businessos_admin
POSTGRES_PASSWORD=your_strong_password_123
POSTGRES_DB=businessos_core_erp

SECRET_KEY=<64-char-random-string-from-above>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

DEFAULT_TENANT_PLAN=starter
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15

AUTO_CREATE_TABLES=true
SEED_DEFAULT_PERMISSIONS=true
```

---

## Step 4: Run the Backend Server (1 minute)

```bash
# Make sure you're in backend/ directory and venv is activated
cd backend
uvicorn src.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
INFO:     Starting Nimbus Retail Group [development]
```

✅ **Backend is running!**

---

## Step 5: Test the API

### Option A: Swagger UI (Easy)

Open browser: **http://localhost:8000/docs**

You'll see interactive API documentation where you can test all endpoints!

### Option B: Curl Commands

#### Register a new tenant:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "My Retail Store",
    "tenant_slug": "my-retail",
    "admin_name": "John Manager",
    "admin_email": "john@mystore.com",
    "admin_password": "SecurePass@123",
    "company_name": "My Store Inc"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "xyz123...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

#### List companies (use access_token from above):
```bash
curl -X GET http://localhost:8000/api/v1/erp/companies \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Demo Credentials (If Using Seed Data)

When `SEED_DEFAULT_PERMISSIONS=true`, the system creates a demo tenant:

```
Tenant: Nimbus Retail Group
Email:  admin@businessos.ai
Password: Admin@123456
```

You can use these to test immediately without registering.

---

## What's Running?

| Component | Status | Access Point |
|-----------|--------|--------------|
| FastAPI Server | ✅ Running | http://localhost:8000 |
| Swagger UI | ✅ Available | http://localhost:8000/docs |
| ReDoc | ✅ Available | http://localhost:8000/redoc |
| PostgreSQL | ✅ Running | localhost:5432 |
| Database | ✅ Auto-created | businessos_core_erp |
| Tables | ✅ Auto-created | 25+ tables seeded |
| Demo Tenant | ✅ Seeded | Nimbus Retail Group |
| Demo Company | ✅ Seeded | Mumbai HQ |
| Permissions | ✅ Seeded | 16 permissions |

---

## API Endpoints (Currently Available)

### Authentication
- `POST /api/v1/auth/register-tenant` - Register new tenant ✅
- `POST /api/v1/auth/login` - Login (⏳ to be implemented)
- `POST /api/v1/auth/refresh` - Refresh token (⏳ to be implemented)

### Organization Management
- `GET/POST /api/v1/erp/companies` - Companies ✅
- `GET/POST /api/v1/erp/branches` - Branches ✅
- `GET/POST /api/v1/erp/departments` - Departments ✅
- `GET/POST /api/v1/erp/designations` - Designations ✅

### User & Access Control
- `GET/POST /api/v1/erp/users` - Users ✅
- `GET/POST /api/v1/erp/roles` - Roles ✅
- `GET /api/v1/erp/permissions` - Permissions ✅

### Audit
- `GET /api/v1/erp/audit/logs` - Audit logs ✅

---

## Troubleshooting

### Issue: "Connection refused" on PostgreSQL
**Solution**: Make sure PostgreSQL is running
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Windows: Start service from Services app
```

### Issue: "POSTGRES_PASSWORD incorrect"
**Solution**: Check your .env file matches the password you created
```bash
# Verify password in PostgreSQL
sudo -u postgres psql -c "ALTER USER businessos_admin WITH PASSWORD 'new_password';"
# Update .env and restart server
```

### Issue: "SECRET_KEY must be at least 32 characters"
**Solution**: Generate a new one
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
# Copy to .env
```

### Issue: "Module not found: fastapi"
**Solution**: Activate virtual environment and reinstall
```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r backend/requirements.txt
```

### Issue: "Address already in use" port 8000
**Solution**: Kill existing process or use different port
```bash
# macOS/Linux: Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Windows: Find and kill in Task Manager
# Or use different port:
uvicorn src.main:app --reload --port 8001
```

---

## Next Steps

### 1. Test in Swagger UI
- Go to http://localhost:8000/docs
- Try "Register Tenant" endpoint first
- Use the returned token for other endpoints

### 2. Understand the Flow
- Tenant registration creates: Tenant + Company + Branch + User + Role
- Login endpoint (coming soon) validates email/password
- All endpoints require `Authorization: Bearer {token}` header

### 3. Connect to Frontend
- Frontend will call these API endpoints
- Mock data will be replaced with real API responses
- Currently mock data at `frontend/src/data/mock.ts`

### 4. Explore Database
Open pgAdmin (http://localhost:5050 if running via Docker):
1. Connect to PostgreSQL
2. Browse `businessos_core_erp` database
3. Explore tables created
4. Run queries to understand data

---

## Common API Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success (GET) | Company retrieved |
| 201 | Created (POST) | New company created |
| 204 | Deleted (DELETE) | Company deleted, no response |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Company doesn't exist |
| 429 | Rate Limited | Too many login attempts |
| 500 | Server Error | Unexpected error |

---

## Useful Commands

### Check if server is running:
```bash
curl http://localhost:8000/docs
```

### View API documentation:
```bash
# In browser
http://localhost:8000/docs         # Swagger UI
http://localhost:8000/redoc        # ReDoc
```

### Reset database (delete all data):
```bash
# In PostgreSQL
DROP DATABASE businessos_core_erp;
CREATE DATABASE businessos_core_erp;
GRANT ALL PRIVILEGES ON DATABASE businessos_core_erp TO businessos_admin;

# Restart backend server - it will recreate tables
```

### View database tables:
```bash
# In PostgreSQL
\c businessos_core_erp
\dt              # List tables
\d tenants       # Describe table
SELECT COUNT(*) FROM companies;  # Row count
```

### Stop server:
```bash
# Press CTRL+C in terminal where server is running
```

---

## Architecture Overview

```
Frontend (React/TS) @ localhost:8080
        │
        │ HTTP/JSON
        ↓
FastAPI Backend @ localhost:8000
        │
        ├─ Authentication (JWT tokens)
        ├─ Authorization (RBAC permissions)
        ├─ Business Logic (CRUD operations)
        └─ Audit Logging
        │
        ↓
PostgreSQL Database @ localhost:5432
        │
        ├─ 25+ Tables
        ├─ Multi-tenant isolation
        ├─ Relationships & constraints
        └─ Audit trails
```

---

## File Structure Reference

```
backend/
├── .env                          ← Your local config (generated from .env.example)
├── requirements.txt              ← Python packages
├── run.py                        ← Simple startup script
├── src/
│   ├── main.py                   ← FastAPI app setup
│   ├── config/settings.py        ← Configuration loader
│   ├── database/
│   │   ├── base.py               ← SQLAlchemy base + mixins
│   │   ├── session.py            ← DB connection
│   │   └── init_db.py            ← Table creation + seeding
│   ├── models/__init__.py        ← All 25+ ORM models
│   ├── schemas/erp.py            ← Pydantic validation schemas
│   ├── api/
│   │   ├── deps.py               ← Authentication context
│   │   └── v1/
│   │       ├── auth.py           ← Login/register endpoints
│   │       └── erp/
│   │           ├── organization.py  ← Company/Branch/Dept endpoints
│   │           ├── access_control.py ← User/Role/Permission endpoints
│   │           └── audit.py       ← Audit log endpoints
│   └── utils/
│       ├── security.py           ← Password/JWT utilities
│       └── pagination.py         ← Pagination helpers
└── database/schema/core_erp_schema.sql ← PostgreSQL DDL
```

---

## Performance Tips

### During Development:
- ✅ Keep `APP_DEBUG=true` for auto-reload
- ✅ Keep `SEED_DEFAULT_PERMISSIONS=true` for demo data
- ✅ Keep `AUTO_CREATE_TABLES=true` for auto-migration

### For Production:
- ⚠️ Set `APP_DEBUG=false` (disables Swagger)
- ⚠️ Use `APP_ENV=production` (different logging)
- ⚠️ Set `AUTO_CREATE_TABLES=false` (use migrations instead)
- ⚠️ Use environment-specific .env (not hardcoded)

---

## Need Help?

### Check logs:
- Server console shows all requests and errors
- Database logs available via pgAdmin

### Review documentation:
- [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) - Complete architecture guide
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - What's done and what's next

### Common tasks:
- **Add new endpoint**: See IMPLEMENTATION_CHECKLIST.md → Implementation Template
- **Fix database issue**: Check PostgreSQL connection in .env
- **Debug API call**: Use Swagger UI at /docs to test manually

---

## What's Next?

1. ✅ **Backend running** - You've achieved this!
2. ⏳ **Implement login endpoint** - Needed for real authentication (2-3 hours)
3. ⏳ **Connect frontend** - React app will call this backend (1-2 days)
4. 🔜 **Complete CORE ERP module** - All CRUD endpoints functional (2-3 weeks)

---

**Created**: July 3, 2026  
**Status**: Ready to Use  
**Support**: See BACKEND_DOCUMENTATION.md for detailed architecture
