import mongoose from 'mongoose';
import { NotificationTemplate, INotificationTemplate } from '../../models/NotificationTemplate';

describe('NotificationTemplate Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await NotificationTemplate.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid NotificationTemplate', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const template = new NotificationTemplate({
        name: 'Welcome Email',
        channel: 'email',
        category: 'user',
        content: {
          subject: 'Welcome to {{appName}}!',
          body: 'Hello {{firstName}}, welcome to our platform!',
          htmlBody: '<h1>Welcome!</h1><p>Hello {{firstName}}, welcome to our platform!</p>',
        },
        variables: [
          { name: 'firstName', type: 'string', required: true },
          { name: 'appName', type: 'string', required: true, defaultValue: 'PharmacyCopilot' },
        ],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });

      const savedTemplate = await template.save();
      
      expect(savedTemplate._id).toBeDefined();
      expect(savedTemplate.name).toBe('Welcome Email');
      expect(savedTemplate.version).toBe(1);
      expect(savedTemplate.usageCount).toBe(0);
      expect(savedTemplate.isActive).toBe(true);
    });

    it('should require mandatory fields', async () => {
      const incompleteTemplate = new NotificationTemplate({
        name: 'Test Template',
        // Missing required fields
      });

      await expect(incompleteTemplate.save()).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidTemplate = new NotificationTemplate({
        name: 'Invalid Template',
        channel: 'invalid_channel' as any,
        category: 'user',
        content: {
          body: 'Test content',
        },
        variables: [],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });

      await expect(invalidTemplate.save()).rejects.toThrow();
    });

    it('should enforce unique name per workspace', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const workspaceId = new mongoose.Types.ObjectId();
      
      const template1 = new NotificationTemplate({
        name: 'Duplicate Name',
        workspaceId,
        channel: 'email',
        category: 'user',
        content: { body: 'Content 1' },
        variables: [],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });
      
      await template1.save();

      const template2 = new NotificationTemplate({
        name: 'Duplicate Name',
        workspaceId,
        channel: 'sms',
        category: 'user',
        content: { body: 'Content 2' },
        variables: [],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });

      await expect(template2.save()).rejects.toThrow();
    });
  });

  describe('Template Rendering', () => {
    let template: INotificationTemplate;
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      template = new NotificationTemplate({
        name: 'Test Template',
        channel: 'email',
        category: 'user',
        content: {
          subject: 'Hello {{firstName}} from {{appName}}',
          body: 'Welcome {{firstName}}! {{#if isPremium}}You have premium access.{{/if}}\n\nYour items:\n{{#each items}}- {{name}}: {{price}}{{/each}}',
          htmlBody: '<h1>Hello {{firstName}}</h1><p>Welcome to {{appName}}!</p>',
        },
        variables: [
          { name: 'firstName', type: 'string', required: true },
          { name: 'appName', type: 'string', required: true, defaultValue: 'PharmacyCopilot' },
          { name: 'isPremium', type: 'boolean', required: false },
          { name: 'items', type: 'array', required: false },
        ],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });
      
      await template.save();
    });

    it('should render template with variables', () => {
      const variables = {
        firstName: 'John',
        appName: 'TestApp',
        isPremium: true,
        items: [
          { name: 'Item 1', price: '$10' },
          { name: 'Item 2', price: '$20' },
        ],
      };

      const rendered = template.render(variables);
      
      expect(rendered.subject).toBe('Hello John from TestApp');
      expect(rendered.body).toContain('Welcome John!');
      expect(rendered.body).toContain('You have premium access.');
      expect(rendered.body).toContain('- Item 1: $10');
      expect(rendered.body).toContain('- Item 2: $20');
      expect(rendered.htmlBody).toBe('<h1>Hello John</h1><p>Welcome to TestApp!</p>');
    });

    it('should use default values for missing variables', () => {
      const variables = {
        firstName: 'Jane',
        // appName missing, should use default
      };

      const rendered = template.render(variables);
      
      expect(rendered.subject).toBe('Hello Jane from PharmacyCopilot');
    });

    it('should handle conditional blocks correctly', () => {
      const variables = {
        firstName: 'John',
        isPremium: false,
      };

      const rendered = template.render(variables);
      
      expect(rendered.body).not.toContain('You have premium access.');
    });

    it('should handle empty arrays in loops', () => {
      const variables = {
        firstName: 'John',
        items: [],
      };

      const rendered = template.render(variables);
      
      expect(rendered.body).toContain('Your items:\n'); // Should not have any items listed
    });

    it('should validate variables correctly', () => {
      const validVariables = {
        firstName: 'John',
        appName: 'TestApp',
        isPremium: true,
        items: [{ name: 'Item 1' }],
      };

      const validation = template.validateVariables(validVariables);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const invalidVariables = {
        // firstName missing (required)
        appName: 'TestApp',
      };

      const validation = template.validateVariables(invalidVariables);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Required variable 'firstName' is missing");
    });

    it('should detect wrong variable types', () => {
      const invalidVariables = {
        firstName: 123, // Should be string
        appName: 'TestApp',
        isPremium: 'yes', // Should be boolean
      };

      const validation = template.validateVariables(invalidVariables);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Variable 'firstName' must be of type 'string'");
      expect(validation.errors).toContain("Variable 'isPremium' must be of type 'boolean'");
    });
  });

  describe('Version Management', () => {
    let template: INotificationTemplate;
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      template = new NotificationTemplate({
        name: 'Versioned Template',
        channel: 'email',
        category: 'user',
        content: {
          subject: 'Version 1',
          body: 'Original content',
        },
        variables: [],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });
      
      await template.save();
    });

    it('should create new version correctly', () => {
      const newContent = {
        subject: 'Version 2',
        body: 'Updated content',
      };

      template.createNewVersion(newContent, adminId);
      
      expect(template.version).toBe(2);
      expect(template.content.subject).toBe('Version 2');
      expect(template.previousVersions).toHaveLength(1);
      expect(template.previousVersions[0].version).toBe(1);
      expect(template.previousVersions[0].content.subject).toBe('Version 1');
    });

    it('should limit version history to 10 versions', () => {
      // Create 12 versions
      for (let i = 2; i <= 12; i++) {
        const newContent = {
          subject: `Version ${i}`,
          body: `Content ${i}`,
        };
        template.createNewVersion(newContent, adminId);
      }
      
      expect(template.version).toBe(12);
      expect(template.previousVersions).toHaveLength(10);
      expect(template.previousVersions[0].version).toBe(2); // Version 1 should be removed
    });
  });

  describe('Usage Tracking', () => {
    let template: INotificationTemplate;
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      template = new NotificationTemplate({
        name: 'Usage Template',
        channel: 'email',
        category: 'user',
        content: { body: 'Test content' },
        variables: [],
        createdBy: adminId,
        lastModifiedBy: adminId,
      });
      
      await template.save();
    });

    it('should increment usage count', () => {
      expect(template.usageCount).toBe(0);
      expect(template.lastUsed).toBeUndefined();
      
      template.incrementUsage();
      
      expect(template.usageCount).toBe(1);
      expect(template.lastUsed).toBeDefined();
    });

    it('should handle approval correctly', () => {
      const approverId = new mongoose.Types.ObjectId();
      
      expect(template.approvedBy).toBeUndefined();
      expect(template.approvedAt).toBeUndefined();
      
      template.approve(approverId);
      
      expect(template.approvedBy?.toString()).toBe(approverId.toString());
      expect(template.approvedAt).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    const adminId = new mongoose.Types.ObjectId();
    const workspaceId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      // Create default templates
      await NotificationTemplate.createDefaultTemplates(undefined, adminId);
      
      // Create workspace-specific template
      await NotificationTemplate.create({
        name: 'Workspace Template',
        workspaceId,
        channel: 'email',
        category: 'user',
        content: { body: 'Workspace content' },
        variables: [],
        usageCount: 50,
        createdBy: adminId,
        lastModifiedBy: adminId,
      });
    });

    it('should find templates by channel and category', async () => {
      const templates = await NotificationTemplate.findByChannelAndCategory('email', 'user', workspaceId);
      
      expect(templates.length).toBeGreaterThan(0);
      // Should include both workspace and default templates
    });

    it('should find default template', async () => {
      const defaultTemplate = await NotificationTemplate.findDefaultTemplate('email', 'user');
      
      expect(defaultTemplate).toBeDefined();
      expect(defaultTemplate?.isDefault).toBe(true);
      expect(defaultTemplate?.workspaceId).toBeNull();
    });

    it('should get popular templates', async () => {
      const popularTemplates = await NotificationTemplate.getPopularTemplates(workspaceId, 5);
      
      expect(popularTemplates).toBeDefined();
      expect(popularTemplates.length).toBeGreaterThan(0);
      // Should be sorted by usage count
      if (popularTemplates.length > 1) {
        expect(popularTemplates[0].usageCount).toBeGreaterThanOrEqual(popularTemplates[1].usageCount);
      }
    });

    it('should create default templates', async () => {
      await NotificationTemplate.deleteMany({});
      
      const templates = await NotificationTemplate.createDefaultTemplates(undefined, adminId);
      
      expect(templates).toHaveLength(3);
      expect(templates.every(t => t.isDefault)).toBe(true);
      expect(templates.every(t => t.workspaceId === undefined)).toBe(true);
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await NotificationTemplate.collection.getIndexes();
      
      expect(indexes).toHaveProperty('channel_1_category_1_isActive_1');
      expect(indexes).toHaveProperty('workspaceId_1_isActive_1');
      expect(indexes).toHaveProperty('name_1_workspaceId_1');
    });
  });
});