import mongoose, { Document, Schema } from 'mongoose';

export interface IPricingFeature extends Document {
    featureId: string;
    name: string;
    description?: string;
    category?: string;
    isActive: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

const pricingFeatureSchema = new Schema(
    {
        featureId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'Feature name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
            default: 'general',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying
pricingFeatureSchema.index({ featureId: 1 });
pricingFeatureSchema.index({ isActive: 1, order: 1 });

export default mongoose.model<IPricingFeature>('PricingFeature', pricingFeatureSchema);
