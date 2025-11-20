import { ApiClient } from '../utils/apiClient';
import logger from '../utils/logger';

export interface RxNormDrug {
  rxcui: string;
  name: string;
  synonym?: string;
  tty: string; // Term Type
  language?: string;
  suppress?: string;
}

export interface RxNormSearchResult {
  drugGroup: {
    name?: string;
    conceptGroup?: Array<{
      tty: string;
      conceptProperties?: RxNormDrug[];
    }>;
  };
}

export interface RxNormRelatedResult {
  relatedGroup: {
    conceptGroup?: Array<{
      tty: string;
      conceptProperties?: RxNormDrug[];
    }>;
  };
}

export interface RxCuiResult {
  idGroup: {
    rxnormId: string[];
  };
}

export class RxNormService {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient({
      baseURL: 'https://rxnav.nlm.nih.gov/REST',
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 1000
    });
  }

  /**
   * Search for drugs by name
   */
  async searchDrugs(drugName: string, maxEntries: number = 20): Promise<RxNormDrug[]> {
    try {
      const response = await this.client.get<RxNormSearchResult>('/drugs.json', {
        params: {
          name: drugName,
          maxEntries
        }
      });

      const conceptGroups = response.data?.drugGroup?.conceptGroup || [];
      const drugs: RxNormDrug[] = [];

      conceptGroups.forEach(group => {
        if (group.conceptProperties) {
          drugs.push(...group.conceptProperties);
        }
      });

      logger.info(`RxNorm search found ${drugs.length} drugs for "${drugName}"`);
      return drugs;
    } catch (error) {
      logger.error('RxNorm drug search failed:', error);
      throw new Error(`Failed to search drugs: ${error}`);
    }
  }

  /**
   * Get RxCUI for a drug name
   */
  async getRxCui(drugName: string): Promise<string[]> {
    try {
      const response = await this.client.get<RxCuiResult>('/rxcui', {
        params: {
          name: drugName
        }
      });

      const rxcuis = response.data?.idGroup?.rxnormId || [];
      logger.info(`Found ${rxcuis.length} RxCUIs for "${drugName}"`);
      return rxcuis;
    } catch (error) {
      logger.error('RxNorm RxCUI lookup failed:', error);
      throw new Error(`Failed to get RxCUI: ${error}`);
    }
  }

  /**
   * Get therapeutic equivalents and related drugs
   */
  async getTherapeuticEquivalents(rxcui: string): Promise<RxNormDrug[]> {
    try {
      const response = await this.client.get<RxNormRelatedResult>(`/related.json`, {
        params: {
          rxcui,
          tty: 'SCD+SBD+GPCK+BPCK' // Semantic Clinical Drug + Semantic Branded Drug + Generic Pack + Branded Pack
        }
      });

      const conceptGroups = response.data?.relatedGroup?.conceptGroup || [];
      const equivalents: RxNormDrug[] = [];

      conceptGroups.forEach(group => {
        if (group.conceptProperties) {
          equivalents.push(...group.conceptProperties);
        }
      });

      logger.info(`Found ${equivalents.length} therapeutic equivalents for RxCUI ${rxcui}`);
      return equivalents;
    } catch (error) {
      logger.error('RxNorm therapeutic equivalents lookup failed:', error);
      throw new Error(`Failed to get therapeutic equivalents: ${error}`);
    }
  }

  /**
   * Get all related drugs (includes generics, brands, ingredients)
   */
  async getRelatedDrugs(rxcui: string): Promise<RxNormDrug[]> {
    try {
      const response = await this.client.get<RxNormRelatedResult>(`/related.json`, {
        params: {
          rxcui
        }
      });

      const conceptGroups = response.data?.relatedGroup?.conceptGroup || [];
      const related: RxNormDrug[] = [];

      conceptGroups.forEach(group => {
        if (group.conceptProperties) {
          related.push(...group.conceptProperties);
        }
      });

      logger.info(`Found ${related.length} related drugs for RxCUI ${rxcui}`);
      return related;
    } catch (error) {
      logger.error('RxNorm related drugs lookup failed:', error);
      throw new Error(`Failed to get related drugs: ${error}`);
    }
  }

  /**
   * Get drug details by RxCUI
   */
  async getDrugDetails(rxcui: string): Promise<any> {
    try {
      // Get basic properties
      const propertiesResponse = await this.client.get(`/rxcui/${rxcui}/properties.json`);
      
      // Get NDCs (National Drug Codes)
      const ndcResponse = await this.client.get(`/rxcui/${rxcui}/ndcs.json`);
      
      return {
        properties: propertiesResponse.data?.properties || {},
        ndcs: ndcResponse.data?.ndcGroup?.ndcList || []
      };
    } catch (error) {
      logger.error('RxNorm drug details lookup failed:', error);
      throw new Error(`Failed to get drug details: ${error}`);
    }
  }

  /**
   * Spell suggestion for drug names
   */
  async getSpellingSuggestions(drugName: string): Promise<string[]> {
    try {
      const response = await this.client.get('/spellingsuggestions.json', {
        params: {
          name: drugName
        }
      });

      const suggestions = response.data?.suggestionGroup?.suggestionList?.suggestion || [];
      logger.info(`Found ${suggestions.length} spelling suggestions for "${drugName}"`);
      return suggestions;
    } catch (error) {
      logger.error('RxNorm spelling suggestions failed:', error);
      return []; // Return empty array on error since this is not critical
    }
  }
}

export default new RxNormService();