import { Request, Response, NextFunction } from 'express';
import rxnormService from '../services/rxnormService';
import dailymedService from '../services/dailymedService';
import openfdaService from '../services/openfdaService';
import interactionService from '../services/interactionService';
import { DrugSearchHistory, TherapyPlan } from '../models/drugCacheModel';
import logger from '../../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class DrugController {
  /**
   * Search for drugs by name
   * @route GET /api/drugs/search
   */
  async searchDrugs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        res
          .status(400)
          .json({ success: false, error: 'Drug name is required' });
        return;
      }

      logger.info(`Drug search request received for name: ${name}`);
      const results = await rxnormService.searchDrugs(name);
      logger.info(
        `Retrieved ${
          results?.drugGroup?.conceptGroup?.length || 0
        } concept groups`
      );

      // Save search history if user is authenticated
      if (req.user && req.user._id) {
        logger.info(`Saving search history for user: ${req.user._id}`);
        await DrugSearchHistory.create({
          userId: req.user._id,
          searchTerm: name,
          searchResults: results,
        });
      } else {
        logger.debug('User not authenticated, skipping search history');
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Drug search error details:', error);
      res.status(500).json({
        success: false,
        error: 'Error searching for drugs',
        message: error.message,
      });
    }
  }

  /**
   * Get drug monograph by set ID
   * @route GET /api/drugs/monograph/:id
   */
  async getMonograph(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Monograph ID is required' });
        return;
      }

      const monograph = await dailymedService.getMonographById(id);
      res.json(monograph);
    } catch (error: any) {
      logger.error('Monograph fetch error:', error);
      next(error);
    }
  }

  /**
   * Check drug interactions
   * @route POST /api/drugs/interactions
   */
  async checkInteractions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { rxcui, rxcuis } = req.body;

      logger.info('Interaction check request:', { rxcui, rxcuis });

      let results;
      if (rxcui) {
        // Single drug interaction check
        logger.info(`Checking interactions for single drug: ${rxcui}`);
        results = await interactionService.getInteractionsForDrug(rxcui);
      } else if (rxcuis && Array.isArray(rxcuis)) {
        // Multiple drug interaction check
        logger.info(`Checking interactions for multiple drugs: ${rxcuis.join(', ')}`);
        results = await interactionService.getInteractionsForMultipleDrugs(
          rxcuis
        );
      } else {
        logger.warn('Invalid request: missing rxcui or rxcuis');
        res
          .status(400)
          .json({ 
            success: false,
            error: 'Either rxcui or rxcuis array is required' 
          });
        return;
      }

      logger.info('Interaction check successful');
      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      logger.error('Interaction check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check drug interactions',
        message: error.message
      });
    }
  }

  /**
   * Get adverse effects for a drug
   * @route GET /api/drugs/adverse-effects/:id
   */
  async getAdverseEffects(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { limit } = req.query;

      if (!id) {
        res.status(400).json({ error: 'Drug identifier is required' });
        return;
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
      res.json(adverseEffects);
    } catch (error: any) {
      logger.error('Adverse effects fetch error:', error);
      next(error);
    }
  }

  /**
   * Get formulary and therapeutic equivalents
   * @route GET /api/drugs/formulary/:id
   */
  async getFormulary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Drug identifier is required' });
        return;
      }

      // Get therapeutic equivalents
      const equivalents = await rxnormService.getTherapeuticEquivalents(id);
      res.json(equivalents);
    } catch (error: any) {
      logger.error('Formulary fetch error:', error);
      next(error);
    }
  }

  /**
   * Create a new therapy plan
   * @route POST /api/drugs/therapy-plans
   */
  async createTherapyPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { planName, drugs, guidelines } = req.body;

      if (!planName || !drugs) {
        res.status(400).json({ error: 'Plan name and drugs are required' });
        return;
      }

      const therapyPlan = await TherapyPlan.create({
        userId: req.user?._id,
        planName,
        drugs,
        guidelines,
      });

      res.status(201).json(therapyPlan);
    } catch (error: any) {
      logger.error('Therapy plan creation error:', error);
      next(error);
    }
  }

  /**
   * Get all therapy plans for user
   * @route GET /api/drugs/therapy-plans
   */
  async getTherapyPlans(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const therapyPlans = await TherapyPlan.find({
        userId: req.user?._id,
      }).sort({ createdAt: -1 });

      res.json(therapyPlans);
    } catch (error: any) {
      logger.error('Therapy plans fetch error:', error);
      next(error);
    }
  }

  /**
   * Get therapy plan by ID
   * @route GET /api/drugs/therapy-plans/:id
   */
  async getTherapyPlanById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const therapyPlan = await TherapyPlan.findOne({
        _id: id,
        userId: req.user?._id,
      });

      if (!therapyPlan) {
        res.status(404).json({ error: 'Therapy plan not found' });
        return;
      }

      res.json(therapyPlan);
    } catch (error: any) {
      logger.error('Therapy plan fetch error:', error);
      next(error);
    }
  }

  /**
   * Update therapy plan
   * @route PUT /api/drugs/therapy-plans/:id
   */
  async updateTherapyPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { planName, drugs, guidelines } = req.body;

      const therapyPlan = await TherapyPlan.findOneAndUpdate(
        {
          _id: id,
          userId: req.user?._id,
        },
        {
          planName,
          drugs,
          guidelines,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!therapyPlan) {
        res.status(404).json({ error: 'Therapy plan not found' });
        return;
      }

      res.json(therapyPlan);
    } catch (error: any) {
      logger.error('Therapy plan update error:', error);
      next(error);
    }
  }

  /**
   * Delete therapy plan
   * @route DELETE /api/drugs/therapy-plans/:id
   */
  async deleteTherapyPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const therapyPlan = await TherapyPlan.findOneAndDelete({
        _id: id,
        userId: req.user?._id,
      });

      if (!therapyPlan) {
        res.status(404).json({ error: 'Therapy plan not found' });
        return;
      }

      res.json({ message: 'Therapy plan deleted successfully' });
    } catch (error: any) {
      logger.error('Therapy plan delete error:', error);
      next(error);
    }
  }
}

export default new DrugController();
