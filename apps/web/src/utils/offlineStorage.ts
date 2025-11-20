/**
 * Offline Storage Utility for Clinical Interventions
 * Handles caching of intervention forms and data for offline use
 */

interface OfflineIntervention {
  id: string;
  data: any;
  authToken: string;
  timestamp: number;
  type: 'create' | 'update';
}

interface OfflineCache {
  patients: any[];
  strategies: any[];
  lastUpdated: number;
}

class OfflineStorageManager {
  private dbName = 'ClinicalInterventionsDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  // Initialize IndexedDB
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
        if (!db.objectStoreNames.contains('offlineInterventions')) {
          db.createObjectStore('offlineInterventions', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('offlineCache')) {
          db.createObjectStore('offlineCache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('formDrafts')) {
          db.createObjectStore('formDrafts', { keyPath: 'id' });
        }

      };
    });
  }

  // Ensure DB is initialized
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  // Store intervention for offline sync
  async storeOfflineIntervention(
    interventionData: any,
    authToken: string,
    type: 'create' | 'update' = 'create'
  ): Promise<string> {
    const db = await this.ensureDB();
    const id = `offline_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const offlineIntervention: OfflineIntervention = {
      id,
      data: interventionData,
      authToken,
      timestamp: Date.now(),
      type,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineInterventions'], 'readwrite');
      const store = transaction.objectStore('offlineInterventions');
      const request = store.add(offlineIntervention);

      request.onsuccess = () => {

        resolve(id);
      };

      request.onerror = () => {
        console.error('Failed to store offline intervention:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all offline interventions
  async getOfflineInterventions(): Promise<OfflineIntervention[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineInterventions'], 'readonly');
      const store = transaction.objectStore('offlineInterventions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove offline intervention after successful sync
  async removeOfflineIntervention(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineInterventions'], 'readwrite');
      const store = transaction.objectStore('offlineInterventions');
      const request = store.delete(id);

      request.onsuccess = () => {

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Cache frequently used data for offline access
  async cacheData(key: string, data: any): Promise<void> {
    const db = await this.ensureDB();

    const cacheEntry = {
      key,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineCache'], 'readwrite');
      const store = transaction.objectStore('offlineCache');
      const request = store.put(cacheEntry);

      request.onsuccess = () => {

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  async getCachedData(
    key: string,
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<any> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offlineCache'], 'readonly');
      const store = transaction.objectStore('offlineCache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if data is still fresh
        const age = Date.now() - result.timestamp;
        if (age > maxAge) {

          resolve(null);
          return;
        }

        resolve(result.data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Save form draft
  async saveFormDraft(formId: string, formData: any): Promise<void> {
    const db = await this.ensureDB();

    const draft = {
      id: formId,
      data: formData,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['formDrafts'], 'readwrite');
      const store = transaction.objectStore('formDrafts');
      const request = store.put(draft);

      request.onsuccess = () => {

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get form draft
  async getFormDraft(formId: string): Promise<any> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['formDrafts'], 'readonly');
      const store = transaction.objectStore('formDrafts');
      const request = store.get(formId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Remove form draft
  async removeFormDraft(formId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['formDrafts'], 'readwrite');
      const store = transaction.objectStore('formDrafts');
      const request = store.delete(formId);

      request.onsuccess = () => {

        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all offline data
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();

    const storeNames = ['offlineInterventions', 'offlineCache', 'formDrafts'];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');

      let completed = 0;
      const total = storeNames.length;

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          completed++;
          if (completed === total) {

            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{
    offlineInterventions: number;
    formDrafts: number;
    cacheEntries: number;
  }> {
    const db = await this.ensureDB();

    const stats = {
      offlineInterventions: 0,
      formDrafts: 0,
      cacheEntries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        ['offlineInterventions', 'formDrafts', 'offlineCache'],
        'readonly'
      );

      let completed = 0;
      const total = 3;

      // Count offline interventions
      const interventionsStore = transaction.objectStore(
        'offlineInterventions'
      );
      const interventionsRequest = interventionsStore.count();
      interventionsRequest.onsuccess = () => {
        stats.offlineInterventions = interventionsRequest.result;
        completed++;
        if (completed === total) resolve(stats);
      };

      // Count form drafts
      const draftsStore = transaction.objectStore('formDrafts');
      const draftsRequest = draftsStore.count();
      draftsRequest.onsuccess = () => {
        stats.formDrafts = draftsRequest.result;
        completed++;
        if (completed === total) resolve(stats);
      };

      // Count cache entries
      const cacheStore = transaction.objectStore('offlineCache');
      const cacheRequest = cacheStore.count();
      cacheRequest.onsuccess = () => {
        stats.cacheEntries = cacheRequest.result;
        completed++;
        if (completed === total) resolve(stats);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Get sync queue items
  async getSyncQueue(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.warn('Database not initialized, returning empty sync queue');
        resolve([]);
        return;
      }

      try {
        const transaction = this.db.transaction(
          ['offlineInterventions'],
          'readonly'
        );
        const store = transaction.objectStore('offlineInterventions');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
          console.error('Error getting sync queue:', request.error);
          reject(request.error);
        };

        transaction.onerror = () => {
          console.error(
            'Transaction error getting sync queue:',
            transaction.error
          );
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Error in getSyncQueue method:', error);
        resolve([]); // Return empty array on error to prevent crashes
      }
    });
  }

  // Remove item from sync queue
  async removeSyncQueueItem(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      try {
        const transaction = this.db.transaction(
          ['offlineInterventions'],
          'readwrite'
        );
        const store = transaction.objectStore('offlineInterventions');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        console.error('Error removing item from sync queue:', error);
        reject(error);
      }
    });
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorageManager();

// Utility functions for common operations
export const offlineUtils = {
  // Check if browser supports offline features
  isOfflineSupported(): boolean {
    return 'serviceWorker' in navigator && 'indexedDB' in window;
  },

  // Check if currently online
  isOnline(): boolean {
    return navigator.onLine;
  },

  // Register service worker
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Listen for updates
      registration.addEventListener('updatefound', () => {

      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  },

  // Request background sync
  async requestBackgroundSync(tag: string): Promise<void> {
    if (
      !('serviceWorker' in navigator) ||
      !('sync' in window.ServiceWorkerRegistration.prototype)
    ) {
      console.warn('Background Sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);

    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  },

  // Show offline notification
  showOfflineNotification(
    message: string = 'You are currently offline. Data will sync when connection is restored.'
  ): void {
    // This would integrate with your notification system

  },

  // Cache essential data for offline use
  async cacheEssentialData(): Promise<void> {
    try {
      // Cache intervention categories and strategies
      const categories = Object.keys({
        drug_therapy_problem: 'Drug Therapy Problem',
        adverse_drug_reaction: 'Adverse Drug Reaction',
        medication_nonadherence: 'Medication Non-adherence',
        drug_interaction: 'Drug Interaction',
        dosing_issue: 'Dosing Issue',
        contraindication: 'Contraindication',
        other: 'Other',
      });

      await offlineStorage.cacheData('intervention_categories', categories);

      const strategies = [
        'medication_review',
        'dose_adjustment',
        'alternative_therapy',
        'discontinuation',
        'additional_monitoring',
        'patient_counseling',
        'physician_consultation',
        'custom',
      ];

      await offlineStorage.cacheData('intervention_strategies', strategies);

    } catch (error) {
      console.error('Failed to cache essential data:', error);
    }
  },
};

export default offlineStorage;
