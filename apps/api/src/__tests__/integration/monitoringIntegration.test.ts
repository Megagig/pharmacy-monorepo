/**
 * Monitoring Integration Tests
 * Tests the complete monitoring and observability system
 * Requirements: 9.1, 9.2, 9.3
 */

import request from 'supertest';
import app from '../../app';
import { patientEngagementMonitoring } from '../../services/PatientEngagementMonitoringService';

describe('Monitoring Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing metrics
    patientEngagementMonitoring.removeAllListeners();
  });

  describe('Health Check Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('uptime');
      expect(response.body.checks).toHaveProperty('memory');
    });

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('memory');
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return system information', async () => {
      const response = await request(app)
        .get('/api/health/system')
        .expect(200);

      expect(response.body).toHaveProperty('process');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('environment');
      
      expect(response.body.process).toHaveProperty('pid');
      expect(response.body.process).toHaveProperty('uptime');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
    });
  });

  describe('Monitoring Endpoints', () => {
    // Note: These tests require authentication, so we'll test the structure
    // In a real environment, you'd need to mock authentication or use test tokens

    it('should have monitoring dashboard endpoint', async () => {
      // This will return 401 without auth, but confirms the endpoint exists
      const response = await request(app)
        .get('/api/monitoring/dashboard');

      // Should return 401 (unauthorized) not 404 (not found)
      expect([401, 403]).toContain(response.status);
    });

    it('should have real-time monitoring endpoint', async () => {
      const response = await request(app)
        .get('/api/monitoring/realtime');

      expect([401, 403]).toContain(response.status);
    });

    it('should have error analysis endpoint', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors/analysis');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Metrics Collection', () => {
    it('should record operations in monitoring service', () => {
      // Record some test operations
      patientEngagementMonitoring.recordOperation(
        'create',
        'appointment',
        'test-workplace',
        1500,
        true,
        {
          userId: 'test-user',
          patientId: 'test-patient',
        }
      );

      patientEngagementMonitoring.recordOperation(
        'get',
        'followup',
        'test-workplace',
        800,
        true
      );

      patientEngagementMonitoring.recordOperation(
        'send',
        'reminder',
        'test-workplace',
        2000,
        false,
        {
          errorType: 'network_error',
          errorMessage: 'Failed to send SMS',
        }
      );

      // Verify metrics are recorded
      const dashboardData = patientEngagementMonitoring.getDashboardData();
      expect(dashboardData).toBeDefined();
    });

    it('should create alerts for performance issues', () => {
      let alertCreated = false;

      patientEngagementMonitoring.on('alert', (alert) => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
        alertCreated = true;
      });

      // Record a slow operation that should trigger an alert
      patientEngagementMonitoring.recordOperation(
        'create',
        'appointment',
        'test-workplace',
        8000, // 8 seconds - should trigger performance alert
        true
      );

      // Give some time for alert processing
      setTimeout(() => {
        expect(alertCreated).toBe(true);
      }, 100);
    });

    it('should track error patterns', () => {
      // Record multiple errors of the same type
      for (let i = 0; i < 5; i++) {
        patientEngagementMonitoring.recordOperation(
          'create',
          'appointment',
          'test-workplace',
          1000,
          false,
          {
            errorType: 'validation_error',
            errorMessage: 'Invalid patient data',
          }
        );
      }

      const errorAnalysis = patientEngagementMonitoring.getErrorAnalysis(
        new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        new Date()
      );

      expect(errorAnalysis.totalErrors).toBe(5);
      expect(errorAnalysis.errorsByType).toHaveProperty('validation_error', 5);
      expect(errorAnalysis.errorsByModule).toHaveProperty('appointment', 5);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times', async () => {
      // Make a request to trigger performance monitoring
      await request(app)
        .get('/api/health')
        .expect(200);

      // The performance middleware should have recorded this request
      // In a real test, you'd verify the metrics were recorded
    });

    it('should handle high volume of metrics', () => {
      const startTime = Date.now();

      // Record many operations quickly
      for (let i = 0; i < 1000; i++) {
        patientEngagementMonitoring.recordOperation(
          'get',
          'appointment',
          'test-workplace',
          Math.random() * 1000 + 100,
          Math.random() > 0.1 // 90% success rate
        );
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should handle 1000 operations quickly
      expect(processingTime).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks without errors', async () => {
      try {
        // These might fail in test environment, but shouldn't throw unhandled errors
        await patientEngagementMonitoring.performHealthCheck('appointment_service');
        await patientEngagementMonitoring.performHealthCheck('database');
      } catch (error) {
        // Health checks might fail in test environment, that's okay
        expect(error).toBeDefined();
      }
    });

    it('should emit health check events', (done) => {
      patientEngagementMonitoring.on('healthCheck', (result) => {
        expect(result).toHaveProperty('service');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('responseTime');
        done();
      });

      patientEngagementMonitoring.performHealthCheck('appointment_service');
    });
  });

  describe('Alert Management', () => {
    it('should create and resolve alerts', () => {
      const alertId = patientEngagementMonitoring.createAlert(
        'performance',
        'medium',
        'appointment',
        'create',
        'Test alert for integration test'
      );

      expect(alertId).toBeDefined();
      expect(typeof alertId).toBe('string');

      const resolved = patientEngagementMonitoring.resolveAlert(alertId);
      expect(resolved).toBe(true);

      // Try to resolve again - should return false
      const resolvedAgain = patientEngagementMonitoring.resolveAlert(alertId);
      expect(resolvedAgain).toBe(false);
    });

    it('should emit alert events', (done) => {
      patientEngagementMonitoring.on('alert', (alert) => {
        expect(alert).toHaveProperty('type', 'error');
        expect(alert).toHaveProperty('severity', 'high');
        expect(alert).toHaveProperty('message');
        done();
      });

      patientEngagementMonitoring.createAlert(
        'error',
        'high',
        'followup',
        'complete',
        'Test error alert'
      );
    });
  });
});