// Enhanced WhatsApp Messaging Platform - Complete Frontend Implementation
// Socket.io connection and WhatsApp integration - Debug Version v2.0.5

let socket;
let contacts = [];
let groups = [];
let templates = [];
let logs = [];
let selectedRecipients = [];
let currentSendMode = 'single';
let whatsappStatus = 'disconnected';

// Debug flag
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    debugLog('DOM Content Loaded - Starting initialization');
    initializeApp();
    initializeSocket();
    loadStoredData();
    setupEventListeners();
    showSection('contacts'); // Default section
});

function initializeApp() {
    debugLog('Initializing Enhanced WhatsApp Messaging Platform...');
    
    // Load draft message if exists
    const draft = localStorage.getItem('whatsapp_message_draft');
    if (draft && document.getElementById('messageContent')) {
        document.getElementById('messageContent').value = draft;
        debugLog('Loaded draft message');
    }
    
    // Initialize UI state
    updateConnectionUI('disconnected');
    populateTemplateSelect();
    renderContacts();
    renderGroups();
    renderTemplates();
    renderLogs();
    
    debugLog('App initialization complete');
}

function initializeSocket() {
    debugLog('Attempting to connect to server via socket.io...');
    
    try {
        // Check if io is available
        if (typeof io === 'undefined') {
            debugLog('ERROR: socket.io library not loaded!');
            showNotification('Socket.io library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        debugLog('Socket.io library found, creating connection...');
        socket = io();
        
        socket.on('connect', () => {
            debugLog('✅ Connected to server successfully');
            showNotification('Connected to server', 'success');
        });
        
        socket.on('disconnect', () => {
            debugLog('❌ Disconnected from server');
            showNotification('Disconnected from server', 'warning');
            updateConnectionUI('disconnected');
        });
        
        socket.on('connection-status', (status) => {
            debugLog('📡 Connection status received:', status);
            whatsappStatus = status;
            updateConnectionUI(status);
        });
        
        socket.on('qr-code', (qrData) => {
            debugLog('📱 QR code received:', !!qrData);
            displayQRCode(qrData);
        });
        
        socket.on('connect_error', (error) => {
            debugLog('❌ Socket connection error:', error);
            showNotification('Connection error: ' + error.message, 'error');
        });
        
        // Test connection after 2 seconds
        setTimeout(() => {
            if (socket && socket.connected) {
                debugLog('Socket connection test: SUCCESS');
            } else {
                debugLog('Socket connection test: FAILED - not connected');
                showNotification('Failed to establish socket connection', 'error');
            }
        }, 2000);
        
    } catch (error) {
        debugLog('❌ Failed to initialize socket:', error);
        showNotification('Failed to connect to server: ' + error.message, 'error');
    }
}

function connectWhatsApp() {
    debugLog('🔌 Connect WhatsApp button clicked');
    
    if (!socket) {
        debugLog('ERROR: No socket connection available');
        showNotification('No server connection', 'error');
        return;
    }
    
    if (!socket.connected) {
        debugLog('ERROR: Socket not connected');
        showNotification('Socket not connected to server', 'error');
        return;
    }
    
    if (whatsappStatus === 'connected') {
        debugLog('Already connected to WhatsApp');
        showNotification('Already connected to WhatsApp', 'info');
        return;
    }
    
    debugLog('Emitting connect-whatsapp event to server');
    updateConnectionUI('connecting');
    socket.emit('connect-whatsapp');
    showNotification('Connecting to WhatsApp...', 'info');
}

function resetConnection() {
    debugLog('🔄 Reset connection button clicked');
    
    if (!socket) {
        debugLog('ERROR: No socket connection for reset');
        showNotification('No server connection', 'error');
        return;
    }
    
    debugLog('Emitting reset-connection event to server');
    socket.emit('reset-connection');
    updateConnectionUI('disconnected');
    hideQRCode();
    showNotification('Connection reset', 'info');
}

function updateConnectionUI(status) {
    debugLog('Updating connection UI to status:', status);
    
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const resetBtn = document.getElementById('resetBtn');
    const sendBtn = document.getElementById('sendBtn');
    const primarySection = document.getElementById('primarySendSection');
    
    if (!statusDot || !statusText || !connectBtn) {
        debugLog('ERROR: Missing UI elements for connection status');
        return;
    }
    
    // Remove all status classes
    statusDot.className = 'status-dot';
    
    switch(status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'WhatsApp Connected ✅';
            connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            connectBtn.disabled = true;
            connectBtn.className = 'btn';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            if (primarySection) primarySection.style.display = 'block';
            hideQRCode();
            debugLog('UI updated for connected state');
            break;
            
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Connecting to WhatsApp...';
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-warning';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = true;
            if (primarySection) primarySection.style.display = 'none';
            debugLog('UI updated for connecting state');
            break;
            
        case 'qr-ready':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Scan QR Code with WhatsApp';
            connectBtn.innerHTML = '<i class="fas fa-qrcode"></i> Scan QR Code';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-warning';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = true;
            if (primarySection) primarySection.style.display = 'none';
            debugLog('UI updated for QR ready state');
            break;
            
        case 'cooldown':
            statusText.textContent = 'Connection cooldown active - please wait';
            connectBtn.innerHTML = '<i class="fas fa-clock"></i> Cooldown Active';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = true;
            if (primarySection) primarySection.style.display = 'none';
            debugLog('UI updated for cooldown state');
            break;
            
        case 'error':
            statusText.textContent = 'Connection error - click Reset to try again';
            connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-danger';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = true;
            if (primarySection) primarySection.style.display = 'none';
            hideQRCode();
            debugLog('UI updated for error state');
            break;
            
        default: // disconnected
            statusText.textContent = 'WhatsApp Not Connected';
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect WhatsApp';
            connectBtn.disabled = false;
            connectBtn.className = 'btn btn-secondary';
            if (resetBtn) resetBtn.disabled = false;
            if (sendBtn) sendBtn.disabled = true;
            if (primarySection) primarySection.style.display = 'none';
            hideQRCode();
            debugLog('UI updated for disconnected state');
    }
}

function displayQRCode(qrData) {
    debugLog('DisplayQRCode called with data:', !!qrData);
    
    const qrSection = document.getElementById('qrSection');
    const qrImage = document.getElementById('qrImage');
    
    if (!qrSection || !qrImage) {
        debugLog('ERROR: QR section elements not found');
        return;
    }
    
    if (qrData) {
        qrImage.src = qrData;
        qrSection.style.display = 'block';
        debugLog('📱 QR Code displayed successfully');
        showNotification('QR Code generated! Scan with WhatsApp to connect.', 'success');
    } else {
        qrSection.style.display = 'none';
        debugLog('📱 QR Code hidden');
    }
}

function hideQRCode() {
    const qrSection = document.getElementById('qrSection');
    if (qrSection) {
        qrSection.style.display = 'none';
        debugLog('QR Code section hidden');
    }
}

function setupEventListeners() {
    debugLog('Setting up event listeners...');
    
    // Auto-save drafts
    let draftTimeout;
    const messageTextarea = document.getElementById('messageContent');
    if (messageTextarea) {
        messageTextarea.addEventListener('input', function() {
            clearTimeout(draftTimeout);
            draftTimeout = setTimeout(() => {
                localStorage.setItem('whatsapp_message_draft', this.value);
            }, 1000);
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (messageTextarea === document.activeElement && whatsappStatus === 'connected') {
                sendMessage();
            }
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="block"]');
            if (openModal) {
                openModal.style.display = 'none';
            }
        }
    });
    
    // Modal click outside to close
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Form submissions
    setupFormHandlers();
    
    debugLog('Event listeners setup complete');
}

function setupFormHandlers() {
    // Contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveContact();
        });
    }
    
    // Group form
    const groupForm = document.getElementById('groupForm');
    if (groupForm) {
        groupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveGroup();
        });
    }
    
    // Template form
    const templateForm = document.getElementById('templateForm');
    if (templateForm) {
        templateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveTemplate();
        });
    }
}

function loadStoredData() {
    try {
        contacts = JSON.parse(localStorage.getItem('whatsapp_contacts') || '[]');
        groups = JSON.parse(localStorage.getItem('whatsapp_groups') || '[]');
        templates = JSON.parse(localStorage.getItem('whatsapp_templates') || '[]');
        logs = JSON.parse(localStorage.getItem('whatsapp_logs') || '[]');
        selectedRecipients = JSON.parse(localStorage.getItem('whatsapp_selected_recipients') || '[]');
        debugLog('📊 Loaded stored data - contacts:', contacts.length, 'templates:', templates.length);
        
        // Update selected recipients display if any
        updateSelectedRecipientsDisplay();
    } catch (error) {
        debugLog('❌ Error loading stored data:', error);
        showNotification('Error loading stored data', 'error');
    }
}

// Send Mode Selection
function selectSendMode(mode) {
    currentSendMode = mode;
    
    const singleBtn = document.getElementById('singleModeBtn');
    const bulkBtn = document.getElementById('bulkModeBtn');
    const singleForm = document.getElementById('singleSendForm');
    const bulkForm = document.getElementById('bulkSendForm');
    
    // Update button states
    if (singleBtn) singleBtn.classList.toggle('selected', mode === 'single');
    if (bulkBtn) bulkBtn.classList.toggle('selected', mode === 'bulk');
    
    // Show/hide forms
    if (singleForm) singleForm.style.display = mode === 'single' ? 'block' : 'none';
    if (bulkForm) bulkForm.style.display = mode === 'bulk' ? 'block' : 'none';
    
    debugLog('📨 Send mode selected:', mode);
}

// Navigation
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remove active class from all nav buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to corresponding nav button
    const activeButton = Array.from(navButtons).find(btn => 
        btn.textContent.toLowerCase().includes(sectionName.toLowerCase())
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    debugLog('📑 Switched to section:', sectionName);
}

// Notification system
function showNotification(message, type = 'info') {
    debugLog('Showing notification:', message, 'type:', type);
    
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Space Mono', monospace;
        font-weight: 600;
        font-size: 14px;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set colors based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#00ff88';
            notification.style.color = '#000';
            break;
        case 'error':
            notification.style.backgroundColor = '#ff6b6b';
            notification.style.color = '#fff';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffb84d';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#555';
            notification.style.color = '#fff';
    }
    
    notification.textContent = message;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

// Placeholder functions for all the other functionality to prevent errors
function renderContacts() {
    const container = document.getElementById('contactList');
    if (container) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-address-book"></i><br>No contacts found. Add your first contact to get started.</div>';
    }
}

function renderGroups() {
    const container = document.getElementById('groupList');
    if (container) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><br>No groups found. Create your first group to organize your contacts.</div>';
    }
}

function renderTemplates() {
    const container = document.getElementById('templateList');
    if (container) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><br>No templates found. Create your first template to save time when sending messages.</div>';
    }
}

function renderLogs() {
    const container = document.getElementById('logList');
    if (container) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i><br>No message logs found. Send your first message to see logs here.</div>';
    }
}

function populateTemplateSelect() {
    const select = document.getElementById('templateSelect');
    if (select) {
        select.innerHTML = '<option value="">Select a template...</option>';
    }
}

function updateSelectedRecipientsDisplay() {
    const container = document.getElementById('selectedRecipients');
    if (container) {
        container.innerHTML = '<p><i class="fas fa-info-circle"></i> No recipients selected</p>';
    }
}

// Essential placeholder functions
function sendMessage() { 
    debugLog('sendMessage called');
    if (whatsappStatus !== 'connected') {
        showNotification('WhatsApp not connected', 'error');
        return;
    }
    showNotification('Send message functionality will be implemented', 'info');
}

function openContactModal() { 
    debugLog('openContactModal called');
    const modal = document.getElementById('contactModal');
    if (modal) modal.style.display = 'block';
}

function openGroupModal() { 
    debugLog('openGroupModal called');
    const modal = document.getElementById('groupModal');
    if (modal) modal.style.display = 'block';
}

function openTemplateModal() { 
    debugLog('openTemplateModal called');
    const modal = document.getElementById('templateModal');
    if (modal) modal.style.display = 'block';
}

function selectFromContacts() { debugLog('selectFromContacts called'); }
function selectFromGroups() { debugLog('selectFromGroups called'); }
function clearRecipients() { debugLog('clearRecipients called'); }
function loadSelectedTemplate() { debugLog('loadSelectedTemplate called'); }
function previewMessage() { debugLog('previewMessage called'); }
function searchContacts() { debugLog('searchContacts called'); }
function filterLogs() { debugLog('filterLogs called'); }
function clearLogs() { debugLog('clearLogs called'); }
function searchLogs() { debugLog('searchLogs called'); }
function loadDemoContacts() { debugLog('loadDemoContacts called'); }
function loadDemoTemplates() { debugLog('loadDemoTemplates called'); }
function importContacts() { debugLog('importContacts called'); }
function exportContacts() { debugLog('exportContacts called'); }
function saveContact() { debugLog('saveContact called'); }
function saveGroup() { debugLog('saveGroup called'); }
function saveTemplate() { debugLog('saveTemplate called'); }

function closeModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Make functions globally available
window.connectWhatsApp = connectWhatsApp;
window.resetConnection = resetConnection;
window.selectSendMode = selectSendMode;
window.showSection = showSection;
window.sendMessage = sendMessage;
window.openContactModal = openContactModal;
window.openGroupModal = openGroupModal;
window.openTemplateModal = openTemplateModal;
window.selectFromContacts = selectFromContacts;
window.selectFromGroups = selectFromGroups;
window.clearRecipients = clearRecipients;
window.loadSelectedTemplate = loadSelectedTemplate;
window.previewMessage = previewMessage;
window.searchContacts = searchContacts;
window.filterLogs = filterLogs;
window.clearLogs = clearLogs;
window.searchLogs = searchLogs;
window.loadDemoContacts = loadDemoContacts;
window.loadDemoTemplates = loadDemoTemplates;
window.importContacts = importContacts;
window.exportContacts = exportContacts;
window.closeModal = closeModal;

debugLog('Enhanced WhatsApp Messaging Platform v2.0.5 initialized with debugging');

// Global error handler
window.addEventListener('error', function(e) {
    debugLog('JavaScript Error:', e.error);
    console.error('Error details:', e);
});

console.log('✅ app.js loaded successfully - v2.0.5');
