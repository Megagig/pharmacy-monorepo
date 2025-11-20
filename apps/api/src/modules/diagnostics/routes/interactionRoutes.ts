import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth, requireFeature } from '../../../middlewares/auth';
import { auditLogger } from '../../../middlewares/auditMiddleware';
import drugInteractionController from '../controllers/drugInteractionController';
import {
    validateInteractionCheck,
    formatValidationErrors
} from '../utils/validators';

const router = Router();

// Rate limiting for interaction endpoints
const interactionRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 200 : 100, // 100 requests per 15 minutes
    message: {
        success: false,
        message: 'Too many interaction check requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware
const validateRequest = (schema: any) => (req: any, res: any, next: any) => {
    const { error } = schema(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: formatValidationErrors(error)
        });
    }
    next();
};

/**
 * @route POST /api/interactions/check
 * @desc Check drug interactions and contraindications
 * @access Private (requires drug_information feature)
 */
router.post(
    '/check',
    interactionRateLimit,
    auth,
    requireFeature('drug_information'),
    auditLogger('CHECK_DRUG_INTERACTIONS', 'clinical_documentation'),
    validateRequest(validateInteractionCheck),
    drugInteractionController.checkDrugInteractions
);

/**
 * @route GET /api/interactions/drug-info
 * @desc Get drug information by name
 * @access Private (requires drug_information feature)
 */
router.get(
    '/drug-info',
    interactionRateLimit,
    auth,
    requireFeature('drug_information'),
    auditLogger('GET_DRUG_INFO', 'data_access'),
    drugInteractionController.getDrugInformation
);

/**
 * @route GET /api/interactions/search
 * @desc Search drugs by name
 * @access Private (requires drug_information feature)
 */
router.get(
    '/search',
    interactionRateLimit,
    auth,
    requireFeature('drug_information'),
    auditLogger('SEARCH_DRUGS', 'data_access'),
    drugInteractionController.searchDrugs
);

/**
 * @route POST /api/interactions/check-allergies
 * @desc Check allergy contraindications
 * @access Private (requires drug_information feature)
 */
router.post(
    '/check-allergies',
    interactionRateLimit,
    auth,
    requireFeature('drug_information'),
    auditLogger('CHECK_ALLERGY_CONTRAINDICATIONS', 'clinical_documentation'),
    drugInteractionController.checkAllergyInteractions
);

// /**
//  * @route GET /api/interactions/details
//  * @desc Get detailed interaction information between two drugs
//  * @access Private (requires drug_information feature)
//  */
// router.get(
//     '/details',
//     interactionRateLimit,
//     auth,
//     requireFeature('drug_information'),
//     auditLogger({
//         action: 'GET_INTERACTION_DETAILS',
//         resourceType: 'InteractionDetails',
//         complianceCategory: 'data_access',
//         riskLevel: 'low'
//     }),
//     drugInteractionController.getInteractionDetails
// );

// /**
//  * @route GET /api/interactions/class-interactions
//  * @desc Get drug class interactions
//  * @access Private (requires drug_information feature)
//  */
// router.get(
//     '/class-interactions',
//     interactionRateLimit,
//     auth,
//     requireFeature('drug_information'),
//     auditLogger({
//         action: 'GET_CLASS_INTERACTIONS',
//         resourceType: 'ClassInteractions',
//         complianceCategory: 'data_access',
//         riskLevel: 'low'
//     }),
//     drugInteractionController.getClassInteractions
// );

// /**
//  * @route GET /api/interactions/food-interactions
//  * @desc Get food-drug interactions
//  * @access Private (requires drug_information feature)
//  */
// router.get(
//     '/food-interactions',
//     interactionRateLimit,
//     auth,
//     requireFeature('drug_information'),
//     auditLogger({
//         action: 'GET_FOOD_INTERACTIONS',
//         resourceType: 'FoodInteractions',
//         complianceCategory: 'data_access',
//         riskLevel: 'low'
//     }),
//     drugInteractionController.getFoodInteractions
// );

// /**
//  * @route GET /api/interactions/pregnancy-info
//  * @desc Get pregnancy and lactation information for drug
//  * @access Private (requires drug_information feature)
//  */
// router.get(
//     '/pregnancy-info',
//     interactionRateLimit,
//     auth,
//     requireFeature('drug_information'),
//     auditLogger({
//         action: 'GET_PREGNANCY_INFO',
//         resourceType: 'PregnancyInfo',
//         complianceCategory: 'data_access',
//         riskLevel: 'low'
//     }),
//     drugInteractionController.getPregnancyInfo
// );

export default router;