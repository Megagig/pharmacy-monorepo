import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const apiBaseUrl = process.env.E2E_API_URL || 'http://localhost:5000';

    // Clean up test data
    console.log('🗑️ Cleaning up test data...');
    
    await page.request.post(`${apiBaseUrl}/api/test/cleanup`, {
      data: {
        cleanupAll: true
      }
    });

    console.log('✅ Test data cleanup complete');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close();
  }

  console.log('🎉 E2E test teardown completed');
}

export default globalTeardown;