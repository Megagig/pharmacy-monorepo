import { Router } from 'express';
import rxnormService from '../modules/drug-info/services/rxnormService';
import dailymedService from '../modules/drug-info/services/dailymedService';
import openfdaService from '../modules/drug-info/services/openfdaService';
import interactionService from '../modules/drug-info/services/interactionService';
import logger from '../utils/logger';

const router = Router();

/**
 * @route GET /api/public/drug-search
 * @desc Public endpoint to search for drugs by name
 * @access Public
 */
router.get('/drug-search', async (req: any, res: any) => {
  try {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Drug name is required',
      });
    }

    const results = await rxnormService.searchDrugs(name);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Public drug search error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error searching for drugs',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-monograph/:id
 * @desc Public endpoint to get drug monograph information
 * @access Public
 */
router.get('/drug-monograph/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug id is required',
      });
    }
    const monograph = await dailymedService.getMonographById(id);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: monograph,
    });
  } catch (error: any) {
    logger.error('Public drug monograph error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error retrieving drug monograph',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-indications/:id
 * @desc Public endpoint to get drug indications from OpenFDA
 * @access Public
 */
router.get('/drug-indications/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug id is required',
      });
    }

    const indications = await openfdaService.getDrugIndications(id);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: indications,
    });
  } catch (error: any) {
    logger.error('Public drug indications error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error retrieving drug indications',
      message: error.message,
    });
  }
});

/**
 * @route POST /api/public/drug-interactions
 * @desc Public endpoint to check drug interactions
 * @access Public
 */
router.post('/drug-interactions', async (req: any, res: any) => {
  try {
    const { rxcui, rxcuis } = req.body;

    let results;
    if (rxcui) {
      // Single drug interaction check
      results = await interactionService.getInteractionsForDrug(rxcui);
    } else if (rxcuis && Array.isArray(rxcuis)) {
      // Multiple drug interaction check
      results = await interactionService.getInteractionsForMultipleDrugs(
        rxcuis
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either rxcui or rxcuis array is required',
      });
    }

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Public drug interactions error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error checking drug interactions',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-adverse-effects/:id
 * @desc Public endpoint to get adverse effects for a drug
 * @access Public
 */
router.get('/drug-adverse-effects/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug id is required',
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

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: adverseEffects,
    });
  } catch (error: any) {
    logger.error('Public drug adverse effects error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error retrieving adverse effects',
      message: error.message,
    });
  }
});

/**
 * @route GET /api/public/drug-formulary/:id
 * @desc Public endpoint to get formulary and therapeutic equivalents
 * @access Public
 */
router.get('/drug-formulary/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Drug id is required',
      });
    }
    const equivalents = await rxnormService.getTherapeuticEquivalents(id);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.json({
      success: true,
      data: equivalents,
    });
  } catch (error: any) {
    logger.error('Public drug formulary error:', error);

    // Set response headers explicitly
    res.setHeader('Content-Type', 'application/json');

    return res.status(500).json({
      success: false,
      error: 'Error retrieving formulary information',
      message: error.message,
    });
  }
});

export default router;
