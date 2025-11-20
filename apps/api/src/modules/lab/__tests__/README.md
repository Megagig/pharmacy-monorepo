# Manual Lab Module - Comprehensive Test Suite

This directory contains comprehensive tests for the Manual Lab Order workflow, covering all aspects from unit tests to end-to-end workflow validation.

## Test Structure

### 1. Unit Tests

#### Models (`comprehensive-models.test.ts`)

- **ManualLabOrder Model**: Creation, validation, instance methods, static methods, virtual properties
- **ManualLabResult Model**: Result entry, interpretation, AI processing, quality control
- **TestCatalog Model**: Test management, activation/deactivation, cost updates

#### Services (`comprehensive-services.test.ts`)

- **ManualLabService**: Order management, result processing, token resolution
- **Business Logic**: Validation, status transitions, audit logging
- **Error Handling**: Database errors, validation failures, external service failures

#### Token Service (`comprehensive-token-service.test.ts`)

- **Security**: Token generation, validation, hashing, expiration
- **QR/Barcode**: Data generation, parsing, format validation
- **Performance**: High-volume generation, concurrent access

### 2. Integration Tests

#### API Endpoints (`comprehensive-api-integration.test.ts`)

- **Authentication**: JWT validation, role-based access control
- **Order Management**: Create, retrieve, update, list orders
- **Result Management**: Add results, retrieve results, validation
- **PDF Generation**: Serve PDFs, security headers, rate limiting
- **Token Scanning**: QR/barcode resolution, mobile workflows
- **Error Handling**: Validation errors, business rule violations

### 3. End-to-End Tests

#### Complete Workflows (`comprehensive-e2e-workflow.test.ts`)

- **Full Workflow**: Order creation → PDF generation → status updates → result entry → AI interpretation
- **Mobile Workflow**: QR scanning → mobile result entry → mobile PDF access
- **AI Integration**: Normal results, critical results with red flags, service failures
- **Notifications**: Critical alerts, patient notifications, delivery failures
- **Error Recovery**: Concurrent operations, partial completion, business rule validation
- **Performance**: Large datasets, concurrent workflows, scalability

## Running Tests

### Individual Test Suites

```bash
# Unit tests - Models
npm run test:manual-lab:models

# Unit tests - Services
npm run test:manual-lab:services

# Unit tests - Token Service
npm run test:manual-lab:tokens

# Integration tests - API
npm run test:manual-lab:api

# End-to-end tests - Workflow
npm run test:manual-lab:e2e
```

### All Tests

```bash
# Run all comprehensive tests
npm run test:manual-lab:comprehensive

# Run with coverage
npm run test:manual-lab:comprehensive -- --coverage

# Run with verbose output
npm run test:manual-lab:comprehensive -- --verbose
```

### Using the Test Runner

```bash
# Direct execution
npx ts-node backend/src/modules/lab/__tests__/run-comprehensive-tests.ts

# With coverage
npx ts-node backend/src/modules/lab/__tests__/run-comprehensive-tests.ts --coverage
```

## Test Configuration

### Environment Variables

The tests require these environment variables:

```bash
JWT_SECRET=test-jwt-secret-key-for-testing-minimum-32-characters-long
LAB_TOKEN_SECRET=test-lab-token-secret-key-minimum-32-characters-long
FRONTEND_URL=https://test.PharmacyCopilot.com
NODE_ENV=test
```

### Database

Tests use MongoDB Memory Server for isolated testing:

- Each test suite gets a fresh database instance
- No external database dependencies
- Automatic cleanup after tests

### Mocked Services

External services are mocked for consistent testing:

- **PDF Generation Service**: Returns mock PDF buffers
- **Audit Service**: Logs activities without external dependencies
- **OpenRouter/AI Service**: Returns mock diagnostic results
- **Notification Service**: Simulates SMS/email delivery

## Coverage Goals

### Target Metrics

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Coverage Areas

- **Models**: Schema validation, instance methods, static methods
- **Services**: Business logic, error handling, external integrations
- **Controllers**: Request handling, response formatting, error cases
- **Utilities**: Token management, PDF generation, validation

## Test Data

### Fixtures

- **Test Workplace**: Pharmacy with valid license
- **Test User**: Pharmacist with proper roles
- **Test Patient**: Patient with complete demographics
- **Test Orders**: Various order configurations and priorities
- **Test Results**: Normal, abnormal, and critical values

### Scenarios Covered

- **Happy Path**: Complete successful workflows
- **Error Cases**: Validation failures, business rule violations
- **Edge Cases**: Concurrent access, large datasets, service failures
- **Security**: Authentication, authorization, token validation
- **Performance**: High-volume operations, concurrent workflows

## Debugging Tests

### Common Issues

1. **Timeout Errors**

   ```bash
   # Increase timeout for slow tests
   npm run test:manual-lab:e2e -- --testTimeout=120000
   ```

2. **Database Connection Issues**

   ```bash
   # Run with open handles detection
   npm run test:manual-lab:comprehensive -- --detectOpenHandles
   ```

3. **Mock Issues**
   ```bash
   # Clear Jest cache
   npm run test:manual-lab:comprehensive -- --no-cache
   ```

### Debug Mode

```bash
# Run with Node.js debugger
node --inspect-brk node_modules/.bin/jest backend/src/modules/lab/__tests__/comprehensive-models.test.ts

# Run single test with verbose output
npm run test:manual-lab:models -- --verbose --testNamePattern="should create a valid manual lab order"
```

## Continuous Integration

### GitHub Actions

```yaml
name: Manual Lab Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:manual-lab:comprehensive -- --coverage
      - uses: codecov/codecov-action@v1
```

### Pre-commit Hooks

```bash
# Install husky for pre-commit hooks
npm install --save-dev husky

# Add pre-commit test hook
npx husky add .husky/pre-commit "npm run test:manual-lab:comprehensive"
```

## Contributing

### Adding New Tests

1. **Follow Naming Convention**: `describe('Feature - Test Category')`
2. **Use Proper Setup**: `beforeEach` for test data, `afterEach` for cleanup
3. **Test Edge Cases**: Include error scenarios and boundary conditions
4. **Mock External Services**: Use consistent mocking patterns
5. **Document Test Purpose**: Clear descriptions of what each test validates

### Test Guidelines

1. **Isolation**: Each test should be independent
2. **Deterministic**: Tests should produce consistent results
3. **Fast**: Unit tests <1s, integration tests <5s, E2E tests <30s
4. **Readable**: Clear test names and assertions
5. **Maintainable**: Easy to update when code changes

## Troubleshooting

### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run test:manual-lab:comprehensive
```

### Port Conflicts

```bash
# MongoDB Memory Server handles port allocation automatically
# No manual port configuration needed
```

### Jest Configuration

```bash
# Check Jest configuration
npx jest --showConfig
```

For additional help, check the main test documentation or contact the development team.
