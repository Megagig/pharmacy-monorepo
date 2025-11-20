/**
 * Centralized Redis Connection Manager
 * Provides a SINGLE shared Redis connection to prevent "max clients reached" error
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private client: Redis | null = null;
  private isConnected = false;
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      RedisConnectionManager.instance = new RedisConnectionManager();
    }
    return RedisConnectionManager.instance;
  }

  /**
   * Get the shared Redis client (creates it if needed)
   */
  public async getClient(): Promise<Redis | null> {
    // Return existing client if available
    if (this.client && this.isConnected) {
      return this.client;
    }

    // If already connecting, wait
    if (this.isConnecting) {
      // Wait for connection to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getClient();
    }

    // Initialize connection
    return this.connect();
  }

  /**
   * Connect to Redis (called only once)
   */
  private async connect(): Promise<Redis | null> {
    if (this.client) {
      return this.client;
    }

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.info('📭 Redis: REDIS_URL not configured - caching disabled');
      return null;
    }

    this.isConnecting = true;

    try {
      logger.info('🔌 Redis: Connecting to Redis...');
      logger.info(`🔗 Redis: URL from env - ${redisUrl.replace(/:[^:@]+@/, ':***@')}`);

      // Detect TLS protocol (rediss://)
      const useTLS = redisUrl.startsWith('rediss://');

      // Parse Redis URL to extract username, password, host, and port
      // Format: redis://username:password@host:port or rediss://username:password@host:port
      const urlMatch = redisUrl.match(/rediss?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);

      if (!urlMatch) {
        throw new Error('Invalid REDIS_URL format. Expected: redis://username:password@host:port or rediss://username:password@host:port');
      }

      const [, username, password, host, portStr] = urlMatch;
      const port = parseInt(portStr, 10);

      logger.info(`� Redis: Username - ${username}`);
      logger.info(`�🔑 Redis: Password extracted - ${password.substring(0, 3)}...${password.substring(password.length - 3)}`);
      logger.info(`🏠 Redis: Connecting to ${host}:${port}${useTLS ? ' (TLS)' : ''}`);

      // Use object configuration for better control
      this.client = new Redis({
        host,
        port,
        username, // Upstash requires username
        password,
        maxRetriesPerRequest: null, // Bull compatibility
        lazyConnect: false,

        // TLS configuration for Upstash and other secure Redis providers
        ...(useTLS && {
          tls: {
            rejectUnauthorized: true, // Verify SSL certificate
          },
        }),

        // CRITICAL: Prevent connection drops
        keepAlive: 10000, // Send TCP keepalive every 10 seconds
        connectTimeout: 30000,
        commandTimeout: 10000,

        // Prevent idle disconnects
        enableReadyCheck: true,
        enableOfflineQueue: true, // Allow queuing during connection

        // Ping server regularly to keep connection alive
        sentinelRetryStrategy: null,
        enableAutoPipelining: false,

        retryStrategy: (times: number) => {
          if (times > 50) {
            logger.error('❌ Redis: Max retry attempts (50) reached');
            this.isConnected = false;
            return null;
          }
          const delay = Math.min(times * 500, 30000);
          if (times % 10 === 0) {
            logger.info(`🔄 Redis: Retry attempt ${times}, waiting ${delay}ms...`);
          }
          return delay;
        },
        reconnectOnError: (err: Error) => {
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'];
          if (targetErrors.some(e => err.message.includes(e))) {
            logger.warn(`⚠️ Redis: Reconnecting due to: ${err.message}`);
            return true;
          }
          return false;
        },
      });

      // Set up event handlers
      this.client.on('connect', () => {
        logger.info('✅ Redis: Connected successfully');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis: Ready to accept commands');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error(`❌ Redis: Connection error: ${err.message}`, { stack: err.stack });
        this.isConnected = false;

        // If max clients error, prevent further attempts
        if (err.message.includes('max number of clients reached')) {
          logger.error('🚫 Redis: Max clients reached - closing connection');
          this.closeConnection();
        }
      });

      this.client.on('close', () => {
        logger.warn('⚠️ Redis: Connection closed');
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('⚠️ Redis: Connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('🔄 Redis: Reconnecting...');
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.isConnecting = false;

      logger.info('✅ Redis: Connection verified and ready');

      // Start heartbeat to prevent idle timeout (ping every 30 seconds)
      this.startHeartbeat();

      return this.client;

    } catch (error) {
      logger.error('❌ Redis: Failed to connect:', error);
      this.isConnected = false;
      this.isConnecting = false;
      this.client = null;
      return null;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    // Clear existing heartbeat
    this.stopHeartbeat();

    // Ping Redis every 30 seconds to prevent idle timeout
    this.heartbeatInterval = setInterval(async () => {
      if (this.client && this.isConnected) {
        try {
          await this.client.ping();
          logger.debug('💓 Redis: Heartbeat ping successful');
        } catch (error) {
          logger.warn('⚠️ Redis: Heartbeat ping failed:', error);
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if Redis is connected
   */
  public isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Close the Redis connection
   */
  public async closeConnection(): Promise<void> {
    // Stop heartbeat
    this.stopHeartbeat();

    if (this.client) {
      try {
        logger.info('🔌 Redis: Closing connection...');
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        logger.info('✅ Redis: Connection closed gracefully');
      } catch (error) {
        logger.error('❌ Redis: Error closing connection:', error);
        // Force disconnect
        if (this.client) {
          this.client.disconnect();
          this.client = null;
          this.isConnected = false;
        }
      }
    }
  }

  /**
   * Get connection status for monitoring
   */
  public getStatus(): {
    connected: boolean;
    client: boolean;
  } {
    return {
      connected: this.isConnected,
      client: this.client !== null,
    };
  }
}

// Export singleton instance
export const redisManager = RedisConnectionManager.getInstance();

// Export convenience functions
export async function getRedisClient(): Promise<Redis | null> {
  return redisManager.getClient();
}

export function isRedisAvailable(): boolean {
  return redisManager.isRedisConnected();
}

export async function closeRedis(): Promise<void> {
  return redisManager.closeConnection();
}
