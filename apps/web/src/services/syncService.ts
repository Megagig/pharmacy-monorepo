/**
 * Synchronization service for offline/online data sync
 * Handles queuing offline changes and syncing when connection is restored
 */

import { offlineStorage } from '../utils/offlineStorage';
import { mtrService } from './mtrService';
import { patientService } from './patientService';

interface SyncResult {
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
}

class SyncService {
    private isOnline = navigator.onLine;
    private syncInProgress = false;
    private syncListeners: Array<(result: SyncResult) => void> = [];
    private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        this.setupEventListeners();
        this.startPeriodicSync();
    }

    private setupEventListeners(): void {
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    private handleOnline(): void {
        this.isOnline = true;

        this.syncAll();
    }

    private handleOffline(): void {
        this.isOnline = false;

    }

    private startPeriodicSync(): void {
        // Sync every 5 minutes when online
        setInterval(() => {
            if (this.isOnline && !this.syncInProgress) {
                this.syncAll();
            }
        }, 5 * 60 * 1000);
    }

    // Add sync listener
    onSync(callback: (result: SyncResult) => void): () => void {
        this.syncListeners.push(callback);
        return () => {
            const index = this.syncListeners.indexOf(callback);
            if (index > -1) {
                this.syncListeners.splice(index, 1);
            }
        };
    }

    private notifySyncListeners(result: SyncResult): void {
        this.syncListeners.forEach(callback => {
            try {
                callback(result);
            } catch (error) {
                console.error('Sync listener error:', error);
            }
        });
    }

    // Queue operations for offline sync
    async queueCreate(entity: string, data: unknown): Promise<void> {
        await offlineStorage.addToSyncQueue({
            type: 'create',
            entity: entity as string,
            data,
        });
    }

    async queueUpdate(entity: string, data: unknown): Promise<void> {
        await offlineStorage.addToSyncQueue({
            type: 'update',
            entity: entity as string,
            data,
        });
    }

    async queueDelete(entity: string, id: string): Promise<void> {
        await offlineStorage.addToSyncQueue({
            type: 'delete',
            entity: entity as string,
            data: { id },
        });
    }

    // Main sync function
    async syncAll(): Promise<SyncResult> {
        if (this.syncInProgress || !this.isOnline) {
            return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] };
        }

        this.syncInProgress = true;
        const result: SyncResult = {
            success: true,
            synced: 0,
            failed: 0,
            errors: [],
        };

        try {
            const syncQueue = await offlineStorage.getSyncQueue();

            for (const item of syncQueue) {
                try {
                    await this.syncItem(item);
                    await offlineStorage.removeSyncQueueItem(item.id);
                    result.synced++;
                } catch (error) {
                    console.error(`Failed to sync item ${item.id}:`, error);
                    result.failed++;
                    result.errors.push(`${item.entity} ${item.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);

                    // Update retry count
                    item.retryCount++;
                    if (item.retryCount < 3) {
                        await offlineStorage.updateSyncQueueItem(item);
                        this.scheduleRetry(item);
                    } else {
                        // Remove after 3 failed attempts
                        await offlineStorage.removeSyncQueueItem(item.id);
                        result.errors.push(`${item.entity} ${item.type}: Max retries exceeded, item removed`);
                    }
                }
            }

            if (result.failed > 0) {
                result.success = false;
            }

        } catch (error) {
            console.error('Sync process error:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
        } finally {
            this.syncInProgress = false;
            this.notifySyncListeners(result);
        }

        return result;
    }

    private async syncItem(item: unknown): Promise<void> {
        switch (item.entity) {
            case 'patients':
                await this.syncPatient(item);
                break;
            case 'medications':
                await this.syncMedication(item);
                break;
            case 'problems':
                await this.syncProblem(item);
                break;
            case 'therapyPlans':
                await this.syncTherapyPlan(item);
                break;
            case 'interventions':
                await this.syncIntervention(item);
                break;
            case 'followUps':
                await this.syncFollowUp(item);
                break;
            default:
                throw new Error(`Unknown entity type: ${item.entity}`);
        }
    }

    private async syncPatient(item: unknown): Promise<void> {
        switch (item.type) {
            case 'create':
                await patientService.createPatient(item.data);
                break;
            case 'update':
                await patientService.updatePatient(item.data._id, item.data);
                break;
            case 'delete':
                await patientService.deletePatient(item.data.id);
                break;
        }
    }

    private async syncMedication(item: unknown): Promise<void> {
        // Medications are typically part of MTR data, sync through MTR service
        switch (item.type) {
            case 'create':
            case 'update':
                // Update the entire MTR with new medication data
                // This would need to be implemented based on your MTR API structure

                break;
            case 'delete':

                break;
        }
    }

    private async syncProblem(item: unknown): Promise<void> {
        switch (item.type) {
            case 'create':
                await mtrService.addProblem(item.data);
                break;
            case 'update':
                await mtrService.updateProblem(item.data._id, item.data);
                break;
            case 'delete':
                await mtrService.deleteProblem(item.data.id);
                break;
        }
    }

    private async syncTherapyPlan(item: unknown): Promise<void> {
        switch (item.type) {
            case 'create':
                await mtrService.createPlan(item.data);
                break;
            case 'update':
                await mtrService.updatePlan(item.data.id, item.data);
                break;
            case 'delete':

                break;
        }
    }

    private async syncIntervention(item: unknown): Promise<void> {
        switch (item.type) {
            case 'create':
                await mtrService.recordIntervention(item.data);
                break;
            case 'update':
                await mtrService.updateIntervention(item.data._id, item.data);
                break;
            case 'delete':

                break;
        }
    }

    private async syncFollowUp(item: unknown): Promise<void> {
        switch (item.type) {
            case 'create':
                await mtrService.scheduleFollowUp(item.data);
                break;
            case 'update':
                await mtrService.updateFollowUp(item.data._id, item.data);
                break;
            case 'delete':

                break;
        }
    }

    private scheduleRetry(item: unknown): void {
        // Clear existing timeout
        const existingTimeout = this.retryTimeouts.get(item.id);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Schedule retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, item.retryCount), 30000); // Max 30 seconds
        const timeout = setTimeout(async () => {
            if (this.isOnline && !this.syncInProgress) {
                try {
                    await this.syncItem(item);
                    await offlineStorage.removeSyncQueueItem(item.id);

                } catch (error) {
                    console.error(`Retry failed for item ${item.id}:`, error);
                    item.retryCount++;
                    if (item.retryCount < 3) {
                        await offlineStorage.updateSyncQueueItem(item);
                        this.scheduleRetry(item);
                    } else {
                        await offlineStorage.removeSyncQueueItem(item.id);
                    }
                }
            }
            this.retryTimeouts.delete(item.id);
        }, delay);

        this.retryTimeouts.set(item.id, timeout);
    }

    // Manual sync trigger
    async forcSync(): Promise<SyncResult> {
        return this.syncAll();
    }

    // Get sync status
    async getSyncStatus(): Promise<{
        isOnline: boolean;
        syncInProgress: boolean;
        queueLength: number;
        lastSync?: Date;
    }> {
        const queue = await offlineStorage.getSyncQueue();
        return {
            isOnline: this.isOnline,
            syncInProgress: this.syncInProgress,
            queueLength: queue.length,
            // lastSync would be stored in localStorage or similar
        };
    }

    // Clear sync queue (for testing or reset)
    async clearSyncQueue(): Promise<void> {
        const queue = await offlineStorage.getSyncQueue();
        for (const item of queue) {
            await offlineStorage.removeSyncQueueItem(item.id);
        }
    }

    // Cleanup
    destroy(): void {
        window.removeEventListener('online', this.handleOnline.bind(this));
        window.removeEventListener('offline', this.handleOffline.bind(this));

        // Clear all retry timeouts
        this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
        this.retryTimeouts.clear();
    }
}

// Create singleton instance
export const syncService = new SyncService();

export default syncService;