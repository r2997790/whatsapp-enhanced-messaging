// MESSAGE LOGS API  
app.get('/api/message-logs', (req, res) => {
    try {
        const logs = readJsonFile(messageLogsFile);
        const { limit = 50, offset = 0 } = req.query;
        
        const paginatedLogs = logs.items.slice(offset, offset + limit);
        
        res.json({
            success: true,
            data: paginatedLogs,
            total: logs.items.length,
            hasMore: offset + limit < logs.items.length
        });
    } catch (error) {
        console.error('Error fetching message logs:', error);
        res.status(500).json({ success: false, message: 'Error fetching message logs' });
    }
});

// ENHANCED MESSAGE SENDING
async function sendWhatsAppMessage(recipient, message, templateId = null, contactData = null) {
    if (!sock || connectionStatus !== 'connected') {
        throw new Error('WhatsApp not connected');
    }
    
    try {
        let formattedRecipient = recipient;
        if (!recipient.includes('@')) {
            if (recipient.includes('g.us')) {
                formattedRecipient = recipient;
            } else {
                formattedRecipient = `${recipient}@s.whatsapp.net`;
            }
        }
        
        let finalMessage = message;
        if (contactData && templateId) {
            const nameParts = contactData.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            finalMessage = message
                .replace(/\{firstName\}/g, firstName)
                .replace(/\{lastName\}/g, lastName)
                .replace(/\{name\}/g, contactData.name)
                .replace(/\{phone\}/g, contactData.phone)
                .replace(/\{email\}/g, contactData.email || '');
        }
        
        console.log(`📤 Step 3A: Sending message to ${formattedRecipient}`);
        
        const result = await sock.sendMessage(formattedRecipient, { 
            text: finalMessage 
        });
        
        const logData = {
            status: 'sent',
            recipient: formattedRecipient,
            recipients: contactData ? [{ 
                name: contactData.name, 
                phone: contactData.phone 
            }] : [{ phone: formattedRecipient }],
            message: finalMessage,
            templateId: templateId,
            messageId: result.key?.id,
            type: 'single'
        };
        
        logMessage(logData);
        
        console.log('✅ Step 3A: Message sent successfully');
        return { success: true, messageId: result.key?.id };
        
    } catch (error) {
        console.error('❌ Step 3A: Message send error:', error);
        
        const logData = {
            status: 'failed',
            recipient: recipient,
            recipients: contactData ? [{ 
                name: contactData.name, 
                phone: contactData.phone 
            }] : [{ phone: recipient }],
            message: message,
            templateId: templateId,
            error: error.message,
            type: 'single'
        };
        
        logMessage(logData);
        
        throw error;
    }
}

// MESSAGE SENDING ENDPOINTS
app.post('/api/send-message', async (req, res) => {
    try {
        const { phone, message, templateId, contactId } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone and message are required' 
            });
        }
        
        let contactData = null;
        if (contactId) {
            const contacts = readJsonFile(contactsFile);
            contactData = contacts.items.find(c => c.id === parseInt(contactId));
        }
        
        const result = await sendWhatsAppMessage(phone, message, templateId, contactData);
        
        res.json({
            success: true,
            message: 'Message sent successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error sending message' 
        });
    }
});

app.post('/api/send-bulk-message', async (req, res) => {
    try {
        const { recipients, message, templateId, delay = 2000 } = req.body;
        
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Recipients array is required' 
            });
        }
        
        if (!message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message is required' 
            });
        }
        
        const results = [];
        const successfulRecipients = [];
        const failedRecipients = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            try {
                let personalizedMessage = message;
                if (templateId && recipient.name) {
                    const nameParts = recipient.name.split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    personalizedMessage = message
                        .replace(/\{firstName\}/g, firstName)
                        .replace(/\{lastName\}/g, lastName)
                        .replace(/\{name\}/g, recipient.name)
                        .replace(/\{phone\}/g, recipient.phone)
                        .replace(/\{email\}/g, recipient.email || '');
                }
                
                let formattedPhone = recipient.phone;
                if (!formattedPhone.includes('@')) {
                    if (formattedPhone.includes('g.us')) {
                        formattedPhone = formattedPhone;
                    } else {
                        formattedPhone = `${formattedPhone}@s.whatsapp.net`;
                    }
                }
                
                console.log(`📤 Step 3A: Sending bulk message ${i + 1}/${recipients.length} to ${recipient.name || formattedPhone}`);
                
                const result = await sock.sendMessage(formattedPhone, { 
                    text: personalizedMessage 
                });
                
                results.push({
                    recipient: recipient,
                    success: true,
                    messageId: result.key?.id
                });
                
                successfulRecipients.push({
                    name: recipient.name || '',
                    phone: recipient.phone
                });
                
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
            } catch (error) {
                console.error(`❌ Step 3A: Bulk message ${i + 1}/${recipients.length} failed:`, error);
                
                results.push({
                    recipient: recipient,
                    success: false,
                    error: error.message
                });
                
                failedRecipients.push({
                    name: recipient.name || '',
                    phone: recipient.phone,
                    error: error.message
                });
            }
        }
        
        const logData = {
            status: successfulRecipients.length > 0 ? 'sent' : 'failed',
            recipients: successfulRecipients.concat(failedRecipients),
            message: message,
            templateId: templateId,
            type: 'bulk',
            bulkResults: {
                total: recipients.length,
                successful: successfulRecipients.length,
                failed: failedRecipients.length
            }
        };
        
        logMessage(logData);
        
        res.json({
            success: true,
            message: 'Bulk messages processed',
            data: {
                results: results,
                summary: {
                    total: recipients.length,
                    successful: successfulRecipients.length,
                    failed: failedRecipients.length
                }
            }
        });
        
    } catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error sending bulk messages' 
        });
    }
});

// ===== SOCKET.IO EVENTS (PRESERVED) =====

io.on('connection', (socket) => {
    console.log(`👤 Step 3A: Client connected: ${socket.id}`);
    
    socket.emit('connection-status', connectionStatus);
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
        console.log('📱 Step 3A: Sent existing QR code to new client');
    }

    socket.on('connect-whatsapp', () => {
        console.log('🔌 Step 3A: Client requested WhatsApp connection');
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            connectToWhatsApp();
        } else {
            console.log(`ℹ️ Step 3A: Already ${connectionStatus}`);
            socket.emit('connection-status', connectionStatus);
        }
    });

    socket.on('reset-connection', async () => {
        console.log('🔄 Step 3A: Client requested connection reset');
        await disconnectWhatsApp();
    });

    socket.on('disconnect-whatsapp', async () => {
        console.log('🔌 Step 3A: Client requested WhatsApp disconnect');
        await disconnectWhatsApp();
    });

    socket.on('ping', () => {
        socket.emit('pong', { 
            timestamp: Date.now(), 
            whatsappStatus: connectionStatus,
            version: 'Step 3A - Data Management'
        });
    });

    socket.on('disconnect', () => {
        console.log(`👋 Step 3A: Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.log(`❌ Step 3A: Socket error from ${socket.id}:`, error);
    });
});

// ===== HEALTH CHECK ENDPOINT =====

app.get('/health', (req, res) => {
    res.json({
        status: 'Step 3A: Data Management System - WhatsApp Server',
        whatsapp: connectionStatus,
        attempts: connectionAttempts,
        timestamp: new Date().toISOString(),
        version: 'step3a-data-management',
        authDir: authDir,
        dataDir: dataDir,
        socketStatus: sock ? 'active' : 'null',
        isConnecting: isConnecting,
        lastConnectionTime: lastConnectionTime ? new Date(lastConnectionTime).toISOString() : null,
        features: [
            'Contacts Management',
            'Groups Management', 
            'Templates System',
            'Message Logs & Analytics',
            'Enhanced Message Personalization'
        ]
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== GRACEFUL SHUTDOWN =====

process.on('SIGTERM', async () => {
    console.log('🛑 Step 3A: Received SIGTERM, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Step 3A: Received SIGINT, shutting down gracefully...');
    await disconnectWhatsApp();
    process.exit(0);
});

// ===== START SERVER =====

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Step 3A: Data Management System WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Node: ${process.version}`);
    console.log('🔥 Step 3A: Data Management Features Added');
    console.log('📁 Auth directory:', authDir);
    console.log('📁 Data directory:', dataDir);
    console.log('⚡ Ready for WhatsApp connections with data management');
    console.log('🎯 Features: Contacts, Templates, Message Logs');
});