import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import openRouterService, { DiagnosticInput, DiagnosticResponse } from '../../../services/openRouterService';
import { AuditService } from '../../../services/auditService';
import mongoose from 'mongoose';

export interface AIProcessingOptions {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    retryAttempts?: number;
    promptVersion?: string;
}

export interface AIAnalysisMetadata {
    modelId: string;
    modelVersion: string;
    promptVersion: string;
    processingTime: number;
    tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    requestId: string;
    temperature?: number;
    maxTokens?: number;
    confidenceScore: number;
    promptHash?: string;
}

export interface EnhancedDiagnosticResponse extends DiagnosticResponse {
    metadata: AIAnalysisMetadata;
    qualityScore: number;
    validationFlags: string[];
    processingNotes: string[];
}

export interface ConsentValidation {
    isValid: boolean;
    consentTimestamp: Date;
    consentMethod: 'verbal' | 'written' | 'electronic';
    patientId: string;
    pharmacistId: string;
    pharmacistRole: string; // Add this line
    errors?: string[];
}

export class AIOrchestrationService {
    private readonly defaultOptions: Required<AIProcessingOptions> = {
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 180000, // 3 minutes
        retryAttempts: 3,
        promptVersion: 'v1.0',
    };

    /**
     * Process patient case with AI analysis and comprehensive validation
     */
    async processPatientCase(
        input: DiagnosticInput,
        consent: ConsentValidation,
        options: AIProcessingOptions = {}
    ): Promise<EnhancedDiagnosticResponse> {
        const startTime = Date.now();
        const processingOptions = { ...this.defaultOptions, ...options };

        try {
            // Validate consent
            this.validateConsent(consent);

            // Validate input data
            this.validateInputData(input);

            // Log AI request for audit
            await this.logAIRequest(input, consent, processingOptions);

            // Generate structured prompt
            const prompt = this.buildStructuredPrompt(input, processingOptions.promptVersion);
            const promptHash = this.generatePromptHash(prompt);

            // Call OpenRouter API with enhanced error handling
            const aiResponse = await this.callOpenRouterWithRetry(
                input,
                processingOptions
            );

            // Validate and enhance AI response
            const enhancedResponse = await this.validateAndEnhanceResponse(
                aiResponse,
                input,
                processingOptions,
                promptHash,
                startTime
            );

            // Log successful processing
            await this.logAIResponse(enhancedResponse, consent, new Types.ObjectId(input.workplaceId!));

            logger.info('AI diagnostic analysis completed successfully', {
                patientId: consent.patientId,
                processingTime: enhancedResponse.metadata.processingTime,
                confidenceScore: enhancedResponse.metadata.confidenceScore,
                qualityScore: enhancedResponse.qualityScore,
                diagnosesCount: enhancedResponse.differentialDiagnoses.length,
            });

            return enhancedResponse;
        } catch (error) {
            const processingTime = Date.now() - startTime;

            // Log failed processing
            await this.logAIError(error, consent, processingTime, new Types.ObjectId(input.workplaceId!));

            logger.error('AI diagnostic analysis failed', {
                patientId: consent.patientId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime,
            });

            throw new Error(`AI diagnostic analysis failed: ${error}`);
        }
    }

    /**
     * Validate consent for AI processing
     */
    private validateConsent(consent: ConsentValidation): void {
        if (!consent.isValid) {
            throw new Error('Invalid consent for AI processing');
        }

        if (!consent.consentTimestamp) {
            throw new Error('Consent timestamp is required');
        }

        if (!consent.patientId || !consent.pharmacistId) {
            throw new Error('Patient ID and Pharmacist ID are required for consent validation');
        }

        // Check if consent is recent (within last 24 hours for AI processing)
        const consentAge = Date.now() - consent.consentTimestamp.getTime();
        const maxConsentAge = 24 * 60 * 60 * 1000; // 24 hours

        if (consentAge > maxConsentAge) {
            throw new Error('Consent has expired. Please obtain fresh consent for AI processing');
        }

        if (consent.errors && consent.errors.length > 0) {
            throw new Error(`Consent validation errors: ${consent.errors.join(', ')}`);
        }
    }

    /**
     * Validate input data for AI processing
     */
    private validateInputData(input: DiagnosticInput): void {
        // Validate symptoms
        if (!input.symptoms || !input.symptoms.subjective || input.symptoms.subjective.length === 0) {
            throw new Error('At least one subjective symptom is required');
        }

        if (!input.symptoms.duration || !input.symptoms.severity || !input.symptoms.onset) {
            throw new Error('Symptom duration, severity, and onset are required');
        }

        // Validate patient demographics if provided
        if (input.patientAge !== undefined && (input.patientAge < 0 || input.patientAge > 150)) {
            throw new Error('Invalid patient age');
        }

        // Validate vital signs if provided
        if (input.vitalSigns) {
            this.validateVitalSigns(input.vitalSigns);
        }

        // Validate lab results if provided
        if (input.labResults) {
            this.validateLabResults(input.labResults);
        }

        // Validate medications if provided
        if (input.currentMedications) {
            this.validateMedications(input.currentMedications);
        }
    }

    /**
     * Validate vital signs
     */
    private validateVitalSigns(vitals: any): void {
        if (vitals.heartRate !== undefined && (vitals.heartRate < 30 || vitals.heartRate > 250)) {
            throw new Error('Invalid heart rate value');
        }

        if (vitals.temperature !== undefined && (vitals.temperature < 30 || vitals.temperature > 45)) {
            throw new Error('Invalid temperature value');
        }

        if (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 60)) {
            throw new Error('Invalid respiratory rate value');
        }

        if (vitals.oxygenSaturation !== undefined && (vitals.oxygenSaturation < 70 || vitals.oxygenSaturation > 100)) {
            throw new Error('Invalid oxygen saturation value');
        }

        if (vitals.bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(vitals.bloodPressure)) {
            throw new Error('Invalid blood pressure format (should be systolic/diastolic)');
        }
    }

    /**
     * Validate lab results
     */
    private validateLabResults(labResults: any[]): void {
        for (const result of labResults) {
            if (!result.testName || !result.value) {
                throw new Error('Lab results must have test name and value');
            }

            if (result.testName.length > 200) {
                throw new Error('Lab test name too long');
            }

            if (result.value.length > 500) {
                throw new Error('Lab result value too long');
            }
        }
    }

    /**
     * Validate medications
     */
    private validateMedications(medications: any[]): void {
        for (const medication of medications) {
            if (!medication.name || !medication.dosage || !medication.frequency) {
                throw new Error('Medications must have name, dosage, and frequency');
            }

            if (medication.name.length > 200) {
                throw new Error('Medication name too long');
            }
        }
    }

    /**
     * Build structured prompt for AI analysis
     */
    private buildStructuredPrompt(input: DiagnosticInput, promptVersion: string): string {
        // This would use the existing prompt building logic from OpenRouterService
        // For now, we'll delegate to the existing service
        return `Diagnostic analysis prompt for version ${promptVersion}`;
    }

    /**
     * Generate hash of prompt for tracking and caching
     */
    private generatePromptHash(prompt: string): string {
        // Simple hash function - in production, use crypto.createHash
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Call OpenRouter API with retry logic
     */
    private async callOpenRouterWithRetry(
        input: DiagnosticInput,
        options: Required<AIProcessingOptions>
    ): Promise<any> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
            try {
                logger.info(`AI API call attempt ${attempt}/${options.retryAttempts}`);

                const response = await Promise.race([
                    openRouterService.generateDiagnosticAnalysis(input),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('AI API timeout')), options.timeout)
                    ),
                ]);

                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                logger.warn(`AI API call attempt ${attempt} failed`, {
                    error: lastError.message,
                    attempt,
                    maxAttempts: options.retryAttempts,
                });

                // Don't retry on certain errors
                if (this.isNonRetryableError(lastError)) {
                    break;
                }

                // Wait before retry (exponential backoff)
                if (attempt < options.retryAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('AI API call failed after all retry attempts');
    }

    /**
     * Check if error should not be retried
     */
    private isNonRetryableError(error: Error): boolean {
        const nonRetryablePatterns = [
            'Invalid or missing OpenRouter API key',
            'OpenRouter API quota exceeded',
            'Invalid consent',
            'Validation error',
        ];

        return nonRetryablePatterns.some(pattern => error.message.includes(pattern));
    }

    /**
     * Validate and enhance AI response
     */
    private async validateAndEnhanceResponse(
        aiResponse: any,
        input: DiagnosticInput,
        options: Required<AIProcessingOptions>,
        promptHash: string,
        startTime: number
    ): Promise<EnhancedDiagnosticResponse> {
        const processingTime = Date.now() - startTime;

        // Validate AI response structure
        this.validateAIResponseStructure(aiResponse.analysis);

        // Calculate quality score
        const qualityScore = this.calculateQualityScore(aiResponse.analysis, input);

        // Generate validation flags
        const validationFlags = this.generateValidationFlags(aiResponse.analysis, input);

        // Generate processing notes
        const processingNotes = this.generateProcessingNotes(aiResponse.analysis, input, qualityScore);

        // Create metadata
        const metadata: AIAnalysisMetadata = {
            modelId: 'deepseek/deepseek-chat-v3.1',
            modelVersion: 'v3.1',
            promptVersion: options.promptVersion,
            processingTime,
            tokenUsage: aiResponse.usage,
            requestId: aiResponse.requestId,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            confidenceScore: aiResponse.analysis.confidenceScore / 100,
            promptHash,
        };

        return {
            ...aiResponse.analysis,
            metadata,
            qualityScore,
            validationFlags,
            processingNotes,
        };
    }

    /**
     * Validate AI response structure
     */
    private validateAIResponseStructure(analysis: DiagnosticResponse): void {
        if (!analysis.differentialDiagnoses || analysis.differentialDiagnoses.length === 0) {
            throw new Error('AI response must contain at least one differential diagnosis');
        }

        if (typeof analysis.confidenceScore !== 'number' || analysis.confidenceScore < 0 || analysis.confidenceScore > 100) {
            throw new Error('AI response must contain valid confidence score (0-100)');
        }

        if (!analysis.disclaimer || analysis.disclaimer.length === 0) {
            throw new Error('AI response must contain disclaimer');
        }

        // Validate each diagnosis
        for (const diagnosis of analysis.differentialDiagnoses) {
            if (!diagnosis.condition || !diagnosis.reasoning) {
                throw new Error('Each diagnosis must have condition and reasoning');
            }

            if (typeof diagnosis.probability !== 'number' || diagnosis.probability < 0 || diagnosis.probability > 100) {
                throw new Error('Each diagnosis must have valid probability (0-100)');
            }
        }
    }

    /**
     * Calculate quality score for AI response
     */
    private calculateQualityScore(analysis: DiagnosticResponse, input: DiagnosticInput): number {
        let score = 0;
        let maxScore = 0;

        // Score based on number of diagnoses (more comprehensive is better, up to a point)
        maxScore += 20;
        const diagnosesCount = analysis.differentialDiagnoses.length;
        if (diagnosesCount >= 2 && diagnosesCount <= 5) {
            score += 20;
        } else if (diagnosesCount === 1 || diagnosesCount === 6) {
            score += 15;
        } else if (diagnosesCount > 6) {
            score += 10; // Too many diagnoses might indicate uncertainty
        }

        // Score based on confidence score
        maxScore += 20;
        score += Math.min(20, analysis.confidenceScore / 5); // Max 20 points for confidence >= 100

        // Score based on reasoning quality (length and detail)
        maxScore += 15;
        const avgReasoningLength = analysis.differentialDiagnoses.reduce(
            (sum, d) => sum + d.reasoning.length, 0
        ) / analysis.differentialDiagnoses.length;
        if (avgReasoningLength >= 100) score += 15;
        else if (avgReasoningLength >= 50) score += 10;
        else score += 5;

        // Score based on red flags appropriateness
        maxScore += 15;
        if (analysis.redFlags && analysis.redFlags.length > 0) {
            score += 15; // Good to identify potential red flags
        } else if (input.symptoms.severity === 'severe') {
            score += 5; // Should have identified red flags for severe symptoms
        } else {
            score += 10; // Appropriate to have no red flags for mild symptoms
        }

        // Score based on recommended tests appropriateness
        maxScore += 15;
        if (analysis.recommendedTests && analysis.recommendedTests.length > 0) {
            score += 15;
        } else {
            score += 5; // Sometimes no additional tests are needed
        }

        // Score based on therapeutic options
        maxScore += 15;
        if (analysis.therapeuticOptions && analysis.therapeuticOptions.length > 0) {
            score += 15;
        } else {
            score += 10; // Sometimes no immediate treatment is recommended
        }

        return Math.round((score / maxScore) * 100);
    }

    /**
     * Generate validation flags for AI response
     */
    private generateValidationFlags(analysis: DiagnosticResponse, input: DiagnosticInput): string[] {
        const flags: string[] = [];

        // Check for low confidence
        if (analysis.confidenceScore < 50) {
            flags.push('LOW_CONFIDENCE');
        }

        // Check for severe symptoms without red flags
        if (input.symptoms.severity === 'severe' && (!analysis.redFlags || analysis.redFlags.length === 0)) {
            flags.push('SEVERE_SYMPTOMS_NO_RED_FLAGS');
        }

        // Check for high probability diagnoses without recommended tests
        const highProbDiagnoses = analysis.differentialDiagnoses.filter(d => d.probability > 70);
        if (highProbDiagnoses.length > 0 && (!analysis.recommendedTests || analysis.recommendedTests.length === 0)) {
            flags.push('HIGH_PROB_DIAGNOSIS_NO_TESTS');
        }

        // Check for critical red flags
        if (analysis.redFlags && analysis.redFlags.some(flag => flag.severity === 'critical')) {
            flags.push('CRITICAL_RED_FLAGS');
        }

        // Check for medication suggestions with current medications (interaction risk)
        if (input.currentMedications && input.currentMedications.length > 0 &&
            analysis.therapeuticOptions && analysis.therapeuticOptions.length > 0) {
            flags.push('MEDICATION_INTERACTION_RISK');
        }

        return flags;
    }

    /**
     * Generate processing notes
     */
    private generateProcessingNotes(
        analysis: DiagnosticResponse,
        input: DiagnosticInput,
        qualityScore: number
    ): string[] {
        const notes: string[] = [];

        if (qualityScore < 70) {
            notes.push('AI response quality score is below threshold - consider manual review');
        }

        if (analysis.confidenceScore < 60) {
            notes.push('Low AI confidence - additional clinical assessment recommended');
        }

        if (input.symptoms.severity === 'severe') {
            notes.push('Severe symptoms reported - prioritize immediate clinical evaluation');
        }

        if (analysis.redFlags && analysis.redFlags.length > 0) {
            notes.push(`${analysis.redFlags.length} red flag(s) identified - review urgently`);
        }

        if (analysis.referralRecommendation?.recommended) {
            notes.push(`Referral recommended to ${analysis.referralRecommendation.specialty} - ${analysis.referralRecommendation.urgency} priority`);
        }

        return notes;
    }

    /**
     * Log AI request for audit trail
     */
    private async logAIRequest(
        input: DiagnosticInput,
        consent: ConsentValidation,
        options: Required<AIProcessingOptions>
    ): Promise<void> {
        try {
            await AuditService.logActivity({
                userId: consent.pharmacistId,
                workplaceId: input.workplaceId!,
                userRole: consent.pharmacistRole, // Assuming consent has pharmacistRole
            }, {
                action: 'ai_diagnostic_request',
                resourceType: 'AIAnalysis',
                details: {
                    patientId: consent.patientId,
                    symptomsCount: input.symptoms.subjective.length,
                    hasVitals: !!input.vitalSigns,
                    hasLabResults: !!(input.labResults && input.labResults.length > 0),
                    hasMedications: !!(input.currentMedications && input.currentMedications.length > 0),
                    promptVersion: options.promptVersion,
                    temperature: options.temperature,
                    maxTokens: options.maxTokens,
                },
                complianceCategory: 'ai_diagnostics'
            });
        } catch (error) {
            logger.warn('Failed to log AI request audit event', { error });
        }
    }

    /**
     * Log AI response for audit trail
     */
    private async logAIResponse(
        response: EnhancedDiagnosticResponse,
        consent: ConsentValidation,
        workplaceId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await AuditService.logActivity({
                userId: consent.pharmacistId,
                workplaceId: workplaceId.toString(),
                userRole: consent.pharmacistRole,
            }, {
                action: 'ai_diagnostic_response',
                resourceType: 'AIAnalysis',
                resourceId: new Types.ObjectId().toString(),
                details: {
                    requestId: response.metadata.requestId,
                    patientId: consent.patientId,
                    processingTime: response.metadata.processingTime,
                    confidenceScore: response.metadata.confidenceScore,
                    qualityScore: response.qualityScore,
                    diagnosesCount: response.differentialDiagnoses.length,
                    redFlagsCount: response.redFlags?.length || 0,
                    tokenUsage: response.metadata.tokenUsage,
                    validationFlags: response.validationFlags,
                },
                complianceCategory: 'ai_diagnostics'
            });
        } catch (error) {
            logger.warn('Failed to log AI response audit event', { error });
        }
    }

    /**
     * Log AI error for audit trail
     */
    private async logAIError(
        error: unknown,
        consent: ConsentValidation,
        processingTime: number,
        workplaceId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await AuditService.logActivity({
                userId: consent.pharmacistId,
                workplaceId: workplaceId.toString(),
                userRole: consent.pharmacistRole,
            }, {
                action: 'ai_diagnostic_error',
                resourceType: 'AIAnalysis',
                resourceId: new Types.ObjectId().toString(),
                complianceCategory: 'ai_diagnostics',
                details: {
                    patientId: consent.patientId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    processingTime,
                },
            });
        } catch (auditError) {
            logger.warn('Failed to log AI error audit event', { auditError });
        }
    }

    /**
     * Test AI service connectivity and configuration
     */
    async testAIService(): Promise<{
        isConnected: boolean;
        responseTime: number;
        error?: string;
    }> {
        const startTime = Date.now();

        try {
            const isConnected = await openRouterService.testConnection();
            const responseTime = Date.now() - startTime;

            return {
                isConnected,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                isConnected: false,
                responseTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get AI service statistics
     */
    getAIServiceStats(): {
        defaultOptions: Required<AIProcessingOptions>;
        supportedModels: string[];
        maxTokenLimit: number;
    } {
        return {
            defaultOptions: this.defaultOptions,
            supportedModels: ['deepseek/deepseek-chat-v3.1'],
            maxTokenLimit: 4000,
        };
    }
}

export default new AIOrchestrationService();