import { Router } from 'express';
import drugController from '../controllers/drugInformationController';
import { auth } from '../middlewares/auth';

const router = Router();

/**
 * @route GET /api/drugs/search
 * @desc Search for drugs by name
 * @access Public (temporarily for debugging)
 */
router.get('/search', drugController.searchDrugs); // Removed auth middleware temporarily

/**
 * @route GET /api/drugs/monograph/:id
 * @desc Get drug monograph by set ID
 * @access Private
 */
router.get('/monograph/:id', auth, drugController.getMonograph);

/**
 * @route POST /api/drugs/interactions
 * @desc Check drug interactions
 * @access Private
 */
router.post('/interactions', auth, drugController.checkInteractions);

/**
 * @route GET /api/drugs/adverse-effects/:id
 * @desc Get adverse effects for a drug
 * @access Private
 */
router.get('/adverse-effects/:id', auth, drugController.getAdverseEffects);

/**
 * @route GET /api/drugs/formulary/:id
 * @desc Get formulary and therapeutic equivalents
 * @access Private
 */
router.get('/formulary/:id', auth, drugController.getFormulary);

/**
 * @route POST /api/drugs/therapy-plans
 * @desc Create a new therapy plan
 * @access Private
 */
router.post('/therapy-plans', auth, drugController.createTherapyPlan);

/**
 * @route GET /api/drugs/therapy-plans
 * @desc Get all therapy plans for user
 * @access Private
 */
router.get('/therapy-plans', auth, drugController.getTherapyPlans);

/**
 * @route GET /api/drugs/therapy-plans/:id
 * @desc Get therapy plan by ID
 * @access Private
 */
router.get('/therapy-plans/:id', auth, drugController.getTherapyPlanById);

/**
 * @route PUT /api/drugs/therapy-plans/:id
 * @desc Update therapy plan
 * @access Private
 */
router.put('/therapy-plans/:id', auth, drugController.updateTherapyPlan);

/**
 * @route DELETE /api/drugs/therapy-plans/:id
 * @desc Delete therapy plan
 * @access Private
 */
router.delete('/therapy-plans/:id', auth, drugController.deleteTherapyPlan);

export default router;
