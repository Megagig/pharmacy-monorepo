import { Request, Response, NextFunction } from 'express';
import rxnormService from '../modules/drug-info/services/rxnormService';
import dailymedService from '../modules/drug-info/services/dailymedService';
import openfdaService from '../modules/drug-info/services/openfdaService';
import interactionService from '../modules/drug-info/services/interactionService';
import {
  DrugSearchHistory,
  TherapyPlan,
} from '../modules/drug-info/models/drugCacheModel';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class DrugInformationController {
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
      // Log authentication information for debugging
      console.log(
        'User authentication state:',
        req.user ? 'Authenticated' : 'Not authenticated'
      );

      const { name } = req.query;
      console.log('Search query:', name);

      if (!name || typeof name !== 'string') {
        console.log('Invalid search query - name is required');
        res.status(400).json({ error: 'Drug name is required' });
        return;
      }

      console.log(`Calling RxNorm service to search for: ${name}`);
      const results = await rxnormService.searchDrugs(name);
      console.log('RxNorm search results:', results);

      // Save search history
      if (req.user && req.user._id) {
        console.log('Saving search history for user:', req.user._id);
        await DrugSearchHistory.create({
          userId: req.user._id,
          searchTerm: name,
          searchResults: results,
        });
      } else {
        console.log('Not saving search history - user not authenticated');
      }

      console.log('Sending successful response');
      res.json(results);
    } catch (error: any) {
      console.error('Drug search error:', error);
      logger.error('Drug search error:', error);
      next(error);
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
        res
          .status(400)
          .json({ error: 'Either rxcui or rxcuis array is required' });
        return;
      }

      res.json(results);
    } catch (error: any) {
      logger.error('Interaction check error:', error);
      next(error);
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

export default new DrugInformationController();
