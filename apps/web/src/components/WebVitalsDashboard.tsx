import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useWebVitals } from '../hooks/useWebVitals';
import { WebVitalsMetrics } from '../utils/WebVitalsMonitor';

interface WebVitalsSummary {
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
  lastUpdated: string;
  trends: {
    [key: string]: {
      change: number;
      direction: 'up' | 'down' | 'stable';
    };
  };
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
  count: number;
}

interface Regression {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'good':
      return 'bg-green-100 text-green-800';
    case 'needs-improvement':
      return 'bg-yellow-100 text-yellow-800';
    case 'poor':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatMetricValue = (metric: string, value: number) => {
  if (metric === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
};

const WebVitalsDashboard: React.FC = () => {
  const { metrics, isMonitoring, budgetViolations, startMonitoring, stopMonitoring, clearViolations } = useWebVitals({
    enabled: true,
    onBudgetExceeded: (entry, budget) => {
      console.warn(`Performance budget exceeded: ${entry.name} = ${entry.value} > ${budget}`);
    },
  });

  const [summary, setSummary] = useState<WebVitalsSummary | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<{ [key: string]: TimeSeriesData[] }>({});
  const [regressions, setRegressions] = useState<Regression[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [selectedMetric, setSelectedMetric] = useState<string>('LCP');

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/web-vitals/summary?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch Web Vitals summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSeries = async (metric: string) => {
    try {
      const interval = selectedPeriod === '1h' ? '1m' : selectedPeriod === '24h' ? '1h' : '1d';
      const response = await fetch(`/api/analytics/web-vitals/timeseries?metric=${metric}&period=${selectedPeriod}&interval=${interval}`);
      if (response.ok) {
        const data = await response.json();
        setTimeSeriesData(prev => ({ ...prev, [metric]: data }));
      }
    } catch (error) {
      console.error(`Failed to fetch time series for ${metric}:`, error);
    }
  };

  const fetchRegressions = async () => {
    try {
      const response = await fetch('/api/analytics/web-vitals/regressions');
      if (response.ok) {
        const data = await response.json();
        setRegressions(data.regressions || []);
      }
    } catch (error) {
      console.error('Failed to fetch regressions:', error);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchRegressions();
    const interval = setInterval(() => {
      fetchSummary();
      fetchRegressions();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedMetric) {
      fetchTimeSeries(selectedMetric);
    }
  }, [selectedMetric, selectedPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Web Vitals Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={(value: '1h' | '24h' | '7d' | '30d') => setSelectedPeriod(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
              <SelectItem value="30d">30d</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant={isMonitoring ? 'default' : 'secondary'}>
            {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
          </Badge>
          <Button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            variant={isMonitoring ? 'destructive' : 'default'}
            size="sm"
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
          <Button onClick={fetchSummary} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Current Session Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Current Session Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {value ? formatMetricValue(key, value) : '-'}
                </div>
                <div className="text-sm text-gray-600">{key}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Regressions Alert */}
      {regressions.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="font-medium text-red-800">
                {regressions.length} performance regression{regressions.length > 1 ? 's' : ''} detected
              </span>
              <Button variant="outline" size="sm" onClick={fetchRegressions}>
                Refresh
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {regressions.slice(0, 3).map((regression, index) => (
                <div key={index} className="text-sm text-red-700">
                  {regression.metric}: {regression.change > 0 ? '+' : ''}{(regression.change * 100).toFixed(1)}% 
                  ({formatMetricValue(regression.metric, regression.previousValue)} → {formatMetricValue(regression.metric, regression.currentValue)})
                  <Badge className="ml-2" variant={regression.severity === 'high' ? 'destructive' : regression.severity === 'medium' ? 'secondary' : 'outline'}>
                    {regression.severity}
                  </Badge>
                </div>
              ))}
              {regressions.length > 3 && (
                <div className="text-sm text-red-600">
                  +{regressions.length - 3} more regressions
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Historical Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Summary ({summary.period})</CardTitle>
            <p className="text-sm text-gray-600">
              Based on {summary.totalSamples} samples • Last updated: {new Date(summary.lastUpdated).toLocaleString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(summary.metrics).map(([metric, values]) => {
                const trend = summary.trends?.[metric];
                return (
                  <div key={metric} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{metric}</span>
                      <Badge className={getStatusColor(summary.budgetStatus[metric])}>
                        {summary.budgetStatus[metric]}
                      </Badge>
                      {trend && (
                        <Badge variant="outline" className={
                          trend.direction === 'up' ? 'text-red-600' : 
                          trend.direction === 'down' ? 'text-green-600' : 
                          'text-gray-600'
                        }>
                          {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'} 
                          {Math.abs(trend.change)}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-4 text-sm">
                      <div>
                        <span className="text-gray-600">P50:</span> {formatMetricValue(metric, values.p50)}
                      </div>
                      <div>
                        <span className="text-gray-600">P75:</span> {formatMetricValue(metric, values.p75)}
                      </div>
                      <div>
                        <span className="text-gray-600">P95:</span> {formatMetricValue(metric, values.p95)}
                      </div>
                      <div>
                        <span className="text-gray-600">Count:</span> {values.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Series Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Performance Trends
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FCP">FCP</SelectItem>
                <SelectItem value="LCP">LCP</SelectItem>
                <SelectItem value="CLS">CLS</SelectItem>
                <SelectItem value="FID">FID</SelectItem>
                <SelectItem value="TTFB">TTFB</SelectItem>
                <SelectItem value="INP">INP</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeSeriesData[selectedMetric] && timeSeriesData[selectedMetric].length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData[selectedMetric]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis tickFormatter={(value) => formatMetricValue(selectedMetric, value)} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [formatMetricValue(selectedMetric, value), selectedMetric]}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No time series data available for {selectedMetric}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Violations */}
      {budgetViolations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Performance Budget Violations
              <Button onClick={clearViolations} variant="outline" size="sm">
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budgetViolations.map((violation, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                  <div>
                    <span className="font-medium text-red-800">{violation.entry.name}</span>
                    <span className="text-red-600 ml-2">
                      {formatMetricValue(violation.entry.name, violation.entry.value)} exceeds budget of {formatMetricValue(violation.entry.name, violation.budget)}
                    </span>
                  </div>
                  <div className="text-xs text-red-600">
                    {new Date(violation.entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WebVitalsDashboard;