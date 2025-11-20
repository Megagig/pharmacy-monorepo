import { WebVitalsService } from './WebVitalsService';
import { LighthouseCIService } from './LighthouseCIService';
import { PerformanceBudgetService } from './PerformanceBudgetService';
import PerformanceCacheService from './PerformanceCacheService';
import { performanceAlertService } from './PerformanceAlertService';

export interface PerformanceOverview {
  timestamp: Date;
  webVitals: {
    summary: any;
    recentViolations: number;
    trendDirection: 'improving' | 'degrading' | 'stable';
  };
  lighthouse: {
    latestScores: { [key: string]: number };
    recentRuns: number;
    budgetViolations: number;
    trendDirection: 'improving' | 'degrading' | 'stable';
  };
  budgets: {
    totalBudgets: number;
    activeBudgets: number;
    recentViolations: number;
    violationRate: number;
  };
  api: {
    p95Latency: number;
    errorRate: number;
    throughput: number;
    trendDirection: 'improving' | 'degrading' | 'stable';
  };
  alerts: {
    activeAlerts: number;
    recentAlerts: number;
    criticalAlerts: number;
  };
  recommendations: string[];
}

export interface PerformanceTrend {
  metric: string;
  category: 'webVitals' | 'lighthouse' | 'api' | 'bundle';
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
  timestamp: Date;
}

export interface PerformanceAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
  resolved: boolean;
  url?: string;
  workspaceId?: string;
}

export interface PerformanceReport {
  period: string;
  generatedAt: Date;
  overview: PerformanceOverview;
  trends: PerformanceTrend[];
  topIssues: Array<{
    category: string;
    metric: string;
    severity: string;
    count: number;
    impact: string;
  }>;
  recommendations: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedImpact: string;
  }>;
  budgetCompliance: {
    overallScore: number;
    categoryScores: { [key: string]: number };
    violationsByCategory: { [key: string]: number };
  };
}

export class PerformanceMonitoringService {
  private webVitalsService: WebVitalsService;
  private lighthouseService: LighthouseCIService;
  private budgetService: PerformanceBudgetService;
  private cacheService: PerformanceCacheService;

  constructor() {
    this.webVitalsService = new WebVitalsService();
    this.lighthouseService = new LighthouseCIService();
    this.budgetService = new PerformanceBudgetService();
    this.cacheService = PerformanceCacheService.getInstance();
  }

  async getPerformanceOverview(workspaceId?: string): Promise<PerformanceOverview> {
    const cacheKey = `performance-overview:${workspaceId || 'global'}`;

    const cached = await this.cacheService.get<PerformanceOverview>(cacheKey);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as any;
    }

    try {
      // Get Web Vitals summary
      const webVitalsSummary = await this.webVitalsService.getWebVitalsSummary('24h', { workspaceId });

      // Get recent Lighthouse results
      const lighthouseResults = await this.lighthouseService.getLighthouseResults({
        limit: 10,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });

      // Get budget information
      const budgets = await this.budgetService.getBudgets(workspaceId);
      const activeBudgets = budgets.filter(b => b.isActive);

      // Calculate recent violations (placeholder - would need actual implementation)
      const recentWebVitalsViolations = 0; // Would query violation records
      const recentLighthouseViolations = 0; // Would query violation records
      const recentBudgetViolations = 0; // Would query violation records

      // Calculate trends (simplified)
      const webVitalsTrend = this.calculateTrendDirection(webVitalsSummary.trends);
      const lighthouseTrend = this.calculateLighthouseTrend(lighthouseResults);

      // Get API metrics (placeholder)
      const apiMetrics = {
        p95Latency: 250, // Would get from actual API monitoring
        errorRate: 0.5, // Would get from actual API monitoring
        throughput: 1200, // Would get from actual API monitoring
        trendDirection: 'stable' as const,
      };

      // Get alert information (placeholder)
      const alertInfo = {
        activeAlerts: 2,
        recentAlerts: 5,
        criticalAlerts: 0,
      };

      // Generate recommendations
      const recommendations = this.generateOverviewRecommendations({
        webVitalsSummary,
        lighthouseResults,
        budgets: activeBudgets,
        apiMetrics,
      });

      const overview: PerformanceOverview = {
        timestamp: new Date(),
        webVitals: {
          summary: webVitalsSummary,
          recentViolations: recentWebVitalsViolations,
          trendDirection: webVitalsTrend,
        },
        lighthouse: {
          latestScores: lighthouseResults[0]?.scores || {},
          recentRuns: lighthouseResults.length,
          budgetViolations: recentLighthouseViolations,
          trendDirection: lighthouseTrend,
        },
        budgets: {
          totalBudgets: budgets.length,
          activeBudgets: activeBudgets.length,
          recentViolations: recentBudgetViolations,
          violationRate: recentBudgetViolations > 0 ? (recentBudgetViolations / (activeBudgets.length * 10)) * 100 : 0,
        },
        api: apiMetrics,
        alerts: alertInfo,
        recommendations,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, overview, 300);

      return overview;
    } catch (error) {
      console.error('Error getting performance overview:', error);
      throw error;
    }
  }

  async getPerformanceTrends(
    period: '24h' | '7d' | '30d' = '7d',
    workspaceId?: string
  ): Promise<PerformanceTrend[]> {
    try {
      const trends: PerformanceTrend[] = [];

      // Get Web Vitals trends
      const webVitalsSummary = await this.webVitalsService.getWebVitalsSummary(period, { workspaceId });
      Object.entries(webVitalsSummary.trends || {}).forEach(([metric, trend]) => {
        trends.push({
          metric,
          category: 'webVitals',
          current: 0, // trend object doesn't have current/previous properties
          previous: 0, // trend object doesn't have current/previous properties
          change: trend.change || 0,
          changePercent: trend.change || 0, // Simplified since previous doesn't exist
          trend: Math.abs(trend.change || 0) < 5 ? 'stable' : (trend.change || 0) > 0 ? 'degrading' : 'improving',
          timestamp: new Date(),
        });
      });

      // Get Lighthouse trends
      const lighthouseTrends = await this.lighthouseService.getLighthouseTrends('main', undefined, this.getPeriodDays(period));
      if (lighthouseTrends.length >= 2) {
        const latest = lighthouseTrends[lighthouseTrends.length - 1];
        const previous = lighthouseTrends[lighthouseTrends.length - 2];

        Object.entries(latest.scores).forEach(([metric, current]) => {
          const prev = previous.scores[metric] || 0;
          const change = current - prev;

          trends.push({
            metric,
            category: 'lighthouse',
            current,
            previous: prev,
            change,
            changePercent: prev > 0 ? (change / prev) * 100 : 0,
            trend: Math.abs(change) < 2 ? 'stable' : change > 0 ? 'improving' : 'degrading',
            timestamp: new Date(latest.date),
          });
        });
      }

      return trends;
    } catch (error) {
      console.error('Error getting performance trends:', error);
      return [];
    }
  }

  async generatePerformanceReport(
    period: '24h' | '7d' | '30d' = '7d',
    workspaceId?: string
  ): Promise<PerformanceReport> {
    try {
      const overview = await this.getPerformanceOverview(workspaceId);
      const trends = await this.getPerformanceTrends(period, workspaceId);

      // Analyze top issues
      const topIssues = this.analyzeTopIssues(overview, trends);

      // Generate detailed recommendations
      const recommendations = this.generateDetailedRecommendations(overview, trends, topIssues);

      // Calculate budget compliance
      const budgetCompliance = await this.calculateBudgetCompliance(workspaceId, period);

      return {
        period,
        generatedAt: new Date(),
        overview,
        trends,
        topIssues,
        recommendations,
        budgetCompliance,
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      throw error;
    }
  }

  async getPerformanceAlerts(
    workspaceId?: string,
    limit: number = 50
  ): Promise<PerformanceAlert[]> {
    // This would integrate with your alerting system
    // For now, return placeholder data
    return [];
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    // This would mark an alert as resolved in your alerting system
    return true;
  }

  private calculateTrendDirection(trends: any): 'improving' | 'degrading' | 'stable' {
    if (!trends) return 'stable';

    const trendValues = Object.values(trends).map((t: any) => t.change || 0);
    const avgChange = trendValues.reduce((sum: number, val: number) => sum + val, 0) / trendValues.length;

    if (Math.abs(avgChange) < 5) return 'stable';
    return avgChange > 0 ? 'degrading' : 'improving'; // For Web Vitals, higher is worse
  }

  private calculateLighthouseTrend(results: any[]): 'improving' | 'degrading' | 'stable' {
    if (results.length < 2) return 'stable';

    const latest = results[0];
    const previous = results[1];

    const latestAvg = (Object.values(latest.scores) as number[]).reduce((sum: number, val: number) => sum + val, 0) / Object.keys(latest.scores).length;
    const previousAvg = (Object.values(previous.scores) as number[]).reduce((sum: number, val: number) => sum + val, 0) / Object.keys(previous.scores).length;

    const change = latestAvg - previousAvg;

    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'degrading'; // For Lighthouse, higher is better
  }

  private generateOverviewRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    // Web Vitals recommendations
    if (data.webVitalsSummary.budgetStatus) {
      Object.entries(data.webVitalsSummary.budgetStatus).forEach(([metric, status]) => {
        if (status === 'poor') {
          recommendations.push(`Optimize ${metric}: Current performance is below acceptable thresholds`);
        }
      });
    }

    // Lighthouse recommendations
    if (data.lighthouseResults.length > 0) {
      const latest = data.lighthouseResults[0];
      Object.entries(latest.scores).forEach(([category, score]: [string, number]) => {
        if (score < 90) {
          recommendations.push(`Improve ${category} score: Currently at ${score}, target is 90+`);
        }
      });
    }

    // Budget recommendations
    if (data.budgets.length === 0) {
      recommendations.push('Set up performance budgets to monitor and prevent regressions');
    }

    return recommendations.slice(0, 5); // Limit to top 5
  }

  private analyzeTopIssues(overview: PerformanceOverview, trends: PerformanceTrend[]): Array<{
    category: string;
    metric: string;
    severity: string;
    count: number;
    impact: string;
  }> {
    const issues: Array<{
      category: string;
      metric: string;
      severity: string;
      count: number;
      impact: string;
    }> = [];

    // Analyze trends for degrading metrics
    trends.forEach(trend => {
      if (trend.trend === 'degrading' && Math.abs(trend.changePercent) > 10) {
        issues.push({
          category: trend.category,
          metric: trend.metric,
          severity: Math.abs(trend.changePercent) > 25 ? 'high' : 'medium',
          count: 1,
          impact: `${trend.changePercent.toFixed(1)}% degradation`,
        });
      }
    });

    // Analyze budget violations
    if (overview.budgets.violationRate > 20) {
      issues.push({
        category: 'budgets',
        metric: 'violation_rate',
        severity: overview.budgets.violationRate > 50 ? 'high' : 'medium',
        count: overview.budgets.recentViolations,
        impact: `${overview.budgets.violationRate.toFixed(1)}% violation rate`,
      });
    }

    return issues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
    });
  }

  private generateDetailedRecommendations(
    overview: PerformanceOverview,
    trends: PerformanceTrend[],
    topIssues: any[]
  ): Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedImpact: string;
  }> {
    const recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      estimatedImpact: string;
    }> = [];

    // High priority issues
    topIssues.forEach(issue => {
      if (issue.severity === 'high') {
        recommendations.push({
          category: issue.category,
          priority: 'high',
          title: `Address ${issue.metric} degradation`,
          description: `The ${issue.metric} metric has degraded significantly. Immediate attention required.`,
          estimatedImpact: 'High - User experience impact',
        });
      }
    });

    // API performance recommendations
    if (overview.api.p95Latency > 500) {
      recommendations.push({
        category: 'api',
        priority: 'high',
        title: 'Optimize API response times',
        description: 'P95 latency is above 500ms. Consider database optimization, caching, or query improvements.',
        estimatedImpact: 'High - Reduces user wait times',
      });
    }

    // Budget recommendations
    if (overview.budgets.activeBudgets === 0) {
      recommendations.push({
        category: 'budgets',
        priority: 'medium',
        title: 'Implement performance budgets',
        description: 'Set up performance budgets to prevent regressions and maintain performance standards.',
        estimatedImpact: 'Medium - Prevents future issues',
      });
    }

    return recommendations;
  }

  private async calculateBudgetCompliance(
    workspaceId?: string,
    period: string = '7d'
  ): Promise<{
    overallScore: number;
    categoryScores: { [key: string]: number };
    violationsByCategory: { [key: string]: number };
  }> {
    // This would calculate actual budget compliance
    // For now, return placeholder data
    return {
      overallScore: 85,
      categoryScores: {
        lighthouse: 90,
        webVitals: 80,
        bundleSize: 85,
        apiLatency: 85,
      },
      violationsByCategory: {
        lighthouse: 2,
        webVitals: 5,
        bundleSize: 1,
        apiLatency: 3,
      },
    };
  }

  private getPeriodDays(period: string): number {
    switch (period) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      default: return 7;
    }
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();
