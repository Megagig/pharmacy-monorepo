import ApiEndpoint, { IApiEndpoint } from '../models/ApiEndpoint';
import ApiKey, { IApiKey } from '../models/ApiKey';
import ApiUsageMetrics, { IApiUsageMetrics } from '../models/ApiUsageMetrics';
import { Types } from 'mongoose';

export interface ApiEndpointFilters {
  category?: string;
  version?: string;
  deprecated?: boolean;
  isPublic?: boolean;
  tags?: string[];
  search?: string;
}

export interface ApiKeyFilters {
  userId?: string;
  environment?: string;
  isActive?: boolean;
  search?: string;
}

export interface UsageMetricsFilters {
  endpoint?: string;
  method?: string;
  userId?: string;
  apiKeyId?: string;
  startDate?: Date;
  endDate?: Date;
  statusCode?: number;
}

export interface ApiDocumentationConfig {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  contact?: {
    name: string;
    email: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenApiSpec {
  openapi: string;
  info: any;
  servers: any[];
  paths: Record<string, any>;
  components: {
    securitySchemes: Record<string, any>;
    schemas: Record<string, any>;
  };
  security: any[];
}

export class ApiManagementService {
  /**
   * Get all API endpoints with filtering and pagination
   */
  async getApiEndpoints(
    filters: ApiEndpointFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    endpoints: IApiEndpoint[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.version) {
      query.version = filters.version;
    }

    if (filters.deprecated !== undefined) {
      query.deprecated = filters.deprecated;
    }

    if (filters.isPublic !== undefined) {
      query.isPublic = filters.isPublic;
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.search) {
      query.$or = [
        { path: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { tags: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await ApiEndpoint.countDocuments(query);
    const endpoints = await ApiEndpoint.find(query)
      .sort({ category: 1, path: 1, method: 1 })
      .skip(skip)
      .limit(limit);

    return {
      endpoints,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Create or update an API endpoint
   */
  async createOrUpdateEndpoint(endpointData: Partial<IApiEndpoint>): Promise<IApiEndpoint> {
    const { path, method, version } = endpointData;
    
    if (!path || !method || !version) {
      throw new Error('Path, method, and version are required');
    }

    const existingEndpoint = await ApiEndpoint.findOne({ path, method, version });
    
    if (existingEndpoint) {
      Object.assign(existingEndpoint, endpointData);
      return await existingEndpoint.save();
    } else {
      const endpoint = new ApiEndpoint(endpointData);
      return await endpoint.save();
    }
  }

  /**
   * Delete an API endpoint
   */
  async deleteEndpoint(endpointId: string): Promise<void> {
    const endpoint = await ApiEndpoint.findById(endpointId);
    if (!endpoint) {
      throw new Error('API endpoint not found');
    }

    await ApiEndpoint.findByIdAndDelete(endpointId);
  }

  /**
   * Generate OpenAPI specification
   */
  async generateOpenApiSpec(config: ApiDocumentationConfig): Promise<OpenApiSpec> {
    const endpoints = await ApiEndpoint.find({ isPublic: true, deprecated: false });
    
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
        contact: config.contact,
        license: config.license
      },
      servers: [
        {
          url: config.baseUrl,
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: {}
      },
      security: [
        { bearerAuth: [] },
        { apiKeyAuth: [] }
      ]
    };

    // Group endpoints by path
    const pathGroups: Record<string, IApiEndpoint[]> = {};
    endpoints.forEach(endpoint => {
      if (!pathGroups[endpoint.path]) {
        pathGroups[endpoint.path] = [];
      }
      pathGroups[endpoint.path].push(endpoint);
    });

    // Convert to OpenAPI format
    Object.entries(pathGroups).forEach(([path, pathEndpoints]) => {
      spec.paths[path] = {};
      
      pathEndpoints.forEach(endpoint => {
        const method = endpoint.method.toLowerCase();
        spec.paths[path][method] = {
          summary: endpoint.description,
          tags: endpoint.tags,
          parameters: endpoint.parameters.map(param => ({
            name: param.name,
            in: 'query', // Simplified - could be path, query, header, etc.
            required: param.required,
            description: param.description,
            schema: {
              type: param.type,
              example: param.example
            }
          })),
          responses: endpoint.responses.reduce((acc, response) => {
            acc[response.statusCode] = {
              description: response.description,
              content: response.schema ? {
                'application/json': {
                  schema: response.schema,
                  example: response.example
                }
              } : undefined
            };
            return acc;
          }, {} as Record<string, any>),
          security: endpoint.authentication.required ? [
            endpoint.authentication.type === 'bearer' ? { bearerAuth: endpoint.authentication.scopes || [] } : { apiKeyAuth: [] }
          ] : []
        };
      });
    });

    return spec;
  }

  /**
   * Get API keys for a user
   */
  async getApiKeys(
    filters: ApiKeyFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    apiKeys: IApiKey[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.environment) {
      query.environment = filters.environment;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { keyId: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await ApiKey.countDocuments(query);
    const apiKeys = await ApiKey.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      apiKeys,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Create a new API key
   */
  async createApiKey(keyData: {
    name: string;
    description?: string;
    userId: string;
    scopes: string[];
    rateLimit?: { requests: number; window: number };
    expiresAt?: Date;
    allowedIPs?: string[];
    allowedDomains?: string[];
    environment: 'development' | 'staging' | 'production';
  }): Promise<{ apiKey: IApiKey; key: string }> {
    const apiKey = new ApiKey({
      ...keyData,
      userId: new Types.ObjectId(keyData.userId)
    });

    const key = apiKey.generateKey();
    await apiKey.save();

    return { apiKey, key };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    const apiKey = await ApiKey.findOne({ keyId });
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.isActive = false;
    await apiKey.save();
  }

  /**
   * Validate an API key
   */
  async validateApiKey(keyString: string): Promise<IApiKey | null> {
    const [keyId, key] = keyString.split('.');
    if (!keyId || !key) {
      return null;
    }

    const apiKey = await ApiKey.findOne({ keyId, isActive: true });
    if (!apiKey || apiKey.isExpired() || !apiKey.validateKey(key)) {
      return null;
    }

    return apiKey;
  }

  /**
   * Record API usage metrics
   */
  async recordUsage(usageData: Partial<IApiUsageMetrics>): Promise<void> {
    const metrics = new ApiUsageMetrics(usageData);
    await metrics.save();

    // Update API key usage if applicable
    if (usageData.apiKeyId) {
      const apiKey = await ApiKey.findOne({ keyId: usageData.apiKeyId });
      if (apiKey) {
        await apiKey.incrementUsage();
      }
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(
    filters: UsageMetricsFilters = {},
    groupBy: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
    timeSeriesData: Array<{ date: Date; requests: number; averageResponseTime: number }>;
  }> {
    const matchStage: any = {};

    if (filters.endpoint) {
      matchStage.endpoint = filters.endpoint;
    }

    if (filters.method) {
      matchStage.method = filters.method;
    }

    if (filters.userId) {
      matchStage.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.apiKeyId) {
      matchStage.apiKeyId = filters.apiKeyId;
    }

    if (filters.startDate || filters.endDate) {
      matchStage.timestamp = {};
      if (filters.startDate) {
        matchStage.timestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        matchStage.timestamp.$lte = filters.endDate;
      }
    }

    if (filters.statusCode) {
      matchStage.statusCode = filters.statusCode;
    }

    // Get basic metrics
    const basicMetrics = await ApiUsageMetrics.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          averageResponseTime: { $avg: '$responseTime' },
          errorCount: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get top endpoints
    const topEndpoints = await ApiUsageMetrics.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$endpoint',
          requests: { $sum: 1 }
        }
      },
      { $sort: { requests: -1 } },
      { $limit: 10 },
      {
        $project: {
          endpoint: '$_id',
          requests: 1,
          _id: 0
        }
      }
    ]);

    // Get time series data
    const dateFormat = this.getDateFormat(groupBy);
    const timeSeriesData = await ApiUsageMetrics.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$timestamp'
            }
          },
          requests: { $sum: 1 },
          averageResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { '_id': 1 } },
      {
        $project: {
          date: { $dateFromString: { dateString: '$_id' } },
          requests: 1,
          averageResponseTime: 1,
          _id: 0
        }
      }
    ]);

    const metrics = basicMetrics[0] || { totalRequests: 0, averageResponseTime: 0, errorCount: 0 };
    const errorRate = metrics.totalRequests > 0 ? (metrics.errorCount / metrics.totalRequests) * 100 : 0;

    return {
      totalRequests: metrics.totalRequests,
      averageResponseTime: Math.round(metrics.averageResponseTime || 0),
      errorRate: Math.round(errorRate * 100) / 100,
      topEndpoints,
      timeSeriesData
    };
  }

  /**
   * Get available API versions
   */
  async getApiVersions(): Promise<string[]> {
    const versions = await ApiEndpoint.distinct('version');
    return versions.sort();
  }

  /**
   * Get API categories
   */
  async getApiCategories(): Promise<string[]> {
    const categories = await ApiEndpoint.distinct('category');
    return categories.sort();
  }

  private getDateFormat(groupBy: string): string {
    switch (groupBy) {
      case 'hour':
        return '%Y-%m-%d %H:00:00';
      case 'day':
        return '%Y-%m-%d';
      case 'week':
        return '%Y-%U'; // Year and week number
      case 'month':
        return '%Y-%m';
      default:
        return '%Y-%m-%d';
    }
  }
}

export default new ApiManagementService();