import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { AlertTriangle, CheckCircle, Package, TrendingUp, TrendingDown } from 'lucide-react';

interface BundleSize {
  raw: number;
  gzip: number;
  brotli: number;
}

interface BundleChunk {
  file: string;
  type: 'main' | 'vendor' | 'chunk';
  size: BundleSize;
}

interface BundleBudget {
  name: string;
  type: string;
  passed: boolean;
  actual: number;
  budget: number;
}

interface BundleReport {
  timestamp: string;
  totalSize: BundleSize;
  chunks: BundleChunk[];
  budgetResults: BundleBudget[];
  recommendations: Array<{
    type: string;
    message: string;
    file?: string;
    size?: number;
  }>;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getStatusIcon = (passed: boolean) => {
  return passed ? (
    <CheckCircle className="h-4 w-4 text-green-600" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-red-600" />
  );
};

const BundleSizeMonitor: React.FC = () => {
  const [report, setReport] = useState<BundleReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBundleReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll simulate loading a report
      const response = await fetch('/dist/bundle-size-report.json');
      
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      } else {
        throw new Error('Bundle report not found. Run "npm run build" first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bundle report');
      console.error('Failed to load bundle report:', err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeBundleNow = async () => {
    setLoading(true);
    try {
      // Trigger bundle analysis
      const response = await fetch('/api/analytics/bundle/analyze', {
        method: 'POST',
      });
      
      if (response.ok) {
        await loadBundleReport();
      } else {
        throw new Error('Failed to trigger bundle analysis');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze bundle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundleReport();
  }, []);

  if (loading && !report) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Loading bundle analysis...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !report) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadBundleReport} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bundle Size Monitor</h2>
        <div className="flex items-center space-x-2">
          {report && (
            <Badge variant="outline">
              Last updated: {new Date(report.timestamp).toLocaleString()}
            </Badge>
          )}
          <Button onClick={analyzeBundleNow} disabled={loading} size="sm">
            {loading ? 'Analyzing...' : 'Analyze Now'}
          </Button>
          <Button onClick={loadBundleReport} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {report && (
        <>
          {/* Total Bundle Size */}
          <Card>
            <CardHeader>
              <CardTitle>Total Bundle Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatBytes(report.totalSize.raw)}
                  </div>
                  <div className="text-sm text-gray-600">Raw Size</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatBytes(report.totalSize.gzip)}
                  </div>
                  <div className="text-sm text-gray-600">Gzip Compressed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatBytes(report.totalSize.brotli)}
                  </div>
                  <div className="text-sm text-gray-600">Brotli Compressed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Status */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.budgetResults.map((budget, index) => {
                  const percentage = (budget.actual / budget.budget) * 100;
                  const isOverBudget = percentage > 100;
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(budget.passed)}
                          <span className="font-medium">{budget.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatBytes(budget.actual)} / {formatBytes(budget.budget)}
                        </div>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${isOverBudget ? 'bg-red-100' : 'bg-gray-100'}`}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className={percentage > 90 ? 'text-red-600' : percentage > 75 ? 'text-yellow-600' : 'text-green-600'}>
                          {percentage.toFixed(1)}% of budget
                        </span>
                        {isOverBudget && (
                          <span className="text-red-600 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Over budget by {formatBytes(budget.actual - budget.budget)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Chunk Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Chunk Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.chunks
                  .sort((a, b) => b.size.gzip - a.size.gzip)
                  .map((chunk, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge variant={chunk.type === 'main' ? 'default' : chunk.type === 'vendor' ? 'secondary' : 'outline'}>
                          {chunk.type}
                        </Badge>
                        <span className="font-mono text-sm">{chunk.file}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatBytes(chunk.size.gzip)}</div>
                        <div className="text-xs text-gray-600">gzipped</div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-yellow-800">{rec.message}</p>
                        {rec.file && (
                          <p className="text-xs text-yellow-600 mt-1">File: {rec.file}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default BundleSizeMonitor;