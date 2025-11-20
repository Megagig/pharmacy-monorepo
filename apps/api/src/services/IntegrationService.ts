import Integration, { IIntegration } from '../models/Integration';
import { Types } from 'mongoose';
import axios from 'axios';

export interface IntegrationFilters {
  userId?: string;
  type?: string;
  provider?: string;
  isActive?: boolean;
  syncFrequency?: string;
  search?: string;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  duration: number;
  error?: string;
  details?: any;
}

export interface IntegrationProvider {
  name: string;
  type: string;
  description: string;
  configurationSchema: any;
  supportedOperations: string[];
  authenticationMethods: string[];
}

export class IntegrationService {
  /**
   * Get integrations with filtering and pagination
   */
  async getIntegrations(
    filters: IntegrationFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    integrations: IIntegration[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.provider) {
      query.provider = filters.provider;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.syncFrequency) {
      query.syncFrequency = filters.syncFrequency;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { provider: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await Integration.countDocuments(query);
    const integrations = await Integration.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      integrations,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Create integration
   */
  async createIntegration(integrationData: Partial<IIntegration>): Promise<IIntegration> {
    const integration = new Integration(integrationData);
    return await integration.save();
  }

  /**
   * Update integration
   */
  async updateIntegration(integrationId: string, updateData: Partial<IIntegration>): Promise<IIntegration> {
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    Object.assign(integration, updateData);
    return await integration.save();
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    await Integration.findByIdAndDelete(integrationId);
  }

  /**
   * Test integration connection
   */
  async testIntegration(integrationId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    details?: any;
  }> {
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const startTime = Date.now();

    try {
      let result: any;

      switch (integration.type) {
        case 'api':
          result = await this.testApiIntegration(integration);
          break;
        case 'webhook':
          result = await this.testWebhookIntegration(integration);
          break;
        case 'database':
          result = await this.testDatabaseIntegration(integration);
          break;
        default:
          throw new Error(`Integration type ${integration.type} not supported for testing`);
      }

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        details: result
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Execute integration sync
   */
  async executeSync(integrationId: string, manualTrigger: boolean = false): Promise<SyncResult> {
    const integration = await Integration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    if (!integration.isActive && !manualTrigger) {
      throw new Error('Integration is not active');
    }

    const startTime = Date.now();

    try {
      let result: SyncResult;

      switch (integration.type) {
        case 'api':
          result = await this.syncApiIntegration(integration);
          break;
        case 'database':
          result = await this.syncDatabaseIntegration(integration);
          break;
        case 'file_sync':
          result = await this.syncFileIntegration(integration);
          break;
        default:
          throw new Error(`Sync not supported for integration type: ${integration.type}`);
      }

      const duration = Date.now() - startTime;
      result.duration = duration;

      (integration as any).updateSyncStatistics(
        result.success,
        result.recordsProcessed,
        duration,
        result.error
      );

      await integration.save();

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      (integration as any).updateSyncStatistics(false, 0, duration, errorMessage);
      await integration.save();

      return {
        success: false,
        recordsProcessed: 0,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Process scheduled syncs
   */
  async processScheduledSyncs(): Promise<void> {
    const integrations = await Integration.find({
      isActive: true,
      syncFrequency: { $in: ['hourly', 'daily', 'weekly'] }
    });

    const syncPromises = integrations
      .filter(integration => (integration as any).shouldSync())
      .map(integration =>
        this.executeSync(integration._id.toString()).catch(error => {
          console.error(`Scheduled sync failed for integration ${integration._id}:`, error);
        })
      );

    await Promise.all(syncPromises);
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStatistics(
    integrationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
    successRate: number;
    recordsProcessed: number;
    syncsByType: Array<{ type: string; count: number }>;
    syncsByProvider: Array<{ provider: string; count: number }>;
  }> {
    const matchStage: any = {};

    if (integrationId) {
      matchStage._id = new Types.ObjectId(integrationId);
    }

    if (startDate || endDate) {
      matchStage.lastSync = {};
      if (startDate) {
        matchStage.lastSync.$gte = startDate;
      }
      if (endDate) {
        matchStage.lastSync.$lte = endDate;
      }
    }

    // Basic statistics
    const basicStats = await Integration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSyncs: { $sum: '$statistics.totalSyncs' },
          successfulSyncs: { $sum: '$statistics.successfulSyncs' },
          failedSyncs: { $sum: '$statistics.failedSyncs' },
          averageDuration: { $avg: '$statistics.lastSyncDuration' },
          recordsProcessed: { $sum: '$statistics.recordsProcessed' }
        }
      }
    ]);

    // Syncs by type
    const syncsByType = await Integration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: '$statistics.totalSyncs' }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Syncs by provider
    const syncsByProvider = await Integration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$provider',
          count: { $sum: '$statistics.totalSyncs' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          provider: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    const stats = basicStats[0] || {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageDuration: 0,
      recordsProcessed: 0
    };

    const successRate = stats.totalSyncs > 0
      ? (stats.successfulSyncs / stats.totalSyncs) * 100
      : 0;

    return {
      totalSyncs: stats.totalSyncs,
      successfulSyncs: stats.successfulSyncs,
      failedSyncs: stats.failedSyncs,
      averageDuration: Math.round(stats.averageDuration || 0),
      successRate: Math.round(successRate * 100) / 100,
      recordsProcessed: stats.recordsProcessed,
      syncsByType,
      syncsByProvider
    };
  }

  /**
   * Get available integration providers
   */
  getAvailableProviders(): IntegrationProvider[] {
    return [
      {
        name: 'Salesforce',
        type: 'api',
        description: 'Salesforce CRM integration',
        configurationSchema: {
          endpoint: { type: 'string', required: true },
          clientId: { type: 'string', required: true },
          clientSecret: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        supportedOperations: ['sync', 'webhook'],
        authenticationMethods: ['oauth2', 'username_password']
      },
      {
        name: 'HubSpot',
        type: 'api',
        description: 'HubSpot CRM integration',
        configurationSchema: {
          apiKey: { type: 'string', required: true },
          endpoint: { type: 'string', required: false }
        },
        supportedOperations: ['sync', 'webhook'],
        authenticationMethods: ['api_key']
      },
      {
        name: 'Zapier',
        type: 'webhook',
        description: 'Zapier automation platform',
        configurationSchema: {
          webhookUrl: { type: 'string', required: true }
        },
        supportedOperations: ['webhook'],
        authenticationMethods: ['none']
      },
      {
        name: 'PostgreSQL',
        type: 'database',
        description: 'PostgreSQL database integration',
        configurationSchema: {
          host: { type: 'string', required: true },
          port: { type: 'number', required: true },
          database: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        supportedOperations: ['sync'],
        authenticationMethods: ['username_password']
      },
      {
        name: 'MySQL',
        type: 'database',
        description: 'MySQL database integration',
        configurationSchema: {
          host: { type: 'string', required: true },
          port: { type: 'number', required: true },
          database: { type: 'string', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: true }
        },
        supportedOperations: ['sync'],
        authenticationMethods: ['username_password']
      },
      {
        name: 'SFTP',
        type: 'file_sync',
        description: 'SFTP file synchronization',
        configurationSchema: {
          host: { type: 'string', required: true },
          port: { type: 'number', required: true },
          username: { type: 'string', required: true },
          password: { type: 'string', required: false },
          privateKey: { type: 'string', required: false },
          remotePath: { type: 'string', required: true }
        },
        supportedOperations: ['sync'],
        authenticationMethods: ['username_password', 'ssh_key']
      }
    ];
  }

  /**
   * Test API integration
   */
  private async testApiIntegration(integration: IIntegration): Promise<any> {
    const config = integration.configuration;

    if (!config.endpoint) {
      throw new Error('API endpoint is required');
    }

    const headers: any = {
      'Content-Type': 'application/json',
      'User-Agent': 'PharmacyCopilot-Integration/1.0'
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await axios({
      method: 'GET',
      url: config.endpoint,
      headers,
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status >= 400) {
      throw new Error(`API test failed: HTTP ${response.status}`);
    }

    return {
      status: response.status,
      headers: response.headers,
      data: response.data
    };
  }

  /**
   * Test webhook integration
   */
  private async testWebhookIntegration(integration: IIntegration): Promise<any> {
    const config = integration.configuration;

    if (!config.endpoint) {
      throw new Error('Webhook endpoint is required');
    }

    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      integration: integration.name
    };

    const response = await axios({
      method: 'POST',
      url: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PharmacyCopilot-Integration/1.0'
      },
      data: testPayload,
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status >= 400) {
      throw new Error(`Webhook test failed: HTTP ${response.status}`);
    }

    return {
      status: response.status,
      responseTime: response.headers['x-response-time'] || 'N/A'
    };
  }

  /**
   * Test database integration
   */
  private async testDatabaseIntegration(integration: IIntegration): Promise<any> {
    // This would require database-specific drivers
    // For now, return a mock response
    return {
      connected: true,
      database: integration.configuration.settings.database,
      version: '1.0.0'
    };
  }

  /**
   * Sync API integration
   */
  private async syncApiIntegration(integration: IIntegration): Promise<SyncResult> {
    // Implementation would depend on the specific API
    // This is a simplified example
    const config = integration.configuration;

    const response = await axios({
      method: 'GET',
      url: `${config.endpoint}/data`,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const data = response.data;
    const records = Array.isArray(data) ? data : [data];

    // Apply mapping and filters
    const processedRecords = records
      .filter(record => this.applyFilters(record, integration.filters))
      .map(record => (integration as any).applyMapping(record));

    // Here you would save the processed records to your database
    // For now, we'll just return the count

    return {
      success: true,
      recordsProcessed: processedRecords.length,
      duration: 0, // Will be set by caller
      details: {
        totalRecords: records.length,
        processedRecords: processedRecords.length
      }
    };
  }

  /**
   * Sync database integration
   */
  private async syncDatabaseIntegration(integration: IIntegration): Promise<SyncResult> {
    // This would require database-specific implementation
    // For now, return a mock response
    return {
      success: true,
      recordsProcessed: 100,
      duration: 0,
      details: {
        query: 'SELECT * FROM users',
        rowsAffected: 100
      }
    };
  }

  /**
   * Sync file integration
   */
  private async syncFileIntegration(integration: IIntegration): Promise<SyncResult> {
    // This would require file system or SFTP implementation
    // For now, return a mock response
    return {
      success: true,
      recordsProcessed: 50,
      duration: 0,
      details: {
        filesProcessed: 5,
        totalSize: '1.2MB'
      }
    };
  }

  /**
   * Apply filters to record
   */
  private applyFilters(record: any, filters: any): boolean {
    if (!filters.conditions || filters.conditions.length === 0) {
      return true;
    }

    const conditionResults = filters.conditions.map((condition: any) => {
      const fieldValue = this.getNestedValue(record, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });

    if (filters.logicalOperator === 'AND') {
      return conditionResults.every(Boolean);
    } else {
      return conditionResults.some(Boolean);
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(expectedValue));
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      default:
        return false;
    }
  }
}

export default new IntegrationService();