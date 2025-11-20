import mongoose, { Document, Schema } from 'mongoose';

export interface IDiagnosticHistory extends Document {
    patientId: mongoose.Types.ObjectId;
    caseId: string;
    diagnosticCaseId: mongoose.Types.ObjectId;
    pharmacistId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;

    // Analysis snapshot for historical reference
    analysisSnapshot: {
        differentialDiagnoses: {
            _id?: mongoose.Types.ObjectId;
            condition: string;
            probability: number;
            reasoning: string;
            severity: 'low' | 'medium' | 'high';
        }[];

        recommendedTests: {
            _id?: mongoose.Types.ObjectId;
            testName: string;
            priority: 'urgent' | 'routine' | 'optional';
            reasoning: string;
        }[];

        therapeuticOptions: {
            _id?: mongoose.Types.ObjectId;
            medication: string;
            dosage: string;
            frequency: string;
            duration: string;
            reasoning: string;
            safetyNotes: string[];
        }[];

        redFlags: {
            _id?: mongoose.Types.ObjectId;
            flag: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
            action: string;
        }[];

        referralRecommendation?: {
            recommended: boolean;
            urgency: 'immediate' | 'within_24h' | 'routine';
            specialty: string;
            reason: string;
        };

        disclaimer: string;
        confidenceScore: number;
        processingTime: number;
    };

    // Clinical context at time of analysis
    clinicalContext: {
        symptoms: {
            subjective: string[];
            objective: string[];
            duration: string;
            severity: 'mild' | 'moderate' | 'severe';
            onset: 'acute' | 'chronic' | 'subacute';
        };
        vitalSigns?: {
            bloodPressure?: string;
            heartRate?: number;
            temperature?: number;
            respiratoryRate?: number;
            oxygenSaturation?: number;
        };
        currentMedications?: {
            _id?: mongoose.Types.ObjectId;
            name: string;
            dosage: string;
            frequency: string;
        }[];
        labResults?: {
            _id?: mongoose.Types.ObjectId;
            testName: string;
            value: string;
            referenceRange: string;
            abnormal: boolean;
        }[];
    };

    // Pharmacist notes and follow-up
    notes: {
        _id?: mongoose.Types.ObjectId;
        content: string;
        addedBy: mongoose.Types.ObjectId;
        addedAt: Date;
        type: 'clinical' | 'follow_up' | 'review' | 'general';
    }[];

    // Follow-up tracking
    followUp: {
        required: boolean;
        scheduledDate?: Date;
        completed: boolean;
        completedDate?: Date;
        outcome?: string;
        nextSteps?: string;
    };

    // Export and sharing history
    exports: {
        _id?: mongoose.Types.ObjectId;
        exportedBy: mongoose.Types.ObjectId;
        exportedAt: Date;
        format: 'pdf' | 'json' | 'csv';
        purpose: 'referral' | 'patient_record' | 'consultation' | 'audit';
    }[];

    // Referral tracking
    referral?: {
        generated: boolean;
        generatedAt?: Date;
        specialty: string;
        urgency: 'immediate' | 'within_24h' | 'routine';
        status: 'pending' | 'sent' | 'acknowledged' | 'completed';
        sentAt?: Date;
        acknowledgedAt?: Date;
        completedAt?: Date;
        feedback?: string;
    };

    // Comparison data for trend analysis
    comparisonData?: {
        previousCaseId?: string;
        changesNoted: string[];
        improvementScore?: number;
        deteriorationFlags?: string[];
    };

    // Audit and compliance
    auditTrail: {
        viewedBy: mongoose.Types.ObjectId[];
        lastViewed: Date;
        modifiedBy: mongoose.Types.ObjectId[];
        lastModified: Date;
        accessLog: {
            _id?: mongoose.Types.ObjectId;
            userId: mongoose.Types.ObjectId;
            action: 'view' | 'edit' | 'export' | 'share';
            timestamp: Date;
            ipAddress?: string;
        }[];
    };

    // Status and lifecycle
    status: 'active' | 'archived' | 'deleted';
    archivedAt?: Date;
    archivedBy?: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const diagnosticHistorySchema = new Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
            index: true,
        },
        caseId: {
            type: String,
            required: true,
            index: true,
        },
        diagnosticCaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DiagnosticCase',
            required: true,
            index: true,
        },
        pharmacistId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        workplaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workplace',
            required: true,
            index: true,
        },
        analysisSnapshot: {
            differentialDiagnoses: [
                {
                    condition: String,
                    probability: Number,
                    reasoning: String,
                    severity: {
                        type: String,
                        enum: ['low', 'medium', 'high'],
                    },
                },
            ],
            recommendedTests: [
                {
                    testName: String,
                    priority: {
                        type: String,
                        enum: ['urgent', 'routine', 'optional'],
                    },
                    reasoning: String,
                },
            ],
            therapeuticOptions: [
                {
                    medication: String,
                    dosage: String,
                    frequency: String,
                    duration: String,
                    reasoning: String,
                    safetyNotes: [String],
                },
            ],
            redFlags: [
                {
                    flag: String,
                    severity: {
                        type: String,
                        enum: ['low', 'medium', 'high', 'critical'],
                    },
                    action: String,
                },
            ],
            referralRecommendation: {
                recommended: Boolean,
                urgency: {
                    type: String,
                    enum: ['immediate', 'within_24h', 'routine'],
                    required: function(this: any) {
                        return this.recommended === true;
                    },
                },
                specialty: {
                    type: String,
                    required: function(this: any) {
                        return this.recommended === true;
                    },
                },
                reason: {
                    type: String,
                    required: function(this: any) {
                        return this.recommended === true;
                    },
                },
            },
            disclaimer: String,
            confidenceScore: Number,
            processingTime: Number,
        },
        clinicalContext: {
            symptoms: {
                subjective: [String],
                objective: [String],
                duration: String,
                severity: {
                    type: String,
                    enum: ['mild', 'moderate', 'severe'],
                },
                onset: {
                    type: String,
                    enum: ['acute', 'chronic', 'subacute'],
                },
            },
            vitalSigns: {
                bloodPressure: String,
                heartRate: Number,
                temperature: Number,
                respiratoryRate: Number,
                oxygenSaturation: Number,
            },
            currentMedications: [
                {
                    name: String,
                    dosage: String,
                    frequency: String,
                },
            ],
            labResults: [
                {
                    testName: String,
                    value: String,
                    referenceRange: String,
                    abnormal: Boolean,
                },
            ],
        },
        notes: [
            {
                content: {
                    type: String,
                    required: true,
                },
                addedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                addedAt: {
                    type: Date,
                    default: Date.now,
                },
                type: {
                    type: String,
                    enum: ['clinical', 'follow_up', 'review', 'general'],
                    default: 'general',
                },
            },
        ],
        followUp: {
            required: {
                type: Boolean,
                default: false,
            },
            scheduledDate: Date,
            completed: {
                type: Boolean,
                default: false,
            },
            completedDate: Date,
            outcome: String,
            nextSteps: String,
        },
        exports: [
            {
                exportedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                exportedAt: {
                    type: Date,
                    default: Date.now,
                },
                format: {
                    type: String,
                    enum: ['pdf', 'json', 'csv'],
                    required: true,
                },
                purpose: {
                    type: String,
                    enum: ['referral', 'patient_record', 'consultation', 'audit'],
                    required: true,
                },
            },
        ],
        referral: {
            generated: {
                type: Boolean,
                default: false,
            },
            generatedAt: Date,
            specialty: String,
            urgency: {
                type: String,
                enum: ['immediate', 'within_24h', 'routine'],
            },
            status: {
                type: String,
                enum: ['pending', 'sent', 'acknowledged', 'completed'],
                default: 'pending',
            },
            sentAt: Date,
            acknowledgedAt: Date,
            completedAt: Date,
            feedback: String,
        },
        comparisonData: {
            previousCaseId: String,
            changesNoted: [String],
            improvementScore: Number,
            deteriorationFlags: [String],
        },
        auditTrail: {
            viewedBy: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
            ],
            lastViewed: {
                type: Date,
                default: Date.now,
            },
            modifiedBy: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
            ],
            lastModified: {
                type: Date,
                default: Date.now,
            },
            accessLog: [
                {
                    userId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'User',
                        required: true,
                    },
                    action: {
                        type: String,
                        enum: ['view', 'edit', 'export', 'share'],
                        required: true,
                    },
                    timestamp: {
                        type: Date,
                        default: Date.now,
                    },
                    ipAddress: String,
                },
            ],
        },
        status: {
            type: String,
            enum: ['active', 'archived', 'deleted'],
            default: 'active',
            index: true,
        },
        archivedAt: Date,
        archivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        collection: 'diagnostic_history',
    }
);

// Indexes for performance and queries
diagnosticHistorySchema.index({ patientId: 1, createdAt: -1 });
diagnosticHistorySchema.index({ pharmacistId: 1, createdAt: -1 });
diagnosticHistorySchema.index({ workplaceId: 1, createdAt: -1 });
diagnosticHistorySchema.index({ caseId: 1 });
diagnosticHistorySchema.index({ status: 1, createdAt: -1 });
diagnosticHistorySchema.index({ 'followUp.required': 1, 'followUp.completed': 1 });
diagnosticHistorySchema.index({ 'referral.status': 1 });
diagnosticHistorySchema.index({ 'analysisSnapshot.confidenceScore': -1 });

// Compound indexes for complex queries
diagnosticHistorySchema.index({ patientId: 1, status: 1, createdAt: -1 });
diagnosticHistorySchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
diagnosticHistorySchema.index({
    patientId: 1,
    'analysisSnapshot.differentialDiagnoses.condition': 1
});

// Pre-save middleware to update audit trail
diagnosticHistorySchema.pre<IDiagnosticHistory>('save', function (next) {
    if (this.isModified() && !this.isNew) {
        this.auditTrail.lastModified = new Date();
    }
    next();
});

export default mongoose.model<IDiagnosticHistory>('DiagnosticHistory', diagnosticHistorySchema);