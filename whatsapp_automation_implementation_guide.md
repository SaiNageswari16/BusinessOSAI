# WhatsApp Web Automation — Technical Implementation Guide

This document covers the complete implementation of the WhatsApp QR scanning, session management, contact sync, and real-time messaging feature. Use this as a reference to replicate the system in another application.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser / Frontend                     │
│              (NextJS — dashboard page)                    │
└────────────────────────┬─────────────────────────────────┘
                         │ REST API calls
                         ▼
┌──────────────────────────────────────────────────────────┐
│               Backend (FastAPI — Python)                  │
│        /api/v1/whatsapp-automation/*                      │
│   • Auth validation  • DB read/write  • Proxying         │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP proxied to internal gateway
                         ▼
┌──────────────────────────────────────────────────────────┐
│           NodeJS Gateway (Express — port 8005)           │
│  • Puppeteer  • whatsapp-web.js  • QR generation        │
│  • Contact resolution  • Session persistence             │
│  • Inbound message listener → fires webhook to FastAPI   │
└──────────────────────────────────────────────────────────┘
```

The **NodeJS Gateway** is the core engine. It spins up a Chromium browser session per WhatsApp number, handles authentication via QR code, and is the only layer that actually interacts with the WhatsApp Web client. The **FastAPI backend** sits in front of it providing:
- Authentication/authorization
- PostgreSQL data persistence
- Secure proxying (so the NodeJS gateway is never exposed to the browser directly)

---

## Part 1: NodeJS WhatsApp Gateway

**Location:** `backend/whatsapp_gateway/index.js`  
**Port:** `8005`  
**Key npm packages:** `whatsapp-web.js`, `qrcode`, `express`, `cors`, `axios`

### 1.1 Dependencies — `package.json`

```json
{
  "dependencies": {
    "whatsapp-web.js": "^1.x",
    "qrcode": "^1.5.x",
    "express": "^4.x",
    "cors": "^2.x",
    "axios": "^1.x"
  }
}
```

### 1.2 Session Persistence

Sessions are stored in two places:

| Storage | What it stores | Purpose |
|---------|---------------|---------|
| `sessions.json` | List of active phone numbers (e.g. `["919849617326"]`) | Knows which sessions to auto-restart on server boot |
| `.wwebjs_auth/session-{id}/` | Encrypted Chromium cookies/auth tokens | Skip QR scan on reconnect |

```js
// Load sessions from disk
function loadSessions() { /* reads sessions.json */ }

// Save sessions to disk
function saveSessions(list) { /* writes sessions.json */ }
```

### 1.3 Starting a Client — `startClient(id)`

`id` is the phone number (digits only, e.g. `919849617326`).

```js
function startClient(id) {
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: id,
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu']
        }
    });

    client._status = 'INITIALIZING';
    client._latestQr = null;
    clients[id] = client;
    client.initialize();
    return client;
}
```

### 1.4 Session Lifecycle Events

The client fires these events in order:

```
INITIALIZING → qr (QR_READY) → authenticated (AUTHENTICATED) → ready (CONNECTED)
```

| Event | Status set | Action |
|-------|-----------|--------|
| `qr` | `QR_READY` | Converts QR to base64 data URL via `qrcode.toDataURL()` |
| `authenticated` | `AUTHENTICATED` | Clears QR — auth token saved to disk |
| `ready` | `CONNECTED` | Session is fully online, ready to send/receive |
| `disconnected` | `DISCONNECTED` | Removes from in-memory map, removes from `sessions.json` |
| `auth_failure` | `DISCONNECTED` | Auth token invalid; user must rescan QR |

### 1.5 Inbound Message Handler

When a message arrives, the gateway:
1. Tries `msg.getContact()` to resolve the real phone number from the WhatsApp JID
2. Prefers `contact.id.user` when `contact.id.server === 'c.us'` (real E.164 number)
3. Falls back to `contact.number` or the raw JID user part
4. POSTs the resolved data to the FastAPI webhook

```js
client.on('message', async (msg) => {
    let fromNumber = msg.from.split('@')[0];
    let profileName = msg._data.notifyName || '';

    try {
        const contact = await msg.getContact();
        if (contact?.id?.server === 'c.us') {
            fromNumber = contact.id.user;   // ← Real E.164 phone number
        } else if (contact?.number) {
            fromNumber = contact.number;
        }
        profileName = contact.name || contact.pushname || profileName;
    } catch (e) { /* fallback to raw JID */ }

    await axios.post(FASTAPI_WEBHOOK_URL, {
        message_id: msg.id.id,
        from: fromNumber,
        body: msg.body || '',
        timestamp: msg.timestamp,
        profile_name: profileName,
        session_id: id          // Which WhatsApp number received this message
    });
});
```

> **⚠️ Important JID Quirk:** WhatsApp uses two types of JIDs:
> - `@c.us` — standard phone contacts. `contact.id.user` = real phone number
> - `@lid` — privacy-restricted ad clicks. `contact.number` is a meaningless internal ID
> 
> Always check `contact.id.server === 'c.us'` before trusting `contact.id.user` for calling purposes.

### 1.6 REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions` | Returns all sessions (active + persistent offline) with status and QR |
| `POST` | `/sessions/:id/start` | Registers + initializes a session |
| `GET` | `/sessions/:id/contacts` | Returns deduplicated phone book list |
| `POST` | `/sessions/:id/sync` | Bulk-posts contacts to FastAPI webhook to ingest as leads |
| `POST` | `/sessions/:id/logout` | Logs out, destroys session, deletes auth folder |
| `GET` | `/sessions/:id/chats/:phone/messages` | Fetches last 50 messages from WhatsApp chat |
| `POST` | `/sessions/:id/chats/:phone/send` | Sends a WhatsApp message to a contact |

#### `GET /sessions` response format:
```json
{
  "919849617326": {
    "status": "CONNECTED",
    "qr": null,
    "info": { "pushname": "Business Name", "wid": "..." }
  },
  "919133228213": {
    "status": "QR_READY",
    "qr": "data:image/png;base64,iVBORw0KGgo...",
    "info": null
  }
}
```

#### Contact Deduplication in `GET /sessions/:id/contacts`:
```js
const seen = new Set();
for (const contact of contacts) {
    const cleanPhone = resolvedPhone.replace(/\D/g, '');
    if (seen.has(cleanPhone)) continue;   // Skip duplicate numbers
    seen.add(cleanPhone);
    list.push({ number: cleanPhone, name: contact.name || contact.pushname || cleanPhone });
}
```

### 1.7 JID Resolver — `resolveJid(client, phone)`

Before sending a message, you need the WhatsApp JID of the recipient (not just the phone number). This helper searches active chats for the matching JID:

```js
async function resolveJid(client, phone) {
    if (phone.includes('@')) return phone;  // Already a JID
    const clean = phone.replace(/\D/g, '');
    
    const chats = await client.getChats();
    for (const chat of chats) {
        if (chat.id.user === clean) return chat.id._serialized;
    }
    
    // Fallback heuristic
    return clean.length > 12 && clean.startsWith('260') ? `${clean}@lid` : `${clean}@c.us`;
}
```

### 1.8 Auto-Restore on Startup

```js
app.listen(PORT, () => {
    const active = loadSessions();
    active.forEach(id => startClient(id));   // Restore all known sessions
});
```

---

## Part 2: FastAPI Backend

**Location:** `backend/app/api/v1/routers/webhooks_whatsapp_automation.py`  
**Router prefix:** `/api/v1/whatsapp-automation`

### 2.1 Environment Variables

```bash
# In .env
WHATSAPP_GATEWAY_URL=http://localhost:8005           # Local dev
# OR in Docker:
WHATSAPP_GATEWAY_URL=http://whatsapp_gateway:8005   # Docker network
```

### 2.2 Session Registration — `POST /sessions/{session_id}/start`

1. Validates user JWT and loads their organization from PostgreSQL
2. Appends the phone number to `Organization.settings["whatsapp_web_sessions"]`
3. Maps `session_id → user_id` in `Organization.settings["agent_whatsapp_sessions"]`
4. Proxies the call to `NodeJS POST /sessions/{id}/start`

```python
@router.post("/sessions/{session_id}/start")
async def start_session(session_id: str, db, current_user):
    clean_id = _clean_digits(session_id)
    settings = dict(org.settings or {})
    
    # Map session → agent for ownership tracking
    agent_sessions = dict(settings.get("agent_whatsapp_sessions") or {})
    agent_sessions[clean_id] = str(current_user.id)
    settings["agent_whatsapp_sessions"] = agent_sessions
    
    # Save to DB
    active_sessions.append(clean_id)
    settings["whatsapp_web_sessions"] = active_sessions
    org.settings = settings
    flag_modified(org, "settings")
    db.commit()
    
    # Proxy to NodeJS
    resp = await httpx.post(f"{GATEWAY_URL}/sessions/{clean_id}/start")
    return resp.json()
```

### 2.3 Inbound Webhook — `POST /webhook`

Called by the NodeJS gateway whenever a new message arrives. This is the core lead ingestion pipeline:

```
Receive payload → Resolve organization by session_id → Normalize phone number
→ Check duplicate leads → Create lead if new → Log CampaignActivity
```

**Organization resolution logic:**
1. Scan all organizations, check `settings["whatsapp_web_sessions"]` for matching session
2. If found, check `settings["agent_whatsapp_sessions"]` to find the owning agent
3. Fallback: use the first organization in the database

**Lead creation:**
```python
lead = Lead(
    organization_id=org_id,
    name=profile_name or from_phone,
    phone=normalized_phone,
    source=LeadSource.WHATSAPP,
    status=LeadStatus.NEW,
    owner_agent_id=owner_agent_id,  # Auto-assigned to the linked agent!
)
```

### 2.4 Role-Based Session Visibility — `GET /sessions`

| Role | Behavior |
|------|---------|
| Admin / Manager | Sees ALL registered sessions + owner agent name/email |
| Agent | Sees ONLY their own linked session number |

```python
is_admin = current_user.role in (AppRole.ADMIN, AppRole.MANAGER, ...)

if is_admin:
    filtered_db_sessions = all_db_sessions
else:
    # Agents only see their own number
    agent_id_str = str(current_user.id)
    filtered_db_sessions = [
        num for num in db_sessions
        if agent_sessions.get(_clean_digits(num)) == agent_id_str
    ]
```

### 2.5 Chat History — `GET /sessions/{session_id}/chats/{phone}/messages`

Chat history is loaded from the **PostgreSQL `CampaignActivity` table**, not from the WhatsApp browser (which was fragile). This provides instant loads and zero Puppeteer dependency:

```python
activities = db.query(CampaignActivity).filter(
    CampaignActivity.lead_id == lead.id,
    CampaignActivity.channel == MessageChannel.WHATSAPP
).order_by(CampaignActivity.timestamp.asc()).all()
```

### 2.6 Send Message — `POST /sessions/{session_id}/chats/{phone}/send`

1. Normalizes phone, looks up (or creates) the Lead in DB
2. Proxies `{ message }` to NodeJS `POST /sessions/{id}/chats/{phone}/send`
3. Logs the sent message as a `CampaignActivity` with `event_type=SENT`

---

## Part 3: NextJS Frontend

**Location:** `frontend/src/app/dashboard/whatsapp-automation/page.tsx`

### 3.1 Session Polling

Sessions are polled every 5 seconds. When the QR dialog is open, the QR image auto-refreshes:

```ts
useEffect(() => {
    fetchSessions();
    const timer = setInterval(() => fetchSessions(), 5000);
    return () => clearInterval(timer);
}, [activeQrNumber]);
```

### 3.2 QR Code Display Flow

```
User clicks "Add Number" → POST /sessions/{number}/start
→ Backend proxies to NodeJS → NodeJS launches Puppeteer
→ On next poll, session.status === "QR_READY" && session.qr is base64 PNG
→ Render <Image src={session.qr} /> in a modal card
→ User scans with phone → status transitions to AUTHENTICATED → CONNECTED
→ QR modal auto-closes
```

```tsx
{activeQrCode && (
    <Image 
        src={activeQrCode}          // base64 data:image/png;base64,...
        alt="WhatsApp Web Login QR Code" 
        width={180} height={180}
    />
)}
```

### 3.3 Sync Contacts Modal Flow

```
User clicks "Sync Contacts" → GET /sessions/{number}/contacts
→ Returns deduplicated [ { number, name } ] array
→ Modal shows searchable checklist + editable name inputs
→ User selects contacts, edits names, clicks "Import Selected"
→ POST /sessions/{number}/sync { numbers: [...], profile_names: [...] }
→ NodeJS fires webhook to FastAPI for each contact
→ FastAPI creates Lead records in PostgreSQL
```

### 3.4 Chat Panel

```
User clicks chat icon on a contact row → GET /sessions/{number}/chats/{phone}/messages
→ Returns formatted messages from PostgreSQL CampaignActivity
→ Render right-side chat bubbles (fromMe ? right : left)

User types reply → POST /sessions/{number}/chats/{phone}/send { message }
→ FastAPI logs to DB + NodeJS sends via Puppeteer
→ Append sent message to local state instantly for responsiveness
```

### 3.5 Key State Variables

```ts
const [sessions, setSessions] = useState<Sessions>({});        // All active sessions
const [activeQrCode, setActiveQrCode] = useState<string|null>(null); // QR base64 to display
const [activeQrNumber, setActiveQrNumber] = useState<string|null>(null);
const [showSyncModal, setShowSyncModal] = useState(false);
const [contactsList, setContactsList] = useState<ContactItem[]>([]);
const [selectedContacts, setSelectedContacts] = useState<Record<string,boolean>>({});
const [customNames, setCustomNames] = useState<Record<string,string>>({});
const [activeChatContact, setActiveChatContact] = useState<ContactItem|null>(null);
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
```

---

## Part 4: Docker Setup

### Dockerfile for NodeJS Gateway

**Location:** `backend/whatsapp_gateway/Dockerfile`

```dockerfile
FROM node:18-slim

# Install Chromium + fonts for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium fonts-ipafont-gothic fonts-wqy-zenhei \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 8005
CMD ["npm", "start"]
```

### docker-compose.yml additions

```yaml
backend:
    environment:
      - WHATSAPP_GATEWAY_URL=http://whatsapp_gateway:8005

whatsapp_gateway:
    build: ./backend/whatsapp_gateway
    ports:
      - "127.0.0.1:8005:8005"
    environment:
      - FASTAPI_WEBHOOK_URL=http://backend:8000/api/v1/whatsapp-automation/webhook
    volumes:
      - ./backend/whatsapp_gateway/.wwebjs_auth:/app/.wwebjs_auth   # Persist auth
      - ./backend/whatsapp_gateway/sessions.json:/app/sessions.json  # Persist session list
    depends_on:
      - backend
```

> **⚠️ Volume mounting is critical.** Without these mounts, auth tokens and the session list are lost every time the container restarts, and users would have to rescan QR codes on every deploy.

---

## Part 5: Database Schema (PostgreSQL)

### `Organization.settings` JSONB fields

```json
{
  "whatsapp_web_sessions": ["919849617326", "919133228213"],
  "agent_whatsapp_sessions": {
    "919849617326": "uuid-of-agent-1",
    "919133228213": "uuid-of-agent-2"
  }
}
```

### `CampaignActivity` table columns used

| Column | Value |
|--------|-------|
| `channel` | `WHATSAPP` |
| `event_type` | `REPLIED` (inbound) or `SENT` (outbound) |
| `provider` | `"whatsapp-web"` |
| `provider_message_id` | Unique WhatsApp message ID (for deduplication) |
| `body` | Message text |
| `lead_id` | FK to the Lead who sent/received the message |

---

## Part 6: How to Reuse in Another Application

### Minimal Requirements

1. **NodeJS Gateway** — Copy `backend/whatsapp_gateway/index.js` and its `package.json` as-is. Change only `FASTAPI_WEBHOOK_URL` to point to your new backend.

2. **Webhook Receiver** — Your backend needs a `POST /webhook` endpoint that accepts:
   ```json
   {
     "message_id": "string",
     "from": "phone_number_string",
     "body": "message text",
     "timestamp": 1723000000,
     "profile_name": "John Doe",
     "session_id": "919849617326"
   }
   ```

3. **Session Control APIs** — Your backend needs to proxy these calls to the gateway:
   - `POST /sessions/{id}/start` → NodeJS `POST /sessions/{id}/start`
   - `GET /sessions` → NodeJS `GET /sessions`
   - `POST /sessions/{id}/logout` → NodeJS `POST /sessions/{id}/logout`

4. **Frontend** — You need:
   - A polling loop (every 3–5s) that calls your `GET /sessions` endpoint
   - Logic to display the base64 QR image when `session.status === "QR_READY"`
   - A "Send" form calling your backend proxy to `POST /sessions/{id}/chats/{phone}/send`

### Minimal Reuse Architecture (No FastAPI)

If your new app doesn't have Python, you can call the NodeJS gateway directly from your backend (Express, Rails, Laravel, etc.):

```
Your Backend → POST http://localhost:8005/sessions/{id}/start
Your Backend ← Receives webhook from NodeJS gateway on message receive
Your Frontend → polls Your Backend GET /sessions (which calls NodeJS GET /sessions)
```

The only complexity is that the NodeJS gateway calls **your webhook URL** when messages arrive, so make sure `FASTAPI_WEBHOOK_URL` in `index.js` points to your new backend's inbound webhook handler.
