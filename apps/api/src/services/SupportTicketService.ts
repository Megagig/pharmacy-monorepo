import mongoose from 'mongoose';
import { SupportTicket, ISupportTicket } from '../models/SupportTicket';
import { TicketComment, ITicketComment } from '../models/TicketComment';
import { User } from '../models/User';
import { NotificationService } from './SaaSNotificationService';
import { RedisCacheService } from './RedisCacheService';
import logger from '../utils/logger';

export interface TicketFilters {
  status?: string[];
  priority?: string[];
  category?: string[];
  assignedTo?: string;
  userId?: string;
  workspaceId?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  search?: string;
  tags?: string[];
}

export interface TicketPagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTickets {
  tickets: ISupportTicket[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  criticalTickets: number;
  averageResponseTime: number; // in hours
  averageResolutionTime: number; // in hours
  customerSatisfactionScore: number;
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
}

export interface EscalationRule {
  priority: 'low' | 'medium' | 'high' | 'critical';
  hoursWithoutResponse: number;
  escalateTo: string; // Role or specific user ID
}

/**
 * SupportTicketService - Handles support ticket management
 * Provides ticket creation, assignment, tracking, and escalation workflows
 */
export class SupportTicketService {
  private static instance: SupportTicketService;
  private notificationService: NotificationService;
  private cacheService: RedisCacheService;
  private readonly CACHE_TTL = 5 * 60; // 5 minutes

  // Default escalation rules
  private readonly escalationRules: EscalationRule[] = [
    { priority: 'critical', hoursWithoutResponse: 1, escalateTo: 'super_admin' },
    { priority: 'high', hoursWithoutResponse: 4, escalateTo: 'admin' },
    { priority: 'medium', hoursWithoutResponse: 24, escalateTo: 'admin' },
    { priority: 'low', hoursWithoutResponse: 72, escalateTo: 'admin' }
  ];

  constructor() {
    this.notificationService = NotificationService.getInstance();
    this.cacheService = RedisCacheService.getInstance();
  }

  public static getInstance(): SupportTicketService {
    if (!SupportTicketService.instance) {
      SupportTicketService.instance = new SupportTicketService();
    }
    return SupportTicketService.instance;
  }

  /**
   * Generate unique ticket number
   */
  private async generateTicketNumber(): Promise<string> {
    try {
      logger.info('Starting ticket number generation');
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const count = await SupportTicket.countDocuments();
        const ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
        
        logger.info(`Attempt ${attempts + 1}: Generated ticket number ${ticketNumber} (count: ${count})`);
        
        // Check if this ticket number already exists
        const existingTicket = await SupportTicket.findOne({ ticketNumber });
        
        if (!existingTicket) {
          logger.info(`Ticket number ${ticketNumber} is unique, using it`);
          return ticketNumber;
        }
        
        logger.warn(`Ticket number ${ticketNumber} already exists, retrying`);
        attempts++;
      }
      
      // Fallback to timestamp-based approach
      const timestamp = Date.now().toString().slice(-6);
      const fallbackNumber = `TKT-${timestamp}`;
      logger.warn(`Using fallback ticket number: ${fallbackNumber}`);
      return fallbackNumber;
    } catch (error) {
      logger.error('Error generating ticket number:', error);
      // Ultimate fallback
      const timestamp = Date.now().toString().slice(-6);
      const ultimateFallback = `TKT-${timestamp}`;
      logger.error(`Using ultimate fallback ticket number: ${ultimateFallback}`);
      return ultimateFallback;
    }
  }

  /**
   * Create a new support ticket
   */
  async createTicket(ticketData: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'general';
    userId: string;
    workspaceId?: string;
    tags?: string[];
    attachments?: { filename: string; url: string }[];
  }): Promise<ISupportTicket> {
    try {
      logger.info('Starting ticket creation process', { userId: ticketData.userId, title: ticketData.title });
      
      // Get user information
      const user = await User.findById(ticketData.userId);
      if (!user) {
        logger.error('User not found', { userId: ticketData.userId });
        throw new Error('User not found');
      }
      
      logger.info('User found', { userId: ticketData.userId, userEmail: user.email });

      // Generate ticket number
      logger.info('Generating ticket number...');
      let ticketNumber;
      try {
        ticketNumber = await this.generateTicketNumber();
        logger.info('Ticket number generated', { ticketNumber });
      } catch (error) {
        logger.error('Failed to generate ticket number, using fallback', error);
        // Fallback ticket number generation
        const timestamp = Date.now().toString().slice(-6);
        ticketNumber = `TKT-${timestamp}`;
        logger.info('Using fallback ticket number', { ticketNumber });
      }

      // Create ticket data
      const ticketCreateData = {
        ticketNumber,
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        category: ticketData.category,
        userId: ticketData.userId,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        workspaceId: ticketData.workspaceId,
        tags: ticketData.tags || [],
        attachments: ticketData.attachments?.map(att => ({
          ...att,
          uploadedAt: new Date(),
          uploadedBy: ticketData.userId
        })) || []
      };
      
      logger.info('Creating ticket with data', { ticketCreateData: { ...ticketCreateData, description: ticketCreateData.description.substring(0, 50) + '...' } });

      // Create ticket
      const ticket = new SupportTicket(ticketCreateData);
      
      // Ensure ticket number is set
      if (!ticket.ticketNumber) {
        const fallbackNumber = `TKT-${Date.now().toString().slice(-6)}`;
        ticket.ticketNumber = fallbackNumber;
        logger.warn('Ticket number was not set, using fallback', { fallbackNumber });
      }

      // Validate before saving
      logger.info('Validating ticket...');
      const validationError = ticket.validateSync();
      if (validationError) {
        logger.error('Ticket validation failed', { validationError: validationError.errors });
        throw new Error(`Validation failed: ${Object.keys(validationError.errors).join(', ')}`);
      }

      logger.info('Saving ticket to database...');
      await ticket.save();
      logger.info('Ticket saved successfully', { ticketId: ticket._id, ticketNumber: ticket.ticketNumber });

      // Auto-assign based on category and priority
      await this.autoAssignTicket(ticket);

      // Send notifications (non-blocking)
      this.sendTicketCreatedNotifications(ticket).catch(error => {
        logger.error('Error sending ticket created notifications:', error);
      });

      // Clear cache
      await this.clearTicketCache();

      logger.info('Support ticket created', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        userId: ticketData.userId,
        priority: ticketData.priority
      });

      return ticket;
    } catch (error: any) {
      logger.error('Error creating support ticket:', error);
      
      // Provide more specific error messages
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message);
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      if (error.message === 'User not found') {
        throw new Error('User not found. Please ensure you are logged in.');
      }
      
      if (error.message.includes('ticketNumber')) {
        throw new Error('Unable to generate ticket number. Please try again.');
      }
      
      throw new Error(error.message || 'Failed to create support ticket');
    }
  }

  /**
   * Get tickets with filtering and pagination
   */
  async getTickets(filters: TicketFilters, pagination: TicketPagination): Promise<PaginatedTickets> {
    try {
      const cacheKey = `tickets:${JSON.stringify(filters)}:${JSON.stringify(pagination)}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      // Build query
      const query = this.buildTicketQuery(filters);

      // Build sort
      const sort: any = {};
      if (pagination.sortBy) {
        sort[pagination.sortBy] = pagination.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Default sort by newest first
      }

      // Execute query with pagination
      const skip = (pagination.page - 1) * pagination.limit;

      const [tickets, totalCount] = await Promise.all([
        SupportTicket.find(query)
          .sort(sort)
          .skip(skip)
          .limit(pagination.limit)
          .populate('assignedTo', 'firstName lastName email')
          .populate('resolvedBy', 'firstName lastName email')
          .lean(),
        SupportTicket.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / pagination.limit);

      const result = {
        tickets: tickets as ISupportTicket[],
        pagination: {
          currentPage: pagination.page,
          totalPages,
          totalCount,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        }
      };

      // Cache result
      await this.cacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

      return result;
    } catch (error) {
      logger.error('Error fetching tickets:', error);
      throw new Error('Failed to fetch tickets');
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<ISupportTicket | null> {
    try {
      const ticket = await SupportTicket.findById(ticketId)
        .populate('assignedTo', 'firstName lastName email role')
        .populate('resolvedBy', 'firstName lastName email')
        .populate('escalatedBy', 'firstName lastName email');

      return ticket;
    } catch (error) {
      logger.error('Error fetching ticket by ID:', error);
      throw new Error('Failed to fetch ticket');
    }
  }

  /**
   * Assign ticket to agent
   */
  async assignTicket(ticketId: string, assignedToId: string, assignedById: string): Promise<ISupportTicket> {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const assignedTo = await User.findById(assignedToId);
      if (!assignedTo) {
        throw new Error('Assigned user not found');
      }

      // Update ticket
      ticket.assignedTo = new mongoose.Types.ObjectId(assignedToId);
      ticket.assignedBy = new mongoose.Types.ObjectId(assignedById);
      ticket.assignedAt = new Date();

      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }

      await ticket.save();

      // Add system comment
      await this.addComment({
        ticketId,
        authorId: assignedById,
        content: `Ticket assigned to ${assignedTo.firstName} ${assignedTo.lastName}`,
        authorType: 'system',
        isInternal: true
      });

      // Send notification to assigned agent (non-blocking)
      try {
        await this.notificationService.sendNotification(
          assignedToId,
          "notification-template",
          "email",
          {
            type: 'ticket_assigned',
            title: 'New Ticket Assigned',
            message: `You have been assigned ticket ${ticket.ticketNumber}: ${ticket.title}`,
            data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
          }
        );
      } catch (notificationError) {
        logger.warn('Failed to send assignment notification, but ticket was assigned successfully', {
          ticketId,
          assignedTo: assignedToId,
          error: notificationError.message
        });
      }

      // Clear cache
      await this.clearTicketCache();

      logger.info('Ticket assigned', {
        ticketId,
        assignedTo: assignedToId,
        assignedBy: assignedById
      });

      return ticket;
    } catch (error) {
      logger.error('Error assigning ticket:', error);
      throw new Error('Failed to assign ticket');
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed',
    updatedById: string,
    resolutionNotes?: string
  ): Promise<ISupportTicket> {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const oldStatus = ticket.status;
      ticket.status = status;

      // Handle resolution
      if (status === 'resolved' && oldStatus !== 'resolved') {
        ticket.resolvedAt = new Date();
        ticket.resolvedBy = new mongoose.Types.ObjectId(updatedById);
        if (resolutionNotes) {
          ticket.resolutionNotes = resolutionNotes;
        }
      }

      await ticket.save();

      // Add system comment
      await this.addComment({
        ticketId,
        authorId: updatedById,
        content: `Ticket status changed from ${oldStatus} to ${status}${resolutionNotes ? `. Resolution notes: ${resolutionNotes}` : ''}`,
        authorType: 'system',
        isInternal: true
      });

      // Send notifications (non-blocking)
      if (status === 'resolved') {
        this.sendTicketResolvedNotifications(ticket).catch(error => {
          logger.error('Error sending ticket resolved notifications:', error);
        });
      }

      // Clear cache
      await this.clearTicketCache();

      logger.info('Ticket status updated', {
        ticketId,
        oldStatus,
        newStatus: status,
        updatedBy: updatedById
      });

      return ticket;
    } catch (error) {
      logger.error('Error updating ticket status:', error);
      throw new Error('Failed to update ticket status');
    }
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(ticketId: string, escalatedById: string, reason: string): Promise<ISupportTicket> {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      ticket.escalatedAt = new Date();
      ticket.escalatedBy = new mongoose.Types.ObjectId(escalatedById);
      ticket.escalationReason = reason;
      ticket.priority = ticket.priority === 'low' ? 'medium' :
        ticket.priority === 'medium' ? 'high' : 'critical';

      await ticket.save();

      // Add system comment
      await this.addComment({
        ticketId,
        authorId: escalatedById,
        content: `Ticket escalated. Reason: ${reason}`,
        authorType: 'system',
        isInternal: true
      });

      // Reassign to higher level support
      await this.autoAssignTicket(ticket);

      // Send escalation notifications (non-blocking)
      this.sendTicketEscalatedNotifications(ticket, reason).catch(error => {
        logger.error('Error sending ticket escalated notifications:', error);
      });

      // Clear cache
      await this.clearTicketCache();

      logger.info('Ticket escalated', {
        ticketId,
        escalatedBy: escalatedById,
        reason,
        newPriority: ticket.priority
      });

      return ticket;
    } catch (error) {
      logger.error('Error escalating ticket:', error);
      throw new Error('Failed to escalate ticket');
    }
  }

  /**
   * Add comment to ticket
   */
  async addComment(commentData: {
    ticketId: string;
    authorId: string;
    content: string;
    authorType: 'customer' | 'agent' | 'system';
    isInternal?: boolean;
    attachments?: { filename: string; url: string }[];
  }): Promise<ITicketComment> {
    try {
      const ticket = await SupportTicket.findById(commentData.ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      const author = await User.findById(commentData.authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      const comment = new TicketComment({
        ticketId: commentData.ticketId,
        authorId: commentData.authorId,
        authorName: `${author.firstName} ${author.lastName}`,
        authorEmail: author.email,
        authorType: commentData.authorType,
        content: commentData.content,
        isInternal: commentData.isInternal || false,
        attachments: commentData.attachments || []
      });

      await comment.save();

      // Update ticket response tracking
      if (commentData.authorType === 'agent' && !commentData.isInternal) {
        if (!ticket.firstResponseAt) {
          ticket.firstResponseAt = new Date();
        }
        ticket.lastResponseAt = new Date();
        ticket.responseCount += 1;
        await ticket.save();
      }

      // Send notifications for non-internal comments
      if (!commentData.isInternal) {
        await this.sendCommentNotifications(ticket, comment);
      }

      // Clear cache
      await this.clearTicketCache();

      logger.info('Comment added to ticket', {
        ticketId: commentData.ticketId,
        commentId: comment._id,
        authorId: commentData.authorId,
        authorType: commentData.authorType
      });

      return comment;
    } catch (error) {
      logger.error('Error adding comment to ticket:', error);
      throw new Error('Failed to add comment');
    }
  }

  /**
   * Get ticket comments
   */
  async getTicketComments(ticketId: string, includeInternal: boolean = false): Promise<ITicketComment[]> {
    try {
      const query: any = { ticketId };
      if (!includeInternal) {
        query.isInternal = false;
      }

      const comments = await TicketComment.find(query)
        .sort({ createdAt: 1 })
        .populate('authorId', 'firstName lastName email role');

      return comments;
    } catch (error) {
      logger.error('Error fetching ticket comments:', error);
      throw new Error('Failed to fetch ticket comments');
    }
  }

  /**
   * Get ticket metrics
   */
  async getTicketMetrics(timeRange?: { startDate: Date; endDate: Date }): Promise<TicketMetrics> {
    try {
      const cacheKey = `ticket:metrics:${timeRange ? `${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}` : 'all'}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const dateFilter = timeRange ? {
        createdAt: {
          $gte: timeRange.startDate,
          $lte: timeRange.endDate
        }
      } : {};

      // Parallel execution of metric calculations
      const [
        totalTickets,
        statusCounts,
        priorityCounts,
        categoryCounts,
        responseTimeStats,
        resolutionTimeStats,
        satisfactionStats
      ] = await Promise.all([
        SupportTicket.countDocuments(dateFilter),
        this.getTicketCountsByField('status', dateFilter),
        this.getTicketCountsByField('priority', dateFilter),
        this.getTicketCountsByField('category', dateFilter),
        this.getAverageResponseTime(dateFilter),
        this.getAverageResolutionTime(dateFilter),
        this.getCustomerSatisfactionScore(dateFilter)
      ]);

      const metrics: TicketMetrics = {
        totalTickets,
        openTickets: statusCounts.find(s => s.status === 'open')?.count || 0,
        resolvedTickets: statusCounts.find(s => s.status === 'resolved')?.count || 0,
        criticalTickets: priorityCounts.find(p => p.priority === 'critical')?.count || 0,
        averageResponseTime: responseTimeStats,
        averageResolutionTime: resolutionTimeStats,
        customerSatisfactionScore: satisfactionStats,
        ticketsByStatus: statusCounts,
        ticketsByPriority: priorityCounts,
        ticketsByCategory: categoryCounts
      };

      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, metrics, { ttl: 600 });

      return metrics;
    } catch (error) {
      logger.error('Error calculating ticket metrics:', error);
      throw new Error('Failed to calculate ticket metrics');
    }
  }

  /**
   * Check for tickets that need escalation
   */
  async checkEscalationNeeded(): Promise<void> {
    try {
      const now = new Date();

      for (const rule of this.escalationRules) {
        const cutoffTime = new Date(now.getTime() - (rule.hoursWithoutResponse * 60 * 60 * 1000));

        const ticketsToEscalate = await SupportTicket.find({
          priority: rule.priority,
          status: { $in: ['open', 'in_progress'] },
          escalatedAt: { $exists: false },
          $or: [
            { firstResponseAt: { $exists: false }, createdAt: { $lte: cutoffTime } },
            { lastResponseAt: { $lte: cutoffTime } }
          ]
        });

        for (const ticket of ticketsToEscalate) {
          await this.escalateTicket(
            ticket._id.toString(),
            'system',
            `Automatic escalation: No response within ${rule.hoursWithoutResponse} hours`
          );
        }
      }
    } catch (error) {
      logger.error('Error checking escalation:', error);
    }
  }

  // Private helper methods

  private buildTicketQuery(filters: TicketFilters): any {
    const query: any = {};

    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    if (filters.priority && filters.priority.length > 0) {
      query.priority = { $in: filters.priority };
    }

    if (filters.category && filters.category.length > 0) {
      query.category = { $in: filters.category };
    }

    if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.workspaceId) {
      query.workspaceId = filters.workspaceId;
    }

    if (filters.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.startDate,
        $lte: filters.dateRange.endDate
      };
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    return query;
  }

  private async autoAssignTicket(ticket: ISupportTicket): Promise<void> {
    try {
      // Simple auto-assignment logic based on category and priority
      // In a real implementation, this would be more sophisticated

      let targetRole = 'support_agent';

      if (ticket.priority === 'critical') {
        targetRole = 'senior_support_agent';
      }

      if (ticket.category === 'technical') {
        targetRole = 'technical_support';
      }

      // Find available agent with the target role
      const availableAgent = await User.findOne({
        role: targetRole,
        isActive: true
      }).sort({ lastLoginAt: -1 });

      if (availableAgent) {
        ticket.assignedTo = availableAgent._id;
        ticket.assignedAt = new Date();
        ticket.status = 'in_progress';
        await ticket.save();
      }
    } catch (error) {
      logger.error('Error auto-assigning ticket:', error);
    }
  }

  private async sendTicketCreatedNotifications(ticket: ISupportTicket): Promise<void> {
    try {
      // Notify customer - wrap in try-catch to prevent notification errors from affecting ticket creation
      try {
        await this.notificationService.sendNotification(
          ticket.userId.toString(),
          "notification-template",
          "email",
          {
            type: 'ticket_created',
            title: 'Support Ticket Created',
            message: `Your support ticket ${ticket.ticketNumber} has been created and will be reviewed shortly.`,
            data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
          });
      } catch (notificationError) {
        logger.warn('Failed to send customer notification, but ticket was created successfully', {
          ticketId: ticket._id,
          error: notificationError.message
        });
      }

      // Notify assigned agent if auto-assigned
      if (ticket.assignedTo) {
        try {
          await this.notificationService.sendNotification(
            ticket.assignedTo.toString(),
            "notification-template",
            "email",
            {
              type: 'ticket_assigned',
              title: 'New Ticket Assigned',
              message: `You have been assigned ticket ${ticket.ticketNumber}: ${ticket.title}`,
              data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
            });
        } catch (notificationError) {
          logger.warn('Failed to send agent notification, but ticket was created successfully', {
            ticketId: ticket._id,
            assignedTo: ticket.assignedTo,
            error: notificationError.message
          });
        }
      }
    } catch (error) {
      logger.error('Error sending ticket created notifications:', error);
    }
  }

  private async sendTicketResolvedNotifications(ticket: ISupportTicket): Promise<void> {
    try {
      await this.notificationService.sendNotification(
        ticket.userId.toString(),
        "notification-template",
        "email",
        {
          type: 'ticket_resolved',
          title: 'Support Ticket Resolved',
          message: `Your support ticket ${ticket.ticketNumber} has been resolved. Please rate your experience.`,
          data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
        });
    } catch (error) {
      logger.error('Error sending ticket resolved notifications:', error);
    }
  }

  private async sendTicketEscalatedNotifications(ticket: ISupportTicket, reason: string): Promise<void> {
    try {
      // Notify customer
      await this.notificationService.sendNotification(
        ticket.userId.toString(),
        "notification-template",
        "email",
        {
          type: 'ticket_escalated',
          title: 'Support Ticket Escalated',
          message: `Your support ticket ${ticket.ticketNumber} has been escalated for priority handling.`,
          data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
        });

      // Notify management
      const managers = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true });
      for (const manager of managers) {
        await this.notificationService.sendNotification(
          manager._id.toString(),
          "notification-template",
          "email",
          {
            type: 'ticket_escalated',
            title: 'Ticket Escalated',
            message: `Ticket ${ticket.ticketNumber} has been escalated. Reason: ${reason}`,
            data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber }
          });
      }
    } catch (error) {
      logger.error('Error sending ticket escalated notifications:', error);
    }
  }

  private async sendCommentNotifications(ticket: ISupportTicket, comment: ITicketComment): Promise<void> {
    try {
      const targetUserId = comment.authorType === 'customer' ?
        (ticket.assignedTo?.toString() || '') :
        ticket.userId.toString();

      if (targetUserId) {
        await this.notificationService.sendNotification(
          targetUserId,
          "notification-template",
          "email",
          {
            type: 'ticket_comment',
            title: 'New Comment on Ticket',
            message: `New comment added to ticket ${ticket.ticketNumber}`,
            data: { ticketId: ticket._id, ticketNumber: ticket.ticketNumber, commentId: comment._id }
          });
      }
    } catch (error) {
      logger.error('Error sending comment notifications:', error);
    }
  }

  private async getTicketCountsByField(field: string, dateFilter: any): Promise<any[]> {
    const result = await SupportTicket.aggregate([
      { $match: dateFilter },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $project: { [field]: '$_id', count: 1, _id: 0 } }
    ]);
    return result;
  }

  private async getAverageResponseTime(dateFilter: any): Promise<number> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          firstResponseAt: { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$firstResponseAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    return result.length > 0 ? Math.round(result[0].avgResponseTime) : 0;
  }

  private async getAverageResolutionTime(dateFilter: any): Promise<number> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      }
    ]);

    return result.length > 0 ? Math.round(result[0].avgResolutionTime) : 0;
  }

  private async getCustomerSatisfactionScore(dateFilter: any): Promise<number> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          ...dateFilter,
          customerSatisfactionRating: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgSatisfaction: { $avg: '$customerSatisfactionRating' }
        }
      }
    ]);

    return result.length > 0 ? Math.round(result[0].avgSatisfaction * 20) : 0; // Convert 1-5 scale to percentage
  }

  private async clearTicketCache(): Promise<void> {
    try {
      await this.cacheService.delPattern('tickets:*');
      await this.cacheService.delPattern('ticket:metrics:*');
    } catch (error) {
      logger.error('Error clearing ticket cache:', error);
    }
  }
}

export default SupportTicketService;