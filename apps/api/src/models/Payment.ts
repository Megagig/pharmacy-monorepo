import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId; // Changed from 'user' to 'userId'
  planId?: mongoose.Types.ObjectId; // Added planId for subscription plans
  subscription?: mongoose.Types.ObjectId; // Optional for subscription payments
  amount: number;
  currency: string;
  paymentMethod:
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'bank_transfer'
  | 'nomba'
  | 'paystack';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentReference?: string; // Added for Nomba payment reference
  stripePaymentIntentId?: string;
  paypalOrderId?: string;
  transactionId?: string;
  metadata?: Record<string, any>; // Added metadata field
  completedAt?: Date; // Added completedAt field
  failedAt?: Date; // Added failedAt field
  invoice: {
    invoiceNumber?: string;
    dueDate?: Date;
    items?: Array<{
      description?: string;
      amount?: number;
      quantity?: number;
    }>;
    metadata?: {
      invoiceId?: string;
      [key: string]: any;
    };
  };
  billingAddress: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  refundInfo: {
    refundedAt?: Date;
    refundAmount?: number;
    reason?: string;
  };
  refundedAt?: Date;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema(
  {
    userId: {
      // Changed from 'user' to 'userId'
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      // Added planId
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: false,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: false, // Made optional
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'NGN', // Changed default to NGN
    },
    paymentMethod: {
      type: String,
      enum: [
        'credit_card',
        'debit_card',
        'paypal',
        'bank_transfer',
        'nomba',
        'paystack',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentReference: String, // Added for Nomba
    stripePaymentIntentId: String,
    paypalOrderId: String,
    transactionId: String,
    metadata: {
      // Added metadata field
      type: Schema.Types.Mixed,
      default: {},
    },
    completedAt: Date, // Added completedAt field
    failedAt: Date, // Added failedAt field
    invoice: {
      invoiceNumber: String,
      dueDate: Date,
      items: [
        {
          description: String,
          amount: Number,
          quantity: { type: Number, default: 1 },
        },
      ],
      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    refundInfo: {
      refundedAt: Date,
      refundAmount: Number,
      reason: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IPayment>('Payment', paymentSchema);
