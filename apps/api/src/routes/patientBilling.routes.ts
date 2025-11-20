import { Router } from 'express';
import { PatientBillingController } from '../controllers/patientBillingController';
import { auth } from '../middlewares/auth';
import { validatePatientAccess } from '../middlewares/patientAuth';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middlewares/inputValidation';

const router = Router();

// Apply authentication to all routes
router.use(auth);

// Validation middleware for patient billing routes
const validatePatientId = [
  param('patientId').isMongoId().withMessage('Invalid patient ID'),
  handleValidationErrors
];

const validateInvoiceId = [
  param('invoiceId').isMongoId().withMessage('Invalid invoice ID'),
  handleValidationErrors
];

const validatePaymentData = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('paymentMethod')
    .isIn(['credit_card', 'debit_card', 'bank_transfer', 'mobile_money', 'paystack', 'nomba'])
    .withMessage('Invalid payment method'),
  body('currency')
    .optional()
    .isIn(['NGN', 'USD', 'EUR'])
    .withMessage('Invalid currency'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  handleValidationErrors
];

const validateInsuranceClaimData = [
  body('insuranceProvider')
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage('Insurance provider is required and must be 100 characters or less'),
  body('policyNumber')
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('Policy number is required and must be 50 characters or less'),
  body('claimAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Claim amount must be a positive number'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be 500 characters or less'),
  handleValidationErrors
];

const validatePaginationQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
  handleValidationErrors
];

const validateInvoiceFilters = [
  query('status')
    .optional()
    .isIn(['draft', 'open', 'paid', 'void', 'uncollectible'])
    .withMessage('Invalid invoice status'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateFrom format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid dateTo format'),
  ...validatePaginationQuery
];

/**
 * @route GET /api/patients/:patientId/invoices
 * @desc Get patient invoices with filtering and pagination
 * @access Patient (own data), Admin, Pharmacist
 */
router.get(
  '/patients/:patientId/invoices',
  validatePatientId,
  validateInvoiceFilters,
  validatePatientAccess,
  PatientBillingController.getPatientInvoices
);

/**
 * @route GET /api/patients/:patientId/invoices/:invoiceId
 * @desc Get detailed invoice information
 * @access Patient (own data), Admin, Pharmacist
 */
router.get(
  '/patients/:patientId/invoices/:invoiceId',
  validatePatientId,
  validateInvoiceId,
  validatePatientAccess,
  PatientBillingController.getInvoiceDetails
);

/**
 * @route GET /api/patients/:patientId/payments
 * @desc Get patient payment history
 * @access Patient (own data), Admin, Pharmacist
 */
router.get(
  '/patients/:patientId/payments',
  validatePatientId,
  validatePaginationQuery,
  validatePatientAccess,
  PatientBillingController.getPaymentHistory
);

/**
 * @route GET /api/patients/:patientId/balance
 * @desc Get patient outstanding balance
 * @access Patient (own data), Admin, Pharmacist
 */
router.get(
  '/patients/:patientId/balance',
  validatePatientId,
  validatePatientAccess,
  PatientBillingController.getOutstandingBalance
);

/**
 * @route POST /api/patients/:patientId/invoices/:invoiceId/pay
 * @desc Initiate payment for an invoice
 * @access Patient (own data), Admin
 */
router.post(
  '/patients/:patientId/invoices/:invoiceId/pay',
  validatePatientId,
  validateInvoiceId,
  validatePaymentData,
  validatePatientAccess,
  PatientBillingController.initiatePayment
);

/**
 * @route POST /api/billing/webhooks/payment-callback
 * @desc Process payment webhook/callback (no auth required for webhooks)
 * @access Public (webhook)
 */
router.post(
  '/billing/webhooks/payment-callback',
  [
    body('paymentReference')
      .notEmpty()
      .withMessage('Payment reference is required'),
    body('status')
      .isIn(['completed', 'failed'])
      .withMessage('Status must be completed or failed'),
    body('transactionId')
      .optional()
      .isString()
      .withMessage('Transaction ID must be a string'),
    body('amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Amount must be a positive number'),
    handleValidationErrors
  ],
  PatientBillingController.processPaymentCallback
);

/**
 * @route GET /api/patients/:patientId/insurance/claims
 * @desc Get patient insurance claims
 * @access Patient (own data), Admin, Pharmacist
 */
router.get(
  '/patients/:patientId/insurance/claims',
  validatePatientId,
  validatePatientAccess,
  PatientBillingController.getInsuranceClaims
);

/**
 * @route POST /api/patients/:patientId/invoices/:invoiceId/insurance/claim
 * @desc Submit insurance claim for invoice
 * @access Patient (own data), Admin, Pharmacist
 */
router.post(
  '/patients/:patientId/invoices/:invoiceId/insurance/claim',
  validatePatientId,
  validateInvoiceId,
  validateInsuranceClaimData,
  validatePatientAccess,
  PatientBillingController.submitInsuranceClaim
);

export default router;