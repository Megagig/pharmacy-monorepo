import mongoose, { Document, Schema } from 'mongoose';
import {
  tenancyGuardPlugin,
  addAuditFields,
  NIGERIAN_STATES,
  BLOOD_GROUPS,
  GENOTYPES,
  MARITAL_STATUS,
  GENDERS,
  generateMRN,
} from '../utils/tenancyGuard';

export interface IPatientVitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  rr?: number;
  tempC?: number;
  heartSounds?: string;
  pallor?: 'none' | 'mild' | 'moderate' | 'severe';
  dehydration?: 'none' | 'mild' | 'moderate' | 'severe';
  recordedAt?: Date;
}

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId; // ref Workplace, indexed (changed from pharmacyId)
  locationId?: string; // Location ID within the workplace for multi-location support
  mrn: string; // generated patient code, unique per workplace

  // Demography
  firstName: string;
  lastName: string;
  otherNames?: string;
  dob?: Date;
  age?: number; // derive/display if dob missing
  gender?: 'male' | 'female' | 'other';
  phone?: string; // +234 format
  email?: string;
  address?: string;
  state?: string; // NG state
  lga?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  genotype?: 'AA' | 'AS' | 'SS' | 'AC' | 'SC' | 'CC';
  weightKg?: number;

  // Virtual fields
  name?: string; // Full name (virtual)

  // Enhanced patient portal fields
  allergies: Array<{
    _id?: mongoose.Types.ObjectId;
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
    recordedDate: Date;
    recordedBy?: mongoose.Types.ObjectId;
    notes?: string;
  }>;

  chronicConditions: Array<{
    _id?: mongoose.Types.ObjectId;
    condition: string;
    diagnosedDate: Date;
    managementPlan?: string;
    status: 'active' | 'managed' | 'resolved';
    recordedBy?: mongoose.Types.ObjectId;
    notes?: string;
  }>;

  // Enhanced emergency contacts with priority
  enhancedEmergencyContacts: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    isPrimary: boolean;
    priority: number; // 1 = highest priority
  }>;

  // Insurance information
  insuranceInfo: {
    provider?: string;
    policyNumber?: string;
    expiryDate?: Date;
    coverageDetails?: string;
    copayAmount?: number;
    isActive?: boolean;
  };

  // Patient-logged vitals history
  patientLoggedVitals: Array<{
    _id?: mongoose.Types.ObjectId;
    recordedDate: Date;
    appointmentId?: mongoose.Types.ObjectId; // Link to appointment if logged during consultation
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    glucose?: number;
    oxygenSaturation?: number;
    notes?: string;
    source: 'patient_portal';
    verifiedBy?: mongoose.Types.ObjectId;
    isVerified?: boolean;
  }>;

  // Clinical snapshots (latest vitals cached for list speed)
  latestVitals?: IPatientVitals;

  // Notification preferences
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    resultNotifications: boolean;
    orderReminders: boolean;
  };

  // Appointment preferences
  appointmentPreferences?: {
    preferredDays: number[]; // 0-6 (Sunday-Saturday)
    preferredTimeSlots: Array<{ start: string; end: string }>; // HH:mm format
    preferredPharmacist?: mongoose.Types.ObjectId;
    reminderPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    language: string; // 'en', 'yo', 'ig', 'ha'
    timezone: string;
  };

  // Multi-location and sharing metadata
  metadata?: {
    sharedAccess?: {
      patientId: mongoose.Types.ObjectId;
      sharedWithLocations: string[];
      sharedBy: mongoose.Types.ObjectId;
      sharedAt: Date;
      accessLevel: 'read' | 'write' | 'full';
      expiresAt?: Date;
    };
    transferWorkflow?: {
      transferId: string;
      patientId: mongoose.Types.ObjectId;
      fromLocationId: string;
      toLocationId: string;
      transferredBy: mongoose.Types.ObjectId;
      transferReason?: string;
      status: 'pending' | 'approved' | 'completed';
      createdAt: Date;
      completedAt?: Date;
      completedBy?: mongoose.Types.ObjectId;
      steps: Array<{
        step: string;
        completedAt: Date;
        completedBy: mongoose.Types.ObjectId;
      }>;
    };
  };

  // Engagement metrics
  engagementMetrics?: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    completionRate: number;
    totalFollowUps: number;
    completedFollowUps: number;
    overdueFollowUps: number;
    followUpCompletionRate: number;
    averageResponseTime: number;
    lastEngagementDate?: Date;
    engagementScore: number;
    lastUpdated?: Date;
  };

  // Flags
  hasActiveDTP?: boolean;
  hasActiveInterventions?: boolean;
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getAge(): number;
  getDisplayName(): string;
  updateLatestVitals(vitals: IPatientVitals): void;
  getInterventionCount(): Promise<number>;
  getActiveInterventionCount(): Promise<number>;
  updateInterventionFlags(): Promise<void>;
  getDiagnosticHistoryCount(): Promise<number>;
  getLatestDiagnosticHistory(): Promise<any>;

  // New methods for patient portal fields
  addAllergy(allergyData: any, recordedBy?: mongoose.Types.ObjectId): void;
  removeAllergy(allergyId: string): boolean;
  updateAllergy(allergyId: string, updates: any): boolean;
  addChronicCondition(conditionData: any, recordedBy?: mongoose.Types.ObjectId): void;
  removeChronicCondition(conditionId: string): boolean;
  updateChronicCondition(conditionId: string, updates: any): boolean;
  addEmergencyContact(contactData: any): void;
  removeEmergencyContact(contactId: string): boolean;
  updateEmergencyContact(contactId: string, updates: any): boolean;
  setPrimaryEmergencyContact(contactId: string): boolean;
  updateInsuranceInfo(insuranceData: any): void;
  logVitals(vitalsData: any): void;
  getVitalsHistory(limit?: number): any[];
  getLatestVitals(): any;
  verifyVitals(vitalsId: string, verifiedBy: mongoose.Types.ObjectId): boolean;
  unverifyVitals(vitalsId: string): boolean;
  getUnverifiedVitals(): any[];
  getVerifiedVitals(limit?: number): any[];
}

const patientSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    locationId: {
      type: String,
      index: true,
      sparse: true, // Allow null values and don't index them
    },
    mrn: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Demography
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    otherNames: {
      type: String,
      trim: true,
      maxlength: [100, 'Other names cannot exceed 100 characters'],
    },
    dob: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          if (value) {
            const now = new Date();
            const age = now.getFullYear() - value.getFullYear();
            return age >= 0 && age <= 150;
          }
          return true;
        },
        message: 'Invalid date of birth',
      },
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [150, 'Age cannot exceed 150'],
    },
    gender: {
      type: String,
      enum: GENDERS,
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
      lowercase: true,
      validate: {
        validator: function (value: string) {
          if (value) {
            return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value);
          }
          return true;
        },
        message: 'Please enter a valid email',
      },
    },
    address: {
      type: String,
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
    state: {
      type: String,
      enum: NIGERIAN_STATES,
    },
    lga: {
      type: String,
      maxlength: [50, 'LGA cannot exceed 50 characters'],
    },
    maritalStatus: {
      type: String,
      enum: MARITAL_STATUS,
    },
    bloodGroup: {
      type: String,
      enum: BLOOD_GROUPS,
    },
    genotype: {
      type: String,
      enum: GENOTYPES,
    },
    weightKg: {
      type: Number,
      min: [0, 'Weight cannot be negative'],
      max: [1000, 'Weight seems unrealistic'],
    },

    // Enhanced patient portal fields
    allergies: [
      {
        allergen: {
          type: String,
          required: [true, 'Allergen name is required'],
          trim: true,
          maxlength: [100, 'Allergen name cannot exceed 100 characters'],
        },
        reaction: {
          type: String,
          required: [true, 'Reaction description is required'],
          trim: true,
          maxlength: [500, 'Reaction description cannot exceed 500 characters'],
        },
        severity: {
          type: String,
          enum: {
            values: ['mild', 'moderate', 'severe'],
            message: 'Severity must be mild, moderate, or severe',
          },
          required: [true, 'Severity level is required'],
        },
        recordedDate: {
          type: Date,
          required: [true, 'Recorded date is required'],
          default: Date.now,
        },
        recordedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        notes: {
          type: String,
          trim: true,
          maxlength: [1000, 'Notes cannot exceed 1000 characters'],
        },
      },
    ],

    chronicConditions: [
      {
        condition: {
          type: String,
          required: [true, 'Condition name is required'],
          trim: true,
          maxlength: [200, 'Condition name cannot exceed 200 characters'],
        },
        diagnosedDate: {
          type: Date,
          required: [true, 'Diagnosed date is required'],
          validate: {
            validator: function (value: Date) {
              return value <= new Date();
            },
            message: 'Diagnosed date cannot be in the future',
          },
        },
        managementPlan: {
          type: String,
          trim: true,
          maxlength: [2000, 'Management plan cannot exceed 2000 characters'],
        },
        status: {
          type: String,
          enum: {
            values: ['active', 'managed', 'resolved'],
            message: 'Status must be active, managed, or resolved',
          },
          default: 'active',
          required: true,
        },
        recordedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        notes: {
          type: String,
          trim: true,
          maxlength: [1000, 'Notes cannot exceed 1000 characters'],
        },
      },
    ],

    enhancedEmergencyContacts: [
      {
        name: {
          type: String,
          required: [true, 'Emergency contact name is required'],
          trim: true,
          maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        relationship: {
          type: String,
          required: [true, 'Relationship is required'],
          trim: true,
          maxlength: [50, 'Relationship cannot exceed 50 characters'],
        },
        phone: {
          type: String,
          required: [true, 'Phone number is required'],
          validate: {
            validator: function (phone: string) {
              return /^\+234[0-9]{10}$/.test(phone);
            },
            message: 'Phone must be in Nigerian format (+234XXXXXXXXXX)',
          },
        },
        email: {
          type: String,
          lowercase: true,
          validate: {
            validator: function (email: string) {
              if (!email) return true; // Optional field
              return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
            },
            message: 'Please enter a valid email',
          },
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        priority: {
          type: Number,
          required: [true, 'Priority is required'],
          min: [1, 'Priority must be at least 1'],
          max: [10, 'Priority cannot exceed 10'],
        },
      },
    ],

    insuranceInfo: {
      provider: {
        type: String,
        trim: true,
        maxlength: [100, 'Insurance provider name cannot exceed 100 characters'],
      },
      policyNumber: {
        type: String,
        trim: true,
        maxlength: [50, 'Policy number cannot exceed 50 characters'],
      },
      expiryDate: {
        type: Date,
        validate: {
          validator: function (value: Date) {
            if (!value) return true; // Optional field
            return value > new Date();
          },
          message: 'Insurance expiry date must be in the future',
        },
      },
      coverageDetails: {
        type: String,
        trim: true,
        maxlength: [1000, 'Coverage details cannot exceed 1000 characters'],
      },
      copayAmount: {
        type: Number,
        min: [0, 'Copay amount cannot be negative'],
        max: [1000000, 'Copay amount seems unrealistic'],
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },

    patientLoggedVitals: [
      {
        recordedDate: {
          type: Date,
          required: [true, 'Recorded date is required'],
          default: Date.now,
        },
        appointmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Appointment',
          required: false,
        },
        bloodPressure: {
          systolic: {
            type: Number,
            min: [50, 'Systolic BP too low'],
            max: [300, 'Systolic BP too high'],
          },
          diastolic: {
            type: Number,
            min: [30, 'Diastolic BP too low'],
            max: [200, 'Diastolic BP too high'],
          },
        },
        heartRate: {
          type: Number,
          min: [30, 'Heart rate too low'],
          max: [250, 'Heart rate too high'],
        },
        temperature: {
          type: Number,
          min: [30, 'Temperature too low'],
          max: [45, 'Temperature too high'],
        },
        weight: {
          type: Number,
          min: [0, 'Weight cannot be negative'],
          max: [1000, 'Weight seems unrealistic'],
        },
        glucose: {
          type: Number,
          min: [20, 'Glucose level too low'],
          max: [800, 'Glucose level too high'],
        },
        oxygenSaturation: {
          type: Number,
          min: [50, 'Oxygen saturation too low'],
          max: [100, 'Oxygen saturation cannot exceed 100%'],
        },
        notes: {
          type: String,
          trim: true,
          maxlength: [500, 'Notes cannot exceed 500 characters'],
        },
        source: {
          type: String,
          enum: ['patient_portal'],
          default: 'patient_portal',
          required: true,
        },
        verifiedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        isVerified: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Clinical snapshots
    latestVitals: {
      bpSystolic: {
        type: Number,
        min: [50, 'Systolic BP too low'],
        max: [300, 'Systolic BP too high'],
      },
      bpDiastolic: {
        type: Number,
        min: [30, 'Diastolic BP too low'],
        max: [200, 'Diastolic BP too high'],
      },
      rr: {
        type: Number,
        min: [8, 'Respiratory rate too low'],
        max: [60, 'Respiratory rate too high'],
      },
      tempC: {
        type: Number,
        min: [30, 'Temperature too low'],
        max: [45, 'Temperature too high'],
      },
      heartSounds: {
        type: String,
        maxlength: [100, 'Heart sounds description too long'],
      },
      pallor: {
        type: String,
        enum: ['none', 'mild', 'moderate', 'severe'],
      },
      dehydration: {
        type: String,
        enum: ['none', 'mild', 'moderate', 'severe'],
      },
      recordedAt: Date,
    },

    // Notification preferences
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      resultNotifications: { type: Boolean, default: true },
      orderReminders: { type: Boolean, default: true },
    },

    // Appointment preferences
    appointmentPreferences: {
      preferredDays: {
        type: [Number],
        validate: {
          validator: function (days: number[]) {
            return days.every((day) => day >= 0 && day <= 6);
          },
          message: 'Preferred days must be between 0 (Sunday) and 6 (Saturday)',
        },
      },
      preferredTimeSlots: [
        {
          start: {
            type: String,
            validate: {
              validator: function (time: string) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
              },
              message: 'Time must be in HH:mm format',
            },
          },
          end: {
            type: String,
            validate: {
              validator: function (time: string) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
              },
              message: 'Time must be in HH:mm format',
            },
          },
        },
      ],
      preferredPharmacist: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      reminderPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
      },
      language: {
        type: String,
        enum: ['en', 'yo', 'ig', 'ha'],
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'Africa/Lagos',
      },
    },

    // Engagement metrics
    engagementMetrics: {
      totalAppointments: { type: Number, default: 0 },
      completedAppointments: { type: Number, default: 0 },
      cancelledAppointments: { type: Number, default: 0 },
      noShowAppointments: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      totalFollowUps: { type: Number, default: 0 },
      completedFollowUps: { type: Number, default: 0 },
      overdueFollowUps: { type: Number, default: 0 },
      followUpCompletionRate: { type: Number, default: 0 },
      averageResponseTime: { type: Number, default: 0 },
      lastEngagementDate: Date,
      engagementScore: { type: Number, default: 0 },
      lastUpdated: Date,
    },

    // Multi-location and sharing metadata
    metadata: {
      sharedAccess: {
        patientId: {
          type: Schema.Types.ObjectId,
          ref: 'Patient',
        },
        sharedWithLocations: [
          {
            type: String,
          },
        ],
        sharedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        sharedAt: Date,
        accessLevel: {
          type: String,
          enum: ['read', 'write', 'full'],
          default: 'read',
        },
        expiresAt: Date,
      },
      transferWorkflow: {
        transferId: String,
        patientId: {
          type: Schema.Types.ObjectId,
          ref: 'Patient',
        },
        fromLocationId: String,
        toLocationId: String,
        transferredBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        transferReason: String,
        status: {
          type: String,
          enum: ['pending', 'approved', 'completed'],
          default: 'pending',
        },
        createdAt: Date,
        completedAt: Date,
        completedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        steps: [
          {
            step: String,
            completedAt: Date,
            completedBy: {
              type: Schema.Types.ObjectId,
              ref: 'User',
            },
          },
        ],
      },
    },

    // Flags
    hasActiveDTP: {
      type: Boolean,
      default: false,
    },
    hasActiveInterventions: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(patientSchema);

// Apply tenancy guard plugin
patientSchema.plugin(tenancyGuardPlugin);

// Compound indexes for tenancy and uniqueness
patientSchema.index({ workplaceId: 1, mrn: 1 }, { unique: true });
patientSchema.index({ workplaceId: 1, lastName: 1, firstName: 1 });
patientSchema.index({ workplaceId: 1, isDeleted: 1 });
patientSchema.index({ workplaceId: 1, phone: 1 }, { sparse: true });
patientSchema.index({ workplaceId: 1, email: 1 }, { sparse: true });
patientSchema.index({ workplaceId: 1, locationId: 1 }, { sparse: true });
patientSchema.index(
  { workplaceId: 1, 'metadata.sharedAccess.sharedWithLocations': 1 },
  { sparse: true }
);
patientSchema.index({ hasActiveDTP: 1 });
patientSchema.index({ createdAt: -1 });

// Indexes for new patient portal fields
patientSchema.index({ 'allergies.allergen': 1 });
patientSchema.index({ 'allergies.severity': 1 });
patientSchema.index({ 'chronicConditions.condition': 1 });
patientSchema.index({ 'chronicConditions.status': 1 });
patientSchema.index({ 'enhancedEmergencyContacts.isPrimary': 1 });
patientSchema.index({ 'insuranceInfo.provider': 1 });
patientSchema.index({ 'insuranceInfo.isActive': 1 });
patientSchema.index({ 'patientLoggedVitals.recordedDate': -1 });
patientSchema.index({ 'patientLoggedVitals.isVerified': 1 });

// Virtual for full name
patientSchema.virtual('name').get(function (this: IPatient) {
  const parts = [this.firstName, this.otherNames, this.lastName].filter(Boolean);
  return parts.join(' ');
});

// Virtual for computed age from DOB
patientSchema.virtual('computedAge').get(function (this: IPatient) {
  if (this.dob) {
    const now = new Date();
    const age = now.getFullYear() - this.dob.getFullYear();
    const monthDiff = now.getMonth() - this.dob.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < this.dob.getDate())
    ) {
      return age - 1;
    }
    return age;
  }
  return this.age;
});

// Virtual for dateOfBirth alias to maintain backward compatibility
patientSchema.virtual('dateOfBirth').get(function (this: IPatient) {
  return this.dob;
});

patientSchema.virtual('dateOfBirth').set(function (this: IPatient, value: Date) {
  this.dob = value;
});

// Virtual for upcoming appointments count
patientSchema.virtual('upcomingAppointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'patientId',
  count: true,
  match: {
    status: { $in: ['scheduled', 'confirmed'] },
    scheduledDate: { $gte: new Date() },
    isDeleted: false,
  },
});

// Virtual for last appointment date
patientSchema.virtual('lastAppointmentDate').get(async function (this: IPatient) {
  try {
    const Appointment = mongoose.model('Appointment');
    const lastAppointment = await Appointment.findOne({
      patientId: this._id,
      status: 'completed',
      isDeleted: false,
    })
      .sort({ scheduledDate: -1 })
      .select('scheduledDate');

    return lastAppointment?.scheduledDate;
  } catch (error) {
    return undefined;
  }
});

// Instance methods
patientSchema.methods.getAge = function (this: IPatient): number {
  if (this.dob) {
    const now = new Date();
    const age = now.getFullYear() - this.dob.getFullYear();
    const monthDiff = now.getMonth() - this.dob.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < this.dob.getDate())
    ) {
      return age - 1;
    }
    return age;
  }
  return this.age || 0;
};

patientSchema.methods.getDisplayName = function (this: IPatient): string {
  const names = [this.firstName];
  if (this.otherNames) names.push(this.otherNames);
  names.push(this.lastName);
  return names.join(' ');
};

patientSchema.methods.updateLatestVitals = function (
  this: IPatient,
  vitals: IPatientVitals
): void {
  this.latestVitals = {
    ...vitals,
    recordedAt: new Date(),
  };
};

patientSchema.methods.getInterventionCount = async function (
  this: IPatient
): Promise<number> {
  const ClinicalIntervention = mongoose.model('ClinicalIntervention');
  return await ClinicalIntervention.countDocuments({
    patientId: this._id,
    isDeleted: false,
  });
};

patientSchema.methods.getActiveInterventionCount = async function (
  this: IPatient
): Promise<number> {
  const ClinicalIntervention = mongoose.model('ClinicalIntervention');
  return await ClinicalIntervention.countDocuments({
    patientId: this._id,
    status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] },
    isDeleted: false,
  });
};

patientSchema.methods.updateInterventionFlags = async function (
  this: IPatient
): Promise<void> {
  const activeCount = await this.getActiveInterventionCount();
  this.hasActiveInterventions = activeCount > 0;
  await this.save();
};

patientSchema.methods.getDiagnosticHistoryCount = async function (
  this: IPatient
): Promise<number> {
  const DiagnosticHistory = mongoose.model('DiagnosticHistory');
  return await DiagnosticHistory.countDocuments({
    patientId: this._id,
    status: 'active',
  });
};

patientSchema.methods.getLatestDiagnosticHistory = async function (
  this: IPatient
): Promise<any> {
  const DiagnosticHistory = mongoose.model('DiagnosticHistory');
  return await DiagnosticHistory.findOne({
    patientId: this._id,
    status: 'active',
  })
    .populate('pharmacistId', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// New methods for patient portal fields
patientSchema.methods.addAllergy = function (
  this: IPatient,
  allergyData: any,
  recordedBy?: mongoose.Types.ObjectId
): void {
  const allergy = {
    ...allergyData,
    recordedDate: new Date(),
    recordedBy,
  };
  this.allergies.push(allergy);
};

patientSchema.methods.removeAllergy = function (
  this: IPatient,
  allergyId: string
): boolean {
  const initialLength = this.allergies.length;
  this.allergies = this.allergies.filter(
    allergy => allergy._id?.toString() !== allergyId
  );
  return this.allergies.length < initialLength;
};

patientSchema.methods.updateAllergy = function (
  this: IPatient,
  allergyId: string,
  updates: any
): boolean {
  const allergy = this.allergies.find(
    allergy => allergy._id?.toString() === allergyId
  );
  if (allergy) {
    Object.assign(allergy, updates);
    return true;
  }
  return false;
};

patientSchema.methods.addChronicCondition = function (
  this: IPatient,
  conditionData: any,
  recordedBy?: mongoose.Types.ObjectId
): void {
  const condition = {
    ...conditionData,
    recordedBy,
  };
  this.chronicConditions.push(condition);
};

patientSchema.methods.removeChronicCondition = function (
  this: IPatient,
  conditionId: string
): boolean {
  const initialLength = this.chronicConditions.length;
  this.chronicConditions = this.chronicConditions.filter(
    condition => condition._id?.toString() !== conditionId
  );
  return this.chronicConditions.length < initialLength;
};

patientSchema.methods.updateChronicCondition = function (
  this: IPatient,
  conditionId: string,
  updates: any
): boolean {
  const condition = this.chronicConditions.find(
    condition => condition._id?.toString() === conditionId
  );
  if (condition) {
    Object.assign(condition, updates);
    return true;
  }
  return false;
};

patientSchema.methods.addEmergencyContact = function (
  this: IPatient,
  contactData: any
): void {
  // If this is set as primary, unset other primary contacts
  if (contactData.isPrimary) {
    this.enhancedEmergencyContacts.forEach(contact => {
      contact.isPrimary = false;
    });
  }

  this.enhancedEmergencyContacts.push(contactData);

  // Sort by priority
  this.enhancedEmergencyContacts.sort((a, b) => a.priority - b.priority);
};

patientSchema.methods.removeEmergencyContact = function (
  this: IPatient,
  contactId: string
): boolean {
  const initialLength = this.enhancedEmergencyContacts.length;
  this.enhancedEmergencyContacts = this.enhancedEmergencyContacts.filter(
    contact => contact._id?.toString() !== contactId
  );
  return this.enhancedEmergencyContacts.length < initialLength;
};

patientSchema.methods.updateEmergencyContact = function (
  this: IPatient,
  contactId: string,
  updates: any
): boolean {
  const contact = this.enhancedEmergencyContacts.find(
    contact => contact._id?.toString() === contactId
  );
  if (contact) {
    // If setting as primary, unset other primary contacts
    if (updates.isPrimary) {
      this.enhancedEmergencyContacts.forEach(c => {
        if (c._id?.toString() !== contactId) {
          c.isPrimary = false;
        }
      });
    }

    Object.assign(contact, updates);

    // Re-sort by priority if priority changed
    if (updates.priority !== undefined) {
      this.enhancedEmergencyContacts.sort((a, b) => a.priority - b.priority);
    }

    return true;
  }
  return false;
};

patientSchema.methods.setPrimaryEmergencyContact = function (
  this: IPatient,
  contactId: string
): boolean {
  let found = false;
  this.enhancedEmergencyContacts.forEach(contact => {
    if (contact._id?.toString() === contactId) {
      contact.isPrimary = true;
      found = true;
    } else {
      contact.isPrimary = false;
    }
  });
  return found;
};

patientSchema.methods.updateInsuranceInfo = function (
  this: IPatient,
  insuranceData: any
): void {
  this.insuranceInfo = { ...this.insuranceInfo, ...insuranceData };
};

patientSchema.methods.logVitals = function (
  this: IPatient,
  vitalsData: any
): void {
  const vitals = {
    ...vitalsData,
    recordedDate: new Date(),
    source: 'patient_portal',
    isVerified: false,
  };
  this.patientLoggedVitals.push(vitals);

  // Keep only last 100 vitals entries to prevent unlimited growth
  if (this.patientLoggedVitals.length > 100) {
    this.patientLoggedVitals = this.patientLoggedVitals
      .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
      .slice(0, 100);
  }
};

patientSchema.methods.getVitalsHistory = function (
  this: IPatient,
  limit: number = 20
): any[] {
  return this.patientLoggedVitals
    .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
    .slice(0, limit);
};

patientSchema.methods.getLatestVitals = function (this: IPatient): any {
  if (this.patientLoggedVitals.length === 0) return null;

  return this.patientLoggedVitals
    .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())[0];
};

patientSchema.methods.verifyVitals = function (
  this: IPatient,
  vitalsId: string,
  verifiedBy: mongoose.Types.ObjectId
): boolean {
  const vitals = this.patientLoggedVitals.find(
    vitals => vitals._id?.toString() === vitalsId
  );
  if (vitals) {
    vitals.isVerified = true;
    vitals.verifiedBy = verifiedBy;
    return true;
  }
  return false;
};

patientSchema.methods.unverifyVitals = function (
  this: IPatient,
  vitalsId: string
): boolean {
  const vitals = this.patientLoggedVitals.find(
    vitals => vitals._id?.toString() === vitalsId
  );
  if (vitals) {
    vitals.isVerified = false;
    vitals.verifiedBy = undefined;
    return true;
  }
  return false;
};

patientSchema.methods.getUnverifiedVitals = function (
  this: IPatient
): any[] {
  return this.patientLoggedVitals
    .filter(vitals => !vitals.isVerified)
    .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime());
};

patientSchema.methods.getVerifiedVitals = function (
  this: IPatient,
  limit: number = 20
): any[] {
  return this.patientLoggedVitals
    .filter(vitals => vitals.isVerified)
    .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
    .slice(0, limit);
};

// Pre-save middleware to validate and set computed fields
patientSchema.pre('save', function (this: IPatient) {
  // Ensure either dob or age is provided
  if (!this.dob && !this.age) {
    throw new Error('Either date of birth or age must be provided');
  }

  // Set computed age if dob is provided
  if (this.dob) {
    this.age = this.getAge();
  }

  // Validate emergency contacts - ensure only one primary contact
  const primaryContacts = this.enhancedEmergencyContacts.filter(contact => contact.isPrimary);
  if (primaryContacts.length > 1) {
    throw new Error('Only one emergency contact can be set as primary');
  }

  // Validate emergency contact priorities are unique
  const priorities = this.enhancedEmergencyContacts.map(contact => contact.priority);
  const uniquePriorities = new Set(priorities);
  if (priorities.length !== uniquePriorities.size) {
    throw new Error('Emergency contact priorities must be unique');
  }

  // Validate chronic conditions - ensure diagnosed dates are not in future
  for (const condition of this.chronicConditions) {
    if (condition.diagnosedDate > new Date()) {
      throw new Error('Chronic condition diagnosed date cannot be in the future');
    }
  }

  // Validate vitals data ranges
  for (const vitals of this.patientLoggedVitals) {
    if (vitals.bloodPressure) {
      const { systolic, diastolic } = vitals.bloodPressure;
      if (systolic && diastolic && systolic <= diastolic) {
        throw new Error('Systolic blood pressure must be higher than diastolic');
      }
    }
  }
});

// Static method to generate next MRN
patientSchema.statics.generateNextMRN = async function (
  workplaceId: mongoose.Types.ObjectId,
  workplaceCode: string
): Promise<string> {
  const lastPatient = await this.findOne(
    { workplaceId },
    { mrn: 1 },
    { sort: { createdAt: -1 }, bypassTenancyGuard: true }
  );

  let sequence = 1;
  if (lastPatient?.mrn) {
    const match = lastPatient.mrn.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return generateMRN(workplaceCode, sequence);
};

// Interface for static methods
interface IPatientModel extends mongoose.Model<IPatient> {
  generateNextMRN(workplaceId: mongoose.Types.ObjectId, workplaceCode: string): Promise<string>;
}

const Patient = mongoose.model<IPatient, IPatientModel>('Patient', patientSchema);

export { Patient };
export default Patient;
