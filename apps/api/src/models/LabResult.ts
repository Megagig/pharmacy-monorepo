import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

/**
 * Universal Laboratory Result Model
 * Supports all modules: Diagnostics, Lab Integration, Patient Management, Medication, Clinical Notes
 */

export interface ILabResultAttachment {
    _id?: mongoose.Types.ObjectId;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    cloudinaryPublicId?: string; // For Cloudinary uploads
    uploadedAt: Date;
    uploadedBy: mongoose.Types.ObjectId;
}

export interface ILabResult extends Document {
    _id: mongoose.Types.ObjectId;

    // Patient and Workplace
    patientId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;

    // Test Information
    testName: string;
    testCode?: string; // e.g., CBC, HbA1c
    loincCode?: string; // Standard LOINC code
    testCategory: 'Hematology' | 'Chemistry' | 'Microbiology' | 'Immunology' | 'Pathology' | 'Radiology' | 'Other';
    specimenType: 'Blood' | 'Urine' | 'Stool' | 'Saliva' | 'Tissue' | 'Swab' | 'Other';

    // Test Results
    testValue: string; // Can be numeric or qualitative
    numericValue?: number; // For numeric results
    unit?: string; // mg/dL, mmol/L, %, etc.
    referenceRange?: string; // Normal range (e.g., "70-100 mg/dL")
    referenceRangeLow?: number; // For numeric comparison
    referenceRangeHigh?: number; // For numeric comparison

    // Interpretation
    interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Pending';
    isCritical: boolean; // Critical value flag
    isAbnormal: boolean; // Abnormal flag

    // Test Metadata
    testDate: Date; // When test was performed
    resultDate?: Date; // When result was received
    orderingPhysician?: string;
    performingLaboratory?: string;
    laboratoryAddress?: string;
    accessionNumber?: string; // Lab accession/reference number

    // Clinical Context
    notes?: string; // Additional notes/comments
    clinicalIndication?: string; // Why test was ordered

    // Status and Workflow
    status: 'Pending' | 'Completed' | 'Reviewed' | 'Signed Off' | 'Cancelled';
    signedOffBy?: mongoose.Types.ObjectId; // Pharmacist who signed off
    signedOffAt?: Date;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;

    // Attachments (PDF/Image uploads)
    attachments: ILabResultAttachment[];

    // Integration References
    orderId?: string; // Reference to ManualLabOrder if applicable
    diagnosticCaseId?: mongoose.Types.ObjectId; // Link to DiagnosticCase
    labIntegrationId?: mongoose.Types.ObjectId; // Link to LabIntegration

    // AI Processing
    aiProcessed: boolean;
    aiProcessedAt?: Date;
    aiInterpretation?: string;

    // Alert/Notification
    alertSent: boolean;
    alertSentAt?: Date;
    alertRecipients?: mongoose.Types.ObjectId[]; // Users who were notified

    // Audit fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: mongoose.Types.ObjectId;

    // Instance methods
    markAsCritical(): Promise<void>;
    signOff(userId: mongoose.Types.ObjectId): Promise<void>;
    addReview(userId: mongoose.Types.ObjectId, notes: string): Promise<void>;
    addAttachment(attachment: ILabResultAttachment): Promise<void>;
    removeAttachment(attachmentId: string): Promise<void>;
    sendAlert(recipients: mongoose.Types.ObjectId[]): Promise<void>;
}

// Attachment sub-schema
const labResultAttachmentSchema = new Schema({
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    mimeType: {
        type: String,
        required: true,
        trim: true
    },
    size: {
        type: Number,
        required: true,
        min: 0
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    cloudinaryPublicId: {
        type: String,
        trim: true,
        sparse: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { _id: true });

// Main Lab Result Schema
const labResultSchema = new Schema({
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required'],
        index: true
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: [true, 'Workplace ID is required'],
        index: true
    },

    // Test Information
    testName: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters'],
        index: true
    },
    testCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [50, 'Test code cannot exceed 50 characters'],
        index: true,
        sparse: true
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters'],
        index: true,
        sparse: true
    },
    testCategory: {
        type: String,
        required: [true, 'Test category is required'],
        enum: ['Hematology', 'Chemistry', 'Microbiology', 'Immunology', 'Pathology', 'Radiology', 'Other'],
        index: true
    },
    specimenType: {
        type: String,
        required: [true, 'Specimen type is required'],
        enum: ['Blood', 'Urine', 'Stool', 'Saliva', 'Tissue', 'Swab', 'Other'],
        index: true
    },

    // Test Results
    testValue: {
        type: String,
        required: [true, 'Test value is required'],
        trim: true,
        maxlength: [500, 'Test value cannot exceed 500 characters']
    },
    numericValue: {
        type: Number,
        sparse: true
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
        type: Number,
        sparse: true
    },
    referenceRangeHigh: {
        type: Number,
        sparse: true
    },

    // Interpretation
    interpretation: {
        type: String,
        required: [true, 'Interpretation is required'],
        enum: ['Normal', 'Low', 'High', 'Critical', 'Abnormal', 'Pending'],
        default: 'Pending',
        index: true
    },
    isCritical: {
        type: Boolean,
        default: false,
        index: true
    },
    isAbnormal: {
        type: Boolean,
        default: false,
        index: true
    },

    // Test Metadata
    testDate: {
        type: Date,
        required: [true, 'Test date is required'],
        index: true
    },
    resultDate: {
        type: Date,
        index: true,
        sparse: true
    },
    orderingPhysician: {
        type: String,
        trim: true,
        maxlength: [200, 'Ordering physician name cannot exceed 200 characters']
    },
    performingLaboratory: {
        type: String,
        trim: true,
        maxlength: [200, 'Laboratory name cannot exceed 200 characters'],
        index: true
    },
    laboratoryAddress: {
        type: String,
        trim: true,
        maxlength: [500, 'Laboratory address cannot exceed 500 characters']
    },
    accessionNumber: {
        type: String,
        trim: true,
        maxlength: [100, 'Accession number cannot exceed 100 characters'],
        index: true,
        sparse: true
    },

    // Clinical Context
    notes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    clinicalIndication: {
        type: String,
        trim: true,
        maxlength: [1000, 'Clinical indication cannot exceed 1000 characters']
    },

    // Status and Workflow
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: ['Pending', 'Completed', 'Reviewed', 'Signed Off', 'Cancelled'],
        default: 'Pending',
        index: true
    },
    signedOffBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        sparse: true
    },
    signedOffAt: {
        type: Date,
        index: true,
        sparse: true
    },
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
    },

    // Attachments
    attachments: {
        type: [labResultAttachmentSchema],
        default: []
    },

    // Integration References
    orderId: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [50, 'Order ID cannot exceed 50 characters'],
        index: true,
        sparse: true
    },
    diagnosticCaseId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticCase',
        index: true,
        sparse: true
    },
    labIntegrationId: {
        type: Schema.Types.ObjectId,
        ref: 'LabIntegration',
        index: true,
        sparse: true
    },

    // AI Processing
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
    aiInterpretation: {
        type: String,
        trim: true,
        maxlength: [5000, 'AI interpretation cannot exceed 5000 characters']
    },

    // Alert/Notification
    alertSent: {
        type: Boolean,
        default: false,
        index: true
    },
    alertSentAt: {
        type: Date,
        index: true,
        sparse: true
    },
    alertRecipients: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted, deletedAt, deletedBy)
addAuditFields(labResultSchema);

// Apply tenancy guard plugin
labResultSchema.plugin(tenancyGuardPlugin);

// Indexes for performance
labResultSchema.index({ patientId: 1, testDate: -1 });
labResultSchema.index({ workplaceId: 1, testDate: -1 });
labResultSchema.index({ testCategory: 1, testDate: -1 });
labResultSchema.index({ isCritical: 1, status: 1 });
labResultSchema.index({ isAbnormal: 1, status: 1 });
labResultSchema.index({ status: 1, testDate: -1 });
labResultSchema.index({ performingLaboratory: 1, testDate: -1 });

// Virtual for patient details
labResultSchema.virtual('patient', {
    ref: 'Patient',
    localField: 'patientId',
    foreignField: '_id',
    justOne: true
});

// Virtual for workplace details
labResultSchema.virtual('workplace', {
    ref: 'Workplace',
    localField: 'workplaceId',
    foreignField: '_id',
    justOne: true
});

// Instance Methods

/**
 * Mark result as critical and trigger alerts
 */
labResultSchema.methods.markAsCritical = async function (this: ILabResult): Promise<void> {
    this.isCritical = true;
    this.isAbnormal = true;
    this.interpretation = 'Critical';
    await this.save();
};

/**
 * Sign off the lab result
 */
labResultSchema.methods.signOff = async function (this: ILabResult, userId: mongoose.Types.ObjectId): Promise<void> {
    this.signedOffBy = userId;
    this.signedOffAt = new Date();
    this.status = 'Signed Off';
    await this.save();
};

/**
 * Add review to lab result
 */
labResultSchema.methods.addReview = async function (this: ILabResult, userId: mongoose.Types.ObjectId, notes: string): Promise<void> {
    this.reviewedBy = userId;
    this.reviewedAt = new Date();
    this.reviewNotes = notes;
    this.status = 'Reviewed';
    await this.save();
};

/**
 * Add attachment to lab result
 */
labResultSchema.methods.addAttachment = async function (this: ILabResult, attachment: ILabResultAttachment): Promise<void> {
    this.attachments.push(attachment);
    await this.save();
};

/**
 * Remove attachment from lab result
 */
labResultSchema.methods.removeAttachment = async function (this: ILabResult, attachmentId: string): Promise<void> {
    this.attachments = this.attachments.filter(att => att._id?.toString() !== attachmentId);
    await this.save();
};

/**
 * Send alert for critical/abnormal results
 */
labResultSchema.methods.sendAlert = async function (this: ILabResult, recipients: mongoose.Types.ObjectId[]): Promise<void> {
    this.alertSent = true;
    this.alertSentAt = new Date();
    this.alertRecipients = recipients;
    await this.save();
};

// Static Methods

/**
 * Find lab results by patient ID
 */
labResultSchema.statics.findByPatient = function (patientId: mongoose.Types.ObjectId, options?: {
    startDate?: Date;
    endDate?: Date;
    testCategory?: string;
    limit?: number;
}) {
    const query: any = { patientId, isDeleted: false };

    if (options?.startDate || options?.endDate) {
        query.testDate = {};
        if (options.startDate) query.testDate.$gte = options.startDate;
        if (options.endDate) query.testDate.$lte = options.endDate;
    }

    if (options?.testCategory) {
        query.testCategory = options.testCategory;
    }

    let queryBuilder = this.find(query).sort({ testDate: -1 });

    if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
    }

    return queryBuilder;
};

/**
 * Find critical lab results
 */
labResultSchema.statics.findCritical = function (workplaceId?: mongoose.Types.ObjectId) {
    const query: any = { isCritical: true, isDeleted: false };
    if (workplaceId) query.workplaceId = workplaceId;
    return this.find(query).sort({ testDate: -1 });
};

/**
 * Find pending lab results
 */
labResultSchema.statics.findPending = function (workplaceId?: mongoose.Types.ObjectId) {
    const query: any = { status: 'Pending', isDeleted: false };
    if (workplaceId) query.workplaceId = workplaceId;
    return this.find(query).sort({ testDate: -1 });
};

/**
 * Find abnormal lab results
 */
labResultSchema.statics.findAbnormal = function (workplaceId?: mongoose.Types.ObjectId) {
    const query: any = { isAbnormal: true, isDeleted: false };
    if (workplaceId) query.workplaceId = workplaceId;
    return this.find(query).sort({ testDate: -1 });
};

/**
 * Get lab result statistics
 */
labResultSchema.statics.getStatistics = async function (workplaceId: mongoose.Types.ObjectId, dateRange?: { start: Date; end: Date }) {
    const matchStage: any = { workplaceId, isDeleted: false };

    if (dateRange) {
        matchStage.testDate = { $gte: dateRange.start, $lte: dateRange.end };
    }

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
                critical: { $sum: { $cond: ['$isCritical', 1, 0] } },
                abnormal: { $sum: { $cond: ['$isAbnormal', 1, 0] } },
                signedOff: { $sum: { $cond: [{ $eq: ['$status', 'Signed Off'] }, 1, 0] } }
            }
        }
    ]);

    return stats[0] || { total: 0, pending: 0, critical: 0, abnormal: 0, signedOff: 0 };
};

// Static method interface
interface ILabResultModel extends mongoose.Model<ILabResult> {
    findByPatient(patientId: mongoose.Types.ObjectId, options?: {
        startDate?: Date;
        endDate?: Date;
        testCategory?: string;
        limit?: number;
    }): mongoose.Query<ILabResult[], ILabResult>;
    findCritical(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<ILabResult[], ILabResult>;
    findPending(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<ILabResult[], ILabResult>;
    findAbnormal(workplaceId?: mongoose.Types.ObjectId): mongoose.Query<ILabResult[], ILabResult>;
    getStatistics(workplaceId: mongoose.Types.ObjectId, dateRange?: { start: Date; end: Date }): Promise<{
        total: number;
        pending: number;
        critical: number;
        abnormal: number;
        signedOff: number;
    }>;
}

// Prevent model overwrite error during hot-reloading
export default (mongoose.models.LabResult ||
    mongoose.model<ILabResult, ILabResultModel>('LabResult', labResultSchema)) as ILabResultModel;

