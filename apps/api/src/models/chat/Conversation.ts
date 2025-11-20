import mongoose, { Document, Schema } from 'mongoose';

/**
 * Simplified Conversation Model for Communication Module Rebuild
 * 
 * Key simplifications from original:
 * - Removed complex nested permissions (using role-based access instead)
 * - Simplified metadata structure
 * - Removed encryption complexity (handled at service layer)
 * - Cleaner participant structure
 */

export interface IConversationParticipant {
  userId: mongoose.Types.ObjectId;
  role: 'pharmacist' | 'doctor' | 'patient' | 'admin';
  joinedAt: Date;
  leftAt?: Date;
}

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'direct' | 'group' | 'patient_query' | 'prescription_discussion' | 'broadcast';
  title?: string;
  
  // Participants (simplified - no complex permissions)
  participants: IConversationParticipant[];
  
  // Linked entities
  patientId?: mongoose.Types.ObjectId;
  prescriptionId?: mongoose.Types.ObjectId;
  
  // Status and priority
  status: 'active' | 'archived' | 'resolved';
  isPinned: boolean;
  
  // Last message tracking
  lastMessage?: {
    text: string;
    senderId: mongoose.Types.ObjectId;
    timestamp: Date;
  };
  
  // Unread counts per user
  unreadCounts: Map<string, number>;
  
  // Timestamps and tenancy
  createdAt: Date;
  updatedAt: Date;
  workplaceId: mongoose.Types.ObjectId;
  
  // Instance methods
  addParticipant(userId: mongoose.Types.ObjectId, role: string): void;
  removeParticipant(userId: mongoose.Types.ObjectId): void;
  updateLastMessage(text: string, senderId: mongoose.Types.ObjectId): void;
  incrementUnreadCount(excludeUserId?: mongoose.Types.ObjectId): void;
  markAsRead(userId: mongoose.Types.ObjectId): void;
  hasParticipant(userId: mongoose.Types.ObjectId): boolean;
  getParticipantRole(userId: mongoose.Types.ObjectId): string | null;
}

// Participant sub-schema
const conversationParticipantSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['pharmacist', 'doctor', 'patient', 'admin'],
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  leftAt: {
    type: Date,
  },
}, { _id: false });

// Main conversation schema
const conversationSchema = new Schema({
  type: {
    type: String,
    enum: ['direct', 'group', 'patient_query', 'prescription_discussion', 'broadcast'],
    required: true,
    index: true,
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Conversation title cannot exceed 200 characters'],
  },
  participants: {
    type: [conversationParticipantSchema],
    required: true,
    validate: {
      validator: function (participants: IConversationParticipant[]) {
        return participants.length >= 1 && participants.length <= 50;
      },
      message: 'Conversation must have between 1 and 50 participants',
    },
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    index: true,
  },
  prescriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'Prescription',
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'resolved'],
    default: 'active',
    required: true,
    index: true,
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true,
  },
  lastMessage: {
    text: {
      type: String,
      maxlength: [500, 'Last message preview cannot exceed 500 characters'],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    timestamp: {
      type: Date,
    },
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  workplaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workplace',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes for optimal query performance
conversationSchema.index({ workplaceId: 1, 'participants.userId': 1, updatedAt: -1 });
conversationSchema.index({ workplaceId: 1, type: 1, status: 1 });
conversationSchema.index({ patientId: 1, workplaceId: 1 });
conversationSchema.index({ prescriptionId: 1, workplaceId: 1 });
conversationSchema.index({ workplaceId: 1, isPinned: 1, updatedAt: -1 });

// Text index for search
conversationSchema.index({ title: 'text' });

// Virtual for active participants
conversationSchema.virtual('activeParticipants').get(function (this: IConversation) {
  return this.participants.filter(p => !p.leftAt);
});

// Virtual for participant count
conversationSchema.virtual('participantCount').get(function (this: IConversation) {
  return this.participants.filter(p => !p.leftAt).length;
});

// Instance Methods

conversationSchema.methods.addParticipant = function (
  this: IConversation,
  userId: mongoose.Types.ObjectId,
  role: string
): void {
  // Check if participant already exists and is active
  const existingParticipant = this.participants.find(
    p => p.userId.toString() === userId.toString() && !p.leftAt
  );

  if (existingParticipant) {
    throw new Error('User is already a participant in this conversation');
  }

  // Add new participant
  this.participants.push({
    userId,
    role: role as any,
    joinedAt: new Date(),
  });

  // Initialize unread count
  this.unreadCounts.set(userId.toString(), 0);
};

conversationSchema.methods.removeParticipant = function (
  this: IConversation,
  userId: mongoose.Types.ObjectId
): void {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString() && !p.leftAt
  );

  if (!participant) {
    throw new Error('User is not an active participant in this conversation');
  }

  // Mark as left
  participant.leftAt = new Date();

  // Remove from unread counts
  this.unreadCounts.delete(userId.toString());
};

conversationSchema.methods.updateLastMessage = function (
  this: IConversation,
  text: string,
  senderId: mongoose.Types.ObjectId
): void {
  this.lastMessage = {
    text: text.substring(0, 500), // Truncate to 500 chars for preview
    senderId,
    timestamp: new Date(),
  };
  this.updatedAt = new Date();
};

conversationSchema.methods.incrementUnreadCount = function (
  this: IConversation,
  excludeUserId?: mongoose.Types.ObjectId
): void {
  this.participants.forEach(participant => {
    if (!participant.leftAt &&
        (!excludeUserId || participant.userId.toString() !== excludeUserId.toString())) {
      const currentCount = this.unreadCounts.get(participant.userId.toString()) || 0;
      this.unreadCounts.set(participant.userId.toString(), currentCount + 1);
    }
  });
};

conversationSchema.methods.markAsRead = function (
  this: IConversation,
  userId: mongoose.Types.ObjectId
): void {
  this.unreadCounts.set(userId.toString(), 0);
};

conversationSchema.methods.hasParticipant = function (
  this: IConversation,
  userId: mongoose.Types.ObjectId
): boolean {
  return this.participants.some(
    p => p.userId.toString() === userId.toString() && !p.leftAt
  );
};

conversationSchema.methods.getParticipantRole = function (
  this: IConversation,
  userId: mongoose.Types.ObjectId
): string | null {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString() && !p.leftAt
  );
  return participant ? participant.role : null;
};

// Pre-save middleware
conversationSchema.pre('save', function (this: IConversation) {
  // Set default title if not provided
  if (!this.title) {
    switch (this.type) {
      case 'patient_query':
        this.title = 'Patient Query';
        break;
      case 'prescription_discussion':
        this.title = 'Prescription Discussion';
        break;
      case 'direct':
        this.title = 'Direct Message';
        break;
      case 'group':
        this.title = 'Group Discussion';
        break;
      case 'broadcast':
        this.title = 'Announcement';
        break;
    }
  }

  // Validate patient ID for patient_query and prescription_discussion
  if (['patient_query', 'prescription_discussion'].includes(this.type) && !this.patientId) {
    throw new Error(`Patient ID is required for ${this.type} conversations`);
  }

  // Validate prescription ID for prescription_discussion
  if (this.type === 'prescription_discussion' && !this.prescriptionId) {
    throw new Error('Prescription ID is required for prescription discussion conversations');
  }
});

// Static methods
conversationSchema.statics.findByParticipant = function (
  userId: mongoose.Types.ObjectId,
  workplaceId: mongoose.Types.ObjectId,
  filters: any = {}
) {
  const query: any = {
    workplaceId,
    'participants.userId': userId,
    'participants.leftAt': { $exists: false },
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.isPinned !== undefined) {
    query.isPinned = filters.isPinned;
  }

  return this.find(query)
    .populate('participants.userId', 'firstName lastName role email')
    .populate('patientId', 'firstName lastName mrn')
    .populate('prescriptionId', 'medicationName')
    .sort({ isPinned: -1, updatedAt: -1 });
};

conversationSchema.statics.findByPatient = function (
  patientId: mongoose.Types.ObjectId,
  workplaceId: mongoose.Types.ObjectId
) {
  return this.find({
    workplaceId,
    patientId,
    status: { $ne: 'archived' },
  })
    .populate('participants.userId', 'firstName lastName role')
    .sort({ updatedAt: -1 });
};

export default mongoose.model<IConversation>('ChatConversation', conversationSchema);
