import mongoose, { Schema, Document } from 'mongoose';
import PerformanceCacheService from './PerformanceCacheService';
import { performanceAlertService, PerformanceAlert } from './PerformanceAlertService';

export interface PerformanceBudget {
  id?: string;
  name: string;
  description?: string;
  workspaceId?: string;
  isActive: boolean;
  budgets: {
    lighthouse: {
      performance: { min: number; target: number };
      accessibility: { min: number; target: number };
      bestPractices: { min: number; target: number };
      seo: { min: number; target: number };
    };
    webVitals: {
      FCP: { max: number; target: number };
      LCP: { max: number; target: number };
      CLS: { max: number; target: number };
      FID: { max: number; target: number };
      TTFB: { max: number; target: number };
      INP: { max: number; target: number };
    };
    bundleSize: {
      totalGzip: { max: number; target: number }; // bytes
      totalBrotli: { max: number; target: number }; // bytes
      mainChunk: { max: number; target: number }; // bytes
      vendorChunk: { max: number; target: number }; // bytes
    };
    apiLatency: {
      p50: { max: number; target: number }; // ms
      p95: { max: number; target: number }; // ms
      p99: { max: number; target: number }; // ms
    };
  };
  alerting: {
    enabled: boolean;
    channels: string[]; // 'email', 'slack', 'webhook'
    escalation: {
      [severity: string]: {
        delay: number; // minutes
        channels: string[];
      };
    };
    cooldown: number; // minutes
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BudgetViolation {
  budgetId: string;
  budgetName: string;
  category: 'lighthouse' | 'webVitals' | 'bundleSize' | 'apiLatency';
  metric: string;
  value: number;
  budget: number;
  target: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  url?: string;
  branch?: string;
  workspaceId?: string;
  additionalData?: any;
}

export interface BudgetReport {
  budgetId: string;
  budgetName: string;
  period: string;
  summary: {
    totalChecks: number;
    violations: number;
    violationRate: number;
    averageScores: { [key: string]: number };
  };
  violations: BudgetViolation[];
  trends: {
    [metric: string]: {
      current: number;
      previous: number;
      change: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
  };
  recommendations: string[];
}

// MongoDB Schema for Performance Budgets
const performanceBudgetSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  workspaceId: { type: String },
  isActive: { type: Boolean, default: true },
  budgets: {
    lighthouse: {
      performance: { min: Number, target: Number },
      accessibility: { min: Number, target: Number },
      bestPractices: { min: Number, target: Number },
      seo: { min: Number, target: Number },
    },
    webVitals: {
      FCP: { max: Number, target: Number },
      LCP: { max: Number, target: Number },
      CLS: { max: Number, target: Number },
      FID: { max: Number, target: Number },
      TTFB: { max: Number, target: Number },
      INP: { max: Number, target: Number },
    },
    bundleSize: {
      totalGzip: { max: Number, target: Number },
      totalBrotli: { max: Number, target: Number },
      mainChunk: { max: Number, target: Number },
      vendorChunk: { max: Number, target: Number },
    },
    apiLatency: {
      p50: { max: Number, target: Number },
      p95: { max: Number, target: Number },
      p99: { max: Number, target: Number },
    },
  },
  alerting: {
    enabled: { type: Boolean, default: true },
    channels: [{ type: String, enum: ['email', 'slack', 'webhook'] }],
    escalation: { type: Map, of: Schema.Types.Mixed },
    cooldown: { type: Number, default: 15 },
  },
}, {
  timestamps: true,
  indexes: [
    { workspaceId: 1, isActive: 1 },
    { name: 1 },
  ]
});

// MongoDB Schema for Budget Violations
const budgetViolationSchema = new Schema({
  budgetId: { type: String, required: true },
  budgetName: { type: String, required: true },
  category: { type: String, required: true, enum: ['lighthouse', 'webVitals', 'bundleSize', 'apiLatency'] },
  metric: { type: String, required: true },
  value: { type: Number, required: true },
  budget: { type: Number, required: true },
  target: { type: Number, required: true },
  severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'] },
  timestamp: { type: Date, required: true, default: Date.now },
  url: { type: String },
  branch: { type: String },
  workspaceId: { type: String },
  additionalData: { type: Schema.Types.Mixed },
}, {
  timestamps: true,
  indexes: [
    { budgetId: 1, timestamp: -1 },
    { workspaceId: 1, timestamp: -1 },
    { category: 1, metric: 1, timestamp: -1 },
    { severity: 1, timestamp: -1 },
  ]
});

const PerformanceBudgetModel = mongoose.model<PerformanceBudget & Document>('PerformanceBudget', performanceBudgetSchema);
const BudgetViolationModel = mongoose.model<BudgetViolation & Document>('BudgetViolation', budgetViolationSchema);

export class PerformanceBudgetService {
  private cacheService: PerformanceCacheService;

  constructor() {
    this.cacheService = PerformanceCacheService.getInstance();
  }

  async createBudget(budget: Omit<PerformanceBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<PerformanceBudget> {
    try {
      const savedBudget = await PerformanceBudgetModel.create(budget);
      await this.invalidateBudgetCaches();
      return savedBudget.toObject();
    } catch (error) {
      console.error('Error creating performance budget:', error);
      throw error;
    }
  }

  async updateBudget(id: string, updates: Partial<PerformanceBudget>): Promise<PerformanceBudget | null> {
    try {
      const updatedBudget = await PerformanceBudgetModel.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      ).lean();

      if (updatedBudget) {
        await this.invalidateBudgetCaches();
      }

      return updatedBudget;
    } catch (error) {
      console.error('Error updating performance budget:', error);
      throw error;
    }
  }

  async deleteBudget(id: string): Promise<boolean> {
    try {
      const result = await PerformanceBudgetModel.findByIdAndDelete(id);
      if (result) {
        await this.invalidateBudgetCaches();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting performance budget:', error);
      throw error;
    }
  }

  async getBudgets(workspaceId?: string): Promise<PerformanceBudget[]> {
    const cacheKey = `performance-budgets:${workspaceId || 'global'}`;

    const cached = await this.cacheService.getCachedApiResponse<PerformanceBudget[]>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      const query: any = { isActive: true };
      if (workspaceId) {
        query.$or = [{ workspaceId }, { workspaceId: { $exists: false } }];
      }

      const budgets = await PerformanceBudgetModel.find(query).lean();

      // Cache for 10 minutes
      await this.cacheService.cacheApiResponse(cacheKey, budgets, { ttl: 600 });

      return budgets;
    } catch (error) {
      console.error('Error getting performance budgets:', error);
      throw error;
    }
  }

  async getBudget(id: string): Promise<PerformanceBudget | null> {
    try {
      const budget = await PerformanceBudgetModel.findById(id).lean();
      return budget;
    } catch (error) {
      console.error('Error getting performance budget:', error);
      throw error;
    }
  }

  async checkLighthouseBudgets(
    result: {
      scores: { [key: string]: number };
      metrics: { [key: string]: number };
      url: string;
      branch?: string;
      workspaceId?: string;
    }
  ): Promise<BudgetViolation[]> {
    try {
      const budgets = await this.getBudgets(result.workspaceId);
      const violations: BudgetViolation[] = [];

      for (const budget of budgets) {
        // Check Lighthouse scores
        Object.entries(result.scores).forEach(([metric, value]) => {
          const budgetConfig = budget.budgets.lighthouse[metric as keyof typeof budget.budgets.lighthouse];
          if (budgetConfig && value < budgetConfig.min) {
            const severity = this.calculateSeverity(value, budgetConfig.min, budgetConfig.target);
            violations.push({
              budgetId: budget.id!,
              budgetName: budget.name,
              category: 'lighthouse',
              metric,
              value,
              budget: budgetConfig.min,
              target: budgetConfig.target,
              severity,
              timestamp: new Date(),
              url: result.url,
              branch: result.branch,
              workspaceId: result.workspaceId,
            });
          }
        });

        // Check Lighthouse metrics (if available)
        Object.entries(result.metrics).forEach(([metric, value]) => {
          const webVitalsBudget = budget.budgets.webVitals[metric as keyof typeof budget.budgets.webVitals];
          if (webVitalsBudget && value > webVitalsBudget.max) {
            const severity = this.calculateSeverity(value, webVitalsBudget.max, webVitalsBudget.target, true);
            violations.push({
              budgetId: budget.id!,
              budgetName: budget.name,
              category: 'webVitals',
              metric,
              value,
              budget: webVitalsBudget.max,
              target: webVitalsBudget.target,
              severity,
              timestamp: new Date(),
              url: result.url,
              branch: result.branch,
              workspaceId: result.workspaceId,
            });
          }
        });
      }

      // Store violations and send alerts
      for (const violation of violations) {
        await this.recordViolation(violation);
        await this.sendViolationAlert(violation);
      }

      return violations;
    } catch (error) {
      console.error('Error checking Lighthouse budgets:', error);
      return [];
    }
  }

  async checkWebVitalsBudgets(
    metrics: { [key: string]: number },
    context: {
      url: string;
      workspaceId?: string;
      userAgent?: string;
      deviceType?: string;
    }
  ): Promise<BudgetViolation[]> {
    try {
      const budgets = await this.getBudgets(context.workspaceId);
      const violations: BudgetViolation[] = [];

      for (const budget of budgets) {
        Object.entries(metrics).forEach(([metric, value]) => {
          const budgetConfig = budget.budgets.webVitals[metric as keyof typeof budget.budgets.webVitals];
          if (budgetConfig && value > budgetConfig.max) {
            const severity = this.calculateSeverity(value, budgetConfig.max, budgetConfig.target, true);
            violations.push({
              budgetId: budget.id!,
              budgetName: budget.name,
              category: 'webVitals',
              metric,
              value,
              budget: budgetConfig.max,
              target: budgetConfig.target,
              severity,
              timestamp: new Date(),
              url: context.url,
              workspaceId: context.workspaceId,
              additionalData: {
                userAgent: context.userAgent,
                deviceType: context.deviceType,
              },
            });
          }
        });
      }

      // Store violations and send alerts
      for (const violation of violations) {
        await this.recordViolation(violation);
        await this.sendViolationAlert(violation);
      }

      return violations;
    } catch (error) {
      console.error('Error checking Web Vitals budgets:', error);
      return [];
    }
  }

  async checkBundleSizeBudgets(
    bundleData: {
      totalGzip: number;
      totalBrotli: number;
      mainChunk: number;
      vendorChunk: number;
    },
    context: {
      branch?: string;
      commit?: string;
      workspaceId?: string;
    }
  ): Promise<BudgetViolation[]> {
    try {
      const budgets = await this.getBudgets(context.workspaceId);
      const violations: BudgetViolation[] = [];

      for (const budget of budgets) {
        Object.entries(bundleData).forEach(([metric, value]) => {
          const budgetConfig = budget.budgets.bundleSize[metric as keyof typeof budget.budgets.bundleSize];
          if (budgetConfig && value > budgetConfig.max) {
            const severity = this.calculateSeverity(value, budgetConfig.max, budgetConfig.target, true);
            violations.push({
              budgetId: budget.id!,
              budgetName: budget.name,
              category: 'bundleSize',
              metric,
              value,
              budget: budgetConfig.max,
              target: budgetConfig.target,
              severity,
              timestamp: new Date(),
              branch: context.branch,
              workspaceId: context.workspaceId,
              additionalData: {
                commit: context.commit,
              },
            });
          }
        });
      }

      // Store violations and send alerts
      for (const violation of violations) {
        await this.recordViolation(violation);
        await this.sendViolationAlert(violation);
      }

      return violations;
    } catch (error) {
      console.error('Error checking bundle size budgets:', error);
      return [];
    }
  }

  async checkAPILatencyBudgets(
    latencyData: {
      p50: number;
      p95: number;
      p99: number;
    },
    context: {
      endpoint?: string;
      workspaceId?: string;
    }
  ): Promise<BudgetViolation[]> {
    try {
      const budgets = await this.getBudgets(context.workspaceId);
      const violations: BudgetViolation[] = [];

      for (const budget of budgets) {
        Object.entries(latencyData).forEach(([metric, value]) => {
          const budgetConfig = budget.budgets.apiLatency[metric as keyof typeof budget.budgets.apiLatency];
          if (budgetConfig && value > budgetConfig.max) {
            const severity = this.calculateSeverity(value, budgetConfig.max, budgetConfig.target, true);
            violations.push({
              budgetId: budget.id!,
              budgetName: budget.name,
              category: 'apiLatency',
              metric,
              value,
              budget: budgetConfig.max,
              target: budgetConfig.target,
              severity,
              timestamp: new Date(),
              workspaceId: context.workspaceId,
              additionalData: {
                endpoint: context.endpoint,
              },
            });
          }
        });
      }

      // Store violations and send alerts
      for (const violation of violations) {
        await this.recordViolation(violation);
        await this.sendViolationAlert(violation);
      }

      return violations;
    } catch (error) {
      console.error('Error checking API latency budgets:', error);
      return [];
    }
  }

  async getBudgetReport(
    budgetId: string,
    period: '24h' | '7d' | '30d' = '7d'
  ): Promise<BudgetReport> {
    try {
      const budget = await this.getBudget(budgetId);
      if (!budget) {
        throw new Error(`Budget not found: ${budgetId}`);
      }

      const startTime = this.getPeriodStartTime(period);

      // Get violations for the period
      const violations = await BudgetViolationModel.find({
        budgetId,
        timestamp: { $gte: startTime },
      }).lean();

      // Calculate summary statistics
      const totalChecks = await this.estimateTotalChecks(budgetId, startTime);
      const violationRate = totalChecks > 0 ? (violations.length / totalChecks) * 100 : 0;

      // Calculate average scores (placeholder - would need actual implementation)
      const averageScores = this.calculateAverageScores(violations);

      // Calculate trends (placeholder - would need previous period data)
      const trends = await this.calculateBudgetTrends(budgetId, startTime);

      // Generate recommendations
      const recommendations = this.generateBudgetRecommendations(violations, budget);

      return {
        budgetId,
        budgetName: budget.name,
        period,
        summary: {
          totalChecks,
          violations: violations.length,
          violationRate,
          averageScores,
        },
        violations,
        trends,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating budget report:', error);
      throw error;
    }
  }

  private calculateSeverity(
    value: number,
    budget: number,
    target: number,
    higherIsBad: boolean = false
  ): 'low' | 'medium' | 'high' | 'critical' {
    const deviation = higherIsBad
      ? (value - budget) / budget
      : (budget - value) / budget;

    if (deviation > 0.5) return 'critical';
    if (deviation > 0.3) return 'high';
    if (deviation > 0.1) return 'medium';
    return 'low';
  }

  private async recordViolation(violation: BudgetViolation): Promise<void> {
    try {
      await BudgetViolationModel.create(violation);
    } catch (error) {
      console.error('Error recording budget violation:', error);
    }
  }

  private async sendViolationAlert(violation: BudgetViolation): Promise<void> {
    try {
      const budget = await this.getBudget(violation.budgetId);
      if (!budget || !budget.alerting.enabled) {
        return;
      }

      const alert: PerformanceAlert = {
        type: 'performance_budget_exceeded',
        severity: violation.severity,
        metric: violation.metric,
        value: violation.value,
        threshold: violation.budget,
        url: violation.url || 'N/A',
        timestamp: violation.timestamp,
        additionalData: {
          budgetName: violation.budgetName,
          category: violation.category,
          target: violation.target,
          ...violation.additionalData,
        },
      };

      await performanceAlertService.sendAlert(alert);
    } catch (error) {
      console.error('Error sending violation alert:', error);
    }
  }

  private getPeriodStartTime(period: string): Date {
    const now = new Date();
    switch (period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  private async estimateTotalChecks(budgetId: string, startTime: Date): Promise<number> {
    // This is a placeholder - in a real implementation, you'd track actual checks
    // For now, estimate based on violation frequency
    const violations = await BudgetViolationModel.countDocuments({
      budgetId,
      timestamp: { $gte: startTime },
    });

    // Assume violations represent ~10% of total checks (rough estimate)
    return Math.max(violations * 10, violations);
  }

  private calculateAverageScores(violations: BudgetViolation[]): { [key: string]: number } {
    // Placeholder implementation
    const scores: { [key: string]: number } = {};

    violations.forEach(violation => {
      if (!scores[violation.metric]) {
        scores[violation.metric] = violation.value;
      } else {
        scores[violation.metric] = (scores[violation.metric] + violation.value) / 2;
      }
    });

    return scores;
  }

  private async calculateBudgetTrends(budgetId: string, startTime: Date): Promise<any> {
    // Placeholder implementation - would need previous period data
    return {};
  }

  private generateBudgetRecommendations(violations: BudgetViolation[], budget: PerformanceBudget): string[] {
    const recommendations: string[] = [];

    const violationsByCategory = violations.reduce((acc, violation) => {
      if (!acc[violation.category]) acc[violation.category] = [];
      acc[violation.category].push(violation);
      return acc;
    }, {} as { [key: string]: BudgetViolation[] });

    Object.entries(violationsByCategory).forEach(([category, categoryViolations]) => {
      const count = categoryViolations.length;

      switch (category) {
        case 'lighthouse':
          recommendations.push(`${count} Lighthouse score violations detected. Focus on optimizing critical rendering path and reducing JavaScript execution time.`);
          break;
        case 'webVitals':
          recommendations.push(`${count} Web Vitals violations detected. Review LCP optimization, layout stability, and input responsiveness.`);
          break;
        case 'bundleSize':
          recommendations.push(`${count} bundle size violations detected. Consider code splitting, tree shaking, and dependency optimization.`);
          break;
        case 'apiLatency':
          recommendations.push(`${count} API latency violations detected. Review database queries, caching strategies, and server performance.`);
          break;
      }
    });

    return recommendations;
  }

  private async invalidateBudgetCaches(): Promise<void> {
    const patterns = [
      'performance-budgets:*',
    ];

    for (const pattern of patterns) {
      await this.cacheService.invalidateByPattern(pattern);
    }
  }

  // Create default budget for new workspaces
  async createDefaultBudget(workspaceId: string): Promise<PerformanceBudget> {
    const defaultBudget: Omit<PerformanceBudget, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Default Performance Budget',
      description: 'Default performance budget with industry standard thresholds',
      workspaceId,
      isActive: true,
      budgets: {
        lighthouse: {
          performance: { min: 90, target: 95 },
          accessibility: { min: 90, target: 95 },
          bestPractices: { min: 90, target: 95 },
          seo: { min: 80, target: 90 },
        },
        webVitals: {
          FCP: { max: 1800, target: 1200 },
          LCP: { max: 2500, target: 1800 },
          CLS: { max: 0.1, target: 0.05 },
          FID: { max: 100, target: 50 },
          TTFB: { max: 800, target: 400 },
          INP: { max: 200, target: 100 },
        },
        bundleSize: {
          totalGzip: { max: 500 * 1024, target: 300 * 1024 }, // 500KB max, 300KB target
          totalBrotli: { max: 400 * 1024, target: 250 * 1024 }, // 400KB max, 250KB target
          mainChunk: { max: 200 * 1024, target: 150 * 1024 }, // 200KB max, 150KB target
          vendorChunk: { max: 300 * 1024, target: 200 * 1024 }, // 300KB max, 200KB target
        },
        apiLatency: {
          p50: { max: 200, target: 100 }, // 200ms max, 100ms target
          p95: { max: 500, target: 300 }, // 500ms max, 300ms target
          p99: { max: 1000, target: 600 }, // 1s max, 600ms target
        },
      },
      alerting: {
        enabled: true,
        channels: ['slack'],
        escalation: {
          low: { delay: 0, channels: ['slack'] },
          medium: { delay: 0, channels: ['slack', 'email'] },
          high: { delay: 0, channels: ['slack', 'email'] },
          critical: { delay: 0, channels: ['slack', 'email'] },
        },
        cooldown: 15,
      },
    };

    return await this.createBudget(defaultBudget);
  }
}

// Export singleton instance
export const performanceBudgetService = new PerformanceBudgetService();
