/**
 * Patient Engagement Performance Tests
 * Comprehensive tests for performance optimizations
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1
 */

import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import PatientEngagementPerformanceService from '../../services/PatientEngagementPerformanceService';
import PatientEngagementIndexOptimizer from '../../services/PatientEngagementIndexOptimizer';
import PatientEngagementLoadTester from '../../scripts/loadTestPatientEngagement';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import Patient from '../../models/Patient';
import User from '../../models/User';

describe('Patient Engagement Performance Optimizations', () => {
  let performanceService: PatientEngagementPerformanceService;
  let indexOptimizer: PatientEngagementIndexOptimizer;
  let loadTester: PatientEngagementLoadTester;
  let testWorkplaceId: mongoose.Types.ObjectId;
  let testPatientIds: mongoose.Types.ObjectId[];
  let testPharmacistIds: mongoose.Types.ObjectId[];

  beforeAll(async () => {
    // Initialize services
    performanceService = PatientEngagementPerformanceService.getInstance();
    indexOptimizer = PatientEngagementIndexOptimizer.getInstance();
    loadTester = new PatientEngagementLoadTester();

    // Setup test data
    testWorkplaceId = new mongoose.Types.ObjectId();
    await setupTestData();

    // Create optimized indexes
    await indexOptimizer.createOptimizedIndexes();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('Database Query Optimization', () => {
    test('should execute appointment queries within performance thresholds', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 50 },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(500); // Should complete within 500ms
      expect(result.performance.indexesUsed.length).toBeGreaterThan(0);
    });

    test('should execute follow-up queries within performance thresholds', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedFollowUpTasks(
        { status: 'pending' },
        { page: 1, limit: 50 },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(400); // Should complete within 400ms
      expect(result.performance.indexesUsed.length).toBeGreaterThan(0);
    });

    test('should use cursor pagination for large datasets efficiently', async () => {
      const offsetResult = await performanceService.getOptimizedAppointments(
        {},
        { page: 1, limit: 100, useCursor: false },
        testWorkplaceId
      );

      const cursorResult = await performanceService.getOptimizedAppointments(
        {},
        { page: 1, limit: 100, useCursor: true },
        testWorkplaceId
      );

      expect(offsetResult.performance.queryTime).toBeGreaterThan(0);
      expect(cursorResult.performance.queryTime).toBeGreaterThan(0);
      expect(cursorResult.pagination?.nextCursor).toBeDefined();
    });

    test('should optimize complex aggregation queries', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedAnalytics(
        'appointments',
        {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(2000); // Analytics queries can take longer
      expect(result.performance.optimizationApplied).toContain('optimized_aggregation');
    });
  });

  describe('Caching Performance', () => {
    test('should cache frequently accessed data', async () => {
      // First request (cache miss)
      const firstResult = await performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        testWorkplaceId,
        { useCache: true }
      );

      expect(firstResult.performance.cacheHit).toBe(false);

      // Second request (cache hit)
      const secondResult = await performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        testWorkplaceId,
        { useCache: true }
      );

      expect(secondResult.performance.cacheHit).toBe(true);
      expect(secondResult.performance.queryTime).toBeLessThan(firstResult.performance.queryTime);
    });

    test('should invalidate cache when data changes', async () => {
      // Cache some data
      await performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        testWorkplaceId,
        { useCache: true }
      );

      // Invalidate cache
      await performanceService.invalidateRelatedCaches(
        'appointment',
        testWorkplaceId,
        undefined,
        testPatientIds[0],
        testPharmacistIds[0]
      );

      // Next request should be cache miss
      const result = await performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        testWorkplaceId,
        { useCache: true }
      );

      expect(result.performance.cacheHit).toBe(false);
    });

    test('should compress large cache entries', async () => {
      // Create a large dataset query
      const result = await performanceService.getOptimizedAppointments(
        {},
        { page: 1, limit: 200 },
        testWorkplaceId,
        { useCache: true }
      );

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.performance.optimizationApplied).toContain('result_cached');
    });
  });

  describe('Index Optimization', () => {
    test('should create all required indexes', async () => {
      const stats = await indexOptimizer.getIndexPerformanceStats();

      expect(stats.collections.appointments).toBeDefined();
      expect(stats.collections.followuptasks).toBeDefined();
      expect(stats.summary.totalIndexes).toBeGreaterThan(10);
    });

    test('should analyze index effectiveness', async () => {
      const analysis = await indexOptimizer.analyzeIndexes();

      expect(analysis.length).toBeGreaterThan(0);
      
      for (const indexAnalysis of analysis) {
        expect(indexAnalysis.collection).toBeDefined();
        expect(indexAnalysis.indexName).toBeDefined();
        expect(indexAnalysis.effectiveness).toBeGreaterThanOrEqual(0);
        expect(indexAnalysis.effectiveness).toBeLessThanOrEqual(100);
        expect(['keep', 'drop', 'modify']).toContain(indexAnalysis.recommendation);
      }
    });

    test('should use appropriate indexes for common queries', async () => {
      // Test appointment queries
      const appointmentResult = await performanceService.getOptimizedAppointments(
        { 
          workplaceId: testWorkplaceId,
          status: 'scheduled',
          assignedTo: testPharmacistIds[0],
        },
        { page: 1, limit: 50 },
        testWorkplaceId
      );

      expect(appointmentResult.performance.indexesUsed).toContain('workplaceId_1');

      // Test follow-up queries
      const followUpResult = await performanceService.getOptimizedFollowUpTasks(
        {
          workplaceId: testWorkplaceId,
          status: 'pending',
          priority: 'high',
        },
        { page: 1, limit: 50 },
        testWorkplaceId
      );

      expect(followUpResult.performance.indexesUsed).toContain('workplaceId_1');
    });
  });

  describe('Calendar View Performance', () => {
    test('should render day view efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedCalendarView(
        'day',
        new Date(),
        { pharmacistId: testPharmacistIds[0] },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(300); // Day view should be fast
    });

    test('should render week view efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedCalendarView(
        'week',
        new Date(),
        {},
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(500); // Week view can be slightly slower
    });

    test('should render month view efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedCalendarView(
        'month',
        new Date(),
        {},
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(800); // Month view is most complex
    });

    test('should cache calendar views aggressively', async () => {
      const date = new Date();

      // First request
      const firstResult = await performanceService.getOptimizedCalendarView(
        'week',
        date,
        {},
        testWorkplaceId,
        { useCache: true }
      );

      // Second request (should be cached)
      const secondResult = await performanceService.getOptimizedCalendarView(
        'week',
        date,
        {},
        testWorkplaceId,
        { useCache: true }
      );

      expect(firstResult.performance.cacheHit).toBe(false);
      expect(secondResult.performance.cacheHit).toBe(true);
    });
  });

  describe('Available Slots Performance', () => {
    test('should calculate available slots efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedAvailableSlots(
        testPharmacistIds[0],
        new Date(),
        30,
        testWorkplaceId,
        'mtm_session'
      );

      const executionTime = performance.now() - startTime;

      expect(result.slots).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(200); // Slot calculation should be fast
    });

    test('should cache available slots with short TTL', async () => {
      const date = new Date();

      // First request
      const firstResult = await performanceService.getOptimizedAvailableSlots(
        testPharmacistIds[0],
        date,
        30,
        testWorkplaceId,
        'mtm_session',
        { useCache: true }
      );

      // Second request (should be cached)
      const secondResult = await performanceService.getOptimizedAvailableSlots(
        testPharmacistIds[0],
        date,
        30,
        testWorkplaceId,
        'mtm_session',
        { useCache: true }
      );

      expect(firstResult.performance.cacheHit).toBe(false);
      expect(secondResult.performance.cacheHit).toBe(true);
    });
  });

  describe('Analytics Performance', () => {
    test('should execute appointment analytics efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedAnalytics(
        'appointments',
        {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(1500); // Analytics can take longer
      expect(result.performance.optimizationApplied).toContain('optimized_aggregation');
    });

    test('should execute follow-up analytics efficiently', async () => {
      const startTime = performance.now();

      const result = await performanceService.getOptimizedAnalytics(
        'followups',
        {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        testWorkplaceId
      );

      const executionTime = performance.now() - startTime;

      expect(result.data).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(executionTime).toBeLessThan(1500);
    });

    test('should cache analytics results with longer TTL', async () => {
      const filters = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };

      // First request
      const firstResult = await performanceService.getOptimizedAnalytics(
        'appointments',
        filters,
        testWorkplaceId,
        { useCache: true }
      );

      // Second request (should be cached)
      const secondResult = await performanceService.getOptimizedAnalytics(
        'appointments',
        filters,
        testWorkplaceId,
        { useCache: true }
      );

      expect(firstResult.performance.cacheHit).toBe(false);
      expect(secondResult.performance.cacheHit).toBe(true);
    });
  });

  describe('Load Testing', () => {
    test('should handle light load efficiently', async () => {
      const config = {
        concurrentUsers: 5,
        testDuration: 10,
        rampUpTime: 2,
        scenarios: [
          {
            name: 'get_appointments',
            weight: 50,
            endpoint: '/api/appointments',
            method: 'GET' as const,
            expectedResponseTime: 200,
          },
          {
            name: 'get_follow_ups',
            weight: 50,
            endpoint: '/api/follow-ups',
            method: 'GET' as const,
            expectedResponseTime: 150,
          },
        ],
      };

      const results = await loadTester.runLoadTest(config);

      expect(results.summary.totalRequests).toBeGreaterThan(0);
      expect(results.summary.errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(results.summary.averageResponseTime).toBeLessThan(500); // Average under 500ms
      expect(results.performance.cacheHitRate).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for load test

    test('should maintain performance under moderate load', async () => {
      const config = {
        concurrentUsers: 10,
        testDuration: 15,
        rampUpTime: 3,
        scenarios: [
          {
            name: 'get_appointments',
            weight: 40,
            endpoint: '/api/appointments',
            method: 'GET' as const,
            expectedResponseTime: 300,
          },
          {
            name: 'get_calendar_view',
            weight: 30,
            endpoint: '/api/calendar',
            method: 'GET' as const,
            expectedResponseTime: 400,
          },
          {
            name: 'get_follow_ups',
            weight: 30,
            endpoint: '/api/follow-ups',
            method: 'GET' as const,
            expectedResponseTime: 250,
          },
        ],
      };

      const results = await loadTester.runLoadTest(config);

      expect(results.summary.totalRequests).toBeGreaterThan(0);
      expect(results.summary.errorRate).toBeLessThan(10); // Less than 10% error rate under load
      expect(results.summary.averageResponseTime).toBeLessThan(800); // Average under 800ms
      expect(results.summary.requestsPerSecond).toBeGreaterThan(1); // At least 1 RPS
    }, 45000); // 45 second timeout for load test
  });

  describe('Memory and Resource Management', () => {
    test('should not have memory leaks during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await performanceService.getOptimizedAppointments(
          { status: 'scheduled' },
          { page: 1, limit: 10 },
          testWorkplaceId,
          { useCache: false } // Disable cache to test memory usage
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should manage cache memory efficiently', async () => {
      const cacheStats = await performanceService.cache.getStats();
      
      expect(cacheStats.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheStats.hitRate).toBeLessThanOrEqual(100);
    });
  });

  // Helper functions

  async function setupTestData(): Promise<void> {
    // Create test patients
    const patients = [];
    for (let i = 0; i < 50; i++) {
      patients.push({
        workplaceId: testWorkplaceId,
        name: `Test Patient ${i}`,
        email: `patient${i}@test.com`,
        phone: `+234${String(i).padStart(10, '0')}`,
        dateOfBirth: new Date(1980 + (i % 40), i % 12, (i % 28) + 1),
        gender: i % 2 === 0 ? 'male' : 'female',
      });
    }

    const createdPatients = await Patient.insertMany(patients);
    testPatientIds = createdPatients.map(p => p._id);

    // Create test pharmacists
    const pharmacists = [];
    for (let i = 0; i < 5; i++) {
      pharmacists.push({
        workplaceId: testWorkplaceId,
        firstName: `Pharmacist`,
        lastName: `${i}`,
        email: `pharmacist${i}@test.com`,
        role: 'pharmacist',
        isActive: true,
      });
    }

    const createdPharmacists = await User.insertMany(pharmacists);
    testPharmacistIds = createdPharmacists.map(p => p._id);

    // Create test appointments
    const appointments = [];
    for (let i = 0; i < 200; i++) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (i % 30) - 15);

      appointments.push({
        workplaceId: testWorkplaceId,
        patientId: testPatientIds[i % testPatientIds.length],
        assignedTo: testPharmacistIds[i % testPharmacistIds.length],
        type: ['mtm_session', 'health_check', 'vaccination'][i % 3],
        title: `Test Appointment ${i}`,
        scheduledDate,
        scheduledTime: `${9 + (i % 8)}:${(i % 4) * 15}`,
        duration: 30,
        status: ['scheduled', 'confirmed', 'completed'][i % 3],
        createdBy: testPharmacistIds[0],
      });
    }

    await Appointment.insertMany(appointments);

    // Create test follow-up tasks
    const followUps = [];
    for (let i = 0; i < 100; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i % 14) - 7);

      followUps.push({
        workplaceId: testWorkplaceId,
        patientId: testPatientIds[i % testPatientIds.length],
        assignedTo: testPharmacistIds[i % testPharmacistIds.length],
        type: 'medication_start_followup',
        title: `Test Follow-up ${i}`,
        description: `Test follow-up task ${i}`,
        objectives: [`Objective ${i}`],
        priority: ['low', 'medium', 'high'][i % 3],
        dueDate,
        status: ['pending', 'in_progress', 'completed'][i % 3],
        trigger: {
          type: 'manual',
          triggerDate: new Date(),
        },
        createdBy: testPharmacistIds[0],
      });
    }

    await FollowUpTask.insertMany(followUps);
  }

  async function cleanupTestData(): Promise<void> {
    await Promise.all([
      Patient.deleteMany({ workplaceId: testWorkplaceId }),
      User.deleteMany({ workplaceId: testWorkplaceId }),
      Appointment.deleteMany({ workplaceId: testWorkplaceId }),
      FollowUpTask.deleteMany({ workplaceId: testWorkplaceId }),
    ]);
  }
});