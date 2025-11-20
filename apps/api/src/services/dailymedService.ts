import { ApiClient } from '../utils/apiClient';
import logger from '../utils/logger';

export interface DailyMedSPL {
  setid: string;
  title: string;
  effective_time?: string;
  version_number?: string;
  spl_product_data_elements?: string;
}

export interface DailyMedSearchResult {
  data: DailyMedSPL[];
  metadata: {
    total_elements: number;
    elements_per_page: number;
    current_page: number;
    total_pages: number;
  };
}

export interface DailyMedMonograph {
  setid: string;
  title: string;
  effective_time: string;
  version_number: string;
  spl_product_data_elements: any[];
  spl_unstructured_data_elements: any[];
  packaging?: any[];
  product_ndc?: string[];
  generic_medicine?: any[];
  brand_name?: string[];
  active_ingredient?: any[];
  inactive_ingredient?: any[];
  dosage_form?: string[];
  route?: string[];
  marketing_category?: string[];
  application_number?: string[];
  labeler?: any[];
  dea_schedule?: string;
  controlled_substance?: string;
  boxed_warning?: string[];
  recent_major_changes?: any[];
  indications_and_usage?: string[];
  dosage_and_administration?: string[];
  contraindications?: string[];
  warnings_and_precautions?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  use_in_specific_populations?: string[];
  overdosage?: string[];
  description?: string[];
  clinical_pharmacology?: string[];
  nonclinical_toxicology?: string[];
  clinical_studies?: string[];
  how_supplied?: string[];
  storage_and_handling?: string[];
  patient_counseling_information?: string[];
}

export class DailyMedService {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient({
      baseURL: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
      timeout: 20000,
      retryAttempts: 3,
      retryDelay: 1500,
    });
  }

  /**
   * Search for drug monographs by name
   */
  async searchDrugs(
    drugName: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<DailyMedSearchResult> {
    try {
      const response = await this.client.get<DailyMedSearchResult>(
        '/spls.json',
        {
          params: {
            drug_name: drugName,
            page,
            pagesize: pageSize,
          },
        }
      );

      logger.info(
        `DailyMed search found ${response.data.metadata.total_elements} results for "${drugName}"`
      );
      return response.data;
    } catch (error) {
      logger.error('DailyMed drug search failed:', error);
      throw new Error(`Failed to search DailyMed: ${error}`);
    }
  }

  /**
   * Get detailed monograph by setid
   */
  async getMonograph(setid: string): Promise<DailyMedMonograph> {
    try {
      const response = await this.client.get<{ data: DailyMedMonograph[] }>(
        `/spls/${setid}.json`
      );

      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('Monograph not found');
      }

      const monograph = response.data.data[0];
      if (monograph) {
        logger.info(
          `Retrieved DailyMed monograph for setid ${setid}: ${monograph.title}`
        );
        return monograph;
      }
      throw new Error('Monograph data is missing');
    } catch (error) {
      logger.error('DailyMed monograph retrieval failed:', error);
      throw new Error(`Failed to get monograph: ${error}`);
    }
  }

  /**
   * Search by NDC (National Drug Code)
   */
  async searchByNDC(ndc: string): Promise<DailyMedSearchResult> {
    try {
      const response = await this.client.get<DailyMedSearchResult>(
        '/spls.json',
        {
          params: {
            ndc,
          },
        }
      );

      logger.info(
        `DailyMed NDC search found ${response.data.metadata.total_elements} results for NDC ${ndc}`
      );
      return response.data;
    } catch (error) {
      logger.error('DailyMed NDC search failed:', error);
      throw new Error(`Failed to search by NDC: ${error}`);
    }
  }
}
