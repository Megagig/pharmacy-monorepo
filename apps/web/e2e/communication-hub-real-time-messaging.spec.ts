import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { CommunicationHelper } from './utils/communication-helper';

test.describe('Communication Hub - Real-Time Messaging', () => {
    let authHelper: AuthHelper;
    let communicationHelper: CommunicationHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        communicationHelper = new CommunicationHelper(page);
        await authHelper.login();
    });

    test.afterEach(async ({ page }) => {
        await authHelper.logout();
    });

    test('should handle real-time message delivery via WebSocket', async ({ page, context }) => {
        // Create second browser context for multi-user testing
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        try {
            // Login second user
            await secondAuthHelper.login('pharmacist2@test.com', 'TestPassword123!');

            // Both users navigate to Communication Hub
            await communicationHelper.navigateToCommunicationHub();
            await secondCommunicationHelper.navigateToCommunicationHub();

            // Create shared conversation
            await communicationHelper.createConversation({
                type: 'direct',
                participants: ['pharmacist2@test.com'],
                title: 'Real-time Test Conversation',
            });

            // User 1 sends message
            await communicationHelper.sendMessage('Real-time message from user 1');

            // User 2 should receive message immediately
            await secondCommunicationHelper.verifyRealTimeMessage('Real-time message from user 1', 3000);

            // User 2 replies
            await secondCommunicationHelper.sendMessage('Reply from user 2');

            // User 1 should receive reply immediately
            await communicationHelper.verifyRealTimeMessage('Reply from user 2', 3000);

            // Verify message order is maintained
            const messages = await page.locator('[data-testid="message-item"]').allTextContents();
            expect(messages[0]).toContain('Real-time message from user 1');
            expect(messages[1]).toContain('Reply from user 2');

        } finally {
            await secondAuthHelper.logout();
            await secondPage.close();
        }
    });

    test('should show typing indicators in real-time', async ({ page, context }) => {
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        try {
            await secondAuthHelper.login('doctor@test.com', 'TestPassword123!');

            await communicationHelper.navigateToCommunicationHub();
            await secondCommunicationHelper.navigateToCommunicationHub();

            // Create conversation
            await communicationHelper.createConversation({
                type: 'direct',
                participants: ['doctor@test.com'],
            });

            // User 1 starts typing
            await page.focus('[data-testid="message-input"]');
            await page.keyboard.type('I am typing a message...', { delay: 100 });

            // User 2 should see typing indicator
            await expect(secondPage.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 5000 });
            await expect(secondPage.locator('[data-testid="typing-indicator"]')).toContainText('is typing');

            // User 1 stops typing
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="message-input"]').clear();

            // Typing indicator should disappear
            await expect(secondPage.locator('[data-testid="typing-indicator"]')).toBeHidden({ timeout: 3000 });

            // User 1 sends message
            await communicationHelper.sendMessage('Final message');

            // Typing indicator should be gone and message should appear
            await expect(secondPage.locator('[data-testid="typing-indicator"]')).toBeHidden();
            await secondCommunicationHelper.verifyRealTimeMessage('Final message');

        } finally {
            await secondAuthHelper.logout();
            await secondPage.close();
        }
    });

    test('should handle presence and online status', async ({ page, context }) => {
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        try {
            await secondAuthHelper.login('nurse@test.com', 'TestPassword123!');

            await communicationHelper.navigateToCommunicationHub();
            await secondCommunicationHelper.navigateToCommunicationHub();

            // Create conversation
            await communicationHelper.createConversation({
                type: 'direct',
                participants: ['nurse@test.com'],
            });

            // Verify both users show as online
            await expect(page.locator('[data-testid="participant-status-nurse@test.com"]')).toHaveClass(/online/);
            await expect(secondPage.locator('[data-testid="participant-status-pharmacist@test.com"]')).toHaveClass(/online/);

            // User 2 goes offline (close page)
            await secondPage.close();

            // User 1 should see user 2 as offline
            await expect(page.locator('[data-testid="participant-status-nurse@test.com"]')).toHaveClass(/offline/, { timeout: 10000 });

            // User 2 comes back online
            const thirdPage = await context.newPage();
            const thirdAuthHelper = new AuthHelper(thirdPage);
            await thirdAuthHelper.login('nurse@test.com', 'TestPassword123!');

            const thirdCommunicationHelper = new CommunicationHelper(thirdPage);
            await thirdCommunicationHelper.navigateToCommunicationHub();

            // User 1 should see user 2 as online again
            await expect(page.locator('[data-testid="participant-status-nurse@test.com"]')).toHaveClass(/online/, { timeout: 10000 });

            await thirdAuthHelper.logout();
            await thirdPage.close();

        } finally {
            // Cleanup
            if (!secondPage.isClosed()) {
                await secondAuthHelper.logout();
                await secondPage.close();
            }
        }
    });

    test('should handle message read receipts in real-time', async ({ page, context }) => {
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        try {
            await secondAuthHelper.login('doctor@test.com', 'TestPassword123!');

            await communicationHelper.navigateToCommunicationHub();
            await secondCommunicationHelper.navigateToCommunicationHub();

            // Create conversation
            await communicationHelper.createConversation({
                type: 'direct',
                participants: ['doctor@test.com'],
            });

            // User 1 sends message
            await communicationHelper.sendMessage('Please read this message');

            // Message should show as sent
            await expect(page.locator('[data-testid="message-status"]').last()).toContainText('sent');

            // User 2 receives and reads message
            await secondCommunicationHelper.verifyRealTimeMessage('Please read this message');

            const messageId = await secondPage.getAttribute('[data-testid="message-item"]:last-child', 'data-message-id');
            if (messageId) {
                await secondCommunicationHelper.markMessageAsRead(messageId);
            }

            // User 1 should see message as read
            await expect(page.locator('[data-testid="message-status"]').last()).toContainText('read', { timeout: 5000 });

            // Verify read receipt shows correct user
            await expect(page.locator('[data-testid="read-by-indicator"]')).toContainText('doctor@test.com');

        } finally {
            await secondAuthHelper.logout();
            await secondPage.close();
        }
    });

    test('should handle real-time notifications', async ({ page, context }) => {
        const secondPage = await context.newPage();
        const secondAuthHelper = new AuthHelper(secondPage);
        const secondCommunicationHelper = new CommunicationHelper(secondPage);

        try {
            await secondAuthHelper.login('pharmacist2@test.com', 'TestPassword123!');

            await communicationHelper.navigateToCommunicationHub();
            await secondCommunicationHelper.navigateToCommunicationHub();

            // Create conversation
            await communicationHelper.createConversation({
                type: 'patient_query',
                participants: ['pharmacist2@test.com'],
                patientId: 'patient-notifications',
            });

            // User 1 sends message with mention
            await communicationHelper.sendMessageWithMention(
                'Can you review this patient case?',
                'pharmacist2@test.com'
            );

            // User 2 should receive real-time notification
            await expect(secondPage.locator('[data-testid="notification-toast"]')).toBeVisible({ timeout: 5000 });
            await expect(secondPage.locator('[data-testid="notification-toast"]')).toContainText('mentioned you');

            // Notification bell should show unread count
            await expect(secondPage.locator('[data-testid="notification-badge"]')).toContainText('1');

            // User 2 clicks notification to navigate to conversation
            await secondPage.click('[data-testid="notification-toast"]');

            // Should navigate to the conversation
            await expect(secondPage.locator('[data-testid="conversation-view"]')).toBeVisible();

            // Notification count should decrease
            await expect(secondPage.locator('[data-testid="notification-badge"]')).toBeHidden();

        } finally {
            await secondAuthHelper.logout();
            await secondPage.close();
        }
    });

    test('should handle connection recovery and message queuing', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
        });

        // Send initial message to establish connection
        await communicationHelper.sendMessage('Initial message');

        // Simulate network failure
        await communicationHelper.simulateNetworkFailure();

        // Try to send message while offline
        await page.fill('[data-testid="message-input"]', 'Offline message');
        await page.click('[data-testid="send-message-button"]');

        // Message should be queued
        await expect(page.locator('[data-testid="message-queued"]')).toBeVisible();

        // Restore connection
        await communicationHelper.restoreNetworkConnection();

        // Queued message should be sent
        await expect(page.locator('[data-testid="message-item"]')).toContainText('Offline message');
        await expect(page.locator('[data-testid="message-queued"]')).toBeHidden();
    });

    test('should handle concurrent message sending', async ({ page, context }) => {
        // Create multiple browser contexts to simulate concurrent users
        const users = [];
        const userCount = 3;

        try {
            // Setup multiple users
            for (let i = 0; i < userCount; i++) {
                const userPage = await context.newPage();
                const userAuthHelper = new AuthHelper(userPage);
                const userCommunicationHelper = new CommunicationHelper(userPage);

                await userAuthHelper.login(`user${i}@test.com`, 'TestPassword123!');
                await userCommunicationHelper.navigateToCommunicationHub();

                users.push({ page: userPage, auth: userAuthHelper, comm: userCommunicationHelper });
            }

            // Main user creates conversation with all users
            await communicationHelper.navigateToCommunicationHub();
            await communicationHelper.createConversation({
                type: 'group',
                participants: users.map((_, i) => `user${i}@test.com`),
                title: 'Concurrent Messaging Test',
            });

            // All users send messages simultaneously
            const messagePromises = users.map((user, i) =>
                user.comm.sendMessage(`Concurrent message from user ${i}`)
            );

            await Promise.all(messagePromises);

            // Verify all messages appear in correct order
            const messages = await page.locator('[data-testid="message-item"]').allTextContents();
            expect(messages.length).toBeGreaterThanOrEqual(userCount);

            // Each user should see all messages
            for (const user of users) {
                const userMessages = await user.page.locator('[data-testid="message-item"]').count();
                expect(userMessages).toBeGreaterThanOrEqual(userCount);
            }

        } finally {
            // Cleanup all user pages
            for (const user of users) {
                await user.auth.logout();
                await user.page.close();
            }
        }
    });
});