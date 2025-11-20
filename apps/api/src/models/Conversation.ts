import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IConversationParticipant {
    userId: mongoose.Types.ObjectId;
    role: 'pharmacist' | 'doctor' | 'patient' | 'pharmacy_team' | 'intern_pharmacist' | 'pharmacy_outlet' | 'nurse' | 'admin' | 'super_admin' | 'owner';
    joinedAt: Date;
    leftAt?: Date;
    permissions: string[];
    lastReadAt?: Date;
}

export interface IConversationMetadata {
    isEncrypted: boolean;
    encryptionKeyId?: string;
    clinicalContext?: {
        diagnosis?: string;
        medications?: mongoose.Types.ObjectId[];
        conditions?: string[];
        interventionIds?: mongoose.Types.ObjectId[];
    };
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags: string[];
}

export interface IConversation extends Document {
    _id: mongoose.Types.ObjectId;
    title?: string;
    type: 'direct' | 'group' | 'patient_query' | 'clinical_consultation';
    participants: IConversationParticipant[];
    patientId?: mongoose.Types.ObjectId;
    caseId?: string;
    status: 'active' | 'archived' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags: string[];
    lastMessageAt: Date;
    lastMessageId?: mongoose.Types.ObjectId;
    unreadCount: Map<string, number>; // userId -> unread count
    createdBy: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    metadata: IConversationMetadata;

    // Soft delete fields
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    addParticipant(userId: mongoose.Types.ObjectId, role: string, permissions?: string[]): void;
    removeParticipant(userId: mongoose.Types.ObjectId): void;
    updateLastMessage(messageId: mongoose.Types.ObjectId): void;
    incrementUnreadCount(excludeUserId?: mongoose.Types.ObjectId): void;
    markAsRead(userId: mongoose.Types.ObjectId): void;
    hasParticipant(userId: mongoose.Types.ObjectId): boolean;
    getParticipantRole(userId: mongoose.Types.ObjectId): string | null;
}

const conversationParticipantSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['pharmacist', 'doctor', 'patient', 'pharmacy_team', 'intern_pharmacist', 'pharmacy_outlet', 'nurse', 'admin', 'super_admin', 'owner'],
        required: true,
        index: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
    leftAt: {
        type: Date,
        index: true,
    },
    permissions: [{
        type: String,
        enum: [
            'read_messages',
            'send_messages',
            'add_participants',
            'remove_participants',
            'edit_conversation',
            'delete_conversation',
            'upload_files',
            'view_patient_data',
            'manage_clinical_context'
        ],
    }],
    lastReadAt: {
        type: Date,
        index: true,
    },
}, { _id: false });

const conversationSchema = new Schema({
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Conversation title cannot exceed 200 characters'],
        index: 'text',
    },
    type: {
        type: String,
        enum: ['direct', 'group', 'patient_query', 'clinical_consultation'],
        required: true,
        index: true,
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
        validate: {
            validator: function (this: IConversation, patientId: mongoose.Types.ObjectId) {
                // Patient ID is required for patient_query and clinical_consultation types
                if (['patient_query', 'clinical_consultation'].includes(this.type)) {
                    return !!patientId;
                }
                return true;
            },
            message: 'Patient ID is required for patient queries and clinical consultations',
        },
    },
    caseId: {
        type: String,
        trim: true,
        maxlength: [100, 'Case ID cannot exceed 100 characters'],
        index: true,
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'resolved', 'closed'],
        default: 'active',
        required: true,
        index: true,
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        required: true,
        index: true,
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters'],
        index: true,
    }],
    lastMessageAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: -1, // Descending index for recent conversations
    },
    lastMessageId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        index: true,
    },
    unreadCount: {
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
    metadata: {
        isEncrypted: {
            type: Boolean,
            default: true,
            required: true,
        },
        encryptionKeyId: {
            type: String,
            index: true,
        },
        clinicalContext: {
            diagnosis: {
                type: String,
                trim: true,
                maxlength: [500, 'Diagnosis cannot exceed 500 characters'],
            },
            medications: [{
                type: Schema.Types.ObjectId,
                ref: 'Medication',
            }],
            conditions: [{
                type: String,
                trim: true,
                maxlength: [200, 'Condition cannot exceed 200 characters'],
            }],
            interventionIds: [{
                type: Schema.Types.ObjectId,
                ref: 'ClinicalIntervention',
            }],
        },
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(conversationSchema);

// Apply tenancy guard plugin
conversationSchema.plugin(tenancyGuardPlugin);

// Indexes for optimal query performance
conversationSchema.index({ workplaceId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ workplaceId: 1, type: 1, status: 1 });
conversationSchema.index({ workplaceId: 1, patientId: 1, status: 1 });
conversationSchema.index({ workplaceId: 1, priority: 1, status: 1 });
conversationSchema.index({ 'participants.userId': 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ 'participants.userId': 1, workplaceId: 1 });
conversationSchema.index({ caseId: 1, workplaceId: 1 }, { sparse: true });
conversationSchema.index({ tags: 1, workplaceId: 1 });
conversationSchema.index({ createdBy: 1, workplaceId: 1 });
conversationSchema.index({ 'metadata.clinicalContext.interventionIds': 1 }, { sparse: true });

// Text index for search functionality
conversationSchema.index({
    title: 'text',
    'metadata.clinicalContext.diagnosis': 'text',
    'metadata.clinicalContext.conditions': 'text'
});

// Virtual for active participants (not left)
conversationSchema.virtual('activeParticipants').get(function (this: IConversation) {
    return this.participants.filter(p => !p.leftAt);
});

// Virtual for participant count
conversationSchema.virtual('participantCount').get(function (this: IConversation) {
    return this.participants.filter(p => !p.leftAt).length;
});

// Instance methods
conversationSchema.methods.addParticipant = function (
    this: IConversation,
    userId: mongoose.Types.ObjectId,
    role: string,
    permissions: string[] = ['read_messages', 'send_messages']
): void {
    // Check if participant already exists
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
        permissions,
    });

    // Initialize unread count for new participant
    this.unreadCount.set(userId.toString(), 0);
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

    participant.leftAt = new Date();

    // Remove from unread count map
    this.unreadCount.delete(userId.toString());
};

conversationSchema.methods.updateLastMessage = function (
    this: IConversation,
    messageId: mongoose.Types.ObjectId
): void {
    this.lastMessageAt = new Date();
    this.lastMessageId = messageId;
};

conversationSchema.methods.incrementUnreadCount = function (
    this: IConversation,
    excludeUserId?: mongoose.Types.ObjectId
): void {
    this.participants.forEach(participant => {
        if (!participant.leftAt &&
            (!excludeUserId || participant.userId.toString() !== excludeUserId.toString())) {
            const currentCount = this.unreadCount.get(participant.userId.toString()) || 0;
            this.unreadCount.set(participant.userId.toString(), currentCount + 1);
        }
    });
};

conversationSchema.methods.markAsRead = function (
    this: IConversation,
    userId: mongoose.Types.ObjectId
): void {
    this.unreadCount.set(userId.toString(), 0);

    // Update participant's lastReadAt
    const participant = this.participants.find(
        p => p.userId.toString() === userId.toString() && !p.leftAt
    );
    if (participant) {
        participant.lastReadAt = new Date();
    }
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

// Pre-save middleware for validation and defaults
conversationSchema.pre('save', function (this: IConversation) {
    // Set default permissions based on role
    this.participants.forEach(participant => {
        if (!participant.permissions || participant.permissions.length === 0) {
            switch (participant.role) {
                case 'patient':
                    participant.permissions = ['read_messages', 'send_messages', 'upload_files'];
                    break;
                case 'pharmacist':
                case 'doctor':
                    participant.permissions = [
                        'read_messages', 'send_messages', 'upload_files',
                        'view_patient_data', 'manage_clinical_context'
                    ];
                    break;
                default:
                    participant.permissions = ['read_messages', 'send_messages'];
            }
        }
    });

    // Generate encryption key ID if not set
    if (this.metadata.isEncrypted && !this.metadata.encryptionKeyId) {
        this.metadata.encryptionKeyId = `conv_${this._id}_${Date.now()}`;
    }

    // Set default title if not provided
    if (!this.title) {
        switch (this.type) {
            case 'patient_query':
                this.title = 'Patient Query';
                break;
            case 'clinical_consultation':
                this.title = 'Clinical Consultation';
                break;
            case 'direct':
                this.title = 'Direct Message';
                break;
            case 'group':
                this.title = 'Group Discussion';
                break;
        }
    }
});

// Static methods
conversationSchema.statics.findByParticipant = function (
    userId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    options: any = {}
) {
    const query = {
        workplaceId,
        'participants.userId': userId,
        'participants.leftAt': { $exists: false },
        status: { $ne: 'closed' },
        ...options,
    };

    return this.find(query)
        .populate('participants.userId', 'firstName lastName role')
        .populate('patientId', 'firstName lastName mrn')
        .populate('lastMessageId', 'content.text senderId createdAt')
        .sort({ lastMessageAt: -1 });
};

conversationSchema.statics.findByPatient = function (
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        status: { $ne: 'closed' },
    })
        .populate('participants.userId', 'firstName lastName role')
        .sort({ lastMessageAt: -1 });
};

export default mongoose.model<IConversation>('Conversation', conversationSchema);