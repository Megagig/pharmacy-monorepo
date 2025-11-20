import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface IReferenceRange {
    low?: number;
    high?: number;
    text?: string;
    unit?: string;
    ageGroup?: string;
    gender?: 'male' | 'female' | 'all';
    condition?: string;
}

export interface ILabResult extends Document {
    _id: mongoose.Types.ObjectId;
    orderId?: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;

    // Test Information
    testCode: string;
    testName: string;
    testCategory?: string;
    loincCode?: string;

    // Result Data
    value: string;
    numericValue?: number;
    unit?: string;
    referenceRange: IReferenceRange;

    // Interpretation and Flags
    interpretation: 'low' | 'normal' | 'high' | 'critical' | 'abnormal' | 'inconclusive';
    flags?: string[];
    criticalValue: boolean;
    deltaCheck?: {
        previousValue?: string;
        percentChange?: number;
        significantChange: boolean;
    };

    // Quality Control
    qualityFlags?: string[];
    technicalNotes?: string;
    methodUsed?: string;
    instrumentId?: string;

    // Timing
    specimenCollectedAt?: Date;
    performedAt: Date;
    reportedAt: Date;
    recordedAt: Date;
    recordedBy: mongoose.Types.ObjectId;

    // External Integration
    source: 'manual' | 'fhir' | 'lis' | 'external' | 'imported';
    externalResultId?: string;
    fhirReference?: string;
    labSystemId?: string;

    // Clinical Context
    clinicalNotes?: string;
    followUpRequired: boolean;
    followUpInstructions?: string;

    // Verification and Review
    verifiedBy?: mongoose.Types.ObjectId;
    verifiedAt?: Date;
    reviewStatus: 'pending' | 'reviewed' | 'flagged' | 'approved';
    reviewNotes?: string;

    // Audit Fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Virtual properties
    isVerified: boolean;
    turnaroundTime: number | null;
    daysSinceResult: number;

    // Instance methods
    interpretResult(): string;
    isCritical(): boolean;
    isAbnormal(): boolean;
    calculatePercentChange(previousValue: number): number;
    flagForReview(reason: string, flaggedBy: mongoose.Types.ObjectId): Promise<void>;
    verify(verifiedBy: mongoose.Types.ObjectId): Promise<void>;
    addClinicalNote(note: string, addedBy: mongoose.Types.ObjectId): Promise<void>;
}

const referenceRangeSchema = new Schema({
    low: {
        type: Number
    },
    high: {
        type: Number
    },
    text: {
        type: String,
        trim: true,
        maxlength: [200, 'Reference range text cannot exceed 200 characters']
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    ageGroup: {
        type: String,
        trim: true,
        maxlength: [50, 'Age group cannot exceed 50 characters']
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'all'],
        default: 'all'
    },
    condition: {
        type: String,
        trim: true,
        maxlength: [100, 'Condition cannot exceed 100 characters']
    }
}, { _id: false });

const deltaCheckSchema = new Schema({
    previousValue: {
        type: String,
        trim: true
    },
    percentChange: {
        type: Number
    },
    significantChange: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const labResultSchema = new Schema({
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'LabOrder',
        index: true,
        sparse: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    locationId: {
        type: String,
        index: true,
        sparse: true
    },

    // Test Information
    testCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    testName: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters'],
        index: true
    },
    testCategory: {
        type: String,
        trim: true,
        maxlength: [100, 'Test category cannot exceed 100 characters'],
        index: true
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters'],
        index: true,
        sparse: true
    },

    // Result Data
    value: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Result value cannot exceed 500 characters']
    },
    numericValue: {
        type: Number,
        index: true,
        sparse: true
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    referenceRange: {
        type: referenceRangeSchema,
        required: true
    },

    // Interpretation and Flags
    interpretation: {
        type: String,
        enum: ['low', 'normal', 'high', 'critical', 'abnormal', 'inconclusive'],
        required: true,
        index: true
    },
    flags: {
        type: [String],
        default: [],
        validate: {
            validator: function (flags: string[]) {
                return flags.every(flag => flag.trim().length > 0);
            },
            message: 'Flags cannot be empty strings'
        }
    },
    criticalValue: {
        type: Boolean,
        default: false,
        index: true
    },
    deltaCheck: deltaCheckSchema,

    // Quality Control
    qualityFlags: {
        type: [String],
        default: []
    },
    technicalNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Technical notes cannot exceed 1000 characters']
    },
    methodUsed: {
        type: String,
        trim: true,
        maxlength: [100, 'Method used cannot exceed 100 characters']
    },
    instrumentId: {
        type: String,
        trim: true,
        maxlength: [50, 'Instrument ID cannot exceed 50 characters']
    },

    // Timing
    specimenCollectedAt: {
        type: Date,
        index: true
    },
    performedAt: {
        type: Date,
        required: true,
        index: true
    },
    reportedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    recordedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    recordedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // External Integration
    source: {
        type: String,
        enum: ['manual', 'fhir', 'lis', 'external', 'imported'],
        required: true,
        default: 'manual',
        index: true
    },
    externalResultId: {
        type: String,
        trim: true,
        maxlength: [100, 'External result ID cannot exceed 100 characters'],
        index: true,
        sparse: true
    },
    fhirReference: {
        type: String,
        trim: true,
        maxlength: [200, 'FHIR reference cannot exceed 200 characters']
    },
    labSystemId: {
        type: String,
        trim: true,
        maxlength: [100, 'Lab system ID cannot exceed 100 characters'],
        index: true,
        sparse: true
    },

    // Clinical Context
    clinicalNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Clinical notes cannot exceed 2000 characters']
    },
    followUpRequired: {
        type: Boolean,
        default: false,
        index: true
    },
    followUpInstructions: {
        type: String,
        trim: true,
        maxlength: [1000, 'Follow-up instructions cannot exceed 1000 characters']
    },

    // Verification and Review
    verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: {
        type: Date,
        index: true
    },
    reviewStatus: {
        type: String,
        enum: ['pending', 'reviewed', 'flagged', 'approved'],
        default: 'pending',
        required: true,
        index: true
    },
    reviewNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Review notes cannot exceed 1000 characters']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(labResultSchema);

// Apply tenancy guard plugin
labResultSchema.plugin(tenancyGuardPlugin);

// Compound indexes for efficient querying
labResultSchema.index({ workplaceId: 1, patientId: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, testCode: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, interpretation: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, criticalValue: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, reviewStatus: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, followUpRequired: 1, performedAt: -1 });
labResultSchema.index({ workplaceId: 1, locationId: 1, performedAt: -1 }, { sparse: true });
labResultSchema.index({ workplaceId: 1, orderId: 1 }, { sparse: true });
labResultSchema.index({ workplaceId: 1, isDeleted: 1, performedAt: -1 });

// Text index for searching
labResultSchema.index({
    testName: 'text',
    value: 'text',
    clinicalNotes: 'text',
    technicalNotes: 'text'
});

// Virtual for checking if result is verified
labResultSchema.virtual('isVerified').get(function (this: ILabResult) {
    return !!this.verifiedBy && !!this.verifiedAt;
});

// Virtual for turnaround time
labResultSchema.virtual('turnaroundTime').get(function (this: ILabResult) {
    if (this.specimenCollectedAt && this.reportedAt) {
        return this.reportedAt.getTime() - this.specimenCollectedAt.getTime();
    }
    return null;
});

// Virtual for days since result
labResultSchema.virtual('daysSinceResult').get(function (this: ILabResult) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.performedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
labResultSchema.methods.interpretResult = function (this: ILabResult): string {
    const { referenceRange, numericValue, interpretation } = this;

    if (interpretation === 'critical') {
        return 'CRITICAL - Immediate attention required';
    }

    if (numericValue !== undefined && referenceRange.low !== undefined && referenceRange.high !== undefined) {
        if (numericValue < referenceRange.low) {
            return `Below normal range (${referenceRange.low}-${referenceRange.high} ${referenceRange.unit || ''})`;
        } else if (numericValue > referenceRange.high) {
            return `Above normal range (${referenceRange.low}-${referenceRange.high} ${referenceRange.unit || ''})`;
        } else {
            return `Within normal range (${referenceRange.low}-${referenceRange.high} ${referenceRange.unit || ''})`;
        }
    }

    return referenceRange.text || 'See reference range for interpretation';
};

labResultSchema.methods.isCritical = function (this: ILabResult): boolean {
    return this.criticalValue || this.interpretation === 'critical';
};

labResultSchema.methods.isAbnormal = function (this: ILabResult): boolean {
    return ['low', 'high', 'critical', 'abnormal'].includes(this.interpretation);
};

labResultSchema.methods.calculatePercentChange = function (
    this: ILabResult,
    previousValue: number
): number {
    if (!this.numericValue || previousValue === 0) return 0;
    return ((this.numericValue - previousValue) / previousValue) * 100;
};

labResultSchema.methods.flagForReview = async function (
    this: ILabResult,
    reason: string,
    flaggedBy: mongoose.Types.ObjectId
): Promise<void> {
    this.reviewStatus = 'flagged';
    this.reviewNotes = reason;
    this.updatedBy = flaggedBy;
    await this.save();
};

labResultSchema.methods.verify = async function (
    this: ILabResult,
    verifiedBy: mongoose.Types.ObjectId
): Promise<void> {
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    this.reviewStatus = 'approved';
    this.updatedBy = verifiedBy;
    await this.save();
};

labResultSchema.methods.addClinicalNote = async function (
    this: ILabResult,
    note: string,
    addedBy: mongoose.Types.ObjectId
): Promise<void> {
    const timestamp = new Date().toISOString();
    const noteWithTimestamp = `[${timestamp}] ${note}`;

    if (this.clinicalNotes) {
        this.clinicalNotes += '\n' + noteWithTimestamp;
    } else {
        this.clinicalNotes = noteWithTimestamp;
    }

    this.updatedBy = addedBy;
    await this.save();
};

// Pre-save middleware
labResultSchema.pre('save', function (this: ILabResult) {
    // Auto-detect numeric value from string value
    if (!this.numericValue && this.value) {
        const numericMatch = this.value.match(/^([+-]?\d*\.?\d+)/);
        if (numericMatch && numericMatch[1]) {
            this.numericValue = parseFloat(numericMatch[1]);
        }
    }

    // Auto-interpret result based on reference range
    if (this.numericValue !== undefined && this.referenceRange.low !== undefined && this.referenceRange.high !== undefined) {
        if (this.numericValue < this.referenceRange.low) {
            this.interpretation = 'low';
        } else if (this.numericValue > this.referenceRange.high) {
            this.interpretation = 'high';
        } else if (!this.interpretation) {
            this.interpretation = 'normal';
        }
    }

    // Set critical value flag based on interpretation
    if (this.interpretation === 'critical') {
        this.criticalValue = true;
    }

    // Set follow-up required for abnormal results
    if (this.isAbnormal() && this.followUpRequired === undefined) {
        this.followUpRequired = true;
    }
});

// Static methods
labResultSchema.statics.findByPatient = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        isDeleted: false
    }).sort({ performedAt: -1 });
};

labResultSchema.statics.findCriticalResults = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        criticalValue: true,
        isDeleted: false
    }).sort({ performedAt: -1 });
};

labResultSchema.statics.findAbnormalResults = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        interpretation: { $in: ['low', 'high', 'critical', 'abnormal'] },
        isDeleted: false
    }).sort({ performedAt: -1 });
};

labResultSchema.statics.findPendingReview = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        reviewStatus: { $in: ['pending', 'flagged'] },
        isDeleted: false
    }).sort({ performedAt: 1 });
};

labResultSchema.statics.findByTestCode = function (
    workplaceId: mongoose.Types.ObjectId,
    testCode: string
) {
    return this.find({
        workplaceId,
        testCode: testCode.toUpperCase(),
        isDeleted: false
    }).sort({ performedAt: -1 });
};

labResultSchema.statics.findTrendData = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId,
    testCode: string,
    fromDate?: Date,
    toDate?: Date
) {
    const query: any = {
        workplaceId,
        patientId,
        testCode: testCode.toUpperCase(),
        numericValue: { $exists: true },
        isDeleted: false
    };

    if (fromDate || toDate) {
        query.performedAt = {};
        if (fromDate) query.performedAt.$gte = fromDate;
        if (toDate) query.performedAt.$lte = toDate;
    }

    return this.find(query).sort({ performedAt: 1 });
};

labResultSchema.statics.findRequiringFollowUp = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        followUpRequired: true,
        isDeleted: false
    }).sort({ performedAt: -1 });
};

// Use DiagnosticLabResult to avoid conflict with universal LabResult model
export default (mongoose.models.DiagnosticLabResult ||
    mongoose.model<ILabResult>('DiagnosticLabResult', labResultSchema));