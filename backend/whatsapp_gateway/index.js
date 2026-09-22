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

// Helper: load sessions list (Self-healing with conflict recovery & auth directory auto-discovery)
function loadSessions() {
    let sessions = [];
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    sessions = parsed;
                }
            } catch (parseErr) {
                console.warn('⚠️ sessions.json had syntax error (possibly single quotes or git conflict). Attempting digit regex recovery...', parseErr.message);
                const matches = raw.match(/\d{10,15}/g);
                if (matches) {
                    sessions = matches;
                }
            }
        }
    } catch (e) {
        console.error('Failed to load sessions.json:', e);
    }

    // Auto-discover existing sessions from AUTH_DIR (.wwebjs_auth/session-<id>)
    try {
        if (fs.existsSync(AUTH_DIR)) {
            const entries = fs.readdirSync(AUTH_DIR);
            for (const entry of entries) {
                if (entry.startsWith('session-')) {
                    const extractedId = cleanDigits(entry.replace('session-', ''));
                    if (extractedId && extractedId.length >= 10 && !sessions.includes(extractedId)) {
                        sessions.push(extractedId);
                        console.log(`🔍 Discovered existing session in auth dir: ${extractedId}`);
                    }
                }
            }
        }
    } catch (authErr) {
        console.warn('Warning discovering sessions from auth directory:', authErr.message);
    }

    // Deduplicate and clean
    const cleaned = [...new Set(sessions.map(s => cleanDigits(String(s))))].filter(Boolean);
    try {
        saveSessions(cleaned);
    } catch (_) {}

    return cleaned;
}

// Helper: save sessions list
function saveSessions(list) {
    try {
        const cleaned = [...new Set((list || []).map(s => cleanDigits(String(s))))].filter(Boolean);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(cleaned, null, 2), 'utf8');
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
    if (!phone) return null;
    if (typeof phone === 'string' && phone.includes('@')) return phone;
    const clean = cleanDigits(String(phone));
    if (!clean) return null;

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
        authTimeoutMs: 120000,
        qrTimeoutMs: 120000,
        webVersion: '2.3000.1018917849-alpha',
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
            strict: false
        },
        puppeteer: puppeteerOptions
    });

    clients[id] = {
        client,
        status: 'INITIALIZING',
        qr: null,
        info: null
    };

    // Watchdog timer: if stuck in INITIALIZING for >120s, cleanly reset
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
    }, 120000);

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

        // Persist session immediately
        const saved = loadSessions();
        if (!saved.includes(id)) {
            saved.push(id);
            saveSessions(saved);
        }
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
        // Auto-retry once after 5s before giving up
        setTimeout(() => {
            if (!clients[id] || clients[id].status === 'DISCONNECTED') {
                console.log(`🔄 [Auto-Retry] Retrying auth handshake for ${id}...`);
                cleanStaleLocks(id);
                startClient(id);
            }
        }, 5000);
    });

    client.on('disconnected', async (reason) => {
        console.log(`🔌 Session ${id} disconnected with reason:`, reason);
        if (clients[id]) {
            clients[id].status = 'DISCONNECTED';
            clients[id].qr = null;
        }

        // Only remove session credentials if user explicitly logged out from phone
        if (reason === 'LOGOUT') {
            console.log(`🗑️ Session ${id} unlinked by user. Clearing saved session credentials...`);
            const saved = loadSessions();
            const updated = saved.filter(s => s !== id);
            saveSessions(updated);

            const sessionAuthPath = path.join(AUTH_DIR, `session-${id}`);
            try {
                if (fs.existsSync(sessionAuthPath)) {
                    fs.rmSync(sessionAuthPath, { recursive: true, force: true });
                }
            } catch (err) {
                console.warn('Could not clean auth dir on logout:', err.message);
            }
        } else {
            // Transient drop: keep credentials and auto-reconnect continuously
            console.log(`🔄 [Auto-Keep-Alive] Transient disconnect for ${id}. Auto-reconnecting in 5 seconds...`);
            setTimeout(() => {
                if (!clients[id] || clients[id].status === 'DISCONNECTED') {
                    cleanStaleLocks(id);
                    startClient(id);
                }
            }, 5000);
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
        console.error(`Failed to initialize client ${id}:`, err?.message || err);
        if (clients[id]) {
            clients[id].status = 'DISCONNECTED';
            clients[id].qr = null;
        }
        cleanStaleLocks(id);
        // Self-healing auto-retry in 8 seconds
        setTimeout(() => {
            if (!clients[id] || clients[id].status === 'DISCONNECTED') {
                console.log(`🔄 [Self-Healing] Auto-retrying initialization for ${id}...`);
                startClient(id);
            }
        }, 8000);
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
    if (!sessionObj || (sessionObj.status !== 'CONNECTED' && sessionObj.status !== 'AUTHENTICATED')) return false;
    if (!sessionObj.client) return false;
    return true;
}

// Helper: respond with "disconnected" and automatically trigger background auto-reconnect
function respondDisconnected(res, sessionId, reason) {
    console.warn(`[${reason}] Session ${sessionId} encountered a communication glitch. Scheduling auto-reconnect...`);
    if (clients[sessionId]) clients[sessionId].status = 'DISCONNECTED';
    res.status(400).json({ success: false, error: 'Session reconnecting in background.', reason });
    // Trigger auto-reconnect
    setTimeout(() => {
        if (!clients[sessionId] || clients[sessionId].status === 'DISCONNECTED') {
            cleanStaleLocks(sessionId);
            startClient(sessionId);
        }
    }, 3000);
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
        if (!jid) {
            return res.json({ success: true, messages: [] });
        }
        let chat = null;
        try {
            chat = await sessionObj.client.getChatById(jid);
        } catch (chatErr) {
            console.warn(`[${id}] getChatById soft notice for ${phone}:`, chatErr.message || chatErr);
        }
        let messages = [];
        if (chat && typeof chat.fetchMessages === 'function') {
            try {
                messages = await chat.fetchMessages({ limit: 50 });
            } catch (fetchErr) {
                console.warn(`FetchMessages failed for ${phone}:`, fetchErr.message);
                messages = [];
            }
        }
        const list = (messages || []).map(m => ({
            id: m && m.id ? (m.id.id || m.id._serialized || String(m.id)) : `msg-${Date.now()}`,
            body: m.body || '',
            fromMe: Boolean(m.fromMe),
            timestamp: m.timestamp || Math.floor(Date.now() / 1000),
            sender: m.from ? m.from.split('@')[0] : phone
        }));
        res.json({ success: true, messages: list });
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected')) {
            return respondDisconnected(res, id, 'protocol-error');
        }
        console.warn('Failed to load chat messages (returning empty list):', e.message || e);
        res.json({ success: true, messages: [] });
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

// Runtime patch to ensure processMediaData never crashes on WhatsApp Web's memoized getters
async function injectWWebJSPatches(pupPage) {
    if (!pupPage) return;
    try {
        await pupPage.evaluate(() => {
            if (!window.WWebJS) return;
            if (window.WWebJS._patchedMediaData) return;
            window.WWebJS._patchedMediaData = true;

            const origProcessMediaData = window.WWebJS.processMediaData;
            window.WWebJS.processMediaData = async function(mediaInfo, options = {}) {
                const file = window.WWebJS.mediaInfoToFile(mediaInfo);
                const fileType = options.forceDocument ? 'document' : (options.forceVoice ? 'ptt' : (options.forceSticker ? 'sticker' : (file.type && file.type.startsWith('image/') ? 'image' : 'document')));
                
                // 1. Try modern WAWebUploadManager
                try {
                    if (window.require && window.require('WAWebUploadManager')) {
                        let filehash = await window.WWebJS.getFileHash(file);
                        let mediaKey = await window.WWebJS.generateHash(32);
                        const controller = new AbortController();
                        let uploadQpl = undefined;
                        try {
                            if (window.require('WAWebStartMediaUploadQpl')) {
                                uploadQpl = window.require('WAWebStartMediaUploadQpl').startMediaUploadQpl({ entryPoint: 'MediaUpload' });
                            }
                        } catch (_) {}

                        const uploadedInfo = await window.require('WAWebUploadManager').encryptAndUpload({
                            blob: file,
                            type: fileType,
                            signal: controller.signal,
                            mediaKey,
                            ...(uploadQpl ? { uploadQpl } : {})
                        });

                        if (uploadedInfo && (uploadedInfo.url || uploadedInfo.directPath || uploadedInfo.clientUrl)) {
                            const cleanFileName = (mediaInfo && mediaInfo.filename) ? mediaInfo.filename : (fileType === 'document' ? 'invoice.pdf' : 'file');
                            const cleanMime = (mediaInfo && mediaInfo.mimetype) ? mediaInfo.mimetype : (fileType === 'document' ? 'application/pdf' : file.type);
                            return {
                                ...uploadedInfo,
                                clientUrl: uploadedInfo.url || uploadedInfo.clientUrl,
                                deprecatedMms3Url: uploadedInfo.url || uploadedInfo.clientUrl,
                                directPath: uploadedInfo.directPath,
                                mediaKey: uploadedInfo.mediaKey || mediaKey,
                                mediaKeyTimestamp: uploadedInfo.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
                                filehash: filehash,
                                encFilehash: uploadedInfo.encFilehash,
                                uploadhash: uploadedInfo.encFilehash,
                                size: file.size,
                                type: fileType,
                                mimetype: cleanMime,
                                filename: cleanFileName,
                                isViewOnce: false,
                            };
                        }
                    }
                } catch (mgrErr) {
                    console.warn('[WWebJS] UploadManager bypass:', mgrErr);
                }

                // 2. Safe Fallback
                try {
                    const OpaqueData = window.require('WAWebMediaOpaqueData');
                    const opaqueData = await OpaqueData.createFromData(file, mediaInfo.mimetype);
                    const mediaParams = {
                        asSticker: options.forceSticker,
                        asGif: options.forceGif,
                        isPtt: options.forceVoice,
                        asDocument: options.forceDocument,
                    };
                    const mediaPrep = window.require('WAWebPrepRawMedia').prepRawMedia(opaqueData, mediaParams);
                    const mediaData = await mediaPrep.waitForPrep();
                    const mediaObject = window.require('WAWebMediaStorage').getOrCreateMediaObject(mediaData.filehash);
                    if (mediaObject && !mediaObject.id) mediaObject.id = mediaData.filehash || 'media_' + Date.now();
                    if (mediaData && !mediaData.id) mediaData.id = mediaData.filehash || 'media_' + Date.now();

                    const mediaType = window.require('WAWebMmsMediaTypes').msgToMediaType({
                        type: mediaData.type,
                        isGif: mediaData.isGif,
                        isNewsletter: options.sendToChannel,
                    });

                    if (!(mediaData.mediaBlob instanceof OpaqueData)) {
                        mediaData.mediaBlob = await OpaqueData.createFromData(mediaData.mediaBlob, mediaData.mediaBlob.type);
                    }
                    mediaData.renderableUrl = mediaData.mediaBlob.url();
                    mediaObject.consolidate(mediaData.toJSON());
                    mediaData.mediaBlob.autorelease();

                    let meUser = null;
                    try {
                        const { getMaybeMePnUser, getMaybeMeLidUser } = window.require('WAWebUserPrefsMeUser');
                        meUser = getMaybeMePnUser() || getMaybeMeLidUser();
                    } catch (_) {}

                    const targetWid = options.chat ? (options.chat.id || options.chat) : meUser;
                    const uploadChatObj = (options.chat && options.chat.id) ? options.chat : (targetWid ? Object.assign({ id: targetWid }, targetWid) : { id: meUser });

                    const dataToUpload = {
                        id: mediaData.filehash || mediaData.id || `media_${Date.now()}`,
                        mimetype: mediaData.mimetype,
                        mediaObject,
                        mediaType,
                        file,
                        chat: uploadChatObj,
                        to: targetWid,
                        user: meUser,
                        sender: meUser,
                    };

                    const { uploadMedia, uploadUnencryptedMedia } = window.require('WAWebMediaMmsV4Upload');
                    const uploadedMedia = !options.sendToChannel ? await uploadMedia(dataToUpload) : await uploadUnencryptedMedia(dataToUpload);
                    if (uploadedMedia && uploadedMedia.mediaEntry) {
                        return Object.assign(uploadedMedia.mediaEntry, {
                            type: mediaData.type,
                            mimetype: mediaData.mimetype,
                            size: mediaData.size,
                            filename: mediaData.filename || (options.forceDocument ? 'invoice.pdf' : 'file'),
                            isViewOnce: false,
                        });
                    }
                } catch (fbErr) {
                    console.error('[WWebJS] Fallback error:', fbErr);
                }

                if (typeof origProcessMediaData === 'function') {
                    return origProcessMediaData.apply(this, [mediaInfo, options]);
                }
            };
        });
    } catch (_) {}
}

// 9. Send media (image/PDF) to a contact
app.post('/sessions/:id/chats/:phone/send-media', async (req, res) => {
    const id = cleanDigits(req.params.id);
    const phone = req.params.phone;
    const { mimeType, fileName, caption } = req.body;
    let rawData = req.body.data;

    const sessionObj = clients[id];
    if (!isClientAlive(sessionObj)) {
        return res.status(400).json({ success: false, error: 'Session is not connected' });
    }

    if (!mimeType || !rawData) {
        return res.status(400).json({ success: false, error: 'mimeType and data (base64) are required' });
    }

    // Clean base64 data string — strip data URI prefix and whitespace
    if (typeof rawData === 'string') {
        if (rawData.includes('base64,')) {
            rawData = rawData.split('base64,')[1];
        }
        rawData = rawData.replace(/[\r\n\s]+/g, '');
    }

    try {
        const jid = await resolveJid(sessionObj.client, phone);
        if (!jid) {
            return res.status(400).json({ success: false, error: 'Invalid recipient phone/JID' });
        }
        const { MessageMedia } = require('whatsapp-web.js');

        const isDoc = (mimeType && (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('msword') || mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('zip') || mimeType.includes('octet-stream'))) || Boolean(fileName && fileName.endsWith('.pdf'));
        const safeName = (fileName || `invoice_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
        
        const media = new MessageMedia(mimeType || 'application/pdf', rawData, safeName);

        const sendOptions = {
            sendMediaAsDocument: isDoc
        };
        if (caption && caption.trim()) {
            sendOptions.caption = caption.trim();
        }

        // Apply browser runtime patch
        await injectWWebJSPatches(sessionObj.client.pupPage);

        let sentMsg = null;
        try {
            sentMsg = await sessionObj.client.sendMessage(jid, media, sendOptions);
        } catch (sendErr) {
            console.warn(`[${id}] Primary media send failed (${sendErr.message}). Retrying with warm-up handshake...`);
            try {
                await sessionObj.client.sendMessage(jid, caption || `📄 ${safeName}`);
                await new Promise(r => setTimeout(r, 1000));
            } catch (_) {}
            sentMsg = await sessionObj.client.sendMessage(jid, media, sendOptions);
        }

        console.log(`[${id}] ✅ Media sent to ${jid}`);
        res.json({
            success: true,
            message_id: sentMsg && sentMsg.id ? (sentMsg.id.id || sentMsg.id._serialized || sentMsg.id) : `media-${Date.now()}`,
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

// Keep-Alive Heartbeat: monitors all registered sessions and automatically brings them online
setInterval(async () => {
    try {
        const saved = loadSessions();
        for (const id of saved) {
            const current = clients[id];
            if (!current || current.status === 'DISCONNECTED') {
                console.log(`💓 [Heartbeat] Auto-reviving offline session: ${id}`);
                cleanStaleLocks(id);
                startClient(id);
                // Pause between restores to avoid CPU contention
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    } catch (e) {
        console.warn('Heartbeat error:', e.message);
    }
}, 30000);

// Server boot: restore active persistent sessions sequentially
app.listen(PORT, async () => {
    console.log(`🟢 WhatsApp Gateway listening on port ${PORT}`);
    const active = loadSessions();
    console.log(`🔄 Auto-restoring ${active.length} active persistent sessions:`, active);
    for (const id of active) {
        try {
            console.log(`🚀 [Boot] Restoring session: ${id}`);
            startClient(id);
            // Stagger multiple sessions by 3 seconds so Chromium instances load smoothly
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.error(`Auto-restore failed for ${id}:`, e);
        }
    }
});
