import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
    name: string; // Unique role name
    displayName: string; // Human-readable name
    description: string;
    category: 'system' | 'workplace' | 'custom';

    // Role hierarchy
    parentRole?: mongoose.Types.ObjectId; // Reference to parent role
    childRoles: mongoose.Types.ObjectId[]; // References to child roles
    hierarchyLevel: number; // For efficient hierarchy queries

    // Permission assignments
    permissions: string[]; // Array of permission strings

    // Role metadata
    isActive: boolean;
    isSystemRole: boolean; // Cannot be deleted
    isDefault: boolean; // Assigned to new users

    // Workspace context
    workspaceId?: mongoose.Types.ObjectId; // For workspace-specific roles

    // Audit fields
    createdBy: mongoose.Types.ObjectId;
    lastModifiedBy: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: [true, 'Role name is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^[a-z0-9_-]+$/,
                'Role name can only contain lowercase letters, numbers, underscores, and hyphens',
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
            enum: ['system', 'workplace', 'custom'],
            required: true,
            default: 'custom',
            index: true,
        },
        parentRole: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            index: true,
            validate: {
                validator: async function (this: IRole, parentRoleId: mongoose.Types.ObjectId) {
                    if (!parentRoleId) return true;

                    // Prevent self-reference
                    if (parentRoleId.equals(this._id)) {
                        return false;
                    }

                    // Check if parent role exists
                    const parentRole = await mongoose.model('Role').findById(parentRoleId);
                    return !!parentRole;
                },
                message: 'Invalid parent role reference',
            },
        },
        childRoles: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Role',
            },
        ],
        hierarchyLevel: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            max: 10, // Prevent excessive nesting
            index: true,
        },
        permissions: [
            {
                type: String,
                trim: true,
                index: true,
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        isSystemRole: {
            type: Boolean,
            default: false,
            index: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
            index: true,
        },
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            index: true,
            sparse: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        lastModifiedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        collection: 'roles',
    }
);

// Indexes for performance optimization
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ category: 1, isActive: 1 });
roleSchema.index({ workspaceId: 1, isActive: 1 });
roleSchema.index({ parentRole: 1 });
roleSchema.index({ hierarchyLevel: 1 });
roleSchema.index({ isSystemRole: 1, isActive: 1 });
roleSchema.index({ isDefault: 1, isActive: 1 });

// Compound indexes for common queries
roleSchema.index({ category: 1, workspaceId: 1, isActive: 1 });
roleSchema.index({ parentRole: 1, isActive: 1 });
roleSchema.index({ hierarchyLevel: 1, isActive: 1 });

// Pre-save middleware to calculate hierarchy level
roleSchema.pre<IRole>('save', async function (next) {
    if (this.isModified('parentRole') || this.isNew) {
        if (this.parentRole) {
            const parentRole = await mongoose.model('Role').findById(this.parentRole);
            if (parentRole) {
                this.hierarchyLevel = (parentRole as IRole).hierarchyLevel + 1;
            }
        } else {
            this.hierarchyLevel = 0;
        }
    }
    next();
});

// Pre-save middleware to prevent circular dependencies
roleSchema.pre<IRole>('save', async function (next) {
    if (this.parentRole && this.isModified('parentRole')) {
        const visited = new Set<string>();
        let currentRoleId: mongoose.Types.ObjectId | undefined = this.parentRole;

        while (currentRoleId) {
            const currentRoleIdStr = currentRoleId.toString();

            // Check for circular dependency
            if (visited.has(currentRoleIdStr) || currentRoleIdStr === this._id.toString()) {
                const error = new Error('Circular dependency detected in role hierarchy');
                return next(error);
            }

            visited.add(currentRoleIdStr);

            const currentRole: IRole | null = await mongoose.model('Role').findById(currentRoleId);
            if (!currentRole) break;

            currentRoleId = (currentRole as IRole).parentRole;
        }
    }
    next();
});

// Post-save middleware to update parent's childRoles array
roleSchema.post<IRole>('save', async function (doc) {
    if (doc.parentRole) {
        await mongoose.model('Role').findByIdAndUpdate(
            doc.parentRole,
            { $addToSet: { childRoles: doc._id } },
            { new: true }
        );
    }
});

// Pre-remove middleware to handle role deletion
roleSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    const role = this as IRole;

    // Prevent deletion of system roles
    if (role.isSystemRole) {
        const error = new Error('System roles cannot be deleted');
        return next(error);
    }

    // Check if role has child roles
    if (role.childRoles && role.childRoles.length > 0) {
        const error = new Error('Cannot delete role with child roles. Remove child roles first.');
        return next(error);
    }

    // Remove this role from parent's childRoles array
    if (role.parentRole) {
        await mongoose.model('Role').findByIdAndUpdate(
            role.parentRole,
            { $pull: { childRoles: role._id } },
            { new: true }
        );
    }

    next();
});

// Instance methods
roleSchema.methods.getAllPermissions = async function (): Promise<string[]> {
    const allPermissions = new Set<string>(this.permissions);

    // Inherit permissions from parent roles
    if (this.parentRole) {
        const parentRole = await mongoose.model('Role').findById(this.parentRole);
        if (parentRole && typeof (parentRole as any).getAllPermissions === 'function') {
            const parentPermissions = await (parentRole as any).getAllPermissions();
            parentPermissions.forEach((permission: string) => allPermissions.add(permission));
        }
    }

    return Array.from(allPermissions);
};

roleSchema.methods.hasPermission = function (permission: string): boolean {
    return this.permissions.includes(permission);
};

roleSchema.methods.getHierarchyPath = async function (): Promise<any[]> {
    const path: any[] = [this];
    let currentRole = this;

    while (currentRole.parentRole) {
        const parentRole = await mongoose.model('Role').findById(currentRole.parentRole);
        if (!parentRole) break;

        path.unshift(parentRole as IRole);
        currentRole = parentRole as IRole;
    }

    return path;
};

const Role = mongoose.model<IRole>('Role', roleSchema);

export { Role };
export default Role;
