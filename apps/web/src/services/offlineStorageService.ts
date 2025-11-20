import { Message, Conversation, CommunicationNotification } from '../stores/types';

interface OfflineMessage extends Message {
    isOffline: boolean;
    syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
    retryCount: number;
    lastRetryAt?: string;
}

interface OfflineAction {
    id: string;
    type: 'send_message' | 'edit_message' | 'delete_message' | 'mark_read' | 'add_reaction';
    data: any;
    timestamp: string;
    retryCount: number;
    maxRetries: number;
}

/**
 * Service for managing offline storage and synchronization
 */
export class OfflineStorageService {
    private dbName = 'CommunicationHubDB';
    private dbVersion = 1;
    private db: IDBDatabase | null = null;

    constructor() {
        this.initDB();
    }

    /**
     * Initialize IndexedDB
     */
    private async initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object stores
                if (!db.objectStoreNames.contains('conversations')) {
                    const conversationStore = db.createObjectStore('conversations', { keyPath: '_id' });
                    conversationStore.createIndex('workplaceId', 'workplaceId', { unique: false });
                    conversationStore.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
                }

                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: '_id' });
                    messageStore.createIndex('conversationId', 'conversationId', { unique: false });
                    messageStore.createIndex('createdAt', 'createdAt', { unique: false });
                    messageStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                if (!db.objectStoreNames.contains('notifications')) {
                    const notificationStore = db.createObjectStore('notifications', { keyPath: '_id' });
                    notificationStore.createIndex('userId', 'userId', { unique: false });
                    notificationStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('offlineActions')) {
                    const actionStore = db.createObjectStore('offlineActions', { keyPath: 'id' });
                    actionStore.createIndex('timestamp', 'timestamp', { unique: false });
                    actionStore.createIndex('type', 'type', { unique: false });
                }

                if (!db.objectStoreNames.contains('fileCache')) {
                    const fileStore = db.createObjectStore('fileCache', { keyPath: 'id' });
                    fileStore.createIndex('conversationId', 'conversationId', { unique: false });
                    fileStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                }
            };
        });
    }

    /**
     * Store conversation offline
     */
    async storeConversation(conversation: Conversation): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');

            const request = store.put({
                ...conversation,
                cachedAt: new Date().toISOString(),
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get stored conversations
     */
    async getStoredConversations(workplaceId: string): Promise<Conversation[]> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const index = store.index('workplaceId');

            const request = index.getAll(workplaceId);

            request.onsuccess = () => {
                const conversations = request.result || [];
                // Sort by lastMessageAt descending
                conversations.sort((a, b) =>
                    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
                );
                resolve(conversations);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Store message offline
     */
    async storeMessage(message: Message, isOffline: boolean = false): Promise<void> {
        if (!this.db) await this.initDB();

        const offlineMessage: OfflineMessage = {
            ...message,
            isOffline,
            syncStatus: isOffline ? 'pending' : 'synced',
            retryCount: 0,
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');

            const request = store.put(offlineMessage);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get stored messages for a conversation
     */
    async getStoredMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('conversationId');

            const request = index.getAll(conversationId);

            request.onsuccess = () => {
                const messages = request.result || [];
                // Sort by createdAt ascending and limit
                messages.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                resolve(messages.slice(-limit));
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get pending offline messages
     */
    async getPendingMessages(): Promise<OfflineMessage[]> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const index = store.index('syncStatus');

            const request = index.getAll('pending');

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update message sync status
     */
    async updateMessageSyncStatus(
        messageId: string,
        status: OfflineMessage['syncStatus'],
        retryCount?: number
    ): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['messages'], 'readwrite');
            const store = transaction.objectStore('messages');

            const getRequest = store.get(messageId);

            getRequest.onsuccess = () => {
                const message = getRequest.result;
                if (message) {
                    message.syncStatus = status;
                    if (retryCount !== undefined) {
                        message.retryCount = retryCount;
                        message.lastRetryAt = new Date().toISOString();
                    }

                    const putRequest = store.put(message);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Store offline action for later sync
     */
    async storeOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
        if (!this.db) await this.initDB();

        const offlineAction: OfflineAction = {
            ...action,
            id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            retryCount: 0,
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
            const store = transaction.objectStore('offlineActions');

            const request = store.put(offlineAction);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get pending offline actions
     */
    async getPendingActions(): Promise<OfflineAction[]> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['offlineActions'], 'readonly');
            const store = transaction.objectStore('offlineActions');

            const request = store.getAll();

            request.onsuccess = () => {
                const actions = request.result || [];
                // Sort by timestamp ascending
                actions.sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                resolve(actions);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove offline action after successful sync
     */
    async removeOfflineAction(actionId: string): Promise<void> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
            const store = transaction.objectStore('offlineActions');

            const request = store.delete(actionId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache file data for offline access
     */
    async cacheFile(fileId: string, conversationId: string, blob: Blob, metadata: any): Promise<void> {
        if (!this.db) await this.initDB();

        const fileData = {
            id: fileId,
            conversationId,
            blob,
            metadata,
            cachedAt: new Date().toISOString(),
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['fileCache'], 'readwrite');
            const store = transaction.objectStore('fileCache');

            const request = store.put(fileData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached file
     */
    async getCachedFile(fileId: string): Promise<{ blob: Blob; metadata: any } | null> {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['fileCache'], 'readonly');
            const store = transaction.objectStore('fileCache');

            const request = store.get(fileId);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve({ blob: result.blob, metadata: result.metadata });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clean up old cached data
     */
    async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
        if (!this.db) await this.initDB();

        const cutoffDate = new Date(Date.now() - maxAge).toISOString();

        // Clean up old file cache
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['fileCache'], 'readwrite');
            const store = transaction.objectStore('fileCache');
            const index = store.index('cachedAt');

            const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{
        conversations: number;
        messages: number;
        notifications: number;
        pendingActions: number;
        cachedFiles: number;
    }> {
        if (!this.db) await this.initDB();

        const stats = {
            conversations: 0,
            messages: 0,
            notifications: 0,
            pendingActions: 0,
            cachedFiles: 0,
        };

        const stores = ['conversations', 'messages', 'notifications', 'offlineActions', 'fileCache'];
        const keys = ['conversations', 'messages', 'notifications', 'pendingActions', 'cachedFiles'] as const;

        for (let i = 0; i < stores.length; i++) {
            const count = await new Promise<number>((resolve, reject) => {
                const transaction = this.db!.transaction([stores[i]], 'readonly');
                const store = transaction.objectStore(stores[i]);
                const request = store.count();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            stats[keys[i]] = count;
        }

        return stats;
    }
}

// Create singleton instance
export const offlineStorage = new OfflineStorageService();