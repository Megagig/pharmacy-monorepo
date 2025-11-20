import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface ITestCatalog extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;

    code: string;
    name: string;
    loincCode?: string;
    category: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    description?: string;
    estimatedCost?: number;
    turnaroundTime?: string;

    // Configuration
    isActive: boolean;
    isCustom: boolean; // User-added vs system default

    // Audit fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Instance methods
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    updateCost(cost: number, updatedBy: mongoose.Types.ObjectId): Promise<void>;
}

const testCatalogSchema = new Schema({
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },

    code: {
        type: String,
        required: [true, 'Test code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters'],
        index: true
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters'],
        index: true,
        sparse: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        maxlength: [100, 'Category cannot exceed 100 characters'],
        index: true
    },
    specimenType: {
        type: String,
        required: [true, 'Specimen type is required'],
        trim: true,
        maxlength: [100, 'Specimen type cannot exceed 100 characters'],
        index: true
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    refRange: {
        type: String,
        trim: true,
        maxlength: [100, 'Reference range cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    estimatedCost: {
        type: Number,
        min: [0, 'Estimated cost cannot be negative']
    },
    turnaroundTime: {
        type: String,
        trim: true,
        maxlength: [50, 'Turnaround time cannot exceed 50 characters']
    },

    // Configuration
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isCustom: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(testCatalogSchema);

// Apply tenancy guard plugin
testCatalogSchema.plugin(tenancyGuardPlugin);

// Compound indexes for efficient querying
testCatalogSchema.index({ workplaceId: 1, code: 1 }, { unique: true });
testCatalogSchema.index({ workplaceId: 1, name: 1 });
testCatalogSchema.index({ workplaceId: 1, category: 1, isActive: 1 });
testCatalogSchema.index({ workplaceId: 1, specimenType: 1, isActive: 1 });
testCatalogSchema.index({ workplaceId: 1, isActive: 1, isCustom: 1 });
testCatalogSchema.index({ workplaceId: 1, isDeleted: 1, isActive: 1 });
testCatalogSchema.index({ loincCode: 1 }, { sparse: true });

// Text index for searching
testCatalogSchema.index({
    name: 'text',
    code: 'text',
    description: 'text',
    category: 'text'
});

// Instance methods
testCatalogSchema.methods.activate = async function (this: ITestCatalog): Promise<void> {
    this.isActive = true;
    await this.save();
};

testCatalogSchema.methods.deactivate = async function (this: ITestCatalog): Promise<void> {
    this.isActive = false;
    await this.save();
};

testCatalogSchema.methods.updateCost = async function (
    this: ITestCatalog,
    cost: number,
    updatedBy: mongoose.Types.ObjectId
): Promise<void> {
    this.estimatedCost = cost;
    this.updatedBy = updatedBy;
    await this.save();
};

// Static methods for querying
testCatalogSchema.statics.findActiveTests = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        isActive: true,
        isDeleted: false
    }).sort({ category: 1, name: 1 });
};

testCatalogSchema.statics.findByCategory = function (
    workplaceId: mongoose.Types.ObjectId,
    category: string
) {
    return this.find({
        workplaceId,
        category: { $regex: new RegExp(category, 'i') },
        isActive: true,
        isDeleted: false
    }).sort({ name: 1 });
};

testCatalogSchema.statics.findBySpecimenType = function (
    workplaceId: mongoose.Types.ObjectId,
    specimenType: string
) {
    return this.find({
        workplaceId,
        specimenType: { $regex: new RegExp(specimenType, 'i') },
        isActive: true,
        isDeleted: false
    }).sort({ name: 1 });
};

testCatalogSchema.statics.searchTests = function (
    workplaceId: mongoose.Types.ObjectId,
    query: string,
    options: {
        category?: string;
        specimenType?: string;
        limit?: number;
        offset?: number;
    } = {}
) {
    const searchQuery: any = {
        workplaceId,
        isActive: true,
        isDeleted: false
    };

    if (query) {
        searchQuery.$text = { $search: query };
    }

    if (options.category) {
        searchQuery.category = { $regex: new RegExp(options.category, 'i') };
    }

    if (options.specimenType) {
        searchQuery.specimenType = { $regex: new RegExp(options.specimenType, 'i') };
    }

    let queryBuilder = this.find(searchQuery);

    if (query) {
        queryBuilder = queryBuilder.sort({ score: { $meta: 'textScore' } });
    } else {
        queryBuilder = queryBuilder.sort({ category: 1, name: 1 });
    }

    if (options.offset) {
        queryBuilder = queryBuilder.skip(options.offset);
    }

    if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
    }

    return queryBuilder;
};

testCatalogSchema.statics.findByCode = function (
    workplaceId: mongoose.Types.ObjectId,
    code: string
) {
    return this.findOne({
        workplaceId,
        code: code.toUpperCase(),
        isDeleted: false
    });
};

testCatalogSchema.statics.getCategories = function (workplaceId: mongoose.Types.ObjectId) {
    return this.distinct('category', {
        workplaceId,
        isActive: true,
        isDeleted: false
    });
};

testCatalogSchema.statics.getSpecimenTypes = function (workplaceId: mongoose.Types.ObjectId) {
    return this.distinct('specimenType', {
        workplaceId,
        isActive: true,
        isDeleted: false
    });
};

// Static method interface
interface ITestCatalogModel extends mongoose.Model<ITestCatalog> {
    findActiveTests(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ITestCatalog[], ITestCatalog>;
    findByCategory(workplaceId: mongoose.Types.ObjectId, category: string): mongoose.Query<ITestCatalog[], ITestCatalog>;
    findBySpecimenType(workplaceId: mongoose.Types.ObjectId, specimenType: string): mongoose.Query<ITestCatalog[], ITestCatalog>;
    searchTests(workplaceId: mongoose.Types.ObjectId, query: string, options?: any): mongoose.Query<ITestCatalog[], ITestCatalog>;
    findByCode(workplaceId: mongoose.Types.ObjectId, code: string): mongoose.Query<ITestCatalog | null, ITestCatalog>;
    getCategories(workplaceId: mongoose.Types.ObjectId): Promise<string[]>;
    getSpecimenTypes(workplaceId: mongoose.Types.ObjectId): Promise<string[]>;
}

export default mongoose.model<ITestCatalog, ITestCatalogModel>('TestCatalog', testCatalogSchema);