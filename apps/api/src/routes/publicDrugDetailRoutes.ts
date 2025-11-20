import { Router } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * @route GET /api/public/drug-details/monograph/:id
 * @desc Public endpoint to get drug monograph
 * @access Public
 */
router.get('/monograph/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug ID is required',
      });
    }

    console.log(`Public drug monograph request received for ID: ${id}`);

    // Return mock data for development
    return res.json({
      success: true,
      data: {
        SPL: {
          set_id: id,
          title: 'Sample Drug Monograph',
          published_date: '2025-09-05',
          content: [
            {
              section: 'Description',
              text: 'This is a sample drug description.',
            },
            {
              section: 'Clinical Pharmacology',
              text: 'Information about how the drug works in the body.',
            },
            {
              section: 'Indications',
              text: 'Approved uses for the medication.',
            },
            { section: 'Dosage', text: 'Recommended dosing information.' },
            { section: 'Warnings', text: 'Important safety information.' },
          ],
        },
      },
    });
  } catch (error: any) {
    console.error('Public drug monograph error:', error);
    logger.error('Public drug monograph error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching drug monograph',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-details/interactions
 * @desc Public endpoint to check drug interactions
 * @access Public
 */
router.get('/interactions', async (req: any, res: any) => {
  try {
    const { rxcui } = req.query;
    if (!rxcui) {
      return res.status(400).json({
        success: false,
        error: 'RxCUI parameter is required',
      });
    }

    console.log(
      `Public drug interactions request received for RxCUI: ${rxcui}`
    );

    // Return mock data for development
    return res.json({
      success: true,
      data: {
        interactionTypeGroup: [
          {
            interactionType: [
              {
                minConceptItem: {
                  rxcui,
                  name: 'Sample Drug',
                  tty: 'SCD',
                },
                interactionPair: [
                  {
                    interactionConcept: [
                      {
                        minConceptItem: {
                          rxcui: rxcui,
                          name: 'Sample Drug',
                          tty: 'SCD',
                        },
                        sourceConceptItem: {
                          id: '123456',
                          name: 'Sample Drug',
                          url: '',
                        },
                      },
                      {
                        minConceptItem: {
                          rxcui: '207106',
                          name: 'Interacting Medication',
                          tty: 'SCD',
                        },
                        sourceConceptItem: {
                          id: '207106',
                          name: 'Interacting Medication',
                          url: '',
                        },
                      },
                    ],
                    severity: 'Moderate',
                    description:
                      'This is a sample drug interaction description.',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  } catch (error: any) {
    console.error('Public drug interactions error:', error);
    logger.error('Public drug interactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking drug interactions',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-details/adverse-effects/:id
 * @desc Public endpoint to get adverse effects for a drug
 * @access Public
 */
router.get('/adverse-effects/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug ID is required',
      });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    console.log(
      `Public adverse effects request received for ID: ${id}, limit: ${limitNum}`
    );

    // Return mock data for development
    return res.json({
      success: true,
      data: {
        meta: {
          disclaimer: 'Sample disclaimer for adverse effects data',
          terms: 'Sample terms of use',
          license: 'Sample license',
          last_updated: '2025-09-05',
          results: {
            skip: 0,
            limit: limitNum,
            total: limitNum,
          },
        },
        results: Array(limitNum)
          .fill(0)
          .map((_, i) => ({
            safetyreportid: `${id}-${i + 1}`,
            receivedate: '2025-01-01',
            receiptdate: '2025-01-02',
            seriousnessdeath: '0',
            seriousnesslifethreatening: '0',
            seriousnesshospitalization: '0',
            patient: {
              drug: [
                {
                  medicinalproduct: 'Sample Drug',
                  drugcharacterization: '1',
                  medicinalproductversion: '1',
                  drugdosagetext: 'Sample dosage',
                  drugadministrationroute: 'Oral',
                  drugindication: 'Sample indication',
                },
              ],
              reaction: [
                {
                  reactionmeddrapt: `Sample Adverse Effect ${i + 1}`,
                  reactionoutcome: 'recovered/resolved',
                },
              ],
            },
          })),
      },
    });
  } catch (error: any) {
    console.error('Public adverse effects error:', error);
    logger.error('Public adverse effects error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching adverse effects',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-details/formulary/:id
 * @desc Public endpoint to get formulary information for a drug
 * @access Public
 */
router.get('/formulary/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug ID is required',
      });
    }

    console.log(`Public formulary request received for ID: ${id}`);

    // Return mock data for development
    return res.json({
      success: true,
      data: {
        relatedGroup: {
          rxCui: id,
          termType: 'SCD',
          conceptGroup: [
            {
              tty: 'SCD',
              conceptProperties: [
                {
                  rxcui: id,
                  name: 'Sample Drug 10mg Oral Tablet',
                  synonym: 'Sample Drug',
                  tty: 'SCD',
                  language: 'ENG',
                  suppress: 'N',
                  umlscui: 'C123456',
                },
                {
                  rxcui: '223456',
                  name: 'Alternative Drug 10mg Oral Tablet',
                  synonym: 'Alternative Drug',
                  tty: 'SCD',
                  language: 'ENG',
                  suppress: 'N',
                  umlscui: 'C223456',
                },
              ],
            },
          ],
        },
      },
    });
  } catch (error: any) {
    console.error('Public formulary error:', error);
    logger.error('Public formulary error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching formulary information',
      message: error.message,
    });
  }
});

export default router;
