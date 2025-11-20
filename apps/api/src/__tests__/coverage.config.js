module.exports = {
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical modules
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/controllers/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/models/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage collection patterns
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/app.ts',
    '!src/config/**',
    '!src/scripts/**',
    '!src/types/**',
    '!src/__tests__/**',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}'
  ],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'cobertura'
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/__tests__/',
    '/coverage/'
  ]
};