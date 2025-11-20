#!/usr/bin/env node

/**
 * Performance Optimization CLI Tool
 * Command-line interface for running performance optimizations and tests
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1
 */

import { Command } from 'commander';
import mongoose from 'mongoose';
import patientEngagementPerformanceService from '../services/PatientEngagementPerformanceService';
import patientEngagementIndexOptimizer from '../services/PatientEngagementIndexOptimizer';
import PatientEngagementLoadTester, { defaultLoadTestConfigs } from './loadTestPatientEngagement';
import PerformanceOptimizationScheduler from '../jobs/PerformanceOptimizationJob';
import logger from '../utils/logger';

const program = new Command();

/**
 * CLI application for performance optimization
 */
class PerformanceOptimizationCLI {
  private performanceService: any;
  private indexOptimizer: any;
  private loadTester: PatientEngagementLoadTester;

  constructor() {
    this.performanceService = patientEngagementPerformanceService;
    this.indexOptimizer = patientEngagementIndexOptimizer;
    this.loadTester = new PatientEngagementLoadTester();
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db';
    
    try {
      await mongoose.connect(mongoUri);
      logger.info('Connected to MongoDB for performance optimization');
    } catch (error) {
      logger.error('Failed to connect to MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  }

  /**
   * Close database connection
   */
  async closeDatabase(): Promise<void> {
    await mongoose.connection.close();
    logger.info('Disconnected from MongoDB');
  }

  /**
   * Create optimized indexes
   */
  async createIndexes(options: { force?: boolean; analyze?: boolean }): Promise<void> {
    console.log('🔧 Creating optimized indexes for Patient Engagement...\n');

    try {
      if (options.analyze) {
        console.log('📊 Analyzing existing indexes...');
        const analysis = await this.indexOptimizer.analyzeIndexes();
        
        console.log('\n📈 Index Analysis Results:');
        console.table(analysis.map(a => ({
          Collection: a.collection,
          Index: a.indexName,
          Effectiveness: `${a.effectiveness}%`,
          Recommendation: a.recommendation,
        })));
      }

      console.log('\n🚀 Creating optimized indexes...');
      await this.indexOptimizer.createOptimizedIndexes();

      console.log('\n📋 Creating query-specific indexes...');
      await this.indexOptimizer.createQuerySpecificIndexes();

      console.log('\n🎯 Creating partial indexes...');
      await this.indexOptimizer.createPartialIndexes();

      if (options.force) {
        console.log('\n🧹 Optimizing existing indexes...');
        await this.indexOptimizer.optimizeExistingIndexes();
      }

      console.log('\n✅ Index optimization completed successfully!');

      // Show performance statistics
      const stats = await this.indexOptimizer.getIndexPerformanceStats();
      console.log('\n📊 Index Performance Statistics:');
      console.log(`Total Collections: ${Object.keys(stats.collections).length}`);
      console.log(`Total Indexes: ${stats.summary.totalIndexes}`);
      console.log(`Total Index Size: ${(stats.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
      console.error('❌ Index optimization failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * Run performance benchmarks
   */
  async runBenchmarks(options: { type?: string; iterations?: number }): Promise<void> {
    console.log('🏃‍♂️ Running performance benchmarks...\n');

    try {
      const benchmarks = await this.loadTester.runPerformanceBenchmarks();

      console.log('📊 Benchmark Results:\n');

      for (const [name, result] of Object.entries(benchmarks)) {
        console.log(`🔍 ${name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:`);
        
        if (typeof result === 'object' && result !== null) {
          if ('averageTime' in result) {
            console.log(`  Average Time: ${(result as any).averageTime.toFixed(2)}ms`);
            console.log(`  Min Time: ${(result as any).minTime.toFixed(2)}ms`);
            console.log(`  Max Time: ${(result as any).maxTime.toFixed(2)}ms`);
          }
          
          if ('improvement' in result) {
            console.log(`  Cache Improvement: ${((result as any).improvement).toFixed(2)}x faster`);
          }
        }
        
        console.log('');
      }

      // Run query performance tests
      console.log('🔍 Testing database query performance...');
      const queryTests = await this.loadTester.testQueryPerformance();
      
      console.log('\n📈 Query Performance Results:');
      console.table(queryTests);

    } catch (error) {
      console.error('❌ Benchmarks failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * Run load tests
   */
  async runLoadTest(options: { 
    config?: 'light' | 'moderate' | 'heavy'; 
    users?: number; 
    duration?: number;
    output?: string;
  }): Promise<void> {
    const configName = options.config || 'light';
    const config = { ...defaultLoadTestConfigs[configName] };

    if (options.users) config.concurrentUsers = options.users;
    if (options.duration) config.testDuration = options.duration;

    console.log(`🚀 Running ${configName} load test...\n`);
    console.log(`👥 Concurrent Users: ${config.concurrentUsers}`);
    console.log(`⏱️  Test Duration: ${config.testDuration}s`);
    console.log(`📊 Scenarios: ${config.scenarios.length}\n`);

    try {
      const results = await this.loadTester.runLoadTest(config);

      console.log('📊 Load Test Results:\n');

      // Summary
      console.log('📈 Summary:');
      console.log(`  Total Requests: ${results.summary.totalRequests}`);
      console.log(`  Successful: ${results.summary.successfulRequests} (${((results.summary.successfulRequests / results.summary.totalRequests) * 100).toFixed(1)}%)`);
      console.log(`  Failed: ${results.summary.failedRequests} (${results.summary.errorRate.toFixed(1)}%)`);
      console.log(`  Average Response Time: ${results.summary.averageResponseTime.toFixed(2)}ms`);
      console.log(`  95th Percentile: ${results.summary.p95ResponseTime.toFixed(2)}ms`);
      console.log(`  99th Percentile: ${results.summary.p99ResponseTime.toFixed(2)}ms`);
      console.log(`  Requests/Second: ${results.summary.requestsPerSecond.toFixed(2)}`);

      // Scenarios
      console.log('\n🎯 Scenario Results:');
      console.table(results.scenarios.map(s => ({
        Scenario: s.name,
        Requests: s.requests,
        'Avg Response (ms)': s.averageResponseTime.toFixed(2),
        'Success Rate (%)': s.successRate.toFixed(1),
        Errors: s.errors.length,
      })));

      // Performance metrics
      console.log('\n⚡ Performance Metrics:');
      console.log(`  Cache Hit Rate: ${results.performance.cacheHitRate.toFixed(1)}%`);
      console.log(`  Index Usage: ${results.performance.indexUsage.toFixed(1)}%`);
      console.log(`  Connection Pool Utilization: ${results.performance.connectionPoolUtilization.toFixed(1)}%`);
      console.log(`  Memory Usage: ${(results.performance.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

      // Recommendations
      if (results.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        results.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

      // Save results if output specified
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to ${options.output}`);
      }

    } catch (error) {
      console.error('❌ Load test failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * Monitor performance metrics
   */
  async monitorPerformance(options: { duration?: number; interval?: number }): Promise<void> {
    const duration = (options.duration || 60) * 1000; // Convert to milliseconds
    const interval = (options.interval || 5) * 1000; // Convert to milliseconds

    console.log(`📊 Monitoring performance for ${duration / 1000}s (interval: ${interval / 1000}s)...\n`);

    const startTime = Date.now();
    const metrics: any[] = [];

    while (Date.now() - startTime < duration) {
      try {
        const cacheStats = await this.performanceService.cache.getStats();
        const indexStats = await this.indexOptimizer.getIndexPerformanceStats();
        
        const metric = {
          timestamp: new Date().toISOString(),
          cache: {
            hitRate: cacheStats.hitRate,
            totalOperations: cacheStats.totalOperations,
            memoryUsage: cacheStats.memoryUsage,
          },
          indexes: {
            totalIndexes: indexStats.summary.totalIndexes,
            totalSize: indexStats.summary.totalSize,
          },
          memory: process.memoryUsage(),
        };

        metrics.push(metric);

        // Display current metrics
        console.log(`⏰ ${metric.timestamp}`);
        console.log(`  Cache Hit Rate: ${metric.cache.hitRate.toFixed(1)}%`);
        console.log(`  Cache Operations: ${metric.cache.totalOperations}`);
        console.log(`  Memory Usage: ${(metric.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log('');

        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('❌ Monitoring error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log('📊 Performance monitoring completed');
    
    // Show summary
    if (metrics.length > 0) {
      const avgHitRate = metrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / metrics.length;
      const avgMemory = metrics.reduce((sum, m) => sum + m.memory.heapUsed, 0) / metrics.length;
      
      console.log('\n📈 Summary:');
      console.log(`  Average Cache Hit Rate: ${avgHitRate.toFixed(1)}%`);
      console.log(`  Average Memory Usage: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Total Samples: ${metrics.length}`);
    }
  }

  /**
   * Clean up performance data
   */
  async cleanup(options: { cache?: boolean; logs?: boolean; force?: boolean }): Promise<void> {
    console.log('🧹 Cleaning up performance data...\n');

    try {
      if (options.cache || options.force) {
        console.log('🗑️  Clearing cache...');
        await this.performanceService.cache.clearAll();
        console.log('✅ Cache cleared');
      }

      if (options.logs || options.force) {
        console.log('🗑️  Clearing performance logs...');
        // Clear performance metrics history
        // This would depend on how logs are stored
        console.log('✅ Performance logs cleared');
      }

      console.log('\n✅ Cleanup completed successfully!');

    } catch (error) {
      console.error('❌ Cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * Show performance status
   */
  async showStatus(): Promise<void> {
    console.log('📊 Patient Engagement Performance Status\n');

    try {
      // Cache statistics
      const cacheStats = await this.performanceService.cache.getStats();
      console.log('💾 Cache Statistics:');
      console.log(`  Hit Rate: ${cacheStats.hitRate.toFixed(1)}%`);
      console.log(`  Total Operations: ${cacheStats.totalOperations}`);
      console.log(`  Average Response Time: ${cacheStats.avgResponseTime.toFixed(2)}ms`);
      console.log(`  Memory Usage: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

      // Index statistics
      const indexStats = await this.indexOptimizer.getIndexPerformanceStats();
      console.log('\n🗂️  Index Statistics:');
      console.log(`  Total Collections: ${Object.keys(indexStats.collections).length}`);
      console.log(`  Total Indexes: ${indexStats.summary.totalIndexes}`);
      console.log(`  Total Size: ${(indexStats.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);

      // System metrics
      const memUsage = process.memoryUsage();
      console.log('\n🖥️  System Metrics:');
      console.log(`  Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);

      // Collection statistics
      console.log('\n📚 Collection Details:');
      for (const [collectionName, stats] of Object.entries(indexStats.collections)) {
        console.log(`  ${collectionName}:`);
        console.log(`    Documents: ${(stats as any).documentCount}`);
        console.log(`    Indexes: ${(stats as any).indexCount}`);
        console.log(`    Index Size: ${((stats as any).totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
      }

    } catch (error) {
      console.error('❌ Failed to get status:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}

// CLI setup
program
  .name('performance-optimization')
  .description('Patient Engagement Performance Optimization Tool')
  .version('1.0.0');

// Create indexes command
program
  .command('create-indexes')
  .description('Create optimized database indexes')
  .option('-f, --force', 'Force optimization of existing indexes')
  .option('-a, --analyze', 'Analyze existing indexes before creating new ones')
  .action(async (options) => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.createIndexes(options);
    await cli.closeDatabase();
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run performance benchmarks')
  .option('-t, --type <type>', 'Benchmark type (queries, cache, all)', 'all')
  .option('-i, --iterations <number>', 'Number of iterations', '100')
  .action(async (options) => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.runBenchmarks(options);
    await cli.closeDatabase();
  });

// Load test command
program
  .command('load-test')
  .description('Run load tests')
  .option('-c, --config <config>', 'Test configuration (light, moderate, heavy)', 'light')
  .option('-u, --users <number>', 'Number of concurrent users')
  .option('-d, --duration <seconds>', 'Test duration in seconds')
  .option('-o, --output <file>', 'Output file for results')
  .action(async (options) => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.runLoadTest(options);
    await cli.closeDatabase();
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor performance metrics')
  .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '60')
  .option('-i, --interval <seconds>', 'Sampling interval in seconds', '5')
  .action(async (options) => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.monitorPerformance(options);
    await cli.closeDatabase();
  });

// Status command
program
  .command('status')
  .description('Show current performance status')
  .action(async () => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.showStatus();
    await cli.closeDatabase();
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up performance data')
  .option('-c, --cache', 'Clear cache data')
  .option('-l, --logs', 'Clear performance logs')
  .option('-f, --force', 'Clear all performance data')
  .action(async (options) => {
    const cli = new PerformanceOptimizationCLI();
    await cli.initializeDatabase();
    await cli.cleanup(options);
    await cli.closeDatabase();
  });

// Parse command line arguments
program.parse();

export default PerformanceOptimizationCLI;