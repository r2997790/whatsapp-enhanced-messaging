// Step 2: Add Message Sending API (Based on Working Client)
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

console.log('🚀 Step 2: Starting WhatsApp Server with MESSAGE SENDING API');

// Explicit app.js route
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

// State management
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
    console.log('📁 Step 2: Created auth directory:', authDir);
}

// Silent logger
const logger = {
    level: 'silent',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// Connection cooldown
function canAttemptConnection() {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastQRTime;
    
    if (timeSinceLastAttempt < 10000) { // 10 second cooldown
        console.log('⏳ Step 2: Cooldown active, skipping connection attempt');
        return false;
    }
    
    if (connectionAttempts >= 5) { // Max 5 attempts
        console.log('🛑 Step 2: Max connection attempts reached');
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

// WhatsApp Connection (Working Configuration)
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
        lastQRTime = Date.now();
        
        console.log(`🔄 Step 2: Connection attempt ${connectionAttempts}/5`);

        // Cleanup existing socket
        if (sock) {
            try {
                sock.end();
                sock = null;
                console.log('🧹 Step 2: Cleaned up existing socket');
            } catch (e) {}
        }

        // Use persistent auth directory
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Step 2: Using persistent auth state');

        // Create socket with basic configuration
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp', 'Desktop', '2.2412.54'],
            connectTimeoutMs: 90000,
            defaultQueryTimeoutMs: 90000,
            keepAliveIntervalMs: 20000,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            fireInitQueries: false,
            emitOwnEvents: false,
            getMessage: async () => ({ conversation: 'hello' })
        });

        console.log('✅ Step 2: Socket created with working config');

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Step 2: Update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // Handle QR code
            if (qr && connectionStatus !== 'connected') {
                try {
                    console.log('📱 Step 2: Generating QR...');
                    qrCodeData = await QRCode.toDataURL(qr, {
                        scale: 8,
                        margin: 2,
                        color: { dark: '#000000', light: '#FFFFFF' },
                        errorCorrectionLevel: 'M'
                    });
                    
                    connectionStatus = 'qr-ready';
                    io.emit('qr-code', qrCodeData);
                    io.emit('connection-status', connectionStatus);
                    console.log('✅ Step 2: QR emitted');
                } catch (error) {
                    console.error('❌ Step 2: QR error:', error);
                }
            }

            // Handle connection state changes
            if (connection === 'open') {
                console.log('🎉 Step 2: ✅ CONNECTION SUCCESSFUL! MESSAGE SENDING READY!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
                io.emit('connection-status', connectionStatus);
                io.emit('qr-code', null);
                
            } else if (connection === 'connecting') {
                console.log('🔗 Step 2: Authenticating...');
                connectionStatus = 'connecting';
                io.emit('connection-status', connectionStatus);
                
            } else if (connection === 'close') {
                console.log('🔌 Step 2: Connection closed:', statusCode);
                
                connectionStatus = 'disconnected';
                isConnecting = false;
                io.emit('connection-status', connectionStatus);
                
                // Handle disconnections
                let shouldReconnect = false;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Step 2: Logged out - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('🔄 Step 2: Connection replaced - stopping');
                    resetConnectionState();
                    
                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('🔄 Step 2: Restart required');
                    shouldReconnect = connectionAttempts < 3;
                    
                } else if (statusCode === DisconnectReason.badSession) {
                    console.log('❌ Step 2: Bad session - clearing auth');
                    try {
                        const files = fs.readdirSync(authDir);
                        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
                    } catch (e) {}
                    shouldReconnect = connectionAttempts < 2;
                    
                } else {
                    console.log('❓ Step 2: Authentication or unknown failure');
                    shouldReconnect = false;
                }

                // Clear QR code on disconnect
                qrCodeData = null;
                io.emit('qr-code', null);

                if (shouldReconnect) {
                    console.log('🔄 Step 2: Will retry in 8 seconds...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 8000);
                } else {
                    console.log('⏹️ Step 2: Stopping auto-reconnection. Manual retry required.');
                }
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error('❌ Step 2: Setup error:', error);
        connectionStatus = 'error';
        isConnecting = false;
        io.emit('connection-status', connectionStatus);
    }
}

// Manual reset function
function manualReset() {
    console.log('🔄 Step 2: Manual reset initiated');
    
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
        console.log('🧹 Step 2: Auth directory cleared');
    } catch (e) {}
    
    // Reset state
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// ==================== NEW: MESSAGE SENDING API ====================

// API Routes (Based on Working Client)
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

// STEP 2: Single Message Sending API
app.post('/api/send-message', async (req, res) => {
    try {
        console.log('📤 Step 2: Single message send request received');
        const { number, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            console.log('❌ Step 2: WhatsApp not connected for single message');
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required' });
        }

        let formattedNumber = number.toString().replace(/[^\d]/g, '');
        if (!formattedNumber.includes('@')) {
            formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        console.log(`📱 Step 2: Sending single message to: ${formattedNumber}`);
        
        await sock.sendMessage(formattedNumber, { text: message });
        
        console.log('✅ Step 2: Single message sent successfully');
        res.json({ success: true, message: 'Message sent successfully' });
        
    } catch (error) {
        console.error('❌ Step 2: Single message send error:', error);
        res.status(500).json({ error: 'Failed to send message: ' + error.message });
    }
});

// STEP 2: Bulk Message Sending API
app.post('/api/send-bulk', async (req, res) => {
    try {
        console.log('📤 Step 2: Bulk message send request received');
        const { numbers, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            console.log('❌ Step 2: WhatsApp not connected for bulk message');
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0 || !message) {
            return res.status(400).json({ error: 'Numbers array and message are required' });
        }

        console.log(`📱 Step 2: Sending bulk message to ${numbers.length} numbers`);
        
        const results = [];
        
        for (const number of numbers) {
            try {
                let formattedNumber = number.toString().replace(/[^\d]/g, '');
                if (!formattedNumber.includes('@')) {
                    formattedNumber = `${formattedNumber}@s.whatsapp.net`;
                }

                await sock.sendMessage(formattedNumber, { text: message });
                results.push({ number, success: true });
                console.log(`✅ Step 2: Bulk message sent to: ${number}`);
                
                // Add delay between messages to prevent rate limiting
                if (numbers.length > 1) {
                    await delay(2000); // 2 second delay
                }
            } catch (error) {
                console.error(`❌ Step 2: Failed to send to ${number}:`, error.message);
                results.push({ number, success: false, error: error.message });
            }
        }
        
        const successful = results.filter(r => r.success).length;
        console.log(`✅ Step 2: Bulk send completed: ${successful}/${results.length} successful`);
        
        res.json({ 
            success: true, 
            message: 'Bulk send completed',
            results: results 
        });
        
    } catch (error) {
        console.error('❌ Step 2: Bulk message send error:', error);
        res.status(500).json({ error: 'Failed to send bulk messages: ' + error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'Step 2: WhatsApp Server with MESSAGE SENDING API',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step2-message-api',
        authDir: authDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        features: ['connection', 'single-messaging', 'bulk-messaging'],
        fix: 'Working Configuration + Message Sending API'
    });
});

// Socket.io connection handling
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
            if (canAttemptConnection()) {
                connectToWhatsApp();
            } else {
                socket.emit('connection-status', 'cooldown');
            }
        } else {
            console.log(`ℹ️ Step 2: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    // Handle connection reset
    socket.on('reset-connection', () => {
        console.log('🔄 Step 2: Client requested reset');
        manualReset();
    });

    // Handle disconnect
    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 2: Client requested WhatsApp disconnect');
        manualReset();
    });

    // Handle ping for connection testing
    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus,
            features: ['messaging'],
            fix: 'Step 2: Message Sending API Added'
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

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Step 2: Received SIGTERM, shutting down gracefully...');
    manualReset();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 2: Received SIGINT, shutting down gracefully...');
    manualReset();
    process.exit(0);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 2: WhatsApp Server with MESSAGE SENDING API running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔥 Step 2: Working authentication + Message sending API added');
    console.log('📁 Auth directory:', authDir);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
    console.log('⚡ Ready for WhatsApp connections and MESSAGE SENDING');
    console.log('🎯 API Endpoints: /api/send-message, /api/send-bulk, /api/status, /api/reset');
    console.log('✅ Step 2: MESSAGE SENDING functionality added based on working client');
});
