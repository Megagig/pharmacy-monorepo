import BillingSubscription, { IBillingSubscription } from '../models/BillingSubscription';
import BillingInvoice from '../models/BillingInvoice';
import SubscriptionPlan from '../models/SubscriptionPlan';
import Payment from '../models/Payment';
import { nombaService } from './nombaService';
import { emailService } from '../utils/emailService';

export interface UpgradeOptions {
  subscriptionId: string;
  newPlanId: string;
  effectiveDate?: Date;
  prorationBehavior: 'immediate' | 'next_cycle' | 'create_prorations';
}

export interface DowngradeOptions {
  subscriptionId: string;
  newPlanId: string;
  effectiveDate?: Date;
  applyImmediately?: boolean;
}

export interface BillingCycleResult {
  processed: number;
  failed: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

export class SubscriptionLifecycleService {
  /**
   * Upgrade a subscription with prorated billing
   */
  async upgradeSubscription(options: UpgradeOptions): Promise<IBillingSubscription> {
    const subscription = await BillingSubscription.findById(options.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.canUpgrade()) {
      throw new Error('Subscription cannot be upgraded in current state');
    }

    const newPlan = await SubscriptionPlan.findById(options.newPlanId);
    if (!newPlan) {
      throw new Error('New plan not found');
    }

    const currentPlan = await SubscriptionPlan.findById(subscription.planId);
    if (!currentPlan) {
      throw new Error('Current plan not found');
    }

    // Validate that this is actually an upgrade
    if (newPlan.priceNGN <= currentPlan.priceNGN) {
      throw new Error('New plan price must be higher than current plan for upgrade');
    }

    const effectiveDate = options.effectiveDate || new Date();

    switch (options.prorationBehavior) {
      case 'immediate':
        return this.processImmediateUpgrade(subscription, newPlan, effectiveDate);
      
      case 'next_cycle':
        return this.scheduleUpgradeForNextCycle(subscription, newPlan);
      
      case 'create_prorations':
        return this.processUpgradeWithProrations(subscription, newPlan, effectiveDate);
      
      default:
        throw new Error('Invalid proration behavior');
    }
  }

  /**
   * Downgrade a subscription
   */
  async downgradeSubscription(options: DowngradeOptions): Promise<IBillingSubscription> {
    const subscription = await BillingSubscription.findById(options.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.canDowngrade()) {
      throw new Error('Subscription cannot be downgraded in current state');
    }

    const newPlan = await SubscriptionPlan.findById(options.newPlanId);
    if (!newPlan) {
      throw new Error('New plan not found');
    }

    const currentPlan = await SubscriptionPlan.findById(subscription.planId);
    if (!currentPlan) {
      throw new Error('Current plan not found');
    }

    // Validate that this is actually a downgrade
    if (newPlan.priceNGN >= currentPlan.priceNGN) {
      throw new Error('New plan price must be lower than current plan for downgrade');
    }

    if (options.applyImmediately) {
      return this.processImmediateDowngrade(subscription, newPlan);
    } else {
      return this.scheduleDowngradeForNextCycle(subscription, newPlan, options.effectiveDate);
    }
  }

  /**
   * Process automatic billing cycles
   */
  async processBillingCycles(): Promise<BillingCycleResult> {
    const now = new Date();
    const result: BillingCycleResult = {
      processed: 0,
      failed: 0,
      errors: []
    };

    // Find subscriptions due for renewal
    const subscriptionsDue = await BillingSubscription.find({
      status: 'active',
      currentPeriodEnd: { $lte: now },
      cancelAtPeriodEnd: false
    });

    console.log(`Processing ${subscriptionsDue.length} subscriptions for billing cycle`);

    for (const subscription of subscriptionsDue) {
      try {
        await this.processSubscriptionRenewal(subscription);
        result.processed++;
      } catch (error) {
        console.error(`Failed to process subscription ${subscription._id}:`, error);
        result.failed++;
        result.errors.push({
          subscriptionId: subscription._id.toString(),
          error: (error as Error).message
        });

        // Mark subscription as past due
        subscription.status = 'past_due';
        subscription.nextDunningAttempt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
        await subscription.save();
      }
    }

    // Process pending plan changes
    await this.processPendingPlanChanges();

    // Process trial expirations
    await this.processTrialExpirations();

    return result;
  }

  /**
   * Process subscription status tracking
   */
  async updateSubscriptionStatuses(): Promise<void> {
    const now = new Date();

    // Update expired trials
    await BillingSubscription.updateMany(
      {
        status: 'trialing',
        trialEnd: { $lte: now }
      },
      {
        status: 'active'
      }
    );

    // Update expired subscriptions
    await BillingSubscription.updateMany(
      {
        status: 'active',
        currentPeriodEnd: { $lte: now },
        cancelAtPeriodEnd: true
      },
      {
        status: 'canceled',
        canceledAt: now
      }
    );

    // Update past due subscriptions that have exceeded grace period
    const gracePeriodExpired = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    await BillingSubscription.updateMany(
      {
        status: 'past_due',
        lastDunningAttempt: { $lte: gracePeriodExpired },
        pastDueNotificationsSent: { $gte: 5 }
      },
      {
        status: 'canceled',
        canceledAt: now,
        cancelationReason: 'Payment failure after multiple attempts'
      }
    );
  }

  /**
   * Calculate proration amount for plan changes
   */
  calculateProrationAmount(
    subscription: IBillingSubscription,
    newPlanAmount: number,
    effectiveDate: Date = new Date()
  ): number {
    const totalPeriodMs = subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime();
    const remainingPeriodMs = subscription.currentPeriodEnd.getTime() - effectiveDate.getTime();
    
    if (remainingPeriodMs <= 0) {
      return 0; // No proration needed if at end of period
    }

    const remainingPeriodRatio = remainingPeriodMs / totalPeriodMs;
    
    // Calculate unused portion of current plan
    const currentPlanCredit = subscription.unitAmount * remainingPeriodRatio;
    
    // Calculate prorated charge for new plan
    const newPlanCharge = newPlanAmount * remainingPeriodRatio;
    
    return Math.round((newPlanCharge - currentPlanCredit) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Process immediate upgrade
   */
  private async processImmediateUpgrade(
    subscription: IBillingSubscription,
    newPlan: any,
    effectiveDate: Date
  ): Promise<IBillingSubscription> {
    const prorationAmount = this.calculateProrationAmount(subscription, newPlan.priceNGN, effectiveDate);

    // Create proration invoice if amount is positive
    if (prorationAmount > 0) {
      await this.createProrationInvoice(subscription, newPlan, prorationAmount, 'upgrade');
    }

    // Update subscription
    subscription.planId = newPlan._id;
    subscription.unitAmount = newPlan.priceNGN;
    
    // Update plan features and limits
    const tierMapping: Record<string, string> = {
      'Free Trial': 'free_trial',
      'Basic': 'basic',
      'Pro': 'pro',
      'Pharmily': 'pharmily',
      'Network': 'network',
      'Enterprise': 'enterprise'
    };
    
    const newTier = tierMapping[newPlan.name] || 'basic';
    subscription.metadata = {
      ...subscription.metadata,
      previousPlan: subscription.planId,
      upgradeDate: effectiveDate,
      prorationAmount
    };

    await subscription.save();

    // Send upgrade confirmation email
    // await this.sendUpgradeConfirmationEmail(subscription, newPlan, prorationAmount);

    return subscription;
  }

  /**
   * Schedule upgrade for next billing cycle
   */
  private async scheduleUpgradeForNextCycle(
    subscription: IBillingSubscription,
    newPlan: any
  ): Promise<IBillingSubscription> {
    subscription.pendingUpdate = {
      planId: newPlan._id,
      effectiveDate: subscription.currentPeriodEnd,
      prorationAmount: 0
    };

    subscription.metadata = {
      ...subscription.metadata,
      scheduledUpgrade: {
        planId: newPlan._id,
        planName: newPlan.name,
        scheduledDate: subscription.currentPeriodEnd
      }
    };

    await subscription.save();

    // Send scheduled upgrade confirmation email
    // await this.sendScheduledUpgradeEmail(subscription, newPlan);

    return subscription;
  }

  /**
   * Process upgrade with detailed prorations
   */
  private async processUpgradeWithProrations(
    subscription: IBillingSubscription,
    newPlan: any,
    effectiveDate: Date
  ): Promise<IBillingSubscription> {
    const prorationAmount = this.calculateProrationAmount(subscription, newPlan.priceNGN, effectiveDate);

    // Create detailed proration invoice
    const invoice = await this.createDetailedProrationInvoice(subscription, newPlan, prorationAmount, effectiveDate);

    // Update subscription
    subscription.planId = newPlan._id;
    subscription.unitAmount = newPlan.priceNGN;
    subscription.metadata = {
      ...subscription.metadata,
      upgradeInvoiceId: invoice._id,
      upgradeDate: effectiveDate,
      prorationAmount
    };

    await subscription.save();

    return subscription;
  }

  /**
   * Process immediate downgrade
   */
  private async processImmediateDowngrade(
    subscription: IBillingSubscription,
    newPlan: any
  ): Promise<IBillingSubscription> {
    const prorationCredit = this.calculateProrationAmount(subscription, newPlan.priceNGN);

    // Create credit note if there's a credit amount
    if (prorationCredit < 0) {
      await this.createCreditNote(subscription, Math.abs(prorationCredit), 'downgrade');
    }

    // Update subscription
    subscription.planId = newPlan._id;
    subscription.unitAmount = newPlan.priceNGN;
    subscription.metadata = {
      ...subscription.metadata,
      previousPlan: subscription.planId,
      downgradeDate: new Date(),
      creditAmount: Math.abs(prorationCredit)
    };

    await subscription.save();

    return subscription;
  }

  /**
   * Schedule downgrade for next billing cycle
   */
  private async scheduleDowngradeForNextCycle(
    subscription: IBillingSubscription,
    newPlan: any,
    effectiveDate?: Date
  ): Promise<IBillingSubscription> {
    const scheduledDate = effectiveDate || subscription.currentPeriodEnd;

    subscription.pendingUpdate = {
      planId: newPlan._id,
      effectiveDate: scheduledDate,
      prorationAmount: 0
    };

    subscription.metadata = {
      ...subscription.metadata,
      scheduledDowngrade: {
        planId: newPlan._id,
        planName: newPlan.name,
        scheduledDate
      }
    };

    await subscription.save();

    return subscription;
  }

  /**
   * Process subscription renewal
   */
  private async processSubscriptionRenewal(subscription: IBillingSubscription): Promise<void> {
    // Create renewal invoice
    const invoice = await this.createRenewalInvoice(subscription);

    // Attempt payment
    if (nombaService.isNombaConfigured() && subscription.nombaCustomerId) {
      const paymentResult = await this.attemptPayment(subscription, invoice);
      
      if (paymentResult.success) {
        // Update subscription period
        await this.updateSubscriptionPeriod(subscription);
        
        // Mark invoice as paid
        invoice.status = 'paid';
        invoice.paidAt = new Date();
        invoice.amountPaid = invoice.total;
        await invoice.save();
      } else {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }
    } else {
      // For development or when Nomba is not configured
      console.log(`Skipping payment for subscription ${subscription._id} - Nomba not configured`);
      await this.updateSubscriptionPeriod(subscription);
    }
  }

  /**
   * Process pending plan changes
   */
  private async processPendingPlanChanges(): Promise<void> {
    const now = new Date();
    const subscriptionsWithPendingChanges = await BillingSubscription.find({
      'pendingUpdate.effectiveDate': { $lte: now }
    });

    for (const subscription of subscriptionsWithPendingChanges) {
      try {
        const newPlan = await SubscriptionPlan.findById(subscription.pendingUpdate!.planId);
        if (newPlan) {
          subscription.planId = newPlan._id;
          subscription.unitAmount = newPlan.priceNGN;
          subscription.pendingUpdate = undefined;
          
          subscription.metadata = {
            ...subscription.metadata,
            planChangeProcessed: now,
            newPlanName: newPlan.name
          };

          await subscription.save();
          console.log(`Processed pending plan change for subscription ${subscription._id}`);
        }
      } catch (error) {
        console.error(`Failed to process pending plan change for subscription ${subscription._id}:`, error);
      }
    }
  }

  /**
   * Process trial expirations
   */
  private async processTrialExpirations(): Promise<void> {
    const now = new Date();
    const expiringTrials = await BillingSubscription.find({
      status: 'trialing',
      trialEnd: { $lte: now }
    });

    for (const subscription of expiringTrials) {
      try {
        if (subscription.defaultPaymentMethod) {
          // Attempt to convert trial to paid subscription
          subscription.status = 'active';
          await subscription.save();
          
          // Create first invoice
          await this.createRenewalInvoice(subscription);
        } else {
          // No payment method, mark as incomplete
          subscription.status = 'incomplete';
          await subscription.save();
          
          // Send payment method required email
          // await this.sendPaymentMethodRequiredEmail(subscription);
        }
      } catch (error) {
        console.error(`Failed to process trial expiration for subscription ${subscription._id}:`, error);
      }
    }
  }

  /**
   * Create proration invoice
   */
  private async createProrationInvoice(
    subscription: IBillingSubscription,
    newPlan: any,
    amount: number,
    type: 'upgrade' | 'downgrade'
  ): Promise<any> {
    const invoice = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'open',
      currency: subscription.currency,
      dueDate: new Date(), // Due immediately
      customerEmail: 'customer@example.com', // Should come from workspace data
      customerName: 'Customer Name', // Should come from workspace data
      lineItems: [{
        description: `${type === 'upgrade' ? 'Upgrade' : 'Downgrade'} proration to ${newPlan.name}`,
        amount: amount,
        quantity: 1,
        unitAmount: amount,
        planId: newPlan._id,
        proration: true
      }]
    });

    await invoice.save();
    return invoice;
  }

  /**
   * Create detailed proration invoice
   */
  private async createDetailedProrationInvoice(
    subscription: IBillingSubscription,
    newPlan: any,
    prorationAmount: number,
    effectiveDate: Date
  ): Promise<any> {
    const currentPlan = await SubscriptionPlan.findById(subscription.planId);
    const remainingDays = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const invoice = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'open',
      currency: subscription.currency,
      dueDate: new Date(),
      customerEmail: 'customer@example.com',
      customerName: 'Customer Name',
      lineItems: [
        {
          description: `Credit for unused time on ${currentPlan?.name} (${remainingDays} days)`,
          amount: -subscription.calculateProration(subscription.unitAmount),
          quantity: 1,
          unitAmount: -subscription.calculateProration(subscription.unitAmount),
          planId: subscription.planId,
          proration: true
        },
        {
          description: `Charge for ${newPlan.name} (${remainingDays} days)`,
          amount: subscription.calculateProration(newPlan.priceNGN),
          quantity: 1,
          unitAmount: subscription.calculateProration(newPlan.priceNGN),
          planId: newPlan._id,
          proration: true
        }
      ]
    });

    await invoice.save();
    return invoice;
  }

  /**
   * Create credit note
   */
  private async createCreditNote(
    subscription: IBillingSubscription,
    amount: number,
    reason: string
  ): Promise<any> {
    const creditNote = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'paid',
      currency: subscription.currency,
      dueDate: new Date(),
      customerEmail: 'customer@example.com',
      customerName: 'Customer Name',
      lineItems: [{
        description: `Credit for ${reason}`,
        amount: -amount,
        quantity: 1,
        unitAmount: -amount,
        proration: true
      }],
      metadata: {
        type: 'credit_note',
        reason
      }
    });

    await creditNote.save();
    return creditNote;
  }

  /**
   * Create renewal invoice
   */
  private async createRenewalInvoice(subscription: IBillingSubscription): Promise<any> {
    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    const nextPeriodStart = subscription.currentPeriodEnd;
    const nextPeriodEnd = new Date(nextPeriodStart);
    
    if (subscription.billingInterval === 'yearly') {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    const invoice = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'open',
      currency: subscription.currency,
      dueDate: subscription.currentPeriodEnd,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Name',
      lineItems: [{
        description: `${plan.name} - ${subscription.billingInterval} subscription`,
        amount: subscription.unitAmount,
        quantity: subscription.quantity,
        unitAmount: subscription.unitAmount,
        planId: plan._id,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd
      }]
    });

    await invoice.save();
    return invoice;
  }

  /**
   * Attempt payment for subscription
   */
  private async attemptPayment(
    subscription: IBillingSubscription,
    invoice: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with Nomba for actual payment processing
      // For now, return mock success
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update subscription period after successful renewal
   */
  private async updateSubscriptionPeriod(subscription: IBillingSubscription): Promise<void> {
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    
    if (subscription.billingInterval === 'yearly') {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    }

    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.status = 'active';
    
    // Reset dunning fields
    subscription.pastDueNotificationsSent = 0;
    subscription.lastDunningAttempt = undefined;
    subscription.nextDunningAttempt = undefined;

    await subscription.save();
  }
}

export const subscriptionLifecycleService = new SubscriptionLifecycleService();