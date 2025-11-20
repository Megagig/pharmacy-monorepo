import { ApiClient } from '../utils/apiClient';
import logger from '../utils/logger';
import DrugInteraction, { IDrugInteraction, IInteractionDetail } from '../models/DrugInteraction';
import MedicationManagement from '../models/MedicationManagement';
import { DrugInteractionService } from './drugInteractionService';
import mongoose from 'mongoose';

export interface MedicationInput {
  medicationId?: mongoose.Types.ObjectId;
  name: string;
  rxcui?: string;
  dosage?: string;
  frequency?: string;
}

export interface InteractionCheckRequest {
  patientId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  medications: MedicationInput[];
  checkType?: 'manual' | 'automatic' | 'scheduled';
  checkTrigger?: string;
  userId: mongoose.Types.ObjectId;
}

export interface InteractionCheckResult {
  interactionId: mongoose.Types.ObjectId;
  hasInteractions: boolean;
  hasCriticalInteractions: boolean;
  hasContraindications: boolean;
  interactionCount: number;
  interactions: IInteractionDetail[];
  requiresPharmacistReview: boolean;
  summary: {
    critical: number;
    major: number;
    moderate: number;
    minor: number;
  };
}

export interface BatchInteractionResult {
  patientId: mongoose.Types.ObjectId;
  result: InteractionCheckResult;
  error?: string;
}

export class UnifiedInteractionService {
  private drugInteractionService: DrugInteractionService;
  private interactionCache: Map<string, any> = new Map();
  private cacheTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.drugInteractionService = new DrugInteractionService();
  }

  /**
   * Main method to check drug interactions for a patient
   */
  async checkInteractions(request: InteractionCheckRequest): Promise<InteractionCheckResult> {
    try {
      logger.info(`Starting interaction check for patient ${request.patientId}`);

      // Validate input
      if (!request.medications || request.medications.length < 2) {
        return this.createEmptyResult(request);
      }

      // Get RxCUIs for medications that don't have them
      const medicationsWithRxcui = await this.enrichMedicationsWithRxcui(request.medications);

      // Check for interactions using external API
      const interactionData = await this.fetchInteractions(medicationsWithRxcui);

      // Process and format interactions
      const processedInteractions = await this.processInteractions(
        interactionData,
        medicationsWithRxcui
      );

      // Determine severity flags
      const severityAnalysis = this.analyzeSeverity(processedInteractions);

      // Save interaction check to database
      const savedInteraction = await this.saveInteractionCheck({
        ...request,
        medications: medicationsWithRxcui,
        interactions: processedInteractions,
        ...severityAnalysis
      });

      // Create result object
      const result: InteractionCheckResult = {
        interactionId: savedInteraction._id,
        hasInteractions: processedInteractions.length > 0,
        hasCriticalInteractions: severityAnalysis.hasCriticalInteraction,
        hasContraindications: severityAnalysis.hasContraindication,
        interactionCount: processedInteractions.length,
        interactions: processedInteractions,
        requiresPharmacistReview: severityAnalysis.requiresPharmacistReview,
        summary: severityAnalysis.summary
      };

      logger.info(`Interaction check completed for patient ${request.patientId}. Found ${processedInteractions.length} interactions`);
      return result;

    } catch (error) {
      logger.error('Error in checkInteractions:', error);
      throw new Error(`Failed to check drug interactions: ${error}`);
    }
  }

  /**
   * Batch check interactions for multiple patients
   */
  async batchCheckInteractions(
    requests: InteractionCheckRequest[]
  ): Promise<BatchInteractionResult[]> {
    const results: BatchInteractionResult[] = [];
    
    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(async (request) => {
        try {
          const result = await this.checkInteractions(request);
          return { patientId: request.patientId, result };
        } catch (error) {
          return { 
            patientId: request.patientId, 
            result: this.createEmptyResult(request),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check interactions for all active medications of a patient
   */
  async checkPatientMedications(
    patientId: mongoose.Types.ObjectId,
    workplaceId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    checkType: 'manual' | 'automatic' | 'scheduled' = 'manual'
  ): Promise<InteractionCheckResult> {
    try {
      // Fetch active medications for the patient
      const activeMedications = await MedicationManagement.find({
        patientId,
        workplaceId,
        status: 'active'
      }).lean();

      if (activeMedications.length < 2) {
        return this.createEmptyResult({
          patientId,
          workplaceId,
          medications: [],
          userId
        });
      }

      // Convert to MedicationInput format
      const medications: MedicationInput[] = activeMedications.map(med => ({
        medicationId: med._id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency
      }));

      return await this.checkInteractions({
        patientId,
        workplaceId,
        medications,
        checkType,
        checkTrigger: 'patient_medication_list',
        userId
      });

    } catch (error) {
      logger.error(`Error checking patient medications for ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get interaction history for a patient
   */
  async getPatientInteractionHistory(
    patientId: mongoose.Types.ObjectId,
    includeResolved = false,
    limit = 50
  ): Promise<IDrugInteraction[]> {
    try {
      return await DrugInteraction.findByPatient(patientId, includeResolved)
        .limit(limit);
    } catch (error) {
      logger.error(`Error fetching interaction history for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get pending interactions requiring pharmacist review
   */
  async getPendingReviews(
    workplaceId: mongoose.Types.ObjectId,
    limit = 100
  ): Promise<IDrugInteraction[]> {
    try {
      return await DrugInteraction.findPendingReviews(workplaceId).limit(limit);
    } catch (error) {
      logger.error(`Error fetching pending reviews for workplace ${workplaceId}:`, error);
      throw error;
    }
  }

  /**
   * Review an interaction (pharmacist action)
   */
  async reviewInteraction(
    interactionId: mongoose.Types.ObjectId,
    reviewerId: mongoose.Types.ObjectId,
    decision: {
      action: 'approve' | 'modify' | 'reject' | 'monitor';
      reason: string;
      modificationSuggestions?: string;
      monitoringParameters?: string;
    },
    notes?: string
  ): Promise<IDrugInteraction> {
    try {
      const interaction = await DrugInteraction.findById(interactionId);
      if (!interaction) {
        throw new Error('Interaction not found');
      }

      return await interaction.markAsReviewed(reviewerId, decision, notes);
    } catch (error) {
      logger.error(`Error reviewing interaction ${interactionId}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async enrichMedicationsWithRxcui(medications: MedicationInput[]): Promise<MedicationInput[]> {
    // For now, return as-is. In a real implementation, you would:
    // 1. Look up RxCUI from drug name if not provided
    // 2. Use a drug name standardization service
    // 3. Cache results for performance
    return medications;
  }

  private async fetchInteractions(medications: MedicationInput[]): Promise<any> {
    const cacheKey = this.generateCacheKey(medications);
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Extract RxCUIs for API call
      const rxcuis = medications
        .map(med => med.rxcui)
        .filter(rxcui => rxcui && rxcui.length > 0) as string[];

      if (rxcuis.length < 2) {
        // If we don't have RxCUIs, we can't check via RxNorm API
        // In a production system, you'd implement name-to-RXCUI lookup
        return { interactions: [] };
      }

      // Call the existing drug interaction service
      const interactionData = await this.drugInteractionService.checkMultiDrugInteractions(rxcuis);
      
      // Cache the result
      this.setCached(cacheKey, interactionData);
      
      return interactionData;
    } catch (error) {
      logger.warn('Failed to fetch from RxNorm API, returning empty result:', error);
      return { interactions: [] };
    }
  }

  private async processInteractions(
    interactionData: any,
    medications: MedicationInput[]
  ): Promise<IInteractionDetail[]> {
    const interactions: IInteractionDetail[] = [];

    try {
      // Use existing service to format results
      const formattedResults = this.drugInteractionService.formatInteractionResults(interactionData);

      // Convert to our internal format
      for (const result of formattedResults) {
        for (const interaction of result.interactions) {
          const drug1 = medications.find(med => 
            med.name.toLowerCase().includes(result.drugName.toLowerCase()) ||
            med.rxcui === result.rxcui
          );
          
          const drug2 = medications.find(med => 
            med.name.toLowerCase().includes(interaction.interactingDrug.toLowerCase()) ||
            med.rxcui === interaction.interactingRxcui
          );

          if (drug1 && drug2) {
            interactions.push({
              drug1: {
                name: drug1.name,
                rxcui: drug1.rxcui,
                medicationId: drug1.medicationId
              },
              drug2: {
                name: drug2.name,
                rxcui: drug2.rxcui,
                medicationId: drug2.medicationId
              },
              severity: interaction.severity || 'minor',
              description: interaction.description,
              managementRecommendation: this.drugInteractionService.getManagementRecommendations(
                interaction.severity || 'minor',
                interaction.description
              ),
              source: interaction.source || 'RxNorm'
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error processing interactions:', error);
    }

    return interactions;
  }

  private analyzeSeverity(interactions: IInteractionDetail[]) {
    const summary = {
      critical: 0,
      major: 0,
      moderate: 0,
      minor: 0
    };

    let hasCriticalInteraction = false;
    let hasContraindication = false;

    for (const interaction of interactions) {
      switch (interaction.severity) {
        case 'contraindicated':
          summary.critical++;
          hasContraindication = true;
          hasCriticalInteraction = true;
          break;
        case 'major':
          summary.major++;
          hasCriticalInteraction = true;
          break;
        case 'moderate':
          summary.moderate++;
          break;
        case 'minor':
          summary.minor++;
          break;
      }
    }

    const requiresPharmacistReview = hasCriticalInteraction || hasContraindication;

    return {
      summary,
      hasCriticalInteraction,
      hasContraindication,
      requiresPharmacistReview
    };
  }

  private async saveInteractionCheck(data: any): Promise<IDrugInteraction> {
    const interaction = new DrugInteraction({
      workplaceId: data.workplaceId,
      patientId: data.patientId,
      medications: data.medications,
      interactions: data.interactions,
      hasCriticalInteraction: data.hasCriticalInteraction,
      hasContraindication: data.hasContraindication,
      requiresPharmacistReview: data.requiresPharmacistReview,
      checkType: data.checkType || 'manual',
      checkTrigger: data.checkTrigger,
      apiSource: 'RxNorm',
      createdBy: data.userId,
      updatedBy: data.userId
    });

    return await interaction.save();
  }

  private createEmptyResult(request: Partial<InteractionCheckRequest>): InteractionCheckResult {
    return {
      interactionId: new mongoose.Types.ObjectId(),
      hasInteractions: false,
      hasCriticalInteractions: false,
      hasContraindications: false,
      interactionCount: 0,
      interactions: [],
      requiresPharmacistReview: false,
      summary: {
        critical: 0,
        major: 0,
        moderate: 0,
        minor: 0
      }
    };
  }

  // Cache management
  private generateCacheKey(medications: MedicationInput[]): string {
    const sortedNames = medications
      .map(med => med.name.toLowerCase())
      .sort()
      .join('|');
    return `interactions:${sortedNames}`;
  }

  private getCached(key: string): any {
    const cached = this.interactionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCached(key: string, data: any): void {
    this.interactionCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear cache periodically
  public clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.interactionCache.entries()) {
      if (now - value.timestamp >= this.cacheTimeout) {
        this.interactionCache.delete(key);
      }
    }
  }
}

export default new UnifiedInteractionService();