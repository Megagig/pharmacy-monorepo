import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import models
import ClinicalIntervention, {
  IClinicalIntervention,
  IInterventionStrategy,
  ITeamAssignment,
  IInterventionOutcome,
} from '../models/ClinicalIntervention';
import Patient from '../models/Patient';
import User from '../models/User';

// Import audit service
import { AuditService } from './auditService';
export interface AuditContext {
  userId: string;
  workspaceId: string;
  sessionId?: string;
}
export interface AuditLogData {
  action: string;
  userId: string;
  interventionId?: string;
  details: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: string;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  workspaceId?: string;
}

// Import performance optimization utilities
import {
  CacheManager,
  PerformanceMonitor,
  QueryOptimizer,
} from '../utils/performanceOptimization';
import { OptimizedQueryBuilder } from '../utils/databaseOptimization';
import performanceCollector from '../utils/performanceMonitoring';

// Import utilities
import {
  PatientManagementError,
  createValidationError,
  createBusinessRuleError,
  createNotFoundError,
} from '../utils/responseHelpers';

/**
 * Clinical Intervention Service Layer
 * Handles business logic for Clinical Interventions workflow
 */

// ===============================
// INTERFACES AND TYPES
// ===============================

export interface CreateInterventionDTO {
  patientId: mongoose.Types.ObjectId;
  category: string;
  priority: string;
  issueDescription: string;
  identifiedBy: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  strategies?: IInterventionStrategy[];
  estimatedDuration?: number;
  relatedMTRId?: mongoose.Types.ObjectId;
  relatedDTPIds?: mongoose.Types.ObjectId[];
}

export interface UpdateInterventionDTO {
  category?: string;
  priority?: string;
  issueDescription?: string;
  status?: string;
  implementationNotes?: string;
  estimatedDuration?: number;
  outcomes?: IInterventionOutcome;
  followUp?: {
    required?: boolean;
    scheduledDate?: Date;
    notes?: string;
    nextReviewDate?: Date;
  };
}

export interface InterventionFilters {
  workplaceId: mongoose.Types.ObjectId;
  patientId?: mongoose.Types.ObjectId;
  category?: string;
  priority?: string;
  status?: string;
  identifiedBy?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isSuperAdmin?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface StrategyRecommendation {
  type: string;
  label: string;
  description: string;
  rationale: string;
  expectedOutcome: string;
  priority: 'primary' | 'secondary';
  applicableCategories: string[];
}

export interface OutcomeMetrics {
  totalInterventions: number;
  completedInterventions: number;
  successRate: number;
  averageDuration: number;
  costSavings: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

export interface DashboardMetrics {
  totalInterventions: number;
  activeInterventions: number;
  completedInterventions: number;
  overdueInterventions: number;
  successRate: number;
  averageResolutionTime: number;
  totalCostSavings: number;
  categoryDistribution: Array<{
    name: string;
    value: number;
    successRate: number;
    color: string;
  }>;
  priorityDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    total: number;
    completed: number;
    successRate: number;
  }>;
  recentInterventions: Array<{
    _id: string;
    interventionNumber: string;
    category: string;
    priority: string;
    status: string;
    patientName: string;
    identifiedDate: string;
    assignedTo?: string;
  }>;
}

// ===============================
// CLINICAL INTERVENTION SERVICE
// ===============================

class ClinicalInterventionService {
  // Strategy recommendation methods (added by StrategyRecommendationEngine)
  static getRecommendedStrategies: (
    category: string
  ) => StrategyRecommendation[];
  static getAllStrategies: () => StrategyRecommendation[];
  static getStrategiesForCategories: (
    categories: string[]
  ) => StrategyRecommendation[];
  static validateCustomStrategy: (strategy: Partial<IInterventionStrategy>) => {
    isValid: boolean;
    errors: string[];
  };
  static generateRecommendations: (
    category: string,
    priority: string,
    issueDescription: string,
    patientFactors?: any
  ) => StrategyRecommendation[];
  static getStrategyByType: (type: string) => StrategyRecommendation | null;

  // Team collaboration methods (added by TeamCollaborationService)
  static assignTeamMember: (
    interventionId: string,
    assignment: Omit<ITeamAssignment, 'assignedAt'>,
    assignedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;
  static updateAssignmentStatus: (
    interventionId: string,
    assignmentUserId: mongoose.Types.ObjectId,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    notes: string | undefined,
    updatedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;
  static getUserAssignments: (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    status?: string[]
  ) => Promise<IClinicalIntervention[]>;
  static getAssignmentHistory: (
    interventionId: string,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<{ assignments: ITeamAssignment[]; auditTrail: any[] }>;
  static removeAssignment: (
    interventionId: string,
    assignmentUserId: mongoose.Types.ObjectId,
    removedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    reason?: string
  ) => Promise<IClinicalIntervention>;
  static getTeamWorkloadStats: (
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: { from: Date; to: Date }
  ) => Promise<{
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    userWorkloads: Array<{
      userId: mongoose.Types.ObjectId;
      userName: string;
      activeAssignments: number;
      completedAssignments: number;
      averageCompletionTime: number;
    }>;
  }>;

  // Outcome and cost analysis methods
  static generateOutcomeReport: (
    workplaceId: mongoose.Types.ObjectId,
    filters: {
      dateFrom?: Date;
      dateTo?: Date;
      category?: string;
      priority?: string;
      outcome?: string;
      pharmacist?: string;
    },
    isSuperAdmin?: boolean
  ) => Promise<any>;

  static calculateCostSavings: (
    interventions: IClinicalIntervention[],
    parameters: {
      adverseEventCost?: number;
    }
  ) => Promise<any>;

  // Strategy management methods
  static addStrategy: (
    interventionId: string,
    strategy: any,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;

  static updateStrategy: (
    interventionId: string,
    strategyId: string,
    updates: any,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;

  // Outcome management methods
  static recordOutcome: (
    interventionId: string,
    outcome: any,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;

  static scheduleFollowUp: (
    interventionId: string,
    followUpData: any,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<IClinicalIntervention>;

  // Search and analytics methods
  static advancedSearch: (filters: any, options: any) => Promise<any>;

  static getUserAssignmentStats: (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: any
  ) => Promise<any>;

  static getDashboardMetrics: (
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: any,
    isSuperAdmin?: boolean
  ) => Promise<any>;

  static getTrendAnalysis: (
    workplaceId: mongoose.Types.ObjectId,
    filters: any
  ) => Promise<any>;

  // Export and notification methods
  static exportData: (filters: any, format: string) => Promise<any>;

  static sendNotifications: (
    interventionId: string,
    notificationData: any,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ) => Promise<any>;

  /**
   * Create a new clinical intervention
   */
  static async createIntervention(
    data: CreateInterventionDTO
  ): Promise<IClinicalIntervention> {
    try {
      // Validate patient exists
      const patient = await Patient.findById(data.patientId);
      if (!patient) {
        throw createNotFoundError('Patient not found');
      }

      // For super_admin, skip workplace validation
      const isSuperAdmin = process.env.NODE_ENV === 'development' || 
                          (data as any).isSuperAdmin;
      if (!isSuperAdmin && patient.workplaceId.toString() !== data.workplaceId.toString()) {
        throw createNotFoundError('Patient not found in your workplace');
      }

      // Validate user exists (skip for super_admin test mode in development)
      const user = await User.findById(data.identifiedBy);
      if (!user) {
        // Check if this is a super_admin test mode ObjectId (development only)
        const isTestMode = process.env.NODE_ENV === 'development' && 
                          data.identifiedBy.toString().match(/^[0-9a-fA-F]{24}$/);
        
        if (!isTestMode) {
          throw createNotFoundError('User not found');
        }
        
        // For test mode, we'll continue without the user validation
        console.log('🔧 DEV MODE: Skipping user validation for super_admin test');
      }

      // Generate intervention number
      const interventionNumber =
        await ClinicalIntervention.generateNextInterventionNumber(
          data.workplaceId
        );

      // Check for duplicate interventions
      const duplicates = await this.checkDuplicateInterventions(
        data.patientId,
        data.category,
        data.workplaceId
      );

      // Create intervention
      const intervention = new ClinicalIntervention({
        ...data,
        interventionNumber,
        identifiedDate: new Date(),
        startedAt: new Date(),
        status: 'identified',
        followUp: {
          required: false,
        },
        relatedDTPIds: data.relatedDTPIds || [],
        createdBy: data.identifiedBy,
      });

      // Add strategies if provided
      if (data.strategies && data.strategies.length > 0) {
        data.strategies.forEach((strategy) => {
          intervention.addStrategy(strategy);
        });
      }

      await intervention.save();

      // Update patient intervention flags
      await this.updatePatientInterventionFlags(
        data.patientId,
        data.workplaceId
      );

      // Log activity with audit trail
      await ClinicalInterventionService.logActivity(
        'CREATE_INTERVENTION',
        intervention._id.toString(),
        data.identifiedBy,
        data.workplaceId,
        {
          category: data.category,
          priority: data.priority,
          duplicatesFound: duplicates.length,
          patientId: data.patientId.toString(),
        },
        undefined, // req object not available in service
        undefined, // no old values for creation
        intervention.toObject() // new values
      );

      return intervention;
    } catch (error) {
      logger.error('Error creating clinical intervention:', error);
      throw error;
    }
  }

  /**
   * Update an existing clinical intervention
   */
  static async updateIntervention(
    id: string,
    updates: UpdateInterventionDTO,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    isSuperAdmin: boolean = false
  ): Promise<IClinicalIntervention> {
    try {
      const query: any = {
        _id: id,
        isDeleted: { $ne: true },
      };

      // Add workplaceId filter only if not super_admin
      if (!isSuperAdmin) {
        query.workplaceId = workplaceId;
      }

      const intervention = await ClinicalIntervention.findOne(query);

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Store old values for audit trail
      const oldValues = intervention.toObject();

      // Validate status transitions
      if (
        updates.status &&
        !this.isValidStatusTransition(intervention.status, updates.status)
      ) {
        throw createBusinessRuleError(
          `Invalid status transition from ${intervention.status} to ${updates.status}`
        );
      }

      // Apply updates
      Object.assign(intervention, updates);
      intervention.updatedBy = userId;

      // Handle status-specific logic
      if (updates.status) {
        switch (updates.status) {
          case 'completed':
            if (!intervention.outcomes?.patientResponse) {
              throw createBusinessRuleError(
                'Patient response outcome is required to complete intervention'
              );
            }
            intervention.completedAt = new Date();
            break;
          case 'cancelled':
            intervention.completedAt = new Date();
            break;
        }
      }

      await intervention.save();

      // Update patient intervention flags if status changed
      if (updates.status) {
        await this.updatePatientInterventionFlags(
          intervention.patientId,
          workplaceId
        );
      }

      // Log activity with audit trail
      await ClinicalInterventionService.logActivity(
        'UPDATE_INTERVENTION',
        intervention._id.toString(),
        userId,
        workplaceId,
        {
          updates: Object.keys(updates),
          statusChange:
            oldValues.status !== intervention.status
              ? {
                from: oldValues.status,
                to: intervention.status,
              }
              : undefined,
        },
        undefined, // req object not available in service
        oldValues,
        intervention.toObject()
      );

      return intervention;
    } catch (error) {
      logger.error('Error updating clinical intervention:', error);
      throw error;
    }
  }

  /**
   * Get interventions with filtering and pagination (optimized)
   */
  static async getInterventions(
    filters: InterventionFilters
  ): Promise<PaginatedResult<IClinicalIntervention>> {
    return await PerformanceMonitor.trackOperation(
      'getInterventions',
      async () => {
        const {
          workplaceId,
          page = 1,
          limit = 20,
          sortBy = 'identifiedDate',
          sortOrder = 'desc',
        } = filters;

        // Generate cache key
        const cacheKey = CacheManager.generateKey(
          'interventions_list',
          JSON.stringify(filters),
          workplaceId.toString()
        );

        // Try to get from cache first
        const cached = await CacheManager.get<
          PaginatedResult<IClinicalIntervention>
        >(cacheKey);
        if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
          performanceCollector.recordInterventionMetrics(
            'getInterventions',
            filters.workplaceId.toString(),
            0, // Cache hit - no DB time
            true,
            { source: 'cache', filters }
          );
          return cached as any;
        }

        const startTime = Date.now();

        try {
          // Use optimized aggregation pipeline
          const pipeline =
            OptimizedQueryBuilder.buildInterventionListQuery(filters);

          // Add sorting
          const sortOptions: any = {};
          sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
          pipeline.push({ $sort: sortOptions });

          // Add pagination
          const skip = (page - 1) * limit;
          pipeline.push({ $skip: skip });
          pipeline.push({ $limit: limit });

          // Execute aggregation with count
          const [results, countResult] = await Promise.all([
            ClinicalIntervention.aggregate(pipeline),
            ClinicalIntervention.aggregate([
              ...OptimizedQueryBuilder.buildInterventionListQuery(
                filters
              ).slice(0, -1), // Remove projection
              { $count: 'total' },
            ]),
          ]);

          const total = countResult[0]?.total || 0;
          const pages = Math.ceil(total / limit);

          const result: PaginatedResult<IClinicalIntervention> = {
            data: results as IClinicalIntervention[],
            pagination: {
              page,
              limit,
              total,
              pages,
              hasNext: page < pages,
              hasPrev: page > 1,
            },
          };

          // Cache the result for 5 minutes
          await CacheManager.set(cacheKey, result, { ttl: 300 });

          const duration = Date.now() - startTime;
          performanceCollector.recordInterventionMetrics(
            'getInterventions',
            filters.workplaceId.toString(),
            duration,
            true,
            {
              source: 'database',
              filters,
              resultCount: results.length,
              totalCount: total,
            }
          );

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          performanceCollector.recordInterventionMetrics(
            'getInterventions',
            filters.workplaceId.toString(),
            duration,
            false,
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              filters,
            }
          );
          throw error;
        }
      },
      { workplaceId: filters.workplaceId.toString(), filters }
    );
  }

  /**
   * Get a single intervention by ID
   */
  static async getInterventionById(
    id: string,
    workplaceId: mongoose.Types.ObjectId,
    isSuperAdmin: boolean = false
  ): Promise<IClinicalIntervention> {
    try {
      const query: any = {
        _id: id,
        isDeleted: { $ne: true },
      };

      // Add workplaceId filter only if not super_admin
      if (!isSuperAdmin) {
        query.workplaceId = workplaceId;
      }

      const intervention = await ClinicalIntervention.findOne(query)
        .populate(
          'patientId',
          'firstName lastName dateOfBirth phoneNumber email'
        )
        .populate('identifiedBy', 'firstName lastName email')
        .populate('assignments.userId', 'firstName lastName email role')
        .populate('relatedMTRId', 'reviewNumber status')
        .populate('relatedDTPIds', 'category description');

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      return intervention;
    } catch (error) {
      logger.error('Error getting clinical intervention by ID:', error);
      throw error;
    }
  }

  /**
   * Delete (soft delete) a clinical intervention
   */
  static async deleteIntervention(
    id: string,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    isSuperAdmin: boolean = false
  ): Promise<boolean> {
    try {
      const query: any = {
        _id: id,
        isDeleted: { $ne: true },
      };

      // Add workplaceId filter only if not super_admin
      if (!isSuperAdmin) {
        query.workplaceId = workplaceId;
      }

      const intervention = await ClinicalIntervention.findOne(query);

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Validate deletion rules
      if (intervention.status === 'completed') {
        throw createBusinessRuleError('Cannot delete completed interventions');
      }

      // Soft delete
      intervention.isDeleted = true;
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'DELETE_INTERVENTION',
        intervention._id.toString(),
        userId,
        workplaceId,
        { status: intervention.status }
      );

      return true;
    } catch (error) {
      logger.error('Error deleting clinical intervention:', error);
      throw error;
    }
  }

  /**
   * Generate intervention number in CI-YYYYMM-XXXX format
   */
  static async generateInterventionNumber(
    workplaceId: mongoose.Types.ObjectId
  ): Promise<string> {
    return await ClinicalIntervention.generateNextInterventionNumber(
      workplaceId
    );
  }

  /**
   * Check for duplicate interventions
   */
  static async checkDuplicateInterventions(
    patientId: mongoose.Types.ObjectId,
    category: string,
    workplaceId: mongoose.Types.ObjectId,
    excludeId?: string
  ): Promise<IClinicalIntervention[]> {
    try {
      const query: any = {
        patientId,
        category,
        workplaceId,
        status: {
          $in: ['identified', 'planning', 'in_progress', 'implemented'],
        },
        isDeleted: { $ne: true },
      };

      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      // Look for interventions in the same category within the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query.identifiedDate = { $gte: thirtyDaysAgo };

      const duplicates = await ClinicalIntervention.find(query)
        .populate('identifiedBy', 'firstName lastName')
        .lean();

      return duplicates as IClinicalIntervention[];
    } catch (error) {
      logger.error('Error checking duplicate interventions:', error);
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  private static isValidStatusTransition(
    currentStatus: string,
    newStatus: string
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      identified: ['planning', 'cancelled'],
      planning: ['in_progress', 'cancelled'],
      in_progress: ['implemented', 'cancelled'],
      implemented: ['completed', 'cancelled'],
      completed: [], // No transitions from completed
      cancelled: [], // No transitions from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Update patient intervention flags when intervention status changes
   */
  static async updatePatientInterventionFlags(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (patient) {
        await patient.updateInterventionFlags();
      }
    } catch (error) {
      logger.error('Error updating patient intervention flags:', error);
      // Don't throw error for flag updates
    }
  }

  /**
   * Get patient intervention summary
   */
  static async getPatientInterventionSummary(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    totalInterventions: number;
    activeInterventions: number;
    completedInterventions: number;
    successfulInterventions: number;
    categoryBreakdown: Record<string, number>;
    recentInterventions: IClinicalIntervention[];
  }> {
    try {
      const [
        totalInterventions,
        activeInterventions,
        completedInterventions,
        successfulInterventions,
        categoryStats,
        recentInterventions,
      ] = await Promise.all([
        ClinicalIntervention.countDocuments({
          patientId,
          workplaceId,
          isDeleted: { $ne: true },
        }),
        ClinicalIntervention.countDocuments({
          patientId,
          workplaceId,
          status: {
            $in: ['identified', 'planning', 'in_progress', 'implemented'],
          },
          isDeleted: { $ne: true },
        }),
        ClinicalIntervention.countDocuments({
          patientId,
          workplaceId,
          status: 'completed',
          isDeleted: { $ne: true },
        }),
        ClinicalIntervention.countDocuments({
          patientId,
          workplaceId,
          status: 'completed',
          'outcomes.successMetrics.problemResolved': true,
          isDeleted: { $ne: true },
        }),
        ClinicalIntervention.aggregate([
          {
            $match: {
              patientId,
              workplaceId,
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
            },
          },
        ]),
        ClinicalIntervention.find({
          patientId,
          workplaceId,
          isDeleted: { $ne: true },
        })
          .populate('identifiedBy', 'firstName lastName')
          .sort({ identifiedDate: -1 })
          .limit(5)
          .lean(),
      ]);

      const categoryBreakdown: Record<string, number> = {};
      categoryStats.forEach((stat: any) => {
        categoryBreakdown[stat._id] = stat.count;
      });

      return {
        totalInterventions,
        activeInterventions,
        completedInterventions,
        successfulInterventions,
        categoryBreakdown,
        recentInterventions: recentInterventions as IClinicalIntervention[],
      };
    } catch (error) {
      logger.error('Error getting patient intervention summary:', error);
      throw error;
    }
  }

  /**
   * Search patients with intervention context
   */
  static async searchPatientsWithInterventions(
    searchQuery: string,
    workplaceId: mongoose.Types.ObjectId,
    limit: number = 10
  ): Promise<
    Array<{
      _id: string;
      firstName: string;
      lastName: string;
      mrn: string;
      displayName: string;
      age?: number;
      interventionCount: number;
      activeInterventionCount: number;
      lastInterventionDate?: Date;
    }>
  > {
    try {
      const searchRegex = new RegExp(searchQuery, 'i');

      // Find patients matching search criteria
      const patients = await Patient.find({
        workplaceId,
        isDeleted: { $ne: true },
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { mrn: searchRegex },
        ],
      })
        .select('firstName lastName mrn dob')
        .limit(limit)
        .lean();

      // Get intervention counts for each patient
      const patientsWithInterventions = await Promise.all(
        patients.map(async (patient) => {
          const [interventionCount, activeInterventionCount, lastIntervention] =
            await Promise.all([
              ClinicalIntervention.countDocuments({
                patientId: patient._id,
                workplaceId,
                isDeleted: { $ne: true },
              }),
              ClinicalIntervention.countDocuments({
                patientId: patient._id,
                workplaceId,
                status: {
                  $in: ['identified', 'planning', 'in_progress', 'implemented'],
                },
                isDeleted: { $ne: true },
              }),
              ClinicalIntervention.findOne({
                patientId: patient._id,
                workplaceId,
                isDeleted: { $ne: true },
              })
                .sort({ identifiedDate: -1 })
                .select('identifiedDate')
                .lean(),
            ]);

          return {
            _id: patient._id.toString(),
            firstName: patient.firstName,
            lastName: patient.lastName,
            mrn: patient.mrn,
            displayName: `${patient.firstName} ${patient.lastName}`,
            age: patient.dob
              ? Math.floor(
                (Date.now() - patient.dob.getTime()) /
                (1000 * 60 * 60 * 24 * 365.25)
              )
              : undefined,
            interventionCount,
            activeInterventionCount,
            lastInterventionDate: lastIntervention?.identifiedDate,
          };
        })
      );

      return patientsWithInterventions;
    } catch (error) {
      logger.error('Error searching patients with interventions:', error);
      throw error;
    }
  }

  /**
   * Link intervention to MTR
   */
  static async linkToMTR(
    interventionId: string,
    mtrId: string,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      // Validate intervention exists
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Validate MTR exists
      const MedicationTherapyReview = mongoose.model('MedicationTherapyReview');
      const mtr = await MedicationTherapyReview.findOne({
        _id: mtrId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!mtr) {
        throw createNotFoundError('MTR not found');
      }

      // Validate patient match
      if (intervention.patientId.toString() !== mtr.patientId.toString()) {
        throw createBusinessRuleError(
          'Intervention and MTR must be for the same patient'
        );
      }

      // Link intervention to MTR
      intervention.relatedMTRId = new mongoose.Types.ObjectId(mtrId);
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await this.logActivity(
        'LINK_TO_MTR',
        interventionId,
        userId,
        workplaceId,
        { mtrId, mtrNumber: mtr.reviewNumber }
      );

      return intervention;
    } catch (error) {
      logger.error('Error linking intervention to MTR:', error);
      throw error;
    }
  }

  /**
   * Create intervention from MTR problems
   */
  static async createInterventionFromMTR(
    mtrId: string,
    problemIds: string[],
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    additionalData?: {
      priority?: string;
      estimatedDuration?: number;
    }
  ): Promise<IClinicalIntervention[]> {
    try {
      // Validate MTR exists
      const MedicationTherapyReview = mongoose.model('MedicationTherapyReview');
      const mtr = await MedicationTherapyReview.findOne({
        _id: mtrId,
        workplaceId,
        isDeleted: { $ne: true },
      }).populate('problems');

      if (!mtr) {
        throw createNotFoundError('MTR not found');
      }

      // Validate problems exist and belong to MTR
      const DrugTherapyProblem = mongoose.model('DrugTherapyProblem');
      const problems = await DrugTherapyProblem.find({
        _id: { $in: problemIds },
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (problems.length !== problemIds.length) {
        throw createNotFoundError('One or more problems not found');
      }

      const createdInterventions: IClinicalIntervention[] = [];

      // Create intervention for each problem
      for (const problem of problems) {
        const interventionData = {
          patientId: mtr.patientId,
          category: this.mapDTPCategoryToInterventionCategory(problem.category),
          priority:
            additionalData?.priority ||
            this.determinePriorityFromProblem(problem),
          issueDescription: `MTR-identified issue: ${problem.description}`,
          identifiedBy: userId,
          workplaceId,
          relatedMTRId: new mongoose.Types.ObjectId(mtrId),
          relatedDTPIds: [problem._id],
          estimatedDuration: additionalData?.estimatedDuration,
        };

        const intervention = await this.createIntervention(interventionData);

        // Add recommended strategies based on problem type
        const recommendedStrategies =
          this.getRecommendedStrategiesForDTP(problem);
        for (const strategy of recommendedStrategies) {
          intervention.addStrategy(strategy);
        }

        await intervention.save();
        createdInterventions.push(intervention);
      }

      // Log activity
      await this.logActivity(
        'CREATE_INTERVENTIONS_FROM_MTR',
        mtrId,
        userId,
        workplaceId,
        {
          problemIds,
          interventionIds: createdInterventions.map((i) => i._id.toString()),
          mtrNumber: mtr.reviewNumber,
        }
      );

      return createdInterventions;
    } catch (error) {
      logger.error('Error creating interventions from MTR:', error);
      throw error;
    }
  }

  /**
   * Get MTR reference display data
   */
  static async getMTRReferenceData(
    mtrId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    _id: string;
    reviewNumber: string;
    status: string;
    priority: string;
    startedAt: Date;
    completedAt?: Date;
    patientName: string;
    pharmacistName: string;
    problemCount: number;
    interventionCount: number;
  } | null> {
    try {
      const MedicationTherapyReview = mongoose.model('MedicationTherapyReview');

      const mtr = await MedicationTherapyReview.findOne({
        _id: mtrId,
        workplaceId,
        isDeleted: { $ne: true },
      })
        .populate('patientId', 'firstName lastName')
        .populate('pharmacistId', 'firstName lastName')
        .lean();

      if (!mtr) {
        return null;
      }

      // Get intervention count for this MTR
      const interventionCount = await ClinicalIntervention.countDocuments({
        relatedMTRId: mtrId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      // Handle both array and single object results from aggregation
      const mtrData = Array.isArray(mtr) ? mtr[0] : mtr;

      if (!mtrData) {
        throw createNotFoundError('MTR not found');
      }

      return {
        _id: (mtrData._id as mongoose.Types.ObjectId).toString(),
        reviewNumber: mtrData.reviewNumber,
        status: mtrData.status,
        priority: mtrData.priority,
        startedAt: mtrData.startedAt,
        completedAt: mtrData.completedAt,
        patientName: `${mtrData.patientId?.firstName || ''} ${mtrData.patientId?.lastName || ''
          }`,
        pharmacistName: `${mtrData.pharmacistId?.firstName || ''} ${mtrData.pharmacistId?.lastName || ''
          }`,
        problemCount: mtrData.problems?.length || 0,
        interventionCount,
      };
    } catch (error) {
      logger.error('Error getting MTR reference data:', error);
      return null;
    }
  }

  /**
   * Get interventions linked to MTR
   */
  static async getInterventionsForMTR(
    mtrId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention[]> {
    try {
      const interventions = await ClinicalIntervention.find({
        relatedMTRId: mtrId,
        workplaceId,
        isDeleted: { $ne: true },
      })
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName')
        .sort({ identifiedDate: -1 })
        .lean();

      return interventions as IClinicalIntervention[];
    } catch (error) {
      logger.error('Error getting interventions for MTR:', error);
      throw error;
    }
  }

  /**
   * Ensure data consistency between interventions and MTR
   */
  static async syncWithMTR(
    interventionId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention || !intervention.relatedMTRId) {
        return; // No MTR to sync with
      }

      const MedicationTherapyReview = mongoose.model('MedicationTherapyReview');
      const mtr = await MedicationTherapyReview.findById(
        intervention.relatedMTRId
      );

      if (!mtr) {
        // MTR no longer exists, remove reference
        intervention.relatedMTRId = undefined;
        await intervention.save();
        return;
      }

      // Ensure patient consistency
      if (intervention.patientId.toString() !== mtr.patientId.toString()) {
        logger.warn('Patient mismatch between intervention and MTR', {
          interventionId,
          mtrId: mtr._id.toString(),
          interventionPatient: intervention.patientId.toString(),
          mtrPatient: mtr.patientId.toString(),
        });
      }

      // Update MTR with intervention outcomes if intervention is completed
      if (intervention.status === 'completed' && intervention.outcomes) {
        // This could trigger MTR outcome updates
        await this.updateMTRFromInterventionOutcome(intervention, mtr);
      }
    } catch (error) {
      logger.error('Error syncing intervention with MTR:', error);
      // Don't throw error for sync operations
    }
  }

  /**
   * Helper methods for MTR integration
   */
  private static mapDTPCategoryToInterventionCategory(
    dtpCategory: string
  ): string {
    const categoryMap: Record<string, string> = {
      untreated_indication: 'drug_therapy_problem',
      improper_drug_selection: 'drug_therapy_problem',
      subtherapeutic_dosage: 'dosing_issue',
      failure_to_receive_drug: 'medication_nonadherence',
      overdosage: 'dosing_issue',
      adverse_drug_reaction: 'adverse_drug_reaction',
      drug_interaction: 'drug_interaction',
      drug_use_without_indication: 'drug_therapy_problem',
    };

    return categoryMap[dtpCategory] || 'other';
  }

  private static determinePriorityFromProblem(problem: any): string {
    // Determine priority based on problem severity and type
    if (
      problem.severity === 'critical' ||
      problem.category === 'adverse_drug_reaction'
    ) {
      return 'critical';
    }
    if (
      problem.severity === 'major' ||
      problem.category === 'drug_interaction'
    ) {
      return 'high';
    }
    if (problem.severity === 'moderate') {
      return 'medium';
    }
    return 'low';
  }

  private static getRecommendedStrategiesForDTP(problem: any): any[] {
    // Get recommended strategies based on DTP type
    const strategies: any[] = [];

    switch (problem.category) {
      case 'adverse_drug_reaction':
        strategies.push({
          type: 'discontinuation',
          description: 'Consider discontinuing the offending medication',
          rationale: 'Eliminate source of adverse drug reaction',
          expectedOutcome: 'Resolution of adverse effects',
          priority: 'primary',
        });
        break;
      case 'drug_interaction':
        strategies.push({
          type: 'medication_review',
          description: 'Review all medications for interactions',
          rationale: 'Identify and manage drug interactions',
          expectedOutcome: 'Elimination of harmful interactions',
          priority: 'primary',
        });
        break;
      case 'subtherapeutic_dosage':
      case 'overdosage':
        strategies.push({
          type: 'dose_adjustment',
          description: 'Adjust medication dosage',
          rationale: 'Optimize therapeutic effect',
          expectedOutcome: 'Improved clinical response',
          priority: 'primary',
        });
        break;
      default:
        strategies.push({
          type: 'medication_review',
          description: 'Comprehensive medication review',
          rationale: 'Address identified drug therapy problem',
          expectedOutcome: 'Optimized medication therapy',
          priority: 'primary',
        });
    }

    return strategies;
  }

  private static async updateMTRFromInterventionOutcome(
    intervention: IClinicalIntervention,
    mtr: any
  ): Promise<void> {
    try {
      // Update MTR clinical outcomes based on intervention results
      if (intervention.outcomes?.successMetrics.problemResolved) {
        mtr.clinicalOutcomes.problemsResolved += 1;
      }
      if (intervention.outcomes?.successMetrics.medicationOptimized) {
        mtr.clinicalOutcomes.medicationsOptimized += 1;
      }
      if (intervention.outcomes?.successMetrics.adherenceImproved) {
        mtr.clinicalOutcomes.adherenceImproved = true;
      }
      if (intervention.outcomes?.successMetrics.costSavings) {
        mtr.clinicalOutcomes.costSavings =
          (mtr.clinicalOutcomes.costSavings || 0) +
          intervention.outcomes.successMetrics.costSavings;
      }

      await mtr.save();
    } catch (error) {
      logger.error('Error updating MTR from intervention outcome:', error);
    }
  }

  /**
   * Log activity for comprehensive audit trail
   */
  static async logActivity(
    action: string,
    interventionId: string,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    details: any,
    req?: any,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    try {
      // Create audit context
      const auditContext: AuditContext = {
        userId: userId.toString(),
        workspaceId: workplaceId.toString(),
        sessionId: req?.sessionID,
      };

      // Create audit log data
      const auditData: AuditLogData = {
        action: `INTERVENTION_${action.toUpperCase()}`,
        userId: userId.toString(),
        interventionId: interventionId,
        oldValues,
        newValues,
        changedFields:
          oldValues && newValues
            ? this.getChangedFields(oldValues, newValues)
            : undefined,
        details: {
          ...details,
          service: 'clinical-intervention',
          timestamp: new Date(),
        },
        complianceCategory: 'clinical_documentation',
        riskLevel: this.determineRiskLevel(action, details),
      };

      // Log to audit service
      await AuditService.logActivity(auditContext, auditData);

      // Also log to winston for file storage
      logger.info('Clinical Intervention Activity', {
        action,
        interventionId,
        userId: userId.toString(),
        workplaceId: workplaceId.toString(),
        details,
        timestamp: new Date(),
        service: 'clinical-intervention',
      });
    } catch (error) {
      logger.error('Error logging clinical intervention activity:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Log intervention access for compliance
   */
  static async logInterventionAccess(
    interventionId: string,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    accessType: 'view' | 'edit' | 'create' | 'delete',
    req?: any,
    details: any = {}
  ): Promise<void> {
    try {
      const auditContext: AuditContext = {
        userId: userId.toString(),
        workspaceId: workplaceId.toString(),
        sessionId: req?.sessionID,
      };

      const auditData: AuditLogData = {
        action: `ACCESS_INTERVENTION_${accessType.toUpperCase()}`,
        userId: userId.toString(),
        interventionId: interventionId,
        details: {
          accessType,
          ...details,
        },
        complianceCategory: 'data_access',
        riskLevel: accessType === 'delete' ? 'high' : 'medium',
      };

      await AuditService.logActivity(auditContext, auditData);
    } catch (error) {
      logger.error('Error logging intervention access:', error);
    }
  }

  /**
   * Get intervention audit trail
   */
  static async getInterventionAuditTrail(
    interventionId: string,
    workplaceId: mongoose.Types.ObjectId,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    logs: any[];
    total: number;
    summary: {
      totalActions: number;
      uniqueUsers: number;
      lastActivity: Date | null;
      riskActivities: number;
    };
  }> {
    try {
      const filters = {
        resourceId: new mongoose.Types.ObjectId(interventionId),
        startDate: options.startDate,
        endDate: options.endDate,
      };

      const { logs, total } = await AuditService.getAuditLogs({
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        page: options.page || 1,
        limit: options.limit || 50,
      });

      // Calculate summary statistics
      const uniqueUsers = new Set(
        logs.map((log) => log.userId?.toString()).filter(Boolean)
      ).size;
      const lastActivity = logs.length > 0 ? logs[0]?.timestamp : null;
      const riskActivities = logs.filter(
        (log) => log.riskLevel === 'high' || log.riskLevel === 'critical'
      ).length;

      return {
        logs,
        total,
        summary: {
          totalActions: total,
          uniqueUsers,
          lastActivity: lastActivity || null,
          riskActivities,
        },
      };
    } catch (error) {
      logger.error('Error getting intervention audit trail:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report for interventions
   */
  static async generateComplianceReport(
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { start: Date; end: Date },
    options: {
      includeDetails?: boolean;
      interventionIds?: string[];
    } = {}
  ): Promise<{
    summary: {
      totalInterventions: number;
      auditedActions: number;
      complianceScore: number;
      riskActivities: number;
    };
    interventionCompliance: Array<{
      interventionId: string;
      interventionNumber: string;
      auditCount: number;
      lastAudit: Date;
      complianceStatus: 'compliant' | 'warning' | 'non-compliant';
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: string[];
  }> {
    try {
      // Get all interventions in date range
      const interventionQuery: any = {
        workplaceId,
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
        isDeleted: { $ne: true },
      };

      if (options.interventionIds?.length) {
        interventionQuery._id = {
          $in: options.interventionIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      const interventions = await ClinicalIntervention.find(interventionQuery)
        .select('_id interventionNumber createdAt status')
        .lean();

      // Get audit logs for these interventions
      const auditFilters = {
        resourceType: 'ClinicalIntervention',
        startDate: dateRange.start,
        endDate: dateRange.end,
      };

      const { logs: auditLogs } = await AuditService.getAuditLogs({
        ...auditFilters,
        startDate: auditFilters.startDate?.toISOString(),
        endDate: auditFilters.endDate?.toISOString(),
        limit: 10000
      });

      // Calculate compliance metrics
      const interventionCompliance = interventions.map((intervention) => {
        const interventionAudits = auditLogs.filter(
          (log) => log.interventionId?.toString() === intervention._id.toString()
        );

        const auditCount = interventionAudits.length;
        const lastAudit =
          interventionAudits.length > 0
            ? interventionAudits.reduce(
              (latest, log) =>
                log.timestamp > (latest || new Date(0))
                  ? log.timestamp
                  : latest || new Date(0),
              interventionAudits[0]?.timestamp || null
            )
            : null;

        const riskActivities = interventionAudits.filter(
          (log) => log.riskLevel === 'high' || log.riskLevel === 'critical'
        ).length;

        // Determine compliance status
        let complianceStatus: 'compliant' | 'warning' | 'non-compliant' =
          'compliant';
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (auditCount === 0) {
          complianceStatus = 'non-compliant';
          riskLevel = 'high';
        } else if (riskActivities > 0) {
          complianceStatus = 'warning';
          riskLevel = riskActivities > 2 ? 'critical' : 'medium';
        } else if (auditCount < 3) {
          complianceStatus = 'warning';
          riskLevel = 'medium';
        }

        return {
          interventionId: intervention._id.toString(),
          interventionNumber: intervention.interventionNumber,
          auditCount,
          lastAudit: lastAudit || intervention.createdAt,
          complianceStatus,
          riskLevel,
        };
      });

      // Calculate summary
      const totalInterventions = interventions.length;
      const auditedActions = auditLogs.length;
      const riskActivities = auditLogs.filter(
        (log) => log.riskLevel === 'high' || log.riskLevel === 'critical'
      ).length;

      const compliantInterventions = interventionCompliance.filter(
        (i) => i.complianceStatus === 'compliant'
      ).length;
      const complianceScore =
        totalInterventions > 0
          ? Math.round((compliantInterventions / totalInterventions) * 100)
          : 100;

      // Generate recommendations
      const recommendations: string[] = [];

      if (complianceScore < 80) {
        recommendations.push(
          'Improve audit trail completeness for clinical interventions'
        );
      }
      if (riskActivities > totalInterventions * 0.1) {
        recommendations.push(
          'Review high-risk activities and implement additional controls'
        );
      }
      if (interventionCompliance.some((i) => i.auditCount === 0)) {
        recommendations.push(
          'Ensure all interventions have proper audit logging'
        );
      }

      return {
        summary: {
          totalInterventions,
          auditedActions,
          complianceScore,
          riskActivities,
        },
        interventionCompliance,
        recommendations,
      };
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw error;
    }
  }

  /**
   * Helper methods for audit logging
   */
  private static getChangedFields(oldValues: any, newValues: any): string[] {
    const changedFields: string[] = [];

    if (!oldValues || !newValues) return changedFields;

    const allKeys = new Set([
      ...Object.keys(oldValues),
      ...Object.keys(newValues),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  private static determineRiskLevel(
    action: string,
    details: any
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical risk actions
    if (action.includes('DELETE') || action.includes('CANCEL')) {
      return 'critical';
    }

    // High risk actions
    if (
      action.includes('OUTCOME') ||
      action.includes('COMPLETE') ||
      details?.priority === 'critical'
    ) {
      return 'high';
    }

    // Medium risk actions
    if (
      action.includes('UPDATE') ||
      action.includes('ASSIGN') ||
      action.includes('STRATEGY')
    ) {
      return 'medium';
    }

    // Low risk actions (READ operations)
    return 'low';
  }
}

// ===============================
// STRATEGY RECOMMENDATION ENGINE
// ===============================

/**
 * Predefined strategy mappings for each intervention category
 */
const STRATEGY_MAPPINGS: Record<string, StrategyRecommendation[]> = {
  drug_therapy_problem: [
    {
      type: 'medication_review',
      label: 'Comprehensive Medication Review',
      description: 'Conduct thorough review of all medications',
      rationale:
        'Identify potential drug therapy problems and optimization opportunities',
      expectedOutcome: 'Improved medication safety and efficacy',
      priority: 'primary',
      applicableCategories: ['drug_therapy_problem', 'dosing_issue'],
    },
    {
      type: 'dose_adjustment',
      label: 'Dose Optimization',
      description: 'Adjust medication dosage based on clinical parameters',
      rationale: 'Optimize therapeutic effect while minimizing adverse effects',
      expectedOutcome: 'Improved clinical response with reduced side effects',
      priority: 'primary',
      applicableCategories: ['drug_therapy_problem', 'dosing_issue'],
    },
    {
      type: 'alternative_therapy',
      label: 'Alternative Medication Selection',
      description:
        'Consider alternative medications with better safety/efficacy profile',
      rationale:
        'Current therapy may not be optimal for patient-specific factors',
      expectedOutcome: 'Better therapeutic outcomes with improved tolerability',
      priority: 'secondary',
      applicableCategories: [
        'drug_therapy_problem',
        'adverse_drug_reaction',
        'contraindication',
      ],
    },
    {
      type: 'additional_monitoring',
      label: 'Enhanced Monitoring Protocol',
      description: 'Implement additional monitoring parameters',
      rationale:
        'Ensure early detection of therapeutic response or adverse effects',
      expectedOutcome: 'Improved safety monitoring and outcome tracking',
      priority: 'secondary',
      applicableCategories: ['drug_therapy_problem', 'adverse_drug_reaction'],
    },
  ],
  adverse_drug_reaction: [
    {
      type: 'discontinuation',
      label: 'Medication Discontinuation',
      description: 'Discontinue the offending medication',
      rationale: 'Eliminate the source of adverse drug reaction',
      expectedOutcome: 'Resolution of adverse effects',
      priority: 'primary',
      applicableCategories: ['adverse_drug_reaction', 'contraindication'],
    },
    {
      type: 'dose_adjustment',
      label: 'Dose Reduction',
      description: 'Reduce medication dose to minimize adverse effects',
      rationale: 'Maintain therapeutic benefit while reducing toxicity',
      expectedOutcome: 'Reduced adverse effects while preserving efficacy',
      priority: 'primary',
      applicableCategories: ['adverse_drug_reaction', 'dosing_issue'],
    },
    {
      type: 'alternative_therapy',
      label: 'Switch to Alternative Agent',
      description: 'Replace with medication having better tolerability profile',
      rationale: 'Maintain therapeutic effect with improved safety profile',
      expectedOutcome: 'Continued therapeutic benefit without adverse effects',
      priority: 'secondary',
      applicableCategories: ['adverse_drug_reaction', 'contraindication'],
    },
    {
      type: 'additional_monitoring',
      label: 'Intensive Safety Monitoring',
      description: 'Implement close monitoring for adverse effect resolution',
      rationale: 'Ensure safe resolution and prevent recurrence',
      expectedOutcome: 'Safe management and prevention of future ADRs',
      priority: 'secondary',
      applicableCategories: ['adverse_drug_reaction'],
    },
  ],
  medication_nonadherence: [
    {
      type: 'patient_counseling',
      label: 'Patient Education and Counseling',
      description: 'Provide comprehensive medication education',
      rationale: 'Address knowledge gaps and misconceptions about medications',
      expectedOutcome: 'Improved understanding and medication adherence',
      priority: 'primary',
      applicableCategories: ['medication_nonadherence'],
    },
    {
      type: 'medication_review',
      label: 'Adherence-Focused Medication Review',
      description: 'Review regimen complexity and adherence barriers',
      rationale: 'Identify and address specific adherence challenges',
      expectedOutcome: 'Simplified regimen with improved adherence',
      priority: 'primary',
      applicableCategories: ['medication_nonadherence'],
    },
    {
      type: 'alternative_therapy',
      label: 'Adherence-Friendly Alternatives',
      description: 'Consider medications with better adherence profiles',
      rationale: 'Reduce dosing frequency or complexity to improve adherence',
      expectedOutcome: 'Improved adherence through simplified regimen',
      priority: 'secondary',
      applicableCategories: ['medication_nonadherence'],
    },
    {
      type: 'additional_monitoring',
      label: 'Adherence Monitoring Program',
      description: 'Implement systematic adherence monitoring',
      rationale: 'Track adherence patterns and provide timely interventions',
      expectedOutcome: 'Sustained improvement in medication adherence',
      priority: 'secondary',
      applicableCategories: ['medication_nonadherence'],
    },
  ],
  drug_interaction: [
    {
      type: 'medication_review',
      label: 'Drug Interaction Assessment',
      description: 'Comprehensive review of all medications for interactions',
      rationale: 'Identify and manage clinically significant drug interactions',
      expectedOutcome: 'Elimination of harmful drug interactions',
      priority: 'primary',
      applicableCategories: ['drug_interaction'],
    },
    {
      type: 'dose_adjustment',
      label: 'Interaction-Based Dose Modification',
      description: 'Adjust doses to account for drug interactions',
      rationale: 'Maintain efficacy while minimizing interaction effects',
      expectedOutcome: 'Safe concurrent use of interacting medications',
      priority: 'primary',
      applicableCategories: ['drug_interaction', 'dosing_issue'],
    },
    {
      type: 'alternative_therapy',
      label: 'Non-Interacting Alternative',
      description: 'Replace one medication with non-interacting alternative',
      rationale: 'Eliminate interaction while maintaining therapeutic goals',
      expectedOutcome: 'Continued therapy without drug interactions',
      priority: 'secondary',
      applicableCategories: ['drug_interaction'],
    },
    {
      type: 'additional_monitoring',
      label: 'Interaction Monitoring Protocol',
      description: 'Implement monitoring for interaction effects',
      rationale: 'Early detection of interaction-related problems',
      expectedOutcome: 'Safe management of unavoidable interactions',
      priority: 'secondary',
      applicableCategories: ['drug_interaction'],
    },
  ],
  dosing_issue: [
    {
      type: 'dose_adjustment',
      label: 'Dose Optimization',
      description: 'Adjust dose based on patient-specific factors',
      rationale: 'Optimize dose for individual patient characteristics',
      expectedOutcome: 'Improved therapeutic response with optimal safety',
      priority: 'primary',
      applicableCategories: ['dosing_issue'],
    },
    {
      type: 'medication_review',
      label: 'Dosing Regimen Review',
      description: 'Comprehensive review of dosing appropriateness',
      rationale:
        'Ensure dosing aligns with current guidelines and patient factors',
      expectedOutcome: 'Evidence-based dosing optimization',
      priority: 'primary',
      applicableCategories: ['dosing_issue'],
    },
    {
      type: 'additional_monitoring',
      label: 'Therapeutic Drug Monitoring',
      description: 'Implement monitoring of drug levels or therapeutic markers',
      rationale: 'Guide dose adjustments based on objective measurements',
      expectedOutcome: 'Precision dosing with improved outcomes',
      priority: 'secondary',
      applicableCategories: ['dosing_issue'],
    },
    {
      type: 'alternative_therapy',
      label: 'Alternative Dosing Strategy',
      description: 'Consider alternative formulations or dosing approaches',
      rationale: 'Improve dosing convenience or therapeutic profile',
      expectedOutcome: 'Better dosing outcomes through alternative approach',
      priority: 'secondary',
      applicableCategories: ['dosing_issue'],
    },
  ],
  contraindication: [
    {
      type: 'discontinuation',
      label: 'Immediate Discontinuation',
      description: 'Stop contraindicated medication immediately',
      rationale: 'Prevent serious adverse outcomes from contraindicated use',
      expectedOutcome: 'Elimination of contraindication risk',
      priority: 'primary',
      applicableCategories: ['contraindication'],
    },
    {
      type: 'alternative_therapy',
      label: 'Safe Alternative Selection',
      description: 'Replace with medication without contraindications',
      rationale: 'Maintain therapeutic benefit while ensuring safety',
      expectedOutcome: 'Continued therapy without contraindication risk',
      priority: 'primary',
      applicableCategories: ['contraindication'],
    },
    {
      type: 'physician_consultation',
      label: 'Specialist Consultation',
      description:
        'Consult with specialist for complex contraindication management',
      rationale: 'Obtain expert guidance for challenging clinical situations',
      expectedOutcome: 'Expert-guided safe medication management',
      priority: 'secondary',
      applicableCategories: ['contraindication'],
    },
    {
      type: 'additional_monitoring',
      label: 'Risk Mitigation Monitoring',
      description:
        'Implement intensive monitoring if discontinuation not possible',
      rationale:
        'Minimize risk when contraindicated medication must be continued',
      expectedOutcome:
        'Safest possible management of unavoidable contraindication',
      priority: 'secondary',
      applicableCategories: ['contraindication'],
    },
  ],
  other: [
    {
      type: 'medication_review',
      label: 'Comprehensive Assessment',
      description: 'Thorough evaluation of the clinical situation',
      rationale: 'Understand the specific nature of the clinical issue',
      expectedOutcome: 'Clear identification and management plan',
      priority: 'primary',
      applicableCategories: ['other'],
    },
    {
      type: 'patient_counseling',
      label: 'Patient Education',
      description: 'Provide relevant patient education and counseling',
      rationale: 'Ensure patient understanding of their medication therapy',
      expectedOutcome: 'Improved patient knowledge and engagement',
      priority: 'primary',
      applicableCategories: ['other'],
    },
    {
      type: 'physician_consultation',
      label: 'Healthcare Provider Consultation',
      description: 'Collaborate with other healthcare providers',
      rationale: 'Ensure coordinated care and optimal outcomes',
      expectedOutcome: 'Integrated healthcare team approach',
      priority: 'secondary',
      applicableCategories: ['other'],
    },
    {
      type: 'custom',
      label: 'Custom Intervention Strategy',
      description: 'Develop tailored intervention for unique situation',
      rationale:
        'Address specific clinical needs not covered by standard approaches',
      expectedOutcome: 'Individualized solution for complex clinical issue',
      priority: 'secondary',
      applicableCategories: ['other'],
    },
  ],
};

class StrategyRecommendationEngine {
  /**
   * Get recommended strategies for a specific intervention category
   */
  static getRecommendedStrategies(category: string): StrategyRecommendation[] {
    const strategies =
      STRATEGY_MAPPINGS[category] || STRATEGY_MAPPINGS['other'] || [];

    // Sort by priority (primary first) and then alphabetically
    return strategies.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'primary' ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Get all available strategies across all categories
   */
  static getAllStrategies(): StrategyRecommendation[] {
    const allStrategies: StrategyRecommendation[] = [];

    Object.values(STRATEGY_MAPPINGS).forEach((categoryStrategies) => {
      categoryStrategies.forEach((strategy) => {
        // Avoid duplicates by checking if strategy type already exists
        if (!allStrategies.find((s) => s.type === strategy.type)) {
          allStrategies.push(strategy);
        }
      });
    });

    return allStrategies.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get strategies applicable to multiple categories
   */
  static getStrategiesForCategories(
    categories: string[]
  ): StrategyRecommendation[] {
    const applicableStrategies: StrategyRecommendation[] = [];

    categories.forEach((category) => {
      const categoryStrategies = this.getRecommendedStrategies(category);
      categoryStrategies.forEach((strategy) => {
        // Add if not already included and if applicable to this category
        if (
          !applicableStrategies.find((s) => s.type === strategy.type) &&
          strategy.applicableCategories.includes(category)
        ) {
          applicableStrategies.push(strategy);
        }
      });
    });

    return applicableStrategies.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'primary' ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Validate custom strategy
   */
  static validateCustomStrategy(strategy: Partial<IInterventionStrategy>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!strategy.type || strategy.type !== 'custom') {
      errors.push('Custom strategy must have type "custom"');
    }

    if (!strategy.description || strategy.description.trim().length < 10) {
      errors.push('Strategy description must be at least 10 characters');
    }

    if (!strategy.rationale || strategy.rationale.trim().length < 10) {
      errors.push('Strategy rationale must be at least 10 characters');
    }

    if (
      !strategy.expectedOutcome ||
      strategy.expectedOutcome.trim().length < 20
    ) {
      errors.push('Expected outcome must be at least 20 characters');
    }

    if (strategy.description && strategy.description.length > 500) {
      errors.push('Strategy description cannot exceed 500 characters');
    }

    if (strategy.rationale && strategy.rationale.length > 500) {
      errors.push('Strategy rationale cannot exceed 500 characters');
    }

    if (strategy.expectedOutcome && strategy.expectedOutcome.length > 500) {
      errors.push('Expected outcome cannot exceed 500 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate strategy recommendations based on clinical context
   */
  static generateRecommendations(
    category: string,
    priority: string,
    issueDescription: string,
    patientFactors?: {
      age?: number;
      conditions?: string[];
      allergies?: string[];
      currentMedications?: string[];
    }
  ): StrategyRecommendation[] {
    let recommendations = this.getRecommendedStrategies(category);

    // Filter based on priority - for critical/high priority, focus on primary strategies
    if (priority === 'critical' || priority === 'high') {
      recommendations = recommendations.filter((r) => r.priority === 'primary');
    }

    // Apply clinical context filtering
    if (patientFactors) {
      recommendations = StrategyRecommendationEngine.applyContextualFiltering(
        recommendations,
        patientFactors,
        issueDescription
      );
    }

    // Limit to top 4 recommendations to avoid overwhelming users
    return recommendations.slice(0, 4);
  }

  /**
   * Apply contextual filtering based on patient factors
   */
  private static applyContextualFiltering(
    strategies: StrategyRecommendation[],
    patientFactors: any,
    issueDescription: string
  ): StrategyRecommendation[] {
    return strategies.filter((strategy) => {
      // Example contextual rules (in production, this would be more sophisticated)

      // If patient has multiple medications, prioritize medication review
      if (
        patientFactors.currentMedications?.length > 5 &&
        strategy.type === 'medication_review'
      ) {
        return true;
      }

      // If patient is elderly (>65), be cautious with dose adjustments
      if (patientFactors.age > 65 && strategy.type === 'dose_adjustment') {
        // Still include but with modified rationale
        strategy.rationale += ' (Consider age-related pharmacokinetic changes)';
        return true;
      }

      // If issue mentions "adherence" or "compliance", prioritize counseling
      if (
        issueDescription.toLowerCase().includes('adherence') ||
        issueDescription.toLowerCase().includes('compliance')
      ) {
        return (
          strategy.type === 'patient_counseling' ||
          strategy.type === 'medication_review'
        );
      }

      // Default: include all strategies
      return true;
    });
  }

  /**
   * Get strategy by type
   */
  static getStrategyByType(type: string): StrategyRecommendation | null {
    for (const categoryStrategies of Object.values(STRATEGY_MAPPINGS)) {
      const strategy = categoryStrategies.find((s) => s.type === type);
      if (strategy) {
        return strategy;
      }
    }
    return null;
  }
}

// Add strategy recommendation methods to main service
ClinicalInterventionService.getRecommendedStrategies =
  StrategyRecommendationEngine.getRecommendedStrategies;
ClinicalInterventionService.getAllStrategies =
  StrategyRecommendationEngine.getAllStrategies;
ClinicalInterventionService.getStrategiesForCategories =
  StrategyRecommendationEngine.getStrategiesForCategories;
ClinicalInterventionService.validateCustomStrategy =
  StrategyRecommendationEngine.validateCustomStrategy;
ClinicalInterventionService.generateRecommendations =
  StrategyRecommendationEngine.generateRecommendations;
ClinicalInterventionService.getStrategyByType =
  StrategyRecommendationEngine.getStrategyByType;

// ===============================
// TEAM COLLABORATION SERVICE
// ===============================

class TeamCollaborationService {
  /**
   * Assign team member to intervention
   */
  static async assignTeamMember(
    interventionId: string,
    assignment: Omit<ITeamAssignment, 'assignedAt'>,
    assignedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Validate user exists and belongs to workplace
      const user = await User.findOne({
        _id: assignment.userId,
        workplaceId,
      });

      if (!user) {
        throw createNotFoundError('User not found or not in workplace');
      }

      // Validate role assignment rules
      const validationResult = this.validateRoleAssignment(
        assignment.role,
        user
      );
      if (!validationResult.isValid) {
        throw createBusinessRuleError(validationResult.errors.join(', '));
      }

      // Check for duplicate assignments
      const existingAssignment = intervention.assignments.find(
        (a) => a.userId.equals(assignment.userId) && a.status !== 'cancelled'
      );

      if (existingAssignment) {
        throw createBusinessRuleError(
          'User is already assigned to this intervention'
        );
      }

      // Create assignment with timestamp
      const newAssignment: ITeamAssignment = {
        ...assignment,
        assignedAt: new Date(),
      };

      intervention.assignTeamMember(newAssignment);
      intervention.updatedBy = assignedBy;
      await intervention.save();

      // Log assignment activity
      await ClinicalInterventionService.logActivity(
        'ASSIGN_TEAM_MEMBER',
        interventionId,
        assignedBy,
        workplaceId,
        {
          assignedUserId: assignment.userId.toString(),
          role: assignment.role,
          task: assignment.task,
        }
      );

      // Trigger notification
      await this.triggerAssignmentNotification(
        intervention,
        newAssignment,
        assignedBy
      );

      return intervention;
    } catch (error) {
      logger.error('Error assigning team member:', error);
      throw error;
    }
  }

  /**
   * Update assignment status
   */
  static async updateAssignmentStatus(
    interventionId: string,
    assignmentUserId: mongoose.Types.ObjectId,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    notes: string | undefined,
    updatedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      const assignment = intervention.assignments.find((a) =>
        a.userId.equals(assignmentUserId)
      );

      if (!assignment) {
        throw createNotFoundError('Assignment not found');
      }

      // Validate status transition
      if (!this.isValidAssignmentStatusTransition(assignment.status, status)) {
        throw createBusinessRuleError(
          `Invalid status transition from ${assignment.status} to ${status}`
        );
      }

      // Update assignment
      const previousStatus = assignment.status;
      assignment.status = status;
      if (notes) assignment.notes = notes;
      if (status === 'completed') assignment.completedAt = new Date();

      intervention.updatedBy = updatedBy;
      await intervention.save();

      // Log status update activity
      await ClinicalInterventionService.logActivity(
        'UPDATE_ASSIGNMENT_STATUS',
        interventionId,
        updatedBy,
        workplaceId,
        {
          assignedUserId: assignmentUserId.toString(),
          previousStatus,
          newStatus: status,
          notes,
        }
      );

      // Trigger status change notification
      await this.triggerStatusChangeNotification(
        intervention,
        assignment,
        previousStatus,
        updatedBy
      );

      return intervention;
    } catch (error) {
      logger.error('Error updating assignment status:', error);
      throw error;
    }
  }

  /**
   * Get assignments for a user
   */
  static async getUserAssignments(
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    status?: string[]
  ): Promise<IClinicalIntervention[]> {
    try {
      const query: any = {
        workplaceId,
        'assignments.userId': userId,
        isDeleted: { $ne: true },
      };

      if (status && status.length > 0) {
        query['assignments.status'] = { $in: status };
      }

      const interventions = await ClinicalIntervention.find(query)
        .populate('patientId', 'firstName lastName dateOfBirth')
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName')
        .sort({ 'assignments.assignedAt': -1 });

      return interventions;
    } catch (error) {
      logger.error('Error getting user assignments:', error);
      throw error;
    }
  }

  /**
   * Get assignment history for intervention
   */
  static async getAssignmentHistory(
    interventionId: string,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    assignments: ITeamAssignment[];
    auditTrail: any[];
  }> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      }).populate('assignments.userId', 'firstName lastName email');

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Get audit trail for assignments (this would integrate with audit logging system)
      const auditTrail = await this.getAssignmentAuditTrail(interventionId);

      return {
        assignments: intervention.assignments,
        auditTrail,
      };
    } catch (error) {
      logger.error('Error getting assignment history:', error);
      throw error;
    }
  }

  /**
   * Remove assignment
   */
  static async removeAssignment(
    interventionId: string,
    assignmentUserId: mongoose.Types.ObjectId,
    removedBy: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    reason?: string
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      const assignmentIndex = intervention.assignments.findIndex((a) =>
        a.userId.equals(assignmentUserId)
      );

      if (assignmentIndex === -1) {
        throw createNotFoundError('Assignment not found');
      }

      const assignment = intervention.assignments[assignmentIndex];

      // Validate removal rules
      if (assignment && assignment.status === 'completed') {
        throw createBusinessRuleError('Cannot remove completed assignments');
      }

      // Mark as cancelled instead of removing
      if (assignment) {
        assignment.status = 'cancelled';
        assignment.notes = reason || 'Assignment removed';
        assignment.completedAt = new Date();
      }

      intervention.updatedBy = removedBy;
      await intervention.save();

      // Log removal activity
      await ClinicalInterventionService.logActivity(
        'REMOVE_ASSIGNMENT',
        interventionId,
        removedBy,
        workplaceId,
        {
          assignedUserId: assignmentUserId.toString(),
          reason,
        }
      );

      return intervention;
    } catch (error) {
      logger.error('Error removing assignment:', error);
      throw error;
    }
  }

  /**
   * Validate role assignment rules
   */
  private static validateRoleAssignment(
    role: string,
    user: any
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Define role validation rules
    const roleRequirements: Record<string, string[]> = {
      pharmacist: ['Pharmacist', 'Owner'],
      physician: ['Physician', 'Doctor'],
      nurse: ['Nurse', 'Pharmacist', 'Owner'],
      patient: [], // No specific role requirements
      caregiver: [], // No specific role requirements
    };

    const requiredRoles = roleRequirements[role];
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = user.role || user.workplaceRole;
      if (!requiredRoles.includes(userRole)) {
        errors.push(
          `User role '${userRole}' is not authorized for assignment role '${role}'`
        );
      }
    }

    // Additional validation rules can be added here
    // e.g., license verification, certification checks, etc.

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate assignment status transitions
   */
  private static isValidAssignmentStatusTransition(
    currentStatus: string,
    newStatus: string
  ): boolean {
    const validTransitions: Record<string, string[]> = {
      pending: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [], // No transitions from completed
      cancelled: [], // No transitions from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Trigger assignment notification
   */
  private static async triggerAssignmentNotification(
    intervention: IClinicalIntervention,
    assignment: ITeamAssignment,
    assignedBy: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      // This would integrate with the notification system
      logger.info('Assignment notification triggered', {
        interventionId: intervention._id.toString(),
        assignedUserId: assignment.userId.toString(),
        assignedBy: assignedBy.toString(),
        role: assignment.role,
        task: assignment.task,
      });

      // In a real implementation, this would:
      // 1. Send email notification to assigned user
      // 2. Create in-app notification
      // 3. Send SMS if configured
      // 4. Update dashboard notifications
    } catch (error) {
      logger.error('Error triggering assignment notification:', error);
      // Don't throw error for notification failures
    }
  }

  /**
   * Trigger status change notification
   */
  private static async triggerStatusChangeNotification(
    intervention: IClinicalIntervention,
    assignment: ITeamAssignment,
    previousStatus: string,
    updatedBy: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      logger.info('Status change notification triggered', {
        interventionId: intervention._id.toString(),
        assignedUserId: assignment.userId.toString(),
        updatedBy: updatedBy.toString(),
        previousStatus,
        newStatus: assignment.status,
      });

      // In a real implementation, this would notify relevant stakeholders
    } catch (error) {
      logger.error('Error triggering status change notification:', error);
      // Don't throw error for notification failures
    }
  }

  /**
   * Get assignment audit trail
   */
  private static async getAssignmentAuditTrail(
    interventionId: string
  ): Promise<any[]> {
    try {
      // This would integrate with the audit logging system
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      logger.error('Error getting assignment audit trail:', error);
      return [];
    }
  }

  /**
   * Get team workload statistics
   */
  static async getTeamWorkloadStats(
    workplaceId: mongoose.Types.ObjectId,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    userWorkloads: Array<{
      userId: mongoose.Types.ObjectId;
      userName: string;
      activeAssignments: number;
      completedAssignments: number;
      averageCompletionTime: number;
    }>;
  }> {
    try {
      const query: any = {
        workplaceId,
        isDeleted: { $ne: true },
      };

      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.from,
          $lte: dateRange.to,
        };
      }

      const interventions = await ClinicalIntervention.find(query).populate(
        'assignments.userId',
        'firstName lastName'
      );

      let totalAssignments = 0;
      let activeAssignments = 0;
      let completedAssignments = 0;
      const userStats: Record<string, any> = {};

      interventions.forEach((intervention) => {
        intervention.assignments.forEach((assignment) => {
          totalAssignments++;

          const userId = assignment.userId.toString();
          if (!userStats[userId]) {
            userStats[userId] = {
              userId: assignment.userId,
              userName: `${(assignment.userId as any).firstName} ${(assignment.userId as any).lastName
                }`,
              activeAssignments: 0,
              completedAssignments: 0,
              completionTimes: [],
            };
          }

          if (assignment.status === 'completed') {
            completedAssignments++;
            userStats[userId].completedAssignments++;

            if (assignment.completedAt && assignment.assignedAt) {
              const completionTime =
                assignment.completedAt.getTime() -
                assignment.assignedAt.getTime();
              userStats[userId].completionTimes.push(completionTime);
            }
          } else if (['pending', 'in_progress'].includes(assignment.status)) {
            activeAssignments++;
            userStats[userId].activeAssignments++;
          }
        });
      });

      const userWorkloads = Object.values(userStats).map((stats: any) => ({
        userId: stats.userId,
        userName: stats.userName,
        activeAssignments: stats.activeAssignments,
        completedAssignments: stats.completedAssignments,
        averageCompletionTime:
          stats.completionTimes.length > 0
            ? stats.completionTimes.reduce((a: number, b: number) => a + b, 0) /
            stats.completionTimes.length
            : 0,
      }));

      return {
        totalAssignments,
        activeAssignments,
        completedAssignments,
        userWorkloads,
      };
    } catch (error) {
      logger.error('Error getting team workload stats:', error);
      throw error;
    }
  }

  /**
   * Add strategy to intervention
   */
  static async addStrategy(
    interventionId: string,
    strategy: Omit<IInterventionStrategy, 'addedAt'>,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Add strategy
      intervention.addStrategy(strategy);
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'ADD_STRATEGY',
        intervention._id.toString(),
        userId,
        workplaceId,
        { strategyType: strategy.type }
      );

      return intervention;
    } catch (error) {
      logger.error('Error adding strategy to intervention:', error);
      throw error;
    }
  }

  /**
   * Update strategy in intervention
   */
  static async updateStrategy(
    interventionId: string,
    strategyId: string,
    updates: Partial<IInterventionStrategy>,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Find and update strategy
      const strategy = intervention.strategies.find(
        (s) => (s as any)._id?.toString() === strategyId
      );
      if (!strategy) {
        throw createNotFoundError('Strategy not found');
      }

      Object.assign(strategy, updates);
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'UPDATE_STRATEGY',
        intervention._id.toString(),
        userId,
        workplaceId,
        { strategyId, updates: Object.keys(updates) }
      );

      return intervention;
    } catch (error) {
      logger.error('Error updating strategy:', error);
      throw error;
    }
  }

  /**
   * Record outcome for intervention
   */
  static async recordOutcome(
    interventionId: string,
    outcome: IInterventionOutcome,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Record outcome
      intervention.outcomes = outcome;
      intervention.updatedBy = userId;

      // Update status if outcome indicates completion
      if (
        outcome.patientResponse === 'improved' &&
        outcome.successMetrics?.problemResolved
      ) {
        intervention.status = 'completed';
        intervention.completedAt = new Date();
      }

      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'RECORD_OUTCOME',
        intervention._id.toString(),
        userId,
        workplaceId,
        { patientResponse: outcome.patientResponse }
      );

      return intervention;
    } catch (error) {
      logger.error('Error recording outcome:', error);
      throw error;
    }
  }

  /**
   * Schedule follow-up for intervention
   */
  static async scheduleFollowUp(
    interventionId: string,
    followUp: {
      required: boolean;
      scheduledDate?: Date;
      notes?: string;
      nextReviewDate?: Date;
    },
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Schedule follow-up
      intervention.followUp = followUp;
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'SCHEDULE_FOLLOW_UP',
        intervention._id.toString(),
        userId,
        workplaceId,
        { required: followUp.required, scheduledDate: followUp.scheduledDate }
      );

      return intervention;
    } catch (error) {
      logger.error('Error scheduling follow-up:', error);
      throw error;
    }
  }

  /**
   * Advanced search with complex filters
   */
  static async advancedSearch(
    filters: InterventionFilters,
    advancedOptions: {
      patientName?: string;
      interventionNumber?: string;
      assignedUsers?: string[];
      outcomeTypes?: string[];
    }
  ): Promise<PaginatedResult<IClinicalIntervention>> {
    try {
      const {
        workplaceId,
        page = 1,
        limit = 20,
        sortBy = 'identifiedDate',
        sortOrder = 'desc',
      } = filters;

      // Build base query
      const query: any = {
        workplaceId,
        isDeleted: { $ne: true },
      };

      // Add basic filters
      if (filters.category) {
        if (
          typeof filters.category === 'object' &&
          (filters.category as any).$in
        ) {
          query.category = filters.category;
        } else {
          query.category = filters.category;
        }
      }

      if (filters.priority) {
        if (
          typeof filters.priority === 'object' &&
          (filters.priority as any).$in
        ) {
          query.priority = filters.priority;
        } else {
          query.priority = filters.priority;
        }
      }

      if (filters.status) {
        if (typeof filters.status === 'object' && (filters.status as any).$in) {
          query.status = filters.status;
        } else {
          query.status = filters.status;
        }
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.identifiedDate = {};
        if (filters.dateFrom) query.identifiedDate.$gte = filters.dateFrom;
        if (filters.dateTo) query.identifiedDate.$lte = filters.dateTo;
      }

      // Advanced search options
      if (advancedOptions.interventionNumber) {
        query.interventionNumber = {
          $regex: advancedOptions.interventionNumber,
          $options: 'i',
        };
      }

      if (
        advancedOptions.assignedUsers &&
        advancedOptions.assignedUsers.length > 0
      ) {
        query['assignments.userId'] = {
          $in: advancedOptions.assignedUsers.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      if (
        advancedOptions.outcomeTypes &&
        advancedOptions.outcomeTypes.length > 0
      ) {
        query['outcomes.patientResponse'] = {
          $in: advancedOptions.outcomeTypes,
        };
      }

      // General search
      if (filters.search) {
        query.$or = [
          { interventionNumber: { $regex: filters.search, $options: 'i' } },
          { issueDescription: { $regex: filters.search, $options: 'i' } },
          { implementationNotes: { $regex: filters.search, $options: 'i' } },
        ];
      }

      // Patient name search (requires population)
      let populatePatient = false;
      if (advancedOptions.patientName) {
        populatePatient = true;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      let interventionsQuery = ClinicalIntervention.find(query)
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      if (populatePatient) {
        interventionsQuery = interventionsQuery.populate(
          'patientId',
          'firstName lastName dateOfBirth'
        );
      }

      const [interventions, total] = await Promise.all([
        interventionsQuery.lean(),
        ClinicalIntervention.countDocuments(query),
      ]);

      // Filter by patient name if specified (post-query filtering)
      let filteredInterventions = interventions as IClinicalIntervention[];
      if (advancedOptions.patientName && populatePatient) {
        const nameRegex = new RegExp(advancedOptions.patientName, 'i');
        filteredInterventions = interventions.filter((intervention: any) => {
          const patient = intervention.patientId;
          return (
            patient &&
            (nameRegex.test(patient.firstName) ||
              nameRegex.test(patient.lastName) ||
              nameRegex.test(`${patient.firstName} ${patient.lastName}`))
          );
        });
      }

      const pages = Math.ceil(total / limit);

      return {
        data: filteredInterventions,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error in advanced search:', error);
      throw error;
    }
  }

  /**
   * Get patient intervention summary
   */
  static async getPatientInterventionSummary(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    totalInterventions: number;
    activeInterventions: number;
    completedInterventions: number;
    successRate: number;
    categoryBreakdown: Record<string, number>;
    recentInterventions: IClinicalIntervention[];
  }> {
    try {
      const query = {
        patientId,
        workplaceId,
        isDeleted: { $ne: true },
      };

      // Get all interventions for patient
      const interventions = await ClinicalIntervention.find(query).lean();

      // Calculate metrics
      const totalInterventions = interventions.length;
      const activeInterventions = interventions.filter((i) =>
        ['identified', 'planning', 'in_progress', 'implemented'].includes(
          i.status
        )
      ).length;
      const completedInterventions = interventions.filter(
        (i) => i.status === 'completed'
      ).length;
      const successfulInterventions = interventions.filter(
        (i) => i.outcomes?.patientResponse === 'improved'
      ).length;
      const successRate =
        completedInterventions > 0
          ? (successfulInterventions / completedInterventions) * 100
          : 0;

      // Category breakdown
      const categoryBreakdown: Record<string, number> = {};
      interventions.forEach((intervention) => {
        categoryBreakdown[intervention.category] =
          (categoryBreakdown[intervention.category] || 0) + 1;
      });

      // Recent interventions (last 5)
      const recentInterventions = await ClinicalIntervention.find(query)
        .populate('identifiedBy', 'firstName lastName')
        .sort({ identifiedDate: -1 })
        .limit(5)
        .lean();

      return {
        totalInterventions,
        activeInterventions,
        completedInterventions,
        successRate,
        categoryBreakdown,
        recentInterventions: recentInterventions as IClinicalIntervention[],
      };
    } catch (error) {
      logger.error('Error getting patient intervention summary:', error);
      throw error;
    }
  }

  /**
   * Get user assignment statistics
   */
  static async getUserAssignmentStats(
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    overdueAssignments: number;
    completionRate: number;
  }> {
    try {
      const query = {
        workplaceId,
        'assignments.userId': userId,
        isDeleted: { $ne: true },
      };

      const interventions = await ClinicalIntervention.find(query).lean();

      let totalAssignments = 0;
      let activeAssignments = 0;
      let completedAssignments = 0;
      let overdueAssignments = 0;

      const now = new Date();

      interventions.forEach((intervention) => {
        intervention.assignments.forEach((assignment) => {
          if (assignment.userId.toString() === userId.toString()) {
            totalAssignments++;

            switch (assignment.status) {
              case 'pending':
              case 'in_progress':
                activeAssignments++;
                // Check if overdue (assuming 7 days default)
                const assignedDate = new Date(assignment.assignedAt);
                const daysDiff =
                  (now.getTime() - assignedDate.getTime()) / (1000 * 3600 * 24);
                if (daysDiff > 7) {
                  overdueAssignments++;
                }
                break;
              case 'completed':
                completedAssignments++;
                break;
            }
          }
        });
      });

      const completionRate =
        totalAssignments > 0
          ? (completedAssignments / totalAssignments) * 100
          : 0;

      return {
        totalAssignments,
        activeAssignments,
        completedAssignments,
        overdueAssignments,
        completionRate,
      };
    } catch (error) {
      logger.error('Error getting user assignment stats:', error);
      throw error;
    }
  }

  /**
   * Link intervention to MTR
   */
  static async linkToMTR(
    interventionId: string,
    mtrId: string,
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
  ): Promise<IClinicalIntervention> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // Link to MTR
      intervention.relatedMTRId = new mongoose.Types.ObjectId(mtrId);
      intervention.updatedBy = userId;
      await intervention.save();

      // Log activity
      await ClinicalInterventionService.logActivity(
        'LINK_MTR',
        intervention._id.toString(),
        userId,
        workplaceId,
        { mtrId }
      );

      return intervention;
    } catch (error) {
      logger.error('Error linking intervention to MTR:', error);
      throw error;
    }
  }

  /**
   * Send notifications for intervention
   */
  static async sendNotifications(
    interventionId: string,
    notification: {
      type: string;
      recipients: mongoose.Types.ObjectId[];
      message?: string;
      urgency: string;
      sentBy: mongoose.Types.ObjectId;
    },
    workplaceId: mongoose.Types.ObjectId
  ): Promise<{ sent: number; failed: number }> {
    try {
      const intervention = await ClinicalIntervention.findOne({
        _id: interventionId,
        workplaceId,
        isDeleted: { $ne: true },
      });

      if (!intervention) {
        throw createNotFoundError('Clinical intervention not found');
      }

      // This would integrate with the notification service
      // For now, just log the notification
      logger.info('Intervention notification sent', {
        interventionId,
        type: notification.type,
        recipients: notification.recipients.map((id) => id.toString()),
        urgency: notification.urgency,
        sentBy: notification.sentBy.toString(),
      });

      // Log activity
      await ClinicalInterventionService.logActivity(
        'SEND_NOTIFICATIONS',
        intervention._id.toString(),
        notification.sentBy,
        workplaceId,
        {
          type: notification.type,
          recipientCount: notification.recipients.length,
          urgency: notification.urgency,
        }
      );

      return {
        sent: notification.recipients.length,
        failed: 0,
      };
    } catch (error) {
      logger.error('Error sending intervention notifications:', error);
      throw error;
    }
  }

  /**
   * Get trend analysis
   */
  static async getTrendAnalysis(
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { from: Date; to: Date },
    period: string,
    groupBy: string
  ): Promise<any> {
    try {
      const query = {
        workplaceId,
        identifiedDate: {
          $gte: dateRange.from,
          $lte: dateRange.to,
        },
        isDeleted: { $ne: true },
      };

      // Build aggregation pipeline based on period and groupBy
      const pipeline: any[] = [{ $match: query }];

      // Group by time period
      let dateGrouping: any = {};
      switch (period) {
        case 'day':
          dateGrouping = {
            year: { $year: '$identifiedDate' },
            month: { $month: '$identifiedDate' },
            day: { $dayOfMonth: '$identifiedDate' },
          };
          break;
        case 'week':
          dateGrouping = {
            year: { $year: '$identifiedDate' },
            week: { $week: '$identifiedDate' },
          };
          break;
        case 'month':
          dateGrouping = {
            year: { $year: '$identifiedDate' },
            month: { $month: '$identifiedDate' },
          };
          break;
        case 'quarter':
          dateGrouping = {
            year: { $year: '$identifiedDate' },
            quarter: {
              $ceil: { $divide: [{ $month: '$identifiedDate' }, 3] },
            },
          };
          break;
      }

      // Add groupBy field
      const groupId: any = { ...dateGrouping };
      if (groupBy !== 'total') {
        groupId[groupBy] = `$${groupBy}`;
      }

      pipeline.push({
        $group: {
          _id: groupId,
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          successful: {
            $sum: {
              $cond: [{ $eq: ['$outcomes.patientResponse', 'improved'] }, 1, 0],
            },
          },
        },
      });

      pipeline.push({ $sort: { _id: 1 } });

      const trends = await ClinicalIntervention.aggregate(pipeline);

      return trends;
    } catch (error) {
      logger.error('Error getting trend analysis:', error);
      throw error;
    }
  }

  /**
   * Generate outcome report
   */
  static async generateOutcomeReport(filters: any): Promise<any> {
    try {
      const query: any = {
        workplaceId: filters.workplaceId,
        isDeleted: { $ne: true },
      };

      // Add filters
      if (filters.dateFrom || filters.dateTo) {
        query.identifiedDate = {};
        if (filters.dateFrom) query.identifiedDate.$gte = filters.dateFrom;
        if (filters.dateTo) query.identifiedDate.$lte = filters.dateTo;
      }

      if (filters.category) query.category = filters.category;
      if (filters.priority) query.priority = filters.priority;

      // Get interventions
      const interventions = await ClinicalIntervention.find(query)
        .populate('patientId', 'firstName lastName')
        .populate('identifiedBy', 'firstName lastName')
        .lean();

      // Calculate metrics
      const totalInterventions = interventions.length;
      const completedInterventions = interventions.filter(
        (i) => i.status === 'completed'
      ).length;
      const successfulInterventions = interventions.filter(
        (i) => i.outcomes?.patientResponse === 'improved'
      ).length;
      const successRate =
        completedInterventions > 0
          ? (successfulInterventions / completedInterventions) * 100
          : 0;

      // Category breakdown
      const categoryBreakdown: Record<string, any> = {};
      interventions.forEach((intervention) => {
        if (!categoryBreakdown[intervention.category]) {
          categoryBreakdown[intervention.category] = {
            total: 0,
            completed: 0,
            successful: 0,
          };
        }
        categoryBreakdown[intervention.category].total++;
        if (intervention.status === 'completed') {
          categoryBreakdown[intervention.category].completed++;
          if (intervention.outcomes?.patientResponse === 'improved') {
            categoryBreakdown[intervention.category].successful++;
          }
        }
      });

      // Calculate success rates for each category
      Object.keys(categoryBreakdown).forEach((category) => {
        const data = categoryBreakdown[category];
        data.successRate =
          data.completed > 0 ? (data.successful / data.completed) * 100 : 0;
      });

      return {
        summary: {
          totalInterventions,
          completedInterventions,
          successfulInterventions,
          successRate,
        },
        categoryBreakdown,
        interventions: filters.includeDetails ? interventions : undefined,
        generatedAt: new Date(),
        filters,
      };
    } catch (error) {
      logger.error('Error generating outcome report:', error);
      throw error;
    }
  }

  /**
   * Export intervention data
   */
  static async exportData(
    filters: any,
    format: string
  ): Promise<Buffer | string> {
    try {
      const query: any = {
        workplaceId: filters.workplaceId,
        isDeleted: { $ne: true },
      };

      // Add filters
      if (filters.dateFrom || filters.dateTo) {
        query.identifiedDate = {};
        if (filters.dateFrom) query.identifiedDate.$gte = filters.dateFrom;
        if (filters.dateTo) query.identifiedDate.$lte = filters.dateTo;
      }

      if (filters.category) query.category = filters.category;
      if (filters.priority) query.priority = filters.priority;
      if (filters.status) query.status = filters.status;

      // Get interventions with full population
      const interventions = await ClinicalIntervention.find(query)
        .populate('patientId', 'firstName lastName dateOfBirth')
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName')
        .lean();

      // Format data for export
      const exportData = interventions.map((intervention) => ({
        interventionNumber: intervention.interventionNumber,
        patientName: intervention.patientId
          ? `${(intervention.patientId as any).firstName} ${(intervention.patientId as any).lastName
          }`
          : 'N/A',
        category: intervention.category,
        priority: intervention.priority,
        status: intervention.status,
        issueDescription: intervention.issueDescription,
        identifiedBy: intervention.identifiedBy
          ? `${(intervention.identifiedBy as any).firstName} ${(intervention.identifiedBy as any).lastName
          }`
          : 'N/A',
        identifiedDate: intervention.identifiedDate,
        completedDate: intervention.completedAt,
        patientResponse: intervention.outcomes?.patientResponse || 'N/A',
        strategiesCount: intervention.strategies.length,
        assignmentsCount: intervention.assignments.length,
      }));

      // Generate export based on format
      switch (format) {
        case 'csv':
          return this.generateCSV(exportData);
        case 'excel':
          return this.generateExcel(exportData);
        case 'pdf':
          return this.generatePDF(exportData);
        default:
          throw createValidationError('Unsupported export format');
      }
    } catch (error) {
      logger.error('Error exporting intervention data:', error);
      throw error;
    }
  }

  /**
   * Generate CSV export
   */
  private static generateCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (
              typeof value === 'string' &&
              (value.includes(',') || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          })
          .join(',')
      ),
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate Excel export (placeholder - would need xlsx library)
   */
  private static generateExcel(data: any[]): Buffer {
    // This would require the xlsx library
    // For now, return CSV as buffer
    const csvContent = this.generateCSV(data);
    return Buffer.from(csvContent, 'utf8');
  }

  /**
   * Generate PDF export (placeholder - would need pdf library)
   */
  private static generatePDF(data: any[]): Buffer {
    // This would require a PDF library like pdfkit or puppeteer
    // For now, return CSV as buffer
    const csvContent = this.generateCSV(data);
    return Buffer.from(csvContent, 'utf8');
  }

  /**
   * Get dashboard metrics for clinical interventions
   */
  static async getDashboardMetrics(
    workplaceId: mongoose.Types.ObjectId,
    dateRange: { from: Date; to: Date }
  ): Promise<any> {
    try {
      const { from, to } = dateRange;

      // Base query for the date range
      const baseQuery = {
        workplaceId,
        isDeleted: { $ne: true },
        identifiedDate: { $gte: from, $lte: to },
      };

      // Get basic counts
      const [
        totalInterventions,
        completedInterventions,
        inProgressInterventions,
        pendingInterventions,
      ] = await Promise.all([
        ClinicalIntervention.countDocuments(baseQuery),
        ClinicalIntervention.countDocuments({
          ...baseQuery,
          status: 'completed',
        }),
        ClinicalIntervention.countDocuments({
          ...baseQuery,
          status: 'in_progress',
        }),
        ClinicalIntervention.countDocuments({
          ...baseQuery,
          status: 'identified',
        }),
      ]);

      // Get category breakdown
      const categoryBreakdown = await ClinicalIntervention.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Get priority breakdown
      const priorityBreakdown = await ClinicalIntervention.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Calculate completion rate
      const completionRate =
        totalInterventions > 0
          ? (completedInterventions / totalInterventions) * 100
          : 0;

      return {
        totalInterventions,
        completedInterventions,
        inProgressInterventions,
        pendingInterventions,
        completionRate: Math.round(completionRate * 100) / 100,
        categoryBreakdown: categoryBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        priorityBreakdown: priorityBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        dateRange,
      };
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }
}

// Add team collaboration methods to main service
ClinicalInterventionService.assignTeamMember =
  TeamCollaborationService.assignTeamMember;
ClinicalInterventionService.updateAssignmentStatus =
  TeamCollaborationService.updateAssignmentStatus;
ClinicalInterventionService.getUserAssignments =
  TeamCollaborationService.getUserAssignments;
ClinicalInterventionService.getAssignmentHistory =
  TeamCollaborationService.getAssignmentHistory;
ClinicalInterventionService.removeAssignment =
  TeamCollaborationService.removeAssignment;
ClinicalInterventionService.getTeamWorkloadStats =
  TeamCollaborationService.getTeamWorkloadStats;

// ===============================
// DASHBOARD ANALYTICS METHODS
// ===============================

// Removed duplicate getDashboardMetrics - now defined as static method inside class

/**
    const { from, to } = dateRange;

    // Base query for the date range
    const baseQuery = {
        workplaceId,
        isDeleted: { $ne: true },
        identifiedDate: { $gte: from, $lte: to }
    };

    // Get total interventions
    const totalInterventions = await ClinicalIntervention.countDocuments({
        workplaceId,
        isDeleted: { $ne: true }
    });

    // Get interventions in date range
    const interventionsInRange = await ClinicalIntervention.countDocuments(baseQuery);

    // Get active interventions (not completed or cancelled)
    const activeInterventions = await ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] }
    });

    // Get completed interventions
    const completedInterventions = await ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: 'completed'
    });

    // Get overdue interventions (follow-up required but past due date)
    const overdueInterventions = await ClinicalIntervention.countDocuments({
        ...baseQuery,
        'followUp.required': true,
        'followUp.scheduledDate': { $lt: new Date() },
        'followUp.completedDate': { $exists: false }
    });

    // Calculate success rate
    const successfulInterventions = await ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: 'completed',
        'outcomes.patientResponse': { $in: ['improved'] }
    });

    const successRate = completedInterventions > 0 ? (successfulInterventions / completedInterventions) * 100 : 0;

    // Calculate average resolution time
    const completedWithDuration = await ClinicalIntervention.aggregate([
        { $match: { ...baseQuery, status: 'completed', completedAt: { $exists: true } } },
        {
            $project: {
                duration: {
                    $divide: [
                        { $subtract: ['$completedAt', '$startedAt'] },
                        1000 * 60 * 60 * 24 // Convert to days
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgDuration: { $avg: '$duration' }
            }
        }
    ]);

    const averageResolutionTime = completedWithDuration.length > 0 ? completedWithDuration[0].avgDuration : 0;

    // Calculate total cost savings
    const costSavingsAgg = await ClinicalIntervention.aggregate([
        { $match: { ...baseQuery, 'outcomes.successMetrics.costSavings': { $exists: true } } },
        {
            $group: {
                _id: null,
                totalSavings: { $sum: '$outcomes.successMetrics.costSavings' }
            }
        }
    ]);

    const totalCostSavings = costSavingsAgg.length > 0 ? costSavingsAgg[0].totalSavings : 0;

    // Get category distribution
    const categoryDistribution = await ClinicalIntervention.aggregate([
        { $match: baseQuery },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                name: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$_id', 'drug_therapy_problem'] }, then: 'Drug Therapy Problem' },
                            { case: { $eq: ['$_id', 'adverse_drug_reaction'] }, then: 'Adverse Drug Reaction' },
                            { case: { $eq: ['$_id', 'medication_nonadherence'] }, then: 'Medication Non-adherence' },
                            { case: { $eq: ['$_id', 'drug_interaction'] }, then: 'Drug Interaction' },
                            { case: { $eq: ['$_id', 'dosing_issue'] }, then: 'Dosing Issue' },
                            { case: { $eq: ['$_id', 'contraindication'] }, then: 'Contraindication' },
                            { case: { $eq: ['$_id', 'other'] }, then: 'Other' }
                        ],
                        default: '$_id'
                    }
                },
                value: '$count',
                successRate: {
                    $cond: [
                        { $gt: ['$count', 0] },
                        { $multiply: [{ $divide: ['$completed', '$count'] }, 100] },
                        0
                    ]
                },
                color: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$_id', 'drug_therapy_problem'] }, then: '#f44336' },
                            { case: { $eq: ['$_id', 'adverse_drug_reaction'] }, then: '#ff9800' },
                            { case: { $eq: ['$_id', 'medication_nonadherence'] }, then: '#2196f3' },
                            { case: { $eq: ['$_id', 'drug_interaction'] }, then: '#9c27b0' },
                            { case: { $eq: ['$_id', 'dosing_issue'] }, then: '#4caf50' },
                            { case: { $eq: ['$_id', 'contraindication'] }, then: '#e91e63' },
                            { case: { $eq: ['$_id', 'other'] }, then: '#607d8b' }
                        ],
                        default: '#757575'
                    }
                }
            }
        },
        { $sort: { value: -1 } }
    ]);

    // Get priority distribution
    const priorityDistribution = await ClinicalIntervention.aggregate([
        { $match: baseQuery },
        {
            $group: {
                _id: '$priority',
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                name: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$_id', 'critical'] }, then: 'Critical' },
                            { case: { $eq: ['$_id', 'high'] }, then: 'High' },
                            { case: { $eq: ['$_id', 'medium'] }, then: 'Medium' },
                            { case: { $eq: ['$_id', 'low'] }, then: 'Low' }
                        ],
                        default: '$_id'
                    }
                },
                value: '$count',
                color: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$_id', 'critical'] }, then: '#f44336' },
                            { case: { $eq: ['$_id', 'high'] }, then: '#ff9800' },
                            { case: { $eq: ['$_id', 'medium'] }, then: '#2196f3' },
                            { case: { $eq: ['$_id', 'low'] }, then: '#4caf50' }
                        ],
                        default: '#757575'
                    }
                }
            }
        },
        { $sort: { value: -1 } }
    ]);

    // Get monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await ClinicalIntervention.aggregate([
        {
            $match: {
                workplaceId,
                isDeleted: { $ne: true },
                identifiedDate: { $gte: sixMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$identifiedDate' },
                    month: { $month: '$identifiedDate' }
                },
                total: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                month: {
                    $dateToString: {
                        format: '%Y-%m',
                        date: {
                            $dateFromParts: {
                                year: '$_id.year',
                                month: '$_id.month'
                            }
                        }
                    }
                },
                total: 1,
                completed: 1,
                successRate: {
                    $cond: [
                        { $gt: ['$total', 0] },
                        { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
                        0
                    ]
                }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get recent interventions
    const recentInterventions = await ClinicalIntervention.find({
        workplaceId,
        isDeleted: { $ne: true }
    })
        .populate('patientId', 'firstName lastName')
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName')
        .sort({ identifiedDate: -1 })
        .limit(10)
        .lean();

    // Format recent interventions for dashboard
    const formattedRecentInterventions = recentInterventions.map(intervention => ({
        _id: intervention._id.toString(),
        interventionNumber: intervention.interventionNumber,
        category: intervention.category,
        priority: intervention.priority,
        status: intervention.status,
        patientName: intervention.patientId ?
            `${(intervention.patientId as any).firstName} ${(intervention.patientId as any).lastName}` :
            'Unknown Patient',
        identifiedDate: intervention.identifiedDate.toISOString(),
        assignedTo: intervention.assignments && intervention.assignments.length > 0 ?
            `${(intervention.assignments[0].userId as any)?.firstName} ${(intervention.assignments[0].userId as any)?.lastName}` :
            undefined
    }));

    return {
        totalInterventions,
        activeInterventions,
        completedInterventions,
        overdueInterventions,
        successRate,
        averageResolutionTime,
        totalCostSavings,
        categoryDistribution,
        priorityDistribution,
        monthlyTrends,
        recentInterventions: formattedRecentInterventions
    };
} catch (error) {
    logger.error('Error getting dashboard metrics:', error);
    throw error;
}
};

/**
 * Generate comprehensive outcome report
 */
ClinicalInterventionService.generateOutcomeReport = async (
  workplaceId: mongoose.Types.ObjectId,
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    category?: string;
    priority?: string;
    outcome?: string;
    pharmacist?: string;
  },
  isSuperAdmin: boolean = false
): Promise<any> => {
  try {
    const { dateFrom, dateTo, category, priority, outcome, pharmacist } =
      filters;

    // Build base query
    const baseQuery: any = {
      isDeleted: { $ne: true },
      // Include all interventions, not just completed ones for better reporting
    };

    // Add workplaceId filter only if not super_admin
    if (!isSuperAdmin) {
      baseQuery.workplaceId = workplaceId;
    }

    // Add date filter - use identifiedDate if completedAt is not available
    if (dateFrom || dateTo) {
      const dateQuery: any = {};
      if (dateFrom) dateQuery.$gte = dateFrom;
      if (dateTo) dateQuery.$lte = dateTo;
      
      // Use $or to check both completedAt and identifiedDate
      baseQuery.$or = [
        { completedAt: dateQuery },
        { identifiedDate: dateQuery }
      ];
    }

    // Add category filter
    if (category && category !== 'all') {
      baseQuery.category = category;
    }

    // Add priority filter
    if (priority && priority !== 'all') {
      baseQuery.priority = priority;
    }

    // Add outcome filter
    if (outcome && outcome !== 'all') {
      baseQuery['outcomes.patientResponse'] = outcome;
    }

    // Add pharmacist filter
    if (pharmacist && pharmacist !== 'all') {
      baseQuery.identifiedBy = new mongoose.Types.ObjectId(pharmacist);
    }

    // Get summary statistics
    const totalInterventions = await ClinicalIntervention.countDocuments(
      baseQuery
    );

    // Count successful interventions - include both completed with outcomes and those with positive status
    const successfulInterventions = await ClinicalIntervention.countDocuments({
      ...baseQuery,
      $or: [
        { 'outcomes.patientResponse': 'improved' },
        { status: 'completed' },
        { status: 'resolved' }
      ]
    });

    const successRate =
      totalInterventions > 0
        ? (successfulInterventions / totalInterventions) * 100
        : 0;

    // Calculate total cost savings
    const costSavingsAgg = await ClinicalIntervention.aggregate([
      {
        $match: {
          ...baseQuery,
          'outcomes.successMetrics.costSavings': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalSavings: { $sum: '$outcomes.successMetrics.costSavings' },
        },
      },
    ]);

    const totalCostSavings =
      costSavingsAgg.length > 0 ? costSavingsAgg[0].totalSavings : 0;

    // Calculate average resolution time - use available date fields
    const resolutionTimeAgg = await ClinicalIntervention.aggregate([
      { 
        $match: { 
          ...baseQuery, 
          $or: [
            { completedAt: { $exists: true }, startedAt: { $exists: true } },
            { completedAt: { $exists: true }, identifiedDate: { $exists: true } },
            { updatedAt: { $exists: true }, identifiedDate: { $exists: true } }
          ]
        } 
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              {
                $subtract: [
                  { $ifNull: ['$completedAt', '$updatedAt'] },
                  { $ifNull: ['$startedAt', '$identifiedDate'] }
                ]
              },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
        },
      },
    ]);

    const averageResolutionTime =
      resolutionTimeAgg.length > 0 ? resolutionTimeAgg[0].avgResolutionTime : 0;

    // Get category analysis
    const categoryAnalysis = await ClinicalIntervention.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$outcomes.patientResponse', 'improved'] },
                    { $eq: ['$status', 'completed'] },
                    { $eq: ['$status', 'resolved'] }
                  ]
                }, 
                1, 
                0
              ],
            },
          },
          totalCostSavings: { $sum: { $ifNull: ['$outcomes.successMetrics.costSavings', 0] } },
          totalResolutionTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: [{ $ifNull: ['$completedAt', '$updatedAt'] }, false] },
                    { $ifNull: [{ $ifNull: ['$startedAt', '$identifiedDate'] }, false] }
                  ]
                },
                {
                  $divide: [
                    {
                      $subtract: [
                        { $ifNull: ['$completedAt', '$updatedAt'] },
                        { $ifNull: ['$startedAt', '$identifiedDate'] }
                      ]
                    },
                    1000 * 60 * 60 * 24,
                  ]
                },
                0
              ]
            },
          },
        },
      },
      {
        $project: {
          category: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$_id', 'drug_therapy_problem'] },
                  then: 'Drug Therapy Problem',
                },
                {
                  case: { $eq: ['$_id', 'adverse_drug_reaction'] },
                  then: 'Adverse Drug Reaction',
                },
                {
                  case: { $eq: ['$_id', 'medication_nonadherence'] },
                  then: 'Medication Non-adherence',
                },
                {
                  case: { $eq: ['$_id', 'drug_interaction'] },
                  then: 'Drug Interaction',
                },
                {
                  case: { $eq: ['$_id', 'dosing_issue'] },
                  then: 'Dosing Issue',
                },
                {
                  case: { $eq: ['$_id', 'contraindication'] },
                  then: 'Contraindication',
                },
                { case: { $eq: ['$_id', 'other'] }, then: 'Other' },
              ],
              default: '$_id',
            },
          },
          total: 1,
          successful: 1,
          successRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$successful', '$total'] }, 100] },
              0,
            ],
          },
          avgCostSavings: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$totalCostSavings', '$total'] },
              0,
            ],
          },
          avgResolutionTime: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$totalResolutionTime', '$total'] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Get trend analysis (monthly for the past 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trendAnalysis = await ClinicalIntervention.aggregate([
      {
        $match: {
          ...baseQuery,
          $or: [
            { completedAt: { $gte: sixMonthsAgo } },
            { identifiedDate: { $gte: sixMonthsAgo } }
          ]
        },
      },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ['$completedAt', '$identifiedDate'] } },
            month: { $month: { $ifNull: ['$completedAt', '$identifiedDate'] } },
          },
          interventions: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$outcomes.patientResponse', 'improved'] },
                    { $eq: ['$status', 'completed'] },
                    { $eq: ['$status', 'resolved'] }
                  ]
                }, 
                1, 
                0
              ],
            },
          },
          costSavings: { $sum: { $ifNull: ['$outcomes.successMetrics.costSavings', 0] } },
          totalResolutionTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: [{ $ifNull: ['$completedAt', '$updatedAt'] }, false] },
                    { $ifNull: [{ $ifNull: ['$startedAt', '$identifiedDate'] }, false] }
                  ]
                },
                {
                  $divide: [
                    {
                      $subtract: [
                        { $ifNull: ['$completedAt', '$updatedAt'] },
                        { $ifNull: ['$startedAt', '$identifiedDate'] }
                      ]
                    },
                    1000 * 60 * 60 * 24,
                  ]
                },
                0
              ]
            },
          },
        },
      },
      {
        $project: {
          period: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                },
              },
            },
          },
          interventions: 1,
          successRate: {
            $cond: [
              { $gt: ['$interventions', 0] },
              {
                $multiply: [
                  { $divide: ['$successful', '$interventions'] },
                  100,
                ],
              },
              0,
            ],
          },
          costSavings: 1,
          resolutionTime: {
            $cond: [
              { $gt: ['$interventions', 0] },
              { $divide: ['$totalResolutionTime', '$interventions'] },
              0,
            ],
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Get detailed outcomes - sort by available date fields
    const detailedOutcomes = await ClinicalIntervention.find(baseQuery)
      .populate('patientId', 'firstName lastName')
      .populate('identifiedBy', 'firstName lastName')
      .sort({ completedAt: -1, identifiedDate: -1, updatedAt: -1 })
      .limit(100)
      .lean();

    const formattedDetailedOutcomes = detailedOutcomes.map((intervention) => ({
      interventionId: intervention._id.toString(),
      interventionNumber: intervention.interventionNumber,
      patientName: intervention.patientId
        ? `${(intervention.patientId as any).firstName} ${(intervention.patientId as any).lastName
        }`
        : 'Unknown Patient',
      category: intervention.category,
      priority: intervention.priority,
      outcome: intervention.outcomes?.patientResponse || 'unknown',
      costSavings: intervention.outcomes?.successMetrics?.costSavings || 0,
      resolutionTime: (() => {
        const endDate = intervention.completedAt || intervention.updatedAt;
        const startDate = intervention.startedAt || intervention.identifiedDate;
        return endDate && startDate
          ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
      })(),
      patientResponse: intervention.outcomes?.patientResponse || 'unknown',
      completedDate: (intervention.completedAt || intervention.updatedAt)?.toISOString() || '',
    }));

    // Calculate comparative analysis (current vs previous period)
    const periodLength =
      dateTo && dateFrom
        ? dateTo.getTime() - dateFrom.getTime()
        : 30 * 24 * 60 * 60 * 1000; // Default to 30 days

    const previousPeriodStart = new Date(
      (dateFrom || new Date()).getTime() - periodLength
    );
    const previousPeriodEnd = dateFrom || new Date();

    const previousPeriodQuery = {
      ...baseQuery,
      $or: [
        { completedAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd } },
        { identifiedDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd } }
      ]
    };

    const previousPeriodTotal = await ClinicalIntervention.countDocuments(
      previousPeriodQuery
    );
    const previousPeriodSuccessful = await ClinicalIntervention.countDocuments({
      ...previousPeriodQuery,
      $or: [
        { 'outcomes.patientResponse': 'improved' },
        { status: 'completed' },
        { status: 'resolved' }
      ]
    });

    const previousPeriodSuccessRate =
      previousPeriodTotal > 0
        ? (previousPeriodSuccessful / previousPeriodTotal) * 100
        : 0;

    const previousPeriodCostSavings = await ClinicalIntervention.aggregate([
      {
        $match: previousPeriodQuery,
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$outcomes.successMetrics.costSavings', 0] } },
        },
      },
    ]);

    const prevCostSavings =
      previousPeriodCostSavings.length > 0
        ? previousPeriodCostSavings[0].total
        : 0;

    const comparativeAnalysis = {
      currentPeriod: {
        interventions: totalInterventions,
        successRate: successRate,
        costSavings: totalCostSavings,
      },
      previousPeriod: {
        interventions: previousPeriodTotal,
        successRate: previousPeriodSuccessRate,
        costSavings: prevCostSavings,
      },
      percentageChange: {
        interventions:
          previousPeriodTotal > 0
            ? ((totalInterventions - previousPeriodTotal) /
              previousPeriodTotal) *
            100
            : 0,
        successRate:
          previousPeriodSuccessRate > 0
            ? ((successRate - previousPeriodSuccessRate) /
              previousPeriodSuccessRate) *
            100
            : 0,
        costSavings:
          prevCostSavings > 0
            ? ((totalCostSavings - prevCostSavings) / prevCostSavings) * 100
            : 0,
      },
    };

    return {
      summary: {
        totalInterventions,
        completedInterventions: totalInterventions,
        successfulInterventions,
        successRate,
        totalCostSavings,
        averageResolutionTime,
        patientSatisfactionScore: 4.5, // Mock value - would come from patient feedback system
      },
      categoryAnalysis,
      trendAnalysis,
      comparativeAnalysis,
      detailedOutcomes: formattedDetailedOutcomes,
    };
  } catch (error) {
    logger.error('Error generating outcome report:', error);
    throw error;
  }
};

/**
 * Calculate cost savings with configurable parameters
 */
ClinicalInterventionService.calculateCostSavings = async (
  interventions: IClinicalIntervention[],
  parameters: {
    adverseEventCost?: number;
    hospitalAdmissionCost?: number;
    medicationWasteCost?: number;
    pharmacistHourlyCost?: number;
  } = {}
): Promise<{
  totalSavings: number;
  breakdown: {
    adverseEventsAvoided: number;
    hospitalAdmissionsAvoided: number;
    medicationWasteReduced: number;
    interventionCost: number;
  };
}> => {
  try {
    const {
      adverseEventCost = 5000,
      hospitalAdmissionCost = 15000,
      medicationWasteCost = 200,
      pharmacistHourlyCost = 50,
    } = parameters;

    let adverseEventsAvoided = 0;
    let hospitalAdmissionsAvoided = 0;
    let medicationWasteReduced = 0;
    let totalInterventionTime = 0;

    interventions.forEach((intervention) => {
      // Count interventions that prevented adverse events
      if (
        intervention.category === 'adverse_drug_reaction' &&
        intervention.outcomes?.patientResponse === 'improved'
      ) {
        adverseEventsAvoided++;
      }

      // Count interventions that prevented hospitalizations
      if (
        ['contraindication', 'drug_interaction'].includes(
          intervention.category
        ) &&
        intervention.outcomes?.patientResponse === 'improved'
      ) {
        hospitalAdmissionsAvoided++;
      }

      // Count interventions that reduced medication waste
      if (
        ['medication_nonadherence', 'dosing_issue'].includes(
          intervention.category
        ) &&
        intervention.outcomes?.patientResponse === 'improved'
      ) {
        medicationWasteReduced++;
      }

      // Add intervention time
      if (intervention.actualDuration) {
        totalInterventionTime += intervention.actualDuration;
      } else if (intervention.estimatedDuration) {
        totalInterventionTime += intervention.estimatedDuration;
      } else {
        totalInterventionTime += 30; // Default 30 minutes
      }
    });

    const breakdown = {
      adverseEventsAvoided: adverseEventsAvoided * adverseEventCost,
      hospitalAdmissionsAvoided:
        hospitalAdmissionsAvoided * hospitalAdmissionCost,
      medicationWasteReduced: medicationWasteReduced * medicationWasteCost,
      interventionCost: (totalInterventionTime / 60) * pharmacistHourlyCost,
    };

    const totalSavings =
      breakdown.adverseEventsAvoided +
      breakdown.hospitalAdmissionsAvoided +
      breakdown.medicationWasteReduced -
      breakdown.interventionCost;

    return {
      totalSavings: Math.max(0, totalSavings), // Ensure non-negative
      breakdown,
    };
  } catch (error) {
    logger.error('Error calculating cost savings:', error);
    throw error;
  }
};

// ===============================
// ANALYTICS WRAPPER FUNCTIONS
// ===============================

// Standalone function to avoid circular reference issues
async function getDashboardMetrics(
  workplaceId: mongoose.Types.ObjectId,
  dateRange: { from: Date; to: Date },
  isSuperAdmin: boolean = false
): Promise<any> {
  try {
    const { from, to } = dateRange;

    // Base query for the date range
    const baseQuery: any = {
      isDeleted: { $ne: true },
      identifiedDate: { $gte: from, $lte: to },
    };

    // Add workplaceId filter only if not super_admin
    if (!isSuperAdmin) {
      baseQuery.workplaceId = workplaceId;
    }

    // Get basic counts
    const [
      totalInterventions,
      completedInterventions,
      inProgressInterventions,
      pendingInterventions,
    ] = await Promise.all([
      ClinicalIntervention.countDocuments(baseQuery),
      ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: 'completed',
      }),
      ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: 'in_progress',
      }),
      ClinicalIntervention.countDocuments({
        ...baseQuery,
        status: 'identified',
      }),
    ]);

    // Get overdue interventions (assuming followUp.scheduledDate < now)
    const now = new Date();
    const overdueInterventions = await ClinicalIntervention.countDocuments({
      ...baseQuery,
      status: { $nin: ['completed', 'cancelled'] },
      'followUp.scheduledDate': { $lt: now },
    });

    // Get category breakdown
    const categoryBreakdown = await ClinicalIntervention.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get priority breakdown
    const priorityBreakdown = await ClinicalIntervention.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Calculate success/completion rate
    const successRate =
      totalInterventions > 0
        ? (completedInterventions / totalInterventions) * 100
        : 0;

    // Calculate average resolution time (in days)
    const averageResolutionResult = await ClinicalIntervention.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { $exists: true },
        },
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$completedAt', '$identifiedDate'] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageResolutionTime: { $avg: '$resolutionTime' },
        },
      },
    ]);

    const averageResolutionTime =
      averageResolutionResult.length > 0
        ? Math.round(averageResolutionResult[0].averageResolutionTime * 10) / 10
        : 0;

    // Get recent interventions with patient data
    const recentInterventions = await ClinicalIntervention.find(baseQuery)
      .sort({ identifiedDate: -1 })
      .limit(5)
      .populate('patientId', 'firstName lastName mrn')
      .select(
        'interventionNumber category priority status identifiedDate assignments patientId'
      )
      .lean();

    // Color schemes for charts
    const categoryColors = [
      '#8884d8',
      '#82ca9d',
      '#ffc658',
      '#ff7c7c',
      '#8dd1e1',
      '#d084d0',
      '#ffb347',
    ];
    const priorityColors = ['#ff4444', '#ffaa44', '#44aa44', '#4444ff'];

    // Format category distribution for frontend
    const categoryDistribution = categoryBreakdown.map((item, index) => ({
      name: formatCategoryName(item._id),
      value: item.count,
      successRate: Math.round((item.count / totalInterventions) * 100), // Simplified success rate
      color: categoryColors[index % categoryColors.length],
    }));

    // Format priority distribution for frontend
    const priorityDistribution = priorityBreakdown.map((item, index) => ({
      name: formatPriorityName(item._id),
      value: item.count,
      color: priorityColors[index % priorityColors.length],
    }));

    // Generate monthly trends (simplified for now - you may want to make this more sophisticated)
    const monthlyTrends = [
      {
        month: 'Current',
        total: totalInterventions,
        completed: completedInterventions,
        successRate: successRate,
      },
    ];

    // Format recent interventions for frontend
    const formattedRecentInterventions = recentInterventions.map(
      (intervention: any) => ({
        _id: intervention._id.toString(),
        interventionNumber: intervention.interventionNumber,
        category: formatCategoryName(intervention.category),
        priority: formatPriorityName(intervention.priority),
        status: intervention.status,
        patientName: intervention.patientId 
          ? `${intervention.patientId.firstName} ${intervention.patientId.lastName}`
          : 'Unknown Patient',
        identifiedDate: intervention.identifiedDate,
        assignedTo:
          intervention.assignments && intervention.assignments.length > 0
            ? intervention.assignments[0].userId?.toString()
            : undefined,
      })
    );

    return {
      totalInterventions,
      activeInterventions: inProgressInterventions,
      completedInterventions,
      overdueInterventions,
      successRate: Math.round(successRate * 100) / 100,
      averageResolutionTime,
      totalCostSavings: 0, // TODO: Implement cost savings calculation
      categoryDistribution,
      priorityDistribution,
      monthlyTrends,
      recentInterventions: formattedRecentInterventions,
    };
  } catch (error) {
    logger.error('Error getting dashboard metrics:', error);
    throw error;
  }
}

// Helper functions for formatting
function formatCategoryName(category: string): string {
  const categoryMap: { [key: string]: string } = {
    drug_therapy_problem: 'Drug Therapy Problem',
    adverse_drug_reaction: 'Adverse Drug Reaction',
    medication_nonadherence: 'Medication Non-adherence',
    drug_interaction: 'Drug Interaction',
    dosing_issue: 'Dosing Issue',
    contraindication: 'Contraindication',
    other: 'Other',
  };
  return categoryMap[category] || category;
}

function formatPriorityName(priority: string): string {
  const priorityMap: { [key: string]: string } = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return priorityMap[priority] || priority;
}

// ===============================
// MISSING UTILITY METHODS
// ===============================

/**
 * Check for duplicate interventions
 */
async function checkDuplicates(
  patientId: mongoose.Types.ObjectId,
  category: string,
  workplaceId: mongoose.Types.ObjectId
): Promise<IClinicalIntervention[]> {
  try {
    const duplicates = await ClinicalIntervention.find({
      patientId,
      category,
      workplaceId,
      status: { $nin: ['completed', 'cancelled'] },
      isDeleted: false,
    })
      .populate('identifiedByUser', 'firstName lastName email')
      .sort({ identifiedDate: -1 })
      .lean();

    return duplicates;
  } catch (error) {
    logger.error('Error checking for duplicates:', error);
    throw error;
  }
}

/**
 * Get category counts
 */
async function getCategoryCounts(workplaceId: mongoose.Types.ObjectId): Promise<Record<string, number>> {
  try {
    const categoryCounts = await ClinicalIntervention.aggregate([
      {
        $match: {
          workplaceId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {};
    categoryCounts.forEach((item) => {
      result[item._id] = item.count;
    });

    return result;
  } catch (error) {
    logger.error('Error getting category counts:', error);
    throw error;
  }
}

/**
 * Get priority distribution
 */
async function getPriorityDistribution(workplaceId: mongoose.Types.ObjectId): Promise<Record<string, number>> {
  try {
    const priorityDistribution = await ClinicalIntervention.aggregate([
      {
        $match: {
          workplaceId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {};
    priorityDistribution.forEach((item) => {
      result[item._id] = item.count;
    });

    return result;
  } catch (error) {
    logger.error('Error getting priority distribution:', error);
    throw error;
  }
}

// Assign the standalone functions to the service
ClinicalInterventionService.getDashboardMetrics = getDashboardMetrics;

export default ClinicalInterventionService;
