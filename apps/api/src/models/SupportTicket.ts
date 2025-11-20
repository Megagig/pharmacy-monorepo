import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportTicket extends Document {
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'general';
  
  // User information
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  workspaceId?: mongoose.Types.ObjectId;
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  
  // Resolution tracking
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolutionNotes?: string;
  customerSatisfactionRating?: number; // 1-5 scale
  
  // Escalation
  escalatedAt?: Date;
  escalatedBy?: mongoose.Types.ObjectId;
  escalationReason?: string;
  
  // Metadata
  tags: string[];
  attachments: {
    filename: string;
    url: string;
    uploadedAt: Date;
    uploadedBy: mongoose.Types.ObjectId;
  }[];
  
  // Tracking
  firstResponseAt?: Date;
  lastResponseAt?: Date;
  responseCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'],
      default: 'open',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general'],
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
      index: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
      maxlength: 2000,
    },
    customerSatisfactionRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    escalatedAt: {
      type: Date,
    },
    escalatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    escalationReason: {
      type: String,
      maxlength: 500,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    attachments: [{
      filename: {
        type: String,
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
    }],
    firstResponseAt: {
      type: Date,
    },
    lastResponseAt: {
      type: Date,
    },
    responseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'supporttickets',
  }
);

// Indexes for efficient queries
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ userId: 1, status: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ resolvedAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ workspaceId: 1, status: 1 });

// Text search index for title and description
supportTicketSchema.index({ 
  title: 'text', 
  description: 'text',
  tags: 'text'
});

// Pre-validate middleware to ensure ticketNumber is set
supportTicketSchema.pre('validate', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    try {
      // Generate a simple timestamp-based ticket number as fallback
      const timestamp = Date.now().toString().slice(-6);
      this.ticketNumber = `TKT-${timestamp}`;
      console.log('Generated fallback ticket number in pre-validate:', this.ticketNumber);
    } catch (error) {
      console.error('Error in pre-validate middleware:', error);
    }
  }
  next();
});

// Methods
supportTicketSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Calculate response time in hours
supportTicketSchema.methods.getResponseTime = function (): number | null {
  if (!this.firstResponseAt) return null;
  return Math.round((this.firstResponseAt.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
};

// Calculate resolution time in hours
supportTicketSchema.methods.getResolutionTime = function (): number | null {
  if (!this.resolvedAt) return null;
  return Math.round((this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
};

// Check if ticket is overdue (based on priority)
supportTicketSchema.methods.isOverdue = function (): boolean {
  if (this.status === 'resolved' || this.status === 'closed') return false;
  
  const now = new Date();
  const hoursOpen = (now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60);
  
  const slaHours = {
    critical: 4,
    high: 24,
    medium: 72,
    low: 168
  };
  
  return hoursOpen > slaHours[this.priority];
};

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);