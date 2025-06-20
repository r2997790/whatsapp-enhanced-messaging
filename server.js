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

// Debug logging
console.log('🚀 Starting Enhanced WhatsApp Messaging Platform v2.0.5 - CRITICAL FIX 2');
console.log('📁 Serving files from:', __dirname);
console.log('📄 Checking for app.js:', fs.existsSync(path.join(__dirname, 'app.js')));

// CRITICAL FIX: Place the explicit app.js route BEFORE static middleware
app.get('/app.js', (req, res) => {
    const appJsPath = path.join(__dirname, 'app.js');
    console.log('📄 Serving app.js from:', appJsPath);
    
    if (fs.existsSync(appJsPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(appJsPath);
    } else {
        console.error('❌ app.js not found at:', appJsPath);
        res.status(404).send('app.js not found');
    }
});

// DEBUG: Log all requests to see what's happening
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.path}`);
    next();
});

// Enhanced static file serving - AFTER explicit routes
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        console.log('📁 Static file request:', filePath);
        
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
let authDir = path.join(tmpdir(), 'wa_session_enhanced');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
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

// Prevent rapid reconnection loops
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

        // Use persistent auth directory
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        console.log('🔐 Using persistent auth state');

        // Create socket with optimized configuration
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp Enhanced', 'Desktop', '2.2412.54'],
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

        console.log('✅ Socket created');

        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log('📡 Update:', { 
                connection, 
                qr: !!qr, 
                statusCode,
                attempts: connectionAttempts 
            });

            // Handle QR code
            if (qr && connectionStatus !== 'connected') {
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
                    console.log('✅ QR emitted to clients');
                } catch (error) {
                    console.error('❌ QR error:', error);
                }
            }

            // Handle connection state changes
            if (connection === 'open') {
                console.log('🎉 CONNECTION SUCCESSFUL!');
                connectionStatus = 'connected';
                qrCodeData = null;
                isConnecting = false;
                resetConnectionState();
                
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
                    console.log('❓ Authentication or unknown failure');
                    shouldReconnect = false;
                }

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
    
    if (sock) {
        try {
            sock.end();
            sock = null;
        } catch (e) {}
    }
    
    try {
        const files = fs.readdirSync(authDir);
        files.forEach(file => fs.unlinkSync(path.join(authDir, file)));
        console.log('🧹 Auth directory cleared');
    } catch (e) {}
    
    resetConnectionState();
    connectionStatus = 'disconnected';
    qrCodeData = null;
    
    io.emit('connection-status', connectionStatus);
    io.emit('qr-code', null);
}

// Helper function to format phone numbers
function formatPhoneNumber(number) {
    let formattedNumber = number.toString().replace(/[^\d]/g, '');
    
    // Handle group IDs
    if (number.includes('@g.us')) {
        return number;
    }
    
    // Handle regular phone numbers
    if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }
    
    return formattedNumber;
}

// Personalization function
function personalizeMessage(content, contact) {
    return content
        .replace(/{firstName}/g, contact.firstName || contact.name || '')
        .replace(/{lastName}/g, contact.lastName || '')
        .replace(/{nickname}/g, contact.nickname || contact.firstName || contact.name || '')
        .replace(/{fullName}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim());
}

// Routes - Place AFTER static file serving
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: '2.0.5-critical-fix-2',
        appJsExists: fs.existsSync(path.join(__dirname, 'app.js'))
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQR: !!qrCodeData,
        isConnecting: isConnecting,
        attempts: connectionAttempts,
        canAttempt: canAttemptConnection(),
        version: '2.0.5-critical-fix-2'
    });
});

app.post('/api/reset', (req, res) => {
    manualReset();
    res.json({ success: true, message: 'Connection reset' });
});

// Enhanced API endpoints for the new functionality
app.post('/api/send-single', async (req, res) => {
    try {
        const { recipient, message, personalize = false } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!recipient || !message) {
            return res.status(400).json({ error: 'Recipient and message are required' });
        }

        let finalMessage = message;
        if (personalize && recipient.firstName) {
            finalMessage = personalizeMessage(message, recipient);
        }

        const formattedNumber = formatPhoneNumber(recipient.phone || recipient.number || recipient.id);
        await sock.sendMessage(formattedNumber, { text: finalMessage });
        
        res.json({ 
            success: true, 
            message: 'Message sent successfully',
            recipient: recipient.firstName ? `${recipient.firstName} ${recipient.lastName || ''}`.trim() : formattedNumber,
            personalizedMessage: finalMessage
        });
    } catch (error) {
        console.error('Send single error:', error);
        res.status(500).json({ error: 'Failed to send message: ' + error.message });
    }
});

app.post('/api/send-bulk', async (req, res) => {
    try {
        const { recipients, message, personalize = false, delayBetween = 2000 } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'Recipients array is required' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const results = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            try {
                let finalMessage = message;
                if (personalize && (recipient.firstName || recipient.name)) {
                    finalMessage = personalizeMessage(message, recipient);
                }

                const formattedNumber = formatPhoneNumber(recipient.phone || recipient.number || recipient.id);
                await sock.sendMessage(formattedNumber, { text: finalMessage });
                
                results.push({ 
                    recipient: recipient.firstName ? `${recipient.firstName} ${recipient.lastName || ''}`.trim() : formattedNumber,
                    success: true,
                    personalizedMessage: finalMessage
                });
                
                // Add delay between messages (except for the last one)
                if (i < recipients.length - 1) {
                    await delay(delayBetween);
                }
            } catch (error) {
                console.error(`Error sending to ${recipient.phone || recipient.number}:`, error);
                results.push({ 
                    recipient: recipient.firstName ? `${recipient.firstName} ${recipient.lastName || ''}`.trim() : (recipient.phone || recipient.number),
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        res.json({ 
            success: true, 
            message: `Bulk send completed: ${successful} successful, ${failed} failed`,
            results: results,
            summary: {
                total: recipients.length,
                successful,
                failed
            }
        });
    } catch (error) {
        console.error('Send bulk error:', error);
        res.status(500).json({ error: 'Failed to send bulk messages: ' + error.message });
    }
});

app.post('/api/send-to-group', async (req, res) => {
    try {
        const { groupId, message, contacts = [] } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        if (!groupId && (!contacts || contacts.length === 0)) {
            return res.status(400).json({ error: 'Group ID or contacts array is required' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const results = [];

        if (groupId) {
            // Send to specific group
            try {
                const formattedGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
                await sock.sendMessage(formattedGroupId, { text: message });
                results.push({ recipient: `Group ${groupId}`, success: true });
            } catch (error) {
                results.push({ recipient: `Group ${groupId}`, success: false, error: error.message });
            }
        } else {
            // Send to individual contacts in the group
            for (let i = 0; i < contacts.length; i++) {
                const contact = contacts[i];
                
                try {
                    const finalMessage = personalizeMessage(message, contact);
                    const formattedNumber = formatPhoneNumber(contact.phone || contact.number || contact.id);
                    await sock.sendMessage(formattedNumber, { text: finalMessage });
                    
                    results.push({ 
                        recipient: contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : formattedNumber,
                        success: true,
                        personalizedMessage: finalMessage
                    });
                    
                    if (i < contacts.length - 1) {
                        await delay(2000);
                    }
                } catch (error) {
                    results.push({ 
                        recipient: contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : (contact.phone || contact.number),
                        success: false, 
                        error: error.message 
                    });
                }
            }
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        res.json({ 
            success: true, 
            message: `Group send completed: ${successful} successful, ${failed} failed`,
            results: results,
            summary: {
                total: results.length,
                successful,
                failed
            }
        });
    } catch (error) {
        console.error('Send to group error:', error);
        res.status(500).json({ error: 'Failed to send to group: ' + error.message });
    }
});

// Legacy compatibility endpoints
app.post('/api/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const formattedNumber = formatPhoneNumber(number);
        await sock.sendMessage(formattedNumber, { text: message });
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Legacy send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log(`👤 Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Sent existing QR code to new client');
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Client requested connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            if (canAttemptConnection()) {
                connectToWhatsApp();
            } else {
                socket.emit('connection-status', 'cooldown');
            }
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

// Handle root route - AFTER all other routes
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    console.log('🏠 Serving index.html from:', indexPath);
    res.sendFile(indexPath);
});

// Catch-all for unknown routes - DO NOT SERVE HTML for static assets
app.get('*', (req, res) => {
    console.log('❓ Unknown route requested:', req.path);
    
    // If it looks like a static asset request, return 404
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
        console.log('❌ Static asset not found:', req.path);
        return res.status(404).send('File not found');
    }
    
    // Otherwise serve index.html for client-side routing
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced WhatsApp Messaging Platform v2.0.5 running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔧 CRITICAL FIX 2: app.js route placed BEFORE static middleware');
    console.log('📁 Static files served from:', __dirname);
    console.log('📄 Files in directory:', fs.readdirSync(__dirname).filter(f => f.endsWith('.js') || f.endsWith('.html')));
});
