import Redis from 'ioredis';
import { PresenceModel, IPresence, ICustomStatus } from '../Presence';

// Mock Redis
jest.mock('ioredis');

describe('PresenceModel', () => {
  let redis: jest.Mocked<Redis>;
  let presenceModel: PresenceModel;

  beforeEach(() => {
    redis = new Redis() as jest.Mocked<Redis>;
    presenceModel = new PresenceModel(redis);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('setUserOnline', () => {
    it('should set user as online with socket ID', async () => {
      const userId = 'user123';
      const socketId = 'socket456';

      redis.setex = jest.fn().mockResolvedValue('OK');
      redis.sadd = jest.fn().mockResolvedValue(1);
      redis.expire = jest.fn().mockResolvedValue(1);

      await presenceModel.setUserOnline(userId, socketId);

      expect(redis.setex).toHaveBeenCalledWith(
        'presence:user123',
        300,
        expect.stringContaining('"status":"online"')
      );
      expect(redis.sadd).toHaveBeenCalledWith('socket:user123', socketId);
      expect(redis.expire).toHaveBeenCalledWith('socket:user123', 300);
    });
  });

  describe('setUserAway', () => {
    it('should set user as away', async () => {
      const userId = 'user123';

      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.setUserAway(userId);

      expect(redis.setex).toHaveBeenCalledWith(
        'presence:user123',
        300,
        expect.stringContaining('"status":"away"')
      );
    });
  });

  describe('setUserOffline', () => {
    it('should set user as offline when no other sockets', async () => {
      const userId = 'user123';
      const socketId = 'socket456';

      redis.srem = jest.fn().mockResolvedValue(1);
      redis.scard = jest.fn().mockResolvedValue(0);
      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.setUserOffline(userId, socketId);

      expect(redis.srem).toHaveBeenCalledWith('socket:user123', socketId);
      expect(redis.scard).toHaveBeenCalledWith('socket:user123');
      expect(redis.setex).toHaveBeenCalledWith(
        'presence:user123',
        86400,
        expect.stringContaining('"status":"offline"')
      );
    });

    it('should keep user online when other sockets exist', async () => {
      const userId = 'user123';
      const socketId = 'socket456';

      redis.srem = jest.fn().mockResolvedValue(1);
      redis.scard = jest.fn().mockResolvedValue(1); // Other socket exists

      await presenceModel.setUserOffline(userId, socketId);

      expect(redis.srem).toHaveBeenCalledWith('socket:user123', socketId);
      expect(redis.scard).toHaveBeenCalledWith('socket:user123');
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('should remove all sockets when no socketId provided', async () => {
      const userId = 'user123';

      redis.del = jest.fn().mockResolvedValue(1);
      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.setUserOffline(userId);

      expect(redis.del).toHaveBeenCalledWith('socket:user123');
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('getUserPresence', () => {
    it('should return user presence with custom status', async () => {
      const userId = 'user123';
      const presenceData = JSON.stringify({
        status: 'online',
        lastSeen: new Date().toISOString(),
      });
      const customStatusData = JSON.stringify({
        text: 'In a meeting',
        emoji: '📅',
      });

      redis.get = jest.fn()
        .mockResolvedValueOnce(presenceData)
        .mockResolvedValueOnce(customStatusData);
      redis.smembers = jest.fn().mockResolvedValue(['socket1', 'socket2']);

      const presence = await presenceModel.getUserPresence(userId);

      expect(presence).toBeDefined();
      expect(presence?.status).toBe('online');
      expect(presence?.customStatus?.text).toBe('In a meeting');
      expect(presence?.socketIds).toHaveLength(2);
    });

    it('should return null when user presence not found', async () => {
      const userId = 'user123';

      redis.get = jest.fn().mockResolvedValue(null);

      const presence = await presenceModel.getUserPresence(userId);

      expect(presence).toBeNull();
    });

    it('should remove expired custom status', async () => {
      const userId = 'user123';
      const presenceData = JSON.stringify({
        status: 'online',
        lastSeen: new Date().toISOString(),
      });
      const expiredCustomStatus = JSON.stringify({
        text: 'In a meeting',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      redis.get = jest.fn()
        .mockResolvedValueOnce(presenceData)
        .mockResolvedValueOnce(expiredCustomStatus);
      redis.smembers = jest.fn().mockResolvedValue([]);
      redis.del = jest.fn().mockResolvedValue(1);

      const presence = await presenceModel.getUserPresence(userId);

      expect(presence?.customStatus).toBeUndefined();
      expect(redis.del).toHaveBeenCalledWith('custom_status:user123');
    });
  });

  describe('getBulkPresence', () => {
    it('should return multiple user presences', async () => {
      const userIds = ['user1', 'user2'];

      const pipeline = {
        get: jest.fn().mockReturnThis(),
        smembers: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, JSON.stringify({ status: 'online', lastSeen: new Date().toISOString() })],
          [null, null], // No custom status
          [null, ['socket1']],
          [null, JSON.stringify({ status: 'away', lastSeen: new Date().toISOString() })],
          [null, null],
          [null, []],
        ]),
      };

      redis.pipeline = jest.fn().mockReturnValue(pipeline);

      const presences = await presenceModel.getBulkPresence(userIds);

      expect(presences.size).toBe(2);
      expect(presences.get('user1')?.status).toBe('online');
      expect(presences.get('user2')?.status).toBe('away');
    });
  });

  describe('setCustomStatus', () => {
    it('should set custom status with expiration', async () => {
      const userId = 'user123';
      const customStatus: ICustomStatus = {
        text: 'In a meeting',
        emoji: '📅',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.setCustomStatus(userId, customStatus);

      expect(redis.setex).toHaveBeenCalledWith(
        'custom_status:user123',
        expect.any(Number),
        expect.stringContaining('"text":"In a meeting"')
      );
    });

    it('should use default TTL when no expiration provided', async () => {
      const userId = 'user123';
      const customStatus: ICustomStatus = {
        text: 'Available',
      };

      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.setCustomStatus(userId, customStatus);

      expect(redis.setex).toHaveBeenCalledWith(
        'custom_status:user123',
        86400, // Default 24 hours
        expect.any(String)
      );
    });
  });

  describe('clearCustomStatus', () => {
    it('should clear custom status', async () => {
      const userId = 'user123';

      redis.del = jest.fn().mockResolvedValue(1);

      await presenceModel.clearCustomStatus(userId);

      expect(redis.del).toHaveBeenCalledWith('custom_status:user123');
    });
  });

  describe('updateLastSeen', () => {
    it('should update last seen timestamp', async () => {
      const userId = 'user123';
      const presenceData = JSON.stringify({
        status: 'online',
        lastSeen: new Date(Date.now() - 60000).toISOString(),
      });

      redis.get = jest.fn().mockResolvedValue(presenceData);
      redis.setex = jest.fn().mockResolvedValue('OK');

      await presenceModel.updateLastSeen(userId);

      expect(redis.get).toHaveBeenCalledWith('presence:user123');
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('getOnlineUsersCount', () => {
    it('should return count of online users', async () => {
      redis.keys = jest.fn().mockResolvedValue([
        'presence:user1',
        'presence:user2',
        'presence:user3',
      ]);

      redis.get = jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ status: 'online' }))
        .mockResolvedValueOnce(JSON.stringify({ status: 'away' }))
        .mockResolvedValueOnce(JSON.stringify({ status: 'online' }));

      const count = await presenceModel.getOnlineUsersCount();

      expect(count).toBe(2);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return list of online user IDs', async () => {
      redis.keys = jest.fn().mockResolvedValue([
        'presence:user1',
        'presence:user2',
        'presence:user3',
      ]);

      redis.get = jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ status: 'online' }))
        .mockResolvedValueOnce(JSON.stringify({ status: 'offline' }))
        .mockResolvedValueOnce(JSON.stringify({ status: 'online' }));

      const users = await presenceModel.getOnlineUsers();

      expect(users).toHaveLength(2);
      expect(users).toContain('user1');
      expect(users).toContain('user3');
    });
  });

  describe('isUserOnline', () => {
    it('should return true for online user', async () => {
      const userId = 'user123';

      redis.get = jest.fn().mockResolvedValue(
        JSON.stringify({ status: 'online', lastSeen: new Date().toISOString() })
      );
      redis.smembers = jest.fn().mockResolvedValue([]);

      const isOnline = await presenceModel.isUserOnline(userId);

      expect(isOnline).toBe(true);
    });

    it('should return false for offline user', async () => {
      const userId = 'user123';

      redis.get = jest.fn().mockResolvedValue(
        JSON.stringify({ status: 'offline', lastSeen: new Date().toISOString() })
      );
      redis.smembers = jest.fn().mockResolvedValue([]);

      const isOnline = await presenceModel.isUserOnline(userId);

      expect(isOnline).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const userId = 'user123';

      redis.get = jest.fn().mockResolvedValue(null);

      const isOnline = await presenceModel.isUserOnline(userId);

      expect(isOnline).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should set expiration for keys without TTL', async () => {
      redis.keys = jest.fn().mockResolvedValue([
        'presence:user1',
        'presence:user2',
      ]);

      redis.ttl = jest.fn()
        .mockResolvedValueOnce(-1) // No expiration
        .mockResolvedValueOnce(300); // Has expiration

      redis.expire = jest.fn().mockResolvedValue(1);

      await presenceModel.cleanup();

      expect(redis.expire).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledWith('presence:user1', 86400);
    });
  });
});
