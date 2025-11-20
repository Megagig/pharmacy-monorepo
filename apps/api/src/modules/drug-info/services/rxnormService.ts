import axios from 'axios';
import logger from '../../../utils/logger';

const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

interface RxNormDrugGroup {
  name: string;
  conceptGroup: Array<{
    tty: string;
    conceptProperties: Array<{
      rxcui: string;
      name: string;
      synonym: string;
      tty: string;
      language: string;
      suppress: string;
      umlscui: string;
    }>;
  }>;
}

interface RxNormSearchResult {
  drugGroup?: RxNormDrugGroup;
}

interface RxNormRxCuiResult {
  idGroup: {
    name: string;
    rxnormId: string[];
  };
}

interface RxNormRelatedGroup {
  rxcui: string;
  termType: string;
  conceptGroup: Array<{
    tty: string;
    conceptProperties: Array<{
      rxcui: string;
      name: string;
      synonym: string;
      tty: string;
      language: string;
      suppress: string;
      umlscui: string;
    }>;
  }>;
}

interface RxNormRelatedResult {
  relatedGroup?: RxNormRelatedGroup;
}

class RxNormService {
  /**
   * Search for drugs by name using RxNorm API
   * @param {string} name - Drug name to search for
   * @returns {Promise<RxNormSearchResult>} - Search results
   */
  async searchDrugs(name: string): Promise<RxNormSearchResult> {
    try {
      logger.info(`Searching for drug with name: ${name}`);

      // Use the correct RxNorm API endpoint for drug search
      // The /drugs endpoint provides comprehensive drug information
      const response = await axios.get(`${RXNORM_BASE_URL}/drugs.json`, {
        params: { name: name },
        headers: {
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });
      return response.data;
    } catch (error: any) {
      logger.error('RxNorm search error:', error);

      // Try alternative endpoint if the drugs endpoint fails
      try {
        logger.info(
          'Trying alternative RxNorm endpoint: /approximateTerm.json'
        );
        const altResponse = await axios.get(
          `${RXNORM_BASE_URL}/approximateTerm.json`,
          {
            params: {
              term: name,
              maxEntries: 10,
            },
            headers: {
              Accept: 'application/json',
            },
            timeout: 10000, // 10 second timeout
          }
        );

        logger.debug('Alternative RxNorm API response received');

        // Convert the approximate match format to our expected format
        const conceptGroups: any[] = [];
        if (altResponse.data.approximateGroup?.candidate) {
          const candidates = Array.isArray(
            altResponse.data.approximateGroup.candidate
          )
            ? altResponse.data.approximateGroup.candidate
            : [altResponse.data.approximateGroup.candidate];

          const conceptProperties = candidates.map((candidate: any) => ({
            rxcui: candidate.rxcui || '',
            name: candidate.name || '',
            synonym: candidate.name || '',
            tty: candidate.tty || 'SCD',
            language: 'ENG',
            suppress: 'N',
            umlscui: '',
          }));

          if (conceptProperties.length > 0) {
            conceptGroups.push({
              tty: 'SCD',
              conceptProperties: conceptProperties,
            });
          }
        }

        return {
          drugGroup: {
            name: name,
            conceptGroup: conceptGroups,
          },
        };
      } catch (altError: any) {
        logger.error('Alternative RxNorm search error:', altError);

        // Return empty result if all attempts fail
        return { drugGroup: { name: name, conceptGroup: [] } };
      }
    }
  }

  /**
   * Get RxCUI for a drug name
   * @param {string} name - Drug name
   * @returns {Promise<RxNormRxCuiResult>} - RxCUI information
   */
  async getRxCuiByName(name: string): Promise<RxNormRxCuiResult> {
    try {
      // Using the correct endpoint with appropriate parameters
      // search=2 means "Exact or Normalized" match which gives best results
      const response = await axios.get(`${RXNORM_BASE_URL}/rxcui.json`, {
        params: {
          name: name,
          search: 2, // Use Exact or Normalized match for better results
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      logger.info(`RxCUI lookup successful for ${name}`);
      return response.data;
    } catch (error: any) {
      logger.error('RxNorm RxCUI lookup error:', error);

      // Try approximate match as a fallback
      try {
        logger.info(`Trying approximate match for ${name}`);
        const altResponse = await axios.get(`${RXNORM_BASE_URL}/rxcui.json`, {
          params: {
            name: name,
            search: 9, // Approximate match as fallback
          },
          headers: {
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        logger.info(`Approximate match found for ${name}`);
        return altResponse.data;
      } catch (altError) {
        logger.error('RxNorm approximate match error:', altError);

        // Return empty result if no matches found
        return {
          idGroup: {
            name: name,
            rxnormId: [],
          },
        };
      }
    }
  }

  /**
   * Get therapeutic equivalents for a drug
   * @param {string} rxcui - RxCUI of the drug
   * @returns {Promise<RxNormRelatedResult>} - Therapeutic equivalence information
   */
  async getTherapeuticEquivalents(rxcui: string): Promise<RxNormRelatedResult> {
    try {
      // Using the correct endpoint and parameters for therapeutic equivalents
      // The getRelatedByType endpoint is more accurate for finding therapeutic equivalents
      const response = await axios.get(
        `${RXNORM_BASE_URL}/rxcui/${rxcui}/related.json`,
        {
          params: {
            tty: 'SCD', // Standard Clinical Drug
          },
          headers: {
            Accept: 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      logger.info(
        `Successfully retrieved therapeutic equivalents for RxCUI: ${rxcui}`
      );
      return response.data;
    } catch (error: any) {
      logger.error(
        `RxNorm therapeutic equivalents error for RxCUI ${rxcui}:`,
        error
      );

      // Try alternative approach - getAllRelatedInfo
      try {
        logger.info(`Trying alternative approach for RxCUI: ${rxcui}`);
        const altResponse = await axios.get(
          `${RXNORM_BASE_URL}/rxcui/${rxcui}/allrelated.json`,
          {
            headers: {
              Accept: 'application/json',
            },
            timeout: 10000,
          }
        );

        logger.info(
          `Successfully retrieved alternative related info for RxCUI: ${rxcui}`
        );

        // Map the response format if needed
        if (altResponse.data && altResponse.data.allRelatedGroup) {
          // Convert allRelatedGroup format to expected relatedGroup format
          const scdGroup = altResponse.data.allRelatedGroup.conceptGroup?.find(
            (group: any) => group.tty === 'SCD'
          );

          if (scdGroup) {
            return {
              relatedGroup: {
                rxcui: rxcui,
                termType: 'SCD',
                conceptGroup: [scdGroup],
              },
            };
          }
        }

        // Return empty structure if no matches
        return {
          relatedGroup: {
            rxcui: rxcui,
            termType: 'SCD',
            conceptGroup: [],
          },
        };
      } catch (altError) {
        logger.error(
          `Alternative approach also failed for RxCUI ${rxcui}:`,
          altError
        );

        // Return empty structure if all attempts fail
        return {
          relatedGroup: {
            rxcui: rxcui,
            termType: 'SCD',
            conceptGroup: [],
          },
        };
      }
    }
  }
}

export default new RxNormService();
