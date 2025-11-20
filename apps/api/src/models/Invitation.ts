import mongoose, { Document, Schema } from 'mongoose';

export interface InvitationMetadata {
    inviterName: string;
    workspaceName: string;
    customMessage?: string;
    canceledBy?: string;
    canceledReason?: string;
    canceledAt?: Date;
}

export interface IInvitation extends Document {
    email: string;
    code: string; // Unique 8-character code
    workspaceId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    role: 'Owner' | 'Pharmacist' | 'Technician' | 'Intern';
    status: 'active' | 'expired' | 'used' | 'canceled';
    expiresAt: Date;
    usedAt?: Date;
    usedBy?: mongoose.Types.ObjectId;
    metadata: InvitationMetadata;
    createdAt: Date;
    updatedAt: Date;
}

const invitationSchema = new Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please enter a valid email',
            ],
            index: true,
        },
        code: {
            type: String,
            unique: true,
            length: 8,
            uppercase: true,
            index: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workplace',
            required: true,
            index: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ['Owner', 'Pharmacist', 'Technician', 'Intern'],
            required: [true, 'Role is required'],
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'used', 'canceled'],
            default: 'active',
            index: true,
        },
        expiresAt: {
            type: Date,
            index: true,
        },
        usedAt: {
            type: Date,
        },
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        metadata: {
            inviterName: {
                type: String,
                required: true,
                trim: true,
            },
            workspaceName: {
                type: String,
                required: true,
                trim: true,
            },
            customMessage: {
                type: String,
                trim: true,
                maxlength: 500,
            },
        },
    },
    { timestamps: true }
);

// Generate unique invitation code before saving
invitationSchema.pre('save', async function (next) {
    if (this.isNew && !this.code) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            result = '';
            for (let i = 0; i < 8; i++) {
                result += characters.charAt(
                    Math.floor(Math.random() * characters.length)
                );
            }

            // Check if this code already exists
            const existing = await (this.constructor as any).findOne({
                code: result,
            });
            if (!existing) {
                this.code = result;
                break;
            }
            attempts++;
        }

        if (!this.code) {
            // Fallback: use timestamp-based code
            this.code = 'INV' + Date.now().toString().slice(-5);
        }
    }

    // Set expiry date if not set (24 hours from creation)
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    next();
});

// Compound indexes for efficient queries
invitationSchema.index({ email: 1, workspaceId: 1 });
invitationSchema.index({ workspaceId: 1, status: 1 });
invitationSchema.index({ code: 1 }, { unique: true });

// TTL index to automatically remove expired invitations after 30 days
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Instance methods
invitationSchema.methods.isExpired = function (): boolean {
    return this.expiresAt < new Date() || this.status === 'expired';
};

invitationSchema.methods.canBeUsed = function (): boolean {
    return this.status === 'active' && !this.isExpired();
};

invitationSchema.methods.markAsUsed = function (userId: mongoose.Types.ObjectId): void {
    this.status = 'used';
    this.usedAt = new Date();
    this.usedBy = userId;
};

invitationSchema.methods.cancel = function (): void {
    this.status = 'canceled';
};

// Static methods
invitationSchema.statics.findActiveByCode = function (code: string) {
    return this.findOne({ code, status: 'active' });
};

invitationSchema.statics.countPendingForWorkspace = function (workspaceId: mongoose.Types.ObjectId) {
    return this.countDocuments({ workspaceId, status: 'active' });
};

invitationSchema.statics.expireOldInvitations = async function () {
    const now = new Date();
    const result = await this.updateMany(
        {
            status: 'active',
            expiresAt: { $lt: now }
        },
        {
            $set: { status: 'expired' }
        }
    );
    return result;
};

export default mongoose.model<IInvitation>('Invitation', invitationSchema);