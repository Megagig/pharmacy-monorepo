import mongoose, { Document, Schema } from 'mongoose';
import './Workplace'; // Import to ensure model is registered

export interface IUserRole extends Document {
    userId: mongoose.Types.ObjectId;
    roleId: mongoose.Types.ObjectId;
    workspaceId?: mongoose.Types.ObjectId; // For workspace-specific role assignments

    // Temporary assignment support
    isTemporary: boolean;
    expiresAt?: Date;

    // Assignment context
    assignmentReason?: string;
    assignmentContext?: Record<string, any>;

    // Status
    isActive: boolean;

    // Audit fields
    assignedBy: mongoose.Types.ObjectId;
    assignedAt: Date;
    lastModifiedBy: mongoose.Types.ObjectId;
    revokedBy?: mongoose.Types.ObjectId;
    revokedAt?: Date;
    revocationReason?: string;

    createdAt: Date;
    updatedAt: Date;
}

const userRoleSchema = new Schema<IUserRole>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        roleId: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: [true, 'Role ID is required'],
            index: true,
        },
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            index: true,
            sparse: true,
        },
        isTemporary: {
            type: Boolean,
            default: false,
            index: true,
        },
        expiresAt: {
            type: Date,
            index: true,
            validate: {
                validator: function (this: IUserRole, expiresAt: Date) {
                    // If isTemporary is true, expiresAt must be provided and in the future
                    if (this.isTemporary) {
                        return expiresAt && expiresAt > new Date();
                    }
                    // If not temporary, expiresAt should not be set
                    return !expiresAt;
                },
                message: 'Temporary assignments must have a future expiration date',
            },
        },
        assignmentReason: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        assignmentContext: {
            type: Schema.Types.Mixed,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Assigned by user ID is required'],
        },
        assignedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
        lastModifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Last modified by user ID is required'],
        },
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        revokedAt: {
            type: Date,
        },
        revocationReason: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    {
        timestamps: true,
        collection: 'user_roles',
    }
);

// Compound indexes for performance optimization
userRoleSchema.index({ userId: 1, roleId: 1, workspaceId: 1 }, { unique: true });
userRoleSchema.index({ userId: 1, isActive: 1 });
userRoleSchema.index({ roleId: 1, isActive: 1 });
userRoleSchema.index({ workspaceId: 1, isActive: 1 });
userRoleSchema.index({ userId: 1, workspaceId: 1, isActive: 1 });
userRoleSchema.index({ expiresAt: 1, isActive: 1 });
userRoleSchema.index({ isTemporary: 1, expiresAt: 1, isActive: 1 });

// Indexes for audit queries
userRoleSchema.index({ assignedBy: 1, assignedAt: -1 });
userRoleSchema.index({ revokedBy: 1, revokedAt: -1 });
userRoleSchema.index({ assignedAt: -1 });

// TTL index for automatic cleanup of expired temporary assignments
userRoleSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 0,
        partialFilterExpression: {
            isTemporary: true,
            isActive: true,
        },
    }
);

// Pre-save validation
userRoleSchema.pre<IUserRole>('save', async function (next) {
    // Validate that user and role exist
    const userExists = await mongoose.model('User').findById(this.userId);
    if (!userExists) {
        return next(new Error('Referenced user does not exist'));
    }

    const roleExists = await mongoose.model('Role').findById(this.roleId);
    if (!roleExists) {
        return next(new Error('Referenced role does not exist'));
    }

    // If workspace is specified, validate it exists
    if (this.workspaceId) {
        const workspaceExists = await mongoose.model('Workplace').findById(this.workspaceId);
        if (!workspaceExists) {
            return next(new Error('Referenced workspace does not exist'));
        }
    }

    // Set revocation fields when deactivating
    if (this.isModified('isActive') && !this.isActive && !this.revokedAt) {
        this.revokedAt = new Date();
        this.revokedBy = this.lastModifiedBy;
    }

    next();
});

// Pre-save middleware to handle expiration
userRoleSchema.pre<IUserRole>('save', function (next) {
    // Auto-deactivate expired temporary assignments
    if (this.isTemporary && this.expiresAt && this.expiresAt <= new Date() && this.isActive) {
        this.isActive = false;
        this.revokedAt = new Date();
        this.revocationReason = 'Automatic expiration';
    }

    next();
});

// Instance methods
userRoleSchema.methods.isExpired = function (): boolean {
    return this.isTemporary && this.expiresAt && this.expiresAt <= new Date();
};

userRoleSchema.methods.getRemainingTime = function (): number | null {
    if (!this.isTemporary || !this.expiresAt) {
        return null;
    }

    const now = new Date().getTime();
    const expiration = this.expiresAt.getTime();

    return Math.max(0, expiration - now);
};

userRoleSchema.methods.revoke = function (
    revokedBy: mongoose.Types.ObjectId,
    reason?: string
): void {
    this.isActive = false;
    this.revokedBy = revokedBy;
    this.revokedAt = new Date();
    this.lastModifiedBy = revokedBy;

    if (reason) {
        this.revocationReason = reason;
    }
};

userRoleSchema.methods.extend = function (
    newExpirationDate: Date,
    modifiedBy: mongoose.Types.ObjectId
): void {
    if (!this.isTemporary) {
        throw new Error('Cannot extend non-temporary role assignment');
    }

    if (newExpirationDate <= new Date()) {
        throw new Error('New expiration date must be in the future');
    }

    this.expiresAt = newExpirationDate;
    this.lastModifiedBy = modifiedBy;
};

// Static methods
userRoleSchema.statics.findActiveByUser = function (userId: mongoose.Types.ObjectId, workspaceId?: mongoose.Types.ObjectId) {
    const query: any = {
        userId,
        isActive: true,
        $or: [
            { isTemporary: false },
            { isTemporary: true, expiresAt: { $gt: new Date() } },
        ],
    };

    if (workspaceId) {
        query.workspaceId = workspaceId;
    }

    return this.find(query).populate('roleId');
};

userRoleSchema.statics.findActiveByRole = function (roleId: mongoose.Types.ObjectId, workspaceId?: mongoose.Types.ObjectId) {
    const query: any = {
        roleId,
        isActive: true,
        $or: [
            { isTemporary: false },
            { isTemporary: true, expiresAt: { $gt: new Date() } },
        ],
    };

    if (workspaceId) {
        query.workspaceId = workspaceId;
    }

    return this.find(query).populate('userId');
};

userRoleSchema.statics.findExpiringSoon = function (hoursAhead: number = 24) {
    const futureTime = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);

    return this.find({
        isTemporary: true,
        isActive: true,
        expiresAt: {
            $gte: new Date(),
            $lte: futureTime,
        },
    }).populate(['userId', 'roleId']);
};

userRoleSchema.statics.cleanupExpired = function () {
    return this.updateMany(
        {
            isTemporary: true,
            isActive: true,
            expiresAt: { $lte: new Date() },
        },
        {
            $set: {
                isActive: false,
                revokedAt: new Date(),
                revocationReason: 'Automatic expiration cleanup',
            },
        }
    );
};

export default mongoose.model<IUserRole>('UserRole', userRoleSchema);