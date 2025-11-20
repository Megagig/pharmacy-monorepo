// Connection Pooling and Load Balancing Service
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';

interface ConnectionConfig {
    uri: string;
    options: mongoose.ConnectOptions;
    weight: number; // For load balancing
    maxConnections: number;
    currentConnections: number;
    isHealthy: boolean;
    lastHealthCheck: Date;
}

interface PoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    pendingConnections: number;
    connectionErrors: number;
    avgResponseTime: number;
}

/**
 * Connection pooling and load balancing service for MongoDB
 */
export class ConnectionPoolService {
    private static instance: ConnectionPoolService;
    private connections: Map<string, mongoose.Connection> = new Map();
    private connectionConfigs: Map<string, ConnectionConfig> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private stats: PoolStats = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        pendingConnections: 0,
        connectionErrors: 0,
        avgResponseTime: 0,
    };
    private responseTimes: number[] = [];

    static getInstance(): ConnectionPoolService {
        if (!ConnectionPoolService.instance) {
            ConnectionPoolService.instance = new ConnectionPoolService();
        }
        return ConnectionPoolService.instance;
    }

    /**
     * Initialize connection pool with multiple database instances
     */
    async initializePool(): Promise<void> {
        logger.info('Initializing MongoDB connection pool...');

        try {
            // Primary database connection
            await this.addConnection('primary', {
                uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db',
                options: {
                    maxPoolSize: 20, // Maximum number of connections
                    minPoolSize: 5,  // Minimum number of connections
                    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
                    serverSelectionTimeoutMS: 5000, // How long to try selecting a server
                    socketTimeoutMS: 45000, // How long a send or receive on a socket can take
                    bufferCommands: false, // Disable mongoose buffering
                    heartbeatFrequencyMS: 10000, // Frequency of heartbeat checks
                    retryWrites: true,
                    retryReads: true,
                    readPreference: 'primary',
                    writeConcern: {
                        w: 'majority',
                        j: true, // Wait for journal acknowledgment
                        wtimeout: 5000,
                    },
                    readConcern: {
                        level: 'majority',
                    },
                },
                weight: 100,
                maxConnections: 20,
                currentConnections: 0,
                isHealthy: true,
                lastHealthCheck: new Date(),
            });

            // Read replica connections (if available)
            if (process.env.MONGODB_READ_REPLICA_URI) {
                await this.addConnection('read-replica', {
                    uri: process.env.MONGODB_READ_REPLICA_URI,
                    options: {
                        maxPoolSize: 15,
                        minPoolSize: 3,
                        maxIdleTimeMS: 30000,
                        serverSelectionTimeoutMS: 5000,
                        socketTimeoutMS: 45000,
                        bufferCommands: false,
                        heartbeatFrequencyMS: 10000,
                        retryWrites: false, // Read-only replica
                        retryReads: true,
                        readPreference: 'secondary',
                        readConcern: {
                            level: 'majority',
                        },
                    },
                    weight: 50,
                    maxConnections: 15,
                    currentConnections: 0,
                    isHealthy: true,
                    lastHealthCheck: new Date(),
                });
            }

            // Analytics database connection (if separate)
            if (process.env.MONGODB_ANALYTICS_URI) {
                await this.addConnection('analytics', {
                    uri: process.env.MONGODB_ANALYTICS_URI,
                    options: {
                        maxPoolSize: 10,
                        minPoolSize: 2,
                        maxIdleTimeMS: 60000, // Longer idle time for analytics
                        serverSelectionTimeoutMS: 10000,
                        socketTimeoutMS: 60000, // Longer timeout for complex queries
                        bufferCommands: false,
                        heartbeatFrequencyMS: 15000,
                        retryWrites: true,
                        retryReads: true,
                        readPreference: 'secondaryPreferred',
                        readConcern: {
                            level: 'available', // More relaxed for analytics
                        },
                    },
                    weight: 30,
                    maxConnections: 10,
                    currentConnections: 0,
                    isHealthy: true,
                    lastHealthCheck: new Date(),
                });
            }

            // Start health check monitoring
            this.startHealthChecking();

            logger.info(`Connection pool initialized with ${this.connectionConfigs.size} connections`);
        } catch (error) {
            logger.error('Failed to initialize connection pool:', error);
            throw error;
        }
    }

    /**
     * Add a new connection to the pool
     */
    private async addConnection(name: string, config: ConnectionConfig): Promise<void> {
        try {
            const connection = mongoose.createConnection(config.uri, config.options);

            // Set up event handlers
            this.setupConnectionEventHandlers(connection, name);

            // Wait for connection to be ready
            await new Promise<void>((resolve, reject) => {
                connection.once('connected', () => {
                    logger.info(`Connection '${name}' established successfully`);
                    resolve();
                });

                connection.once('error', (error) => {
                    logger.error(`Connection '${name}' failed:`, error);
                    reject(error);
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error(`Connection '${name}' timeout`));
                }, 10000);
            });

            this.connections.set(name, connection);
            this.connectionConfigs.set(name, config);
            this.updateStats();

        } catch (error) {
            logger.error(`Failed to add connection '${name}':`, error);
            throw error;
        }
    }

    /**
     * Get optimal connection based on load balancing
     */
    getConnection(preferredType?: 'read' | 'write' | 'analytics'): mongoose.Connection {
        const startTime = performance.now();

        try {
            let candidates: Array<{ name: string; config: ConnectionConfig; connection: mongoose.Connection }> = [];

            // Filter connections based on preference and health
            for (const [name, config] of this.connectionConfigs.entries()) {
                const connection = this.connections.get(name);
                if (!connection || !config.isHealthy) continue;

                // Apply preference filtering
                if (preferredType === 'read' && name.includes('replica')) {
                    candidates.push({ name, config, connection });
                } else if (preferredType === 'analytics' && name.includes('analytics')) {
                    candidates.push({ name, config, connection });
                } else if (preferredType === 'write' && name === 'primary') {
                    candidates.push({ name, config, connection });
                } else if (!preferredType) {
                    candidates.push({ name, config, connection });
                }
            }

            // Fallback to any healthy connection if no preferred type found
            if (candidates.length === 0) {
                for (const [name, config] of this.connectionConfigs.entries()) {
                    const connection = this.connections.get(name);
                    if (connection && config.isHealthy) {
                        candidates.push({ name, config, connection });
                    }
                }
            }

            if (candidates.length === 0) {
                throw new Error('No healthy database connections available');
            }

            // Load balancing: choose connection with lowest load
            const selected = candidates.reduce((best, current) => {
                const bestLoad = best.config.currentConnections / best.config.maxConnections;
                const currentLoad = current.config.currentConnections / current.config.maxConnections;

                // Consider both load and weight
                const bestScore = bestLoad - (best.config.weight / 100);
                const currentScore = currentLoad - (current.config.weight / 100);

                return currentScore < bestScore ? current : best;
            });

            // Update connection usage
            selected.config.currentConnections++;
            this.updateStats();

            const responseTime = performance.now() - startTime;
            this.trackResponseTime(responseTime);

            logger.debug(`Selected connection '${selected.name}' (load: ${selected.config.currentConnections}/${selected.config.maxConnections})`);

            return selected.connection;

        } catch (error) {
            const responseTime = performance.now() - startTime;
            this.trackResponseTime(responseTime);
            this.stats.connectionErrors++;

            logger.error('Failed to get database connection:', error);
            throw error;
        }
    }

    /**
     * Release connection back to pool
     */
    releaseConnection(connection: mongoose.Connection): void {
        for (const [name, config] of this.connectionConfigs.entries()) {
            const poolConnection = this.connections.get(name);
            if (poolConnection === connection) {
                config.currentConnections = Math.max(0, config.currentConnections - 1);
                this.updateStats();
                break;
            }
        }
    }

    /**
     * Execute operation with automatic connection management
     */
    async executeWithConnection<T>(
        operation: (connection: mongoose.Connection) => Promise<T>,
        preferredType?: 'read' | 'write' | 'analytics'
    ): Promise<T> {
        const connection = this.getConnection(preferredType);

        try {
            const result = await operation(connection);
            return result;
        } finally {
            this.releaseConnection(connection);
        }
    }

    /**
     * Setup connection event handlers
     */
    private setupConnectionEventHandlers(connection: mongoose.Connection, name: string): void {
        connection.on('connected', () => {
            logger.info(`Database connection '${name}' established`);
            const config = this.connectionConfigs.get(name);
            if (config) {
                config.isHealthy = true;
                config.lastHealthCheck = new Date();
            }
        });

        connection.on('error', (error) => {
            logger.error(`Database connection '${name}' error:`, error);
            const config = this.connectionConfigs.get(name);
            if (config) {
                config.isHealthy = false;
            }
            this.stats.connectionErrors++;
        });

        connection.on('disconnected', () => {
            logger.warn(`Database connection '${name}' disconnected`);
            const config = this.connectionConfigs.get(name);
            if (config) {
                config.isHealthy = false;
                config.currentConnections = 0;
            }
        });

        connection.on('reconnected', () => {
            logger.info(`Database connection '${name}' reconnected`);
            const config = this.connectionConfigs.get(name);
            if (config) {
                config.isHealthy = true;
                config.lastHealthCheck = new Date();
            }
        });

        connection.on('close', () => {
            logger.info(`Database connection '${name}' closed`);
            const config = this.connectionConfigs.get(name);
            if (config) {
                config.isHealthy = false;
                config.currentConnections = 0;
            }
        });
    }

    /**
     * Start health checking for all connections
     */
    private startHealthChecking(): void {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthChecks();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Perform health checks on all connections
     */
    private async performHealthChecks(): Promise<void> {
        const healthCheckPromises = Array.from(this.connections.entries()).map(
            async ([name, connection]) => {
                try {
                    // Simple ping to check connection health
                    await connection.db.admin().ping();

                    const config = this.connectionConfigs.get(name);
                    if (config) {
                        config.isHealthy = true;
                        config.lastHealthCheck = new Date();
                    }

                    logger.debug(`Health check passed for connection '${name}'`);
                } catch (error) {
                    logger.warn(`Health check failed for connection '${name}':`, error);

                    const config = this.connectionConfigs.get(name);
                    if (config) {
                        config.isHealthy = false;
                    }
                }
            }
        );

        await Promise.allSettled(healthCheckPromises);
    }

    /**
     * Update pool statistics
     */
    private updateStats(): void {
        let totalConnections = 0;
        let activeConnections = 0;

        for (const config of this.connectionConfigs.values()) {
            totalConnections += config.maxConnections;
            activeConnections += config.currentConnections;
        }

        this.stats.totalConnections = totalConnections;
        this.stats.activeConnections = activeConnections;
        this.stats.idleConnections = totalConnections - activeConnections;
    }

    /**
     * Track response time
     */
    private trackResponseTime(responseTime: number): void {
        this.responseTimes.push(responseTime);

        // Keep only last 1000 measurements
        if (this.responseTimes.length > 1000) {
            this.responseTimes.shift();
        }

        this.stats.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    /**
     * Get pool statistics
     */
    getStats(): PoolStats & { connections: Array<{ name: string; config: ConnectionConfig }> } {
        return {
            ...this.stats,
            connections: Array.from(this.connectionConfigs.entries()).map(([name, config]) => ({
                name,
                config: { ...config },
            })),
        };
    }

    /**
     * Get connection health status
     */
    getHealthStatus(): Record<string, { healthy: boolean; lastCheck: Date; load: number }> {
        const status: Record<string, { healthy: boolean; lastCheck: Date; load: number }> = {};

        for (const [name, config] of this.connectionConfigs.entries()) {
            status[name] = {
                healthy: config.isHealthy,
                lastCheck: config.lastHealthCheck,
                load: config.currentConnections / config.maxConnections,
            };
        }

        return status;
    }

    /**
     * Gracefully close all connections
     */
    async closeAll(): Promise<void> {
        logger.info('Closing all database connections...');

        // Stop health checking
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // Close all connections
        const closePromises = Array.from(this.connections.entries()).map(
            async ([name, connection]) => {
                try {
                    await connection.close();
                    logger.info(`Connection '${name}' closed successfully`);
                } catch (error) {
                    logger.error(`Failed to close connection '${name}':`, error);
                }
            }
        );

        await Promise.allSettled(closePromises);

        // Clear maps
        this.connections.clear();
        this.connectionConfigs.clear();

        logger.info('All database connections closed');
    }

    /**
     * Reconnect failed connections
     */
    async reconnectFailedConnections(): Promise<void> {
        logger.info('Attempting to reconnect failed connections...');

        for (const [name, config] of this.connectionConfigs.entries()) {
            if (!config.isHealthy) {
                try {
                    const connection = this.connections.get(name);
                    if (connection) {
                        await connection.close();
                    }

                    // Create new connection
                    await this.addConnection(name, config);
                    logger.info(`Successfully reconnected '${name}'`);
                } catch (error) {
                    logger.error(`Failed to reconnect '${name}':`, error);
                }
            }
        }
    }
}

export default ConnectionPoolService;
