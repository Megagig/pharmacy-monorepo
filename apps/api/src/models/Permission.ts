import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
    action: string; // Unique permission action (e.g., 'patient:read', 'patients:view:all')
    displayName: string; // Human-readable name
    description: string;
    category: string; // Module/feature category (e.g., 'patient', 'medication', 'reports')

    // Subscription and plan requirements
    requiredSubscriptionTier?: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
    requiredPlanFeatures?: string[]; // Required plan features

    // Permission dependencies and conflicts
    dependencies: string[]; // Permissions that must be granted together
    conflicts: string[]; // Permissions that cannot be granted together

    // Permission metadata
    isActive: boolean;
    isSystemPermission: boolean; // Cannot be deleted
    riskLevel: 'low' | 'medium' | 'high' | 'critical';

    // Audit fields
    createdBy?: mongoose.Types.ObjectId;
    lastModifiedBy?: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
    {
        action: {
            type: String,
            required: [true, 'Permission action is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^[a-z0-9_-]+:[a-z0-9_-]+(:[a-z0-9_-]+)?$/,
                'Permission action must follow format "resource:action" or "resource:action:scope" (e.g., "patient:read" or "patients:view:all")',
            ],
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
            lowercase: true,
            index: true,
            enum: [
                'patient',
                'medication',
                'clinical',
                'reports',
                'administration',
                'billing',
                'inventory',
                'communication',
                'audit',
                'system',
                'workspace',
                'user_management',
                'subscription',
                'integration',
                'analytics',
                'compliance',
                'security',
            ],
        },
        requiredSubscriptionTier: {
            type: String,
            enum: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
            index: true,
        },
        requiredPlanFeatures: [
            {
                type: String,
                trim: true,
            },
        ],
        dependencies: [
            {
                type: String,
                trim: true,
                lowercase: true,
                validate: {
                    validator: function (action: string) {
                        return /^[a-z0-9_-]+:[a-z0-9_-]+(:[a-z0-9_-]+)?$/.test(action);
                    },
                    message: 'Dependency must follow format "resource:action" or "resource:action:scope"',
                },
            },
        ],
        conflicts: [
            {
                type: String,
                trim: true,
                lowercase: true,
                validate: {
                    validator: function (action: string) {
                        return /^[a-z0-9_-]+:[a-z0-9_-]+(:[a-z0-9_-]+)?$/.test(action);
                    },
                    message: 'Conflict must follow format "resource:action" or "resource:action:scope"',
                },
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        isSystemPermission: {
            type: Boolean,
            default: false,
            index: true,
        },
        riskLevel: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            required: true,
            default: 'low',
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        lastModifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
    },
    {
        timestamps: true,
        collection: 'permissions',
    }
);

// Indexes for performance optimization
permissionSchema.index({ action: 1 }, { unique: true });
permissionSchema.index({ category: 1, isActive: 1 });
permissionSchema.index({ riskLevel: 1, isActive: 1 });
permissionSchema.index({ requiredSubscriptionTier: 1, isActive: 1 });
permissionSchema.index({ isSystemPermission: 1, isActive: 1 });

// Compound indexes for common queries
permissionSchema.index({ category: 1, riskLevel: 1, isActive: 1 });
permissionSchema.index({ requiredSubscriptionTier: 1, category: 1, isActive: 1 });

// Text index for search functionality
permissionSchema.index({
    action: 'text',
    displayName: 'text',
    description: 'text',
});

// Pre-save validation to prevent self-dependencies and conflicts
permissionSchema.pre<IPermission>('save', function (next) {
    // Remove self from dependencies and conflicts
    this.dependencies = this.dependencies.filter(dep => dep !== this.action);
    this.conflicts = this.conflicts.filter(conflict => conflict !== this.action);

    // Check for overlap between dependencies and conflicts
    const dependencySet = new Set(this.dependencies);
    const hasOverlap = this.conflicts.some(conflict => dependencySet.has(conflict));

    if (hasOverlap) {
        const error = new Error('Permission cannot have the same action in both dependencies and conflicts');
        return next(error);
    }

    next();
});

// Pre-remove middleware to prevent deletion of system permissions
permissionSchema.pre('deleteOne', { document: true, query: false }, function (next) {
    const permission = this as IPermission;

    if (permission.isSystemPermission) {
        const error = new Error('System permissions cannot be deleted');
        return next(error);
    }

    next();
});

// Instance methods
permissionSchema.methods.checkSubscriptionRequirement = function (
    userSubscriptionTier: string,
    userPlanFeatures: string[]
): boolean {
    // Check subscription tier requirement
    if (this.requiredSubscriptionTier) {
        const tierHierarchy = {
            free_trial: 0,
            basic: 1,
            pro: 2,
            pharmily: 3,
            network: 4,
            enterprise: 5,
        };

        const requiredLevel = tierHierarchy[this.requiredSubscriptionTier as keyof typeof tierHierarchy];
        const userLevel = tierHierarchy[userSubscriptionTier as keyof typeof tierHierarchy];

        if (userLevel < requiredLevel) {
            return false;
        }
    }

    // Check plan features requirement
    if (this.requiredPlanFeatures && this.requiredPlanFeatures.length > 0) {
        const hasAllFeatures = this.requiredPlanFeatures.every((feature: string) =>
            userPlanFeatures.includes(feature)
        );

        if (!hasAllFeatures) {
            return false;
        }
    }

    return true;
};

permissionSchema.methods.validateDependencies = async function (
    grantedPermissions: string[]
): Promise<{ valid: boolean; missingDependencies: string[] }> {
    const missingDependencies = this.dependencies.filter(
        (dep: string) => !grantedPermissions.includes(dep)
    );

    return {
        valid: missingDependencies.length === 0,
        missingDependencies,
    };
};

permissionSchema.methods.validateConflicts = function (
    grantedPermissions: string[]
): { valid: boolean; conflictingPermissions: string[] } {
    const conflictingPermissions = this.conflicts.filter(
        (conflict: string) => grantedPermissions.includes(conflict)
    );

    return {
        valid: conflictingPermissions.length === 0,
        conflictingPermissions,
    };
};

// Static methods
permissionSchema.statics.getByCategory = function (category: string) {
    return this.find({ category, isActive: true }).sort({ displayName: 1 });
};

permissionSchema.statics.getSystemPermissions = function () {
    return this.find({ isSystemPermission: true, isActive: true }).sort({ action: 1 });
};

permissionSchema.statics.getByRiskLevel = function (riskLevel: string) {
    return this.find({ riskLevel, isActive: true }).sort({ action: 1 });
};

const Permission = mongoose.model<IPermission>('Permission', permissionSchema);

export { Permission };
export default Permission;
