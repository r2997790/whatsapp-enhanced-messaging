// Step 3A: Data Management System - Enhanced WhatsApp Server with CRUD APIs
// MAINTAINS: All existing authentication and messaging functionality
// ADDS: Contacts, Groups, Templates, and Message Logs management

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

console.log('🚀 Step 3A: Starting Data Management System - WhatsApp Server v3A.0');

// ===== STEP 3A: DATA STORAGE SYSTEM =====

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Step 3A: Created data directory:', dataDir);
}

// Data file paths
const contactsFile = path.join(dataDir, 'contacts.json');
const groupsFile = path.join(dataDir, 'groups.json');
const templatesFile = path.join(dataDir, 'templates.json');
const messageLogsFile = path.join(dataDir, 'message-logs.json');

// Initialize data files with default structure
function initializeDataFiles() {
    const defaultData = {
        contacts: {
            lastId: 0,
            items: []
        },
        groups: {
            lastId: 0,
            items: []
        },
        templates: {
            lastId: 2,
            items: [
                {
                    id: 1,
                    name: "Welcome Message",
                    category: "marketing",
                    content: "Hi {firstName}! Welcome to our service. We're excited to have you on board! 🎉",
                    variables: ["firstName"],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 2,
                    name: "Order Confirmation",
                    category: "notifications",
                    content: "Hello {firstName}, your order #{orderNumber} has been confirmed and will be delivered to {address}. Thank you for your business! 📦",
                    variables: ["firstName", "orderNumber", "address"],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]
        },
        messageLogs: {
            lastId: 0,
            items: []
        }
    };

    // Initialize contacts.json
    if (!fs.existsSync(contactsFile)) {
        fs.writeFileSync(contactsFile, JSON.stringify(defaultData.contacts, null, 2));
        console.log('📋 Step 3A: Initialized contacts.json');
    }

    // Initialize groups.json
    if (!fs.existsSync(groupsFile)) {
        fs.writeFileSync(groupsFile, JSON.stringify(defaultData.groups, null, 2));
        console.log('👥 Step 3A: Initialized groups.json');
    }

    // Initialize templates.json with sample templates
    if (!fs.existsSync(templatesFile)) {
        fs.writeFileSync(templatesFile, JSON.stringify(defaultData.templates, null, 2));
        console.log('📝 Step 3A: Initialized templates.json with sample templates');
    }

    // Initialize message-logs.json
    if (!fs.existsSync(messageLogsFile)) {
        fs.writeFileSync(messageLogsFile, JSON.stringify(defaultData.messageLogs, null, 2));
        console.log('📊 Step 3A: Initialized message-logs.json');
    }
}

// Data helper functions
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading JSON file:', filePath, error);
        return { lastId: 0, items: [] };
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing JSON file:', filePath, error);
        return false;
    }
}

// Initialize data files on startup
initializeDataFiles();

// ===== EXISTING WHATSAPP FUNCTIONALITY (PRESERVED) =====

// CRITICAL: Explicit app.js route FIRST
app.get('/app.js', (req, res) => {
    const appJsPath = path.join(__dirname, 'app-step3a-data-management.js');
    console.log('📄 Step 3A: Serving app-step3a-data-management.js from:', appJsPath);
    
    if (fs.existsSync(appJsPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(appJsPath);
        console.log('✅ app-step3a-data-management.js served successfully');
    } else {
        console.error('❌ app-step3a-data-management.js not found');
        res.status(404).send('app-step3a-data-management.js not found');
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

// CRITICAL WhatsApp State Management (PRESERVED)
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
    console.log('📁 Step 3A: Created auth directory:', authDir);
}

// CRITICAL: Logger configuration that works (PRESERVED)
const logger = {
    level: 'error',
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: () => logger
};

// [Continue with rest of file - this is just the first part due to length limits]