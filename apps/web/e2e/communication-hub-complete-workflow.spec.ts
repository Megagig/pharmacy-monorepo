import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { CommunicationHelper, communicationTestData } from './utils/communication-helper';

test.describe('Communication Hub - Complete Workflow', () => {
    let authHelper: AuthHelper;
    let communicationHelper: CommunicationHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        communicationHelper = new CommunicationHelper(page);

        // Login before each test
        await authHelper.login();
    });

    test.afterEach(async ({ page }) => {
        // Cleanup after each test
        await authHelper.logout();
    });

    test('should complete full patient query workflow', async ({ page }) => {
        // Navigate to Communication Hub
        await communicationHelper.navigateToCommunicationHub();

        // Create a patient query conversation
        await communicationHelper.createConversation({
            type: 'patient_query',
            participants: ['doctor@test.com'],
            patientId: 'patient-123',
            title: 'Medication Interaction Question',
        });

        // Send initial patient query
        await communicationHelper.sendMessage(
            'I have a question about potential interactions between my medications'
        );

        // Verify message appears in conversation
        await expect(page.locator('[data-testid="message-item"]')).toContainText(
            'question about potential interactions'
        );

        // Send follow-up message with @mention
        await communicationHelper.sendMessageWithMention(
            'Could you please review my current medication list?',
            'doctor@test.com'
        );

        // Upload a file (medication list)
        await communicationHelper.uploadFile('test-files/medication-list.pdf');

        // Add reaction to previous message
        const messageId = await page.getAttribute('[data-testid="message-item"]:first-child', 'data-message-id');
        if (messageId) {
            await communicationHelper.addReactionToMessage(messageId, '👍');
        }

        // Reply to a message
        if (messageId) {
            await communicationHelper.replyToMessage(messageId, 'Thank you for the information');
        }

        // Mark messages as read
        if (messageId) {
            await communicationHelper.markMessageAsRead(messageId);
        }

        // Search for messages
        const searchResults = await communicationHelper.searchMessages('medication');
        expect(searchResults).toBeGreaterThan(0);

        // Check notifications
        const notificationCount = await communicationHelper.checkNotifications();
        expect(notificationCount).toBeGreaterThanOrEqual(0);

        // Verify conversation appears in conversation list
        await communicationHelper.verifyConversationList();
    });

    test('should handle multi-party healthcare collaboration', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create group conversation with multiple healthcare providers
        await communicationHelper.createConversation({
            type: 'group',
            participants: ['pharmacist@test.com', 'doctor@test.com', 'nurse@test.com'],
            patientId: 'patient-456',
            title: 'Patient Care Coordination',
        });

        // Each participant sends a message
        await communicationHelper.sendMessage('Pharmacist: I reviewed the medication regimen');
        await communicationHelper.sendMessage('Doctor: Please check for drug interactions');
        await communicationHelper.sendMessage('Nurse: Patient reports side effects');

        // Use @mentions to direct messages
        await communicationHelper.sendMessageWithMention(
            'Can you provide more details about the side effects?',
            'nurse@test.com'
        );

        // Share clinical documentation
        await communicationHelper.uploadFile('test-files/lab-results.pdf');

        // Verify all messages appear in thread
        await expect(page.locator('[data-testid="message-item"]')).toHaveCount({ min: 5 });

        // Verify message threading works
        await communicationHelper.verifyMessageThread();
    });

    test('should handle real-time messaging with Socket.IO', async ({ page, context }) => {
        // Open two browser contexts to simulate multiple users
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        // Login with second user
        await secondAuthHelper.login('pharmacist2@test.com', 'TestPassword123!');
        await secondCommunicationHelper.navigateToCommunicationHub();

        // First user navigates to Communication Hub
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation with both users
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['pharmacist2@test.com'],
        });

        // First user sends message
        await communicationHelper.sendMessage('Hello from user 1');

        // Second user should receive message in real-time
        await secondCommunicationHelper.verifyRealTimeMessage('Hello from user 1');

        // Test typing indicators
        await communicationHelper.simulateTyping('I am typing...');

        // Verify typing indicator appears for second user
        await expect(secondPage.locator('[data-testid="typing-indicator"]')).toBeVisible();

        // Second user sends reply
        await secondCommunicationHelper.sendMessage('Hello from user 2');

        // First user should receive reply in real-time
        await communicationHelper.verifyRealTimeMessage('Hello from user 2');

        // Cleanup second page
        await secondAuthHelper.logout();
        await secondPage.close();
    });

    test('should handle file sharing and document management', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation
        await communicationHelper.createConversation({
            type: 'patient_query',
            participants: ['doctor@test.com'],
            patientId: 'patient-789',
        });

        // Upload different file types
        await communicationHelper.uploadFile('test-files/prescription.pdf');
        await communicationHelper.uploadFile('test-files/lab-image.jpg');
        await communicationHelper.uploadFile('test-files/medication-list.xlsx');

        // Verify file messages appear
        await expect(page.locator('[data-testid="file-message"]')).toHaveCount(3);

        // Verify file previews are shown
        await expect(page.locator('[data-testid="file-preview"]')).toHaveCount({ min: 1 });

        // Test file download
        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="file-download-button"]:first-child');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBeTruthy();

        // Verify file access permissions
        await expect(page.locator('[data-testid="file-access-indicator"]')).toBeVisible();
    });

    test('should maintain audit trail and compliance', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation and perform various actions
        await communicationHelper.createConversation({
            type: 'patient_query',
            participants: ['doctor@test.com'],
            patientId: 'patient-audit',
        });

        await communicationHelper.sendMessage('Test message for audit');
        await communicationHelper.uploadFile('test-files/test-document.pdf');

        // Navigate to audit log (admin feature)
        await communicationHelper.verifyAuditLog();

        // Export audit log
        await communicationHelper.exportAuditLog();

        // Verify audit entries contain required information
        await expect(page.locator('[data-testid="audit-entry"]')).toContainText('message_sent');
        await expect(page.locator('[data-testid="audit-entry"]')).toContainText('file_shared');
        await expect(page.locator('[data-testid="audit-entry"]')).toContainText('conversation_created');
    });

    test('should integrate with dashboard and navigation', async ({ page }) => {
        // Start from main dashboard
        await page.goto('/dashboard');

        // Verify Communication Hub is accessible from navigation
        await expect(page.locator('[data-testid="communication-hub-nav"]')).toBeVisible();

        // Click to navigate to Communication Hub
        await page.click('[data-testid="communication-hub-nav"]');

        // Verify we're in Communication Hub
        await expect(page.locator('[data-testid="communication-hub"]')).toBeVisible();

        // Verify dashboard integration widgets
        await page.goto('/dashboard');
        await expect(page.locator('[data-testid="communication-widget"]')).toBeVisible();

        // Check notification badges in main navigation
        await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();

        // Test deep linking to specific conversation
        await page.goto('/communication-hub/conversation/test-conversation-id');
        await expect(page.locator('[data-testid="conversation-view"]')).toBeVisible();
    });

    test('should handle message search and filtering', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation with multiple messages
        await communicationHelper.createConversation({
            type: 'group',
            participants: ['doctor@test.com', 'pharmacist@test.com'],
            patientId: 'patient-search',
        });

        // Send messages with different content
        await communicationHelper.sendMessage('Patient has diabetes and hypertension');
        await communicationHelper.sendMessage('Prescribed metformin for diabetes management');
        await communicationHelper.sendMessage('Blood pressure readings are elevated');
        await communicationHelper.sendMessage('Consider ACE inhibitor for hypertension');

        // Test basic search
        let results = await communicationHelper.searchMessages('diabetes');
        expect(results).toBe(2);

        // Test advanced search with filters
        await page.click('[data-testid="advanced-search-button"]');

        // Filter by date range
        await page.fill('[data-testid="search-date-from"]', '2024-01-01');
        await page.fill('[data-testid="search-date-to"]', '2024-12-31');

        // Filter by participant
        await page.selectOption('[data-testid="search-participant-filter"]', 'doctor@test.com');

        // Apply filters and search
        await page.fill('[data-testid="search-input"]', 'hypertension');
        results = await communicationHelper.searchMessages('hypertension');
        expect(results).toBeGreaterThan(0);

        // Test search highlighting
        await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
    });
});