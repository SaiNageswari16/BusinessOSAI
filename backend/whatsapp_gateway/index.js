const express = require('express');
const cors = require('cors');
const axios = require('axios');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Global Process Crash Prevention
process.on('uncaughtException', (err) => {
    const msg = err?.message || String(err);
    if (
        msg.includes('Execution context was destroyed') ||
        msg.includes('Session closed') ||
        msg.includes('Protocol error') ||
        msg.includes('Target closed') ||
        msg.includes('Promise was collected')
    ) {
        console.warn('⚠️ [Safe Catch] Suppressed Puppeteer context/navigation error:', msg);
        return;
    }
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = reason?.message || String(reason);
    if (
        msg.includes('Execution context was destroyed') ||
        msg.includes('Session closed') ||
        msg.includes('Protocol error') ||
        msg.includes('Target closed') ||
        msg.includes('Promise was collected')
    ) {
        console.warn('⚠️ [Safe Catch] Suppressed Puppeteer unhandled rejection:', msg);
        return;
    }
    console.error('💥 Unhandled Promise Rejection:', reason);
});

const app = express();
const PORT = process.env.PORT || 8005;
const FASTAPI_WEBHOOK_URL = process.env.FASTAPI_WEBHOOK_URL || 'http://localhost:8000/api/v1/whatsapp-automation/webhook';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');

// Store active clients: { [id]: { client, status, qr, info } }
const clients = {};

// Helper: load sessions list
function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load sessions.json:', e);
    }
    return [];
}

// Helper: save sessions list
function saveSessions(list) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save sessions.json:', e);
    }
}

// Helper: clean E.164 digits
function cleanDigits(id) {
    return id.replace(/\D/g, '');
}

// Helper: resolve JID from simple phone number
async function resolveJid(client, phone) {
    if (phone.includes('@')) return phone;
    const clean = cleanDigits(phone);
    if (clean.length > 12) {
        return `${clean}@lid`;
    }

    try {
        const numId = await client.getNumberId(clean);
        if (numId && numId._serialized) {
            return numId._serialized;
        }
    } catch (e) {
        console.warn('resolveJid getNumberId error:', e);
    }
    return `${clean}@c.us`;
}

// Helper: global clean-up of ALL stale Chromium lock files across all sessions
function cleanAllStaleLocks() {
    try {
        if (!fs.existsSync(AUTH_DIR)) return;
        const entries = fs.readdirSync(AUTH_DIR);
        for (const entry of entries) {
            const sessionDir = path.join(AUTH_DIR, entry);
            try {
                if (fs.statSync(sessionDir).isDirectory()) {
                    const lockFiles = [
                        'SingletonLock',
                        'SingletonCookie',
                        'SingletonSocket',
                        'DevToolsActivePort'
                    ];
                    for (const f of lockFiles) {
                        const p = path.join(sessionDir, f);
                        if (fs.existsSync(p)) {
                            fs.unlinkSync(p);
                        }
                    }
                }
            } catch (_) {}
        }
        console.log('🧹 [Self-Healing] All stale Chromium locks successfully cleared.');
    } catch (e) {
        console.warn('Warning during global lock cleanup:', e.message);
    }
}

// Clean on module load
cleanAllStaleLocks();

// Helper: clean stale Chromium lock files for a specific session
function cleanStaleLocks(sessionId) {
    try {
        const sessionDir = path.join(AUTH_DIR, `session-${sessionId}`);
        if (fs.existsSync(sessionDir)) {
            const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
            for (const f of lockFiles) {
                const p = path.join(sessionDir, f);
                if (fs.existsSync(p)) {
                    fs.unlinkSync(p);
                    console.log(`🧹 Removed stale lock: ${f} for session ${sessionId}`);
                }
            }
        }
    } catch (e) {
        console.warn(`Warning cleaning locks for ${sessionId}:`, e.message);
    }
}

// Graceful process shutdown handler
async function gracefulShutdown(signal) {
    console.log(`🛑 Received ${signal}. Gracefully destroying all WhatsApp clients...`);
    const promises = Object.keys(clients).map(async (id) => {
        try {
            if (clients[id]?.client) {
                await clients[id].client.destroy();
            }
        } catch (_) {}
    });
    await Promise.all(promises);
    cleanAllStaleLocks();
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Core: Start a Client
function startClient(rawId, forceRestart = false) {
    const id = cleanDigits(rawId);
    if (clients[id]) {
        if (!forceRestart && (clients[id].status === 'CONNECTED' || clients[id].status === 'QR_READY')) {
            console.log(`Client for ${id} is already active (${clients[id].status}).`);
            return clients[id];
        }
        console.log(`🔄 Re-initializing stale/requested client for ${id}...`);
        try {
            if (clients[id].client) clients[id].client.destroy();
        } catch (_) {}
        delete clients[id];
    }

    cleanStaleLocks(id);

    console.log(`🚀 Initializing WhatsApp client for session: ${id}`);
    const puppeteerOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else if (process.platform === 'linux') {
        const possibleChromePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ];
        for (const p of possibleChromePaths) {
            if (fs.existsSync(p)) {
                puppeteerOptions.executablePath = p;
                console.log(`🧭 Using Linux system browser at: ${p}`);
                break;
            }
        }
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: id,
            dataPath: AUTH_DIR
        }),
        webVersionCache: {
            type: 'none'
        },
        puppeteer: puppeteerOptions
    });

    clients[id] = {
        client,
        status: 'INITIALIZING',
        qr: null,
        info: null
    };

    // Watchdog timer: if stuck in INITIALIZING for >60s, cleanly reset
    const watchdogTimer = setTimeout(() => {
        if (clients[id] && clients[id].status === 'INITIALIZING') {
            console.warn(`⏱️ [Watchdog] Session ${id} took too long in INITIALIZING. Resetting cleanly...`);
            try {
                client.destroy();
            } catch (_) {}
            cleanStaleLocks(id);
            clients[id].status = 'DISCONNECTED';
            clients[id].qr = null;
        }
    }, 60000);

    client.on('loading_screen', (percent, message) => {
        console.log(`⏳ [${id}] Loading screen: ${percent}% - ${message}`);
    });

    client.on('change_state', (state) => {
        console.log(`🔄 [${id}] WhatsApp state changed: ${state}`);
    });

    client.on('qr', async (qrText) => {
        clearTimeout(watchdogTimer);
        console.log(`📲 [${id}] QR generated successfully`);
        try {
            const qrDataUrl = await qrcode.toDataURL(qrText);
            clients[id].status = 'QR_READY';
            clients[id].qr = qrDataUrl;
        } catch (e) {
            console.error('QR parsing error:', e);
        }
    });

    client.on('authenticated', () => {
        clearTimeout(watchdogTimer);
        console.log(`🔑 [${id}] Session AUTHENTICATED`);
        clients[id].status = 'AUTHENTICATED';
        clients[id].qr = null;
    });

    client.on('ready', () => {
        clearTimeout(watchdogTimer);
        console.log(`✅ [${id}] Session is fully CONNECTED and READY`);
        clients[id].status = 'CONNECTED';
        clients[id].qr = null;
        clients[id].info = client.info;

        // Ensure session is persisted
        const saved = loadSessions();
        if (!saved.includes(id)) {
            saved.push(id);
            saveSessions(saved);
        }
    });

    client.on('auth_failure', async (msg) => {
        console.error(`❌ Session ${id} Auth Failure:`, msg);
        if (clients[id]) {
            clients[id].status = 'DISCONNECTED';
            clients[id].qr = null;
        }
        try {
            await client.destroy();
        } catch (_) {}
    });

    client.on('disconnected', async (reason) => {
        console.log(`🔌 Session ${id} was DISCONNECTED:`, reason);
        if (clients[id]) {
            clients[id].status = 'DISCONNECTED';
            clients[id].qr = null;
        }
        
        // Remove from saved list
        const saved = loadSessions();
        const updated = saved.filter(s => s !== id);
        saveSessions(updated);

        // If logged out, clean session auth files to allow fresh scan
        if (reason === 'LOGOUT') {
            const sessionAuthPath = path.join(AUTH_DIR, `session-${id}`);
            try {
                if (fs.existsSync(sessionAuthPath)) {
                    fs.rmSync(sessionAuthPath, { recursive: true, force: true });
                }
            } catch (err) {
                console.warn('Could not clean auth dir on logout:', err.message);
            }
        }

        try {
            await client.destroy();
        } catch (_) {}
    });

    // Inbound Message Listener
    client.on('message', async (msg) => {
        console.log(`📥 Incoming message for ${id} from ${msg.from}`);
        let fromNumber = msg.from.split('@')[0];
        let profileName = msg._data.notifyName || '';

        try {
            const contact = await msg.getContact();
            if (contact?.id?.server === 'c.us') {
                fromNumber = contact.id.user;
            } else if (contact?.number) {
                fromNumber = contact.number;
            }
            profileName = contact.name || contact.pushname || profileName;
        } catch (e) {
            console.warn('Failed to fetch contact details:', e);
        }

        // Fallback: if fromNumber is still a LID (contains lid or length > 12), resolve it explicitly
        if (fromNumber.includes('lid') || fromNumber.length > 12) {
            try {
                const contactObj = await client.getContactById(msg.from);
                if (contactObj && contactObj.number) {
                    fromNumber = contactObj.number;
                }
            } catch (err) {
                console.warn('Failed to resolve LID fallback:', err);
            }
        }

        try {
            await axios.post(FASTAPI_WEBHOOK_URL, {
                message_id: msg.id.id,
                from: fromNumber,
                body: msg.body || '',
                timestamp: msg.timestamp,
                profile_name: profileName,
                session_id: id
            });
            console.log(`📨 Posted webhook to FastAPI for ${fromNumber}`);
        } catch (err) {
            console.error('❌ Webhook dispatch failed:', err.message);
        }
    });

    client.initialize().catch(err => {
        console.error(`Failed to initialize client ${id}:`, err);
    });

    return clients[id];
}

// REST Endpoints

// 1. Get all active sessions status
app.get('/sessions', (req, res) => {
    const data = {};
    for (const id in clients) {
        data[id] = {
            status: clients[id].status,
            qr: clients[id].qr,
            info: clients[id].info
        };
    }
    res.json(data);
});

// 2. Start/Initialize a session
app.post('/sessions/:id/start', (req, res) => {
    const id = cleanDigits(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }
    const force = req.query.force === 'true' || req.body?.force === true;
    const session = startClient(id, force);
    res.json({
        success: true,
        status: session.status,
        hasQr: !!session.qr
    });
});

// 3. Get deduplicated contacts list
app.get('/sessions/:id/contacts', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    try {
        const contacts = await sessionObj.client.getContacts();
        const list = [];
        const seen = new Set();

        for (const contact of contacts) {
            if (!contact.isMyContact || contact.isGroup || contact.isMe) continue;
            
            let resolvedNumber = contact.id.user;
            if (contact.id.server !== 'c.us' && contact.number) {
                resolvedNumber = contact.number;
            }
            
            const cleanPhone = cleanDigits(resolvedNumber);
            if (!cleanPhone || seen.has(cleanPhone)) continue;
            
            seen.add(cleanPhone);
            list.push({
                number: cleanPhone,
                name: contact.name || contact.pushname || cleanPhone
            });
        }
        res.json({ success: true, contacts: list });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            return respondDisconnected(res, id, 'contacts-protocol-error');
        }
        console.error('Failed to fetch contacts:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Bulk sync/import contacts to leads
app.post('/sessions/:id/sync', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const { contacts } = req.body; // Array of { number, name }
    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ success: false, error: 'Invalid payload: contacts list required' });
    }

    console.log(`🔄 Syncing ${contacts.length} contacts for session ${id}`);
    
    // Asynchronously dispatch to FastAPI webhook
    res.json({ success: true, message: `Syncing ${contacts.length} contacts in background.` });

    for (const item of contacts) {
        const cleanPhone = cleanDigits(item.number);
        if (!cleanPhone) continue;
        try {
            await axios.post(FASTAPI_WEBHOOK_URL, {
                message_id: `sync-${id}-${cleanPhone}-${Date.now()}`,
                from: cleanPhone,
                body: "Lead imported via WhatsApp contact sync.",
                timestamp: Math.floor(Date.now() / 1000),
                profile_name: item.name || cleanPhone,
                session_id: id
            });
        } catch (e) {
            console.error(`Failed to sync contact webhook for ${cleanPhone}:`, e.message);
        }
    }
});

// 5. Logout and destroy a session
app.post('/sessions/:id/logout', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const sessionObj = clients[id];
    if (!sessionObj) {
        return res.json({ success: true, message: 'Session not active in memory' });
    }

    try {
        await sessionObj.client.destroy();
    } catch (e) {
        console.warn('Error destroying client:', e.message);
    }

    delete clients[id];

    // Remove from sessions.json
    const saved = loadSessions();
    const updated = saved.filter(s => s !== id);
    saveSessions(updated);

    // Clean session auth files
    const sessionAuthPath = path.join(AUTH_DIR, `session-${id}`);
    try {
        if (fs.existsSync(sessionAuthPath)) {
            fs.rmSync(sessionAuthPath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('Failed to clean auth files:', e);
    }

    res.json({ success: true, message: 'Session logged out and cleared.' });
});

// Helper: check whether the client session is still usable (CDP not dead)
function isClientAlive(sessionObj) {
    if (!sessionObj || sessionObj.status !== 'CONNECTED') return false;
    if (!sessionObj.client) return false;
    return true;
}

// Helper: respond with "disconnected" and stop retrying for this session
function respondDisconnected(res, sessionId, reason) {
    console.warn(`[${reason}] Marking session ${sessionId} as unreachable.`);
    if (clients[sessionId]) clients[sessionId].status = 'DISCONNECTED';
    res.status(400).json({ success: false, error: 'Session disconnected — please reconnect.', reason });
}

// 6. Get chat messages from a contact (fetches last 50)
app.get('/sessions/:id/chats/:phone/messages', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const phone = req.params.phone;
    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    try {
        const jid = await resolveJid(sessionObj.client, phone);
        const chat = await sessionObj.client.getChatById(jid);
        let messages = [];
        try {
            messages = await chat.fetchMessages({ limit: 50 });
        } catch (fetchErr) {
            console.warn(`FetchMessages failed for ${phone}:`, fetchErr.message);
            messages = [];
        }
        const list = messages.map(m => ({
            id: m.id.id,
            body: m.body,
            fromMe: m.fromMe,
            timestamp: m.timestamp,
            sender: m.from.split('@')[0]
        }));
        res.json({ success: true, messages: list });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            return respondDisconnected(res, id, 'protocol-error');
        }
        console.error('Failed to load chat messages:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 8. Get all active chats (conversations) from the WhatsApp instance
app.get('/sessions/:id/chats', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    try {
        let chats = [];
        try {
            chats = await sessionObj.client.getChats();
        } catch (fetchErr) {
            console.warn(`[${id}] Chats still synchronizing from phone, returning empty list temporarily...`);
            return res.json({ success: true, chats: [] });
        }

        const list = [];
        for (const chat of (chats || [])) {
            let lastMessageText = "";
            let lastMessageTime = chat.timestamp || 0;
            try {
                const messages = await chat.fetchMessages({ limit: 1 });
                if (messages && messages.length > 0) {
                    lastMessageText = messages[0].body || "";
                    lastMessageTime = messages[0].timestamp || lastMessageTime;
                }
            } catch (err) {
                // Ignore per-chat message fetch errors (page may have been GC'd)
            }

            let phone = chat.id.user;
            try {
                if (chat.id._serialized.includes('@lid') || chat.id.user.length > 12) {
                    const contact = await sessionObj.client.getContactById(chat.id._serialized);
                    if (contact && contact.number) {
                        phone = contact.number;
                    }
                }
            } catch (err) {
                // Ignore per-chat contact resolution errors
            }

            list.push({
                id: chat.id._serialized,
                name: chat.name || chat.id.user,
                phone: phone,
                unreadCount: chat.unreadCount || 0,
                timestamp: lastMessageTime,
                lastMessage: lastMessageText,
                isGroup: chat.isGroup
            });
        }

        list.sort((a, b) => b.timestamp - a.timestamp);
        res.json({ success: true, chats: list });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            console.warn(`Protocol error in /chats for ${id}: ${msg} — marking disconnected.`);
            clients[id].status = 'DISCONNECTED';
            return respondDisconnected(res, id, 'protocol-error');
        }
        console.error('Failed to load active chats:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. Send a message to a contact
app.post('/sessions/:id/chats/:phone/send', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const phone = req.params.phone;
    const { message } = req.body;

    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    try {
        const jid = await resolveJid(sessionObj.client, phone);
        const sentMsg = await sessionObj.client.sendMessage(jid, message);
        res.json({
            success: true,
            message_id: sentMsg && sentMsg.id ? sentMsg.id.id : `msg-${Date.now()}`,
            timestamp: sentMsg && sentMsg.timestamp ? sentMsg.timestamp : Math.floor(Date.now() / 1000)
        });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            return respondDisconnected(res, id, 'send-protocol-error');
        }
        console.error('Failed to send message:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 9. Send media (image/PDF) to a contact
app.post('/sessions/:id/chats/:phone/send-media', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const phone = req.params.phone;
    const { mimeType, data, fileName, caption } = req.body;

    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    if (!mimeType || !data) {
        return res.status(400).json({ success: false, error: 'mimeType and data (base64) are required' });
    }

    try {
        const jid = await resolveJid(sessionObj.client, phone);
        const { MessageMedia } = require('whatsapp-web.js');

        // Build MessageMedia — for PDFs include fileName as the third arg
        const media = new MessageMedia(mimeType, data, fileName || undefined);

        const sendOptions = {};
        if (caption && caption.trim()) {
            sendOptions.caption = caption.trim();
        }

        const sentMsg = await sessionObj.client.sendMessage(jid, media, sendOptions);
        res.json({
            success: true,
            message_id: sentMsg && sentMsg.id ? sentMsg.id.id : `media-${Date.now()}`,
            timestamp: sentMsg && sentMsg.timestamp ? sentMsg.timestamp : Math.floor(Date.now() / 1000)
        });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            return respondDisconnected(res, id, 'send-media-protocol-error');
        }
        console.error('Failed to send media:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Server boot: restore active persistent sessions
app.listen(PORT, () => {
    console.log(`🟢 WhatsApp Gateway listening on port ${PORT}`);
    const active = loadSessions();
    console.log(`🔄 Auto-restoring ${active.length} active sessions:`, active);
    active.forEach(id => {
        try {
            startClient(id);
        } catch (e) {
            console.error(`Auto-restore failed for ${id}:`, e);
        }
    });
});
