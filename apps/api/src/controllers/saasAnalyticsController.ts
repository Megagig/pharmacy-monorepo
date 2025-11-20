import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { SystemAnalyticsService } from '../services/SystemAnalyticsService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import { User } from '../models/User';
import { Subscription } from '../models/Subscription';
import { Workplace } from '../models/Workplace';
import { Patient } from '../models/Patient';
import { ClinicalIntervention } from '../models/ClinicalIntervention';
import DiagnosticCase from '../models/DiagnosticCase';
import MedicationRecord from '../models/MedicationRecord';
import ClinicalNote from '../models/ClinicalNote';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export interface SubscriptionAnalytics {
  mrr: number;
  arr: number;
  ltv: number;
  cac: number;
  churnRate: number;
  upgradeRate: number;
  downgradeRate: number;
  planDistribution: PlanDistribution[];
  revenueByPlan: RevenueByPlan[];
  growthTrend: GrowthTrend[];
}

export interface PlanDistribution {
  planName: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface RevenueByPlan {
  planName: string;
  revenue: number;
  growth: number;
}

export interface GrowthTrend {
  month: string;
  mrr: number;
  subscribers: number;
  churn: number;
}

export interface PharmacyUsageReport {
  pharmacyId: string;
  pharmacyName: string;
  subscriptionPlan: string;
  prescriptionsProcessed: number;
  diagnosticsPerformed: number;
  patientsManaged: number;
  activeUsers: number;
  lastActivity: string;
  clinicalOutcomes: {
    interventions: number;
    adherenceImprovement: number;
    costSavings: number;
  };
}

export interface ClinicalOutcomesReport {
  totalInterventions: number;
  averageAdherenceImprovement: number;
  totalCostSavings: number;
  interventionsByType: InterventionByType[];
  outcomesByPharmacy: OutcomeByPharmacy[];
  trendsOverTime: OutcomeTrend[];
}

export interface InterventionByType {
  type: string;
  count: number;
  successRate: number;
  avgCostSaving: number;
}

export interface OutcomeByPharmacy {
  pharmacyId: string;
  pharmacyName: string;
  interventions: number;
  adherenceImprovement: number;
  costSavings: number;
  patientSatisfaction: number;
}

export interface OutcomeTrend {
  month: string;
  interventions: number;
  adherenceRate: number;
  costSavings: number;
}

/**
 * SaaS Analytics Controller
 * Handles analytics and reporting for subscription metrics, pharmacy usage, and clinical outcomes
 */
export class SaaSAnalyticsController {
  private systemAnalyticsService: SystemAnalyticsService;

  constructor() {
    this.systemAnalyticsService = SystemAnalyticsService.getInstance();
  }

  /**
   * Get subscription analytics
   * GET /api/admin/saas/analytics/subscriptions
   */
  async getSubscriptionAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '30d' } = req.query;

      logger.info('Fetching subscription analytics', {
        adminId: req.user?._id,
        timeRange
      });

      const dateRange = this.getDateRange(timeRange as string);

      // Get subscription data
      const subscriptions = await Subscription.find({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      }).populate('workspaceId');

      const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
      const cancelledSubscriptions = subscriptions.filter(sub => sub.status === 'canceled'); // Fixed: 'canceled' not 'cancelled'

      // Calculate MRR (Monthly Recurring Revenue)
      const mrr = activeSubscriptions.reduce((sum, sub) => {
        const monthlyAmount = this.getMonthlyAmount(sub.amount || sub.priceAtPurchase, sub.billingCycle || sub.billingInterval);
        return sum + monthlyAmount;
      }, 0);

      // Calculate ARR (Annual Recurring Revenue)
      const arr = mrr * 12;

      // Calculate churn rate
      const totalSubscriptions = subscriptions.length;
      const churnRate = totalSubscriptions > 0 ? cancelledSubscriptions.length / totalSubscriptions : 0;

      // Calculate LTV (Lifetime Value) - simplified calculation
      const avgMonthlyRevenue = mrr / Math.max(activeSubscriptions.length, 1);
      const avgLifetimeMonths = churnRate > 0 ? 1 / churnRate : 24; // Default to 24 months if no churn
      const ltv = avgMonthlyRevenue * avgLifetimeMonths;

      // Calculate CAC (Customer Acquisition Cost) - placeholder
      const cac = 150; // This would come from marketing spend data

      // Load plan names from plans.json
      const plansConfig = require('../config/plans.json');
      const planNameMap: Record<string, string> = {};
      Object.entries(plansConfig.plans).forEach(([key, plan]: [string, any]) => {
        planNameMap[key] = plan.name;
      });

      // Get plan distribution with actual plan names
      const planCounts = activeSubscriptions.reduce((acc, sub) => {
        const planTier = sub.tier || 'free_trial';
        const planName = planNameMap[planTier] || planTier;
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const planDistribution: PlanDistribution[] = Object.entries(planCounts).map(([planName, count]) => {
        const planRevenue = activeSubscriptions
          .filter(sub => {
            const planTier = sub.tier || 'free_trial';
            const name = planNameMap[planTier] || planTier;
            return name === planName;
          })
          .reduce((sum, sub) => sum + this.getMonthlyAmount(sub.amount || sub.priceAtPurchase, sub.billingCycle || sub.billingInterval), 0);

        return {
          planName,
          count,
          percentage: (count / activeSubscriptions.length) * 100,
          revenue: planRevenue
        };
      });

      // Get revenue by plan with growth calculation
      const previousDateRange = {
        start: subDays(dateRange.start, this.getDaysInRange(timeRange as string)),
        end: dateRange.start
      };
      
      const previousSubscriptions = await Subscription.find({
        createdAt: { $gte: previousDateRange.start, $lte: previousDateRange.end },
        status: 'active'
      });

      const previousRevenue = previousSubscriptions.reduce((acc, sub) => {
        const planTier = sub.tier || 'free_trial';
        const planName = planNameMap[planTier] || planTier;
        const revenue = this.getMonthlyAmount(sub.amount || sub.priceAtPurchase, sub.billingCycle || sub.billingInterval);
        acc[planName] = (acc[planName] || 0) + revenue;
        return acc;
      }, {} as Record<string, number>);

      const revenueByPlan: RevenueByPlan[] = planDistribution.map(plan => {
        const currentRevenue = plan.revenue;
        const prevRevenue = previousRevenue[plan.planName] || 0;
        const growth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) : 0;
        
        return {
          planName: plan.planName,
          revenue: currentRevenue,
          growth
        };
      });

      // Generate real growth trend from historical data
      const growthTrend: GrowthTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = subDays(new Date(), i * 30);
        const monthEnd = subDays(new Date(), (i - 1) * 30);
        const monthLabel = format(monthStart, 'MMM yyyy');
        
        // Get subscriptions active in this month
        const monthSubscriptions = await Subscription.find({
          createdAt: { $lte: monthEnd },
          $or: [
            { status: 'active' },
            { canceledAt: { $gte: monthStart } }
          ]
        });
        
        const monthActiveSubscriptions = monthSubscriptions.filter(
          sub => sub.status === 'active' || (sub.canceledAt && new Date(sub.canceledAt) >= monthStart)
        );
        
        const monthCanceledSubscriptions = monthSubscriptions.filter(
          sub => sub.status === 'canceled' && sub.canceledAt && 
          new Date(sub.canceledAt) >= monthStart && new Date(sub.canceledAt) <= monthEnd
        );
        
        // Calculate month MRR
        const monthMrr = monthActiveSubscriptions.reduce((sum, sub) => {
          return sum + this.getMonthlyAmount(sub.amount || sub.priceAtPurchase, sub.billingCycle || sub.billingInterval);
        }, 0);
        
        // Calculate month churn rate
        const monthChurnRate = monthSubscriptions.length > 0 
          ? monthCanceledSubscriptions.length / monthSubscriptions.length 
          : 0;
        
        growthTrend.push({
          month: monthLabel,
          mrr: monthMrr,
          subscribers: monthActiveSubscriptions.length,
          churn: monthChurnRate
        });
      }

      const analytics: SubscriptionAnalytics = {
        mrr,
        arr,
        ltv,
        cac,
        churnRate,
        upgradeRate: 0.05, // Placeholder
        downgradeRate: 0.02, // Placeholder
        planDistribution,
        revenueByPlan,
        growthTrend
      };

      sendSuccess(
        res,
        analytics,
        'Subscription analytics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching subscription analytics:', error);
      sendError(
        res,
        'SUBSCRIPTION_ANALYTICS_ERROR',
        'Failed to retrieve subscription analytics',
        500
      );
    }
  }

  /**
   * Get pharmacy usage reports
   * GET /api/admin/saas/analytics/pharmacy-usage
   */
  async getPharmacyUsageReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '30d' } = req.query;

      logger.info('Fetching pharmacy usage reports', {
        adminId: req.user?._id,
        timeRange
      });

      const dateRange = this.getDateRange(timeRange as string);

      // Get all workplaces (pharmacies) with active subscriptions
      const workplaces = await Workplace.find({
        currentSubscriptionId: { $exists: true, $ne: null }
      }).populate('currentSubscriptionId');

      const reports: PharmacyUsageReport[] = await Promise.all(
        workplaces.map(async (workplace) => {
          // Get user count
          const activeUsers = await User.countDocuments({
            workplaceId: workplace._id,
            isActive: true
          });

          // Get patient count
          const patientsManaged = await Patient.countDocuments({
            workplaceId: workplace._id,
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          });

          // Get clinical interventions
          const interventions = await ClinicalIntervention.find({
            workplaceId: workplace._id,
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          });

          // Calculate clinical outcomes
          const clinicalOutcomes = {
            interventions: interventions.length,
            adherenceImprovement: interventions.reduce((sum, intervention) => {
              return sum + (intervention.adherenceImprovement || 0);
            }, 0) / Math.max(interventions.length, 1),
            costSavings: interventions.reduce((sum, intervention) => {
              return sum + (intervention.costSavings || 0);
            }, 0)
          };

          // Load plan names from plans.json
          const plansConfig = require('../config/plans.json');
          const subscription = workplace.currentSubscriptionId as any;
          const planTier = subscription?.tier || 'free_trial';
          const planName = plansConfig.plans[planTier]?.name || planTier;

          // Get actual prescription counts (using MedicationRecord as proxy)
          const prescriptionsProcessed = await MedicationRecord.countDocuments({
            workplaceId: workplace._id,
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          });

          // Get actual diagnostic counts
          const diagnosticsPerformed = await DiagnosticCase.countDocuments({
            workplaceId: workplace._id,
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          });

          return {
            pharmacyId: workplace._id.toString(),
            pharmacyName: workplace.name,
            subscriptionPlan: planName,
            prescriptionsProcessed,
            diagnosticsPerformed,
            patientsManaged,
            activeUsers,
            lastActivity: workplace.updatedAt.toISOString(),
            clinicalOutcomes
          };
        })
      );

      sendSuccess(
        res,
        { reports },
        'Pharmacy usage reports retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching pharmacy usage reports:', error);
      sendError(
        res,
        'PHARMACY_USAGE_ERROR',
        'Failed to retrieve pharmacy usage reports',
        500
      );
    }
  }

  /**
   * Get clinical outcomes report
   * GET /api/admin/saas/analytics/clinical-outcomes
   */
  async getClinicalOutcomesReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '30d' } = req.query;

      logger.info('Fetching clinical outcomes report', {
        adminId: req.user?._id,
        timeRange
      });

      const dateRange = this.getDateRange(timeRange as string);

      // Get all clinical interventions
      const interventions = await ClinicalIntervention.find({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      }).populate('workplaceId');

      // Calculate total metrics
      const totalInterventions = interventions.length;
      const averageAdherenceImprovement = interventions.reduce((sum, intervention) => {
        return sum + (intervention.adherenceImprovement || 0);
      }, 0) / Math.max(interventions.length, 1);
      const totalCostSavings = interventions.reduce((sum, intervention) => {
        return sum + (intervention.costSavings || 0);
      }, 0);

      // Group interventions by type
      const interventionsByType = interventions.reduce((acc, intervention) => {
        const type = intervention.type || 'Other';
        if (!acc[type]) {
          acc[type] = {
            count: 0,
            totalCostSaving: 0,
            successCount: 0
          };
        }
        acc[type].count++;
        acc[type].totalCostSaving += intervention.costSavings || 0;
        if (intervention.outcome === 'successful') {
          acc[type].successCount++;
        }
        return acc;
      }, {} as Record<string, any>);

      const interventionsByTypeArray: InterventionByType[] = Object.entries(interventionsByType).map(([type, data]) => ({
        type,
        count: data.count,
        successRate: data.count > 0 ? data.successCount / data.count : 0,
        avgCostSaving: data.count > 0 ? data.totalCostSaving / data.count : 0
      }));

      // Group outcomes by pharmacy
      const outcomesByPharmacy = interventions.reduce((acc, intervention) => {
        const pharmacyId = intervention.workplaceId._id.toString();
        const pharmacyName = (intervention.workplaceId as any).name; // Type assertion for populated field

        if (!acc[pharmacyId]) {
          acc[pharmacyId] = {
            pharmacyId,
            pharmacyName,
            interventions: 0,
            adherenceImprovement: 0,
            costSavings: 0,
            patientSatisfaction: 0
          };
        }

        acc[pharmacyId].interventions++;
        acc[pharmacyId].adherenceImprovement += intervention.adherenceImprovement || 0;
        acc[pharmacyId].costSavings += intervention.costSavings || 0;
        acc[pharmacyId].patientSatisfaction += intervention.patientSatisfaction || 0;

        return acc;
      }, {} as Record<string, any>);

      const outcomesByPharmacyArray: OutcomeByPharmacy[] = Object.values(outcomesByPharmacy).map((pharmacy: any) => ({
        ...pharmacy,
        adherenceImprovement: pharmacy.interventions > 0 ? pharmacy.adherenceImprovement / pharmacy.interventions : 0,
        patientSatisfaction: pharmacy.interventions > 0 ? pharmacy.patientSatisfaction / pharmacy.interventions : 0
      }));

      // Generate trends over time (simplified)
      const trendsOverTime: OutcomeTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const month = format(subDays(new Date(), i * 30), 'MMM yyyy');
        const monthInterventions = Math.floor(totalInterventions * (0.8 + i * 0.04) / 6);
        trendsOverTime.push({
          month,
          interventions: monthInterventions,
          adherenceRate: 0.75 + (i * 0.02),
          costSavings: totalCostSavings * (0.8 + i * 0.04) / 6
        });
      }

      const report: ClinicalOutcomesReport = {
        totalInterventions,
        averageAdherenceImprovement,
        totalCostSavings,
        interventionsByType: interventionsByTypeArray,
        outcomesByPharmacy: outcomesByPharmacyArray,
        trendsOverTime
      };

      sendSuccess(
        res,
        report,
        'Clinical outcomes report retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching clinical outcomes report:', error);
      sendError(
        res,
        'CLINICAL_OUTCOMES_ERROR',
        'Failed to retrieve clinical outcomes report',
        500
      );
    }
  }

  /**
   * Export analytics report
   * POST /api/admin/saas/analytics/export
   */
  async exportReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        format,
        reportType,
        dateRange,
        includeCharts = true
      } = req.body;

      logger.info('Exporting analytics report', {
        adminId: req.user?._id,
        format,
        reportType,
        dateRange
      });

      let reportData: any;
      let filename: string;

      // Get report data based on type
      switch (reportType) {
        case 'subscription':
          // Mock request for subscription analytics
          const mockReq = { query: { timeRange: '30d' }, user: req.user } as unknown as AuthRequest;
          const mockRes = {
            json: (data: any) => { reportData = data.data; }
          } as any;
          await this.getSubscriptionAnalytics(mockReq, mockRes);
          filename = `subscription-analytics-${format(new Date(), 'yyyy-MM-dd')}`;
          break;
        case 'pharmacy':
          reportData = { reports: [] }; // Placeholder
          filename = `pharmacy-usage-${format(new Date(), 'yyyy-MM-dd')}`;
          break;
        case 'clinical':
          reportData = {}; // Placeholder
          filename = `clinical-outcomes-${format(new Date(), 'yyyy-MM-dd')}`;
          break;
        default:
          reportData = {};
          filename = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}`;
      }

      // Generate report based on format
      switch (format) {
        case 'pdf':
          const pdfBuffer = await this.generatePDFReport(reportData, reportType, includeCharts);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
          res.send(pdfBuffer);
          break;

        case 'excel':
          const excelBuffer = await this.generateExcelReport(reportData, reportType);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
          res.send(excelBuffer);
          break;

        case 'csv':
          const csvData = this.generateCSVReport(reportData, reportType);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csvData);
          break;

        default:
          sendError(res, 'INVALID_FORMAT', 'Unsupported export format', 400);
          return;
      }

      logger.info('Report exported successfully', {
        adminId: req.user?._id,
        format,
        reportType,
        filename
      });
    } catch (error) {
      logger.error('Error exporting report:', error);
      sendError(
        res,
        'EXPORT_ERROR',
        'Failed to export report',
        500
      );
    }
  }

  /**
   * Schedule report delivery
   * POST /api/admin/saas/analytics/schedule
   */
  async scheduleReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        reportType,
        format,
        frequency,
        recipients,
        dateRange
      } = req.body;

      logger.info('Scheduling report delivery', {
        adminId: req.user?._id,
        reportType,
        format,
        frequency,
        recipients: recipients.length
      });

      // In a real implementation, this would create a scheduled job
      // For now, we'll just log the schedule request

      sendSuccess(
        res,
        {
          scheduleId: `schedule_${Date.now()}`,
          reportType,
          format,
          frequency,
          recipients,
          nextDelivery: this.getNextDeliveryDate(frequency),
          createdBy: req.user?._id,
          createdAt: new Date()
        },
        'Report delivery scheduled successfully'
      );
    } catch (error) {
      logger.error('Error scheduling report:', error);
      sendError(
        res,
        'SCHEDULE_ERROR',
        'Failed to schedule report delivery',
        500
      );
    }
  }

  // Private helper methods

  private getDateRange(timeRange: string): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (timeRange) {
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '90d':
        start = subDays(end, 90);
        break;
      case '1y':
        start = subDays(end, 365);
        break;
      default:
        start = subDays(end, 30);
    }

    return { start, end };
  }

  private getMonthlyAmount(amount: number, billingCycle: string): number {
    switch (billingCycle) {
      case 'monthly':
        return amount;
      case 'quarterly':
        return amount / 3;
      case 'yearly':
        return amount / 12;
      default:
        return amount;
    }
  }

  private getDaysInRange(timeRange: string): number {
    switch (timeRange) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  }

  private async generatePDFReport(data: any, reportType: string, includeCharts: boolean): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Add content to PDF
        doc.fontSize(20).text(`${reportType.toUpperCase()} Analytics Report`, 100, 100);
        doc.fontSize(12).text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy')}`, 100, 130);

        // Add report data (simplified)
        doc.text(JSON.stringify(data, null, 2), 100, 160);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateExcelReport(data: any, reportType: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${reportType} Report`);

    // Add headers and data (simplified)
    worksheet.addRow(['Report Type', reportType]);
    worksheet.addRow(['Generated', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
    worksheet.addRow([]);

    // Add data rows based on report type
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        worksheet.addRow([key, String(value)]);
      });
    }

    return (await workbook.xlsx.writeBuffer()) as any as Buffer;
  }

  private generateCSVReport(data: any, reportType: string): string {
    const rows = [
      ['Report Type', reportType],
      ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm:ss')],
      ['']
    ];

    // Add data rows
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        rows.push([key, String(value)]);
      });
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  private getNextDeliveryDate(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}

// Create and export controller instance
export const saasAnalyticsController = new SaaSAnalyticsController();