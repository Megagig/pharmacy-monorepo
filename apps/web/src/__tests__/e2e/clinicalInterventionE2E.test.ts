import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL || 'http://localhost:5000';

// Mock data
const mockUser = {
    email: 'test.pharmacist@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Pharmacist',
    role: 'pharmacist'
};

const mockPatient = {
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN123456',
    dob: '1980-01-01',
    phone: '+2348012345678',
    email: 'john.doe@example.com'
};

test.describe('Clinical Interventions E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API responses
        await page.route(`${API_BASE_URL}/api/auth/login`, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        user: mockUser,
                        token: 'mock-jwt-token'
                    }
                })
            });
        });

        await page.route(`${API_BASE_URL}/api/patients**`, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        patients: [mockPatient],
                        pagination: {
                            page: 1,
                            limit: 20,
                            total: 1,
                            pages: 1,
                            hasNext: false,
                            hasPrev: false
                        }
                    }
                })
            });
        });

        await page.route(`${API_BASE_URL}/api/clinical-interventions**`, async route => {
            const url = route.request().url();

            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            interventions: [
                                {
                                    _id: 'intervention-1',
                                    interventionNumber: 'CI-202412-0001',
                                    category: 'drug_therapy_problem',
                                    priority: 'high',
                                    status: 'in_progress',
                                    issueDescription: 'Patient experiencing side effects',
                                    patientId: 'patient-1',
                                    identifiedBy: 'user-1',
                                    identifiedDate: '2024-12-01T10:00:00Z',
                                    patient: mockPatient
                                }
                            ],
                            pagination: {
                                page: 1,
                                limit: 20,
                                total: 1,
                                pages: 1,
                                hasNext: false,
                                hasPrev: false
                            }
                        }
                    })
                });
            } else if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            intervention: {
                                _id: 'intervention-2',
                                interventionNumber: 'CI-202412-0002',
                                category: 'drug_therapy_problem',
                                priority: 'high',
                                status: 'identified',
                                issueDescription: 'New intervention created',
                                patientId: 'patient-1',
                                identifiedBy: 'user-1'
                            }
                        }
                    })
                });
            }
        });

        await page.route(`${API_BASE_URL}/api/clinical-interventions/analytics/summary**`, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        metrics: {
                            totalInterventions: 25,
                            activeInterventions: 8,
                            completedInterventions: 15,
                            overdueInterventions: 2,
                            successRate: 85.5,
                            averageResolutionTime: 3.2,
                            totalCostSavings: 12500,
                            categoryDistribution: [
                                { name: 'Drug Therapy Problems', value: 12, color: '#8884d8' }
                            ],
                            priorityDistribution: [
                                { name: 'High', value: 8, color: '#ff8800' }
                            ],
                            monthlyTrends: [
                                { month: 'Dec', total: 25, completed: 20, successRate: 80 }
                            ]
                        }
                    }
                })
            });
        });

        // Navigate to login page and authenticate
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="email-input"]', mockUser.email);
        await page.fill('[data-testid="password-input"]', mockUser.password);
        await page.click('[data-testid="login-button"]');

        // Wait for redirect to dashboard
        await page.waitForURL(`${BASE_URL}/dashboard`);
    });

    test.describe('Dashboard Navigation and Display', () => {
        test('should display clinical interventions dashboard', async ({ page }) => {
            // Navigate to clinical interventions
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.waitForURL(`${BASE_URL}/clinical-interventions`);

            // Check page title
            await expect(page.locator('h1')).toContainText('Clinical Interventions Dashboard');

            // Check metrics cards are displayed
            await expect(page.locator('[data-testid="total-interventions"]')).toContainText('25');
            await expect(page.locator('[data-testid="active-interventions"]')).toContainText('8');
            await expect(page.locator('[data-testid="success-rate"]')).toContainText('85.5%');

            // Check interventions table
            await expect(page.locator('[data-testid="interventions-table"]')).toBeVisible();
            await expect(page.locator('[data-testid="intervention-row"]')).toHaveCount(1);
            await expect(page.locator('text=CI-202412-0001')).toBeVisible();
            await expect(page.locator('text=John Doe')).toBeVisible();
        });

        test('should display charts and analytics', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.waitForURL(`${BASE_URL}/clinical-interventions`);

            // Check for chart containers
            await expect(page.locator('[data-testid="category-distribution-chart"]')).toBeVisible();
            await expect(page.locator('[data-testid="priority-distribution-chart"]')).toBeVisible();
            await expect(page.locator('[data-testid="monthly-trends-chart"]')).toBeVisible();
        });
    });

    test.describe('Intervention Creation Workflow', () => {
        test('should create new intervention successfully', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.waitForURL(`${BASE_URL}/clinical-interventions`);

            // Click create intervention button
            await page.click('[data-testid="create-intervention-button"]');

            // Wait for form to appear (modal or new page)
            await expect(page.locator('[data-testid="intervention-form"]')).toBeVisible();

            // Fill out the form
            await page.selectOption('[data-testid="patient-select"]', { label: 'John Doe (MRN123456)' });
            await page.selectOption('[data-testid="category-select"]', 'drug_therapy_problem');
            await page.selectOption('[data-testid="priority-select"]', 'high');
            await page.fill('[data-testid="issue-description"]', 'Patient experiencing significant side effects from current medication regimen that requires immediate attention and intervention');

            // Submit the form
            await page.click('[data-testid="submit-intervention"]');

            // Wait for success message
            await expect(page.locator('[data-testid="success-message"]')).toContainText('Intervention created successfully');

            // Verify form closes and dashboard updates
            await expect(page.locator('[data-testid="intervention-form"]')).not.toBeVisible();
        });

        test('should validate required fields', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.click('[data-testid="create-intervention-button"]');

            // Try to submit without filling required fields
            await page.click('[data-testid="submit-intervention"]');

            // Check for validation errors
            await expect(page.locator('[data-testid="patient-error"]')).toContainText('Patient is required');
            await expect(page.locator('[data-testid="category-error"]')).toContainText('Category is required');
            await expect(page.locator('[data-testid="priority-error"]')).toContainText('Priority is required');
            await expect(page.locator('[data-testid="description-error"]')).toContainText('Issue description is required');
        });

        test('should validate issue description length', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.click('[data-testid="create-intervention-button"]');

            // Fill with short description
            await page.fill('[data-testid="issue-description"]', 'Short');
            await page.click('[data-testid="submit-intervention"]');

            // Check for length validation error
            await expect(page.locator('[data-testid="description-error"]')).toContainText('Issue description must be at least 10 characters');
        });

        test('should add and remove strategies', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.click('[data-testid="create-intervention-button"]');

            // Add strategy
            await page.click('[data-testid="add-strategy-button"]');
            await expect(page.locator('[data-testid="strategy-form"]')).toBeVisible();

            // Fill strategy form
            await page.selectOption('[data-testid="strategy-type"]', 'dose_adjustment');
            await page.fill('[data-testid="strategy-description"]', 'Reduce dose by 50%');
            await page.fill('[data-testid="strategy-rationale"]', 'Patient experiencing dose-related side effects');
            await page.fill('[data-testid="strategy-outcome"]', 'Reduced side effects while maintaining therapeutic efficacy');

            // Save strategy
            await page.click('[data-testid="save-strategy"]');

            // Verify strategy is added to list
            await expect(page.locator('[data-testid="strategy-list"]')).toContainText('Dose Adjustment');
            await expect(page.locator('[data-testid="strategy-list"]')).toContainText('Reduce dose by 50%');

            // Remove strategy
            await page.click('[data-testid="remove-strategy-0"]');
            await expect(page.locator('[data-testid="strategy-list"]')).not.toContainText('Dose Adjustment');
        });
    });

    test.describe('Filtering and Search', () => {
        test('should filter interventions by category', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Apply category filter
            await page.selectOption('[data-testid="category-filter"]', 'drug_therapy_problem');

            // Wait for filtered results
            await page.waitForResponse(response =>
                response.url().includes('/api/clinical-interventions') &&
                response.url().includes('category=drug_therapy_problem')
            );

            // Verify filter is applied
            await expect(page.locator('[data-testid="category-filter"]')).toHaveValue('drug_therapy_problem');
        });

        test('should filter interventions by priority', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Apply priority filter
            await page.selectOption('[data-testid="priority-filter"]', 'high');

            // Wait for filtered results
            await page.waitForResponse(response =>
                response.url().includes('/api/clinical-interventions') &&
                response.url().includes('priority=high')
            );

            // Verify filter is applied
            await expect(page.locator('[data-testid="priority-filter"]')).toHaveValue('high');
        });

        test('should search interventions', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Perform search
            await page.fill('[data-testid="search-input"]', 'side effects');

            // Wait for search results (debounced)
            await page.waitForResponse(response =>
                response.url().includes('/api/clinical-interventions') &&
                response.url().includes('search=side%20effects')
            );

            // Verify search term is in input
            await expect(page.locator('[data-testid="search-input"]')).toHaveValue('side effects');
        });

        test('should clear search', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Perform search
            await page.fill('[data-testid="search-input"]', 'test search');

            // Clear search
            await page.click('[data-testid="clear-search"]');

            // Verify search is cleared
            await expect(page.locator('[data-testid="search-input"]')).toHaveValue('');
        });

        test('should combine multiple filters', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Apply multiple filters
            await page.selectOption('[data-testid="category-filter"]', 'drug_therapy_problem');
            await page.selectOption('[data-testid="priority-filter"]', 'high');
            await page.selectOption('[data-testid="status-filter"]', 'in_progress');

            // Wait for filtered results
            await page.waitForResponse(response => {
                const url = response.url();
                return url.includes('/api/clinical-interventions') &&
                    url.includes('category=drug_therapy_problem') &&
                    url.includes('priority=high') &&
                    url.includes('status=in_progress');
            });

            // Verify all filters are applied
            await expect(page.locator('[data-testid="category-filter"]')).toHaveValue('drug_therapy_problem');
            await expect(page.locator('[data-testid="priority-filter"]')).toHaveValue('high');
            await expect(page.locator('[data-testid="status-filter"]')).toHaveValue('in_progress');
        });
    });

    test.describe('Pagination', () => {
        test('should handle pagination controls', async ({ page }) => {
            // Mock paginated response
            await page.route(`${API_BASE_URL}/api/clinical-interventions**`, async route => {
                const url = new URL(route.request().url());
                const page_param = url.searchParams.get('page') || '1';

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            interventions: [
                                {
                                    _id: `intervention-${page_param}`,
                                    interventionNumber: `CI-202412-000${page_param}`,
                                    category: 'drug_therapy_problem',
                                    priority: 'high',
                                    status: 'in_progress',
                                    issueDescription: `Intervention on page ${page_param}`,
                                    patientId: 'patient-1',
                                    identifiedBy: 'user-1',
                                    identifiedDate: '2024-12-01T10:00:00Z',
                                    patient: mockPatient
                                }
                            ],
                            pagination: {
                                page: parseInt(page_param),
                                limit: 20,
                                total: 50,
                                pages: 3,
                                hasNext: parseInt(page_param) < 3,
                                hasPrev: parseInt(page_param) > 1
                            }
                        }
                    })
                });
            });

            await page.click('[data-testid="nav-clinical-interventions"]');

            // Check initial pagination state
            await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 1 of 3');

            // Go to next page
            await page.click('[data-testid="next-page"]');
            await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 2 of 3');

            // Go to previous page
            await page.click('[data-testid="prev-page"]');
            await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 1 of 3');

            // Go to specific page
            await page.fill('[data-testid="page-input"]', '3');
            await page.press('[data-testid="page-input"]', 'Enter');
            await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 3 of 3');
        });
    });

    test.describe('Sorting', () => {
        test('should sort interventions by column headers', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Click priority column header to sort
            await page.click('[data-testid="priority-header"]');

            // Wait for sorted results
            await page.waitForResponse(response =>
                response.url().includes('/api/clinical-interventions') &&
                response.url().includes('sortBy=priority') &&
                response.url().includes('sortOrder=asc')
            );

            // Click again to reverse sort
            await page.click('[data-testid="priority-header"]');

            await page.waitForResponse(response =>
                response.url().includes('/api/clinical-interventions') &&
                response.url().includes('sortBy=priority') &&
                response.url().includes('sortOrder=desc')
            );
        });
    });

    test.describe('Accessibility', () => {
        test('should be keyboard navigable', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Tab through interactive elements
            await page.keyboard.press('Tab');
            await expect(page.locator('[data-testid="create-intervention-button"]')).toBeFocused();

            await page.keyboard.press('Tab');
            await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

            await page.keyboard.press('Tab');
            await expect(page.locator('[data-testid="category-filter"]')).toBeFocused();
        });

        test('should have proper ARIA labels', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Check for proper ARIA attributes
            await expect(page.locator('[role="main"]')).toBeVisible();
            await expect(page.locator('[role="table"]')).toBeVisible();
            await expect(page.locator('[role="search"]')).toBeVisible();

            // Check for proper labels
            await expect(page.locator('[aria-label*="Search interventions"]')).toBeVisible();
            await expect(page.locator('[aria-label*="Filter by category"]')).toBeVisible();
            await expect(page.locator('[aria-label*="Filter by priority"]')).toBeVisible();
        });

        test('should support screen reader navigation', async ({ page }) => {
            await page.click('[data-testid="nav-clinical-interventions"]');

            // Check for proper heading hierarchy
            await expect(page.locator('h1')).toHaveCount(1);
            await expect(page.locator('h2')).toHaveCount.greaterThan(0);

            // Check for proper table structure
            await expect(page.locator('table')).toHaveAttribute('role', 'table');
            await expect(page.locator('th')).toHaveCount.greaterThan(0);
            await expect(page.locator('td')).toHaveCount.greaterThan(0);
        });
    });

    test.describe('Error Handling', () => {
        test('should handle network errors gracefully', async ({ page }) => {
            // Mock network error
            await page.route(`${API_BASE_URL}/api/clinical-interventions**`, async route => {
                await route.abort('failed');
            });

            await page.click('[data-testid="nav-clinical-interventions"]');

            // Should show error message
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Error loading interventions');

            // Should show retry button
            await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
        });

        test('should handle server errors', async ({ page }) => {
            // Mock server error
            await page.route(`${API_BASE_URL}/api/clinical-interventions**`, async route => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: false,
                        error: {
                            message: 'Internal server error'
                        }
                    })
                });
            });

            await page.click('[data-testid="nav-clinical-interventions"]');

            // Should show error message
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Internal server error');
        });
    });

    test.describe('Performance', () => {
        test('should load dashboard within acceptable time', async ({ page }) => {
            const startTime = Date.now();

            await page.click('[data-testid="nav-clinical-interventions"]');
            await page.waitForURL(`${BASE_URL}/clinical-interventions`);

            // Wait for main content to load
            await expect(page.locator('[data-testid="interventions-table"]')).toBeVisible();

            const endTime = Date.now();
            const loadTime = endTime - startTime;

            // Should load within 3 seconds
            expect(loadTime).toBeLessThan(3000);
        });

        test('should handle large datasets efficiently', async ({ page }) => {
            // Mock large dataset
            const largeDataset = Array.from({ length: 100 }, (_, i) => ({
                _id: `intervention-${i + 1}`,
                interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                category: 'drug_therapy_problem',
                priority: 'medium',
                status: 'identified',
                issueDescription: `Test intervention ${i + 1}`,
                patientId: 'patient-1',
                identifiedBy: 'user-1',
                identifiedDate: '2024-12-01T10:00:00Z',
                patient: mockPatient
            }));

            await page.route(`${API_BASE_URL}/api/clinical-interventions**`, async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            interventions: largeDataset.slice(0, 20), // First page
                            pagination: {
                                page: 1,
                                limit: 20,
                                total: 100,
                                pages: 5,
                                hasNext: true,
                                hasPrev: false
                            }
                        }
                    })
                });
            });

            const startTime = Date.now();

            await page.click('[data-testid="nav-clinical-interventions"]');
            await expect(page.locator('[data-testid="intervention-row"]')).toHaveCount(20);

            const endTime = Date.now();
            const renderTime = endTime - startTime;

            // Should render large dataset within reasonable time
            expect(renderTime).toBeLessThan(2000);

            // Should show pagination for large dataset
            await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Page 1 of 5');
        });
    });
});