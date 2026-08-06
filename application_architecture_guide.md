# BusinessOS AI — Complete Architecture, Setup & Deployment Guide

This guide details the complete technical architecture of the **BusinessOS AI** platform, covering the frameworks and versions in use, VM system configuration, Redis caching setup, and React Query (TanStack Query) caching configuration.

---

## 1. Technology Stack & Version Breakdown

### 1.1 Backend Service (FastAPI)
The backend is a high-performance REST API built with Python, using async/await database operations and strict type-validation schemas:

| Component / Library | Version | Description |
| :--- | :--- | :--- |
| **Python** | `>=3.10` | Base runtime environment |
| **FastAPI** | `0.115.6` | Async web framework |
| **Uvicorn [standard]** | `0.34.0` | High-speed ASGI server |
| **SQLAlchemy** | `2.0.36` | Database ORM (using `asyncio`) |
| **Asyncpg** | `0.30.0` | High-performance async PostgreSQL driver |
| **Alembic** | `1.14.0` | DB migration tool |
| **Pydantic** | `2.10.4` | Data validation schemas |
| **Pydantic Settings** | `2.7.0` | Env var configuration helper |
| **Python-jose** | `3.3.0` | JWT token management |
| **Passlib [bcrypt]** | `1.7.4` | Password hashing & verification |

### 1.2 Frontend (React & TanStack)
The frontend is a single-page app utilizing TanStack Router for route generation and TanStack Start for server rendering:

| Component / Library | Version | Description |
| :--- | :--- | :--- |
| **Node.js** | `>=22.0.0` | JavaScript/TypeScript runtime |
| **React** | `19.2.0` | UI component rendering engine |
| **Vite** | `8.0.16` | Build tool & bundler |
| **TailwindCSS** | `4.2.1` | Utility-first CSS styling engine |
| **TanStack React Router** | `1.170.16` | Strongly-typed client routing |
| **TanStack React Start** | `1.168.26` | Server framework for TanStack |
| **TanStack React Query** | `5.101.1` | Server-state caching and synchronization |
| **Framer Motion** | `12.42.0` | Micro-animations and transitions |
| **Lucide React** | `0.575.0` | Icon set |

---

## 2. Local Developer Environment Setup

Follow these steps to run the application locally on your machine:

### 2.1 Backend Local Setup
1. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```
2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install dependencies**:
   This installs FastAPI, SQLAlchemy, and the newly added `redis` client:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run a Local Redis Instance**:
   You can run Redis either natively on your machine or via a quick Docker command:
   ```bash
   docker run -d --name local-redis -p 6379:6379 redis:alpine
   ```
5. **Setup environment variables**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Add or update the Redis connection parameters in `.env`:
   ```env
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=  # Leave empty if no password is set on local docker instance
   ```
6. **Run DB migrations & seed**:
   ```bash
   python migrate_db.py
   python seed_superapp.py
   ```
7. **Launch the FastAPI server**:
   ```bash
   python run.py
   ```
   *The server runs at `http://localhost:8000`.*

### 2.2 Frontend Local Setup
1. **Navigate to the frontend folder**:
   ```bash
   cd frontend
   ```
2. **Install Node.js dependencies**:
   ```bash
   npm install # or bun install
   ```
3. **Configure environment settings**:
   Create `.env`:
   ```bash
   VITE_API_URL=http://localhost:8000
   ```
4. **Start the Vite dev server**:
   ```bash
   npm run dev
   ```
   *Access the app at `http://localhost:8080` (or the port indicated by Vite).*

---

## 3. Production VM Setup Guide (Ubuntu 22.04 LTS)

Follow this setup checklist to configure a production cloud VM (e.g. AWS EC2, DigitalOcean Droplet, Google Compute Engine):

### Step 1: System Package Update & Tooling Install
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git software-properties-common ufwn certbot python3-certbot-nginx
```

### Step 2: Install Docker Engine
```bash
# Add Docker's official GPG key
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Step 3: Install Node.js LTS (v22+)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 4. Redis Installation & Secure Cache Configuration

Redis is used for caching session authentication data, API rate limits, and real-time POS transaction states.

### 4.1 Installing Redis Server
On the VM, install Redis natively:
```bash
sudo apt install redis-server -y
```

### 4.2 Securing Redis
By default, Redis does not require a password and listens on all interfaces. Secure it by editing the config:
```bash
sudo nano /etc/redis/redis.conf
```
Update these two directives:
```nginx
# 1. Bind to localhost only to block external access
bind 127.0.0.1 ::1

# 2. Enable a strong password for authorization
requirepass InsertAStrongRandomPasswordHere321!
```
Restart the service to apply:
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### 4.3 Integrating Redis in FastAPI Backend
Install the python redis driver:
`pip install redis hiredis`

Add these settings to your `.env` configuration:
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=InsertAStrongRandomPasswordHere321!
```

---

## 5. React Query (TanStack Query) Setup & Caching Patterns

The frontend uses **TanStack React Query v5** to manage client server-state sync, caching, and cache invalidation.

### 5.1 Router Integration (`frontend/src/router.tsx`)
A unique `QueryClient` is initialized with every router state instantiation:
```typescript
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
        gcTime: 1000 * 60 * 10,   // Unused queries stay in cache for 10 minutes
        retry: 1,                 // Retry failing queries once
        refetchOnWindowFocus: false, // Prevent background refetches on window focus
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
```

### 5.2 Context Wrapping (`frontend/src/routes/__root.tsx`)
The `QueryClientProvider` is injected at the root level so all nested routes have access to the cached data:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### 5.3 Fetching & Mutating Cached Data (CRM Lead Example)
Use these hook structures to keep data in sync:

#### Fetching Data
```typescript
import { useQuery } from "@tanstack/react-query";
import { crmApi } from "../lib/api-client";

export function useCustomers(page = 1) {
  return useQuery({
    queryKey: ["customers", page],
    queryFn: () => crmApi.getCustomers(page, 50),
    placeholderData: (previousData) => previousData, // Smooth paginated transitions
  });
}
```

#### Mutating Data & Invalidating Cache
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "../lib/api-client";

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newCustomer) => crmApi.createCustomer(newCustomer),
    onSuccess: () => {
      // Invalidate the 'customers' list cache to trigger an automatic background refetch
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
```

---

## 6. Dockerized Deployment Reference

To deploy the entire environment via Docker Compose on the VM:

Create a `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: bos_postgres
    restart: always
    environment:
      POSTGRES_DB: businessos
      POSTGRES_USER: root
      POSTGRES_PASSWORD: StrongDbPassword123!
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: bos_redis
    restart: always
    command: redis-server --requirepass StrongRedisPassword321!
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    container_name: bos_backend
    restart: always
    environment:
      - DATABASE_URL=postgresql+asyncpg://root:StrongDbPassword123!@db:5432/businessos
      - REDIS_URL=redis://:StrongRedisPassword321!@redis:6379/0
      - WHATSAPP_GATEWAY_URL=http://whatsapp_gateway:8005
    depends_on:
      - db
      - redis
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    container_name: bos_frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
```
Deploy to the VM with a single command:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
This starts the async FastAPI backend, Postgres DB, secured Redis cache, and full-width React frontend container cluster.
