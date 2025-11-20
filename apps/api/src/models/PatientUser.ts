import mongoose, { Document, Schema } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IPatientUser extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId; // ref: Workplace

  // Authentication fields
  email: string;
  phone?: string;
  passwordHash: string;

  // Profile information
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;

  // Account status
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;

  // Verification tokens
  verificationToken?: string;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  resetToken?: string;
  resetTokenExpires?: Date;

  // Security
  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;

  // Patient association
  patientId?: mongoose.Types.ObjectId; // ref: Patient - linked patient record

  // Notification preferences
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
    appointmentReminders: boolean;
    medicationReminders: boolean;
    healthTips: boolean;
  };

  // Profile settings
  language: string; // 'en', 'yo', 'ig', 'ha'
  timezone: string;
  avatar?: string;

  // Privacy settings
  profileVisibility: 'private' | 'limited' | 'public';
  dataSharing: boolean;

  // Onboarding
  onboardingCompleted: boolean;

  // Session management
  refreshTokens: Array<{
    token: string;
    createdAt: Date;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
  }>;

  // Audit fields (added by addAuditFields)
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(password: string): Promise<boolean>;
  generateVerificationToken(): string;
  generateVerificationCode(): string;
  generateResetToken(): string;
  isLocked(): boolean;
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
}

const patientUserSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },

    // Authentication fields
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      index: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    phone: {
      type: String,
      index: true,
      sparse: true,
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },

    // Profile information
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          return !value || value <= new Date();
        },
        message: 'Date of birth cannot be in the future',
      },
    },

    // Account status
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'inactive'],
      default: 'pending',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },

    // Verification tokens
    verificationToken: {
      type: String,
      index: true,
      sparse: true,
    },
    verificationCode: {
      type: String,
      index: true,
      sparse: true,
    },
    verificationCodeExpires: {
      type: Date,
    },
    resetToken: {
      type: String,
      index: true,
      sparse: true,
    },
    resetTokenExpires: {
      type: Date,
    },

    // Security
    lastLoginAt: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },

    // Patient association
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
      sparse: true,
    },

    // Notification preferences
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      appointmentReminders: { type: Boolean, default: true },
      medicationReminders: { type: Boolean, default: true },
      healthTips: { type: Boolean, default: false },
    },

    // Profile settings
    language: {
      type: String,
      enum: ['en', 'yo', 'ig', 'ha'],
      default: 'en',
    },
    timezone: {
      type: String,
      default: 'Africa/Lagos',
    },
    avatar: {
      type: String,
    },

    // Privacy settings
    profileVisibility: {
      type: String,
      enum: ['private', 'limited', 'public'],
      default: 'private',
    },
    dataSharing: {
      type: Boolean,
      default: false,
    },

    // Onboarding
    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Session management
    refreshTokens: [{
      token: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      deviceInfo: String,
      ipAddress: String,
    }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.passwordHash;
        delete ret.verificationToken;
        delete ret.verificationCode;
        delete ret.resetToken;
        delete ret.refreshTokens;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes
patientUserSchema.index({ workplaceId: 1, email: 1 }, { unique: true });
patientUserSchema.index({ workplaceId: 1, phone: 1 }, { sparse: true });
patientUserSchema.index({ workplaceId: 1, status: 1 });
patientUserSchema.index({ verificationToken: 1 }, { sparse: true });
patientUserSchema.index({ resetToken: 1 }, { sparse: true });
patientUserSchema.index({ lockUntil: 1 }, { sparse: true });

// Virtual for full name
patientUserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
patientUserSchema.virtual('isAccountLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save middleware to hash password
patientUserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
patientUserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

patientUserSchema.methods.generateVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = token;
  return token;
};

patientUserSchema.methods.generateVerificationCode = function (): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  this.verificationCode = code;
  this.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return code;
};

patientUserSchema.methods.generateResetToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetToken = token;
  this.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return token;
};

patientUserSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

patientUserSchema.methods.incLoginAttempts = async function (): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) }; // 2 hours
  }

  return this.updateOne(updates);
};

patientUserSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Post-save middleware to create/sync Patient record
patientUserSchema.post('save', async function (doc) {
  // Check if PatientUser just became active (approved)
  if (doc.status === 'active' && doc.isActive) {
    try {
      // Import PatientSyncService dynamically to avoid circular dependencies
      const { PatientSyncService } = await import('../services/patientSyncService');
      
      // If no linked Patient record exists, create one
      if (!doc.patientId) {
        console.log(`Creating Patient record for newly approved PatientUser: ${doc._id}`);
        const { patient, isNewRecord } = await PatientSyncService.createOrLinkPatientRecord(doc._id.toString());
        console.log(`${isNewRecord ? 'Created new' : 'Linked existing'} Patient record ${patient._id} for PatientUser ${doc._id}`);
      } else {
        // If linked Patient record exists, sync the changes
        await PatientSyncService.syncPatientUserToPatient(doc);
      }
    } catch (error) {
      console.error('Error creating/syncing PatientUser to Patient record:', error);
      // Don't throw error to avoid breaking PatientUser operations
    }
  }
});

// Apply plugins
patientUserSchema.plugin(tenancyGuardPlugin);
addAuditFields(patientUserSchema);

const PatientUser = mongoose.model<IPatientUser>('PatientUser', patientUserSchema);

export default PatientUser;