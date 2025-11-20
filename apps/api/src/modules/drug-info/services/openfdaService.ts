import axios from 'axios';
import logger from '../../../utils/logger';

const OPENFDA_BASE_URL = 'https://api.fda.gov/drug';

interface OpenFDAEventResult {
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
  results: Array<{
    safetyreportid: string;
    receivedate: string;
    receiptdate: string;
    seriousnessdeath: string;
    seriousnesslifethreatening: string;
    seriousnesshospitalization: string;
    patient: {
      drug: Array<{
        medicinalproduct: string;
        drugcharacterization: string;
        medicinalproductversion: string;
        drugdosagetext: string;
        drugadministrationroute: string;
        drugindication: string;
      }>;
      reaction: Array<{
        reactionmeddrapt: string;
        reactionoutcome: string;
      }>;
    };
  }>;
}

interface OpenFDALabelResult {
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
  results: Array<{
    effective_time: string;
    version: string;
    openfda: {
      brand_name: string[];
      generic_name: string[];
      manufacturer_name: string[];
      product_type: string[];
    };
    indications_and_usage: string[];
    dosage_and_administration: string[];
  }>;
}

class OpenFdaService {
  /**
   * Get adverse effects for a drug
   * @param {string} drugName - Name of the drug
   * @param {number} limit - Number of records to return
   * @returns {Promise<OpenFDAEventResult>} - Adverse effects data
   */
  async getAdverseEffects(
    drugName: string,
    limit: number = 10
  ): Promise<OpenFDAEventResult> {
    try {
      // Properly encode the drug name for URL parameters
      const encodedDrugName = encodeURIComponent(drugName);
      const response = await axios.get(`${OPENFDA_BASE_URL}/event.json`, {
        params: {
          search: `patient.drug.medicinalproduct:"${encodedDrugName}"`,
          limit: limit,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000, // 15 second timeout
      });

      logger.info(`Successfully retrieved adverse effects for ${drugName}`);
      return response.data;
    } catch (error: any) {
      logger.error('OpenFDA adverse effects error:', error);

      // Try alternative query if the first one fails
      try {
        logger.info(`Trying alternative search for ${drugName}`);
        // Try a broader search using generic name
        const altResponse = await axios.get(`${OPENFDA_BASE_URL}/event.json`, {
          params: {
            search: `patient.drug.openfda.generic_name:"${encodeURIComponent(
              drugName
            )}" OR patient.drug.openfda.brand_name:"${encodeURIComponent(
              drugName
            )}"`,
            limit: limit,
          },
          headers: {
            Accept: 'application/json',
          },
          timeout: 15000,
        });

        logger.info(
          `Successfully retrieved adverse effects with alternative search for ${drugName}`
        );
        return altResponse.data;
      } catch (altError) {
        logger.error('Alternative OpenFDA search also failed:', altError);

        // Return a minimal structure rather than throwing
        return {
          meta: {
            disclaimer: 'No adverse effects found or API error occurred',
            terms: 'See OpenFDA for terms of service',
            license: 'See OpenFDA for license',
            last_updated: new Date().toISOString(),
            results: {
              skip: 0,
              limit: limit,
              total: 0,
            },
          },
          results: [],
        };
      }
    }
  }

  /**
   * Get drug labeling information
   * @param {string} brandName - Brand name of the drug
   * @returns {Promise<OpenFDALabelResult>} - Drug labeling data
   */
  /**
   * Get drug indications information
   * @param {string} drugId - RxCUI or drug identifier
   * @returns {Promise<OpenFDALabelResult>} - Drug indications data
   */
  async getDrugIndications(drugId: string): Promise<OpenFDALabelResult> {
    try {
      // First, try to get the drug name from RxNorm if drugId is an RxCUI
      let drugName = drugId;

      // If it appears to be an RxCUI (numeric), try to get the name
      if (/^\d+$/.test(drugId)) {
        try {
          const rxNormInfo = await axios.get(
            `https://rxnav.nlm.nih.gov/REST/rxcui/${drugId}/property.json?propName=name`
          );

          if (rxNormInfo.data?.propConceptGroup?.propConcept?.[0]?.propValue) {
            drugName =
              rxNormInfo.data.propConceptGroup.propConcept[0].propValue;
            logger.info(`Converted RxCUI ${drugId} to drug name: ${drugName}`);
          }
        } catch (rxError) {
          logger.warn(
            `Could not convert RxCUI ${drugId} to drug name:`,
            rxError
          );
          // Continue with the original ID
        }
      }

      // Properly encode the drug name for URL parameters
      const encodedDrugName = encodeURIComponent(drugName);

      // Search for indications using the drug name
      const response = await axios.get(`${OPENFDA_BASE_URL}/label.json`, {
        params: {
          search: `openfda.brand_name:"${encodedDrugName}" OR openfda.generic_name:"${encodedDrugName}"`,
          limit: 5,
          // Only return the fields we need for indications
          fields:
            'openfda.brand_name,openfda.generic_name,openfda.manufacturer_name,indications_and_usage',
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000, // 15 second timeout
      });

      logger.info(`Successfully retrieved drug indications for ${drugName}`);
      return response.data;
    } catch (error: any) {
      logger.error('OpenFDA indications search error:', error);

      // Return a minimal structure rather than throwing
      return {
        meta: {
          disclaimer: 'No drug indications found or API error occurred',
          terms: 'See OpenFDA for terms of service',
          license: 'See OpenFDA for license',
          last_updated: new Date().toISOString(),
          results: {
            skip: 0,
            limit: 5,
            total: 0,
          },
        },
        results: [],
      };
    }
  }

  async getDrugLabeling(brandName: string): Promise<OpenFDALabelResult> {
    try {
      // Properly encode the brand name for URL parameters and use quotes for exact matching
      const encodedBrandName = encodeURIComponent(brandName);
      const response = await axios.get(`${OPENFDA_BASE_URL}/label.json`, {
        params: {
          search: `openfda.brand_name:"${encodedBrandName}"`,
          limit: 10,
        },
        headers: {
          Accept: 'application/json',
        },
        timeout: 15000, // 15 second timeout
      });

      logger.info(`Successfully retrieved drug labeling for ${brandName}`);
      return response.data;
    } catch (error: any) {
      logger.error('OpenFDA labeling error:', error);

      // Try alternative search methods if the first one fails
      try {
        logger.info(`Trying alternative search for ${brandName}`);
        // Try searching by generic name as well
        const altResponse = await axios.get(`${OPENFDA_BASE_URL}/label.json`, {
          params: {
            search: `openfda.generic_name:"${encodeURIComponent(
              brandName
            )}" OR openfda.substance_name:"${encodeURIComponent(brandName)}"`,
            limit: 10,
          },
          headers: {
            Accept: 'application/json',
          },
          timeout: 15000,
        });

        logger.info(
          `Successfully retrieved drug labeling with alternative search for ${brandName}`
        );
        return altResponse.data;
      } catch (altError) {
        logger.error(
          'Alternative OpenFDA labeling search also failed:',
          altError
        );

        // Return a minimal structure rather than throwing
        return {
          meta: {
            disclaimer: 'No drug labeling found or API error occurred',
            terms: 'See OpenFDA for terms of service',
            license: 'See OpenFDA for license',
            last_updated: new Date().toISOString(),
            results: {
              skip: 0,
              limit: 10,
              total: 0,
            },
          },
          results: [],
        };
      }
    }
  }
}

export default new OpenFdaService();
