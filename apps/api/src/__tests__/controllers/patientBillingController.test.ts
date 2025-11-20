import request from 'supertest';
import express from 'express';
import { PatientBillingController } from '../../controllers/patientBillingController';
import { PatientBillingService } from '../../services/PatientBillingService';

// Mock the service
jest.mock('../../services/PatientBillingService');
jest.mock('../../utils/logger');

const MockedPatientBillingService = PatientBillingService as jest.Mocked<typeof PatientBillingService>;

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.user = {
    _id: 'patient123',
    workplaceId: 'workspace123',
    role: 'patient'
  };
  next();
});

// Setup routes
app.get('/patients/:patientId/invoices', PatientBillingController.getPatientInvoices);
app.get('/patients/:patientId/invoices/:invoiceId', PatientBillingController.getInvoiceDetails);
app.get('/patients/:patientId/payments', PatientBillingController.getPaymentHistory);
app.get('/patients/:patientId/balance', PatientBillingController.getOutstandingBalance);
app.post('/patients/:patientId/invoices/:invoiceId/pay', PatientBillingController.initiatePayment);

describe('PatientBillingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /patients/:patientId/invoices', () => {
    it('should return patient invoices', async () => {
      const mockResult = {
        invoices: [{ id: 'inv1', total: 100 }],
        total: 1,
        hasMore: false
      };

      MockedPatientBillingService.getPatientInvoices.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/patients/patient123/invoices')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
    });

    it('should return 403 for unauthorized patient access', async () => {
      const response = await request(app)
        .get('/patients/otherpatient/invoices')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('POST /patients/:patientId/invoices/:invoiceId/pay', () => {
    it('should initiate payment successfully', async () => {
      const mockResult = {
        paymentId: 'pay123',
        paymentUrl: 'https://pay.example.com',
        paymentReference: 'REF123',
        status: 'pending'
      };

      MockedPatientBillingService.initiatePayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/patients/patient123/invoices/inv123/pay')
        .send({
          amount: 100,
          paymentMethod: 'credit_card'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/patients/patient123/invoices/inv123/pay')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Amount and payment method are required');
    });
  });
});