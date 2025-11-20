import DeveloperAccount, { IDeveloperAccount } from '../models/DeveloperAccount';
import ApiDocumentation, { IApiDocumentation } from '../models/ApiDocumentation';
import SandboxSession, { ISandboxSession } from '../models/SandboxSession';
import ApiEndpoint from '../models/ApiEndpoint';
import ApiKey from '../models/ApiKey';
import { Types } from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';

export interface DeveloperAccountFilters {
  status?: string;
  subscriptionTier?: string;
  isVerified?: boolean;
  search?: string;
}

export interface DocumentationFilters {
  category?: string;
  difficulty?: string;
  tags?: string[];
  search?: string;
  isPublished?: boolean;
}

export interface SandboxFilters {
  developerId?: string;
  environment?: string;
  isActive?: boolean;
}

export interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  nextSteps: string[];
  progressPercentage: number;
  recommendations: string[];
}

export interface ApiTestRequest {
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  variables?: Record<string, any>;
}

export interface ApiTestResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  error?: string;
}

export class DeveloperPortalService {
  /**
   * Get developer accounts with filtering and pagination
   */
  async getDeveloperAccounts(
    filters: DeveloperAccountFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    accounts: IDeveloperAccount[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.subscriptionTier) {
      query.subscriptionTier = filters.subscriptionTier;
    }

    if (filters.isVerified !== undefined) {
      query.isVerified = filters.isVerified;
    }

    if (filters.search) {
      query.$or = [
        { companyName: { $regex: filters.search, $options: 'i' } },
        { contactEmail: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const total = await DeveloperAccount.countDocuments(query);
    const accounts = await DeveloperAccount.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      accounts,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Create or update developer account
   */
  async createOrUpdateDeveloperAccount(
    userId: string,
    accountData: Partial<IDeveloperAccount>
  ): Promise<IDeveloperAccount> {
    const existingAccount = await DeveloperAccount.findOne({ userId: new Types.ObjectId(userId) });

    if (existingAccount) {
      Object.assign(existingAccount, accountData);
      return await existingAccount.save();
    } else {
      const account = new DeveloperAccount({
        ...accountData,
        userId: new Types.ObjectId(userId)
      });
      return await account.save();
    }
  }

  /**
   * Get developer account by user ID
   */
  async getDeveloperAccountByUserId(userId: string): Promise<IDeveloperAccount | null> {
    return await DeveloperAccount.findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'email firstName lastName');
  }

  /**
   * Verify developer account email
   */
  async verifyDeveloperAccount(token: string): Promise<IDeveloperAccount> {
    const account = await DeveloperAccount.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!account) {
      throw new Error('Invalid or expired verification token');
    }

    account.isVerified = true;
    account.status = 'active';
    account.onboardingSteps.emailVerification = true;
    account.verificationToken = undefined;
    account.verificationTokenExpires = undefined;

    return await account.save();
  }

  /**
   * Generate verification token
   */
  async generateVerificationToken(userId: string): Promise<string> {
    const account = await DeveloperAccount.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new Error('Developer account not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    account.verificationToken = token;
    account.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await account.save();
    return token;
  }

  /**
   * Get onboarding progress
   */
  async getOnboardingProgress(userId: string): Promise<OnboardingProgress> {
    const account = await DeveloperAccount.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new Error('Developer account not found');
    }

    const steps = account.onboardingSteps;
    const completedSteps: string[] = [];
    const nextSteps: string[] = [];
    const recommendations: string[] = [];

    // Check completed steps
    if (steps.profileSetup) completedSteps.push('profileSetup');
    if (steps.emailVerification) completedSteps.push('emailVerification');
    if (steps.firstApiKey) completedSteps.push('firstApiKey');
    if (steps.firstApiCall) completedSteps.push('firstApiCall');
    if (steps.documentationRead) completedSteps.push('documentationRead');

    // Determine next steps
    if (!steps.profileSetup) {
      nextSteps.push('profileSetup');
      recommendations.push('Complete your profile with company information');
    } else if (!steps.emailVerification) {
      nextSteps.push('emailVerification');
      recommendations.push('Verify your email address to activate your account');
    } else if (!steps.firstApiKey) {
      nextSteps.push('firstApiKey');
      recommendations.push('Create your first API key to start making requests');
    } else if (!steps.firstApiCall) {
      nextSteps.push('firstApiCall');
      recommendations.push('Make your first API call using the sandbox environment');
    } else if (!steps.documentationRead) {
      nextSteps.push('documentationRead');
      recommendations.push('Explore our API documentation and tutorials');
    }

    const progressPercentage = (account as any).checkOnboardingProgress();
    const currentStep = nextSteps[0] || 'completed';

    return {
      currentStep,
      completedSteps,
      nextSteps,
      progressPercentage,
      recommendations
    };
  }

  /**
   * Update onboarding step
   */
  async updateOnboardingStep(userId: string, step: string, completed: boolean = true): Promise<void> {
    const account = await DeveloperAccount.findOne({ userId: new Types.ObjectId(userId) });
    if (!account) {
      throw new Error('Developer account not found');
    }

    if (step in account.onboardingSteps) {
      (account.onboardingSteps as any)[step] = completed;

      // Check if all steps are completed
      const allCompleted = Object.values(account.onboardingSteps).every(Boolean);
      account.onboardingCompleted = allCompleted;

      await account.save();
    }
  }

  /**
   * Get API documentation with filtering
   */
  async getApiDocumentation(
    filters: DocumentationFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    documentation: IApiDocumentation[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.isPublished !== undefined) {
      query.isPublished = filters.isPublished;
    } else {
      query.isPublished = true; // Default to published only
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.difficulty) {
      query.difficulty = filters.difficulty;
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const skip = (page - 1) * limit;
    const total = await ApiDocumentation.countDocuments(query);
    const documentation = await ApiDocumentation.find(query)
      .populate('endpointId')
      .populate('relatedEndpoints')
      .sort(filters.search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      documentation,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get documentation by endpoint ID
   */
  async getDocumentationByEndpoint(endpointId: string): Promise<IApiDocumentation | null> {
    return await ApiDocumentation.findOne({
      endpointId: new Types.ObjectId(endpointId),
      isPublished: true
    })
      .populate('endpointId')
      .populate('relatedEndpoints');
  }

  /**
   * Create or update API documentation
   */
  async createOrUpdateDocumentation(
    endpointId: string,
    docData: Partial<IApiDocumentation>
  ): Promise<IApiDocumentation> {
    const existingDoc = await ApiDocumentation.findOne({
      endpointId: new Types.ObjectId(endpointId)
    });

    if (existingDoc) {
      Object.assign(existingDoc, docData);
      return await existingDoc.save();
    } else {
      const documentation = new ApiDocumentation({
        ...docData,
        endpointId: new Types.ObjectId(endpointId)
      });
      return await documentation.save();
    }
  }

  /**
   * Create sandbox session
   */
  async createSandboxSession(
    developerId: string,
    sessionData: Partial<ISandboxSession>
  ): Promise<ISandboxSession> {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = new SandboxSession({
      ...sessionData,
      developerId: new Types.ObjectId(developerId),
      sessionId,
      expiresAt
    });

    return await session.save();
  }

  /**
   * Get sandbox sessions
   */
  async getSandboxSessions(
    filters: SandboxFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    sessions: ISandboxSession[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: any = {};

    if (filters.developerId) {
      query.developerId = new Types.ObjectId(filters.developerId);
    }

    if (filters.environment) {
      query.environment = filters.environment;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const skip = (page - 1) * limit;
    const total = await SandboxSession.countDocuments(query);
    const sessions = await SandboxSession.find(query)
      .populate('developerId')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit);

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get sandbox session by ID
   */
  async getSandboxSession(sessionId: string): Promise<ISandboxSession | null> {
    return await SandboxSession.findOne({ sessionId, isActive: true })
      .populate('developerId');
  }

  /**
   * Execute API test in sandbox
   */
  async executeApiTest(
    sessionId: string,
    testRequest: ApiTestRequest
  ): Promise<ApiTestResponse> {
    const session = await SandboxSession.findOne({ sessionId, isActive: true });
    if (!session) {
      throw new Error('Sandbox session not found or expired');
    }

    if ((session as any).isExpired()) {
      throw new Error('Sandbox session has expired');
    }

    const startTime = Date.now();
    let response: ApiTestResponse;

    try {
      // Replace variables in the request
      let processedRequest = this.processRequestVariables(testRequest, session.variables);

      // Add request to session
      const requestId = (session as any).addRequest({
        endpoint: processedRequest.endpoint,
        method: processedRequest.method,
        headers: processedRequest.headers || {},
        body: processedRequest.body
      });

      // Make the actual API call to sandbox environment
      const axiosConfig = {
        method: processedRequest.method.toLowerCase() as any,
        url: `${session.configuration.baseUrl}${processedRequest.endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Sandbox-Session': sessionId,
          ...processedRequest.headers
        },
        data: processedRequest.body,
        timeout: session.configuration.timeout,
        validateStatus: () => true // Don't throw on HTTP error status
      };

      const axiosResponse = await axios(axiosConfig);
      const responseTime = Date.now() - startTime;

      response = {
        requestId,
        statusCode: axiosResponse.status,
        headers: axiosResponse.headers as any,
        body: axiosResponse.data,
        responseTime
      };

      // Update request with response
      (session as any).updateRequest(requestId, {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        responseTime: response.responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      response = {
        requestId: '',
        statusCode: 0,
        headers: {},
        body: null,
        responseTime,
        error: errorMessage
      };

      // Add error to session if we have a request ID
      if (response.requestId) {
        (session as any).setError(response.requestId, errorMessage);
      }
    }

    await session.save();
    return response;
  }

  /**
   * Get API key management for developer
   */
  async getDeveloperApiKeys(developerId: string): Promise<any[]> {
    const account = await DeveloperAccount.findById(developerId);
    if (!account) {
      throw new Error('Developer account not found');
    }

    return await ApiKey.find({
      userId: account.userId,
      isActive: true
    }).select('-hashedKey'); // Don't return the hashed key
  }

  /**
   * Generate code examples for endpoint
   */
  generateCodeExamples(endpoint: any, apiKey: string): Record<string, string> {
    const examples: Record<string, string> = {};
    const url = `${process.env.API_BASE_URL || 'https://api.PharmacyCopilot.com'}${endpoint.path}`;
    const method = endpoint.method;

    // JavaScript/Node.js example
    examples.javascript = `
const axios = require('axios');

const response = await axios({
  method: '${method}',
  url: '${url}',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  }${method !== 'GET' ? ',\n  data: {\n    // Your request body here\n  }' : ''}
});

console.log(response.data);
    `.trim();

    // Python example
    examples.python = `
import requests

headers = {
    'Authorization': f'Bearer ${apiKey}',
    'Content-Type': 'application/json'
}

${method !== 'GET' ? 'data = {\n    # Your request body here\n}\n\n' : ''}response = requests.${method.toLowerCase()}('${url}', headers=headers${method !== 'GET' ? ', json=data' : ''})
print(response.json())
    `.trim();

    // cURL example
    examples.curl = `
curl -X ${method} '${url}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json'${method !== 'GET' ? ' \\\n  -d \'{\n    "key": "value"\n  }\'' : ''}
    `.trim();

    return examples;
  }

  /**
   * Process request variables
   */
  private processRequestVariables(
    request: ApiTestRequest,
    variables: Record<string, any>
  ): ApiTestRequest {
    const processedRequest = { ...request };

    // Replace variables in URL
    processedRequest.endpoint = this.replaceVariables(request.endpoint, variables);

    // Replace variables in headers
    if (request.headers) {
      processedRequest.headers = {};
      Object.entries(request.headers).forEach(([key, value]) => {
        processedRequest.headers![key] = this.replaceVariables(value, variables);
      });
    }

    // Replace variables in body
    if (request.body) {
      processedRequest.body = this.replaceVariablesInObject(request.body, variables);
    }

    return processedRequest;
  }

  /**
   * Replace variables in string
   */
  private replaceVariables(str: string, variables: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? String(variables[varName]) : match;
    });
  }

  /**
   * Replace variables in object
   */
  private replaceVariablesInObject(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, variables);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariablesInObject(item, variables));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      Object.entries(obj).forEach(([key, value]) => {
        result[key] = this.replaceVariablesInObject(value, variables);
      });
      return result;
    }
    return obj;
  }

  /**
   * Get documentation categories
   */
  async getDocumentationCategories(): Promise<string[]> {
    const categories = await ApiDocumentation.distinct('category', { isPublished: true });
    return categories.sort();
  }

  /**
   * Get documentation tags
   */
  async getDocumentationTags(): Promise<string[]> {
    const tags = await ApiDocumentation.distinct('tags', { isPublished: true });
    return tags.sort();
  }
}

export default new DeveloperPortalService();