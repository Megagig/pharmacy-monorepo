module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/tests/**/*',
    '!src/__tests__/**/*'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@/middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@/models/(.*)$': '<rootDir>/src/models/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true
};