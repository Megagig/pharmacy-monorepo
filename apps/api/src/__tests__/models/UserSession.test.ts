import mongoose from 'mongoose';
import { UserSession, IUserSession } from '../../models/UserSession';

describe('UserSession Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await UserSession.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid UserSession document', async () => {
      const userId = new mongoose.Types.ObjectId();
      const workspaceId = new mongoose.Types.ObjectId();
      
      const validSession = {
        sessionId: 'session_123456789',
        userId,
        workspaceId,
        deviceInfo: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          isMobile: false,
        },
        locationInfo: {
          ipAddress: '192.168.1.100',
          country: 'Nigeria',
          region: 'Lagos',
          city: 'Lagos',
          timezone: 'Africa/Lagos',
          isp: 'MTN Nigeria',
        },
        securityFlags: {
          isSuspicious: false,
          isFromNewDevice: true,
          isFromNewLocation: false,
          hasFailedAttempts: false,
          riskScore: 25,
        },
        loginTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
        refreshTokens: ['token1', 'token2'],
        failedAttempts: 0,
      };

      const session = new UserSession(validSession);
      const savedSession = await session.save();

      expect(savedSession._id).toBeDefined();
      expect(savedSession.sessionId).toBe('session_123456789');
      expect(savedSession.userId.toString()).toBe(userId.toString());
      expect(savedSession.deviceInfo.browser).toBe('Chrome');
      expect(savedSession.isActive).toBe(true);
      expect(savedSession.createdAt).toBeDefined();
    });

    it('should require mandatory fields', async () => {
      const incompleteSession = new UserSession({
        sessionId: 'session_123',
        // Missing required fields
      });

      await expect(incompleteSession.save()).rejects.toThrow();
    });

    it('should validate IP address format', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const invalidSession = new UserSession({
        sessionId: 'session_123456789',
        userId,
        deviceInfo: {
          userAgent: 'Mozilla/5.0',
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          isMobile: false,
        },
        locationInfo: {
          ipAddress: 'invalid-ip', // Invalid IP format
          country: 'Nigeria',
        },
        securityFlags: {
          isSuspicious: false,
          isFromNewDevice: false,
          isFromNewLocation: false,
          hasFailedAttempts: false,
          riskScore: 0,
        },
        loginTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      await expect(invalidSession.save()).rejects.toThrow();
    });

    it('should validate risk score range', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const invalidSession = new UserSession({
        sessionId: 'session_123456789',
        userId,
        deviceInfo: {
          userAgent: 'Mozilla/5.0',
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          isMobile: false,
        },
        locationInfo: {
          ipAddress: '192.168.1.1',
          country: 'Nigeria',
        },
        securityFlags: {
          isSuspicious: false,
          isFromNewDevice: false,
          isFromNewLocation: false,
          hasFailedAttempts: false,
          riskScore: 150, // Invalid score > 100
        },
        loginTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      await expect(invalidSession.save()).rejects.toThrow();
    });

    it('should validate unique sessionId', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      const sessionData = {
        sessionId: 'duplicate_session_id',
        deviceInfo: {
          userAgent: 'Mozilla/5.0',
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          isMobile: false,
        },
        locationInfo: {
          ipAddress: '192.168.1.1',
          country: 'Nigeria',
        },
        securityFlags: {
          isSuspicious: false,
          isFromNewDevice: false,
          isFromNewLocation: false,
          hasFailedAttempts: false,
          riskScore: 0,
        },
        loginTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      };

      const session1 = new UserSession({ ...sessionData, userId: userId1 });
      await session1.save();

      const session2 = new UserSession({ ...sessionData, userId: userId2 });
      await expect(session2.save()).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let session: IUserSession;
    const userId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      session = new UserSession({
        sessionId: 'test_session_123',
        userId,
        deviceInfo: {
          userAgent: 'Mozilla/5.0',
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          isMobile: false,
        },
        locationInfo: {
          ipAddress: '192.168.1.1',
          country: 'Nigeria',
        },
        securityFlags: {
          isSuspicious: false,
          isFromNewDevice: true,
          isFromNewLocation: false,
          hasFailedAttempts: false,
          riskScore: 0,
        },
        loginTime: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        failedAttempts: 2,
      });
      await session.save();
    });

    it('should detect expired sessions', () => {
      // Test with future expiry
      expect(session.isExpired()).toBe(false);

      // Test with past expiry
      session.expiresAt = new Date(Date.now() - 1000);
      expect(session.isExpired()).toBe(true);

      // Test with inactive session
      session.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      session.isActive = false;
      expect(session.isExpired()).toBe(true);
    });

    it('should update activity timestamp', () => {
      const oldActivity = session.lastActivity;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        session.updateActivity();
        expect(session.lastActivity.getTime()).toBeGreaterThan(oldActivity.getTime());
      }, 10);
    });

    it('should terminate session correctly', () => {
      const adminId = new mongoose.Types.ObjectId();
      
      session.terminate('admin_terminated', adminId);
      
      expect(session.isActive).toBe(false);
      expect(session.logoutTime).toBeDefined();
      expect(session.logoutReason).toBe('admin_terminated');
      expect(session.refreshTokens).toHaveLength(0);
    });

    it('should calculate risk score correctly', () => {
      const riskScore = session.calculateRiskScore();
      
      // Should have some risk due to new device and failed attempts
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
      
      // New device adds 20 points, 2 failed attempts add 20 points
      expect(riskScore).toBeGreaterThanOrEqual(40);
    });

    it('should calculate session duration correctly', () => {
      const duration = session.getDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      
      // Test with logout time
      session.logoutTime = new Date(session.loginTime.getTime() + 60 * 60 * 1000); // 1 hour later
      const durationWithLogout = session.getDuration();
      expect(durationWithLogout).toBe(60); // 60 minutes
    });

    it('should exclude sensitive fields in JSON output', () => {
      const jsonOutput = session.toJSON();
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).not.toHaveProperty('refreshTokens');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('sessionId');
    });
  });

  describe('Static Methods', () => {
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      // Create test sessions
      await UserSession.create([
        {
          sessionId: 'active_session_1',
          userId: userId1,
          deviceInfo: {
            userAgent: 'Mozilla/5.0',
            browser: 'Chrome',
            os: 'Windows',
            device: 'Desktop',
            isMobile: false,
          },
          locationInfo: {
            ipAddress: '192.168.1.1',
            country: 'Nigeria',
          },
          securityFlags: {
            isSuspicious: false,
            isFromNewDevice: false,
            isFromNewLocation: false,
            hasFailedAttempts: false,
            riskScore: 10,
          },
          loginTime: new Date(),
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          sessionId: 'suspicious_session',
          userId: userId2,
          deviceInfo: {
            userAgent: 'Mozilla/5.0',
            browser: 'Chrome',
            os: 'Windows',
            device: 'Desktop',
            isMobile: false,
          },
          locationInfo: {
            ipAddress: '192.168.1.2',
            country: 'Nigeria',
          },
          securityFlags: {
            isSuspicious: true,
            isFromNewDevice: true,
            isFromNewLocation: true,
            hasFailedAttempts: true,
            riskScore: 85,
          },
          loginTime: new Date(),
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          isActive: true,
        },
      ]);
    });

    it('should get active sessions for user', async () => {
      const activeSessions = await UserSession.getActiveSessions(userId1);
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe('active_session_1');
    });

    it('should get suspicious sessions', async () => {
      const suspiciousSessions = await UserSession.getSuspiciousSessions();
      expect(suspiciousSessions).toHaveLength(1);
      expect(suspiciousSessions[0].sessionId).toBe('suspicious_session');
    });

    it('should terminate all user sessions', async () => {
      await UserSession.terminateUserSessions(userId1, 'security_breach');
      
      const sessions = await UserSession.find({ userId: userId1 });
      expect(sessions[0].isActive).toBe(false);
      expect(sessions[0].logoutReason).toBe('security_breach');
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await UserSession.collection.getIndexes();
      
      expect(indexes).toHaveProperty('sessionId_1');
      expect(indexes).toHaveProperty('userId_1');
      expect(indexes).toHaveProperty('isActive_1');
      expect(indexes).toHaveProperty('expiresAt_1');
    });

    it('should have TTL index for automatic cleanup', async () => {
      const indexes = await UserSession.collection.getIndexes();
      
      const ttlIndex = Object.values(indexes).find((index: any) => 
        index.expireAfterSeconds !== undefined
      );
      
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(0);
    });
  });
});