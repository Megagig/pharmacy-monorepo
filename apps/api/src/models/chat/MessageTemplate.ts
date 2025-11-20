import mongoose, { Document, Schema } from 'mongoose';

/**
 * MessageTemplate Model
 * 
 * Quick message templates for pharmacists to use in conversations
 */

export interface IMessageTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: 'medication_instructions' | 'follow_up' | 'side_effects' | 'general';
  variables: string[]; // e.g., ['patientName', 'medicationName', 'dosage']
  
  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;
  
  // Permissions
  workplaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isGlobal: boolean; // Available to all workplaces
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  incrementUsage(): Promise<this>;
  renderTemplate(variables: Record<string, string>): string;
}

export interface IMessageTemplateModel extends mongoose.Model<IMessageTemplate> {
  findByCategory(category: string, workplaceId: string): Promise<IMessageTemplate[]>;
  searchTemplates(searchTerm: string, workplaceId: string): Promise<IMessageTemplate[]>;
}

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: ['medication_instructions', 'follow_up', 'side_effects', 'general'],
      required: true,
      index: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    usageCount: {
      type: Number,
      default: 0,
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
MessageTemplateSchema.index({ workplaceId: 1, category: 1 });
MessageTemplateSchema.index({ workplaceId: 1, isGlobal: 1 });
MessageTemplateSchema.index({ category: 1, usageCount: -1 });

// Text search index
MessageTemplateSchema.index({ title: 'text', content: 'text' });

// Instance methods
MessageTemplateSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

MessageTemplateSchema.methods.renderTemplate = function (variables: Record<string, string>): string {
  let rendered = this.content;
  
  // Replace variables in format {{variableName}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value);
  }
  
  return rendered;
};

// Static methods
MessageTemplateSchema.statics.findByCategory = function (
  category: string,
  workplaceId: string
) {
  return this.find({
    $or: [
      { workplaceId: new mongoose.Types.ObjectId(workplaceId), category },
      { isGlobal: true, category },
    ],
  }).sort({ usageCount: -1, title: 1 });
};

MessageTemplateSchema.statics.searchTemplates = function (
  searchTerm: string,
  workplaceId: string
) {
  return this.find({
    $and: [
      {
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
          { isGlobal: true },
        ],
      },
      {
        $text: { $search: searchTerm },
      },
    ],
  }).sort({ score: { $meta: 'textScore' } });
};

export const MessageTemplate = mongoose.model<IMessageTemplate, IMessageTemplateModel>(
  'MessageTemplate',
  MessageTemplateSchema
);

export default MessageTemplate;
