import mongoose, { Schema, Document } from 'mongoose';
import PerformanceCacheService from './PerformanceCacheService';
import { performanceAlertService, PerformanceAlert } from './PerformanceAlertService';
import { performanceBudgetService } from './PerformanceBudgetService';

export interface LighthouseResult {
  url: string;
  timestamp: Date;
  runId: string;
  branch: string;
  commit: string;
  workspaceId: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    totalBlockingTime: number;
    speedIndex: number;
    timeToInteractive: number;
  };
  budgetStatus: {
    [key: string]: 'passed' | 'failed';
  };
  reportUrl?: string;
  rawResult: any;
}

export interface LighthouseTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface LighthouseComparison {
  current: LighthouseResult;
  baseline: LighthouseResult;
  trends: LighthouseTrend[];
  regressions: Array<{
    metric: string;
    current: number;
    baseline: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// MongoDB Schema for Lighthouse results
const lighthouseResultSchema = new Schema({
  url: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  runId: { type: String, required: true, unique: true },
  branch: { type: String, required: true },
  commit: { type: String, required: true },
  workspaceId: { type: String, required: true },
  scores: {
    performance: { type: Number, required: true },
    accessibility: { type: Number, required: true },
    bestPractices: { type: Number, required: true },
    seo: { type: Number, required: true },
  },
  metrics: {
    firstContentfulPaint: { type: Number },
    largestContentfulPaint: { type: Number },
    cumulativeLayoutShift: { type: Number },
    totalBlockingTime: { type: Number },
    speedIndex: { type: Number },
    timeToInteractive: { type: Number },
  },
  budgetStatus: { type: Map, of: String },
  reportUrl: { type: String },
  rawResult: { type: Schema.Types.Mixed },
}, {
  timestamps: true,
  indexes: [
    { timestamp: -1 },
    { branch: 1, timestamp: -1 },
    { url: 1, timestamp: -1 },
    { runId: 1 },
    { workspaceId: 1 },
  ]
});

const LighthouseResultModel = mongoose.model<LighthouseResult & Document>('LighthouseResult', lighthouseResultSchema);

export class LighthouseCIService {
  private cacheService: PerformanceCacheService;
  private performanceBudgets: { [key: string]: number };

  constructor() {
    this.cacheService = PerformanceCacheService.getInstance();
    this.performanceBudgets = {
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 80,
      firstContentfulPaint: 2000,
      largestContentfulPaint: 2500,
      cumulativeLayoutShift: 0.1,
      totalBlockingTime: 300,
      speedIndex: 3000,
      timeToInteractive: 3800,
    };
  }

  async storeLighthouseResult(result: Omit<LighthouseResult, 'timestamp'>): Promise<LighthouseResult> {
    try {
      // Calculate budget status
      const budgetStatus = this.calculateBudgetStatus(result);

      const enhancedResult = {
        ...result,
        timestamp: new Date(),
        budgetStatus,
      };

      // Store in MongoDB
      const savedResult = await LighthouseResultModel.create(enhancedResult);

      // Check for regressions
      await this.checkForRegressions(savedResult);

      // Check against performance budgets
      await performanceBudgetService.checkLighthouseBudgets({
        scores: savedResult.scores,
        metrics: savedResult.metrics,
        url: savedResult.url,
        branch: savedResult.branch,
        workspaceId: savedResult.workspaceId,
      });

      // Invalidate relevant caches
      await this.invalidateRelevantCaches(savedResult);

      return savedResult.toObject();
    } catch (error) {
      console.error('Error storing Lighthouse result:', error);
      throw error;
    }
  }

  async getLighthouseResults(
    filters: {
      branch?: string;
      url?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<LighthouseResult[]> {
    const cacheKey = `lighthouse-results:${JSON.stringify(filters)}`;

    const cached = await this.cacheService.get<LighthouseResult[]>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      const query: any = {};

      if (filters.branch) query.branch = filters.branch;
      if (filters.url) query.url = filters.url;
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      const results = await LighthouseResultModel
        .find(query)
        .sort({ timestamp: -1 })
        .limit(filters.limit || 50)
        .lean();

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, results, 300);

      return results;
    } catch (error) {
      console.error('Error getting Lighthouse results:', error);
      throw error;
    }
  }

  async compareLighthouseResults(
    currentRunId: string,
    baselineRunId?: string
  ): Promise<LighthouseComparison> {
    try {
      const current = await LighthouseResultModel.findOne({ runId: currentRunId }).lean();
      if (!current) {
        throw new Error(`Lighthouse result not found: ${currentRunId}`);
      }

      let baseline: LighthouseResult;

      if (baselineRunId) {
        const baselineResult = await LighthouseResultModel.findOne({ runId: baselineRunId }).lean();
        if (!baselineResult) {
          throw new Error(`Baseline Lighthouse result not found: ${baselineRunId}`);
        }
        baseline = baselineResult;
      } else {
        // Use the most recent result from the same branch (excluding current)
        const baselineResult = await LighthouseResultModel
          .findOne({
            branch: current.branch,
            url: current.url,
            timestamp: { $lt: current.timestamp },
          })
          .sort({ timestamp: -1 })
          .lean();

        if (!baselineResult) {
          throw new Error('No baseline result found for comparison');
        }
        baseline = baselineResult;
      }

      // Calculate trends
      const trends = this.calculateTrends(current, baseline);

      // Detect regressions
      const regressions = this.detectRegressions(current, baseline);

      return {
        current,
        baseline,
        trends,
        regressions,
      };
    } catch (error) {
      console.error('Error comparing Lighthouse results:', error);
      throw error;
    }
  }

  async getLighthouseTrends(
    branch: string = 'main',
    url?: string,
    days: number = 30
  ): Promise<Array<{
    date: Date;
    scores: { [key: string]: number };
    metrics: { [key: string]: number };
  }>> {
    const cacheKey = `lighthouse-trends:${branch}:${url}:${days}`;

    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const query: any = {
        branch,
        timestamp: { $gte: startDate },
      };

      if (url) query.url = url;

      const results = await LighthouseResultModel
        .find(query)
        .sort({ timestamp: 1 })
        .lean();

      // Group by day and calculate averages
      const dailyData = new Map();

      results.forEach(result => {
        const dateKey = result.timestamp.toISOString().split('T')[0];

        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, {
            date: new Date(dateKey),
            scores: [],
            metrics: [],
          });
        }

        const dayData = dailyData.get(dateKey);
        dayData.scores.push(result.scores);
        dayData.metrics.push(result.metrics);
      });

      // Calculate averages for each day
      const trends = Array.from(dailyData.values()).map(dayData => ({
        date: dayData.date,
        scores: this.calculateAverages(dayData.scores),
        metrics: this.calculateAverages(dayData.metrics),
      }));

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, trends, 3600);

      return trends;
    } catch (error) {
      console.error('Error getting Lighthouse trends:', error);
      throw error;
    }
  }

  async generatePerformanceReport(
    branch: string = 'main',
    days: number = 7
  ): Promise<{
    summary: {
      totalRuns: number;
      averageScores: { [key: string]: number };
      budgetViolations: number;
      regressionCount: number;
    };
    trends: any[];
    recentRegressions: any[];
    recommendations: string[];
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const results = await LighthouseResultModel
        .find({
          branch,
          timestamp: { $gte: startDate },
        })
        .sort({ timestamp: -1 })
        .lean();

      // Calculate summary statistics
      const totalRuns = results.length;
      const averageScores = this.calculateAverages(results.map(r => r.scores));

      const budgetViolations = results.reduce((count, result) => {
        return count + Object.values(result.budgetStatus).filter(status => status === 'failed').length;
      }, 0);

      // Get trends
      const trends = await this.getLighthouseTrends(branch, undefined, days);

      // Get recent regressions (placeholder - would need regression detection logic)
      const recentRegressions: any[] = [];

      // Generate recommendations
      const recommendations = this.generateRecommendations(averageScores, results);

      return {
        summary: {
          totalRuns,
          averageScores,
          budgetViolations,
          regressionCount: recentRegressions.length,
        },
        trends,
        recentRegressions,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw error;
    }
  }

  private calculateBudgetStatus(result: Omit<LighthouseResult, 'timestamp' | 'budgetStatus'>): { [key: string]: 'passed' | 'failed' } {
    const status: { [key: string]: 'passed' | 'failed' } = {};

    // Check scores
    Object.entries(result.scores).forEach(([key, value]) => {
      const budget = this.performanceBudgets[key];
      status[key] = budget && value >= budget ? 'passed' : 'failed';
    });

    // Check metrics
    Object.entries(result.metrics).forEach(([key, value]) => {
      const budget = this.performanceBudgets[key];
      if (budget && value !== undefined) {
        status[key] = value <= budget ? 'passed' : 'failed';
      }
    });

    return status;
  }

  private calculateTrends(current: LighthouseResult, baseline: LighthouseResult): LighthouseTrend[] {
    const trends: LighthouseTrend[] = [];

    // Compare scores
    Object.entries(current.scores).forEach(([metric, currentValue]) => {
      const baselineValue = baseline.scores[metric as keyof typeof baseline.scores];
      if (baselineValue !== undefined) {
        const change = currentValue - baselineValue;
        const changePercent = (change / baselineValue) * 100;

        trends.push({
          metric,
          current: currentValue,
          previous: baselineValue,
          change,
          changePercent,
          trend: Math.abs(changePercent) < 2 ? 'stable' : changePercent > 0 ? 'improving' : 'degrading',
        });
      }
    });

    // Compare metrics
    Object.entries(current.metrics).forEach(([metric, currentValue]) => {
      const baselineValue = baseline.metrics[metric as keyof typeof baseline.metrics];
      if (baselineValue !== undefined && currentValue !== undefined) {
        const change = currentValue - baselineValue;
        const changePercent = (change / baselineValue) * 100;

        trends.push({
          metric,
          current: currentValue,
          previous: baselineValue,
          change,
          changePercent,
          trend: Math.abs(changePercent) < 5 ? 'stable' : changePercent < 0 ? 'improving' : 'degrading',
        });
      }
    });

    return trends;
  }

  private detectRegressions(current: LighthouseResult, baseline: LighthouseResult): Array<{
    metric: string;
    current: number;
    baseline: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high';
  }> {
    const regressions: Array<{
      metric: string;
      current: number;
      baseline: number;
      threshold: number;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check score regressions (decrease is bad)
    Object.entries(current.scores).forEach(([metric, currentValue]) => {
      const baselineValue = baseline.scores[metric as keyof typeof baseline.scores];
      if (baselineValue !== undefined) {
        const change = ((currentValue - baselineValue) / baselineValue) * 100;

        if (change < -5) { // 5% decrease
          const severity = change < -15 ? 'high' : change < -10 ? 'medium' : 'low';
          regressions.push({
            metric,
            current: currentValue,
            baseline: baselineValue,
            threshold: -5,
            severity,
          });
        }
      }
    });

    // Check metric regressions (increase is bad for metrics)
    Object.entries(current.metrics).forEach(([metric, currentValue]) => {
      const baselineValue = baseline.metrics[metric as keyof typeof baseline.metrics];
      if (baselineValue !== undefined && currentValue !== undefined) {
        const change = ((currentValue - baselineValue) / baselineValue) * 100;

        if (change > 10) { // 10% increase
          const severity = change > 30 ? 'high' : change > 20 ? 'medium' : 'low';
          regressions.push({
            metric,
            current: currentValue,
            baseline: baselineValue,
            threshold: 10,
            severity,
          });
        }
      }
    });

    return regressions;
  }

  private async checkForRegressions(result: LighthouseResult): Promise<void> {
    try {
      // Get the previous result for comparison
      const previousResult = await LighthouseResultModel
        .findOne({
          branch: result.branch,
          url: result.url,
          timestamp: { $lt: result.timestamp },
        })
        .sort({ timestamp: -1 })
        .lean();

      if (!previousResult) return;

      const regressions = this.detectRegressions(result, previousResult);

      // Send alerts for significant regressions
      for (const regression of regressions) {
        if (regression.severity === 'high' || regression.severity === 'medium') {
          const alert: PerformanceAlert = {
            type: 'lighthouse_failure',
            severity: regression.severity,
            metric: regression.metric,
            value: regression.current,
            threshold: regression.baseline,
            url: result.url,
            timestamp: result.timestamp,
            additionalData: {
              branch: result.branch,
              commit: result.commit,
              runId: result.runId,
              reportUrl: result.reportUrl,
            },
          };

          await performanceAlertService.sendAlert(alert);
        }
      }
    } catch (error) {
      console.error('Error checking for regressions:', error);
    }
  }

  private calculateAverages(data: any[]): { [key: string]: number } {
    if (data.length === 0) return {};

    const sums: { [key: string]: number } = {};
    const counts: { [key: string]: number } = {};

    data.forEach(item => {
      Object.entries(item).forEach(([key, value]) => {
        if (typeof value === 'number') {
          sums[key] = (sums[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });

    const averages: { [key: string]: number } = {};
    Object.keys(sums).forEach(key => {
      averages[key] = Math.round((sums[key] / counts[key]) * 100) / 100;
    });

    return averages;
  }

  private generateRecommendations(averageScores: { [key: string]: number }, results: LighthouseResult[]): string[] {
    const recommendations: string[] = [];

    if (averageScores.performance < 90) {
      recommendations.push('Performance score is below target (90). Consider optimizing critical rendering path and reducing JavaScript execution time.');
    }

    if (averageScores.accessibility < 90) {
      recommendations.push('Accessibility score needs improvement. Review color contrast, alt text, and keyboard navigation.');
    }

    if (averageScores.bestPractices < 90) {
      recommendations.push('Best practices score can be improved. Check for HTTPS usage, console errors, and deprecated APIs.');
    }

    // Check for consistent budget violations
    const budgetViolationCounts = new Map();
    results.forEach(result => {
      Object.entries(result.budgetStatus).forEach(([metric, status]) => {
        if (status === 'failed') {
          budgetViolationCounts.set(metric, (budgetViolationCounts.get(metric) || 0) + 1);
        }
      });
    });

    budgetViolationCounts.forEach((count, metric) => {
      if (count > results.length * 0.5) { // More than 50% of runs
        recommendations.push(`${metric} consistently exceeds budget. This metric needs focused optimization.`);
      }
    });

    return recommendations;
  }

  private async invalidateRelevantCaches(result: LighthouseResult): Promise<void> {
    const patterns = [
      'lighthouse-results:*',
      `lighthouse-trends:${result.branch}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.invalidateByPattern(pattern);
    }
  }

  // Static method for ContinuousMonitoringService
  static async runLighthouseTest(url: string): Promise<{
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  }> {
    // This would integrate with a real Lighthouse testing service
    // For now, simulate realistic test results
    const service = new LighthouseCIService();

    // Simulate running Lighthouse test
    const result = {
      performance: 85 + Math.random() * 10, // 85-95
      accessibility: 90 + Math.random() * 8, // 90-98
      bestPractices: 88 + Math.random() * 10, // 88-98
      seo: 85 + Math.random() * 12, // 85-97
    };

    // Round to nearest integer
    return {
      performance: Math.round(result.performance),
      accessibility: Math.round(result.accessibility),
      bestPractices: Math.round(result.bestPractices),
      seo: Math.round(result.seo),
    };
  }
}

// Export singleton instance
export const lighthouseCIService = new LighthouseCIService();
