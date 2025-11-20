import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { CommunicationHelper } from './utils/communication-helper';

test.describe('Communication Hub - Accessibility Testing', () => {
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

    test('should support keyboard navigation throughout the interface', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Test keyboard navigation in conversation list
        await page.keyboard.press('Tab'); // Focus on first conversation
        await expect(page.locator('[data-testid="conversation-item"]:first-child')).toBeFocused();

        // Navigate through conversations with arrow keys
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[data-testid="conversation-item"]:nth-child(2)')).toBeFocused();

        await page.keyboard.press('ArrowUp');
        await expect(page.locator('[data-testid="conversation-item"]:first-child')).toBeFocused();

        // Enter conversation with Enter key
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-testid="conversation-view"]')).toBeVisible();

        // Navigate to message input with Tab
        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="message-input"]')).toBeFocused();

        // Type message and send with keyboard
        await page.keyboard.type('Accessibility test message');
        await page.keyboard.press('Enter');

        // Verify message was sent
        await expect(page.locator('[data-testid="message-item"]')).toContainText('Accessibility test message');

        // Test keyboard navigation in message thread
        await page.keyboard.press('Tab'); // Focus on first message
        await expect(page.locator('[data-testid="message-item"]:first-child')).toBeFocused();

        // Navigate through messages
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');

        // Test keyboard shortcuts
        await page.keyboard.press('Control+f'); // Open search
        await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

        await page.keyboard.press('Escape'); // Close search
        await expect(page.locator('[data-testid="search-input"]')).toBeHidden();
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Check main container has proper role
        await expect(page.locator('[data-testid="communication-hub"]')).toHaveAttribute('role', 'main');

        // Check conversation list has proper ARIA attributes
        const conversationList = page.locator('[data-testid="conversation-list"]');
        await expect(conversationList).toHaveAttribute('role', 'list');
        await expect(conversationList).toHaveAttribute('aria-label', /conversations/i);

        // Check conversation items have proper roles
        const conversationItems = page.locator('[data-testid="conversation-item"]');
        await expect(conversationItems.first()).toHaveAttribute('role', 'listitem');
        await expect(conversationItems.first()).toHaveAttribute('tabindex', '0');

        // Check message thread has proper ARIA attributes
        const messageThread = page.locator('[data-testid="message-thread"]');
        await expect(messageThread).toHaveAttribute('role', 'log');
        await expect(messageThread).toHaveAttribute('aria-live', 'polite');
        await expect(messageThread).toHaveAttribute('aria-label', /message thread/i);

        // Check message input has proper labels
        const messageInput = page.locator('[data-testid="message-input"]');
        await expect(messageInput).toHaveAttribute('aria-label', /type message/i);
        await expect(messageInput).toHaveAttribute('role', 'textbox');

        // Check send button has proper attributes
        const sendButton = page.locator('[data-testid="send-message-button"]');
        await expect(sendButton).toHaveAttribute('aria-label', /send message/i);
        await expect(sendButton).toHaveAttribute('type', 'button');

        // Check notification area
        const notificationArea = page.locator('[data-testid="notification-area"]');
        await expect(notificationArea).toHaveAttribute('role', 'region');
        await expect(notificationArea).toHaveAttribute('aria-live', 'assertive');
    });

    test('should support screen reader announcements', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation to test announcements
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
            title: 'Screen Reader Test',
        });

        // Send message and check for screen reader announcement
        await communicationHelper.sendMessage('Test message for screen reader');

        // Check that message has proper screen reader text
        const message = page.locator('[data-testid="message-item"]').last();
        await expect(message).toHaveAttribute('aria-label', /message from/i);

        // Check timestamp is accessible
        const timestamp = message.locator('[data-testid="message-timestamp"]');
        await expect(timestamp).toHaveAttribute('aria-label', /sent at/i);

        // Test typing indicator announcement
        await page.focus('[data-testid="message-input"]');
        await page.keyboard.type('Testing typing indicator...');

        // Check for typing announcement area
        const typingArea = page.locator('[data-testid="typing-announcements"]');
        await expect(typingArea).toHaveAttribute('aria-live', 'polite');

        // Test notification announcements
        const notificationArea = page.locator('[data-testid="notification-announcements"]');
        await expect(notificationArea).toHaveAttribute('aria-live', 'assertive');
    });

    test('should support high contrast mode', async ({ page }) => {
        // Enable high contrast mode simulation
        await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });

        await communicationHelper.navigateToCommunicationHub();

        // Check that elements are visible in high contrast mode
        await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="message-thread"]')).toBeVisible();
        await expect(page.locator('[data-testid="message-input"]')).toBeVisible();

        // Check color contrast ratios (simplified check)
        const messageInput = page.locator('[data-testid="message-input"]');
        const styles = await messageInput.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                borderColor: computed.borderColor,
            };
        });

        // Verify styles are applied (basic check)
        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();

        // Test focus indicators in high contrast
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });

    test('should support reduced motion preferences', async ({ page }) => {
        // Simulate reduced motion preference
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await communicationHelper.navigateToCommunicationHub();

        // Create conversation and send message
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
        });

        await communicationHelper.sendMessage('Testing reduced motion');

        // Check that animations are disabled or reduced
        const messageItem = page.locator('[data-testid="message-item"]').last();

        // Verify no complex animations are running
        const animationDuration = await messageItem.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return computed.animationDuration;
        });

        // Should have no animation or very short duration
        expect(animationDuration === 'none' || animationDuration === '0s').toBeTruthy();
    });

    test('should support voice input and speech recognition', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
        });

        // Check for voice input button
        const voiceButton = page.locator('[data-testid="voice-input-button"]');
        await expect(voiceButton).toBeVisible();
        await expect(voiceButton).toHaveAttribute('aria-label', /voice input/i);

        // Test voice input activation (mock)
        await voiceButton.click();

        // Check that voice input modal opens
        await expect(page.locator('[data-testid="voice-input-modal"]')).toBeVisible();

        // Check accessibility of voice input interface
        const voiceModal = page.locator('[data-testid="voice-input-modal"]');
        await expect(voiceModal).toHaveAttribute('role', 'dialog');
        await expect(voiceModal).toHaveAttribute('aria-modal', 'true');
        await expect(voiceModal).toHaveAttribute('aria-labelledby');

        // Check for voice input status announcements
        const voiceStatus = page.locator('[data-testid="voice-status"]');
        await expect(voiceStatus).toHaveAttribute('aria-live', 'assertive');

        // Close voice input
        await page.keyboard.press('Escape');
        await expect(voiceModal).toBeHidden();
    });

    test('should provide proper focus management', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Test focus trap in modals
        await page.click('[data-testid="new-conversation-button"]');

        const modal = page.locator('[data-testid="new-conversation-modal"]');
        await expect(modal).toBeVisible();

        // Focus should be trapped within modal
        await page.keyboard.press('Tab');
        const focusedElement = await page.locator(':focus');

        // Verify focus is within modal
        const isWithinModal = await focusedElement.evaluate((el, modalEl) => {
            return modalEl.contains(el);
        }, await modal.elementHandle());

        expect(isWithinModal).toBeTruthy();

        // Test focus return after modal close
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();

        // Focus should return to trigger button
        await expect(page.locator('[data-testid="new-conversation-button"]')).toBeFocused();

        // Test focus management in conversation switching
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
        });

        // Switch conversations and verify focus
        await page.click('[data-testid="conversation-item"]:first-child');
        await expect(page.locator('[data-testid="message-input"]')).toBeFocused();
    });

    test('should support alternative text for images and files', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
        });

        // Upload image file
        await communicationHelper.uploadFile('test-files/medical-chart.jpg');

        // Check image has proper alt text
        const imageMessage = page.locator('[data-testid="image-message"]');
        const image = imageMessage.locator('img');
        await expect(image).toHaveAttribute('alt', /medical chart/i);

        // Upload document file
        await communicationHelper.uploadFile('test-files/prescription.pdf');

        // Check file has proper description
        const fileMessage = page.locator('[data-testid="file-message"]');
        await expect(fileMessage).toHaveAttribute('aria-label', /prescription document/i);

        // Check file download link is accessible
        const downloadLink = fileMessage.locator('[data-testid="file-download-button"]');
        await expect(downloadLink).toHaveAttribute('aria-label', /download prescription/i);
    });

    test('should provide proper error announcements', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Simulate network error
        await page.route('**/api/conversations', (route) => {
            route.abort('failed');
        });

        // Try to create conversation (should fail)
        await page.click('[data-testid="new-conversation-button"]');
        await page.fill('[data-testid="conversation-title-input"]', 'Test Conversation');
        await page.click('[data-testid="create-conversation-button"]');

        // Check error announcement
        const errorArea = page.locator('[data-testid="error-announcements"]');
        await expect(errorArea).toHaveAttribute('aria-live', 'assertive');
        await expect(errorArea).toContainText(/error/i);

        // Check error message is accessible
        const errorMessage = page.locator('[data-testid="error-message"]');
        await expect(errorMessage).toHaveAttribute('role', 'alert');
        await expect(errorMessage).toBeVisible();
    });

    test('should support customizable text size and zoom', async ({ page }) => {
        // Test with different zoom levels
        const zoomLevels = [1.0, 1.25, 1.5, 2.0];

        for (const zoom of zoomLevels) {
            await page.setViewportSize({
                width: Math.floor(1200 / zoom),
                height: Math.floor(800 / zoom)
            });

            await communicationHelper.navigateToCommunicationHub();

            // Verify interface remains usable at different zoom levels
            await expect(page.locator('[data-testid="conversation-list"]')).toBeVisible();
            await expect(page.locator('[data-testid="message-input"]')).toBeVisible();

            // Test that text remains readable
            const messageInput = page.locator('[data-testid="message-input"]');
            const fontSize = await messageInput.evaluate((el) => {
                return window.getComputedStyle(el).fontSize;
            });

            // Font size should scale appropriately
            const fontSizeNum = parseFloat(fontSize);
            expect(fontSizeNum).toBeGreaterThan(10); // Minimum readable size
        }
    });
});