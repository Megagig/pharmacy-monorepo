import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailDelivery extends Document {
    // Email identification
    messageId: string;
    provider: 'resend' | 'nodemailer' | 'simulation';

    // Email details
    to: string;
    subject: string;
    templateName?: string;

    // Delivery tracking
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained';
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;

    // Error handling
    error?: string;
    retryCount: number;
    maxRetries: number;
    nextRetryAt?: Date;

    // Context
    workspaceId?: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    relatedEntity?: {
        type: 'invitation' | 'subscription' | 'user' | 'workspace';
        id: mongoose.Types.ObjectId;
    };

    // Metadata
    metadata?: Record<string, any>;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Methods
    markAsSent(messageId?: string): Promise<IEmailDelivery>;
    markAsDelivered(): Promise<IEmailDelivery>;
    markAsFailed(error: string): Promise<IEmailDelivery>;
    markAsBounced(): Promise<IEmailDelivery>;
    markAsComplained(): Promise<IEmailDelivery>;
}

export interface IEmailDeliveryModel extends mongoose.Model<IEmailDelivery> {
    findPendingRetries(): Promise<IEmailDelivery[]>;
    getDeliveryStats(workspaceId?: mongoose.Types.ObjectId): Promise<any>;
}

const EmailDeliverySchema = new Schema<IEmailDelivery>(
    {
        messageId: {
            type: String,
            required: true,
            index: true,
        },
        provider: {
            type: String,
            enum: ['resend', 'nodemailer', 'simulation'],
            required: true,
        },
        to: {
            type: String,
            required: true,
            index: true,
        },
        subject: {
            type: String,
            required: true,
        },
        templateName: {
            type: String,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'complained'],
            default: 'pending',
            index: true,
        },
        sentAt: {
            type: Date,
        },
        deliveredAt: {
            type: Date,
        },
        failedAt: {
            type: Date,
        },
        error: {
            type: String,
        },
        retryCount: {
            type: Number,
            default: 0,
        },
        maxRetries: {
            type: Number,
            default: 3,
        },
        nextRetryAt: {
            type: Date,
        },
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: 'Workplace',
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        relatedEntity: {
            type: {
                type: String,
                enum: ['invitation', 'subscription', 'user', 'workspace'],
            },
            id: {
                type: Schema.Types.ObjectId,
            },
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
EmailDeliverySchema.index({ status: 1, nextRetryAt: 1 });
EmailDeliverySchema.index({ workspaceId: 1, status: 1 });
EmailDeliverySchema.index({ createdAt: -1 });
EmailDeliverySchema.index({ 'relatedEntity.type': 1, 'relatedEntity.id': 1 });

// TTL index to automatically delete old records after 90 days
EmailDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Methods
EmailDeliverySchema.methods.markAsSent = function (messageId?: string) {
    this.status = 'sent';
    this.sentAt = new Date();
    if (messageId) {
        this.messageId = messageId;
    }
    return this.save();
};

EmailDeliverySchema.methods.markAsDelivered = function () {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    return this.save();
};

EmailDeliverySchema.methods.markAsFailed = function (error: string) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.error = error;
    this.retryCount += 1;

    // Calculate next retry time with exponential backoff
    if (this.retryCount <= this.maxRetries) {
        const backoffMinutes = Math.pow(2, this.retryCount) * 5; // 10, 20, 40 minutes
        this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
        this.status = 'pending'; // Reset to pending for retry
    }

    return this.save();
};

EmailDeliverySchema.methods.markAsBounced = function () {
    this.status = 'bounced';
    this.failedAt = new Date();
    return this.save();
};

EmailDeliverySchema.methods.markAsComplained = function () {
    this.status = 'complained';
    this.failedAt = new Date();
    return this.save();
};

// Static methods
EmailDeliverySchema.statics.findPendingRetries = function () {
    return this.find({
        status: 'pending',
        retryCount: { $gt: 0, $lte: 3 },
        nextRetryAt: { $lte: new Date() },
    });
};

EmailDeliverySchema.statics.getDeliveryStats = function (workspaceId?: mongoose.Types.ObjectId) {
    const match = workspaceId ? { workspaceId } : {};

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$count' },
                stats: {
                    $push: {
                        status: '$_id',
                        count: '$count',
                    },
                },
            },
        },
    ]);
};

export const EmailDelivery = mongoose.model<IEmailDelivery, IEmailDeliveryModel>('EmailDelivery', EmailDeliverySchema);