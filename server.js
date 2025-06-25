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
app.use(express.static('.'));

const PORT = process.env.PORT || 8080;

// State management - simplified approach with LOOP PREVENTION
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let isConnecting = false;
let connectionAttempts = 0;
let lastQRTime = 0;
let authDir = path.join(tmpdir(), 'wa_session_persistent');

// In-memory storage for enhanced features
let contacts = [];
let groups = [];
let templates = [];
let messageLogs = [];

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

// Silent logger - prevents most baileys logging issues
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// CRITICAL: Prevent rapid reconnection loops
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastQRTime;
    
    if (timeSinceLastAttempt < 10000) { // 10 second cooldown
        console.log('⏳ Cooldown active, skipping connection attempt');
        return false;
    }
    
    if (connectionAttempts >= 5) { // Max 5 attempts
        console.log('🛑 Max connection attempts reached');
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
}

async function connectToWhatsApp() {
    if (isConnecting) {
        console.log('⚠️ Already connecting, ignoring request');
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
        
        console.log(`🔄 Connection attempt ${connectionAttempts}/5`);

        // Cleanup existing socket
        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Cleaned up existing socket');
            } catch (e) {}
        }

        // Use persistent auth directory (don't clear it)
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Using persistent auth state');

        // Create socket with PROVEN configuration
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp', 'Desktop', '2.2412.54'],
            connectTimeoutMs: 90000, // Longer timeout
            defaultQueryTimeoutMs: 90000,
            keepAliveIntervalMs: 20000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: false,
            emitOwnEvents: false,
            getMessage: async () => ({ conversation: 'hello' })
        });

        console.log('✅ Socket created');

        // CRITICAL: Single connection update handler with strict state management
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // Handle QR code - ONLY ONCE PER CONNECTION ATTEMPT
            if (qr && connectionStatus !== 'connected' && !qrCodeData) {
                try {
                    console.log('📱 Generating QR...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ QR emitted (ONCE)');
                } catch (error) {
                    console.error('❌ QR error:', error);
                }
            }

            // Handle connection state changes - EXACT LOGIC FROM WORKING VERSION
            if (connection === 'open') {
                console.log('🎉 CONNECTION SUCCESSFUL!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState(); // Reset on success
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Authenticating...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                
                // CRITICAL: Only reconnect on specific conditions
                let shouldReconnect = false;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Logged out - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Connection replaced - stopping');
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Restart required');
                    shouldReconnect = connectionAttempts < 3;
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('❌ Bad session - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    shouldReconnect = connectionAttempts < 2;
                    
                } else {
                    // For authentication failures and unknown disconnects
                    console.log('❓ Authentication or unknown failure');
                    // DON'T auto-reconnect - wait for manual retry
                    shouldReconnect = false;
                }

                // Clear QR code on disconnect
                qrCodeData = null;
                io.emit('qr-code', null);

                if (shouldReconnect) {
                    console.log('🔄 Will retry in 8 seconds...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 8000);
                } else {
                    console.log('⏹️ Stopping auto-reconnection. Manual retry required.');
                }
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages for logs
        sock.ev.on('messages.upsert', async (m) => {
            console.log('📩 Message received - connection active');
        });

    } catch (error) {
        console.error('❌ Setup error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
    }
}

// Manual reset function
function manualReset() {
    console.log('🔄 Manual reset initiated');
    
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
        console.log('🧹 Auth directory cleared');
    } catch (e) {}
    
    // Reset state
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'LOOP_PREVENTION_ENABLED'
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        attempts: connectionAttempts,
        canAttempt: canAttemptConnection()
    });
});

app.post('/api/reset', (req, res) => {
    manualReset();
    res.json({ success: true, message: 'Connection reset' });
});

// Enhanced messaging API
app.post('/api/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required' });
        }

        let formattedNumber = number.toString().replace(/[^\d@.]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        await sock.sendMessage(formattedNumber, { text: message });
        
        // Log the message
        messageLogs.push({
            id: Date.now(),
            number: number,
            message: message,
            timestamp: new Date(),
            status: 'sent',
            type: 'single'
        });

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Send message error:', error);
        
        // Log failed message
        messageLogs.push({
            id: Date.now(),
            number: req.body.number,
            message: req.body.message,
            timestamp: new Date(),
            status: 'failed',
            type: 'single',
            error: error.message
        });
        
        res.status(500).json({ error: 'Failed to send message: ' + error.message });
    }
});

// Socket.io - CRITICAL: Prevent client-side loops
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            if (canAttemptConnection()) {
                connectToWhatsApp();
            } else {
                socket.emit('connection-status', 'cooldown');
            }
        } else {
            console.log('⚠️ Ignoring connect request - already connecting/connected');
        }
    });

    socket.on('reset-connection', () => {
        console.log('🔄 Client requested reset');
        manualReset();
    });

    socket.on('disconnect', () => {
        console.log(`👋 Client disconnected: ${socket.id}`);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced WhatsApp Messaging Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('⏳ Ready - ANTI-LOOP PROTECTION ENABLED');
    console.log('🔒 QR Loop Prevention: ACTIVE');
    console.log('');
    console.log('Ready to implement Part 2 & 3: Contact Management and Templates');
});

module.exports = { app, server, io };