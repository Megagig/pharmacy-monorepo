import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface IMedicationAdherence {
    medicationName: string;
    rxcui?: string;
    dosage: string;
    frequency: string;
    prescribedDate: Date;
    expectedRefillDate?: Date;
    lastRefillDate?: Date;
    daysSupply?: number;
    adherenceScore: number; // 0-100
    adherenceStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    missedDoses?: number;
    totalDoses?: number;
    refillHistory: Array<{
        date: Date;
        daysSupply: number;
        source: 'pharmacy' | 'patient_report' | 'system_estimate';
        notes?: string;
    }>;
}

export interface IAdherenceAlert {
    type: 'missed_refill' | 'low_adherence' | 'medication_gap' | 'overdue_follow_up' | 'side_effects';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    triggeredAt: Date;
    acknowledged: boolean;
    acknowledgedBy?: mongoose.Types.ObjectId;
    acknowledgedAt?: Date;
    actionTaken?: string;
    resolved: boolean;
    resolvedAt?: Date;
}

export interface IAdherenceIntervention {
    type: 'counseling' | 'reminder_system' | 'dose_adjustment' | 'medication_change' | 'follow_up_scheduled';
    description: string;
    implementedBy: mongoose.Types.ObjectId;
    implementedAt: Date;
    expectedOutcome: string;
    actualOutcome?: string;
    effectiveness?: 'very_effective' | 'effective' | 'somewhat_effective' | 'not_effective';
    notes?: string;
}

export interface IAdherenceTracking extends Document {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    diagnosticRequestId?: mongoose.Types.ObjectId;
    diagnosticResultId?: mongoose.Types.ObjectId;

    // Medication tracking
    medications: IMedicationAdherence[];

    // Overall adherence metrics
    overallAdherenceScore: number; // 0-100
    adherenceCategory: 'excellent' | 'good' | 'fair' | 'poor';
    lastAssessmentDate: Date;
    nextAssessmentDate: Date;

    // Monitoring settings
    monitoringActive: boolean;
    monitoringStartDate: Date;
    monitoringEndDate?: Date;
    monitoringFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';

    // Alerts and notifications
    alerts: IAdherenceAlert[];
    alertPreferences: {
        enableRefillReminders: boolean;
        enableAdherenceAlerts: boolean;
        reminderDaysBefore: number;
        escalationThreshold: number; // days
    };

    // Interventions
    interventions: IAdherenceIntervention[];

    // Patient engagement
    patientReportedAdherence?: {
        lastReportDate: Date;
        selfReportedScore: number; // 0-100
        reportingMethod: 'phone' | 'app' | 'in_person' | 'survey';
        barriers?: string[];
        notes?: string;
    };

    // Outcome tracking
    clinicalOutcomes?: {
        symptomsImproved: boolean;
        vitalSignsImproved: boolean;
        labValuesImproved: boolean;
        qualityOfLifeScore?: number;
        sideEffectsReported?: string[];
        hospitalizations?: number;
        emergencyVisits?: number;
    };

    // Audit fields (added by addAuditFields)
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Virtual properties
    activeAlerts: IAdherenceAlert[];
    criticalAlerts: IAdherenceAlert[];
    averageAdherence: number;
    medicationsAtRisk: IMedicationAdherence[];

    // Instance methods
    calculateOverallAdherence(): number;
    addMedication(medication: Omit<IMedicationAdherence, 'adherenceScore' | 'adherenceStatus' | 'refillHistory'>): void;
    updateMedicationAdherence(medicationName: string, adherenceData: Partial<IMedicationAdherence>): void;
    addRefill(medicationName: string, refillData: IMedicationAdherence['refillHistory'][0]): void;
    createAlert(alert: Omit<IAdherenceAlert, 'triggeredAt' | 'acknowledged' | 'resolved'>): void;
    acknowledgeAlert(alertIndex: number, acknowledgedBy: mongoose.Types.ObjectId, actionTaken?: string): void;
    resolveAlert(alertIndex: number): void;
    addIntervention(intervention: Omit<IAdherenceIntervention, 'implementedAt'>): void;
    assessAdherenceRisk(): 'low' | 'medium' | 'high' | 'critical';
    generateAdherenceReport(): any;
    calculateMedicationAdherence(medication: IMedicationAdherence): void;
}

export interface IAdherenceTrackingModel extends mongoose.Model<IAdherenceTracking> {
    findByPatient(patientId: mongoose.Types.ObjectId, workplaceId?: mongoose.Types.ObjectId): Promise<IAdherenceTracking | null>;
    findPoorAdherence(workplaceId?: mongoose.Types.ObjectId, threshold?: number): Promise<IAdherenceTracking[]>;
    findDueForAssessment(workplaceId?: mongoose.Types.ObjectId): Promise<IAdherenceTracking[]>;
    findWithActiveAlerts(workplaceId?: mongoose.Types.ObjectId): Promise<IAdherenceTracking[]>;
}

const medicationAdherenceSchema = new Schema({
    medicationName: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Medication name cannot exceed 200 characters']
    },
    rxcui: {
        type: String,
        trim: true,
        maxlength: [20, 'RxCUI cannot exceed 20 characters']
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
    prescribedDate: {
        type: Date,
        required: true
    },
    expectedRefillDate: Date,
    lastRefillDate: Date,
    daysSupply: {
        type: Number,
        min: [1, 'Days supply must be at least 1'],
        max: [365, 'Days supply cannot exceed 365']
    },
    adherenceScore: {
        type: Number,
        required: true,
        min: [0, 'Adherence score cannot be negative'],
        max: [100, 'Adherence score cannot exceed 100'],
        default: 0
    },
    adherenceStatus: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor', 'unknown'],
        required: true,
        default: 'unknown'
    },
    missedDoses: {
        type: Number,
        min: [0, 'Missed doses cannot be negative'],
        default: 0
    },
    totalDoses: {
        type: Number,
        min: [0, 'Total doses cannot be negative'],
        default: 0
    },
    refillHistory: [{
        date: {
            type: Date,
            required: true
        },
        daysSupply: {
            type: Number,
            required: true,
            min: [1, 'Days supply must be at least 1']
        },
        source: {
            type: String,
            enum: ['pharmacy', 'patient_report', 'system_estimate'],
            required: true
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters']
        }
    }]
}, { _id: false });

const adherenceAlertSchema = new Schema({
    type: {
        type: String,
        enum: ['missed_refill', 'low_adherence', 'medication_gap', 'overdue_follow_up', 'side_effects'],
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Alert message cannot exceed 500 characters']
    },
    triggeredAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    acknowledged: {
        type: Boolean,
        default: false,
        index: true
    },
    acknowledgedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    acknowledgedAt: Date,
    actionTaken: {
        type: String,
        trim: true,
        maxlength: [500, 'Action taken cannot exceed 500 characters']
    },
    resolved: {
        type: Boolean,
        default: false,
        index: true
    },
    resolvedAt: Date
}, { _id: false });

const adherenceInterventionSchema = new Schema({
    type: {
        type: String,
        enum: ['counseling', 'reminder_system', 'dose_adjustment', 'medication_change', 'follow_up_scheduled'],
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    implementedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    implementedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    expectedOutcome: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Expected outcome cannot exceed 500 characters']
    },
    actualOutcome: {
        type: String,
        trim: true,
        maxlength: [500, 'Actual outcome cannot exceed 500 characters']
    },
    effectiveness: {
        type: String,
        enum: ['very_effective', 'effective', 'somewhat_effective', 'not_effective']
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
}, { _id: false });

const adherenceTrackingSchema = new Schema({
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    diagnosticRequestId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticRequest',
        index: true
    },
    diagnosticResultId: {
        type: Schema.Types.ObjectId,
        ref: 'DiagnosticResult',
        index: true
    },

    // Medication tracking
    medications: {
        type: [medicationAdherenceSchema],
        default: [],
        validate: {
            validator: function (medications: IMedicationAdherence[]) {
                return medications.length > 0;
            },
            message: 'At least one medication must be tracked'
        }
    },

    // Overall adherence metrics
    overallAdherenceScore: {
        type: Number,
        required: true,
        min: [0, 'Overall adherence score cannot be negative'],
        max: [100, 'Overall adherence score cannot exceed 100'],
        default: 0,
        index: true
    },
    adherenceCategory: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
        required: true,
        default: 'poor',
        index: true
    },
    lastAssessmentDate: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    nextAssessmentDate: {
        type: Date,
        required: true,
        index: true
    },

    // Monitoring settings
    monitoringActive: {
        type: Boolean,
        default: true,
        index: true
    },
    monitoringStartDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    monitoringEndDate: Date,
    monitoringFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly'],
        default: 'weekly',
        required: true
    },

    // Alerts and notifications
    alerts: {
        type: [adherenceAlertSchema],
        default: []
    },
    alertPreferences: {
        enableRefillReminders: {
            type: Boolean,
            default: true
        },
        enableAdherenceAlerts: {
            type: Boolean,
            default: true
        },
        reminderDaysBefore: {
            type: Number,
            default: 7,
            min: [1, 'Reminder days must be at least 1'],
            max: [30, 'Reminder days cannot exceed 30']
        },
        escalationThreshold: {
            type: Number,
            default: 3,
            min: [1, 'Escalation threshold must be at least 1'],
            max: [14, 'Escalation threshold cannot exceed 14 days']
        }
    },

    // Interventions
    interventions: {
        type: [adherenceInterventionSchema],
        default: []
    },

    // Patient engagement
    patientReportedAdherence: {
        lastReportDate: Date,
        selfReportedScore: {
            type: Number,
            min: [0, 'Self-reported score cannot be negative'],
            max: [100, 'Self-reported score cannot exceed 100']
        },
        reportingMethod: {
            type: String,
            enum: ['phone', 'app', 'in_person', 'survey']
        },
        barriers: {
            type: [String],
            default: []
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Notes cannot exceed 1000 characters']
        }
    },

    // Outcome tracking
    clinicalOutcomes: {
        symptomsImproved: Boolean,
        vitalSignsImproved: Boolean,
        labValuesImproved: Boolean,
        qualityOfLifeScore: {
            type: Number,
            min: [0, 'Quality of life score cannot be negative'],
            max: [100, 'Quality of life score cannot exceed 100']
        },
        sideEffectsReported: {
            type: [String],
            default: []
        },
        hospitalizations: {
            type: Number,
            min: [0, 'Hospitalizations cannot be negative'],
            default: 0
        },
        emergencyVisits: {
            type: Number,
            min: [0, 'Emergency visits cannot be negative'],
            default: 0
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(adherenceTrackingSchema);

// Apply tenancy guard plugin
adherenceTrackingSchema.plugin(tenancyGuardPlugin, {
    pharmacyIdField: 'workplaceId'
});

// Indexes for efficient querying
adherenceTrackingSchema.index({ workplaceId: 1, patientId: 1 });
adherenceTrackingSchema.index({ workplaceId: 1, overallAdherenceScore: 1 });
adherenceTrackingSchema.index({ workplaceId: 1, adherenceCategory: 1 });
adherenceTrackingSchema.index({ workplaceId: 1, monitoringActive: 1 });
adherenceTrackingSchema.index({ workplaceId: 1, nextAssessmentDate: 1 });
adherenceTrackingSchema.index({ workplaceId: 1, 'alerts.acknowledged': 1, 'alerts.severity': 1 });
adherenceTrackingSchema.index({ workplaceId: 1, isDeleted: 1 });
adherenceTrackingSchema.index({ diagnosticRequestId: 1 }, { sparse: true });
adherenceTrackingSchema.index({ diagnosticResultId: 1 }, { sparse: true });

// Virtual for active alerts
adherenceTrackingSchema.virtual('activeAlerts').get(function (this: IAdherenceTracking) {
    return this.alerts.filter(alert => !alert.acknowledged && !alert.resolved);
});

// Virtual for critical alerts
adherenceTrackingSchema.virtual('criticalAlerts').get(function (this: IAdherenceTracking) {
    return this.alerts.filter(alert =>
        !alert.resolved &&
        (alert.severity === 'critical' || alert.severity === 'high')
    );
});

// Virtual for average adherence
adherenceTrackingSchema.virtual('averageAdherence').get(function (this: IAdherenceTracking) {
    if (this.medications.length === 0) return 0;

    const total = this.medications.reduce((sum, med) => sum + med.adherenceScore, 0);
    return Math.round(total / this.medications.length);
});

// Virtual for medications at risk
adherenceTrackingSchema.virtual('medicationsAtRisk').get(function (this: IAdherenceTracking) {
    return this.medications.filter(med =>
        med.adherenceScore < 80 ||
        med.adherenceStatus === 'poor' ||
        med.adherenceStatus === 'fair'
    );
});

// Instance methods
adherenceTrackingSchema.methods.calculateOverallAdherence = function (this: IAdherenceTracking): number {
    if (this.medications.length === 0) return 0;

    const weightedSum = this.medications.reduce((sum, med) => {
        // Weight by importance (could be based on medication type, condition severity, etc.)
        const weight = 1; // For now, all medications have equal weight
        return sum + (med.adherenceScore * weight);
    }, 0);

    const totalWeight = this.medications.length;
    const score = Math.round(weightedSum / totalWeight);

    // Update adherence category based on score
    if (score >= 90) this.adherenceCategory = 'excellent';
    else if (score >= 80) this.adherenceCategory = 'good';
    else if (score >= 60) this.adherenceCategory = 'fair';
    else this.adherenceCategory = 'poor';

    this.overallAdherenceScore = score;
    return score;
};

adherenceTrackingSchema.methods.addMedication = function (
    this: IAdherenceTracking,
    medication: Omit<IMedicationAdherence, 'adherenceScore' | 'adherenceStatus' | 'refillHistory'>
): void {
    const newMedication: IMedicationAdherence = {
        ...medication,
        adherenceScore: 0,
        adherenceStatus: 'unknown',
        refillHistory: []
    };

    this.medications.push(newMedication);
    this.calculateOverallAdherence();
};

adherenceTrackingSchema.methods.updateMedicationAdherence = function (
    this: IAdherenceTracking,
    medicationName: string,
    adherenceData: Partial<IMedicationAdherence>
): void {
    const medication = this.medications.find(med => med.medicationName === medicationName);
    if (!medication) {
        throw new Error(`Medication ${medicationName} not found`);
    }

    Object.assign(medication, adherenceData);

    // Update adherence status based on score
    if (medication.adherenceScore >= 90) medication.adherenceStatus = 'excellent';
    else if (medication.adherenceScore >= 80) medication.adherenceStatus = 'good';
    else if (medication.adherenceScore >= 60) medication.adherenceStatus = 'fair';
    else medication.adherenceStatus = 'poor';

    this.calculateOverallAdherence();
};

adherenceTrackingSchema.methods.addRefill = function (
    this: IAdherenceTracking,
    medicationName: string,
    refillData: IMedicationAdherence['refillHistory'][0]
): void {
    const medication = this.medications.find(med => med.medicationName === medicationName);
    if (!medication) {
        throw new Error(`Medication ${medicationName} not found`);
    }

    medication.refillHistory.push(refillData);
    medication.lastRefillDate = refillData.date;
    medication.daysSupply = refillData.daysSupply;

    // Calculate expected refill date
    if (medication.daysSupply) {
        const expectedRefill = new Date(refillData.date);
        expectedRefill.setDate(expectedRefill.getDate() + medication.daysSupply);
        medication.expectedRefillDate = expectedRefill;
    }

    // Recalculate adherence based on refill pattern
    this.calculateMedicationAdherence(medication);
};

adherenceTrackingSchema.methods.createAlert = function (
    this: IAdherenceTracking,
    alert: Omit<IAdherenceAlert, 'triggeredAt' | 'acknowledged' | 'resolved'>
): void {
    const newAlert: IAdherenceAlert = {
        ...alert,
        triggeredAt: new Date(),
        acknowledged: false,
        resolved: false
    };

    this.alerts.push(newAlert);
};

adherenceTrackingSchema.methods.acknowledgeAlert = function (
    this: IAdherenceTracking,
    alertIndex: number,
    acknowledgedBy: mongoose.Types.ObjectId,
    actionTaken?: string
): void {
    if (alertIndex < 0 || alertIndex >= this.alerts.length) {
        throw new Error('Invalid alert index');
    }

    const alert = this.alerts[alertIndex]!;
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();
    if (actionTaken) {
        alert.actionTaken = actionTaken;
    }
};

adherenceTrackingSchema.methods.resolveAlert = function (
    this: IAdherenceTracking,
    alertIndex: number
): void {
    if (alertIndex < 0 || alertIndex >= this.alerts.length) {
        throw new Error('Invalid alert index');
    }

    const alert = this.alerts[alertIndex]!;
    alert.resolved = true;
    alert.resolvedAt = new Date();
};

adherenceTrackingSchema.methods.addIntervention = function (
    this: IAdherenceTracking,
    intervention: Omit<IAdherenceIntervention, 'implementedAt'>
): void {
    const newIntervention: IAdherenceIntervention = {
        ...intervention,
        implementedAt: new Date()
    };

    this.interventions.push(newIntervention);
};

adherenceTrackingSchema.methods.assessAdherenceRisk = function (this: IAdherenceTracking): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.overallAdherenceScore;
    const activeAlerts = this.activeAlerts.length;
    const criticalAlerts = this.criticalAlerts.length;

    if (criticalAlerts > 0 || score < 50) return 'critical';
    if (score < 70 || activeAlerts > 2) return 'high';
    if (score < 85 || activeAlerts > 0) return 'medium';
    return 'low';
};

adherenceTrackingSchema.methods.generateAdherenceReport = function (this: IAdherenceTracking): any {
    return {
        patientId: this.patientId,
        overallScore: this.overallAdherenceScore,
        category: this.adherenceCategory,
        riskLevel: this.assessAdherenceRisk(),
        medicationCount: this.medications.length,
        medicationsAtRisk: this.medicationsAtRisk.length,
        activeAlerts: this.activeAlerts.length,
        criticalAlerts: this.criticalAlerts.length,
        interventions: this.interventions.length,
        lastAssessment: this.lastAssessmentDate,
        nextAssessment: this.nextAssessmentDate,
        medications: this.medications.map(med => ({
            name: med.medicationName,
            adherenceScore: med.adherenceScore,
            status: med.adherenceStatus,
            lastRefill: med.lastRefillDate,
            expectedRefill: med.expectedRefillDate
        }))
    };
};

// Helper method to calculate medication adherence
adherenceTrackingSchema.methods.calculateMedicationAdherence = function (
    medication: IMedicationAdherence
): void {
    if (medication.refillHistory.length < 2) {
        // Not enough data to calculate adherence
        medication.adherenceScore = 0;
        medication.adherenceStatus = 'unknown';
        return;
    }

    // Calculate adherence based on refill patterns
    const refills = medication.refillHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
    let totalGaps = 0;
    let expectedGaps = 0;

    for (let i = 1; i < refills.length; i++) {
        const previousRefill = refills[i - 1]!;
        const currentRefill = refills[i]!;

        const daysBetween = Math.floor(
            (currentRefill.date.getTime() - previousRefill.date.getTime()) / (1000 * 60 * 60 * 24)
        );

        const expectedDays = previousRefill.daysSupply || 30; // Default to 30 days if not specified

        totalGaps += Math.max(0, daysBetween - expectedDays);
        expectedGaps += expectedDays;
    }

    // Calculate adherence percentage
    const adherencePercentage = expectedGaps > 0
        ? Math.max(0, Math.min(100, ((expectedGaps - totalGaps) / expectedGaps) * 100))
        : 0;

    medication.adherenceScore = Math.round(adherencePercentage);

    // Update status based on score
    if (medication.adherenceScore >= 90) medication.adherenceStatus = 'excellent';
    else if (medication.adherenceScore >= 80) medication.adherenceStatus = 'good';
    else if (medication.adherenceScore >= 60) medication.adherenceStatus = 'fair';
    else medication.adherenceStatus = 'poor';
};

// Pre-save middleware
adherenceTrackingSchema.pre('save', function (this: IAdherenceTracking) {
    // Recalculate overall adherence when medications change
    if (this.isModified('medications')) {
        this.calculateOverallAdherence();
    }

    // Update last assessment date
    if (this.isModified('overallAdherenceScore')) {
        this.lastAssessmentDate = new Date();
    }

    // Set next assessment date based on monitoring frequency
    if (this.isNew || this.isModified('monitoringFrequency')) {
        const nextDate = new Date();
        switch (this.monitoringFrequency) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'biweekly':
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }
        this.nextAssessmentDate = nextDate;
    }
});

// Static methods
adherenceTrackingSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = { patientId };
    const baseQuery = workplaceId
        ? this.findOne(query).setOptions({ workplaceId })
        : this.findOne(query);
    return baseQuery;
};

adherenceTrackingSchema.statics.findPoorAdherence = function (
    workplaceId?: mongoose.Types.ObjectId,
    threshold: number = 70
) {
    const query = {
        overallAdherenceScore: { $lt: threshold },
        monitoringActive: true
    };
    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ overallAdherenceScore: 1 });
};

adherenceTrackingSchema.statics.findDueForAssessment = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        nextAssessmentDate: { $lte: new Date() },
        monitoringActive: true
    };
    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ nextAssessmentDate: 1 });
};

adherenceTrackingSchema.statics.findWithActiveAlerts = function (
    workplaceId?: mongoose.Types.ObjectId
) {
    const query = {
        'alerts.acknowledged': false,
        'alerts.resolved': false,
        monitoringActive: true
    };
    const baseQuery = workplaceId
        ? this.find(query).setOptions({ workplaceId })
        : this.find(query);
    return baseQuery.sort({ 'alerts.severity': -1, 'alerts.triggeredAt': 1 });
};

export default mongoose.model<IAdherenceTracking, IAdherenceTrackingModel>('AdherenceTracking', adherenceTrackingSchema);