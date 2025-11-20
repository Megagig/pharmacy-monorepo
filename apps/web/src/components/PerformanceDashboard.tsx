import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import PerformanceOverview from './PerformanceOverview';
import WebVitalsDashboard from './WebVitalsDashboard';
import LighthouseDashboard from './LighthouseDashboard';
import PerformanceBudgetDashboard from './PerformanceBudgetDashboard';
import BundleSizeMonitor from './BundleSizeMonitor';
import { Activity, Database, Server, TrendingUp } from 'lucide-react';

interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

interface TopEndpoint {
  endpoint: string;
  count: number;
  avgDuration: number;
  p95Duration: number;
}

interface DatabaseStats {
  collections: Array<{
    name: string;
    count: number;
    size: number;
    avgObjSize: number;
    indexes: number;
  }>;
  slowQueries: Array<{
    command: string;
    collection: string;
    duration: number;
    timestamp: string;
  }>;
  connectionStats: {
    current: number;
    available: number;
    totalCreated: number;
  };
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const PerformanceDashboard: React.FC = () => {
  const [latencyStats, setLatencyStats] = useState<LatencyStats | null>(null);
  const [topEndpoints, setTopEndpoints] = useState<TopEndpoint[]>([]);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLatencyMetrics = async () => {
    try {
      const response = await fetch('/api/admin/performance/latency');
      if (response.ok) {
        const data = await response.json();
        setLatencyStats(data.data.stats);
        setTopEndpoints(data.data.topEndpoints);
      }
    } catch (error) {
      console.error('Failed to fetch latency metrics:', error);
    }
  };

  const fetchDatabaseStats = async () => {
    try {
      const response = await fetch('/api/admin/performance/database/profile');
      if (response.ok) {
        const data = await response.json();
        setDatabaseStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    }
  };

  const enableDatabaseProfiling = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/performance/database/profiling/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slowMs: 100 }),
      });
      
      if (response.ok) {
        await fetchDatabaseStats();
      }
    } catch (error) {
      console.error('Failed to enable database profiling:', error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeIndexes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/performance/database/indexes/optimize', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchDatabaseStats();
      }
    } catch (error) {
      console.error('Failed to optimize indexes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatencyMetrics();
    fetchDatabaseStats();
    
    const interval = setInterval(() => {
      fetchLatencyMetrics();
      fetchDatabaseStats();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button onClick={enableDatabaseProfiling} disabled={loading} size="sm">
            Enable DB Profiling
          </Button>
          <Button onClick={optimizeIndexes} disabled={loading} size="sm">
            Optimize Indexes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="web-vitals">Web Vitals</TabsTrigger>
          <TabsTrigger value="lighthouse">Lighthouse CI</TabsTrigger>
          <TabsTrigger value="budgets">Performance Budgets</TabsTrigger>
          <TabsTrigger value="bundle-size">Bundle Size</TabsTrigger>
          <TabsTrigger value="api-latency">API Latency</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PerformanceOverview />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* API Latency Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Latency (P95)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {latencyStats ? formatDuration(latencyStats.p95) : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {latencyStats ? `${latencyStats.count} requests` : 'No data'}
                </p>
              </CardContent>
            </Card>

            {/* Database Connections */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">DB Connections</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseStats ? databaseStats.connectionStats.current : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {databaseStats ? `${databaseStats.connectionStats.available} available` : 'No data'}
                </p>
              </CardContent>
            </Card>

            {/* Slow Queries */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseStats ? databaseStats.slowQueries.length : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>

            {/* Collections */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collections</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {databaseStats ? databaseStats.collections.length : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Database collections
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints */}
          {topEndpoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top API Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topEndpoints.slice(0, 5).map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-mono text-sm">{endpoint.endpoint}</span>
                        <div className="text-xs text-gray-600">{endpoint.count} requests</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatDuration(endpoint.p95Duration)}</div>
                        <div className="text-xs text-gray-600">P95</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="web-vitals">
          <WebVitalsDashboard />
        </TabsContent>

        <TabsContent value="lighthouse">
          <LighthouseDashboard />
        </TabsContent>

        <TabsContent value="budgets">
          <PerformanceBudgetDashboard />
        </TabsContent>

        <TabsContent value="bundle-size">
          <BundleSizeMonitor />
        </TabsContent>

        <TabsContent value="api-latency" className="space-y-4">
          {/* API Latency Stats */}
          {latencyStats && (
            <Card>
              <CardHeader>
                <CardTitle>API Latency Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatDuration(latencyStats.avg)}
                    </div>
                    <div className="text-sm text-gray-600">Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatDuration(latencyStats.p50)}
                    </div>
                    <div className="text-sm text-gray-600">P50</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatDuration(latencyStats.p95)}
                    </div>
                    <div className="text-sm text-gray-600">P95</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {formatDuration(latencyStats.p99)}
                    </div>
                    <div className="text-sm text-gray-600">P99</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {formatDuration(latencyStats.min)}
                    </div>
                    <div className="text-sm text-gray-600">Min</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {formatDuration(latencyStats.max)}
                    </div>
                    <div className="text-sm text-gray-600">Max</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Endpoints Detailed */}
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-mono text-sm">{endpoint.endpoint}</span>
                    </div>
                    <div className="flex space-x-4 text-sm">
                      <div>
                        <span className="text-gray-600">Requests:</span> {endpoint.count}
                      </div>
                      <div>
                        <span className="text-gray-600">Avg:</span> {formatDuration(endpoint.avgDuration)}
                      </div>
                      <div>
                        <span className="text-gray-600">P95:</span> {formatDuration(endpoint.p95Duration)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          {databaseStats && (
            <>
              {/* Database Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Connection Pool</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Current:</span>
                        <span className="font-medium">{databaseStats.connectionStats.current}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Available:</span>
                        <span className="font-medium">{databaseStats.connectionStats.available}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Created:</span>
                        <span className="font-medium">{databaseStats.connectionStats.totalCreated}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Collections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{databaseStats.collections.length}</div>
                    <p className="text-sm text-gray-600">Total collections</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Slow Queries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{databaseStats.slowQueries.length}</div>
                    <p className="text-sm text-gray-600">Queries > 100ms</p>
                  </CardContent>
                </Card>
              </div>

              {/* Collections Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Collection Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {databaseStats.collections
                      .sort((a, b) => b.count - a.count)
                      .map((collection, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{collection.name}</span>
                            <div className="text-sm text-gray-600">{collection.indexes} indexes</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{collection.count.toLocaleString()} docs</div>
                            <div className="text-sm text-gray-600">{formatBytes(collection.size)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Slow Queries */}
              {databaseStats.slowQueries.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Slow Queries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {databaseStats.slowQueries.slice(0, 10).map((query, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{query.command}</Badge>
                            <span className="text-sm font-medium">{formatDuration(query.duration)}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Collection: {query.collection}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(query.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceDashboard;