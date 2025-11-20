import { Request, Response } from 'express';
import { billingService } from '../services/BillingService';
import { nombaService } from '../services/nombaService';
import BillingSubscription from '../models/BillingSubscription';
import BillingInvoice from '../models/BillingInvoice';
import Payment from '../models/Payment';

interface AuthRequest extends Request {
  user?: any;
}

export class BillingController {
  /**
   * Create a new subscription
   */
  async createSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { planId, billingInterval = 'monthly', trialDays } = req.body;
      const user = req.user;

      if (!user?.workplaceId) {
        res.status(400).json({
          success: false,
          message: 'User must be associated with a workspace'
        });
        return;
      }

      const subscription = await billingService.createSubscription({
        workspaceId: user.workplaceId,
        planId,
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        billingInterval,
        trialDays,
        metadata: {
          userId: user._id,
          createdBy: user.email
        }
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully'
      });
    } catch (error) {
      console.error('Create subscription error:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Get current subscription for workspace
   */
  async getCurrentSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user?.workplaceId) {
        res.status(400).json({
          success: false,
          message: 'User must be associated with a workspace'
        });
        return;
      }

      const subscription = await billingService.getSubscriptionByWorkspace(user.workplaceId);

      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription'
      });
    }
  }

  /**
   * Upgrade or downgrade subscription
   */
  async updateSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId, newPlanId, prorationBehavior = 'immediate' } = req.body;

      const subscription = await billingService.updateSubscription({
        subscriptionId,
        newPlanId,
        prorationBehavior
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription updated successfully'
      });
    } catch (error) {
      console.error('Update subscription error:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId, cancelAtPeriodEnd = true, reason } = req.body;

      const subscription = await billingService.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd,
        reason
      );

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription canceled successfully'
      });
    } catch (error) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  }

  /**
   * Get billing history for workspace
   */
  async getBillingHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!user?.workplaceId) {
        res.status(400).json({
          success: false,
          message: 'User must be associated with a workspace'
        });
        return;
      }

      const invoices = await billingService.getInvoicesByWorkspace(user.workplaceId, limit);

      res.json({
        success: true,
        data: invoices
      });
    } catch (error) {
      console.error('Get billing history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch billing history'
      });
    }
  }

  /**
   * Create checkout session for subscription payment
   */
  async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { subscriptionId, invoiceId } = req.body;
      const user = req.user;

      let invoice;
      if (invoiceId) {
        invoice = await BillingInvoice.findById(invoiceId);
      } else if (subscriptionId) {
        // Create invoice for subscription payment
        const subscription = await BillingSubscription.findById(subscriptionId);
        if (!subscription) {
          res.status(404).json({
            success: false,
            message: 'Subscription not found'
          });
          return;
        }
        // Create invoice logic would go here
      }

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
        return;
      }

      // Create Nomba payment
      const paymentData = {
        amount: invoice.total,
        currency: invoice.currency,
        customerEmail: invoice.customerEmail,
        customerName: invoice.customerName,
        description: `Payment for invoice ${invoice.invoiceNumber}`,
        callbackUrl: `${process.env.FRONTEND_URL}/billing/payment-success`,
        metadata: {
          invoiceId: invoice._id.toString(),
          subscriptionId: subscriptionId,
          userId: user._id.toString()
        }
      };

      if (nombaService.isNombaConfigured()) {
        const paymentResponse = await nombaService.initiatePayment(paymentData);

        if (paymentResponse.success) {
          // Store payment record
          await Payment.create({
            userId: user._id,
            amount: invoice.total,
            currency: invoice.currency,
            paymentReference: paymentResponse.data!.reference,
            status: 'pending',
            paymentMethod: 'nomba',
            metadata: paymentData.metadata
          });

          res.json({
            success: true,
            data: {
              checkoutUrl: paymentResponse.data!.checkoutUrl,
              reference: paymentResponse.data!.reference
            }
          });
        } else {
          res.status(400).json({
            success: false,
            message: paymentResponse.message
          });
        }
      } else {
        // Development mode or Nomba not configured
        const mockReference = `mock_${Date.now()}_${user._id}`;

        await Payment.create({
          userId: user._id,
          amount: invoice.total,
          currency: invoice.currency,
          paymentReference: mockReference,
          status: 'pending',
          paymentMethod: 'nomba',
          metadata: paymentData.metadata
        });

        res.json({
          success: true,
          data: {
            checkoutUrl: `${process.env.FRONTEND_URL}/billing/mock-payment?reference=${mockReference}`,
            reference: mockReference
          },
          message: 'Development mode: Mock payment initiated'
        });
      }
    } catch (error) {
      console.error('Create checkout session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create checkout session'
      });
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentReference } = req.body;

      if (!paymentReference) {
        res.status(400).json({
          success: false,
          message: 'Payment reference is required'
        });
        return;
      }

      // Find payment record
      const paymentRecord = await Payment.findOne({ paymentReference });
      if (!paymentRecord) {
        res.status(404).json({
          success: false,
          message: 'Payment record not found'
        });
        return;
      }

      // Verify payment with Nomba (unless mock)
      if (!paymentReference.startsWith('mock_') && nombaService.isNombaConfigured()) {
        const verificationResult = await nombaService.verifyPayment(paymentReference);

        if (!verificationResult.success || verificationResult.data?.status !== 'success') {
          res.status(400).json({
            success: false,
            message: 'Payment verification failed'
          });
          return;
        }
      }

      // Update payment record
      paymentRecord.status = 'completed';
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      // Update invoice if applicable
      const invoiceId = paymentRecord.metadata?.invoiceId;
      if (invoiceId) {
        const invoice = await BillingInvoice.findById(invoiceId);
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          invoice.amountPaid = invoice.total;
          await invoice.save();
        }
      }

      res.json({
        success: true,
        message: 'Payment processed successfully'
      });
    } catch (error) {
      console.error('Handle payment success error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process payment'
      });
    }
  }

  /**
   * Process refund
   */
  async processRefund(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { paymentReference, amount, reason } = req.body;

      if (!paymentReference) {
        res.status(400).json({
          success: false,
          message: 'Payment reference is required'
        });
        return;
      }

      // Find payment record
      const paymentRecord = await Payment.findOne({ paymentReference });
      if (!paymentRecord) {
        res.status(404).json({
          success: false,
          message: 'Payment record not found'
        });
        return;
      }

      if (paymentRecord.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Can only refund completed payments'
        });
        return;
      }

      // Process refund with Nomba
      if (nombaService.isNombaConfigured()) {
        const refundResult = await nombaService.refundPayment(paymentReference, amount);

        if (refundResult.success) {
          // Update payment record
          paymentRecord.status = 'refunded';
          paymentRecord.refundedAt = new Date();
          paymentRecord.refundAmount = amount || paymentRecord.amount;
          paymentRecord.refundReason = reason;
          await paymentRecord.save();

          res.json({
            success: true,
            message: 'Refund processed successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            message: refundResult.message
          });
        }
      } else {
        // Mock refund for development
        paymentRecord.status = 'refunded';
        paymentRecord.refundedAt = new Date();
        paymentRecord.refundAmount = amount || paymentRecord.amount;
        paymentRecord.refundReason = reason;
        await paymentRecord.save();

        res.json({
          success: true,
          message: 'Refund processed successfully (development mode)'
        });
      }
    } catch (error) {
      console.error('Process refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund'
      });
    }
  }

  /**
   * Get billing analytics (admin only)
   */
  async getBillingAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const analytics = await billingService.getBillingAnalytics(timeRange);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get billing analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch billing analytics'
      });
    }
  }

  /**
   * Get all subscriptions (Super Admin only)
   */
  async getAllSubscriptions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, status, search } = req.query;

      const query: any = {};
      if (status) {
        query.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);

      // Use the existing Subscription model instead of BillingSubscription
      const Subscription = (await import('../models/Subscription')).default;

      let subscriptions = await Subscription.find(query)
        .populate('workspaceId', 'name email')
        .populate('planId', 'name tier priceNGN')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      // Apply search filter if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        subscriptions = subscriptions.filter(sub => {
          const workspace = sub.workspaceId as any;
          return (
            workspace?.name?.toLowerCase().includes(searchLower) ||
            workspace?.email?.toLowerCase().includes(searchLower)
          );
        });
      }

      const total = await Subscription.countDocuments(query);

      // Transform data to include customer info
      const transformedSubscriptions = subscriptions.map(sub => {
        const workspace = sub.workspaceId as any;
        const plan = sub.planId as any;

        return {
          _id: sub._id,
          status: sub.status,
          planName: plan?.name || 'Unknown Plan',
          unitAmount: sub.priceAtPurchase || 0,
          currency: 'NGN',
          currentPeriodStart: sub.startDate,
          currentPeriodEnd: sub.endDate,
          billingInterval: sub.billingInterval,
          customerName: workspace?.name || 'Unknown',
          customerEmail: workspace?.email || 'N/A',
          cancelAtPeriodEnd: !sub.autoRenew,
          trialEnd: sub.trialEndDate,
          createdAt: sub.createdAt
        };
      });

      res.json({
        success: true,
        data: {
          subscriptions: transformedSubscriptions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get all subscriptions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscriptions'
      });
    }
  }

  /**
   * Get revenue trends over time
   */
  async getRevenueTrends(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = '30d' } = req.query;

      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;
      else if (period === '365d') daysBack = 365;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get completed payments grouped by date
      const payments = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt' }
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      // Fill in missing dates with zero revenue
      const trends = [];
      for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (daysBack - i - 1));
        const dateStr = date.toISOString().split('T')[0];

        const payment = payments.find(p => p._id === dateStr);
        trends.push({
          date: dateStr,
          revenue: payment?.revenue || 0,
          transactions: payment?.count || 0
        });
      }

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('Get revenue trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch revenue trends'
      });
    }
  }

  /**
   * Get all invoices with pagination and filters
   */
  async getAllInvoices(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, status, search } = req.query;

      // Map payment status to invoice status
      const statusMap: Record<string, string> = {
        'paid': 'completed',
        'open': 'pending',
        'void': 'failed',
        'uncollectible': 'failed'
      };

      const query: any = {};
      if (status && statusMap[status as string]) {
        query.status = statusMap[status as string];
      }

      const skip = (Number(page) - 1) * Number(limit);

      // Use Payment model as invoices
      let payments = await Payment.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      // Transform payments to invoice format
      let invoices = payments.map(payment => {
        const user = payment.userId as any;
        return {
          _id: payment._id,
          invoiceNumber: payment.paymentReference || `PAY-${payment._id}`,
          status: payment.status === 'completed' ? 'paid' : payment.status === 'pending' ? 'open' : 'void',
          total: payment.amount,
          currency: payment.currency,
          dueDate: payment.createdAt,
          paidAt: payment.completedAt,
          customerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          customerEmail: user?.email || 'N/A'
        };
      });

      // Apply search filter if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        invoices = invoices.filter(inv =>
          inv.invoiceNumber.toLowerCase().includes(searchLower) ||
          inv.customerName.toLowerCase().includes(searchLower) ||
          inv.customerEmail.toLowerCase().includes(searchLower)
        );
      }

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        data: {
          invoices,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get all invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices'
      });
    }
  }

  /**
   * Get payment methods for all customers (Super Admin only)
   */
  async getAllPaymentMethods(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get unique payment methods from completed payments
      const paymentMethods = await Payment.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              paymentMethod: '$paymentMethod'
            },
            customerName: { $first: { $concat: ['$user.firstName', ' ', '$user.lastName'] } },
            customerEmail: { $first: '$user.email' },
            lastUsed: { $max: '$completedAt' },
            transactionCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $sort: { lastUsed: -1 }
        },
        {
          $limit: 100
        }
      ]);

      const transformedMethods = paymentMethods.map(pm => ({
        _id: `${pm._id.userId}_${pm._id.paymentMethod}`,
        userId: pm._id.userId,
        paymentMethod: pm._id.paymentMethod,
        customerName: pm.customerName,
        customerEmail: pm.customerEmail,
        lastUsed: pm.lastUsed,
        transactionCount: pm.transactionCount,
        totalAmount: pm.totalAmount,
        status: 'active'
      }));

      res.json({
        success: true,
        data: transformedMethods
      });
    } catch (error) {
      console.error('Get all payment methods error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment methods'
      });
    }
  }
}

export const billingController = new BillingController();