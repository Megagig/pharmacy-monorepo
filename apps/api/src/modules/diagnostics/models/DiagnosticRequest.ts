import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface ISymptomData {
    subjective: string[];
    objective: string[];
    duration: string;
    severity: 'mild' | 'moderate' | 'severe';
    onset: 'acute' | 'chronic' | 'subacute';
}

export interface IVitalSigns {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    bloodGlucose?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
}

export interface IMedicationEntry {
    name: string;
    dosage: string;
    frequency: string;
    route?: string;
    startDate?: Date;
    indication?: string;
}

export interface IClinicalContext {
    chiefComplaint?: string;
    presentingSymptoms?: string[];
    relevantHistory?: string;
    assessment?: string;
    plan?: string;
}

export interface IInputSnapshot {
    symptoms: ISymptomData;
    vitals?: IVitalSigns;
    currentMedications?: IMedicationEntry[];
    allergies?: string[];
    medicalHistory?: string[];
    labResultIds?: mongoose.Types.ObjectId[];
    socialHistory?: {
        smoking?: 'never' | 'former' | 'current';
        alcohol?: 'never' | 'occasional' | 'regular' | 'heavy';
        exercise?: 'sedentary' | 'light' | 'moderate' | 'active';
    };
    familyHistory?: string[];
}

export interface IDiagnosticRequest extends Document {
    _id: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    pharmacistId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;

    // Clinical Input Data
    inputSnapshot: IInputSnapshot;
    clinicalContext?: IClinicalContext;

    // AI Processing Metadata
    consentObtained: boolean;
    consentTimestamp: Date;
    promptVersion: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

    // Processing metadata
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
    errorMessage?: string;
    retryCount: number;

    // Priority and urgency
    priority: 'routine' | 'urgent' | 'stat';
    clinicalUrgency?: 'low' | 'medium' | 'high' | 'critical';

    // Audit Fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    processingDuration?: number;

    // Instance methods
    updateStatus(status: IDiagnosticRequest['status']): Promise<void>;
    markAsProcessing(): Promise<void>;
    markAsCompleted(): Promise<void>;
    markAsFailed(error: string): Promise<void>;
    incrementRetryCount(): Promise<void>;
    canRetry(): boolean;
}

const symptomDataSchema = new Schema({
    subjective: {
        type: [String],
        required: true,
        validate: {
            validator: function (symptoms: string[]) {
                return symptoms.length > 0;
            },
            message: 'At least one subjective symptom is required'
        }
    },
    objective: {
        type: [String],
        default: []
    },
    duration: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Duration description cannot exceed 100 characters']
    },
    severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe'],
        required: true,
        index: true
    },
    onset: {
        type: String,
        enum: ['acute', 'chronic', 'subacute'],
        required: true,
        index: true
    }
}, { _id: false });

const vitalSignsSchema = new Schema({
    bloodPressure: {
        type: String,
        validate: {
            validator: function (bp: string) {
                if (!bp) return true;
                // Validate BP format like "120/80"
                return /^\d{2,3}\/\d{2,3}$/.test(bp);
            },
            message: 'Blood pressure must be in format "systolic/diastolic" (e.g., 120/80)'
        }
    },
    heartRate: {
        type: Number,
        min: [30, 'Heart rate too low'],
        max: [250, 'Heart rate too high']
    },
    temperature: {
        type: Number,
        min: [30, 'Temperature too low'],
        max: [45, 'Temperature too high']
    },
    bloodGlucose: {
        type: Number,
        min: [20, 'Blood glucose too low'],
        max: [600, 'Blood glucose too high']
    },
    respiratoryRate: {
        type: Number,
        min: [8, 'Respiratory rate too low'],
        max: [60, 'Respiratory rate too high']
    },
    oxygenSaturation: {
        type: Number,
        min: [70, 'Oxygen saturation too low'],
        max: [100, 'Oxygen saturation cannot exceed 100%']
    },
    weight: {
        type: Number,
        min: [0.5, 'Weight too low'],
        max: [1000, 'Weight too high']
    },
    height: {
        type: Number,
        min: [30, 'Height too low'],
        max: [300, 'Height too high']
    }
}, { _id: false });

const medicationEntrySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Medication name cannot exceed 200 characters']
    },
    dosage: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Dosage cannot exceed 100 characters']
    },
    frequency: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Frequency cannot exceed 100 characters']
    },
    route: {
        type: String,
        trim: true,
        maxlength: [50, 'Route cannot exceed 50 characters']
    },
    startDate: Date,
    indication: {
        type: String,
        trim: true,
        maxlength: [200, 'Indication cannot exceed 200 characters']
    }
}, { _id: false });

const inputSnapshotSchema = new Schema({
    symptoms: {
        type: symptomDataSchema,
        required: true
    },
    vitals: vitalSignsSchema,
    currentMedications: {
        type: [medicationEntrySchema],
        default: []
    },
    allergies: {
        type: [String],
        default: [],
        validate: {
            validator: function (allergies: string[]) {
                return allergies.every(allergy => allergy.trim().length > 0);
            },
            message: 'Allergies cannot be empty strings'
        }
    },
    medicalHistory: {
        type: [String],
        default: [],
        validate: {
            validator: function (history: string[]) {
                return history.every(item => item.trim().length > 0);
            },
            message: 'Medical history items cannot be empty strings'
        }
    },
    labResultIds: {
        type: [Schema.Types.ObjectId],
        ref: 'LabResult',
        default: []
    },
    socialHistory: {
        smoking: {
            type: String,
            enum: ['never', 'former', 'current']
        },
        alcohol: {
            type: String,
            enum: ['never', 'occasional', 'regular', 'heavy']
        },
        exercise: {
            type: String,
            enum: ['sedentary', 'light', 'moderate', 'active']
        }
    },
    familyHistory: {
        type: [String],
        default: [],
        validate: {
            validator: function (history: string[]) {
                return history.every(item => item.trim().length > 0);
            },
            message: 'Family history items cannot be empty strings'
        }
    }
}, { _id: false });

const diagnosticRequestSchema = new Schema({
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    pharmacistId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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

    // Clinical Input Data
    inputSnapshot: {
        type: inputSnapshotSchema,
        required: true
    },
    clinicalContext: {
        chiefComplaint: {
            type: String,
            trim: true,
            maxlength: [500, 'Chief complaint cannot exceed 500 characters']
        },
        presentingSymptoms: {
            type: [String],
            default: []
        },
        relevantHistory: {
            type: String,
            trim: true,
            maxlength: [1000, 'Relevant history cannot exceed 1000 characters']
        },
        assessment: {
            type: String,
            trim: true,
            maxlength: [2000, 'Assessment cannot exceed 2000 characters']
        },
        plan: {
            type: String,
            trim: true,
            maxlength: [2000, 'Plan cannot exceed 2000 characters']
        }
    },

    // AI Processing Metadata
    consentObtained: {
        type: Boolean,
        required: true,
        validate: {
            validator: function (consent: boolean) {
                return consent === true;
            },
            message: 'Patient consent is required for AI diagnostic processing'
        }
    },
    consentTimestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    promptVersion: {
        type: String,
        required: true,
        default: 'v1.0',
        maxlength: [20, 'Prompt version cannot exceed 20 characters']
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        required: true,
        index: true
    },

    // Processing metadata
    processingStartedAt: {
        type: Date,
        index: true
    },
    processingCompletedAt: {
        type: Date,
        index: true
    },
    errorMessage: {
        type: String,
        maxlength: [1000, 'Error message cannot exceed 1000 characters']
    },
    retryCount: {
        type: Number,
        default: 0,
        min: [0, 'Retry count cannot be negative'],
        max: [5, 'Maximum retry count exceeded']
    },

    // Priority and urgency
    priority: {
        type: String,
        enum: ['routine', 'urgent', 'stat'],
        default: 'routine',
        required: true,
        index: true
    },
    clinicalUrgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(diagnosticRequestSchema);

// Apply tenancy guard plugin
diagnosticRequestSchema.plugin(tenancyGuardPlugin);

// Compound indexes for efficient querying
diagnosticRequestSchema.index({ workplaceId: 1, patientId: 1, createdAt: -1 });
diagnosticRequestSchema.index({ workplaceId: 1, pharmacistId: 1, status: 1 });
diagnosticRequestSchema.index({ workplaceId: 1, status: 1, priority: 1 });
diagnosticRequestSchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
diagnosticRequestSchema.index({ workplaceId: 1, locationId: 1, status: 1 }, { sparse: true });
diagnosticRequestSchema.index({ workplaceId: 1, clinicalUrgency: 1, createdAt: -1 }, { sparse: true });
diagnosticRequestSchema.index({ workplaceId: 1, isDeleted: 1, createdAt: -1 });

// Virtual for processing duration
diagnosticRequestSchema.virtual('processingDuration').get(function (this: IDiagnosticRequest) {
    if (this.processingStartedAt && this.processingCompletedAt) {
        return this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
    }
    return null;
});

// Virtual for checking if request is active
diagnosticRequestSchema.virtual('isActive').get(function (this: IDiagnosticRequest) {
    return ['pending', 'processing'].includes(this.status);
});

// Instance methods
diagnosticRequestSchema.methods.updateStatus = async function (
    this: IDiagnosticRequest,
    status: IDiagnosticRequest['status']
): Promise<void> {
    this.status = status;

    if (status === 'processing' && !this.processingStartedAt) {
        this.processingStartedAt = new Date();
    } else if (['completed', 'failed', 'cancelled'].includes(status) && !this.processingCompletedAt) {
        this.processingCompletedAt = new Date();
    }

    await this.save();
};

diagnosticRequestSchema.methods.markAsProcessing = async function (this: IDiagnosticRequest): Promise<void> {
    await this.updateStatus('processing');
};

diagnosticRequestSchema.methods.markAsCompleted = async function (this: IDiagnosticRequest): Promise<void> {
    await this.updateStatus('completed');
};

diagnosticRequestSchema.methods.markAsFailed = async function (
    this: IDiagnosticRequest,
    error: string
): Promise<void> {
    this.errorMessage = error;
    await this.updateStatus('failed');
};

diagnosticRequestSchema.methods.incrementRetryCount = async function (this: IDiagnosticRequest): Promise<void> {
    this.retryCount += 1;
    await this.save();
};

diagnosticRequestSchema.methods.canRetry = function (this: IDiagnosticRequest): boolean {
    return this.status === 'failed' && this.retryCount < 3;
};

// Pre-save middleware for validation
diagnosticRequestSchema.pre('save', function (this: IDiagnosticRequest) {
    // Ensure consent timestamp is set when consent is obtained
    if (this.consentObtained && !this.consentTimestamp) {
        this.consentTimestamp = new Date();
    }

    // Set clinical urgency based on symptoms severity if not explicitly set
    if (!this.clinicalUrgency && this.inputSnapshot?.symptoms?.severity) {
        const severityMap = {
            'mild': 'low',
            'moderate': 'medium',
            'severe': 'high'
        } as const;
        this.clinicalUrgency = severityMap[this.inputSnapshot.symptoms.severity];
    }
});

// Static methods
diagnosticRequestSchema.statics.findActiveRequests = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        status: { $in: ['pending', 'processing'] },
        isDeleted: false
    }).sort({ priority: 1, createdAt: 1 });
};

diagnosticRequestSchema.statics.findByPatient = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        isDeleted: false
    }).sort({ createdAt: -1 });
};

diagnosticRequestSchema.statics.findPendingRetries = function () {
    return this.find({
        status: 'failed',
        retryCount: { $lt: 3 },
        isDeleted: false
    }).sort({ createdAt: 1 });
};

export default mongoose.model<IDiagnosticRequest>('DiagnosticRequest', diagnosticRequestSchema);