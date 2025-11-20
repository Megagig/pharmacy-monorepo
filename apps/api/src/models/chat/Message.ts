import mongoose, { Document, Schema } from 'mongoose';

/**
 * Simplified Message Model for Communication Module Rebuild
 * 
 * Key simplifications from original:
 * - Removed complex encryption metadata (handled at service layer)
 * - Simplified reaction structure
 * - Cleaner edit history
 * - Removed excessive validation complexity
 */

export interface IMessageContent {
  text?: string;
  type: 'text' | 'file' | 'image' | 'system';
}

export interface IMessageReaction {
  emoji: string;
  userIds: mongoose.Types.ObjectId[];
}

export interface IMessageReadReceipt {
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IMessageFlag {
  reportedBy: mongoose.Types.ObjectId;
  reportedAt: Date;
  reason: 'inappropriate' | 'spam' | 'harassment' | 'privacy_violation' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  
  // Content
  content: IMessageContent;
  
  // Threading
  threadId?: mongoose.Types.ObjectId;
  parentMessageId?: mongoose.Types.ObjectId;
  
  // Interactions
  reactions: IMessageReaction[];
  mentions: mongoose.Types.ObjectId[];
  
  // Status
  status: 'sent' | 'delivered' | 'read';
  readBy: IMessageReadReceipt[];
  
  // Edit tracking (simplified)
  isEdited: boolean;
  editedAt?: Date;
  
  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  
  // Moderation
  flags: IMessageFlag[];
  isFlagged: boolean;
  
  // Timestamps and tenancy
  createdAt: Date;
  updatedAt: Date;
  workplaceId: mongoose.Types.ObjectId;
  
  // Instance methods
  addReaction(userId: mongoose.Types.ObjectId, emoji: string): void;
  removeReaction(userId: mongoose.Types.ObjectId, emoji: string): void;
  markAsRead(userId: mongoose.Types.ObjectId): void;
  isReadBy(userId: mongoose.Types.ObjectId): boolean;
  edit(newContent: string): void;
  softDelete(): void;
  addFlag(reportedBy: mongoose.Types.ObjectId, reason: string, description?: string): void;
  dismissFlag(flagId: string, reviewedBy: mongoose.Types.ObjectId, reviewNotes?: string): void;
}

// Message content sub-schema
const messageContentSchema = new Schema({
  text: {
    type: String,
    trim: true,
    maxlength: [10000, 'Message content cannot exceed 10,000 characters'],
  },
  type: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    required: true,
  },
}, { _id: false });

// Reaction sub-schema (simplified - group by emoji)
const messageReactionSchema = new Schema({
  emoji: {
    type: String,
    required: true,
    validate: {
      validator: function (emoji: string) {
        const allowedEmojis = [
          '👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔',
          '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊'
        ];
        return allowedEmojis.includes(emoji);
      },
      message: 'Invalid emoji for healthcare communication',
    },
  },
  userIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { _id: false });

// Read receipt sub-schema
const messageReadReceiptSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  readAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
}, { _id: false });

// Flag sub-schema for moderation
const messageFlagSchema = new Schema({
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reportedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  reason: {
    type: String,
    enum: ['inappropriate', 'spam', 'harassment', 'privacy_violation', 'other'],
    required: true,
  },
  description: {
    type: String,
    maxlength: [500, 'Flag description cannot exceed 500 characters'],
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed'],
    default: 'pending',
    required: true,
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  reviewNotes: {
    type: String,
    maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
  },
}, { _id: true });

// Main message schema
const messageSchema = new Schema({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatConversation',
    required: true,
    index: true,
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: messageContentSchema,
    required: true,
  },
  threadId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatMessage',
    index: true,
  },
  parentMessageId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatMessage',
    index: true,
  },
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  reactions: {
    type: [messageReactionSchema],
    default: [],
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
    required: true,
  },
  readBy: {
    type: [messageReadReceiptSchema],
    default: [],
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
  },
  flags: {
    type: [messageFlagSchema],
    default: [],
  },
  isFlagged: {
    type: Boolean,
    default: false,
    index: true,
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
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, threadId: 1, createdAt: 1 });
messageSchema.index({ workplaceId: 1, createdAt: -1 });
messageSchema.index({ mentions: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
messageSchema.index({ isFlagged: 1, 'flags.status': 1, createdAt: -1 });

// Text index for search
messageSchema.index({ 'content.text': 'text' });

// Virtual for reply count (for threaded messages)
messageSchema.virtual('replyCount', {
  ref: 'ChatMessage',
  localField: '_id',
  foreignField: 'parentMessageId',
  count: true,
});

// Virtual for read count
messageSchema.virtual('readCount').get(function (this: IMessage) {
  return this.readBy?.length || 0;
});

// Virtual for total reactions
messageSchema.virtual('totalReactions').get(function (this: IMessage) {
  return this.reactions.reduce((sum, reaction) => sum + reaction.userIds.length, 0);
});

// Instance Methods

messageSchema.methods.addReaction = function (
  this: IMessage,
  userId: mongoose.Types.ObjectId,
  emoji: string
): void {
  // Find existing reaction for this emoji
  const existingReaction = this.reactions.find(r => r.emoji === emoji);

  if (existingReaction) {
    // Check if user already reacted with this emoji
    const userIdStr = userId.toString();
    const hasReacted = existingReaction.userIds.some(
      id => id.toString() === userIdStr
    );

    if (!hasReacted) {
      existingReaction.userIds.push(userId);
    }
  } else {
    // Create new reaction
    this.reactions.push({
      emoji,
      userIds: [userId],
    });
  }
};

messageSchema.methods.removeReaction = function (
  this: IMessage,
  userId: mongoose.Types.ObjectId,
  emoji: string
): void {
  const reaction = this.reactions.find(r => r.emoji === emoji);

  if (reaction) {
    const userIdStr = userId.toString();
    reaction.userIds = reaction.userIds.filter(
      id => id.toString() !== userIdStr
    );

    // Remove reaction if no users left
    if (reaction.userIds.length === 0) {
      this.reactions = this.reactions.filter(r => r.emoji !== emoji);
    }
  }
};

messageSchema.methods.markAsRead = function (
  this: IMessage,
  userId: mongoose.Types.ObjectId
): void {
  // Check if already read by this user
  const alreadyRead = this.readBy.some(
    r => r.userId.toString() === userId.toString()
  );

  if (!alreadyRead) {
    this.readBy.push({
      userId,
      readAt: new Date(),
    });

    // Update status
    if (this.status === 'sent') {
      this.status = 'delivered';
    }
    if (this.status === 'delivered') {
      this.status = 'read';
    }
  }
};

messageSchema.methods.isReadBy = function (
  this: IMessage,
  userId: mongoose.Types.ObjectId
): boolean {
  return this.readBy.some(r => r.userId.toString() === userId.toString());
};

messageSchema.methods.edit = function (
  this: IMessage,
  newContent: string
): void {
  // Check if edit is within 15-minute window
  const fifteenMinutes = 15 * 60 * 1000;
  const timeSinceCreation = Date.now() - this.createdAt.getTime();

  if (timeSinceCreation > fifteenMinutes) {
    throw new Error('Cannot edit message after 15 minutes');
  }

  if (this.isDeleted) {
    throw new Error('Cannot edit deleted message');
  }

  this.content.text = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
};

messageSchema.methods.softDelete = function (this: IMessage): void {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content.text = 'This message was deleted';
};

messageSchema.methods.addFlag = function (
  this: IMessage,
  reportedBy: mongoose.Types.ObjectId,
  reason: string,
  description?: string
): void {
  // Check if user already flagged this message
  const alreadyFlagged = this.flags.some(
    flag => flag.reportedBy.toString() === reportedBy.toString() && flag.status === 'pending'
  );

  if (alreadyFlagged) {
    throw new Error('You have already flagged this message');
  }

  // Validate reason
  const validReasons = ['inappropriate', 'spam', 'harassment', 'privacy_violation', 'other'];
  if (!validReasons.includes(reason)) {
    throw new Error('Invalid flag reason');
  }

  // Add flag
  this.flags.push({
    reportedBy,
    reportedAt: new Date(),
    reason: reason as any,
    description,
    status: 'pending',
  } as any);

  this.isFlagged = true;
};

messageSchema.methods.dismissFlag = function (
  this: IMessage,
  flagId: string,
  reviewedBy: mongoose.Types.ObjectId,
  reviewNotes?: string
): void {
  const flag = this.flags.find((f: any) => f._id.toString() === flagId);

  if (!flag) {
    throw new Error('Flag not found');
  }

  if (flag.status !== 'pending') {
    throw new Error('Flag has already been reviewed');
  }

  flag.status = 'dismissed';
  flag.reviewedBy = reviewedBy;
  flag.reviewedAt = new Date();
  flag.reviewNotes = reviewNotes;

  // Check if there are any pending flags left
  const hasPendingFlags = this.flags.some(f => f.status === 'pending');
  if (!hasPendingFlags) {
    this.isFlagged = false;
  }
};

// Pre-save middleware
messageSchema.pre('save', function (this: IMessage) {
  // Validate text content for text messages
  if (this.content.type === 'text' && !this.content.text) {
    throw new Error('Text content is required for text messages');
  }

  // Validate system messages
  if (this.content.type === 'system' && !this.content.text) {
    throw new Error('System messages must have text content');
  }
});

// Post-save middleware to update conversation
messageSchema.post('save', async function (this: IMessage) {
  if (this.isNew && !this.isDeleted) {
    try {
      const ChatConversation = mongoose.model('ChatConversation');
      const conversation = await ChatConversation.findById(this.conversationId);

      if (conversation) {
        // Update last message
        const messageText = this.content.text || '[File]';
        conversation.updateLastMessage(messageText, this.senderId);

        // Increment unread count for other participants
        conversation.incrementUnreadCount(this.senderId);

        await conversation.save();
      }
    } catch (error) {
      console.error('Error updating conversation after message save:', error);
    }
  }
});

// Static methods
messageSchema.statics.findByConversation = function (
  conversationId: mongoose.Types.ObjectId,
  options: any = {}
) {
  const { limit = 50, before, after, threadId } = options;

  const query: any = {
    conversationId,
    isDeleted: false,
  };

  if (threadId) {
    query.threadId = threadId;
  }

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  if (after) {
    query.createdAt = { ...query.createdAt, $gt: new Date(after) };
  }

  return this.find(query)
    .populate('senderId', 'firstName lastName role email')
    .populate('mentions', 'firstName lastName role')
    .populate('readBy.userId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

messageSchema.statics.searchMessages = function (
  workplaceId: mongoose.Types.ObjectId,
  searchQuery: string,
  options: any = {}
) {
  const { conversationId, senderId, limit = 50 } = options;

  const query: any = {
    workplaceId,
    isDeleted: false,
    $text: { $search: searchQuery },
  };

  if (conversationId) {
    query.conversationId = conversationId;
  }

  if (senderId) {
    query.senderId = senderId;
  }

  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('senderId', 'firstName lastName role')
    .populate('conversationId', 'title type')
    .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
    .limit(limit);
};

messageSchema.statics.findThreadMessages = function (
  threadId: mongoose.Types.ObjectId,
  options: any = {}
) {
  const { limit = 100 } = options;

  return this.find({
    threadId,
    isDeleted: false,
  })
    .populate('senderId', 'firstName lastName role')
    .populate('mentions', 'firstName lastName role')
    .sort({ createdAt: 1 }) // Chronological order for threads
    .limit(limit);
};

export default mongoose.model<IMessage>('ChatMessage', messageSchema);
