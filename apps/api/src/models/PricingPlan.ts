import mongoose, { Document, Schema } from 'mongoose';

export interface IPricingFeature {
    id: string;
    name: string;
    description?: string;
    order: number;
}

export interface IPricingPlan extends Document {
    name: string;
    slug: string;
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly' | 'one-time';
    tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
    description: string;
    features: string[]; // Array of feature IDs
    isPopular: boolean;
    isActive: boolean;
    isContactSales: boolean;
    whatsappNumber?: string;
    trialDays?: number;
    order: number;
    metadata?: {
        buttonText?: string;
        badge?: string;
        icon?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const pricingPlanSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Plan name is required'],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'NGN',
            enum: ['NGN', 'USD', 'EUR'],
        },
        billingPeriod: {
            type: String,
            enum: ['monthly', 'yearly', 'one-time'],
            default: 'monthly',
        },
        tier: {
            type: String,
            enum: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        features: [{
            type: String, // Feature IDs
        }],
        isPopular: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isContactSales: {
            type: Boolean,
            default: false,
        },
        whatsappNumber: {
            type: String,
            default: null,
        },
        trialDays: {
            type: Number,
            default: null,
        },
        order: {
            type: Number,
            default: 0,
        },
        metadata: {
            buttonText: String,
            badge: String,
            icon: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying
pricingPlanSchema.index({ slug: 1 });
pricingPlanSchema.index({ tier: 1, isActive: 1 });
pricingPlanSchema.index({ order: 1 });

export default mongoose.model<IPricingPlan>('PricingPlan', pricingPlanSchema);
