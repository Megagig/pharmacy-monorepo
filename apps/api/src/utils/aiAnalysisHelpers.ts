/**
 * Utility functions for cleaning and validating AI analysis data
 */

export interface ReferralRecommendation {
  recommended: boolean;
  urgency?: 'immediate' | 'within_24h' | 'routine';
  specialty?: string;
  reason?: string;
}

export interface AIAnalysis {
  differentialDiagnoses: any[];
  recommendedTests: any[];
  therapeuticOptions: any[];
  redFlags: any[];
  referralRecommendation?: ReferralRecommendation;
  disclaimer: string;
  confidenceScore: number;
  processingTime: number;
}

/**
 * Clean referral recommendation data to handle null/undefined values
 */
export const cleanReferralRecommendation = (
  referral: ReferralRecommendation | null | undefined
): ReferralRecommendation | undefined => {
  if (!referral) {
    return undefined;
  }

  // If referral is not recommended, remove optional fields
  if (!referral.recommended) {
    return {
      recommended: false,
      urgency: undefined,
      specialty: undefined,
      reason: undefined,
    };
  }

  // If recommended, ensure required fields have default values
  return {
    recommended: true,
    urgency: referral.urgency || 'routine',
    specialty: referral.specialty || 'general_medicine',
    reason: referral.reason || 'Further evaluation required',
  };
};

/**
 * Clean AI analysis data to handle null/undefined values and ensure schema compliance
 */
export const cleanAIAnalysis = (analysis: any): AIAnalysis => {
  const cleaned: AIAnalysis = {
    differentialDiagnoses: analysis.differentialDiagnoses || [],
    recommendedTests: analysis.recommendedTests || [],
    therapeuticOptions: analysis.therapeuticOptions || [],
    redFlags: analysis.redFlags || [],
    disclaimer: analysis.disclaimer || 'This analysis is for informational purposes only and should not replace professional medical judgment.',
    confidenceScore: analysis.confidenceScore || 0,
    processingTime: analysis.processingTime || 0,
  };

  // Clean referral recommendation
  if (analysis.referralRecommendation) {
    cleaned.referralRecommendation = cleanReferralRecommendation(analysis.referralRecommendation);
  }

  return cleaned;
};

/**
 * Validate AI analysis data before saving to database
 */
export const validateAIAnalysis = (analysis: AIAnalysis): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check required fields
  if (!analysis.disclaimer) {
    errors.push('Disclaimer is required');
  }

  if (typeof analysis.confidenceScore !== 'number' || analysis.confidenceScore < 0 || analysis.confidenceScore > 100) {
    errors.push('Confidence score must be a number between 0 and 100');
  }

  if (typeof analysis.processingTime !== 'number' || analysis.processingTime < 0) {
    errors.push('Processing time must be a non-negative number');
  }

  // Validate arrays
  if (!Array.isArray(analysis.differentialDiagnoses)) {
    errors.push('Differential diagnoses must be an array');
  }

  if (!Array.isArray(analysis.recommendedTests)) {
    errors.push('Recommended tests must be an array');
  }

  if (!Array.isArray(analysis.therapeuticOptions)) {
    errors.push('Therapeutic options must be an array');
  }

  if (!Array.isArray(analysis.redFlags)) {
    errors.push('Red flags must be an array');
  }

  // Validate referral recommendation if present
  if (analysis.referralRecommendation) {
    const referral = analysis.referralRecommendation;
    
    if (typeof referral.recommended !== 'boolean') {
      errors.push('Referral recommendation must have a boolean "recommended" field');
    }

    if (referral.recommended) {
      if (!referral.urgency || !['immediate', 'within_24h', 'routine'].includes(referral.urgency)) {
        errors.push('Referral urgency must be one of: immediate, within_24h, routine');
      }

      if (!referral.specialty || typeof referral.specialty !== 'string') {
        errors.push('Referral specialty is required when referral is recommended');
      }

      if (!referral.reason || typeof referral.reason !== 'string') {
        errors.push('Referral reason is required when referral is recommended');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize AI analysis for client response (remove sensitive data)
 */
export const sanitizeAIAnalysisForClient = (analysis: AIAnalysis): AIAnalysis => {
  // Create a copy and remove any sensitive information if needed
  const sanitized = { ...analysis };

  // For now, we don't need to remove anything, but this function
  // can be extended to filter out sensitive data in the future

  return sanitized;
};

/**
 * Generate a summary of AI analysis for logging
 */
export const generateAnalysisSummary = (analysis: AIAnalysis): string => {
  const diagnosesCount = analysis.differentialDiagnoses?.length || 0;
  const testsCount = analysis.recommendedTests?.length || 0;
  const therapyCount = analysis.therapeuticOptions?.length || 0;
  const redFlagsCount = analysis.redFlags?.length || 0;
  const hasReferral = analysis.referralRecommendation?.recommended || false;

  return `Analysis: ${diagnosesCount} diagnoses, ${testsCount} tests, ${therapyCount} therapies, ${redFlagsCount} red flags, referral: ${hasReferral}, confidence: ${analysis.confidenceScore}%`;
};