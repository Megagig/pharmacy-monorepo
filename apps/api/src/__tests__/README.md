# MTR Backend Test Suite

This directory contains comprehensive unit and integration tests for the Medication Therapy Review (MTR) backend module.

## Test Structure

```
__tests__/
├── setup.ts                    # Global test setup and utilities
├── runTests.ts                 # Test runner script
├── models/                     # Model unit tests
│   ├── MedicationTherapyReview.test.ts
│   ├── DrugTherapyProblem.test.ts
│   ├── MTRIntervention.test.ts
│   └── MTRFollowUp.test.ts
├── controllers/                # Controller unit tests
│   └── mtrController.test.ts
├── services/                   # Service unit tests
│   └── mtrService.test.ts
├── validators/                 # Validator unit tests
│   └── mtrValidators.test.ts
└── integration/                # Integration tests
    └── mtrIntegration.test.ts
```

## Test Categories

### Unit Tests

#### Models (`models/`)

- **MedicationTherapyReview.test.ts**: Tests for the main MTR model

  - Model creation and validation
  - Workflow step management
  - Virtual properties and methods
  - Pre-save middleware
  - Static methods
  - Clinical outcomes tracking

- **DrugTherapyProblem.test.ts**: Tests for drug therapy problem model

  - Problem creation and validation
  - Severity and priority calculations
  - Resolution tracking
  - Instance methods (resolve, reopen, isOverdue)
  - Static methods for querying

- **MTRIntervention.test.ts**: Tests for intervention model

  - Intervention creation and validation
  - Follow-up management
  - Outcome tracking
  - Virtual properties
  - Static methods for reporting

- **MTRFollowUp.test.ts**: Tests for follow-up model
  - Follow-up scheduling and validation
  - Reminder system
  - Status tracking and completion
  - Rescheduling functionality
  - Static methods for querying

#### Controllers (`controllers/`)

- **mtrController.test.ts**: Tests for MTR API endpoints
  - CRUD operations for MTR sessions
  - Workflow step management
  - Problem, intervention, and follow-up operations
  - Patient-specific operations
  - Error handling and validation
  - Authentication and authorization

#### Services (`services/`)

- **mtrService.test.ts**: Tests for business logic services
  - MTR workflow validation
  - Drug interaction checking
  - Problem generation from interactions
  - Step validation logic
  - Audit logging

#### Validators (`validators/`)

- **mtrValidators.test.ts**: Tests for input validation
  - Schema validation for all MTR operations
  - Field validation and constraints
  - Enum value validation
  - Length and format validation
  - Error message verification

### Integration Tests (`integration/`)

- **mtrIntegration.test.ts**: End-to-end workflow tests
  - Complete MTR workflow from creation to completion
  - Drug interaction checking integration
  - Reporting and analytics
  - Error scenario handling
  - Pagination and filtering
  - Performance and scalability tests

## Running Tests

### Prerequisites

1. Install dependencies:

   ```bash
   npm install
   ```

2. Ensure MongoDB Memory Server is available (installed automatically with dev dependencies)

### Test Commands

#### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

#### MTR-Specific Test Runner

```bash
# Run all MTR tests
npm run test:mtr

# Run specific test categories
npm run test:mtr unit
npm run test:mtr integration
npm run test:mtr controllers

# Run with options
npm run test:mtr unit --coverage
npm run test:mtr integration --watch
npm run test:mtr all --verbose
```

#### Direct Jest Commands

```bash
# Run specific test files
npx jest src/__tests__/models/MedicationTherapyReview.test.ts

# Run tests matching pattern
npx jest --testNamePattern="workflow"

# Run tests with coverage for specific files
npx jest --coverage --collectCoverageFrom="src/models/MedicationTherapyReview.ts"
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

- Uses `ts-jest` preset for TypeScript support
- In-memory MongoDB for database tests
- Coverage collection from source files
- 30-second timeout for integration tests
- Automatic mock clearing between tests

### Test Setup (`setup.ts`)

- MongoDB Memory Server setup and teardown
- Global test utilities and helpers
- Custom Jest matchers
- Mock data generators

## Test Utilities

### Global Test Utilities

Available via `global.testUtils`:

```typescript
// Create test ObjectIds
const id = testUtils.createObjectId();

// Create mock objects
const user = testUtils.createMockUser();
const workplace = testUtils.createMockWorkplace();
const patient = testUtils.createMockPatient();
```

### Custom Jest Matchers

```typescript
// Validate MongoDB ObjectIds
expect(someId).toBeValidObjectId();
```

## Test Data Management

### Database Cleanup

- Automatic cleanup after each test
- Fresh database state for each test
- No test data pollution between tests

### Mock Data

- Consistent mock data generators
- Realistic test scenarios
- Edge case coverage

## Coverage Goals

### Target Coverage Metrics

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI/CD
- `coverage/coverage-final.json` - JSON format

## Best Practices

### Test Organization

1. **Arrange-Act-Assert**: Clear test structure
2. **Descriptive Names**: Test names explain what is being tested
3. **Single Responsibility**: Each test focuses on one aspect
4. **Independent Tests**: No dependencies between tests

### Test Data

1. **Fresh Data**: Create new test data for each test
2. **Realistic Scenarios**: Use realistic medical data
3. **Edge Cases**: Test boundary conditions and error scenarios
4. **Data Cleanup**: Automatic cleanup prevents pollution

### Assertions

1. **Specific Assertions**: Test exact expected values
2. **Error Testing**: Verify error messages and types
3. **State Verification**: Check database state after operations
4. **Side Effects**: Verify all expected side effects

## Debugging Tests

### Common Issues

1. **Timeout Errors**: Increase timeout for slow operations
2. **Database Conflicts**: Ensure proper cleanup between tests
3. **Mock Issues**: Verify mocks are properly reset
4. **Async Issues**: Use proper async/await patterns

### Debugging Commands

```bash
# Run single test with debugging
npx jest --runInBand --detectOpenHandles src/__tests__/models/MedicationTherapyReview.test.ts

# Run with verbose output
npx jest --verbose --no-cache

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Continuous Integration

### CI/CD Integration

Tests are designed to run in CI/CD environments:

- No external dependencies (uses in-memory database)
- Deterministic test results
- Proper exit codes for build systems
- Coverage reporting for quality gates

### Environment Variables

Tests respect these environment variables:

- `NODE_ENV=test` - Ensures test environment
- `JEST_TIMEOUT` - Override default timeout
- `MONGODB_URI` - Override database (falls back to memory server)

## Contributing

### Adding New Tests

1. Follow existing test structure and naming conventions
2. Add tests for new models, controllers, or services
3. Ensure good coverage of happy path and error scenarios
4. Update this README if adding new test categories

### Test Guidelines

1. **Comprehensive Coverage**: Test all public methods and edge cases
2. **Performance Awareness**: Avoid unnecessarily slow tests
3. **Maintainability**: Write clear, readable tests
4. **Documentation**: Comment complex test scenarios

## Troubleshooting

### Common Solutions

1. **Memory Issues**: Increase Node.js memory limit
2. **Port Conflicts**: MongoDB Memory Server handles port allocation
3. **Timeout Issues**: Adjust Jest timeout configuration
4. **Coverage Issues**: Check file paths in coverage configuration

### Getting Help

1. Check Jest documentation for configuration issues
2. Review MongoDB Memory Server docs for database issues
3. Consult test files for examples of specific testing patterns
4. Check CI/CD logs for environment-specific issues
