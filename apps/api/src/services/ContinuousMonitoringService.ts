/**
 * Continuous Performance Monitoring Service
 * 
 * Provides ongoing performance monitoring, trend analysis, and regression detection
 */

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import logger from '../utils/logger';
import { WebVitalsService } from './WebVitalsService';
import { LighthouseCIService } from './LighthouseCIService';
import { PerformanceAlertService } from './PerformanceAlertService';
import ProductionValidationService from './ProductionValidationService';

export interface MonitoringConfig {
  webVitals: {
    enabled: boolean;
    collectionInterval: number; // minutes
    alertThresholds: {
      LCP: number;
      FID: number;
      CLS: number;
      TTFB: number;
    };
  };
  lighthouse: {
    enabled: boolean;
    schedule: string; // cron expression
    urls: string[];
    alertThresholds: {
      performance: number;
      accessibility: number;
      bestPractices: number;
      seo: number;
    };
  };
  apiLatency: {
    enabled: boolean;
    monitoringInterval: number; // minutes
    endpoints: string[];
    alertThresholds: {
      p95: number;
      errorRate: number;
    };
  };
  regressionDetection: {
    enabled: boolean;
    analysisInterval: number; // minutes
    lookbackPeriod: number; // hours
    regressionThreshold: number; // percentage
  };
  reporting: {
    dailyReport: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
    recipients: string[];
  };
}

export interface PerformanceTrend {
  metric: string;
  period: 'hour' | 'day' | 'week' | 'month';
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
  significance: 'low' | 'medium' | 'high';
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
}

export interface RegressionAlert {
  id: string;
  timestamp: Date;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  baselineValue: number;
  changePercentage: number;
  affectedUsers: number;
  description: string;
  recommendations: string[];
}

class ContinuousMonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private monitoringTasks = new Map<string, NodeJS.Timeout>();
  private cronJobs = new Map<string, cron.ScheduledTask>();
  private isRunning = false;

  constructor() {
    super();
    this.config = this.getDefaultConfig();
  }

  /**
   * Start continuous monitoring
   */
  async start(config?: Partial<MonitoringConfig>): Promise<void> {
    if (this.isRunning) {
      logger.warn('Continuous monitoring is already running');
      return;
    }

    this.config = { ...this.config, ...config };
    this.isRunning = true;

    logger.info('Starting continuous performance monitoring');

    // Start Web Vitals monitoring
    if (this.config.webVitals.enabled) {
      await this.startWebVitalsMonitoring();
    }

    // Start Lighthouse monitoring
    if (this.config.lighthouse.enabled) {
      await this.startLighthouseMonitoring();
    }

    // Start API latency monitoring
    if (this.config.apiLatency.enabled) {
      await this.startAPILatencyMonitoring();
    }

    // Start regression detection
    if (this.config.regressionDetection.enabled) {
      await this.startRegressionDetection();
    }

    // Schedule reports
    this.scheduleReports();

    this.emit('monitoringStarted', this.config);
    logger.info('Continuous performance monitoring started');
  }

  /**
   * Stop continuous monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping continuous performance monitoring');

    // Clear all monitoring tasks
    for (const [name, task] of this.monitoringTasks) {
      clearInterval(task);
      logger.info(`Stopped monitoring task: ${name}`);
    }
    this.monitoringTasks.clear();

    // Stop all cron jobs
    for (const [name, job] of this.cronJobs) {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    }
    this.cronJobs.clear();

    this.isRunning = false;
    this.emit('monitoringStopped');
    logger.info('Continuous performance monitoring stopped');
  }

  /**
   * Start Web Vitals monitoring
   */
  private async startWebVitalsMonitoring(): Promise<void> {
    logger.info('Starting Web Vitals monitoring');

    const interval = setInterval(async () => {
      try {
        await this.checkWebVitalsThresholds();
      } catch (error) {
        logger.error('Error in Web Vitals monitoring:', error);
      }
    }, this.config.webVitals.collectionInterval * 60 * 1000);

    this.monitoringTasks.set('webVitals', interval);
  }

  /**
   * Start Lighthouse monitoring
   */
  private async startLighthouseMonitoring(): Promise<void> {
    logger.info('Starting Lighthouse monitoring');

    const job = cron.schedule(this.config.lighthouse.schedule, async () => {
      try {
        await this.runLighthouseChecks();
      } catch (error) {
        logger.error('Error in Lighthouse monitoring:', error);
      }
    });

    this.cronJobs.set('lighthouse', job);
  }

  /**
   * Start API latency monitoring
   */
  private async startAPILatencyMonitoring(): Promise<void> {
    logger.info('Starting API latency monitoring');

    const interval = setInterval(async () => {
      try {
        await this.checkAPILatencyThresholds();
      } catch (error) {
        logger.error('Error in API latency monitoring:', error);
      }
    }, this.config.apiLatency.monitoringInterval * 60 * 1000);

    this.monitoringTasks.set('apiLatency', interval);
  }

  /**
   * Start regression detection
   */
  private async startRegressionDetection(): Promise<void> {
    logger.info('Starting regression detection');

    const interval = setInterval(async () => {
      try {
        await this.detectPerformanceRegressions();
      } catch (error) {
        logger.error('Error in regression detection:', error);
      }
    }, this.config.regressionDetection.analysisInterval * 60 * 1000);

    this.monitoringTasks.set('regressionDetection', interval);
  }

  /**
   * Check Web Vitals thresholds
   */
  private async checkWebVitalsThresholds(): Promise<void> {
    const recentMetrics = await WebVitalsService.getRecentMetrics(
      this.config.webVitals.collectionInterval * 60 * 1000
    );

    if (recentMetrics.length === 0) {
      return;
    }

    // Calculate averages
    const averages = this.calculateWebVitalsAverages(recentMetrics);
    const thresholds = this.config.webVitals.alertThresholds;

    // Check thresholds
    const violations: Array<{ metric: string; value: number; threshold: number }> = [];

    if (averages.LCP > thresholds.LCP) {
      violations.push({ metric: 'LCP', value: averages.LCP, threshold: thresholds.LCP });
    }

    if (averages.FID > thresholds.FID) {
      violations.push({ metric: 'FID', value: averages.FID, threshold: thresholds.FID });
    }

    if (averages.CLS > thresholds.CLS) {
      violations.push({ metric: 'CLS', value: averages.CLS, threshold: thresholds.CLS });
    }

    if (averages.TTFB > thresholds.TTFB) {
      violations.push({ metric: 'TTFB', value: averages.TTFB, threshold: thresholds.TTFB });
    }

    // Send alerts for violations
    for (const violation of violations) {
      await PerformanceAlertService.sendAlert({
        type: 'web_vitals_threshold',
        severity: 'medium',
        message: `Web Vitals threshold exceeded: ${violation.metric} = ${violation.value} > ${violation.threshold}`,
        data: {
          metric: violation.metric,
          value: violation.value,
          threshold: violation.threshold,
          sampleSize: recentMetrics.length,
        },
      });
    }

    this.emit('webVitalsChecked', { averages, violations });
  }

  /**
   * Run Lighthouse checks
   */
  private async runLighthouseChecks(): Promise<void> {
    for (const url of this.config.lighthouse.urls) {
      try {
        const result = await LighthouseCIService.runLighthouseTest(url);
        const thresholds = this.config.lighthouse.alertThresholds;

        // Check thresholds
        const violations: Array<{ metric: string; value: number; threshold: number }> = [];

        if (result.performance < thresholds.performance) {
          violations.push({ metric: 'Performance', value: result.performance, threshold: thresholds.performance });
        }

        if (result.accessibility < thresholds.accessibility) {
          violations.push({ metric: 'Accessibility', value: result.accessibility, threshold: thresholds.accessibility });
        }

        if (result.bestPractices < thresholds.bestPractices) {
          violations.push({ metric: 'Best Practices', value: result.bestPractices, threshold: thresholds.bestPractices });
        }

        if (result.seo < thresholds.seo) {
          violations.push({ metric: 'SEO', value: result.seo, threshold: thresholds.seo });
        }

        // Send alerts for violations
        for (const violation of violations) {
          await PerformanceAlertService.sendAlert({
            type: 'lighthouse_threshold',
            severity: violation.metric === 'Performance' ? 'high' : 'medium',
            message: `Lighthouse ${violation.metric} threshold exceeded: ${violation.value} < ${violation.threshold}`,
            data: {
              url,
              metric: violation.metric,
              value: violation.value,
              threshold: violation.threshold,
              fullResult: result,
            },
          });
        }

        this.emit('lighthouseChecked', { url, result, violations });

      } catch (error) {
        logger.error(`Error running Lighthouse check for ${url}:`, error);
      }
    }
  }

  /**
   * Check API latency thresholds
   */
  private async checkAPILatencyThresholds(): Promise<void> {
    for (const endpoint of this.config.apiLatency.endpoints) {
      try {
        const metrics = await this.measureEndpointLatency(endpoint);
        const thresholds = this.config.apiLatency.alertThresholds;

        const violations: Array<{ metric: string; value: number; threshold: number }> = [];

        if (metrics.p95 > thresholds.p95) {
          violations.push({ metric: 'P95 Latency', value: metrics.p95, threshold: thresholds.p95 });
        }

        if (metrics.errorRate > thresholds.errorRate) {
          violations.push({ metric: 'Error Rate', value: metrics.errorRate, threshold: thresholds.errorRate });
        }

        // Send alerts for violations
        for (const violation of violations) {
          await PerformanceAlertService.sendAlert({
            type: 'api_latency_threshold',
            severity: 'high',
            message: `API ${violation.metric} threshold exceeded for ${endpoint}: ${violation.value} > ${violation.threshold}`,
            data: {
              endpoint,
              metric: violation.metric,
              value: violation.value,
              threshold: violation.threshold,
              fullMetrics: metrics,
            },
          });
        }

        this.emit('apiLatencyChecked', { endpoint, metrics, violations });

      } catch (error) {
        logger.error(`Error checking API latency for ${endpoint}:`, error);
      }
    }
  }

  /**
   * Detect performance regressions
   */
  private async detectPerformanceRegressions(): Promise<void> {
    logger.info('Running regression detection analysis');

    try {
      // Analyze trends for different metrics
      const trends = await this.analyzePerformanceTrends();
      const regressions: RegressionAlert[] = [];

      for (const trend of trends) {
        if (trend.trend === 'degrading' && trend.significance === 'high') {
          const regression: RegressionAlert = {
            id: `regression_${Date.now()}_${trend.metric}`,
            timestamp: new Date(),
            metric: trend.metric,
            severity: this.calculateRegressionSeverity(trend.changePercentage),
            currentValue: trend.data[trend.data.length - 1]?.value || 0,
            baselineValue: trend.data[0]?.value || 0,
            changePercentage: trend.changePercentage,
            affectedUsers: await this.estimateAffectedUsers(trend.metric),
            description: `Performance regression detected in ${trend.metric}: ${trend.changePercentage.toFixed(1)}% degradation over ${trend.period}`,
            recommendations: this.generateRegressionRecommendations(trend.metric, trend.changePercentage),
          };

          regressions.push(regression);
        }
      }

      // Send regression alerts
      for (const regression of regressions) {
        await PerformanceAlertService.sendAlert({
          type: 'performance_regression',
          severity: regression.severity,
          message: regression.description,
          data: regression,
        });
      }

      this.emit('regressionDetected', regressions);

    } catch (error) {
      logger.error('Error in regression detection:', error);
    }
  }

  /**
   * Analyze performance trends
   */
  private async analyzePerformanceTrends(): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    const lookbackHours = this.config.regressionDetection.lookbackPeriod;

    // Analyze Web Vitals trends
    const webVitalsData = await WebVitalsService.getMetricsInRange(
      new Date(Date.now() - lookbackHours * 60 * 60 * 1000),
      new Date()
    );

    if (webVitalsData.length > 0) {
      const webVitalsTrends = this.calculateMetricTrends(webVitalsData, ['LCP', 'FID', 'CLS', 'TTFB']);
      trends.push(...webVitalsTrends);
    }

    // Analyze API latency trends (would integrate with your monitoring system)
    // For now, simulate trend analysis
    const apiTrends = await this.simulateAPITrends();
    trends.push(...apiTrends);

    return trends;
  }

  /**
   * Calculate metric trends
   */
  private calculateMetricTrends(data: any[], metrics: string[]): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    for (const metric of metrics) {
      const values = data.map(d => ({ timestamp: new Date(d.timestamp), value: d[metric] }))
        .filter(d => d.value != null)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (values.length < 2) continue;

      const firstValue = values[0].value;
      const lastValue = values[values.length - 1].value;
      const changePercentage = ((lastValue - firstValue) / firstValue) * 100;

      let trend: 'improving' | 'stable' | 'degrading';
      let significance: 'low' | 'medium' | 'high';

      if (Math.abs(changePercentage) < 5) {
        trend = 'stable';
        significance = 'low';
      } else if (changePercentage > 0) {
        trend = 'degrading';
        significance = changePercentage > 20 ? 'high' : changePercentage > 10 ? 'medium' : 'low';
      } else {
        trend = 'improving';
        significance = Math.abs(changePercentage) > 20 ? 'high' : Math.abs(changePercentage) > 10 ? 'medium' : 'low';
      }

      trends.push({
        metric,
        period: 'day',
        trend,
        changePercentage,
        significance,
        data: values,
      });
    }

    return trends;
  }

  /**
   * Simulate API trends (replace with real implementation)
   */
  private async simulateAPITrends(): Promise<PerformanceTrend[]> {
    // This would integrate with your actual API monitoring system
    return [];
  }

  /**
   * Calculate Web Vitals averages
   */
  private calculateWebVitalsAverages(metrics: any[]): {
    LCP: number;
    FID: number;
    CLS: number;
    TTFB: number;
  } {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      LCP: avg(metrics.map(m => m.LCP).filter(Boolean)),
      FID: avg(metrics.map(m => m.FID).filter(Boolean)),
      CLS: avg(metrics.map(m => m.CLS).filter(Boolean)),
      TTFB: avg(metrics.map(m => m.TTFB).filter(Boolean)),
    };
  }

  /**
   * Measure endpoint latency
   */
  private async measureEndpointLatency(endpoint: string): Promise<{
    p50: number;
    p95: number;
    errorRate: number;
  }> {
    // This would integrate with your actual monitoring system
    // For now, simulate realistic values
    return {
      p50: 200 + Math.random() * 100,
      p95: 400 + Math.random() * 200,
      errorRate: Math.random() * 2,
    };
  }

  /**
   * Calculate regression severity
   */
  private calculateRegressionSeverity(changePercentage: number): 'low' | 'medium' | 'high' | 'critical' {
    const absChange = Math.abs(changePercentage);

    if (absChange > 50) return 'critical';
    if (absChange > 25) return 'high';
    if (absChange > 10) return 'medium';
    return 'low';
  }

  /**
   * Estimate affected users
   */
  private async estimateAffectedUsers(metric: string): Promise<number> {
    // This would integrate with your analytics system
    // For now, simulate based on metric type
    const baseUsers = 1000;

    switch (metric) {
      case 'LCP':
      case 'FID':
        return Math.floor(baseUsers * 0.8); // High impact metrics
      case 'CLS':
      case 'TTFB':
        return Math.floor(baseUsers * 0.6); // Medium impact metrics
      default:
        return Math.floor(baseUsers * 0.4); // Lower impact metrics
    }
  }

  /**
   * Generate regression recommendations
   */
  private generateRegressionRecommendations(metric: string, changePercentage: number): string[] {
    const recommendations: string[] = [];

    switch (metric) {
      case 'LCP':
        recommendations.push('Review image optimization and lazy loading implementation');
        recommendations.push('Check server response times and CDN performance');
        recommendations.push('Analyze critical resource loading and preloading strategies');
        break;
      case 'FID':
        recommendations.push('Review JavaScript bundle size and execution time');
        recommendations.push('Check for blocking third-party scripts');
        recommendations.push('Analyze main thread blocking tasks');
        break;
      case 'CLS':
        recommendations.push('Review dynamic content insertion and image dimensions');
        recommendations.push('Check font loading strategies and web font optimization');
        recommendations.push('Analyze layout shift sources in recent deployments');
        break;
      case 'TTFB':
        recommendations.push('Review server performance and database query optimization');
        recommendations.push('Check CDN configuration and caching strategies');
        recommendations.push('Analyze API response times and backend performance');
        break;
      default:
        recommendations.push('Review recent deployments and configuration changes');
        recommendations.push('Check monitoring data for correlation with other metrics');
    }

    if (Math.abs(changePercentage) > 25) {
      recommendations.unshift('Consider immediate rollback if recent deployment caused this regression');
    }

    return recommendations;
  }

  /**
   * Schedule performance reports
   */
  private scheduleReports(): void {
    if (this.config.reporting.dailyReport) {
      const dailyJob = cron.schedule('0 9 * * *', async () => {
        await this.generateDailyReport();
      });
      this.cronJobs.set('dailyReport', dailyJob);
    }

    if (this.config.reporting.weeklyReport) {
      const weeklyJob = cron.schedule('0 9 * * 1', async () => {
        await this.generateWeeklyReport();
      });
      this.cronJobs.set('weeklyReport', weeklyJob);
    }

    if (this.config.reporting.monthlyReport) {
      const monthlyJob = cron.schedule('0 9 1 * *', async () => {
        await this.generateMonthlyReport();
      });
      this.cronJobs.set('monthlyReport', monthlyJob);
    }
  }

  /**
   * Generate daily performance report
   */
  private async generateDailyReport(): Promise<void> {
    logger.info('Generating daily performance report');

    try {
      // This would generate a comprehensive daily report
      const report = {
        date: new Date().toISOString().split('T')[0],
        summary: 'Daily performance summary',
        // Add actual report data here
      };

      // Send report to configured recipients
      await this.sendReport('Daily Performance Report', report);

    } catch (error) {
      logger.error('Error generating daily report:', error);
    }
  }

  /**
   * Generate weekly performance report
   */
  private async generateWeeklyReport(): Promise<void> {
    logger.info('Generating weekly performance report');

    try {
      // This would generate a comprehensive weekly report
      const report = {
        week: new Date().toISOString().split('T')[0],
        summary: 'Weekly performance summary',
        // Add actual report data here
      };

      // Send report to configured recipients
      await this.sendReport('Weekly Performance Report', report);

    } catch (error) {
      logger.error('Error generating weekly report:', error);
    }
  }

  /**
   * Generate monthly performance report
   */
  private async generateMonthlyReport(): Promise<void> {
    logger.info('Generating monthly performance report');

    try {
      // This would generate a comprehensive monthly report
      const report = {
        month: new Date().toISOString().split('T')[0],
        summary: 'Monthly performance summary',
        // Add actual report data here
      };

      // Send report to configured recipients
      await this.sendReport('Monthly Performance Report', report);

    } catch (error) {
      logger.error('Error generating monthly report:', error);
    }
  }

  /**
   * Send performance report
   */
  private async sendReport(subject: string, report: any): Promise<void> {
    // This would send the report via email or other channels
    logger.info(`Sending report: ${subject}`);
  }

  /**
   * Get default monitoring configuration
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      webVitals: {
        enabled: true,
        collectionInterval: 5, // 5 minutes
        alertThresholds: {
          LCP: 2500,
          FID: 100,
          CLS: 0.1,
          TTFB: 800,
        },
      },
      lighthouse: {
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
        urls: [
          process.env.PRODUCTION_URL || 'https://app.PharmacyCopilot.com',
        ],
        alertThresholds: {
          performance: 85,
          accessibility: 90,
          bestPractices: 90,
          seo: 90,
        },
      },
      apiLatency: {
        enabled: true,
        monitoringInterval: 10, // 10 minutes
        endpoints: [
          '/api/patients',
          '/api/notes',
          '/api/medications',
          '/api/dashboard/overview',
        ],
        alertThresholds: {
          p95: 1000,
          errorRate: 5,
        },
      },
      regressionDetection: {
        enabled: true,
        analysisInterval: 30, // 30 minutes
        lookbackPeriod: 24, // 24 hours
        regressionThreshold: 10, // 10% degradation
      },
      reporting: {
        dailyReport: true,
        weeklyReport: true,
        monthlyReport: true,
        recipients: process.env.PERFORMANCE_REPORT_RECIPIENTS?.split(',') || [],
      },
    };
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    config: MonitoringConfig;
    activeTasks: string[];
    activeJobs: string[];
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      activeTasks: Array.from(this.monitoringTasks.keys()),
      activeJobs: Array.from(this.cronJobs.keys()),
    };
  }

  /**
   * Update monitoring configuration
   */
  async updateConfig(newConfig: Partial<MonitoringConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    if (this.isRunning) {
      await this.stop();
      await this.start(this.config);
    }

    logger.info('Monitoring configuration updated');
  }
}

export default new ContinuousMonitoringService();
