import { Message, Conversation, CommunicationNotification } from '../stores/types';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
}

/**
 * In-memory cache service for communication data
 * Implements LRU (Least Recently Used) eviction policy
 */
export class CacheService {
    private cache = new Map<string, CacheEntry<any>>();
    private accessOrder = new Map<string, number>();
    private accessCounter = 0;
    private config: CacheConfig;

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxSize: config.maxSize || 1000,
            defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5 minutes
        };
    }

    /**
     * Set a value in the cache
     */
    set<T>(key: string, value: T, ttl?: number): void {
        const entry: CacheEntry<T> = {
            data: value,
            timestamp: Date.now(),
            ttl: ttl || this.config.defaultTTL,
        };

        // Remove expired entries before adding new one
        this.cleanup();

        // If cache is at max size, remove least recently used item
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, entry);
        this.accessOrder.set(key, ++this.accessCounter);
    }

    /**
     * Get a value from the cache
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            return null;
        }

        // Update access order
        this.accessOrder.set(key, ++this.accessCounter);

        return entry.data as T;
    }

    /**
     * Check if a key exists in the cache
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        // Check if entry has expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Remove a key from the cache
     */
    delete(key: string): boolean {
        this.accessOrder.delete(key);
        return this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRate: this.calculateHitRate(),
        };
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => {
            this.cache.delete(key);
            this.accessOrder.delete(key);
        });
    }

    /**
     * Evict least recently used item
     */
    private evictLRU(): void {
        let lruKey: string | null = null;
        let lruAccess = Infinity;

        for (const [key, accessTime] of this.accessOrder.entries()) {
            if (accessTime < lruAccess) {
                lruAccess = accessTime;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.cache.delete(lruKey);
            this.accessOrder.delete(lruKey);
        }
    }

    /**
     * Calculate cache hit rate (placeholder - would need hit/miss tracking)
     */
    private calculateHitRate(): number {
        // This would require tracking hits and misses
        // For now, return a placeholder value
        return 0.85;
    }
}

/**
 * Specialized cache service for communication data
 */
export class CommunicationCacheService extends CacheService {
    constructor() {
        super({
            maxSize: 2000,
            defaultTTL: 10 * 60 * 1000, // 10 minutes for communication data
        });
    }

    // Conversation caching
    cacheConversation(conversation: Conversation): void {
        this.set(`conversation:${conversation._id}`, conversation);
    }

    getCachedConversation(conversationId: string): Conversation | null {
        return this.get<Conversation>(`conversation:${conversationId}`);
    }

    cacheConversationList(key: string, conversations: Conversation[]): void {
        this.set(`conversations:${key}`, conversations, 5 * 60 * 1000); // 5 minutes for lists
    }

    getCachedConversationList(key: string): Conversation[] | null {
        return this.get<Conversation[]>(`conversations:${key}`);
    }

    // Message caching
    cacheMessage(message: Message): void {
        this.set(`message:${message._id}`, message);
    }

    getCachedMessage(messageId: string): Message | null {
        return this.get<Message>(`message:${messageId}`);
    }

    cacheMessageList(conversationId: string, messages: Message[], page: number = 1): void {
        this.set(`messages:${conversationId}:${page}`, messages, 3 * 60 * 1000); // 3 minutes for message lists
    }

    getCachedMessageList(conversationId: string, page: number = 1): Message[] | null {
        return this.get<Message[]>(`messages:${conversationId}:${page}`);
    }

    // Notification caching
    cacheNotification(notification: CommunicationNotification): void {
        this.set(`notification:${notification._id}`, notification, 2 * 60 * 1000); // 2 minutes for notifications
    }

    getCachedNotification(notificationId: string): CommunicationNotification | null {
        return this.get<CommunicationNotification>(`notification:${notificationId}`);
    }

    cacheNotificationList(userId: string, notifications: CommunicationNotification[]): void {
        this.set(`notifications:${userId}`, notifications, 1 * 60 * 1000); // 1 minute for notification lists
    }

    getCachedNotificationList(userId: string): CommunicationNotification[] | null {
        return this.get<CommunicationNotification[]>(`notifications:${userId}`);
    }

    // User data caching
    cacheUserData(userId: string, userData: any): void {
        this.set(`user:${userId}`, userData, 15 * 60 * 1000); // 15 minutes for user data
    }

    getCachedUserData(userId: string): any | null {
        return this.get(`user:${userId}`);
    }

    // File metadata caching
    cacheFileMetadata(fileId: string, metadata: any): void {
        this.set(`file:${fileId}`, metadata, 30 * 60 * 1000); // 30 minutes for file metadata
    }

    getCachedFileMetadata(fileId: string): any | null {
        return this.get(`file:${fileId}`);
    }

    // Search results caching
    cacheSearchResults(query: string, results: any): void {
        const searchKey = `search:${btoa(query)}`;
        this.set(searchKey, results, 2 * 60 * 1000); // 2 minutes for search results
    }

    getCachedSearchResults(query: string): any | null {
        const searchKey = `search:${btoa(query)}`;
        return this.get(searchKey);
    }

    // Invalidation methods
    invalidateConversation(conversationId: string): void {
        this.delete(`conversation:${conversationId}`);

        // Also invalidate related message lists
        const keysToDelete: string[] = [];
        for (const key of Array.from(this.cache.keys())) {
            if (key.startsWith(`messages:${conversationId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.delete(key));
    }

    invalidateMessage(messageId: string): void {
        this.delete(`message:${messageId}`);
    }

    invalidateUserNotifications(userId: string): void {
        this.delete(`notifications:${userId}`);
    }

    invalidateSearchResults(): void {
        const keysToDelete: string[] = [];
        for (const key of Array.from(this.cache.keys())) {
            if (key.startsWith('search:')) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.delete(key));
    }
}

// Create singleton instance
export const communicationCache = new CommunicationCacheService();