import { apiHelpers } from './api';

export interface ReportFilters {
  dateRange?: {
    startDate: Date;
    endDate: Date;
    preset?: '7d' | '30d' | '90d' | '1y';
  };
  patientId?: string;
  pharmacistId?: string;
  therapyType?: string;
  priority?: string;
  location?: string;
  status?: string;
}

export interface ReportData {
  summary: {
    totalRecords: number;
    primaryMetric: {
      label: string;
      value: number | string;
      unit?: string;
      trend?: 'up' | 'down' | 'stable';
      changePercent?: number;
    };
    secondaryMetrics: Array<{
      label: string;
      value: number | string;
      unit?: string;
      icon?: string;
      color?: string;
    }>;
  };
  charts: Array<{
    id: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    title: string;
    data: any[];
  }>;
  tables: Array<{
    id: string;
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  metadata: {
    id: string;
    title: string;
    description: string;
    category: string;
    generatedAt: Date;
    generatedBy: string;
    workspaceId: string;
    filters: ReportFilters;
    dataPoints: number;
    version: string;
  };
}

export interface ReportSummary {
  totalReviews: number;
  completedReviews: number;
  completionRate: number;
  totalInterventions: number;
  interventionAcceptanceRate: number;
  totalProblems: number;
  problemResolutionRate: number;
  totalCostSavings: number;
  avgCompletionTime: number;
  formattedCostSavings: string;
}

class ReportsService {
  /**
   * Get available report types
   */
  async getAvailableReports() {
    try {
      const response = await apiHelpers.get('/reports/types');
      return response.data.data || {};
    } catch (error) {
      console.error('Error fetching available reports:', error);
      throw error;
    }
  }

  /**
   * Get report summary statistics
   */
  async getReportSummary(period: string = '30d'): Promise<ReportSummary> {
    try {
      const response = await apiHelpers.get(`/reports/summary?period=${period}`);
      return response.data.data?.summary || {};
    } catch (error) {
      console.error('Error fetching report summary:', error);
      throw error;
    }
  }

  /**
   * Generate specific report data
   */
  async generateReport(reportType: string, filters: ReportFilters = {}): Promise<ReportData> {
    try {

      const params = new URLSearchParams();

      if (filters.dateRange) {
        params.append('startDate', filters.dateRange.startDate.toISOString());
        params.append('endDate', filters.dateRange.endDate.toISOString());
      }

      if (filters.patientId) params.append('patientId', filters.patientId);
      if (filters.pharmacistId) params.append('pharmacistId', filters.pharmacistId);
      if (filters.therapyType) params.append('therapyType', filters.therapyType);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.location) params.append('location', filters.location);
      if (filters.status) params.append('status', filters.status);

      const queryString = params.toString();
      const url = `/reports/${reportType}${queryString ? `?${queryString}` : ''}`;


      // Add timeout and better error handling with shorter timeout for better UX

      const response = await Promise.race([
        apiHelpers.get(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
        )
      ]) as any;


      if (!response.data) {
        throw new Error('No data received from API');
      }

      // Transform backend response to match frontend ReportData interface
      const transformedData = this.transformBackendResponse(response.data.data || response.data, reportType, filters);

      return transformedData;
    } catch (error: any) {
      console.error(`❌ Error generating ${reportType} report:`, error);

      // Provide detailed error information
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        console.error('Response data:', error.response.data);

        // Create a more specific error message
        const statusCode = error.response.status;
        const errorData = error.response.data;

        if (statusCode === 401) {
          throw new Error('Authentication required. Please log in again.');
        } else if (statusCode === 403) {
          throw new Error('Access denied. You do not have permission to view this report.');
        } else if (statusCode === 404) {
          throw new Error(`Report type "${reportType}" not found or not implemented.`);
        } else if (statusCode === 500) {
          throw new Error(`Server error: ${errorData?.message || 'Internal server error'}`);
        } else {
          throw new Error(`API Error ${statusCode}: ${errorData?.message || error.response.statusText}`);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        throw new Error('Network error: Unable to connect to the server. Please check your internet connection.');
      } else if (error.message === 'Request timeout after 2 minutes') {
        throw new Error('Request timeout: The server is taking too long to respond. Please try again.');
      } else {
        console.error('Error setting up request:', error.message);
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Queue report export job
   */
  async exportReport(reportType: string, format: 'pdf' | 'excel' | 'csv', filters: ReportFilters = {}) {
    try {
      const response = await apiHelpers.post('/reports/export', {
        reportType,
        format,
        filters,
        fileName: `${reportType}-${new Date().toISOString().split('T')[0]}.${format}`
      });
      return response.data.data || {};
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  }

  /**
   * Get export job status
   */
  async getExportStatus(jobId: string) {
    try {
      const response = await apiHelpers.get(`/reports/export/${jobId}/status`);
      return response.data.data || {};
    } catch (error) {
      console.error('Error getting export status:', error);
      throw error;
    }
  }

  /**
   * Transform backend response to frontend format
   */
  private transformBackendResponse(backendData: any, reportType: string, filters: ReportFilters): ReportData {
    // Transform the backend response to match the frontend ReportData interface
    const transformedData: ReportData = {
      summary: {
        totalRecords: this.extractTotalRecords(backendData),
        primaryMetric: {
          label: 'Total Records',
          value: this.extractTotalRecords(backendData),
          unit: 'records',
          trend: 'stable'
        },
        secondaryMetrics: this.extractSecondaryMetrics(backendData, reportType)
      },
      charts: this.transformChartsData(backendData, reportType),
      tables: this.transformTablesData(backendData, reportType),
      metadata: {
        id: `report-${reportType}-${Date.now()}`,
        title: this.getReportTitle(reportType),
        description: `Generated ${reportType} report`,
        category: this.getReportCategory(reportType),
        generatedAt: new Date(),
        generatedBy: 'System',
        workspaceId: 'current-workspace',
        filters,
        dataPoints: this.extractTotalRecords(backendData),
        version: '1.0'
      }
    };

    return transformedData;
  }

  private getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      'patient-outcomes': 'Patient Outcomes Report',
      'pharmacist-interventions': 'Pharmacist Interventions Report',
      'therapy-effectiveness': 'Therapy Effectiveness Report',
      'quality-improvement': 'Quality Improvement Report',
      'regulatory-compliance': 'Regulatory Compliance Report',
      'cost-effectiveness': 'Cost Effectiveness Report',
      'trend-forecasting': 'Trend Forecasting Report',
      'operational-efficiency': 'Operational Efficiency Report',
      'medication-inventory': 'Medication Inventory Report',
      'patient-demographics': 'Patient Demographics Report',
      'adverse-events': 'Adverse Events Report'
    };
    return titles[reportType] || reportType;
  }

  private getReportCategory(reportType: string): string {
    const categories: Record<string, string> = {
      'patient-outcomes': 'Clinical',
      'pharmacist-interventions': 'Clinical',
      'therapy-effectiveness': 'Clinical',
      'quality-improvement': 'Quality',
      'regulatory-compliance': 'Compliance',
      'cost-effectiveness': 'Financial',
      'trend-forecasting': 'Analytics',
      'operational-efficiency': 'Operations',
      'medication-inventory': 'Operations',
      'patient-demographics': 'Analytics',
      'adverse-events': 'Safety'
    };
    return categories[reportType] || 'General';
  }

  private extractSecondaryMetrics(backendData: any, reportType: string): Array<any> {
    const metrics = [];

    switch (reportType) {
      case 'patient-outcomes':
        if (backendData.therapyEffectiveness?.length) {
          const completionRate = backendData.therapyEffectiveness.reduce((sum: number, item: any) => {
            return sum + (item.totalReviews > 0 ? (item.completedReviews / item.totalReviews) * 100 : 0);
          }, 0) / backendData.therapyEffectiveness.length;

          metrics.push({
            label: 'Completion Rate',
            value: `${Math.round(completionRate)}%`,
            icon: 'CheckCircle',
            color: 'success'
          });
        }
        break;

      case 'pharmacist-interventions':
        if (backendData.interventionMetrics?.length) {
          const totalAccepted = backendData.interventionMetrics.reduce((sum: number, item: any) => sum + (item.acceptedInterventions || 0), 0);
          const totalInterventions = backendData.interventionMetrics.reduce((sum: number, item: any) => sum + (item.totalInterventions || 0), 0);
          const acceptanceRate = totalInterventions > 0 ? (totalAccepted / totalInterventions) * 100 : 0;

          metrics.push({
            label: 'Acceptance Rate',
            value: `${Math.round(acceptanceRate)}%`,
            icon: 'ThumbsUp',
            color: 'primary'
          });
        }
        break;

      default:
        metrics.push({
          label: 'Status',
          value: 'Active',
          icon: 'Activity',
          color: 'info'
        });
    }

    return metrics;
  }

  private extractTotalRecords(backendData: any): number {

    // Extract total records from various possible backend response structures
    if (backendData.therapyEffectiveness?.length) {
      return backendData.therapyEffectiveness.reduce((sum: number, item: any) => sum + (item.totalReviews || 0), 0);
    }
    if (backendData.interventionMetrics?.length) {
      return backendData.interventionMetrics.reduce((sum: number, item: any) => sum + (item.totalInterventions || 0), 0);
    }
    if (backendData.adherenceMetrics?.length) {
      return backendData.adherenceMetrics.reduce((sum: number, item: any) => sum + (item.totalReviews || 0), 0);
    }

    // Check for any array data in the response
    const dataArrays = Object.values(backendData).filter(Array.isArray);
    if (dataArrays.length > 0) {
      const totalFromArrays = dataArrays.reduce((sum: number, arr: any) => sum + arr.length, 0);
      if (totalFromArrays > 0) {

        return totalFromArrays;
      }
    }

    // If no data found, return 0 (real data only)

    return 0;
  }



  private transformChartsData(backendData: any, reportType: string): Array<any> {
    const charts = [];

    // Transform based on report type and available data
    switch (reportType) {
      case 'patient-outcomes':
        // Therapy effectiveness chart
        if (backendData.therapyEffectiveness && backendData.therapyEffectiveness.length > 0) {
          charts.push({
            id: 'therapy-effectiveness-chart',
            type: 'bar',
            title: 'Therapy Effectiveness by Type',
            data: backendData.therapyEffectiveness.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.completedReviews || 0,
              total: item.totalReviews || 0
            }))
          });
        }

        // Clinical improvements overview
        if (backendData.clinicalImprovements && Object.keys(backendData.clinicalImprovements).length > 0) {
          const improvements = backendData.clinicalImprovements;
          charts.push({
            id: 'clinical-improvements-chart',
            type: 'pie',
            title: 'Clinical Improvements Overview',
            data: [
              { category: 'Adherence Improved', value: improvements.adherenceImproved || 0 },
              { category: 'Symptoms Improved', value: improvements.symptomsImproved || 0 },
              { category: 'Quality of Life Improved', value: improvements.qualityOfLifeImproved || 0 },
              { category: 'Medication Optimized', value: improvements.medicationOptimized || 0 }
            ].filter(item => item.value > 0)
          });
        }

        // Outcomes by priority
        if (backendData.outcomesByPriority && backendData.outcomesByPriority.length > 0) {
          charts.push({
            id: 'outcomes-priority-chart',
            type: 'bar',
            title: 'Outcomes by Priority Level',
            data: backendData.outcomesByPriority.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.completedReviews || 0,
              total: item.totalReviews || 0
            }))
          });
        }

        // Completion time analysis
        if (backendData.completionTimeAnalysis && backendData.completionTimeAnalysis.length > 0) {
          charts.push({
            id: 'completion-time-chart',
            type: 'bar',
            title: 'Review Completion Time Distribution',
            data: backendData.completionTimeAnalysis.map((item: any) => ({
              category: typeof item._id === 'number' ? `${item._id}-${item._id + 1} days` : item._id,
              value: item.count || 0
            }))
          });
        }

        // Cost effectiveness trends
        if (backendData.costEffectivenessAnalysis && backendData.costEffectivenessAnalysis.length > 0) {
          charts.push({
            id: 'cost-trends-chart',
            type: 'line',
            title: 'Cost Savings Trends',
            data: backendData.costEffectivenessAnalysis.map((item: any) => ({
              category: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
              value: item.totalCostSavings || 0
            }))
          });
        }
        break;

      case 'pharmacist-interventions':
        // Intervention metrics by type
        if (backendData.interventionMetrics && backendData.interventionMetrics.length > 0) {
          charts.push({
            id: 'intervention-metrics-chart',
            type: 'pie',
            title: 'Interventions by Type',
            data: backendData.interventionMetrics.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.totalInterventions || 0
            }))
          });
        }

        // Intervention outcomes
        if (backendData.interventionOutcomes && backendData.interventionOutcomes.length > 0) {
          charts.push({
            id: 'intervention-outcomes-chart',
            type: 'pie',
            title: 'Intervention Outcomes',
            data: backendData.interventionOutcomes.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.count || 0
            }))
          });
        }

        // Top performing pharmacists
        if (backendData.interventionsByPharmacist && backendData.interventionsByPharmacist.length > 0) {
          charts.push({
            id: 'pharmacist-performance-chart',
            type: 'bar',
            title: 'Top Performing Pharmacists',
            data: backendData.interventionsByPharmacist.slice(0, 10).map((item: any) => ({
              category: item.pharmacistName || 'Unknown',
              value: item.totalInterventions || 0
            }))
          });
        }

        // Intervention trends
        if (backendData.interventionTrends && backendData.interventionTrends.length > 0) {
          charts.push({
            id: 'intervention-trends-chart',
            type: 'line',
            title: 'Intervention Trends Over Time',
            data: backendData.interventionTrends.map((item: any) => ({
              category: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
              value: item.totalInterventions || 0
            }))
          });
        }

        // Intervention priority analysis
        if (backendData.interventionPriority && backendData.interventionPriority.length > 0) {
          charts.push({
            id: 'intervention-priority-chart',
            type: 'bar',
            title: 'Interventions by Priority',
            data: backendData.interventionPriority.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.totalInterventions || 0
            }))
          });
        }
        break;

      case 'therapy-effectiveness':
        // Adherence improvement trends
        if (backendData.adherenceMetrics && backendData.adherenceMetrics.length > 0) {
          charts.push({
            id: 'adherence-chart',
            type: 'bar',
            title: 'Adherence Improvement by Therapy Type',
            data: backendData.adherenceMetrics.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.adherenceImproved || 0,
              total: item.totalReviews || 0
            }))
          });
        }

        // Medication optimization analysis
        if (backendData.medicationOptimization && backendData.medicationOptimization.length > 0) {
          charts.push({
            id: 'medication-optimization-chart',
            type: 'bar',
            title: 'Medication Optimization by Review Type',
            data: backendData.medicationOptimization.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.medicationOptimized || 0
            }))
          });
        }

        // Patient satisfaction distribution
        if (backendData.patientSatisfaction && backendData.patientSatisfaction.length > 0) {
          charts.push({
            id: 'patient-satisfaction-chart',
            type: 'bar',
            title: 'Patient Satisfaction Score Distribution',
            data: backendData.patientSatisfaction.map((item: any) => ({
              category: typeof item._id === 'number' ? `${item._id}-${item._id + 2}` : item._id,
              value: item.count || 0
            }))
          });
        }

        // Clinical indicators improvement
        if (backendData.clinicalIndicators && backendData.clinicalIndicators.length > 0) {
          charts.push({
            id: 'clinical-indicators-chart',
            type: 'bar',
            title: 'Clinical Indicators Improvement by Priority',
            data: backendData.clinicalIndicators.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.vitalSignsImproved + item.labValuesImproved + item.functionalStatusImproved || 0
            }))
          });
        }

        // Therapy duration effectiveness
        if (backendData.therapyDuration && backendData.therapyDuration.length > 0) {
          charts.push({
            id: 'therapy-duration-chart',
            type: 'bar',
            title: 'Therapy Duration vs Success Rate',
            data: backendData.therapyDuration.map((item: any) => ({
              category: typeof item._id === 'number' ? `${item._id}-${item._id + 7} days` : item._id,
              value: Math.round((item.successRate || 0) * 100)
            }))
          });
        }
        break;

      case 'patient-demographics':

        // Age distribution chart
        if (backendData.ageDistribution && backendData.ageDistribution.length > 0) {
          charts.push({
            id: 'age-distribution-chart',
            type: 'bar',
            title: 'Age Distribution',
            data: backendData.ageDistribution.map((item: any) => ({
              category: item._id === 'Unknown' ? 'Unknown Age' : `${item._id} years`,
              value: item.count || 0
            }))
          });
        }

        // Gender distribution chart
        if (backendData.genderDistribution && backendData.genderDistribution.length > 0) {
          charts.push({
            id: 'gender-distribution-chart',
            type: 'pie',
            title: 'Gender Distribution',
            data: backendData.genderDistribution.map((item: any) => ({
              category: item._id || 'Not Specified',
              value: item.count || 0
            }))
          });
        }

        // Marital status distribution chart
        if (backendData.maritalStatusDistribution && backendData.maritalStatusDistribution.length > 0) {
          charts.push({
            id: 'marital-status-chart',
            type: 'pie',
            title: 'Marital Status Distribution',
            data: backendData.maritalStatusDistribution.map((item: any) => ({
              category: item._id || 'Not Specified',
              value: item.count || 0
            }))
          });
        }

        // Blood group distribution chart
        if (backendData.bloodGroupDistribution && backendData.bloodGroupDistribution.length > 0) {
          charts.push({
            id: 'blood-group-chart',
            type: 'bar',
            title: 'Blood Group Distribution',
            data: backendData.bloodGroupDistribution.map((item: any) => ({
              category: item._id || 'Not Specified',
              value: item.count || 0
            }))
          });
        }

        // Genotype distribution chart
        if (backendData.genotypeDistribution && backendData.genotypeDistribution.length > 0) {
          charts.push({
            id: 'genotype-chart',
            type: 'bar',
            title: 'Genotype Distribution',
            data: backendData.genotypeDistribution.map((item: any) => ({
              category: item._id || 'Not Specified',
              value: item.count || 0
            }))
          });
        }

        // Geographic distribution chart (top states)
        if (backendData.stateDistribution && backendData.stateDistribution.length > 0) {
          charts.push({
            id: 'state-distribution-chart',
            type: 'bar',
            title: 'Geographic Distribution (Top States)',
            data: backendData.stateDistribution.map((item: any) => ({
              category: item._id || 'Not Specified',
              value: item.count || 0
            }))
          });
        }
        break;

      case 'quality-improvement':
        if (backendData.qualityMetrics) {
          charts.push({
            id: 'quality-metrics-chart',
            type: 'bar',
            title: 'Quality Metrics by Priority',
            data: backendData.qualityMetrics.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.totalReviews || 0
            }))
          });
        }
        break;

      case 'cost-effectiveness':
        if (backendData.costSavings) {
          charts.push({
            id: 'cost-savings-chart',
            type: 'bar',
            title: 'Cost Savings by Review Type',
            data: backendData.costSavings.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.totalCostSavings || 0
            }))
          });
        }
        break;

      case 'trend-forecasting':
        if (backendData.trends) {
          charts.push({
            id: 'trends-chart',
            type: 'line',
            title: 'Monthly Trends',
            data: backendData.trends.map((item: any) => ({
              category: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
              value: item.totalReviews || 0
            }))
          });
        }
        break;

      case 'operational-efficiency':
        if (backendData.workflowMetrics) {
          charts.push({
            id: 'workflow-metrics-chart',
            type: 'bar',
            title: 'Workflow Metrics by Status',
            data: backendData.workflowMetrics.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.count || 0
            }))
          });
        }
        break;

      case 'adverse-events':
        if (backendData.adverseEvents) {
          charts.push({
            id: 'adverse-events-chart',
            type: 'bar',
            title: 'Adverse Events by Review Type',
            data: backendData.adverseEvents.map((item: any) => ({
              category: item._id || 'Unknown',
              value: item.adverseEventsReduced || 0
            }))
          });
        }
        break;

      default:
        // Only show generic chart if no specific data is available
        if (Object.keys(backendData).length === 0) {
          charts.push({
            id: 'no-data-chart',
            type: 'bar',
            title: 'No Data Available',
            data: [
              { category: 'No Data', value: 0 }
            ]
          });
        }
    }

    // If no charts were created, add a placeholder
    if (charts.length === 0) {
      charts.push({
        id: 'placeholder-chart',
        type: 'bar',
        title: 'Report Data',
        data: [
          { category: 'No Data Available', value: 0 }
        ]
      });
    }

    return charts;
  }

  private transformTablesData(backendData: any, reportType: string): Array<any> {
    const tables = [];

    // Transform based on report type and available data
    switch (reportType) {
      case 'patient-outcomes':
        // Therapy effectiveness table
        if (backendData.therapyEffectiveness && backendData.therapyEffectiveness.length > 0) {
          tables.push({
            id: 'therapy-effectiveness-table',
            title: 'Therapy Effectiveness Details',
            headers: ['Review Type', 'Total', 'Completed', 'In Progress', 'Pending', 'Completion Rate', 'Avg Days', 'Cost Savings'],
            rows: backendData.therapyEffectiveness.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.completedReviews || 0).toString(),
              (item.inProgressReviews || 0).toString(),
              (item.pendingReviews || 0).toString(),
              item.totalReviews > 0 ? `${Math.round((item.completedReviews / item.totalReviews) * 100)}%` : '0%',
              item.avgCompletionTime ? item.avgCompletionTime.toFixed(1) : 'N/A',
              `₦${(item.totalCostSavings || 0).toLocaleString()}`
            ])
          });
        }

        // Clinical improvements summary
        if (backendData.clinicalImprovements && Object.keys(backendData.clinicalImprovements).length > 0) {
          const improvements = backendData.clinicalImprovements;
          const total = improvements.totalCompleted || 1;
          tables.push({
            id: 'clinical-improvements-table',
            title: 'Clinical Improvements Summary',
            headers: ['Improvement Type', 'Count', 'Percentage'],
            rows: [
              ['Adherence Improved', (improvements.adherenceImproved || 0).toString(), `${Math.round(((improvements.adherenceImproved || 0) / total) * 100)}%`],
              ['Symptoms Improved', (improvements.symptomsImproved || 0).toString(), `${Math.round(((improvements.symptomsImproved || 0) / total) * 100)}%`],
              ['Quality of Life Improved', (improvements.qualityOfLifeImproved || 0).toString(), `${Math.round(((improvements.qualityOfLifeImproved || 0) / total) * 100)}%`],
              ['Medication Optimized', (improvements.medicationOptimized || 0).toString(), `${Math.round(((improvements.medicationOptimized || 0) / total) * 100)}%`],
              ['Avg Patient Satisfaction', (improvements.avgPatientSatisfaction || 0).toFixed(1), 'Score (0-10)']
            ]
          });
        }

        // Adverse events reduction
        if (backendData.adverseEventReduction && backendData.adverseEventReduction.length > 0) {
          tables.push({
            id: 'adverse-events-table',
            title: 'Adverse Events Reduction',
            headers: ['Review Type', 'Total Reviews', 'Adverse Events Reduced', 'Drug Interactions Resolved', 'Contraindications Addressed'],
            rows: backendData.adverseEventReduction.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.adverseEventsReduced || 0).toString(),
              (item.drugInteractionsResolved || 0).toString(),
              (item.contraIndicationsAddressed || 0).toString()
            ])
          });
        }

        // Outcomes by priority
        if (backendData.outcomesByPriority && backendData.outcomesByPriority.length > 0) {
          tables.push({
            id: 'priority-outcomes-table',
            title: 'Outcomes by Priority Level',
            headers: ['Priority', 'Total Reviews', 'Completed', 'Completion Rate', 'Avg Cost Savings', 'Total Cost Savings'],
            rows: backendData.outcomesByPriority.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.completedReviews || 0).toString(),
              item.totalReviews > 0 ? `${Math.round((item.completedReviews / item.totalReviews) * 100)}%` : '0%',
              `₦${(item.avgCostSavings || 0).toLocaleString()}`,
              `₦${(item.totalCostSavings || 0).toLocaleString()}`
            ])
          });
        }
        break;

      case 'pharmacist-interventions':
        // Intervention metrics table
        if (backendData.interventionMetrics && backendData.interventionMetrics.length > 0) {
          tables.push({
            id: 'intervention-metrics-table',
            title: 'Intervention Metrics by Type',
            headers: ['Type', 'Total', 'Accepted', 'Rejected', 'Pending', 'Acceptance Rate', 'Avg Response Time (hrs)'],
            rows: backendData.interventionMetrics.map((item: any) => [
              item._id || 'Unknown',
              (item.totalInterventions || 0).toString(),
              (item.acceptedInterventions || 0).toString(),
              (item.rejectedInterventions || 0).toString(),
              (item.pendingInterventions || 0).toString(),
              item.totalInterventions > 0 ? `${Math.round((item.acceptedInterventions / item.totalInterventions) * 100)}%` : '0%',
              item.avgResponseTime ? item.avgResponseTime.toFixed(1) : 'N/A'
            ])
          });
        }

        // Pharmacist performance table
        if (backendData.interventionsByPharmacist && backendData.interventionsByPharmacist.length > 0) {
          tables.push({
            id: 'pharmacist-performance-table',
            title: 'Pharmacist Performance',
            headers: ['Pharmacist', 'Total Interventions', 'Accepted', 'Acceptance Rate', 'Avg Response Time (hrs)'],
            rows: backendData.interventionsByPharmacist.map((item: any) => [
              item.pharmacistName || 'Unknown',
              (item.totalInterventions || 0).toString(),
              (item.acceptedInterventions || 0).toString(),
              item.totalInterventions > 0 ? `${Math.round((item.acceptedInterventions / item.totalInterventions) * 100)}%` : '0%',
              item.avgResponseTime ? item.avgResponseTime.toFixed(1) : 'N/A'
            ])
          });
        }

        // Intervention outcomes summary
        if (backendData.interventionOutcomes && backendData.interventionOutcomes.length > 0) {
          tables.push({
            id: 'intervention-outcomes-table',
            title: 'Intervention Outcomes Analysis',
            headers: ['Outcome', 'Count', 'Avg Severity', 'Avg Clinical Impact'],
            rows: backendData.interventionOutcomes.map((item: any) => [
              item._id || 'Unknown',
              (item.count || 0).toString(),
              item.avgSeverity ? item.avgSeverity.toFixed(1) : 'N/A',
              item.avgImpact ? item.avgImpact.toFixed(1) : 'N/A'
            ])
          });
        }

        // Intervention effectiveness
        if (backendData.interventionEffectiveness && backendData.interventionEffectiveness.length > 0) {
          tables.push({
            id: 'intervention-effectiveness-table',
            title: 'Intervention Effectiveness',
            headers: ['Type', 'Accepted Count', 'Avg Clinical Impact', 'Avg Patient Satisfaction', 'Cost Savings Generated'],
            rows: backendData.interventionEffectiveness.map((item: any) => [
              item._id || 'Unknown',
              (item.totalAccepted || 0).toString(),
              item.avgClinicalImpact ? item.avgClinicalImpact.toFixed(1) : 'N/A',
              item.avgPatientSatisfaction ? item.avgPatientSatisfaction.toFixed(1) : 'N/A',
              `₦${(item.costSavingsGenerated || 0).toLocaleString()}`
            ])
          });
        }

        // Priority analysis
        if (backendData.interventionPriority && backendData.interventionPriority.length > 0) {
          tables.push({
            id: 'intervention-priority-table',
            title: 'Interventions by Priority',
            headers: ['Priority', 'Total Interventions', 'Accepted', 'Acceptance Rate', 'Avg Severity'],
            rows: backendData.interventionPriority.map((item: any) => [
              item._id || 'Unknown',
              (item.totalInterventions || 0).toString(),
              (item.acceptedInterventions || 0).toString(),
              item.totalInterventions > 0 ? `${Math.round((item.acceptedInterventions / item.totalInterventions) * 100)}%` : '0%',
              item.avgSeverity ? item.avgSeverity.toFixed(1) : 'N/A'
            ])
          });
        }
        break;

      case 'therapy-effectiveness':
        // Adherence metrics table
        if (backendData.adherenceMetrics && backendData.adherenceMetrics.length > 0) {
          tables.push({
            id: 'adherence-metrics-table',
            title: 'Adherence Improvement Analysis',
            headers: ['Therapy Type', 'Total Reviews', 'Adherence Improved', 'Improvement Rate', 'Avg Score', 'Baseline', 'Follow-up'],
            rows: backendData.adherenceMetrics.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.adherenceImproved || 0).toString(),
              item.totalReviews > 0 ? `${Math.round((item.adherenceImproved / item.totalReviews) * 100)}%` : '0%',
              item.avgAdherenceScore ? item.avgAdherenceScore.toFixed(1) : 'N/A',
              item.baselineAdherence ? item.baselineAdherence.toFixed(1) : 'N/A',
              item.followUpAdherence ? item.followUpAdherence.toFixed(1) : 'N/A'
            ])
          });
        }

        // Therapy outcomes summary
        if (backendData.therapyOutcomes && Object.keys(backendData.therapyOutcomes).length > 0) {
          const outcomes = backendData.therapyOutcomes;
          const total = outcomes.totalCompleted || 1;
          tables.push({
            id: 'therapy-outcomes-table',
            title: 'Therapy Outcomes Summary',
            headers: ['Outcome Type', 'Count', 'Percentage', 'Clinical Impact'],
            rows: [
              ['Symptoms Improved', (outcomes.symptomsImproved || 0).toString(), `${Math.round(((outcomes.symptomsImproved || 0) / total) * 100)}%`, 'High'],
              ['Quality of Life Improved', (outcomes.qualityOfLifeImproved || 0).toString(), `${Math.round(((outcomes.qualityOfLifeImproved || 0) / total) * 100)}%`, 'High'],
              ['Adverse Events Reduced', (outcomes.adverseEventsReduced || 0).toString(), `${Math.round(((outcomes.adverseEventsReduced || 0) / total) * 100)}%`, 'Critical'],
              ['Drug Interactions Resolved', (outcomes.drugInteractionsResolved || 0).toString(), `${Math.round(((outcomes.drugInteractionsResolved || 0) / total) * 100)}%`, 'Critical'],
              ['Avg Clinical Improvement', (outcomes.avgClinicalImprovement || 0).toFixed(1), 'Score (0-10)', 'Overall']
            ]
          });
        }

        // Medication optimization table
        if (backendData.medicationOptimization && backendData.medicationOptimization.length > 0) {
          tables.push({
            id: 'medication-optimization-table',
            title: 'Medication Optimization Analysis',
            headers: ['Review Type', 'Total', 'Optimized', 'Dosage Adjusted', 'Switched', 'Discontinued', 'Avg Cost Savings'],
            rows: backendData.medicationOptimization.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.medicationOptimized || 0).toString(),
              (item.dosageAdjusted || 0).toString(),
              (item.medicationSwitched || 0).toString(),
              (item.medicationDiscontinued || 0).toString(),
              `₦${(item.avgCostSavings || 0).toLocaleString()}`
            ])
          });
        }

        // Patient satisfaction analysis
        if (backendData.patientSatisfaction && backendData.patientSatisfaction.length > 0) {
          tables.push({
            id: 'patient-satisfaction-table',
            title: 'Patient Satisfaction Analysis',
            headers: ['Score Range', 'Patient Count', 'Avg Score', 'Review Types'],
            rows: backendData.patientSatisfaction.map((item: any) => [
              typeof item._id === 'number' ? `${item._id}-${item._id + 2}` : item._id,
              (item.count || 0).toString(),
              item.avgScore ? item.avgScore.toFixed(1) : 'N/A',
              (item.reviewTypes || []).join(', ') || 'N/A'
            ])
          });
        }

        // Clinical indicators improvement
        if (backendData.clinicalIndicators && backendData.clinicalIndicators.length > 0) {
          tables.push({
            id: 'clinical-indicators-table',
            title: 'Clinical Indicators Improvement',
            headers: ['Priority', 'Total Reviews', 'Vital Signs', 'Lab Values', 'Functional Status', 'Avg Improvement Score'],
            rows: backendData.clinicalIndicators.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.vitalSignsImproved || 0).toString(),
              (item.labValuesImproved || 0).toString(),
              (item.functionalStatusImproved || 0).toString(),
              item.avgImprovementScore ? item.avgImprovementScore.toFixed(1) : 'N/A'
            ])
          });
        }

        // Therapy duration effectiveness
        if (backendData.therapyDuration && backendData.therapyDuration.length > 0) {
          tables.push({
            id: 'therapy-duration-table',
            title: 'Therapy Duration vs Effectiveness',
            headers: ['Duration Range', 'Patient Count', 'Avg Duration (days)', 'Success Rate'],
            rows: backendData.therapyDuration.map((item: any) => [
              typeof item._id === 'number' ? `${item._id}-${item._id + 7} days` : item._id,
              (item.count || 0).toString(),
              item.avgDuration ? item.avgDuration.toFixed(1) : 'N/A',
              `${Math.round((item.successRate || 0) * 100)}%`
            ])
          });
        }
        break;

      case 'patient-demographics':



        // Age distribution table
        if (backendData.ageDistribution && backendData.ageDistribution.length > 0) {
          tables.push({
            id: 'age-distribution-table',
            title: 'Age Distribution',
            headers: ['Age Group', 'Patient Count', 'Percentage', 'Avg Age'],
            rows: backendData.ageDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id === 'Unknown' ? 'Unknown Age' : `${item._id} years`,
                (item.count || 0).toString(),
                `${percentage}%`,
                item.avgAge ? item.avgAge.toFixed(1) : 'N/A'
              ];
            })
          });
        }

        // Gender distribution table
        if (backendData.genderDistribution && backendData.genderDistribution.length > 0) {
          tables.push({
            id: 'gender-distribution-table',
            title: 'Gender Distribution',
            headers: ['Gender', 'Patient Count', 'Percentage'],
            rows: backendData.genderDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id || 'Not Specified',
                (item.count || 0).toString(),
                `${percentage}%`
              ];
            })
          });
        }

        // Marital status distribution table
        if (backendData.maritalStatusDistribution && backendData.maritalStatusDistribution.length > 0) {
          tables.push({
            id: 'marital-status-table',
            title: 'Marital Status Distribution',
            headers: ['Marital Status', 'Patient Count', 'Percentage'],
            rows: backendData.maritalStatusDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id || 'Not Specified',
                (item.count || 0).toString(),
                `${percentage}%`
              ];
            })
          });
        }

        // Blood group distribution table
        if (backendData.bloodGroupDistribution && backendData.bloodGroupDistribution.length > 0) {
          tables.push({
            id: 'blood-group-table',
            title: 'Blood Group Distribution',
            headers: ['Blood Group', 'Patient Count', 'Percentage'],
            rows: backendData.bloodGroupDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id || 'Not Specified',
                (item.count || 0).toString(),
                `${percentage}%`
              ];
            })
          });
        }

        // Genotype distribution table
        if (backendData.genotypeDistribution && backendData.genotypeDistribution.length > 0) {
          tables.push({
            id: 'genotype-table',
            title: 'Genotype Distribution',
            headers: ['Genotype', 'Patient Count', 'Percentage'],
            rows: backendData.genotypeDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id || 'Not Specified',
                (item.count || 0).toString(),
                `${percentage}%`
              ];
            })
          });
        }

        // Geographic distribution table (top states)
        if (backendData.stateDistribution && backendData.stateDistribution.length > 0) {
          tables.push({
            id: 'state-distribution-table',
            title: 'Geographic Distribution (Top States)',
            headers: ['State', 'Patient Count', 'Percentage'],
            rows: backendData.stateDistribution.map((item: any) => {
              const total = backendData.totalPatients || 1;
              const percentage = ((item.count || 0) / total * 100).toFixed(1);
              return [
                item._id || 'Not Specified',
                (item.count || 0).toString(),
                `${percentage}%`
              ];
            })
          });
        }

        // Comprehensive summary table
        tables.push({
          id: 'demographics-summary-table',
          title: 'Demographics Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Patients', (backendData.totalPatients || 0).toString()],
            ['Age Groups', (backendData.ageDistribution?.length || 0).toString()],
            ['Gender Categories', (backendData.genderDistribution?.length || 0).toString()],
            ['Marital Status Types', (backendData.maritalStatusDistribution?.length || 0).toString()],
            ['Blood Group Types', (backendData.bloodGroupDistribution?.length || 0).toString()],
            ['Genotype Types', (backendData.genotypeDistribution?.length || 0).toString()],
            ['States Represented', (backendData.stateDistribution?.length || 0).toString()],
            ['Data Source', 'Real Patient Database'],
            ['Last Updated', new Date().toLocaleDateString()]
          ]
        });
        break;

      case 'quality-improvement':
        if (backendData.qualityMetrics) {
          tables.push({
            id: 'quality-metrics-table',
            title: 'Quality Metrics',
            headers: ['Priority Level', 'Total Reviews', 'Avg Completion Time (Days)'],
            rows: backendData.qualityMetrics.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.avgCompletionTime || 0).toFixed(1)
            ])
          });
        }
        break;

      case 'cost-effectiveness':
        if (backendData.costSavings) {
          tables.push({
            id: 'cost-savings-table',
            title: 'Cost Savings Analysis',
            headers: ['Review Type', 'Total Cost Savings', 'Review Count', 'Avg Savings per Review'],
            rows: backendData.costSavings.map((item: any) => [
              item._id || 'Unknown',
              `₦${(item.totalCostSavings || 0).toLocaleString()}`,
              (item.reviewCount || 0).toString(),
              `₦${((item.totalCostSavings || 0) / (item.reviewCount || 1)).toLocaleString()}`
            ])
          });
        }
        break;

      case 'trend-forecasting':
        if (backendData.trends) {
          tables.push({
            id: 'trends-table',
            title: 'Monthly Trends',
            headers: ['Month', 'Total Reviews', 'Completed Reviews', 'Completion Rate'],
            rows: backendData.trends.map((item: any) => [
              `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
              (item.totalReviews || 0).toString(),
              (item.completedReviews || 0).toString(),
              item.totalReviews > 0 ? `${Math.round((item.completedReviews / item.totalReviews) * 100)}%` : '0%'
            ])
          });
        }
        break;

      case 'operational-efficiency':
        if (backendData.workflowMetrics) {
          tables.push({
            id: 'workflow-table',
            title: 'Workflow Efficiency',
            headers: ['Status', 'Count', 'Avg Processing Time (Hours)'],
            rows: backendData.workflowMetrics.map((item: any) => [
              item._id || 'Unknown',
              (item.count || 0).toString(),
              (item.avgProcessingTime || 0).toFixed(1)
            ])
          });
        }
        break;

      case 'adverse-events':
        if (backendData.adverseEvents) {
          tables.push({
            id: 'adverse-events-table',
            title: 'Adverse Events Analysis',
            headers: ['Review Type', 'Total Reviews', 'Adverse Events Reduced'],
            rows: backendData.adverseEvents.map((item: any) => [
              item._id || 'Unknown',
              (item.totalReviews || 0).toString(),
              (item.adverseEventsReduced || 0).toString()
            ])
          });
        }
        break;

      default:
        // Only show generic table if we have actual data
        const entries = Object.entries(backendData).filter(([key, value]) =>
          key !== 'error' && key !== 'message' && key !== 'timestamp'
        ).slice(0, 10);

        if (entries.length > 0) {
          tables.push({
            id: 'generic-table',
            title: 'Report Data',
            headers: ['Item', 'Value'],
            rows: entries.map(([key, value]) => [
              key,
              typeof value === 'object' ? JSON.stringify(value) : String(value)
            ])
          });
        }
    }

    // If no tables were created, add a placeholder
    if (tables.length === 0) {
      tables.push({
        id: 'placeholder-table',
        title: 'Report Summary',
        headers: ['Status', 'Message'],
        rows: [
          ['Data Status', 'No data available for the selected criteria'],
          ['Suggestion', 'Try adjusting the date range or filters'],
          ['Report Type', reportType]
        ]
      });
    }

    return tables;
  }


}

export const reportsService = new ReportsService();
export default reportsService;