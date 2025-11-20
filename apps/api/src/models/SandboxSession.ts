import mongoose, { Document, Schema } from 'mongoose';

export interface ISandboxSession extends Document {
  developerId: mongoose.Types.ObjectId;
  sessionId: string;
  name: string;
  description?: string;
  environment: 'sandbox' | 'testing';
  configuration: {
    baseUrl: string;
    apiVersion: string;
    timeout: number;
    retryAttempts: number;
  };
  requests: {
    id: string;
    timestamp: Date;
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    response?: {
      statusCode: number;
      headers: Record<string, string>;
      body: any;
      responseTime: number;
    };
    error?: string;
  }[];
  variables: Record<string, any>;
  collections: {
    name: string;
    description?: string;
    requests: string[]; // request IDs
  }[];
  isActive: boolean;
  expiresAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SandboxSessionSchema = new Schema<ISandboxSession>({
  developerId: {
    type: Schema.Types.ObjectId,
    ref: 'DeveloperAccount',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  environment: {
    type: String,
    enum: ['sandbox', 'testing'],
    default: 'sandbox',
    index: true
  },
  configuration: {
    baseUrl: {
      type: String,
      required: true,
      default: process.env.SANDBOX_BASE_URL || 'https://sandbox-api.PharmacyCopilot.com'
    },
    apiVersion: {
      type: String,
      default: 'v1'
    },
    timeout: {
      type: Number,
      default: 30000 // 30 seconds
    },
    retryAttempts: {
      type: Number,
      default: 3
    }
  },
  requests: [{
    id: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    endpoint: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {}
    },
    body: Schema.Types.Mixed,
    response: {
      statusCode: Number,
      headers: {
        type: Schema.Types.Mixed,
        default: {}
      },
      body: Schema.Types.Mixed,
      responseTime: Number
    },
    error: String
  }],
  variables: {
    type: Schema.Types.Mixed,
    default: {}
  },
  collections: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    requests: [String]
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
SandboxSessionSchema.index({ developerId: 1, isActive: 1 });
SandboxSessionSchema.index({ expiresAt: 1 });
SandboxSessionSchema.index({ lastActivity: -1 });

// TTL index to automatically delete expired sessions
SandboxSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
SandboxSessionSchema.methods.addRequest = function(requestData: any): string {
  const requestId = new mongoose.Types.ObjectId().toString();
  this.requests.push({
    id: requestId,
    ...requestData,
    timestamp: new Date()
  });
  
  // Keep only last 100 requests
  if (this.requests.length > 100) {
    this.requests = this.requests.slice(-100);
  }
  
  this.lastActivity = new Date();
  return requestId;
};

SandboxSessionSchema.methods.updateRequest = function(requestId: string, responseData: any): void {
  const request = this.requests.find((req: any) => req.id === requestId);
  if (request) {
    request.response = responseData;
    this.lastActivity = new Date();
  }
};

SandboxSessionSchema.methods.setError = function(requestId: string, error: string): void {
  const request = this.requests.find((req: any) => req.id === requestId);
  if (request) {
    request.error = error;
    this.lastActivity = new Date();
  }
};

SandboxSessionSchema.methods.isExpired = function(): boolean {
  return this.expiresAt < new Date();
};

SandboxSessionSchema.methods.extendSession = function(hours: number = 24): void {
  this.expiresAt = new Date(Date.now() + (hours * 60 * 60 * 1000));
  this.lastActivity = new Date();
};

export default mongoose.model<ISandboxSession>('SandboxSession', SandboxSessionSchema);