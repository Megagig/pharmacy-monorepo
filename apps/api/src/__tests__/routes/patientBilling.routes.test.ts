import request from 'supertest';
import express from 'express';
import patientBillingRoutes from '../../routes/patientBilling.routes';
import { PatientBillingService } from '../../services/PatientBillingService';

// Mock dependencies
jest.mock('../../services/PatientBillingService');
jest.mock('../../middlewares/auth');
jest.mock('../../middlewares/patientAuth');
jest.mock('../../utils/logger');

const MockedPatientBillingService = PatientBillingService as jest.Mocked<typeof PatientBillingService>;

// Mock auth middleware
jest.mock('../../middlewares/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      _id: 'patient123',
      workplaceId: 'workspace123',
      role: 'patient'
    };
    next();
  }
}));

// Mock patient auth middleware
jest.mock('../../middlewares/patientAuth', () => ({
  validatePatientAccess: (req: any, res: any, next: any) => next()
}));

// Mock validation middleware
jest.mock('../../middlewares/validation', () => ({
  handleValidationErrors: (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api', patientBillingRoutes);

describe('Patient Billing Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/patients/:patientId/invoices', () => {
    it('should return patient invoices', async () => {
      const mockResult = {
        invoices: [{ id: 'inv1', total: 100 }],
        total: 1,
        hasMore: false
      };

      MockedPatientBillingService.getPatientInvoices.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/patients/patient123/invoices')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it('should handle service errors', async () => {
      MockedPatientBillingService.getPatientInvoices.mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .get('/api/patients/patient123/invoices')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve invoices');
    });
  });

  describe('POST /api/patients/:patientId/invoices/:invoiceId/pay', () => {
    it('should initiate payment successfully', async () => {
      const mockResult = {
        paymentId: 'pay123',
        paymentUrl: 'https://pay.example.com',
        paymentReference: 'REF123',
        status: 'pending'
      };

      MockedPatientBillingService.initiatePayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/patients/patient123/invoices/inv123/pay')
        .send({
          amount: 100,
          paymentMethod: 'credit_card'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });
  });

  describe('POST /api/billing/webhooks/payment-callback', () => {
    it('should process payment callback', async () => {
      MockedPatientBillingService.processPaymentCallback.mockResolvedValue();

      const response = await request(app)
        .post('/api/billing/webhooks/payment-callback')
        .send({
          paymentReference: 'REF123',
          status: 'completed',
          transactionId: 'TXN123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment callback processed successfully');
    });
  });

  describe('GET /api/patients/:patientId/balance', () => {
    it('should return outstanding balance', async () => {
      const mockBalance = {
        totalOutstanding: 500,
        overdueAmount: 200,
        currency: 'NGN',
        invoiceCount: 3,
        overdueCount: 1
      };

      MockedPatientBillingService.getOutstandingBalance.mockResolvedValue(mockBalance);

      const response = await request(app)
        .get('/api/patients/patient123/balance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBalance);
    });
  });
});