import { Page, expect } from '@playwright/test';

export interface CommunicationTestData {
    conversation: {
        title?: string;
        type: 'direct' | 'group' | 'patient_query';
        participants: string[];
        patientId?: string;
    };
    messages: {
        content: string;
        type: 'text' | 'file' | 'image';
        attachments?: string[];
        mentions?: string[];
    }[];
    notifications: {
        type: string;
        priority: 'low' | 'normal' | 'high' | 'urgent';
    }[];
}

export class CommunicationHelper {
    constructor(private page: Page) { }

    async navigateToCommunicationHub() {
        console.log('📱 Navigating to Communication Hub...');
        await this.page.goto('/communication-hub');
        await this.page.waitForSelector('[data-testid="communication-hub"]', { timeout: 10000 });
        console.log('✅ Communication Hub loaded');
    }

    async createConversation(data: CommunicationTestData['conversation']) {
        console.log(`💬 Creating ${data.type} conversation...`);

        // Click new conversation button
        await this.page.click('[data-testid="new-conversation-button"]');

        // Wait for modal to open
        await this.page.waitForSelector('[data-testid="new-conversation-modal"]');

        // Select conversation type
        await this.page.selectOption('[data-testid="conversation-type-select"]', data.type);

        // Add title if provided
        if (data.title) {
            await this.page.fill('[data-testid="conversation-title-input"]', data.title);
        }

        // Add participants
        for (const participant of data.participants) {
            await this.page.fill('[data-testid="participant-search-input"]', participant);
            await this.page.click(`[data-testid="participant-option-${participant}"]`);
        }

        // Link to patient if provided
        if (data.patientId) {
            await this.page.fill('[data-testid="patient-search-input"]', data.patientId);
            await this.page.click(`[data-testid="patient-option-${data.patientId}"]`);
        }

        // Create conversation
        await this.page.click('[data-testid="create-conversation-button"]');

        // Wait for conversation to be created
        await this.page.waitForSelector('[data-testid="conversation-item"]');

        console.log('✅ Conversation created successfully');
    }

    async sendMessage(content: string, type: 'text' | 'file' | 'image' = 'text') {
        console.log(`📝 Sending ${type} message: ${content.substring(0, 50)}...`);

        if (type === 'text') {
            await this.page.fill('[data-testid="message-input"]', content);
            await this.page.click('[data-testid="send-message-button"]');
        } else if (type === 'file') {
            // Handle file upload
            await this.page.click('[data-testid="file-upload-button"]');
            await this.page.setInputFiles('[data-testid="file-input"]', content);
            await this.page.click('[data-testid="send-file-button"]');
        }

        // Wait for message to appear
        await this.page.waitForSelector('[data-testid="message-item"]:last-child');

        console.log('✅ Message sent successfully');
    }

    async sendMessageWithMention(content: string, mentionUser: string) {
        console.log(`📝 Sending message with @${mentionUser} mention...`);

        await this.page.fill('[data-testid="message-input"]', `@${mentionUser} ${content}`);

        // Wait for mention dropdown and select user
        await this.page.waitForSelector('[data-testid="mention-dropdown"]');
        await this.page.click(`[data-testid="mention-option-${mentionUser}"]`);

        await this.page.click('[data-testid="send-message-button"]');

        // Verify mention appears in message
        await expect(this.page.locator('[data-testid="message-mention"]')).toContainText(mentionUser);

        console.log('✅ Message with mention sent successfully');
    }

    async replyToMessage(messageId: string, replyContent: string) {
        console.log(`↩️ Replying to message ${messageId}...`);

        // Click reply button on specific message
        await this.page.click(`[data-testid="message-${messageId}"] [data-testid="reply-button"]`);

        // Fill reply input
        await this.page.fill('[data-testid="reply-input"]', replyContent);

        // Send reply
        await this.page.click('[data-testid="send-reply-button"]');

        // Wait for reply to appear
        await this.page.waitForSelector(`[data-testid="reply-to-${messageId}"]`);

        console.log('✅ Reply sent successfully');
    }

    async addReactionToMessage(messageId: string, emoji: string) {
        console.log(`😊 Adding ${emoji} reaction to message ${messageId}...`);

        // Hover over message to show reaction button
        await this.page.hover(`[data-testid="message-${messageId}"]`);

        // Click reaction button
        await this.page.click(`[data-testid="message-${messageId}"] [data-testid="reaction-button"]`);

        // Select emoji
        await this.page.click(`[data-testid="emoji-${emoji}"]`);

        // Verify reaction appears
        await expect(this.page.locator(`[data-testid="message-${messageId}"] [data-testid="reaction-${emoji}"]`)).toBeVisible();

        console.log('✅ Reaction added successfully');
    }

    async markMessageAsRead(messageId: string) {
        console.log(`👁️ Marking message ${messageId} as read...`);

        // Scroll message into view (simulates reading)
        await this.page.locator(`[data-testid="message-${messageId}"]`).scrollIntoViewIfNeeded();

        // Wait for read status to update
        await this.page.waitForSelector(`[data-testid="message-${messageId}"] [data-testid="read-indicator"]`);

        console.log('✅ Message marked as read');
    }

    async searchMessages(query: string) {
        console.log(`🔍 Searching messages for: ${query}...`);

        // Open search
        await this.page.click('[data-testid="search-button"]');

        // Enter search query
        await this.page.fill('[data-testid="search-input"]', query);

        // Wait for search results
        await this.page.waitForSelector('[data-testid="search-results"]');

        const resultCount = await this.page.locator('[data-testid="search-result-item"]').count();
        console.log(`✅ Found ${resultCount} search results`);

        return resultCount;
    }

    async uploadFile(filePath: string) {
        console.log(`📎 Uploading file: ${filePath}...`);

        // Click file upload button
        await this.page.click('[data-testid="file-upload-button"]');

        // Upload file
        await this.page.setInputFiles('[data-testid="file-input"]', filePath);

        // Wait for upload to complete
        await this.page.waitForSelector('[data-testid="file-upload-success"]');

        // Send file message
        await this.page.click('[data-testid="send-file-button"]');

        // Verify file message appears
        await this.page.waitForSelector('[data-testid="file-message"]');

        console.log('✅ File uploaded and sent successfully');
    }

    async checkNotifications() {
        console.log('🔔 Checking notifications...');

        // Click notification bell
        await this.page.click('[data-testid="notification-bell"]');

        // Wait for notification panel
        await this.page.waitForSelector('[data-testid="notification-panel"]');

        const notificationCount = await this.page.locator('[data-testid="notification-item"]').count();
        console.log(`✅ Found ${notificationCount} notifications`);

        return notificationCount;
    }

    async markNotificationAsRead(notificationId: string) {
        console.log(`✅ Marking notification ${notificationId} as read...`);

        await this.page.click(`[data-testid="notification-${notificationId}"] [data-testid="mark-read-button"]`);

        // Verify notification is marked as read
        await expect(this.page.locator(`[data-testid="notification-${notificationId}"]`)).toHaveClass(/read/);

        console.log('✅ Notification marked as read');
    }

    async simulateTyping(text: string) {
        console.log('⌨️ Simulating typing...');

        const messageInput = this.page.locator('[data-testid="message-input"]');

        // Type slowly to trigger typing indicators
        for (const char of text) {
            await messageInput.type(char, { delay: 100 });
        }

        // Verify typing indicator appears for other users
        await this.page.waitForSelector('[data-testid="typing-indicator"]');

        console.log('✅ Typing simulation completed');
    }

    async verifyRealTimeMessage(expectedContent: string, timeout = 5000) {
        console.log(`⏱️ Waiting for real-time message: ${expectedContent}...`);

        // Wait for message to appear via WebSocket
        await this.page.waitForSelector(
            `[data-testid="message-item"]:has-text("${expectedContent}")`,
            { timeout }
        );

        console.log('✅ Real-time message received');
    }

    async verifyConversationList() {
        console.log('📋 Verifying conversation list...');

        // Check that conversation list is visible
        await expect(this.page.locator('[data-testid="conversation-list"]')).toBeVisible();

        // Check for at least one conversation
        await expect(this.page.locator('[data-testid="conversation-item"]')).toHaveCount({ min: 1 });

        console.log('✅ Conversation list verified');
    }

    async verifyMessageThread() {
        console.log('🧵 Verifying message thread...');

        // Check that message thread is visible
        await expect(this.page.locator('[data-testid="message-thread"]')).toBeVisible();

        // Check for message input
        await expect(this.page.locator('[data-testid="message-input"]')).toBeVisible();

        console.log('✅ Message thread verified');
    }

    async simulateNetworkFailure() {
        console.log('🌐 Simulating network failure...');

        // Simulate offline mode
        await this.page.context().setOffline(true);

        // Try to send a message
        await this.page.fill('[data-testid="message-input"]', 'Test message during offline');
        await this.page.click('[data-testid="send-message-button"]');

        // Verify offline indicator appears
        await expect(this.page.locator('[data-testid="offline-indicator"]')).toBeVisible();

        console.log('✅ Network failure simulated');
    }

    async restoreNetworkConnection() {
        console.log('🌐 Restoring network connection...');

        // Restore online mode
        await this.page.context().setOffline(false);

        // Wait for connection to restore
        await this.page.waitForSelector('[data-testid="online-indicator"]');

        // Verify queued messages are sent
        await this.page.waitForSelector('[data-testid="message-sent-indicator"]');

        console.log('✅ Network connection restored');
    }

    async verifyAuditLog() {
        console.log('📊 Verifying audit log...');

        // Navigate to audit log (admin feature)
        await this.page.click('[data-testid="audit-log-button"]');

        // Wait for audit log to load
        await this.page.waitForSelector('[data-testid="audit-log-table"]');

        // Verify audit entries exist
        await expect(this.page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 1 });

        console.log('✅ Audit log verified');
    }

    async exportAuditLog() {
        console.log('📤 Exporting audit log...');

        // Click export button
        const downloadPromise = this.page.waitForEvent('download');
        await this.page.click('[data-testid="export-audit-button"]');

        // Wait for download
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toContain('audit-log');

        console.log('✅ Audit log exported successfully');
    }
}

export const communicationTestData: CommunicationTestData = {
    conversation: {
        type: 'patient_query',
        participants: ['pharmacist@test.com', 'doctor@test.com'],
        patientId: 'patient-123',
    },
    messages: [
        {
            content: 'Patient is asking about medication interactions',
            type: 'text',
        },
        {
            content: 'I recommend checking the drug interaction database',
            type: 'text',
            mentions: ['pharmacist@test.com'],
        },
        {
            content: 'test-file.pdf',
            type: 'file',
            attachments: ['test-file.pdf'],
        },
    ],
    notifications: [
        {
            type: 'new_message',
            priority: 'normal',
        },
        {
            type: 'mention',
            priority: 'high',
        },
    ],
};

export const performanceCommunicationData = {
    largeConversation: {
        messageCount: 1000,
        participantCount: 50,
    },
    concurrentUsers: 10,
    messageVolume: 100, // messages per minute
};