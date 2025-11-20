import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import PatientUser from '../../../models/PatientUser';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import Invoice from '../../../models/Invoice';
import Payment from '../../../models/Payment';
import { generateToken } from '../../../utils/token';

describe('Patient Billing Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let testPharmacist: any;
  let testInvoice: any;
  let testPayment: any;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'admin@testpharmacy.com',
      phone: '+2348012345678',
      address: '123 Test Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Lagos Island',
      licenseNumber: 'PCN-TEST-001',
      isActive: true,
      subscriptionStatus: 'active'
    });

    // Create test pharmacist
    testPharmacist = await User.create({
      firstName: 'Dr. Jane',
      lastName: 'Pharmacist',
      email: 'pharmacist@testpharmacy.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isEmailVerified: true,
      status: 'active'
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348087654321',
      email: 'john.doe@example.com',
      address: '456 Patient Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Ikeja',
      workplaceId: testWorkplace._id,
      insuranceInfo: {
        provider: 'Test Insurance',
        policyNumber: 'TI-123456',
        expiryDate: new Date('2024-12-31'),
        coverageDetails: 'Full coverage',
        copayAmount: 1000
      }
    });

    // Create test patient user
    testPatientUser = await PatientUser.create({
      email: 'john.doe@example.com',
      password: 'password123',
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      status: 'active',
      isEmailVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        appointmentReminders: true,
        medicationReminders: true,
        refillReminders: true
      }
    });

    // Create test invoice
    testInvoice = await Invoice.create({
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      invoiceNumber: 'INV-2024-001',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [
        {
          description: 'Lisinopril 10mg - 30 tablets',
          quantity: 1,
          unitPrice: 5000,
          totalPrice: 5000,
          itemType: 'medication',
          medicationId: new mongoose.Types.ObjectId()
        },
        {
          description: 'Consultation fee',
          quantity: 1,
          unitPrice: 3000,
          totalPrice: 3000,
          itemType: 'consultation'
        }
      ],
      subtotal: 8000,
      tax: 800,
      discount: 0,
      totalAmount: 8800,
      status: 'pending',
      paymentTerms: 'Net 30',
      notes: 'Payment due within 30 days',
      createdBy: testPharmacist._id
    });

    // Create test payment
    testPayment = await Payment.create({
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      invoiceId: testInvoice._id,
      paymentReference: 'PAY-2024-001',
      amount: 4400, // Partial payment
      paymentMethod: 'card',
      paymentStatus: 'completed',
      paymentDate: new Date(),
      transactionId: 'txn_123456789',
      paymentGateway: 'stripe',
      currency: 'NGN',
      createdBy: testPatientUser._id
    });

    // Generate patient token
    patientToken = generateToken(testPatientUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
  });

  describe('Invoice Management', () => {
    describe('GET /api/patient-portal/billing/invoices', () => {
      it('should return patient invoices', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/invoices')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].invoiceNumber).toBe('INV-2024-001');
        expect(response.body.data[0].totalAmount).toBe(8800);
        expect(response.body.data[0].status).toBe('pending');
      });

      it('should filter invoices by status', async () => {
        // Create paid invoice
        await Invoice.create({
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          invoiceNumber: 'INV-2024-002',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          items: [{
            description: 'Test item',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            itemType: 'medication'
          }],
          subtotal: 1000,
          tax: 100,
          totalAmount: 1100,
          status: 'paid',
          createdBy: testPharmacist._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/billing/invoices?status=pending')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('pending');
      });

      it('should filter invoices by date range', async () => {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 7);

        const response = await request(testApp)
          .get(`/api/patient-portal/billing/invoices?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });

      it('should sort invoices by issue date (newest first)', async () => {
        // Create older invoice
        const olderDate = new Date();
        olderDate.setDate(olderDate.getDate() - 30);

        await Invoice.create({
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          invoiceNumber: 'INV-2024-000',
          issueDate: olderDate,
          dueDate: new Date(olderDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          items: [{
            description: 'Older item',
            quantity: 1,
            unitPrice: 2000,
            totalPrice: 2000,
            itemType: 'consultation'
          }],
          subtotal: 2000,
          tax: 200,
          totalAmount: 2200,
          status: 'paid',
          createdBy: testPharmacist._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/billing/invoices')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        // Newer invoice should come first
        expect(response.body.data[0].invoiceNumber).toBe('INV-2024-001');
        expect(response.body.data[1].invoiceNumber).toBe('INV-2024-000');
      });

      it('should paginate results', async () => {
        // Create additional invoices
        for (let i = 2; i <= 6; i++) {
          await Invoice.create({
            patientId: testPatient._id,
            workplaceId: testWorkplace._id,
            invoiceNumber: `INV-2024-00${i}`,
            issueDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + (30 - i) * 24 * 60 * 60 * 1000),
            items: [{
              description: `Item ${i}`,
              quantity: 1,
              unitPrice: 1000 * i,
              totalPrice: 1000 * i,
              itemType: 'medication'
            }],
            subtotal: 1000 * i,
            tax: 100 * i,
            totalAmount: 1100 * i,
            status: 'pending',
            createdBy: testPharmacist._id
          });
        }

        const response = await request(testApp)
          .get('/api/patient-portal/billing/invoices?limit=3&page=1')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination.totalPages).toBeGreaterThan(1);
      });

      it('should require authentication', async () => {
        await request(testApp)
          .get('/api/patient-portal/billing/invoices')
          .expect(401);
      });

      it('should include payment information', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/invoices')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data[0].paidAmount).toBe(4400);
        expect(response.body.data[0].remainingBalance).toBe(4400);
        expect(response.body.data[0].paymentStatus).toBe('partially_paid');
      });
    });

    describe('GET /api/patient-portal/billing/invoices/:invoiceId', () => {
      it('should return detailed invoice information', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${testInvoice._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.invoiceNumber).toBe('INV-2024-001');
        expect(response.body.data.items).toHaveLength(2);
        expect(response.body.data.items[0].description).toBe('Lisinopril 10mg - 30 tablets');
        expect(response.body.data.subtotal).toBe(8000);
        expect(response.body.data.tax).toBe(800);
        expect(response.body.data.totalAmount).toBe(8800);
      });

      it('should include payment history', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${testInvoice._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.payments).toHaveLength(1);
        expect(response.body.data.payments[0].amount).toBe(4400);
        expect(response.body.data.payments[0].paymentStatus).toBe('completed');
      });

      it('should return 404 for non-existent invoice', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });

      it('should not allow access to other patients invoices', async () => {
        // Create another patient and invoice
        const otherPatient = await Patient.create({
          firstName: 'Other',
          lastName: 'Patient',
          dateOfBirth: new Date('1985-01-01'),
          gender: 'female',
          phone: '+2348087654999',
          email: 'other@example.com',
          workplaceId: testWorkplace._id
        });

        const otherInvoice = await Invoice.create({
          patientId: otherPatient._id,
          workplaceId: testWorkplace._id,
          invoiceNumber: 'INV-OTHER-001',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          items: [{
            description: 'Other patient item',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            itemType: 'medication'
          }],
          subtotal: 1000,
          tax: 100,
          totalAmount: 1100,
          status: 'pending',
          createdBy: testPharmacist._id
        });

        // Try to access other patient's invoice
        await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${otherInvoice._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });
    });

    describe('GET /api/patient-portal/billing/invoices/:invoiceId/download', () => {
      it('should download invoice PDF', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${testInvoice._id}/download`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.headers['content-disposition']).toContain('INV-2024-001.pdf');
      });

      it('should return 404 for non-existent invoice', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/billing/invoices/${nonExistentId}/download`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });
    });
  });

  describe('Payment Processing', () => {
    describe('POST /api/patient-portal/billing/invoices/:invoiceId/pay', () => {
      it('should initiate payment for invoice', async () => {
        const paymentData = {
          amount: 4400, // Remaining balance
          paymentMethod: 'card',
          currency: 'NGN'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(paymentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentIntent).toBeDefined();
        expect(response.body.data.clientSecret).toBeDefined();
        expect(response.body.data.amount).toBe(4400);
      });

      it('should validate payment amount', async () => {
        const invalidPaymentData = {
          amount: 10000, // More than remaining balance
          paymentMethod: 'card',
          currency: 'NGN'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidPaymentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('amount exceeds');
      });

      it('should validate payment method', async () => {
        const invalidPaymentData = {
          amount: 1000,
          paymentMethod: 'invalid-method',
          currency: 'NGN'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidPaymentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('payment method');
      });

      it('should not allow payment for fully paid invoices', async () => {
        // Mark invoice as paid
        await Invoice.findByIdAndUpdate(testInvoice._id, { status: 'paid' });

        const paymentData = {
          amount: 1000,
          paymentMethod: 'card',
          currency: 'NGN'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(paymentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already paid');
      });

      it('should handle insurance coverage', async () => {
        const paymentData = {
          amount: 3400, // After insurance copay
          paymentMethod: 'card',
          currency: 'NGN',
          useInsurance: true
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(paymentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.insuranceCoverage).toBeDefined();
        expect(response.body.data.copayAmount).toBe(1000);
      });
    });

    describe('POST /api/patient-portal/billing/payments/confirm', () => {
      it('should confirm successful payment', async () => {
        const confirmationData = {
          paymentIntentId: 'pi_test_123456',
          invoiceId: testInvoice._id,
          amount: 4400,
          transactionId: 'txn_confirmed_123'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/billing/payments/confirm')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(confirmationData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentStatus).toBe('completed');
        
        // Verify payment was recorded
        const payment = await Payment.findOne({ 
          invoiceId: testInvoice._id,
          transactionId: 'txn_confirmed_123'
        });
        expect(payment).toBeTruthy();
        expect(payment?.amount).toBe(4400);
      });

      it('should update invoice status when fully paid', async () => {
        const confirmationData = {
          paymentIntentId: 'pi_test_full_payment',
          invoiceId: testInvoice._id,
          amount: 4400, // Remaining balance
          transactionId: 'txn_full_payment'
        };

        await request(testApp)
          .post('/api/patient-portal/billing/payments/confirm')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(confirmationData)
          .expect(200);

        // Verify invoice is marked as paid
        const updatedInvoice = await Invoice.findById(testInvoice._id);
        expect(updatedInvoice?.status).toBe('paid');
      });

      it('should handle failed payment confirmation', async () => {
        const confirmationData = {
          paymentIntentId: 'pi_test_failed',
          invoiceId: testInvoice._id,
          amount: 4400,
          status: 'failed',
          errorMessage: 'Card declined'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/billing/payments/confirm')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(confirmationData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentStatus).toBe('failed');
        
        // Verify failed payment was recorded
        const payment = await Payment.findOne({ 
          invoiceId: testInvoice._id,
          paymentStatus: 'failed'
        });
        expect(payment).toBeTruthy();
      });
    });
  });

  describe('Payment History', () => {
    describe('GET /api/patient-portal/billing/payments', () => {
      it('should return patient payment history', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/payments')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].paymentReference).toBe('PAY-2024-001');
        expect(response.body.data[0].amount).toBe(4400);
        expect(response.body.data[0].paymentStatus).toBe('completed');
      });

      it('should filter payments by status', async () => {
        // Create failed payment
        await Payment.create({
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          invoiceId: testInvoice._id,
          paymentReference: 'PAY-2024-002',
          amount: 1000,
          paymentMethod: 'card',
          paymentStatus: 'failed',
          paymentDate: new Date(),
          transactionId: 'txn_failed_123',
          paymentGateway: 'stripe',
          currency: 'NGN',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/billing/payments?status=completed')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].paymentStatus).toBe('completed');
      });

      it('should filter payments by date range', async () => {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 7);

        const response = await request(testApp)
          .get(`/api/patient-portal/billing/payments?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });

      it('should sort payments by date (newest first)', async () => {
        // Create older payment
        const olderDate = new Date();
        olderDate.setDate(olderDate.getDate() - 30);

        await Payment.create({
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          invoiceId: testInvoice._id,
          paymentReference: 'PAY-2024-000',
          amount: 2000,
          paymentMethod: 'cash',
          paymentStatus: 'completed',
          paymentDate: olderDate,
          transactionId: 'txn_older_123',
          paymentGateway: 'manual',
          currency: 'NGN',
          createdBy: testPharmacist._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/billing/payments')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        // Newer payment should come first
        expect(response.body.data[0].paymentReference).toBe('PAY-2024-001');
        expect(response.body.data[1].paymentReference).toBe('PAY-2024-000');
      });

      it('should include invoice information', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/payments')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data[0].invoice).toBeDefined();
        expect(response.body.data[0].invoice.invoiceNumber).toBe('INV-2024-001');
      });
    });

    describe('GET /api/patient-portal/billing/payments/:paymentId', () => {
      it('should return detailed payment information', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/billing/payments/${testPayment._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.paymentReference).toBe('PAY-2024-001');
        expect(response.body.data.amount).toBe(4400);
        expect(response.body.data.paymentMethod).toBe('card');
        expect(response.body.data.transactionId).toBe('txn_123456789');
      });

      it('should return 404 for non-existent payment', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/billing/payments/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });
    });

    describe('GET /api/patient-portal/billing/payments/:paymentId/receipt', () => {
      it('should download payment receipt', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/billing/payments/${testPayment._id}/receipt`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.headers['content-disposition']).toContain('PAY-2024-001-receipt.pdf');
      });
    });
  });

  describe('Billing Summary', () => {
    describe('GET /api/patient-portal/billing/summary', () => {
      it('should return billing summary', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/summary')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.totalOutstanding).toBe(4400);
        expect(response.body.data.totalPaid).toBe(4400);
        expect(response.body.data.pendingInvoices).toBe(1);
        expect(response.body.data.overdueInvoices).toBe(0);
      });

      it('should include recent transactions', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/summary')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.recentTransactions).toBeDefined();
        expect(response.body.data.recentTransactions).toHaveLength(1);
      });

      it('should include insurance information', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/summary')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.insuranceInfo).toBeDefined();
        expect(response.body.data.insuranceInfo.provider).toBe('Test Insurance');
        expect(response.body.data.insuranceInfo.copayAmount).toBe(1000);
      });
    });
  });

  describe('Payment Methods', () => {
    describe('GET /api/patient-portal/billing/payment-methods', () => {
      it('should return available payment methods', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/payment-methods')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.methods).toContain('card');
        expect(response.body.data.methods).toContain('bank_transfer');
        expect(response.body.data.currencies).toContain('NGN');
      });

      it('should include payment gateway configuration', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/billing/payment-methods')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.gateways).toBeDefined();
        expect(response.body.data.gateways.stripe).toBeDefined();
        expect(response.body.data.gateways.stripe.publicKey).toBeDefined();
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should apply rate limiting to payment endpoints', async () => {
      const paymentData = {
        amount: 1000,
        paymentMethod: 'card',
        currency: 'NGN'
      };

      // Make multiple payment requests quickly
      const requests = Array(10).fill(null).map(() => 
        request(testApp)
          .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(paymentData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate workspace context for billing', async () => {
      // Create invoice in different workplace
      const differentWorkplace = await Workplace.create({
        name: 'Different Pharmacy',
        email: 'admin@different.com',
        phone: '+2348012345679',
        address: '789 Different Street, Lagos, Nigeria',
        state: 'Lagos',
        lga: 'Ikeja',
        licenseNumber: 'PCN-DIFF-001',
        isActive: true,
        subscriptionStatus: 'active'
      });

      const differentInvoice = await Invoice.create({
        patientId: testPatient._id,
        workplaceId: differentWorkplace._id, // Different workplace
        invoiceNumber: 'INV-DIFF-001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        items: [{
          description: 'Cross-workplace item',
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
          itemType: 'medication'
        }],
        subtotal: 1000,
        tax: 100,
        totalAmount: 1100,
        status: 'pending',
        createdBy: testPharmacist._id
      });

      // Try to access invoice from different workplace
      await request(testApp)
        .get(`/api/patient-portal/billing/invoices/${differentInvoice._id}`)
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(404); // Should not find invoice in patient's workplace
    });

    it('should prevent payment amount manipulation', async () => {
      const maliciousPaymentData = {
        amount: -1000, // Negative amount
        paymentMethod: 'card',
        currency: 'NGN'
      };

      const response = await request(testApp)
        .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send(maliciousPaymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('amount must be positive');
    });

    it('should validate payment confirmation authenticity', async () => {
      const fakeConfirmationData = {
        paymentIntentId: 'pi_fake_123456',
        invoiceId: new mongoose.Types.ObjectId(), // Different invoice
        amount: 1000000, // Large amount
        transactionId: 'txn_fake_123'
      };

      const response = await request(testApp)
        .post('/api/patient-portal/billing/payments/confirm')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(fakeConfirmationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('invalid payment');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid invoice IDs', async () => {
      const invalidId = 'invalid-object-id';
      
      await request(testApp)
        .get(`/api/patient-portal/billing/invoices/${invalidId}`)
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(testApp)
        .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle payment gateway errors', async () => {
      // Mock payment gateway failure
      const paymentData = {
        amount: 4400,
        paymentMethod: 'card',
        currency: 'NGN',
        simulateError: true // Test flag
      };

      const response = await request(testApp)
        .post(`/api/patient-portal/billing/invoices/${testInvoice._id}/pay`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send(paymentData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('payment gateway error');
    });
  });

  describe('Performance', () => {
    it('should handle large billing history efficiently', async () => {
      // Create many invoices and payments
      for (let i = 0; i < 100; i++) {
        const invoice = await Invoice.create({
          patientId: testPatient._id,
          workplaceId: testWorkplace._id,
          invoiceNumber: `INV-PERF-${i.toString().padStart(3, '0')}`,
          issueDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          dueDate: new Date(Date.now() + (30 - i) * 24 * 60 * 60 * 1000),
          items: [{
            description: `Performance test item ${i}`,
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            itemType: 'medication'
          }],
          subtotal: 1000,
          tax: 100,
          totalAmount: 1100,
          status: i % 3 === 0 ? 'paid' : 'pending',
          createdBy: testPharmacist._id
        });

        if (i % 2 === 0) {
          await Payment.create({
            patientId: testPatient._id,
            workplaceId: testWorkplace._id,
            invoiceId: invoice._id,
            paymentReference: `PAY-PERF-${i.toString().padStart(3, '0')}`,
            amount: 1100,
            paymentMethod: 'card',
            paymentStatus: 'completed',
            paymentDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            transactionId: `txn_perf_${i}`,
            paymentGateway: 'stripe',
            currency: 'NGN',
            createdBy: testPatientUser._id
          });
        }
      }

      const startTime = Date.now();
      
      const response = await request(testApp)
        .get('/api/patient-portal/billing/invoices?limit=20')
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.data).toHaveLength(20);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});