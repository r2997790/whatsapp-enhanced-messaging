// Step 2: Core WhatsApp Connection Functions
// Minimal app.js focused on Baileys WhatsApp connection

let socket;
let whatsappStatus = 'disconnected';

console.log('📱 Step 2: Loading app.js with core WhatsApp functions...');

// Initialize socket connection
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Step 2: DOM loaded, initializing socket...');
    initializeSocket();
    updateConnectionUI('disconnected');
});

function initializeSocket() {
    console.log('🔌 Step 2: Attempting socket.io connection...');
    
    try {
        if (typeof io === 'undefined') {
            console.error('❌ socket.io library not loaded!');
            return;
        }
        
        socket = io();
        
        socket.on('connect', () => {
            console.log('✅ Socket connected to server');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected from server');
            updateConnectionUI('disconnected');
        });
        
        socket.on('connection-status', (status) => {
            console.log('📡 WhatsApp status received:', status);
            whatsappStatus = status;
            updateConnectionUI(status);
        });
        
        socket.on('qr-code', (qrData) => {
            console.log('📱 QR code received:', !!qrData);
            displayQRCode(qrData);
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize socket:', error);
    }
}

// Core WhatsApp connection function
function connectWhatsApp() {
    console.log('🔌 Step 2: Connect WhatsApp button clicked');
    
    if (!socket) {
        console.error('❌ No socket connection');
        return;
    }
    
    if (!socket.connected) {
        console.error('❌ Socket not connected to server');
        return;
    }
    
    if (whatsappStatus === 'connected') {
        console.log('ℹ️ Already connected to WhatsApp');
        return;
    }
    
    console.log('📤 Sending connect-whatsapp request to server');
    updateConnectionUI('connecting');
    socket.emit('connect-whatsapp');
}

// Reset WhatsApp connection
function resetConnection() {
    console.log('🔄 Step 2: Reset connection requested');
    
    if (!socket) {
        console.error('❌ No socket connection for reset');
        return;
    }
    
    console.log('📤 Sending reset-connection request to server');
    socket.emit('reset-connection');
    updateConnectionUI('disconnected');
    hideQRCode();
}

// Update connection UI based on status
function updateConnectionUI(status) {
    console.log('🎨 Step 2: Updating UI to status:', status);
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    
    if (!statusDot || !statusText || !connectBtn) {
        console.error('❌ Missing UI elements');
        return;
    }
    
    // Reset classes
    statusDot.className = 'status-dot';
    
    switch(status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'WhatsApp Connected ✅';
            connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            connectBtn.disabled = true;
            connectBtn.className = 'btn';
            hideQRCode();
            console.log('✅ UI updated for connected state');
            break;
            
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Connecting to WhatsApp...';
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            console.log('🔄 UI updated for connecting state');
            break;
            
        case 'qr-ready':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Scan QR Code with WhatsApp';
            connectBtn.innerHTML = '<i class="fas fa-qrcode"></i> Scan QR Code';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            console.log('📱 UI updated for QR ready state');
            break;
            
        default: // disconnected
            statusText.textContent = 'WhatsApp Not Connected';
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect WhatsApp';
            connectBtn.disabled = false;
            connectBtn.className = 'btn btn-secondary';
            hideQRCode();
            console.log('❌ UI updated for disconnected state');
    }
}

// Display QR code for WhatsApp connection
function displayQRCode(qrData) {
    console.log('📱 Step 2: DisplayQRCode called with data:', !!qrData);
    
    const qrSection = document.getElementById('qrSection');
    const qrImage = document.getElementById('qrImage');
    
    if (!qrSection || !qrImage) {
        console.error('❌ QR section elements not found');
        return;
    }
    
    if (qrData) {
        qrImage.src = qrData;
        qrSection.style.display = 'block';
        console.log('✅ QR Code displayed successfully');
    } else {
        qrSection.style.display = 'none';
        console.log('❌ QR Code hidden');
    }
}

// Hide QR code section
function hideQRCode() {
    const qrSection = document.getElementById('qrSection');
    if (qrSection) {
        qrSection.style.display = 'none';
        console.log('📱 QR Code section hidden');
    }
}

// Make functions globally available
window.connectWhatsApp = connectWhatsApp;
window.resetConnection = resetConnection;

console.log('✅ Step 2: Core WhatsApp functions loaded and ready');

// Global error handler
window.addEventListener('error', function(e) {
    console.error('🚨 JavaScript Error:', e.error);
});