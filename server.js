// Step 3: Minimal server focused on Baileys WhatsApp connection
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

const PORT = process.env.PORT || 3000;

console.log('🚀 Step 3: Starting Minimal WhatsApp Server - Baileys Focus v1.0');

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

// WhatsApp State Management
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastQRTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_step3');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log('📁 Step 3: Created auth directory:', authDir);
}

// Silent logger for Baileys
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Connection cooldown prevention
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastQRTime;
    
    if (timeSinceLastAttempt < 10000) { // 10 second cooldown
        console.log('⏳ Step 3: Cooldown active, skipping connection attempt');
        return false;
    }
    
    if (connectionAttempts >= 3) { // Max 3 attempts for testing
        console.log('🛑 Step 3: Max connection attempts reached');
        return false;
    }
    
    return true;
}

// Reset connection state
function resetConnectionState() {
    connectionAttempts = 0;
    lastQRTime = 0;
    qrCodeData = null;
    isConnecting = false;
    console.log('🔄 Step 3: Connection state reset');
}

// CORE BAILEYS WHATSAPP CONNECTION
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
        lastQRTime = Date.now();
        
        console.log(`🔄 Step 3: Baileys connection attempt ${connectionAttempts}/3`);

        // Cleanup existing socket
        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Step 3: Cleaned up existing socket');
            } catch (e) {
                console.log('⚠️ Step 3: Error cleaning socket:', e.message);
            }
        }

        // Initialize Baileys auth state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Step 3: Baileys auth state initialized');

        // Create WhatsApp socket with Baileys
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp Step3 Test', 'Desktop', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: async () => ({ conversation: 'Step 3 Test Message' })
        });

        console.log('✅ Step 3: Baileys socket created');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 3: Baileys connection update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // Handle QR code generation
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 3: Generating QR code with Baileys...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 6,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 3: QR code generated and sent to clients');
                } catch (error) {
                    console.error('❌ Step 3: QR generation error:', error);
                    connectionStatus = 'error';
                    io.emit('connection-status', connectionStatus);
                }
            }

            // Handle connection states
            if (connection === 'open') {
                console.log('🎉 Step 3: BAILEYS WHATSAPP CONNECTION SUCCESSFUL!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 3: Baileys authenticating...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 3: Baileys connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                
                // Handle specific disconnect reasons
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 3: Logged out - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                        console.log('🧹 Step 3: Auth directory cleared');
                    } catch (e) {
                        console.log('⚠️ Step 3: Error clearing auth:', e.message);
                    }
                    resetConnectionState();
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 3: Restart required by Baileys');
                    // Don't auto-restart in testing phase
                } else {
                    console.log('❓ Step 3: Other disconnect reason:', statusCode);
                }

                qrCodeData = null;
                io.emit('qr-code', null);
            }
        });

        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('❌ Step 3: Baileys connection error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
    }
}

// Manual reset function
function manualReset() {
    console.log('🔄 Step 3: Manual reset initiated');
    
    if (sock) {
        try {
            sock.end();
            sock = null;
            console.log('🧹 Step 3: Socket terminated');
        } catch (e) {
            console.log('⚠️ Step 3: Error terminating socket:', e.message);
        }
    }
    
    try {
        const files = fs.readdirSync(authDir);
        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
        console.log('🧹 Step 3: Auth directory cleared');
    } catch (e) {
        console.log('⚠️ Step 3: Error clearing auth directory:', e.message);
    }
    
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 3: Baileys WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step3-baileys-focus',
        authDir: authDir
    });
});

// Socket.io connection handling
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
            console.log('ℹ️ Step 3: Already connected or connecting');
        }
    });

    // Handle connection reset
    socket.on('reset-connection', () => {
        console.log('🔄 Step 3: Client requested connection reset');
        manualReset();
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 3: Client disconnected: ${socket.id}`);
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 3: Baileys WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🎯 Step 3: Focus on Baileys WhatsApp connection only');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
});