import mongoose, { Document, Schema } from 'mongoose';

export interface IMedicationReminderSettings {
    enabled: boolean;
    defaultReminderTimes: string[];
    reminderMethod: 'email' | 'sms' | 'both';
    defaultNotificationLeadTime: number;
    customMessage?: string;
    repeatReminders?: boolean;
    repeatInterval?: number; // minutes
    smartReminders?: boolean;
    allowSnooze?: boolean;
    snoozeOptions?: number[]; // minutes
    notifyCaregiver?: boolean;
    caregiverContact?: string;
}

export interface IMedicationMonitoringSettings {
    adherenceMonitoring: boolean;
    refillReminders: boolean;
    interactionChecking: boolean;
    refillThreshold?: number; // percentage
    missedDoseThreshold?: number; // consecutive missed doses
    adherenceReporting?: boolean;
    reportFrequency?: 'daily' | 'weekly' | 'monthly';
    alertOnLowAdherence?: boolean;
    lowAdherenceThreshold?: number; // percentage
    stockoutPrediction?: boolean;
}

export interface IMedicationSettings extends Document {
    patientId: mongoose.Types.ObjectId | string; // Allow both ObjectId and string (for "system")
    workplaceId: mongoose.Types.ObjectId;
    reminderSettings: IMedicationReminderSettings;
    monitoringSettings: IMedicationMonitoringSettings;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
}

const MedicationReminderSettingsSchema = new Schema<IMedicationReminderSettings>({
    enabled: { type: Boolean, default: false },
    defaultReminderTimes: { type: [String], default: ['09:00', '13:00', '19:00'] },
    reminderMethod: {
        type: String,
        enum: ['email', 'sms', 'both'],
        default: 'email'
    },
    defaultNotificationLeadTime: { type: Number, default: 15 },
    customMessage: { type: String, default: 'Time to take your medication!' },
    repeatReminders: { type: Boolean, default: false },
    repeatInterval: { type: Number, default: 30 },
    smartReminders: { type: Boolean, default: false },
    allowSnooze: { type: Boolean, default: true },
    snoozeOptions: { type: [Number], default: [5, 10, 15, 30] },
    notifyCaregiver: { type: Boolean, default: false },
    caregiverContact: { type: String, default: '' }
});

const MedicationMonitoringSettingsSchema = new Schema<IMedicationMonitoringSettings>({
    adherenceMonitoring: { type: Boolean, default: true },
    refillReminders: { type: Boolean, default: true },
    interactionChecking: { type: Boolean, default: true },
    refillThreshold: { type: Number, default: 20 },
    missedDoseThreshold: { type: Number, default: 2 },
    adherenceReporting: { type: Boolean, default: true },
    reportFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly'
    },
    alertOnLowAdherence: { type: Boolean, default: true },
    lowAdherenceThreshold: { type: Number, default: 70 },
    stockoutPrediction: { type: Boolean, default: true }
});

const MedicationSettingsSchema = new Schema<IMedicationSettings>({
    patientId: {
        type: Schema.Types.Mixed, // Allow both ObjectId and string (for "system")
        required: true,
        index: true
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    reminderSettings: {
        type: MedicationReminderSettingsSchema,
        default: () => ({})
    },
    monitoringSettings: {
        type: MedicationMonitoringSettingsSchema,
        default: () => ({})
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true,
    collection: 'medicationsettings'
});

// Compound index for efficient queries
MedicationSettingsSchema.index({ patientId: 1, workplaceId: 1 }, { unique: true });

// Pre-save middleware to set default values
MedicationSettingsSchema.pre('save', function (next) {
    if (this.isNew) {
        if (!this.reminderSettings) {
            this.reminderSettings = {} as IMedicationReminderSettings;
        }
        if (!this.monitoringSettings) {
            this.monitoringSettings = {} as IMedicationMonitoringSettings;
        }
    }
    next();
});

export default mongoose.model<IMedicationSettings>('MedicationSettings', MedicationSettingsSchema);