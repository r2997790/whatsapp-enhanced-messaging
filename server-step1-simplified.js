// Step 1: Simplified Authentication Configuration (Based on Working Client)
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
    delay
} = require('@whiskeysockets/baileys');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

console.log('🚀 Step 1: Starting SIMPLIFIED WhatsApp Server (Based on Working Client)');

// Explicit app.js route
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

// SIMPLIFIED: State management (like working client)
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastQRTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_persistent');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 1: Created auth directory:', authDir);
}

// SIMPLIFIED: Silent logger (like working client)
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// SIMPLIFIED: Connection cooldown (like working client)
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastQRTime;
    
    if (timeSinceLastAttempt < 10000) { // 10 second cooldown (not 30)
        console.log('⏳ Step 1: Cooldown active, skipping connection attempt');
        return false;
    }
    
    if (connectionAttempts >= 5) { // Max 5 attempts (not 3)
        console.log('🛑 Step 1: Max connection attempts reached');
        return false;
    }
    
    return true;
}

// SIMPLIFIED: Reset connection state (like working client)
function resetConnectionState() {
    connectionAttempts = 0;
    lastQRTime = 0;
    qrCodeData = null;
    isConnecting = false;
}

// SIMPLIFIED: WhatsApp Connection (Based on Working Client)
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
        lastQRTime = Date.now();
        
        console.log(`🔄 Step 1: SIMPLIFIED connection attempt ${connectionAttempts}/5`);

        // SIMPLIFIED: Cleanup existing socket (like working client)
        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Step 1: Cleaned up existing socket');
            } catch (e) {}
        }

        // SIMPLIFIED: Use persistent auth directory (like working client)
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Step 1: Using persistent auth state');

        // SIMPLIFIED: Create socket with basic configuration (like working client)
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp', 'Desktop', '2.2412.54'], // Same as working client
            connectTimeoutMs: 90000, // Longer timeout like working client
            defaultQueryTimeoutMs: 90000,
            keepAliveIntervalMs: 20000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: false,
            emitOwnEvents: false,
            getMessage: async () => ({ conversation: 'hello' })
        });

        console.log('✅ Step 1: Socket created with simplified config');

        // SIMPLIFIED: Connection update handler (like working client)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 1: Update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // SIMPLIFIED: Handle QR code (like working client)
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 1: Generating QR...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 1: QR emitted');
                } catch (error) {
                    console.error('❌ Step 1: QR error:', error);
                }
            }

            // SIMPLIFIED: Handle connection state changes (like working client)
            if (connection === 'open') {
                console.log('🎉 Step 1: ✅ SIMPLIFIED CONNECTION SUCCESSFUL!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState(); // Reset on success
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 1: Authenticating...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 1: Connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                
                // SIMPLIFIED: Handle disconnections (like working client)
                let shouldReconnect = false;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 1: Logged out - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Step 1: Connection replaced - stopping');
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 1: Restart required');
                    shouldReconnect = connectionAttempts < 3;
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('❌ Step 1: Bad session - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    shouldReconnect = connectionAttempts < 2;
                    
                } else {
                    // For authentication failures and unknown disconnects
                    console.log('❓ Step 1: Authentication or unknown failure');
                    shouldReconnect = false; // DON'T auto-reconnect
                }

                // Clear QR code on disconnect
                qrCodeData = null;
                io.emit('qr-code', null);

                if (shouldReconnect) {
                    console.log('🔄 Step 1: Will retry in 8 seconds...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 8000);
                } else {
                    console.log('⏹️ Step 1: Stopping auto-reconnection. Manual retry required.');
                }
            }
        });

        // SIMPLIFIED: Save credentials (like working client)
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('❌ Step 1: Setup error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
    }
}

// SIMPLIFIED: Manual reset function (like working client)
function manualReset() {
    console.log('🔄 Step 1: Manual reset initiated');
    
    // Stop current connection
    if (sock) {
        try {
            sock.end();
            sock = null;
        } catch (e) {}
    }
    
    // Clear auth directory
    try {
        const files = fs.readdirSync(authDir);
        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
        console.log('🧹 Step 1: Auth directory cleared');
    } catch (e) {}
    
    // Reset state
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 1: SIMPLIFIED WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step1-simplified',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        fix: 'Simplified Configuration Based on Working Client'
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
            if (canAttemptConnection()) {
                connectToWhatsApp();
            } else {
                socket.emit('connection-status', 'cooldown');
            }
        } else {
            console.log(`ℹ️ Step 1: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    // Handle connection reset
    socket.on('reset-connection', () => {
        console.log('🔄 Step 1: Client requested reset');
        manualReset();
    });

    // Handle disconnect
    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 1: Client requested WhatsApp disconnect');
        manualReset();
    });

    // Handle ping for connection testing
    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus,
            fix: 'Step 1: Simplified Config Applied'
        });
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 1: Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.log(`❌ Step 1: Socket error from ${socket.id}:`, error);
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 1: Received SIGTERM, shutting down gracefully...');
    manualReset();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 1: Received SIGINT, shutting down gracefully...');
    manualReset();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 1: SIMPLIFIED WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔥 Step 1: Simplified configuration applied based on working client');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
    console.log('⚡ Ready for WhatsApp connections with WORKING authentication');
    console.log('🎯 Based on successful working client implementation');
});
