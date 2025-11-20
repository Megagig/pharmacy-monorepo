import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  unitAmount: number;
  planId?: mongoose.Types.ObjectId;
  periodStart?: Date;
  periodEnd?: Date;
  proration?: boolean;
}

export interface IBillingInvoice extends Document {
  workspaceId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;

  // Invoice details
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

  // Amounts
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;

  // Line items
  lineItems: IInvoiceLineItem[];

  // Dates
  createdAt: Date;
  dueDate: Date;
  paidAt?: Date;
  voidedAt?: Date;

  // Payment
  paymentAttempts: number;
  lastPaymentAttempt?: Date;
  nextPaymentAttempt?: Date;

  // Nomba integration
  nombaInvoiceId?: string;
  nombaPaymentIntentId?: string;

  // Customer details
  customerEmail: string;
  customerName: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };

  // Metadata
  metadata: Record<string, any>;

  // Methods
  isPaid(): boolean;
  isOverdue(): boolean;
  canVoid(): boolean;
  calculateTotals(): void;
}

const invoiceLineItemSchema = new Schema({
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  unitAmount: {
    type: Number,
    required: true,
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
  },
  periodStart: Date,
  periodEnd: Date,
  proration: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const billingInvoiceSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'BillingSubscription',
      required: true,
      index: true,
    },

    // Invoice details
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
      default: 'draft',
      index: true,
    },

    // Amounts
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
    },

    // Line items
    lineItems: [invoiceLineItemSchema],

    // Dates
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidAt: Date,
    voidedAt: Date,

    // Payment
    paymentAttempts: {
      type: Number,
      default: 0,
    },
    lastPaymentAttempt: Date,
    nextPaymentAttempt: Date,

    // Nomba integration
    nombaInvoiceId: {
      type: String,
      sparse: true,
      index: true,
    },
    nombaPaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },

    // Customer details
    customerEmail: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },

    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Instance methods
billingInvoiceSchema.methods.isPaid = function (): boolean {
  return this.status === 'paid';
};

billingInvoiceSchema.methods.isOverdue = function (): boolean {
  return this.status === 'open' && new Date() > this.dueDate;
};

billingInvoiceSchema.methods.canVoid = function (): boolean {
  return ['draft', 'open'].includes(this.status);
};

billingInvoiceSchema.methods.calculateTotals = function (): void {
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  this.total = this.subtotal + this.tax;
  this.amountDue = this.total - this.amountPaid;
};

// Pre-save middleware to calculate totals
billingInvoiceSchema.pre('save', function (next) {
  (this as any).calculateTotals(); // Type assertion for method call
  next();
});

// Generate invoice number
billingInvoiceSchema.pre('save', function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    this.invoiceNumber = `INV-${year}${month}-${timestamp}`;
  }
  next();
});

// Indexes
billingInvoiceSchema.index({ workspaceId: 1, status: 1 });
billingInvoiceSchema.index({ dueDate: 1, status: 1 });
billingInvoiceSchema.index({ createdAt: -1 });

export default mongoose.model<IBillingInvoice>('BillingInvoice', billingInvoiceSchema);