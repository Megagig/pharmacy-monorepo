import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Zap, Globe, Server, Activity } from 'lucide-react';

interface PerformanceOverview {
  timestamp: string;
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

interface PerformanceMetricsSummary {
  webVitals: {
    score: number;
    violations: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  lighthouse: {
    score: number;
    violations: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  budgets: {
    compliance: number;
    violations: number;
    activeBudgets: number;
  };
  api: {
    latency: number;
    errorRate: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  alerts: {
    active: number;
    critical: number;
  };
}

const getTrendIcon = (trend: 'improving' | 'degrading' | 'stable') => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'degrading':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-gray-500" />;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBadgeVariant = (score: number) => {
  if (score >= 90) return 'default';
  if (score >= 70) return 'secondary';
  return 'destructive';
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

const PerformanceOverview: React.FC = () => {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<PerformanceMetricsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d'>('24h');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/performance-monitoring/overview');
      if (response.ok) {
        const data = await response.json();
        setOverview(data.overview);
      }
    } catch (error) {
      console.error('Failed to fetch performance overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricsSummary = async () => {
    try {
      const response = await fetch(`/api/performance-monitoring/metrics/summary?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setMetricsSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch metrics summary:', error);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchMetricsSummary();
    
    const interval = setInterval(() => {
      fetchOverview();
      fetchMetricsSummary();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  if (!overview || !metricsSummary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading performance overview...</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const performanceScores = [
    { name: 'Web Vitals', value: metricsSummary.webVitals.score, color: COLORS[0] },
    { name: 'Lighthouse', value: metricsSummary.lighthouse.score, color: COLORS[1] },
    { name: 'Budget Compliance', value: metricsSummary.budgets.compliance, color: COLORS[2] },
  ];

  const overallScore = (metricsSummary.webVitals.score + metricsSummary.lighthouse.score + metricsSummary.budgets.compliance) / 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Overview</h2>
        <div className="flex items-center space-x-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as '1h' | '24h' | '7d')}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <Button onClick={fetchOverview} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overall Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Overall Performance Score
            <Badge variant={getScoreBadgeVariant(overallScore)}>
              {Math.round(overallScore)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6">
            <div className="flex-1">
              <Progress value={overallScore} className="h-3" />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceScores}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {performanceScores.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${Math.round(value)}`, 'Score']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {performanceScores.map((score, index) => (
              <div key={index} className="text-center">
                <div className={`text-lg font-bold ${getScoreColor(score.value)}`}>
                  {Math.round(score.value)}
                </div>
                <div className="text-sm text-gray-600">{score.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Web Vitals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Web Vitals</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${getScoreColor(metricsSummary.webVitals.score)}`}>
                  {Math.round(metricsSummary.webVitals.score)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metricsSummary.webVitals.violations} violations
                </p>
              </div>
              {getTrendIcon(metricsSummary.webVitals.trend)}
            </div>
          </CardContent>
        </Card>

        {/* Lighthouse */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lighthouse</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${getScoreColor(metricsSummary.lighthouse.score)}`}>
                  {Math.round(metricsSummary.lighthouse.score)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.lighthouse.recentRuns} recent runs
                </p>
              </div>
              {getTrendIcon(metricsSummary.lighthouse.trend)}
            </div>
          </CardContent>
        </Card>

        {/* API Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Latency</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {metricsSummary.api.latency}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  P95 latency
                </p>
              </div>
              {getTrendIcon(metricsSummary.api.trend)}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {metricsSummary.alerts.active}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metricsSummary.alerts.critical} critical
                </p>
              </div>
              {metricsSummary.alerts.critical > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Budget Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {overview.budgets.activeBudgets}
              </div>
              <div className="text-sm text-gray-600">Active Budgets</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.round(metricsSummary.budgets.compliance)}%
              </div>
              <div className="text-sm text-gray-600">Compliance Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {metricsSummary.budgets.violations}
              </div>
              <div className="text-sm text-gray-600">Recent Violations</div>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={metricsSummary.budgets.compliance} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {overview.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Globe className="w-6 h-6 mb-2" />
              <span className="text-sm">View Web Vitals</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Zap className="w-6 h-6 mb-2" />
              <span className="text-sm">Lighthouse Reports</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Clock className="w-6 h-6 mb-2" />
              <span className="text-sm">Manage Budgets</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Activity className="w-6 h-6 mb-2" />
              <span className="text-sm">View Alerts</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceOverview;