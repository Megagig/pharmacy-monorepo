import mongoose, { Document, Schema } from 'mongoose';

export interface IVitalsVerification extends Document {
  patientId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  source: 'patient' | 'pharmacist';
  entryId: string; // ID referencing the source entry (assessmentId or patientLoggedVitals._id)
  verified: boolean;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vitalsVerificationSchema = new Schema<IVitalsVerification>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    workplaceId: { type: Schema.Types.ObjectId, ref: 'Workplace', required: true, index: true },
    source: { type: String, enum: ['patient', 'pharmacist'], required: true },
    entryId: { type: String, required: true, index: true },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

vitalsVerificationSchema.index({ patientId: 1, workplaceId: 1, entryId: 1 }, { unique: true });

export default mongoose.model<IVitalsVerification>('VitalsVerification', vitalsVerificationSchema);
