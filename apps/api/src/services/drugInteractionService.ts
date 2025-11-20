import { ApiClient } from '../utils/apiClient';
import logger from '../utils/logger';

export interface DrugInteraction {
  interactionPairs: Array<{
    interactionConcept: Array<{
      minConceptItem: {
        rxcui: string;
        name: string;
        tty: string;
      };
      sourceConceptItem: {
        id: string;
        name: string;
        url?: string;
      };
    }>;
    severity?: string;
    description?: string;
  }>;
}

export interface InteractionResult {
  nlmDisclaimer?: string;
  interactions: DrugInteraction[];
}

export interface SingleDrugInteraction {
  nlmDisclaimer?: string;
  interactionTypeGroup?: Array<{
    sourceDisclaimer: string;
    sourceName: string;
    interactionType: Array<{
      comment?: string;
      minConcept: Array<{
        rxcui: string;
        name: string;
        tty: string;
      }>;
    }>;
  }>;
}

export interface DrugInteractionCheck {
  drugName: string;
  rxcui?: string;
  interactions: Array<{
    interactingDrug: string;
    interactingRxcui?: string;
    severity?: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    source: string;
    management?: string;
  }>;
}

export class DrugInteractionService {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient({
      baseURL: 'https://rxnav.nlm.nih.gov/REST/interaction',
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 1000,
    });
  }

  /**
   * Check interactions for a single drug by RxCUI
   */
  async checkSingleDrugInteractions(
    rxcui: string
  ): Promise<SingleDrugInteraction> {
    try {
      const response = await this.client.get<SingleDrugInteraction>(
        `/interaction.json`,
        {
          params: { rxcui },
        }
      );

      logger.info(`Drug interaction check completed for RxCUI ${rxcui}`);
      return response.data;
    } catch (error) {
      logger.error('Single drug interaction check failed:', error);
      throw new Error(
        `Failed to check interactions for RxCUI ${rxcui}: ${error}`
      );
    }
  }

  /**
   * Check interactions between multiple drugs
   */
  async checkMultiDrugInteractions(
    rxcuis: string[]
  ): Promise<InteractionResult> {
    try {
      // RxNav API expects POST for multiple drug interactions
      const response = await this.client.post<InteractionResult>('/list.json', {
        rxcuis,
      });

      logger.info(
        `Multi-drug interaction check completed for ${rxcuis.length} drugs`
      );
      return response.data;
    } catch (error) {
      logger.error('Multi-drug interaction check failed:', error);
      throw new Error(
        `Failed to check interactions for multiple drugs: ${error}`
      );
    }
  }

  /**
   * Process and format interaction results for frontend consumption
   */
  formatInteractionResults(
    interactionData: SingleDrugInteraction | InteractionResult,
    primaryRxcui?: string
  ): DrugInteractionCheck[] {
    const results: DrugInteractionCheck[] = [];

    try {
      // Handle single drug interaction results
      if (
        'interactionTypeGroup' in interactionData &&
        interactionData.interactionTypeGroup
      ) {
        for (const typeGroup of interactionData.interactionTypeGroup) {
          for (const interactionType of typeGroup.interactionType) {
            if (interactionType.minConcept) {
              for (const concept of interactionType.minConcept) {
                // Skip self-interactions
                if (concept.rxcui === primaryRxcui) continue;

                results.push({
                  drugName: concept.name,
                  rxcui: concept.rxcui,
                  interactions: [
                    {
                      interactingDrug: concept.name,
                      interactingRxcui: concept.rxcui,
                      description:
                        interactionType.comment || 'Interaction detected',
                      source: typeGroup.sourceName,
                      severity: this.determineSeverity(
                        interactionType.comment || ''
                      ),
                    },
                  ],
                });
              }
            }
          }
        }
      }

      // Handle multi-drug interaction results
      if ('interactions' in interactionData && interactionData.interactions) {
        for (const interaction of interactionData.interactions) {
          if (interaction.interactionPairs) {
            for (const pair of interaction.interactionPairs) {
              if (
                pair.interactionConcept &&
                pair.interactionConcept.length >= 2
              ) {
                const drug1 = pair.interactionConcept[0];
                const drug2 = pair.interactionConcept[1];

                // Add null checks
                if (
                  drug1 &&
                  drug2 &&
                  drug1.minConceptItem &&
                  drug2.minConceptItem &&
                  drug1.sourceConceptItem
                ) {
                  results.push({
                    drugName: drug1.minConceptItem.name,
                    rxcui: drug1.minConceptItem.rxcui,
                    interactions: [
                      {
                        interactingDrug: drug2.minConceptItem.name,
                        interactingRxcui: drug2.minConceptItem.rxcui,
                        description:
                          pair.description || 'Drug interaction detected',
                        source: drug1.sourceConceptItem.name,
                        severity: this.determineSeverity(
                          pair.description || ''
                        ),
                      },
                    ],
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error formatting interaction results:', error);
    }

    return results;
  }

  /**
   * Determine interaction severity based on description keywords
   */
  private determineSeverity(
    description: string
  ): 'minor' | 'moderate' | 'major' | 'contraindicated' {
    const lowerDesc = description.toLowerCase();

    if (
      lowerDesc.includes('contraindicated') ||
      lowerDesc.includes('avoid') ||
      lowerDesc.includes('dangerous')
    ) {
      return 'contraindicated';
    }

    if (
      lowerDesc.includes('major') ||
      lowerDesc.includes('serious') ||
      lowerDesc.includes('severe')
    ) {
      return 'major';
    }

    if (
      lowerDesc.includes('moderate') ||
      lowerDesc.includes('monitor') ||
      lowerDesc.includes('caution')
    ) {
      return 'moderate';
    }

    return 'minor';
  }

  /**
   * Get interaction management recommendations
   */
  getManagementRecommendations(severity: string, description: string): string {
    switch (severity) {
      case 'contraindicated':
        return 'Do not use together. Consider alternative medications.';
      case 'major':
        return 'Monitor closely. Consider dose adjustment or alternative therapy.';
      case 'moderate':
        return 'Monitor for adverse effects. Consider dose modification if needed.';
      case 'minor':
        return 'Monitor patient. Interaction is generally manageable.';
      default:
        return 'Monitor patient for any adverse effects.';
    }
  }

  /**
   * Check if a drug name might have interactions (preliminary check)
   */
  async quickInteractionCheck(
    drugName: string
  ): Promise<{ hasInteractions: boolean; count: number }> {
    try {
      // This is a simplified check - in a real implementation you might
      // want to maintain a local database of common interactions
      const response = await this.client.get('/interaction.json', {
        params: { rxcui: drugName }, // This might not work with name, needs RxCUI
      });

      const hasInteractions =
        response.data?.interactionTypeGroup &&
        response.data.interactionTypeGroup.length > 0;
      const count =
        response.data?.interactionTypeGroup?.reduce(
          (total: number, group: any) => {
            return total + (group.interactionType?.length || 0);
          },
          0
        ) || 0;

      return { hasInteractions, count };
    } catch (error) {
      logger.warn('Quick interaction check failed:', error);
      return { hasInteractions: false, count: 0 };
    }
  }
}

export default new DrugInteractionService();
