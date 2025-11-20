# Task 18: E2E Tests - Quick Start Guide

## 🚀 Quick Start

### 1. Prerequisites

Ensure you have test users in your database:

```bash
# Super Admin
Email: superadmin@test.com
Password: SuperAdmin123!
Role: super_admin

# Regular User
Email: user@test.com
Password: User123!
Role: pharmacist
```

### 2. Start Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 3. Run Tests

```bash
# Terminal 3: Tests
cd frontend

# Run all feature management E2E tests
npm run test:e2e:feature-management

# OR run with visible browser (recommended for first run)
npm run test:e2e:feature-management:headed
```

## 📊 View Results

```bash
# View HTML report
npm run test:e2e:report

# Report opens automatically in browser
```

## 🐛 Debug Failing Tests

```bash
# Run in debug mode with Playwright Inspector
npm run test:e2e:feature-management:debug

# Run specific test
npx playwright test featureManagement.e2e.test.ts -g "should create a new feature"
```

## 📝 Test Coverage

The E2E test suite includes **40+ test cases** covering:

✅ Authentication & Authorization (3 tests)
✅ Feature Creation (6 tests)
✅ Feature Editing (2 tests)
✅ Feature Deletion (2 tests)
✅ Tier Feature Matrix (4 tests)
✅ Form Validation (3 tests)
✅ Toast Notifications (3 tests)
✅ Responsive Design (4 tests)
✅ Data Persistence (2 tests)
✅ Error Handling (2 tests)
✅ Performance (2 tests)

## 🔧 Common Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npx playwright test featureManagement.e2e.test.ts --ui

# Run on specific browser
npx playwright test featureManagement.e2e.test.ts --project=chromium
npx playwright test featureManagement.e2e.test.ts --project=firefox
npx playwright test featureManagement.e2e.test.ts --project=webkit

# Update snapshots (if using visual regression)
npx playwright test featureManagement.e2e.test.ts --update-snapshots
```

## 🎯 Test Specific Scenarios

```bash
# Test authentication only
npx playwright test featureManagement.e2e.test.ts -g "Authentication"

# Test CRUD operations only
npx playwright test featureManagement.e2e.test.ts -g "Feature Creation|Feature Editing|Feature Deletion"

# Test responsive design only
npx playwright test featureManagement.e2e.test.ts -g "Responsive Design"

# Test matrix functionality only
npx playwright test featureManagement.e2e.test.ts -g "Tier Feature Matrix"
```

## 📱 Test Different Viewports

```bash
# Mobile viewport
npx playwright test featureManagement.e2e.test.ts --project="Mobile Chrome"

# Tablet viewport
npx playwright test featureManagement.e2e.test.ts --project="Mobile Safari"

# Desktop
npx playwright test featureManagement.e2e.test.ts --project=chromium
```

## 🔍 Debugging Tips

### View Trace
```bash
# Generate trace
npx playwright test featureManagement.e2e.test.ts --trace on

# View trace
npx playwright show-trace trace.zip
```

### Screenshots
Screenshots are automatically captured on failure in `test-results/`

### Videos
Videos are automatically recorded on failure in `test-results/`

### Console Logs
```bash
# Run with console output
DEBUG=pw:api npx playwright test featureManagement.e2e.test.ts
```

## ⚠️ Troubleshooting

### Tests Fail with "Element not found"
- Check if selectors match your implementation
- Add explicit waits: `await page.waitForSelector('selector')`
- Verify element is not in shadow DOM

### Authentication Fails
- Verify test users exist in database
- Check credentials are correct
- Ensure backend is running

### Timeouts
- Increase timeout: `test.setTimeout(60000)`
- Check network speed
- Verify backend is responding

### Flaky Tests
- Add `waitForLoadState('networkidle')`
- Use explicit waits instead of `waitForTimeout`
- Check for race conditions

## 📚 Documentation

- **Full Documentation**: `frontend/src/__tests__/e2e/README.md`
- **Implementation Details**: `frontend/TASK_18_E2E_TESTS_IMPLEMENTATION.md`
- **Verification Checklist**: `frontend/TASK_18_VERIFICATION_CHECKLIST.md`

## 🎉 Success Indicators

Tests are working correctly when you see:
- ✅ All tests passing (40+ tests)
- ✅ No console errors
- ✅ Test report generated
- ✅ Screenshots/videos only on failures
- ✅ Execution time < 5 minutes

## 🚨 Need Help?

1. Check the full documentation in `frontend/src/__tests__/e2e/README.md`
2. Review the implementation summary in `TASK_18_E2E_TESTS_IMPLEMENTATION.md`
3. Run tests in debug mode: `npm run test:e2e:feature-management:debug`
4. Check Playwright documentation: https://playwright.dev/

## 📦 CI/CD Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: npm run test:e2e:feature-management
  env:
    E2E_BASE_URL: http://localhost:3000
    E2E_API_URL: http://localhost:5000

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## ✨ Next Steps

1. Run tests locally to verify everything works
2. Review test report for any issues
3. Integrate with CI/CD pipeline
4. Set up automated test runs
5. Monitor test health over time

---

**Quick Reference Card**

```bash
# Most Common Commands
npm run test:e2e:feature-management          # Run tests
npm run test:e2e:feature-management:headed   # Run with browser
npm run test:e2e:feature-management:debug    # Debug mode
npm run test:e2e:report                      # View report
```

**Test File Location**: `frontend/src/__tests__/e2e/featureManagement.e2e.test.ts`

**Status**: ✅ Ready to use
