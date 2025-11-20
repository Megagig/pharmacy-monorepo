import { useCallback, useRef, useEffect } from 'react';

interface RequestConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    priority?: 'low' | 'normal' | 'high';
    timeout?: number;
    retries?: number;
}

interface QueuedRequest extends RequestConfig {
    id: string;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
    retryCount: number;
}

interface BatchRequest {
    requests: QueuedRequest[];
    timeout: NodeJS.Timeout;
}

/**
 * Hook for managing HTTP request pooling and batching
 */
export const useConnectionPool = (options: {
    maxConcurrent?: number;
    batchSize?: number;
    batchTimeout?: number;
    defaultTimeout?: number;
    defaultRetries?: number;
} = {}) => {
    const {
        maxConcurrent = 6,
        batchSize = 10,
        batchTimeout = 100,
        defaultTimeout = 30000,
        defaultRetries = 3,
    } = options;

    const activeRequests = useRef(new Set<string>());
    const requestQueue = useRef<QueuedRequest[]>([]);
    const batchQueue = useRef<QueuedRequest[]>([]);
    const batchTimeout = useRef<NodeJS.Timeout | null>(null);
    const requestCounter = useRef(0);

    // Process the request queue
    const processQueue = useCallback(() => {
        while (
            activeRequests.current.size < maxConcurrent &&
            requestQueue.current.length > 0
        ) {
            // Sort by priority and timestamp
            requestQueue.current.sort((a, b) => {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                const aPriority = priorityOrder[a.priority || 'normal'];
                const bPriority = priorityOrder[b.priority || 'normal'];

                if (aPriority !== bPriority) {
                    return bPriority - aPriority; // Higher priority first
                }

                return a.timestamp - b.timestamp; // Earlier timestamp first
            });

            const request = requestQueue.current.shift()!;
            activeRequests.current.add(request.id);
            executeRequest(request);
        }
    }, [maxConcurrent]);

    // Execute a single request
    const executeRequest = useCallback(async (request: QueuedRequest) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, request.timeout || defaultTimeout);

        try {
            const headers = {
                'Content-Type': 'application/json',
                ...request.headers,
            };

            // Add auth token if available
            const token = localStorage.getItem('token');
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const fetchOptions: RequestInit = {
                method: request.method || 'GET',
                headers,
                signal: controller.signal,
            };

            if (request.body && request.method !== 'GET') {
                fetchOptions.body = typeof request.body === 'string'
                    ? request.body
                    : JSON.stringify(request.body);
            }

            const response = await fetch(request.url, fetchOptions);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            let data;

            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else if (contentType?.includes('text/')) {
                data = await response.text();
            } else {
                data = await response.blob();
            }

            request.resolve(data);
        } catch (error) {
            clearTimeout(timeoutId);

            // Retry logic
            if (
                request.retryCount < (request.retries || defaultRetries) &&
                (error as Error).name !== 'AbortError'
            ) {
                request.retryCount++;

                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, request.retryCount), 10000);

                setTimeout(() => {
                    requestQueue.current.push(request);
                    processQueue();
                }, delay);
            } else {
                request.reject(error);
            }
        } finally {
            activeRequests.current.delete(request.id);
            processQueue();
        }
    }, [defaultTimeout, defaultRetries, processQueue]);

    // Process batch requests
    const processBatch = useCallback(() => {
        if (batchQueue.current.length === 0) return;

        const requests = batchQueue.current.splice(0, batchSize);

        // Group requests by endpoint for potential batching
        const groupedRequests = requests.reduce((groups, request) => {
            const baseUrl = request.url.split('?')[0];
            if (!groups[baseUrl]) {
                groups[baseUrl] = [];
            }
            groups[baseUrl].push(request);
            return groups;
        }, {} as Record<string, QueuedRequest[]>);

        // Process each group
        Object.values(groupedRequests).forEach(group => {
            if (group.length === 1 || !canBatchRequests(group)) {
                // Process individually
                group.forEach(request => {
                    requestQueue.current.push(request);
                });
            } else {
                // Process as batch
                processBatchedRequests(group);
            }
        });

        processQueue();
    }, [batchSize, processQueue]);

    // Check if requests can be batched
    const canBatchRequests = useCallback((requests: QueuedRequest[]): boolean => {
        // Only batch GET requests to the same endpoint
        return requests.every(req =>
            req.method === 'GET' || !req.method
        ) && requests.length > 1;
    }, []);

    // Process batched requests
    const processBatchedRequests = useCallback(async (requests: QueuedRequest[]) => {
        try {
            // Create batch request
            const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            activeRequests.current.add(batchId);

            const batchUrl = requests[0].url.split('?')[0] + '/batch';
            const batchBody = {
                requests: requests.map(req => ({
                    id: req.id,
                    url: req.url,
                    method: req.method || 'GET',
                    headers: req.headers,
                })),
            };

            const response = await fetch(batchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(batchBody),
            });

            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.statusText}`);
            }

            const batchResult = await response.json();

            // Resolve individual requests
            requests.forEach(request => {
                const result = batchResult.responses?.find((r: any) => r.id === request.id);
                if (result) {
                    if (result.success) {
                        request.resolve(result.data);
                    } else {
                        request.reject(new Error(result.error));
                    }
                } else {
                    request.reject(new Error('No response in batch result'));
                }
            });

            activeRequests.current.delete(batchId);
        } catch (error) {
            // Fall back to individual requests
            requests.forEach(request => {
                requestQueue.current.push(request);
            });
            processQueue();
        }
    }, [processQueue]);

    // Schedule batch processing
    const scheduleBatch = useCallback(() => {
        if (batchTimeout.current) {
            clearTimeout(batchTimeout.current);
        }

        batchTimeout.current = setTimeout(() => {
            processBatch();
            batchTimeout.current = null;
        }, batchTimeout);
    }, [processBatch, batchTimeout]);

    // Main request function
    const request = useCallback(<T = any>(config: RequestConfig): Promise<T> => {
        return new Promise((resolve, reject) => {
            const requestId = `req_${++requestCounter.current}`;

            const queuedRequest: QueuedRequest = {
                ...config,
                id: requestId,
                resolve,
                reject,
                timestamp: Date.now(),
                retryCount: 0,
            };

            // Add to batch queue for GET requests, direct queue for others
            if (!config.method || config.method === 'GET') {
                batchQueue.current.push(queuedRequest);
                scheduleBatch();
            } else {
                requestQueue.current.push(queuedRequest);
                processQueue();
            }
        });
    }, [processQueue, scheduleBatch]);

    // Convenience methods
    const get = useCallback(<T = any>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> => {
        return request<T>({ ...config, url, method: 'GET' });
    }, [request]);

    const post = useCallback(<T = any>(url: string, body?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> => {
        return request<T>({ ...config, url, method: 'POST', body });
    }, [request]);

    const put = useCallback(<T = any>(url: string, body?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> => {
        return request<T>({ ...config, url, method: 'PUT', body });
    }, [request]);

    const del = useCallback(<T = any>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<T> => {
        return request<T>({ ...config, url, method: 'DELETE' });
    }, [request]);

    const patch = useCallback(<T = any>(url: string, body?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<T> => {
        return request<T>({ ...config, url, method: 'PATCH', body });
    }, [request]);

    // Get pool statistics
    const getStats = useCallback(() => {
        return {
            activeRequests: activeRequests.current.size,
            queuedRequests: requestQueue.current.length,
            batchedRequests: batchQueue.current.length,
            maxConcurrent,
        };
    }, [maxConcurrent]);

    // Clear all queues
    const clearQueues = useCallback(() => {
        requestQueue.current = [];
        batchQueue.current = [];
        if (batchTimeout.current) {
            clearTimeout(batchTimeout.current);
            batchTimeout.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearQueues();
        };
    }, [clearQueues]);

    return {
        request,
        get,
        post,
        put,
        delete: del,
        patch,
        getStats,
        clearQueues,
    };
};