import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface IManualLabResultValue {
    testCode: string;
    testName: string;
    numericValue?: number;
    unit?: string;
    stringValue?: string;
    comment?: string;
    abnormalFlag?: boolean;
}

export interface IManualLabResultInterpretation {
    testCode: string;
    interpretation: 'low' | 'normal' | 'high' | 'critical';
    note?: string;
}

export interface IManualLabResult extends Document {
    _id: mongoose.Types.ObjectId;
    orderId: string; // Reference to ManualLabOrder orderId
    enteredBy: mongoose.Types.ObjectId;
    enteredAt: Date;

    values: IManualLabResultValue[];
    interpretation: IManualLabResultInterpretation[];

    // AI processing
    aiProcessed: boolean;
    aiProcessedAt?: Date;
    diagnosticResultId?: mongoose.Types.ObjectId; // Link to AI diagnostic result

    // Quality control
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;

    // Audit fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Instance methods
    addValue(testCode: string, testName: string, value: number | string, unit?: string): void;
    interpretValue(testCode: string, interpretation: IManualLabResultInterpretation['interpretation'], note?: string): void;
    markAsAIProcessed(diagnosticResultId: mongoose.Types.ObjectId): Promise<void>;
    addReview(reviewedBy: mongoose.Types.ObjectId, notes?: string): Promise<void>;
    hasAbnormalResults(): boolean;
    getCriticalResults(): IManualLabResultValue[];
}

const manualLabResultValueSchema = new Schema({
    testCode: {
        type: String,
        required: [true, 'Test code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    testName: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters']
    },
    numericValue: {
        type: Number,
        sparse: true,
        validate: {
            validator: function (value: number) {
                return value >= 0;
            },
            message: 'Numeric value cannot be negative'
        }
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    stringValue: {
        type: String,
        trim: true,
        maxlength: [500, 'String value cannot exceed 500 characters']
    },
    comment: {
        type: String,
        trim: true,
        maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    abnormalFlag: {
        type: Boolean,
        default: false,
        index: true
    }
}, { _id: false });

const manualLabResultInterpretationSchema = new Schema({
    testCode: {
        type: String,
        required: [true, 'Test code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    interpretation: {
        type: String,
        enum: ['low', 'normal', 'high', 'critical'],
        required: true,
        index: true
    },
    note: {
        type: String,
        trim: true,
        maxlength: [500, 'Interpretation note cannot exceed 500 characters']
    }
}, { _id: false });

const manualLabResultSchema = new Schema({
    orderId: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Order ID cannot exceed 20 characters'],
        index: true
    },
    enteredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    enteredAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    values: {
        type: [manualLabResultValueSchema],
        required: true,
        validate: {
            validator: function (values: IManualLabResultValue[]) {
                return values.length > 0;
            },
            message: 'At least one result value is required'
        }
    },
    interpretation: {
        type: [manualLabResultInterpretationSchema],
        default: []
    },

    // AI processing
    aiProcessed: {
        type: Boolean,
        default: false,
        index: true
    },
    aiProcessedAt: {
        type: Date,
        index: true,
        sparse: true
    },
    diagnosticResultId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticResult',
        index: true,
        sparse: true
    },

    // Quality control
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        sparse: true
    },
    reviewedAt: {
        type: Date,
        index: true,
        sparse: true
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
addAuditFields(manualLabResultSchema);

// Apply tenancy guard plugin
manualLabResultSchema.plugin(tenancyGuardPlugin);

// Indexes for efficient querying
manualLabResultSchema.index({ orderId: 1 }, { unique: true });
manualLabResultSchema.index({ enteredBy: 1, enteredAt: -1 });
manualLabResultSchema.index({ aiProcessed: 1, enteredAt: -1 });
manualLabResultSchema.index({ reviewedBy: 1, reviewedAt: -1 }, { sparse: true });
manualLabResultSchema.index({ 'values.testCode': 1, enteredAt: -1 });
manualLabResultSchema.index({ 'values.abnormalFlag': 1, enteredAt: -1 });
manualLabResultSchema.index({ 'interpretation.interpretation': 1, enteredAt: -1 });
manualLabResultSchema.index({ createdAt: -1 });
manualLabResultSchema.index({ isDeleted: 1, enteredAt: -1 });

// Text index for searching
manualLabResultSchema.index({
    orderId: 'text',
    'values.testName': 'text',
    'values.stringValue': 'text',
    'values.comment': 'text',
    reviewNotes: 'text'
});

// Virtual for checking if result has been reviewed
manualLabResultSchema.virtual('isReviewed').get(function (this: IManualLabResult) {
    return !!this.reviewedBy && !!this.reviewedAt;
});

// Virtual for checking processing status
manualLabResultSchema.virtual('processingStatus').get(function (this: IManualLabResult) {
    if (this.aiProcessed) return 'ai_processed';
    if (this.reviewedBy && this.reviewedAt) return 'reviewed';
    return 'pending';
});

// Instance methods
manualLabResultSchema.methods.addValue = function (
    this: IManualLabResult,
    testCode: string,
    testName: string,
    value: number | string,
    unit?: string
): void {
    const resultValue: IManualLabResultValue = {
        testCode: testCode.toUpperCase(),
        testName,
        unit
    };

    if (typeof value === 'number') {
        resultValue.numericValue = value;
    } else {
        resultValue.stringValue = value;
    }

    this.values.push(resultValue);
};

manualLabResultSchema.methods.interpretValue = function (
    this: IManualLabResult,
    testCode: string,
    interpretation: IManualLabResultInterpretation['interpretation'],
    note?: string
): void {
    const existingIndex = this.interpretation.findIndex(
        interp => interp.testCode === testCode.toUpperCase()
    );

    const interpretationData: IManualLabResultInterpretation = {
        testCode: testCode.toUpperCase(),
        interpretation,
        note
    };

    if (existingIndex >= 0) {
        this.interpretation[existingIndex] = interpretationData;
    } else {
        this.interpretation.push(interpretationData);
    }

    // Update abnormal flag for corresponding value
    const valueIndex = this.values.findIndex(
        val => val.testCode === testCode.toUpperCase()
    );
    if (valueIndex >= 0 && this.values[valueIndex]) {
        this.values[valueIndex]!.abnormalFlag = ['low', 'high', 'critical'].includes(interpretation);
    }
};

manualLabResultSchema.methods.markAsAIProcessed = async function (
    this: IManualLabResult,
    diagnosticResultId: mongoose.Types.ObjectId
): Promise<void> {
    this.aiProcessed = true;
    this.aiProcessedAt = new Date();
    this.diagnosticResultId = diagnosticResultId;
    await this.save();
};

manualLabResultSchema.methods.addReview = async function (
    this: IManualLabResult,
    reviewedBy: mongoose.Types.ObjectId,
    notes?: string
): Promise<void> {
    this.reviewedBy = reviewedBy;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    this.updatedBy = reviewedBy;
    await this.save();
};

manualLabResultSchema.methods.hasAbnormalResults = function (this: IManualLabResult): boolean {
    return this.values.some(value => value.abnormalFlag) ||
        this.interpretation.some(interp => ['low', 'high', 'critical'].includes(interp.interpretation));
};

manualLabResultSchema.methods.getCriticalResults = function (this: IManualLabResult): IManualLabResultValue[] {
    const criticalTestCodes = this.interpretation
        .filter(interp => interp.interpretation === 'critical')
        .map(interp => interp.testCode);

    return this.values.filter(value => criticalTestCodes.includes(value.testCode));
};

// Pre-save middleware for validation
manualLabResultSchema.pre('save', function (this: IManualLabResult) {
    // Validate that each value has either numeric or string value
    for (const value of this.values) {
        if (value.numericValue === undefined && !value.stringValue) {
            throw new Error(`Test ${value.testCode} must have either numeric or string value`);
        }
    }

    // Ensure interpretation exists for all values
    for (const value of this.values) {
        const hasInterpretation = this.interpretation.some(
            interp => interp.testCode === value.testCode
        );
        if (!hasInterpretation) {
            // Auto-add normal interpretation if not specified
            this.interpretation.push({
                testCode: value.testCode,
                interpretation: 'normal'
            });
        }
    }
});

// Static methods for querying
manualLabResultSchema.statics.findByOrderId = function (orderId: string) {
    return this.findOne({
        orderId: orderId.toUpperCase(),
        isDeleted: false
    });
};

manualLabResultSchema.statics.findPendingAIProcessing = function () {
    return this.find({
        aiProcessed: false,
        isDeleted: false
    }).sort({ enteredAt: 1 });
};

manualLabResultSchema.statics.findAbnormalResults = function () {
    return this.find({
        $or: [
            { 'values.abnormalFlag': true },
            { 'interpretation.interpretation': { $in: ['low', 'high', 'critical'] } }
        ],
        isDeleted: false
    }).sort({ enteredAt: -1 });
};

manualLabResultSchema.statics.findCriticalResults = function () {
    return this.find({
        'interpretation.interpretation': 'critical',
        isDeleted: false
    }).sort({ enteredAt: -1 });
};

manualLabResultSchema.statics.findPendingReview = function () {
    return this.find({
        reviewedBy: { $exists: false },
        isDeleted: false
    }).sort({ enteredAt: 1 });
};

manualLabResultSchema.statics.findByEnteredBy = function (
    enteredBy: mongoose.Types.ObjectId,
    fromDate?: Date,
    toDate?: Date
) {
    const query: any = {
        enteredBy,
        isDeleted: false
    };

    if (fromDate || toDate) {
        query.enteredAt = {};
        if (fromDate) query.enteredAt.$gte = fromDate;
        if (toDate) query.enteredAt.$lte = toDate;
    }

    return this.find(query).sort({ enteredAt: -1 });
};

// Static method interface
interface IManualLabResultModel extends mongoose.Model<IManualLabResult> {
    findByOrderId(orderId: string): mongoose.Query<IManualLabResult | null, IManualLabResult>;
    findPendingAIProcessing(): mongoose.Query<IManualLabResult[], IManualLabResult>;
    findAbnormalResults(): mongoose.Query<IManualLabResult[], IManualLabResult>;
    findCriticalResults(): mongoose.Query<IManualLabResult[], IManualLabResult>;
    findPendingReview(): mongoose.Query<IManualLabResult[], IManualLabResult>;
    findByEnteredBy(enteredBy: mongoose.Types.ObjectId, fromDate?: Date, toDate?: Date): mongoose.Query<IManualLabResult[], IManualLabResult>;
}

export default mongoose.model<IManualLabResult, IManualLabResultModel>('ManualLabResult', manualLabResultSchema);