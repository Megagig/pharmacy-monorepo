import mongoose from 'mongoose';
import { SupportTicketService } from '../../services/SupportTicketService';
import { SupportTicket } from '../../models/SupportTicket';
import { TicketComment } from '../../models/TicketComment';
import { User } from '../../models/User';
import { NotificationService } from '../../services/NotificationService';
import { RedisCacheService } from '../../services/RedisCacheService';

// Mock dependencies
jest.mock('../../models/SupportTicket');
jest.mock('../../models/TicketComment');
jest.mock('../../models/User');
jest.mock('../../services/NotificationService');
jest.mock('../../services/RedisCacheService');

describe('SupportTicketService', () => {
  let supportTicketService: SupportTicketService;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockCacheService: jest.Mocked<RedisCacheService>;

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user'
  };

  const mockTicketData = {
    title: 'Test Support Ticket',
    description: 'This is a test support ticket description',
    priority: 'medium' as const,
    category: 'technical' as const,
    userId: mockUser._id.toString(),
    tags: ['test', 'support']
  };

  const mockTicket = {
    _id: new mongoose.Types.ObjectId(),
    ticketNumber: 'TKT-000001',
    title: mockTicketData.title,
    description: mockTicketData.description,
    status: 'open',
    priority: mockTicketData.priority,
    category: mockTicketData.category,
    userId: mockUser._id,
    userEmail: mockUser.email,
    userName: `${mockUser.firstName} ${mockUser.lastName}`,
    tags: mockTicketData.tags,
    attachments: [],
    responseCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock NotificationService
    mockNotificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
      getInstance: jest.fn()
    } as any;
    (NotificationService.getInstance as jest.Mock).mockReturnValue(mockNotificationService);

    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      delPattern: jest.fn().mockResolvedValue(true)
    } as any;
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);

    supportTicketService = SupportTicketService.getInstance();
  });

  describe('createTicket', () => {
    beforeEach(() => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (SupportTicket as any).mockImplementation(() => mockTicket);
    });

    it('should create a support ticket successfully', async () => {
      const result = await supportTicketService.createTicket(mockTicketData);

      expect(User.findById).toHaveBeenCalledWith(mockTicketData.userId);
      expect(SupportTicket).toHaveBeenCalledWith(expect.objectContaining({
        title: mockTicketData.title,
        description: mockTicketData.description,
        priority: mockTicketData.priority,
        category: mockTicketData.category,
        userId: mockTicketData.userId,
        userEmail: mockUser.email,
        userName: `${mockUser.firstName} ${mockUser.lastName}`,
        tags: mockTicketData.tags
      }));
      expect(mockTicket.save).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should throw error if user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.createTicket(mockTicketData))
        .rejects.toThrow('Failed to create support ticket');
    });

    it('should send notifications after ticket creation', async () => {
      await supportTicketService.createTicket(mockTicketData);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTicketData.userId,
          type: 'ticket_created',
          title: 'Support Ticket Created'
        })
      );
    });

    it('should clear cache after ticket creation', async () => {
      await supportTicketService.createTicket(mockTicketData);

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('tickets:*');
    });
  });

  describe('getTickets', () => {
    const mockFilters = {
      status: ['open', 'in_progress'],
      priority: ['high', 'critical'],
      category: ['technical']
    };

    const mockPagination = {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const
    };

    const mockTickets = [mockTicket];
    const mockTotalCount = 1;

    beforeEach(() => {
      (SupportTicket.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTickets)
      });
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(mockTotalCount);
    });

    it('should return tickets with pagination', async () => {
      const result = await supportTicketService.getTickets(mockFilters, mockPagination);

      expect(result).toEqual({
        tickets: mockTickets,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: mockTotalCount,
          hasNext: false,
          hasPrev: false
        }
      });
    });

    it('should use cache when available', async () => {
      const cachedResult = { tickets: mockTickets, pagination: {} };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await supportTicketService.getTickets(mockFilters, mockPagination);

      expect(result).toEqual(cachedResult);
      expect(SupportTicket.find).not.toHaveBeenCalled();
    });

    it('should cache the result', async () => {
      await supportTicketService.getTickets(mockFilters, mockPagination);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { ttl: 300 }
      );
    });
  });

  describe('assignTicket', () => {
    const assignedToId = new mongoose.Types.ObjectId().toString();
    const assignedById = new mongoose.Types.ObjectId().toString();

    const mockAssignedUser = {
      _id: assignedToId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com'
    };

    beforeEach(() => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);
      (User.findById as jest.Mock).mockResolvedValue(mockAssignedUser);
    });

    it('should assign ticket successfully', async () => {
      const result = await supportTicketService.assignTicket(
        mockTicket._id.toString(),
        assignedToId,
        assignedById
      );

      expect(mockTicket.assignedTo).toEqual(new mongoose.Types.ObjectId(assignedToId));
      expect(mockTicket.assignedBy).toEqual(new mongoose.Types.ObjectId(assignedById));
      expect(mockTicket.assignedAt).toBeInstanceOf(Date);
      expect(mockTicket.status).toBe('in_progress');
      expect(mockTicket.save).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should throw error if ticket not found', async () => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.assignTicket(
        mockTicket._id.toString(),
        assignedToId,
        assignedById
      )).rejects.toThrow('Failed to assign ticket');
    });

    it('should throw error if assigned user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.assignTicket(
        mockTicket._id.toString(),
        assignedToId,
        assignedById
      )).rejects.toThrow('Failed to assign ticket');
    });

    it('should send notification to assigned agent', async () => {
      await supportTicketService.assignTicket(
        mockTicket._id.toString(),
        assignedToId,
        assignedById
      );

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: assignedToId,
          type: 'ticket_assigned',
          title: 'New Ticket Assigned'
        })
      );
    });
  });

  describe('updateTicketStatus', () => {
    const updatedById = new mongoose.Types.ObjectId().toString();
    const resolutionNotes = 'Issue resolved by restarting the service';

    beforeEach(() => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);
    });

    it('should update ticket status successfully', async () => {
      const result = await supportTicketService.updateTicketStatus(
        mockTicket._id.toString(),
        'resolved',
        updatedById,
        resolutionNotes
      );

      expect(mockTicket.status).toBe('resolved');
      expect(mockTicket.resolvedAt).toBeInstanceOf(Date);
      expect(mockTicket.resolvedBy).toEqual(new mongoose.Types.ObjectId(updatedById));
      expect(mockTicket.resolutionNotes).toBe(resolutionNotes);
      expect(mockTicket.save).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should throw error if ticket not found', async () => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.updateTicketStatus(
        mockTicket._id.toString(),
        'resolved',
        updatedById
      )).rejects.toThrow('Failed to update ticket status');
    });

    it('should send notification when ticket is resolved', async () => {
      await supportTicketService.updateTicketStatus(
        mockTicket._id.toString(),
        'resolved',
        updatedById,
        resolutionNotes
      );

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTicket.userId.toString(),
          type: 'ticket_resolved',
          title: 'Support Ticket Resolved'
        })
      );
    });
  });

  describe('escalateTicket', () => {
    const escalatedById = new mongoose.Types.ObjectId().toString();
    const reason = 'Customer is VIP and needs immediate attention';

    beforeEach(() => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);
    });

    it('should escalate ticket successfully', async () => {
      const result = await supportTicketService.escalateTicket(
        mockTicket._id.toString(),
        escalatedById,
        reason
      );

      expect(mockTicket.escalatedAt).toBeInstanceOf(Date);
      expect(mockTicket.escalatedBy).toEqual(new mongoose.Types.ObjectId(escalatedById));
      expect(mockTicket.escalationReason).toBe(reason);
      expect(mockTicket.priority).toBe('high'); // Should increase from medium to high
      expect(mockTicket.save).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should throw error if ticket not found', async () => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.escalateTicket(
        mockTicket._id.toString(),
        escalatedById,
        reason
      )).rejects.toThrow('Failed to escalate ticket');
    });

    it('should increase priority correctly', async () => {
      // Test low -> medium
      mockTicket.priority = 'low';
      await supportTicketService.escalateTicket(
        mockTicket._id.toString(),
        escalatedById,
        reason
      );
      expect(mockTicket.priority).toBe('medium');

      // Test high -> critical
      mockTicket.priority = 'high';
      await supportTicketService.escalateTicket(
        mockTicket._id.toString(),
        escalatedById,
        reason
      );
      expect(mockTicket.priority).toBe('critical');
    });
  });

  describe('addComment', () => {
    const commentData = {
      ticketId: mockTicket._id.toString(),
      authorId: mockUser._id.toString(),
      content: 'This is a test comment',
      authorType: 'customer' as const,
      isInternal: false
    };

    const mockComment = {
      _id: new mongoose.Types.ObjectId(),
      ...commentData,
      authorName: `${mockUser.firstName} ${mockUser.lastName}`,
      authorEmail: mockUser.email,
      attachments: [],
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(true)
    };

    beforeEach(() => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(mockTicket);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (TicketComment as any).mockImplementation(() => mockComment);
    });

    it('should add comment successfully', async () => {
      const result = await supportTicketService.addComment(commentData);

      expect(SupportTicket.findById).toHaveBeenCalledWith(commentData.ticketId);
      expect(User.findById).toHaveBeenCalledWith(commentData.authorId);
      expect(TicketComment).toHaveBeenCalledWith(expect.objectContaining({
        ticketId: commentData.ticketId,
        authorId: commentData.authorId,
        content: commentData.content,
        authorType: commentData.authorType,
        isInternal: commentData.isInternal
      }));
      expect(mockComment.save).toHaveBeenCalled();
      expect(result).toEqual(mockComment);
    });

    it('should throw error if ticket not found', async () => {
      (SupportTicket.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.addComment(commentData))
        .rejects.toThrow('Failed to add comment');
    });

    it('should throw error if author not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(supportTicketService.addComment(commentData))
        .rejects.toThrow('Failed to add comment');
    });

    it('should update ticket response tracking for agent comments', async () => {
      const agentCommentData = {
        ...commentData,
        authorType: 'agent' as const
      };

      await supportTicketService.addComment(agentCommentData);

      expect(mockTicket.firstResponseAt).toBeInstanceOf(Date);
      expect(mockTicket.lastResponseAt).toBeInstanceOf(Date);
      expect(mockTicket.responseCount).toBe(1);
      expect(mockTicket.save).toHaveBeenCalled();
    });

    it('should not send notifications for internal comments', async () => {
      const internalCommentData = {
        ...commentData,
        isInternal: true
      };

      await supportTicketService.addComment(internalCommentData);

      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('getTicketComments', () => {
    const ticketId = mockTicket._id.toString();
    const mockComments = [
      {
        _id: new mongoose.Types.ObjectId(),
        ticketId,
        content: 'First comment',
        isInternal: false,
        createdAt: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        ticketId,
        content: 'Internal note',
        isInternal: true,
        createdAt: new Date()
      }
    ];

    beforeEach(() => {
      (TicketComment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockComments)
      });
    });

    it('should return all comments when includeInternal is true', async () => {
      const result = await supportTicketService.getTicketComments(ticketId, true);

      expect(TicketComment.find).toHaveBeenCalledWith({ ticketId });
      expect(result).toEqual(mockComments);
    });

    it('should exclude internal comments when includeInternal is false', async () => {
      const result = await supportTicketService.getTicketComments(ticketId, false);

      expect(TicketComment.find).toHaveBeenCalledWith({ 
        ticketId, 
        isInternal: false 
      });
      expect(result).toEqual(mockComments);
    });
  });

  describe('getTicketMetrics', () => {
    const timeRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    beforeEach(() => {
      // Mock various aggregation queries
      (SupportTicket.countDocuments as jest.Mock).mockResolvedValue(100);
      (SupportTicket.aggregate as jest.Mock).mockResolvedValue([
        { _id: 'open', count: 30 },
        { _id: 'resolved', count: 60 },
        { _id: 'closed', count: 10 }
      ]);
    });

    it('should calculate ticket metrics correctly', async () => {
      const result = await supportTicketService.getTicketMetrics(timeRange);

      expect(result).toHaveProperty('totalTickets');
      expect(result).toHaveProperty('openTickets');
      expect(result).toHaveProperty('resolvedTickets');
      expect(result).toHaveProperty('averageResponseTime');
      expect(result).toHaveProperty('averageResolutionTime');
      expect(result).toHaveProperty('customerSatisfactionScore');
    });

    it('should use cache when available', async () => {
      const cachedMetrics = { totalTickets: 100, openTickets: 30 };
      mockCacheService.get.mockResolvedValue(cachedMetrics);

      const result = await supportTicketService.getTicketMetrics(timeRange);

      expect(result).toEqual(cachedMetrics);
      expect(SupportTicket.countDocuments).not.toHaveBeenCalled();
    });

    it('should cache the calculated metrics', async () => {
      await supportTicketService.getTicketMetrics(timeRange);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { ttl: 600 }
      );
    });
  });
});