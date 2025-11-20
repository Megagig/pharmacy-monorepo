import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { CommunicationHelper, performanceCommunicationData } from './utils/communication-helper';

test.describe('Communication Hub - Load Testing', () => {
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

    test('should handle large conversation with many messages', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation
        await communicationHelper.createConversation({
            type: 'group',
            participants: ['doctor@test.com', 'pharmacist@test.com'],
            title: 'Large Conversation Test',
        });

        const messageCount = 100;
        const startTime = Date.now();

        // Send many messages rapidly
        for (let i = 0; i < messageCount; i++) {
            await communicationHelper.sendMessage(`Load test message ${i + 1}`);

            // Add small delay to prevent overwhelming the system
            if (i % 10 === 0) {
                await page.waitForTimeout(100);
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Sent ${messageCount} messages in ${totalTime}ms`);
        console.log(`Average time per message: ${totalTime / messageCount}ms`);

        // Verify all messages are displayed
        await expect(page.locator('[data-testid="message-item"]')).toHaveCount(messageCount);

        // Test scrolling performance with many messages
        await page.locator('[data-testid="message-thread"]').scrollTo({ top: 0 });
        await page.waitForTimeout(500);

        // Scroll to bottom
        await page.locator('[data-testid="message-thread"]').scrollTo({ top: 999999 });
        await page.waitForTimeout(500);

        // Verify virtualization is working (not all messages rendered at once)
        const renderedMessages = await page.locator('[data-testid="message-item"]:visible').count();
        expect(renderedMessages).toBeLessThan(messageCount);

        // Performance assertion: should handle 100 messages in under 30 seconds
        expect(totalTime).toBeLessThan(30000);
    });

    test('should handle concurrent users in same conversation', async ({ page, context }) => {
        const concurrentUsers = 5;
        const messagesPerUser = 20;
        const users = [];

        try {
            // Setup concurrent users
            for (let i = 0; i < concurrentUsers; i++) {
                const userPage = await context.newPage();
                const userAuthHelper = new AuthHelper(userPage);
                const userCommunicationHelper = new CommunicationHelper(userPage);

                await userAuthHelper.login(`loadtest${i}@test.com`, 'TestPassword123!');
                await userCommunicationHelper.navigateToCommunicationHub();

                users.push({
                    page: userPage,
                    auth: userAuthHelper,
                    comm: userCommunicationHelper,
                    id: i
                });
            }

            // Main user creates conversation
            await communicationHelper.navigateToCommunicationHub();
            await communicationHelper.createConversation({
                type: 'group',
                participants: users.map(u => `loadtest${u.id}@test.com`),
                title: 'Concurrent Load Test',
            });

            const startTime = Date.now();

            // All users send messages concurrently
            const messagePromises = [];

            for (const user of users) {
                for (let j = 0; j < messagesPerUser; j++) {
                    messagePromises.push(
                        user.comm.sendMessage(`Message ${j + 1} from user ${user.id}`)
                    );
                }
            }

            // Wait for all messages to be sent
            await Promise.all(messagePromises);

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const totalMessages = concurrentUsers * messagesPerUser;

            console.log(`${concurrentUsers} users sent ${totalMessages} messages in ${totalTime}ms`);
            console.log(`Average throughput: ${(totalMessages / totalTime * 1000).toFixed(2)} messages/second`);

            // Verify message count
            await expect(page.locator('[data-testid="message-item"]')).toHaveCount({ min: totalMessages });

            // Performance assertion: should handle concurrent load efficiently
            expect(totalTime).toBeLessThan(60000); // Under 1 minute

            // Verify all users can see all messages
            for (const user of users) {
                const userMessageCount = await user.page.locator('[data-testid="message-item"]').count();
                expect(userMessageCount).toBeGreaterThanOrEqual(totalMessages);
            }

        } finally {
            // Cleanup
            for (const user of users) {
                await user.auth.logout();
                await user.page.close();
            }
        }
    });

    test('should handle large file uploads under load', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
            title: 'File Upload Load Test',
        });

        const fileCount = 10;
        const startTime = Date.now();

        // Upload multiple files
        for (let i = 0; i < fileCount; i++) {
            await communicationHelper.uploadFile(`test-files/large-file-${i}.pdf`);

            // Small delay between uploads
            await page.waitForTimeout(200);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Uploaded ${fileCount} files in ${totalTime}ms`);

        // Verify all files are uploaded
        await expect(page.locator('[data-testid="file-message"]')).toHaveCount(fileCount);

        // Performance assertion
        expect(totalTime).toBeLessThan(30000); // Under 30 seconds
    });

    test('should handle rapid message search queries', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create conversation with many messages
        await communicationHelper.createConversation({
            type: 'group',
            participants: ['doctor@test.com'],
            title: 'Search Performance Test',
        });

        // Send messages with searchable content
        const searchTerms = ['medication', 'patient', 'diagnosis', 'treatment', 'prescription'];

        for (let i = 0; i < 50; i++) {
            const term = searchTerms[i % searchTerms.length];
            await communicationHelper.sendMessage(`Message ${i + 1} about ${term} management`);
        }

        const searchQueries = 20;
        const startTime = Date.now();

        // Perform rapid searches
        for (let i = 0; i < searchQueries; i++) {
            const searchTerm = searchTerms[i % searchTerms.length];
            await communicationHelper.searchMessages(searchTerm);

            // Small delay between searches
            await page.waitForTimeout(100);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Performed ${searchQueries} searches in ${totalTime}ms`);
        console.log(`Average search time: ${totalTime / searchQueries}ms`);

        // Performance assertion: searches should be fast
        expect(totalTime / searchQueries).toBeLessThan(1000); // Under 1 second per search
    });

    test('should handle memory usage with large datasets', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        // Create multiple conversations
        const conversationCount = 10;
        const messagesPerConversation = 50;

        for (let i = 0; i < conversationCount; i++) {
            await communicationHelper.createConversation({
                type: 'direct',
                participants: [`user${i}@test.com`],
                title: `Memory Test Conversation ${i + 1}`,
            });

            // Send messages in each conversation
            for (let j = 0; j < messagesPerConversation; j++) {
                await communicationHelper.sendMessage(`Memory test message ${j + 1} in conversation ${i + 1}`);
            }

            // Switch between conversations to test memory management
            if (i > 0) {
                await page.click(`[data-testid="conversation-item"]:nth-child(${i})`);
                await page.waitForTimeout(100);
            }
        }

        // Measure memory usage (if available)
        const memoryInfo = await page.evaluate(() => {
            if ('memory' in performance) {
                return (performance as any).memory;
            }
            return null;
        });

        if (memoryInfo) {
            console.log('Memory usage:', {
                used: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) + ' MB',
                limit: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024) + ' MB',
            });

            // Memory assertion: should not exceed reasonable limits
            expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // Under 100MB
        }

        // Verify all conversations are accessible
        await expect(page.locator('[data-testid="conversation-item"]')).toHaveCount(conversationCount);
    });

    test('should handle network latency simulation', async ({ page }) => {
        // Simulate slow network conditions
        await page.route('**/api/conversations/**', async (route) => {
            // Add 2 second delay to simulate slow network
            await new Promise(resolve => setTimeout(resolve, 2000));
            await route.continue();
        });

        await communicationHelper.navigateToCommunicationHub();

        const startTime = Date.now();

        // Create conversation under slow network conditions
        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
            title: 'Network Latency Test',
        });

        // Send messages
        await communicationHelper.sendMessage('Message under slow network conditions');

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Operations completed in ${totalTime}ms under simulated network latency`);

        // Verify functionality still works despite latency
        await expect(page.locator('[data-testid="message-item"]')).toContainText('Message under slow network conditions');

        // Should handle latency gracefully (under 30 seconds total)
        expect(totalTime).toBeLessThan(30000);
    });

    test('should handle auto-save performance under load', async ({ page }) => {
        await communicationHelper.navigateToCommunicationHub();

        await communicationHelper.createConversation({
            type: 'direct',
            participants: ['doctor@test.com'],
            title: 'Auto-save Performance Test',
        });

        // Type rapidly to trigger frequent auto-saves
        const messageInput = page.locator('[data-testid="message-input"]');

        const startTime = Date.now();

        // Simulate rapid typing
        for (let i = 0; i < 100; i++) {
            await messageInput.type(`Word${i} `, { delay: 50 });

            // Verify auto-save indicator appears periodically
            if (i % 10 === 0) {
                await expect(page.locator('[data-testid="auto-save-indicator"]')).toBeVisible({ timeout: 1000 });
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Auto-save performance test completed in ${totalTime}ms`);

        // Send the final message
        await page.click('[data-testid="send-message-button"]');

        // Verify message was saved correctly
        await expect(page.locator('[data-testid="message-item"]')).toContainText('Word99');

        // Performance assertion: auto-save should not significantly impact typing
        expect(totalTime).toBeLessThan(15000); // Under 15 seconds for 100 words
    });
});