import mongoose, { Document, Schema } from 'mongoose';

export interface IPharmacy extends Document {
    name: string;
    licenseNumber: string;
    address: string;
    state: string;
    lga: string;
    ownerId: mongoose.Types.ObjectId;
    verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
    documents: Array<{
        kind: string;
        url: string;
        uploadedAt: Date;
    }>;
    logoUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const pharmacySchema = new Schema({
    name: {
        type: String,
        required: [true, 'Pharmacy name is required'],
        trim: true
    },
    licenseNumber: {
        type: String,
        required: [true, 'PCN license number is required'],
        unique: true,
        sparse: true,
        index: true
    },
    address: {
        type: String,
        required: [true, 'Address is required']
    },
    state: {
        type: String,
        required: [true, 'State is required']
    },
    lga: {
        type: String,
        required: [true, 'Local Government Area is required']
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    verificationStatus: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified'
    },
    documents: [{
        kind: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    logoUrl: String
}, { timestamps: true });

// Indexes
pharmacySchema.index({ licenseNumber: 1 }, { unique: true, sparse: true });
pharmacySchema.index({ ownerId: 1 });

export default mongoose.model<IPharmacy>('Pharmacy', pharmacySchema);