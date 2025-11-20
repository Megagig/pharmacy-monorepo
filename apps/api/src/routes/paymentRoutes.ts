import express from 'express';
import {
  getPayments,
  createPayment,
  getPayment,
  processWebhook,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  createSetupIntent,
  generateInvoice
} from '../controllers/paymentController';
import { auth } from '../middlewares/auth';

const router = express.Router();

router.post('/webhook', processWebhook); // Webhook doesn't need auth
router.use(auth); // All other payment routes require authentication

// Payment history routes
router.route('/')
  .get(getPayments)
  .post(createPayment);

router.get('/:id', getPayment);
router.get('/:paymentId/invoice', generateInvoice);

// Payment methods management
router.get('/methods/list', getPaymentMethods);
router.post('/methods/setup-intent', createSetupIntent);
router.post('/methods/add', addPaymentMethod);
router.delete('/methods/:paymentMethodId', removePaymentMethod);
router.put('/methods/default', setDefaultPaymentMethod);

export default router;