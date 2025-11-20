import axios from 'axios';
import logger from '../../../utils/logger';

const DAILYMED_BASE_URL = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';

interface DailyMedSPL {
  set_id: string;
  title: string;
  published_date: string;
  content: any[];
}

interface DailyMedSearchResult {
  metadata: {
    total_elements: number;
    per_page: number;
    current_page: number;
  };
  results: Array<{
    setid: string;
    title: string;
    published_date: string;
  }>;
}

interface DailyMedMonograph {
  SPL?: DailyMedSPL;
}

class DailyMedService {
  /**
   * Search for drug monographs by name
   * @param {string} drugName - Name of the drug to search for
   * @returns {Promise<DailyMedSearchResult>} - Search results
   */
  async searchMonographs(drugName: string): Promise<DailyMedSearchResult> {
    try {
      const response = await axios.get(`${DAILYMED_BASE_URL}/spls.json`, {
        params: {
          drug_name: drugName,
          page: 1,
          pageSize: 10,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000, // 15 second timeout
      });

      logger.info(`Successfully retrieved monographs for ${drugName}`);
      return response.data;
    } catch (error: any) {
      logger.error('DailyMed search error:', error);

      // Return a structured empty response instead of throwing
      return {
        metadata: {
          total_elements: 0,
          per_page: 10,
          current_page: 1,
        },
        results: [],
      };
    }
  }

  /**
   * Get drug monograph by set ID
   * @param {string} setId - Set ID of the monograph
   * @returns {Promise<DailyMedMonograph>} - Monograph details
   */
  async getMonographById(setId: string): Promise<DailyMedMonograph> {
    try {
      const response = await axios.get(
        `${DAILYMED_BASE_URL}/spls/${setId}.json`,
        {
          headers: {
            Accept: 'application/json',
          },
          timeout: 15000, // 15 second timeout
        }
      );

      logger.info(`Successfully retrieved monograph for set ID: ${setId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`DailyMed monograph error for set ID ${setId}:`, error);

      // If the exact setId cannot be found, try to search for it
      try {
        logger.info(
          `Trying to search for monographs related to set ID: ${setId}`
        );
        // First search to see if we can find related monographs
        const searchResponse = await this.searchMonographs(setId);

        if (searchResponse.results && searchResponse.results.length > 0) {
          // Use the first result's setId
          const firstResult = searchResponse.results[0];
          if (firstResult && firstResult.setid) {
            logger.info(
              `Found alternative monograph with set ID: ${firstResult.setid}`
            );

            const altResponse = await axios.get(
              `${DAILYMED_BASE_URL}/spls/${firstResult.setid}.json`,
              {
                headers: {
                  Accept: 'application/json',
                },
                timeout: 15000,
              }
            );

            return altResponse.data;
          }
        }
      } catch (searchError) {
        logger.error('Alternative monograph search failed:', searchError);
      }

      // Return an empty structure if all attempts fail
      return { SPL: undefined };
    }
  }
}

export default new DailyMedService();
