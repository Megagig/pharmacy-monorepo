const Sequencer = require('@jest/test-sequencer').default;

class DiagnosticTestSequencer extends Sequencer {
  sort(tests) {
    // Define test execution order for optimal performance and dependency management
    const testOrder = [
      // 1. Unit tests first (fastest, no dependencies)
      'unit',
      'service',
      'controller',
      'model',
      'middleware',
      'validator',

      // 2. Integration tests (moderate speed, some dependencies)
      'integration',
      'crossModule',

      // 3. End-to-end tests (slower, full system)
      'e2e',
      'completeUserJourney',

      // 4. Performance tests (resource intensive)
      'performance',
      'loadTesting',

      // 5. Security tests (may modify system state)
      'security',
      'penetration',

      // 6. Audit tests (logging and compliance)
      'audit',
      'compliance',
    ];

    return tests.sort((testA, testB) => {
      const getTestPriority = (testPath) => {
        for (let i = 0; i < testOrder.length; i++) {
          if (testPath.includes(testOrder[i])) {
            return i;
          }
        }
        return testOrder.length; // Unknown tests go last
      };

      const priorityA = getTestPriority(testA.path);
      const priorityB = getTestPriority(testB.path);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically for consistency
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = DiagnosticTestSequencer;
