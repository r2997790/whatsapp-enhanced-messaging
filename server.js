// Step 3: Critical Authentication Fix - Based on Evolution API Working Configuration
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

console.log('🚀 Step 3: Starting CRITICAL AUTH FIX WhatsApp Server v4.0');

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

// CRITICAL WhatsApp State Management (Evolution API Pattern)
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastConnectionTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_evolution');
let connectionTimeout = null;
let qrTimeout = null;

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 3: Created auth directory:', authDir);
}

// CRITICAL: Logger configuration that works (from Evolution API)
const logger = {
    level: 'error',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Enhanced connection cooldown with better logic
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionTime;
    
    if (timeSinceLastAttempt < 30000) { // 30 second cooldown
        const remainingTime = Math.ceil((30000 - timeSinceLastAttempt) / 1000);
        console.log(`⏳ Step 3: Cooldown active, ${remainingTime}s remaining`);
        return false;
    }
    
    if (connectionAttempts >= 3) { // Max 3 attempts, then require reset
        console.log('🛑 Step 3: Max connection attempts reached (3). Reset required.');
        return false;
    }
    
    return true;
}

// Enhanced connection state reset
function resetConnectionState() {
    console.log('🔄 Step 3: Resetting connection state...');
    connectionAttempts = 0;
    lastConnectionTime = 0;
    qrCodeData = null;
    isConnecting = false;
    
    // Clear timeouts
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
    
    console.log('✅ Step 3: Connection state reset complete');
}

// Enhanced auth file cleanup
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
    } catch (error) {
        console.log('⚠️ Step 3: Error clearing auth files:', error.message);
    }
}

// CRITICAL: WhatsApp Connection with Evolution API Configuration
async function connectToWhatsApp() {
    if (isConnecting) {
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
        
        console.log(`🔄 Step 3: CRITICAL AUTH FIX - Connection attempt ${connectionAttempts}/3`);

        // Cleanup existing socket properly
        if (sock) {
            try {
                console.log('🧹 Step 3: Cleaning up existing socket...');
                sock.removeAllListeners();
                sock.end();
                await delay(3000); // Wait longer for proper cleanup
                sock = null;
                console.log('✅ Step 3: Previous socket cleaned up');
            } catch (e) {
                console.log('⚠️ Step 3: Error cleaning socket:', e.message);
            }
        }

        // CRITICAL: Get latest Baileys version (Evolution API pattern)
        console.log('📱 Step 3: Fetching latest Baileys version...');
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📱 Step 3: Using Baileys version: ${version.join('.')}`);

        // CRITICAL: Initialize auth state with Evolution API pattern
        console.log('🔐 Step 3: Initializing auth state (Evolution API pattern)...');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('✅ Step 3: Auth state initialized');

        // CRITICAL: Browser configuration that works (from Evolution API)
        const browser = ['Chrome (Linux)', 'WhatsApp Enhanced', '1.0.0'];
        console.log('🌐 Step 3: Browser config:', browser);

        // CRITICAL: Socket configuration based on Evolution API working config
        console.log('🔌 Step 3: Creating WhatsApp socket with Evolution API config...');
        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            version,
            logger: logger,
            printQRInTerminal: false,
            browser: browser,
            
            // CRITICAL: Evolution API timing configuration
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: undefined, // Let Baileys decide
            qrTimeout: 40000, // 40 second QR timeout
            
            // CRITICAL: Evolution API connection settings
            markOnlineOnConnect: false, // CRITICAL: false prevents issues
            retryRequestDelayMs: 10,
            emitOwnEvents: false,
            fireInitQueries: false, // CRITICAL: Prevents initial query conflicts
            
            // CRITICAL: Message and history settings (Evolution API pattern)
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: (jid) => {
                return isJidBroadcast(jid);
            },
            
            // CRITICAL: Message retry and cache settings
            maxMsgRetryCount: 3,
            msgRetryCounterMap: new Map(),
            
            // CRITICAL: getMessage function (prevents auth issues)
            getMessage: async (key) => {
                return { conversation: 'Message not available' };
            }
        });

        console.log('✅ Step 3: WhatsApp socket created with Evolution API config');

        // CRITICAL: Connection update handler with Evolution API pattern
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

            // Clear connection timeout on any update
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }

            // CRITICAL: QR code handling with proper timeout
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 3: Generating QR code (Evolution API pattern)...');
                    
                    // Clear any existing QR timeout
                    if (qrTimeout) {
                        clearTimeout(qrTimeout);
                    }
                    
                    // Set QR code timeout (40 seconds like Evolution API)
                    qrTimeout = setTimeout(() => {
                        console.log('⏰ Step 3: QR code expired after 40 seconds');
                        handleConnectionFailure('qr_timeout');
                    }, 40000);
                    
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 4,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'H'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 3: QR code generated and sent (Evolution API pattern)');
                    
                } catch (error) {
                    console.error('❌ Step 3: QR generation error:', error);
                    handleConnectionFailure('qr_error');
                }
            }

            // CRITICAL: Connection state handling (Evolution API pattern)
            if (connection === 'open') {
                console.log('🎉 Step 3: ✅ CRITICAL FIX SUCCESS - WHATSAPP CONNECTED!');
                
                // Clear all timeouts
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
                
                // CRITICAL: Don't send presence update immediately (Evolution API pattern)
                console.log('📞 Step 3: Connection verified - ready for messaging');
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 3: Authenticating with WhatsApp (Evolution API)...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 3: Connection closed with code:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                // Clear timeouts
                if (qrTimeout) {
                    clearTimeout(qrTimeout);
                    qrTimeout = null;
                }
                
                // CRITICAL: Enhanced disconnect reason handling (Evolution API pattern)
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 3: Logged out - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 3: Restart required (Evolution API) - clearing auth');
                    // CRITICAL: Evolution API clears auth on restart required
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionLost) {
                    console.log('📡 Step 3: Connection lost - network issue');
                    
                } else if (statusCode === DisconnectReason.connectionClosed) {
                    console.log('🔒 Step 3: Connection closed by server');
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('💥 Step 3: Bad session - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Step 3: Connection replaced by another session');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.multideviceMismatch) {
                    console.log('📱 Step 3: Multi-device mismatch - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.forbidden) {
                    console.log('🚫 Step 3: Forbidden - account may be banned');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.unavailableService) {
                    console.log('🚫 Step 3: Service unavailable - WhatsApp servers may be down');
                    
                } else if (statusCode === 515) {
                    console.log('🔥 Step 3: Status 515 (Stream Error) - clearing auth and resetting');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else {
                    console.log('❓ Step 3: Other disconnect reason:', statusCode);
                    // For unknown errors, also clear auth to prevent persistent issues
                    await clearAuthFiles();
                    resetConnectionState();
                }

                qrCodeData = null;
                sock = null;
            }
        });

        // CRITICAL: Handle credential updates (Evolution API pattern)
        sock.ev.on('creds.update', saveCreds);

        // CRITICAL: Handle messages for connection verification
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Step 3: Message received - connection active and working');
        });

        // CRITICAL: Handle connection errors
        sock.ev.on('CB:call', (call) => {
            console.log('📞 Step 3: Call received:', call);
        });

    } catch (error) {
        console.error('❌ Step 3: Connection error:', error);
        handleConnectionFailure('connection_error');
        
        // CRITICAL: Always clear auth on errors to prevent persistent issues
        await clearAuthFiles();
        resetConnectionState();
    }
}

// Enhanced connection failure handler
function handleConnectionFailure(reason) {
    console.log(`❌ Step 3: Handling connection failure: ${reason}`);
    
    connectionStatus = 'error';
    isConnecting = false;
    qrCodeData = null;
    
    // Clear timeouts
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    if (qrTimeout) {
        clearTimeout(qrTimeout);
        qrTimeout = null;
    }
    
    // Cleanup socket
    if (sock) {
        try {
            sock.removeAllListeners();
            sock.end();
            sock = null;
        } catch (e) {
            console.log('⚠️ Step 3: Error cleaning up failed socket:', e.message);
        }
    }
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
    
    console.log(`💡 Step 3: Connection failed due to ${reason}. Try reset and reconnect.`);
}

// Enhanced disconnect function
async function disconnectWhatsApp() {
    console.log('🔌 Step 3: Disconnecting WhatsApp...');
    
    // Clear all timeouts
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
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 3: CRITICAL AUTH FIX WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step3-critical-auth-fix',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        lastConnectionTime: lastConnectionTime ? new Date(lastConnectionTime).toISOString() : null,
        fix: 'Evolution API Configuration Applied'
    });
});

// Socket.io connection handling with enhanced error management
io.on('connection', (socket) => {
    console.log(`👤 Step 3: Client connected: ${socket.id}`);
    
    // Send current status to new client
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Step 3: Sent existing QR code to new client');
    }

    // Handle WhatsApp connection request
    socket.on('connect-whatsapp', () => {
        console.log('🔌 Step 3: Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log(`ℹ️ Step 3: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    // Handle connection reset
    socket.on('reset-connection', async () => {
        console.log('🔄 Step 3: Client requested connection reset');
        await disconnectWhatsApp();
    });

    // Handle disconnect
    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 3: Client requested WhatsApp disconnect');
        await disconnectWhatsApp();
    });

    // Handle ping for connection testing
    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus,
            fix: 'Evolution API Config Applied'
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

// Enhanced graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 3: Received SIGTERM, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 3: Received SIGINT, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 3: CRITICAL AUTH FIX WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔥 Step 3: Evolution API configuration applied - CRITICAL AUTH FIX');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
    console.log('⚡ Ready for WhatsApp connections with WORKING authentication');
    console.log('🎯 Based on Evolution API working implementation');
});
