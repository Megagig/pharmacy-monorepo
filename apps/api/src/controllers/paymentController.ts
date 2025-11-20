import { Request, Response } from 'express';
import Stripe from 'stripe';
import Payment from '../models/Payment';
import Subscription from '../models/Subscription';
import User from '../models/User';
import { emailService } from '../utils/emailService';

interface AuthRequest extends Request {
  user?: any;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, dateFrom, dateTo } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter query
    const filter: any = { user: req.user._id };
    
    if (status) {
      filter.status = status;
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter)
        .populate('subscription', 'tier planId status')
        .populate({
          path: 'subscription',
          populate: {
            path: 'planId',
            model: 'SubscriptionPlan',
            select: 'name priceNGN billingInterval'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filter)
    ]);

    // Calculate summary statistics
    const summary = await Payment.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({ 
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          hasNext: skip + Number(limit) < totalCount,
          hasPrev: Number(page) > 1
        },
        summary: summary.length > 0 ? summary[0] : {
          totalAmount: 0,
          totalPayments: 0,
          successfulPayments: 0,
          failedPayments: 0
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching payments', 
      error: error.message 
    });
  }
};

export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.create({
      ...req.body,
      user: req.user._id
    });

    res.status(201).json({ 
      success: true,
      data: { payment }
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false,
      message: 'Error creating payment', 
      error: error.message 
    });
  }
};

export const getPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id
    })
    .populate('subscription')
    .populate({
      path: 'subscription',
      populate: {
        path: 'planId',
        model: 'SubscriptionPlan'
      }
    });

    if (!payment) {
      res.status(404).json({ 
        success: false,
        message: 'Payment not found' 
      });
      return;
    }

    res.json({ 
      success: true,
      data: { payment }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching payment', 
      error: error.message 
    });
  }
};

// Get payment methods from Stripe
export const getPaymentMethods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user || !user.stripeCustomerId) {
      res.json({
        success: true,
        data: { paymentMethods: [] }
      });
      return;
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    // Get default payment method
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const defaultPaymentMethodId = typeof customer !== 'string' && !customer.deleted && 'invoice_settings' in customer && customer.invoice_settings?.default_payment_method;

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPaymentMethodId,
      createdAt: new Date(pm.created * 1000)
    }));

    res.json({
      success: true,
      data: { paymentMethods: formattedMethods }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};

// Add new payment method
export const addPaymentMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethodId, setAsDefault = false } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({
        success: false,
        message: 'User does not have a Stripe customer ID'
      });
      return;
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripeCustomerId,
    });

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    res.json({
      success: true,
      message: 'Payment method added successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error adding payment method',
      error: error.message
    });
  }
};

// Remove payment method
export const removePaymentMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      res.status(400).json({
        success: false,
        message: 'Payment method ID is required'
      });
      return;
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error removing payment method',
      error: error.message
    });
  }
};

// Set default payment method
export const setDefaultPaymentMethod = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMethodId } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({
        success: false,
        message: 'User does not have a Stripe customer ID'
      });
      return;
    }

    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({
      success: true,
      message: 'Default payment method updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating default payment method',
      error: error.message
    });
  }
};

// Create setup intent for adding payment method
export const createSetupIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    let stripeCustomerId = user?.stripeCustomerId;

    // Create customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: `${user?.firstName} ${user?.lastName}`,
        metadata: {
          userId: user?._id.toString() || '',
        },
      });
      stripeCustomerId = customer.id;
      await User.findByIdAndUpdate(user?._id, { stripeCustomerId });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error creating setup intent',
      error: error.message
    });
  }
};

// Generate invoice PDF
export const generateInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findOne({
      _id: paymentId,
      user: req.user._id
    })
    .populate('subscription')
    .populate({
      path: 'subscription',
      populate: {
        path: 'planId',
        model: 'SubscriptionPlan'
      }
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
      return;
    }

    // For now, return invoice data - PDF generation would require additional libraries
    const invoiceData = {
      invoiceNumber: payment.invoice?.invoiceNumber || `INV-${payment._id}`,
      paymentId: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      date: payment.createdAt,
      customer: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      items: payment.invoice?.items || [{
        description: 'Subscription Plan',
        amount: payment.amount,
        quantity: 1
      }]
    };

    res.json({
      success: true,
      data: { invoice: invoiceData }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error generating invoice',
      error: error.message
    });
  }
};

export const processWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Handle payment webhooks from Stripe/PayPal
    const { type, data } = req.body;

    if (type === 'payment.succeeded') {
      await Payment.findByIdAndUpdate(
        data.paymentId,
        { status: 'completed' }
      );
    }

    res.json({ received: true });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};