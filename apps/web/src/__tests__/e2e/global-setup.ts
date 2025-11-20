import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Setup test database and seed data
    const apiBaseUrl = process.env.E2E_API_URL || 'http://localhost:5000';
    
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        const response = await page.request.get(`${apiBaseUrl}/health`);
        if (response.ok()) {
          console.log('✅ Backend is ready');
          break;
        }
      } catch (error) {
        // Backend not ready yet
      }
      
      retries--;
      if (retries === 0) {
        throw new Error('Backend failed to start within timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Setup test data
    console.log('📊 Setting up test data...');
    
    // Create test admin user
    await page.request.post(`${apiBaseUrl}/api/test/setup-admin`, {
      data: {
        email: 'admin@test.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'super_admin'
      }
    });

    // Create test tenants
    await page.request.post(`${apiBaseUrl}/api/test/setup-tenants`, {
      data: {
        tenants: [
          {
            name: 'Demo Tenant 1',
            domain: 'demo1.example.com',
            plan: 'basic',
            status: 'active',
            adminEmail: 'admin@demo1.com'
          },
          {
            name: 'Demo Tenant 2',
            domain: 'demo2.example.com',
            plan: 'premium',
            status: 'active',
            adminEmail: 'admin@demo2.com'
          },
          {
            name: 'Demo Tenant 3',
            domain: 'demo3.example.com',
            plan: 'enterprise',
            status: 'suspended',
            adminEmail: 'admin@demo3.com'
          }
        ]
      }
    });

    // Create test users
    await page.request.post(`${apiBaseUrl}/api/test/setup-users`, {
      data: {
        users: [
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@demo1.com',
            role: 'admin',
            tenantId: 'demo1'
          },
          {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@demo2.com',
            role: 'user',
            tenantId: 'demo2'
          }
        ]
      }
    });

    // Create test subscriptions
    await page.request.post(`${apiBaseUrl}/api/test/setup-subscriptions`, {
      data: {
        subscriptions: [
          {
            tenantId: 'demo1',
            plan: 'basic',
            status: 'active',
            amount: 29.99,
            currency: 'USD'
          },
          {
            tenantId: 'demo2',
            plan: 'premium',
            status: 'active',
            amount: 99.99,
            currency: 'USD'
          }
        ]
      }
    });

    console.log('✅ Test data setup complete');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('🎉 E2E test setup completed successfully');
}

export default globalSetup;