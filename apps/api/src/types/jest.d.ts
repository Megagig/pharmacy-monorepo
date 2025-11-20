/// <reference types="jest" />

// Extend Jest matchers if needed
declare namespace jest {
  interface Matchers<R> {
    // Add custom matchers here if needed
  }
}

// Ensure Jest globals are available
declare global {
  var describe: jest.Describe;
  var it: jest.It;
  var test: jest.It;
  var expect: jest.Expect;
  var beforeAll: jest.Lifecycle;
  var afterAll: jest.Lifecycle;
  var beforeEach: jest.Lifecycle;
  var afterEach: jest.Lifecycle;
  var jest: typeof import('jest');
}

export {};