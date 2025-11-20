import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import Workplace from '../models/Workplace';
import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import User from '../models/User';
import { emailService } from '../utils/emailService';
import { paystackService } from '../services/paystackService';
import Payment from '../models/Payment';
import mongoose from 'mongoose';

export interface WorkspaceSubscriptionData {
  workspaceId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingInterval: 'monthly' | 'yearly';
  autoRenew?: boolean;
}

export interface TrialCreationData {
  workspaceId: mongoose.Types.ObjectId;
  trialDurationDays?: number;
}

export class SubscriptionManagementController {
  /**
   * Get workspace subscription details
   */
  async getWorkspaceSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      // Verify user has access to this workspace
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      // Check if user is workspace owner or has appropriate permissions
      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      const isTeamMember = workspace.teamMembers.some(
        (memberId) => memberId.toString() === req.user!._id.toString()
      );

      if (!isOwner && !isTeamMember && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied to workspace subscription',
        });
      }

      // Get workspace subscription
      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
      })
        .populate('planId')
        .populate('workspaceId', 'name subscriptionStatus trialEndDate');

      if (!subscription) {
        return res.status(200).json({
          success: true,
          data: {
            subscription: null,
            workspace: {
              id: workspace._id,
              name: workspace.name,
              subscriptionStatus: workspace.subscriptionStatus,
              trialEndDate: workspace.trialEndDate,
              isTrialExpired: workspace.trialEndDate ? new Date() > workspace.trialEndDate : false,
            },
            message: 'No subscription found for workspace',
          },
        });
      }

      // Calculate subscription status details
      const now = new Date();
      const isExpired = subscription.isExpired();
      const isInGracePeriod = subscription.isInGracePeriod();
      const daysRemaining = subscription.endDate
        ? Math.ceil((subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      res.json({
        success: true,
        data: {
          subscription,
          workspace: {
            id: workspace._id,
            name: workspace.name,
            subscriptionStatus: workspace.subscriptionStatus,
            trialEndDate: workspace.trialEndDate,
          },
          status: {
            isExpired,
            isInGracePeriod,
            daysRemaining,
            canRenew: subscription.canRenew(),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching workspace subscription:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching workspace subscription',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create trial subscription for new workspace
   */
  async createTrialSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, trialDurationDays = 14 }: TrialCreationData = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      // Verify workspace exists and user has permission
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      if (!isOwner && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only workspace owners can create trial subscriptions',
        });
      }

      // Check if workspace already has a subscription
      const existingSubscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['trial', 'active', 'past_due'] },
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: 'Workspace already has an active subscription',
        });
      }

      // Find free trial plan
      const trialPlan = await SubscriptionPlan.findOne({
        tier: 'free_trial',
        isActive: true,
      });

      if (!trialPlan) {
        return res.status(500).json({
          success: false,
          message: 'Trial plan not found',
        });
      }

      // Calculate trial dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDurationDays);

      // Get all features for trial subscription
      const { getSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
      const features = await getSubscriptionFeatures(trialPlan, 'free_trial');

      // Create trial subscription
      const subscription = new Subscription({
        workspaceId: workspaceId,
        planId: trialPlan._id,
        tier: 'free_trial',
        status: 'trial',
        startDate: startDate,
        endDate: endDate,
        trialEndDate: endDate,
        priceAtPurchase: 0,
        billingInterval: 'monthly',
        autoRenew: false,
        features: features, // All features from plan + feature flags
        limits: {
          patients: null,
          users: null,
          locations: 1,
          storage: null,
          apiCalls: null,
        },
      });

      await subscription.save();

      // Update workspace with subscription info
      workspace.currentSubscriptionId = subscription._id;
      workspace.currentPlanId = trialPlan._id;
      workspace.subscriptionStatus = 'trial';
      workspace.trialStartDate = startDate;
      workspace.trialEndDate = endDate;
      await workspace.save();

      // Send trial activation email
      const owner = await User.findById(workspace.ownerId);
      if (owner) {
        await emailService.sendTrialActivation(owner.email, {
          firstName: owner.firstName,
          workspaceName: workspace.name,
          trialEndDate: endDate,
          trialDurationDays,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Trial subscription created successfully',
        data: {
          subscription,
          workspace: {
            id: workspace._id,
            name: workspace.name,
            subscriptionStatus: workspace.subscriptionStatus,
            trialEndDate: workspace.trialEndDate,
          },
        },
      });
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating trial subscription',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Update subscription status (for internal use and webhooks)
   */
  async updateSubscriptionStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;
      const { status, gracePeriodDays = 7 } = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      const validStatuses = ['trial', 'active', 'past_due', 'expired', 'canceled', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subscription status',
        });
      }

      // Only super_admin or system can update subscription status directly
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update subscription status',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found for workspace',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      // Update subscription status
      subscription.status = status;

      // Handle grace period for past_due status
      if (status === 'past_due' && gracePeriodDays > 0) {
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
        subscription.gracePeriodEnd = gracePeriodEnd;
      }

      await subscription.save();

      // Update workspace status
      workspace.subscriptionStatus = status;
      await workspace.save();

      // Send notification email to workspace owner
      const owner = await User.findById(workspace.ownerId);
      if (owner) {
        await this.sendStatusChangeNotification(owner, workspace, subscription, status);
      }

      res.json({
        success: true,
        message: 'Subscription status updated successfully',
        data: {
          subscription,
          workspace: {
            id: workspace._id,
            name: workspace.name,
            subscriptionStatus: workspace.subscriptionStatus,
          },
        },
      });
    } catch (error) {
      console.error('Error updating subscription status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating subscription status',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Create workspace subscription checkout session
   */
  async createWorkspaceCheckout(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, planId, billingInterval = 'monthly' }: WorkspaceSubscriptionData = req.body;

      if (!workspaceId || !planId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID and Plan ID are required',
        });
      }

      // Verify workspace and permissions
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      if (!isOwner && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only workspace owners can manage subscriptions',
        });
      }

      // Get plan details
      const plan = await SubscriptionPlan.findOne({
        _id: planId,
        billingInterval: billingInterval,
        isActive: true,
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found',
        });
      }

      // Check for existing active subscription
      const existingSubscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['active', 'trial'] },
      });

      if (existingSubscription && existingSubscription.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Workspace already has an active subscription. Use upgrade/downgrade endpoints.',
        });
      }

      // Create payment with Paystack
      const paymentData = {
        email: req.user!.email,
        amount: plan.priceNGN * 100, // Convert to kobo
        currency: 'NGN',
        callback_url: req.body.callbackUrl || `${process.env.FRONTEND_URL}/workspace/subscription/success`,
        metadata: {
          userId: req.user!._id.toString(),
          workspaceId: workspaceId.toString(),
          planId: plan._id.toString(),
          billingInterval,
          tier: plan.tier,
          customerName: `${req.user!.firstName} ${req.user!.lastName}`,
          planName: plan.name,
          workspaceName: workspace.name,
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      };

      // Handle development mode
      if (process.env.NODE_ENV === 'development' && !paystackService.isConfigured()) {
        const mockReference = `mock_ws_${Date.now()}_${workspaceId}`;
        const mockCheckoutUrl = `${process.env.FRONTEND_URL}/workspace/subscription/checkout?reference=${mockReference}&workspaceId=${workspaceId}&planId=${planId}`;

        // Store pending payment record
        await Payment.create({
          userId: req.user!._id,
          planId: plan._id,
          amount: plan.priceNGN,
          currency: 'NGN',
          paymentReference: mockReference,
          status: 'pending',
          paymentMethod: 'paystack',
          metadata: {
            ...paymentData.metadata,
            workspaceId: workspaceId.toString(),
          },
        });

        return res.json({
          success: true,
          data: {
            authorization_url: mockCheckoutUrl,
            access_code: 'mock_access_code',
            reference: mockReference,
          },
          message: 'Development mode: Mock payment initiated',
        });
      }

      // Initialize payment with Paystack
      if (!paystackService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'Payment service is not properly configured. Please contact support.',
        });
      }

      const paymentResponse = await paystackService.initializeTransaction(paymentData);

      if (!paymentResponse.success) {
        console.error('Paystack payment initialization failed:', paymentResponse);
        return res.status(400).json({
          success: false,
          message: paymentResponse.message || 'Failed to initialize payment',
          error: paymentResponse.error,
        });
      }

      // Store pending payment record
      await Payment.create({
        userId: req.user!._id,
        planId: plan._id,
        amount: plan.priceNGN,
        currency: 'NGN',
        paymentReference: paymentResponse.data!.reference,
        status: 'pending',
        paymentMethod: 'paystack',
        metadata: {
          ...paymentData.metadata,
          workspaceId: workspaceId.toString(),
        },
      });

      res.json({
        success: true,
        data: {
          authorization_url: paymentResponse.data!.authorization_url,
          access_code: paymentResponse.data!.access_code,
          reference: paymentResponse.data!.reference,
        },
      });
    } catch (error) {
      console.error('Error creating workspace checkout:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating checkout session',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle successful workspace subscription payment
   */
  async handleWorkspacePaymentSuccess(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { paymentReference } = req.body;

      if (!paymentReference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
      }

      // Find payment record
      const paymentRecord = await Payment.findOne({
        paymentReference: paymentReference,
      });

      if (!paymentRecord) {
        return res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
      }

      const workspaceId = paymentRecord.metadata?.workspaceId;
      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment metadata - workspace ID missing',
        });
      }

      // Verify payment with Paystack (skip for mock payments)
      if (!paymentReference.startsWith('mock_')) {
        const verificationResult = await paystackService.verifyTransaction(paymentReference);
        if (!verificationResult.success || verificationResult.data?.status !== 'success') {
          return res.status(400).json({
            success: false,
            message: 'Payment verification failed',
          });
        }
      }

      // Process workspace subscription activation
      const result = await this.activateWorkspaceSubscription(paymentRecord);

      res.json({
        success: true,
        message: 'Workspace subscription activated successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error handling workspace payment success:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing workspace payment',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Private method to activate workspace subscription
   */
  private async activateWorkspaceSubscription(paymentRecord: any) {
    const workspaceId = paymentRecord.metadata.workspaceId;
    const planId = paymentRecord.planId;
    const billingInterval = paymentRecord.metadata.billingInterval || 'monthly';

    // Get workspace and plan
    const workspace = await Workplace.findById(workspaceId);
    const plan = await SubscriptionPlan.findById(planId);

    if (!workspace || !plan) {
      throw new Error('Workspace or plan not found');
    }

    // Cancel existing subscriptions
    await Subscription.updateMany(
      { workspaceId: workspaceId, status: { $in: ['active', 'trial'] } },
      { status: 'canceled' }
    );

    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    if (billingInterval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Get all features for this subscription
    const { getSubscriptionFeatures } = await import('../utils/subscriptionFeatures');
    const features = await getSubscriptionFeatures(plan, plan.tier);

    // Create new subscription
    const subscription = new Subscription({
      workspaceId: workspaceId,
      planId: planId,
      tier: plan.tier,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      priceAtPurchase: plan.priceNGN,
      billingInterval: billingInterval,
      autoRenew: true,
      features: features,
      limits: {
        patients: plan.features.patientLimit,
        users: plan.features.teamSize,
        locations: plan.features.multiLocationDashboard ? null : 1,
        storage: null,
        apiCalls: plan.features.apiAccess ? null : 0,
      },
    });

    await subscription.save();

    // Update workspace
    workspace.currentSubscriptionId = subscription._id;
    workspace.currentPlanId = planId;
    workspace.subscriptionStatus = 'active';
    await workspace.save();

    // Update payment record
    paymentRecord.status = 'completed';
    paymentRecord.completedAt = new Date();
    await paymentRecord.save();

    // Send confirmation email
    const owner = await User.findById(workspace.ownerId);
    if (owner) {
      await emailService.sendWorkspaceSubscriptionConfirmation(owner.email, {
        firstName: owner.firstName,
        workspaceName: workspace.name,
        planName: plan.name,
        amount: plan.priceNGN,
        billingInterval: billingInterval,
        startDate: startDate,
        endDate: endDate,
      });
    }

    return {
      subscription,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        subscriptionStatus: workspace.subscriptionStatus,
      },
    };
  }

  /**
   * Upgrade workspace subscription
   */
  async upgradeWorkspaceSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, planId, billingInterval = 'monthly' } = req.body;

      if (!workspaceId || !planId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID and Plan ID are required',
        });
      }

      // Verify workspace and permissions
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      if (!isOwner && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only workspace owners can upgrade subscriptions',
        });
      }

      // Get current subscription
      const currentSubscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['active', 'trial'] },
      }).populate('planId');

      if (!currentSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found for workspace',
        });
      }

      // Get new plan
      const newPlan = await SubscriptionPlan.findOne({
        _id: planId,
        billingInterval: billingInterval,
        isActive: true,
      });

      if (!newPlan) {
        return res.status(404).json({
          success: false,
          message: 'New subscription plan not found',
        });
      }

      // Check if this is actually an upgrade
      const tierOrder = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
      const currentTierIndex = tierOrder.indexOf(currentSubscription.tier);
      const newTierIndex = tierOrder.indexOf(newPlan.tier);

      if (newTierIndex <= currentTierIndex) {
        return res.status(400).json({
          success: false,
          message: 'This is not an upgrade. Use downgrade endpoint for downgrades or same-tier changes.',
        });
      }

      // Calculate prorated amount
      const currentPlan = currentSubscription.planId as any;
      const daysRemaining = Math.ceil(
        (currentSubscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const totalDaysInPeriod = billingInterval === 'yearly' ? 365 : 30;
      const proratedDiscount = (currentPlan.priceNGN * daysRemaining) / totalDaysInPeriod;
      const upgradeAmount = Math.max(0, newPlan.priceNGN - proratedDiscount);

      // For immediate upgrades (no payment required if upgrade amount is 0 or very small)
      if (upgradeAmount <= 100) { // Less than ₦1 difference
        // Apply upgrade immediately
        const result = await this.applySubscriptionUpgrade(
          currentSubscription,
          newPlan,
          workspace,
          billingInterval,
          0
        );

        return res.json({
          success: true,
          message: 'Subscription upgraded successfully',
          data: {
            ...result,
            upgradeAmount: 0,
            proratedDiscount: proratedDiscount,
          },
        });
      }

      // For paid upgrades, create payment session
      const paymentData = {
        email: req.user!.email,
        amount: upgradeAmount * 100, // Convert to kobo
        currency: 'NGN',
        callback_url: req.body.callbackUrl || `${process.env.FRONTEND_URL}/workspace/subscription/upgrade-success`,
        metadata: {
          userId: req.user!._id.toString(),
          workspaceId: workspaceId.toString(),
          planId: newPlan._id.toString(),
          currentSubscriptionId: currentSubscription._id.toString(),
          billingInterval,
          tier: newPlan.tier,
          upgradeAmount: upgradeAmount,
          proratedDiscount: proratedDiscount,
          customerName: `${req.user!.firstName} ${req.user!.lastName}`,
          planName: newPlan.name,
          workspaceName: workspace.name,
          isUpgrade: true,
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      };

      // Handle development mode
      if (process.env.NODE_ENV === 'development' && !paystackService.isConfigured()) {
        const mockReference = `mock_upgrade_${Date.now()}_${workspaceId}`;

        // Store pending payment record
        await Payment.create({
          userId: req.user!._id,
          planId: newPlan._id,
          amount: upgradeAmount,
          currency: 'NGN',
          paymentReference: mockReference,
          status: 'pending',
          paymentMethod: 'paystack',
          metadata: paymentData.metadata,
        });

        return res.json({
          success: true,
          data: {
            authorization_url: `${process.env.FRONTEND_URL}/workspace/subscription/upgrade-checkout?reference=${mockReference}`,
            access_code: 'mock_access_code',
            reference: mockReference,
            upgradeAmount: upgradeAmount,
            proratedDiscount: proratedDiscount,
          },
          message: 'Development mode: Mock upgrade payment initiated',
        });
      }

      // Initialize payment with Paystack
      if (!paystackService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message: 'Payment service is not properly configured. Please contact support.',
        });
      }

      const paymentResponse = await paystackService.initializeTransaction(paymentData);

      if (!paymentResponse.success) {
        console.error('Paystack upgrade payment initialization failed:', paymentResponse);
        return res.status(400).json({
          success: false,
          message: paymentResponse.message || 'Failed to initialize upgrade payment',
          error: paymentResponse.error,
        });
      }

      // Store pending payment record
      await Payment.create({
        userId: req.user!._id,
        planId: newPlan._id,
        amount: upgradeAmount,
        currency: 'NGN',
        paymentReference: paymentResponse.data!.reference,
        status: 'pending',
        paymentMethod: 'paystack',
        metadata: paymentData.metadata,
      });

      res.json({
        success: true,
        data: {
          authorization_url: paymentResponse.data!.authorization_url,
          access_code: paymentResponse.data!.access_code,
          reference: paymentResponse.data!.reference,
          upgradeAmount: upgradeAmount,
          proratedDiscount: proratedDiscount,
        },
      });
    } catch (error) {
      console.error('Error upgrading workspace subscription:', error);
      res.status(500).json({
        success: false,
        message: 'Error upgrading subscription',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Downgrade workspace subscription
   */
  async downgradeWorkspaceSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, planId, effectiveDate } = req.body;

      if (!workspaceId || !planId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID and Plan ID are required',
        });
      }

      // Verify workspace and permissions
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      if (!isOwner && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only workspace owners can downgrade subscriptions',
        });
      }

      // Get current subscription
      const currentSubscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: 'active',
      }).populate('planId');

      if (!currentSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found for workspace',
        });
      }

      // Get new plan
      const newPlan = await SubscriptionPlan.findOne({
        _id: planId,
        isActive: true,
      });

      if (!newPlan) {
        return res.status(404).json({
          success: false,
          message: 'New subscription plan not found',
        });
      }

      // Check if this is actually a downgrade
      const tierOrder = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
      const currentTierIndex = tierOrder.indexOf(currentSubscription.tier);
      const newTierIndex = tierOrder.indexOf(newPlan.tier);

      if (newTierIndex >= currentTierIndex) {
        return res.status(400).json({
          success: false,
          message: 'This is not a downgrade. Use upgrade endpoint for upgrades or same-tier changes.',
        });
      }

      // Determine effective date (default to end of current billing period)
      const downgradeEffectiveDate = effectiveDate
        ? new Date(effectiveDate)
        : currentSubscription.endDate;

      // Validate effective date is not in the past
      if (downgradeEffectiveDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Effective date cannot be in the past',
        });
      }

      // Schedule the downgrade
      currentSubscription.scheduledDowngrade = {
        planId: newPlan._id,
        effectiveDate: downgradeEffectiveDate,
        scheduledAt: new Date(),
      };

      await currentSubscription.save();

      // Send downgrade confirmation email
      const owner = await User.findById(workspace.ownerId);
      if (owner) {
        const currentPlan = currentSubscription.planId as any;
        await emailService.sendSubscriptionDowngrade(owner.email, {
          firstName: owner.firstName,
          currentPlanName: currentPlan.name,
          newPlanName: newPlan.name,
          effectiveDate: downgradeEffectiveDate,
        });
      }

      res.json({
        success: true,
        message: 'Subscription downgrade scheduled successfully',
        data: {
          currentPlan: (currentSubscription.planId as any).name,
          newPlan: newPlan.name,
          effectiveDate: downgradeEffectiveDate,
          scheduledAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error downgrading workspace subscription:', error);
      res.status(500).json({
        success: false,
        message: 'Error scheduling downgrade',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Cancel scheduled downgrade
   */
  async cancelScheduledDowngrade(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      // Verify workspace and permissions
      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const isOwner = workspace.ownerId.toString() === req.user!._id.toString();
      if (!isOwner && req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only workspace owners can cancel scheduled downgrades',
        });
      }

      // Get current subscription
      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: 'active',
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found for workspace',
        });
      }

      if (!subscription.scheduledDowngrade) {
        return res.status(400).json({
          success: false,
          message: 'No scheduled downgrade found',
        });
      }

      // Remove scheduled downgrade
      subscription.scheduledDowngrade = undefined;
      await subscription.save();

      res.json({
        success: true,
        message: 'Scheduled downgrade cancelled successfully',
      });
    } catch (error) {
      console.error('Error cancelling scheduled downgrade:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling scheduled downgrade',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle successful upgrade payment
   */
  async handleUpgradePaymentSuccess(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { paymentReference } = req.body;

      if (!paymentReference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
      }

      // Find payment record
      const paymentRecord = await Payment.findOne({
        paymentReference: paymentReference,
      });

      if (!paymentRecord) {
        return res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
      }

      const metadata = paymentRecord.metadata;
      if (!metadata?.isUpgrade || !metadata?.currentSubscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid upgrade payment metadata',
        });
      }

      // Verify payment with Paystack (skip for mock payments)
      if (!paymentReference.startsWith('mock_')) {
        const verificationResult = await paystackService.verifyTransaction(paymentReference);
        if (!verificationResult.success || verificationResult.data?.status !== 'success') {
          return res.status(400).json({
            success: false,
            message: 'Payment verification failed',
          });
        }
      }

      // Get current subscription and new plan
      const currentSubscription = await Subscription.findById(metadata.currentSubscriptionId);
      const newPlan = await SubscriptionPlan.findById(paymentRecord.planId);
      const workspace = await Workplace.findById(metadata.workspaceId);

      if (!currentSubscription || !newPlan || !workspace) {
        return res.status(404).json({
          success: false,
          message: 'Subscription, plan, or workspace not found',
        });
      }

      // Apply the upgrade
      const result = await this.applySubscriptionUpgrade(
        currentSubscription,
        newPlan,
        workspace,
        metadata.billingInterval || 'monthly',
        metadata.upgradeAmount || 0
      );

      // Update payment record
      paymentRecord.status = 'completed';
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      res.json({
        success: true,
        message: 'Subscription upgraded successfully',
        data: {
          ...result,
          upgradeAmount: metadata.upgradeAmount,
          proratedDiscount: metadata.proratedDiscount,
        },
      });
    } catch (error) {
      console.error('Error handling upgrade payment success:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing upgrade payment',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Private method to apply subscription upgrade
   */
  private async applySubscriptionUpgrade(
    currentSubscription: any,
    newPlan: any,
    workspace: any,
    billingInterval: string,
    upgradeAmount: number
  ) {
    // Update subscription with new plan
    currentSubscription.planId = newPlan._id;
    currentSubscription.tier = newPlan.tier;
    currentSubscription.priceAtPurchase = newPlan.priceNGN;
    currentSubscription.billingInterval = billingInterval;
    currentSubscription.features = Object.keys(newPlan.features).filter(
      key => (newPlan.features as any)[key] === true
    );
    currentSubscription.limits = {
      patients: newPlan.features.patientLimit,
      users: newPlan.features.teamSize,
      locations: newPlan.features.multiLocationDashboard ? null : 1,
      storage: null,
      apiCalls: newPlan.features.apiAccess ? null : 0,
    };

    // Clear any scheduled downgrade
    currentSubscription.scheduledDowngrade = undefined;

    await currentSubscription.save();

    // Update workspace
    workspace.currentPlanId = newPlan._id;
    await workspace.save();

    // Send upgrade confirmation email
    const owner = await User.findById(workspace.ownerId);
    if (owner) {
      await emailService.sendSubscriptionUpgrade(owner.email, {
        firstName: owner.firstName,
        oldPlanName: 'Previous Plan', // Could be enhanced to get actual old plan name
        newPlanName: newPlan.name,
        upgradeAmount: upgradeAmount,
        effectiveDate: new Date(),
      });
    }

    return {
      subscription: currentSubscription,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        subscriptionStatus: workspace.subscriptionStatus,
      },
    };
  }

  /**
   * Check and handle trial expiry for workspaces
   */
  async checkTrialExpiry(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: 'trial',
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No trial subscription found for workspace',
        });
      }

      const now = new Date();
      const isExpired = subscription.trialEndDate && now > subscription.trialEndDate;
      const daysRemaining = subscription.trialEndDate
        ? Math.ceil((subscription.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // If trial is expired, update status
      if (isExpired) {
        await this.expireTrialSubscription(subscription, workspace);
      }

      res.json({
        success: true,
        data: {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          trialEndDate: subscription.trialEndDate,
          isExpired,
          daysRemaining: Math.max(0, daysRemaining),
          status: subscription.status,
        },
      });
    } catch (error) {
      console.error('Error checking trial expiry:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking trial expiry',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Extend trial period (admin only)
   */
  async extendTrialPeriod(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, extensionDays = 7 } = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      // Only super_admin can extend trials
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can extend trial periods',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['trial', 'expired'] },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No trial subscription found for workspace',
        });
      }

      // Extend trial period
      const currentEndDate = subscription.trialEndDate || subscription.endDate;
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + extensionDays);

      subscription.trialEndDate = newEndDate;
      subscription.endDate = newEndDate;
      subscription.status = 'trial';
      await subscription.save();

      // Update workspace
      workspace.trialEndDate = newEndDate;
      workspace.subscriptionStatus = 'trial';
      await workspace.save();

      // Send extension notification
      const owner = await User.findById(workspace.ownerId);
      if (owner) {
        await emailService.sendTrialExtension(owner.email, {
          firstName: owner.firstName,
          workspaceName: workspace.name,
          extensionDays,
          newEndDate,
        });
      }

      res.json({
        success: true,
        message: 'Trial period extended successfully',
        data: {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          newTrialEndDate: newEndDate,
          extensionDays,
        },
      });
    } catch (error) {
      console.error('Error extending trial period:', error);
      res.status(500).json({
        success: false,
        message: 'Error extending trial period',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle subscription expiry and grace period
   */
  async handleSubscriptionExpiry(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId, gracePeriodDays = 7 } = req.body;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      // Only super_admin can manually handle expiry
      if (req.user!.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can manually handle subscription expiry',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
        status: { $in: ['active', 'past_due'] },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found for workspace',
        });
      }

      const now = new Date();
      const isExpired = now > subscription.endDate;

      if (isExpired) {
        // Set grace period
        const gracePeriodEnd = new Date();
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

        subscription.status = 'past_due';
        subscription.gracePeriodEnd = gracePeriodEnd;
        await subscription.save();

        // Update workspace
        workspace.subscriptionStatus = 'past_due';
        await workspace.save();

        // Send past due notification
        const owner = await User.findById(workspace.ownerId);
        if (owner) {
          await this.sendStatusChangeNotification(owner, workspace, subscription, 'past_due');
        }

        res.json({
          success: true,
          message: 'Subscription marked as past due with grace period',
          data: {
            workspaceId: workspace._id,
            status: 'past_due',
            gracePeriodEnd,
            gracePeriodDays,
          },
        });
      } else {
        res.json({
          success: true,
          message: 'Subscription is not yet expired',
          data: {
            workspaceId: workspace._id,
            status: subscription.status,
            endDate: subscription.endDate,
            daysRemaining: Math.ceil((subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          },
        });
      }
    } catch (error) {
      console.error('Error handling subscription expiry:', error);
      res.status(500).json({
        success: false,
        message: 'Error handling subscription expiry',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Enable paywall mode for expired subscriptions
   */
  async enablePaywallMode(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription found for workspace',
        });
      }

      const now = new Date();
      const isExpired = subscription.status === 'expired' ||
        (subscription.gracePeriodEnd && now > subscription.gracePeriodEnd) ||
        (subscription.trialEndDate && now > subscription.trialEndDate && subscription.status === 'trial');

      if (!isExpired) {
        return res.status(400).json({
          success: false,
          message: 'Subscription is not expired, paywall mode not applicable',
        });
      }

      // Update subscription and workspace to expired status
      subscription.status = 'expired';
      await subscription.save();

      workspace.subscriptionStatus = 'expired';
      await workspace.save();

      // Send expiry notification
      const owner = await User.findById(workspace.ownerId);
      if (owner) {
        await this.sendStatusChangeNotification(owner, workspace, subscription, 'expired');
      }

      res.json({
        success: true,
        message: 'Paywall mode enabled for expired subscription',
        data: {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          status: 'expired',
          paywallMode: true,
          message: 'Subscription has expired. Please upgrade to restore full access.',
        },
      });
    } catch (error) {
      console.error('Error enabling paywall mode:', error);
      res.status(500).json({
        success: false,
        message: 'Error enabling paywall mode',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get workspace subscription status with expiry details
   */
  async getSubscriptionStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { workspaceId } = req.params;

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required',
        });
      }

      const workspace = await Workplace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: workspaceId,
      }).populate('planId');

      if (!subscription) {
        return res.json({
          success: true,
          data: {
            workspaceId: workspace._id,
            workspaceName: workspace.name,
            hasSubscription: false,
            status: 'no_subscription',
            paywallMode: true,
            message: 'No subscription found. Please subscribe to access features.',
          },
        });
      }

      const now = new Date();
      const isTrialExpired = subscription.trialEndDate && now > subscription.trialEndDate;
      const isSubscriptionExpired = now > subscription.endDate;
      const isInGracePeriod = subscription.gracePeriodEnd && now <= subscription.gracePeriodEnd;

      let effectiveStatus = subscription.status;
      let paywallMode = false;
      let message = '';

      // Determine effective status and paywall mode
      if (subscription.status === 'trial' && isTrialExpired) {
        effectiveStatus = 'expired';
        paywallMode = true;
        message = 'Trial period has expired. Please upgrade to continue using all features.';
      } else if (subscription.status === 'active' && isSubscriptionExpired) {
        if (isInGracePeriod) {
          effectiveStatus = 'past_due';
          message = 'Subscription payment is past due. Please update your payment method.';
        } else {
          effectiveStatus = 'expired';
          paywallMode = true;
          message = 'Subscription has expired. Please renew to restore full access.';
        }
      } else if (subscription.status === 'past_due' && !isInGracePeriod) {
        effectiveStatus = 'expired';
        paywallMode = true;
        message = 'Grace period has ended. Please renew your subscription.';
      } else if (['expired', 'canceled', 'suspended'].includes(subscription.status)) {
        paywallMode = true;
        message = 'Subscription is not active. Please subscribe or reactivate to access features.';
      }

      // Calculate days remaining
      let daysRemaining = 0;
      if (subscription.status === 'trial' && subscription.trialEndDate) {
        daysRemaining = Math.ceil((subscription.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (subscription.status === 'active') {
        daysRemaining = Math.ceil((subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (subscription.gracePeriodEnd) {
        daysRemaining = Math.ceil((subscription.gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      res.json({
        success: true,
        data: {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          hasSubscription: true,
          status: effectiveStatus,
          originalStatus: subscription.status,
          paywallMode,
          message,
          subscription: {
            id: subscription._id,
            planId: subscription.planId,
            tier: subscription.tier,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            trialEndDate: subscription.trialEndDate,
            gracePeriodEnd: subscription.gracePeriodEnd,
          },
          daysRemaining: Math.max(0, daysRemaining),
          features: subscription.features,
          limits: subscription.limits,
        },
      });
    } catch (error) {
      console.error('Error getting subscription status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting subscription status',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Private method to expire trial subscription
   */
  private async expireTrialSubscription(subscription: any, workspace: any) {
    subscription.status = 'expired';
    await subscription.save();

    workspace.subscriptionStatus = 'expired';
    await workspace.save();

    // Send trial expiry notification
    const owner = await User.findById(workspace.ownerId);
    if (owner) {
      await emailService.sendTrialExpired(owner.email, {
        firstName: owner.firstName,
        workspaceName: workspace.name,
        trialEndDate: subscription.trialEndDate,
      });
    }
  }

  /**
   * Private method to send status change notifications
   */
  private async sendStatusChangeNotification(
    user: any,
    workspace: any,
    subscription: any,
    newStatus: string
  ) {
    try {
      switch (newStatus) {
        case 'past_due':
          await emailService.sendSubscriptionPastDue(user.email, {
            firstName: user.firstName,
            workspaceName: workspace.name,
            gracePeriodEnd: subscription.gracePeriodEnd,
          });
          break;
        case 'expired':
          await emailService.sendSubscriptionExpired(user.email, {
            firstName: user.firstName,
            workspaceName: workspace.name,
          });
          break;
        case 'canceled':
          await emailService.sendSubscriptionCanceled(user.email, {
            firstName: user.firstName,
            workspaceName: workspace.name,
          });
          break;
        case 'suspended':
          await emailService.sendSubscriptionSuspended(user.email, {
            firstName: user.firstName,
            workspaceName: workspace.name,
          });
          break;
      }
    } catch (error) {
      console.error('Error sending status change notification:', error);
    }
  }
}

export const subscriptionManagementController = new SubscriptionManagementController();