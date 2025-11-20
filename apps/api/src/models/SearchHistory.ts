import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface ISearchHistory extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    query: string;
    filters: {
        conversationId?: string;
        senderId?: string;
        messageType?: string;
        priority?: string;
        dateFrom?: Date;
        dateTo?: Date;
        tags?: string[];
    };
    resultCount: number;
    searchType: 'message' | 'conversation';
    executionTime: number; // in milliseconds
    createdAt: Date;
    updatedAt: Date;
}

export interface ISavedSearch extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    name: string;
    description?: string;
    query: string;
    filters: {
        conversationId?: string;
        senderId?: string;
        messageType?: string;
        priority?: string;
        dateFrom?: Date;
        dateTo?: Date;
        tags?: string[];
    };
    searchType: 'message' | 'conversation';
    isPublic: boolean; // Can be shared with other users in workplace
    lastUsed?: Date;
    useCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const searchHistorySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true,
    },
    query: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Search query cannot exceed 500 characters'],
        index: 'text',
    },
    filters: {
        conversationId: {
            type: String,
            validate: {
                validator: function (id: string) {
                    return !id || /^[0-9a-fA-F]{24}$/.test(id);
                },
                message: 'Invalid conversation ID format',
            },
        },
        senderId: {
            type: String,
            validate: {
                validator: function (id: string) {
                    return !id || /^[0-9a-fA-F]{24}$/.test(id);
                },
                message: 'Invalid sender ID format',
            },
        },
        messageType: {
            type: String,
            enum: ['text', 'file', 'image', 'clinical_note', 'system', 'voice_note'],
        },
        priority: {
            type: String,
            enum: ['normal', 'high', 'urgent'],
        },
        dateFrom: Date,
        dateTo: Date,
        tags: [{
            type: String,
            trim: true,
            maxlength: [50, 'Tag cannot exceed 50 characters'],
        }],
    },
    resultCount: {
        type: Number,
        required: true,
        min: [0, 'Result count cannot be negative'],
    },
    searchType: {
        type: String,
        enum: ['message', 'conversation'],
        required: true,
        index: true,
    },
    executionTime: {
        type: Number,
        required: true,
        min: [0, 'Execution time cannot be negative'],
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

const savedSearchSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Search name cannot exceed 100 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    query: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Search query cannot exceed 500 characters'],
        index: 'text',
    },
    filters: {
        conversationId: {
            type: String,
            validate: {
                validator: function (id: string) {
                    return !id || /^[0-9a-fA-F]{24}$/.test(id);
                },
                message: 'Invalid conversation ID format',
            },
        },
        senderId: {
            type: String,
            validate: {
                validator: function (id: string) {
                    return !id || /^[0-9a-fA-F]{24}$/.test(id);
                },
                message: 'Invalid sender ID format',
            },
        },
        messageType: {
            type: String,
            enum: ['text', 'file', 'image', 'clinical_note', 'system', 'voice_note'],
        },
        priority: {
            type: String,
            enum: ['normal', 'high', 'urgent'],
        },
        dateFrom: Date,
        dateTo: Date,
        tags: [{
            type: String,
            trim: true,
            maxlength: [50, 'Tag cannot exceed 50 characters'],
        }],
    },
    searchType: {
        type: String,
        enum: ['message', 'conversation'],
        required: true,
        index: true,
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true,
    },
    lastUsed: {
        type: Date,
        index: true,
    },
    useCount: {
        type: Number,
        default: 0,
        min: [0, 'Use count cannot be negative'],
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Add audit fields
addAuditFields(searchHistorySchema);
addAuditFields(savedSearchSchema);

// Apply tenancy guard plugin
searchHistorySchema.plugin(tenancyGuardPlugin);
savedSearchSchema.plugin(tenancyGuardPlugin);

// Indexes for search history
searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ workplaceId: 1, searchType: 1, createdAt: -1 });
searchHistorySchema.index({ query: 'text' });

// Indexes for saved searches
savedSearchSchema.index({ userId: 1, name: 1 }, { unique: true });
savedSearchSchema.index({ workplaceId: 1, isPublic: 1, searchType: 1 });
savedSearchSchema.index({ lastUsed: -1 });
savedSearchSchema.index({ useCount: -1 });

// Virtual for search history frequency
searchHistorySchema.virtual('frequency').get(function (this: ISearchHistory) {
    // This would be calculated based on how often this query appears
    return 1;
});

// Instance methods for saved searches
savedSearchSchema.methods.incrementUseCount = function (this: ISavedSearch) {
    this.useCount += 1;
    this.lastUsed = new Date();
    return this.save();
};

// Static methods for search history
searchHistorySchema.statics.getRecentSearches = function (
    userId: mongoose.Types.ObjectId,
    limit: number = 10
) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('query searchType createdAt resultCount');
};

searchHistorySchema.statics.getPopularSearches = function (
    workplaceId: mongoose.Types.ObjectId,
    searchType?: 'message' | 'conversation',
    limit: number = 10
) {
    const matchStage: any = { workplaceId };
    if (searchType) {
        matchStage.searchType = searchType;
    }

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$query',
                count: { $sum: 1 },
                avgResultCount: { $avg: '$resultCount' },
                lastUsed: { $max: '$createdAt' },
                searchType: { $first: '$searchType' }
            }
        },
        { $sort: { count: -1, lastUsed: -1 } },
        { $limit: limit },
        {
            $project: {
                query: '$_id',
                count: 1,
                avgResultCount: 1,
                lastUsed: 1,
                searchType: 1,
                _id: 0
            }
        }
    ]);
};

// Static methods for saved searches
savedSearchSchema.statics.getPublicSearches = function (
    workplaceId: mongoose.Types.ObjectId,
    searchType?: 'message' | 'conversation'
) {
    const query: any = { workplaceId, isPublic: true };
    if (searchType) {
        query.searchType = searchType;
    }

    return this.find(query)
        .populate('userId', 'firstName lastName role')
        .sort({ useCount: -1, lastUsed: -1 })
        .limit(20);
};

savedSearchSchema.statics.getUserSearches = function (
    userId: mongoose.Types.ObjectId,
    searchType?: 'message' | 'conversation'
) {
    const query: any = { userId };
    if (searchType) {
        query.searchType = searchType;
    }

    return this.find(query)
        .sort({ lastUsed: -1, createdAt: -1 });
};

// Pre-save middleware for search history cleanup
searchHistorySchema.pre('save', async function (this: ISearchHistory) {
    // Limit search history per user to prevent database bloat
    const MAX_HISTORY_PER_USER = 1000;

    if (this.isNew) {
        const count = await (this.constructor as any).countDocuments({ userId: this.userId });

        if (count >= MAX_HISTORY_PER_USER) {
            // Remove oldest entries
            const oldestEntries = await (this.constructor as any)
                .find({ userId: this.userId })
                .sort({ createdAt: 1 })
                .limit(count - MAX_HISTORY_PER_USER + 1)
                .select('_id');

            const idsToRemove = oldestEntries.map((entry: any) => entry._id);
            await (this.constructor as any).deleteMany({ _id: { $in: idsToRemove } });
        }
    }
});

export const SearchHistory = mongoose.model<ISearchHistory>('SearchHistory', searchHistorySchema);
export const SavedSearch = mongoose.model<ISavedSearch>('SavedSearch', savedSearchSchema);

export default { SearchHistory, SavedSearch };