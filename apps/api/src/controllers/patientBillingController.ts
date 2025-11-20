import { Request, Response } from 'express';
import { PatientBillingService } from '../services/PatientBillingService';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
  };
}

export class PatientBillingController {
  /**
   * Get patient invoices
   */
  static async getPatientInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { status, dateFrom, dateTo, limit, skip } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access (patient can only access their own data)
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const filters = {
        status: status as any,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined
      };

      const result = await PatientBillingService.getPatientInvoices(
        patientId,
        workplaceId,
        filters
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getPatientInvoices:', error);
      res.status(500).json({
        error: 'Failed to retrieve invoices',
        message: error.message
      });
    }
  }

  /**
   * Get invoice details
   */
  static async getInvoiceDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId, invoiceId } = req.params;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const invoice = await PatientBillingService.getInvoiceDetails(
        patientId,
        invoiceId,
        workplaceId
      );

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      logger.error('Error in getInvoiceDetails:', error);
      res.status(500).json({
        error: 'Failed to retrieve invoice details',
        message: error.message
      });
    }
  }

  /**
   * Get payment history
   */
  static async getPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const { limit, skip } = req.query;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const result = await PatientBillingService.getPaymentHistory(
        patientId,
        workplaceId,
        limit ? parseInt(limit as string) : undefined,
        skip ? parseInt(skip as string) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getPaymentHistory:', error);
      res.status(500).json({
        error: 'Failed to retrieve payment history',
        message: error.message
      });
    }
  }

  /**
   * Get outstanding balance
   */
  static async getOutstandingBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const balance = await PatientBillingService.getOutstandingBalance(
        patientId,
        workplaceId
      );

      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      logger.error('Error in getOutstandingBalance:', error);
      res.status(500).json({
        error: 'Failed to retrieve outstanding balance',
        message: error.message
      });
    }
  }

  /**
   * Initiate payment
   */
  static async initiatePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId, invoiceId } = req.params;
      const { amount, paymentMethod, currency, description, metadata } = req.body;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Validate required fields
      if (!amount || !paymentMethod) {
        res.status(400).json({ error: 'Amount and payment method are required' });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: 'Amount must be greater than zero' });
        return;
      }

      const paymentData = {
        amount: parseFloat(amount),
        paymentMethod,
        currency,
        description,
        metadata
      };

      const result = await PatientBillingService.initiatePayment(
        patientId,
        invoiceId,
        workplaceId,
        paymentData
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in initiatePayment:', error);
      res.status(500).json({
        error: 'Failed to initiate payment',
        message: error.message
      });
    }
  }

  /**
   * Process payment webhook/callback
   */
  static async processPaymentCallback(req: Request, res: Response): Promise<void> {
    try {
      const { paymentReference, status, transactionId, amount, metadata } = req.body;

      if (!paymentReference || !status) {
        res.status(400).json({ error: 'Payment reference and status are required' });
        return;
      }

      await PatientBillingService.processPaymentCallback({
        paymentReference,
        status,
        transactionId,
        amount: amount ? parseFloat(amount) : undefined,
        metadata
      });

      res.json({
        success: true,
        message: 'Payment callback processed successfully'
      });
    } catch (error) {
      logger.error('Error in processPaymentCallback:', error);
      res.status(500).json({
        error: 'Failed to process payment callback',
        message: error.message
      });
    }
  }

  /**
   * Get insurance claims
   */
  static async getInsuranceClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const claims = await PatientBillingService.getInsuranceClaims(
        patientId,
        workplaceId
      );

      res.json({
        success: true,
        data: claims
      });
    } catch (error) {
      logger.error('Error in getInsuranceClaims:', error);
      res.status(500).json({
        error: 'Failed to retrieve insurance claims',
        message: error.message
      });
    }
  }

  /**
   * Submit insurance claim
   */
  static async submitInsuranceClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { patientId, invoiceId } = req.params;
      const { insuranceProvider, policyNumber, claimAmount, description } = req.body;
      const workplaceId = req.user?.workplaceId;

      if (!workplaceId) {
        res.status(401).json({ error: 'Workspace not found' });
        return;
      }

      // Validate patient access
      if (req.user?.role === 'patient' && req.user._id !== patientId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Validate required fields
      if (!insuranceProvider || !policyNumber || !claimAmount) {
        res.status(400).json({ 
          error: 'Insurance provider, policy number, and claim amount are required' 
        });
        return;
      }

      if (claimAmount <= 0) {
        res.status(400).json({ error: 'Claim amount must be greater than zero' });
        return;
      }

      const claimData = {
        insuranceProvider,
        policyNumber,
        claimAmount: parseFloat(claimAmount),
        description
      };

      const claim = await PatientBillingService.submitInsuranceClaim(
        patientId,
        invoiceId,
        workplaceId,
        claimData
      );

      res.json({
        success: true,
        data: claim
      });
    } catch (error) {
      logger.error('Error in submitInsuranceClaim:', error);
      res.status(500).json({
        error: 'Failed to submit insurance claim',
        message: error.message
      });
    }
  }
}