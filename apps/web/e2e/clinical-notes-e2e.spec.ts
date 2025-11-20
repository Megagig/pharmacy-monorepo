import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL || 'http://localhost:5000';

// Mock data
const mockUser = {
    _id: 'user1',
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    email: 'jane.smith@pharmacy.com',
    role: 'pharmacist',
    workplaceId: 'workplace1',
    workplaceRole: 'Pharmacist',
};

const mockPatient = {
    _id: 'patient1',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN001',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    gender: 'Male',
    age: 45,
    workplaceId: 'workplace1',
};

const mockSubscription = {
    _id: 'sub1',
    planId: 'professional',
    status: 'active',
    features: {
        clinicalNotes: true,
        maxNotes: 1000,
        confidentialNotes: true,
        fileAttachments: true,
    },
};

// Helper functions
async function loginUser(page: Page) {
    await page.goto('/login');

    // Mock authentication API
    await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                user: mockUser,
                token: 'mock-jwt-token',
            }),
        });
    });

    await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                user: mockUser,
            }),
        });
    });

    await page.route('**/api/subscriptions/current', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                subscription: mockSubscription,
            }),
        });
    });

    await page.fill('[data-testid="email-input"]', 'jane.smith@pharmacy.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
}

async function mockClinicalNotesAPI(page: Page) {
    // Mock notes list API
    await page.route('**/api/notes**', async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();

        if (method === 'GET') {
            const patientId = url.searchParams.get('patientId');
            const search = url.searchParams.get('search');

            let notes = [
                {
                    _id: 'note1',
                    title: 'Initial Consultation',
                    type: 'consultation',
                    priority: 'medium',
                    isConfidential: false,
                    followUpRequired: true,
                    followUpDate: '2024-02-15T10:00:00Z',
                    attachments: [],
                    createdAt: '2024-02-01T10:00:00Z',
                    updatedAt: '2024-02-01T10:00:00Z',
                    patient: mockPatient,
                    pharmacist: mockUser,
                    content: {
                        subjective: 'Patient reports feeling better',
                        objective: 'Vital signs stable',
                        assessment: 'Improving condition',
                        plan: 'Continue current medication',
                    },
                    recommendations: ['Monitor blood pressure'],
                    tags: ['hypertension'],
                    workplaceId: 'workplace1',
                },
                {
                    _id: 'note2',
                    title: 'Medication Review',
                    type: 'medication_review',
                    priority: 'low',
                    isConfidential: false,
                    followUpRequired: false,
                    attachments: [],
                    createdAt: '2024-02-02T10:00:00Z',
                    updatedAt: '2024-02-02T10:00:00Z',
                    patient: mockPatient,
                    pharmacist: mockUser,
                    content: {
                        subjective: 'No new complaints',
                        objective: 'Medication adherence good',
                        assessment: 'Stable on current regimen',
                        plan: 'Continue medications',
                    },
                    recommendations: ['Regular follow-up'],
                    tags: ['routine'],
                    workplaceId: 'workplace1',
                },
            ];

            // Filter by patient if specified
            if (patientId) {
                notes = notes.filter(note => note.patient._id === patientId);
            }

            // Filter by search if specified
            if (search) {
                notes = notes.filter(note =>
                    note.title.toLowerCase().includes(search.toLowerCase()) ||
                    note.content.subjective?.toLowerCase().includes(search.toLowerCase()) ||
                    note.content.objective?.toLowerCase().includes(search.toLowerCase()) ||
                    note.content.assessment?.toLowerCase().includes(search.toLowerCase()) ||
                    note.content.plan?.toLowerCase().includes(search.toLowerCase())
                );
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    notes,
                    total: notes.length,
                    page: 1,
                    totalPages: 1,
                }),
            });
        } else if (method === 'POST') {
            const body = await route.request().postDataJSON();
            const newNote = {
                _id: 'new-note-' + Date.now(),
                ...body,
                patient: mockPatient,
                pharmacist: mockUser,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                workplaceId: 'workplace1',
                attachments: [],
            };

            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    note: newNote,
                }),
            });
        }
    });

    // Mock individual note API
    await page.route('**/api/notes/*', async (route) => {
        const method = route.request().method();
        const noteId = route.request().url().split('/').pop()?.split('?')[0];

        if (method === 'GET') {
            const note = {
                _id: noteId,
                title: 'Initial Consultation',
                type: 'consultation',
                priority: 'medium',
                isConfidential: false,
                followUpRequired: true,
                followUpDate: '2024-02-15T10:00:00Z',
                attachments: [],
                createdAt: '2024-02-01T10:00:00Z',
                updatedAt: '2024-02-01T10:00:00Z',
                patient: mockPatient,
                pharmacist: mockUser,
                content: {
                    subjective: 'Patient reports feeling better',
                    objective: 'Vital signs stable',
                    assessment: 'Improving condition',
                    plan: 'Continue current medication',
                },
                recommendations: ['Monitor blood pressure'],
                tags: ['hypertension'],
                workplaceId: 'workplace1',
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    note,
                }),
            });
        } else if (method === 'PUT') {
            const body = await route.request().postDataJSON();
            const updatedNote = {
                _id: noteId,
                ...body,
                patient: mockPatient,
                pharmacist: mockUser,
                updatedAt: new Date().toISOString(),
                workplaceId: 'workplace1',
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    note: updatedNote,
                }),
            });
        } else if (method === 'DELETE') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    message: 'Note deleted successfully',
                }),
            });
        }
    });

    // Mock patients API
    await page.route('**/api/patients**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                patients: [mockPatient],
                total: 1,
            }),
        });
    });

    await page.route('**/api/patients/*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                patient: mockPatient,
            }),
        });
    });
}

test.describe('Clinical Notes E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await mockClinicalNotesAPI(page);
        await loginUser(page);
    });

    test.describe('Authentication and Authorization', () => {
        test('should redirect unauthenticated users to login', async ({ page }) => {
            // Clear authentication
            await page.context().clearCookies();
            await page.goto('/notes');

            await expect(page).toHaveURL('/login');
        });

        test('should allow authenticated pharmacists to access clinical notes', async ({ page }) => {
            await page.goto('/notes');

            await expect(page.locator('h1')).toContainText('Clinical Notes');
            await expect(page.locator('[data-testid="new-note-button"]')).toBeVisible();
        });

        test('should enforce role-based access for confidential notes', async ({ page }) => {
            // Mock technician user
            await page.route('**/api/auth/me', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        user: {
                            ...mockUser,
                            role: 'pharmacy_team',
                            workplaceRole: 'Technician',
                        },
                    }),
                });
            });

            // Mock filtered notes for technician
            await page.route('**/api/notes**', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        notes: [
                            {
                                _id: 'note1',
                                title: 'Regular Note',
                                type: 'consultation',
                                isConfidential: false,
                                patient: mockPatient,
                                pharmacist: mockUser,
                            },
                        ],
                        total: 1,
                    }),
                });
            });

            await page.goto('/notes');

            await expect(page.locator('text=Regular Note')).toBeVisible();
            await expect(page.locator('text=Confidential')).not.toBeVisible();
        });
    });

    test.describe('Subscription Integration', () => {
        test('should show subscription required message for expired subscription', async ({ page }) => {
            await page.route('**/api/subscriptions/current', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        subscription: {
                            ...mockSubscription,
                            status: 'expired',
                            features: {
                                ...mockSubscription.features,
                                clinicalNotes: false,
                            },
                        },
                    }),
                });
            });

            await page.goto('/notes');

            await expect(page.locator('text=Subscription Required')).toBeVisible();
            await expect(page.locator('text=Upgrade Plan')).toBeVisible();
        });

        test('should enforce usage limits', async ({ page }) => {
            await page.route('**/api/subscriptions/current', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        subscription: {
                            ...mockSubscription,
                            limits: { notes: 50 },
                            usage: { notes: 50 },
                        },
                    }),
                });
            });

            await page.goto('/notes');

            await expect(page.locator('[data-testid="new-note-button"]')).toBeDisabled();
            await expect(page.locator('text=Usage limit reached')).toBeVisible();
        });
    });

    test.describe('Clinical Notes Dashboard', () => {
        test('should display notes list with proper information', async ({ page }) => {
            await page.goto('/notes');

            await expect(page.locator('h1')).toContainText('Clinical Notes');
            await expect(page.locator('text=Initial Consultation')).toBeVisible();
            await expect(page.locator('text=Medication Review')).toBeVisible();
            await expect(page.locator('text=John Doe')).toBeVisible();
            await expect(page.locator('text=MRN001')).toBeVisible();
        });

        test('should support search functionality', async ({ page }) => {
            await page.goto('/notes');

            await page.fill('[data-testid="search-input"]', 'consultation');
            await page.press('[data-testid="search-input"]', 'Enter');

            await expect(page.locator('text=Initial Consultation')).toBeVisible();
            await expect(page.locator('text=Medication Review')).not.toBeVisible();
        });

        test('should support filtering by note type', async ({ page }) => {
            await page.goto('/notes');

            await page.click('[data-testid="filter-button"]');
            await page.click('[data-testid="filter-type"]');
            await page.click('text=Consultation');
            await page.click('[data-testid="apply-filters"]');

            await expect(page.locator('text=Initial Consultation')).toBeVisible();
            await expect(page.locator('text=Medication Review')).not.toBeVisible();
        });

        test('should support bulk operations', async ({ page }) => {
            await page.goto('/notes');

            // Select multiple notes
            await page.check('[data-testid="note-checkbox-note1"]');
            await page.check('[data-testid="note-checkbox-note2"]');

            // Open bulk actions
            await page.click('[data-testid="bulk-actions-button"]');
            await page.click('text=Update Priority');
            await page.click('text=High');
            await page.click('[data-testid="confirm-bulk-action"]');

            await expect(page.locator('text=2 notes updated successfully')).toBeVisible();
        });
    });

    test.describe('Note Creation Workflow', () => {
        test('should create a new clinical note', async ({ page }) => {
            await page.goto('/notes');

            await page.click('[data-testid="new-note-button"]');
            await expect(page).toHaveURL('/notes/new');

            // Fill out the form
            await page.fill('[data-testid="note-title"]', 'Test Clinical Note');
            await page.selectOption('[data-testid="note-type"]', 'consultation');
            await page.selectOption('[data-testid="patient-select"]', 'patient1');

            // Fill SOAP sections
            await page.fill('[data-testid="subjective-input"]', 'Patient reports new symptoms');
            await page.fill('[data-testid="objective-input"]', 'Physical examination findings');
            await page.fill('[data-testid="assessment-input"]', 'Clinical assessment');
            await page.fill('[data-testid="plan-input"]', 'Treatment plan');

            // Set priority
            await page.selectOption('[data-testid="priority-select"]', 'medium');

            // Submit the form
            await page.click('[data-testid="submit-button"]');

            await expect(page.locator('text=Note created successfully')).toBeVisible();
            await expect(page).toHaveURL(/\/notes\/new-note-\d+/);
        });

        test('should validate required fields', async ({ page }) => {
            await page.goto('/notes/new');

            // Try to submit without required fields
            await page.click('[data-testid="submit-button"]');

            await expect(page.locator('text=Title is required')).toBeVisible();
            await expect(page.locator('text=Patient is required')).toBeVisible();
            await expect(page.locator('text=Note type is required')).toBeVisible();
        });

        test('should create note with patient context from patient profile', async ({ page }) => {
            await page.goto('/patients/patient1');

            // Switch to Clinical Notes tab
            await page.click('text=Clinical Notes');

            // Click create note button
            await page.click('[data-testid="create-note-from-patient"]');

            await expect(page).toHaveURL('/notes/new?patientId=patient1');

            // Patient should be pre-selected and disabled
            const patientSelect = page.locator('[data-testid="patient-select"]');
            await expect(patientSelect).toHaveValue('patient1');
            await expect(patientSelect).toBeDisabled();
        });
    });

    test.describe('Note Editing Workflow', () => {
        test('should edit an existing note', async ({ page }) => {
            await page.goto('/notes');

            // Click edit button for first note
            await page.click('[data-testid="edit-note-note1"]');
            await expect(page).toHaveURL('/notes/note1/edit');

            // Form should be pre-populated
            await expect(page.locator('[data-testid="note-title"]')).toHaveValue('Initial Consultation');

            // Update the title
            await page.fill('[data-testid="note-title"]', 'Updated Consultation');

            // Update subjective section
            await page.fill('[data-testid="subjective-input"]', 'Updated patient reports');

            // Submit the form
            await page.click('[data-testid="submit-button"]');

            await expect(page.locator('text=Note updated successfully')).toBeVisible();
            await expect(page).toHaveURL('/notes/note1');
        });

        test('should show unsaved changes warning', async ({ page }) => {
            await page.goto('/notes/note1/edit');

            // Make changes
            await page.fill('[data-testid="note-title"]', 'Modified Title');

            // Try to navigate away
            await page.click('[data-testid="cancel-button"]');

            await expect(page.locator('text=You have unsaved changes')).toBeVisible();
            await expect(page.locator('text=Discard Changes')).toBeVisible();
            await expect(page.locator('text=Continue Editing')).toBeVisible();
        });
    });

    test.describe('Note Detail View', () => {
        test('should display complete note information', async ({ page }) => {
            await page.goto('/notes');

            // Click view button for first note
            await page.click('[data-testid="view-note-note1"]');
            await expect(page).toHaveURL('/notes/note1');

            // Check note details
            await expect(page.locator('h1')).toContainText('Initial Consultation');
            await expect(page.locator('text=Patient reports feeling better')).toBeVisible();
            await expect(page.locator('text=Vital signs stable')).toBeVisible();
            await expect(page.locator('text=Improving condition')).toBeVisible();
            await expect(page.locator('text=Continue current medication')).toBeVisible();

            // Check patient information
            await expect(page.locator('text=John Doe')).toBeVisible();
            await expect(page.locator('text=MRN001')).toBeVisible();

            // Check pharmacist information
            await expect(page.locator('text=Dr. Jane Smith')).toBeVisible();
        });

        test('should allow navigation to edit from detail view', async ({ page }) => {
            await page.goto('/notes/note1');

            await page.click('[data-testid="edit-note-button"]');
            await expect(page).toHaveURL('/notes/note1/edit');
        });

        test('should allow note deletion with confirmation', async ({ page }) => {
            await page.goto('/notes/note1');

            await page.click('[data-testid="delete-note-button"]');

            // Confirmation dialog should appear
            await expect(page.locator('text=Delete Note')).toBeVisible();
            await expect(page.locator('text=Are you sure you want to delete this note?')).toBeVisible();

            await page.click('[data-testid="confirm-delete"]');

            await expect(page.locator('text=Note deleted successfully')).toBeVisible();
            await expect(page).toHaveURL('/notes');
        });
    });

    test.describe('Patient Integration', () => {
        test('should display clinical notes in patient profile', async ({ page }) => {
            await page.goto('/patients/patient1');

            // Should show patient information
            await expect(page.locator('h1')).toContainText('John Doe');
            await expect(page.locator('text=MRN: MRN001')).toBeVisible();

            // Switch to Clinical Notes tab
            await page.click('text=Clinical Notes');

            // Should show patient-specific notes
            await expect(page.locator('text=Initial Consultation')).toBeVisible();
            await expect(page.locator('text=Medication Review')).toBeVisible();
        });

        test('should maintain patient context during navigation', async ({ page }) => {
            await page.goto('/patients/patient1');

            // Patient header should be visible
            await expect(page.locator('text=John Doe')).toBeVisible();

            // Switch between tabs
            await page.click('text=Allergies');
            await expect(page.locator('text=John Doe')).toBeVisible();

            await page.click('text=Clinical Notes');
            await expect(page.locator('text=John Doe')).toBeVisible();
        });
    });

    test.describe('File Upload Integration', () => {
        test('should upload files to clinical notes', async ({ page }) => {
            // Mock file upload API
            await page.route('**/api/notes/*/attachments', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        attachment: {
                            _id: 'att1',
                            fileName: 'test-file.pdf',
                            originalName: 'Test File.pdf',
                            mimeType: 'application/pdf',
                            size: 1024000,
                            url: '/api/attachments/att1',
                        },
                    }),
                });
            });

            await page.goto('/notes/new');

            // Upload a file
            const fileInput = page.locator('[data-testid="file-upload-input"]');
            await fileInput.setInputFiles({
                name: 'test-file.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('test file content'),
            });

            await expect(page.locator('text=test-file.pdf')).toBeVisible();
            await expect(page.locator('text=Upload complete')).toBeVisible();
        });

        test('should validate file types and sizes', async ({ page }) => {
            await page.goto('/notes/new');

            // Try to upload invalid file type
            const fileInput = page.locator('[data-testid="file-upload-input"]');
            await fileInput.setInputFiles({
                name: 'test-file.exe',
                mimeType: 'application/x-executable',
                buffer: Buffer.from('executable content'),
            });

            await expect(page.locator('text=Invalid file type')).toBeVisible();
        });
    });

    test.describe('Accessibility', () => {
        test('should be keyboard navigable', async ({ page }) => {
            await page.goto('/notes');

            // Tab through main elements
            await page.keyboard.press('Tab'); // New Note button
            await expect(page.locator('[data-testid="new-note-button"]')).toBeFocused();

            await page.keyboard.press('Tab'); // Search input
            await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

            await page.keyboard.press('Tab'); // Filter button
            await expect(page.locator('[data-testid="filter-button"]')).toBeFocused();
        });

        test('should have proper ARIA labels and roles', async ({ page }) => {
            await page.goto('/notes');

            // Check main heading
            const heading = page.locator('h1');
            await expect(heading).toHaveAttribute('role', 'heading');

            // Check search input
            const searchInput = page.locator('[data-testid="search-input"]');
            await expect(searchInput).toHaveAttribute('aria-label', 'Search clinical notes');

            // Check data grid
            const dataGrid = page.locator('[role="grid"]');
            await expect(dataGrid).toBeVisible();
        });

        test('should support screen readers', async ({ page }) => {
            await page.goto('/notes');

            // Check for proper heading structure
            await expect(page.locator('h1')).toContainText('Clinical Notes');

            // Check for descriptive text
            await expect(page.locator('[aria-describedby]')).toBeVisible();

            // Check for proper table headers
            await expect(page.locator('th[scope="col"]')).toHaveCount(6); // Title, Patient, Type, Priority, Date, Actions
        });
    });

    test.describe('Responsive Design', () => {
        test('should work on mobile devices', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
            await page.goto('/notes');

            // Should show mobile-optimized layout
            await expect(page.locator('[data-testid="mobile-notes-list"]')).toBeVisible();

            // Should have mobile navigation
            await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
        });

        test('should work on tablet devices', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 }); // iPad
            await page.goto('/notes');

            // Should show tablet-optimized layout
            await expect(page.locator('[data-testid="tablet-notes-grid"]')).toBeVisible();
        });

        test('should maintain functionality across screen sizes', async ({ page }) => {
            // Test desktop
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.goto('/notes');
            await expect(page.locator('text=Initial Consultation')).toBeVisible();

            // Test tablet
            await page.setViewportSize({ width: 768, height: 1024 });
            await expect(page.locator('text=Initial Consultation')).toBeVisible();

            // Test mobile
            await page.setViewportSize({ width: 375, height: 667 });
            await expect(page.locator('text=Initial Consultation')).toBeVisible();
        });
    });

    test.describe('Error Handling', () => {
        test('should handle network errors gracefully', async ({ page }) => {
            await page.route('**/api/notes**', async (route) => {
                await route.abort('failed');
            });

            await page.goto('/notes');

            await expect(page.locator('text=Connection Error')).toBeVisible();
            await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
        });

        test('should handle authentication errors', async ({ page }) => {
            await page.route('**/api/notes**', async (route) => {
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: false,
                        message: 'Authentication failed',
                    }),
                });
            });

            await page.goto('/notes');

            await expect(page.locator('text=Authentication Error')).toBeVisible();
            await expect(page.locator('text=Please log in again')).toBeVisible();
        });

        test('should handle validation errors during note creation', async ({ page }) => {
            await page.route('**/api/notes', async (route) => {
                if (route.request().method() === 'POST') {
                    await route.fulfill({
                        status: 400,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: false,
                            message: 'Validation failed',
                            errors: {
                                title: 'Title is required',
                                patient: 'Patient is required',
                            },
                        }),
                    });
                }
            });

            await page.goto('/notes/new');
            await page.click('[data-testid="submit-button"]');

            await expect(page.locator('text=Title is required')).toBeVisible();
            await expect(page.locator('text=Patient is required')).toBeVisible();
        });
    });

    test.describe('Performance', () => {
        test('should load notes list within acceptable time', async ({ page }) => {
            const startTime = Date.now();

            await page.goto('/notes');
            await expect(page.locator('text=Initial Consultation')).toBeVisible();

            const loadTime = Date.now() - startTime;
            expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
        });

        test('should handle large datasets efficiently', async ({ page }) => {
            // Mock large dataset
            await page.route('**/api/notes**', async (route) => {
                const largeNoteSet = Array.from({ length: 1000 }, (_, i) => ({
                    _id: `note${i}`,
                    title: `Note ${i}`,
                    type: 'consultation',
                    priority: 'medium',
                    patient: mockPatient,
                    pharmacist: mockUser,
                    createdAt: new Date().toISOString(),
                }));

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        notes: largeNoteSet.slice(0, 25), // Paginated
                        total: 1000,
                        page: 1,
                        totalPages: 40,
                    }),
                });
            });

            await page.goto('/notes');

            // Should use virtual scrolling or pagination
            await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
            await expect(page.locator('text=1 of 40')).toBeVisible();
        });
    });
});