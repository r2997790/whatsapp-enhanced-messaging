// Step 3: ULTRA CRITICAL Authentication Fix - Status 515 and QR Code Fix
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');

const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    isJidGroup,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

console.log('🚀 Step 3: ULTRA CRITICAL AUTH FIX - Status 515 Solution v5.0');

// CRITICAL: Explicit app.js route FIRST
app.get('/app.js', (req, res) => {
    const appJsPath = path.join(__dirname, 'app.js');
    console.log('📄 Step 3: Serving app.js from:', appJsPath);
    
    if (fs.existsSync(appJsPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(appJsPath);
        console.log('✅ app.js served successfully');
    } else {
        console.error('❌ app.js not found');
        res.status(404).send('app.js not found');
    }
});

// Static files
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
    }
}));

// ULTRA CRITICAL WhatsApp State Management
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastConnectionTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_ultra_fix');
let connectionTimeout = null;
let qrTimeout = null;
let forceNewSession = false;

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 3: Created auth directory:', authDir);
}

// ULTRA CRITICAL: Silent logger (prevents status 515 issues)
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Enhanced connection management
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionTime;
    
    if (timeSinceLastAttempt < 15000 && !forceNewSession) { // Reduced cooldown
        const remainingTime = Math.ceil((15000 - timeSinceLastAttempt) / 1000);
        console.log(`⏳ Step 3: Cooldown active, ${remainingTime}s remaining`);
        return false;
    }
    
    if (connectionAttempts >= 5 && !forceNewSession) { // Increased attempts
        console.log('🛑 Step 3: Max connection attempts reached (5). Reset required.');
        return false;
    }
    
    return true;
}

function resetConnectionState() {
    console.log('🔄 Step 3: ULTRA RESET - Full connection state reset...');
    connectionAttempts = 0;
    lastConnectionTime = 0;
    qrCodeData = null;
    isConnecting = false;
    forceNewSession = false;
    
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
    
    console.log('✅ Step 3: ULTRA RESET complete');
}

async function clearAuthFiles() {
    try {
        if (fs.existsSync(authDir)) {
            const files = fs.readdirSync(authDir);
            for (const file of files) {
                const filePath = path.join(authDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.log('⚠️ Step 3: Error deleting file:', file, err.message);
                }
            }
            console.log('🧹 Step 3: Auth files cleared successfully');
        }
        
        // ULTRA CRITICAL: Force new session after clearing
        forceNewSession = true;
        
    } catch (error) {
        console.log('⚠️ Step 3: Error clearing auth files:', error.message);
    }
}

// ULTRA CRITICAL: Enhanced WhatsApp Connection with Status 515 Protection
async function connectToWhatsApp() {
    if (isConnecting && !forceNewSession) {
        console.log('⚠️ Step 3: Already connecting, ignoring request');
        return;
    }

    if (!canAttemptConnection()) {
        io.emit('connection-status', 'cooldown');
        return;
    }

    try {
        isConnecting = true;
        connectionAttempts++;
        lastConnectionTime = Date.now();
        
        console.log(`🔄 Step 3: ULTRA FIX - Connection attempt ${connectionAttempts}/5`);

        // ULTRA CRITICAL: Aggressive socket cleanup
        if (sock) {
            try {
                console.log('🧹 Step 3: AGGRESSIVE socket cleanup...');
                sock.removeAllListeners();
                sock.end();
                sock.ws?.terminate();
                await delay(5000); // Longer cleanup delay
                sock = null;
                console.log('✅ Step 3: Socket aggressively cleaned');
            } catch (e) {
                console.log('⚠️ Step 3: Error during aggressive cleanup:', e.message);
            }
        }

        // ULTRA CRITICAL: Clear auth on status 515 or force new session
        if (forceNewSession) {
            console.log('🔥 Step 3: FORCE NEW SESSION - clearing all auth data');
            await clearAuthFiles();
            await delay(2000);
            forceNewSession = false;
        }

        console.log('📱 Step 3: Fetching latest Baileys version...');
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 Step 3: Using Baileys version: ${version.join('.')}`);

        console.log('🔐 Step 3: Initializing auth state with ULTRA protection...');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('✅ Step 3: Auth state initialized');

        // ULTRA CRITICAL: Browser configuration optimized for status 515 prevention
        const browser = ['Ubuntu', 'Chrome', '20.0.04'];
        console.log('🌐 Step 3: Browser config (STATUS 515 OPTIMIZED):', browser);

        console.log('🔌 Step 3: Creating WhatsApp socket with ULTRA CONFIG...');
        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            version,
            logger: logger,
            printQRInTerminal: false,
            browser: browser,
            
            // ULTRA CRITICAL: Status 515 prevention configuration
            connectTimeoutMs: 30000, // Reduced timeout
            defaultQueryTimeoutMs: 20000, // Set explicit timeout
            qrTimeout: 30000, // Reduced QR timeout
            
            // ULTRA CRITICAL: Connection settings to prevent status 515
            markOnlineOnConnect: false,
            retryRequestDelayMs: 250, // Increased delay
            emitOwnEvents: false,
            fireInitQueries: false,
            
            // ULTRA CRITICAL: Message settings optimized
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: (jid) => isJidBroadcast(jid),
            
            // ULTRA CRITICAL: Retry settings to prevent status 515
            maxMsgRetryCount: 1, // Reduced retries
            msgRetryCounterMap: new Map(),
            
            // ULTRA CRITICAL: Minimal getMessage to prevent conflicts
            getMessage: async (key) => {
                return { conversation: '' };
            },
            
            // ULTRA CRITICAL: Additional status 515 prevention
            keepAliveIntervalMs: 10000,
            transactionOpts: {
                maxCommitRetries: 1,
                delayBetweenTriesMs: 1000
            }
        });

        console.log('✅ Step 3: WhatsApp socket created with ULTRA CONFIG');

        // ULTRA CRITICAL: Connection update handler with status 515 protection
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 3: Connection update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts,
                notifications: !!receivedPendingNotifications
            });

            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }

            // ULTRA CRITICAL: QR code handling with enhanced timeout
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 3: Generating QR code (ULTRA MODE)...');
                    
                    if (qrTimeout) {
                        clearTimeout(qrTimeout);
                    }
                    
                    // ULTRA CRITICAL: Shorter QR timeout to prevent status 515
                    qrTimeout = setTimeout(() => {
                        console.log('⏰ Step 3: QR code expired after 30 seconds - FORCING RESET');
                        forceNewSession = true;
                        handleConnectionFailure('qr_timeout_ultra');
                    }, 30000);
                    
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 4,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M' // Changed from H to M for better compatibility
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 3: QR code generated and sent (ULTRA MODE)');
                    
                } catch (error) {
                    console.error('❌ Step 3: QR generation error:', error);
                    forceNewSession = true;
                    handleConnectionFailure('qr_error_ultra');
                }
            }

            if (connection === 'open') {
                console.log('🎉 Step 3: ✅ ULTRA FIX SUCCESS - WHATSAPP CONNECTED!');
                
                if (qrTimeout) {
                    clearTimeout(qrTimeout);
                    qrTimeout = null;
                }
                
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                console.log('📞 Step 3: Connection verified - ready for messaging');
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 3: Authenticating with WhatsApp (ULTRA MODE)...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 3: Connection closed with code:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                if (qrTimeout) {
                    clearTimeout(qrTimeout);
                    qrTimeout = null;
                }
                
                // ULTRA CRITICAL: Enhanced disconnect reason handling with status 515 fix
                if (statusCode === 515) {
                    console.log('🔥 Step 3: STATUS 515 DETECTED - ULTRA RESET MODE ACTIVATED');
                    await clearAuthFiles();
                    forceNewSession = true;
                    resetConnectionState();
                    
                    // Auto-retry after ultra reset
                    setTimeout(() => {
                        if (connectionStatus === 'disconnected') {
                            console.log('🔄 Step 3: Auto-retry after STATUS 515 fix');
                            connectToWhatsApp();
                        }
                    }, 5000);
                    
                } else if (statusCode === DisconnectReason.loggedOut ||
                          statusCode === DisconnectReason.restartRequired ||
                          statusCode === DisconnectReason.badSession ||
                          statusCode === DisconnectReason.connectionReplaced ||
                          statusCode === DisconnectReason.multideviceMismatch ||
                          statusCode === DisconnectReason.forbidden) {
                    console.log(`🚫 Step 3: Critical disconnect (${statusCode}) - ULTRA clearing auth`);
                    await clearAuthFiles();
                    forceNewSession = true;
                    resetConnectionState();
                } else {
                    console.log('❓ Step 3: Other disconnect reason:', statusCode);
                    // For unknown errors, also force new session
                    forceNewSession = true;
                }

                qrCodeData = null;
                sock = null;
            }
        });

        // ULTRA CRITICAL: Handle credential updates
        sock.ev.on('creds.update', saveCreds);

        // ULTRA CRITICAL: Handle messages for connection verification
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Step 3: Message received - connection active and working');
        });

    } catch (error) {
        console.error('❌ Step 3: ULTRA CONNECTION ERROR:', error);
        forceNewSession = true;
        handleConnectionFailure('ultra_connection_error');
        await clearAuthFiles();
        resetConnectionState();
    }
}

function handleConnectionFailure(reason) {
    console.log(`❌ Step 3: ULTRA HANDLING connection failure: ${reason}`);
    
    connectionStatus = 'error';
    isConnecting = false;
    qrCodeData = null;
    
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
    
    if (sock) {
        try {
            sock.removeAllListeners();
            sock.end();
            sock.ws?.terminate();
            sock = null;
        } catch (e) {
            console.log('⚠️ Step 3: Error cleaning up failed socket:', e.message);
        }
    }
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
    
    // ULTRA CRITICAL: Force new session on any failure
    forceNewSession = true;
    
    console.log(`💡 Step 3: ULTRA failure handled for ${reason}. Next attempt will force new session.`);
}

async function disconnectWhatsApp() {
    console.log('🔌 Step 3: ULTRA DISCONNECT...');
    
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
    
    if (sock) {
        try {
            await sock.logout();
            sock.removeAllListeners();
            sock.end();
            sock.ws?.terminate();
            sock = null;
            console.log('✅ Step 3: WhatsApp disconnected properly');
        } catch (e) {
            console.log('⚠️ Step 3: Error during disconnect:', e.message);
        }
    }
    
    await clearAuthFiles();
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    forceNewSession = true;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 3: ULTRA CRITICAL AUTH FIX - Status 515 Solution',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'ultra-fix-v5.0',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        forceNewSession: forceNewSession,
        lastConnectionTime: lastConnectionTime ? new Date(lastConnectionTime).toISOString() : null,
        fix: 'Status 515 Protection + QR Code Ultra Fix'
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`👤 Step 3: Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Step 3: Sent existing QR code to new client');
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Step 3: Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log(`ℹ️ Step 3: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    socket.on('reset-connection', async () => {
        console.log('🔄 Step 3: Client requested ULTRA RESET');
        forceNewSession = true;
        await disconnectWhatsApp();
    });

    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 3: Client requested WhatsApp disconnect');
        await disconnectWhatsApp();
    });

    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus,
            version: 'ULTRA FIX v5.0 - Status 515 Solution'
        });
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 3: Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.log(`❌ Step 3: Socket error from ${socket.id}:`, error);
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 3: Received SIGTERM, ULTRA shutdown...');
    await disconnectWhatsApp();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 3: Received SIGINT, ULTRA shutdown...');
    await disconnectWhatsApp();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 3: ULTRA CRITICAL AUTH FIX Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔥 Step 3: ULTRA FIX deployed - Status 515 Solution Active');
    console.log('📁 Auth directory:', authDir);
    console.log('⚡ Ready for WhatsApp connections with ULTRA AUTHENTICATION');
    console.log('🎯 Status 515 Protection + Enhanced QR Code System');
});