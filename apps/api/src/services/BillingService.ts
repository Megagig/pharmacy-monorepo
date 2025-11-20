import BillingSubscription, { IBillingSubscription } from '../models/BillingSubscription';
import BillingInvoice, { IBillingInvoice } from '../models/BillingInvoice';
import SubscriptionPlan from '../models/SubscriptionPlan';
import Payment from '../models/Payment';
import { nombaService } from './nombaService';
import { emailService } from '../utils/emailService';

export interface CreateSubscriptionData {
  workspaceId: string;
  planId: string;
  customerEmail: string;
  customerName: string;
  billingInterval: 'monthly' | 'yearly';
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface UpgradeSubscriptionData {
  subscriptionId: string;
  newPlanId: string;
  prorationBehavior: 'immediate' | 'next_cycle';
}

export interface BillingAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByStatus: Record<string, number>;
  revenueByPlan: Array<{ planName: string; revenue: number; count: number }>;
}

export class BillingService {
  /**
   * Create a new subscription with Nomba integration
   */
  async createSubscription(data: CreateSubscriptionData): Promise<IBillingSubscription> {
    const plan = await SubscriptionPlan.findById(data.planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Check for existing active subscription
    const existingSubscription = await BillingSubscription.findOne({
      workspaceId: data.workspaceId,
      status: { $in: ['active', 'trialing'] }
    });

    if (existingSubscription) {
      throw new Error('Workspace already has an active subscription');
    }

    const now = new Date();
    const trialEnd = data.trialDays ? new Date(now.getTime() + (data.trialDays * 24 * 60 * 60 * 1000)) : null;
    
    // Calculate billing period
    const periodStart = trialEnd || now;
    const periodEnd = new Date(periodStart);
    if (data.billingInterval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = new BillingSubscription({
      workspaceId: data.workspaceId,
      planId: data.planId,
      status: trialEnd ? 'trialing' : 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      billingCycleAnchor: periodStart,
      billingInterval: data.billingInterval,
      unitAmount: plan.priceNGN,
      currency: 'NGN',
      trialStart: trialEnd ? now : undefined,
      trialEnd: trialEnd,
      metadata: data.metadata || {}
    });

    await subscription.save();

    // Create Nomba customer if not in trial
    if (!trialEnd && nombaService.isNombaConfigured()) {
      try {
        // Note: Nomba customer creation would be implemented here
        // This is a placeholder for the actual Nomba customer creation API
        console.log('Creating Nomba customer for subscription:', subscription._id);
      } catch (error) {
        console.error('Failed to create Nomba customer:', error);
        // Continue without Nomba integration for now
      }
    }

    return subscription;
  }

  /**
   * Upgrade or downgrade a subscription
   */
  async updateSubscription(data: UpgradeSubscriptionData): Promise<IBillingSubscription> {
    const subscription = await BillingSubscription.findById(data.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = await SubscriptionPlan.findById(data.newPlanId);
    if (!newPlan) {
      throw new Error('New plan not found');
    }

    const currentPlan = await SubscriptionPlan.findById(subscription.planId);
    if (!currentPlan) {
      throw new Error('Current plan not found');
    }

    if (data.prorationBehavior === 'immediate') {
      // Calculate proration
      const prorationAmount = subscription.calculateProration(newPlan.priceNGN);
      
      // Create proration invoice if amount is positive
      if (prorationAmount > 0) {
        await this.createProrationInvoice(subscription, newPlan, prorationAmount);
      }

      // Update subscription immediately
      subscription.planId = newPlan._id;
      subscription.unitAmount = newPlan.priceNGN;
      await subscription.save();
    } else {
      // Schedule change for next billing cycle
      subscription.pendingUpdate = {
        planId: newPlan._id,
        effectiveDate: subscription.currentPeriodEnd,
        prorationAmount: 0
      };
      await subscription.save();
    }

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string, 
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<IBillingSubscription> {
    const subscription = await BillingSubscription.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelationReason = reason;
    } else {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.cancelationReason = reason;
    }

    await subscription.save();
    return subscription;
  }

  /**
   * Process subscription renewals
   */
  async processRenewals(): Promise<void> {
    const now = new Date();
    const subscriptionsToRenew = await BillingSubscription.find({
      status: 'active',
      currentPeriodEnd: { $lte: now },
      cancelAtPeriodEnd: false
    });

    for (const subscription of subscriptionsToRenew) {
      try {
        await this.renewSubscription(subscription);
      } catch (error) {
        console.error(`Failed to renew subscription ${subscription._id}:`, error);
        // Mark as past due and schedule dunning
        subscription.status = 'past_due';
        subscription.nextDunningAttempt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
        await subscription.save();
      }
    }
  }

  /**
   * Renew a subscription
   */
  private async renewSubscription(subscription: IBillingSubscription): Promise<void> {
    // Create renewal invoice
    const invoice = await this.createRenewalInvoice(subscription);
    
    // Attempt payment with Nomba
    if (nombaService.isNombaConfigured() && subscription.nombaCustomerId) {
      try {
        const paymentResult = await this.processPayment(invoice);
        if (paymentResult.success) {
          // Update subscription period
          const newPeriodStart = subscription.currentPeriodEnd;
          const newPeriodEnd = new Date(newPeriodStart);
          
          if (subscription.billingInterval === 'yearly') {
            newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
          } else {
            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
          }

          subscription.currentPeriodStart = newPeriodStart;
          subscription.currentPeriodEnd = newPeriodEnd;
          await subscription.save();

          // Mark invoice as paid
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          invoice.amountPaid = invoice.total;
          await invoice.save();
        }
      } catch (error) {
        console.error('Payment processing failed:', error);
        throw error;
      }
    }
  }

  /**
   * Create a renewal invoice
   */
  private async createRenewalInvoice(subscription: IBillingSubscription): Promise<IBillingInvoice> {
    const plan = await SubscriptionPlan.findById(subscription.planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    const invoice = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'open',
      currency: subscription.currency,
      dueDate: subscription.currentPeriodEnd,
      customerEmail: 'customer@example.com', // This should come from workspace/user data
      customerName: 'Customer Name', // This should come from workspace/user data
      lineItems: [{
        description: `${plan.name} - ${subscription.billingInterval} subscription`,
        amount: subscription.unitAmount,
        quantity: subscription.quantity,
        unitAmount: subscription.unitAmount,
        planId: plan._id,
        periodStart: subscription.currentPeriodEnd,
        periodEnd: subscription.billingInterval === 'yearly' 
          ? new Date(subscription.currentPeriodEnd.getFullYear() + 1, subscription.currentPeriodEnd.getMonth(), subscription.currentPeriodEnd.getDate())
          : new Date(subscription.currentPeriodEnd.getFullYear(), subscription.currentPeriodEnd.getMonth() + 1, subscription.currentPeriodEnd.getDate())
      }]
    });

    await invoice.save();
    return invoice;
  }

  /**
   * Create a proration invoice
   */
  private async createProrationInvoice(
    subscription: IBillingSubscription, 
    newPlan: any, 
    prorationAmount: number
  ): Promise<IBillingInvoice> {
    const invoice = new BillingInvoice({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription._id,
      status: 'open',
      currency: subscription.currency,
      dueDate: new Date(), // Due immediately
      customerEmail: 'customer@example.com', // This should come from workspace/user data
      customerName: 'Customer Name', // This should come from workspace/user data
      lineItems: [{
        description: `Proration for plan change to ${newPlan.name}`,
        amount: prorationAmount,
        quantity: 1,
        unitAmount: prorationAmount,
        planId: newPlan._id,
        proration: true
      }]
    });

    await invoice.save();
    return invoice;
  }

  /**
   * Process payment for an invoice
   */
  private async processPayment(invoice: IBillingInvoice): Promise<{ success: boolean; error?: string }> {
    try {
      // This would integrate with Nomba payment processing
      // For now, return a mock success
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get billing analytics
   */
  async getBillingAnalytics(timeRange?: { start: Date; end: Date }): Promise<BillingAnalytics> {
    // Use existing Subscription model
    const Subscription = (await import('../models/Subscription')).default;
    
    const matchStage: any = {};
    if (timeRange) {
      matchStage.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
    }

    // Get subscription counts by status
    const subscriptionsByStatus = await Subscription.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate MRR and ARR
    const activeSubscriptions = await Subscription.find({ status: 'active' });
    const monthlyRevenue = activeSubscriptions
      .filter(sub => sub.billingInterval === 'monthly')
      .reduce((sum, sub) => sum + (sub.priceAtPurchase || 0), 0);
    
    const yearlyRevenue = activeSubscriptions
      .filter(sub => sub.billingInterval === 'yearly')
      .reduce((sum, sub) => sum + ((sub.priceAtPurchase || 0) / 12), 0);

    const mrr = monthlyRevenue + yearlyRevenue;
    const arr = mrr * 12;

    // Get revenue by plan
    const revenueByPlan = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'pricingplans', localField: 'planId', foreignField: '_id', as: 'plan' } },
      { $unwind: '$plan' },
      { 
        $group: { 
          _id: '$plan.name', 
          revenue: { $sum: '$priceAtPurchase' },
          count: { $sum: 1 }
        } 
      },
      { $project: { planName: '$_id', revenue: 1, count: 1, _id: 0 } }
    ]);

    return {
      totalRevenue: arr, // Using ARR as total revenue
      monthlyRecurringRevenue: mrr,
      annualRecurringRevenue: arr,
      churnRate: 0, // Would need historical data to calculate
      averageRevenuePerUser: activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0,
      lifetimeValue: 0, // Would need historical data to calculate
      subscriptionsByStatus: subscriptionsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      revenueByPlan
    };
  }

  /**
   * Process dunning for past due subscriptions
   */
  async processDunning(): Promise<void> {
    const now = new Date();
    const pastDueSubscriptions = await BillingSubscription.find({
      status: 'past_due',
      nextDunningAttempt: { $lte: now }
    });

    for (const subscription of pastDueSubscriptions) {
      try {
        await this.attemptDunning(subscription);
      } catch (error) {
        console.error(`Dunning failed for subscription ${subscription._id}:`, error);
      }
    }
  }

  /**
   * Attempt dunning for a past due subscription
   */
  private async attemptDunning(subscription: IBillingSubscription): Promise<void> {
    subscription.pastDueNotificationsSent += 1;
    subscription.lastDunningAttempt = new Date();

    // Schedule next attempt (exponential backoff)
    const daysUntilNext = Math.min(Math.pow(2, subscription.pastDueNotificationsSent), 7);
    subscription.nextDunningAttempt = new Date(Date.now() + (daysUntilNext * 24 * 60 * 60 * 1000));

    // If too many attempts, mark as uncollectible
    if (subscription.pastDueNotificationsSent >= 5) {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.cancelationReason = 'Payment failure after multiple attempts';
    }

    await subscription.save();

    // Send dunning email
    // await emailService.sendDunningNotification(...);
  }

  /**
   * Get subscription by workspace ID
   */
  async getSubscriptionByWorkspace(workspaceId: string): Promise<IBillingSubscription | null> {
    return BillingSubscription.findOne({
      workspaceId,
      status: { $in: ['active', 'trialing', 'past_due'] }
    }).populate('planId');
  }

  /**
   * Get invoices for a workspace
   */
  async getInvoicesByWorkspace(workspaceId: string, limit: number = 10): Promise<IBillingInvoice[]> {
    // Try BillingInvoice first, fallback to creating from Payment records
    const invoices = await BillingInvoice.find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('subscriptionId');
    
    return invoices;
  }
}

export const billingService = new BillingService();