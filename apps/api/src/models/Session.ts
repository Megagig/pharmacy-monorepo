import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    isActive: boolean;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const sessionSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    refreshToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userAgent: String,
    ipAddress: String,
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index - MongoDB will auto-delete expired documents
    }
}, { timestamps: true });

// Compound index for efficient queries
sessionSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<ISession>('Session', sessionSchema);