import apiClient from './apiClient';

export interface AIUsageDashboardData {
  overview: {
    totalRequests: number;
    totalCost: number;
    averageCost: number;
    successRate: number;
    budgetRemaining: number;
    budgetUsedPercent: number;
  };
  topWorkspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    requests: number;
    cost: number;
    tier: string;
  }>;
  featureBreakdown: Array<{
    feature: string;
    requests: number;
    cost: number;
    percentage: number;
  }>;
  dailyTrends: Array<{
    date: string;
    requests: number;
    cost: number;
  }>;
  suspendedWorkspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    tier: string;
    reason: string;
    suspendedAt: string;
    suspendedBy: {
      name: string;
      email: string;
    } | null;
  }>;
  alerts: Array<{
    type: 'budget_warning' | 'limit_exceeded' | 'suspicious_activity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    workspaceId?: string;
    workspaceName?: string;
    data?: any;
  }>;
  globalBudget: {
    monthlyBudget: number;
    used: number;
    remaining: number;
    usedPercent: number;
    totalRequests: number;
    currentMonth: string;
  };
}

export interface WorkspaceUsageDetails {
  workspaceId: string;
  workspaceName: string;
  tier: string;
  limits: {
    requestsPerMonth: number;
    costBudgetPerMonth: number;
    dailyRequestLimit?: number;
  };
  currentUsage: {
    requestCount: number;
    totalCost: number;
    percentage: number;
  };
  suspended: boolean;
  suspensionReason?: string;
  recentActivity: Array<{
    date: string;
    requests: number;
    cost: number;
    features: string[];
  }>;
}

export interface AIUsageAnalytics {
  analytics: Array<{
    period: string;
    requests: number;
    cost: number;
    avgDuration: number;
    successRate: number;
    uniqueWorkspaces: number;
    features: string[];
  }>;
  filters: {
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
    feature?: string;
    tier?: string;
    groupBy: string;
  };
}

class AIUsageMonitoringService {
  private baseUrl = '/admin/ai-usage';

  /**
   * Get comprehensive AI usage dashboard data
   */
  async getDashboardData(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AIUsageDashboardData> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const response = await apiClient.get<{ success: boolean; data: AIUsageDashboardData }>(
      `${this.baseUrl}/dashboard?${queryParams.toString()}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch AI usage dashboard data');
    }

    return response.data.data;
  }

  /**
   * Get detailed usage information for a specific workspace
   */
  async getWorkspaceUsageDetails(workspaceId: string): Promise<WorkspaceUsageDetails> {
    const response = await apiClient.get<{ success: boolean; data: WorkspaceUsageDetails }>(
      `${this.baseUrl}/workspace/${workspaceId}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch workspace usage details');
    }

    return response.data.data;
  }

  /**
   * Suspend AI features for a workspace
   */
  async suspendWorkspace(workspaceId: string, reason: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/workspace/${workspaceId}/suspend`,
      { reason }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to suspend workspace AI features');
    }
  }

  /**
   * Restore AI features for a workspace
   */
  async restoreWorkspace(workspaceId: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/workspace/${workspaceId}/restore`
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to restore workspace AI features');
    }
  }

  /**
   * Update AI usage limits for a workspace
   */
  async updateWorkspaceLimits(
    workspaceId: string,
    limits: {
      requestsPerMonth?: number;
      costBudgetPerMonth?: number;
      dailyRequestLimit?: number;
    }
  ): Promise<void> {
    const response = await apiClient.put<{ success: boolean; message: string }>(
      `${this.baseUrl}/workspace/${workspaceId}/limits`,
      limits
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update workspace limits');
    }
  }

  /**
   * Get advanced AI usage analytics with filtering
   */
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
    feature?: string;
    tier?: string;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<AIUsageAnalytics> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.workspaceId) queryParams.append('workspaceId', params.workspaceId);
    if (params?.feature) queryParams.append('feature', params.feature);
    if (params?.tier) queryParams.append('tier', params.tier);
    if (params?.groupBy) queryParams.append('groupBy', params.groupBy);

    const response = await apiClient.get<{ success: boolean; data: AIUsageAnalytics }>(
      `${this.baseUrl}/analytics?${queryParams.toString()}`
    );

    if (!response.data.success) {
      throw new Error('Failed to fetch AI usage analytics');
    }

    return response.data.data;
  }

  /**
   * Get real-time usage statistics
   */
  async getRealTimeStats(): Promise<{
    activeRequests: number;
    requestsLastHour: number;
    costLastHour: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();

    const analytics = await this.getAnalytics({
      startDate: oneHourAgo.toISOString(),
      endDate: now.toISOString(),
      groupBy: 'hour',
    });

    const lastHourData = analytics.analytics[analytics.analytics.length - 1];

    return {
      activeRequests: 0, // This would need WebSocket or polling for real-time data
      requestsLastHour: lastHourData?.requests || 0,
      costLastHour: lastHourData?.cost || 0,
      averageResponseTime: lastHourData?.avgDuration || 0,
      errorRate: lastHourData ? (100 - lastHourData.successRate) : 0,
    };
  }

  /**
   * Export usage data to CSV
   */
  async exportUsageData(params?: {
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
    feature?: string;
  }): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.workspaceId) queryParams.append('workspaceId', params.workspaceId);
    if (params?.feature) queryParams.append('feature', params.feature);

    const response = await apiClient.get(
      `${this.baseUrl}/export?${queryParams.toString()}`,
      {
        responseType: 'blob',
      }
    );

    return response.data;
  }

  /**
   * Get usage predictions based on historical data
   */
  async getUsagePredictions(workspaceId?: string): Promise<{
    predictedMonthlyRequests: number;
    predictedMonthlyCost: number;
    trendDirection: 'up' | 'down' | 'stable';
    confidenceLevel: number;
    recommendations: string[];
  }> {
    // This would typically call a machine learning endpoint
    // For now, we'll calculate simple predictions based on recent trends
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const analytics = await this.getAnalytics({
      startDate: thirtyDaysAgo.toISOString(),
      endDate: now.toISOString(),
      workspaceId,
      groupBy: 'day',
    });

    const dailyData = analytics.analytics;
    if (dailyData.length < 7) {
      return {
        predictedMonthlyRequests: 0,
        predictedMonthlyCost: 0,
        trendDirection: 'stable',
        confidenceLevel: 0,
        recommendations: ['Insufficient data for predictions'],
      };
    }

    // Simple linear trend calculation
    const recentWeek = dailyData.slice(-7);
    const previousWeek = dailyData.slice(-14, -7);

    const recentAvgRequests = recentWeek.reduce((sum, day) => sum + day.requests, 0) / 7;
    const previousAvgRequests = previousWeek.reduce((sum, day) => sum + day.requests, 0) / 7;
    const recentAvgCost = recentWeek.reduce((sum, day) => sum + day.cost, 0) / 7;

    const requestTrend = (recentAvgRequests - previousAvgRequests) / previousAvgRequests;
    const trendDirection: 'up' | 'down' | 'stable' = 
      requestTrend > 0.1 ? 'up' : requestTrend < -0.1 ? 'down' : 'stable';

    const predictedMonthlyRequests = Math.round(recentAvgRequests * 30);
    const predictedMonthlyCost = recentAvgCost * 30;

    const recommendations: string[] = [];
    if (trendDirection === 'up') {
      recommendations.push('Usage is trending upward. Consider reviewing limits.');
      if (predictedMonthlyCost > 5) {
        recommendations.push('Predicted monthly cost exceeds $5. Monitor closely.');
      }
    } else if (trendDirection === 'down') {
      recommendations.push('Usage is declining. Check if AI features are being utilized effectively.');
    }

    return {
      predictedMonthlyRequests,
      predictedMonthlyCost: Math.round(predictedMonthlyCost * 10000) / 10000,
      trendDirection,
      confidenceLevel: Math.min(dailyData.length / 30, 1) * 100,
      recommendations,
    };
  }
}

export const aiUsageMonitoringService = new AIUsageMonitoringService();