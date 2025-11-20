import axios, { AxiosResponse } from 'axios';
import logger from '../utils/logger';
import { z } from 'zod';
import {
  symptomDataSchema,
  vitalSignsSchema,
  medicationEntrySchema,
} from '../modules/diagnostics/validators/diagnosticValidators';
import fs from 'fs/promises';
import path from 'path';
import AIUsageTrackingService from './AIUsageTrackingService';

export type ISymptomData = z.infer<typeof symptomDataSchema>;
export type VitalSigns = z.infer<typeof vitalSignsSchema>;
export type MedicationEntry = z.infer<typeof medicationEntrySchema>;

export interface LabResult {
  testName: string;
  value: string;
  referenceRange: string;
  abnormal?: boolean;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

enum ModelTier {
  PRIMARY = 'deepseek/deepseek-chat-v3.1',
  FALLBACK = 'deepseek/deepseek-chat-v3.1',
  CRITICAL = 'google/gemma-2-9b-it'
}

interface ModelConfig {
  name: string;
  maxTokens: number;
  temperature: number;
  costPerInputToken: number;
  costPerOutputToken: number;
}

interface UsageTracking {
  month: string;
  totalCost: number;
  requestCount: number;
  modelUsage: {
    [key: string]: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };
  };
}

interface CaseComplexity {
  score: number;
  factors: string[];
  isCritical: boolean;
  recommendedModel: ModelTier;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: OpenRouterUsage;
}

export interface DiagnosticInput {
  symptoms: ISymptomData;
  labResults?: LabResult[];
  currentMedications?: MedicationEntry[];
  vitalSigns?: VitalSigns;
  patientAge?: number;
  patientGender?: string;
  allergies?: string[];
  medicalHistory?: string[];
  workplaceId?: string;
}

interface DiagnosticResponse {
  differentialDiagnoses: {
    condition: string;
    probability: number;
    reasoning: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  recommendedTests: {
    testName: string;
    priority: 'urgent' | 'routine' | 'optional';
    reasoning: string;
  }[];
  therapeuticOptions: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    reasoning: string;
    safetyNotes: string[];
  }[];
  redFlags: {
    flag: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    action: string;
  }[];
  referralRecommendation?: {
    recommended: boolean;
    urgency: 'immediate' | 'within_24h' | 'routine';
    specialty: string;
    reason: string;
  };
  disclaimer: string;
  confidenceScore: number;
}

class OpenRouterService {
  private baseURL: string;
  private apiKey: string;
  private timeout: number;
  private retryConfig: RetryConfig;
  private monthlyBudgetLimit: number;
  private usageFilePath: string;
  private models: Map<ModelTier, ModelConfig>;

  constructor() {
    this.baseURL =
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.timeout = 180000; // 3 minutes timeout
    this.monthlyBudgetLimit = parseFloat(process.env.OPENROUTER_MONTHLY_BUDGET || '15'); // $15 default
    this.usageFilePath = path.join(process.cwd(), 'data', 'openrouter-usage.json');

    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffMultiplier: 2,
    };

    // Initialize model configurations
    this.models = new Map([
      [ModelTier.PRIMARY, {
        name: 'deepseek/deepseek-chat-v3.1', // Use paid version as primary (very cheap)
        maxTokens: 4000,
        temperature: 0.1,
        costPerInputToken: 0.20 / 1000000, // $0.20 per 1M tokens
        costPerOutputToken: 0.80 / 1000000  // $0.80 per 1M tokens
      }],
      [ModelTier.FALLBACK, {
        name: 'deepseek/deepseek-chat-v3.1',
        maxTokens: 4000,
        temperature: 0.1,
        costPerInputToken: 0.20 / 1000000, // $0.20 per 1M tokens
        costPerOutputToken: 0.80 / 1000000  // $0.80 per 1M tokens
      }],
      [ModelTier.CRITICAL, {
        name: 'google/gemma-2-9b-it',
        maxTokens: 6000,
        temperature: 0.15,
        costPerInputToken: 0.03 / 1000000, // $0.03 per 1M tokens
        costPerOutputToken: 0.09 / 1000000  // $0.09 per 1M tokens
      }]
    ]);

    if (!this.apiKey) {
      logger.error('OpenRouter API key not configured');
      throw new Error('OpenRouter API key is required');
    }

    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Generate structured medical diagnostic analysis with hybrid model selection
   */
  async generateDiagnosticAnalysis(
    input: DiagnosticInput,
    context?: {
      workspaceId?: string;
      userId?: string;
      feature?: string;
      patientId?: string;
      caseId?: string;
    }
  ): Promise<{
    analysis: DiagnosticResponse;
    usage: OpenRouterUsage;
    requestId: string;
    processingTime: number;
    modelUsed: string;
    costEstimate: number;
  }> {
    const startTime = Date.now();

    try {
      // Check budget before processing
      const canUsePaidModels = await this.checkBudgetLimit();

      // Analyze case complexity
      const complexity = this.analyzeCaseComplexity(input);

      // Select appropriate model based on complexity and budget
      const selectedModel = this.selectModel(complexity, canUsePaidModels);
      const modelConfig = this.models.get(selectedModel)!;

      logger.info('Starting diagnostic analysis', {
        complexityScore: complexity.score,
        isCritical: complexity.isCritical,
        selectedModel: modelConfig.name,
        budgetRemaining: canUsePaidModels,
        factors: complexity.factors
      });

      const systemPrompt = this.createSystemPrompt();
      const userPrompt = this.formatDiagnosticPrompt(input);

      const request: OpenRouterRequest = {
        model: modelConfig.name,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        top_p: 0.9,
      };

      const response = await this.executeWithModelFallback(request, selectedModel, canUsePaidModels);
      const processingTime = Date.now() - startTime;

      const message = response.data.choices?.[0]?.message;
      if (!message?.content) {
        throw new Error('No response generated from AI model or content is empty');
      }

      const aiContent = message.content;
      const analysis = this.parseAndValidateAIResponse(aiContent);

      // Calculate cost and track usage
      const costEstimate = this.calculateCost(response.data.usage, response.data.model);
      await this.trackUsage(response.data.model, response.data.usage, costEstimate);

      // Track usage in new AI monitoring system
      if (context?.workspaceId && context?.userId) {
        try {
          const aiUsageService = AIUsageTrackingService.getInstance();
          await aiUsageService.recordUsage({
            workspaceId: context.workspaceId,
            userId: context.userId,
            feature: context.feature || 'ai_diagnostics',
            aiModel: response.data.model,
            requestType: 'analysis',
            inputTokens: response.data.usage.prompt_tokens,
            outputTokens: response.data.usage.completion_tokens,
            cost: costEstimate,
            requestDuration: processingTime,
            success: true,
            metadata: {
              patientId: context.patientId,
              caseId: context.caseId,
              complexity: complexity.isCritical ? 'critical' :
                complexity.score >= 30 ? 'high' :
                  complexity.score >= 15 ? 'medium' : 'low',
              requestId: response.data.id,
              complexityScore: complexity.score,
              factors: complexity.factors,
            },
          });
        } catch (trackingError) {
          logger.error('Failed to record AI usage tracking', {
            error: trackingError instanceof Error ? trackingError.message : 'Unknown error',
            workspaceId: context.workspaceId,
            userId: context.userId,
          });
          // Don't fail the main request if tracking fails
        }
      }

      logger.info('Diagnostic analysis completed', {
        requestId: response.data.id,
        processingTime,
        tokensUsed: response.data.usage.total_tokens,
        modelUsed: response.data.model,
        costEstimate: costEstimate.toFixed(6),
        complexityScore: complexity.score
      });

      return {
        analysis,
        usage: response.data.usage,
        requestId: response.data.id,
        processingTime,
        modelUsed: response.data.model,
        costEstimate
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const enhancedError = this.enhanceError(error);

      // Track failed usage in new AI monitoring system
      if (context?.workspaceId && context?.userId) {
        try {
          const aiUsageService = AIUsageTrackingService.getInstance();
          await aiUsageService.recordUsage({
            workspaceId: context.workspaceId,
            userId: context.userId,
            feature: context.feature || 'ai_diagnostics',
            aiModel: 'unknown',
            requestType: 'analysis',
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            requestDuration: processingTime,
            success: false,
            errorMessage: enhancedError.message,
            metadata: {
              patientId: context.patientId,
              caseId: context.caseId,
              statusCode: enhancedError.statusCode,
            },
          });
        } catch (trackingError) {
          logger.error('Failed to record AI usage tracking for error', {
            error: trackingError instanceof Error ? trackingError.message : 'Unknown error',
            workspaceId: context.workspaceId,
            userId: context.userId,
          });
        }
      }

      logger.error('OpenRouter API error', {
        error: enhancedError.message,
        statusCode: enhancedError.statusCode,
        responseData: enhancedError.responseData,
        processingTime,
        apiKey: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT_SET',
        baseURL: this.baseURL,
      });

      throw new Error(`AI diagnostic analysis failed: ${enhancedError.message}`);
    }
  }

  /**
   * Analyze case complexity to determine appropriate model
   */
  private analyzeCaseComplexity(input: DiagnosticInput): CaseComplexity {
    let score = 0;
    const factors: string[] = [];

    // Age factor (elderly patients are more complex)
    if (input.patientAge && input.patientAge >= 65) {
      score += 15;
      factors.push('elderly patient (65+)');
    }

    // Multiple symptoms complexity
    const totalSymptoms = (input.symptoms.subjective?.length || 0) + (input.symptoms.objective?.length || 0);
    if (totalSymptoms >= 4) {
      score += 20;
      factors.push(`multiple symptoms (${totalSymptoms})`);
    }

    // Vital signs abnormalities
    let abnormalVitals = 0;
    if (input.vitalSigns) {
      // Check for abnormal blood pressure
      if (input.vitalSigns.bloodPressure) {
        const bp = input.vitalSigns.bloodPressure.toLowerCase();
        if (bp.includes('high') || bp.includes('low') || bp.includes('hyper') || bp.includes('hypo')) {
          abnormalVitals++;
        }
        // Parse numeric BP values
        const bpMatch = bp.match(/(\d+)\/(\d+)/);
        if (bpMatch) {
          const systolic = parseInt(bpMatch[1]);
          const diastolic = parseInt(bpMatch[2]);
          if (systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60) {
            abnormalVitals++;
          }
        }
      }

      // Check temperature
      if (input.vitalSigns.temperature && (input.vitalSigns.temperature > 38.5 || input.vitalSigns.temperature < 35)) {
        abnormalVitals++;
      }

      // Check heart rate
      if (input.vitalSigns.heartRate && (input.vitalSigns.heartRate > 100 || input.vitalSigns.heartRate < 60)) {
        abnormalVitals++;
      }

      // Check oxygen saturation
      if (input.vitalSigns.oxygenSaturation && input.vitalSigns.oxygenSaturation < 95) {
        abnormalVitals++;
      }
    }

    if (abnormalVitals >= 2) {
      score += 25;
      factors.push(`multiple abnormal vitals (${abnormalVitals})`);
    }

    // Laboratory results complexity
    const abnormalLabs = input.labResults?.filter(lab => lab.abnormal)?.length || 0;
    if (abnormalLabs >= 2) {
      score += 20;
      factors.push(`abnormal lab results (${abnormalLabs})`);
    }

    // Medication complexity (polypharmacy)
    const medicationCount = input.currentMedications?.length || 0;
    if (medicationCount >= 3) {
      score += 15;
      factors.push(`polypharmacy (${medicationCount} medications)`);
    }

    // Red flag symptoms (critical indicators)
    const redFlagSymptoms = [
      'chest pain', 'difficulty breathing', 'shortness of breath', 'severe headache',
      'confusion', 'altered mental status', 'seizure', 'stroke', 'heart attack',
      'severe abdominal pain', 'blood in stool', 'blood in urine', 'severe allergic reaction'
    ];

    const allSymptoms = [
      ...(input.symptoms.subjective || []),
      ...(input.symptoms.objective || [])
    ].join(' ').toLowerCase();

    const redFlagsFound = redFlagSymptoms.filter(flag => allSymptoms.includes(flag));
    if (redFlagsFound.length > 0) {
      score += 30;
      factors.push(`red flag symptoms: ${redFlagsFound.join(', ')}`);
    }

    // Medical history complexity
    const historyCount = input.medicalHistory?.length || 0;
    if (historyCount >= 3) {
      score += 10;
      factors.push(`complex medical history (${historyCount} conditions)`);
    }

    // Determine if case is critical (should use best model)
    const isCritical = score >= 50 || redFlagsFound.length > 0 || abnormalVitals >= 3;

    // Recommend model based on complexity
    let recommendedModel: ModelTier;
    if (isCritical) {
      recommendedModel = ModelTier.CRITICAL;
    } else if (score >= 30) {
      recommendedModel = ModelTier.FALLBACK;
    } else {
      recommendedModel = ModelTier.PRIMARY;
    }

    return {
      score,
      factors,
      isCritical,
      recommendedModel
    };
  }

  /**
   * Select appropriate model based on complexity and budget constraints
   */
  private selectModel(complexity: CaseComplexity, canUsePaidModels: boolean): ModelTier {
    // If budget is exceeded, force free model
    if (!canUsePaidModels) {
      logger.warn('Monthly budget limit reached, using free model only', {
        complexityScore: complexity.score,
        recommendedModel: complexity.recommendedModel
      });
      return ModelTier.PRIMARY;
    }

    // Use complexity-based recommendation
    return complexity.recommendedModel;
  }

  /**
   * Execute request with automatic model fallback
   */
  private async executeWithModelFallback(
    request: OpenRouterRequest,
    selectedModel: ModelTier,
    canUsePaidModels: boolean
  ): Promise<AxiosResponse<OpenRouterResponse>> {
    const modelsToTry = this.getModelFallbackChain(selectedModel, canUsePaidModels);

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelTier = modelsToTry[i];
      const modelConfig = this.models.get(modelTier)!;

      try {
        const requestWithModel = {
          ...request,
          model: modelConfig.name,
          max_tokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature
        };

        logger.info(`Attempting request with model: ${modelConfig.name}`, {
          attempt: i + 1,
          totalModels: modelsToTry.length
        });

        return await this.executeWithRetry(async () => {
          return await axios.post<OpenRouterResponse>(
            `${this.baseURL}/chat/completions`,
            requestWithModel,
            {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
                'X-Title': 'PharmacyCopilot SaaS - AI Diagnostic Module',
              },
              timeout: this.timeout,
            }
          );
        });

      } catch (error) {
        const isLastModel = i === modelsToTry.length - 1;
        const isRateLimit = this.isRateLimitError(error);

        if (isRateLimit && !isLastModel) {
          logger.warn(`Rate limit hit for ${modelConfig.name}, trying next model`, {
            currentModel: modelConfig.name,
            nextModel: this.models.get(modelsToTry[i + 1])?.name
          });
          continue;
        }

        if (isLastModel) {
          throw error;
        }

        // For other errors, try next model
        logger.warn(`Error with ${modelConfig.name}, trying next model`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          currentModel: modelConfig.name,
          nextModel: this.models.get(modelsToTry[i + 1])?.name
        });
      }
    }

    throw new Error('All model fallbacks failed');
  }

  /**
   * Get model fallback chain based on selected model and budget
   */
  private getModelFallbackChain(selectedModel: ModelTier, canUsePaidModels: boolean): ModelTier[] {
    if (!canUsePaidModels) {
      // If budget exceeded, still use cheapest paid model for critical cases
      logger.warn('Budget exceeded but continuing with minimal cost models');
      return [ModelTier.PRIMARY]; // Use DeepSeek paid (very cheap)
    }

    switch (selectedModel) {
      case ModelTier.CRITICAL:
        return [ModelTier.CRITICAL, ModelTier.PRIMARY]; // Gemma -> DeepSeek
      case ModelTier.FALLBACK:
        return [ModelTier.PRIMARY]; // Just DeepSeek
      case ModelTier.PRIMARY:
      default:
        return [ModelTier.PRIMARY]; // DeepSeek paid
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error?.response?.status === 429;
  }

  /**
   * Execute a function with retry logic for transient failures
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = this.shouldRetryError(error);

      if (shouldRetry && attempt <= this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(attempt);

        logger.warn(`OpenRouter request failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries: this.retryConfig.maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.sleep(delay);
        return this.executeWithRetry(operation, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryError(error: any): boolean {
    // Don't retry on authentication errors or client errors
    if (error?.response?.status) {
      const status = error.response.status;
      // Retry on server errors (5xx) and rate limiting (429)
      return status >= 500 || status === 429;
    }

    // Retry on network errors (no response)
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhance error information for better debugging
   */
  private enhanceError(error: any): {
    message: string;
    statusCode: number | null;
    responseData: string;
  } {
    let errorMessage = 'Unknown error';
    let statusCode: number | null = null;
    let responseData = 'N/A';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check if it's an axios error with response data
      if ('response' in error && error.response) {
        const axiosError = error as any;
        if (axiosError.response && axiosError.response.status) {
          statusCode = parseInt(axiosError.response.status, 10);
        }
        responseData = JSON.stringify(axiosError.response.data);

        // Specific error handling for common OpenRouter issues
        if (statusCode) {
          if (statusCode === 401) {
            errorMessage = 'Invalid or missing OpenRouter API key';
          } else if (statusCode === 402) {
            errorMessage = 'OpenRouter API quota exceeded or payment required';
          } else if (statusCode === 429) {
            errorMessage = 'OpenRouter API rate limit exceeded';
          } else if (statusCode >= 500) {
            errorMessage = 'OpenRouter API server error';
          }
        }
      }
    }

    return { message: errorMessage, statusCode, responseData };
  }

  /**
   * Create system prompt for medical diagnostic AI
   */
  private createSystemPrompt(): string {
    return `You are an expert medical AI assistant designed to help pharmacists with diagnostic evaluations. Your role is to:

1. Analyze patient symptoms, vital signs, lab results, and medication history
2. Provide differential diagnoses with probability assessments
3. Recommend appropriate laboratory investigations
4. Suggest evidence-based therapeutic options
5. Identify red flags requiring immediate medical attention
6. Recommend specialist referrals when appropriate

IMPORTANT GUIDELINES:
- Always provide structured JSON output as specified
- Include appropriate medical disclaimers
- Consider drug interactions and contraindications
- Prioritize patient safety over convenience
- Use evidence-based medicine principles
- Be conservative in recommendations
- Always recommend physician consultation for serious conditions

Your response must be valid JSON in this exact format:
{
  "differentialDiagnoses": [
    {
      "condition": "string",
      "probability": number (0-100),
      "reasoning": "string",
      "severity": "low|medium|high"
    }
  ],
  "recommendedTests": [
    {
      "testName": "string",
      "priority": "urgent|routine|optional",
      "reasoning": "string"
    }
  ],
  "therapeuticOptions": [
    {
      "medication": "string",
      "dosage": "string",
      "frequency": "string",
      "duration": "string",
      "reasoning": "string",
      "safetyNotes": ["string"]
    }
  ],
  "redFlags": [
    {
      "flag": "string",
      "severity": "low|medium|high|critical",
      "action": "string"
    }
  ],
  "referralRecommendation": {
    "recommended": boolean,
    "urgency": "immediate|within_24h|routine",
    "specialty": "string",
    "reason": "string"
  },
  "disclaimer": "This AI-generated analysis is for pharmacist consultation only and does not replace professional medical diagnosis. Final clinical decisions must always be made by qualified healthcare professionals.",
  "confidenceScore": number (0-100)
}`;
  }

  /**
   * Format diagnostic input into structured prompt
   */
  private formatDiagnosticPrompt(input: DiagnosticInput): string {
    let prompt = `PATIENT PRESENTATION FOR DIAGNOSTIC ANALYSIS:\n\n`;

    // Patient Demographics
    if (input.patientAge || input.patientGender) {
      prompt += `PATIENT DEMOGRAPHICS:\n`;
      if (input.patientAge) prompt += `- Age: ${input.patientAge} years\n`;
      if (input.patientGender) prompt += `- Gender: ${input.patientGender}\n`;
      prompt += `\n`;
    }

    // Symptoms
    prompt += `PRESENTING SYMPTOMS:\n`;
    prompt += `- Onset: ${input.symptoms.onset}\n`;
    prompt += `- Duration: ${input.symptoms.duration}\n`;
    prompt += `- Severity: ${input.symptoms.severity}\n`;

    if (input.symptoms.subjective.length > 0) {
      prompt += `- Subjective complaints: ${input.symptoms.subjective.join(', ')}\n`;
    }

    if (input.symptoms.objective.length > 0) {
      prompt += `- Objective findings: ${input.symptoms.objective.join(', ')}\n`;
    }
    prompt += `\n`;

    // Vital Signs
    if (input.vitalSigns) {
      prompt += `VITAL SIGNS:\n`;
      if (input.vitalSigns.bloodPressure)
        prompt += `- Blood Pressure: ${input.vitalSigns.bloodPressure}\n`;
      if (input.vitalSigns.heartRate)
        prompt += `- Heart Rate: ${input.vitalSigns.heartRate} bpm\n`;
      if (input.vitalSigns.temperature)
        prompt += `- Temperature: ${input.vitalSigns.temperature}°C\n`;
      if (input.vitalSigns.respiratoryRate)
        prompt += `- Respiratory Rate: ${input.vitalSigns.respiratoryRate} breaths/min\n`;
      if (input.vitalSigns.oxygenSaturation)
        prompt += `- Oxygen Saturation: ${input.vitalSigns.oxygenSaturation}%\n`;
      prompt += `\n`;
    }

    // Lab Results
    if (input.labResults && input.labResults.length > 0) {
      prompt += `LABORATORY RESULTS:\n`;
      input.labResults.forEach((lab) => {
        prompt += `- ${lab.testName}: ${lab.value} (Reference: ${lab.referenceRange})${lab.abnormal ? ' [ABNORMAL]' : ''}\n`;
      });
      prompt += `\n`;
    }

    // Current Medications
    if (input.currentMedications && input.currentMedications.length > 0) {
      prompt += `CURRENT MEDICATIONS:\n`;
      input.currentMedications.forEach((med) => {
        prompt += `- ${med.name} ${med.dosage} ${med.frequency}\n`;
      });
      prompt += `\n`;
    }

    // Allergies
    if (input.allergies && input.allergies.length > 0) {
      prompt += `KNOWN ALLERGIES:\n`;
      prompt += `- ${input.allergies.join(', ')}\n\n`;
    }

    // Medical History
    if (input.medicalHistory && input.medicalHistory.length > 0) {
      prompt += `MEDICAL HISTORY:\n`;
      prompt += `- ${input.medicalHistory.join(', ')}\n\n`;
    }

    prompt += `Please provide a comprehensive diagnostic analysis in the specified JSON format.`;

    return prompt;
  }

  /**
   * Parse and validate AI response with comprehensive error handling
   */
  private parseAndValidateAIResponse(content: string): DiagnosticResponse {
    try {
      // Extract JSON from response (handle cases where AI includes extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch?.[0]) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Comprehensive validation
      const validatedResponse = this.validateDiagnosticResponse(parsed);

      return validatedResponse;
    } catch (error) {
      logger.error('Failed to parse AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        content: content.substring(0, 500),
      });
      throw new Error('Failed to parse AI diagnostic response');
    }
  }

  /**
   * Comprehensive validation of diagnostic response structure
   */
  private validateDiagnosticResponse(parsed: any): DiagnosticResponse {
    const errors: string[] = [];

    // Validate differential diagnoses
    if (!parsed.differentialDiagnoses || !Array.isArray(parsed.differentialDiagnoses)) {
      errors.push('Missing or invalid differential diagnoses array');
    } else {
      parsed.differentialDiagnoses.forEach((diagnosis: any, index: number) => {
        if (!diagnosis.condition || typeof diagnosis.condition !== 'string') {
          errors.push(`Diagnosis ${index}: missing or invalid condition`);
        }
        if (typeof diagnosis.probability !== 'number' || diagnosis.probability < 0 || diagnosis.probability > 100) {
          errors.push(`Diagnosis ${index}: invalid probability (must be 0-100)`);
        }
        if (!diagnosis.reasoning || typeof diagnosis.reasoning !== 'string') {
          errors.push(`Diagnosis ${index}: missing or invalid reasoning`);
        }
        if (!['low', 'medium', 'high'].includes(diagnosis.severity)) {
          errors.push(`Diagnosis ${index}: invalid severity (must be low/medium/high)`);
        }
      });
    }

    // Validate recommended tests (optional but if present, must be valid)
    if (parsed.recommendedTests) {
      if (!Array.isArray(parsed.recommendedTests)) {
        errors.push('Recommended tests must be an array');
      } else {
        parsed.recommendedTests.forEach((test: any, index: number) => {
          if (!test.testName || typeof test.testName !== 'string') {
            errors.push(`Test ${index}: missing or invalid test name`);
          }
          if (!['urgent', 'routine', 'optional'].includes(test.priority)) {
            errors.push(`Test ${index}: invalid priority (must be urgent/routine/optional)`);
          }
          if (!test.reasoning || typeof test.reasoning !== 'string') {
            errors.push(`Test ${index}: missing or invalid reasoning`);
          }
        });
      }
    }

    // Validate therapeutic options (optional but if present, must be valid)
    if (parsed.therapeuticOptions) {
      if (!Array.isArray(parsed.therapeuticOptions)) {
        errors.push('Therapeutic options must be an array');
      } else {
        parsed.therapeuticOptions.forEach((option: any, index: number) => {
          if (!option.medication || typeof option.medication !== 'string') {
            errors.push(`Therapeutic option ${index}: missing or invalid medication`);
          }
          if (!option.dosage || typeof option.dosage !== 'string') {
            errors.push(`Therapeutic option ${index}: missing or invalid dosage`);
          }
          if (!option.frequency || typeof option.frequency !== 'string') {
            errors.push(`Therapeutic option ${index}: missing or invalid frequency`);
          }
          if (!option.reasoning || typeof option.reasoning !== 'string') {
            errors.push(`Therapeutic option ${index}: missing or invalid reasoning`);
          }
          if (option.safetyNotes && !Array.isArray(option.safetyNotes)) {
            errors.push(`Therapeutic option ${index}: safety notes must be an array`);
          }
        });
      }
    }

    // Validate red flags (optional but if present, must be valid)
    if (parsed.redFlags) {
      if (!Array.isArray(parsed.redFlags)) {
        errors.push('Red flags must be an array');
      } else {
        parsed.redFlags.forEach((flag: any, index: number) => {
          if (!flag.flag || typeof flag.flag !== 'string') {
            errors.push(`Red flag ${index}: missing or invalid flag description`);
          }
          if (!['low', 'medium', 'high', 'critical'].includes(flag.severity)) {
            errors.push(`Red flag ${index}: invalid severity (must be low/medium/high/critical)`);
          }
          if (!flag.action || typeof flag.action !== 'string') {
            errors.push(`Red flag ${index}: missing or invalid action`);
          }
        });
      }
    }

    // Validate referral recommendation (optional but if present, must be valid)
    if (parsed.referralRecommendation) {
      const ref = parsed.referralRecommendation;
      if (typeof ref.recommended !== 'boolean') {
        errors.push('Referral recommendation: recommended must be boolean');
      }
      if (ref.recommended) {
        if (!['immediate', 'within_24h', 'routine'].includes(ref.urgency)) {
          errors.push('Referral recommendation: invalid urgency (must be immediate/within_24h/routine)');
        }
        if (!ref.specialty || typeof ref.specialty !== 'string') {
          errors.push('Referral recommendation: missing or invalid specialty');
        }
        if (!ref.reason || typeof ref.reason !== 'string') {
          errors.push('Referral recommendation: missing or invalid reason');
        }
      }
    }

    // Validate confidence score
    if (typeof parsed.confidenceScore !== 'number' || parsed.confidenceScore < 0 || parsed.confidenceScore > 100) {
      // Set default if invalid
      parsed.confidenceScore = 75;
      logger.warn('Invalid confidence score, using default value of 75');
    }

    // Ensure disclaimer is present
    if (!parsed.disclaimer || typeof parsed.disclaimer !== 'string') {
      parsed.disclaimer =
        'This AI-generated analysis is for pharmacist consultation only and does not replace professional medical diagnosis. Final clinical decisions must always be made by qualified healthcare professionals.';
    }

    // If there are validation errors, throw them
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join('; ')}`);
    }

    // Set defaults for optional arrays if not present
    if (!parsed.recommendedTests) {
      parsed.recommendedTests = [];
    }
    if (!parsed.therapeuticOptions) {
      parsed.therapeuticOptions = [];
    }
    if (!parsed.redFlags) {
      parsed.redFlags = [];
    }

    return parsed as DiagnosticResponse;
  }

  /**
   * Calculate cost for API usage
   */
  private calculateCost(usage: OpenRouterUsage, modelName: string): number {
    // Find model config by name
    let modelConfig: ModelConfig | undefined;
    for (const config of this.models.values()) {
      if (config.name === modelName) {
        modelConfig = config;
        break;
      }
    }

    if (!modelConfig) {
      logger.warn(`Unknown model for cost calculation: ${modelName}`);
      return 0;
    }

    const inputCost = usage.prompt_tokens * modelConfig.costPerInputToken;
    const outputCost = usage.completion_tokens * modelConfig.costPerOutputToken;

    return inputCost + outputCost;
  }

  /**
   * Track API usage and costs
   */
  private async trackUsage(modelName: string, usage: OpenRouterUsage, cost: number): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      let usageData: UsageTracking;

      try {
        const data = await fs.readFile(this.usageFilePath, 'utf-8');
        usageData = JSON.parse(data);
      } catch {
        // File doesn't exist or is invalid, create new tracking data
        usageData = {
          month: currentMonth,
          totalCost: 0,
          requestCount: 0,
          modelUsage: {}
        };
      }

      // Reset if new month
      if (usageData.month !== currentMonth) {
        usageData = {
          month: currentMonth,
          totalCost: 0,
          requestCount: 0,
          modelUsage: {}
        };
      }

      // Update usage data
      usageData.totalCost += cost;
      usageData.requestCount += 1;

      if (!usageData.modelUsage[modelName]) {
        usageData.modelUsage[modelName] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0
        };
      }

      const modelUsage = usageData.modelUsage[modelName];
      modelUsage.requests += 1;
      modelUsage.inputTokens += usage.prompt_tokens;
      modelUsage.outputTokens += usage.completion_tokens;
      modelUsage.cost += cost;

      // Save updated usage data
      await fs.writeFile(this.usageFilePath, JSON.stringify(usageData, null, 2));

      logger.info('Usage tracked', {
        model: modelName,
        cost: cost.toFixed(6),
        monthlyTotal: usageData.totalCost.toFixed(6),
        requestCount: usageData.requestCount
      });

    } catch (error) {
      logger.error('Failed to track usage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if monthly budget limit has been reached
   */
  private async checkBudgetLimit(): Promise<boolean> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      try {
        const data = await fs.readFile(this.usageFilePath, 'utf-8');
        const usageData: UsageTracking = JSON.parse(data);

        // If different month, budget is available
        if (usageData.month !== currentMonth) {
          return true;
        }

        const budgetUsed = (usageData.totalCost / this.monthlyBudgetLimit) * 100;
        const canUsePaid = usageData.totalCost < this.monthlyBudgetLimit;

        logger.info('Budget check', {
          monthlyLimit: this.monthlyBudgetLimit,
          currentUsage: usageData.totalCost.toFixed(6),
          budgetUsedPercent: budgetUsed.toFixed(1),
          canUsePaidModels: canUsePaid
        });

        return canUsePaid;
      } catch {
        // No usage file exists, budget is available
        return true;
      }
    } catch (error) {
      logger.error('Budget check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // On error, allow paid models (fail open)
      return true;
    }
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(): Promise<UsageTracking | null> {
    try {
      const data = await fs.readFile(this.usageFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      const dataDir = path.dirname(this.usageFilePath);
      await fs.mkdir(dataDir, { recursive: true });
      logger.info('Data directory ensured', { path: dataDir });
    } catch (error) {
      logger.error('Failed to create data directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: this.usageFilePath
      });
      // Don't throw error, just log it
    }
  }

  /**
   * Test the OpenRouter connection
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing OpenRouter connection', {
        baseURL: this.baseURL,
        apiKeySet: !!this.apiKey,
        apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) : 'NOT_SET',
      });

      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'PharmacyCopilot SaaS - AI Diagnostic Module',
        },
        timeout: 30000, // 30 seconds for connection test
      });

      logger.info('OpenRouter connection test successful', {
        status: response.status,
        modelsCount: response.data?.data?.length || 'unknown',
      });

      return response.status === 200;
    } catch (error) {
      let errorDetails = 'Unknown error';
      let statusCode: number | null = null;

      if (error instanceof Error) {
        errorDetails = error.message;
        if ('response' in error && error.response) {
          const axiosError = error as any;
          if (axiosError.response && axiosError.response.status) {
            statusCode = parseInt(axiosError.response.status, 10);
          }
          errorDetails = `${error.message} (Status: ${statusCode || 'N/A'})`;
        }
      }

      logger.error('OpenRouter connection test failed', {
        error: errorDetails,
        statusCode,
        baseURL: this.baseURL,
        apiKeySet: !!this.apiKey,
      });

      return false;
    }
  }
}

export default new OpenRouterService();
export { DiagnosticResponse };
