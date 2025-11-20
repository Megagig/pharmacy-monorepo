import { api } from '../lib/api';

/**
 * Queue Monitoring Service
 * Handles job queue monitoring, management, and health checks
 */

// Types
export interface QueueStats {
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
}

export interface QueueMetrics {
    queueName: string;
    stats: QueueStats;
    throughput: {
        current: number;
        average: number;
        peak: number;
    };
    latency: {
        current: number;
        average: number;
        p95: number;
        p99: number;
    };
    errorRate: number;
    lastProcessedJob?: {
        id: string;
        timestamp: Date;
        duration: number;
    };
}

export interface QueueHealth {
    queueName: string;
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: {
        backlog: number;
        processingRate: number;
        errorRate: number;
        avgWaitTime: number;
    };
}

export interface Job {
    id: string;
    queueName: string;
    name: string;
    data: any;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
    progress: number;
    attempts: number;
    maxAttempts: number;
    error?: string;
    stackTrace?: string;
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
}

export interface QueueDashboard {
    overview: {
        totalQueues: number;
        healthyQueues: number;
        warningQueues: number;
        criticalQueues: number;
        totalJobs: number;
        activeJobs: number;
        failedJobs: number;
    };
    queues: Array<{
        name: string;
        stats: QueueStats;
        health: 'healthy' | 'warning' | 'critical';
    }>;
}

class QueueMonitoringService {
    private baseUrl = '/queue-monitoring';

    /**
     * Get queue dashboard with all statistics
     */
    async getQueueDashboard(): Promise<QueueDashboard> {
        const response = await api.get(`${this.baseUrl}/dashboard`);
        return response.data;
    }

    /**
     * Get statistics for all queues
     */
    async getAllQueueStats(): Promise<{ queues: QueueStats[] }> {
        const response = await api.get(`${this.baseUrl}/stats`);
        return response.data;
    }

    /**
     * Get health status for all queues
     */
    async getAllQueuesHealth(): Promise<{ queues: QueueHealth[] }> {
        const response = await api.get(`${this.baseUrl}/health`);
        return response.data;
    }

    /**
     * Get statistics for a specific queue
     */
    async getQueueStats(queueName: string): Promise<QueueStats> {
        const response = await api.get(`${this.baseUrl}/${queueName}/stats`);
        return response.data;
    }

    /**
     * Get detailed metrics for a specific queue
     */
    async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
        const response = await api.get(`${this.baseUrl}/${queueName}/metrics`);
        return response.data;
    }

    /**
     * Get health status for a specific queue
     */
    async getQueueHealth(queueName: string): Promise<QueueHealth> {
        const response = await api.get(`${this.baseUrl}/${queueName}/health`);
        return response.data;
    }

    /**
     * Pause a queue
     */
    async pauseQueue(queueName: string): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/${queueName}/pause`);
        return response.data;
    }

    /**
     * Resume a queue
     */
    async resumeQueue(queueName: string): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/${queueName}/resume`);
        return response.data;
    }

    /**
     * Clean a queue (remove old jobs)
     */
    async cleanQueue(queueName: string, options?: {
        grace?: number;
        status?: 'completed' | 'failed';
        limit?: number;
    }): Promise<{ success: boolean; removed: number }> {
        const response = await api.post(`${this.baseUrl}/${queueName}/clean`, options);
        return response.data;
    }

    /**
     * Empty a queue (remove all jobs)
     */
    async emptyQueue(queueName: string): Promise<{ success: boolean; removed: number }> {
        const response = await api.post(`${this.baseUrl}/${queueName}/empty`);
        return response.data;
    }

    /**
     * Get a specific job
     */
    async getJob(queueName: string, jobId: string): Promise<Job> {
        const response = await api.get(`${this.baseUrl}/${queueName}/jobs/${jobId}`);
        return response.data;
    }

    /**
     * Retry a failed job
     */
    async retryJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
        const response = await api.post(`${this.baseUrl}/${queueName}/jobs/${jobId}/retry`);
        return response.data;
    }

    /**
     * Remove a job
     */
    async removeJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
        const response = await api.delete(`${this.baseUrl}/${queueName}/jobs/${jobId}`);
        return response.data;
    }
}

export default new QueueMonitoringService();
