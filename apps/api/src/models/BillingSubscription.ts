import mongoose, { Document, Schema } from 'mongoose';

export interface IBillingSubscription extends Document {
  workspaceId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete';
  
  // Billing details
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingCycleAnchor: Date;
  billingInterval: 'monthly' | 'yearly';
  
  // Pricing
  unitAmount: number;
  currency: string;
  quantity: number;
  
  // Payment method
  defaultPaymentMethod?: string;
  
  // Nomba integration
  nombaCustomerId?: string;
  nombaSubscriptionId?: string;
  
  // Lifecycle management
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  cancelationReason?: string;
  
  // Trial information
  trialStart?: Date;
  trialEnd?: Date;
  
  // Proration and changes
  pendingUpdate?: {
    planId: mongoose.Types.ObjectId;
    effectiveDate: Date;
    prorationAmount: number;
  };
  
  // Dunning management
  pastDueNotificationsSent: number;
  lastDunningAttempt?: Date;
  nextDunningAttempt?: Date;
  
  // Metadata
  metadata: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isActive(): boolean;
  isInTrial(): boolean;
  canUpgrade(): boolean;
  canDowngrade(): boolean;
  calculateProration(newPlanAmount: number): number;
}

const billingSubscriptionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete'],
      default: 'trialing',
      index: true,
    },
    
    // Billing details
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    billingCycleAnchor: {
      type: Date,
      required: true,
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    
    // Pricing
    unitAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
      uppercase: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    
    // Payment method
    defaultPaymentMethod: {
      type: String,
      sparse: true,
    },
    
    // Nomba integration
    nombaCustomerId: {
      type: String,
      sparse: true,
      index: true,
    },
    nombaSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    
    // Lifecycle management
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: Date,
    cancelationReason: String,
    
    // Trial information
    trialStart: Date,
    trialEnd: {
      type: Date,
      index: true,
    },
    
    // Proration and changes
    pendingUpdate: {
      planId: {
        type: Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
      },
      effectiveDate: Date,
      prorationAmount: Number,
    },
    
    // Dunning management
    pastDueNotificationsSent: {
      type: Number,
      default: 0,
    },
    lastDunningAttempt: Date,
    nextDunningAttempt: Date,
    
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
billingSubscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active';
};

billingSubscriptionSchema.methods.isInTrial = function(): boolean {
  const now = new Date();
  return this.status === 'trialing' && 
         this.trialEnd && 
         now <= this.trialEnd;
};

billingSubscriptionSchema.methods.canUpgrade = function(): boolean {
  return ['active', 'trialing'].includes(this.status);
};

billingSubscriptionSchema.methods.canDowngrade = function(): boolean {
  return this.status === 'active' && !this.cancelAtPeriodEnd;
};

billingSubscriptionSchema.methods.calculateProration = function(newPlanAmount: number): number {
  const now = new Date();
  const totalPeriodDays = Math.ceil(
    (this.currentPeriodEnd.getTime() - this.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const remainingDays = Math.ceil(
    (this.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const currentPeriodUsed = (totalPeriodDays - remainingDays) / totalPeriodDays;
  const currentPlanCredit = this.unitAmount * (1 - currentPeriodUsed);
  const newPlanCharge = newPlanAmount * (1 - currentPeriodUsed);
  
  return newPlanCharge - currentPlanCredit;
};

// Indexes
billingSubscriptionSchema.index({ workspaceId: 1, status: 1 });
billingSubscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });
billingSubscriptionSchema.index({ trialEnd: 1, status: 1 });
billingSubscriptionSchema.index({ nextDunningAttempt: 1, status: 1 });

export default mongoose.model<IBillingSubscription>('BillingSubscription', billingSubscriptionSchema);