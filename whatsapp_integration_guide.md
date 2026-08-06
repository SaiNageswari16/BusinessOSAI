# WhatsApp Integration — Technical Implementation & Real-Time Flow Guide

This document provides a comprehensive technical breakdown of the WhatsApp Web Automation & Messaging Gateway integrated into **BusinessOS AI**. Use this reference to understand the end-to-end architecture, real-time message flows, session handling, phone number normalization (e.g., `+919398622127`), database persistence, and step-by-step instructions for replicating or updating the integration.

---

## 1. System Architecture Overview

The system uses a **decoupled 3-tier architecture** to isolate browser automation (Puppeteer) from business logic and database persistence:

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                         │
│       (Dashboard / CRM / Settings / WhatsApp Automation UI)       │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ REST API / Session Polling (Port 8000)
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (Python)                    │
│             /api/v1/whatsapp-automation/*                        │
│   • Auth / JWT Validation   • PostgreSQL Storage (Lead & Chat)   │
│   • Multi-Tenant RBAC       • Webhook Receiver & Lead Ingestion   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP Proxy & Webhook Dispatch (Port 8005)
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Node.js WhatsApp Gateway (Express)                │
│   • whatsapp-web.js / Puppeteer Chromium Sessions                │
│   • QR Base64 Generation    • Session Disk Persistence           │
│   • Contact & JID Resolver  • Inbound Event Listener               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Phone Number Breakdown & Normalization

WhatsApp Web requires strict **E.164 digit-only formatting** (without spaces, dashes, or `+` symbols).

### Phone Number Conversion Table
| Input Format | Normalized Session ID / Phone | WhatsApp JID (`@c.us` / `@lid`) |
| :--- | :--- | :--- |
| **`+91 93986 22127`** | **`919398622127`** | `919398622127@c.us` |
| **`09398622127`** (India Local) | **`919398622127`** | `919398622127@c.us` |
| **`+91-98496-17326`** (Customer) | **`919849617326`** | `919849617326@c.us` |
| **Privacy Restricted Ad Click** | `26001234567890` | `26001234567890@lid` |

### Normalization Logic (`cleanDigits`)
```js
function cleanDigits(phone) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, ''); // Strips +, spaces, dashes
    // Auto-fix 10-digit Indian numbers by prepending country code 91
    if (digits.length === 10) {
        digits = '91' + digits;
    }
    return digits;
}
```

---

## 3. Session Initialization & QR Code Scanning Flow

Here is the exact step-by-step lifecycle when registering a WhatsApp number like **`+919398622127`**:

```
[User Clicks "Add Number" (+919398622127)]
                   │
                   ▼
  FastAPI POST /sessions/919398622127/start
                   │  (Stores 919398622127 in Organization.settings DB)
                   ▼
  Node.js Gateway POST /sessions/919398622127/start
                   │  (Spins up Puppeteer Chromium instance)
                   ▼
  Client fires 'qr' event ➔ Converts QR to Base64 Data URL
                   │  (status set to "QR_READY")
                   ▼
  Frontend polls GET /sessions every 3s ➔ Renders QR Image in Modal
                   │
  [User Scans QR Code using WhatsApp on Mobile (+919398622127)]
                   │
                   ▼
  Client fires 'authenticated' ➔ Saves session tokens to .wwebjs_auth/session-919398622127/
                   │
                   ▼
  Client fires 'ready' ➔ Status updated to "CONNECTED" ➔ QR Modal Auto-Closes!
```

### Session Status Lifecycle States
```
INITIALIZING ──► QR_READY ──► AUTHENTICATED ──► CONNECTED
     │                                               │
     └─────────────────► DISCONNECTED ◄──────────────┘
```

---

## 4. Real-Time Message Flows

### 4.1 Inbound Message Flow (Customer ➔ Business Number `+919398622127`)

When customer **`+919849617326`** sends a WhatsApp message *"Hi, I need pricing details"* to **`+919398622127`**:

```
1. Customer (+919849617326) sends message via WhatsApp network
                        │
                        ▼
2. Node.js Gateway Chromium session (for 919398622127) receives event:
   client.on('message', async (msg) => { ... })
                        │
                        ▼
3. Contact & JID Resolution:
   • Resolves real number: 919849617326 (handles @c.us vs @lid privacy masks)
   • Resolves contact profile name: "Rajesh Kumar"
                        │
                        ▼
4. Gateway Dispatches Webhook to FastAPI:
   POST http://localhost:8000/api/v1/whatsapp-automation/webhook
   Payload:
   {
     "message_id": "false_919849617326@c.us_3EB012345678",
     "from": "919849617326",
     "body": "Hi, I need pricing details",
     "timestamp": 1723001234,
     "profile_name": "Rajesh Kumar",
     "session_id": "919398622127"
   }
                        │
                        ▼
5. FastAPI Webhook Processor:
   • Resolves Organization linked to session "919398622127"
   • Resolves Agent linked to session "919398622127" (e.g. Agent UUID)
   • Checks if Lead (+919849617326) exists in PostgreSQL:
     - If NEW: Creates Lead record (Name: "Rajesh Kumar", Phone: "+919849617326", Source: "WHATSAPP", Owner: Agent UUID)
     - If EXISTS: Updates Lead status / last contact timestamp
   • Logs to PostgreSQL CampaignActivity table:
     - channel: "WHATSAPP"
     - event_type: "REPLIED" (Inbound)
     - provider: "whatsapp-web"
     - provider_message_id: "false_919849617326@c.us_3EB012345678"
     - body: "Hi, I need pricing details"
                        │
                        ▼
6. Real-Time UI Update:
   • Next.js Frontend polls GET /sessions/919398622127/chats/919849617326/messages
   • New inbound bubble appears instantly on the Agent's Chat Panel!
```

---

### 4.2 Outbound Message Flow (Agent ➔ Customer `+919849617326` from `+919398622127`)

When Agent types reply *"Hello! Our standard package is ₹4,999."* in the CRM Chat Panel:

```
1. Agent clicks "Send" in Next.js Frontend
                        │
                        ▼
2. Frontend calls FastAPI:
   POST /api/v1/whatsapp-automation/sessions/919398622127/chats/919849617326/send
   Payload: { "message": "Hello! Our standard package is ₹4,999." }
                        │
                        ▼
3. FastAPI Backend:
   • Validates Agent JWT & Lead permissions
   • Proxies call to Node.js Gateway:
     POST http://localhost:8005/sessions/919398622127/chats/919849617326/send
                        │
                        ▼
4. Node.js Gateway:
   • Looks up Client for session "919398622127"
   • Resolves JID: resolveJid(client, "919849617326") ➔ "919849617326@c.us"
   • Calls Puppeteer action: client.sendMessage("919849617326@c.us", text)
   • Message sent over WhatsApp network to customer's phone!
                        │
                        ▼
5. FastAPI Logs Outbound Activity:
   • Saves to PostgreSQL CampaignActivity table:
     - channel: "WHATSAPP"
     - event_type: "SENT" (Outbound)
     - body: "Hello! Our standard package is ₹4,999."
                        │
                        ▼
6. Responsive UI Update:
   • Outbound green bubble appended immediately to Chat Panel window.
```

---

## 5. JID Resolution Logic (`resolveJid`)

WhatsApp uses two internal JID formats:
1. **Standard Phone Contacts (`@c.us`)**: e.g., `919849617326@c.us` (Real E.164 phone numbers).
2. **Privacy Protected / Ad Leads (`@lid`)**: e.g., `26001234567890@lid` (Generated during Click-to-WhatsApp Ads).

### Implementation in Node.js Gateway (`backend/whatsapp_gateway/index.js`)
```js
async function resolveJid(client, phone) {
    if (phone.includes('@')) return phone;
    const clean = phone.replace(/\D/g, '');
    
    // Privacy LID check (> 12 digits starting with 260)
    if (clean.length > 12 && clean.startsWith('260')) {
        return `${clean}@lid`;
    }
    
    // Check active WhatsApp chats for matching phone number
    try {
        const chats = await client.getChats();
        for (const chat of chats) {
            let chatPhone = chat.id.user;
            if (chat.id._serialized.includes('@lid')) {
                const contact = await client.getContactById(chat.id._serialized);
                if (contact && contact.number) chatPhone = contact.number;
            }
            if (chatPhone === clean) {
                return chat.id._serialized;
            }
        }
    } catch (err) {}
    
    // Fallback to standard WhatsApp user format
    return `${clean}@c.us`;
}
```

---

## 6. PostgreSQL Database Schemas

### 6.1 `Organization.settings` (JSONB)
Stores multi-tenant WhatsApp sessions and maps which agent owns which phone number:

```json
{
  "whatsapp_web_sessions": [
    "919398622127",
    "919849617326"
  ],
  "agent_whatsapp_sessions": {
    "919398622127": "e6a4b1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "919849617326": "f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

### 6.2 `CampaignActivity` Table (Chat Message Ledger)
All inbound and outbound messages are stored in PostgreSQL for zero-latency retrieval without relying on Puppeteer browser queries:

| Column Name | Data Type | Sample Value (`+919398622127` flow) | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `a1b2c3d4-0000-1111-2222-333344445555` | Primary Key |
| `organization_id` | `UUID` | `b9f8e7d6-5c4b-3a2f-1e0d-9c8b7a6f5e4d` | Multi-Tenant Org FK |
| `lead_id` | `UUID` | `c8d7e6f5-4a3b-2c1d-0e9f-8a7b6c5d4e3f` | Linked Lead FK (+919849617326) |
| `channel` | `Enum` | `'WHATSAPP'` | Communication Channel |
| `event_type` | `Enum` | `'REPLIED'` (Inbound) / `'SENT'` (Outbound) | Message Direction |
| `provider` | `String` | `'whatsapp-web'` | Provider Engine |
| `provider_message_id`| `String` | `'false_919849617326@c.us_3EB012345678'` | Unique WA Message ID |
| `body` | `Text` | `'Hi, I need pricing details'` | Message Text Content |
| `timestamp` | `DateTime` | `2026-08-06T11:24:09Z` | ISO Timestamp |

---

## 7. Complete API Reference

Base Backend URL: `http://localhost:8000/api/v1/whatsapp-automation`  
Direct Node.js Gateway URL: `http://localhost:8005`

### Endpoints Overview

| Method | Endpoint Path | Description |
| :--- | :--- | :--- |
| `GET` | `/sessions` | Returns list of sessions with status & QR code for authenticated user/agent |
| `POST` | `/sessions/{id}/start` | Registers and launches a new WhatsApp Web session (e.g. `919398622127`) |
| `POST` | `/sessions/{id}/logout` | Destroys browser session & deletes stored auth cookies from disk |
| `GET` | `/sessions/{id}/contacts` | Returns deduplicated phonebook contacts from WhatsApp |
| `POST` | `/sessions/{id}/sync` | Bulk ingests selected contacts into PostgreSQL as Leads |
| `GET` | `/sessions/{id}/chats/{phone}/messages` | Fetches chat message history from PostgreSQL `CampaignActivity` |
| `POST` | `/sessions/{id}/chats/{phone}/send` | Sends an outbound WhatsApp message to recipient phone number |
| `POST` | `/webhook` | Inbound webhook receiver called by Node.js Gateway |

---

### Sample Webhook Payload (`POST /webhook`)

```json
{
  "message_id": "false_919849617326@c.us_3EB012345678",
  "from": "919849617326",
  "body": "Hi, I need pricing details for business OS AI",
  "timestamp": 1723001234,
  "profile_name": "Rajesh Kumar",
  "session_id": "919398622127"
}
```

### Sample Send Message Payload (`POST /sessions/919398622127/chats/919849617326/send`)

```json
{
  "message": "Hello Rajesh! Thank you for reaching out to us."
}
```

---

## 8. Docker Deployment & Volume Persistence

To ensure WhatsApp browser sessions remain logged in across server reboots, Docker volumes **MUST** persist the `.wwebjs_auth` directory and `sessions.json`.

### `docker-compose.yml` Configuration
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - WHATSAPP_GATEWAY_URL=http://whatsapp_gateway:8005
    depends_on:
      - whatsapp_gateway

  whatsapp_gateway:
    build: ./backend/whatsapp_gateway
    ports:
      - "127.0.0.1:8005:8005"
    environment:
      - PORT=8005
      - FASTAPI_WEBHOOK_URL=http://backend:8000/api/v1/whatsapp-automation/webhook
    volumes:
      # Persistent storage for Chromium session cookies & QR tokens
      - ./backend/whatsapp_gateway/.wwebjs_auth:/app/.wwebjs_auth
      - ./backend/whatsapp_gateway/sessions.json:/app/sessions.json
```

---

## 9. Key Checklist for Copying / Updating Integration

When updating or replicating this setup in another application:

- [x] **Match Environment Variables**: Ensure `WHATSAPP_GATEWAY_URL` points to `http://localhost:8005` in dev or `http://whatsapp_gateway:8005` in Docker.
- [x] **Always Clean Phone Numbers**: Pass digits only (e.g. `919398622127`), avoiding `+` or spaces in session paths.
- [x] **Mount Docker Volumes**: Never omit `.wwebjs_auth` mount, otherwise QR scans will be required on every deployment.
- [x] **Read Chat History from DB**: Always query `CampaignActivity` table for chat UI display to guarantee sub-millisecond response times.
- [x] **Handle `@lid` Privacy JIDs**: Always check `contact.id.server === 'c.us'` before extracting phone numbers.
