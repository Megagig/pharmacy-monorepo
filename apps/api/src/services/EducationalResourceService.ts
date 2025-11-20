import mongoose from 'mongoose';
import EducationalResource, { IEducationalResource } from '../models/EducationalResource';
import Patient, { IPatient } from '../models/Patient';
import Medication, { IMedication } from '../models/Medication';
import logger from '../utils/logger';

export interface ResourceFilters {
  category?: string;
  tags?: string[];
  mediaType?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  localizedFor?: string;
  accessLevel?: 'public' | 'patient_only' | 'premium' | 'staff_only';
  workplaceId?: mongoose.Types.ObjectId;
  patientId?: mongoose.Types.ObjectId;
}

export interface ResourceSearchOptions extends ResourceFilters {
  searchQuery?: string;
  sortBy?: 'relevance' | 'popularity' | 'newest' | 'rating';
  limit?: number;
  skip?: number;
}

export interface ResourceRecommendationOptions {
  patientId: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  limit?: number;
  includeGeneral?: boolean;
}

export class EducationalResourceService {
  /**
   * Get published educational resources with filtering and search
   */
  static async getResources(options: ResourceSearchOptions = {}): Promise<{
    resources: IEducationalResource[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        searchQuery,
        category,
        tags,
        mediaType,
        difficulty,
        language,
        localizedFor,
        accessLevel,
        workplaceId,
        sortBy = 'newest',
        limit = 20,
        skip = 0,
      } = options;

      let query: any = {
        isPublished: true,
        isDeleted: false,
      };

      // Add language filter if specified
      if (language) {
        query.language = language;
      }

      // Add localizedFor filter if specified
      if (localizedFor) {
        query.localizedFor = { $in: [localizedFor, 'general'] };
      }

      // Apply filters
      if (category) {
        query.category = category;
      }

      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      if (mediaType) {
        query.mediaType = mediaType;
      }

      if (difficulty) {
        query.difficulty = difficulty;
      }

      if (accessLevel) {
        query.accessLevel = accessLevel;
      }

      // Handle workspace-specific and global resources
      if (workplaceId) {
        query.$or = [
          { workplaceId },
          { workplaceId: null }, // Include global resources
        ];
      } else {
        query.workplaceId = null; // Only global resources
      }

      // Handle search query
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }

      // Build sort criteria
      let sortCriteria: any = {};
      switch (sortBy) {
        case 'relevance':
          if (searchQuery) {
            sortCriteria = { score: { $meta: 'textScore' }, viewCount: -1 };
          } else {
            sortCriteria = { viewCount: -1, 'ratings.averageRating': -1 };
          }
          break;
        case 'popularity':
          sortCriteria = { viewCount: -1, 'ratings.averageRating': -1 };
          break;
        case 'rating':
          sortCriteria = { 'ratings.averageRating': -1, 'ratings.totalRatings': -1 };
          break;
        case 'newest':
        default:
          sortCriteria = { publishedAt: -1, createdAt: -1 };
          break;
      }

      // Execute query
      const [resources, total] = await Promise.all([
        EducationalResource.find(query)
          .select('title slug description content thumbnail category mediaType difficulty language readingTime duration viewCount downloadCount ratings publishedAt targetAudience tags mediaUrl accessLevel averageRating totalRatings')
          .sort(sortCriteria)
          .skip(skip)
          .limit(limit)
          .lean(),
        EducationalResource.countDocuments(query),
      ]);

      const hasMore = skip + resources.length < total;

      logger.info('Educational resources retrieved', {
        count: resources.length,
        total,
        filters: options,
      });

      return {
        resources: resources as IEducationalResource[],
        total,
        hasMore,
      };
    } catch (error) {
      logger.error('Error retrieving educational resources:', error);
      throw new Error('Failed to retrieve educational resources');
    }
  }

  /**
   * Get a single resource by slug
   */
  static async getResourceBySlug(
    slug: string,
    options: {
      workplaceId?: mongoose.Types.ObjectId;
      userType?: string;
      subscriptionLevel?: string;
      incrementView?: boolean;
    } = {}
  ): Promise<IEducationalResource | null> {
    try {
      const { workplaceId, userType = 'public', subscriptionLevel, incrementView = true } = options;

      let query: any = {
        slug,
        isPublished: true,
        isDeleted: false,
      };

      // Handle workspace context
      if (workplaceId) {
        query.$or = [
          { workplaceId },
          { workplaceId: null },
        ];
      } else {
        query.workplaceId = null;
      }

      const resource = await EducationalResource.findOne(query)
        .populate('relatedResources', 'title slug description thumbnail category mediaType readingTime viewCount ratings')
        .populate('prerequisites', 'title slug description thumbnail category mediaType readingTime')
        .populate('followUpResources', 'title slug description thumbnail category mediaType readingTime');

      if (!resource) {
        return null;
      }

      // Check access permissions
      if (!resource.isAccessibleTo(userType, subscriptionLevel)) {
        logger.warn('Access denied to educational resource', {
          resourceId: resource._id,
          userType,
          accessLevel: resource.accessLevel,
        });
        return null;
      }

      // Increment view count if requested
      if (incrementView) {
        await resource.incrementViewCount();
      }

      logger.info('Educational resource retrieved by slug', {
        resourceId: resource._id,
        slug,
        userType,
      });

      return resource;
    } catch (error) {
      logger.error('Error retrieving educational resource by slug:', error);
      throw new Error('Failed to retrieve educational resource');
    }
  }

  /**
   * Get personalized resource recommendations based on patient conditions and medications
   */
  static async getRecommendationsForPatient(
    options: ResourceRecommendationOptions
  ): Promise<IEducationalResource[]> {
    try {
      const { patientId, workplaceId, limit = 10, includeGeneral = true } = options;

      // Get patient information
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId,
        isDeleted: false,
      }).select('allergies chronicConditions');

      if (!patient) {
        logger.warn('Patient not found for recommendations', { patientId, workplaceId });
        return [];
      }

      // Get patient's current medications
      const medications = await Medication.find({
        patient: patientId,
        status: 'active',
      }).select('drugName genericName');

      // Extract conditions and medication names
      const conditions = patient.chronicConditions?.map(c => c.condition.toLowerCase()) || [];
      const medicationNames = medications.map(m => 
        [m.drugName, m.genericName].filter(Boolean).map(name => name.toLowerCase())
      ).flat();

      // Build recommendation query
      const query: any = {
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
        $or: [
          { workplaceId },
          { workplaceId: null },
        ],
      };

      // Add targeting criteria
      const targetingCriteria: any[] = [];

      if (conditions.length > 0) {
        targetingCriteria.push({
          'targetAudience.conditions': { $in: conditions },
        });
      }

      if (medicationNames.length > 0) {
        targetingCriteria.push({
          'targetAudience.medications': { $in: medicationNames },
        });
      }

      // Include general wellness content if requested
      if (includeGeneral) {
        targetingCriteria.push({
          category: { $in: ['wellness', 'prevention', 'nutrition', 'lifestyle'] },
          'targetAudience.conditions': { $exists: false, $size: 0 },
          'targetAudience.medications': { $exists: false, $size: 0 },
        });
      }

      if (targetingCriteria.length > 0) {
        query.$or = [
          ...query.$or,
          ...targetingCriteria,
        ];
      }

      const recommendations = await EducationalResource.find(query)
        .select('title slug description thumbnail category mediaType difficulty readingTime viewCount ratings targetAudience')
        .sort({ 'ratings.averageRating': -1, viewCount: -1 })
        .limit(limit)
        .lean();

      logger.info('Educational resource recommendations generated', {
        patientId,
        workplaceId,
        conditionsCount: conditions.length,
        medicationsCount: medicationNames.length,
        recommendationsCount: recommendations.length,
      });

      return recommendations as IEducationalResource[];
    } catch (error) {
      logger.error('Error generating educational resource recommendations:', error);
      throw new Error('Failed to generate resource recommendations');
    }
  }

  /**
   * Track resource viewing
   */
  static async trackResourceView(
    resourceId: mongoose.Types.ObjectId,
    options: {
      patientId?: mongoose.Types.ObjectId;
      workplaceId?: mongoose.Types.ObjectId;
      userType?: string;
    } = {}
  ): Promise<void> {
    try {
      const { patientId, workplaceId, userType } = options;

      const resource = await EducationalResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      await resource.incrementViewCount();

      // Log the view for analytics
      logger.info('Educational resource view tracked', {
        resourceId,
        patientId,
        workplaceId,
        userType,
        category: resource.category,
        mediaType: resource.mediaType,
      });
    } catch (error) {
      logger.error('Error tracking resource view:', error);
      throw new Error('Failed to track resource view');
    }
  }

  /**
   * Track resource download
   */
  static async trackResourceDownload(
    resourceId: mongoose.Types.ObjectId,
    options: {
      patientId?: mongoose.Types.ObjectId;
      workplaceId?: mongoose.Types.ObjectId;
      userType?: string;
    } = {}
  ): Promise<void> {
    try {
      const { patientId, workplaceId, userType } = options;

      const resource = await EducationalResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      await resource.incrementDownloadCount();

      // Log the download for analytics
      logger.info('Educational resource download tracked', {
        resourceId,
        patientId,
        workplaceId,
        userType,
        category: resource.category,
        mediaType: resource.mediaType,
      });
    } catch (error) {
      logger.error('Error tracking resource download:', error);
      throw new Error('Failed to track resource download');
    }
  }

  /**
   * Get popular resources
   */
  static async getPopularResources(
    workplaceId?: mongoose.Types.ObjectId,
    limit: number = 10
  ): Promise<IEducationalResource[]> {
    try {
      const query: any = {
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
      };

      if (workplaceId) {
        query.$or = [
          { workplaceId },
          { workplaceId: null },
        ];
      } else {
        query.workplaceId = null;
      }

      const resources = await EducationalResource.find(query)
        .select('title slug description thumbnail category mediaType readingTime viewCount ratings')
        .sort({ viewCount: -1, 'ratings.averageRating': -1 })
        .limit(limit)
        .lean();

      logger.info('Popular educational resources retrieved', {
        workplaceId,
        count: resources.length,
      });

      return resources as IEducationalResource[];
    } catch (error) {
      logger.error('Error retrieving popular resources:', error);
      throw new Error('Failed to retrieve popular resources');
    }
  }

  /**
   * Get resources by category
   */
  static async getResourcesByCategory(
    category: string,
    options: {
      workplaceId?: mongoose.Types.ObjectId;
      language?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<{
    resources: IEducationalResource[];
    total: number;
  }> {
    try {
      const { workplaceId, language = 'en', limit = 20, skip = 0 } = options;

      const query: any = {
        category,
        isPublished: true,
        isDeleted: false,
        language,
        accessLevel: { $in: ['public', 'patient_only'] },
      };

      if (workplaceId) {
        query.$or = [
          { workplaceId },
          { workplaceId: null },
        ];
      } else {
        query.workplaceId = null;
      }

      const [resources, total] = await Promise.all([
        EducationalResource.find(query)
          .select('title slug description thumbnail category mediaType difficulty readingTime viewCount ratings')
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        EducationalResource.countDocuments(query),
      ]);

      logger.info('Educational resources retrieved by category', {
        category,
        workplaceId,
        count: resources.length,
        total,
      });

      return {
        resources: resources as IEducationalResource[],
        total,
      };
    } catch (error) {
      logger.error('Error retrieving resources by category:', error);
      throw new Error('Failed to retrieve resources by category');
    }
  }

  /**
   * Get available categories with resource counts
   */
  static async getAvailableCategories(
    workplaceId?: mongoose.Types.ObjectId
  ): Promise<Array<{ category: string; count: number }>> {
    try {
      const matchQuery: any = {
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
      };

      if (workplaceId) {
        matchQuery.$or = [
          { workplaceId },
          { workplaceId: null },
        ];
      } else {
        matchQuery.workplaceId = null;
      }

      const categories = await EducationalResource.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            _id: 0,
          },
        },
        { $sort: { count: -1 } },
      ]);

      logger.info('Available categories retrieved', {
        workplaceId,
        categoriesCount: categories.length,
      });

      return categories;
    } catch (error) {
      logger.error('Error retrieving available categories:', error);
      throw new Error('Failed to retrieve available categories');
    }
  }

  /**
   * Get available tags with usage counts
   */
  static async getAvailableTags(
    workplaceId?: mongoose.Types.ObjectId,
    limit: number = 50
  ): Promise<Array<{ tag: string; count: number }>> {
    try {
      const matchQuery: any = {
        isPublished: true,
        isDeleted: false,
        accessLevel: { $in: ['public', 'patient_only'] },
        tags: { $exists: true, $ne: [] },
      };

      if (workplaceId) {
        matchQuery.$or = [
          { workplaceId },
          { workplaceId: null },
        ];
      } else {
        matchQuery.workplaceId = null;
      }

      const tags = await EducationalResource.aggregate([
        { $match: matchQuery },
        { $unwind: '$tags' },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            tag: '$_id',
            count: 1,
            _id: 0,
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

      logger.info('Available tags retrieved', {
        workplaceId,
        tagsCount: tags.length,
      });

      return tags;
    } catch (error) {
      logger.error('Error retrieving available tags:', error);
      throw new Error('Failed to retrieve available tags');
    }
  }

  /**
   * Rate a resource
   */
  static async rateResource(
    resourceId: mongoose.Types.ObjectId,
    rating: number,
    options: {
      patientId?: mongoose.Types.ObjectId;
      workplaceId?: mongoose.Types.ObjectId;
    } = {}
  ): Promise<IEducationalResource> {
    try {
      const { patientId, workplaceId } = options;

      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const resource = await EducationalResource.findById(resourceId);
      if (!resource) {
        throw new Error('Resource not found');
      }

      resource.addRating(rating);
      await resource.save();

      logger.info('Educational resource rated', {
        resourceId,
        rating,
        patientId,
        workplaceId,
        newAverageRating: resource.ratings.averageRating,
        totalRatings: resource.ratings.totalRatings,
      });

      return resource;
    } catch (error) {
      logger.error('Error rating educational resource:', error);
      throw new Error('Failed to rate resource');
    }
  }

  /**
   * Get resource analytics for admin
   */
  static async getResourceAnalytics(
    workplaceId?: mongoose.Types.ObjectId,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{
    totalResources: number;
    publishedResources: number;
    totalViews: number;
    totalDownloads: number;
    averageRating: number;
    categoryBreakdown: Array<{ category: string; count: number; views: number }>;
    popularResources: Array<{ title: string; slug: string; views: number; rating: number }>;
  }> {
    try {
      const matchQuery: any = {
        isDeleted: false,
      };

      if (workplaceId) {
        matchQuery.workplaceId = workplaceId;
      }

      if (dateRange) {
        matchQuery.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const [
        totalStats,
        categoryStats,
        popularResources,
      ] = await Promise.all([
        // Total statistics
        EducationalResource.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalResources: { $sum: 1 },
              publishedResources: {
                $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] },
              },
              totalViews: { $sum: '$viewCount' },
              totalDownloads: { $sum: '$downloadCount' },
              averageRating: { $avg: '$ratings.averageRating' },
            },
          },
        ]),

        // Category breakdown
        EducationalResource.aggregate([
          { $match: { ...matchQuery, isPublished: true } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              views: { $sum: '$viewCount' },
            },
          },
          {
            $project: {
              category: '$_id',
              count: 1,
              views: 1,
              _id: 0,
            },
          },
          { $sort: { views: -1 } },
        ]),

        // Popular resources
        EducationalResource.find({ ...matchQuery, isPublished: true })
          .select('title slug viewCount ratings.averageRating')
          .sort({ viewCount: -1 })
          .limit(10)
          .lean(),
      ]);

      const stats = totalStats[0] || {
        totalResources: 0,
        publishedResources: 0,
        totalViews: 0,
        totalDownloads: 0,
        averageRating: 0,
      };

      const analytics = {
        totalResources: stats.totalResources,
        publishedResources: stats.publishedResources,
        totalViews: stats.totalViews,
        totalDownloads: stats.totalDownloads,
        averageRating: Math.round(stats.averageRating * 10) / 10,
        categoryBreakdown: categoryStats,
        popularResources: popularResources.map((resource: any) => ({
          title: resource.title,
          slug: resource.slug,
          views: resource.viewCount,
          rating: resource.ratings.averageRating,
        })),
      };

      logger.info('Educational resource analytics retrieved', {
        workplaceId,
        dateRange,
        analytics,
      });

      return analytics;
    } catch (error) {
      logger.error('Error retrieving resource analytics:', error);
      throw new Error('Failed to retrieve resource analytics');
    }
  }
}

export default EducationalResourceService;