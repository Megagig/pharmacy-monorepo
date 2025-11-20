import { Router } from 'express';
import rxnormService from '../modules/drug-info/services/rxnormService';
import dailymedService from '../modules/drug-info/services/dailymedService';
import interactionService from '../modules/drug-info/services/interactionService';
import openfdaService from '../modules/drug-info/services/openfdaService';
import logger from '../utils/logger';

const router = Router();

/**
 * @route GET /api/public/monograph/:id
 * @desc Public endpoint to get drug monograph
 * @access Public
 */
router.get('/monograph/:id', async (req, res) => {
  console.log('=== PUBLIC MONOGRAPH API CALLED ===');

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Monograph ID is required',
      });
    }

    const monograph = await dailymedService.getMonographById(id);

    return res.json({
      success: true,
      data: monograph,
    });
  } catch (error: any) {
    logger.error('Public monograph fetch error:', error);

    return res.status(500).json({
      success: false,
      error: 'Error fetching monograph',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/public/interactions
 * @desc Public endpoint to check drug interactions
 * @access Public
 */
router.post('/interactions', async (req, res) => {
  console.log('=== PUBLIC INTERACTIONS API CALLED ===');

  try {
    const { rxcui, rxcuis } = req.body;

    if (!rxcui && (!rxcuis || !Array.isArray(rxcuis))) {
      return res.status(400).json({
        success: false,
        error: 'Valid rxcui or rxcuis array is required',
      });
    }

    let results;
    if (rxcui) {
      // Single drug interaction check
      results = await interactionService.getInteractionsForDrug(rxcui);
    } else if (rxcuis && Array.isArray(rxcuis)) {
      // Multiple drug interaction check
      results = await interactionService.getInteractionsForMultipleDrugs(
        rxcuis
      );
    }

    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Public interaction check error:', error);

    return res.status(500).json({
      success: false,
      error: 'Error checking interactions',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/adverse-effects/:id
 * @desc Public endpoint to get adverse effects for a drug
 * @access Public
 */
router.get('/adverse-effects/:id', async (req, res) => {
  console.log('=== PUBLIC ADVERSE EFFECTS API CALLED ===');

  try {
    const { id } = req.params;
    const { limit } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug identifier is required',
      });
    }

    // First try to get RxCUI if id is a name
    let drugName: string = id;
    try {
      const rxCuiData = await rxnormService.getRxCuiByName(id);
      if (
        rxCuiData &&
        rxCuiData.idGroup &&
        rxCuiData.idGroup.rxnormId &&
        rxCuiData.idGroup.rxnormId.length > 0
      ) {
        const firstRxCui = rxCuiData.idGroup.rxnormId[0];
        if (firstRxCui) {
          drugName = firstRxCui;
        }
      }
    } catch (e) {
      // If we can't get RxCUI, use the provided ID as name
      logger.info('Could not resolve RxCUI, using provided ID as name');
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    const adverseEffects = await openfdaService.getAdverseEffects(
      drugName,
      limitNum
    );

    return res.json({
      success: true,
      data: adverseEffects,
    });
  } catch (error: any) {
    logger.error('Public adverse effects fetch error:', error);

    return res.status(500).json({
      success: false,
      error: 'Error fetching adverse effects',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/formulary/:id
 * @desc Public endpoint to get formulary information
 * @access Public
 */
router.get('/formulary/:id', async (req, res) => {
  console.log('=== PUBLIC FORMULARY API CALLED ===');

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug identifier is required',
      });
    }

    // Add error handling for RxNav API
    try {
      const equivalents = await rxnormService.getTherapeuticEquivalents(id);

      return res.json({
        success: true,
        data: equivalents,
      });
    } catch (error: any) {
      // Check if it's a 404 error from RxNav API
      if (error.message && error.message.includes('404')) {
        return res.json({
          success: true,
          data: {
            // Return an empty but valid response structure
            relatedGroup: {
              rxcui: id,
              name: 'Unknown drug',
              conceptGroup: [],
            },
          },
        });
      }

      throw error; // Re-throw other errors to be caught by the outer try/catch
    }
  } catch (error: any) {
    logger.error('Public formulary fetch error:', error);

    return res.status(500).json({
      success: false,
      error: 'Error fetching formulary',
      message: error.message,
    });
  }
});

export default router;
