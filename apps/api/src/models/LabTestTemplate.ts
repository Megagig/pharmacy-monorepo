import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

/**
 * Lab Test Panel Template Model
 * Pre-populated templates for common test panels (Lipid Panel, Renal Function, etc.)
 */

export interface ILabTestTemplateItem {
    testName: string;
    testCode?: string;
    loincCode?: string;
    unit?: string;
    referenceRange?: string;
    referenceRangeLow?: number;
    referenceRangeHigh?: number;
    specimenType: string;
    order: number; // Display order in the panel
}

export interface ILabTestTemplate extends Document {
    _id: mongoose.Types.ObjectId;

    // Template Information
    name: string; // e.g., "Lipid Panel", "Renal Function Panel"
    code: string; // Unique code (e.g., "LIPID_PANEL")
    description?: string;
    category: 'Hematology' | 'Chemistry' | 'Microbiology' | 'Immunology' | 'Pathology' | 'Radiology' | 'Other';

    // Template Items
    tests: ILabTestTemplateItem[];

    // Template Metadata
    isSystemTemplate: boolean; // Pre-populated by system
    isActive: boolean;
    workplaceId?: mongoose.Types.ObjectId; // For custom workplace templates

    // Usage Statistics
    usageCount: number;
    lastUsedAt?: Date;

    // Audit fields
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Instance methods
    incrementUsage(): Promise<void>;
    addTest(test: ILabTestTemplateItem): Promise<void>;
    removeTest(testName: string): Promise<void>;
    updateTest(testName: string, updates: Partial<ILabTestTemplateItem>): Promise<void>;
}

// Test Template Item sub-schema
const labTestTemplateItemSchema = new Schema({
    testName: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters']
    },
    testCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [50, 'Test code cannot exceed 50 characters']
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters']
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [50, 'Unit cannot exceed 50 characters']
    },
    referenceRange: {
        type: String,
        trim: true,
        maxlength: [100, 'Reference range cannot exceed 100 characters']
    },
    referenceRangeLow: {
        type: Number
    },
    referenceRangeHigh: {
        type: Number
    },
    specimenType: {
        type: String,
        required: [true, 'Specimen type is required'],
        trim: true,
        maxlength: [100, 'Specimen type cannot exceed 100 characters']
    },
    order: {
        type: Number,
        required: true,
        default: 0
    }
}, { _id: false });

// Main Lab Test Template Schema
const labTestTemplateSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Template name is required'],
        trim: true,
        maxlength: [200, 'Template name cannot exceed 200 characters'],
        index: true
    },
    code: {
        type: String,
        required: [true, 'Template code is required'],
        trim: true,
        uppercase: true,
        maxlength: [50, 'Template code cannot exceed 50 characters'],
        index: true,
        unique: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Hematology', 'Chemistry', 'Microbiology', 'Immunology', 'Pathology', 'Radiology', 'Other'],
        index: true
    },
    tests: {
        type: [labTestTemplateItemSchema],
        required: [true, 'At least one test is required'],
        validate: {
            validator: function (tests: ILabTestTemplateItem[]) {
                return tests.length > 0;
            },
            message: 'Template must contain at least one test'
        }
    },
    isSystemTemplate: {
        type: Boolean,
        default: false,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        index: true,
        sparse: true
    },
    usageCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastUsedAt: {
        type: Date,
        index: true,
        sparse: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields
addAuditFields(labTestTemplateSchema);

// Apply tenancy guard plugin
labTestTemplateSchema.plugin(tenancyGuardPlugin);

// Indexes
labTestTemplateSchema.index({ category: 1, isActive: 1 });
labTestTemplateSchema.index({ isSystemTemplate: 1, isActive: 1 });
labTestTemplateSchema.index({ workplaceId: 1, isActive: 1 });

// Instance Methods

/**
 * Increment usage count
 */
labTestTemplateSchema.methods.incrementUsage = async function (this: ILabTestTemplate): Promise<void> {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
    await this.save();
};

/**
 * Add test to template
 */
labTestTemplateSchema.methods.addTest = async function (this: ILabTestTemplate, test: ILabTestTemplateItem): Promise<void> {
    this.tests.push(test);
    await this.save();
};

/**
 * Remove test from template
 */
labTestTemplateSchema.methods.removeTest = async function (this: ILabTestTemplate, testName: string): Promise<void> {
    this.tests = this.tests.filter(t => t.testName !== testName);
    await this.save();
};

/**
 * Update test in template
 */
labTestTemplateSchema.methods.updateTest = async function (this: ILabTestTemplate, testName: string, updates: Partial<ILabTestTemplateItem>): Promise<void> {
    const testIndex = this.tests.findIndex(t => t.testName === testName);
    if (testIndex !== -1) {
        this.tests[testIndex] = { ...this.tests[testIndex], ...updates } as ILabTestTemplateItem;
        await this.save();
    }
};

// Static Methods

/**
 * Find system templates
 */
labTestTemplateSchema.statics.findSystemTemplates = function () {
    return this.find({ isSystemTemplate: true, isActive: true, isDeleted: false }).sort({ name: 1 });
};

/**
 * Find workplace templates
 */
labTestTemplateSchema.statics.findWorkplaceTemplates = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({ workplaceId, isActive: true, isDeleted: false }).sort({ name: 1 });
};

/**
 * Find all active templates (system + workplace)
 */
labTestTemplateSchema.statics.findAllActive = function (workplaceId?: mongoose.Types.ObjectId) {
    const query: any = { isActive: true, isDeleted: false };
    if (workplaceId) {
        query.$or = [
            { isSystemTemplate: true },
            { workplaceId }
        ];
    } else {
        query.isSystemTemplate = true;
    }
    return this.find(query).sort({ name: 1 });
};

// Static method interface
interface ILabTestTemplateModel extends mongoose.Model<ILabTestTemplate> {
    findSystemTemplates(): mongoose.Query<ILabTestTemplate[], ILabTestTemplate>;
    findWorkplaceTemplates(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabTestTemplate[], ILabTestTemplate>;
    findAllActive(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<ILabTestTemplate[], ILabTestTemplate>;
}

// Prevent model overwrite error during hot-reloading
export default (mongoose.models.LabTestTemplate ||
    mongoose.model<ILabTestTemplate, ILabTestTemplateModel>('LabTestTemplate', labTestTemplateSchema)) as ILabTestTemplateModel;

