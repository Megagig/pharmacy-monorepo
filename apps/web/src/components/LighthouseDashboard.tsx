import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface LighthouseResult {
  runId: string;
  url: string;
  timestamp: string;
  branch: string;
  commit: string;
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
  budgetStatus: { [key: string]: 'passed' | 'failed' };
  reportUrl?: string;
}

interface LighthouseTrend {
  date: string;
  scores: { [key: string]: number };
  metrics: { [key: string]: number };
}

interface PerformanceReport {
  summary: {
    totalRuns: number;
    averageScores: { [key: string]: number };
    budgetViolations: number;
    regressionCount: number;
  };
  trends: LighthouseTrend[];
  recentRegressions: any[];
  recommendations: string[];
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBadgeVariant = (score: number) => {
  if (score >= 90) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
};

const formatMetricValue = (metric: string, value: number) => {
  if (metric.includes('layout-shift')) {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
};

const LighthouseDashboard: React.FC = () => {
  const [results, setResults] = useState<LighthouseResult[]>([]);
  const [trends, setTrends] = useState<LighthouseTrend[]>([]);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [selectedMetric, setSelectedMetric] = useState<string>('performance');

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lighthouse/results?branch=${selectedBranch}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch Lighthouse results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const response = await fetch(`/api/lighthouse/trends?branch=${selectedBranch}&days=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setTrends(data.trends || []);
      }
    } catch (error) {
      console.error('Failed to fetch Lighthouse trends:', error);
    }
  };

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/lighthouse/report?branch=${selectedBranch}&days=7`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      }
    } catch (error) {
      console.error('Failed to fetch performance report:', error);
    }
  };

  useEffect(() => {
    fetchResults();
    fetchTrends();
    fetchReport();
  }, [selectedBranch, selectedPeriod]);

  const latestResult = results[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Lighthouse CI Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="develop">develop</SelectItem>
              <SelectItem value="staging">staging</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod.toString()} onValueChange={(value) => setSelectedPeriod(Number(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7d</SelectItem>
              <SelectItem value="30">30d</SelectItem>
              <SelectItem value="90">90d</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchResults} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Performance Report Summary */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{report.summary.totalRuns}</div>
              <div className="text-sm text-gray-600">Total Runs (7d)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(report.summary.averageScores.performance || 0)}
              </div>
              <div className="text-sm text-gray-600">Avg Performance</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{report.summary.budgetViolations}</div>
              <div className="text-sm text-gray-600">Budget Violations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.regressionCount}</div>
              <div className="text-sm text-gray-600">Regressions</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Latest Results */}
      {latestResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Latest Lighthouse Results
              <Badge variant="outline">
                {new Date(latestResult.timestamp).toLocaleDateString()}
              </Badge>
            </CardTitle>
            <p className="text-sm text-gray-600">
              Branch: {latestResult.branch} • Commit: {latestResult.commit.substring(0, 8)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {Object.entries(latestResult.scores).map(([category, score]) => (
                <div key={category} className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                    {score}
                  </div>
                  <div className="text-sm text-gray-600 capitalize">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <Badge variant={getScoreBadgeVariant(score)} className="mt-1">
                    {latestResult.budgetStatus[category] === 'passed' ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(latestResult.metrics).map(([metric, value]) => (
                <div key={metric} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm font-medium">
                    {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{formatMetricValue(metric, value)}</span>
                    {latestResult.budgetStatus[metric] === 'passed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : latestResult.budgetStatus[metric] === 'failed' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {latestResult.reportUrl && (
              <div className="mt-4">
                <Button asChild variant="outline">
                  <a href={latestResult.reportUrl} target="_blank" rel="noopener noreferrer">
                    View Detailed Report
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Performance Trends ({selectedPeriod} days)
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="accessibility">Accessibility</SelectItem>
                <SelectItem value="bestPractices">Best Practices</SelectItem>
                <SelectItem value="seo">SEO</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [Math.round(value), selectedMetric]}
                />
                <Line 
                  type="monotone" 
                  dataKey={`scores.${selectedMetric}`}
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No trend data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">URL</th>
                    <th className="text-center p-2">Performance</th>
                    <th className="text-center p-2">Accessibility</th>
                    <th className="text-center p-2">Best Practices</th>
                    <th className="text-center p-2">SEO</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 10).map((result) => {
                    const overallPassed = Object.values(result.budgetStatus).every(status => status === 'passed');
                    return (
                      <tr key={result.runId} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          {new Date(result.timestamp).toLocaleDateString()}
                        </td>
                        <td className="p-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {new URL(result.url).pathname || '/'}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          <span className={getScoreColor(result.scores.performance)}>
                            {result.scores.performance}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          <span className={getScoreColor(result.scores.accessibility)}>
                            {result.scores.accessibility}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          <span className={getScoreColor(result.scores.bestPractices)}>
                            {result.scores.bestPractices}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          <span className={getScoreColor(result.scores.seo)}>
                            {result.scores.seo}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          {overallPassed ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No Lighthouse results available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LighthouseDashboard;