import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit, Trash2, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceBudget {
  id: string;
  name: string;
  description?: string;
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
      totalGzip: { max: number; target: number };
      totalBrotli: { max: number; target: number };
      mainChunk: { max: number; target: number };
      vendorChunk: { max: number; target: number };
    };
    apiLatency: {
      p50: { max: number; target: number };
      p95: { max: number; target: number };
      p99: { max: number; target: number };
    };
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    cooldown: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface BudgetReport {
  budgetId: string;
  budgetName: string;
  period: string;
  summary: {
    totalChecks: number;
    violations: number;
    violationRate: number;
    averageScores: { [key: string]: number };
  };
  violations: any[];
  recommendations: string[];
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const PerformanceBudgetDashboard: React.FC = () => {
  const [budgets, setBudgets] = useState<PerformanceBudget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<PerformanceBudget | null>(null);
  const [budgetReport, setBudgetReport] = useState<BudgetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/performance-budgets');
      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
      }
    } catch (error) {
      console.error('Failed to fetch performance budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetReport = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/performance-budgets/${budgetId}/report?period=7d`);
      if (response.ok) {
        const data = await response.json();
        setBudgetReport(data.report);
      }
    } catch (error) {
      console.error('Failed to fetch budget report:', error);
    }
  };

  const createDefaultBudget = async () => {
    try {
      const response = await fetch('/api/performance-budgets/default', {
        method: 'POST',
      });
      if (response.ok) {
        await fetchBudgets();
      }
    } catch (error) {
      console.error('Failed to create default budget:', error);
    }
  };

  const deleteBudget = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this performance budget?')) {
      return;
    }

    try {
      const response = await fetch(`/api/performance-budgets/${budgetId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchBudgets();
        if (selectedBudget?.id === budgetId) {
          setSelectedBudget(null);
          setBudgetReport(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  };

  const toggleBudgetStatus = async (budgetId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/performance-budgets/${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (response.ok) {
        await fetchBudgets();
      }
    } catch (error) {
      console.error('Failed to update budget status:', error);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  useEffect(() => {
    if (selectedBudget) {
      fetchBudgetReport(selectedBudget.id);
    }
  }, [selectedBudget]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Budgets</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={createDefaultBudget} variant="outline" size="sm">
            Create Default Budget
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Performance Budget</DialogTitle>
              </DialogHeader>
              <BudgetForm onSave={() => { setIsCreateDialogOpen(false); fetchBudgets(); }} />
            </DialogContent>
          </Dialog>
          <Button onClick={fetchBudgets} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">No performance budgets configured</p>
            <Button onClick={createDefaultBudget}>
              Create Default Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Budget List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Budgets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {budgets.map((budget) => (
                  <div
                    key={budget.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBudget?.id === budget.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedBudget(budget)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{budget.name}</h4>
                        {budget.description && (
                          <p className="text-sm text-gray-600">{budget.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={budget.isActive ? 'default' : 'secondary'}>
                          {budget.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBudget(budget);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBudget(budget.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Budget Details */}
          <div className="lg:col-span-2">
            {selectedBudget ? (
              <div className="space-y-6">
                {/* Budget Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {selectedBudget.name}
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={selectedBudget.isActive}
                          onCheckedChange={(checked) =>
                            toggleBudgetStatus(selectedBudget.id, checked)
                          }
                        />
                        <span className="text-sm">
                          {selectedBudget.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </CardTitle>
                    {selectedBudget.description && (
                      <p className="text-gray-600">{selectedBudget.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="lighthouse">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>
                        <TabsTrigger value="webVitals">Web Vitals</TabsTrigger>
                        <TabsTrigger value="bundleSize">Bundle Size</TabsTrigger>
                        <TabsTrigger value="apiLatency">API Latency</TabsTrigger>
                      </TabsList>

                      <TabsContent value="lighthouse" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(selectedBudget.budgets.lighthouse).map(([metric, config]) => (
                            <div key={metric} className="p-3 border rounded">
                              <h4 className="font-medium capitalize">{metric.replace(/([A-Z])/g, ' $1')}</h4>
                              <div className="text-sm text-gray-600">
                                Min: {config.min} • Target: {config.target}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="webVitals" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(selectedBudget.budgets.webVitals).map(([metric, config]) => (
                            <div key={metric} className="p-3 border rounded">
                              <h4 className="font-medium">{metric}</h4>
                              <div className="text-sm text-gray-600">
                                Max: {metric === 'CLS' ? config.max.toFixed(3) : `${config.max}ms`} • 
                                Target: {metric === 'CLS' ? config.target.toFixed(3) : `${config.target}ms`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="bundleSize" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(selectedBudget.budgets.bundleSize).map(([metric, config]) => (
                            <div key={metric} className="p-3 border rounded">
                              <h4 className="font-medium capitalize">{metric.replace(/([A-Z])/g, ' $1')}</h4>
                              <div className="text-sm text-gray-600">
                                Max: {formatBytes(config.max)} • Target: {formatBytes(config.target)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="apiLatency" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(selectedBudget.budgets.apiLatency).map(([metric, config]) => (
                            <div key={metric} className="p-3 border rounded">
                              <h4 className="font-medium">{metric.toUpperCase()}</h4>
                              <div className="text-sm text-gray-600">
                                Max: {config.max}ms • Target: {config.target}ms
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Budget Report */}
                {budgetReport && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Budget Report (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {budgetReport.summary.totalChecks}
                          </div>
                          <div className="text-sm text-gray-600">Total Checks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {budgetReport.summary.violations}
                          </div>
                          <div className="text-sm text-gray-600">Violations</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {budgetReport.summary.violationRate.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">Violation Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(100 - budgetReport.summary.violationRate).toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">Success Rate</div>
                        </div>
                      </div>

                      {budgetReport.recommendations.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Recommendations</h4>
                          {budgetReport.recommendations.map((recommendation, index) => (
                            <Alert key={index}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{recommendation}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">Select a budget to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Performance Budget</DialogTitle>
          </DialogHeader>
          {selectedBudget && (
            <BudgetForm
              budget={selectedBudget}
              onSave={() => {
                setIsEditDialogOpen(false);
                fetchBudgets();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Budget Form Component (simplified for brevity)
const BudgetForm: React.FC<{
  budget?: PerformanceBudget;
  onSave: () => void;
}> = ({ budget, onSave }) => {
  const [formData, setFormData] = useState({
    name: budget?.name || '',
    description: budget?.description || '',
    // Add other form fields as needed
  });

  const handleSave = async () => {
    try {
      const url = budget
        ? `/api/performance-budgets/${budget.id}`
        : '/api/performance-budgets';
      
      const method = budget ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save budget:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Budget Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter budget name"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter budget description"
        />
      </div>
      {/* Add more form fields for budget configuration */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onSave}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {budget ? 'Update' : 'Create'} Budget
        </Button>
      </div>
    </div>
  );
};

export default PerformanceBudgetDashboard;