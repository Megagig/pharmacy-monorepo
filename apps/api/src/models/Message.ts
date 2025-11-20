import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IMessageAttachment {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    secureUrl: string;
    thumbnailUrl?: string;
    uploadedAt: Date;
}

export interface IMessageContent {
    text?: string; // Encrypted content
    type: 'text' | 'file' | 'image' | 'clinical_note' | 'system' | 'voice_note';
    attachments?: IMessageAttachment[];
    metadata?: {
        originalText?: string; // For system messages
        clinicalData?: {
            patientId?: mongoose.Types.ObjectId;
            interventionId?: mongoose.Types.ObjectId;
            medicationId?: mongoose.Types.ObjectId;
        };
        systemAction?: {
            action: string;
            performedBy: mongoose.Types.ObjectId;
            timestamp: Date;
        };
    };
}

export interface IMessageReaction {
    userId: mongoose.Types.ObjectId;
    emoji: string;
    createdAt: Date;
}

export interface IMessageReadReceipt {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
}

export interface IMessageEditHistory {
    content: string;
    editedAt: Date;
    editedBy: mongoose.Types.ObjectId;
    reason?: string;
}

export interface IMessage extends Document {
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    content: IMessageContent;
    threadId?: mongoose.Types.ObjectId;
    parentMessageId?: mongoose.Types.ObjectId;
    mentions: mongoose.Types.ObjectId[];
    reactions: IMessageReaction[];
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    priority: 'normal' | 'high' | 'urgent';
    readBy: IMessageReadReceipt[];
    editHistory: IMessageEditHistory[];

    // Encryption metadata
    isEncrypted: boolean;
    encryptionKeyId?: string;

    // Soft delete fields
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: mongoose.Types.ObjectId;

    // Audit fields
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    addReaction(userId: mongoose.Types.ObjectId, emoji: string): void;
    removeReaction(userId: mongoose.Types.ObjectId, emoji: string): void;
    markAsRead(userId: mongoose.Types.ObjectId): void;
    isReadBy(userId: mongoose.Types.ObjectId): boolean;
    addEdit(content: string, editedBy: mongoose.Types.ObjectId, reason?: string): void;
    getMentionedUsers(): mongoose.Types.ObjectId[];
    hasAttachments(): boolean;
    getAttachmentCount(): number;
}

const messageAttachmentSchema = new Schema({
    fileId: {
        type: String,
        required: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
        maxlength: [255, 'File name cannot exceed 255 characters'],
    },
    fileSize: {
        type: Number,
        required: true,
        min: [0, 'File size cannot be negative'],
        max: [100 * 1024 * 1024, 'File size cannot exceed 100MB'], // 100MB limit
    },
    mimeType: {
        type: String,
        required: true,
        validate: {
            validator: function (mimeType: string) {
                // Allow common file types for healthcare communication
                const allowedTypes = [
                    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                    'application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain', 'text/csv',
                    'audio/mpeg', 'audio/wav', 'audio/ogg',
                    'video/mp4', 'video/webm'
                ];
                return allowedTypes.includes(mimeType);
            },
            message: 'File type not allowed for healthcare communication',
        },
    },
    secureUrl: {
        type: String,
        required: true,
        validate: {
            validator: function (url: string) {
                return /^https?:\/\/.+/.test(url);
            },
            message: 'Invalid secure URL format',
        },
    },
    thumbnailUrl: {
        type: String,
        validate: {
            validator: function (url: string) {
                return !url || /^https?:\/\/.+/.test(url);
            },
            message: 'Invalid thumbnail URL format',
        },
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, { _id: false });

const messageReactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    emoji: {
        type: String,
        required: true,
        validate: {
            validator: function (emoji: string) {
                // Allow standard emojis and healthcare-specific reactions
                const allowedEmojis = [
                    '👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔',
                    '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊'
                ];
                return allowedEmojis.includes(emoji);
            },
            message: 'Emoji not allowed in healthcare communication',
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, { _id: false });

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

const messageEditHistorySchema = new Schema({
    content: {
        type: String,
        required: true,
    },
    editedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
    editedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reason: {
        type: String,
        trim: true,
        maxlength: [200, 'Edit reason cannot exceed 200 characters'],
    },
}, { _id: false });

const messageSchema = new Schema({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
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
        text: {
            type: String,
            trim: true,
            maxlength: [10000, 'Message content cannot exceed 10,000 characters'],
            validate: {
                validator: function (this: IMessage, text: string) {
                    // Text is required for text messages, optional for others
                    if (this.content.type === 'text') {
                        return !!text && text.length > 0;
                    }
                    return true;
                },
                message: 'Text content is required for text messages',
            },
        },
        type: {
            type: String,
            enum: ['text', 'file', 'image', 'clinical_note', 'system', 'voice_note'],
            required: true,
            index: true,
        },
        attachments: {
            type: [messageAttachmentSchema],
            default: [],
        },
        metadata: {
            originalText: String, // For system messages
            clinicalData: {
                patientId: {
                    type: Schema.Types.ObjectId,
                    ref: 'Patient',
                },
                interventionId: {
                    type: Schema.Types.ObjectId,
                    ref: 'ClinicalIntervention',
                },
                medicationId: {
                    type: Schema.Types.ObjectId,
                    ref: 'Medication',
                },
            },
            systemAction: {
                action: {
                    type: String,
                    enum: [
                        'participant_added', 'participant_removed', 'conversation_created',
                        'conversation_archived', 'conversation_resolved', 'priority_changed',
                        'clinical_context_updated', 'file_shared', 'intervention_linked'
                    ],
                },
                performedBy: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                },
                timestamp: Date,
            },
        },
    },
    threadId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        index: true,
    },
    parentMessageId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        index: true,
    },
    mentions: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    }],
    reactions: {
        type: [messageReactionSchema],
        default: [],
    },
    status: {
        type: String,
        enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
        default: 'sent',
        required: true,
        index: true,
    },
    priority: {
        type: String,
        enum: ['normal', 'high', 'urgent'],
        default: 'normal',
        required: true,
        index: true,
    },
    readBy: {
        type: [messageReadReceiptSchema],
        default: [],
    },
    editHistory: {
        type: [messageEditHistorySchema],
        default: [],
    },

    // Encryption metadata
    isEncrypted: {
        type: Boolean,
        default: true,
        required: true,
    },
    encryptionKeyId: {
        type: String,
        index: true,
    },

    // Soft delete fields
    deletedAt: {
        type: Date,
        index: true,
    },
    deletedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(messageSchema);

// Apply tenancy guard plugin
messageSchema.plugin(tenancyGuardPlugin);

// Indexes for optimal query performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, threadId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ workplaceId: 1, createdAt: -1 });
messageSchema.index({ mentions: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ priority: 1, createdAt: -1 });
messageSchema.index({ 'content.type': 1, conversationId: 1 });
messageSchema.index({ parentMessageId: 1, createdAt: 1 });

// Compound indexes for common queries
messageSchema.index({ conversationId: 1, status: 1, createdAt: -1 });
messageSchema.index({ workplaceId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ workplaceId: 1, 'content.type': 1, createdAt: -1 });

// Text index for search functionality
messageSchema.index({
    'content.text': 'text',
    'content.metadata.originalText': 'text'
});

// Virtual for reply count (for threaded messages)
messageSchema.virtual('replyCount', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'parentMessageId',
    count: true,
});

// Virtual for attachment count
messageSchema.virtual('attachmentCount').get(function (this: IMessage) {
    return this.content.attachments?.length || 0;
});

// Virtual for read count
messageSchema.virtual('readCount').get(function (this: IMessage) {
    // Guard against undefined arrays in edge cases
    return Array.isArray(this.readBy) ? this.readBy.length : 0;
});

// Instance methods
messageSchema.methods.addReaction = function (
    this: IMessage,
    userId: mongoose.Types.ObjectId,
    emoji: string
): void {
    // Remove existing reaction from this user for this emoji
    this.reactions = this.reactions.filter(
        r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );

    // Add new reaction
    this.reactions.push({
        userId,
        emoji,
        createdAt: new Date(),
    });
};

messageSchema.methods.removeReaction = function (
    this: IMessage,
    userId: mongoose.Types.ObjectId,
    emoji: string
): void {
    this.reactions = this.reactions.filter(
        r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );
};

messageSchema.methods.markAsRead = function (
    this: IMessage,
    userId: mongoose.Types.ObjectId
): void {
    // Check if already read by this user
    const existingRead = (this.readBy || []).find(
        r => r.userId.toString() === userId.toString()
    );

    if (!existingRead) {
        if (!Array.isArray(this.readBy)) this.readBy = [] as any;
        this.readBy.push({
            userId,
            readAt: new Date(),
        });
    }
};

messageSchema.methods.isReadBy = function (
    this: IMessage,
    userId: mongoose.Types.ObjectId
): boolean {
    return this.readBy.some(r => r.userId.toString() === userId.toString());
};

messageSchema.methods.addEdit = function (
    this: IMessage,
    content: string,
    editedBy: mongoose.Types.ObjectId,
    reason?: string
): void {
    // Store current content in edit history
    if (this.content.text) {
        if (!Array.isArray(this.editHistory)) this.editHistory = [] as any;
        this.editHistory.push({
            content: this.content.text,
            editedAt: new Date(),
            editedBy,
            reason,
        });
    }

    // Update content
    this.content.text = content;
    this.updatedBy = editedBy;
};

messageSchema.methods.getMentionedUsers = function (this: IMessage): mongoose.Types.ObjectId[] {
    return this.mentions;
};

messageSchema.methods.hasAttachments = function (this: IMessage): boolean {
    return !!(this.content.attachments && this.content.attachments.length > 0);
};

messageSchema.methods.getAttachmentCount = function (this: IMessage): number {
    return this.content.attachments?.length || 0;
};

// Pre-save middleware for validation and defaults
messageSchema.pre('save', function (this: IMessage) {
    // Set encryption key ID if encrypted and not set
    if (this.isEncrypted && !this.encryptionKeyId) {
        this.encryptionKeyId = `msg_${this._id}_${Date.now()}`;
    }

    // Validate attachments for file/image messages
    if (['file', 'image'].includes(this.content.type)) {
        if (!this.content.attachments || this.content.attachments.length === 0) {
            throw new Error(`${this.content.type} messages must have attachments`);
        }
    }

    // Validate system messages
    if (this.content.type === 'system') {
        if (!this.content.metadata?.systemAction) {
            throw new Error('System messages must have system action metadata');
        }
    }

    // Set createdBy to senderId if not set
    if (!this.createdBy) {
        this.createdBy = this.senderId;
    }
});

// Post-save middleware to update conversation
messageSchema.post('save', async function (this: IMessage) {
    try {
        const Conversation = mongoose.model('Conversation');
        await Conversation.findByIdAndUpdate(this.conversationId, {
            lastMessageAt: this.createdAt,
            lastMessageId: this._id,
            $inc: {
                [`unreadCount.${this.senderId}`]: 0, // Don't increment for sender
            },
        });

        // Increment unread count for other participants
        const conversation = await Conversation.findById(this.conversationId);
        if (conversation) {
            conversation.incrementUnreadCount(this.senderId);
            await conversation.save();
        }
    } catch (error) {
        console.error('Error updating conversation after message save:', error);
    }
});

// Static methods
messageSchema.statics.findByConversation = function (
    conversationId: mongoose.Types.ObjectId,
    options: any = {}
) {
    const { limit = 50, before, after, threadId } = options;

    const query: any = { conversationId };

    if (threadId) {
        query.threadId = threadId;
    }

    if (before) {
        query.createdAt = { $lt: new Date(before) };
    }

    if (after) {
        query.createdAt = { $gt: new Date(after) };
    }

    return this.find(query)
        .populate('senderId', 'firstName lastName role')
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
    const { conversationId, senderId, type, limit = 50 } = options;

    const query: any = {
        workplaceId,
        $text: { $search: searchQuery },
    };

    if (conversationId) {
        query.conversationId = conversationId;
    }

    if (senderId) {
        query.senderId = senderId;
    }

    if (type) {
        query['content.type'] = type;
    }

    return this.find(query, { score: { $meta: 'textScore' } })
        .populate('senderId', 'firstName lastName role')
        .populate('conversationId', 'title type')
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit);
};

export default mongoose.model<IMessage>('Message', messageSchema);