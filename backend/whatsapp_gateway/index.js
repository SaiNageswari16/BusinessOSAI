const express = require('express');
const cors = require('cors');
const axios = require('axios');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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

// Lifecycle & Reconnect Constants
const ACTIVE_STATES = new Set(['INITIALIZING', 'AUTHENTICATED', 'QR_READY', 'CONNECTED']);
const INITIALIZING_WATCHDOG_MS = 120000; // 120s max in INITIALIZING
const AUTHENTICATED_WATCHDOG_MS = 90000; // 90s max in AUTHENTICATED before READY
const FORCE_RESTART_COOLDOWN_MS = 30000; // Ignore duplicate force=true while already initializing <30s
const MAX_QR_ROTATIONS = 5;              // Pause auto-reconnect if QR rotates 5 times without scan
const MAX_RECONNECT_ATTEMPTS = 5;        // Max consecutive auto-reconnect retries before cooldown
const BASE_RECONNECT_DELAY_MS = 5000;    // 5s initial backoff
const MAX_RECONNECT_DELAY_MS = 60000;    // 60s max backoff

// Store active clients:
// {
//   [id]: {
//     client, status, qr, info, instanceId,
//     watchdogTimer, reconnectTimer, reconnectReason,
//     retryCount, qrCount, wasAuthenticated,
//     awaitingManualQr, pausedReconnect, loggedOut,
//     isDestroying, initStartedAt
//   }
// }
const clients = {};

// Per-session async mutex locks to serialize start/destroy operations
const startLocks = {};

// Monotonically increasing client generation counter to isolate stale callbacks
let globalInstanceCounter = 0;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: clean E.164 digits
function cleanDigits(id) {
    if (!id) return '';
    return String(id).replace(/\D/g, '');
}

// Helper: compute alternate 10-digit / 91-prefixed 12-digit Indian number variant
function getAlternatePhoneId(digits) {
    if (!digits) return null;
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return null;
}

// Helper: resolve a raw session ID to its single canonical ID
// Prevents duplicate clients for 10-digit vs 91-prefixed 12-digit numbers (e.g. 9908297963 vs 919908297963)
function resolveCanonicalSessionId(rawId) {
    const digits = cleanDigits(rawId);
    if (!digits) return '';

    // 1. Check in-memory active session map first
    if (clients[digits]) return digits;
    const alt = getAlternatePhoneId(digits);
    if (alt && clients[alt]) return alt;

    // 2. Check existing .wwebjs_auth/session-<id> directories on disk (preserve existing auth credentials!)
    try {
        const directAuthDir = path.join(AUTH_DIR, `session-${digits}`);
        const altAuthDir = alt ? path.join(AUTH_DIR, `session-${alt}`) : null;
        const directExists = fs.existsSync(directAuthDir);
        const altExists = Boolean(altAuthDir && fs.existsSync(altAuthDir));

        if (directExists && !altExists) return digits;
        if (altExists && !directExists) return alt;
        if (directExists && altExists) {
            // If both exist on disk, prefer the 12-digit E.164 form (91...)
            return digits.length === 12 ? digits : alt;
        }
    } catch (_) { }

    return digits;
}

// Helper: deduplicate a list of session IDs so 10-digit and 91-prefixed variants collapse to one canonical ID
function deduplicateSessionList(rawList) {
    const result = [];
    const seenCanonical = new Set();
    for (const item of (rawList || [])) {
        const canonical = resolveCanonicalSessionId(item);
        if (!canonical || canonical.length < 10) continue;
        const alt = getAlternatePhoneId(canonical);
        if (seenCanonical.has(canonical) || (alt && seenCanonical.has(alt))) {
            continue;
        }
        seenCanonical.add(canonical);
        result.push(canonical);
    }
    return result;
}

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
    // Deduplicate and canonicalize without deleting any auth directories
    const cleaned = deduplicateSessionList(sessions);
    try {
        saveSessions(cleaned);
    } catch (_) { }

    return cleaned;
}

// Helper: save sessions list
function saveSessions(list) {
    try {
        const cleaned = [...new Set((list || []).map(s => cleanDigits(String(s))))].filter(Boolean);
        const cleaned = deduplicateSessionList(list);
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
// Helper: global clean-up of ALL stale Chromium lock files across all sessions (used only at boot/shutdown)
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
            } catch (_) { }
        }
        console.log('🧹 [Self-Healing] All stale Chromium locks successfully cleared.');
    } catch (e) {
        console.warn('Warning during global lock cleanup:', e.message);
    }
}

// Clean on module load
// Clean on module load before any clients are started
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
        // Helper: cancel watchdog and reconnect timers on a session object
        function cancelSessionTimers(sessionObj) {
            if (!sessionObj) return;
            if (sessionObj.watchdogTimer) {
                clearTimeout(sessionObj.watchdogTimer);
                sessionObj.watchdogTimer = null;
            }
            if (sessionObj.reconnectTimer) {
                clearTimeout(sessionObj.reconnectTimer);
                sessionObj.reconnectTimer = null;
                sessionObj.reconnectReason = null;
            }
        }

        // Helper: Force-kill any orphaned OS Chromium processes still holding the session's user-data-dir
        function killOrphanedSessionProcesses(sessionId, browserPid = null) {
            if (browserPid) {
                try {
                    if (clients[id]?.client) {
                        await clients[id].client.destroy();
                    }
                    process.kill(browserPid, 'SIGKILL');
                    console.log(`🔪 [${sessionId}] Sent SIGKILL to Chromium PID ${browserPid}`);
                } catch (_) { }
            });
    await Promise.all(promises);
    cleanAllStaleLocks();
    process.exit(0);
}

if (process.platform === 'linux' && sessionId) {
    const sessionDirMarker = path.join(AUTH_DIR, `session-${sessionId}`);
    try {
        execFileSync('pkill', ['-9', '-f', sessionDirMarker], { stdio: 'ignore' });
    } catch (_) {
        // pkill exits with code 1 when no matching processes exist — safe to ignore
    }
}
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
            // Bulletproof Chromium & WhatsApp Client Cleanup
            // Ensures old client and all child Chromium processes are completely terminated before replacement
            async function destroyClientSafely(sessionId, reason = 'cleanup', targetClient = null) {
                const id = resolveCanonicalSessionId(sessionId);
                const sessionObj = clients[id];
                const clientToDestroy = targetClient || sessionObj?.client;

                if (sessionObj && (!targetClient || sessionObj.client === targetClient)) {
                    sessionObj.isDestroying = true;
                    cancelSessionTimers(sessionObj);
                }

                if (!clientToDestroy) {
                    cleanStaleLocks(id);
                    if (sessionObj && (!targetClient || sessionObj.client === targetClient)) {
                        sessionObj.isDestroying = false;
                    }
                    console.log(`🔄 Re-initializing stale/requested client for ${id}...`);
                    return;
                }

                if (clientToDestroy._destroyPromise) {
                    await clientToDestroy._destroyPromise;
                    return;
                }

                clientToDestroy._isBeingDestroyed = true;

                clientToDestroy._destroyPromise = (async () => {
                    let browserPid = null;
                    let pupBrowser = null;
                    try {
                        if (clients[id].client) clients[id].client.destroy();
                        pupBrowser = clientToDestroy.pupBrowser || null;
                        const proc = pupBrowser?.process?.();
                        if (proc && proc.pid) {
                            browserPid = proc.pid;
                        }
                    } catch (_) { }
                    delete clients[id];
                }

    cleanStaleLocks(id);
                // Remove listeners first so teardown does not emit spurious disconnected/auth_failure events
                try {
                    clientToDestroy.removeAllListeners();
                } catch (_) { }

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
                try {
                    if (pupBrowser) {
                        const pages = await Promise.race([
                            pupBrowser.pages().catch(() => []),
                            sleep(2000).then(() => [])
                        ]);
                        for (const page of (pages || [])) {
                            try {
                                await Promise.race([page.close({ runBeforeUnload: false }), sleep(1000)]);
                            } catch (_) { }
                        }
                    }
                } catch (_) { }

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
                            try {
                                await Promise.race([
                                    clientToDestroy.destroy(),
                                    sleep(8000).then(() => {
                                        throw new Error('client.destroy() timed out after 8000ms');
                                    })
                                ]);
                            } catch (err) {
                                console.warn(`⚠️ [${id}] Graceful destroy warning (${reason}): ${err?.message || err}`);
                            }

                            try {
                                if (pupBrowser) {
                                    await Promise.race([pupBrowser.close(), sleep(2000)]);
                                }
                            } catch (_) { }

                            // Check if browser PID may have been assigned late during initialize()
                            try {
                                if (!browserPid && clientToDestroy.pupBrowser?.process?.()?.pid) {
                                    browserPid = clientToDestroy.pupBrowser.process().pid;
                                }
                            } catch (_) { }

                            // Ensure zero orphaned Chromium processes remain for this session
                            killOrphanedSessionProcesses(id, browserPid);
                            cleanStaleLocks(id);

                            if (sessionObj && sessionObj.client === clientToDestroy) {
                                sessionObj.client = null;
                                sessionObj.isDestroying = false;
                            }
                        }) ();

                        await clientToDestroy._destroyPromise;
                    }

                    // Centralized Reconnection Manager
                    // Deduplicates retry timers, enforces exponential backoff, and respects manual QR / cooldown states
                    function scheduleReconnect(rawId, reason, expectedInstanceId = null) {
                        const id = resolveCanonicalSessionId(rawId);
                        if (!id) return;

                        const session = clients[id];

                        // 1. Ignore callbacks from stale/replaced client instances
                        if (expectedInstanceId !== null && session && session.instanceId !== expectedInstanceId) {
                            console.log(`🛡️ [${id}] Ignoring reconnect request (${reason}) from stale instance #${expectedInstanceId} (active: #${session.instanceId})`);
                            return;
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
                        // 2. Do not auto-reconnect if explicitly logged out or waiting for manual QR scan
                        if (session && (session.loggedOut || session.awaitingManualQr)) {
                            console.log(`⏸️ [${id}] Auto-reconnect skipped (${reason}) — session is ${session.loggedOut ? 'logged out' : 'awaiting manual QR scan'}.`);
                            return;
                        }

                        clients[id] = {
                            client,
                            status: 'INITIALIZING',
                            qr: null,
                            info: null
                        };
                        // 3. Do not auto-reconnect if paused after hitting max retry cap
                        if (session && session.pausedReconnect) {
                            console.log(`⏸️ [${id}] Auto-reconnect paused after ${session.retryCount} failed attempts. Awaiting manual /start.`);
                            return;
                        }

                        // Watchdog timer: if stuck in INITIALIZING for >120s, cleanly reset
                        const watchdogTimer = setTimeout(() => {
                            if (clients[id] && clients[id].status === 'INITIALIZING') {
                                console.warn(`⏱️ [Watchdog] Session ${id} took too long in INITIALIZING. Resetting cleanly...`);
                                // 4. Do not auto-reconnect if session is already active
                                if (session && ACTIVE_STATES.has(session.status) && !session.isDestroying) {
                                    console.log(`ℹ️ [${id}] Session is already ${session.status}; skipping reconnect (${reason}).`);
                                    return;
                                }

                                // 5. Deduplicate if a reconnect timer is already pending for this session
                                if (session && session.reconnectTimer) {
                                    console.log(`⏳ [${id}] Reconnect already scheduled (${session.reconnectReason}). Deduplicating trigger: ${reason}`);
                                    return;
                                }

                                // Ensure session entry exists to hold retry metadata
                                if (!clients[id]) {
                                    clients[id] = {
                                        client: null,
                                        status: 'DISCONNECTED',
                                        qr: null,
                                        info: null,
                                        instanceId: ++globalInstanceCounter,
                                        watchdogTimer: null,
                                        reconnectTimer: null,
                                        reconnectReason: null,
                                        retryCount: 0,
                                        qrCount: 0,
                                        wasAuthenticated: false,
                                        awaitingManualQr: false,
                                        pausedReconnect: false,
                                        loggedOut: false,
                                        isDestroying: false,
                                        initStartedAt: 0
                                    };
                                }

                                const target = clients[id];
                                target.retryCount = (target.retryCount || 0) + 1;

                                if (target.retryCount > MAX_RECONNECT_ATTEMPTS) {
                                    target.pausedReconnect = true;
                                    cancelSessionTimers(target);
                                    console.warn(`🛑 [${id}] Reached max auto-reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) after "${reason}". Pausing background retries until manual /start.`);
                                    return;
                                }

                                const expDelay = Math.min(
                                    BASE_RECONNECT_DELAY_MS * Math.pow(2, target.retryCount - 1),
                                    MAX_RECONNECT_DELAY_MS
                                );
                                const jitter = Math.floor(Math.random() * 1500);
                                const delayMs = expDelay + jitter;
                                const scheduledInstanceId = target.instanceId;

                                target.reconnectReason = reason;
                                console.log(`🔄 [Reconnect Manager] Scheduled reconnect #${target.retryCount}/${MAX_RECONNECT_ATTEMPTS} for ${id} in ${Math.round(delayMs / 1000)}s (reason: ${reason})`);

                                target.reconnectTimer = setTimeout(async () => {
                                    const current = clients[id];
                                    if (!current || current.instanceId !== scheduledInstanceId) {
                                        return;
                                    }
                                    current.reconnectTimer = null;
                                    current.reconnectReason = null;

                                    if (current.loggedOut || current.awaitingManualQr || current.pausedReconnect) {
                                        return;
                                    }
                                    if (ACTIVE_STATES.has(current.status)) {
                                        return;
                                    }

                                    await startClient(id, false, { manual: false, reason: `reconnect:${reason}` });
                                }, delayMs);
                            }

                            // Graceful process shutdown handler
                            async function gracefulShutdown(signal) {
                                console.log(`🛑 Received ${signal}. Gracefully destroying all WhatsApp clients...`);
                                const ids = Object.keys(clients);
                                await Promise.all(
                                    ids.map(async (id) => {
                                        try {
                                            client.destroy();
                                            if (clients[id]) {
                                                clients[id].loggedOut = true;
                                                cancelSessionTimers(clients[id]);
                                            }
                                            await destroyClientSafely(id, `shutdown:${signal}`);
                                        } catch (_) { }
                                        cleanStaleLocks(id);
                                        clients[id].status = 'DISCONNECTED';
                                        clients[id].qr = null;
                                    }
    }, 120000);
                    })
    );
                    cleanAllStaleLocks();
                    process.exit(0);
                }
                process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
                process.on('SIGINT', () => gracefulShutdown('SIGINT'));

                client.on('loading_screen', (percent, message) => {
                    console.log(`⏳ [${id}] Loading screen: ${percent}% - ${message}`);
                });
                // Core: Start a Client (Serialized per session via startLocks[id])
                async function startClient(rawId, forceRestart = false, options = {}) {
                    const id = resolveCanonicalSessionId(rawId);
                    if (!id) return null;

                    client.on('change_state', (state) => {
                        console.log(`🔄 [${id}] WhatsApp state changed: ${state}`);
                    });
                    const isManual = Boolean(options.manual);

                    client.on('qr', async (qrText) => {
                        clearTimeout(watchdogTimer);
                        console.log(`📲 [${id}] QR generated successfully`);
                        // Fast path: if already starting inside lock and not forcing a restart, await the in-flight lock
                        if (startLocks[id]) {
                            console.log(`🔒 [${id}] Initialization already in progress. Joining existing start lock...`);
                            try {
                                const qrDataUrl = await qrcode.toDataURL(qrText);
                                clients[id].status = 'QR_READY';
                                clients[id].qr = qrDataUrl;
                            } catch (e) {
                                console.error('QR parsing error:', e);
                                await startLocks[id];
                            } catch (_) { }
                            if (!forceRestart && clients[id] && ACTIVE_STATES.has(clients[id].status)) {
                                return clients[id];
                            }
                        }

                        let releaseLock;
                        const lockPromise = new Promise((resolve) => {
                            releaseLock = resolve;
                        });
                        startLocks[id] = lockPromise;

                        client.on('authenticated', () => {
                            clearTimeout(watchdogTimer);
                            console.log(`🔑 [${id}] Session AUTHENTICATED`);
                            clients[id].status = 'AUTHENTICATED';
                            clients[id].qr = null;
                            try {
                                const existing = clients[id];

                                // Persist session immediately
                                const saved = loadSessions();
                                if (!saved.includes(id)) {
                                    saved.push(id);
                                    saveSessions(saved);
                                    // If manual start requested (e.g. POST /sessions/:id/start), clear pause/QR cooldown flags
                                    if (isManual && existing) {
                                        existing.awaitingManualQr = false;
                                        existing.pausedReconnect = false;
                                        existing.loggedOut = false;
                                        existing.retryCount = 0;
                                    }
                                });

                        client.on('ready', () => {
                            clearTimeout(watchdogTimer);
                            console.log(`✅ [${id}] Session is fully CONNECTED and READY`);
                            clients[id].status = 'CONNECTED';
                            clients[id].qr = null;
                            clients[id].info = client.info;
                            if (existing) {
                                // 1. Protect all active states (INITIALIZING, AUTHENTICATED, QR_READY, CONNECTED) from duplicate starts
                                if (!forceRestart && ACTIVE_STATES.has(existing.status) && !existing.isDestroying) {
                                    console.log(`ℹ️ [${id}] Client is already active (${existing.status}, instance #${existing.instanceId}). Returning existing instance.`);
                                    return existing;
                                }

                                // Ensure session is persisted
                                const saved = loadSessions();
                                if (!saved.includes(id)) {
                                    saved.push(id);
                                    saveSessions(saved);
                                    // 2. Protect in-flight INITIALIZING against rapid forceRestart double-clicks within 30s
                                    if (
                                        forceRestart &&
                                        existing.status === 'INITIALIZING' &&
                                        !existing.isDestroying &&
                                        Date.now() - (existing.initStartedAt || 0) < FORCE_RESTART_COOLDOWN_MS
                                    ) {
                                        console.log(`⏳ [${id}] Client is already INITIALIZING (<30s). Suppressing redundant forceRestart.`);
                                        return existing;
                                    }

                                    // 3. If background (non-manual) start attempted while awaiting manual QR or paused, abort
                                    if (!isManual && (existing.awaitingManualQr || existing.pausedReconnect || existing.loggedOut)) {
                                        return existing;
                                    }

                                    console.log(`🔄 [${id}] Cleaning up previous client instance #${existing.instanceId} (status: ${existing.status}, force: ${forceRestart})...`);
                                    cancelSessionTimers(existing);
                                    await destroyClientSafely(id, forceRestart ? 'force-restart' : 'reinitialize', existing.client);
                                }
                            });

                        client.on('auth_failure', async (msg) => {
                            console.error(`❌ Session ${id} Auth Failure:`, msg);
                            if (clients[id]) {
                                clients[id].status = 'DISCONNECTED';
                                clients[id].qr = null;
                                cleanStaleLocks(id);

                                const instanceId = ++globalInstanceCounter;
                                const prevRetryCount = isManual ? 0 : (existing?.retryCount || 0);
                                const prevWasAuthenticated = Boolean(existing?.wasAuthenticated);

                                console.log(`🚀 [${id}] Initializing WhatsApp client (instance #${instanceId}, retry #${prevRetryCount})`);

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
                                        '--disable-background-networking',
                                        '--disable-default-apps',
                                        '--disable-sync',
                                        '--disable-translate',
                                        '--mute-audio',
                                        '--safebrowsing-disable-auto-update',
                                        '-- disable-features=IsolateOrigins,site-per-process'.replace('-- ', '--'),
                                        '--js-flags=--max-old-space-size=256'
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
                                try {
                                    await client.destroy();
                                } catch (_) { }
                                // Auto-retry once after 5s before giving up
                                setTimeout(() => {
                                    if (!clients[id] || clients[id].status === 'DISCONNECTED') {
                                        console.log(`🔄 [Auto-Retry] Retrying auth handshake for ${id}...`);
                                        cleanStaleLocks(id);
                                        startClient(id);

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

                                        const sessionState = {
                                            client,
                                            status: 'INITIALIZING',
                                            qr: null,
                                            info: null,
                                            instanceId,
                                            watchdogTimer: null,
                                            reconnectTimer: null,
                                            reconnectReason: null,
                                            retryCount: prevRetryCount,
                                            qrCount: 0,
                                            wasAuthenticated: prevWasAuthenticated,
                                            awaitingManualQr: false,
                                            pausedReconnect: false,
                                            loggedOut: false,
                                            isDestroying: false,
                                            initStartedAt: Date.now()
                                        };

                                        clients[id] = sessionState;

                                        // Guard helper: verify this callback still belongs to the active client instance
                                        const isCurrentInstance = () => {
                                            return Boolean(
                                                clients[id] &&
                                                clients[id].instanceId === instanceId &&
                                                !clients[id].isDestroying &&
                                                !client._isBeingDestroyed
                                            );
                                        };

                                        // Watchdog timer: if stuck in INITIALIZING for >120s, cleanly destroy and schedule controlled reconnect
                                        sessionState.watchdogTimer = setTimeout(async () => {
                                            if (!isCurrentInstance()) return;
                                            if (clients[id].status === 'INITIALIZING') {
                                                console.warn(`⏱️ [Watchdog] Session ${id} (instance #${instanceId}) stuck in INITIALIZING >120s. Destroying cleanly...`);
                                                clients[id].status = 'DISCONNECTED';
                                                clients[id].qr = null;
                                                await destroyClientSafely(id, 'initializing-watchdog', client);
                                                scheduleReconnect(id, 'initializing-watchdog', instanceId);
                                            }
                                        }, 5000);
                                    });
                            }, INITIALIZING_WATCHDOG_MS);

                        client.on('disconnected', async (reason) => {
                            console.log(`🔌 Session ${id} disconnected with reason:`, reason);
                            if (clients[id]) {
                                clients[id].status = 'DISCONNECTED';
                                clients[id].qr = null;
                            }
                            client.on('loading_screen', (percent, message) => {
                                if (!isCurrentInstance()) return;
                                console.log(`⏳ [${id}] Loading screen: ${percent}% - ${message}`);
                            });

                            // Only remove session credentials if user explicitly logged out from phone
                            if (reason === 'LOGOUT') {
                                console.log(`🗑️ Session ${id} unlinked by user. Clearing saved session credentials...`);
                                const saved = loadSessions();
                                const updated = saved.filter(s => s !== id);
                                saveSessions(updated);
                                client.on('change_state', (state) => {
                                    if (!isCurrentInstance()) return;
                                    console.log(`🔄 [${id}] WhatsApp state changed: ${state}`);
                                });

                                const sessionAuthPath = path.join(AUTH_DIR, `session-${id}`);
                                client.on('qr', async (qrText) => {
                                    if (!isCurrentInstance()) {
                                        await destroyClientSafely(id, 'stale-qr-instance', client);
                                        return;
                                    }

                                    if (sessionState.watchdogTimer) {
                                        clearTimeout(sessionState.watchdogTimer);
                                        sessionState.watchdogTimer = null;
                                    }

                                    sessionState.qrCount = (sessionState.qrCount || 0) + 1;

                                    // Stop infinite QR generation if no user scans the QR after MAX_QR_ROTATIONS
                                    if (sessionState.qrCount > MAX_QR_ROTATIONS) {
                                        console.warn(`⏸️ [${id}] QR rotated ${sessionState.qrCount - 1} times without scan. Closing idle browser and awaiting manual start.`);
                                        sessionState.status = 'DISCONNECTED';
                                        sessionState.qr = null;
                                        sessionState.awaitingManualQr = true;
                                        await destroyClientSafely(id, 'qr-max-rotations', client);
                                        return;
                                    }

                                    console.log(`📲 [${id}] QR generated (${sessionState.qrCount}/${MAX_QR_ROTATIONS})`);
                                    try {
                                        if (fs.existsSync(sessionAuthPath)) {
                                            fs.rmSync(sessionAuthPath, { recursive: true, force: true });
                                            const qrDataUrl = await qrcode.toDataURL(qrText);
                                            if (!isCurrentInstance()) return;
                                            sessionState.status = 'QR_READY';
                                            sessionState.qr = qrDataUrl;
                                        } catch (e) {
                                            console.error(`QR parsing error for ${id}:`, e);
                                        }
                                    });

                                client.on('authenticated', () => {
                                    if (!isCurrentInstance()) {
                                        destroyClientSafely(id, 'stale-authenticated-instance', client).catch(() => { });
                                        return;
                                    }

                                    if (sessionState.watchdogTimer) {
                                        clearTimeout(sessionState.watchdogTimer);
                                        sessionState.watchdogTimer = null;
                                    }

                                    console.log(`🔑 [${id}] Session AUTHENTICATED (instance #${instanceId})`);
                                    sessionState.status = 'AUTHENTICATED';
                                    sessionState.qr = null;
                                    sessionState.qrCount = 0;
                                    sessionState.wasAuthenticated = true;
                                    sessionState.awaitingManualQr = false;
                                    sessionState.pausedReconnect = false;
                                    sessionState.retryCount = 0;

                                    // Secondary watchdog in case session hangs indefinitely between AUTHENTICATED and READY
                                    sessionState.watchdogTimer = setTimeout(async () => {
                                        if (!isCurrentInstance()) return;
                                        if (clients[id].status === 'AUTHENTICATED') {
                                            console.warn(`⏱️ [Watchdog] Session ${id} stuck in AUTHENTICATED >90s without READY. Reconnecting cleanly...`);
                                            clients[id].status = 'DISCONNECTED';
                                            await destroyClientSafely(id, 'authenticated-watchdog', client);
                                            scheduleReconnect(id, 'authenticated-watchdog', instanceId);
                                        }
                                    } catch (err) {
                                        console.warn('Could not clean auth dir on logout:', err.message);
                                    }, AUTHENTICATED_WATCHDOG_MS);

                                // Persist session immediately
                                const saved = loadSessions();
                                if (!saved.includes(id)) {
                                    saved.push(id);
                                    saveSessions(saved);
                                }
                            } else {
                                // Transient drop: keep credentials and auto-reconnect continuously
                                console.log(`🔄 [Auto-Keep-Alive] Transient disconnect for ${id}. Auto-reconnecting in 5 seconds...`);
                                setTimeout(() => {
                                    if (!clients[id] || clients[id].status === 'DISCONNECTED') {
                                        cleanStaleLocks(id);
                                        startClient(id);
                                    });

                                client.on('ready', () => {
                                    if (!isCurrentInstance()) {
                                        destroyClientSafely(id, 'stale-ready-instance', client).catch(() => { });
                                        return;
                                    }

                                    cancelSessionTimers(sessionState);
                                    console.log(`✅ [${id}] Session is fully CONNECTED and READY (instance #${instanceId})`);
                                    sessionState.status = 'CONNECTED';
                                    sessionState.qr = null;
                                    sessionState.qrCount = 0;
                                    sessionState.wasAuthenticated = true;
                                    sessionState.awaitingManualQr = false;
                                    sessionState.pausedReconnect = false;
                                    sessionState.retryCount = 0;
                                    sessionState.info = client.info;

                                    // Ensure session is persisted
                                    const saved = loadSessions();
                                    if (!saved.includes(id)) {
                                        saved.push(id);
                                        saveSessions(saved);
                                    }
                                });

                                client.on('auth_failure', async (msg) => {
                                    if (!isCurrentInstance()) {
                                        await destroyClientSafely(id, 'stale-auth-failure', client);
                                        return;
                                    }

                                    cancelSessionTimers(sessionState);
                                    console.error(`❌ [${id}] Session Auth Failure (instance #${instanceId}):`, msg);
                                    sessionState.status = 'DISCONNECTED';
                                    sessionState.qr = null;

                                    await destroyClientSafely(id, 'auth_failure', client);
                                    scheduleReconnect(id, 'auth_failure', instanceId);
                                });

                                client.on('disconnected', async (reason) => {
                                    if (!isCurrentInstance()) {
                                        await destroyClientSafely(id, 'stale-disconnected', client);
                                        return;
                                    }

                                    cancelSessionTimers(sessionState);
                                    const reasonStr = String(reason || '');
                                    const wasInQrMode = sessionState.status === 'QR_READY' || (!sessionState.wasAuthenticated && sessionState.qrCount > 0);
                                    const isQrRetriesExceeded = reasonStr.toLowerCase().includes('max qrcode retries') || wasInQrMode;

                                    console.log(`🔌 [${id}] Session disconnected (instance #${instanceId}) with reason: ${reasonStr}`);
                                    sessionState.status = 'DISCONNECTED';
                                    sessionState.qr = null;

                                    // 1. Explicit user logout from mobile device -> clean credentials
                                    if (reasonStr === 'LOGOUT') {
                                        console.log(`🗑️ [${id}] Session unlinked by user (LOGOUT). Clearing saved session credentials...`);
                                        sessionState.loggedOut = true;
                                        await destroyClientSafely(id, 'user-logout', client);

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
                                    }, 5000);
                            }
                            delete clients[id];
                            return;
                        }

        try {
                            await client.destroy();
                        } catch (_) { }
                    });
                    // 2. Unscanned QR timeout -> destroy browser and wait for manual /start (do NOT loop QR in background)
                    if (isQrRetriesExceeded) {
                        console.log(`⏸️ [${id}] Disconnected during unauthenticated QR phase (${reasonStr}). Pausing until manual start.`);
                        sessionState.awaitingManualQr = true;
                        await destroyClientSafely(id, `qr-disconnected:${reasonStr}`, client);
                        return;
                    }

                    // Inbound Message Listener
                    client.on('message', async (msg) => {
                        console.log(`📥 Incoming message for ${id} from ${msg.from}`);
                        let fromNumber = msg.from.split('@')[0];
                        let profileName = msg._data.notifyName || '';
                        // 3. Transient disconnect -> destroy old browser cleanly and schedule controlled reconnect
                        await destroyClientSafely(id, `disconnected:${reasonStr}`, client);
                        scheduleReconnect(id, `disconnected:${reasonStr}`, instanceId);
                    });

                    try {
                        const contact = await msg.getContact();
                        if (contact?.id?.server === 'c.us') {
                            fromNumber = contact.id.user;
                        } else if (contact?.number) {
                            fromNumber = contact.number;
                            // Inbound Message Listener
                            client.on('message', async (msg) => {
                                if (!isCurrentInstance()) return;

                                console.log(`📥 Incoming message for ${id} from ${msg.from}`);
                                let fromNumber = msg.from.split('@')[0];
                                let profileName = msg._data?.notifyName || '';

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
                                profileName = contact.name || contact.pushname || profileName;
                            } catch (e) {
                                console.warn('Failed to fetch contact details:', e);
                            }

                            // Fallback: if fromNumber is still a LID (contains lid or length > 12), resolve it explicitly
                            if (fromNumber.includes('lid') || fromNumber.length > 12) {
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
                                    const contactObj = await client.getContactById(msg.from);
                                    if (contactObj && contactObj.number) {
                                        fromNumber = contactObj.number;
                                    }
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
                                    console.warn('Failed to resolve LID fallback:', err);
                                    console.error('❌ Webhook dispatch failed:', err.message);
                                }
                            }
                        });

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
                            // Launch browser asynchronously; handle initialization errors via centralized reconnect manager
                            client.initialize().then(async () => {
                                // If this client was superseded or marked for destruction while puppeteer.launch() was running, reap it immediately
                                if (!isCurrentInstance()) {
                                    console.log(`🧹 [${id}] Reaping superseded client instance #${instanceId} after initialize() settled.`);
                                    await destroyClientSafely(id, 'superseded-after-init', client);
                                }
                            }).catch(async (err) => {
                                const errMsg = err?.message || String(err);
                                console.error(`❌ [${id}] Failed to initialize client (instance #${instanceId}):`, errMsg);

                                if (!isCurrentInstance()) {
                                    await destroyClientSafely(id, 'stale-init-error', client);
                                    return;
                                }

                                cancelSessionTimers(sessionState);
                                sessionState.status = 'DISCONNECTED';
                                sessionState.qr = null;

                                await destroyClientSafely(id, 'init-error', client);

                                if (!sessionState.awaitingManualQr && !sessionState.loggedOut) {
                                    scheduleReconnect(id, 'init-error', instanceId);
                                }
                            });

                            return sessionState;
                        } finally {
                            if (startLocks[id] === lockPromise) {
                                delete startLocks[id];
                            }
                        });
                        releaseLock();
                    }
}

                client.initialize().catch(err => {
                    console.error(`Failed to initialize client ${id}:`, err?.message || err);
                    if (clients[id]) {
                        clients[id].status = 'DISCONNECTED';
                        clients[id].qr = null;
                        // Helper: look up a session entry using canonical ID resolution
                        function getSessionEntry(rawId) {
                            const id = resolveCanonicalSessionId(rawId);
                            let sessionObj = clients[id];
                            if (!sessionObj) {
                                const alt = getAlternatePhoneId(id);
                                if (alt && clients[alt]) {
                                    return { id: alt, sessionObj: clients[alt] };
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
            }
            return { id, sessionObj };
        }

        return clients[id];
        // Helper: check whether the client session is still usable (CDP not dead)
        function isClientAlive(sessionObj) {
            if (!sessionObj || sessionObj.isDestroying) return false;
            if (sessionObj.status !== 'CONNECTED' && sessionObj.status !== 'AUTHENTICATED') return false;
            if (!sessionObj.client || sessionObj.client._isBeingDestroyed) return false;
            return true;
        }

        // Helper: respond with "disconnected", clean up dead browser, and delegate to centralized reconnect manager
        function respondDisconnected(res, rawSessionId, reason) {
            const { id, sessionObj } = getSessionEntry(rawSessionId);
            const currentInstanceId = sessionObj?.instanceId ?? null;
            console.warn(`⚠️ [${reason}] Session ${id} encountered a protocol glitch. Destroying stale browser & scheduling reconnect...`);

            if (sessionObj) {
                sessionObj.status = 'DISCONNECTED';
                sessionObj.qr = null;
            }

            if (!res.headersSent) {
                res.status(400).json({ success: false, error: 'Session reconnecting in background.', reason });
            }

            (async () => {
                try {
                    await destroyClientSafely(id, reason, sessionObj?.client || null);
                    scheduleReconnect(id, reason, currentInstanceId);
                } catch (err) {
                    console.error(`Error handling respondDisconnected for ${id}:`, err?.message || err);
                }
            })();
        }

        // REST Endpoints

        // 1. Get all active sessions status
        app.get('/sessions', (req, res) => {
            const data = {};
            for (const id in clients) {
                data[id] = {
                    const entry = {
                        status: clients[id].status,
                        qr: clients[id].qr,
                        info: clients[id].info
                    };
                    data[id] = entry;
                    // Also expose under 10/12-digit alternate key if not separately present so callers using either format match
                    const alt = getAlternatePhoneId(id);
                    if(alt && !clients[alt]) {
            data[alt] = entry;
        }
    }
    res.json(data);
});

// 2. Start/Initialize a session
app.post('/sessions/:id/start', (req, res) => {
    const id = cleanDigits(req.params.id);
    app.post('/sessions/:id/start', async (req, res) => {
        const id = resolveCanonicalSessionId(req.params.id);
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
        try {
            const session = await startClient(id, force, { manual: true, reason: 'api-start' });
            if (!session) {
                return res.status(400).json({ success: false, error: 'Could not initialize session' });
            }
            res.json({
                success: true,
                status: session.status,
                hasQr: !!session.qr
            });
        } catch (e) {
            console.error(`Error in POST /sessions/${id}/start:`, e);
            res.status(500).json({ success: false, error: e.message || 'Failed to start session' });
        }
    });

    // 3. Get deduplicated contacts list
    app.get('/sessions/:id/contacts', async (req, res) => {
        const id = cleanDigits(req.params.id);
        const sessionObj = clients[id];
        const { id, sessionObj } = getSessionEntry(req.params.id);
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
                if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected') || msg.includes('Target closed')) {
                    return respondDisconnected(res, id, 'contacts-protocol-error');
                }
                console.error('Failed to fetch contacts:', e);
                res.status(500).json({ success: false, error: e.message });
            }
        });

    // 4. Bulk sync/import contacts to leads
    app.post('/sessions/:id/sync', async (req, res) => {
        const id = cleanDigits(req.params.id);
        const { id } = getSessionEntry(req.params.id);
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
                    body: 'Lead imported via WhatsApp contact sync.',
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
        const rawDigits = cleanDigits(req.params.id);
        const { id, sessionObj } = getSessionEntry(rawDigits);
        const alt = getAlternatePhoneId(id);

        try {
            await sessionObj.client.destroy();
        } catch (e) {
            console.warn('Error destroying client:', e.message);
            if (sessionObj) {
                sessionObj.loggedOut = true;
                cancelSessionTimers(sessionObj);
                await destroyClientSafely(id, 'api-logout', sessionObj.client);
                delete clients[id];
            }
            if (alt && clients[alt]) {
                clients[alt].loggedOut = true;
                cancelSessionTimers(clients[alt]);
                await destroyClientSafely(alt, 'api-logout', clients[alt].client);
                delete clients[alt];
            }

            delete clients[id];

            // Remove from sessions.json
            const saved = loadSessions();
            const updated = saved.filter(s => s !== id);
            const updated = saved.filter(s => s !== id && s !== rawDigits && (!alt || s !== alt));
            saveSessions(updated);

            // Clean session auth files
            const sessionAuthPath = path.join(AUTH_DIR, `session-${id}`);
            try {
                if (fs.existsSync(sessionAuthPath)) {
                    fs.rmSync(sessionAuthPath, { recursive: true, force: true });
                    // Clean session auth files for both canonical and alternate IDs on explicit user logout
                    for (const targetId of [id, rawDigits, alt].filter(Boolean)) {
                        const sessionAuthPath = path.join(AUTH_DIR, `session-${targetId}`);
                        try {
                            if (fs.existsSync(sessionAuthPath)) {
                                fs.rmSync(sessionAuthPath, { recursive: true, force: true });
                            }
                        } catch (e) {
                            console.error(`Failed to clean auth files for ${targetId}:`, e);
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
        const { id, sessionObj } = getSessionEntry(req.params.id);
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
                if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected') || msg.includes('Target closed')) {
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
        const { id, sessionObj } = getSessionEntry(req.params.id);
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
                let lastMessageText = '';
                let lastMessageTime = chat.timestamp || 0;
                try {
                    const messages = await chat.fetchMessages({ limit: 1 });
                    if (messages && messages.length > 0) {
                        lastMessageText = messages[0].body || "";
                        lastMessageText = messages[0].body || '';
                        lastMessageTime = messages[0].timestamp || lastMessageTime;
                    }
                } catch (err) {
                } catch (_) {
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
                } catch (_) {
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
                if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected') || msg.includes('Target closed')) {
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
        const rawId = cleanDigits(req.params.id);
        const { id, sessionObj } = getSessionEntry(req.params.id);
        const phone = req.params.phone;
        const { message } = req.body;

        let sessionObj = clients[rawId];
        if (!sessionObj) {
            if (rawId.startsWith('91') && clients[rawId.slice(2)]) {
                sessionObj = clients[rawId.slice(2)];
            } else if (rawId.length === 10 && clients['91' + rawId]) {
                sessionObj = clients['91' + rawId];
            }
        }

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
                if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected') || msg.includes('Target closed')) {
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
                window.WWebJS.processMediaData = async function (mediaInfo, options = {}) {
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
                            } catch (_) { }

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
                        } catch (_) { }

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
        } catch (_) { }
    }

    // 9. Send media (image/PDF) to a contact
    app.post('/sessions/:id/chats/:phone/send-media', async (req, res) => {
        const id = cleanDigits(req.params.id);
        const { id, sessionObj } = getSessionEntry(req.params.id);
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
                    await sleep(1000);
                } catch (_) { }
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
                if (msg.includes('Protocol') || msg.includes('Promise was collected') || msg.includes('disconnected') || msg.includes('Target closed')) {
                    return respondDisconnected(res, id, 'send-media-protocol-error');
                }
                console.error('Failed to send media:', e);
                res.status(500).json({ success: false, error: e.message });
            }
        });

    // Keep-Alive Heartbeat: monitors all registered sessions and automatically brings them online
    // Keep-Alive Heartbeat: monitors registered sessions without overriding active/scheduled/paused sessions
    let heartbeatRunning = false;
    setInterval(async () => {
        if (heartbeatRunning) return;
        heartbeatRunning = true;
        try {
            const saved = loadSessions();
            for (const id of saved) {
                for (const rawId of saved) {
                    const id = resolveCanonicalSessionId(rawId);
                    if (!id || startLocks[id]) continue;

                    const current = clients[id];
                    if (!current || current.status === 'DISCONNECTED') {
                        console.log(`💓 [Heartbeat] Auto-reviving offline session: ${id}`);
                        cleanStaleLocks(id);
                        startClient(id);
                        // Pause between restores to avoid CPU contention
                        await new Promise(r => setTimeout(r, 3000));
                        // Never disturb sessions that are active, destroying, scheduled to reconnect, or awaiting manual QR/start
                        if (current) {
                            if (
                                ACTIVE_STATES.has(current.status) ||
                                current.isDestroying ||
                                current.reconnectTimer ||
                                current.awaitingManualQr ||
                                current.pausedReconnect ||
                                current.loggedOut
                            ) {
                                continue;
                            }
                        }

                        console.log(`💓 [Heartbeat] Scheduling recovery for offline session: ${id}`);
                        scheduleReconnect(id, 'heartbeat', current?.instanceId ?? null);
                        await sleep(3000);
                    }
                } catch (e) {
                    console.warn('Heartbeat error:', e.message);
                } finally {
                    heartbeatRunning = false;
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
                await startClient(id, false, { manual: false, reason: 'boot-restore' });
                // Stagger multiple sessions by 4 seconds so Chromium instances load smoothly
                await sleep(4000);
            } catch (e) {
                console.error(`Auto-restore failed for ${id}:`, e);
            }
        }
    });
