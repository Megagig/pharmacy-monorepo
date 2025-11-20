import mongoose from 'mongoose';
import { Workplace, IWorkplace } from '../models/Workplace';
import User, { IUser } from '../models/User';
import PricingPlan from '../models/PricingPlan';
import logger from '../utils/logger';
import { SecurityAuditLog } from '../models/SecurityAuditLog';

export interface TenantProvisioningData {
  name: string;
  type: 'pharmacy' | 'clinic' | 'hospital' | 'chain';
  contactInfo: {
    email: string;
    phone?: string;
    address: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    website?: string;
  };
  primaryContact: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  subscriptionPlanId: string;
  settings?: {
    timezone?: string;
    currency?: string;
    language?: string;
  };
  features?: string[];
  limits?: {
    maxUsers?: number;
    maxPatients?: number;
    storageLimit?: number;
    apiCallsPerMonth?: number;
  };
}

export interface TenantStatusUpdate {
  status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
  reason?: string;
  suspensionDetails?: {
    reason: string;
    suspendedBy: string;
    suspendedAt: Date;
    autoReactivateAt?: Date;
  };
}

export interface TenantUsageUpdate {
  currentUsers?: number;
  currentPatients?: number;
  storageUsed?: number;
  apiCallsThisMonth?: number;
}

export interface TenantFilters {
  status?: string[];
  type?: string[];
  subscriptionStatus?: string[];
  search?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  lastActivityAfter?: Date;
  lastActivityBefore?: Date;
}

export interface TenantListOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeUsage?: boolean;
  includeSettings?: boolean;
}

export interface TenantBrandingUpdate {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface TenantLimitsUpdate {
  maxUsers?: number;
  maxPatients?: number;
  storageLimit?: number;
  apiCallsPerMonth?: number;
  maxWorkspaces?: number;
  maxIntegrations?: number;
}

export interface TenantCustomizationUpdate {
  branding?: TenantBrandingUpdate;
  limits?: TenantLimitsUpdate;
  features?: string[];
  settings?: {
    timezone?: string;
    currency?: string;
    language?: string;
  };
}

export class TenantManagementService {
  /**
   * Transform Workplace to Tenant format for frontend compatibility
   */
  private async transformWorkplaceToTenant(workplace: IWorkplace): Promise<any> {
    // Get actual subscription and plan data
    const Subscription = mongoose.model('Subscription');
    
    let actualSubscription = null;
    let actualPlan = null;
    let subscriptionStatus = workplace.subscriptionStatus;
    let planName = 'Free Trial';
    
    if (workplace.currentSubscriptionId) {
      actualSubscription = await Subscription.findById(workplace.currentSubscriptionId);
      
      if (actualSubscription) {
        subscriptionStatus = actualSubscription.status;
        
        // Manually fetch the plan using PricingPlan model
        if (actualSubscription.planId) {
          actualPlan = await PricingPlan.findById(actualSubscription.planId);
          if (actualPlan) {
            planName = actualPlan.name;
          }
        }
      }
    } else if (workplace.currentPlanId) {
      actualPlan = await PricingPlan.findById(workplace.currentPlanId);
      if (actualPlan) {
        planName = actualPlan.name;
      }
    }

    // Calculate real usage metrics - use consistent query
    const userCount = await User.countDocuments({ 
      workplaceId: workplace._id
    });

    // Get patient count (assuming you have a Patient model)
    let patientCount = 0;
    try {
      const Patient = mongoose.model('Patient');
      patientCount = await Patient.countDocuments({ workplaceId: workplace._id });
    } catch (error) {
      // Patient model might not exist, use stats
      patientCount = workplace.stats?.patientsCount || 0;
    }

    return {
      _id: workplace._id,
      name: workplace.name,
      slug: workplace.name.toLowerCase().replace(/\s+/g, '-'),
      type: workplace.type.toLowerCase(),
      status: subscriptionStatus === 'active' ? 'active' : 
              subscriptionStatus === 'trial' ? 'trial' : 
              subscriptionStatus === 'canceled' ? 'cancelled' : 'pending',
      subscriptionStatus: subscriptionStatus,
      planName: planName,
      contactInfo: {
        email: workplace.email,
        phone: workplace.phone,
      },
      createdAt: workplace.createdAt,
      lastActivity: workplace.updatedAt,
      // Real usage metrics
      usageMetrics: {
        currentUsers: userCount,
        currentPatients: patientCount,
        storageUsed: 0, // TODO: Calculate actual storage if needed
        apiCallsThisMonth: 0, // TODO: Calculate actual API calls if needed
        lastCalculatedAt: new Date(),
      },
      // Get limits from actual plan or defaults
      limits: actualPlan?.features ? {
        maxUsers: actualPlan.features.teamSize || 50,
        maxPatients: actualPlan.features.patientLimit || 1000,
        storageLimit: 5000, // TODO: Add to plan features if needed
        apiCallsPerMonth: 10000, // TODO: Add to plan features if needed
      } : {
        maxUsers: 50,
        maxPatients: 1000,
        storageLimit: 5000,
        apiCallsPerMonth: 10000,
      },
      // Get features from actual plan
      features: actualPlan?.features ? Object.keys(actualPlan.features).filter(key => 
        actualPlan.features[key] === true
      ) : [],
      branding: {
        primaryColor: '#1976d2',
        secondaryColor: '#dc004e',
      },
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        language: 'en',
      },
      // Include plan and subscription info
      currentPlan: actualPlan,
      currentSubscription: actualSubscription,
    };
  }

  /**
   * Provision a new tenant workspace (simplified)
   */
  async provisionTenant(
    tenantData: TenantProvisioningData,
    adminId: string
  ): Promise<any> {
    try {
      // Create a new workplace
      const workplace = new Workplace({
        name: tenantData.name,
        type: tenantData.type,
        email: tenantData.contactInfo.email,
        phone: tenantData.contactInfo.phone,
        address: tenantData.contactInfo.address?.street,
        ownerId: new mongoose.Types.ObjectId(adminId),
        subscriptionStatus: 'trial',
      });

      await workplace.save();
      
      logger.info(`Tenant provisioned: ${workplace.name}`);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error provisioning tenant:', error);
      throw error;
    }
  }

  /**
   * Deprovision a tenant workspace
   */
  async deprovisionTenant(
    tenantId: string,
    adminId: string,
    options: {
      deleteData?: boolean;
      reason?: string;
      transferDataTo?: string;
    } = {}
  ): Promise<void> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      if (options.deleteData) {
        // Remove all users from this workspace
        await User.updateMany(
          { workplaceId: tenantId },
          { $unset: { workplaceId: 1 }, status: 'suspended' }
        );
        
        // Delete the workplace
        await Workplace.findByIdAndDelete(tenantId);
      } else {
        // Just mark as cancelled
        workplace.subscriptionStatus = 'canceled';
        await workplace.save();
      }

      logger.info(`Tenant deprovisioned: ${workplace.name}`);
    } catch (error) {
      logger.error('Error deprovisioning tenant:', error);
      throw error;
    }
  }

  /**
   * Update tenant status
   */
  async updateTenantStatus(
    tenantId: string,
    statusUpdate: TenantStatusUpdate,
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      workplace.subscriptionStatus = statusUpdate.status as any;
      await workplace.save();

      logger.info(`Tenant status updated: ${workplace.name} -> ${statusUpdate.status}`);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant status:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID with optional population
   */
  async getTenantById(
    tenantId: string,
    options: {
      includeSettings?: boolean;
      includeUsers?: boolean;
      includeUsage?: boolean;
    } = {}
  ): Promise<any | null> {
    try {
      let query = Workplace.findById(tenantId)
        .populate('ownerId', 'firstName lastName email')
        .populate('currentSubscriptionId')
        .populate('currentPlanId');

      const tenant = await query.exec();
      
      if (!tenant) {
        return null;
      }

      // Include additional data if requested
      if (options.includeUsers) {
        const users = await User.find({ workplaceId: tenant._id }).select('firstName lastName email role status');
        (tenant as any).users = users;
      }

      if (options.includeUsage) {
        // Calculate real-time usage metrics
        const userCount = await User.countDocuments({ workplaceId: tenant._id, status: 'active' });
        
        // Update the stats
        tenant.stats.usersCount = userCount;
        tenant.stats.lastUpdated = new Date();
      }

      return await this.transformWorkplaceToTenant(tenant);
    } catch (error) {
      logger.error('Error getting tenant by ID:', error);
      throw error;
    }
  }

  /**
   * List tenants with filtering and pagination
   */
  async listTenants(
    filters: TenantFilters = {},
    options: TenantListOptions = {}
  ): Promise<{
    tenants: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeUsage = false,
        includeSettings = false,
      } = options;

      // Build query
      const query: any = {};

      if (filters.status?.length) {
        query.subscriptionStatus = { $in: filters.status };
      }

      if (filters.type?.length) {
        query.type = { $in: filters.type };
      }

      if (filters.subscriptionStatus?.length) {
        query.subscriptionStatus = { $in: filters.subscriptionStatus };
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
        ];
      }

      if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) {
          query.createdAt.$gte = filters.createdAfter;
        }
        if (filters.createdBefore) {
          query.createdAt.$lte = filters.createdBefore;
        }
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      let tenantQuery = Workplace.find(query)
        .populate('ownerId', 'firstName lastName email')
        .populate('currentSubscriptionId')
        .populate('currentPlanId')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const [tenants, total] = await Promise.all([
        tenantQuery.exec(),
        Workplace.countDocuments(query),
      ]);

      // Include usage data if requested
      if (includeUsage) {
        for (const tenant of tenants) {
          const userCount = await User.countDocuments({ 
            workplaceId: tenant._id, 
            status: 'active' 
          });
          // Update the stats
          tenant.stats.usersCount = userCount;
          tenant.stats.lastUpdated = new Date();
        }
      }

      // Transform workplaces to tenant format
      const transformedTenants = await Promise.all(
        tenants.map(workplace => this.transformWorkplaceToTenant(workplace))
      );

      return {
        tenants: transformedTenants,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error listing tenants:', error);
      throw error;
    }
  }

  /**
   * Update tenant usage metrics
   */
  async updateTenantUsage(
    tenantId: string,
    usageUpdate: TenantUsageUpdate
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // Update stats
      if (usageUpdate.currentUsers !== undefined) {
        workplace.stats.usersCount = usageUpdate.currentUsers;
      }
      if (usageUpdate.currentPatients !== undefined) {
        workplace.stats.patientsCount = usageUpdate.currentPatients;
      }
      
      workplace.stats.lastUpdated = new Date();
      await workplace.save();

      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant usage:', error);
      throw error;
    }
  }

  /**
   * Validate data isolation for a tenant
   */
  async validateDataIsolation(tenantId: string): Promise<{
    isValid: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    try {
      const violations: string[] = [];
      const recommendations: string[] = [];

      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // Check for users without proper workspace assignment
      const usersWithoutWorkspace = await User.countDocuments({
        workplaceId: { $ne: tenantId },
        $or: [
          { workplaceId: { $exists: false } },
          { workplaceId: null },
        ],
      });

      if (usersWithoutWorkspace > 0) {
        violations.push(`${usersWithoutWorkspace} users found without proper workspace assignment`);
        recommendations.push('Assign users to appropriate workspaces or deactivate orphaned accounts');
      }

      return {
        isValid: violations.length === 0,
        violations,
        recommendations,
      };
    } catch (error) {
      logger.error('Error validating data isolation:', error);
      throw error;
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStatistics(): Promise<{
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    canceledTenants: number;
    totalUsers: number;
    averageUsersPerTenant: number;
  }> {
    try {
      const [
        totalTenants,
        activeTenants,
        trialTenants,
        canceledTenants,
        totalUsers,
      ] = await Promise.all([
        Workplace.countDocuments(),
        Workplace.countDocuments({ subscriptionStatus: 'active' }),
        Workplace.countDocuments({ subscriptionStatus: 'trial' }),
        Workplace.countDocuments({ subscriptionStatus: 'canceled' }),
        User.countDocuments({ status: 'active' }),
      ]);

      return {
        totalTenants,
        activeTenants,
        trialTenants,
        canceledTenants,
        totalUsers,
        averageUsersPerTenant: totalTenants > 0 ? Math.round(totalUsers / totalTenants) : 0,
      };
    } catch (error) {
      logger.error('Error getting tenant statistics:', error);
      throw error;
    }
  }

  /**
   * Update tenant branding and theming
   */
  async updateTenantBranding(
    tenantId: string,
    brandingUpdate: TenantBrandingUpdate,
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // For now, just log the branding update since Workplace model doesn't have branding fields
      logger.info(`Branding update requested for workspace: ${workplace.name}`, brandingUpdate);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant branding:', error);
      throw error;
    }
  }

  /**
   * Update tenant limits and quotas
   */
  async updateTenantLimits(
    tenantId: string,
    limitsUpdate: TenantLimitsUpdate,
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // For now, just log the limits update since Workplace model doesn't have limits fields
      logger.info(`Limits update requested for workspace: ${workplace.name}`, limitsUpdate);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant limits:', error);
      throw error;
    }
  }

  /**
   * Update tenant feature configuration
   */
  async updateTenantFeatures(
    tenantId: string,
    features: string[],
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // For now, just log the features update since Workplace model doesn't have features fields
      logger.info(`Features update requested for workspace: ${workplace.name}`, features);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant features:', error);
      throw error;
    }
  }

  /**
   * Update comprehensive tenant customization
   */
  async updateTenantCustomization(
    tenantId: string,
    customization: TenantCustomizationUpdate,
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // For now, just log the customization update
      logger.info(`Customization update requested for workspace: ${workplace.name}`, customization);
      
      return this.transformWorkplaceToTenant(workplace);
    } catch (error) {
      logger.error('Error updating tenant customization:', error);
      throw error;
    }
  }

  /**
   * Get tenant subscription details
   */
  async getTenantSubscription(tenantId: string): Promise<any> {
    try {
      const Subscription = mongoose.model('Subscription');
      const PricingPlan = mongoose.model('PricingPlan');

      const workplace = await Workplace.findById(tenantId)
        .populate('currentSubscriptionId')
        .populate('currentPlanId');

      if (!workplace) {
        throw new Error('Workspace not found');
      }

      let subscription = null;
      let plan = null;
      
      if (workplace.currentSubscriptionId) {
        subscription = await Subscription.findById(workplace.currentSubscriptionId);
        
        // Manually fetch the plan details
        if (subscription && subscription.planId) {
          plan = await PricingPlan.findById(subscription.planId);
        }
      }

      return {
        workspace: {
          id: workplace._id,
          name: workplace.name,
          subscriptionStatus: workplace.subscriptionStatus,
          trialEndDate: workplace.trialEndDate,
        },
        subscription: subscription ? {
          ...subscription.toObject(),
          plan: plan // Include the plan details in the subscription
        } : null,
        plan: plan || workplace.currentPlanId,
      };
    } catch (error) {
      logger.error('Error getting tenant subscription:', error);
      throw error;
    }
  }

  /**
   * Update tenant subscription (upgrade/downgrade/revoke)
   */
  async updateTenantSubscription(
    tenantId: string,
    update: { action: 'upgrade' | 'downgrade' | 'revoke'; planId?: string; reason?: string },
    adminId: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Subscription = mongoose.model('Subscription');

      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      let subscription = null;
      if (workplace.currentSubscriptionId) {
        subscription = await Subscription.findById(workplace.currentSubscriptionId);
      }

      switch (update.action) {
        case 'upgrade':
        case 'downgrade':
          if (!update.planId) {
            throw new Error('Plan ID is required for upgrade/downgrade');
          }

          const newPlan = await PricingPlan.findById(update.planId);
          if (!newPlan) {
            throw new Error('Subscription plan not found');
          }

          if (subscription) {
            // Update existing subscription
            subscription.planId = new mongoose.Types.ObjectId(update.planId);
            subscription.tier = newPlan.tier;
            subscription.status = 'active';
            subscription.priceAtPurchase = newPlan.price;
            subscription.billingInterval = newPlan.billingPeriod;
            
            // Update end date based on billing interval
            const now = new Date();
            if (newPlan.billingPeriod === 'yearly') {
              subscription.endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            } else {
              subscription.endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            }
            
            await subscription.save();
          } else {
            // Create new subscription
            const now = new Date();
            const endDate = newPlan.billingPeriod === 'yearly' 
              ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
              : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

            subscription = new Subscription({
              workspaceId: workplace._id,
              planId: update.planId,
              tier: newPlan.tier,
              status: 'active',
              startDate: now,
              endDate: endDate,
              priceAtPurchase: newPlan.price,
              billingInterval: newPlan.billingPeriod,
            });
            await subscription.save();
          }

          // Update workplace
          workplace.currentSubscriptionId = subscription._id;
          workplace.currentPlanId = new mongoose.Types.ObjectId(update.planId);
          workplace.subscriptionStatus = 'active' as any;
          break;

        case 'revoke':
          if (subscription) {
            subscription.status = 'canceled';
            await subscription.save();
          }

          workplace.subscriptionStatus = 'canceled' as any;
          workplace.currentSubscriptionId = undefined;
          workplace.currentPlanId = undefined;
          break;
      }

      await workplace.save();

      // Log audit event
      await (SecurityAuditLog as any).createLog({
        userId: new mongoose.Types.ObjectId(adminId),
        action: `subscription_${update.action}`,
        resource: 'workspace',
        resourceId: workplace._id,
        category: 'tenant_management',
        severity: 'medium',
        details: {
          workspaceName: workplace.name,
          action: update.action,
          planId: update.planId,
          planName: update.planId ? (await PricingPlan.findById(update.planId))?.name : null,
          reason: update.reason,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'System',
        success: true,
      });

      await session.commitTransaction();
      
      logger.info(`Subscription ${update.action} completed for workspace: ${workplace.name}`);
      
      return subscription;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error updating tenant subscription:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get workspace members
   */
  async getWorkspaceMembers(
    tenantId: string,
    options: { page: number; limit: number }
  ): Promise<{
    members: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      const skip = (options.page - 1) * options.limit;
      
      const memberQuery = { workplaceId: tenantId };
      
      const [members, total] = await Promise.all([
        User.find(memberQuery)
          .select('firstName lastName email role workplaceRole status lastLoginAt createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(options.limit)
          .lean(),
        User.countDocuments(memberQuery)
      ]);

      return {
        members,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          totalPages: Math.ceil(total / options.limit),
        },
      };
    } catch (error) {
      logger.error('Error getting workspace members:', error);
      throw error;
    }
  }

  /**
   * Invite new member to workspace
   */
  async inviteWorkspaceMember(
    tenantId: string,
    memberData: { email: string; role: string; firstName: string; lastName: string },
    adminId: string
  ): Promise<any> {
    try {
      const WorkspaceInvite = mongoose.model('WorkspaceInvite');

      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: memberData.email });
      if (existingUser && existingUser.workplaceId?.toString() === tenantId) {
        throw new Error('User is already a member of this workspace');
      }

      // Check for existing pending invitation
      const existingInvite = await WorkspaceInvite.findOne({
        workplaceId: tenantId,
        email: memberData.email,
        status: 'pending'
      });

      if (existingInvite) {
        throw new Error('Invitation already sent to this email');
      }

      // Create invitation
      const invitation = new WorkspaceInvite({
        workplaceId: tenantId,
        email: memberData.email,
        role: memberData.role,
        invitedBy: new mongoose.Types.ObjectId(adminId),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          invitedByAdmin: true,
        }
      });

      await invitation.save();

      // TODO: Send invitation email
      // await emailService.sendWorkspaceInvitation({
      //   to: memberData.email,
      //   workspaceName: workplace.name,
      //   inviteToken: invitation.inviteToken,
      //   firstName: memberData.firstName,
      //   lastName: memberData.lastName,
      // });

      // Log audit event
      await (SecurityAuditLog as any).createLog({
        userId: new mongoose.Types.ObjectId(adminId),
        action: 'workspace_member_invited',
        resource: 'workspace',
        resourceId: workplace._id,
        category: 'user_management',
        severity: 'low',
        details: {
          workspaceName: workplace.name,
          invitedEmail: memberData.email,
          role: memberData.role,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'System',
        success: true,
      });

      logger.info(`Member invited to workspace: ${memberData.email} -> ${workplace.name}`);
      
      return invitation;
    } catch (error) {
      logger.error('Error inviting workspace member:', error);
      throw error;
    }
  }

  /**
   * Update member role in workspace
   */
  async updateMemberRole(
    tenantId: string,
    memberId: string,
    newRole: string,
    adminId: string
  ): Promise<any> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      const member = await User.findOne({ _id: memberId, workplaceId: tenantId });
      if (!member) {
        throw new Error('Member not found in this workspace');
      }

      const previousRole = member.workplaceRole;
      member.workplaceRole = newRole as any;
      await member.save();

      // Log audit event
      await (SecurityAuditLog as any).createLog({
        userId: new mongoose.Types.ObjectId(adminId),
        action: 'member_role_updated',
        resource: 'user',
        resourceId: member._id,
        category: 'user_management',
        severity: 'medium',
        details: {
          workspaceName: workplace.name,
          memberEmail: member.email,
          previousRole,
          newRole,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'System',
        success: true,
      });

      logger.info(`Member role updated: ${member.email} -> ${newRole} in ${workplace.name}`);
      
      return member;
    } catch (error) {
      logger.error('Error updating member role:', error);
      throw error;
    }
  }

  // Removed getAvailableSubscriptionPlans - use PricingManagementController.getAllPlans() instead

  /**
   * Remove member from workspace
   */
  async removeMember(
    tenantId: string,
    memberId: string,
    reason: string | undefined,
    adminId: string
  ): Promise<void> {
    try {
      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      const member = await User.findOne({ _id: memberId, workplaceId: tenantId });
      if (!member) {
        throw new Error('Member not found in this workspace');
      }

      // Don't allow removing the workspace owner
      if (member._id.toString() === workplace.ownerId.toString()) {
        throw new Error('Cannot remove workspace owner');
      }

      // Remove member from workspace
      member.workplaceId = undefined;
      member.workplaceRole = undefined;
      member.status = 'suspended';
      await member.save();

      // Remove from workspace team members array
      workplace.teamMembers = workplace.teamMembers.filter(
        (teamMemberId: any) => teamMemberId.toString() !== memberId
      );
      await workplace.save();

      // Log audit event
      await (SecurityAuditLog as any).createLog({
        userId: new mongoose.Types.ObjectId(adminId),
        action: 'member_removed',
        resource: 'user',
        resourceId: member._id,
        category: 'user_management',
        severity: 'medium',
        details: {
          workspaceName: workplace.name,
          memberEmail: member.email,
          reason,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'System',
        success: true,
      });

      logger.info(`Member removed from workspace: ${member.email} from ${workplace.name}`);
    } catch (error) {
      logger.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Enforce data isolation between tenants
   */
  async enforceDataIsolation(tenantId: string): Promise<{
    fixed: string[];
    errors: string[];
  }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const fixed: string[] = [];
      const errors: string[] = [];

      const workplace = await Workplace.findById(tenantId);
      if (!workplace) {
        throw new Error('Workspace not found');
      }

      // Fix users without workspace assignment
      const usersWithoutWorkspace = await User.find({
        $or: [
          { workplaceId: { $exists: false } },
          { workplaceId: null },
        ],
      });

      for (const user of usersWithoutWorkspace) {
        try {
          // Assign to default workspace or remove if no valid workspace
          await User.findByIdAndUpdate(user._id, {
            workplaceId: null,
            status: 'suspended',
          });
          fixed.push(`Deactivated user ${user.email} without valid workspace`);
        } catch (error) {
          errors.push(`Failed to fix user ${user.email}: ${error}`);
        }
      }

      await session.commitTransaction();
      
      logger.info(`Data isolation enforced for workspace: ${workplace.name}`);
      
      return { fixed, errors };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error enforcing data isolation:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const tenantManagementService = new TenantManagementService();