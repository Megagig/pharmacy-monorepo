import mongoose, { Document, Schema } from 'mongoose';

export interface IRolePermission extends Document {
    roleId: mongoose.Types.ObjectId;
    permissionAction: string; // Permission action string (e.g., 'patient:read')

    // Permission control
    granted: boolean; // true = granted, false = explicitly denied

    // Conditional permissions
    conditions?: {
        timeRestrictions?: {
            allowedHours?: { start: number; end: number }[]; // 24-hour format
            allowedDays?: number[]; // 0-6, Sunday = 0
            timezone?: string;
        };
        ipRestrictions?: {
            allowedIPs?: string[];
            blockedIPs?: string[];
            allowedNetworks?: string[]; // CIDR notation
        };
        contextRestrictions?: {
            workspaceOnly?: boolean;
            departmentIds?: mongoose.Types.ObjectId[];
            resourceIds?: mongoose.Types.ObjectId[];
        };
    };

    // Metadata
    isActive: boolean;
    priority: number; // Higher priority overrides lower priority (for conflict resolution)

    // Audit fields
    grantedBy: mongoose.Types.ObjectId;
    grantedAt: Date;
    lastModifiedBy: mongoose.Types.ObjectId;
    revokedBy?: mongoose.Types.ObjectId;
    revokedAt?: Date;
    revocationReason?: string;

    createdAt: Date;
    updatedAt: Date;
}

const rolePermissionSchema = new Schema<IRolePermission>(
    {
        roleId: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: [true, 'Role ID is required'],
            index: true,
        },
        permissionAction: {
            type: String,
            required: [true, 'Permission action is required'],
            trim: true,
            lowercase: true,
            index: true,
            match: [
                /^[a-z0-9_-]+:[a-z0-9_-]+$/,
                'Permission action must follow format "resource:action"',
            ],
        },
        granted: {
            type: Boolean,
            required: true,
            default: true,
            index: true,
        },
        conditions: {
            timeRestrictions: {
                allowedHours: [
                    {
                        start: {
                            type: Number,
                            min: 0,
                            max: 23,
                        },
                        end: {
                            type: Number,
                            min: 0,
                            max: 23,
                        },
                    },
                ],
                allowedDays: [
                    {
                        type: Number,
                        min: 0,
                        max: 6,
                    },
                ],
                timezone: {
                    type: String,
                    default: 'UTC',
                },
            },
            ipRestrictions: {
                allowedIPs: [String],
                blockedIPs: [String],
                allowedNetworks: [
                    {
                        type: String,
                        validate: {
                            validator: function (network: string) {
                                // Basic CIDR validation
                                return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(network);
                            },
                            message: 'Invalid CIDR notation for network',
                        },
                    },
                ],
            },
            contextRestrictions: {
                workspaceOnly: {
                    type: Boolean,
                    default: false,
                },
                departmentIds: [
                    {
                        type: Schema.Types.ObjectId,
                        ref: 'Department',
                    },
                ],
                resourceIds: [
                    {
                        type: Schema.Types.ObjectId,
                    },
                ],
            },
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        priority: {
            type: Number,
            default: 0,
            index: true,
        },
        grantedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Granted by user ID is required'],
        },
        grantedAt: {
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
        collection: 'role_permissions',
    }
);

// Compound indexes for performance optimization
rolePermissionSchema.index({ roleId: 1, permissionAction: 1 }, { unique: true });
rolePermissionSchema.index({ roleId: 1, granted: 1, isActive: 1 });
rolePermissionSchema.index({ permissionAction: 1, granted: 1, isActive: 1 });
rolePermissionSchema.index({ priority: -1, isActive: 1 });

// Indexes for audit queries
rolePermissionSchema.index({ grantedBy: 1, grantedAt: -1 });
rolePermissionSchema.index({ revokedBy: 1, revokedAt: -1 });
rolePermissionSchema.index({ grantedAt: -1 });

// Pre-save validation
rolePermissionSchema.pre<IRolePermission>('save', async function (next) {
    // Validate that role exists
    const roleExists = await mongoose.model('Role').findById(this.roleId);
    if (!roleExists) {
        return next(new Error('Referenced role does not exist'));
    }

    // Validate that permission exists (optional - permissions might be defined dynamically)
    const permissionExists = await mongoose.model('Permission').findOne({
        action: this.permissionAction,
    });

    // If permission model exists but permission not found, warn but don't fail
    if (!permissionExists) {
        console.warn(`Permission '${this.permissionAction}' not found in Permission model`);
    }

    // Set revocation fields when deactivating
    if (this.isModified('isActive') && !this.isActive && !this.revokedAt) {
        this.revokedAt = new Date();
        this.revokedBy = this.lastModifiedBy;
    }

    next();
});

// Instance methods
rolePermissionSchema.methods.checkTimeRestrictions = function (currentTime?: Date): boolean {
    if (!this.conditions?.timeRestrictions) {
        return true;
    }

    const now = currentTime || new Date();
    const timeRestrictions = this.conditions.timeRestrictions;

    // Check allowed hours
    if (timeRestrictions.allowedHours && timeRestrictions.allowedHours.length > 0) {
        const currentHour = now.getHours();
        const isAllowedHour = timeRestrictions.allowedHours.some(
            (timeRange: { start: number; end: number }) => {
                if (timeRange.start <= timeRange.end) {
                    return currentHour >= timeRange.start && currentHour <= timeRange.end;
                } else {
                    // Handle overnight ranges (e.g., 22:00 to 06:00)
                    return currentHour >= timeRange.start || currentHour <= timeRange.end;
                }
            }
        );

        if (!isAllowedHour) {
            return false;
        }
    }

    // Check allowed days
    if (timeRestrictions.allowedDays && timeRestrictions.allowedDays.length > 0) {
        const currentDay = now.getDay();
        if (!timeRestrictions.allowedDays.includes(currentDay)) {
            return false;
        }
    }

    return true;
};

rolePermissionSchema.methods.checkIPRestrictions = function (clientIP: string): boolean {
    if (!this.conditions?.ipRestrictions) {
        return true;
    }

    const ipRestrictions = this.conditions.ipRestrictions;

    // Check blocked IPs first
    if (ipRestrictions.blockedIPs && ipRestrictions.blockedIPs.includes(clientIP)) {
        return false;
    }

    // Check allowed IPs
    if (ipRestrictions.allowedIPs && ipRestrictions.allowedIPs.length > 0) {
        if (!ipRestrictions.allowedIPs.includes(clientIP)) {
            return false;
        }
    }

    // Check allowed networks (basic implementation)
    if (ipRestrictions.allowedNetworks && ipRestrictions.allowedNetworks.length > 0) {
        // This would need a proper CIDR matching library in production
        // For now, just check if IP starts with network prefix
        const isInAllowedNetwork = ipRestrictions.allowedNetworks.some((network: string) => {
            const networkPrefix = network.split('/')[0];
            if (!networkPrefix) return false;
            const lastDotIndex = networkPrefix.lastIndexOf('.');
            if (lastDotIndex === -1) return false;
            return clientIP.startsWith(networkPrefix.substring(0, lastDotIndex));
        });

        if (!isInAllowedNetwork) {
            return false;
        }
    }

    return true;
};

rolePermissionSchema.methods.checkContextRestrictions = function (
    context: {
        workspaceId?: mongoose.Types.ObjectId;
        departmentId?: mongoose.Types.ObjectId;
        resourceId?: mongoose.Types.ObjectId;
    }
): boolean {
    if (!this.conditions?.contextRestrictions) {
        return true;
    }

    const contextRestrictions = this.conditions.contextRestrictions;

    // Check workspace restriction
    if (contextRestrictions.workspaceOnly && !context.workspaceId) {
        return false;
    }

    // Check department restrictions
    if (contextRestrictions.departmentIds && contextRestrictions.departmentIds.length > 0) {
        if (!context.departmentId ||
            !contextRestrictions.departmentIds.some((id: mongoose.Types.ObjectId) => id.equals(context.departmentId!))) {
            return false;
        }
    }

    // Check resource restrictions
    if (contextRestrictions.resourceIds && contextRestrictions.resourceIds.length > 0) {
        if (!context.resourceId ||
            !contextRestrictions.resourceIds.some((id: mongoose.Types.ObjectId) => id.equals(context.resourceId!))) {
            return false;
        }
    }

    return true;
};

rolePermissionSchema.methods.evaluatePermission = function (
    context: {
        currentTime?: Date;
        clientIP?: string;
        workspaceId?: mongoose.Types.ObjectId;
        departmentId?: mongoose.Types.ObjectId;
        resourceId?: mongoose.Types.ObjectId;
    } = {}
): boolean {
    if (!this.isActive) {
        return false;
    }

    // If permission is explicitly denied, return false
    if (!this.granted) {
        return false;
    }

    // Check all conditions
    const timeAllowed = this.checkTimeRestrictions(context.currentTime);
    const ipAllowed = context.clientIP ? this.checkIPRestrictions(context.clientIP) : true;
    const contextAllowed = this.checkContextRestrictions({
        workspaceId: context.workspaceId,
        departmentId: context.departmentId,
        resourceId: context.resourceId,
    });

    return timeAllowed && ipAllowed && contextAllowed;
};

rolePermissionSchema.methods.revoke = function (
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

// Static methods
rolePermissionSchema.statics.findByRole = function (
    roleId: mongoose.Types.ObjectId,
    activeOnly: boolean = true
) {
    const query: any = { roleId };
    if (activeOnly) {
        query.isActive = true;
    }

    return this.find(query).sort({ priority: -1, permissionAction: 1 });
};

rolePermissionSchema.statics.findByPermission = function (
    permissionAction: string,
    activeOnly: boolean = true
) {
    const query: any = { permissionAction };
    if (activeOnly) {
        query.isActive = true;
    }

    return this.find(query).populate('roleId').sort({ priority: -1 });
};

rolePermissionSchema.statics.resolvePermissionConflicts = function (
    rolePermissions: IRolePermission[]
): boolean {
    if (rolePermissions.length === 0) {
        return false;
    }

    // Sort by priority (highest first)
    const sortedPermissions = rolePermissions.sort((a, b) => b.priority - a.priority);

    // Return the granted status of the highest priority permission
    return sortedPermissions[0]?.granted || false;
};

export default mongoose.model<IRolePermission>('RolePermission', rolePermissionSchema);