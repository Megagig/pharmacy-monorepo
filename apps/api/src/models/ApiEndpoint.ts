import mongoose, { Document, Schema } from 'mongoose';

export interface IApiEndpoint extends Document {
  path: string;
  method: string;
  version: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }[];
  responses: {
    statusCode: number;
    description: string;
    schema?: any;
    example?: any;
  }[];
  authentication: {
    required: boolean;
    type: 'bearer' | 'api_key' | 'basic';
    scopes?: string[];
  };
  rateLimit: {
    requests: number;
    window: number; // in seconds
  };
  deprecated: boolean;
  deprecationDate?: Date;
  tags: string[];
  category: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiEndpointSchema = new Schema<IApiEndpoint>({
  path: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    index: true
  },
  version: {
    type: String,
    required: true,
    default: 'v1',
    index: true
  },
  description: {
    type: String,
    required: true
  },
  parameters: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['string', 'number', 'boolean', 'object', 'array']
    },
    required: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      required: true
    },
    example: Schema.Types.Mixed
  }],
  responses: [{
    statusCode: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    schema: Schema.Types.Mixed,
    example: Schema.Types.Mixed
  }],
  authentication: {
    required: {
      type: Boolean,
      default: true
    },
    type: {
      type: String,
      enum: ['bearer', 'api_key', 'basic'],
      default: 'bearer'
    },
    scopes: [String]
  },
  rateLimit: {
    requests: {
      type: Number,
      default: 100
    },
    window: {
      type: Number,
      default: 3600 // 1 hour
    }
  },
  deprecated: {
    type: Boolean,
    default: false,
    index: true
  },
  deprecationDate: Date,
  tags: [String],
  category: {
    type: String,
    required: true,
    index: true
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
ApiEndpointSchema.index({ path: 1, method: 1, version: 1 }, { unique: true });
ApiEndpointSchema.index({ category: 1, isPublic: 1 });
ApiEndpointSchema.index({ deprecated: 1, version: 1 });

export default mongoose.model<IApiEndpoint>('ApiEndpoint', ApiEndpointSchema);