import mongoose, { Document, Schema } from 'mongoose';

export interface IApiDocumentation extends Document {
  endpointId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  content: string;
  examples: {
    language: string;
    code: string;
    description?: string;
  }[];
  interactiveExamples: {
    name: string;
    description: string;
    request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: any;
    };
    expectedResponse: {
      statusCode: number;
      body: any;
    };
  }[];
  changelog: {
    version: string;
    date: Date;
    changes: string[];
    breaking: boolean;
  }[];
  tags: string[];
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  prerequisites: string[];
  relatedEndpoints: mongoose.Types.ObjectId[];
  isPublished: boolean;
  publishedAt?: Date;
  lastReviewed?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  version: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ApiDocumentationSchema = new Schema<IApiDocumentation>({
  endpointId: {
    type: Schema.Types.ObjectId,
    ref: 'ApiEndpoint',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  examples: [{
    language: {
      type: String,
      required: true,
      enum: ['javascript', 'python', 'php', 'curl', 'java', 'csharp', 'ruby', 'go']
    },
    code: {
      type: String,
      required: true
    },
    description: String
  }],
  interactiveExamples: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    request: {
      method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      },
      url: {
        type: String,
        required: true
      },
      headers: {
        type: Schema.Types.Mixed,
        default: {}
      },
      body: Schema.Types.Mixed
    },
    expectedResponse: {
      statusCode: {
        type: Number,
        required: true
      },
      body: Schema.Types.Mixed
    }
  }],
  changelog: [{
    version: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    changes: [{
      type: String,
      required: true
    }],
    breaking: {
      type: Boolean,
      default: false
    }
  }],
  tags: [String],
  category: {
    type: String,
    required: true,
    index: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
    index: true
  },
  estimatedTime: {
    type: Number,
    default: 5
  },
  prerequisites: [String],
  relatedEndpoints: [{
    type: Schema.Types.ObjectId,
    ref: 'ApiEndpoint'
  }],
  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: Date,
  lastReviewed: Date,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ApiDocumentationSchema.index({ category: 1, isPublished: 1 });
ApiDocumentationSchema.index({ difficulty: 1, isPublished: 1 });
ApiDocumentationSchema.index({ tags: 1 });
ApiDocumentationSchema.index({ createdAt: -1 });

// Text search index
ApiDocumentationSchema.index({
  title: 'text',
  description: 'text',
  content: 'text',
  tags: 'text'
});

export default mongoose.model<IApiDocumentation>('ApiDocumentation', ApiDocumentationSchema);