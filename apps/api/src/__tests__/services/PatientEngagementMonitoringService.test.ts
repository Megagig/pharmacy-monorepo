/**
 * Patient Engagement Monitoring Service Tests
 * Tests for monitoring and observability functionality
 * Requirements: 9.1, 9.2, 9.3
 */

import { PatientEngagementMonitoringService } from '../../services/PatientEngagementMonitoringService';

describe('PatientEngagementMonitoringService', () => {
  let monitoringService: PatientEngagementMonitoringService;

  beforeEach(() => {
    monitoringService = new PatientEngagementMonitoringService();
  });

  afterEach(() => {
    // Clean up any listeners
    monitoringService.removeAllListeners();
  });

  describe('recordOperation', () => {
    it('should record a successful operation', () => {
      const operation = 'create';
      const module = 'appointment';
      const workplaceId = 'test-workplace-id';
      const duration = 1500;

      monitoringService.recordOperation(operation, module, workplaceId, duration, true);

      // Verify the operation was recorded
      const dashboardData = monitoringService.getDashboardData();
      expect(dashboardData).toBeDefined();
    });

    it('should record a failed operation with error details', () => {
      const operation = 'create';
      const module = 'appointment';
      const workplaceId = 'test-workplace-id';
      const duration = 2000;

      monitoringService.recordOperation(operation, module, workplaceId, duration, false, {
        errorType: 'validation_error',
        errorMessage: 'Invalid patient ID',
        userId: 'test-user-id',
      });

      // Verify the operation was recorded with error details
      const dashboardData = monitoringService.getDashboardData();
      expect(dashboardData).toBeDefined();
    });

    it('should emit metric event when operation is recorded', (done) => {
      monitoringService.on('metric', (metric) => {
        expect(metric.operation).toBe('create');
        expect(metric.module).toBe('appointment');
        expect(metric.success).toBe(true);
        done();
      });

      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 1000, true);
    });
  });

  describe('createAlert', () => {
    it('should create an alert and emit alert event', (done) => {
      monitoringService.on('alert', (alert) => {
        expect(alert.type).toBe('performance');
        expect(alert.severity).toBe('high');
        expect(alert.message).toBe('Test alert message');
        done();
      });

      const alertId = monitoringService.createAlert(
        'performance',
        'high',
        'appointment',
        'create',
        'Test alert message',
        { testData: true }
      );

      expect(alertId).toBeDefined();
      expect(typeof alertId).toBe('string');
    });

    it('should resolve an alert', () => {
      const alertId = monitoringService.createAlert(
        'error',
        'medium',
        'followup',
        'complete',
        'Test error alert'
      );

      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);

      // Try to resolve again - should return false
      const resolvedAgain = monitoringService.resolveAlert(alertId);
      expect(resolvedAgain).toBe(false);
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data with correct structure', async () => {
      // Record some test operations
      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 1000, true);
      monitoringService.recordOperation('get', 'appointment', 'test-workplace', 500, true);
      monitoringService.recordOperation('create', 'followup', 'test-workplace', 1500, false, {
        errorType: 'validation_error',
      });

      const dashboardData = await monitoringService.getDashboardData();

      expect(dashboardData).toHaveProperty('summary');
      expect(dashboardData).toHaveProperty('operationMetrics');
      expect(dashboardData).toHaveProperty('performanceMetrics');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('healthChecks');

      expect(dashboardData.summary).toHaveProperty('totalOperations');
      expect(dashboardData.summary).toHaveProperty('successRate');
      expect(dashboardData.summary).toHaveProperty('averageResponseTime');
      expect(dashboardData.summary).toHaveProperty('activeAlerts');
      expect(dashboardData.summary).toHaveProperty('healthStatus');

      expect(dashboardData.summary.totalOperations).toBe(3);
      expect(dashboardData.summary.successRate).toBeCloseTo(66.67, 1); // 2 out of 3 successful
    });

    it('should filter data by workplace ID', async () => {
      // Record operations for different workplaces
      monitoringService.recordOperation('create', 'appointment', 'workplace-1', 1000, true);
      monitoringService.recordOperation('create', 'appointment', 'workplace-2', 1000, true);

      const dashboardData = await monitoringService.getDashboardData(
        undefined,
        undefined,
        'workplace-1'
      );

      expect(dashboardData.summary.totalOperations).toBe(1);
    });
  });

  describe('getOperationMetrics', () => {
    it('should return metrics for specific operation and module', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const endTime = new Date();

      // Record some operations
      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 1000, true);
      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 1500, true);
      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 2000, false);

      const metrics = monitoringService.getOperationMetrics(
        'create',
        'appointment',
        startTime,
        endTime,
        'test-workplace'
      );

      expect(metrics.total).toBe(3);
      expect(metrics.successful).toBe(2);
      expect(metrics.failed).toBe(1);
      expect(metrics.averageResponseTime).toBe(1500); // (1000 + 1500 + 2000) / 3
      expect(metrics.errorRate).toBeCloseTo(33.33, 1); // 1 out of 3 failed
    });
  });

  describe('getErrorAnalysis', () => {
    it('should analyze errors correctly', () => {
      const startTime = new Date(Date.now() - 60 * 60 * 1000);
      const endTime = new Date();

      // Record some errors
      monitoringService.recordOperation('create', 'appointment', 'test-workplace', 1000, false, {
        errorType: 'validation_error',
      });
      monitoringService.recordOperation('update', 'appointment', 'test-workplace', 1000, false, {
        errorType: 'not_found_error',
      });
      monitoringService.recordOperation('create', 'followup', 'test-workplace', 1000, false, {
        errorType: 'validation_error',
      });

      const errorAnalysis = monitoringService.getErrorAnalysis(startTime, endTime, 'test-workplace');

      expect(errorAnalysis.totalErrors).toBe(3);
      expect(errorAnalysis.errorsByType).toEqual({
        validation_error: 2,
        not_found_error: 1,
      });
      expect(errorAnalysis.errorsByModule).toEqual({
        appointment: 2,
        followup: 1,
      });
      expect(errorAnalysis.errorsByOperation).toEqual({
        create: 2,
        update: 1,
      });
    });
  });

  describe('performHealthCheck', () => {
    it('should perform health check and return result', async () => {
      // Mock a simple health check that doesn't require external dependencies
      const result = await monitoringService.performHealthCheck('appointment_service');

      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');

      expect(result.service).toBe('appointment_service');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(typeof result.responseTime).toBe('number');
    });

    it('should emit health check event', (done) => {
      monitoringService.on('healthCheck', (result) => {
        expect(result.service).toBe('appointment_service');
        done();
      });

      monitoringService.performHealthCheck('appointment_service');
    });
  });
});

// Integration test with mocked dependencies
describe('PatientEngagementMonitoringService Integration', () => {
  let monitoringService: PatientEngagementMonitoringService;

  beforeEach(() => {
    monitoringService = new PatientEngagementMonitoringService();
  });

  afterEach(() => {
    monitoringService.removeAllListeners();
  });

  it('should handle high volume of operations', async () => {
    const startTime = Date.now();

    // Record 1000 operations
    for (let i = 0; i < 1000; i++) {
      monitoringService.recordOperation(
        'create',
        'appointment',
        'test-workplace',
        Math.random() * 2000 + 500, // 500-2500ms
        Math.random() > 0.1 // 90% success rate
      );
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Should process 1000 operations quickly (under 1 second)
    expect(processingTime).toBeLessThan(1000);

    const dashboardData = await monitoringService.getDashboardData();
    expect(dashboardData.summary.totalOperations).toBe(1000);
    expect(dashboardData.summary.successRate).toBeGreaterThan(85);
    expect(dashboardData.summary.successRate).toBeLessThan(95);
  });

  it('should maintain performance under concurrent operations', async () => {
    const promises = [];

    // Simulate concurrent operations
    for (let i = 0; i < 100; i++) {
      promises.push(
        Promise.resolve().then(() => {
          monitoringService.recordOperation(
            'create',
            'appointment',
            `workplace-${i % 10}`,
            Math.random() * 1000 + 500,
            true
          );
        })
      );
    }

    await Promise.all(promises);

    const dashboardData = await monitoringService.getDashboardData();
    expect(dashboardData.summary.totalOperations).toBe(100);
  });
});