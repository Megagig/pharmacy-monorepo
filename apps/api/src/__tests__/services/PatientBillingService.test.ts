import mongoose from 'mongoose';
import { PatientBillingService } from '../../services/PatientBillingService';
import BillingInvoice from '../../models/BillingInvoice';
import Payment from '../../models/Payment';
import Patient from '../../models/Patient';
import { nombaService } from '../../services/nombaService';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../../models/BillingInvoice');
jest.mock('../../models/Payment');
jest.mock('../../models/Patient');
jest.mock('../../services/nombaService');
jest.mock('../../utils/logger');

const MockedBillingInvoice = BillingInvoice as jest.Mocked<typeof BillingInvoice>;
const MockedPayment = Payment as jest.Mocked<typeof Payment>;
const MockedPatient = Patient as jest.Mocked<typeof Patient>;
const mockedNombaService = nombaService as jest.Mocked<typeof nombaService>;

describe('PatientBillingService', () => {
  const mockPatientId = new mongoose.Types.ObjectId().toString();
  const mockWorkplaceId = new mongoose.Types.ObjectId().toString();
  const mockInvoiceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatientInvoices', () => {
    it('should return patient invoices with pagination', async () => {
      const mockPatient = { _id: mockPatientId, workplaceId: mockWorkplaceId };
      const mockInvoices = [
        { _id: mockInvoiceId, invoiceNumber: 'INV-001', total: 100 },
        { _id: new mongoose.Types.ObjectId(), invoiceNumber: 'INV-002', total: 200 }
      ];

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedBillingInvoice.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockInvoices)
      } as any);
      MockedBillingInvoice.countDocuments.mockResolvedValue(2);

      const result = await PatientBillingService.getPatientInvoices(
        mockPatientId,
        mockWorkplaceId,
        { limit: 10, skip: 0 }
      );

      expect(result).toEqual({
        invoices: mockInvoices,
        total: 2,
        hasMore: false
      });
    });

    it('should throw error if patient not found', async () => {
      MockedPatient.findOne.mockResolvedValue(null);

      await expect(
        PatientBillingService.getPatientInvoices(mockPatientId, mockWorkplaceId)
      ).rejects.toThrow('Patient not found or access denied');
    });
  });

  describe('getOutstandingBalance', () => {
    it('should return outstanding balance summary', async () => {
      const mockPatient = { _id: mockPatientId, workplaceId: mockWorkplaceId };
      const mockAggregateResult = [{
        totalOutstanding: 500,
        overdueAmount: 200,
        invoiceCount: 3,
        overdueCount: 1,
        currency: 'NGN'
      }];

      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedBillingInvoice.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await PatientBillingService.getOutstandingBalance(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toEqual(mockAggregateResult[0]);
    });

    it('should return zero balance when no outstanding invoices', async () => {
      const mockPatient = { _id: mockPatientId, workplaceId: mockWorkplaceId };
      MockedPatient.findOne.mockResolvedValue(mockPatient as any);
      MockedBillingInvoice.aggregate.mockResolvedValue([]);

      const result = await PatientBillingService.getOutstandingBalance(
        mockPatientId,
        mockWorkplaceId
      );

      expect(result).toEqual({
        totalOutstanding: 0,
        overdueAmount: 0,
        currency: 'NGN',
        invoiceCount: 0,
        overdueCount: 0
      });
    });
  });

  describe('initiatePayment', () => {
    it('should throw error for non-open invoice', async () => {
      const mockInvoice = {
        _id: mockInvoiceId,
        status: 'paid',
        amountDue: 0
      };

      jest.spyOn(PatientBillingService, 'getInvoiceDetails').mockResolvedValue(mockInvoice as any);

      await expect(
        PatientBillingService.initiatePayment(
          mockPatientId,
          mockInvoiceId,
          mockWorkplaceId,
          { amount: 100, paymentMethod: 'credit_card' }
        )
      ).rejects.toThrow('Invoice is not available for payment');
    });
  });

  describe('processPaymentCallback', () => {
    it('should throw error if payment not found', async () => {
      MockedPayment.findOne.mockResolvedValue(null);

      await expect(
        PatientBillingService.processPaymentCallback({
          paymentReference: 'INVALID_REF',
          status: 'completed'
        })
      ).rejects.toThrow('Payment not found');
    });
  });
});