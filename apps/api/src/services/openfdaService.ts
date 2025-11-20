import { ApiClient } from '../utils/apiClient';
import logger from '../utils/logger';

export interface OpenFDAAdverseEvent {
  receiptdate?: string;
  receiptdateformat?: string;
  patient?: {
    patientonsetage?: string;
    patientonsetageunit?: string;
    patientsex?: string;
    patientweight?: string;
    drug?: Array<{
      medicinalproduct?: string;
      drugindication?: string;
      drugstartdate?: string;
      drugenddate?: string;
      drugdosagetext?: string;
      actiondrug?: string;
      drugrecurrence?: string;
    }>;
    reaction?: Array<{
      reactionmeddrapt?: string;
      reactionoutcome?: string;
    }>;
  };
  sender?: {
    sendertype?: string;
    senderorganization?: string;
  };
  serious?: string;
  seriousnesscongenitalanomali?: string;
  seriousnessdeath?: string;
  seriousnessdisabling?: string;
  seriousnesshospitalization?: string;
  seriousnesslifethreatening?: string;
  seriousnessother?: string;
}

export interface OpenFDAAdverseEventResult {
  meta: {
    disclaimer: string;
    terms: string;
    license: string;
    last_updated: string;
    results: {
      skip: number;
      limit: number;
      total: number;
    };
  };
  results: OpenFDAAdverseEvent[];
}

export interface OpenFDADrugLabel {
  id: string;
  set_id: string;
  version?: string;
  effective_time?: string;
  openfda?: {
    application_number?: string[];
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_ndc?: string[];
    product_type?: string[];
    route?: string[];
    substance_name?: string[];
    rxcui?: string[];
    spl_id?: string[];
    spl_set_id?: string[];
    package_ndc?: string[];
    nui?: string[];
    pharm_class_moa?: string[];
    pharm_class_cs?: string[];
    pharm_class_pe?: string[];
    pharm_class_epc?: string[];
  };
  purpose?: string[];
  indications_and_usage?: string[];
  contraindications?: string[];
  dosage_and_administration?: string[];
  warnings?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  boxed_warning?: string[];
  warnings_and_cautions?: string[];
  pregnancy?: string[];
  pediatric_use?: string[];
  geriatric_use?: string[];
  overdosage?: string[];
  clinical_pharmacology?: string[];
  mechanism_of_action?: string[];
  pharmacodynamics?: string[];
  pharmacokinetics?: string[];
}

export interface OpenFDADrugLabelResult {
  meta: {
    disclaimer: string;
    terms: string;
    license: string;
    last_updated: string;
    results: {
      skip: number;
      limit: number;
      total: number;
    };
  };
  results: OpenFDADrugLabel[];
}

export class OpenFDAService {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient({
      baseURL: 'https://api.fda.gov/drug',
      timeout: 20000,
      retryAttempts: 3,
      retryDelay: 2000
    });
  }

  /**
   * Search for adverse events by drug name
   */
  async getAdverseEvents(drugName: string, limit: number = 100, skip: number = 0): Promise<OpenFDAAdverseEventResult> {
    try {
      const searchQuery = `patient.drug.medicinalproduct:"${drugName}"`;
      
      const response = await this.client.get<OpenFDAAdverseEventResult>('/event.json', {
        params: {
          search: searchQuery,
          limit,
          skip
        }
      });

      logger.info(`OpenFDA adverse events found ${response.data.meta.results.total} results for "${drugName}"`);
      return response.data;
    } catch (error) {
      logger.error('OpenFDA adverse events search failed:', error);
      throw new Error(`Failed to get adverse events: ${error}`);
    }
  }

  /**
   * Get drug labeling information
   */
  async getDrugLabeling(drugName: string, limit: number = 10, skip: number = 0): Promise<OpenFDADrugLabelResult> {
    try {
      // Try searching by brand name first, then generic name
      let searchQuery = `openfda.brand_name:"${drugName}"`;
      
      const response = await this.client.get<OpenFDADrugLabelResult>('/label.json', {
        params: {
          search: searchQuery,
          limit,
          skip
        }
      });

      // If no results with brand name, try generic name
      if (response.data.meta.results.total === 0) {
        searchQuery = `openfda.generic_name:"${drugName}"`;
        const genericResponse = await this.client.get<OpenFDADrugLabelResult>('/label.json', {
          params: {
            search: searchQuery,
            limit,
            skip
          }
        });
        
        logger.info(`OpenFDA drug labeling found ${genericResponse.data.meta.results.total} results for generic "${drugName}"`);
        return genericResponse.data;
      }

      logger.info(`OpenFDA drug labeling found ${response.data.meta.results.total} results for brand "${drugName}"`);
      return response.data;
    } catch (error) {
      logger.error('OpenFDA drug labeling search failed:', error);
      throw new Error(`Failed to get drug labeling: ${error}`);
    }
  }

  /**
   * Get adverse events by severity
   */
  async getAdverseEventsBySeverity(drugName: string, serious: boolean = true): Promise<OpenFDAAdverseEventResult> {
    try {
      const seriousValue = serious ? '1' : '2';
      const searchQuery = `patient.drug.medicinalproduct:"${drugName}" AND serious:${seriousValue}`;
      
      const response = await this.client.get<OpenFDAAdverseEventResult>('/event.json', {
        params: {
          search: searchQuery,
          limit: 100
        }
      });

      logger.info(`OpenFDA serious adverse events found ${response.data.meta.results.total} results for "${drugName}"`);
      return response.data;
    } catch (error) {
      logger.error('OpenFDA serious adverse events search failed:', error);
      throw new Error(`Failed to get serious adverse events: ${error}`);
    }
  }

  /**
   * Analyze adverse event patterns for a drug
   */
  analyzeAdverseEventPatterns(events: OpenFDAAdverseEvent[]): any {
    const analysis: any = {
      totalEvents: events.length,
      reactionCounts: {},
      severityBreakdown: {
        serious: 0,
        nonSerious: 0
      },
      demographics: {
        ageGroups: {},
        genders: {}
      },
      outcomes: {}
    };

    events.forEach(event => {
      // Count reactions
      if (event.patient?.reaction) {
        event.patient.reaction.forEach(reaction => {
          if (reaction.reactionmeddrapt) {
            analysis.reactionCounts[reaction.reactionmeddrapt] = 
              (analysis.reactionCounts[reaction.reactionmeddrapt] || 0) + 1;
          }
          
          if (reaction.reactionoutcome) {
            analysis.outcomes[reaction.reactionoutcome] = 
              (analysis.outcomes[reaction.reactionoutcome] || 0) + 1;
          }
        });
      }

      // Severity breakdown
      if (event.serious === '1') {
        analysis.severityBreakdown.serious++;
      } else {
        analysis.severityBreakdown.nonSerious++;
      }

      // Demographics
      if (event.patient?.patientsex) {
        analysis.demographics.genders[event.patient.patientsex] = 
          (analysis.demographics.genders[event.patient.patientsex] || 0) + 1;
      }

      if (event.patient?.patientonsetage && event.patient?.patientonsetageunit) {
        const ageGroup = this.categorizeAge(
          parseInt(event.patient.patientonsetage), 
          event.patient.patientonsetageunit
        );
        analysis.demographics.ageGroups[ageGroup] = 
          (analysis.demographics.ageGroups[ageGroup] || 0) + 1;
      }
    });

    // Sort reactions by frequency
    analysis.topReactions = Object.entries(analysis.reactionCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([reaction, count]) => ({ reaction, count }));

    return analysis;
  }

  /**
   * Get contraindications and warnings from drug labeling
   */
  extractSafetyInformation(labeling: OpenFDADrugLabel): any {
    return {
      contraindications: labeling.contraindications || [],
      warnings: labeling.warnings || [],
      boxedWarnings: labeling.boxed_warning || [],
      warningsAndCautions: labeling.warnings_and_cautions || [],
      adverseReactions: labeling.adverse_reactions || [],
      drugInteractions: labeling.drug_interactions || [],
      overdosage: labeling.overdosage || [],
      pregnancy: labeling.pregnancy || [],
      pediatricUse: labeling.pediatric_use || [],
      geriatricUse: labeling.geriatric_use || []
    };
  }

  private categorizeAge(age: number, unit: string): string {
    // Convert to years if needed
    let ageInYears = age;
    if (unit === '802' || unit.toLowerCase().includes('month')) { // months
      ageInYears = age / 12;
    } else if (unit === '803' || unit.toLowerCase().includes('week')) { // weeks
      ageInYears = age / 52;
    } else if (unit === '804' || unit.toLowerCase().includes('day')) { // days
      ageInYears = age / 365;
    }

    if (ageInYears < 2) return 'Infant (0-2 years)';
    if (ageInYears < 12) return 'Child (2-12 years)';
    if (ageInYears < 18) return 'Adolescent (12-18 years)';
    if (ageInYears < 65) return 'Adult (18-65 years)';
    return 'Elderly (65+ years)';
  }
}

export default new OpenFDAService();