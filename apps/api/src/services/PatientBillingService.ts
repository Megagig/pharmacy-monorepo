import mongoose from 'mongoose';
import BillingInvoice, { IBillingInvoice } from '../models/BillingInvoice';
import Payment, { IPayment } from '../models/Payment';
import Patient, { IPatient } from '../models/Patient';
import { nombaService, NombaService } from './nombaService';
import logger from '../utils/logger';

export interface PatientInvoiceFilter {
  status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  skip?: number;
}

export interface PaymentInitiationData {
  amount: number;
  paymentMethod: 'credit_card' | 'debit_card' | 'bank_transfer' | 'mobile_money' | 'paystack' | 'nomba';
  currency?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface InsuranceClaim {
  id: string;
  invoiceId: string;
  patientId: string;
  claimNumber: string;
  status: 'submitted' | 'processing' | 'approved' | 'denied' | 'paid';
  submittedDate: Date;
  processedDate?: Date;
  claimAmount: number;
  approvedAmount?: number;
  denialReason?: string;
  insuranceProvider: string;
  policyNumber: string;
}

export class PatientBillingService {
  /**
   * Get patient invoices with filtering and pagination
   */
  static async getPatientInvoices(
    patientId: string,
    workplaceId: string,
    filters: PatientInvoiceFilter = {}
  ): Promise<{
    invoices: IBillingInvoice[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Build query
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        'metadata.patientId': patientId
      };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      const limit = filters.limit || 20;
      const skip = filters.skip || 0;

      // Get invoices with pagination
      const [invoices, total] = await Promise.all([
        BillingInvoice.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        BillingInvoice.countDocuments(query)
      ]);

      return {
        invoices: invoices as IBillingInvoice[],
        total,
        hasMore: skip + invoices.length < total
      };
    } catch (error) {
      logger.error('Error getting patient invoices:', {
        error: error.message,
        patientId,
        workplaceId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get detailed invoice information
   */
  static async getInvoiceDetails(
    patientId: string,
    invoiceId: string,
    workplaceId: string
  ): Promise<IBillingInvoice> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const invoice = await BillingInvoice.findOne({
        _id: invoiceId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        'metadata.patientId': patientId
      });

      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }

      return invoice;
    } catch (error) {
      logger.error('Error getting invoice details:', {
        error: error.message,
        patientId,
        invoiceId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Get patient payment history
   */
  static async getPaymentHistory(
    patientId: string,
    workplaceId: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<{
    payments: IPayment[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Get payments for this patient
      const query = {
        'invoice.metadata.patientId': patientId,
        'invoice.metadata.workplaceId': workplaceId
      };

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Payment.countDocuments(query)
      ]);

      return {
        payments: payments as IPayment[],
        total,
        hasMore: skip + payments.length < total
      };
    } catch (error) {
      logger.error('Error getting payment history:', {
        error: error.message,
        patientId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Get patient's outstanding balance
   */
  static async getOutstandingBalance(
    patientId: string,
    workplaceId: string
  ): Promise<{
    totalOutstanding: number;
    overdueAmount: number;
    currency: string;
    invoiceCount: number;
    overdueCount: number;
  }> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Aggregate outstanding balances
      const result = await BillingInvoice.aggregate([
        {
          $match: {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            'metadata.patientId': patientId,
            status: { $in: ['open', 'uncollectible'] },
            amountDue: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: '$amountDue' },
            overdueAmount: {
              $sum: {
                $cond: [
                  { $lt: ['$dueDate', new Date()] },
                  '$amountDue',
                  0
                ]
              }
            },
            invoiceCount: { $sum: 1 },
            overdueCount: {
              $sum: {
                $cond: [
                  { $lt: ['$dueDate', new Date()] },
                  1,
                  0
                ]
              }
            },
            currency: { $first: '$currency' }
          }
        }
      ]);

      if (result.length === 0) {
        return {
          totalOutstanding: 0,
          overdueAmount: 0,
          currency: 'NGN',
          invoiceCount: 0,
          overdueCount: 0
        };
      }

      return result[0];
    } catch (error) {
      logger.error('Error getting outstanding balance:', {
        error: error.message,
        patientId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Initiate payment for an invoice
   */
  static async initiatePayment(
    patientId: string,
    invoiceId: string,
    workplaceId: string,
    paymentData: PaymentInitiationData
  ): Promise<{
    paymentId: string;
    paymentUrl?: string;
    paymentReference: string;
    status: string;
  }> {
    try {
      // Get invoice details
      const invoice = await this.getInvoiceDetails(patientId, invoiceId, workplaceId);

      if (invoice.status !== 'open') {
        throw new Error('Invoice is not available for payment');
      }

      if (invoice.amountDue <= 0) {
        throw new Error('Invoice has no outstanding amount');
      }

      // Validate payment amount
      if (paymentData.amount > invoice.amountDue) {
        throw new Error('Payment amount exceeds outstanding balance');
      }

      // Create payment record
      const payment = new Payment({
        userId: new mongoose.Types.ObjectId(patientId),
        amount: paymentData.amount,
        currency: paymentData.currency || invoice.currency,
        paymentMethod: paymentData.paymentMethod,
        status: 'pending',
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          metadata: {
            patientId,
            workplaceId,
            invoiceId: invoice._id.toString()
          }
        },
        transactionId: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      await payment.save();

      // Process payment based on method
      let paymentResult;
      if (paymentData.paymentMethod === 'nomba') {
        const orderReference = `nomba_patient_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        paymentResult = await nombaService.createCheckoutOrder({
          orderReference,
          customerId: patientId,
          customerEmail: paymentData.metadata?.customerEmail || 'patient@example.com',
          amount: NombaService.formatAmount(paymentData.amount),
          currency: paymentData.currency || invoice.currency,
          callbackUrl: paymentData.metadata?.callbackUrl || `${process.env.FRONTEND_URL}/patient/payment/success`,
          accountId: nombaService.getAccountId(),
        });

        if (paymentResult.success && paymentResult.data) {
          // Update payment with Nomba details
          payment.paymentReference = orderReference;
          payment.transactionId = paymentResult.data.orderId;
          await payment.save();
        }
      }

      return {
        paymentId: payment._id.toString(),
        paymentUrl: paymentResult?.success ? paymentResult.data?.checkoutLink : undefined,
        paymentReference: payment.paymentReference || payment.transactionId,
        status: payment.status
      };
    } catch (error) {
      logger.error('Error initiating payment:', {
        error: error.message,
        patientId,
        invoiceId,
        workplaceId,
        paymentData
      });
      throw error;
    }
  }

  /**
   * Process payment callback/webhook
   */
  static async processPaymentCallback(paymentData: {
    paymentReference: string;
    status: 'completed' | 'failed';
    transactionId?: string;
    amount?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Find payment by reference
      const payment = await Payment.findOne({
        $or: [
          { paymentReference: paymentData.paymentReference },
          { transactionId: paymentData.paymentReference }
        ]
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      payment.status = paymentData.status;
      if (paymentData.status === 'completed') {
        payment.completedAt = new Date();
      } else {
        payment.failedAt = new Date();
      }

      if (paymentData.transactionId) {
        payment.transactionId = paymentData.transactionId;
      }

      await payment.save();

      // Update invoice if payment completed
      if (paymentData.status === 'completed' && payment.invoice?.metadata?.invoiceId) {
        const invoice = await BillingInvoice.findById(payment.invoice.metadata.invoiceId);
        if (invoice) {
          invoice.amountPaid += payment.amount;
          invoice.calculateTotals();

          if (invoice.amountDue <= 0) {
            invoice.status = 'paid';
            invoice.paidAt = new Date();
          }

          await invoice.save();
        }
      }

      logger.info('Payment callback processed:', {
        paymentReference: paymentData.paymentReference,
        status: paymentData.status,
        paymentId: payment._id
      });
    } catch (error) {
      logger.error('Error processing payment callback:', {
        error: error.message,
        paymentData
      });
      throw error;
    }
  }

  /**
   * Get insurance claims for patient
   */
  static async getInsuranceClaims(
    patientId: string,
    workplaceId: string
  ): Promise<InsuranceClaim[]> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // For now, return mock data as insurance claims would typically
      // be handled by external insurance systems
      // In a real implementation, this would integrate with insurance APIs
      return [];
    } catch (error) {
      logger.error('Error getting insurance claims:', {
        error: error.message,
        patientId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Submit insurance claim for invoice
   */
  static async submitInsuranceClaim(
    patientId: string,
    invoiceId: string,
    workplaceId: string,
    claimData: {
      insuranceProvider: string;
      policyNumber: string;
      claimAmount: number;
      description?: string;
    }
  ): Promise<InsuranceClaim> {
    try {
      // Get invoice details
      const invoice = await this.getInvoiceDetails(patientId, invoiceId, workplaceId);

      // Verify patient has insurance info
      const patient = await Patient.findById(patientId);
      if (!patient?.insuranceInfo?.provider) {
        throw new Error('Patient insurance information not found');
      }

      // Create claim record (in a real implementation, this would integrate with insurance APIs)
      const claim: InsuranceClaim = {
        id: `CLAIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceId: invoice._id.toString(),
        patientId,
        claimNumber: `CLM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        status: 'submitted',
        submittedDate: new Date(),
        claimAmount: claimData.claimAmount,
        insuranceProvider: claimData.insuranceProvider,
        policyNumber: claimData.policyNumber
      };

      // In a real implementation, you would:
      // 1. Submit to insurance API
      // 2. Store claim in database
      // 3. Set up webhooks for status updates

      logger.info('Insurance claim submitted:', {
        claimId: claim.id,
        patientId,
        invoiceId,
        claimAmount: claimData.claimAmount
      });

      return claim;
    } catch (error) {
      logger.error('Error submitting insurance claim:', {
        error: error.message,
        patientId,
        invoiceId,
        workplaceId,
        claimData
      });
      throw error;
    }
  }
}