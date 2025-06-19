            <p><i class="fas fa-comment"></i> <strong>Message:</strong> ${log.message}</p>
            ${log.error ? `<p style="color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> <strong>Error:</strong> ${log.error}</p>` : ''}
        </div>
    `).join('');
}

function searchLogs() {
    renderLogs();
}

function filterLogs(status) {
    const filteredLogs = status === 'all' ? logs : logs.filter(log => log.status === status);
    
    const container = document.getElementById('logList');
    
    if (filteredLogs.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-${status === 'sent' ? 'check' : status === 'failed' ? 'times' : 'list'}"></i><br>No ${status} messages found.</div>`;
        return;
    }
    
    container.innerHTML = filteredLogs.map(log => `
        <div class="contact-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4><i class="fas fa-user"></i> ${log.recipient}</h4>
                <span class="status-badge status-${log.status}">
                    <i class="fas fa-${log.status === 'sent' ? 'check' : 'times'}"></i> ${log.status.toUpperCase()}
                </span>
            </div>
            <p><i class="fas fa-clock"></i> <strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</p>
            <p><i class="fas fa-comment"></i> <strong>Message:</strong> ${log.message}</p>
            ${log.error ? `<p style="color: #ff6b6b;"><i class="fas fa-exclamation-triangle"></i> <strong>Error:</strong> ${log.error}</p>` : ''}
        </div>
    `).join('');
}

function clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
        logs = [];
        localStorage.setItem('whatsapp_logs', JSON.stringify(logs));
        renderLogs();
        showNotification('Logs cleared successfully', 'success');
    }
}

function addToLogs(logEntry) {
    logs.unshift({
        id: Date.now().toString(),
        ...logEntry
    });
    localStorage.setItem('whatsapp_logs', JSON.stringify(logs));
    renderLogs();
}

// Demo data functions
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

// Import/Export functions
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

// Modal functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

// Click outside modal to close
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Notification system
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

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const messageTextarea = document.getElementById('messageContent');
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

// Auto-save drafts
let draftTimeout;
document.getElementById('messageContent')?.addEventListener('input', function() {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
        localStorage.setItem('whatsapp_message_draft', this.value);
    }, 1000);
});

// Load draft on page load
document.addEventListener('DOMContentLoaded', function() {
    const draft = localStorage.getItem('whatsapp_message_draft');
    if (draft && document.getElementById('messageContent')) {
        document.getElementById('messageContent').value = draft;
    }
});

// Clear draft when message is sent
function clearDraft() {
    localStorage.removeItem('whatsapp_message_draft');
}

// Add to existing sendSingleMessage and sendBulkMessage functions
// (Add clearDraft() call after successful sends)

console.log('Enhanced WhatsApp Messaging Platform initialized');
