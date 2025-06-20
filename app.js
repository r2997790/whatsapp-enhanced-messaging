// Enhanced WhatsApp Messaging Platform - Complete Frontend Implementation
// Socket.io connection and WhatsApp integration

let socket;
let contacts = [];
let groups = [];
let templates = [];
let logs = [];
let selectedRecipients = [];
let currentSendMode = 'single';
let whatsappStatus = 'disconnected';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeSocket();
    loadStoredData();
    setupEventListeners();
    showSection('contacts'); // Default section
});

function initializeApp() {
    console.log('Initializing Enhanced WhatsApp Messaging Platform...');
    
    // Load draft message if exists
    const draft = localStorage.getItem('whatsapp_message_draft');
    if (draft && document.getElementById('messageContent')) {
        document.getElementById('messageContent').value = draft;
    }
    
    // Initialize UI state
    updateConnectionUI('disconnected');
    populateTemplateSelect();
    renderContacts();
    renderGroups();
    renderTemplates();
    renderLogs();
}

function initializeSocket() {
    console.log('Connecting to server...');
    
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('✅ Connected to server');
            showNotification('Connected to server', 'success');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            showNotification('Disconnected from server', 'warning');
            updateConnectionUI('disconnected');
        });
        
        socket.on('connection-status', (status) => {
            console.log('📡 Connection status:', status);
            whatsappStatus = status;
            updateConnectionUI(status);
        });
        
        socket.on('qr-code', (qrData) => {
            console.log('📱 QR code received:', !!qrData);
            displayQRCode(qrData);
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            showNotification('Connection error: ' + error.message, 'error');
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize socket:', error);
        showNotification('Failed to connect to server', 'error');
    }
}

function connectWhatsApp() {
    console.log('🔌 Requesting WhatsApp connection...');
    
    if (!socket) {
        showNotification('No server connection', 'error');
        return;
    }
    
    if (whatsappStatus === 'connected') {
        showNotification('Already connected to WhatsApp', 'info');
        return;
    }
    
    updateConnectionUI('connecting');
    socket.emit('connect-whatsapp');
    showNotification('Connecting to WhatsApp...', 'info');
}

function resetConnection() {
    console.log('🔄 Resetting WhatsApp connection...');
    
    if (!socket) {
        showNotification('No server connection', 'error');
        return;
    }
    
    socket.emit('reset-connection');
    updateConnectionUI('disconnected');
    hideQRCode();
    showNotification('Connection reset', 'info');
}

function updateConnectionUI(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const resetBtn = document.getElementById('resetBtn');
    const sendBtn = document.getElementById('sendBtn');
    const primarySection = document.getElementById('primarySendSection');
    
    // Remove all status classes
    statusDot.className = 'status-dot';
    
    switch(status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'WhatsApp Connected ✅';
            connectBtn.textContent = '✅ Connected';
            connectBtn.disabled = true;
            connectBtn.className = 'btn';
            resetBtn.disabled = false;
            sendBtn.disabled = false;
            primarySection.style.display = 'block';
            hideQRCode();
            break;
            
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Connecting to WhatsApp...';
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-warning';
            resetBtn.disabled = false;
            sendBtn.disabled = true;
            primarySection.style.display = 'none';
            break;
            
        case 'qr-ready':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Scan QR Code with WhatsApp';
            connectBtn.innerHTML = '<i class="fas fa-qrcode"></i> Scan QR Code';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-warning';
            resetBtn.disabled = false;
            sendBtn.disabled = true;
            primarySection.style.display = 'none';
            break;
            
        case 'cooldown':
            statusText.textContent = 'Connection cooldown active - please wait';
            connectBtn.innerHTML = '<i class="fas fa-clock"></i> Cooldown Active';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-secondary';
            resetBtn.disabled = false;
            sendBtn.disabled = true;
            primarySection.style.display = 'none';
            break;
            
        case 'error':
            statusText.textContent = 'Connection error - click Reset to try again';
            connectBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            connectBtn.disabled = true;
            connectBtn.className = 'btn btn-danger';
            resetBtn.disabled = false;
            sendBtn.disabled = true;
            primarySection.style.display = 'none';
            hideQRCode();
            break;
            
        default: // disconnected
            statusText.textContent = 'WhatsApp Not Connected';
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect WhatsApp';
            connectBtn.disabled = false;
            connectBtn.className = 'btn btn-secondary';
            resetBtn.disabled = false;
            sendBtn.disabled = true;
            primarySection.style.display = 'none';
            hideQRCode();
    }
}

function displayQRCode(qrData) {
    const qrSection = document.getElementById('qrSection');
    const qrImage = document.getElementById('qrImage');
    
    if (qrData) {
        qrImage.src = qrData;
        qrSection.style.display = 'block';
        console.log('📱 QR Code displayed');
    } else {
        qrSection.style.display = 'none';
        console.log('📱 QR Code hidden');
    }
}

function hideQRCode() {
    const qrSection = document.getElementById('qrSection');
    qrSection.style.display = 'none';
}

function setupEventListeners() {
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
        console.log('📊 Loaded stored data');
        
        // Update selected recipients display if any
        updateSelectedRecipientsDisplay();
    } catch (error) {
        console.error('❌ Error loading stored data:', error);
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
    singleBtn.classList.toggle('selected', mode === 'single');
    bulkBtn.classList.toggle('selected', mode === 'bulk');
    
    // Show/hide forms
    singleForm.style.display = mode === 'single' ? 'block' : 'none';
    bulkForm.style.display = mode === 'bulk' ? 'block' : 'none';
    
    console.log('📨 Send mode selected:', mode);
}

// Message Sending
async function sendMessage() {
    if (whatsappStatus !== 'connected') {
        showNotification('WhatsApp not connected', 'error');
        return;
    }
    
    const messageContent = document.getElementById('messageContent').value.trim();
    if (!messageContent) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        if (currentSendMode === 'single') {
            await sendSingleMessage(messageContent);
        } else {
            await sendBulkMessage(messageContent);
        }
        
        // Clear draft after successful send
        localStorage.removeItem('whatsapp_message_draft');
        document.getElementById('messageContent').value = '';
        
    } catch (error) {
        console.error('❌ Send error:', error);
        showNotification('Failed to send message: ' + error.message, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send WhatsApp Message';
    }
}

async function sendSingleMessage(message) {
    const phoneInput = document.getElementById('singlePhone').value.trim();
    
    if (!phoneInput) {
        throw new Error('Please enter a phone number');
    }
    
    const recipient = {
        phone: phoneInput,
        firstName: '', 
        lastName: ''
    };
    
    const response = await fetch('/api/send-single', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            recipient: recipient,
            message: message,
            personalize: false
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        showNotification(`Message sent to ${result.recipient}`, 'success');
        addToLogs({
            recipient: result.recipient,
            message: result.personalizedMessage || message,
            status: 'sent',
            timestamp: new Date().toISOString()
        });
        
        // Clear phone input
        document.getElementById('singlePhone').value = '';
        
    } else {
        throw new Error(result.error || 'Unknown error occurred');
    }
}

async function sendBulkMessage(message) {
    if (selectedRecipients.length === 0) {
        throw new Error('Please select recipients');
    }
    
    const response = await fetch('/api/send-bulk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            recipients: selectedRecipients,
            message: message,
            personalize: true,
            delayBetween: 2000
        })
    });
    
    const result = await response.json();
    
    if (result.success) {
        showNotification(result.message, 'success');
        
        // Add each result to logs
        result.results.forEach(res => {
            addToLogs({
                recipient: res.recipient,
                message: res.personalizedMessage || message,
                status: res.success ? 'sent' : 'failed',
                error: res.error,
                timestamp: new Date().toISOString()
            });
        });
        
        // Clear recipients
        clearRecipients();
        
    } else {
        throw new Error(result.error || 'Unknown error occurred');
    }
}

function previewMessage() {
    const messageContent = document.getElementById('messageContent').value.trim();
    
    if (!messageContent) {
        showNotification('Please enter a message to preview', 'error');
        return;
    }
    
    let previewText = 'Message Preview:\n\n';
    
    if (currentSendMode === 'single') {
        previewText += messageContent;
    } else {
        if (selectedRecipients.length === 0) {
            previewText += messageContent + '\n\n(No recipients selected)';
        } else {
            previewText += 'Sample personalization for first recipient:\n\n';
            const firstRecipient = selectedRecipients[0];
            const personalizedMessage = personalizeMessage(messageContent, firstRecipient);
            previewText += personalizedMessage;
            previewText += `\n\n📊 Will be sent to ${selectedRecipients.length} recipients`;
        }
    }
    
    alert(previewText);
}

// Utility Functions
function personalizeMessage(content, contact) {
    return content
        .replace(/{firstName}/g, contact.firstName || contact.name || '')
        .replace(/{lastName}/g, contact.lastName || '')
        .replace(/{nickname}/g, contact.nickname || contact.firstName || contact.name || '')
        .replace(/{fullName}/g, `${contact.firstName || ''} ${contact.lastName || ''}`.trim());
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
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

// Demo Data Functions
function loadDemoContacts() {
    const demoContacts = [
        {
            id: 'demo1',
            firstName: 'John',
            lastName: 'Smith',
            nickname: 'Johnny',
            phone: '1234567890',
            email: 'john.smith@email.com',
            createdAt: new Date().toISOString()
        },
        {
            id: 'demo2',
            firstName: 'Sarah',
            lastName: 'Johnson',
            nickname: 'Sara',
            phone: '1234567891',
            email: 'sarah.j@email.com',
            createdAt: new Date().toISOString()
        },
        {
            id: 'demo3',
            firstName: 'Mike',
            lastName: 'Davis',
            nickname: 'Mikey',
            phone: '1234567892',
            email: 'mike.davis@email.com',
            createdAt: new Date().toISOString()
        }
    ];

    contacts = [...contacts, ...demoContacts];
    localStorage.setItem('whatsapp_contacts', JSON.stringify(contacts));
    renderContacts();
    showNotification('Demo contacts loaded successfully!', 'success');
}

function loadDemoTemplates() {
    const demoTemplates = [
        {
            id: 'template1',
            name: 'Welcome Message',
            content: 'Hi {firstName}! Welcome to our platform. We\'re excited to have you on board! 🎉',
            createdAt: new Date().toISOString()
        },
        {
            id: 'template2',
            name: 'Meeting Reminder',
            content: 'Hello {nickname}, just a friendly reminder about our meeting tomorrow at 2 PM. See you there! 📅',
            createdAt: new Date().toISOString()
        },
        {
            id: 'template3',
            name: 'Thank You Message',
            content: 'Thank you {firstName} for your business! We appreciate your trust in us. 🙏',
            createdAt: new Date().toISOString()
        },
        {
            id: 'template4',
            name: 'Birthday Wishes',
            content: '🎂 Happy Birthday {firstName}! Hope you have an amazing day filled with joy and celebration! 🎉🎈',
            createdAt: new Date().toISOString()
        }
    ];

    templates = [...templates, ...demoTemplates];
    localStorage.setItem('whatsapp_templates', JSON.stringify(templates));
    renderTemplates();
    populateTemplateSelect();
    showNotification('Demo templates loaded successfully!', 'success');
}

// Import/Export Functions
function importContacts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const csv = e.target.result;
                    const lines = csv.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    
                    const importedContacts = [];
                    for (let i = 1; i < lines.length; i++) {
                        if (lines[i].trim()) {
                            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                            const contact = {
                                id: Date.now().toString() + Math.random(),
                                firstName: values[0] || '',
                                lastName: values[1] || '',
                                nickname: values[2] || '',
                                phone: values[3] || '',
                                email: values[4] || '',
                                createdAt: new Date().toISOString()
                            };
                            
                            if (contact.firstName && contact.phone) {
                                importedContacts.push(contact);
                            }
                        }
                    }
                    
                    contacts = [...contacts, ...importedContacts];
                    localStorage.setItem('whatsapp_contacts', JSON.stringify(contacts));
                    renderContacts();
                    showNotification(`Imported ${importedContacts.length} contacts successfully!`, 'success');
                } catch (error) {
                    showNotification('Error importing CSV: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function exportContacts() {
    if (contacts.length === 0) {
        showNotification('No contacts to export', 'error');
        return;
    }

    const csvHeaders = ['First Name', 'Last Name', 'Nickname', 'Phone', 'Email'];
    const csvData = contacts.map(contact => [
        contact.firstName,
        contact.lastName || '',
        contact.nickname || '',
        contact.phone || '',
        contact.email || ''
    ]);

    const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-contacts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

console.log('Enhanced WhatsApp Messaging Platform initialized');
