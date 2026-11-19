const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const DEFAULT_SESSION_KEY = 'main';
const sessions = new Map();
let tableEnsured = false;
let baileysLoader = null;

function getAuthDir(sessionKey = DEFAULT_SESSION_KEY) {
  const safeKey = String(sessionKey || DEFAULT_SESSION_KEY).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join('/tmp', `bvc_wa_auth_${safeKey}`);
}

function getOrCreateState(sessionKey = DEFAULT_SESSION_KEY) {
  const key = String(sessionKey || DEFAULT_SESSION_KEY);
  if (!sessions.has(key)) {
    sessions.set(key, {
      sessionKey: key,
      sock: null,
      status: 'DISCONNECTED', // DISCONNECTED | CONNECTING | QR_READY | PAIRING_CODE_READY | CONNECTED
      qrDataUrl: null,
      qrRaw: null,
      pairingCode: null,
      phoneNumber: null,
      displayName: 'Main Company WhatsApp',
      lastError: null,
      connectedAt: null,
      updatedAt: new Date().toISOString(),
      qrAttempts: 0,
      reconnectAttempts: 0,
      reconnectTimer: null,
      persistTimer: null,
      isDisconnecting: false,
      authDir: getAuthDir(key)
    });
  }
  return sessions.get(key);
}

/**
 * Format phone number into clean WhatsApp digits & JID.
 * Supports 10-digit Indian numbers (auto-prefixes 91) as well as full E.164 international numbers.
 */
function formatWhatsAppTarget(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Missing phone number' };
  }
  const trimmed = phone.trim();
  if (!trimmed || trimmed === '-' || trimmed.includes('X') || trimmed.includes('x') || trimmed.includes('*')) {
    return { valid: false, isPlaceholder: true, error: 'Placeholder or masked phone number' };
  }
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `91${digits}`;
  }
  if (digits.length < 11 || digits.length > 15) {
    return { valid: false, error: 'Phone number must have 10 to 15 digits including country code' };
  }
  return {
    valid: true,
    isPlaceholder: false,
    digits,
    formatted: `+${digits}`,
    jid: `${digits}@s.whatsapp.net`
  };
}

async function ensureSessionTable() {
  if (tableEnsured) return;
  try {
    await db.master.run(`
      CREATE TABLE IF NOT EXISTS whatsapp_server_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT UNIQUE NOT NULL,
        display_name TEXT,
        phone_number TEXT,
        status TEXT DEFAULT 'DISCONNECTED',
        auth_creds_json TEXT,
        auth_keys_json TEXT,
        last_connected_at DATETIME,
        last_error TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('[WhatsApp Server] Session table init warning:', err.message);
  }
}

async function getDbSessionRow(sessionKey = DEFAULT_SESSION_KEY) {
  await ensureSessionTable();
  const res = await db.master.query(
    `SELECT * FROM whatsapp_server_sessions WHERE session_key = ? LIMIT 1`,
    [sessionKey]
  );
  return res.rows && res.rows[0] ? res.rows[0] : null;
}

async function upsertDbSessionRow(sessionKey, fields = {}) {
  await ensureSessionTable();
  const existing = await getDbSessionRow(sessionKey);
  const nowIso = new Date().toISOString();

  if (!existing) {
    await db.master.run(
      `INSERT INTO whatsapp_server_sessions
        (session_key, display_name, phone_number, status, auth_creds_json, auth_keys_json, last_connected_at, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionKey,
        fields.display_name ?? 'Main Company WhatsApp',
        fields.phone_number ?? null,
        fields.status ?? 'DISCONNECTED',
        fields.auth_creds_json ?? null,
        fields.auth_keys_json ?? null,
        fields.last_connected_at ?? null,
        fields.last_error ?? null,
        nowIso
      ]
    );
    return;
  }

  const sets = [];
  const params = [];
  const allowed = ['display_name', 'phone_number', 'status', 'auth_creds_json', 'auth_keys_json', 'last_connected_at', 'last_error'];
  for (const col of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, col)) {
      sets.push(`${col} = ?`);
      params.push(fields[col]);
    }
  }
  sets.push('updated_at = ?');
  params.push(nowIso, sessionKey);

  await db.master.run(
    `UPDATE whatsapp_server_sessions SET ${sets.join(', ')} WHERE session_key = ?`,
    params
  );
}

function clearAuthDirectory(authDir) {
  try {
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[WhatsApp Server] Failed clearing auth dir:', err.message);
  }
}

function restoreAuthDirFromDb(row, authDir) {
  if (!row || !row.auth_creds_json) return false;
  try {
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'creds.json'), row.auth_creds_json, 'utf8');
    if (row.auth_keys_json) {
      const keysObj = JSON.parse(row.auth_keys_json);
      if (keysObj && typeof keysObj === 'object') {
        for (const [filename, content] of Object.entries(keysObj)) {
          const safeName = path.basename(filename);
          if (safeName && safeName !== 'creds.json' && typeof content === 'string') {
            fs.writeFileSync(path.join(authDir, safeName), content, 'utf8');
          }
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[WhatsApp Server] Failed restoring auth from DB:', err.message);
    return false;
  }
}

async function persistAuthDirToDb(sessionKey, state) {
  try {
    const authDir = state.authDir;
    if (!fs.existsSync(authDir)) return;
    const credsPath = path.join(authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return;

    const credsJson = fs.readFileSync(credsPath, 'utf8');
    const files = fs.readdirSync(authDir);
    const keysMap = {};
    for (const f of files) {
      if (f === 'creds.json' || !f.endsWith('.json')) continue;
      try {
        keysMap[f] = fs.readFileSync(path.join(authDir, f), 'utf8');
      } catch (_) {}
    }

    await upsertDbSessionRow(sessionKey, {
      display_name: state.displayName,
      phone_number: state.phoneNumber,
      status: state.status,
      auth_creds_json: credsJson,
      auth_keys_json: JSON.stringify(keysMap),
      last_connected_at: state.connectedAt,
      last_error: state.lastError
    });
  } catch (err) {
    console.warn('[WhatsApp Server] Failed persisting auth to DB:', err.message);
  }
}

function schedulePersistAuth(sessionKey, state) {
  if (state.persistTimer) clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    persistAuthDirToDb(sessionKey, state).catch(() => {});
  }, 800);
}

async function loadBaileysDeps() {
  if (baileysLoader) return baileysLoader;
  const [baileysMod, pinoMod, qrMod] = await Promise.all([
    import('@whiskeysockets/baileys'),
    import('pino'),
    import('qrcode')
  ]);
  baileysLoader = {
    makeWASocket: baileysMod.makeWASocket || baileysMod.default,
    DisconnectReason: baileysMod.DisconnectReason,
    useMultiFileAuthState: baileysMod.useMultiFileAuthState,
    Browsers: baileysMod.Browsers,
    fetchLatestBaileysVersion: baileysMod.fetchLatestBaileysVersion,
    pino: pinoMod.default || pinoMod,
    qrcode: qrMod.default || qrMod
  };
  return baileysLoader;
}

function closeExistingSocket(state) {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.sock) {
    try {
      state.sock.ev.removeAllListeners('connection.update');
      state.sock.ev.removeAllListeners('creds.update');
      state.sock.end(undefined);
    } catch (_) {}
    state.sock = null;
  }
}

function extractPhoneFromJid(jid) {
  if (!jid || typeof jid !== 'string') return null;
  const userPart = jid.split('@')[0] || '';
  const cleanDigits = userPart.split(':')[0].replace(/\D/g, '');
  return cleanDigits ? `+${cleanDigits}` : null;
}

async function connectSession({ sessionKey = DEFAULT_SESSION_KEY, mode = 'qr', phoneNumber = '', fresh = false } = {}) {
  const state = getOrCreateState(sessionKey);
  await ensureSessionTable();

  if (state.isDisconnecting) {
    return getSessionStatus(sessionKey);
  }

  let pairingDigits = null;
  if (mode === 'pairing') {
    const target = formatWhatsAppTarget(phoneNumber);
    if (!target.valid) {
      throw new Error(target.error || 'Enter a valid WhatsApp phone number with country code (e.g. +91 9876543210)');
    }
    pairingDigits = target.digits;
  }

  // Close existing active socket cleanly before creating a new one
  closeExistingSocket(state);

  if (fresh || mode === 'pairing') {
    clearAuthDirectory(state.authDir);
    if (mode === 'qr' && fresh) {
      await upsertDbSessionRow(sessionKey, {
        status: 'CONNECTING',
        auth_creds_json: null,
        auth_keys_json: null,
        last_error: null
      });
    }
  } else if (!fs.existsSync(path.join(state.authDir, 'creds.json'))) {
    const dbRow = await getDbSessionRow(sessionKey);
    if (dbRow && dbRow.auth_creds_json) {
      restoreAuthDirFromDb(dbRow, state.authDir);
      if (dbRow.phone_number) state.phoneNumber = dbRow.phone_number;
      if (dbRow.display_name) state.displayName = dbRow.display_name;
    }
  }

  if (mode === 'restore' && !fs.existsSync(path.join(state.authDir, 'creds.json'))) {
    state.status = 'DISCONNECTED';
    return getSessionStatus(sessionKey);
  }

  fs.mkdirSync(state.authDir, { recursive: true });

  state.status = 'CONNECTING';
  state.qrDataUrl = null;
  state.qrRaw = null;
  state.pairingCode = null;
  state.lastError = null;
  state.qrAttempts = 0;
  state.updatedAt = new Date().toISOString();

  await upsertDbSessionRow(sessionKey, {
    status: 'CONNECTING',
    last_error: null
  });

  const deps = await loadBaileysDeps();
  const { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion, pino, qrcode } = deps;

  const { state: authState, saveCreds } = await useMultiFileAuthState(state.authDir);

  let waVersion;
  try {
    const verInfo = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Version lookup timeout')), 4500))
    ]);
    if (verInfo && verInfo.version) waVersion = verInfo.version;
  } catch (_) {}

  const logger = pino({ level: 'silent' });
  const sock = makeWASocket({
    ...(waVersion ? { version: waVersion } : {}),
    auth: authState,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 30000,
    defaultQueryTimeoutMs: 30000
  });

  state.sock = sock;

  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
      schedulePersistAuth(sessionKey, state);
    } catch (err) {
      console.warn('[WhatsApp Server] creds.update warning:', err.message);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    // Ignore stale socket events
    if (state.sock !== sock) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr && mode !== 'pairing') {
      if (mode === 'restore') {
        // Session requires re-scan; do not silently spin in background without user intent
        state.status = 'DISCONNECTED';
        state.lastError = 'Saved WhatsApp session expired. Please scan QR or enter pairing code again.';
        closeExistingSocket(state);
        await upsertDbSessionRow(sessionKey, {
          status: 'DISCONNECTED',
          last_error: state.lastError
        }).catch(() => {});
        return;
      }

      state.qrAttempts += 1;
      if (state.qrAttempts > 6) {
        state.status = 'DISCONNECTED';
        state.qrDataUrl = null;
        state.qrRaw = null;
        state.lastError = 'QR code expired after 2 minutes. Click Connect / Generate QR to try again.';
        closeExistingSocket(state);
        await upsertDbSessionRow(sessionKey, {
          status: 'DISCONNECTED',
          last_error: state.lastError
        }).catch(() => {});
        return;
      }

      try {
        state.qrRaw = qr;
        state.qrDataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
        state.status = 'QR_READY';
        state.pairingCode = null;
        state.lastError = null;
        state.updatedAt = new Date().toISOString();
      } catch (qrErr) {
        state.lastError = qrErr.message;
      }
    }

    if (connection === 'open') {
      state.status = 'CONNECTED';
      state.qrDataUrl = null;
      state.qrRaw = null;
      state.pairingCode = null;
      state.lastError = null;
      state.qrAttempts = 0;
      state.reconnectAttempts = 0;
      state.connectedAt = new Date().toISOString();
      state.updatedAt = state.connectedAt;
      state.phoneNumber = extractPhoneFromJid(sock.user?.id) || state.phoneNumber;
      state.displayName = sock.user?.name || state.displayName || 'Main Company WhatsApp';

      try {
        await saveCreds();
        await persistAuthDirToDb(sessionKey, state);
      } catch (_) {}
      console.log(`✅ [WhatsApp Server] Connected (${sessionKey}): ${state.phoneNumber || 'Linked Account'}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMessage = lastDisconnect?.error?.message || 'Connection closed';
      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

      if (loggedOut) {
        console.warn(`[WhatsApp Server] Session ${sessionKey} logged out (status ${statusCode}).`);
        state.status = 'DISCONNECTED';
        state.qrDataUrl = null;
        state.qrRaw = null;
        state.pairingCode = null;
        state.phoneNumber = null;
        state.lastError = 'WhatsApp session logged out. Please link the Main Company WhatsApp again.';
        state.updatedAt = new Date().toISOString();
        closeExistingSocket(state);
        clearAuthDirectory(state.authDir);
        await upsertDbSessionRow(sessionKey, {
          status: 'DISCONNECTED',
          phone_number: null,
          auth_creds_json: null,
          auth_keys_json: null,
          last_error: state.lastError
        }).catch(() => {});
        return;
      }

      const wasQrOrPairing = state.status === 'QR_READY' || state.status === 'PAIRING_CODE_READY';
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

      // Reconnect if registered, or if WhatsApp explicitly requested a stream restart (515 after scan), or transient drop within limit
      const hasRegisteredCreds = Boolean(sock.authState?.creds?.registered);
      if ((hasRegisteredCreds || isRestartRequired || !wasQrOrPairing) && state.reconnectAttempts < 5 && !state.isDisconnecting) {
        state.reconnectAttempts += 1;
        state.status = 'CONNECTING';
        state.lastError = isRestartRequired ? 'Completing WhatsApp handshake...' : `Reconnecting (${errMessage})...`;
        state.updatedAt = new Date().toISOString();
        const delayMs = isRestartRequired ? 1000 : 3000;
        state.reconnectTimer = setTimeout(() => {
          connectSession({ sessionKey, mode: hasRegisteredCreds ? 'restore' : mode }).catch((e) => {
            state.status = 'DISCONNECTED';
            state.lastError = e.message;
          });
        }, delayMs);
      } else {
        state.status = 'DISCONNECTED';
        state.lastError = errMessage;
        state.updatedAt = new Date().toISOString();
        await upsertDbSessionRow(sessionKey, {
          status: 'DISCONNECTED',
          last_error: state.lastError
        }).catch(() => {});
      }
    }
  });

  if (mode === 'pairing' && pairingDigits) {
    // Allow socket handshake to initialize before requesting pairing code
    setTimeout(async () => {
      try {
        if (state.sock !== sock || sock.authState?.creds?.registered) return;
        const code = await sock.requestPairingCode(pairingDigits);
        if (state.sock === sock) {
          state.pairingCode = code;
          state.phoneNumber = `+${pairingDigits}`;
          state.status = 'PAIRING_CODE_READY';
          state.qrDataUrl = null;
          state.lastError = null;
          state.updatedAt = new Date().toISOString();
        }
      } catch (pairErr) {
        if (state.sock === sock) {
          state.status = 'DISCONNECTED';
          state.lastError = `Failed generating pairing code: ${pairErr.message}`;
          state.updatedAt = new Date().toISOString();
        }
      }
    }, 1500);
  }

  return getSessionStatus(sessionKey);
}

async function disconnectSession(sessionKey = DEFAULT_SESSION_KEY) {
  const state = getOrCreateState(sessionKey);
  state.isDisconnecting = true;
  try {
    if (state.sock) {
      try {
        await Promise.race([
          state.sock.logout(),
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]);
      } catch (_) {}
    }
    closeExistingSocket(state);
    clearAuthDirectory(state.authDir);

    state.status = 'DISCONNECTED';
    state.qrDataUrl = null;
    state.qrRaw = null;
    state.pairingCode = null;
    state.phoneNumber = null;
    state.connectedAt = null;
    state.lastError = null;
    state.updatedAt = new Date().toISOString();

    await upsertDbSessionRow(sessionKey, {
      status: 'DISCONNECTED',
      phone_number: null,
      auth_creds_json: null,
      auth_keys_json: null,
      last_error: null
    });
  } finally {
    state.isDisconnecting = false;
  }

  return getSessionStatus(sessionKey);
}

async function getSessionStatus(sessionKey = DEFAULT_SESSION_KEY) {
  const state = getOrCreateState(sessionKey);
  if (state.status === 'DISCONNECTED' && !state.phoneNumber) {
    try {
      const dbRow = await getDbSessionRow(sessionKey);
      if (dbRow && dbRow.phone_number && state.phoneNumber === null && dbRow.status === 'CONNECTED') {
        state.phoneNumber = dbRow.phone_number;
        state.displayName = dbRow.display_name || state.displayName;
        state.connectedAt = dbRow.last_connected_at || state.connectedAt;
      }
    } catch (_) {}
  }

  return {
    sessionKey: state.sessionKey,
    status: state.status,
    connected: state.status === 'CONNECTED' && Boolean(state.sock),
    phoneNumber: state.phoneNumber,
    displayName: state.displayName,
    qrDataUrl: state.qrDataUrl,
    pairingCode: state.pairingCode,
    lastError: state.lastError,
    connectedAt: state.connectedAt,
    updatedAt: state.updatedAt
  };
}

function isConnected(sessionKey = DEFAULT_SESSION_KEY) {
  const state = sessions.get(String(sessionKey || DEFAULT_SESSION_KEY));
  return Boolean(state && state.status === 'CONNECTED' && state.sock);
}

/**
 * Send a WhatsApp text message via the linked Main Company Server WhatsApp account.
 */
async function sendMessage({ to, text, sessionKey = DEFAULT_SESSION_KEY }) {
  const state = sessions.get(String(sessionKey || DEFAULT_SESSION_KEY));
  if (!state || state.status !== 'CONNECTED' || !state.sock) {
    return {
      success: false,
      connected: false,
      error: 'Main Company Server WhatsApp is not connected'
    };
  }

  const target = formatWhatsAppTarget(to);
  if (!target.valid) {
    return {
      success: false,
      connected: true,
      error: target.error || 'Invalid recipient WhatsApp number'
    };
  }

  try {
    const sent = await Promise.race([
      state.sock.sendMessage(target.jid, { text: String(text || '') }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp send timed out after 15s')), 15000))
    ]);

    return {
      success: true,
      connected: true,
      messageId: sent?.key?.id || `wa_srv_${Date.now()}`,
      jid: target.jid,
      phone: target.formatted,
      senderPhone: state.phoneNumber
    };
  } catch (err) {
    return {
      success: false,
      connected: state.status === 'CONNECTED',
      error: err.message
    };
  }
}

/**
 * Restore any previously linked WhatsApp sessions on server boot (non-blocking).
 */
async function initSavedSessionsOnBoot() {
  try {
    await ensureSessionTable();
    const res = await db.master.query(
      `SELECT session_key, auth_creds_json, status FROM whatsapp_server_sessions WHERE auth_creds_json IS NOT NULL`
    );
    const rows = res.rows || [];
    for (const row of rows) {
      if (!row.auth_creds_json) continue;
      let credsRegistered = false;
      try {
        const parsed = JSON.parse(row.auth_creds_json);
        credsRegistered = Boolean(parsed && parsed.registered);
      } catch (_) {}

      if (credsRegistered) {
        console.log(`🔄 [WhatsApp Server] Restoring saved WhatsApp session: ${row.session_key}`);
        connectSession({ sessionKey: row.session_key, mode: 'restore' }).catch((err) => {
          console.warn(`[WhatsApp Server] Boot restore failed (${row.session_key}):`, err.message);
        });
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Server] Boot initialization warning:', err.message);
  }
}

/**
 * Internal helper for unit testing without spawning a live Baileys socket.
 */
function _setTestSocket(sessionKey = DEFAULT_SESSION_KEY, mockSock, phoneNumber = '+919999900000') {
  const state = getOrCreateState(sessionKey);
  state.sock = mockSock;
  state.status = mockSock ? 'CONNECTED' : 'DISCONNECTED';
  state.phoneNumber = mockSock ? phoneNumber : null;
  state.connectedAt = mockSock ? new Date().toISOString() : null;
}

module.exports = {
  DEFAULT_SESSION_KEY,
  formatWhatsAppTarget,
  ensureSessionTable,
  connectSession,
  disconnectSession,
  getSessionStatus,
  isConnected,
  sendMessage,
  initSavedSessionsOnBoot,
  _setTestSocket
};
