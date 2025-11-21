import { Request, Response } from 'express';
import User from '../models/User';
import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { FeatureFlag } from '../models/FeatureFlag';
import Payment from '../models/Payment';
import { emailService } from '../utils/emailService';
import { nombaService, NombaService } from '../services/nombaService';
import { getSubscriptionFeatures } from '../utils/subscriptionFeatures';

interface AuthRequest extends Request {
  user?: any;
  subscription?: any;
}

export class SubscriptionController {
  // Get current subscription details
  async getCurrentSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const user = req.user;

      // Users without workplaces have no subscription (note: User model uses 'workplaceId' with 'e')
      if (!user.workplaceId) {
        return res.status(200).json({
          success: true,
          data: {
            hasWorkspace: false,
            hasSubscription: false,
            subscription: null,
            status: 'no_workspace',
            accessLevel: 'basic', // Knowledge Hub, CPD, Forum only
            availableFeatures: [],
            isExpired: false,
            isInGracePeriod: false,
            canRenew: false,
            message: 'Create or join a workplace to access full features',
          },
        });
      }

      // Get workspace subscription (Subscription model uses 'workspaceId' without 'e')
      const subscription = await Subscription.findOne({
        workspaceId: user.workplaceId, // User.workplaceId -> Subscription.workspaceId
        status: { $in: ['active', 'trial', 'grace_period'] },
      })
        .populate('planId')
        .populate('paymentHistory');

      if (!subscription) {
        // User has workspace but no subscription
        return res.status(200).json({
          success: true,
          data: {
            hasWorkspace: true,
            hasSubscription: false,
            subscription: null,
            status: 'no_subscription',
            accessLevel: 'limited',
            availableFeatures: [],
            isExpired: true,
            isInGracePeriod: false,
            canRenew: true,
            message: 'No active subscription found for your workplace',
          },
        });
      }

      // Get available features for this subscription tier
      const availableFeatures = await FeatureFlag.find({
        isActive: true,
        allowedTiers: subscription.tier,
      }).select('key name description metadata.category');

      // Calculate trial info
      const now = new Date();
      const isTrialActive = subscription.status === 'trial' &&
        subscription.endDate &&
        now <= subscription.endDate;

      let daysRemaining = 0;
      if (isTrialActive && subscription.endDate) {
        const diffTime = subscription.endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      res.json({
        success: true,
        data: {
          hasWorkspace: true,
          hasSubscription: true,
          subscription,
          status: subscription.status,
          tier: subscription.tier,
          accessLevel: 'full',
          availableFeatures,
          isExpired: subscription.isExpired(),
          isInGracePeriod: subscription.isInGracePeriod(),
          canRenew: subscription.canRenew(),
          isTrialActive,
          daysRemaining,
          endDate: subscription.endDate,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching subscription',
        error: (error as Error).message,
      });
    }
  }

  // Get available subscription plans
  getAvailablePlans = async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const billingInterval = (req.query.billingInterval as string) || 'monthly';

      // Import PlanConfigService dynamically to avoid circular imports
      const PlanConfigService = (await import('../services/PlanConfigService')).default;
      const planConfigService = PlanConfigService.getInstance();

      // Get plans from configuration
      const configPlans = await planConfigService.getActivePlans();

      // Filter by billing interval and sort by tier rank
      const filteredPlans = configPlans
        .filter(plan => plan.billingInterval === billingInterval)
        .sort((a, b) => a.tierRank - b.tierRank);

      // Get feature definitions for display
      const config = await planConfigService.loadConfiguration();

      // Transform plans to include feature details
      const transformedPlans = filteredPlans.map((plan) => ({
        ...plan,
        displayFeatures: this.getDisplayFeaturesFromConfig(plan, config.features),
      }));

      res.json({
        success: true,
        data: transformedPlans,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching plans',
        error: (error as Error).message,
      });
    }
  };

  private getDisplayFeaturesFromConfig(plan: any, featureDefinitions: any): string[] {
    const features: string[] = [];

    // Add limits as features
    if (plan.limits.patients) {
      features.push(`Up to ${plan.limits.patients} patients`);
    } else {
      features.push('Unlimited patients');
    }

    if (plan.limits.users) {
      features.push(`Up to ${plan.limits.users} team members`);
    } else {
      features.push('Unlimited team members');
    }

    if (plan.limits.locations) {
      features.push(`Up to ${plan.limits.locations} locations`);
    } else if (plan.features.includes('multi_location_dashboard')) {
      features.push('Unlimited locations');
    }

    // Add feature names from configuration
    plan.features.forEach((featureCode: string) => {
      const featureDef = featureDefinitions[featureCode];
      if (featureDef) {
        features.push(featureDef.name);
      }
    });

    // Add special tier-specific features
    if (plan.tier === 'free_trial') {
      features.unshift('14-day free trial with full access');
    }

    if (plan.isContactSales) {
      features.push('Custom pricing available');
      features.push('Dedicated account manager');
    }

    return features;
  }

  private getDisplayFeatures(plan: any): string[] {
    const features: string[] = [];

    if (plan.tier === 'free_trial') {
      features.push('Access to all features during trial period');
      features.push('14-day free trial');
    } else if (plan.tier === 'basic') {
      features.push(
        `Up to ${plan.features.patientLimit || 'unlimited'} patients`
      );
      features.push(
        `${plan.features.clinicalNotesLimit || 'unlimited'} clinical notes`
      );
      features.push(
        `${plan.features.patientRecordsLimit || 'unlimited'} patient records`
      );
      features.push('Basic reports');
      features.push(`${plan.features.teamSize || 1} User`);
      if (plan.features.emailReminders) features.push('Email reminders');
    } else if (plan.tier === 'pro') {
      features.push('Unlimited patients');
      features.push('Unlimited clinical notes');
      features.push('Unlimited users');
      features.push('Priority support');
      if (plan.features.integrations) features.push('Integrations');
      if (plan.features.emailReminders) features.push('Email reminders');
      if (plan.features.advancedReports) features.push('Advanced reports');
      if (plan.features.drugTherapyManagement)
        features.push('Drug Therapy Management');
    } else if (plan.tier === 'pharmily') {
      features.push('Everything in Pro plan');
      features.push('ADR Reporting');
      features.push('Drug Interaction Checker');
      features.push('Dose Calculator');
      features.push('Advanced Reporting');
      if (plan.features.integrations) features.push('Integrations');
      if (plan.features.emailReminders) features.push('Email reminders');
    } else if (plan.tier === 'network') {
      features.push('Everything in Pharmily plan');
      features.push('Multi-location Dashboard');
      features.push('Shared Patient Records');
      features.push('Group Analytics');
      features.push('Clinical Decision Support System (CDSS)');
      features.push('Team Management');
      if (plan.features.smsReminders) features.push('SMS reminders');
    } else if (plan.tier === 'enterprise') {
      features.push('Everything in Network plan');
      features.push('Dedicated support');
      features.push('Team management');
      features.push('ADR reporting');
      features.push('Advanced reports');
      if (plan.features.smsReminders) features.push('SMS reminders');
      if (plan.features.customIntegrations)
        features.push('Custom integrations');
    }

    return features;
  }

  // Create Paystack checkout session
  async createCheckoutSession(req: AuthRequest, res: Response): Promise<any> {
    try {
      console.log('createCheckoutSession - Request received:', {
        body: req.body,
        user: req.user
          ? {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
            hasSubscription: !!req.user.currentSubscriptionId,
          }
          : 'No user',
      });

      const { planId, planSlug, tier, billingInterval = 'monthly', amount } = req.body;

      console.log('Looking for subscription plan:', {
        planId,
        planSlug,
        tier,
        billingInterval,
        amount,
      });

      // Try to find plan by ID first, then by slug, then by tier + billingInterval
      let plan = null;

      // PRIORITY 1: Try PricingPlan first (newer model with correct pricing)
      if (planSlug) {
        console.log('Trying PricingPlan first with slug:', planSlug);
        const PricingPlan = (await import('../models/PricingPlan')).default;
        const pricingPlan = await PricingPlan.findOne({ slug: planSlug });

        if (pricingPlan) {
          console.log('Found PricingPlan, using it for checkout:', {
            id: pricingPlan._id,
            name: pricingPlan.name,
            tier: pricingPlan.tier,
            price: pricingPlan.price,
          });

          // Create a plan-like object from PricingPlan for compatibility
          plan = {
            _id: pricingPlan._id,
            name: pricingPlan.name,
            tier: pricingPlan.tier,
            priceNGN: pricingPlan.price,
            billingInterval: pricingPlan.billingPeriod,
            features: pricingPlan.features || [],
          } as any;
        }
      }

      // PRIORITY 2: Fall back to SubscriptionPlan (legacy model) if PricingPlan not found
      if (!plan && planId) {
        console.log('PricingPlan not found, trying SubscriptionPlan with ID:', planId);
        plan = await SubscriptionPlan.findOne({
          _id: planId,
          billingInterval: billingInterval,
        });
      }

      if (!plan && planSlug) {
        // Try to find by matching tier and billingInterval (since PricingPlan uses slug)
        const tierFromSlug = planSlug.split('-')[0]; // e.g., "basic-monthly" -> "basic"
        plan = await SubscriptionPlan.findOne({
          tier: tierFromSlug,
          billingInterval: billingInterval,
        });
      }

      if (!plan && tier) {
        plan = await SubscriptionPlan.findOne({
          tier: tier,
          billingInterval: billingInterval,
        });
      }

      if (!plan) {
        console.error('No plan found with criteria:', { planId, planSlug, tier, billingInterval });
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found. Please contact support.',
        });
      }

      console.log('Using plan for checkout:', {
        id: plan._id,
        name: plan.name,
        tier: plan.tier,
        price: plan.priceNGN,
      });

      const user = req.user;

      if (!user) {
        console.error('createCheckoutSession - No user in request');
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      console.log(
        'Checking for existing subscription for user:',
        user._id.toString(),
        'workplaceId:',
        user.workplaceId?.toString()
      );

      // Check if user already has active subscription
      const existingSubscription = await Subscription.findOne({
        workspaceId: user.workplaceId,
        status: { $in: ['active', 'trial'] },
      });

      console.log(
        'Existing subscription check result:',
        existingSubscription
          ? {
            id: existingSubscription._id,
            status: existingSubscription.status,
            planId: existingSubscription.planId,
            endDate: existingSubscription.endDate,
          }
          : 'No active subscription'
      );

      if (existingSubscription) {
        console.log('User has existing subscription, allowing upgrade/change:', {
          currentStatus: existingSubscription.status,
          currentTier: existingSubscription.tier,
          newTier: plan.tier
        });
        // Allow upgrades/changes - the processSubscriptionActivation will handle canceling the old one
      }

      // Check for pending payments to avoid duplicates
      const pendingPayment = await Payment.findOne({
        userId: user._id,
        status: 'pending',
        planId: plan._id
      });

      if (pendingPayment) {
        console.log('Found existing pending payment:', pendingPayment.paymentReference);

        // For Nomba, we can't reuse old payment references because each checkout order
        // must be created fresh with Nomba's API. Mark the old one as expired.
        console.log('Marking old pending payment as expired for Nomba');
        pendingPayment.status = 'failed';
        await pendingPayment.save();
      }

      // Create payment with Nomba
      const orderReference = `nomba_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      const orderData = {
        orderReference,
        customerId: user._id.toString(),
        customerEmail: user.email,
        amount: NombaService.formatAmount(plan.priceNGN),
        currency: 'NGN',
        callbackUrl:
          req.body.callbackUrl ||
          `${process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : process.env.FRONTEND_URL}/subscription/success`,
        accountId: nombaService.getAccountId(),
      };

      // Check if this is development mode without Nomba credentials or if Nomba is not configured
      if (
        process.env.NODE_ENV === 'development' &&
        !nombaService.isConfigured()
      ) {
        // Mock payment response for development
        const mockReference = `mock_${Date.now()}_${user._id}`;
        const mockCheckoutUrl = `${process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : process.env.FRONTEND_URL}/subscription-management/checkout?reference=${mockReference}&planId=${planId}`;

        // Store pending payment record with mock data
        await Payment.create({
          userId: user._id,
          planId: plan._id,
          amount: plan.priceNGN,
          currency: 'NGN',
          paymentReference: mockReference,
          status: 'pending',
          paymentMethod: 'nomba',
          metadata: {
            userId: user._id.toString(),
            planId: plan._id.toString(),
            billingInterval,
            tier: plan.tier,
            customerName: `${user.firstName} ${user.lastName}`,
            planName: plan.name,
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

      // Check if Nomba is configured in production
      if (!nombaService.isConfigured()) {
        return res.status(500).json({
          success: false,
          message:
            'Payment service is not properly configured. Please contact support.',
        });
      }

      const paymentResponse = await nombaService.createCheckoutOrder(
        orderData
      );

      if (!paymentResponse.success) {
        console.error('Nomba payment initialization failed:', {
          message: paymentResponse.message,
          error: paymentResponse.error,
          details: paymentResponse.details,
        });

        return res.status(400).json({
          success: false,
          message: paymentResponse.message || 'Failed to initialize payment',
          error: paymentResponse.error,
          details: paymentResponse.details,
        });
      }

      // Store pending payment record
      await Payment.create({
        userId: user._id,
        planId: plan._id,
        amount: plan.priceNGN,
        currency: 'NGN',
        paymentReference: orderReference,
        status: 'pending',
        paymentMethod: 'nomba',
        metadata: {
          userId: user._id.toString(),
          planId: plan._id.toString(),
          billingInterval,
          tier: plan.tier,
          customerName: `${user.firstName} ${user.lastName}`,
          planName: plan.name,
        },
      });

      res.json({
        success: true,
        data: {
          authorization_url: paymentResponse.data!.checkoutLink,
          access_code: paymentResponse.data!.orderId,
          reference: orderReference,
        },
      });

    } catch (error) {
      console.error('Checkout session creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating checkout session',
        error: (error as Error).message,
      });
    }
  }

  // Verify payment by reference (public method for Nomba callback)
  async verifyPaymentByReference(req: Request, res: Response): Promise<any> {
    try {
      const reference = req.query.reference as string;

      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
      }

      // Verify with Nomba
      const verificationResult = await nombaService.verifyTransaction(
        reference
      );

      if (!verificationResult.success || !verificationResult.data) {
        return res.status(400).json({
          success: false,
          message: verificationResult.message || 'Payment verification failed',
        });
      }

      const paymentData = verificationResult.data;

      // If payment is successful, also process subscription activation
      if (paymentData.status === 'success' || paymentData.status === 'completed') {
        try {
          console.log('Payment verified as successful, looking for payment record:', reference);

          // Find the payment record
          const paymentRecord = await Payment.findOne({
            paymentReference: reference,
          });

          console.log('Payment record found:', paymentRecord ? {
            id: paymentRecord._id,
            userId: paymentRecord.userId,
            status: paymentRecord.status,
            amount: paymentRecord.amount
          } : 'No payment record found');

          if (paymentRecord && paymentRecord.status !== 'completed') {
            console.log('Processing subscription activation for verified payment:', reference);

            // Update payment status
            paymentRecord.status = 'completed';
            paymentRecord.completedAt = new Date();
            await paymentRecord.save();

            // Process subscription activation
            await this.processSubscriptionActivation(paymentRecord);

            console.log('Subscription activation completed for payment:', reference);
          } else if (paymentRecord && paymentRecord.status === 'completed') {
            console.log('Payment already processed, skipping activation:', reference);
          }
        } catch (activationError) {
          console.error('Error during subscription activation:', activationError);
          // Don't fail the verification response, just log the error
        }
      }

      // Return basic payment verification info
      return res.status(200).json({
        success: true,
        data: {
          status: paymentData.status,
          reference: paymentData.orderReference,
          amount: paymentData.amount,
        },
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying payment',
        error: (error as Error).message,
      });
    }
  }

  // Handle successful payment from Nomba
  async handleSuccessfulPayment(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { paymentReference } = req.body;

      if (!paymentReference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
      }

      // Check if this is a development mode mock payment
      let paymentData: any;
      if (
        process.env.NODE_ENV === 'development' &&
        paymentReference.startsWith('mock_')
      ) {
        // Mock verification for development
        paymentData = {
          status: 'success',
          reference: paymentReference,
          amount: 0, // Will be filled from payment record
          currency: 'NGN',
          customerEmail: '',
        };
      } else {
        // Verify payment with Nomba
        const verificationResult = await nombaService.verifyTransaction(
          paymentReference
        );

        if (!verificationResult.success || !verificationResult.data) {
          return res.status(400).json({
            success: false,
            message:
              verificationResult.message || 'Payment verification failed',
          });
        }

        paymentData = verificationResult.data;

        if (paymentData.status !== 'success' && paymentData.status !== 'completed') {
          return res.status(400).json({
            success: false,
            message: 'Payment not completed',
          });
        }
      }

      // Find the payment record
      const paymentRecord = await Payment.findOne({
        paymentReference: paymentReference,
      });

      if (!paymentRecord) {
        return res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
      }

      const userId = paymentRecord.userId;
      const planId = paymentRecord.planId;
      const billingInterval =
        paymentRecord.metadata?.billingInterval || 'monthly';

      if (!userId || !planId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment metadata',
        });
      }

      const user = await User.findById(userId);
      const plan = await SubscriptionPlan.findById(planId);

      if (!user || !plan) {
        return res.status(404).json({
          success: false,
          message: 'User or plan not found',
        });
      }

      // Ensure user has a workplaceId
      if (!user.workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'User must have a workplace to activate subscription',
        });
      }

      // Cancel existing active subscriptions for the workspace
      await Subscription.updateMany(
        { workspaceId: user.workplaceId, status: { $in: ['active', 'trial'] } },
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

      // Get all features for this subscription (plan features + feature flags)
      const features = await getSubscriptionFeatures(plan, plan.tier);

      // Create new subscription with workspaceId (not userId)
      const subscription = new Subscription({
        workspaceId: user.workplaceId,
        planId: planId,
        tier: plan.tier,
        status: plan.tier === 'free_trial' ? 'trial' : 'active',
        startDate: startDate,
        endDate: endDate,
        priceAtPurchase: plan.priceNGN,
        autoRenew: true,
        paymentReference: paymentReference,
        features: features,
      });

      await subscription.save();

      // Update payment record
      paymentRecord.status = 'completed';
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      // Update user subscription info
      user.currentSubscriptionId = subscription._id;
      user.currentPlanId = planId;
      await user.save();

      // Send confirmation email
      await emailService.sendSubscriptionConfirmation(user.email, {
        firstName: user.firstName,
        planName: plan.name,
        amount: plan.priceNGN,
        billingInterval: billingInterval,
        startDate: startDate,
        endDate: endDate,
      });

      res.json({
        success: true,
        message: 'Subscription activated successfully',
        data: subscription,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing payment',
        error: (error as Error).message,
      });
    }
  }

  // Cancel subscription
  async cancelSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { reason } = req.body;

      if (!req.user.workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'User must have a workplace',
        });
      }

      const subscription = await Subscription.findOne({
        workspaceId: req.user.workplaceId,
        status: { $in: ['active', 'trial'] },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // Set grace period (7 days)
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      subscription.status = 'past_due';
      subscription.gracePeriodEnd = gracePeriodEnd;
      subscription.autoRenew = false;

      await subscription.save();

      // Get plan details for email
      const plan = await SubscriptionPlan.findById(subscription.planId);

      // Send cancellation confirmation
      await emailService.sendSubscriptionCancellation(req.user.email, {
        firstName: req.user.firstName,
        planName: plan?.name || 'Unknown Plan',
        gracePeriodEnd: gracePeriodEnd,
        reason: reason,
      });

      res.json({
        success: true,
        message: 'Subscription canceled successfully',
        data: {
          gracePeriodEnd: gracePeriodEnd,
          accessUntil: gracePeriodEnd,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error cancelling subscription',
        error: (error as Error).message,
      });
    }
  }

  // Upgrade subscription
  async upgradeSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { planId, billingInterval = 'monthly' } = req.body;

      if (!req.user.workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'User must have a workplace',
        });
      }

      const currentSubscription = await Subscription.findOne({
        workspaceId: req.user.workplaceId,
        status: 'active',
      }).populate('planId');

      if (!currentSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      const newPlan = await SubscriptionPlan.findById(planId);
      if (!newPlan) {
        return res.status(404).json({
          success: false,
          message: 'New plan not found',
        });
      }

      // Check if this is actually an upgrade
      const tierOrder = [
        'free_trial',
        'basic',
        'pro',
        'pharmily',
        'network',
        'enterprise',
      ];
      const currentTierIndex = tierOrder.indexOf(currentSubscription.tier);
      const newTierIndex = tierOrder.indexOf(
        newPlan.name.toLowerCase().replace(' ', '_')
      );

      if (newTierIndex <= currentTierIndex) {
        return res.status(400).json({
          success: false,
          message:
            'This is not an upgrade. Use downgrade endpoint for downgrades.',
        });
      }

      // Calculate prorated amount
      const currentPlan = currentSubscription.planId as any;
      const daysRemaining = Math.ceil(
        (currentSubscription.endDate.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
      );
      const totalDaysInPeriod = billingInterval === 'yearly' ? 365 : 30;
      const proratedDiscount =
        (currentPlan.priceNGN * daysRemaining) / totalDaysInPeriod;
      const upgradeAmount = newPlan.priceNGN - proratedDiscount;

      // Create immediate payment for upgrade with Nomba
      // Note: For upgrades, you would need to implement Nomba payment flow here
      // This is a simplified version that updates the subscription directly
      console.log('Processing subscription upgrade...');

      // Update subscription in database
      const tierMapping: Record<string, string> = {
        'Free Trial': 'free_trial',
        Basic: 'basic',
        'Basic Yearly': 'basic',
        Pro: 'pro',
        'Pro Yearly': 'pro',
        Pharmily: 'pharmily',
        'Pharmily Yearly': 'pharmily',
        Network: 'network',
        'Network Yearly': 'network',
        Enterprise: 'enterprise',
        'Enterprise Yearly': 'enterprise',
      };
      const newTier = tierMapping[newPlan.name] || 'basic';

      const features = await FeatureFlag.find({
        isActive: true,
        allowedTiers: newTier,
      });

      currentSubscription.planId = newPlan._id;
      currentSubscription.tier = newTier as
        | 'free_trial'
        | 'basic'
        | 'pro'
        | 'pharmily'
        | 'network'
        | 'enterprise';
      currentSubscription.priceAtPurchase = newPlan.priceNGN;
      currentSubscription.features = features.map((f) => f.key);

      await currentSubscription.save();

      // Update user
      const user = await User.findById(req.user._id);
      if (user) {
        user.features = features.map((f) => f.key);
        await user.save();
      }

      // Send upgrade confirmation email
      await emailService.sendSubscriptionUpgrade(req.user.email, {
        firstName: req.user.firstName,
        oldPlanName: currentPlan.name,
        newPlanName: newPlan.name,
        upgradeAmount: upgradeAmount,
        effectiveDate: new Date(),
      });

      res.json({
        success: true,
        message: 'Subscription upgraded successfully',
        data: {
          subscription: currentSubscription,
          upgradeAmount: upgradeAmount,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error upgrading subscription',
        error: (error as Error).message,
      });
    }
  }

  // Downgrade subscription
  async downgradeSubscription(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { planId } = req.body;

      if (!req.user.workplaceId) {
        return res.status(400).json({
          success: false,
          message: 'User must have a workplace',
        });
      }

      const currentSubscription = await Subscription.findOne({
        workspaceId: req.user.workplaceId,
        status: 'active',
      }).populate('planId');

      if (!currentSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      const newPlan = await SubscriptionPlan.findById(planId);
      if (!newPlan) {
        return res.status(404).json({
          success: false,
          message: 'New plan not found',
        });
      }

      // Schedule downgrade at end of current billing period
      currentSubscription.scheduledDowngrade = {
        planId: newPlan._id,
        effectiveDate: currentSubscription.endDate,
        scheduledAt: new Date(),
      };

      await currentSubscription.save();

      // Send downgrade confirmation email
      const currentPlan = currentSubscription.planId as any;
      await emailService.sendSubscriptionDowngrade(req.user.email, {
        firstName: req.user.firstName,
        currentPlanName: currentPlan.name,
        newPlanName: newPlan.name,
        effectiveDate: currentSubscription.endDate,
      });

      res.json({
        success: true,
        message: 'Subscription downgrade scheduled successfully',
        data: {
          effectiveDate: currentSubscription.endDate,
          newPlan: newPlan.name,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error scheduling downgrade',
        error: (error as Error).message,
      });
    }
  }

  // Get subscription status for frontend
  async getSubscriptionStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const user = req.user;

      // Users without workplaces have no subscription (note: User model uses 'workplaceId' with 'e')
      if (!user.workplaceId) {
        return res.json({
          success: true,
          data: {
            hasWorkspace: false,
            hasSubscription: false,
            status: 'no_workspace',
            accessLevel: 'basic', // Knowledge Hub, CPD, Forum only
            message: 'Create or join a workplace to access full features',
          },
        });
      }

      // Get workspace subscription (Subscription model uses 'workspaceId' without 'e')
      const subscription = await Subscription.findOne({
        workspaceId: user.workplaceId, // User.workplaceId -> Subscription.workspaceId
        status: { $in: ['active', 'trial', 'grace_period'] },
      }).populate('planId');

      if (!subscription) {
        return res.json({
          success: true,
          data: {
            hasWorkspace: true,
            hasSubscription: false,
            status: 'no_subscription',
            accessLevel: 'limited',
            message: 'No active subscription found',
          },
        });
      }

      // Calculate trial info
      const now = new Date();
      const isTrialActive = subscription.status === 'trial' &&
        subscription.endDate &&
        now <= subscription.endDate;

      let daysRemaining = 0;
      if (isTrialActive && subscription.endDate) {
        const diffTime = subscription.endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      res.json({
        success: true,
        data: {
          hasWorkspace: true,
          hasSubscription: true,
          status: subscription.status,
          tier: subscription.tier,
          accessLevel: 'full',
          isTrialActive,
          daysRemaining,
          endDate: subscription.endDate,
          planId: subscription.planId,
          features: subscription.features || [],
          limits: subscription.limits || {},
        },
      });
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription status',
      });
    }
  }

  // Get subscription analytics
  async getSubscriptionAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<any> {
    try {
      const subscription = await Subscription.findOne({
        userId: req.user._id,
        status: { $in: ['active', 'trial', 'grace_period'] },
      }).populate('planId');

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // Calculate usage metrics (this would be expanded based on actual feature usage)
      const usageMetrics = {
        currentPeriodStart: subscription.startDate,
        currentPeriodEnd: subscription.endDate,
        daysRemaining: Math.ceil(
          (subscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
        features: subscription.features,
        // Add more metrics based on actual feature usage
        storageUsed: 0,
        apiCalls: 0,
        teamMembers: 1,
      };

      // Calculate cost optimization suggestions
      const costOptimization = {
        currentMonthlySpend: subscription.priceAtPurchase,
        projectedAnnualSpend: subscription.priceAtPurchase * 12,
        savings: {
          yearlyVsMonthly: subscription.priceAtPurchase * 2, // 2 months free
          downgradeSavings: 0, // Calculate based on available plans
        },
      };

      res.json({
        success: true,
        data: {
          subscription,
          usageMetrics,
          costOptimization,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching analytics',
        error: (error as Error).message,
      });
    }
  }

  // Nomba webhook handler
  async handleWebhook(req: Request, res: Response): Promise<any> {
    const signature = req.headers['x-nomba-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    let event;
    try {
      const payload = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = nombaService.verifyWebhookSignature(
        payload,
        signature
      );
      if (!isValid) {
        console.log('Webhook signature verification failed');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      event = req.body;
    } catch (err) {
      console.log('Webhook processing error:', (err as Error).message);
      return res
        .status(400)
        .json({ error: `Webhook Error: ${(err as Error).message}` });
    }

    try {
      switch (event.event_type) {
        case 'payment_success':
          await this.handleNombaPaymentSucceeded(event.data);
          break;
        case 'payment_failed':
          await this.handleNombaPaymentFailed(event.data);
          break;
        default:
          console.log(`Unhandled event type ${event.event_type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.log('Error processing webhook:', (err as Error).message);
      res
        .status(500)
        .json({ error: `Webhook handler failed: ${(err as Error).message}` });
    }
  }

  private async handleSubscriptionCreated(subscription: any) {
    // Handle new subscription creation for Nomba
    console.log('Subscription created via Nomba');
  }

  private async handleSubscriptionUpdated(subscription: any) {
    // Handle subscription updates for Nomba
    console.log('Subscription updated via Nomba');
  }

  private async handleSubscriptionDeleted(subscription: any) {
    // Handle subscription deletion for Nomba
    console.log('Subscription deleted via Nomba');
  }

  private async handlePaymentSucceeded(paymentData: any) {
    // Handle successful payment from payment provider webhook
    console.log(
      'Payment succeeded',
      paymentData?.reference || 'Unknown reference'
    );
    // Process payment success logic here
  }

  private async handlePaymentFailed(paymentData: any) {
    // Handle failed payment from payment provider webhook
    console.log(
      'Payment failed',
      paymentData?.reference || 'Unknown reference'
    );
    // Process payment failure logic here
  }

  // Nomba-specific webhook handlers
  private async handleNombaPaymentSucceeded(paymentData: any) {
    try {
      const reference = paymentData.order.orderReference;
      if (!reference) return;

      // Find the payment record
      const paymentRecord = await Payment.findOne({
        paymentReference: reference,
        status: 'pending',
      });

      if (!paymentRecord) {
        console.log('Payment record not found for reference:', reference);
        return;
      }

      // Process the subscription activation (this logic is also in handleSuccessfulPayment)
      console.log(
        'Processing Nomba payment success via webhook:',
        reference
      );

      // Update payment status
      paymentRecord.status = 'completed';
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      // Process subscription activation
      await this.processSubscriptionActivation(paymentRecord);
    } catch (error) {
      console.error('Error handling Nomba payment success:', error);
    }
  }

  private async handleNombaPaymentFailed(paymentData: any) {
    try {
      const reference = paymentData.order.orderReference;
      if (!reference) return;

      // Update payment record
      await Payment.updateOne(
        { paymentReference: reference },
        {
          status: 'failed',
          failedAt: new Date(),
        }
      );

      console.log('Payment failed for reference:', reference);
    } catch (error) {
      console.error('Error handling Nomba payment failure:', error);
    }
  }



  private async processSubscriptionActivation(paymentRecord: any) {
    try {
      const userId = paymentRecord.userId;
      const planId = paymentRecord.planId;
      const billingInterval =
        paymentRecord.metadata?.billingInterval || 'monthly';
      const tier = paymentRecord.metadata?.tier;

      const user = await User.findById(userId);

      // PRIORITY 1: Try PricingPlan first (newer model with correct pricing)
      let plan = null;
      if (planId) {
        console.log('Trying PricingPlan first for activation...');
        const PricingPlan = (await import('../models/PricingPlan')).default;
        const pricingPlan = await PricingPlan.findById(planId);

        if (pricingPlan) {
          console.log('Found PricingPlan for activation:', pricingPlan.name);
          // Create plan-like object from PricingPlan
          plan = {
            _id: pricingPlan._id,
            name: pricingPlan.name,
            tier: pricingPlan.tier,
            priceNGN: pricingPlan.price,
            features: pricingPlan.features || [],
          } as any;
        }
      }

      // PRIORITY 2: Fall back to SubscriptionPlan if PricingPlan not found
      if (!plan && planId) {
        console.log('PricingPlan not found, trying SubscriptionPlan for activation...');
        plan = await SubscriptionPlan.findById(planId);
      }

      if (!user || !plan) {
        console.error('User or plan not found for subscription activation', {
          userId,
          planId,
          userFound: !!user,
          planFound: !!plan,
        });
        return;
      }

      if (!user.workplaceId) {
        console.error('User does not have a workplaceId for subscription activation', {
          userId,
          userEmail: user.email,
        });
        return;
      }

      console.log('Activating subscription for user:', {
        userId: user._id,
        email: user.email,
        planName: plan.name,
        tier: plan.tier,
      });

      // Cancel existing active subscriptions for the workspace
      await Subscription.updateMany(
        { workspaceId: user.workplaceId, status: { $in: ['active', 'trial'] } },
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

      // Create new subscription
      const subscription = new Subscription({
        workspaceId: user.workplaceId,
        planId: planId,
        tier: plan.tier,
        status: plan.tier === 'free_trial' ? 'trial' : 'active',
        startDate: startDate,
        endDate: endDate,
        priceAtPurchase: plan.priceNGN,
        autoRenew: true,
        paymentReference: paymentRecord.paymentReference,
        features: Object.keys(plan.features).filter(
          (key: string) => (plan.features as any)[key] === true
        ),
      });

      await subscription.save();

      // Update user subscription info
      user.currentSubscriptionId = subscription._id;
      user.currentPlanId = planId;
      await user.save();

      // Send confirmation email
      await emailService.sendSubscriptionConfirmation(user.email, {
        firstName: user.firstName,
        planName: plan.name,
        amount: plan.priceNGN,
        billingInterval: billingInterval,
        startDate: startDate,
        endDate: endDate,
      });

      console.log('Subscription activated successfully for user:', userId);
    } catch (error) {
      console.error('Error processing subscription activation:', error);
    }
  }

  // Get billing history
  async getBillingHistory(req: AuthRequest, res: Response): Promise<any> {
    try {
      const payments = await Payment.find({
        userId: req.user._id,
      })
        .populate('planId')
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching billing history',
        error: (error as Error).message,
      });
    }
  }

  // Get usage metrics
  async getUsageMetrics(req: AuthRequest, res: Response): Promise<any> {
    try {
      const subscription = await Subscription.findOne({
        userId: req.user._id,
        status: { $in: ['active', 'trial', 'grace_period'] },
      }).populate('planId');

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // Basic usage metrics - you can expand this based on actual usage tracking
      const usageMetrics = {
        currentPeriodStart: subscription.startDate,
        currentPeriodEnd: subscription.endDate,
        daysRemaining: Math.ceil(
          (subscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
        features: subscription.features,
        // Add more usage tracking here as needed
        patientsCount: 0, // Would be fetched from actual patient records
        notesCount: 0, // Would be fetched from actual notes
        teamMembers: 1,
      };

      res.json({
        success: true,
        data: usageMetrics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching usage metrics',
        error: (error as Error).message,
      });
    }
  }
}

export const subscriptionController = new SubscriptionController();
