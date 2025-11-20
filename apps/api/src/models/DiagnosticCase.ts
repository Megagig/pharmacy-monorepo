import mongoose, { Document, Schema } from 'mongoose';

export interface IDiagnosticCase extends Document {
  caseId: string;
  patientId: mongoose.Types.ObjectId;
  pharmacistId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId; // Link to appointment if created during consultation

  // Input data
  symptoms: {
    subjective: string[];
    objective: string[];
    duration: string;
    severity: 'mild' | 'moderate' | 'severe';
    onset: 'acute' | 'chronic' | 'subacute';
  };

  labResults?: {
    testName: string;
    value: string;
    referenceRange: string;
    abnormal: boolean;
  }[];

  currentMedications?: {
    name: string;
    dosage: string;
    frequency: string;
    startDate: Date;
  }[];

  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };

  // AI Analysis Results
  aiAnalysis: {
    differentialDiagnoses: {
      condition: string;
      probability: number;
      reasoning: string;
      severity: 'low' | 'medium' | 'high';
    }[];

    recommendedTests: {
      testName: string;
      priority: 'urgent' | 'routine' | 'optional';
      reasoning: string;
    }[];

    therapeuticOptions: {
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      reasoning: string;
      safetyNotes: string[];
    }[];

    redFlags: {
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

  // Drug Interactions
  drugInteractions?: {
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    clinicalEffect: string;
    management: string;
  }[];

  // Pharmacist Actions
  pharmacistDecision: {
    accepted: boolean;
    modifications: string;
    finalRecommendation: string;
    counselingPoints: string[];
    followUpRequired: boolean;
    followUpDate?: Date;
    notes?: string;
    reviewedAt?: Date;
    reviewedBy?: mongoose.Types.ObjectId;
  };

  // Patient-Friendly Interpretation (for Patient Portal)
  patientInterpretation?: {
    summary: string;                    // Brief, patient-friendly summary
    keyFindings: string[];             // Key findings in plain language
    whatThisMeans: string;             // Explanation of what the results mean
    recommendations: string[];          // Actionable recommendations
    whenToSeekCare: string;            // When to contact healthcare provider
    visibleToPatient: boolean;         // Pharmacist approval flag
    interpretedBy: mongoose.Types.ObjectId;  // Pharmacist who wrote interpretation
    interpretedAt: Date;               // When interpretation was added
    lastModifiedAt?: Date;             // Last update timestamp
    lastModifiedBy?: mongoose.Types.ObjectId;  // Who last modified
  };

  // Follow-up Management
  followUp?: {
    scheduledDate: Date;
    reason: string;
    completed: boolean;
    completedDate?: Date;
    outcome?: string;
    nextSteps?: string;
  };

  // Referral Management
  referral?: {
    generated: boolean;
    generatedAt?: Date;
    document?: {
      content: string;
      template: string;
      lastModified: Date;
      modifiedBy: mongoose.Types.ObjectId;
    };
    status: 'pending' | 'sent' | 'acknowledged' | 'completed';
    sentAt?: Date;
    sentTo?: {
      physicianName: string;
      physicianEmail?: string;
      specialty: string;
      institution?: string;
    };
    acknowledgedAt?: Date;
    completedAt?: Date;
    feedback?: string;
    trackingId?: string;
  };

  // Patient Consent
  patientConsent: {
    provided: boolean;
    consentDate: Date;
    consentMethod: 'verbal' | 'written' | 'electronic';
  };

  // Audit Trail
  aiRequestData: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestId: string;
    processingTime: number;
  };

  status: 'draft' | 'pending_review' | 'follow_up' | 'completed' | 'referred' | 'cancelled';
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods for patient interpretation
  addPatientInterpretation(
    interpretationData: {
      summary: string;
      keyFindings: string[];
      whatThisMeans: string;
      recommendations: string[];
      whenToSeekCare: string;
      visibleToPatient?: boolean;
    },
    interpretedBy: mongoose.Types.ObjectId
  ): void;

  updatePatientInterpretation(
    updates: Partial<{
      summary: string;
      keyFindings: string[];
      whatThisMeans: string;
      recommendations: string[];
      whenToSeekCare: string;
      visibleToPatient: boolean;
    }>,
    modifiedBy: mongoose.Types.ObjectId
  ): void;

  makeVisibleToPatient(modifiedBy: mongoose.Types.ObjectId): void;
  hideFromPatient(modifiedBy: mongoose.Types.ObjectId): void;
  hasPatientInterpretation(): boolean;
  isVisibleToPatient(): boolean;
}

const diagnosticCaseSchema = new Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: false,
      index: true,
    },
    symptoms: {
      subjective: [String],
      objective: [String],
      duration: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe'],
        required: true,
      },
      onset: {
        type: String,
        enum: ['acute', 'chronic', 'subacute'],
        required: true,
      },
    },
    labResults: [
      {
        testName: String,
        value: String,
        referenceRange: String,
        abnormal: Boolean,
      },
    ],
    currentMedications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        startDate: Date,
      },
    ],
    vitalSigns: {
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
    },
    aiAnalysis: {
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
          required: function (this: any) {
            return this.recommended === true;
          },
        },
        specialty: {
          type: String,
          required: function (this: any) {
            return this.recommended === true;
          },
        },
        reason: {
          type: String,
          required: function (this: any) {
            return this.recommended === true;
          },
        },
      },
      disclaimer: String,
      confidenceScore: Number,
      processingTime: Number,
    },
    drugInteractions: [
      {
        drug1: String,
        drug2: String,
        severity: {
          type: String,
          enum: ['minor', 'moderate', 'major', 'contraindicated'],
        },
        description: String,
        clinicalEffect: String,
        management: String,
      },
    ],
    pharmacistDecision: {
      accepted: {
        type: Boolean,
        default: false,
      },
      modifications: String,
      finalRecommendation: String,
      counselingPoints: [String],
      followUpRequired: {
        type: Boolean,
        default: false,
      },
      followUpDate: Date,
      notes: String,
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    patientInterpretation: {
      summary: {
        type: String,
        trim: true,
        maxlength: [500, 'Summary cannot exceed 500 characters'],
      },
      keyFindings: {
        type: [String],
        validate: {
          validator: function (findings: string[]) {
            return findings.length <= 10;
          },
          message: 'Maximum 10 key findings allowed'
        }
      },
      whatThisMeans: {
        type: String,
        trim: true,
        maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
      },
      recommendations: {
        type: [String],
        validate: {
          validator: function (recs: string[]) {
            return recs.length <= 15;
          },
          message: 'Maximum 15 recommendations allowed'
        }
      },
      whenToSeekCare: {
        type: String,
        trim: true,
        maxlength: [500, 'When to seek care guidance cannot exceed 500 characters'],
      },
      visibleToPatient: {
        type: Boolean,
        default: false,
        index: true,
      },
      interpretedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      interpretedAt: {
        type: Date,
      },
      lastModifiedAt: {
        type: Date,
      },
      lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    patientConsent: {
      provided: {
        type: Boolean,
        required: true,
      },
      consentDate: {
        type: Date,
        required: true,
      },
      consentMethod: {
        type: String,
        enum: ['verbal', 'written', 'electronic'],
        required: true,
      },
    },
    aiRequestData: {
      model: String,
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number,
      requestId: String,
      processingTime: Number,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'follow_up', 'completed', 'referred', 'cancelled'],
      default: 'draft',
      index: true,
    },
    completedAt: Date,
    followUp: {
      scheduledDate: {
        type: Date,
        required: function (this: any) {
          return this.parent().status === 'follow_up';
        },
      },
      reason: {
        type: String,
        required: function (this: any) {
          return this.parent().status === 'follow_up';
        },
      },
      completed: {
        type: Boolean,
        default: false,
      },
      completedDate: Date,
      outcome: String,
      nextSteps: String,
    },
    referral: {
      generated: {
        type: Boolean,
        default: false,
      },
      generatedAt: Date,
      document: {
        content: String,
        template: String,
        lastModified: Date,
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
      status: {
        type: String,
        enum: ['pending', 'sent', 'acknowledged', 'completed'],
        default: 'pending',
      },
      sentAt: Date,
      sentTo: {
        physicianName: String,
        physicianEmail: String,
        specialty: String,
        institution: String,
      },
      acknowledgedAt: Date,
      completedAt: Date,
      feedback: String,
      trackingId: String,
    },
  },
  {
    timestamps: true,
    collection: 'diagnostic_cases'
  }
);

// Generate unique case ID
diagnosticCaseSchema.pre<IDiagnosticCase>('save', function (next) {
  if (this.isNew && !this.caseId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    this.caseId = `DX-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Indexes for performance
diagnosticCaseSchema.index({ patientId: 1, createdAt: -1 });
diagnosticCaseSchema.index({ pharmacistId: 1, createdAt: -1 });
diagnosticCaseSchema.index({ workplaceId: 1, createdAt: -1 });
diagnosticCaseSchema.index({ status: 1, createdAt: -1 });
diagnosticCaseSchema.index({ 'aiAnalysis.redFlags.severity': 1 });
diagnosticCaseSchema.index({ completedAt: -1 });
diagnosticCaseSchema.index({ 'patientInterpretation.visibleToPatient': 1 });
diagnosticCaseSchema.index({ 'patientInterpretation.interpretedBy': 1, 'patientInterpretation.interpretedAt': -1 });
diagnosticCaseSchema.index({ workplaceId: 1, 'patientInterpretation.visibleToPatient': 1, createdAt: -1 });

// Instance methods for patient interpretation management
diagnosticCaseSchema.methods.addPatientInterpretation = function (
  interpretationData: {
    summary: string;
    keyFindings: string[];
    whatThisMeans: string;
    recommendations: string[];
    whenToSeekCare: string;
    visibleToPatient?: boolean;
  },
  interpretedBy: mongoose.Types.ObjectId
): void {
  this.patientInterpretation = {
    ...interpretationData,
    visibleToPatient: interpretationData.visibleToPatient || false,
    interpretedBy,
    interpretedAt: new Date(),
    lastModifiedAt: new Date(),
    lastModifiedBy: interpretedBy,
  };
};

diagnosticCaseSchema.methods.updatePatientInterpretation = function (
  updates: Partial<{
    summary: string;
    keyFindings: string[];
    whatThisMeans: string;
    recommendations: string[];
    whenToSeekCare: string;
    visibleToPatient: boolean;
  }>,
  modifiedBy: mongoose.Types.ObjectId
): void {
  if (!this.patientInterpretation) {
    throw new Error('Patient interpretation does not exist. Use addPatientInterpretation first.');
  }

  this.patientInterpretation = {
    ...this.patientInterpretation,
    ...updates,
    lastModifiedAt: new Date(),
    lastModifiedBy: modifiedBy,
  };
};

diagnosticCaseSchema.methods.makeVisibleToPatient = function (
  modifiedBy: mongoose.Types.ObjectId
): void {
  if (!this.patientInterpretation) {
    throw new Error('Cannot make visible: No patient interpretation exists');
  }

  this.patientInterpretation.visibleToPatient = true;
  this.patientInterpretation.lastModifiedAt = new Date();
  this.patientInterpretation.lastModifiedBy = modifiedBy;
};

diagnosticCaseSchema.methods.hideFromPatient = function (
  modifiedBy: mongoose.Types.ObjectId
): void {
  if (!this.patientInterpretation) {
    throw new Error('Cannot hide: No patient interpretation exists');
  }

  this.patientInterpretation.visibleToPatient = false;
  this.patientInterpretation.lastModifiedAt = new Date();
  this.patientInterpretation.lastModifiedBy = modifiedBy;
};

diagnosticCaseSchema.methods.hasPatientInterpretation = function (): boolean {
  return !!(this.patientInterpretation && this.patientInterpretation.summary);
};

diagnosticCaseSchema.methods.isVisibleToPatient = function (): boolean {
  return !!(this.patientInterpretation && this.patientInterpretation.visibleToPatient);
};

export default mongoose.model<IDiagnosticCase>('DiagnosticCase', diagnosticCaseSchema);