# MTR End-to-End Testing

This directory contains comprehensive end-to-end tests for the Medication Therapy Review (MTR) module using Playwright.

## Test Structure

### Test Files

- **`mtr-complete-workflow.spec.ts`** - Tests the complete MTR workflow from patient selection to completion
- **`mtr-error-scenarios.spec.ts`** - Tests error handling and recovery mechanisms
- **`mtr-mobile-responsive.spec.ts`** - Tests mobile and responsive design functionality
- **`mtr-performance.spec.ts`** - Tests performance with large datasets and concurrent operations

### Utility Files

- **`utils/auth-helper.ts`** - Authentication helper for login/logout operations
- **`utils/mtr-helper.ts`** - MTR-specific helper functions for workflow operations
- **`utils/test-data.ts`** - Test data definitions and sample datasets

### Configuration Files

- **`global-setup.ts`** - Global test setup including server startup and test data creation
- **`global-teardown.ts`** - Global test cleanup
- **`playwright.config.ts`** - Playwright configuration for browsers, devices, and test settings

## Running Tests

### Prerequisites

1. Ensure both frontend and backend servers are available
2. Install dependencies: `npm install`
3. Install Playwright browsers: `npx playwright install`

### Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Run specific test file
npx playwright test mtr-complete-workflow.spec.ts

# Run tests on specific browser
npx playwright test --project=chromium

# Run tests on mobile device
npx playwright test --project="Mobile Chrome"
```

## Test Coverage

### Complete Workflow Tests

- ✅ Full MTR session from patient selection to completion
- ✅ Complex MTR with multiple medications and problems
- ✅ Data persistence across step navigation
- ✅ Step navigation validation
- ✅ Auto-save functionality
- ✅ Field validation
- ✅ Concurrent MTR sessions

### Error Scenarios

- ✅ Network failure handling
- ✅ Server error recovery
- ✅ Invalid input validation
- ✅ Session timeout handling
- ✅ Browser crash recovery
- ✅ Concurrent user conflicts
- ✅ Large dataset performance
- ✅ Malicious input sanitization

### Mobile & Responsive

- ✅ Mobile device workflow completion
- ✅ Touch gesture handling
- ✅ Offline functionality
- ✅ Tablet layout optimization
- ✅ Responsive breakpoint testing
- ✅ Cross-screen functionality
- ✅ Mobile accessibility
- ✅ Voice input support

### Performance Tests

- ✅ Large medication list handling (50+ items)
- ✅ Concurrent operations performance
- ✅ Rapid user interaction handling
- ✅ Memory usage optimization
- ✅ Initial load performance
- ✅ Network latency handling
- ✅ Auto-save performance

## Test Data

The tests use predefined test data including:

- **Test Users**: E2E pharmacist accounts with proper credentials
- **Test Patients**: Sample patient records for MTR sessions
- **Sample Medications**: Various medication types for testing
- **Problem Scenarios**: Different drug therapy problems
- **Performance Data**: Large datasets for performance testing

## Browser Support

Tests run on multiple browsers and devices:

- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: iPhone 12, Pixel 5
- **Tablet**: iPad Pro
- **Custom**: Various screen sizes and resolutions

## Debugging

### Debug Mode

```bash
npm run test:e2e:debug
```

### Screenshots and Videos

- Screenshots are captured on test failures
- Videos are recorded for failed tests
- Traces are collected for debugging

### Logs

- Console logs are captured during test execution
- Network requests are logged for API testing
- Performance metrics are collected

## CI/CD Integration

The tests are configured for CI/CD environments:

- Automatic server startup/shutdown
- Headless browser execution
- Parallel test execution
- Test result reporting
- Artifact collection (screenshots, videos, reports)

## Best Practices

1. **Test Isolation**: Each test is independent and can run in any order
2. **Data Cleanup**: Tests clean up after themselves
3. **Realistic Scenarios**: Tests simulate real user workflows
4. **Error Handling**: Tests verify proper error handling and recovery
5. **Performance**: Tests ensure acceptable performance under load
6. **Accessibility**: Tests verify accessibility compliance
7. **Cross-Platform**: Tests work across different browsers and devices

## Troubleshooting

### Common Issues

1. **Server Not Starting**: Ensure backend is available on port 3000
2. **Frontend Not Loading**: Ensure frontend is available on port 5173
3. **Test Timeouts**: Increase timeout values for slow operations
4. **Browser Issues**: Update Playwright browsers with `npx playwright install`
5. **Network Issues**: Check firewall and proxy settings

### Debug Tips

1. Use `--headed` flag to see browser actions
2. Add `await page.pause()` to pause execution
3. Use `--debug` flag for step-by-step debugging
4. Check browser console for JavaScript errors
5. Verify test data setup in global-setup.ts

## Contributing

When adding new E2E tests:

1. Follow the existing test structure
2. Use the helper classes for common operations
3. Add appropriate test data to `test-data.ts`
4. Include error scenarios and edge cases
5. Test on multiple browsers and devices
6. Update this README with new test coverage
