const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration
const PORT = process.env.PORT || 3000;
const SESSION_DIR = './session';

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Global variables
let sock = null;
let qrCode = null;
let isConnected = false;
let connectionState = 'disconnected';

// Logger configuration - reduced logging to prevent spam
const logger = pino({ 
    level: 'error',  // Only log errors to reduce noise
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        connected: isConnected,
        state: connectionState,
        qrCode: qrCode,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/send-message', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!isConnected || !sock) {
            return res.status(400).json({ 
                success: false, 
                error: 'WhatsApp not connected' 
            });
        }

        if (!to || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number and message are required' 
            });
        }

        // Format phone number
        const phoneNumber = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        
        // Send message
        const result = await sock.sendMessage(phoneNumber, { text: message });
        
        console.log('Message sent successfully:', result);
        res.json({ 
            success: true, 
            messageId: result.key.id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/disconnect', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            sock = null;
            isConnected = false;
            connectionState = 'disconnected';
            qrCode = null;
            
            // Clean up session files
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                fs.mkdirSync(SESSION_DIR, { recursive: true });
            }
            
            io.emit('connection-update', { 
                state: 'disconnected',
                qrCode: null 
            });
        }
        
        res.json({ success: true, message: 'Disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Initialize WhatsApp connection
async function initializeWhatsApp() {
    try {
        console.log('Initializing WhatsApp connection...');
        
        // Clear any existing connection
        if (sock) {
            try {
                await sock.logout();
            } catch (e) {
                // Ignore logout errors
            }
            sock = null;
        }
        
        // Get latest Baileys version
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);
        
        // Initialize auth state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        
        // Create socket
        sock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            printQRInTerminal: false,  // We'll handle QR display ourselves
            browser: ['WhatsApp Enhanced Messaging', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,  // Don't sync full history for faster startup
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true,
            fireInitQueries: true,
            emitOwnEvents: false,
            msgRetryCounterCache: {},
            qrTimeout: 60000,  // 60 second QR timeout
            // Connection options
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 5,
        });

        // Connection event handlers
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('Connection update:', { connection, qr: !!qr });
            
            if (qr) {
                qrCode = qr;
                connectionState = 'qr-ready';
                console.log('QR Code generated, emitting to clients...');
                io.emit('qr-code', qr);
                io.emit('connection-update', { 
                    state: 'qr-ready',
                    qrCode: qr 
                });
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                
                console.log('Connection closed:', {
                    statusCode,
                    shouldReconnect,
                    reason: DisconnectReason[statusCode] || 'Unknown'
                });
                
                isConnected = false;
                qrCode = null;
                
                if (shouldReconnect) {
                    connectionState = 'reconnecting';
                    console.log('Reconnecting in 5 seconds...');
                    setTimeout(() => initializeWhatsApp(), 5000);
                } else {
                    connectionState = 'disconnected';
                    sock = null;
                }
                
                io.emit('connection-update', { 
                    state: connectionState,
                    qrCode: null 
                });
                
            } else if (connection === 'open') {
                console.log('WhatsApp connected successfully!');
                isConnected = true;
                connectionState = 'connected';
                qrCode = null;
                
                io.emit('connection-update', { 
                    state: 'connected',
                    qrCode: null 
                });
                
                // Test connection
                try {
                    const me = sock.user;
                    console.log('Connected as:', me?.name || me?.id);
                } catch (error) {
                    console.log('Could not get user info:', error.message);
                }
            }
        });

        // Save credentials when they update
        sock.ev.on('creds.update', saveCreds);

        // Handle messages (optional - for logging)
        sock.ev.on('messages.upsert', (m) => {
            console.log('New message received:', m.messages.length);
        });

        // Handle errors
        sock.ev.on('connection.error', (error) => {
            console.error('Connection error:', error);
        });

    } catch (error) {
        console.error('Error initializing WhatsApp:', error);
        connectionState = 'error';
        io.emit('connection-update', { 
            state: 'error',
            error: error.message 
        });
        
        // Retry after 10 seconds
        setTimeout(() => initializeWhatsApp(), 10000);
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current status to new client
    socket.emit('connection-update', {
        state: connectionState,
        qrCode: qrCode,
        connected: isConnected
    });
    
    // Handle connection requests
    socket.on('connect-whatsapp', () => {
        console.log('Client requested WhatsApp connection');
        if (!isConnected && connectionState !== 'connecting') {
            initializeWhatsApp();
        }
    });
    
    // Handle disconnect requests
    socket.on('disconnect-whatsapp', async () => {
        console.log('Client requested WhatsApp disconnection');
        try {
            if (sock) {
                await sock.logout();
                sock = null;
                isConnected = false;
                connectionState = 'disconnected';
                qrCode = null;
                
                // Clean up session files
                if (fs.existsSync(SESSION_DIR)) {
                    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                    fs.mkdirSync(SESSION_DIR, { recursive: true });
                }
                
                io.emit('connection-update', { 
                    state: 'disconnected',
                    qrCode: null 
                });
            }
        } catch (error) {
            console.error('Error during disconnection:', error);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Cleanup on process exit
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (sock) {
        try {
            await sock.logout();
        } catch (error) {
            console.log('Error during shutdown:', error.message);
        }
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    if (sock) {
        try {
            await sock.logout();
        } catch (error) {
            console.log('Error during shutdown:', error.message);
        }
    }
    process.exit(0);
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    console.log('');
    console.log('🚀 WhatsApp Enhanced Messaging Platform');
    console.log('📱 Ready for QR code authentication');
    console.log('⚡ All systems initialized');
    console.log('');
    console.log('Next steps:');
    console.log('1. Open the web interface');
    console.log('2. Click "Connect WhatsApp"');
    console.log('3. Scan the QR code with your phone');
    console.log('4. Start sending messages!');
    console.log('');
    console.log('Ready to implement Part 2 & 3: Contact Management and Templates');
});

module.exports = { app, server, io };