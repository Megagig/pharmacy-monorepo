import mongoose from 'mongoose';
import { SupportTicket, ISupportTicket } from '../../models/SupportTicket';

describe('SupportTicket Model', () => {
  let mockTicket: any;

  beforeEach(() => {
    mockTicket = {
      title: 'Test Support Ticket',
      description: 'This is a test support ticket description',
      status: 'open',
      priority: 'medium',
      category: 'technical',
      userId: new mongoose.Types.ObjectId(),
      userEmail: 'test@example.com',
      userName: 'John Doe',
      tags: ['test', 'support'],
      attachments: [],
      responseCount: 0
    };
  });

  describe('Schema Validation', () => {
    it('should create a valid ticket', () => {
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require title', () => {
      delete mockTicket.title;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.title).toBeDefined();
    });

    it('should require description', () => {
      delete mockTicket.description;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.description).toBeDefined();
    });

    it('should require userId', () => {
      delete mockTicket.userId;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.userId).toBeDefined();
    });

    it('should require userEmail', () => {
      delete mockTicket.userEmail;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.userEmail).toBeDefined();
    });

    it('should require userName', () => {
      delete mockTicket.userName;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.userName).toBeDefined();
    });

    it('should validate status enum', () => {
      mockTicket.status = 'invalid_status';
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.status).toBeDefined();
    });

    it('should accept valid status values', () => {
      const validStatuses = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];
      
      validStatuses.forEach(status => {
        mockTicket.status = status;
        const ticket = new SupportTicket(mockTicket);
        const validationError = ticket.validateSync();
        expect(validationError?.errors.status).toBeUndefined();
      });
    });

    it('should validate priority enum', () => {
      mockTicket.priority = 'invalid_priority';
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.priority).toBeDefined();
    });

    it('should accept valid priority values', () => {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      
      validPriorities.forEach(priority => {
        mockTicket.priority = priority;
        const ticket = new SupportTicket(mockTicket);
        const validationError = ticket.validateSync();
        expect(validationError?.errors.priority).toBeUndefined();
      });
    });

    it('should validate category enum', () => {
      mockTicket.category = 'invalid_category';
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.category).toBeDefined();
    });

    it('should accept valid category values', () => {
      const validCategories = ['technical', 'billing', 'feature_request', 'bug_report', 'general'];
      
      validCategories.forEach(category => {
        mockTicket.category = category;
        const ticket = new SupportTicket(mockTicket);
        const validationError = ticket.validateSync();
        expect(validationError?.errors.category).toBeUndefined();
      });
    });

    it('should validate title length', () => {
      mockTicket.title = 'a'.repeat(201); // Exceeds max length
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.title).toBeDefined();
    });

    it('should validate description length', () => {
      mockTicket.description = 'a'.repeat(5001); // Exceeds max length
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.description).toBeDefined();
    });

    it('should validate resolutionNotes length', () => {
      mockTicket.resolutionNotes = 'a'.repeat(2001); // Exceeds max length
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.resolutionNotes).toBeDefined();
    });

    it('should validate escalationReason length', () => {
      mockTicket.escalationReason = 'a'.repeat(501); // Exceeds max length
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.escalationReason).toBeDefined();
    });

    it('should validate customerSatisfactionRating range', () => {
      mockTicket.customerSatisfactionRating = 6; // Exceeds max
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.customerSatisfactionRating).toBeDefined();

      mockTicket.customerSatisfactionRating = 0; // Below min
      const ticket2 = new SupportTicket(mockTicket);
      const validationError2 = ticket2.validateSync();
      expect(validationError2?.errors.customerSatisfactionRating).toBeDefined();
    });

    it('should accept valid customerSatisfactionRating values', () => {
      const validRatings = [1, 2, 3, 4, 5];
      
      validRatings.forEach(rating => {
        mockTicket.customerSatisfactionRating = rating;
        const ticket = new SupportTicket(mockTicket);
        const validationError = ticket.validateSync();
        expect(validationError?.errors.customerSatisfactionRating).toBeUndefined();
      });
    });

    it('should default status to open', () => {
      delete mockTicket.status;
      const ticket = new SupportTicket(mockTicket);
      expect(ticket.status).toBe('open');
    });

    it('should default priority to medium', () => {
      delete mockTicket.priority;
      const ticket = new SupportTicket(mockTicket);
      expect(ticket.priority).toBe('medium');
    });

    it('should default responseCount to 0', () => {
      delete mockTicket.responseCount;
      const ticket = new SupportTicket(mockTicket);
      expect(ticket.responseCount).toBe(0);
    });

    it('should validate responseCount minimum', () => {
      mockTicket.responseCount = -1;
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors.responseCount).toBeDefined();
    });
  });

  describe('Pre-save Middleware', () => {
    let ticket: any;

    beforeEach(() => {
      ticket = new SupportTicket(mockTicket);
      // Mock the countDocuments method for ticket number generation
      SupportTicket.countDocuments = jest.fn().mockResolvedValue(5);
    });

    it('should generate ticket number for new tickets', async () => {
      ticket.isNew = true;
      delete ticket.ticketNumber;
      
      const nextSpy = jest.fn();
      await ticket.schema.pre('save').call(ticket, nextSpy);
      
      expect(ticket.ticketNumber).toBe('TKT-000006');
      expect(nextSpy).toHaveBeenCalled();
    });

    it('should not override existing ticket number', async () => {
      ticket.isNew = true;
      ticket.ticketNumber = 'TKT-000001';
      
      const nextSpy = jest.fn();
      await ticket.schema.pre('save').call(ticket, nextSpy);
      
      expect(ticket.ticketNumber).toBe('TKT-000001');
    });

    it('should not generate ticket number for existing tickets', async () => {
      ticket.isNew = false;
      delete ticket.ticketNumber;
      
      const nextSpy = jest.fn();
      await ticket.schema.pre('save').call(ticket, nextSpy);
      
      expect(ticket.ticketNumber).toBeUndefined();
    });
  });

  describe('Instance Methods', () => {
    let ticket: any;

    beforeEach(() => {
      ticket = new SupportTicket(mockTicket);
      ticket.createdAt = new Date('2024-01-01T10:00:00Z');
    });

    describe('getResponseTime', () => {
      it('should return null when no first response', () => {
        ticket.firstResponseAt = null;
        
        expect(ticket.getResponseTime()).toBeNull();
      });

      it('should calculate response time in hours', () => {
        ticket.firstResponseAt = new Date('2024-01-01T14:00:00Z'); // 4 hours later
        
        expect(ticket.getResponseTime()).toBe(4);
      });

      it('should round response time to nearest hour', () => {
        ticket.firstResponseAt = new Date('2024-01-01T12:30:00Z'); // 2.5 hours later
        
        expect(ticket.getResponseTime()).toBe(3); // Rounded to 3
      });
    });

    describe('getResolutionTime', () => {
      it('should return null when not resolved', () => {
        ticket.resolvedAt = null;
        
        expect(ticket.getResolutionTime()).toBeNull();
      });

      it('should calculate resolution time in hours', () => {
        ticket.resolvedAt = new Date('2024-01-02T10:00:00Z'); // 24 hours later
        
        expect(ticket.getResolutionTime()).toBe(24);
      });

      it('should round resolution time to nearest hour', () => {
        ticket.resolvedAt = new Date('2024-01-01T22:30:00Z'); // 12.5 hours later
        
        expect(ticket.getResolutionTime()).toBe(13); // Rounded to 13
      });
    });

    describe('isOverdue', () => {
      beforeEach(() => {
        // Mock current time to be 2024-01-02T10:00:00Z (24 hours after creation)
        jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-02T10:00:00Z').getTime());
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should return false for resolved tickets', () => {
        ticket.status = 'resolved';
        ticket.priority = 'critical';
        
        expect(ticket.isOverdue()).toBe(false);
      });

      it('should return false for closed tickets', () => {
        ticket.status = 'closed';
        ticket.priority = 'critical';
        
        expect(ticket.isOverdue()).toBe(false);
      });

      it('should return true for critical tickets after 4 hours', () => {
        ticket.status = 'open';
        ticket.priority = 'critical';
        // Ticket is 24 hours old, SLA is 4 hours
        
        expect(ticket.isOverdue()).toBe(true);
      });

      it('should return false for critical tickets within 4 hours', () => {
        ticket.status = 'open';
        ticket.priority = 'critical';
        ticket.createdAt = new Date('2024-01-02T08:00:00Z'); // 2 hours ago
        
        expect(ticket.isOverdue()).toBe(false);
      });

      it('should return true for high priority tickets after 24 hours', () => {
        ticket.status = 'open';
        ticket.priority = 'high';
        // Ticket is 24 hours old, SLA is 24 hours
        
        expect(ticket.isOverdue()).toBe(true);
      });

      it('should return false for medium priority tickets within 72 hours', () => {
        ticket.status = 'open';
        ticket.priority = 'medium';
        // Ticket is 24 hours old, SLA is 72 hours
        
        expect(ticket.isOverdue()).toBe(false);
      });

      it('should return false for low priority tickets within 168 hours', () => {
        ticket.status = 'open';
        ticket.priority = 'low';
        // Ticket is 24 hours old, SLA is 168 hours (1 week)
        
        expect(ticket.isOverdue()).toBe(false);
      });

      it('should handle edge case at exact SLA time', () => {
        ticket.status = 'open';
        ticket.priority = 'high';
        ticket.createdAt = new Date('2024-01-01T10:00:00Z'); // Exactly 24 hours ago
        
        expect(ticket.isOverdue()).toBe(false); // Should not be overdue at exact SLA time
      });
    });

    describe('toJSON', () => {
      it('should exclude __v field', () => {
        ticket.__v = 0;
        ticket.toObject = jest.fn().mockReturnValue({
          _id: ticket._id,
          title: ticket.title,
          __v: 0
        });
        
        const json = ticket.toJSON();
        
        expect(json.__v).toBeUndefined();
        expect(json.title).toBe(ticket.title);
      });
    });
  });

  describe('Attachments Schema', () => {
    it('should validate attachment structure', () => {
      mockTicket.attachments = [{
        filename: 'screenshot.png',
        url: 'https://example.com/screenshot.png',
        uploadedAt: new Date(),
        uploadedBy: new mongoose.Types.ObjectId()
      }];
      
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require filename in attachments', () => {
      mockTicket.attachments = [{
        url: 'https://example.com/screenshot.png',
        uploadedBy: new mongoose.Types.ObjectId()
      }];
      
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors['attachments.0.filename']).toBeDefined();
    });

    it('should require url in attachments', () => {
      mockTicket.attachments = [{
        filename: 'screenshot.png',
        uploadedBy: new mongoose.Types.ObjectId()
      }];
      
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors['attachments.0.url']).toBeDefined();
    });

    it('should require uploadedBy in attachments', () => {
      mockTicket.attachments = [{
        filename: 'screenshot.png',
        url: 'https://example.com/screenshot.png'
      }];
      
      const ticket = new SupportTicket(mockTicket);
      const validationError = ticket.validateSync();
      expect(validationError?.errors['attachments.0.uploadedBy']).toBeDefined();
    });

    it('should default uploadedAt in attachments', () => {
      mockTicket.attachments = [{
        filename: 'screenshot.png',
        url: 'https://example.com/screenshot.png',
        uploadedBy: new mongoose.Types.ObjectId()
      }];
      
      const ticket = new SupportTicket(mockTicket);
      expect(ticket.attachments[0].uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes defined', () => {
      const schema = SupportTicket.schema;
      const indexes = schema.indexes();
      
      // Check for specific indexes
      const indexPaths = indexes.map(index => Object.keys(index[0]));
      
      expect(indexPaths).toContainEqual(['ticketNumber']);
      expect(indexPaths).toContainEqual(['status']);
      expect(indexPaths).toContainEqual(['priority']);
      expect(indexPaths).toContainEqual(['category']);
      expect(indexPaths).toContainEqual(['userId']);
      expect(indexPaths).toContainEqual(['assignedTo']);
      expect(indexPaths).toContainEqual(['createdAt']);
      expect(indexPaths).toContainEqual(['resolvedAt']);
    });

    it('should have compound indexes', () => {
      const schema = SupportTicket.schema;
      const indexes = schema.indexes();
      
      const compoundIndexPaths = indexes.map(index => Object.keys(index[0]));
      
      expect(compoundIndexPaths).toContainEqual(['status', 'priority']);
      expect(compoundIndexPaths).toContainEqual(['userId', 'status']);
      expect(compoundIndexPaths).toContainEqual(['assignedTo', 'status']);
      expect(compoundIndexPaths).toContainEqual(['category', 'status']);
      expect(compoundIndexPaths).toContainEqual(['workspaceId', 'status']);
    });

    it('should have text search index', () => {
      const schema = SupportTicket.schema;
      const indexes = schema.indexes();
      
      // Look for text index
      const textIndex = indexes.find(index => 
        Object.values(index[0]).includes('text')
      );
      
      expect(textIndex).toBeDefined();
    });
  });

  describe('References', () => {
    it('should reference User model for userId', () => {
      const schema = SupportTicket.schema;
      const userIdPath = schema.path('userId');
      
      expect(userIdPath.options.ref).toBe('User');
    });

    it('should reference Workplace model for workspaceId', () => {
      const schema = SupportTicket.schema;
      const workspaceIdPath = schema.path('workspaceId');
      
      expect(workspaceIdPath.options.ref).toBe('Workplace');
    });

    it('should reference User model for assignedTo', () => {
      const schema = SupportTicket.schema;
      const assignedToPath = schema.path('assignedTo');
      
      expect(assignedToPath.options.ref).toBe('User');
    });

    it('should reference User model for resolvedBy', () => {
      const schema = SupportTicket.schema;
      const resolvedByPath = schema.path('resolvedBy');
      
      expect(resolvedByPath.options.ref).toBe('User');
    });

    it('should reference User model for escalatedBy', () => {
      const schema = SupportTicket.schema;
      const escalatedByPath = schema.path('escalatedBy');
      
      expect(escalatedByPath.options.ref).toBe('User');
    });
  });
});