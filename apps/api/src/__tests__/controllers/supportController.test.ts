import { Request, Response } from 'express';
import { SupportController } from '../../controllers/supportController';
import { SupportTicketService } from '../../services/SupportTicketService';
import { KnowledgeBaseService } from '../../services/KnowledgeBaseService';
import { SupportMetricsService } from '../../services/SupportMetricsService';
import { AuthRequest } from '../../middlewares/auth';
import { sendSuccess, sendError } from '../../utils/responseHelpers';
import { validateRequest } from '../../utils/validation';

// Mock dependencies
jest.mock('../../services/SupportTicketService');
jest.mock('../../services/KnowledgeBaseService');
jest.mock('../../services/SupportMetricsService');
jest.mock('../../utils/responseHelpers');
jest.mock('../../utils/validation');

describe('SupportController', () => {
  let supportController: SupportController;
  let mockTicketService: jest.Mocked<SupportTicketService>;
  let mockKnowledgeBaseService: jest.Mocked<KnowledgeBaseService>;
  let mockMetricsService: jest.Mocked<SupportMetricsService>;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;

  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user'
  };

  const mockTicket = {
    _id: 'ticket123',
    ticketNumber: 'TKT-000001',
    title: 'Test Support Ticket',
    description: 'This is a test ticket',
    status: 'open',
    priority: 'medium',
    category: 'technical',
    userId: mockUser._id,
    userEmail: mockUser.email,
    userName: `${mockUser.firstName} ${mockUser.lastName}`,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockTicketService = {
      createTicket: jest.fn(),
      getTickets: jest.fn(),
      getTicketById: jest.fn(),
      assignTicket: jest.fn(),
      updateTicketStatus: jest.fn(),
      escalateTicket: jest.fn(),
      addComment: jest.fn(),
      getTicketComments: jest.fn(),
      getInstance: jest.fn()
    } as any;
    (SupportTicketService.getInstance as jest.Mock).mockReturnValue(mockTicketService);

    mockKnowledgeBaseService = {
      createArticle: jest.fn(),
      getArticles: jest.fn(),
      searchArticles: jest.fn(),
      getInstance: jest.fn()
    } as any;
    (KnowledgeBaseService.getInstance as jest.Mock).mockReturnValue(mockKnowledgeBaseService);

    mockMetricsService = {
      getSupportKPIs: jest.fn(),
      getSupportAnalytics: jest.fn(),
      getInstance: jest.fn()
    } as any;
    (SupportMetricsService.getInstance as jest.Mock).mockReturnValue(mockMetricsService);

    // Mock request and response
    mockReq = {
      user: mockUser,
      body: {},
      query: {},
      params: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock validation
    (validateRequest as jest.Mock).mockResolvedValue({ isValid: true, errors: [] });

    supportController = new SupportController();
  });

  describe('createTicket', () => {
    const ticketData = {
      title: 'Test Support Ticket',
      description: 'This is a test support ticket description',
      priority: 'medium',
      category: 'technical',
      tags: ['test', 'support']
    };

    beforeEach(() => {
      mockReq.body = ticketData;
      mockTicketService.createTicket.mockResolvedValue(mockTicket as any);
    });

    it('should create a ticket successfully', async () => {
      await supportController.createTicket(mockReq as AuthRequest, mockRes as Response);

      expect(validateRequest).toHaveBeenCalled();
      expect(mockTicketService.createTicket).toHaveBeenCalledWith({
        ...ticketData,
        userId: mockUser._id
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTicket,
        'Support ticket created successfully',
        201
      );
    });

    it('should handle validation errors', async () => {
      const validationErrors = [{ field: 'title', message: 'Title is required' }];
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: validationErrors 
      });

      await supportController.createTicket(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        validationErrors
      );
      expect(mockTicketService.createTicket).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockTicketService.createTicket.mockRejectedValue(new Error('Service error'));

      await supportController.createTicket(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'TICKET_CREATION_ERROR',
        'Failed to create support ticket',
        500
      );
    });
  });

  describe('getTickets', () => {
    const mockPaginatedResult = {
      tickets: [mockTicket],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 1,
        hasNext: false,
        hasPrev: false
      }
    };

    beforeEach(() => {
      mockReq.query = {
        page: '1',
        limit: '20',
        status: ['open', 'in_progress'],
        priority: ['high', 'critical']
      };
      mockTicketService.getTickets.mockResolvedValue(mockPaginatedResult as any);
    });

    it('should get tickets successfully', async () => {
      await supportController.getTickets(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.getTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['open', 'in_progress'],
          priority: ['high', 'critical']
        }),
        expect.objectContaining({
          page: 1,
          limit: 20
        })
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockPaginatedResult,
        'Tickets retrieved successfully'
      );
    });

    it('should use default pagination values', async () => {
      mockReq.query = {};

      await supportController.getTickets(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.getTickets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          page: 1,
          limit: 20,
          sortOrder: 'desc'
        })
      );
    });

    it('should handle validation errors', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'page', message: 'Invalid page number' }] 
      });

      await supportController.getTickets(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        expect.any(Array)
      );
    });
  });

  describe('getTicketById', () => {
    const ticketId = 'ticket123';

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockTicketService.getTicketById.mockResolvedValue(mockTicket as any);
    });

    it('should get ticket by ID successfully', async () => {
      await supportController.getTicketById(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.getTicketById).toHaveBeenCalledWith(ticketId);
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTicket,
        'Ticket retrieved successfully'
      );
    });

    it('should handle ticket not found', async () => {
      mockTicketService.getTicketById.mockResolvedValue(null);

      await supportController.getTicketById(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'TICKET_NOT_FOUND',
        'Ticket not found',
        404
      );
    });

    it('should handle invalid ticket ID', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'ticketId', message: 'Invalid ticket ID' }] 
      });

      await supportController.getTicketById(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid ticket ID',
        400,
        expect.any(Array)
      );
    });
  });

  describe('assignTicket', () => {
    const ticketId = 'ticket123';
    const assignedToId = 'agent456';

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockReq.body = { assignedToId };
      mockTicketService.assignTicket.mockResolvedValue(mockTicket as any);
    });

    it('should assign ticket successfully', async () => {
      await supportController.assignTicket(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.assignTicket).toHaveBeenCalledWith(
        ticketId,
        assignedToId,
        mockUser._id
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTicket,
        'Ticket assigned successfully'
      );
    });

    it('should handle validation errors', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'assignedToId', message: 'Invalid assigned to ID' }] 
      });

      await supportController.assignTicket(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        expect.any(Array)
      );
    });
  });

  describe('updateTicketStatus', () => {
    const ticketId = 'ticket123';
    const status = 'resolved';
    const resolutionNotes = 'Issue resolved by restarting the service';

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockReq.body = { status, resolutionNotes };
      mockTicketService.updateTicketStatus.mockResolvedValue(mockTicket as any);
    });

    it('should update ticket status successfully', async () => {
      await supportController.updateTicketStatus(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.updateTicketStatus).toHaveBeenCalledWith(
        ticketId,
        status,
        mockUser._id,
        resolutionNotes
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTicket,
        'Ticket status updated successfully'
      );
    });

    it('should handle invalid status', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'status', message: 'Invalid status' }] 
      });

      await supportController.updateTicketStatus(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        expect.any(Array)
      );
    });
  });

  describe('escalateTicket', () => {
    const ticketId = 'ticket123';
    const reason = 'Customer is VIP and needs immediate attention';

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockReq.body = { reason };
      mockTicketService.escalateTicket.mockResolvedValue(mockTicket as any);
    });

    it('should escalate ticket successfully', async () => {
      await supportController.escalateTicket(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.escalateTicket).toHaveBeenCalledWith(
        ticketId,
        mockUser._id,
        reason
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockTicket,
        'Ticket escalated successfully'
      );
    });

    it('should handle missing reason', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'reason', message: 'Reason is required' }] 
      });

      await supportController.escalateTicket(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        expect.any(Array)
      );
    });
  });

  describe('addComment', () => {
    const ticketId = 'ticket123';
    const content = 'This is a test comment';
    const mockComment = {
      _id: 'comment123',
      ticketId,
      content,
      authorId: mockUser._id,
      createdAt: new Date()
    };

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockReq.body = { content, isInternal: false };
      mockTicketService.addComment.mockResolvedValue(mockComment as any);
    });

    it('should add comment successfully', async () => {
      await supportController.addComment(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.addComment).toHaveBeenCalledWith({
        ticketId,
        authorId: mockUser._id,
        content,
        authorType: 'customer',
        isInternal: false,
        attachments: undefined
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockComment,
        'Comment added successfully',
        201
      );
    });

    it('should determine author type as agent for support roles', async () => {
      mockReq.user = { ...mockUser, role: 'support_agent' };

      await supportController.addComment(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.addComment).toHaveBeenCalledWith(
        expect.objectContaining({
          authorType: 'agent'
        })
      );
    });

    it('should handle validation errors', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'content', message: 'Content is required' }] 
      });

      await supportController.addComment(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        expect.any(Array)
      );
    });
  });

  describe('getTicketComments', () => {
    const ticketId = 'ticket123';
    const mockComments = [
      {
        _id: 'comment1',
        content: 'First comment',
        createdAt: new Date()
      },
      {
        _id: 'comment2',
        content: 'Second comment',
        createdAt: new Date()
      }
    ];

    beforeEach(() => {
      mockReq.params = { ticketId };
      mockReq.query = { includeInternal: 'true' };
      mockTicketService.getTicketComments.mockResolvedValue(mockComments as any);
    });

    it('should get ticket comments successfully', async () => {
      await supportController.getTicketComments(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.getTicketComments).toHaveBeenCalledWith(ticketId, true);
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        { comments: mockComments },
        'Comments retrieved successfully'
      );
    });

    it('should handle includeInternal parameter', async () => {
      mockReq.query = { includeInternal: 'false' };

      await supportController.getTicketComments(mockReq as AuthRequest, mockRes as Response);

      expect(mockTicketService.getTicketComments).toHaveBeenCalledWith(ticketId, false);
    });
  });

  describe('createArticle', () => {
    const articleData = {
      title: 'How to Reset Your Password',
      content: 'This article explains how to reset your password...',
      excerpt: 'Learn how to reset your password',
      category: 'Account Management',
      tags: ['password', 'reset']
    };

    const mockArticle = {
      _id: 'article123',
      ...articleData,
      authorId: mockUser._id,
      createdAt: new Date()
    };

    beforeEach(() => {
      mockReq.body = articleData;
      mockKnowledgeBaseService.createArticle.mockResolvedValue(mockArticle as any);
    });

    it('should create article successfully', async () => {
      await supportController.createArticle(mockReq as AuthRequest, mockRes as Response);

      expect(mockKnowledgeBaseService.createArticle).toHaveBeenCalledWith({
        ...articleData,
        authorId: mockUser._id
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockArticle,
        'Article created successfully',
        201
      );
    });

    it('should handle validation errors', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'title', message: 'Title is required' }] 
      });

      await supportController.createArticle(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid input data',
        400,
        expect.any(Array)
      );
    });
  });

  describe('searchArticles', () => {
    const searchQuery = 'password reset';
    const mockSearchResult = {
      articles: [
        {
          _id: 'article1',
          title: 'How to Reset Your Password',
          excerpt: 'Learn how to reset your password'
        }
      ],
      totalCount: 1,
      searchTime: 50,
      suggestions: []
    };

    beforeEach(() => {
      mockReq.query = { q: searchQuery, page: '1', limit: '10' };
      mockKnowledgeBaseService.searchArticles.mockResolvedValue(mockSearchResult as any);
    });

    it('should search articles successfully', async () => {
      await supportController.searchArticles(mockReq as AuthRequest, mockRes as Response);

      expect(mockKnowledgeBaseService.searchArticles).toHaveBeenCalledWith(
        searchQuery,
        expect.any(Object),
        expect.objectContaining({
          page: 1,
          limit: 10
        })
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockSearchResult,
        'Search completed successfully'
      );
    });

    it('should handle missing search query', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'q', message: 'Search query is required' }] 
      });

      await supportController.searchArticles(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid search parameters',
        400,
        expect.any(Array)
      );
    });
  });

  describe('getSupportMetrics', () => {
    const mockMetrics = {
      totalTickets: 100,
      openTickets: 30,
      resolvedTickets: 60,
      averageResponseTime: 4.5,
      customerSatisfactionScore: 85
    };

    beforeEach(() => {
      mockReq.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockMetricsService.getSupportKPIs.mockResolvedValue(mockMetrics as any);
    });

    it('should get support metrics successfully', async () => {
      await supportController.getSupportMetrics(mockReq as AuthRequest, mockRes as Response);

      expect(mockMetricsService.getSupportKPIs).toHaveBeenCalledWith({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockMetrics,
        'Support metrics retrieved successfully'
      );
    });

    it('should handle no time range', async () => {
      mockReq.query = {};

      await supportController.getSupportMetrics(mockReq as AuthRequest, mockRes as Response);

      expect(mockMetricsService.getSupportKPIs).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getSupportAnalytics', () => {
    const mockAnalytics = {
      timeRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      },
      kpis: {
        totalTickets: 100,
        openTickets: 30
      },
      ticketDistribution: {
        byStatus: [],
        byPriority: [],
        byCategory: []
      }
    };

    beforeEach(() => {
      mockReq.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockMetricsService.getSupportAnalytics.mockResolvedValue(mockAnalytics as any);
    });

    it('should get support analytics successfully', async () => {
      await supportController.getSupportAnalytics(mockReq as AuthRequest, mockRes as Response);

      expect(mockMetricsService.getSupportAnalytics).toHaveBeenCalledWith({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });
      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        mockAnalytics,
        'Support analytics retrieved successfully'
      );
    });

    it('should handle missing date parameters', async () => {
      (validateRequest as jest.Mock).mockResolvedValue({ 
        isValid: false, 
        errors: [{ field: 'startDate', message: 'Start date is required' }] 
      });

      await supportController.getSupportAnalytics(mockReq as AuthRequest, mockRes as Response);

      expect(sendError).toHaveBeenCalledWith(
        mockRes,
        'VALIDATION_ERROR',
        'Invalid date parameters',
        400,
        expect.any(Array)
      );
    });
  });
});