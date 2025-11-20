# Feature Management E2E Tests

## Overview

This directory contains end-to-end (E2E) tests for the Admin Feature Management System using Playwright. These tests validate the complete user workflow from authentication through feature CRUD operations and tier management.

## Test Coverage

### Authentication & Authorization
- ✅ Super admin can access feature management page
- ✅ Non-super admin users are redirected/blocked (403)
- ✅ Unauthenticated users are redirected to login

### Feature Creation
- ✅ Create new feature through UI
- ✅ Form validation (required fields, format validation)
- ✅ Success toast notifications
- ✅ Form closes after successful creation

### Feature Editing
- ✅ Edit existing feature
- ✅ Form pre-population with current values
- ✅ Cancel edit without saving
- ✅ Success notifications on update

### Feature Deletion
- ✅ Delete feature with confirmation dialog
- ✅ Cancel deletion
- ✅ Success notifications on deletion

### Tier Feature Matrix
- ✅ Switch to Tier Management tab
- ✅ Display feature-tier matrix
- ✅ Toggle tier access for features
- ✅ Real-time updates with notifications

### Form Validation
- ✅ Display validation errors correctly
- ✅ Clear errors when fields are filled
- ✅ Validate all required fields

### Toast Notifications
- ✅ Success toasts for all operations
- ✅ Error toasts on failures
- ✅ Appropriate messages for each action

### Responsive Design
- ✅ Mobile viewport (320px)
- ✅ Tablet viewport (768px)
- ✅ Horizontal scroll for matrix on mobile
- ✅ Form layout adapts to screen size

### Data Persistence
- ✅ Features persist after page reload
- ✅ Tier changes persist after reload

### Error Handling
- ✅ Network errors handled gracefully
- ✅ Retry options on errors

### Performance
- ✅ Page loads within acceptable time
- ✅ Handles multiple features efficiently

## Prerequisites

1. **Backend Server**: Ensure the backend is running on `http://localhost:5000` (or set `E2E_API_URL`)
2. **Frontend Server**: Ensure the frontend is running on `http://localhost:3000` (or set `E2E_BASE_URL`)
3. **Test Users**: The following test users must exist in the database:
   - Super Admin: `superadmin@test.com` / `SuperAdmin123!`
   - Regular User: `user@test.com` / `User123!`

## Running the Tests

### Run all E2E tests
```bash
cd frontend
npm run test:e2e
```

### Run only feature management tests
```bash
npx playwright test featureManagement.e2e.test.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test featureManagement.e2e.test.ts --headed
```

### Run in debug mode
```bash
npx playwright test featureManagement.e2e.test.ts --debug
```

### Run specific test
```bash
npx playwright test featureManagement.e2e.test.ts -g "should create a new feature"
```

### Run on specific browser
```bash
npx playwright test featureManagement.e2e.test.ts --project=chromium
npx playwright test featureManagement.e2e.test.ts --project=firefox
npx playwright test featureManagement.e2e.test.ts --project=webkit
```

## Environment Variables

```bash
# Base URL for frontend
E2E_BASE_URL=http://localhost:3000

# Base URL for backend API
E2E_API_URL=http://localhost:5000
```

## Test Structure

```
featureManagement.e2e.test.ts
├── Authentication and Authorization
│   ├── Super admin access
│   ├── Non-super admin redirect
│   └── Unauthenticated redirect
├── Feature Creation
│   ├── Create new feature
│   ├── Validation tests
│   └── Success notifications
├── Feature Editing
│   ├── Edit existing feature
│   └── Cancel edit
├── Feature Deletion
│   ├── Delete with confirmation
│   └── Cancel deletion
├── Tier Feature Matrix
│   ├── Display matrix
│   └── Toggle tier access
├── Form Validation
├── Toast Notifications
├── Responsive Design
├── Data Persistence
├── Error Handling
└── Performance
```

## Helper Functions

### `loginAsSuperAdmin(page: Page)`
Logs in as a super admin user and navigates to dashboard.

### `loginAsRegularUser(page: Page)`
Logs in as a regular user (non-super admin) and navigates to dashboard.

### `navigateToFeatureManagement(page: Page)`
Navigates to the feature management page.

### `createFeature(page: Page, featureData?)`
Creates a new feature through the UI with the provided data.

## Debugging Tips

1. **View test report**:
   ```bash
   npx playwright show-report
   ```

2. **Take screenshots on failure**: Automatically enabled in config

3. **Record video on failure**: Automatically enabled in config

4. **Use Playwright Inspector**:
   ```bash
   npx playwright test --debug
   ```

5. **Check trace viewer**:
   ```bash
   npx playwright show-trace trace.zip
   ```

## Common Issues

### Tests fail with "Element not found"
- Ensure selectors match your actual implementation
- Check if elements are inside shadow DOM
- Verify timing - add appropriate waits

### Authentication fails
- Verify test users exist in database
- Check credentials match
- Ensure backend is running

### Timeouts
- Increase timeout in test or config
- Check network speed
- Verify backend is responding

### Flaky tests
- Add explicit waits for network requests
- Use `waitForLoadState('networkidle')`
- Avoid hard-coded timeouts, use `waitFor` methods

## CI/CD Integration

These tests are configured to run in CI/CD pipelines. The `playwright.config.ts` includes:
- Retry on failure (2 retries in CI)
- Parallel execution disabled in CI
- HTML, JSON, and JUnit reporters
- Screenshots and videos on failure

## Maintenance

When updating the feature management UI:
1. Update test selectors if element attributes change
2. Add new tests for new features
3. Update helper functions if workflows change
4. Keep test data in sync with validation rules

## Requirements Validation

These E2E tests validate all requirements from the specification:
- ✅ Requirement 1: Feature Flag CRUD Operations
- ✅ Requirement 2: Tier and Role Mapping
- ✅ Requirement 3: Feature Matrix UI
- ✅ Requirement 4: Bulk Operations
- ✅ Requirement 5: Role-Based Access Control
- ✅ Requirement 6: Real-Time Updates
- ✅ Requirement 9: User Interface Components
- ✅ Requirement 10: Backward Compatibility

## Contributing

When adding new E2E tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Add appropriate waits and assertions
4. Test both success and error cases
5. Consider responsive design
6. Update this README with new test coverage
