import { apiClient } from './apiClient';

export interface DiagnosticCaseData {
    patientId: string;
    symptoms: {
        subjective: string[];
        objective: string[];
        duration: string;
        severity: 'mild' | 'moderate' | 'severe';
        onset: 'acute' | 'chronic' | 'subacute';
    };
    vitals?: {
        bloodPressure?: string;
        heartRate?: number;
        temperature?: number;
        bloodGlucose?: number;
        respiratoryRate?: number;
    };
    // Alias for backward compatibility
    vitalSigns?: {
        bloodPressure?: string;
        heartRate?: number;
        temperature?: number;
        bloodGlucose?: number;
        respiratoryRate?: number;
    };
    currentMedications?: Array<{
        name: string;
        dosage: string;
        frequency: string;
    }>;
    allergies?: string[];
    medicalHistory?: string[];
    labResults?: string[];
    patientConsent?: {
        provided: boolean;
        method: string;
    };
}

export interface AIAnalysisResult {
    id: string;
    caseId: string;
    analysis: {
        primaryDiagnosis: {
            condition: string;
            confidence: number;
            reasoning: string;
        };
        differentialDiagnoses: Array<{
            condition: string;
            confidence: number;
            reasoning: string;
        }>;
        recommendedTests: Array<{
            test: string;
            priority: 'high' | 'medium' | 'low';
            reasoning: string;
        }>;
        treatmentSuggestions: Array<{
            treatment: string;
            type: 'medication' | 'procedure' | 'lifestyle' | 'referral';
            priority: 'high' | 'medium' | 'low';
            reasoning: string;
        }>;
        riskFactors: Array<{
            factor: string;
            severity: 'high' | 'medium' | 'low';
            description: string;
        }>;
        followUpRecommendations: Array<{
            action: string;
            timeframe: string;
            reasoning: string;
        }>;
    };
    confidence: number;
    processingTime: number;
    createdAt: string;
    status: 'processing' | 'completed' | 'failed';
}

export interface DiagnosticCase {
    id: string;
    patientId: string | {
        _id?: string;
        id?: string;
        firstName?: string;
        lastName?: string;
        age?: number;
        gender?: string;
    };
    caseData: DiagnosticCaseData;
    aiAnalysis?: AIAnalysisResult;
    status: 'draft' | 'submitted' | 'analyzing' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
}

class AIdiagnosticService {
    /**
     * Safely get confidence score from analysis object
     */
    private getConfidenceScore(analysis: unknown): number {
        if (analysis && typeof analysis === 'object' && 'confidenceScore' in analysis) {
            return (analysis as any).confidenceScore || 0;
        }
        return 0;
    }

    /**
     * Transform DiagnosticResult structure to frontend analysis format
     */
    private transformDiagnosticResultToAnalysis(diagnosticResult: any) {

        if (!diagnosticResult) {
            return this.getDefaultAnalysisStructure();
        }

        // Extract primary diagnosis from the diagnoses array
        const primaryDiagnosis = diagnosticResult.diagnoses?.[0];
        const differentialDiagnoses = diagnosticResult.diagnoses?.slice(1) || [];

        return {
            primaryDiagnosis: {
                condition: primaryDiagnosis?.condition || 'Unknown',
                confidence: primaryDiagnosis?.probability || 0,
                reasoning: primaryDiagnosis?.reasoning || 'No reasoning provided'
            },
            differentialDiagnoses: differentialDiagnoses.map((dx: any) => ({
                condition: dx.condition || 'Unknown',
                confidence: dx.probability || 0,
                reasoning: dx.reasoning || 'No reasoning provided'
            })),
            recommendedTests: (diagnosticResult.suggestedTests || []).map((test: any) => ({
                test: test.testName || 'Unknown test',
                priority: this.mapPriority(test.priority),
                reasoning: test.reasoning || 'No reasoning provided'
            })),
            treatmentSuggestions: (diagnosticResult.medicationSuggestions || []).map((med: any) => ({
                treatment: `${med.drugName} ${med.dosage} ${med.frequency}` || 'Unknown treatment',
                type: 'medication' as const,
                priority: 'medium' as const,
                reasoning: med.reasoning || 'No reasoning provided'
            })),
            riskFactors: (diagnosticResult.redFlags || []).map((flag: any) => ({
                factor: flag.flag || 'Unknown risk factor',
                severity: flag.severity || 'medium',
                description: flag.clinicalRationale || 'No description provided'
            })),
            followUpRecommendations: this.extractFollowUpRecommendations(diagnosticResult)
        };
    }

    /**
     * Helper method to map priority levels
     */
    private mapPriority(priority: string): 'high' | 'medium' | 'low' {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return 'high';
            case 'routine':
                return 'medium';
            case 'optional':
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Extract confidence score from diagnostic result
     */
    private extractConfidenceScore(diagnosticResult: any): number {
        // Try multiple possible confidence score fields
        if (diagnosticResult.confidenceScore !== undefined) {
            return Number(diagnosticResult.confidenceScore) || 0;
        }

        if (diagnosticResult.aiMetadata?.confidenceScore !== undefined) {
            return Number(diagnosticResult.aiMetadata.confidenceScore) || 0;
        }

        // Calculate from primary diagnosis probability if available
        if (diagnosticResult.diagnoses?.[0]?.probability !== undefined) {
            return Number(diagnosticResult.diagnoses[0].probability) / 100 || 0;
        }

        // Default fallback
        return 0;
    }

    /**
     * Extract follow-up recommendations from diagnostic result
     */
    private extractFollowUpRecommendations(diagnosticResult: any): Array<{ recommendation: string; priority: string; timeframe?: string }> {
        const recommendations = [];

        // Add referral recommendation if present
        if (diagnosticResult.referralRecommendation?.recommended) {
            recommendations.push({
                recommendation: `Refer to ${diagnosticResult.referralRecommendation.specialty}: ${diagnosticResult.referralRecommendation.reason}`,
                priority: diagnosticResult.referralRecommendation.urgency || 'routine',
                timeframe: this.mapUrgencyToTimeframe(diagnosticResult.referralRecommendation.urgency)
            });
        }

        // Add follow-up requirements
        if (diagnosticResult.followUpRequired) {
            recommendations.push({
                recommendation: 'Schedule follow-up appointment to monitor progress and treatment response',
                priority: 'routine',
                timeframe: '1-2 weeks'
            });
        }

        // Add monitoring recommendations from red flags
        if (diagnosticResult.redFlags && Array.isArray(diagnosticResult.redFlags)) {
            diagnosticResult.redFlags.forEach((flag: any) => {
                if (flag.action) {
                    recommendations.push({
                        recommendation: flag.action,
                        priority: flag.severity || 'medium',
                        timeframe: flag.timeframe || this.mapSeverityToTimeframe(flag.severity)
                    });
                }
            });
        }

        // Add medication monitoring if medication suggestions exist
        if (diagnosticResult.medicationSuggestions && Array.isArray(diagnosticResult.medicationSuggestions)) {
            diagnosticResult.medicationSuggestions.forEach((med: any) => {
                if (med.monitoringParameters && Array.isArray(med.monitoringParameters)) {
                    med.monitoringParameters.forEach((param: string) => {
                        recommendations.push({
                            recommendation: `Monitor ${param} for ${med.drugName}`,
                            priority: 'routine',
                            timeframe: '1-2 weeks'
                        });
                    });
                }
            });
        }

        // Add test follow-up recommendations
        if (diagnosticResult.suggestedTests && Array.isArray(diagnosticResult.suggestedTests)) {
            diagnosticResult.suggestedTests.forEach((test: any) => {
                if (test.priority === 'urgent') {
                    recommendations.push({
                        recommendation: `Follow up on ${test.testName} results`,
                        priority: 'high',
                        timeframe: '24-48 hours'
                    });
                }
            });
        }

        // If no specific recommendations, add general follow-up
        if (recommendations.length === 0) {
            recommendations.push({
                recommendation: 'Schedule routine follow-up to assess treatment response and symptom progression',
                priority: 'routine',
                timeframe: '1-2 weeks'
            });
        }

        return recommendations;
    }

    /**
     * Map urgency to timeframe
     */
    private mapUrgencyToTimeframe(urgency: string): string {
        switch (urgency?.toLowerCase()) {
            case 'immediate':
                return 'within 24 hours';
            case 'within_24h':
                return 'within 24 hours';
            case 'within_week':
                return 'within 1 week';
            case 'routine':
                return '1-2 weeks';
            default:
                return '1-2 weeks';
        }
    }

    /**
     * Map severity to timeframe
     */
    private mapSeverityToTimeframe(severity: string): string {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return 'immediately';
            case 'high':
                return 'within 24 hours';
            case 'medium':
                return 'within 1 week';
            case 'low':
                return '1-2 weeks';
            default:
                return '1-2 weeks';
        }
    }

    /**
     * Get default analysis structure when no data is available
     */
    private getDefaultAnalysisStructure() {
        return {
            primaryDiagnosis: {
                condition: 'Unknown',
                confidence: 0,
                reasoning: 'No reasoning provided'
            },
            differentialDiagnoses: [],
            recommendedTests: [],
            treatmentSuggestions: [],
            riskFactors: [],
            followUpRecommendations: []
        };
    }

    /**
     * Transform backend analysis structure to frontend format (legacy method)
     */
    private transformAnalysisStructure(backendAnalysis: unknown) {
        if (!backendAnalysis || typeof backendAnalysis !== 'object') {
            return {
                primaryDiagnosis: {
                    condition: 'Unknown',
                    confidence: 0,
                    reasoning: 'No reasoning provided'
                },
                differentialDiagnoses: [],
                recommendedTests: [],
                treatmentSuggestions: [],
                riskFactors: [],
                followUpRecommendations: []
            };
        }

        const analysis = backendAnalysis as {
            differentialDiagnoses?: Array<{
                condition?: string;
                probability?: number;
                reasoning?: string;
            }>;
            recommendedTests?: Array<{
                testName?: string;
                priority?: string;
                reasoning?: string;
            }>;
            therapeuticOptions?: Array<{
                medication?: string;
                reasoning?: string;
            }>;
            redFlags?: Array<{
                flag?: string;
                severity?: string;
                action?: string;
            }>;
            referralRecommendation?: {
                specialty?: string;
                urgency?: string;
                reason?: string;
            };
        };

        return {
            primaryDiagnosis: {
                condition: analysis.differentialDiagnoses?.[0]?.condition || 'Unknown',
                confidence: (analysis.differentialDiagnoses?.[0]?.probability || 0) / 100,
                reasoning: analysis.differentialDiagnoses?.[0]?.reasoning || 'No reasoning provided'
            },
            differentialDiagnoses: (analysis.differentialDiagnoses || []).slice(1).map((dx) => ({
                condition: dx.condition || 'Unknown',
                confidence: (dx.probability || 0) / 100,
                reasoning: dx.reasoning || 'No reasoning provided'
            })),
            recommendedTests: (analysis.recommendedTests || []).map((test) => ({
                test: test.testName || 'Unknown test',
                priority: (test.priority === 'urgent' ? 'high' : test.priority === 'routine' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
                reasoning: test.reasoning || 'No reasoning provided'
            })),
            treatmentSuggestions: (analysis.therapeuticOptions || []).map((option) => ({
                treatment: option.medication || 'Unknown treatment',
                type: 'medication' as const,
                priority: 'medium' as const,
                reasoning: option.reasoning || 'No reasoning provided'
            })),
            riskFactors: (analysis.redFlags || []).map((flag) => ({
                factor: flag.flag || 'Unknown risk factor',
                severity: (flag.severity === 'critical' ? 'high' : flag.severity || 'medium') as 'high' | 'medium' | 'low',
                description: flag.action || 'No description provided'
            })),
            followUpRecommendations: analysis.referralRecommendation ? [{
                action: `Referral to ${analysis.referralRecommendation.specialty || 'specialist'}`,
                timeframe: analysis.referralRecommendation.urgency || 'As needed',
                reasoning: analysis.referralRecommendation.reason || 'No reasoning provided'
            }] : []
        };
    }
    /**
     * Validate patient access before submitting diagnostic case
     */
    async validatePatientAccess(patientId: string): Promise<{ hasAccess: boolean; patientName?: string; error?: string }> {
        try {
            const response = await apiClient.post('/ai-diagnostics/patient/validate', {
                patientId
            });

            return {
                hasAccess: true,
                patientName: response.data.data.patientName
            };
        } catch (error: unknown) {
            console.error('Failed to validate patient access:', error);

            if (
                error &&
                typeof error === 'object' &&
                'response' in error &&
                error.response &&
                typeof error.response === 'object' &&
                'data' in error.response
            ) {
                const response = error.response as {
                    status: number;
                    data?: { message?: string; debug?: string };
                };

                return {
                    hasAccess: false,
                    error: response.data?.message || 'Patient access validation failed',
                };
            }

            return {
                hasAccess: false,
                error: 'Failed to validate patient access'
            };
        }
    }

    /**
     * Submit a diagnostic case for AI analysis
     */
    async submitCase(caseData: DiagnosticCaseData): Promise<DiagnosticCase> {
        try {
            // Transform data to match backend API expectations
            const apiPayload = {
                patientId: caseData.patientId,
                inputSnapshot: {
                    symptoms: caseData.symptoms,
                    vitals: caseData.vitalSigns || caseData.vitals || {},
                    currentMedications: caseData.currentMedications || [],
                    allergies: caseData.allergies || [],
                    medicalHistory: caseData.medicalHistory || [],
                    labResultIds: caseData.labResults || [],
                },
                priority: 'routine' as const,
                consentObtained: caseData.patientConsent?.provided ?? true
            };

            // Debug: Log the payload being sent

            // Use extended timeout for AI analysis (3 minutes)
            const response = await apiClient.post('/diagnostics', apiPayload, {
                timeout: 180000 // 3 minutes timeout for AI processing
            });

            // Debug: Log the full response structure



            // Transform response to match frontend expectations
            const responseData = response.data.data;

            const diagnosticRequest = responseData.request;

            const requestId = diagnosticRequest?._id || diagnosticRequest?.id;



            const transformedAnalysis = this.transformAnalysisStructure(responseData.analysis);

            return {
                id: requestId,
                patientId: caseData.patientId,
                caseData: caseData,
                aiAnalysis: {
                    id: requestId,
                    caseId: requestId,
                    analysis: transformedAnalysis,
                    confidence: responseData.analysis?.confidenceScore || 0,
                    processingTime: responseData.processingTime,
                    createdAt: new Date().toISOString(),
                    status: 'completed' as const
                },
                status: 'completed' as const,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        } catch (error: unknown) {
            console.error('Failed to submit diagnostic case:', error);

            // Provide more specific error messages
            if (
                error &&
                typeof error === 'object' &&
                'response' in error &&
                error.response &&
                typeof error.response === 'object' &&
                'status' in error.response
            ) {
                const response = error.response as {
                    status: number;
                    data?: {
                        message?: string;
                        details?: any;
                        errors?: any;
                    };
                };

                // Log full error details for debugging
                console.error('API Error Response:', {
                    status: response.status,
                    data: response.data
                });

                if (response.status === 422) {
                    // Validation error - provide detailed feedback
                    const details = response.data?.details || response.data?.errors;
                    let message = 'Validation failed:\n';

                    if (Array.isArray(details)) {
                        // Handle array of validation errors
                        message += details.map((err: any) => {
                            if (typeof err === 'string') return err;
                            if (err.path && err.message) return `• ${err.path}: ${err.message}`;
                            if (err.message) return `• ${err.message}`;
                            if (err.msg) return `• ${err.msg}`;
                            return `• ${JSON.stringify(err)}`;
                        }).join('\n');
                    } else if (details && typeof details === 'object') {
                        // Handle object of validation errors
                        message += JSON.stringify(details, null, 2);
                    } else {
                        message += response.data?.message || 'Please check your input';
                    }

                    console.error('Validation Error Details:', message);
                    throw new Error(message);
                } else if (response.status === 401) {
                    const message = response.data?.message || 'Authentication failed';
                    throw new Error(`Authentication Error: ${message}`);
                } else if (response.status === 403) {
                    const message = response.data?.message || 'Access denied';
                    throw new Error(`Permission Error: ${message}`);
                } else if (response.status === 404) {
                    const message = response.data?.message || 'Patient not found or access denied';
                    throw new Error(`Patient Error: ${message}`);
                } else if (response.status === 402) {
                    const message = response.data?.message || 'Subscription required';
                    throw new Error(`Subscription Error: ${message}`);
                } else if (response.data?.message) {
                    throw new Error(response.data.message);
                }
            }

            throw error;
        }
    }

    /**
     * Get AI analysis for a case
     */
    async getAnalysis(caseId: string): Promise<AIAnalysisResult> {
        try {
            const caseData = await this.getCase(caseId);


            if (caseData.aiAnalysis) {
                return caseData.aiAnalysis;
            }
            throw new Error('No AI analysis found for this case');
        } catch (error) {
            console.error('Failed to get AI analysis:', error);
            throw error;
        }
    }

    /**
     * Get case details
     */
    async getCase(caseId: string): Promise<DiagnosticCase> {
        try {
            const response = await apiClient.get(`/ai-diagnostics/${caseId}`, {
                timeout: 30000 // 30 seconds timeout for getting case data
            });
            const responseData = response.data.data;



            // Extract the request and result from the backend response
            const diagnosticRequest = responseData.request;
            const diagnosticResult = responseData.result;

            // Extract ID - try both _id and id
            const extractedId = diagnosticRequest._id || diagnosticRequest.id || caseId;

            // Extract patientId
            const extractedPatientId = diagnosticRequest.patientId && typeof diagnosticRequest.patientId === 'object'
                ? diagnosticRequest.patientId._id || diagnosticRequest.patientId.id
                : diagnosticRequest.patientId;

            // Transform backend response to frontend format
            return {
                id: extractedId,
                patientId: extractedPatientId || 'unknown',
                caseData: {
                    patientId: extractedPatientId || 'unknown',
                    symptoms: diagnosticRequest.inputSnapshot?.symptoms || { subjective: [], objective: [], duration: '', severity: 'mild' as const, onset: 'acute' as const },
                    vitalSigns: diagnosticRequest.inputSnapshot?.vitals || {},
                    currentMedications: diagnosticRequest.inputSnapshot?.currentMedications || [],
                    allergies: diagnosticRequest.inputSnapshot?.allergies || [],
                    medicalHistory: diagnosticRequest.inputSnapshot?.medicalHistory || [],
                    labResults: diagnosticRequest.inputSnapshot?.labResultIds || []
                },
                aiAnalysis: diagnosticResult ? {
                    id: extractedId,
                    caseId: extractedId,
                    analysis: this.transformDiagnosticResultToAnalysis(diagnosticResult),
                    confidence: this.extractConfidenceScore(diagnosticResult),
                    processingTime: responseData.processingTime || 0,
                    createdAt: diagnosticResult.createdAt || diagnosticRequest.createdAt,
                    status: 'completed' as const
                } : undefined,
                status: diagnosticRequest.status === 'pending' ? 'analyzing' as const :
                    diagnosticRequest.status === 'processing' ? 'analyzing' as const :
                        diagnosticRequest.status === 'completed' ? 'completed' as const :
                            diagnosticRequest.status === 'failed' ? 'failed' as const : 'analyzing' as const,
                createdAt: diagnosticRequest.createdAt,
                updatedAt: diagnosticRequest.updatedAt
            };
        } catch (error: unknown) {
            console.error('Failed to get diagnostic case:', error);

            // Provide more specific error messages
            if (
                error &&
                typeof error === 'object' &&
                'response' in error &&
                error.response &&
                typeof error.response === 'object' &&
                'status' in error.response
            ) {
                const response = error.response as {
                    status: number;
                    data?: { message?: string };
                };

                if (response.status === 401) {
                    const message = response.data?.message || 'Authentication failed';
                    throw new Error(`Authentication Error: ${message}`);
                } else if (response.status === 403) {
                    const message = response.data?.message || 'Access denied';
                    throw new Error(`Permission Error: ${message}`);
                } else if (response.status === 422) {
                    const message = response.data?.message || 'Invalid request data';
                    throw new Error(`Validation Error: ${message}`);
                } else if (response.data?.message) {
                    throw new Error(response.data.message);
                }
            }

            throw error;
        }
    }

    /**
     * Get all cases for a patient
     */
    async getPatientCases(patientId: string): Promise<DiagnosticCase[]> {
        try {
            const response = await apiClient.get(`/ai-diagnostics/patients/${patientId}/history`);
            const diagnosticCases = response.data.data.cases;

            // Transform backend cases to frontend format
            return diagnosticCases.map((diagnosticCase: {
                _id: string;
                patientId: string | { _id?: string; id?: string };
                symptoms: unknown;
                vitalSigns?: unknown;
                currentMedications?: unknown[];
                labResults?: string[];
                aiAnalysis?: unknown;
                aiRequestData?: { processingTime?: number };
                status: string;
                createdAt: string;
                updatedAt: string;
                caseId: string;
            }) => ({
                id: diagnosticCase._id,
                patientId: diagnosticCase.patientId && typeof diagnosticCase.patientId === 'object'
                    ? diagnosticCase.patientId._id || diagnosticCase.patientId.id
                    : diagnosticCase.patientId,
                caseData: {
                    patientId: diagnosticCase.patientId && typeof diagnosticCase.patientId === 'object'
                        ? diagnosticCase.patientId._id || diagnosticCase.patientId.id
                        : diagnosticCase.patientId,
                    symptoms: diagnosticCase.symptoms,
                    vitals: diagnosticCase.vitalSigns || {},
                    currentMedications: diagnosticCase.currentMedications || [],
                    allergies: [], // Not stored in this format
                    medicalHistory: [], // Not stored in this format
                    labResults: diagnosticCase.labResults || []
                },
                aiAnalysis: diagnosticCase.aiAnalysis ? {
                    id: diagnosticCase._id,
                    caseId: diagnosticCase.caseId,
                    analysis: this.transformAnalysisStructure(diagnosticCase.aiAnalysis),
                    confidence: this.getConfidenceScore(diagnosticCase.aiAnalysis),
                    processingTime: diagnosticCase.aiRequestData?.processingTime || 0,
                    createdAt: diagnosticCase.createdAt,
                    status: 'completed' as const
                } : undefined,
                status: diagnosticCase.status === 'pending' ? 'analyzing' as const :
                    diagnosticCase.status === 'processing' ? 'analyzing' as const :
                        diagnosticCase.status === 'completed' ? 'completed' as const :
                            diagnosticCase.status === 'failed' ? 'failed' as const : 'analyzing' as const,
                createdAt: diagnosticCase.createdAt,
                updatedAt: diagnosticCase.updatedAt
            }));
        } catch (error: any) {
            console.error('Failed to get patient cases:', error);
            
            // Handle permission errors gracefully
            if (error.response?.status === 403) {
                const errorData = error.response?.data;
                if (errorData?.message === 'Permission not defined') {
                    console.warn('AI Diagnostics permission not configured. Returning empty array.');
                    return []; // Return empty array instead of throwing
                }
            }
            
            throw error;
        }
    }

    /**
     * Poll for analysis completion
     */
    async pollAnalysis(caseId: string, maxAttempts: number = 30): Promise<AIAnalysisResult> {
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const analysis = await this.getAnalysis(caseId);

                if (analysis.status === 'completed') {
                    return analysis;
                } else if (analysis.status === 'failed') {
                    throw new Error('AI analysis failed');
                }

                // Progressive delay: start with 2s, increase to 5s after 10 attempts
                const delay = attempts < 10 ? 2000 : 5000;
                await new Promise(resolve => setTimeout(resolve, delay));
                attempts++;
            } catch (error) {
                if (attempts === maxAttempts - 1) {
                    throw error;
                }
                // Longer delay on error to reduce server load
                const delay = attempts < 10 ? 3000 : 8000;
                await new Promise(resolve => setTimeout(resolve, delay));
                attempts++;
            }
        }

        throw new Error('Analysis timeout - please check back later');
    }
}

export const aiDiagnosticService = new AIdiagnosticService();