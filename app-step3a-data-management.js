            },
            body: JSON.stringify({ name, category, content })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal('templateModal');
            loadTemplates();
            showNotification('Template added successfully!', 'success');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Error saving template', 'error');
    }
}

function useTemplate(templateId) {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    // Fill the message content in the main messaging interface
    const messageContent = document.getElementById('messageContent');
    const templateSelect = document.getElementById('templateSelect');
    
    if (messageContent) {
        messageContent.value = template.content;
    }
    
    if (templateSelect) {
        templateSelect.value = templateId;
    }
    
    // Clear current section to show messaging interface
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));
    
    showNotification('Template loaded into message editor!', 'success');
}

function updateTemplateSelect() {
    const templateSelect = document.getElementById('templateSelect');
    if (!templateSelect) return;
    
    // Clear existing options except the first one
    templateSelect.innerHTML = '<option value="">Select a template...</option>';
    
    // Add templates
    allTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        templateSelect.appendChild(option);
    });
}

function loadSelectedTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    const messageContent = document.getElementById('messageContent');
    
    if (!templateSelect || !messageContent) return;
    
    const templateId = parseInt(templateSelect.value);
    if (!templateId) {
        return;
    }
    
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
        messageContent.value = template.content;
    }
}

// ===== MESSAGE LOGS MANAGEMENT =====

async function loadMessageLogs() {
    try {
        const response = await fetch('/api/message-logs?limit=50');
        const result = await response.json();
        
        if (result.success) {
            allMessageLogs = result.data;
            renderMessageLogs(allMessageLogs);
        } else {
            console.error('Failed to load message logs:', result.message);
        }
    } catch (error) {
        console.error('Error loading message logs:', error);
    }
}

function renderMessageLogs(logs) {
    const logsSection = document.getElementById('logs');
    
    let html = `
        <h2><i class="fas fa-chart-line"></i> Message Logs & Analytics</h2>
        <div style="margin-bottom: 20px;">
            <button class="btn btn-secondary" onclick="loadMessageLogs()">
                <i class="fas fa-sync"></i> Refresh
            </button>
        </div>
    `;
    
    if (logs.length === 0) {
        html += `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i><br>
                No message logs found. Send your first message to see logs here.
            </div>
        `;
    } else {
        html += '<div style="max-height: 600px; overflow-y: auto;">';
        
        logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const statusClass = log.status === 'sent' ? 'status-sent' : 'status-failed';
            const recipients = log.recipients || [];
            const recipientCount = recipients.length;
            
            html += `
                <div class="contact-card" style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <span class="status-badge ${statusClass}">${log.status.toUpperCase()}</span>
                            <span style="color: #999; font-size: 12px; margin-left: 10px;">${timestamp}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="color: #00ff88; font-size: 12px;">
                                ${log.type === 'bulk' ? `Bulk (${recipientCount} recipients)` : 'Single'}
                            </span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 10px;">
                        <strong>Recipients:</strong><br>
                        ${recipients.map(r => `<span class="recipient-tag">${r.name || r.phone}</span>`).join(' ')}
                    </div>
                    
                    <div style="background: #0a0a0a; padding: 10px; border-radius: 5px; margin: 10px 0; font-size: 12px; max-height: 100px; overflow-y: auto;">
                        ${log.message}
                    </div>
                    
                    ${log.error ? `<div style="color: #ff6b6b; font-size: 12px;"><strong>Error:</strong> ${log.error}</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    logsSection.innerHTML = html;
}

// ===== ENHANCED MESSAGING FUNCTIONS =====

function selectSendMode(mode) {
    currentSendMode = mode;
    
    // Update UI
    const singleBtn = document.getElementById('singleModeBtn');
    const bulkBtn = document.getElementById('bulkModeBtn');
    const singleForm = document.getElementById('singleSendForm');
    const bulkForm = document.getElementById('bulkSendForm');
    
    if (mode === 'single') {
        singleBtn.classList.add('selected');
        bulkBtn.classList.remove('selected');
        singleForm.style.display = 'block';
        bulkForm.style.display = 'none';
    } else {
        bulkBtn.classList.add('selected');
        singleBtn.classList.remove('selected');
        singleForm.style.display = 'none';
        bulkForm.style.display = 'block';
    }
}

function selectFromContacts() {
    if (allContacts.length === 0) {
        showNotification('No contacts available. Add contacts first.', 'error');
        return;
    }
    
    let modalHtml = `
        <div class="modal" id="selectContactsModal" style="display: block;">
            <div class="modal-content">
                <span class="close" onclick="closeModal('selectContactsModal')">&times;</span>
                <h3>Select Contacts</h3>
                <div class="checkbox-group" id="contactsCheckboxGroup">
    `;
    
    allContacts.forEach(contact => {
        modalHtml += `
            <div class="checkbox-item">
                <input type="checkbox" id="contact_${contact.id}" value="${contact.id}">
                <label for="contact_${contact.id}">${contact.name} (${contact.phone})</label>
            </div>
        `;
    });
    
    modalHtml += `
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" onclick="addSelectedContacts()">
                        <i class="fas fa-check"></i> Add Selected
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal('selectContactsModal')">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function addSelectedContacts() {
    const checkedBoxes = document.querySelectorAll('#contactsCheckboxGroup input[type="checkbox"]:checked');
    
    checkedBoxes.forEach(checkbox => {
        const contactId = parseInt(checkbox.value);
        const contact = allContacts.find(c => c.id === contactId);
        
        if (contact && !selectedContacts.find(c => c.id === contactId)) {
            selectedContacts.push(contact);
        }
    });
    
    updateSelectedRecipientsDisplay();
    closeModal('selectContactsModal');
    
    if (checkedBoxes.length > 0) {
        showNotification(`${checkedBoxes.length} contacts added to recipients`, 'success');
    }
}

function updateSelectedRecipientsDisplay() {
    const selectedRecipientsDiv = document.getElementById('selectedRecipients');
    if (!selectedRecipientsDiv) return;
    
    if (selectedContacts.length === 0) {
        selectedRecipientsDiv.innerHTML = '<p><i class="fas fa-info-circle"></i> No recipients selected</p>';
        return;
    }
    
    let html = `<p><strong>${selectedContacts.length} recipients selected:</strong></p>`;
    
    selectedContacts.forEach(contact => {
        html += `<span class="recipient-tag">${contact.name} <span onclick="removeContact(${contact.id})" style="cursor: pointer; margin-left: 5px;">×</span></span>`;
    });
    
    selectedRecipientsDiv.innerHTML = html;
}

function removeContact(contactId) {
    selectedContacts = selectedContacts.filter(c => c.id !== contactId);
    updateSelectedRecipientsDisplay();
}

function clearRecipients() {
    selectedContacts = [];
    updateSelectedRecipientsDisplay();
    showNotification('Recipients cleared', 'success');
}

async function sendMessage() {
    const messageContent = document.getElementById('messageContent').value.trim();
    const templateSelect = document.getElementById('templateSelect');
    const templateId = templateSelect ? parseInt(templateSelect.value) || null : null;
    
    if (!messageContent) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        if (currentSendMode === 'single') {
            const phone = document.getElementById('singlePhone').value.trim();
            if (!phone) {
                showNotification('Please enter a phone number', 'error');
                return;
            }
            
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phone,
                    message: messageContent,
                    templateId: templateId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Message sent successfully!', 'success');
                document.getElementById('singlePhone').value = '';
                document.getElementById('messageContent').value = '';
                if (templateSelect) templateSelect.value = '';
            } else {
                showNotification(result.message, 'error');
            }
            
        } else {
            // Bulk messaging
            if (selectedContacts.length === 0) {
                showNotification('Please select recipients', 'error');
                return;
            }
            
            const recipients = selectedContacts.map(contact => ({
                name: contact.name,
                phone: contact.phone,
                email: contact.email
            }));
            
            const response = await fetch('/api/send-bulk-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: recipients,
                    message: messageContent,
                    templateId: templateId,
                    delay: 2000
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const { total, successful, failed } = result.data.summary;
                showNotification(`Bulk messaging completed! Sent: ${successful}/${total}, Failed: ${failed}`, 'success');
                
                // Clear form
                clearRecipients();
                document.getElementById('messageContent').value = '';
                if (templateSelect) templateSelect.value = '';
            } else {
                showNotification(result.message, 'error');
            }
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error sending message', 'error');
    }
}

function previewMessage() {
    const messageContent = document.getElementById('messageContent').value.trim();
    
    if (!messageContent) {
        showNotification('Please enter a message first', 'error');
        return;
    }
    
    let previewContent = messageContent;
    
    // If we have contacts selected and template variables, show personalized preview
    if (currentSendMode === 'bulk' && selectedContacts.length > 0) {
        const sampleContact = selectedContacts[0];
        const nameParts = sampleContact.name.split(' ');
        
        previewContent = messageContent
            .replace(/\{firstName\}/g, nameParts[0] || '')
            .replace(/\{lastName\}/g, nameParts.slice(1).join(' ') || '')
            .replace(/\{name\}/g, sampleContact.name)
            .replace(/\{phone\}/g, sampleContact.phone)
            .replace(/\{email\}/g, sampleContact.email || '');
    }
    
    const modalHtml = `
        <div class="modal" id="previewModal" style="display: block;">
            <div class="modal-content">
                <span class="close" onclick="closeModal('previewModal')">&times;</span>
                <h3>Message Preview</h3>
                ${currentSendMode === 'bulk' && selectedContacts.length > 0 ? 
                    `<p><small>Preview with sample data from: ${selectedContacts[0].name}</small></p>` : ''}
                <div style="background: #0a0a0a; padding: 15px; border-radius: 5px; border: 1px solid #333; white-space: pre-wrap; font-family: 'Space Mono', monospace;">
                    ${previewContent}
                </div>
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="closeModal('previewModal')">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ===== UTILITY FUNCTIONS =====

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 400px;
        font-family: 'Space Mono', monospace;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#00ff88';
            notification.style.color = '#000';
            break;
        case 'error':
            notification.style.backgroundColor = '#ff6b6b';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffb84d';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#555';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// ===== INITIALIZATION =====

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Step 3A: Enhanced WhatsApp Messaging Platform Initializing...');
    
    // Initialize socket connection
    initializeSocket();
    
    // Load initial data
    loadContacts();
    loadTemplates();
    
    // Set default send mode
    selectSendMode('single');
    
    // Show contacts section by default
    showSection('contacts');
    
    console.log('✅ Step 3A: Application initialized with data management features');
});