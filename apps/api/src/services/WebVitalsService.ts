import mongoose, { Schema, Document } from 'mongoose';
import PerformanceCacheService from './PerformanceCacheService';
import { performanceAlertService, PerformanceAlert } from './PerformanceAlertService';
import { performanceBudgetService } from './PerformanceBudgetService';

export interface WebVitalsEntry {
  name: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'TTFB' | 'INP';
  value: number;
  id: string;
  timestamp: Date;
  url: string;
  userAgent: string;
  connectionType?: string;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  country?: string;
  ip?: string;
}

export interface WebVitalsSummary {
  period: string;
  metrics: {
    [key: string]: {
      p50: number;
      p75: number;
      p95: number;
      p99: number;
      count: number;
      avg: number;
    };
  };
  budgetStatus: {
    [key: string]: 'good' | 'needs-improvement' | 'poor';
  };
  totalSamples: number;
  lastUpdated: Date;
  trends: {
    [key: string]: {
      change: number; // percentage change from previous period
      direction: 'up' | 'down' | 'stable';
    };
  };
}

export interface PerformanceBudgets {
  FCP: { good: number; poor: number };
  LCP: { good: number; poor: number };
  CLS: { good: number; poor: number };
  FID: { good: number; poor: number };
  TTFB: { good: number; poor: number };
  INP: { good: number; poor: number };
}

// MongoDB Schema for Web Vitals data
const webVitalsSchema = new Schema({
  name: { type: String, required: true, enum: ['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP'] },
  value: { type: Number, required: true },
  id: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  url: { type: String, required: true },
  userAgent: { type: String, required: true },
  connectionType: { type: String },
  userId: { type: String },
  workspaceId: { type: String },
  sessionId: { type: String },
  deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
  country: { type: String },
  ip: { type: String },
}, {
  timestamps: true,
  // Create indexes for efficient querying
  indexes: [
    { timestamp: -1 },
    { name: 1, timestamp: -1 },
    { workspaceId: 1, timestamp: -1 },
    { url: 1, timestamp: -1 },
    { deviceType: 1, timestamp: -1 },
  ]
});

const WebVitalsModel = mongoose.model<WebVitalsEntry & Document>('WebVitals', webVitalsSchema);

export class WebVitalsService {
  private cacheService: PerformanceCacheService;
  private performanceBudgets: PerformanceBudgets;

  constructor() {
    this.cacheService = PerformanceCacheService.getInstance();
    this.performanceBudgets = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      TTFB: { good: 800, poor: 1800 },
      INP: { good: 200, poor: 500 },
    };
  }

  async storeWebVitalsEntry(entry: Omit<WebVitalsEntry, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    try {
      // Enhance entry with additional metadata
      const enhancedEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date(),
        deviceType: this.detectDeviceType(entry.userAgent),
        sessionId: entry.sessionId || this.generateSessionId(entry.userAgent, entry.ip),
      };

      // Store in MongoDB
      await WebVitalsModel.create(enhancedEntry);

      // Invalidate relevant caches
      await this.invalidateRelevantCaches(enhancedEntry);

      // Check performance budgets and trigger alerts if needed
      await this.checkPerformanceBudgets(enhancedEntry);

      // Check against configured performance budgets
      await performanceBudgetService.checkWebVitalsBudgets(
        { [enhancedEntry.name]: enhancedEntry.value },
        {
          url: enhancedEntry.url,
          workspaceId: enhancedEntry.workspaceId,
          userAgent: enhancedEntry.userAgent,
          deviceType: enhancedEntry.deviceType,
        }
      );

    } catch (error) {
      console.error('Error storing Web Vitals entry:', error);
      throw error;
    }
  }

  async getWebVitalsSummary(
    period: '1h' | '24h' | '7d' | '30d' = '24h',
    filters: {
      workspaceId?: string;
      url?: string;
      deviceType?: string;
      country?: string;
    } = {}
  ): Promise<WebVitalsSummary> {
    const cacheKey = `web-vitals-summary:${period}:${JSON.stringify(filters)}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<WebVitalsSummary>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      const startTime = this.getPeriodStartTime(period);
      const query: any = {
        timestamp: { $gte: startTime },
        ...filters,
      };

      // Get current period data
      const currentData = await WebVitalsModel.find(query).lean();

      // Get previous period data for trend analysis
      const previousStartTime = this.getPreviousPeriodStartTime(period, startTime);
      const previousQuery = {
        ...query,
        timestamp: { $gte: previousStartTime, $lt: startTime },
      };
      const previousData = await WebVitalsModel.find(previousQuery).lean();

      // Calculate metrics for current period
      const metrics = this.calculateMetrics(currentData);

      // Calculate trends
      const previousMetrics = this.calculateMetrics(previousData);
      const trends = this.calculateTrends(metrics, previousMetrics);

      // Determine budget status
      const budgetStatus = this.calculateBudgetStatus(metrics);

      const summary: WebVitalsSummary = {
        period,
        metrics,
        budgetStatus,
        totalSamples: currentData.length,
        lastUpdated: new Date(),
        trends,
      };

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, summary, 300);

      return summary;
    } catch (error) {
      console.error('Error getting Web Vitals summary:', error);
      throw error;
    }
  }

  async getWebVitalsTimeSeries(
    metric: string,
    period: '1h' | '24h' | '7d' | '30d' = '24h',
    interval: '1m' | '5m' | '1h' | '1d' = '1h',
    filters: any = {}
  ): Promise<Array<{ timestamp: Date; value: number; count: number }>> {
    const cacheKey = `web-vitals-timeseries:${metric}:${period}:${interval}:${JSON.stringify(filters)}`;

    const cached = await this.cacheService.get<Array<{ timestamp: Date; value: number; count: number }>>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      const startTime = this.getPeriodStartTime(period);
      const intervalMs = this.getIntervalMs(interval);

      const pipeline = [
        {
          $match: {
            name: metric,
            timestamp: { $gte: startTime },
            ...filters,
          }
        },
        {
          $group: {
            _id: {
              $toDate: {
                $subtract: [
                  { $toLong: '$timestamp' },
                  { $mod: [{ $toLong: '$timestamp' }, intervalMs] }
                ]
              }
            },
            avgValue: { $avg: '$value' },
            count: { $sum: 1 },
          }
        },
        {
          $sort: { _id: 1 as const }
        },
        {
          $project: {
            timestamp: '$_id',
            value: '$avgValue',
            count: 1,
            _id: 0,
          }
        }
      ];

      const result = await WebVitalsModel.aggregate(pipeline);

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, result, 120);

      return result;
    } catch (error) {
      console.error('Error getting Web Vitals time series:', error);
      throw error;
    }
  }

  async detectRegressions(
    metric: string,
    threshold: number = 0.2 // 20% increase
  ): Promise<Array<{
    metric: string;
    currentValue: number;
    previousValue: number;
    change: number;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }>> {
    try {
      // Compare last hour with previous hour
      const currentHour = await this.getWebVitalsSummary('1h');
      const previousHourStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const previousHourEnd = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      const previousHourData = await WebVitalsModel.find({
        name: metric,
        timestamp: { $gte: previousHourStart, $lt: previousHourEnd },
      }).lean();

      const previousHourMetrics = this.calculateMetrics(previousHourData);

      const regressions = [];
      const currentValue = currentHour.metrics[metric]?.p95 || 0;
      const previousValue = previousHourMetrics[metric]?.p95 || 0;

      if (previousValue > 0) {
        const change = (currentValue - previousValue) / previousValue;

        if (change > threshold) {
          const severity = change > 0.5 ? 'high' : change > 0.3 ? 'medium' : 'low';

          regressions.push({
            metric,
            currentValue,
            previousValue,
            change,
            severity,
            timestamp: new Date(),
          });
        }
      }

      return regressions;
    } catch (error) {
      console.error('Error detecting regressions:', error);
      return [];
    }
  }

  private calculateMetrics(data: any[]): { [key: string]: any } {
    const metrics: { [key: string]: any } = {};

    // Group by metric name
    const groupedData = data.reduce((acc, entry) => {
      if (!acc[entry.name]) {
        acc[entry.name] = [];
      }
      acc[entry.name].push(entry.value);
      return acc;
    }, {});

    // Calculate percentiles for each metric
    Object.entries(groupedData).forEach(([metricName, values]: [string, number[]]) => {
      if (values.length === 0) return;

      const sorted = values.sort((a, b) => a - b);
      const count = sorted.length;

      metrics[metricName] = {
        p50: this.percentile(sorted, 0.5),
        p75: this.percentile(sorted, 0.75),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99),
        count,
        avg: values.reduce((sum, val) => sum + val, 0) / count,
      };
    });

    return metrics;
  }

  private calculateTrends(current: any, previous: any): any {
    const trends: any = {};

    Object.keys(current).forEach(metric => {
      const currentP95 = current[metric]?.p95 || 0;
      const previousP95 = previous[metric]?.p95 || 0;

      if (previousP95 > 0) {
        const change = ((currentP95 - previousP95) / previousP95) * 100;
        trends[metric] = {
          change: Math.round(change * 100) / 100,
          direction: Math.abs(change) < 5 ? 'stable' : change > 0 ? 'up' : 'down',
        };
      } else {
        trends[metric] = { change: 0, direction: 'stable' };
      }
    });

    return trends;
  }

  private calculateBudgetStatus(metrics: any): { [key: string]: 'good' | 'needs-improvement' | 'poor' } {
    const status: { [key: string]: 'good' | 'needs-improvement' | 'poor' } = {};

    Object.entries(this.performanceBudgets).forEach(([metric, budgets]) => {
      const p75Value = metrics[metric]?.p75 || 0;

      if (p75Value <= budgets.good) {
        status[metric] = 'good';
      } else if (p75Value <= budgets.poor) {
        status[metric] = 'needs-improvement';
      } else {
        status[metric] = 'poor';
      }
    });

    return status;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone/.test(ua)) return 'mobile';
    if (/tablet|ipad/.test(ua)) return 'tablet';
    return 'desktop';
  }

  private generateSessionId(userAgent: string, ip?: string): string {
    const hash = require('crypto').createHash('md5');
    hash.update(userAgent + (ip || '') + Math.floor(Date.now() / (30 * 60 * 1000))); // 30-minute sessions
    return hash.digest('hex');
  }

  private getPeriodStartTime(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private getPreviousPeriodStartTime(period: string, currentStart: Date): Date {
    const periodMs = Date.now() - currentStart.getTime();
    return new Date(currentStart.getTime() - periodMs);
  }

  private getIntervalMs(interval: string): number {
    switch (interval) {
      case '1m':
        return 60 * 1000;
      case '5m':
        return 5 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private async invalidateRelevantCaches(entry: WebVitalsEntry): Promise<void> {
    const patterns = [
      'web-vitals-summary:*',
      `web-vitals-timeseries:${entry.name}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.invalidate(pattern);
    }
  }

  private async checkPerformanceBudgets(entry: WebVitalsEntry): Promise<void> {
    const budget = this.performanceBudgets[entry.name];
    if (!budget) return;

    let severity: 'low' | 'medium' | 'high' = 'low';
    let exceeded = false;

    if (entry.value > budget.poor) {
      severity = 'high';
      exceeded = true;
    } else if (entry.value > budget.good) {
      severity = 'medium';
      exceeded = true;
    }

    if (exceeded) {
      // Trigger alert (implement your alerting logic here)
      console.warn(`Performance budget exceeded: ${entry.name} = ${entry.value} (${severity} severity)`);

      // You could send to alerting service, Slack, email, etc.
      await this.sendPerformanceAlert({
        type: 'performance_budget_exceeded',
        metric: entry.name,
        value: entry.value,
        budget: severity === 'high' ? budget.poor : budget.good,
        severity,
        url: entry.url,
        timestamp: entry.timestamp,
        userAgent: entry.userAgent,
        deviceType: entry.deviceType,
      });
    }
  }

  private async sendPerformanceAlert(alertData: any): Promise<void> {
    const alert: PerformanceAlert = {
      type: 'performance_budget_exceeded',
      severity: alertData.severity,
      metric: alertData.metric,
      value: alertData.value,
      threshold: alertData.budget,
      url: alertData.url,
      timestamp: alertData.timestamp,
      userAgent: alertData.userAgent,
      deviceType: alertData.deviceType,
      workspaceId: alertData.workspaceId,
    };

    await performanceAlertService.sendAlert(alert);
  }

  // Static methods for ContinuousMonitoringService
  static async getRecentMetrics(timeRangeMs: number): Promise<any[]> {
    const service = new WebVitalsService();
    const startTime = new Date(Date.now() - timeRangeMs);

    const data = await WebVitalsModel.find({
      timestamp: { $gte: startTime }
    }).lean();

    return data;
  }

  static async getMetricsInRange(startDate: Date, endDate: Date): Promise<any[]> {
    const service = new WebVitalsService();

    const data = await WebVitalsModel.find({
      timestamp: { $gte: startDate, $lte: endDate }
    }).lean();

    return data;
  }
}

// Export singleton instance
export const webVitalsService = new WebVitalsService();
