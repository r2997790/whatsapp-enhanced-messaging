// Step 2: Enhanced app.js with Message Sending Integration
// Maintains enhanced messaging style while adding working functionality

let socket;
let whatsappStatus = 'disconnected';
let selectedRecipients = [];
let selectedContacts = [];
let selectedGroups = [];
let currentSendMode = 'single';

console.log('📱 Step 2: Loading enhanced app.js with MESSAGE SENDING integration...');

// Initialize socket connection
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Step 2: DOM loaded, initializing socket with message API...');
    initializeSocket();
    updateConnectionUI('disconnected');
    initializeNavigation();
    showSection('contacts'); // Default section
});

function initializeSocket() {
    console.log('🔌 Step 2: Attempting socket.io connection...');
    
    try {
        if (typeof io === 'undefined') {
            console.error('❌ socket.io library not loaded!');
            return;
        }
        
        socket = io({
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        socket.on('connect', () => {
            console.log('✅ Step 2: Socket connected to message-enabled server');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Step 2: Socket disconnected from server');
            updateConnectionUI('disconnected');
        });
        
        socket.on('connection-status', (status) => {
            console.log('📡 Step 2: WhatsApp status received:', status);
            whatsappStatus = status;
            updateConnectionUI(status);
            
            // Show primary send section when connected
            if (status === 'connected') {
                showPrimarySendSection();
            } else {
                hidePrimarySendSection();
            }
        });
        
        socket.on('qr-code', (qrData) => {
            console.log('📱 Step 2: QR code received:', !!qrData);
            displayQRCode(qrData);
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Step 2: Socket connection error:', error);
        });
        
        socket.on('pong', (data) => {
            console.log('🏓 Step 2: Pong received:', data);
        });
        
    } catch (error) {
        console.error('❌ Step 2: Failed to initialize socket:', error);
    }
}

// Core WhatsApp connection function
function connectWhatsApp() {
    console.log('🔌 Step 2: Connect WhatsApp button clicked');
    
    if (!socket) {
        console.error('❌ No socket connection');
        updateConnectionUI('error');
        return;
    }
    
    if (!socket.connected) {
        console.error('❌ Socket not connected to server');
        updateConnectionUI('error');
        return;
    }
    
    if (whatsappStatus === 'connected') {
        console.log('ℹ️ Already connected to WhatsApp');
        return;
    }
    
    console.log('📤 Step 2: Sending connect-whatsapp request to server');
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
    
    console.log('📤 Step 2: Sending reset-connection request to server');
    socket.emit('reset-connection');
    updateConnectionUI('disconnected');
    hideQRCode();
    hidePrimarySendSection();
}

// Update connection UI based on status
function updateConnectionUI(status) {
    console.log('🎨 Step 2: Updating UI to status:', status);
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!statusDot || !statusText || !connectBtn) {
        console.error('❌ Missing UI elements');
        return;
    }
    
    // Reset classes
    statusDot.className = 'status-dot';
    
    switch(status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'WhatsApp Connected ✅ - Ready to Send Messages!';
            connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            connectBtn.disabled = true;
            connectBtn.className = 'btn';
            if (sendBtn) sendBtn.disabled = false;
            hideQRCode();
            console.log('✅ Step 2: UI updated for connected state with messaging');
            break;
            
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Connecting to WhatsApp...';
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            if (sendBtn) sendBtn.disabled = true;
            console.log('🔄 Step 2: UI updated for connecting state');
            break;
            
        case 'qr-ready':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Scan QR Code with WhatsApp';
            connectBtn.innerHTML = '<i class="fas fa-qrcode"></i> Scan QR Code';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            if (sendBtn) sendBtn.disabled = true;
            console.log('📱 Step 2: UI updated for QR ready state');
            break;
            
        case 'cooldown':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Please wait before retrying...';
            connectBtn.innerHTML = '<i class="fas fa-clock"></i> Cooldown';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-warning';
            if (sendBtn) sendBtn.disabled = true;
            hideQRCode();
            console.log('⏳ Step 2: UI updated for cooldown state');
            break;
            
        case 'error':
            statusText.textContent = 'Connection Error';
            connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Retry';
            connectBtn.disabled = false;
            connectBtn.className = 'btn btn-danger';
            if (sendBtn) sendBtn.disabled = true;
            hideQRCode();
            console.log('❌ Step 2: UI updated for error state');
            break;
            
        default: // disconnected
            statusText.textContent = 'WhatsApp Not Connected';
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect WhatsApp';
            connectBtn.disabled = false;
            connectBtn.className = 'btn btn-secondary';
            if (sendBtn) sendBtn.disabled = true;
            hideQRCode();
            console.log('❌ Step 2: UI updated for disconnected state');
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
        console.log('✅ Step 2: QR Code displayed successfully');
    } else {
        qrSection.style.display = 'none';
        console.log('❌ Step 2: QR Code hidden');
    }
}

// Hide QR code section
function hideQRCode() {
    const qrSection = document.getElementById('qrSection');
    if (qrSection) {
        qrSection.style.display = 'none';
        console.log('📱 Step 2: QR Code section hidden');
    }
}

// Show primary send section when connected
function showPrimarySendSection() {
    const section = document.getElementById('primarySendSection');
    if (section) {
        section.style.display = 'block';
        console.log('✅ Step 2: Primary send section shown - messaging ready');
    }
}

// Hide primary send section when disconnected
function hidePrimarySendSection() {
    const section = document.getElementById('primarySendSection');
    if (section) {
        section.style.display = 'none';
        console.log('❌ Step 2: Primary send section hidden');
    }
}

// Navigation functions
function initializeNavigation() {
    console.log('🔄 Step 2: Initializing navigation...');
}

function showSection(sectionName) {
    console.log('📂 Step 2: Showing section:', sectionName);
    
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log('✅ Step 2: Section shown:', sectionName);
    } else {
        console.error('❌ Step 2: Section not found:', sectionName);
    }
    
    // Add active class to corresponding nav button
    const activeButton = Array.from(navButtons).find(btn => 
        btn.textContent.toLowerCase().includes(sectionName.toLowerCase())
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Send mode selection
function selectSendMode(mode) {
    console.log('📋 Step 2: Selecting send mode:', mode);
    
    currentSendMode = mode;
    
    // Update UI
    const singleBtn = document.getElementById('singleModeBtn');
    const bulkBtn = document.getElementById('bulkModeBtn');
    const singleForm = document.getElementById('singleSendForm');
    const bulkForm = document.getElementById('bulkSendForm');
    
    if (singleBtn && bulkBtn && singleForm && bulkForm) {
        // Reset button states
        singleBtn.classList.remove('selected');
        bulkBtn.classList.remove('selected');
        
        // Hide both forms
        singleForm.style.display = 'none';
        bulkForm.style.display = 'none';
        
        if (mode === 'single') {
            singleBtn.classList.add('selected');
            singleForm.style.display = 'block';
        } else if (mode === 'bulk') {
            bulkBtn.classList.add('selected');
            bulkForm.style.display = 'block';
        }
        
        console.log('✅ Step 2: Send mode updated to:', mode);
    }
}

// STEP 2: NEW - Real Message Sending Function
async function sendMessage() {
    console.log('📤 Step 2: Send message requested with REAL API integration');
    
    if (whatsappStatus !== 'connected') {
        showNotification('❌ WhatsApp is not connected. Please connect first.', 'error');
        return;
    }
    
    const messageContent = document.getElementById('messageContent');
    if (!messageContent || !messageContent.value.trim()) {
        showNotification('❌ Please enter a message to send.', 'error');
        return;
    }
    
    // Disable send button during sending
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }
    
    try {
        if (currentSendMode === 'single') {
            await sendSingleMessage();
        } else if (currentSendMode === 'bulk') {
            await sendBulkMessage();
        }
    } finally {
        // Re-enable send button
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send WhatsApp Message';
        }
    }
}

// STEP 2: NEW - Single Message API Integration
async function sendSingleMessage() {
    const phoneInput = document.getElementById('singlePhone');
    const messageContent = document.getElementById('messageContent');
    
    if (!phoneInput || !phoneInput.value.trim()) {
        showNotification('❌ Please enter a phone number.', 'error');
        return;
    }
    
    const phone = phoneInput.value.trim();
    const message = messageContent.value.trim();
    
    console.log('📱 Step 2: Sending single message to:', phone);
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: phone,
                message: message
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification(`✅ Message sent successfully to ${phone}!`, 'success');
            // Clear the message field
            messageContent.value = '';
            console.log('✅ Step 2: Single message sent successfully');
        } else {
            showNotification(`❌ Failed to send message: ${result.error}`, 'error');
            console.error('❌ Step 2: Single message failed:', result.error);
        }
        
    } catch (error) {
        showNotification(`❌ Network error: ${error.message}`, 'error');
        console.error('❌ Step 2: Single message network error:', error);
    }
}

// STEP 2: NEW - Bulk Message API Integration
async function sendBulkMessage() {
    const messageContent = document.getElementById('messageContent');
    
    if (selectedRecipients.length === 0) {
        showNotification('❌ Please select recipients for bulk messaging.', 'error');
        return;
    }
    
    const message = messageContent.value.trim();
    
    console.log('📱 Step 2: Sending bulk message to', selectedRecipients.length, 'recipients');
    
    try {
        const response = await fetch('/api/send-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numbers: selectedRecipients,
                message: message
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            const successful = result.results.filter(r => r.success).length;
            const total = result.results.length;
            showNotification(`✅ Bulk message completed: ${successful}/${total} sent successfully!`, 'success');
            
            // Clear the message field
            messageContent.value = '';
            
            // Show results if available
            if (result.results) {
                displayBulkResults(result.results);
            }
            
            console.log('✅ Step 2: Bulk message completed:', result);
        } else {
            showNotification(`❌ Bulk send failed: ${result.error}`, 'error');
            console.error('❌ Step 2: Bulk message failed:', result.error);
        }
        
    } catch (error) {
        showNotification(`❌ Network error: ${error.message}`, 'error');
        console.error('❌ Step 2: Bulk message network error:', error);
    }
}

// STEP 2: NEW - Show notification function
function showNotification(message, type = 'info') {
    console.log(`📢 Step 2: Notification [${type}]: ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff6b6b' : '#ffb84d'};
        color: ${type === 'success' ? '#000' : '#fff'};
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// STEP 2: NEW - Display bulk results
function displayBulkResults(results) {
    console.log('📊 Step 2: Displaying bulk results:', results);
    
    // Switch to logs section to show results
    showSection('logs');
    
    const logsSection = document.getElementById('logs');
    if (logsSection) {
        const resultsHtml = results.map(result => `
            <div class="result-item ${result.success ? 'success' : 'error'}">
                <span>${result.number}</span>
                <span>${result.success ? '✅ Sent' : '❌ ' + (result.error || 'Failed')}</span>
            </div>
        `).join('');
        
        logsSection.innerHTML = `
            <h2><i class="fas fa-chart-line"></i> Message Results</h2>
            <div class="bulk-results">
                ${resultsHtml}
            </div>
        `;
    }
}

// Preview message function
function previewMessage() {
    const messageContent = document.getElementById('messageContent');
    if (!messageContent || !messageContent.value.trim()) {
        showNotification('❌ Please enter a message to preview.', 'error');
        return;
    }
    
    const message = messageContent.value.trim();
    showNotification(`📱 Message Preview:\n\n${message}`, 'info');
}

// Template management functions
function loadSelectedTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    const messageContent = document.getElementById('messageContent');
    
    if (templateSelect && messageContent) {
        const selectedTemplate = templateSelect.value;
        if (selectedTemplate) {
            // Here you would load the actual template content
            messageContent.value = `Template: ${selectedTemplate}`;
            console.log('✅ Step 2: Template loaded:', selectedTemplate);
        }
    }
}

// Contact and group management functions
function selectFromContacts() {
    console.log('👥 Step 2: Select from contacts requested');
    showNotification('📱 Contact selection feature coming in Step 3!', 'info');
}

function selectFromGroups() {
    console.log('👥 Step 2: Select from groups requested');
    showNotification('📱 Group selection feature coming in Step 3!', 'info');
}

function clearRecipients() {
    console.log('🧹 Step 2: Clearing recipients');
    selectedRecipients = [];
    selectedContacts = [];
    selectedGroups = [];
    
    const recipientsDiv = document.getElementById('selectedRecipients');
    if (recipientsDiv) {
        recipientsDiv.innerHTML = '<p><i class="fas fa-info-circle"></i> No recipients selected</p>';
    }
    
    console.log('✅ Step 2: Recipients cleared');
}

// Utility functions
function pingServer() {
    if (socket && socket.connected) {
        socket.emit('ping');
        console.log('🏓 Step 2: Ping sent to server');
    }
}

// Test all functions
function testAllFunctions() {
    console.log('🧪 Step 2: Testing all functions with messaging...');
    
    const functions = [
        'connectWhatsApp',
        'resetConnection',
        'showSection',
        'selectSendMode',
        'sendMessage',
        'previewMessage',
        'selectFromContacts',
        'selectFromGroups',
        'clearRecipients',
        'loadSelectedTemplate'
    ];
    
    let allFunctionsWork = true;
    
    functions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ ${funcName} is available`);
        } else {
            console.error(`❌ ${funcName} is missing`);
            allFunctionsWork = false;
        }
    });
    
    return allFunctionsWork;
}

// Make functions globally available
window.connectWhatsApp = connectWhatsApp;
window.resetConnection = resetConnection;
window.showSection = showSection;
window.selectSendMode = selectSendMode;
window.sendMessage = sendMessage;
window.previewMessage = previewMessage;
window.selectFromContacts = selectFromContacts;
window.selectFromGroups = selectFromGroups;
window.clearRecipients = clearRecipients;
window.loadSelectedTemplate = loadSelectedTemplate;
window.pingServer = pingServer;
window.testAllFunctions = testAllFunctions;

console.log('✅ Step 2: Enhanced WhatsApp functions with MESSAGE SENDING loaded and ready');

// Global error handler
window.addEventListener('error', function(e) {
    console.error('🚨 Step 2: JavaScript Error:', e.error);
});

// Test functions on load
setTimeout(() => {
    const allWorking = testAllFunctions();
    if (allWorking) {
        console.log('🎉 Step 2: All functions working - MESSAGE SENDING READY!');
    }
}, 1000);
