import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { SupportTicketService } from '../services/SupportTicketService';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { SupportMetricsService } from '../services/SupportMetricsService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';
import { body, query, param } from 'express-validator';

// Import new help system models
import HelpFAQ from '../models/HelpFAQ';
import HelpVideo from '../models/HelpVideo';
import HelpFeedback from '../models/HelpFeedback';
import HelpSettings from '../models/HelpSettings';
import HelpSearchAnalytics from '../models/HelpSearchAnalytics';
import { KnowledgeBaseArticle } from '../models/KnowledgeBaseArticle';
import PDFDocument from 'pdfkit';

/**
 * Support Controller
 * Handles support ticket management, knowledge base, and support metrics
 * for the SaaS Settings Module
 */
export class SupportController {
  private ticketService: SupportTicketService;
  private knowledgeBaseService: KnowledgeBaseService;
  private metricsService: SupportMetricsService;

  constructor() {
    this.ticketService = SupportTicketService.getInstance();
    this.knowledgeBaseService = KnowledgeBaseService.getInstance();
    this.metricsService = SupportMetricsService.getInstance();
  }

  // Ticket Management Methods

  /**
   * Create a new support ticket
   * POST /api/admin/saas/support/tickets
   */
  async createTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        body('title').notEmpty().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
        body('description').notEmpty().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
        body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
        body('category').isIn(['technical', 'billing', 'feature_request', 'bug_report', 'general']).withMessage('Invalid category'),
        body('tags').optional().isArray().withMessage('Tags must be an array'),
        body('workspaceId').optional().isMongoId().withMessage('Invalid workspace ID')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const ticketData = {
        ...req.body,
        userId: req.user!._id
      };

      logger.info('Creating support ticket', {
        userId: req.user!._id,
        title: ticketData.title,
        priority: ticketData.priority
      });

      const ticket = await this.ticketService.createTicket(ticketData);

      sendSuccess(
        res,
        ticket,
        'Support ticket created successfully',
        201
      );
    } catch (error) {
      logger.error('Error creating support ticket:', error);
      sendError(
        res,
        'TICKET_CREATION_ERROR',
        'Failed to create support ticket',
        500
      );
    }
  }

  /**
   * Get tickets with filtering and pagination
   * GET /api/admin/saas/support/tickets
   */
  async getTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
        query('status').optional().isArray().withMessage('Status must be an array'),
        query('priority').optional().isArray().withMessage('Priority must be an array'),
        query('category').optional().isArray().withMessage('Category must be an array'),
        query('assignedTo').optional().isMongoId().withMessage('Invalid assigned to ID'),
        query('search').optional().isString().withMessage('Search must be a string')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const filters = {
        status: req.query.status as string[],
        priority: req.query.priority as string[],
        category: req.query.category as string[],
        assignedTo: req.query.assignedTo as string,
        userId: req.query.userId as string,
        workspaceId: req.query.workspaceId as string,
        search: req.query.search as string,
        tags: req.query.tags as string[],
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      logger.info('Fetching support tickets', {
        userId: req.user!._id,
        filters,
        pagination
      });

      const result = await this.ticketService.getTickets(filters, pagination);

      sendSuccess(
        res,
        result,
        'Tickets retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching tickets:', error);
      sendError(
        res,
        'TICKETS_FETCH_ERROR',
        'Failed to fetch tickets',
        500
      );
    }
  }

  /**
   * Get ticket by ID
   * GET /api/admin/saas/support/tickets/:ticketId
   */
  async getTicketById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;

      logger.info('Fetching ticket by ID', {
        userId: req.user!._id,
        ticketId
      });

      const ticket = await this.ticketService.getTicketById(ticketId);

      if (!ticket) {
        sendError(res, 'TICKET_NOT_FOUND', 'Ticket not found', 404);
        return;
      }

      sendSuccess(
        res,
        ticket,
        'Ticket retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching ticket by ID:', error);
      sendError(
        res,
        'TICKET_FETCH_ERROR',
        'Failed to fetch ticket',
        500
      );
    }
  }

  /**
   * Assign ticket to agent
   * PUT /api/admin/saas/support/tickets/:ticketId/assign
   */
  async assignTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
        body('assignedToId').isMongoId().withMessage('Invalid assigned to ID')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;
      const { assignedToId } = req.body;

      logger.info('Assigning ticket', {
        userId: req.user!._id,
        ticketId,
        assignedToId
      });

      const ticket = await this.ticketService.assignTicket(
        ticketId,
        assignedToId,
        req.user!._id
      );

      sendSuccess(
        res,
        ticket,
        'Ticket assigned successfully'
      );
    } catch (error) {
      logger.error('Error assigning ticket:', error);
      sendError(
        res,
        'TICKET_ASSIGNMENT_ERROR',
        'Failed to assign ticket',
        500
      );
    }
  }

  /**
   * Update ticket status
   * PUT /api/admin/saas/support/tickets/:ticketId/status
   */
  async updateTicketStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
        body('status').isIn(['open', 'in_progress', 'pending_customer', 'resolved', 'closed']).withMessage('Invalid status'),
        body('resolutionNotes').optional().isString().withMessage('Resolution notes must be a string')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;
      const { status, resolutionNotes } = req.body;

      logger.info('Updating ticket status', {
        userId: req.user!._id,
        ticketId,
        status
      });

      const ticket = await this.ticketService.updateTicketStatus(
        ticketId,
        status,
        req.user!._id,
        resolutionNotes
      );

      sendSuccess(
        res,
        ticket,
        'Ticket status updated successfully'
      );
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      sendError(
        res,
        'TICKET_UPDATE_ERROR',
        'Failed to update ticket status',
        500
      );
    }
  }

  /**
   * Escalate ticket
   * PUT /api/admin/saas/support/tickets/:ticketId/escalate
   */
  async escalateTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
        body('reason').notEmpty().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;
      const { reason } = req.body;

      logger.info('Escalating ticket', {
        userId: req.user!._id,
        ticketId,
        reason
      });

      const ticket = await this.ticketService.escalateTicket(
        ticketId,
        req.user!._id,
        reason
      );

      sendSuccess(
        res,
        ticket,
        'Ticket escalated successfully'
      );
    } catch (error) {
      logger.error('Error escalating ticket:', error);
      sendError(
        res,
        'TICKET_ESCALATION_ERROR',
        'Failed to escalate ticket',
        500
      );
    }
  }

  /**
   * Add comment to ticket
   * POST /api/admin/saas/support/tickets/:ticketId/comments
   */
  async addComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
        body('content').notEmpty().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
        body('isInternal').optional().isBoolean().withMessage('isInternal must be a boolean')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;
      const { content, isInternal, attachments } = req.body;

      // Determine author type based on user role
      const authorType = ['support_agent', 'senior_support_agent', 'technical_support', 'admin', 'super_admin'].includes(req.user!.role)
        ? 'agent'
        : 'customer';

      logger.info('Adding comment to ticket', {
        userId: req.user!._id,
        ticketId,
        authorType
      });

      const comment = await this.ticketService.addComment({
        ticketId,
        authorId: req.user!._id,
        content,
        authorType,
        isInternal: isInternal || false,
        attachments
      });

      sendSuccess(
        res,
        comment,
        'Comment added successfully',
        201
      );
    } catch (error) {
      logger.error('Error adding comment:', error);
      sendError(
        res,
        'COMMENT_CREATION_ERROR',
        'Failed to add comment',
        500
      );
    }
  }

  /**
   * Get ticket comments
   * GET /api/admin/saas/support/tickets/:ticketId/comments
   */
  async getTicketComments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        param('ticketId').isMongoId().withMessage('Invalid ticket ID'),
        query('includeInternal').optional().isBoolean().withMessage('includeInternal must be a boolean')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const { ticketId } = req.params;
      const includeInternal = req.query.includeInternal === 'true';

      logger.info('Fetching ticket comments', {
        userId: req.user!._id,
        ticketId,
        includeInternal
      });

      const comments = await this.ticketService.getTicketComments(ticketId, includeInternal);

      sendSuccess(
        res,
        { comments },
        'Comments retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching comments:', error);
      sendError(
        res,
        'COMMENTS_FETCH_ERROR',
        'Failed to fetch comments',
        500
      );
    }
  }

  // Knowledge Base Methods

  /**
   * Create knowledge base article
   * POST /api/admin/saas/support/knowledge-base/articles
   */
  async createArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        body('title').notEmpty().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
        body('content').notEmpty().withMessage('Content is required'),
        body('excerpt').notEmpty().isLength({ min: 10, max: 500 }).withMessage('Excerpt must be 10-500 characters'),
        body('category').notEmpty().withMessage('Category is required'),
        body('tags').optional().isArray().withMessage('Tags must be an array'),
        body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const articleData = {
        ...req.body,
        authorId: req.user!._id
      };

      logger.info('Creating knowledge base article', {
        userId: req.user!._id,
        title: articleData.title
      });

      const article = await this.knowledgeBaseService.createArticle(articleData);

      sendSuccess(
        res,
        article,
        'Article created successfully',
        201
      );
    } catch (error) {
      logger.error('Error creating article:', error);
      sendError(
        res,
        'ARTICLE_CREATION_ERROR',
        'Failed to create article',
        500
      );
    }
  }

  /**
   * Get knowledge base articles
   * GET /api/admin/saas/support/knowledge-base/articles
   */
  async getArticles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = {
        status: req.query.status as string[],
        category: req.query.category as string,
        subcategory: req.query.subcategory as string,
        tags: req.query.tags as string[],
        authorId: req.query.authorId as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        search: req.query.search as string,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      logger.info('Fetching knowledge base articles', {
        userId: req.user!._id,
        filters,
        pagination
      });

      const result = await this.knowledgeBaseService.getArticles(filters, pagination);

      sendSuccess(
        res,
        result,
        'Articles retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching articles:', error);
      sendError(
        res,
        'ARTICLES_FETCH_ERROR',
        'Failed to fetch articles',
        500
      );
    }
  }

  /**
   * Search knowledge base articles
   * GET /api/admin/saas/support/knowledge-base/search
   */
  async searchArticles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        query('q').notEmpty().withMessage('Search query is required'),
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const searchQuery = req.query.q as string;
      const filters = {
        category: req.query.category as string,
        tags: req.query.tags as string[]
      };
      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10
      };

      logger.info('Searching knowledge base articles', {
        userId: req.user!._id,
        searchQuery,
        filters
      });

      const result = await this.knowledgeBaseService.searchArticles(searchQuery, filters, pagination);

      sendSuccess(
        res,
        result,
        'Search completed successfully'
      );
    } catch (error) {
      logger.error('Error searching articles:', error);
      sendError(
        res,
        'SEARCH_ERROR',
        'Failed to search articles',
        500
      );
    }
  }

  // Metrics Methods

  /**
   * Get support metrics
   * GET /api/admin/saas/support/metrics
   */
  async getSupportMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const timeRange = req.query.startDate && req.query.endDate ? {
        startDate: new Date(req.query.startDate as string),
        endDate: new Date(req.query.endDate as string)
      } : undefined;

      logger.info('Fetching support metrics', {
        userId: req.user!._id,
        timeRange
      });

      const metrics = await this.metricsService.getSupportKPIs(timeRange);

      logger.info('Support metrics calculated', {
        totalTickets: metrics.totalTickets,
        chartDataCounts: {
          status: metrics.ticketsByStatus?.length || 0,
          priority: metrics.ticketsByPriority?.length || 0,
          category: metrics.ticketsByCategory?.length || 0
        }
      });

      sendSuccess(
        res,
        metrics,
        'Support metrics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching support metrics:', error);
      sendError(
        res,
        'METRICS_ERROR',
        'Failed to fetch support metrics',
        500
      );
    }
  }

  /**
   * Get support analytics
   * GET /api/admin/saas/support/analytics
   */
  async getSupportAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationRules = [
        query('startDate').notEmpty().isISO8601().withMessage('Valid start date is required'),
        query('endDate').notEmpty().isISO8601().withMessage('Valid end date is required')
      ];

      // Validation temporarily disabled
      // const validationResult = await validateRequest(req, validationRules);
      // if (!validationResult.isValid) {
      //   sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, validationResult.errors);
      //   return;
      // }

      const timeRange = {
        startDate: new Date(req.query.startDate as string),
        endDate: new Date(req.query.endDate as string)
      };

      logger.info('Fetching support analytics', {
        userId: req.user!._id,
        timeRange
      });

      const analytics = await this.metricsService.getSupportAnalytics(timeRange);

      sendSuccess(
        res,
        analytics,
        'Support analytics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching support analytics:', error);
      sendError(
        res,
        'ANALYTICS_ERROR',
        'Failed to fetch support analytics',
        500
      );
    }
  }

  // Help System Methods

  /**
   * Get help content (FAQs, Articles, Videos) with search and filtering
   * GET /api/admin/saas/support/help/content
   */
  async getHelpContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('🔍 Help content request from user:', {
        userId: req.user?._id,
        userRole: req.user?.role,
        userEmail: req.user?.email
      });
      
      const {
        search,
        category,
        contentType = 'all',
        difficulty,
        tags,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const searchStartTime = Date.now();
      let searchResults: any = {
        articles: [],
        faqs: [],
        videos: [],
        total: 0
      };

      // Build search query
      const searchQuery: any = { status: 'published' };
      
      if (search) {
        searchQuery.$text = { $search: search as string };
      }
      
      if (category) {
        searchQuery.category = category;
      }
      
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        searchQuery.tags = { $in: tagArray };
      }

      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Search Articles
      if (contentType === 'all' || contentType === 'articles') {
        const articles = await KnowledgeBaseArticle.find(searchQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .populate('authorId', 'firstName lastName')
          .lean();
        
        searchResults.articles = articles;
      }

      // Search FAQs
      if (contentType === 'all' || contentType === 'faqs') {
        const faqs = await HelpFAQ.find(searchQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .populate('authorId', 'firstName lastName')
          .lean();
        
        searchResults.faqs = faqs;
      }

      // Search Videos
      if (contentType === 'all' || contentType === 'videos') {
        const videoQuery = { ...searchQuery };
        if (difficulty) {
          videoQuery.difficulty = difficulty;
        }
        
        const videos = await HelpVideo.find(videoQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .populate('authorId', 'firstName lastName')
          .lean();
        
        searchResults.videos = videos;
      }

      // Calculate total results
      searchResults.total = searchResults.articles.length + 
                           searchResults.faqs.length + 
                           searchResults.videos.length;

      // Log search analytics
      if (search) {
        const searchDuration = Date.now() - searchStartTime;
        
        await HelpSearchAnalytics.create({
          query: search as string,
          normalizedQuery: (search as string).toLowerCase().trim(),
          userId: req.user!._id,
          userRole: req.user!.role,
          category: category as string,
          contentType: contentType as any,
          resultsCount: searchResults.total,
          hasResults: searchResults.total > 0,
          searchDurationMs: searchDuration,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
        });
      }

      sendSuccess(res, searchResults, 'Help content retrieved successfully');
    } catch (error) {
      logger.error('Error fetching help content:', error);
      sendError(res, 'HELP_CONTENT_ERROR', 'Failed to fetch help content', 500);
    }
  }

  /**
   * Get help categories and statistics
   * GET /api/admin/saas/support/help/categories
   */
  async getHelpCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('📂 Help categories request from user:', {
        userId: req.user?._id,
        userRole: req.user?.role,
        userEmail: req.user?.email
      });
      // Get categories with counts
      const [articleCategories, faqCategories, videoCategories] = await Promise.all([
        KnowledgeBaseArticle.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        HelpFAQ.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        HelpVideo.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      // Merge and organize categories
      const categoryMap = new Map();
      
      [...articleCategories, ...faqCategories, ...videoCategories].forEach(cat => {
        if (categoryMap.has(cat._id)) {
          categoryMap.get(cat._id).count += cat.count;
        } else {
          categoryMap.set(cat._id, { name: cat._id, count: cat.count });
        }
      });

      const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);

      sendSuccess(res, { categories }, 'Categories retrieved successfully');
    } catch (error) {
      logger.error('Error fetching help categories:', error);
      sendError(res, 'CATEGORIES_ERROR', 'Failed to fetch categories', 500);
    }
  }

  /**
   * Submit help feedback
   * POST /api/admin/saas/support/help/feedback
   */
  async submitHelpFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        type,
        rating,
        title,
        message,
        category,
        relatedContentType,
        relatedContentId,
        relatedContentTitle
      } = req.body;

      const feedback = await HelpFeedback.create({
        userId: req.user!._id,
        userEmail: req.user!.email,
        userName: `${req.user!.firstName} ${req.user!.lastName}`,
        type,
        rating,
        title,
        message,
        category,
        relatedContentType,
        relatedContentId,
        relatedContentTitle,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        pageUrl: req.get('Referer'),
      });

      // Send notification for critical feedback
      if (rating <= 2 || type === 'bug_report') {
        logger.warn('Critical feedback received', {
          feedbackId: feedback._id,
          userId: req.user!._id,
          rating,
          type
        });
      }

      sendSuccess(res, feedback, 'Feedback submitted successfully', 201);
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      sendError(res, 'FEEDBACK_ERROR', 'Failed to submit feedback', 500);
    }
  }

  /**
   * Get public contact information for help page (for all authenticated users)
   * GET /api/admin/saas/support/help/contact-info
   */
  async getHelpContactInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('📞 Help contact info request from user:', {
        userId: req.user?._id,
        userRole: req.user?.role,
        userEmail: req.user?.email
      });
      const settings = await HelpSettings.getSettings();
      
      // Return only public contact information
      const publicInfo = {
        whatsappNumber: settings.whatsappNumber,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        businessHours: settings.businessHours,
        systemStatus: settings.systemStatus,
        features: {
          enableWhatsappSupport: settings.features.enableWhatsappSupport,
          enableLiveChat: settings.features.enableLiveChat,
        },
        customization: {
          welcomeMessage: settings.customization.welcomeMessage,
        }
      };
      
      sendSuccess(res, publicInfo, 'Help contact information retrieved successfully');
    } catch (error) {
      logger.error('Error fetching help contact info:', error);
      sendError(res, 'HELP_CONTENT_ERROR', 'Failed to fetch help contact information', 500);
    }
  }

  /**
   * Get help settings (for super admin)
   * GET /api/admin/saas/support/help/settings
   */
  async getHelpSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await HelpSettings.getSettings();
      sendSuccess(res, settings, 'Help settings retrieved successfully');
    } catch (error) {
      logger.error('Error fetching help settings:', error);
      sendError(res, 'SETTINGS_ERROR', 'Failed to fetch help settings', 500);
    }
  }

  /**
   * Update help settings (for super admin)
   * PUT /api/admin/saas/support/help/settings
   */
  async updateHelpSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const settings = await HelpSettings.getSettings();
      
      Object.assign(settings, req.body);
      settings.lastUpdatedBy = req.user!._id;
      
      await settings.save();

      sendSuccess(res, settings, 'Help settings updated successfully');
    } catch (error) {
      logger.error('Error updating help settings:', error);
      sendError(res, 'SETTINGS_UPDATE_ERROR', 'Failed to update help settings', 500);
    }
  }

  /**
   * Generate PDF user manual
   * GET /api/admin/saas/support/help/manual/pdf
   */
  async generatePDFManual(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { categories } = req.query;
      
      // Get content for PDF
      const query: any = { status: 'published' };
      if (categories) {
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        query.category = { $in: categoryArray };
      }

      const [articles, faqs] = await Promise.all([
        KnowledgeBaseArticle.find(query).sort({ category: 1, title: 1 }),
        HelpFAQ.find(query).sort({ category: 1, displayOrder: 1, question: 1 })
      ]);

      // Create PDF
      const doc = new PDFDocument();
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="PharmacyCopilot-User-Manual.pdf"');
      
      // Pipe PDF to response
      doc.pipe(res);

      // Add title page
      doc.fontSize(24).text('PharmacyCopilot User Manual', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.addPage();

      // Add table of contents
      doc.fontSize(18).text('Table of Contents');
      doc.moveDown();
      
      let currentCategory = '';

      // Generate content
      for (const article of articles) {
        if (article.category !== currentCategory) {
          currentCategory = article.category;
          doc.addPage();
          doc.fontSize(16).text(currentCategory.toUpperCase(), { underline: true });
          doc.moveDown();
        }
        
        doc.fontSize(14).text(article.title, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(article.content);
        doc.moveDown();
      }

      // Add FAQs section
      if (faqs.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Frequently Asked Questions');
        doc.moveDown();

        currentCategory = '';
        for (const faq of faqs) {
          if (faq.category !== currentCategory) {
            currentCategory = faq.category;
            doc.fontSize(14).text(currentCategory.toUpperCase(), { underline: true });
            doc.moveDown();
          }
          
          doc.fontSize(12).text(`Q: ${faq.question}`, { continued: false });
          doc.fontSize(10).text(`A: ${faq.answer}`);
          doc.moveDown();
        }
      }

      doc.end();
    } catch (error) {
      logger.error('Error generating PDF manual:', error);
      sendError(res, 'PDF_GENERATION_ERROR', 'Failed to generate PDF manual', 500);
    }
  }

  /**
   * Get help analytics (for super admin)
   * GET /api/admin/saas/support/help/analytics
   */
  async getHelpAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      };

      const [
        popularQueries,
        searchTrends,
        zeroResultQueries,
        feedbackStats,
        contentStats
      ] = await Promise.all([
        HelpSearchAnalytics.getPopularQueries(10, dateRange),
        HelpSearchAnalytics.getSearchTrends(dateRange, 'day'),
        HelpSearchAnalytics.getZeroResultQueries(10, dateRange),
        HelpFeedback.aggregate([
          {
            $match: {
              createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            }
          },
          {
            $group: {
              _id: null,
              totalFeedback: { $sum: 1 },
              averageRating: { $avg: '$rating' },
              criticalFeedback: {
                $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] }
              }
            }
          }
        ]),
        Promise.all([
          KnowledgeBaseArticle.countDocuments({ status: 'published' }),
          HelpFAQ.countDocuments({ status: 'published' }),
          HelpVideo.countDocuments({ status: 'published' })
        ])
      ]);

      const analytics = {
        searchAnalytics: {
          popularQueries,
          searchTrends,
          zeroResultQueries
        },
        feedbackStats: feedbackStats[0] || {
          totalFeedback: 0,
          averageRating: 0,
          criticalFeedback: 0
        },
        contentStats: {
          articles: contentStats[0],
          faqs: contentStats[1],
          videos: contentStats[2],
          total: contentStats[0] + contentStats[1] + contentStats[2]
        }
      };

      sendSuccess(res, analytics, 'Help analytics retrieved successfully');
    } catch (error) {
      logger.error('Error fetching help analytics:', error);
      sendError(res, 'ANALYTICS_ERROR', 'Failed to fetch help analytics', 500);
    }
  }

  // CRUD Operations for Help Content (Super Admin only)

  /**
   * Create FAQ
   * POST /api/admin/saas/support/help/faqs
   */
  async createFAQ(req: AuthRequest, res: Response): Promise<void> {
    try {
      const faqData = {
        ...req.body,
        authorId: req.user!._id,
        authorName: `${req.user!.firstName} ${req.user!.lastName}`
      };

      const faq = await HelpFAQ.create(faqData);
      sendSuccess(res, faq, 'FAQ created successfully', 201);
    } catch (error) {
      logger.error('Error creating FAQ:', error);
      sendError(res, 'FAQ_CREATION_ERROR', 'Failed to create FAQ', 500);
    }
  }

  /**
   * Update FAQ
   * PUT /api/admin/saas/support/help/faqs/:id
   */
  async updateFAQ(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const faq = await HelpFAQ.findByIdAndUpdate(
        id,
        {
          ...req.body,
          lastEditedBy: req.user!._id,
          lastEditedAt: new Date()
        },
        { new: true }
      );

      if (!faq) {
        sendError(res, 'FAQ_NOT_FOUND', 'FAQ not found', 404);
        return;
      }

      sendSuccess(res, faq, 'FAQ updated successfully');
    } catch (error) {
      logger.error('Error updating FAQ:', error);
      sendError(res, 'FAQ_UPDATE_ERROR', 'Failed to update FAQ', 500);
    }
  }

  /**
   * Vote on FAQ helpfulness
   * POST /api/help/faqs/:id/vote
   */
  async voteFAQ(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { helpful } = req.body; // true for helpful, false for not helpful
      
      if (typeof helpful !== 'boolean') {
        sendError(res, 'VALIDATION_ERROR', 'Vote must be true (helpful) or false (not helpful)', 400);
        return;
      }

      const faq = await HelpFAQ.findById(id);
      if (!faq) {
        sendError(res, 'NOT_FOUND', 'FAQ not found', 404);
        return;
      }

      // Update vote counts
      if (helpful) {
        faq.helpfulVotes += 1;
      } else {
        faq.notHelpfulVotes += 1;
      }

      await faq.save();

      logger.info('FAQ vote recorded', {
        faqId: id,
        helpful,
        userId: req.user!._id,
        newCounts: {
          helpful: faq.helpfulVotes,
          notHelpful: faq.notHelpfulVotes
        }
      });

      sendSuccess(res, {
        helpfulVotes: faq.helpfulVotes,
        notHelpfulVotes: faq.notHelpfulVotes
      }, 'Vote recorded successfully');
    } catch (error) {
      logger.error('Error recording FAQ vote:', error);
      sendError(res, 'SERVER_ERROR', 'Failed to record vote', 500);
    }
  }

  /**
   * Delete FAQ
   * DELETE /api/admin/saas/support/help/faqs/:id
   */
  async deleteFAQ(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const faq = await HelpFAQ.findByIdAndDelete(id);

      if (!faq) {
        sendError(res, 'FAQ_NOT_FOUND', 'FAQ not found', 404);
        return;
      }

      sendSuccess(res, null, 'FAQ deleted successfully');
    } catch (error) {
      logger.error('Error deleting FAQ:', error);
      sendError(res, 'FAQ_DELETE_ERROR', 'Failed to delete FAQ', 500);
    }
  }

  /**
   * Create Video
   * POST /api/admin/saas/support/help/videos
   */
  async createVideo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const videoData = {
        ...req.body,
        authorId: req.user!._id,
        authorName: `${req.user!.firstName} ${req.user!.lastName}`
      };

      const video = await HelpVideo.create(videoData);
      sendSuccess(res, video, 'Video created successfully', 201);
    } catch (error) {
      logger.error('Error creating video:', error);
      sendError(res, 'VIDEO_CREATION_ERROR', 'Failed to create video', 500);
    }
  }

  /**
   * Update Video
   * PUT /api/admin/saas/support/help/videos/:id
   */
  async updateVideo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const video = await HelpVideo.findByIdAndUpdate(
        id,
        {
          ...req.body,
          lastEditedBy: req.user!._id,
          lastEditedAt: new Date()
        },
        { new: true }
      );

      if (!video) {
        sendError(res, 'VIDEO_NOT_FOUND', 'Video not found', 404);
        return;
      }

      sendSuccess(res, video, 'Video updated successfully');
    } catch (error) {
      logger.error('Error updating video:', error);
      sendError(res, 'VIDEO_UPDATE_ERROR', 'Failed to update video', 500);
    }
  }

  /**
   * Delete Video
   * DELETE /api/admin/saas/support/help/videos/:id
   */
  async deleteVideo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const video = await HelpVideo.findByIdAndDelete(id);

      if (!video) {
        sendError(res, 'VIDEO_NOT_FOUND', 'Video not found', 404);
        return;
      }

      sendSuccess(res, null, 'Video deleted successfully');
    } catch (error) {
      logger.error('Error deleting video:', error);
      sendError(res, 'VIDEO_DELETE_ERROR', 'Failed to delete video', 500);
    }
  }

  /**
   * Get all feedback (for admin review)
   * GET /api/admin/saas/support/help/feedback
   */
  async getAllFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        status,
        type,
        priority,
        rating,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query: any = {};
      
      if (status) query.status = status;
      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (rating) query.rating = parseInt(rating as string);

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const [feedback, total] = await Promise.all([
        HelpFeedback.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .populate('userId', 'firstName lastName email')
          .populate('respondedBy', 'firstName lastName'),
        HelpFeedback.countDocuments(query)
      ]);

      sendSuccess(res, {
        feedback,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }, 'Feedback retrieved successfully');
    } catch (error) {
      logger.error('Error fetching feedback:', error);
      sendError(res, 'FEEDBACK_FETCH_ERROR', 'Failed to fetch feedback', 500);
    }
  }

  /**
   * Respond to feedback
   * PUT /api/admin/saas/support/help/feedback/:id/respond
   */
  async respondToFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { response, status = 'resolved' } = req.body;

      const feedback = await HelpFeedback.findByIdAndUpdate(
        id,
        {
          adminResponse: response,
          status,
          respondedBy: req.user!._id,
          respondedAt: new Date()
        },
        { new: true }
      ).populate('userId', 'firstName lastName email');

      if (!feedback) {
        sendError(res, 'FEEDBACK_NOT_FOUND', 'Feedback not found', 404);
        return;
      }

      sendSuccess(res, feedback, 'Response sent successfully');
    } catch (error) {
      logger.error('Error responding to feedback:', error);
      sendError(res, 'FEEDBACK_RESPONSE_ERROR', 'Failed to respond to feedback', 500);
    }
  }

  // Knowledge Base Article Management (Super Admin only)

  /**
   * Create Knowledge Base Article
   * POST /api/admin/saas/support/knowledge-base/articles
   */
  async createKnowledgeBaseArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const articleData = {
        ...req.body,
        authorId: req.user!._id,
        authorName: `${req.user!.firstName} ${req.user!.lastName}`,
        slug: req.body.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      };

      const article = await KnowledgeBaseArticle.create(articleData);
      sendSuccess(res, article, 'Article created successfully', 201);
    } catch (error) {
      logger.error('Error creating knowledge base article:', error);
      sendError(res, 'ARTICLE_CREATION_ERROR', 'Failed to create article', 500);
    }
  }

  /**
   * Update Knowledge Base Article
   * PUT /api/admin/saas/support/knowledge-base/articles/:id
   */
  async updateKnowledgeBaseArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const article = await KnowledgeBaseArticle.findByIdAndUpdate(
        id,
        {
          ...req.body,
          lastEditedBy: req.user!._id,
          lastEditedAt: new Date()
        },
        { new: true }
      );

      if (!article) {
        sendError(res, 'ARTICLE_NOT_FOUND', 'Article not found', 404);
        return;
      }

      sendSuccess(res, article, 'Article updated successfully');
    } catch (error) {
      logger.error('Error updating knowledge base article:', error);
      sendError(res, 'ARTICLE_UPDATE_ERROR', 'Failed to update article', 500);
    }
  }

  /**
   * Delete Knowledge Base Article
   * DELETE /api/admin/saas/support/knowledge-base/articles/:id
   */
  async deleteKnowledgeBaseArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const article = await KnowledgeBaseArticle.findByIdAndDelete(id);

      if (!article) {
        sendError(res, 'ARTICLE_NOT_FOUND', 'Article not found', 404);
        return;
      }

      sendSuccess(res, null, 'Article deleted successfully');
    } catch (error) {
      logger.error('Error deleting knowledge base article:', error);
      sendError(res, 'ARTICLE_DELETE_ERROR', 'Failed to delete article', 500);
    }
  }

  /**
   * Get Knowledge Base Article by ID
   * GET /api/admin/saas/support/knowledge-base/articles/:id
   */
  async getKnowledgeBaseArticleById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const article = await KnowledgeBaseArticle.findById(id)
        .populate('authorId', 'firstName lastName');

      if (!article) {
        sendError(res, 'ARTICLE_NOT_FOUND', 'Article not found', 404);
        return;
      }

      // Increment view count
      await article.incrementViewCount();

      sendSuccess(res, article, 'Article retrieved successfully');
    } catch (error) {
      logger.error('Error fetching knowledge base article:', error);
      sendError(res, 'ARTICLE_FETCH_ERROR', 'Failed to fetch article', 500);
    }
  }
}

// Create and export controller instance
export const supportController = new SupportController();