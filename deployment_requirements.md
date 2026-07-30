# IOTRONCS Retail - Server Deployment & Requirement Specifications

This document outlines the software requirements, frameworks, versions, database settings, and deployment steps necessary to host IOTRONCS Retail on a production server.

---

## 🖥️ System & Infrastructure Requirements

### 1. Database
* **Database Engine**: PostgreSQL `>=15` is required (local or managed cloud database like AWS RDS).
* **Connection Type**: Async pooling using PostgreSQL wire protocol.

### 2. Static Assets Storage
* **Directories**: The application writes and caches fetched product images to `/images` (mapped to `backend/images/`). The server environment must grant write permissions to this folder.

### 3. Ports
* **Web Server**: Port `8001` (FastAPI backend API)
* **Frontend Dev Server / Build**: Port `8080` (Vite client)

---

## 🐍 Backend Requirements & Dependencies

### 1. Python Runtime
* **Version**: **Python `>=3.10`** (Development environment is running **`3.11.9`**).

### 2. Primary Frameworks (FastAPI / ASGI)
* **Web Framework**: `fastapi==0.115.6`
* **ASGI Server**: `uvicorn[standard]==0.34.0`

### 3. Database & Migration Layer
* **ORM Engine**: `sqlalchemy[asyncio]==2.0.36`
* **Driver**: `asyncpg==0.30.0`
* **Migration Manager**: `alembic==1.14.0`

### 4. Auth, Validation & Utilities
* **Data Validation**: `pydantic[email]==2.10.4` & `pydantic-settings==2.7.0`
* **Security & Tokens**: `python-jose[cryptography]==3.3.0` & `authlib==1.2.0`
* **Bcrypt Hashing**: `passlib[bcrypt]==1.7.4` & `bcrypt==4.2.1`
* **Environment Loader**: `python-dotenv==1.0.1`
* **HTTP Client (RAG Sourcing)**: `requests==2.32.3`

---

## ⚛️ Frontend Requirements & Dependencies

### 1. Node.js Runtime
* **Version**: **Node.js `>=22.0.0`**

### 2. Primary Frameworks
* **Base Engine**: `react==19.2.0` & `react-dom==19.2.0`
* **Module Bundler / Builder**: `vite==8.0.16`
* **Routing System**: `@tanstack/react-router==1.170.16`
* **Styling Framework**: `tailwindcss==4.2.1`

### 3. Core Libraries
* **State & Query Hydration**: `@tanstack/react-query==5.101.1`
* **Micro-Animations**: `framer-motion==12.42.0`
* **Data Handling (CSV/Excel)**: `xlsx==0.18.5` & `papaparse==5.5.4`
* **Icons**: `lucide-react==0.575.0`
* **Charts & Analytics**: `recharts==2.15.4`

---

## 🚀 Standard Deployment Pipeline (Ubuntu/Linux Production)

### 1. Environment Preparation
```bash
# Install Node.js (v22+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs python3.11 python3.11-venv postgresql
```

### 2. Backend Setup & Run Daemon (Systemd)
1. **Virtual Environment**:
   ```bash
   cd backend
   python3.11 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Setup Environment**: Copy `.env.example` to `.env` and fill out DB configs, Gemini API key, etc.
3. **Database Migration**:
   ```bash
   python migrate_db.py
   ```
4. **Configure Systemd Service for Web server (`/etc/systemd/system/businessos-api.service`)**:
   ```ini
   [Unit]
   Description=BusinessOS API Web Server
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/path/to/BusinessOSAI/backend
   ExecStart=/path/to/BusinessOSAI/backend/.venv/bin/python run.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
5. **Configure Systemd Service for Standalone Worker (`/etc/systemd/system/businessos-worker.service`)**:
   ```ini
   [Unit]
   Description=BusinessOS RAG Sourcing Worker
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/path/to/BusinessOSAI/backend
   ExecStart=/path/to/BusinessOSAI/backend/.venv/bin/python worker.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

### 3. Frontend Build & Static Serving (Nginx)
1. **Build Assets**:
   ```bash
   cd ../frontend
   npm install
   npm run build
   ```
2. **Nginx Reverse Proxy Configurations**: Serve the static frontend build folder `/dist` and reverse-proxy `/api/v1` to backend port `8001`.
