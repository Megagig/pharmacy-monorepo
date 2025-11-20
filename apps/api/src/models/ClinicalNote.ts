import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment {
  _id?: mongoose.Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
}

export interface ILabResult {
  test: string;
  result: string;
  normalRange: string;
  date: Date;
  status: 'normal' | 'abnormal' | 'critical';
}

export interface IVitalSigns {
  bloodPressure?: {
    systolic?: number;
    diastolic?: number;
  };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  recordedAt?: Date;
}

export interface IClinicalNote extends Document {
  patient: mongoose.Types.ObjectId;
  pharmacist: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  locationId?: string;
  customId?: string; // Custom ID for external integrations
  legacyId?: string; // Legacy ID for backward compatibility
  type:
  | 'consultation'
  | 'medication_review'
  | 'follow_up'
  | 'adverse_event'
  | 'other';
  title: string;
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  medications: mongoose.Types.ObjectId[];
  vitalSigns?: IVitalSigns;
  laborResults: ILabResult[];
  recommendations: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  attachments: IAttachment[];
  priority: 'low' | 'medium' | 'high';
  isConfidential: boolean;
  tags: string[];

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  lastModifiedBy: mongoose.Types.ObjectId;

  // Soft deletion fields
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
}

export interface IClinicalNoteModel extends mongoose.Model<IClinicalNote> {
  findActive(filter?: any): mongoose.Query<IClinicalNote[], IClinicalNote>;
  findDeleted(filter?: any): mongoose.Query<IClinicalNote[], IClinicalNote>;
}

const attachmentSchema = new Schema({
  fileName: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

const labResultSchema = new Schema({
  test: {
    type: String,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
  normalRange: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['normal', 'abnormal', 'critical'],
    default: 'normal',
  },
});

const vitalSignsSchema = new Schema({
  bloodPressure: {
    systolic: Number,
    diastolic: Number,
  },
  heartRate: Number,
  temperature: Number,
  weight: Number,
  height: Number,
  recordedAt: {
    type: Date,
    default: Date.now,
  },
});

const clinicalNoteSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    pharmacist: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    locationId: {
      type: String,
      index: true,
      sparse: true,
    },
    type: {
      type: String,
      enum: [
        'consultation',
        'medication_review',
        'follow_up',
        'adverse_event',
        'other',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      index: 'text', // Enable text search
    },
    content: {
      subjective: {
        type: String,
        index: 'text',
      },
      objective: {
        type: String,
        index: 'text',
      },
      assessment: {
        type: String,
        index: 'text',
      },
      plan: {
        type: String,
        index: 'text',
      },
    },
    medications: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Medication',
      },
    ],
    vitalSigns: vitalSignsSchema,
    laborResults: [labResultSchema],
    recommendations: {
      type: [String],
      index: 'text',
    },
    followUpRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    followUpDate: {
      type: Date,
      index: true,
    },
    attachments: [attachmentSchema],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    isConfidential: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      index: true,
    },

    // Audit fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Soft deletion fields
    deletedAt: {
      type: Date,
      index: true,
      sparse: true,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
  },
  {
    timestamps: true,
    // Enable text search across multiple fields
    indexes: [
      {
        title: 'text',
        'content.subjective': 'text',
        'content.objective': 'text',
        'content.assessment': 'text',
        'content.plan': 'text',
        recommendations: 'text',
        tags: 'text',
      },
    ],
  }
);

// Compound indexes for efficient querying
clinicalNoteSchema.index({ workplaceId: 1, patient: 1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, pharmacist: 1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, type: 1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, priority: 1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, isConfidential: 1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, followUpRequired: 1, deletedAt: 1 });
clinicalNoteSchema.index(
  { workplaceId: 1, locationId: 1, deletedAt: 1 },
  { sparse: true }
);
clinicalNoteSchema.index({ workplaceId: 1, createdAt: -1, deletedAt: 1 });
clinicalNoteSchema.index({ workplaceId: 1, updatedAt: -1, deletedAt: 1 });

// Additional indexes for search and filtering
clinicalNoteSchema.index({ workplaceId: 1, tags: 1, deletedAt: 1 });
clinicalNoteSchema.index({
  workplaceId: 1,
  'laborResults.status': 1,
  deletedAt: 1,
});

// Pre-save middleware to set audit fields
clinicalNoteSchema.pre('save', function (next) {
  if (this.isNew) {
    this.createdBy = this.createdBy || this.pharmacist;
    this.lastModifiedBy = this.lastModifiedBy || this.pharmacist;
  } else {
    this.lastModifiedBy = this.lastModifiedBy || this.pharmacist;
  }
  next();
});

// Pre-update middleware to set lastModifiedBy
clinicalNoteSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate() as any;
  if (update && !update.lastModifiedBy) {
    update.lastModifiedBy = update.pharmacist;
    update.updatedAt = new Date();
  }
  next();
});

// Virtual for checking if note is deleted
clinicalNoteSchema.virtual('isDeleted').get(function () {
  return !!this.deletedAt;
});

// Method to soft delete
clinicalNoteSchema.methods.softDelete = function (
  deletedBy: mongoose.Types.ObjectId
) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.lastModifiedBy = deletedBy;
  return this.save();
};

// Method to restore soft deleted note
clinicalNoteSchema.methods.restore = function (
  restoredBy: mongoose.Types.ObjectId
) {
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.lastModifiedBy = restoredBy;
  return this.save();
};

// Static method to find non-deleted notes
clinicalNoteSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, deletedAt: { $exists: false } });
};

// Static method to find deleted notes
clinicalNoteSchema.statics.findDeleted = function (filter = {}) {
  return this.find({ ...filter, deletedAt: { $exists: true } });
};

export default mongoose.model<IClinicalNote, IClinicalNoteModel>(
  'ClinicalNote',
  clinicalNoteSchema
);
