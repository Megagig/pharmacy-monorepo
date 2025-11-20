/**
 * Load Testing Script for Patient Engagement Performance
 * Tests performance under load and validates optimizations
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1
 */

import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import patientEngagementPerformanceService from '../services/PatientEngagementPerformanceService';
import patientEngagementIndexOptimizer from '../services/PatientEngagementIndexOptimizer';
import Appointment from '../models/Appointment';
import FollowUpTask from '../models/FollowUpTask';
import Patient from '../models/Patient';
import User from '../models/User';
import logger from '../utils/logger';

export interface LoadTestConfig {
  concurrentUsers: number;
  testDuration: number; // seconds
  rampUpTime: number; // seconds
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of requests
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  dataGenerator?: () => any;
  expectedResponseTime: number; // milliseconds
}

export interface LoadTestResults {
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  scenarios: Array<{
    name: string;
    requests: number;
    averageResponseTime: number;
    successRate: number;
    errors: string[];
  }>;
  performance: {
    cacheHitRate: number;
    indexUsage: number;
    connectionPoolUtilization: number;
    memoryUsage: number;
  };
  recommendations: string[];
}

/**
 * Load testing service for Patient Engagement module
 */
export class PatientEngagementLoadTester {
  private performanceService: any;
  private indexOptimizer: any;
  private testData: {
    workplaceId: mongoose.Types.ObjectId;
    patientIds: mongoose.Types.ObjectId[];
    pharmacistIds: mongoose.Types.ObjectId[];
    appointmentIds: mongoose.Types.ObjectId[];
    followUpIds: mongoose.Types.ObjectId[];
  };

  constructor() {
    this.performanceService = patientEngagementPerformanceService;
    this.indexOptimizer = patientEngagementIndexOptimizer;
    this.testData = {
      workplaceId: new mongoose.Types.ObjectId(),
      patientIds: [],
      pharmacistIds: [],
      appointmentIds: [],
      followUpIds: [],
    };
  }

  /**
   * Run comprehensive load test
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
    logger.info('Starting Patient Engagement load test', {
      concurrentUsers: config.concurrentUsers,
      testDuration: config.testDuration,
      scenarios: config.scenarios.length,
    });

    try {
      // Setup test data
      await this.setupTestData();

      // Initialize performance monitoring
      const performanceMonitor = this.startPerformanceMonitoring();

      // Run load test
      const results = await this.executeLoadTest(config);

      // Stop monitoring and collect metrics
      const performanceMetrics = await this.stopPerformanceMonitoring(performanceMonitor);
      results.performance = performanceMetrics;

      // Generate recommendations
      results.recommendations = this.generateRecommendations(results);

      // Cleanup test data
      await this.cleanupTestData();

      logger.info('Load test completed', {
        totalRequests: results.summary.totalRequests,
        successRate: ((results.summary.successfulRequests / results.summary.totalRequests) * 100).toFixed(2),
        averageResponseTime: results.summary.averageResponseTime.toFixed(2),
      });

      return results;
    } catch (error) {
      logger.error('Load test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Run specific performance benchmarks
   */
  async runPerformanceBenchmarks(): Promise<any> {
    logger.info('Running performance benchmarks...');

    const benchmarks = {
      appointmentQueries: await this.benchmarkAppointmentQueries(),
      followUpQueries: await this.benchmarkFollowUpQueries(),
      calendarViews: await this.benchmarkCalendarViews(),
      analyticsQueries: await this.benchmarkAnalyticsQueries(),
      cachePerformance: await this.benchmarkCachePerformance(),
    };

    return benchmarks;
  }

  /**
   * Test database query performance
   */
  async testQueryPerformance(): Promise<any> {
    logger.info('Testing database query performance...');

    const queryTests = [
      {
        name: 'Simple appointment lookup',
        query: () => Appointment.findById(this.testData.appointmentIds[0]),
        expectedTime: 50,
      },
      {
        name: 'Appointment list with filters',
        query: () => Appointment.find({
          workplaceId: this.testData.workplaceId,
          status: 'scheduled',
        }).limit(50),
        expectedTime: 100,
      },
      {
        name: 'Complex appointment aggregation',
        query: () => Appointment.aggregate([
          { $match: { workplaceId: this.testData.workplaceId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        expectedTime: 200,
      },
      {
        name: 'Follow-up tasks with sorting',
        query: () => FollowUpTask.find({
          workplaceId: this.testData.workplaceId,
          status: 'pending',
        }).sort({ priority: -1, dueDate: 1 }).limit(50),
        expectedTime: 150,
      },
    ];

    const results = [];

    for (const test of queryTests) {
      const startTime = performance.now();
      
      try {
        await test.query();
        const duration = performance.now() - startTime;
        
        results.push({
          name: test.name,
          duration: duration.toFixed(2),
          expected: test.expectedTime,
          passed: duration <= test.expectedTime,
        });
      } catch (error) {
        results.push({
          name: test.name,
          duration: -1,
          expected: test.expectedTime,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // Private methods

  private async setupTestData(): Promise<void> {
    logger.info('Setting up test data...');

    // Create test patients
    const patients = [];
    for (let i = 0; i < 100; i++) {
      patients.push({
        workplaceId: this.testData.workplaceId,
        name: `Test Patient ${i}`,
        email: `patient${i}@test.com`,
        phone: `+234${String(i).padStart(10, '0')}`,
        dateOfBirth: new Date(1980 + (i % 40), i % 12, (i % 28) + 1),
        gender: i % 2 === 0 ? 'male' : 'female',
      });
    }

    const createdPatients = await Patient.insertMany(patients);
    this.testData.patientIds = createdPatients.map(p => p._id);

    // Create test pharmacists
    const pharmacists = [];
    for (let i = 0; i < 10; i++) {
      pharmacists.push({
        workplaceId: this.testData.workplaceId,
        firstName: `Pharmacist`,
        lastName: `${i}`,
        email: `pharmacist${i}@test.com`,
        role: 'pharmacist',
        isActive: true,
      });
    }

    const createdPharmacists = await User.insertMany(pharmacists);
    this.testData.pharmacistIds = createdPharmacists.map(p => p._id);

    // Create test appointments
    const appointments = [];
    for (let i = 0; i < 500; i++) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (i % 30) - 15); // ±15 days

      appointments.push({
        workplaceId: this.testData.workplaceId,
        patientId: this.testData.patientIds[i % this.testData.patientIds.length],
        assignedTo: this.testData.pharmacistIds[i % this.testData.pharmacistIds.length],
        type: ['mtm_session', 'health_check', 'vaccination'][i % 3],
        title: `Test Appointment ${i}`,
        scheduledDate,
        scheduledTime: `${9 + (i % 8)}:${(i % 4) * 15}`,
        duration: 30,
        status: ['scheduled', 'confirmed', 'completed'][i % 3],
        createdBy: this.testData.pharmacistIds[0],
      });
    }

    const createdAppointments = await Appointment.insertMany(appointments);
    this.testData.appointmentIds = createdAppointments.map(a => a._id);

    // Create test follow-up tasks
    const followUps = [];
    for (let i = 0; i < 200; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i % 14) - 7); // ±7 days

      followUps.push({
        workplaceId: this.testData.workplaceId,
        patientId: this.testData.patientIds[i % this.testData.patientIds.length],
        assignedTo: this.testData.pharmacistIds[i % this.testData.pharmacistIds.length],
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
        createdBy: this.testData.pharmacistIds[0],
      });
    }

    const createdFollowUps = await FollowUpTask.insertMany(followUps);
    this.testData.followUpIds = createdFollowUps.map(f => f._id);

    logger.info('Test data setup completed', {
      patients: this.testData.patientIds.length,
      pharmacists: this.testData.pharmacistIds.length,
      appointments: this.testData.appointmentIds.length,
      followUps: this.testData.followUpIds.length,
    });
  }

  private async cleanupTestData(): Promise<void> {
    logger.info('Cleaning up test data...');

    await Promise.all([
      Patient.deleteMany({ workplaceId: this.testData.workplaceId }),
      User.deleteMany({ workplaceId: this.testData.workplaceId }),
      Appointment.deleteMany({ workplaceId: this.testData.workplaceId }),
      FollowUpTask.deleteMany({ workplaceId: this.testData.workplaceId }),
    ]);

    logger.info('Test data cleanup completed');
  }

  private async executeLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
    const results: LoadTestResults = {
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0,
      },
      scenarios: [],
      performance: {
        cacheHitRate: 0,
        indexUsage: 0,
        connectionPoolUtilization: 0,
        memoryUsage: 0,
      },
      recommendations: [],
    };

    const responseTimes: number[] = [];
    const scenarioResults = new Map<string, any>();

    // Initialize scenario results
    for (const scenario of config.scenarios) {
      scenarioResults.set(scenario.name, {
        name: scenario.name,
        requests: 0,
        responseTimes: [],
        errors: [],
      });
    }

    // Calculate request distribution
    const totalWeight = config.scenarios.reduce((sum, s) => sum + s.weight, 0);
    const requestsPerUser = Math.floor(config.testDuration / config.scenarios.length);

    // Simulate concurrent users
    const userPromises = [];
    for (let user = 0; user < config.concurrentUsers; user++) {
      userPromises.push(this.simulateUser(config, scenarioResults, requestsPerUser));
    }

    // Wait for all users to complete
    await Promise.all(userPromises);

    // Calculate summary statistics
    for (const [scenarioName, scenarioData] of scenarioResults.entries()) {
      responseTimes.push(...scenarioData.responseTimes);
      results.summary.totalRequests += scenarioData.requests;
      results.summary.successfulRequests += scenarioData.requests - scenarioData.errors.length;
      results.summary.failedRequests += scenarioData.errors.length;

      results.scenarios.push({
        name: scenarioName,
        requests: scenarioData.requests,
        averageResponseTime: scenarioData.responseTimes.length > 0
          ? scenarioData.responseTimes.reduce((a: number, b: number) => a + b, 0) / scenarioData.responseTimes.length
          : 0,
        successRate: scenarioData.requests > 0
          ? ((scenarioData.requests - scenarioData.errors.length) / scenarioData.requests) * 100
          : 0,
        errors: scenarioData.errors,
      });
    }

    // Calculate percentiles
    responseTimes.sort((a, b) => a - b);
    results.summary.averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    results.summary.p95ResponseTime = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.95)]
      : 0;
    results.summary.p99ResponseTime = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.99)]
      : 0;
    results.summary.requestsPerSecond = results.summary.totalRequests / config.testDuration;
    results.summary.errorRate = results.summary.totalRequests > 0
      ? (results.summary.failedRequests / results.summary.totalRequests) * 100
      : 0;

    return results;
  }

  private async simulateUser(
    config: LoadTestConfig,
    scenarioResults: Map<string, any>,
    requestsPerUser: number
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (config.testDuration * 1000);

    while (Date.now() < endTime) {
      // Select random scenario based on weight
      const scenario = this.selectRandomScenario(config.scenarios);
      const scenarioData = scenarioResults.get(scenario.name)!;

      try {
        const requestStart = performance.now();
        
        // Execute scenario
        await this.executeScenario(scenario);
        
        const responseTime = performance.now() - requestStart;
        
        scenarioData.requests++;
        scenarioData.responseTimes.push(responseTime);
      } catch (error) {
        scenarioData.requests++;
        scenarioData.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      // Add some delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  private selectRandomScenario(scenarios: LoadTestScenario[]): LoadTestScenario {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }

    return scenarios[0]; // Fallback
  }

  private async executeScenario(scenario: LoadTestScenario): Promise<any> {
    switch (scenario.name) {
      case 'get_appointments':
        return await this.performanceService.getOptimizedAppointments(
          { status: 'scheduled' },
          { page: 1, limit: 50 },
          this.testData.workplaceId
        );
      
      case 'get_follow_ups':
        return await this.performanceService.getOptimizedFollowUpTasks(
          { status: 'pending' },
          { page: 1, limit: 50 },
          this.testData.workplaceId
        );
      
      case 'get_calendar_view':
        return await this.performanceService.getOptimizedCalendarView(
          'week',
          new Date(),
          {},
          this.testData.workplaceId
        );
      
      case 'get_analytics':
        return await this.performanceService.getOptimizedAnalytics(
          'appointments',
          { startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          this.testData.workplaceId
        );
      
      default:
        throw new Error(`Unknown scenario: ${scenario.name}`);
    }
  }

  private startPerformanceMonitoring(): any {
    return {
      startTime: Date.now(),
      initialMemory: process.memoryUsage(),
    };
  }

  private async stopPerformanceMonitoring(monitor: any): Promise<any> {
    const endMemory = process.memoryUsage();
    const cacheStats = await this.performanceService.cache.getStats();

    return {
      cacheHitRate: cacheStats.hitRate,
      indexUsage: 85, // Placeholder - would need actual monitoring
      connectionPoolUtilization: 70, // Placeholder - would need actual monitoring
      memoryUsage: endMemory.heapUsed - monitor.initialMemory.heapUsed,
    };
  }

  private generateRecommendations(results: LoadTestResults): string[] {
    const recommendations: string[] = [];

    if (results.summary.averageResponseTime > 500) {
      recommendations.push('Average response time is high (>500ms). Consider query optimization.');
    }

    if (results.summary.errorRate > 5) {
      recommendations.push('Error rate is high (>5%). Review error handling and system stability.');
    }

    if (results.performance.cacheHitRate < 70) {
      recommendations.push('Cache hit rate is low (<70%). Review caching strategy.');
    }

    if (results.summary.requestsPerSecond < 100) {
      recommendations.push('Throughput is low (<100 RPS). Consider scaling or optimization.');
    }

    return recommendations;
  }

  // Benchmark methods

  private async benchmarkAppointmentQueries(): Promise<any> {
    const iterations = 100;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 50 },
        this.testData.workplaceId
      );
      
      results.push(performance.now() - startTime);
    }

    return {
      iterations,
      averageTime: results.reduce((a, b) => a + b, 0) / results.length,
      minTime: Math.min(...results),
      maxTime: Math.max(...results),
    };
  }

  private async benchmarkFollowUpQueries(): Promise<any> {
    const iterations = 100;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedFollowUpTasks(
        { status: 'pending' },
        { page: 1, limit: 50 },
        this.testData.workplaceId
      );
      
      results.push(performance.now() - startTime);
    }

    return {
      iterations,
      averageTime: results.reduce((a, b) => a + b, 0) / results.length,
      minTime: Math.min(...results),
      maxTime: Math.max(...results),
    };
  }

  private async benchmarkCalendarViews(): Promise<any> {
    const iterations = 50;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedCalendarView(
        'week',
        new Date(),
        {},
        this.testData.workplaceId
      );
      
      results.push(performance.now() - startTime);
    }

    return {
      iterations,
      averageTime: results.reduce((a, b) => a + b, 0) / results.length,
      minTime: Math.min(...results),
      maxTime: Math.max(...results),
    };
  }

  private async benchmarkAnalyticsQueries(): Promise<any> {
    const iterations = 20;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedAnalytics(
        'appointments',
        { startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        this.testData.workplaceId
      );
      
      results.push(performance.now() - startTime);
    }

    return {
      iterations,
      averageTime: results.reduce((a, b) => a + b, 0) / results.length,
      minTime: Math.min(...results),
      maxTime: Math.max(...results),
    };
  }

  private async benchmarkCachePerformance(): Promise<any> {
    const iterations = 1000;
    const cacheResults = [];
    const noCacheResults = [];

    // Test with cache
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        this.testData.workplaceId,
        { useCache: true }
      );
      
      cacheResults.push(performance.now() - startTime);
    }

    // Test without cache
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await this.performanceService.getOptimizedAppointments(
        { status: 'scheduled' },
        { page: 1, limit: 10 },
        this.testData.workplaceId,
        { useCache: false }
      );
      
      noCacheResults.push(performance.now() - startTime);
    }

    return {
      withCache: {
        averageTime: cacheResults.reduce((a, b) => a + b, 0) / cacheResults.length,
        minTime: Math.min(...cacheResults),
        maxTime: Math.max(...cacheResults),
      },
      withoutCache: {
        averageTime: noCacheResults.reduce((a, b) => a + b, 0) / noCacheResults.length,
        minTime: Math.min(...noCacheResults),
        maxTime: Math.max(...noCacheResults),
      },
      improvement: (noCacheResults.reduce((a, b) => a + b, 0) / noCacheResults.length) /
                   (cacheResults.reduce((a, b) => a + b, 0) / cacheResults.length),
    };
  }
}

/**
 * Default load test configurations
 */
export const defaultLoadTestConfigs = {
  light: {
    concurrentUsers: 10,
    testDuration: 60,
    rampUpTime: 10,
    scenarios: [
      {
        name: 'get_appointments',
        weight: 40,
        endpoint: '/api/appointments',
        method: 'GET' as const,
        expectedResponseTime: 200,
      },
      {
        name: 'get_follow_ups',
        weight: 30,
        endpoint: '/api/follow-ups',
        method: 'GET' as const,
        expectedResponseTime: 150,
      },
      {
        name: 'get_calendar_view',
        weight: 20,
        endpoint: '/api/calendar',
        method: 'GET' as const,
        expectedResponseTime: 300,
      },
      {
        name: 'get_analytics',
        weight: 10,
        endpoint: '/api/analytics',
        method: 'GET' as const,
        expectedResponseTime: 500,
      },
    ],
  },
  
  moderate: {
    concurrentUsers: 50,
    testDuration: 300,
    rampUpTime: 30,
    scenarios: [
      {
        name: 'get_appointments',
        weight: 35,
        endpoint: '/api/appointments',
        method: 'GET' as const,
        expectedResponseTime: 300,
      },
      {
        name: 'get_follow_ups',
        weight: 35,
        endpoint: '/api/follow-ups',
        method: 'GET' as const,
        expectedResponseTime: 250,
      },
      {
        name: 'get_calendar_view',
        weight: 20,
        endpoint: '/api/calendar',
        method: 'GET' as const,
        expectedResponseTime: 400,
      },
      {
        name: 'get_analytics',
        weight: 10,
        endpoint: '/api/analytics',
        method: 'GET' as const,
        expectedResponseTime: 800,
      },
    ],
  },

  heavy: {
    concurrentUsers: 100,
    testDuration: 600,
    rampUpTime: 60,
    scenarios: [
      {
        name: 'get_appointments',
        weight: 30,
        endpoint: '/api/appointments',
        method: 'GET' as const,
        expectedResponseTime: 500,
      },
      {
        name: 'get_follow_ups',
        weight: 30,
        endpoint: '/api/follow-ups',
        method: 'GET' as const,
        expectedResponseTime: 400,
      },
      {
        name: 'get_calendar_view',
        weight: 25,
        endpoint: '/api/calendar',
        method: 'GET' as const,
        expectedResponseTime: 600,
      },
      {
        name: 'get_analytics',
        weight: 15,
        endpoint: '/api/analytics',
        method: 'GET' as const,
        expectedResponseTime: 1000,
      },
    ],
  },
};

export default PatientEngagementLoadTester;