import { Response } from 'express';
import mongoose from 'mongoose';
import { PatientAuthRequest } from '../middlewares/patientAuth';
import EducationalResource from '../models/EducationalResource';
import Patient from '../models/Patient';
import MedicationRecord from '../models/MedicationRecord';
import logger from '../utils/logger';
import { asyncHandler, sendSuccess, sendError } from '../utils/responseHelpers';

/**
 * Get personalized recommendations for a patient
 * GET /api/educational-resources/recommendations/personalized
 */
export const getPersonalizedRecommendations = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const patientUserId = req.patientUser?._id;
    const workplaceId = req.patientUser?.workplaceId;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!patientUserId || !workplaceId) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    try {
      // Get patient data
      const patient = await Patient.findOne({ patientUserId });
      
      if (!patient) {
        // Return general recommendations if no patient profile
        const resources = await EducationalResource.find({
          workplaceId: { $in: [new mongoose.Types.ObjectId(workplaceId), null] },
          isPublished: true,
          isDeleted: false,
          autoRecommend: true,
          accessLevel: { $in: ['public', 'patient_only'] },
        })
          .select('title description slug thumbnail category mediaType readingTime viewCount ratings')
          .sort({ viewCount: -1, 'ratings.averageRating': -1 })
          .limit(limit)
          .lean();

        const recommendations = resources.map((r: any) => ({
          id: r._id.toString(),
          title: r.title,
          description: r.description,
          slug: r.slug,
          thumbnail: r.thumbnail,
          category: r.category,
          mediaType: r.mediaType,
          readingTime: r.readingTime,
          viewCount: r.viewCount,
          rating: r.ratings?.averageRating || 0,
          matchReason: 'Popular resource',
        }));

        return sendSuccess(
          res,
          { recommendations },
          'General recommendations retrieved successfully'
        );
      }

      // Get patient's conditions from chronicConditions
      const conditions = patient.chronicConditions?.map(c => c.condition.toLowerCase()) || [];

      // Get patient's medications
      const medications = await MedicationRecord.find({
        patientId: patient._id,
        status: 'active',
      }).select('medicationName');
      
      const medicationNames = medications.map(m => m.medicationName.toLowerCase());

      // Calculate age group
      const ageGroup = calculateAgeGroup(patient.dob);

      // Build user profile
      const userProfile = {
        conditions,
        medications: medicationNames,
        ageGroup,
      };

      // Find resources with auto-recommend enabled or matching criteria
      const resources = await EducationalResource.find({
        workplaceId: { $in: [new mongoose.Types.ObjectId(workplaceId), null] },
        isPublished: true,
        isDeleted: false,
        $or: [
          { autoRecommend: true },
          { 'recommendationCriteria.conditions': { $in: conditions } },
          { 'recommendationCriteria.medications': { $in: medicationNames } },
          { 'recommendationCriteria.ageGroups': ageGroup },
        ],
      })
        .select('title description slug thumbnail category mediaType readingTime viewCount ratings targetAudience recommendationCriteria autoRecommend')
        .lean();

      // Calculate recommendation score for each resource
      const scoredResources = resources.map((resource: any) => {
        const score = calculateRecommendationScore(resource, userProfile);
        return {
          ...resource,
          recommendationScore: score,
          matchReason: getMatchReason(resource, userProfile),
        };
      });

      // Sort by score and limit
      const topRecommendations = scoredResources
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit)
        .map(r => ({
          id: r._id.toString(),
          title: r.title,
          description: r.description,
          slug: r.slug,
          thumbnail: r.thumbnail,
          category: r.category,
          mediaType: r.mediaType,
          readingTime: r.readingTime,
          viewCount: r.viewCount,
          rating: r.ratings?.averageRating || 0,
          recommendationScore: r.recommendationScore,
          matchReason: r.matchReason,
        }));

      sendSuccess(
        res,
        { recommendations: topRecommendations, userProfile },
        'Personalized recommendations retrieved successfully'
      );
    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve recommendations', 500);
    }
  }
);

/**
 * Get general recommendations (for users without profile)
 * GET /api/educational-resources/recommendations/general
 */
export const getGeneralRecommendations = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const workplaceId = req.patientUser?.workplaceId;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!workplaceId) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    try {
      const resources = await EducationalResource.find({
        workplaceId: { $in: [new mongoose.Types.ObjectId(workplaceId), null] },
        isPublished: true,
        isDeleted: false,
        autoRecommend: true,
        accessLevel: { $in: ['public', 'patient_only'] },
      })
        .select('title description slug thumbnail category mediaType readingTime viewCount ratings')
        .sort({ viewCount: -1, 'ratings.averageRating': -1 })
        .limit(limit)
        .lean();

      const recommendations = resources.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        description: r.description,
        slug: r.slug,
        thumbnail: r.thumbnail,
        category: r.category,
        mediaType: r.mediaType,
        readingTime: r.readingTime,
        viewCount: r.viewCount,
        rating: r.ratings?.averageRating || 0,
        matchReason: 'Popular resource',
      }));

      sendSuccess(
        res,
        { recommendations },
        'General recommendations retrieved successfully'
      );
    } catch (error) {
      logger.error('Error getting general recommendations:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve recommendations', 500);
    }
  }
);

/**
 * Get condition-specific recommendations
 * GET /api/educational-resources/recommendations/condition/:condition
 */
export const getConditionRecommendations = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const workplaceId = req.patientUser?.workplaceId;
    const { condition } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!workplaceId) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    try {
      const resources = await EducationalResource.find({
        workplaceId: { $in: [new mongoose.Types.ObjectId(workplaceId), null] },
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
        $or: [
          { 'recommendationCriteria.conditions': condition.toLowerCase() },
          { 'targetAudience.conditions': condition.toLowerCase() },
          { tags: condition.toLowerCase() },
        ],
      })
        .select('title description slug thumbnail category mediaType readingTime viewCount ratings')
        .sort({ 'ratings.averageRating': -1, viewCount: -1 })
        .limit(limit)
        .lean();

      const recommendations = resources.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        description: r.description,
        slug: r.slug,
        thumbnail: r.thumbnail,
        category: r.category,
        mediaType: r.mediaType,
        readingTime: r.readingTime,
        viewCount: r.viewCount,
        rating: r.ratings?.averageRating || 0,
        matchReason: `Related to ${condition}`,
      }));

      sendSuccess(
        res,
        { recommendations, condition },
        'Condition-specific recommendations retrieved successfully'
      );
    } catch (error) {
      logger.error('Error getting condition recommendations:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve recommendations', 500);
    }
  }
);

/**
 * Get medication-specific recommendations
 * GET /api/educational-resources/recommendations/medication/:medication
 */
export const getMedicationRecommendations = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const workplaceId = req.patientUser?.workplaceId;
    const { medication } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!workplaceId) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    try {
      const resources = await EducationalResource.find({
        workplaceId: { $in: [new mongoose.Types.ObjectId(workplaceId), null] },
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
        $or: [
          { 'recommendationCriteria.medications': medication.toLowerCase() },
          { 'targetAudience.medications': medication.toLowerCase() },
          { tags: medication.toLowerCase() },
        ],
      })
        .select('title description slug thumbnail category mediaType readingTime viewCount ratings')
        .sort({ 'ratings.averageRating': -1, viewCount: -1 })
        .limit(limit)
        .lean();

      const recommendations = resources.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        description: r.description,
        slug: r.slug,
        thumbnail: r.thumbnail,
        category: r.category,
        mediaType: r.mediaType,
        readingTime: r.readingTime,
        viewCount: r.viewCount,
        rating: r.ratings?.averageRating || 0,
        matchReason: `Related to ${medication}`,
      }));

      sendSuccess(
        res,
        { recommendations, medication },
        'Medication-specific recommendations retrieved successfully'
      );
    } catch (error) {
      logger.error('Error getting medication recommendations:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve recommendations', 500);
    }
  }
);

// Helper Functions

function calculateAgeGroup(dateOfBirth?: Date): string {
  if (!dateOfBirth) return 'adult';

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ? age - 1
    : age;

  if (actualAge < 13) return 'child';
  if (actualAge < 18) return 'teen';
  if (actualAge < 65) return 'adult';
  return 'senior';
}

function calculateRecommendationScore(
  resource: any,
  userProfile: {
    conditions?: string[];
    medications?: string[];
    ageGroup?: string;
  }
): number {
  let score = 0;

  // Base score from resource quality
  score += (resource.ratings?.averageRating || 0) * 10; // 0-50 points
  score += Math.min((resource.viewCount || 0) / 100, 20); // 0-20 points based on popularity

  // Boost for user-specific relevance
  if (resource.recommendationCriteria) {
    // Condition match
    if (userProfile.conditions && resource.recommendationCriteria.conditions) {
      const matchingConditions = userProfile.conditions.filter((c: string) =>
        resource.recommendationCriteria.conditions.includes(c)
      );
      score += matchingConditions.length * 15; // 15 points per matching condition
    }

    // Medication match
    if (userProfile.medications && resource.recommendationCriteria.medications) {
      const matchingMeds = userProfile.medications.filter((m: string) =>
        resource.recommendationCriteria.medications.includes(m)
      );
      score += matchingMeds.length * 10; // 10 points per matching medication
    }

    // Age group match
    if (
      userProfile.ageGroup &&
      resource.recommendationCriteria.ageGroups?.includes(userProfile.ageGroup)
    ) {
      score += 10; // 10 points for age group match
    }
  }

  // Additional boost for auto-recommended resources
  if (resource.autoRecommend) {
    score += 5;
  }

  return Math.min(Math.round(score), 100);
}

function getMatchReason(
  resource: any,
  userProfile: {
    conditions?: string[];
    medications?: string[];
    ageGroup?: string;
  }
): string {
  const reasons: string[] = [];

  if (resource.recommendationCriteria) {
    // Check condition matches
    if (userProfile.conditions && resource.recommendationCriteria.conditions) {
      const matchingConditions = userProfile.conditions.filter((c: string) =>
        resource.recommendationCriteria.conditions.includes(c)
      );
      if (matchingConditions.length > 0) {
        reasons.push(`Related to your ${matchingConditions.join(', ')}`);
      }
    }

    // Check medication matches
    if (userProfile.medications && resource.recommendationCriteria.medications) {
      const matchingMeds = userProfile.medications.filter((m: string) =>
        resource.recommendationCriteria.medications.includes(m)
      );
      if (matchingMeds.length > 0) {
        reasons.push(`Information about your medication`);
      }
    }

    // Check age group match
    if (
      userProfile.ageGroup &&
      resource.recommendationCriteria.ageGroups?.includes(userProfile.ageGroup)
    ) {
      reasons.push('Relevant for your age group');
    }
  }

  if (resource.autoRecommend && reasons.length === 0) {
    reasons.push('Recommended by your pharmacy');
  }

  if (reasons.length === 0) {
    reasons.push('Popular resource');
  }

  return reasons.join(' • ');
}

export default {
  getPersonalizedRecommendations,
  getGeneralRecommendations,
  getConditionRecommendations,
  getMedicationRecommendations,
};
