import Redis from 'ioredis';

/**
 * Presence Model for Communication Module (Redis-based)
 * 
 * Tracks user online/offline status and custom status messages
 * Uses Redis for fast access and automatic TTL cleanup
 */

export interface IPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  customStatus?: {
    text: string;
    emoji?: string;
    expiresAt?: Date;
  };
  lastSeen: Date;
  socketIds: string[]; // Multiple connections (desktop + mobile)
}

export interface ICustomStatus {
  text: string;
  emoji?: string;
  expiresAt?: Date;
}

export class PresenceModel {
  private redis: Redis;
  private readonly PRESENCE_PREFIX = 'presence:';
  private readonly CUSTOM_STATUS_PREFIX = 'custom_status:';
  private readonly SOCKET_PREFIX = 'socket:';
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Set user as online
   */
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    const key = this.PRESENCE_PREFIX + userId;
    const socketKey = this.SOCKET_PREFIX + userId;

    // Set presence
    await this.redis.setex(
      key,
      this.DEFAULT_TTL,
      JSON.stringify({
        status: 'online',
        lastSeen: new Date().toISOString(),
      })
    );

    // Add socket ID to set
    await this.redis.sadd(socketKey, socketId);
    await this.redis.expire(socketKey, this.DEFAULT_TTL);
  }

  /**
   * Set user as away
   */
  async setUserAway(userId: string): Promise<void> {
    const key = this.PRESENCE_PREFIX + userId;

    await this.redis.setex(
      key,
      this.DEFAULT_TTL,
      JSON.stringify({
        status: 'away',
        lastSeen: new Date().toISOString(),
      })
    );
  }

  /**
   * Set user as offline
   */
  async setUserOffline(userId: string, socketId?: string): Promise<void> {
    const key = this.PRESENCE_PREFIX + userId;
    const socketKey = this.SOCKET_PREFIX + userId;

    if (socketId) {
      // Remove specific socket
      await this.redis.srem(socketKey, socketId);

      // Check if user has other active sockets
      const remainingSockets = await this.redis.scard(socketKey);

      if (remainingSockets > 0) {
        // User still has other connections, keep as online
        return;
      }
    } else {
      // Remove all sockets
      await this.redis.del(socketKey);
    }

    // Set as offline
    await this.redis.setex(
      key,
      86400, // Keep offline status for 24 hours
      JSON.stringify({
        status: 'offline',
        lastSeen: new Date().toISOString(),
      })
    );
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<IPresence | null> {
    const key = this.PRESENCE_PREFIX + userId;
    const customStatusKey = this.CUSTOM_STATUS_PREFIX + userId;
    const socketKey = this.SOCKET_PREFIX + userId;

    const [presenceData, customStatusData, socketIds] = await Promise.all([
      this.redis.get(key),
      this.redis.get(customStatusKey),
      this.redis.smembers(socketKey),
    ]);

    if (!presenceData) {
      return null;
    }

    const presence = JSON.parse(presenceData);
    const customStatus = customStatusData ? JSON.parse(customStatusData) : undefined;

    // Check if custom status has expired
    if (customStatus?.expiresAt && new Date(customStatus.expiresAt) < new Date()) {
      await this.redis.del(customStatusKey);
      return {
        userId,
        status: presence.status,
        lastSeen: new Date(presence.lastSeen),
        socketIds,
      };
    }

    return {
      userId,
      status: presence.status,
      customStatus,
      lastSeen: new Date(presence.lastSeen),
      socketIds,
    };
  }

  /**
   * Get multiple user presences
   */
  async getBulkPresence(userIds: string[]): Promise<Map<string, IPresence>> {
    const presences = new Map<string, IPresence>();

    // Use pipeline for efficiency
    const pipeline = this.redis.pipeline();

    userIds.forEach(userId => {
      pipeline.get(this.PRESENCE_PREFIX + userId);
      pipeline.get(this.CUSTOM_STATUS_PREFIX + userId);
      pipeline.smembers(this.SOCKET_PREFIX + userId);
    });

    const results = await pipeline.exec();

    if (!results) {
      return presences;
    }

    // Process results in groups of 3 (presence, customStatus, socketIds)
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const presenceResult = results[i * 3];
      const customStatusResult = results[i * 3 + 1];
      const socketIdsResult = results[i * 3 + 2];

      if (presenceResult && presenceResult[1]) {
        const presence = JSON.parse(presenceResult[1] as string);
        const customStatus = customStatusResult && customStatusResult[1]
          ? JSON.parse(customStatusResult[1] as string)
          : undefined;
        const socketIds = socketIdsResult && socketIdsResult[1]
          ? socketIdsResult[1] as string[]
          : [];

        // Check if custom status has expired
        if (customStatus?.expiresAt && new Date(customStatus.expiresAt) < new Date()) {
          await this.redis.del(this.CUSTOM_STATUS_PREFIX + userId);
          presences.set(userId, {
            userId,
            status: presence.status,
            lastSeen: new Date(presence.lastSeen),
            socketIds,
          });
        } else {
          presences.set(userId, {
            userId,
            status: presence.status,
            customStatus,
            lastSeen: new Date(presence.lastSeen),
            socketIds,
          });
        }
      }
    }

    return presences;
  }

  /**
   * Set custom status
   */
  async setCustomStatus(
    userId: string,
    customStatus: ICustomStatus
  ): Promise<void> {
    const key = this.CUSTOM_STATUS_PREFIX + userId;

    // Calculate TTL based on expiration
    let ttl = 86400; // Default 24 hours
    if (customStatus.expiresAt) {
      const expiresIn = Math.floor(
        (new Date(customStatus.expiresAt).getTime() - Date.now()) / 1000
      );
      ttl = Math.max(expiresIn, 60); // Minimum 1 minute
    }

    await this.redis.setex(
      key,
      ttl,
      JSON.stringify(customStatus)
    );
  }

  /**
   * Clear custom status
   */
  async clearCustomStatus(userId: string): Promise<void> {
    const key = this.CUSTOM_STATUS_PREFIX + userId;
    await this.redis.del(key);
  }

  /**
   * Update last seen timestamp
   */
  async updateLastSeen(userId: string): Promise<void> {
    const key = this.PRESENCE_PREFIX + userId;
    const presenceData = await this.redis.get(key);

    if (presenceData) {
      const presence = JSON.parse(presenceData);
      presence.lastSeen = new Date().toISOString();

      await this.redis.setex(
        key,
        this.DEFAULT_TTL,
        JSON.stringify(presence)
      );
    }
  }

  /**
   * Get online users count
   */
  async getOnlineUsersCount(): Promise<number> {
    const keys = await this.redis.keys(this.PRESENCE_PREFIX + '*');
    let onlineCount = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const presence = JSON.parse(data);
        if (presence.status === 'online') {
          onlineCount++;
        }
      }
    }

    return onlineCount;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<string[]> {
    const keys = await this.redis.keys(this.PRESENCE_PREFIX + '*');
    const onlineUsers: string[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const presence = JSON.parse(data);
        if (presence.status === 'online') {
          const userId = key.replace(this.PRESENCE_PREFIX, '');
          onlineUsers.push(userId);
        }
      }
    }

    return onlineUsers;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const presence = await this.getUserPresence(userId);
    return presence?.status === 'online';
  }

  /**
   * Cleanup expired presences (called periodically)
   */
  async cleanup(): Promise<void> {
    // Redis TTL handles most cleanup automatically
    // This method can be used for additional cleanup if needed
    const keys = await this.redis.keys(this.PRESENCE_PREFIX + '*');

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // Key has no expiration, set one
        await this.redis.expire(key, 86400);
      }
    }
  }

  /**
   * Subscribe to presence updates (for real-time notifications)
   */
  async subscribeToPresenceUpdates(
    callback: (userId: string, presence: IPresence) => void
  ): Promise<void> {
    // This would use Redis pub/sub
    // Implementation depends on your Redis setup
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe('presence:updates');

    subscriber.on('message', (channel, message) => {
      if (channel === 'presence:updates') {
        const { userId, presence } = JSON.parse(message);
        callback(userId, presence);
      }
    });
  }

  /**
   * Publish presence update
   */
  async publishPresenceUpdate(userId: string, presence: IPresence): Promise<void> {
    await this.redis.publish(
      'presence:updates',
      JSON.stringify({ userId, presence })
    );
  }
}

// Export singleton instance (will be initialized with Redis connection)
let presenceModel: PresenceModel | null = null;

export const initializePresenceModel = (redis: Redis): PresenceModel => {
  presenceModel = new PresenceModel(redis);
  return presenceModel;
};

export const getPresenceModel = (): PresenceModel => {
  if (!presenceModel) {
    throw new Error('Presence model not initialized. Call initializePresenceModel first.');
  }
  return presenceModel;
};

export default PresenceModel;
