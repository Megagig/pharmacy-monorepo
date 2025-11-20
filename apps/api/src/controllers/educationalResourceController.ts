import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import EducationalResource from '../models/EducationalResource';
import EducationalResourceService, { ResourceSearchOptions } from '../services/EducationalResourceService';
import ResourceBookmark from '../models/ResourceBookmark';
import logger from '../utils/logger';
import { PatientAuthRequest } from '../middlewares/patientAuth';
import { WorkspaceAuthRequest } from '../middlewares/workspaceAuth';
import { AuthRequest } from '../middlewares/auth';
import { asyncHandler, sendSuccess, sendError, getRequestContext } from '../utils/responseHelpers';

// Extend Request types for different authentication contexts
interface PublicResourceRequest extends Request {
  query: {
    category?: string;
    tags?: string;
    mediaType?: string;
    difficulty?: string;
    language?: string;
    localizedFor?: string;
    search?: string;
    sortBy?: string;
    limit?: string;
    skip?: string;
    page?: string;
  };
}

interface PatientResourceRequest extends Request {
  params: {
    slug?: string;
    resourceId?: string;
  };
  query: {
    category?: string;
    tags?: string;
    mediaType?: string;
    difficulty?: string;
    search?: string;
    sortBy?: string;
    limit?: string;
    skip?: string;
    page?: string;
    includeGeneral?: string;
  };
  body: {
    rating?: number;
    notes?: string;
  };
  patientUser?: {
    _id: string;
    workplaceId: string;
    patientId?: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
}

interface AdminResourceRequest extends Request {
  params: {
    resourceId?: string;
  };
  body: {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
    tags?: string[];
    mediaType?: string;
    mediaUrl?: string;
    thumbnail?: string;
    duration?: number;
    fileSize?: number;
    targetAudience?: {
      conditions?: string[];
      medications?: string[];
      ageGroups?: string[];
      demographics?: string[];
    };
    difficulty?: string;
    accessLevel?: string;
    requiredSubscription?: string;
    sources?: Array<{
      title: string;
      url?: string;
      author?: string;
      publishedDate?: Date;
      type: string;
    }>;
    isPublished?: boolean;
    workplaceId?: string | mongoose.Types.ObjectId | null;
    isGlobal?: boolean;
    displayLocations?: string[];
    isPinned?: boolean;
    displayOrder?: number;
    isScheduled?: boolean;
    scheduledStartDate?: string;
    scheduledEndDate?: string;
    autoRecommend?: boolean;
    recommendationCriteria?: {
      conditions?: string[];
      medications?: string[];
      ageGroups?: string[];
    };
    language?: string;
  };
  query: {
    category?: string;
    status?: string;
    limit?: string;
    skip?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
    workplaceId?: string;
    mediaType?: string;
    sortBy?: string;
  };
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
  };
}

export class EducationalResourceController {
  /**
   * Get published educational resources (Public endpoint)
   */
  static async getPublicResources(req: PublicResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        category,
        tags,
        mediaType,
        difficulty,
        language = 'en',
        localizedFor = 'general',
        search,
        sortBy = 'newest',
        limit = '20',
        skip = '0',
        page,
      } = req.query;

      // Calculate skip from page if provided
      const limitNum = parseInt(limit, 10);
      let skipNum = parseInt(skip, 10);
      if (page) {
        const pageNum = parseInt(page, 10);
        skipNum = (pageNum - 1) * limitNum;
      }

      const options: ResourceSearchOptions = {
        category,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        mediaType,
        difficulty: difficulty as any,
        language,
        localizedFor,
        searchQuery: search,
        sortBy: sortBy as any,
        accessLevel: 'public', // Only public resources for unauthenticated users
        limit: limitNum,
        skip: skipNum,
      };

      const result = await EducationalResourceService.getResources(options);

      res.json({
        success: true,
        data: {
          resources: result.resources,
          pagination: {
            total: result.total,
            limit: limitNum,
            skip: skipNum,
            page: page ? parseInt(page, 10) : Math.floor(skipNum / limitNum) + 1,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving public educational resources:', error);
      next(error);
    }
  }

  /**
   * Get educational resources for authenticated patients
   */
  static async getPatientResources(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        category,
        tags,
        mediaType,
        difficulty,
        search,
        sortBy = 'newest',
        limit = '20',
        skip = '0',
        page,
      } = req.query;

      const workplaceId = req.patientUser?.workplaceId;
      const patientId = req.patientUser?.patientId;

      // Calculate skip from page if provided
      const limitNum = parseInt(limit, 10);
      let skipNum = parseInt(skip, 10);
      if (page) {
        const pageNum = parseInt(page, 10);
        skipNum = (pageNum - 1) * limitNum;
      }

      const options: ResourceSearchOptions = {
        category,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        mediaType,
        difficulty: difficulty as any,
        searchQuery: search,
        sortBy: sortBy as any,
        accessLevel: undefined, // Allow public and patient_only resources
        workplaceId: workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        patientId: patientId ? new mongoose.Types.ObjectId(patientId) : undefined,
        limit: limitNum,
        skip: skipNum,
      };

      const result = await EducationalResourceService.getResources(options);

      res.json({
        success: true,
        data: {
          resources: result.resources,
          pagination: {
            total: result.total,
            limit: limitNum,
            skip: skipNum,
            page: page ? parseInt(page, 10) : Math.floor(skipNum / limitNum) + 1,
            hasMore: result.hasMore,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving patient educational resources:', error);
      next(error);
    }
  }

  /**
   * Get a single resource by slug (Public endpoint)
   */
  static async getPublicResourceBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      const resource = await EducationalResourceService.getResourceBySlug(slug, {
        userType: 'public',
        incrementView: true,
      });

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Educational resource not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { resource },
      });
    } catch (error) {
      logger.error('Error retrieving public educational resource by slug:', error);
      next(error);
    }
  }

  /**
   * Get a single resource by slug for authenticated patients
   */
  static async getPatientResourceBySlug(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const workplaceId = req.patientUser?.workplaceId;

      const resource = await EducationalResourceService.getResourceBySlug(slug, {
        workplaceId: workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        userType: 'patient',
        incrementView: true,
      });

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Educational resource not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { resource },
      });
    } catch (error) {
      logger.error('Error retrieving patient educational resource by slug:', error);
      next(error);
    }
  }

  /**
   * Get personalized recommendations for patient
   */
  static async getPatientRecommendations(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = req.patientUser?.workplaceId;
      const patientId = req.patientUser?.patientId;
      const { limit = '10', includeGeneral = 'true' } = req.query;

      if (!patientId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'PATIENT_ID_REQUIRED',
            message: 'Patient ID is required for recommendations',
          },
        });
        return;
      }

      const recommendations = await EducationalResourceService.getRecommendationsForPatient({
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId!),
        limit: parseInt(limit, 10),
        includeGeneral: includeGeneral === 'true',
      });

      res.json({
        success: true,
        data: { recommendations },
      });
    } catch (error) {
      logger.error('Error retrieving patient recommendations:', error);
      next(error);
    }
  }

  /**
   * Get popular resources
   */
  static async getPopularResources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '10' } = req.query;
      const workplaceId = (req as any).patientUser?.workplaceId; // Optional workplace context

      const resources = await EducationalResourceService.getPopularResources(
        workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: { resources },
      });
    } catch (error) {
      logger.error('Error retrieving popular resources:', error);
      next(error);
    }
  }

  /**
   * Get resources by category
   */
  static async getResourcesByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;
      const { language = 'en', limit = '20', skip = '0', page } = req.query;
      const workplaceId = (req as any).patientUser?.workplaceId; // Optional workplace context

      // Calculate skip from page if provided
      const limitNum = parseInt(limit as string, 10);
      let skipNum = parseInt(skip as string, 10);
      if (page) {
        const pageNum = parseInt(page as string, 10);
        skipNum = (pageNum - 1) * limitNum;
      }

      const result = await EducationalResourceService.getResourcesByCategory(category, {
        workplaceId: workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        language: language as string,
        limit: limitNum,
        skip: skipNum,
      });

      res.json({
        success: true,
        data: {
          resources: result.resources,
          pagination: {
            total: result.total,
            limit: limitNum,
            skip: skipNum,
            page: page ? parseInt(page as string, 10) : Math.floor(skipNum / limitNum) + 1,
            hasMore: skipNum + result.resources.length < result.total,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving resources by category:', error);
      next(error);
    }
  }

  /**
   * Get available categories
   */
  static async getAvailableCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = (req as any).patientUser?.workplaceId; // Optional workplace context

      const categories = await EducationalResourceService.getAvailableCategories(workplaceId);

      res.json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      logger.error('Error retrieving available categories:', error);
      next(error);
    }
  }

  /**
   * Get available tags
   */
  static async getAvailableTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = '50' } = req.query;
      const workplaceId = (req as any).patientUser?.workplaceId; // Optional workplace context

      const tags = await EducationalResourceService.getAvailableTags(
        workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: { tags },
      });
    } catch (error) {
      logger.error('Error retrieving available tags:', error);
      next(error);
    }
  }

  /**
   * Rate a resource (Patient only)
   */
  static async rateResource(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const { rating } = req.body;
      const workplaceId = req.patientUser?.workplaceId;
      const patientId = req.patientUser?.patientId;

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
        return;
      }

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RATING',
            message: 'Rating must be between 1 and 5',
          },
        });
        return;
      }

      const updatedResource = await EducationalResourceService.rateResource(
        new mongoose.Types.ObjectId(resourceId),
        rating,
        { patientId: patientId ? new mongoose.Types.ObjectId(patientId) : undefined, workplaceId: workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined }
      );

      res.json({
        success: true,
        data: {
          resource: {
            id: updatedResource._id,
            title: updatedResource.title,
            ratings: updatedResource.ratings,
          },
        },
        message: 'Resource rated successfully',
      });
    } catch (error) {
      logger.error('Error rating educational resource:', error);
      next(error);
    }
  }

  /**
   * Track resource view (Patient only)
   */
  static async trackResourceView(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const workplaceId = req.patientUser?.workplaceId;
      const patientId = req.patientUser?.patientId;

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
        return;
      }

      await EducationalResourceService.trackResourceView(
        new mongoose.Types.ObjectId(resourceId),
        { patientId: new mongoose.Types.ObjectId(patientId), workplaceId: new mongoose.Types.ObjectId(workplaceId), userType: 'patient' }
      );

      res.json({
        success: true,
        message: 'Resource view tracked successfully',
      });
    } catch (error) {
      logger.error('Error tracking resource view:', error);
      next(error);
    }
  }

  /**
   * Track resource download (Patient only)
   */
  static async trackResourceDownload(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const workplaceId = req.patientUser?.workplaceId;
      const patientId = req.patientUser?.patientId;

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
        return;
      }

      await EducationalResourceService.trackResourceDownload(
        new mongoose.Types.ObjectId(resourceId),
        { patientId: new mongoose.Types.ObjectId(patientId), workplaceId: new mongoose.Types.ObjectId(workplaceId), userType: 'patient' }
      );

      res.json({
        success: true,
        message: 'Resource download tracked successfully',
      });
    } catch (error) {
      logger.error('Error tracking resource download:', error);
      next(error);
    }
  }

  // Admin endpoints for resource management

  /**
   * Get all resources for admin (Workspace Admin only)
   */
  static async getAdminResources(req: AdminResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, status, limit = '20', skip = '0', page, workplaceId: workplaceIdParam, mediaType } = req.query;
      const workplaceId = req.user?.workplaceId;

      // Calculate skip from page if provided
      const limitNum = parseInt(limit, 10);
      let skipNum = parseInt(skip, 10);
      if (page) {
        const pageNum = parseInt(page, 10);
        skipNum = (pageNum - 1) * limitNum;
      }

      let query: any = {
        isDeleted: false,
      };

      // Handle workplaceId filtering
      if (workplaceIdParam === 'null') {
        // Filter for global resources (workplaceId is null)
        query.workplaceId = null;
      } else if (workplaceIdParam) {
        // Filter for specific workplace
        query.workplaceId = new mongoose.Types.ObjectId(workplaceIdParam as string);
      } else if (workplaceId) {
        // Default to user's workplace
        query.workplaceId = new mongoose.Types.ObjectId(workplaceId);
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      if (mediaType && mediaType !== 'all') {
        query.mediaType = mediaType;
      }

      if (status === 'published') {
        query.isPublished = true;
      } else if (status === 'draft') {
        query.isPublished = false;
      }

      const [resources, total] = await Promise.all([
        EducationalResource.find(query)
          .select('title slug description content category mediaType difficulty isPublished publishedAt viewCount downloadCount ratings createdAt updatedAt workplaceId accessLevel tags thumbnail mediaUrl duration')
          .sort({ createdAt: -1 })
          .skip(skipNum)
          .limit(limitNum)
          .lean(),
        EducationalResource.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: resources,
        pagination: {
          total,
          limit: limitNum,
          skip: skipNum,
          page: page ? parseInt(page, 10) : Math.floor(skipNum / limitNum) + 1,
          hasMore: skipNum + resources.length < total,
        },
      });
    } catch (error) {
      logger.error('Error retrieving admin educational resources:', error);
      next(error);
    }
  }

  /**
   * Create new educational resource (Workspace Admin only)
   */
  static async createResource(req: AdminResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = req.user?.workplaceId;
      const createdBy = req.user?._id;

      const resourceData: any = {
        ...req.body,
        createdBy,
      };

      // Handle workplaceId - if the resource has workplaceId in body and it's explicitly null or the resource is marked as global, set it to null
      if (req.body.workplaceId === null || (req.body as any).isGlobal === true) {
        resourceData.workplaceId = null;
      } else if (req.body.workplaceId) {
        resourceData.workplaceId = new mongoose.Types.ObjectId(req.body.workplaceId as any);
      } else {
        resourceData.workplaceId = workplaceId ? new mongoose.Types.ObjectId(workplaceId) : null;
      }

      // Generate unique slug
      if (resourceData.title) {
        const baseSlug = resourceData.title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        resourceData.slug = await EducationalResource.ensureUniqueSlug(baseSlug);
      }

      const resource = new EducationalResource(resourceData);
      await resource.save();

      logger.info('Educational resource created', {
        resourceId: resource._id,
        title: resource.title,
        workplaceId: resource.workplaceId?.toString() || 'global',
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: { resource },
        message: 'Educational resource created successfully',
      });
    } catch (error) {
      logger.error('Error creating educational resource:', error);
      next(error);
    }
  }

  /**
   * Update educational resource (Workspace Admin only)
   */
  static async updateResource(req: AdminResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const workplaceId = req.user?.workplaceId;
      const updatedBy = req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
        return;
      }

      // Find resource - allow updating both workspace and global resources
      const resource = await EducationalResource.findOne({
        _id: resourceId,
        isDeleted: false,
      });

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Educational resource not found',
          },
        });
        return;
      }

      // Check if user has permission to edit this resource
      // Only allow editing workspace resources or if user is admin
      if (resource.workplaceId && workplaceId && resource.workplaceId.toString() !== workplaceId.toString()) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to edit this resource',
          },
        });
        return;
      }

      // Update fields
      const updateData = { ...req.body, updatedBy };
      
      // Handle workplaceId update if isGlobal flag is provided
      if ((req.body as any).isGlobal === true) {
        updateData.workplaceId = null;
      } else if ((req.body as any).isGlobal === false && workplaceId) {
        updateData.workplaceId = new mongoose.Types.ObjectId(workplaceId);
      }
      
      Object.assign(resource, updateData);

      // Generate new slug if title changed
      if (req.body.title && req.body.title !== resource.title) {
        const baseSlug = req.body.title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        resource.slug = await EducationalResource.ensureUniqueSlug(baseSlug, resource._id);
      }

      await resource.save();

      logger.info('Educational resource updated', {
        resourceId: resource._id,
        title: resource.title,
        workplaceId: resource.workplaceId?.toString() || 'global',
        updatedBy,
      });

      res.json({
        success: true,
        data: { resource },
        message: 'Educational resource updated successfully',
      });
    } catch (error) {
      logger.error('Error updating educational resource:', error);
      next(error);
    }
  }

  /**
   * Delete educational resource (Workspace Admin only)
   */
  static async deleteResource(req: AdminResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const workplaceId = req.user?.workplaceId;
      const updatedBy = req.user?._id;

      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RESOURCE_ID',
            message: 'Invalid resource ID format',
          },
        });
        return;
      }

      const resource = await EducationalResource.findOne({
        _id: resourceId,
        workplaceId: workplaceId ? new mongoose.Types.ObjectId(workplaceId) : undefined,
        isDeleted: false,
      });

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Educational resource not found',
          },
        });
        return;
      }

      // Soft delete
      resource.isDeleted = true;
      resource.updatedBy = updatedBy ? new mongoose.Types.ObjectId(updatedBy) : undefined;
      await resource.save();

      logger.info('Educational resource deleted', {
        resourceId: resource._id,
        title: resource.title,
        workplaceId: workplaceId ? workplaceId.toString() : undefined,
        deletedBy: updatedBy,
      });

      res.json({
        success: true,
        message: 'Educational resource deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting educational resource:', error);
      next(error);
    }
  }

  /**
   * Get resource analytics (Workspace Admin only)
   */
  static async getResourceAnalytics(req: AdminResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = req.user?.workplaceId;
      const { startDate, endDate } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string),
        };
      }

      const analytics = await EducationalResourceService.getResourceAnalytics(new mongoose.Types.ObjectId(workplaceId), dateRange);

      res.json({
        success: true,
        data: { analytics },
      });
    } catch (error) {
      logger.error('Error retrieving resource analytics:', error);
      next(error);
    }
  }

  /**
   * Add bookmark for patient
   */
  static async addBookmark(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const { notes } = req.body;
      const patientUserId = req.patientUser?._id;
      const workplaceId = req.patientUser?.workplaceId;

      if (!patientUserId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Patient authentication required',
          },
        });
        return;
      }

      // Check if resource exists
      const resource = await EducationalResource.findById(resourceId);
      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Educational resource not found',
          },
        });
        return;
      }

      // Check if bookmark already exists
      const existingBookmark = await ResourceBookmark.findOne({
        patientUserId,
        resourceId,
      });

      if (existingBookmark) {
        res.status(409).json({
          success: false,
          error: {
            code: 'BOOKMARK_EXISTS',
            message: 'This resource is already bookmarked',
          },
        });
        return;
      }

      // Create bookmark
      const bookmark = await ResourceBookmark.create({
        patientUserId,
        resourceId,
        workplaceId,
        notes,
      });

      logger.info('Resource bookmarked', {
        patientUserId: patientUserId.toString(),
        resourceId,
        workplaceId: workplaceId?.toString(),
      });

      res.status(201).json({
        success: true,
        data: { bookmark },
        message: 'Resource bookmarked successfully',
      });
    } catch (error) {
      logger.error('Error adding bookmark:', error);
      next(error);
    }
  }

  /**
   * Remove bookmark for patient
   */
  static async removeBookmark(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const patientUserId = req.patientUser?._id;

      if (!patientUserId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Patient authentication required',
          },
        });
        return;
      }

      const bookmark = await ResourceBookmark.findOneAndDelete({
        patientUserId,
        resourceId,
      });

      if (!bookmark) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BOOKMARK_NOT_FOUND',
            message: 'Bookmark not found',
          },
        });
        return;
      }

      logger.info('Bookmark removed', {
        patientUserId: patientUserId.toString(),
        resourceId,
      });

      res.json({
        success: true,
        message: 'Bookmark removed successfully',
      });
    } catch (error) {
      logger.error('Error removing bookmark:', error);
      next(error);
    }
  }

  /**
   * Get patient's bookmarks
   */
  static async getBookmarks(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientUserId = req.patientUser?._id;
      const { limit = '50', skip = '0' } = req.query;

      if (!patientUserId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Patient authentication required',
          },
        });
        return;
      }

      const limitNum = parseInt(limit, 10);
      const skipNum = parseInt(skip, 10);

      const bookmarks = await ResourceBookmark.find({ patientUserId })
        .populate('resourceId')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skipNum);

      const total = await ResourceBookmark.countDocuments({ patientUserId });

      res.json({
        success: true,
        data: {
          bookmarks,
          pagination: {
            total,
            limit: limitNum,
            skip: skipNum,
            hasMore: skipNum + bookmarks.length < total,
          },
        },
      });
    } catch (error) {
      logger.error('Error retrieving bookmarks:', error);
      next(error);
    }
  }

  /**
   * Check if resource is bookmarked
   */
  static async checkBookmark(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const patientUserId = req.patientUser?._id;

      if (!patientUserId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Patient authentication required',
          },
        });
        return;
      }

      const bookmark = await ResourceBookmark.findOne({
        patientUserId,
        resourceId,
      });

      res.json({
        success: true,
        data: {
          isBookmarked: !!bookmark,
          bookmark: bookmark || null,
        },
      });
    } catch (error) {
      logger.error('Error checking bookmark:', error);
      next(error);
    }
  }

  /**
   * Update bookmark notes
   */
  static async updateBookmarkNotes(req: PatientResourceRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const { notes } = req.body;
      const patientUserId = req.patientUser?._id;

      if (!patientUserId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Patient authentication required',
          },
        });
        return;
      }

      const bookmark = await ResourceBookmark.findOneAndUpdate(
        { patientUserId, resourceId },
        { notes },
        { new: true }
      );

      if (!bookmark) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BOOKMARK_NOT_FOUND',
            message: 'Bookmark not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { bookmark },
        message: 'Bookmark notes updated successfully',
      });
    } catch (error) {
      logger.error('Error updating bookmark notes:', error);
      next(error);
    }
  }
}

/**
 * Get educational resources for workspace dashboard (Staff only)
 * GET /api/educational-resources/dashboard/workspace
 */
export const getWorkspaceDashboardResources = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const context = getRequestContext(req);
    const workplaceId = new mongoose.Types.ObjectId(context.workplaceId);

    try {
      const resources = await EducationalResource.find({
        $or: [
          { workplaceId },
          { workplaceId: null, accessLevel: 'public' } // Include global public resources
        ],
        isPublished: true,
        isDeleted: false,
        displayLocations: 'workspace_dashboard'
      })
        .sort({ isPinned: -1, displayOrder: 1, createdAt: -1 })
        .limit(6)
        .select('title description slug thumbnail category mediaType viewCount ratings createdAt isPinned')
        .lean();

      const formattedResources = resources.map((resource: any) => ({
        id: resource._id.toString(),
        title: resource.title,
        description: resource.description,
        slug: resource.slug,
        thumbnail: resource.thumbnail,
        category: resource.category,
        mediaType: resource.mediaType,
        viewCount: resource.viewCount || 0,
        rating: resource.ratings?.averageRating || 0,
        createdAt: resource.createdAt,
        isPinned: resource.isPinned
      }));

      sendSuccess(
        res,
        { resources: formattedResources },
        'Workspace dashboard resources retrieved successfully'
      );
    } catch (error) {
      logger.error('Error retrieving workspace dashboard resources:', error);
      return sendError(res, 'SERVER_ERROR', 'Failed to retrieve workspace dashboard resources', 500);
    }
  }
);

export default EducationalResourceController;