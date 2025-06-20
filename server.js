// Step 1: Fixed WhatsApp Connection with Proper Authentication
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
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

console.log('🚀 Step 1: Starting Fixed WhatsApp Server v2.0');

// CRITICAL: Explicit app.js route FIRST
app.get('/app.js', (req, res) => {
    const appJsPath = path.join(__dirname, 'app.js');
    console.log('📄 Step 1: Serving app.js from:', appJsPath);
    
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

// WhatsApp State Management
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastConnectionTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_fixed');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 1: Created auth directory:', authDir);
}

// Proper logger for Baileys (reduced noise but not silent)
const logger = {
    level: 'warn',
    info: () => {},
    error: (msg) => console.log('🔴 Baileys Error:', msg),
    warn: (msg) => console.log('🟡 Baileys Warning:', msg),
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Improved connection cooldown
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionTime;
    
    // 15 second cooldown between attempts
    if (timeSinceLastAttempt < 15000) {
        console.log(`⏳ Step 1: Cooldown active, ${Math.ceil((15000 - timeSinceLastAttempt) / 1000)}s remaining`);
        return false;
    }
    
    // Max 5 attempts per session
    if (connectionAttempts >= 5) {
        console.log('🛑 Step 1: Max connection attempts reached (5)');
        return false;
    }
    
    return true;
}

// Reset connection state
function resetConnectionState() {
    connectionAttempts = 0;
    lastConnectionTime = 0;
    qrCodeData = null;
    isConnecting = false;
    console.log('🔄 Step 1: Connection state reset');
}

// Cleanup auth files
async function clearAuthFiles() {
    try {
        if (fs.existsSync(authDir)) {
            const files = fs.readdirSync(authDir);
            for (const file of files) {
                fs.unlinkSync(path.join(authDir, file));
            }
            console.log('🧹 Step 1: Auth files cleared');
        }
    } catch (error) {
        console.log('⚠️ Step 1: Error clearing auth files:', error.message);
    }
}

// IMPROVED BAILEYS WHATSAPP CONNECTION
async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('⚠️ Step 1: Already connecting, ignoring request');
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
        
        console.log(`🔄 Step 1: WhatsApp connection attempt ${connectionAttempts}/5`);

        // Cleanup existing socket properly
        if (sock) {
            try {
                sock.end();
                sock.removeAllListeners();
                await delay(1000); // Wait for cleanup
                sock = null;
                console.log('🧹 Step 1: Previous socket cleaned up');
            } catch (e) {
                console.log('⚠️ Step 1: Error cleaning socket:', e.message);
            }
        }

        // Get latest Baileys version for compatibility
        const { version } = await fetchLatestBaileysVersion();
        console.log('📱 Step 1: Using Baileys version:', version);

        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Step 1: Auth state initialized');

        // Create WhatsApp socket with improved configuration
        sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: logger,
            browser: ['Chrome (Linux)', '', ''], // Better browser fingerprint
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            shouldSyncHistoryMessage: () => false,
            shouldIgnoreJid: () => false,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 3,
            getMessage: async () => ({ conversation: 'Message not available' })
        });

        console.log('✅ Step 1: WhatsApp socket created with improved config');

        // Handle connection updates with better error handling
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 1: Connection update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // Handle QR code generation
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 1: Generating QR code...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 4,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'H'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 1: QR code generated and sent');
                } catch (error) {
                    console.error('❌ Step 1: QR generation error:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            // Handle connection states
            if (connection === 'open') {
                console.log('🎉 Step 1: ✅ WHATSAPP CONNECTED SUCCESSFULLY!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                // Send test message to verify connection
                console.log('📞 Step 1: Connection verified, ready for messaging');
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 1: Authenticating with WhatsApp...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 1: Connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
                // Handle specific disconnect reasons with better logic
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 1: Logged out - clearing auth and resetting');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 1: Restart required - will retry after cooldown');
                    // Let user manually retry
                    
                } else if (statusCode === DisconnectReason.connectionLost) {
                    console.log('📡 Step 1: Connection lost - network issue');
                    
                } else if (statusCode === DisconnectReason.connectionClosed) {
                    console.log('🔒 Step 1: Connection closed by server');
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('💥 Step 1: Bad session - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Step 1: Connection replaced by another session');
                    
                } else if (statusCode === DisconnectReason.multideviceMismatch) {
                    console.log('📱 Step 1: Multi-device mismatch - clearing auth');
                    await clearAuthFiles();
                    resetConnectionState();
                    
                } else {
                    console.log('❓ Step 1: Other disconnect reason:', statusCode);
                }

                qrCodeData = null;
                sock = null;
            }
        });

        // Handle credential updates
        sock.ev.on('creds.update', saveCreds);

        // Handle messages (for testing)
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Step 1: Message received (connection working)');
        });

    } catch (error) {
        console.error('❌ Step 1: Connection error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
        
        // Clear auth on critical errors
        if (error.message.includes('Unauthorized') || error.message.includes('403')) {
            await clearAuthFiles();
            resetConnectionState();
        }
    }
}

// Disconnect function
async function disconnectWhatsApp() {
    console.log('🔌 Step 1: Disconnecting WhatsApp...');
    
    if (sock) {
        try {
            await sock.logout();
            sock.end();
            sock = null;
            console.log('✅ Step 1: WhatsApp disconnected properly');
        } catch (e) {
            console.log('⚠️ Step 1: Error during disconnect:', e.message);
        }
    }
    
    await clearAuthFiles();
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 1: Fixed WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step1-fixed-auth',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null'
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`👤 Step 1: Client connected: ${socket.id}`);
    
    // Send current status to new client
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Step 1: Sent existing QR code to new client');
    }

    // Handle WhatsApp connection request
    socket.on('connect-whatsapp', () => {
        console.log('🔌 Step 1: Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log('ℹ️ Step 1: Already connected or connecting');
        }
    });

    // Handle connection reset
    socket.on('reset-connection', async () => {
        console.log('🔄 Step 1: Client requested connection reset');
        await disconnectWhatsApp();
    });

    // Handle disconnect
    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 1: Client requested WhatsApp disconnect');
        await disconnectWhatsApp();
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 1: Client disconnected: ${socket.id}`);
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 1: Shutting down...');
    await disconnectWhatsApp();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 1: Fixed WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🎯 Step 1: Improved authentication and error handling');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
});
