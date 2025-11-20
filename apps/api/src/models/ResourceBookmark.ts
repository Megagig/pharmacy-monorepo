import mongoose, { Schema, Document } from 'mongoose';

export interface IResourceBookmark extends Document {
  _id: mongoose.Types.ObjectId;
  patientUserId: mongoose.Types.ObjectId;
  resourceId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const resourceBookmarkSchema = new Schema<IResourceBookmark>(
  {
    patientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'PatientUser',
      required: true,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'EducationalResource',
      required: true,
      index: true,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one bookmark per patient per resource
resourceBookmarkSchema.index({ patientUserId: 1, resourceId: 1 }, { unique: true });

// Compound index for efficient queries
resourceBookmarkSchema.index({ patientUserId: 1, workplaceId: 1, createdAt: -1 });

const ResourceBookmark = mongoose.model<IResourceBookmark>('ResourceBookmark', resourceBookmarkSchema);

export default ResourceBookmark;
