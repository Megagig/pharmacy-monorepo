import mongoose from 'mongoose';
import DeveloperPortalService from '../../services/DeveloperPortalService';
import DeveloperAccount from '../../models/DeveloperAccount';
import ApiDocumentation from '../../models/ApiDocumentation';
import SandboxSession from '../../models/SandboxSession';
import ApiEndpoint from '../../models/ApiEndpoint';

describe('DeveloperPortalService', () => {
  let userId: mongoose.Types.ObjectId;
  let developerId: mongoose.Types.ObjectId;
  let endpointId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    userId = new mongoose.Types.ObjectId();
    developerId = new mongoose.Types.ObjectId();
    endpointId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await DeveloperAccount.deleteMany({});
    await ApiDocumentation.deleteMany({});
    await SandboxSession.deleteMany({});
    await ApiEndpoint.deleteMany({});
  });

  describe('Developer Account Management', () => {
    it('should create new developer account', async () => {
      const accountData = {
        companyName: 'Test Company',
        contactEmail: 'test@example.com',
        description: 'Test description'
      };

      const account = await DeveloperPortalService.createOrUpdateDeveloperAccount(
        userId.toString(),
        accountData
      );

      expect(account._id).toBeDefined();
      expect(account.userId).toEqual(userId);
      expect(account.companyName).toBe(accountData.companyName);
      expect(account.contactEmail).toBe(accountData.contactEmail);
    });

    it('should update existing developer account', async () => {
      // Create initial account
      const initialAccount = await DeveloperAccount.create({
        userId,
        contactEmail: 'initial@example.com',
        companyName: 'Initial Company'
      });

      const updateData = {
        companyName: 'Updated Company',
        description: 'Updated description'
      };

      const updatedAccount = await DeveloperPortalService.createOrUpdateDeveloperAccount(
        userId.toString(),
        updateData
      );

      expect(updatedAccount._id.toString()).toBe(initialAccount._id.toString());
      expect(updatedAccount.companyName).toBe(updateData.companyName);
      expect(updatedAccount.description).toBe(updateData.description);
      expect(updatedAccount.contactEmail).toBe('initial@example.com'); // Should remain unchanged
    });

    it('should get developer account by user ID', async () => {
      const accountData = {
        userId,
        contactEmail: 'test@example.com',
        companyName: 'Test Company'
      };

      await DeveloperAccount.create(accountData);

      const account = await DeveloperPortalService.getDeveloperAccountByUserId(userId.toString());

      expect(account).toBeDefined();
      expect(account!.userId).toEqual(userId);
      expect(account!.companyName).toBe(accountData.companyName);
    });

    it('should return null for non-existent account', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const account = await DeveloperPortalService.getDeveloperAccountByUserId(
        nonExistentUserId.toString()
      );

      expect(account).toBeNull();
    });

    it('should get developer accounts with filtering', async () => {
      const accounts = [
        {
          userId: new mongoose.Types.ObjectId(),
          contactEmail: 'user1@example.com',
          companyName: 'Company A',
          subscriptionTier: 'free',
          status: 'active'
        },
        {
          userId: new mongoose.Types.ObjectId(),
          contactEmail: 'user2@example.com',
          companyName: 'Company B',
          subscriptionTier: 'pro',
          status: 'pending'
        }
      ];

      await DeveloperAccount.insertMany(accounts);

      const result = await DeveloperPortalService.getDeveloperAccounts({
        status: 'active'
      });

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].companyName).toBe('Company A');
      expect(result.total).toBe(1);
    });
  });

  describe('Account Verification', () => {
    it('should generate verification token', async () => {
      const account = await DeveloperAccount.create({
        userId,
        contactEmail: 'test@example.com'
      });

      const token = await DeveloperPortalService.generateVerificationToken(userId.toString());

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes as hex

      const updatedAccount = await DeveloperAccount.findById(account._id);
      expect(updatedAccount!.verificationToken).toBe(token);
      expect(updatedAccount!.verificationTokenExpires).toBeDefined();
    });

    it('should verify developer account with valid token', async () => {
      const token = 'valid_token_123';
      const account = await DeveloperAccount.create({
        userId,
        contactEmail: 'test@example.com',
        verificationToken: token,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        status: 'pending'
      });

      const verifiedAccount = await DeveloperPortalService.verifyDeveloperAccount(token);

      expect(verifiedAccount._id.toString()).toBe(account._id.toString());
      expect(verifiedAccount.isVerified).toBe(true);
      expect(verifiedAccount.status).toBe('active');
      expect(verifiedAccount.onboardingSteps.emailVerification).toBe(true);
      expect(verifiedAccount.verificationToken).toBeUndefined();
      expect(verifiedAccount.verificationTokenExpires).toBeUndefined();
    });

    it('should throw error for invalid verification token', async () => {
      await expect(
        DeveloperPortalService.verifyDeveloperAccount('invalid_token')
      ).rejects.toThrow('Invalid or expired verification token');
    });

    it('should throw error for expired verification token', async () => {
      const token = 'expired_token_123';
      await DeveloperAccount.create({
        userId,
        contactEmail: 'test@example.com',
        verificationToken: token,
        verificationTokenExpires: new Date(Date.now() - 1000), // Expired 1 second ago
        status: 'pending'
      });

      await expect(
        DeveloperPortalService.verifyDeveloperAccount(token)
      ).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('Onboarding Management', () => {
    let account: any;

    beforeEach(async () => {
      account = await DeveloperAccount.create({
        userId,
        contactEmail: 'test@example.com'
      });
    });

    it('should get onboarding progress', async () => {
      const progress = await DeveloperPortalService.getOnboardingProgress(userId.toString());

      expect(progress.currentStep).toBe('profileSetup');
      expect(progress.completedSteps).toHaveLength(0);
      expect(progress.nextSteps).toContain('profileSetup');
      expect(progress.progressPercentage).toBe(0);
      expect(progress.recommendations).toContain('Complete your profile with company information');
    });

    it('should update onboarding step', async () => {
      await DeveloperPortalService.updateOnboardingStep(userId.toString(), 'profileSetup', true);

      const updatedAccount = await DeveloperAccount.findById(account._id);
      expect(updatedAccount!.onboardingSteps.profileSetup).toBe(true);
    });

    it('should mark onboarding as completed when all steps are done', async () => {
      const steps = ['profileSetup', 'emailVerification', 'firstApiKey', 'firstApiCall', 'documentationRead'];
      
      for (const step of steps) {
        await DeveloperPortalService.updateOnboardingStep(userId.toString(), step, true);
      }

      const updatedAccount = await DeveloperAccount.findById(account._id);
      expect(updatedAccount!.onboardingCompleted).toBe(true);
    });
  });

  describe('API Documentation Management', () => {
    beforeEach(async () => {
      const endpoint = await ApiEndpoint.create({
        path: '/api/v1/test',
        method: 'GET',
        version: 'v1',
        description: 'Test endpoint',
        category: 'Test'
      });
      endpointId = endpoint._id;

      const docs = [
        {
          endpointId,
          title: 'Test API Documentation',
          description: 'Documentation for test API',
          content: 'Detailed content here',
          category: 'Authentication',
          difficulty: 'beginner',
          tags: ['auth', 'basic'],
          isPublished: true
        },
        {
          endpointId: new mongoose.Types.ObjectId(),
          title: 'Advanced API Documentation',
          description: 'Advanced documentation',
          content: 'Advanced content here',
          category: 'Advanced',
          difficulty: 'advanced',
          tags: ['advanced', 'complex'],
          isPublished: true
        }
      ];

      await ApiDocumentation.insertMany(docs);
    });

    it('should get API documentation with filtering', async () => {
      const result = await DeveloperPortalService.getApiDocumentation({
        category: 'Authentication'
      });

      expect(result.documentation).toHaveLength(1);
      expect(result.documentation[0].title).toBe('Test API Documentation');
      expect(result.total).toBe(1);
    });

    it('should filter documentation by difficulty', async () => {
      const result = await DeveloperPortalService.getApiDocumentation({
        difficulty: 'beginner'
      });

      expect(result.documentation).toHaveLength(1);
      expect(result.documentation[0].difficulty).toBe('beginner');
    });

    it('should filter documentation by tags', async () => {
      const result = await DeveloperPortalService.getApiDocumentation({
        tags: ['auth']
      });

      expect(result.documentation).toHaveLength(1);
      expect(result.documentation[0].tags).toContain('auth');
    });

    it('should get documentation by endpoint ID', async () => {
      const documentation = await DeveloperPortalService.getDocumentationByEndpoint(
        endpointId.toString()
      );

      expect(documentation).toBeDefined();
      expect(documentation!.title).toBe('Test API Documentation');
      expect(documentation!.endpointId).toEqual(endpointId);
    });

    it('should create new documentation', async () => {
      const newEndpointId = new mongoose.Types.ObjectId();
      const docData = {
        title: 'New Documentation',
        description: 'New documentation description',
        content: 'New content',
        category: 'New Category'
      };

      const documentation = await DeveloperPortalService.createOrUpdateDocumentation(
        newEndpointId.toString(),
        docData
      );

      expect(documentation._id).toBeDefined();
      expect(documentation.endpointId).toEqual(newEndpointId);
      expect(documentation.title).toBe(docData.title);
    });
  });

  describe('Sandbox Session Management', () => {
    it('should create sandbox session', async () => {
      const sessionData = {
        name: 'Test Session',
        description: 'Test session description',
        environment: 'sandbox' as const
      };

      const session = await DeveloperPortalService.createSandboxSession(
        developerId.toString(),
        sessionData
      );

      expect(session._id).toBeDefined();
      expect(session.developerId).toEqual(developerId);
      expect(session.name).toBe(sessionData.name);
      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    it('should get sandbox sessions with filtering', async () => {
      const session = await SandboxSession.create({
        developerId,
        sessionId: 'test_session_123',
        name: 'Test Session',
        environment: 'sandbox',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const result = await DeveloperPortalService.getSandboxSessions({
        developerId: developerId.toString(),
        environment: 'sandbox'
      });

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].name).toBe('Test Session');
    });

    it('should get sandbox session by ID', async () => {
      const sessionId = 'test_session_123';
      await SandboxSession.create({
        developerId,
        sessionId,
        name: 'Test Session',
        environment: 'sandbox',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const session = await DeveloperPortalService.getSandboxSession(sessionId);

      expect(session).toBeDefined();
      expect(session!.sessionId).toBe(sessionId);
      expect(session!.name).toBe('Test Session');
    });
  });

  describe('Code Examples Generation', () => {
    it('should generate code examples for endpoint', () => {
      const endpoint = {
        path: '/api/v1/users',
        method: 'GET'
      };
      const apiKey = 'test_api_key_123';

      const examples = DeveloperPortalService.generateCodeExamples(endpoint, apiKey);

      expect(examples.javascript).toBeDefined();
      expect(examples.python).toBeDefined();
      expect(examples.curl).toBeDefined();

      expect(examples.javascript).toContain(endpoint.path);
      expect(examples.javascript).toContain(apiKey);
      expect(examples.python).toContain(endpoint.path);
      expect(examples.python).toContain(apiKey);
      expect(examples.curl).toContain(endpoint.path);
      expect(examples.curl).toContain(apiKey);
    });

    it('should include request body for POST methods', () => {
      const endpoint = {
        path: '/api/v1/users',
        method: 'POST'
      };
      const apiKey = 'test_api_key_123';

      const examples = DeveloperPortalService.generateCodeExamples(endpoint, apiKey);

      expect(examples.javascript).toContain('data:');
      expect(examples.python).toContain('data =');
      expect(examples.curl).toContain('-d');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      const docs = [
        {
          endpointId: new mongoose.Types.ObjectId(),
          title: 'Doc 1',
          description: 'Description 1',
          content: 'Content 1',
          category: 'Authentication',
          tags: ['auth', 'security'],
          isPublished: true
        },
        {
          endpointId: new mongoose.Types.ObjectId(),
          title: 'Doc 2',
          description: 'Description 2',
          content: 'Content 2',
          category: 'Users',
          tags: ['users', 'management'],
          isPublished: true
        }
      ];

      await ApiDocumentation.insertMany(docs);
    });

    it('should get documentation categories', async () => {
      const categories = await DeveloperPortalService.getDocumentationCategories();

      expect(categories).toContain('Authentication');
      expect(categories).toContain('Users');
      expect(categories).toHaveLength(2);
    });

    it('should get documentation tags', async () => {
      const tags = await DeveloperPortalService.getDocumentationTags();

      expect(tags).toContain('auth');
      expect(tags).toContain('security');
      expect(tags).toContain('users');
      expect(tags).toContain('management');
      expect(tags).toHaveLength(4);
    });
  });
});