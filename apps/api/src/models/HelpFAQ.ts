import mongoose, { Document, Schema } from 'mongoose';

export interface IHelpFAQ extends Document {
    question: string;
    answer: string;
    category: string;
    subcategory?: string;
    tags: string[];

    // Status and visibility
    status: 'draft' | 'published' | 'archived';
    isPublic: boolean;

    // Author information
    authorId: mongoose.Types.ObjectId;
    authorName: string;

    // Content management
    version: number;
    lastEditedBy?: mongoose.Types.ObjectId;
    lastEditedAt?: Date;

    // Analytics
    viewCount: number;
    helpfulVotes: number;
    notHelpfulVotes: number;
    searchCount: number;

    // SEO and search
    searchKeywords: string[];

    // Related content
    relatedFAQs: mongoose.Types.ObjectId[];
    relatedArticles: mongoose.Types.ObjectId[];

    // Priority and ordering
    priority: 'low' | 'medium' | 'high' | 'critical';
    displayOrder: number;

    // Publishing
    publishedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

const helpFAQSchema = new Schema<IHelpFAQ>(
    {
        question: {
            type: String,
            required: true,
            maxlength: 500,
            trim: true,
        },
        answer: {
            type: String,
            required: true,
            maxlength: 5000,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        subcategory: {
            type: String,
            trim: true,
            index: true,
        },
        tags: [{
            type: String,
            trim: true,
            lowercase: true,
        }],
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
            required: true,
            index: true,
        },
        isPublic: {
            type: Boolean,
            default: true,
            index: true,
        },
        authorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        authorName: {
            type: String,
            required: true,
            trim: true,
        },
        version: {
            type: Number,
            default: 1,
            min: 1,
        },
        lastEditedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        lastEditedAt: {
            type: Date,
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        helpfulVotes: {
            type: Number,
            default: 0,
            min: 0,
        },
        notHelpfulVotes: {
            type: Number,
            default: 0,
            min: 0,
        },
        searchCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        searchKeywords: [{
            type: String,
            trim: true,
            lowercase: true,
        }],
        relatedFAQs: [{
            type: Schema.Types.ObjectId,
            ref: 'HelpFAQ',
        }],
        relatedArticles: [{
            type: Schema.Types.ObjectId,
            ref: 'KnowledgeBaseArticle',
        }],
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            index: true,
        },
        displayOrder: {
            type: Number,
            default: 0,
            index: true,
        },
        publishedAt: {
            type: Date,
            index: true,
        },
    },
    {
        timestamps: true,
        collection: 'helpfaqs',
    }
);

// Indexes for search and filtering
helpFAQSchema.index({ status: 1, isPublic: 1 });
helpFAQSchema.index({ category: 1, status: 1 });
helpFAQSchema.index({ priority: 1, displayOrder: 1 });
helpFAQSchema.index({ publishedAt: -1 });
helpFAQSchema.index({ viewCount: -1 });
helpFAQSchema.index({ tags: 1 });

// Full-text search index
helpFAQSchema.index({
    question: 'text',
    answer: 'text',
    tags: 'text',
    searchKeywords: 'text'
});

// Pre-save middleware
helpFAQSchema.pre('save', function (next) {
    // Set published date when status changes to published
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }

    // Update version number on content changes
    if ((this.isModified('question') || this.isModified('answer')) && !this.isNew) {
        this.version += 1;
        this.lastEditedAt = new Date();
    }

    next();
});

// Methods
helpFAQSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
};

// Calculate helpfulness score
helpFAQSchema.methods.getHelpfulnessScore = function (): number {
    const total = this.helpfulVotes + this.notHelpfulVotes;
    if (total === 0) return 0;
    return Math.round((this.helpfulVotes / total) * 100);
};

// Check if FAQ is published and visible
helpFAQSchema.methods.isVisible = function (): boolean {
    return this.status === 'published';
};

// Increment view count
helpFAQSchema.methods.incrementViewCount = function (): Promise<IHelpFAQ> {
    this.viewCount = (this.viewCount || 0) + 1;
    return this.save();
};

// Increment search count
helpFAQSchema.methods.incrementSearchCount = function (): Promise<IHelpFAQ> {
    this.searchCount = (this.searchCount || 0) + 1;
    return this.save();
};

export const HelpFAQ = mongoose.model<IHelpFAQ>('HelpFAQ', helpFAQSchema);
export default HelpFAQ;