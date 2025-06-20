// Step 2: Enhanced WhatsApp Connection with Improved Authentication
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
    isJidGroup
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

console.log('🚀 Step 2: Starting Enhanced WhatsApp Server v3.0');

// CRITICAL: Explicit app.js route FIRST
app.get('/app.js', (req, res) => {
    const appJsPath = path.join(__dirname, 'app.js');
    console.log('📄 Step 2: Serving app.js from:', appJsPath);
    
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

// Enhanced WhatsApp State Management
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastConnectionTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_enhanced');
let connectionTimeout = null;
let qrTimeout = null;
let reconnectDelay = 15000; // 15 second delay between attempts

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 2: Created auth directory:', authDir);
}

// Enhanced logger for better debugging
const logger = {
    level: 'warn',
    info: () => {},
    error: (msg) => console.log('🔴 Baileys Error:', msg),
    warn: (msg) => console.log('🟡 Baileys Warning:', msg),
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Enhanced connection cooldown with exponential backoff
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionTime;
    
    // Exponential backoff: 15s, 30s, 60s, 120s, 240s
    const backoffDelays = [15000, 30000, 60000, 120000, 240000];
    const currentDelay = backoffDelays[Math.min(connectionAttempts, backoffDelays.length - 1)];
    
    if (timeSinceLastAttempt < currentDelay) {
        const remainingTime = Math.ceil((currentDelay - timeSinceLastAttempt) / 1000);
        console.log(`⏳ Step 2: Cooldown active, ${remainingTime}s remaining (attempt ${connectionAttempts + 1})`);
        return false;
    }
    
    // Max 5 attempts per session, then require manual reset
    if (connectionAttempts >= 5) {
        console.log('🛑 Step 2: Max connection attempts reached (5). Please reset to try again.');
        return false;
    }
    
    return true;
}

// Enhanced connection state reset
function resetConnectionState() {
    console.log('🔄 Step 2: Resetting connection state...');
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
    
    console.log('✅ Step 2: Connection state reset complete');
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
                    console.log('⚠️ Step 2: Error deleting file:', file, err.message);
                }
            }
            console.log('🧹 Step 2: Auth files cleared successfully');
        }
    } catch (error) {
        console.log('⚠️ Step 2: Error clearing auth files:', error.message);
    }
}

// ENHANCED BAILEYS WHATSAPP CONNECTION WITH TIMEOUT PROTECTION
async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('⚠️ Step 2: Already connecting, ignoring request');
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
        
        console.log(`🔄 Step 2: WhatsApp connection attempt ${connectionAttempts}/5`);
        
        // Set overall connection timeout (90 seconds)
        connectionTimeout = setTimeout(() => {
            console.log('⏰ Step 2: Connection timeout after 90 seconds');
            handleConnectionFailure('timeout');
        }, 90000);

        // Cleanup existing socket properly
        if (sock) {
            try {
                console.log('🧹 Step 2: Cleaning up existing socket...');
                sock.removeAllListeners();
                sock.end();
                await delay(2000); // Wait for proper cleanup
                sock = null;
                console.log('✅ Step 2: Previous socket cleaned up');
            } catch (e) {
                console.log('⚠️ Step 2: Error cleaning socket:', e.message);
            }
        }

        // Get latest Baileys version for maximum compatibility
        console.log('📱 Step 2: Fetching latest Baileys version...');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📱 Step 2: Using Baileys version: ${version.join('.')} (latest: ${isLatest})`);

        // Initialize auth state with better error handling
        console.log('🔐 Step 2: Initializing auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('✅ Step 2: Auth state initialized');

        // Create WhatsApp socket with enhanced configuration
        console.log('🔌 Step 2: Creating WhatsApp socket...');
        sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: logger,
            browser: ['Ubuntu', 'Chrome', '110.0.0.0'], // Better browser fingerprint
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: true, // Changed to true for better authentication
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: (jid) => isJidBroadcast(jid),
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 3,
            fireInitQueries: false, // Prevent unnecessary queries during initial connection
            getMessage: async () => ({ conversation: 'Message not available' }),
            // Enhanced authentication options
            options: {
                webhookUrl: null,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                printQRInTerminal: false
            }
        });

        console.log('✅ Step 2: WhatsApp socket created successfully');

        // Enhanced connection update handler with timeout protection
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 2: Connection update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts,
                receivedNotifications: !!receivedPendingNotifications
            });

            // Clear connection timeout on any update
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
            }

            // Handle QR code generation with timeout
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 2: Generating QR code...');
                    
                    // Clear any existing QR timeout
                    if (qrTimeout) {
                        clearTimeout(qrTimeout);
                    }
                    
                    // Set QR code timeout (60 seconds)
                    qrTimeout = setTimeout(() => {
                        console.log('⏰ Step 2: QR code expired after 60 seconds');
                        handleConnectionFailure('qr_timeout');
                    }, 60000);
                    
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 4,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'H'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 2: QR code generated and sent');
                    
                } catch (error) {
                    console.error('❌ Step 2: QR generation error:', error);
                    handleConnectionFailure('qr_error');
                }
            }

            // Handle connection states with better logic
            if (connection === 'open') {
                console.log('🎉 Step 2: ✅ WHATSAPP CONNECTED SUCCESSFULLY!');
                
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
                
                // Verify connection with a simple presence update
                try {
                    await sock.sendPresenceUpdate('available');
                    console.log('📞 Step 2: Connection verified - presence updated');
                } catch (err) {
                    console.log('⚠️ Step 2: Could not update presence:', err.message);
                }
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 2: Authenticating with WhatsApp...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 2: Connection closed with code:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                // Clear timeouts
                if (qrTimeout) {
                    clearTimeout(qrTimeout);
                    qrTimeout = null;
                }
                
                // Enhanced disconnect reason handling
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 2: Logged out - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 2: Restart required - will retry after cooldown');
                    // Will retry on next user request
                    
                } else if (statusCode === DisconnectReason.connectionLost) {
                    console.log('📡 Step 2: Connection lost - network issue');
                    
                } else if (statusCode === DisconnectReason.connectionClosed) {
                    console.log('🔒 Step 2: Connection closed by server');
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('💥 Step 2: Bad session - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Step 2: Connection replaced by another session');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.multideviceMismatch) {
                    console.log('📱 Step 2: Multi-device mismatch - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.forbidden) {
                    console.log('🚫 Step 2: Forbidden - account may be banned');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.unavailableService) {
                    console.log('🚫 Step 2: Service unavailable - WhatsApp servers may be down');
                    
                } else {
                    console.log('❓ Step 2: Other disconnect reason:', statusCode);
                }

                qrCodeData = null;
                sock = null;
            }
        });

        // Handle credential updates
        sock.ev.on('creds.update', saveCreds);

        // Handle messages (for connection verification)
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Step 2: Message received - connection active');
        });

        // Handle connection errors
        sock.ev.on('CB:call', (call) => {
            console.log('📞 Step 2: Call received:', call);
        });

    } catch (error) {
        console.error('❌ Step 2: Connection error:', error);
        handleConnectionFailure('connection_error');
        
        // Clear auth on critical errors
        if (error.message.includes('Unauthorized') || 
            error.message.includes('403') || 
            error.message.includes('401')) {
            await clearAuthFiles();
            resetConnectionState();
        }
    }
}

// Enhanced connection failure handler
function handleConnectionFailure(reason) {
    console.log(`❌ Step 2: Handling connection failure: ${reason}`);
    
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
            console.log('⚠️ Step 2: Error cleaning up failed socket:', e.message);
        }
    }
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
    
    console.log(`💡 Step 2: Connection failed due to ${reason}. Wait ${reconnectDelay/1000}s before retry.`);
}

// Enhanced disconnect function
async function disconnectWhatsApp() {
    console.log('🔌 Step 2: Disconnecting WhatsApp...');
    
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
            console.log('✅ Step 2: WhatsApp disconnected properly');
        } catch (e) {
            console.log('⚠️ Step 2: Error during disconnect:', e.message);
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
        status: 'Step 2: Enhanced WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step2-enhanced-auth',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        lastConnectionTime: lastConnectionTime ? new Date(lastConnectionTime).toISOString() : null
    });
});

// Socket.io connection handling with enhanced error management
io.on('connection', (socket) => {
    console.log(`👤 Step 2: Client connected: ${socket.id}`);
    
    // Send current status to new client
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Step 2: Sent existing QR code to new client');
    }

    // Handle WhatsApp connection request
    socket.on('connect-whatsapp', () => {
        console.log('🔌 Step 2: Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log(`ℹ️ Step 2: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    // Handle connection reset
    socket.on('reset-connection', async () => {
        console.log('🔄 Step 2: Client requested connection reset');
        await disconnectWhatsApp();
    });

    // Handle disconnect
    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 2: Client requested WhatsApp disconnect');
        await disconnectWhatsApp();
    });

    // Handle ping for connection testing
    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus 
        });
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 2: Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.log(`❌ Step 2: Socket error from ${socket.id}:`, error);
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Enhanced graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 2: Received SIGTERM, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 2: Received SIGINT, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 2: Enhanced WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🎯 Step 2: Enhanced authentication, timeout protection & error handling');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
    console.log('⚡ Ready for WhatsApp connections with improved stability');
});
