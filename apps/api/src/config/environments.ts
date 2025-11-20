/**
 * Environment-specific Configuration Management
 * Handles configuration for different deployment environments
 */

import { config as dotenvConfig } from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenvConfig();

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface DatabaseConfig {
    uri: string;
    options: {
        maxPoolSize: number;
        minPoolSize: number;
        maxIdleTimeMS: number;
        serverSelectionTimeoutMS: number;
        socketTimeoutMS: number;
        bufferMaxEntries: number;
        bufferCommands: boolean;
    };
}

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    lazyConnect: boolean;
}

export interface SecurityConfig {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
    rateLimiting: {
        windowMs: number;
        max: number;
        skipSuccessfulRequests: boolean;
    };
    cors: {
        origin: string | string[];
        credentials: boolean;
        optionsSuccessStatus: number;
    };
}

export interface PerformanceConfig {
    enableCaching: boolean;
    cacheDefaultTTL: number;
    enableCompression: boolean;
    enableMetrics: boolean;
    enableProfiling: boolean;
    maxRequestSize: string;
    requestTimeout: number;
}

export interface FeatureFlags {
    enableClinicalInterventions: boolean;
    enableAdvancedReporting: boolean;
    enablePerformanceMonitoring: boolean;
    enableAuditLogging: boolean;
    enableNotifications: boolean;
    enableMTRIntegration: boolean;
    enableBulkOperations: boolean;
    enableExportFeatures: boolean;
}

export interface LoggingConfig {
    level: string;
    format: 'json' | 'simple';
    enableFileLogging: boolean;
    enableConsoleLogging: boolean;
    maxFiles: number;
    maxSize: string;
}

export interface EnvironmentConfig {
    environment: Environment;
    port: number;
    database: DatabaseConfig;
    redis: RedisConfig;
    security: SecurityConfig;
    performance: PerformanceConfig;
    featureFlags: FeatureFlags;
    logging: LoggingConfig;
    monitoring: {
        enableHealthChecks: boolean;
        enableMetrics: boolean;
        enableTracing: boolean;
        metricsPort: number;
    };
    deployment: {
        version: string;
        buildNumber: string;
        deployedAt: string;
        gitCommit: string;
    };
}

/**
 * Get current environment
 */
export const getCurrentEnvironment = (): Environment => {
    const env = process.env.NODE_ENV as Environment;
    if (!['development', 'staging', 'production', 'test'].includes(env)) {
        logger.warn(`Invalid NODE_ENV: ${env}, defaulting to development`);
        return 'development';
    }
    return env;
};

/**
 * Development environment configuration
 */
const developmentConfig: EnvironmentConfig = {
    environment: 'development',
    port: parseInt(process.env.PORT || '5000'),

    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmatech_dev',
        options: {
            maxPoolSize: 5,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        },
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
    },

    security: {
        jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
        jwtExpiresIn: '24h',
        bcryptRounds: 10,
        rateLimiting: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Generous limit for development
            skipSuccessfulRequests: false,
        },
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true,
            optionsSuccessStatus: 200,
        },
    },

    performance: {
        enableCaching: true,
        cacheDefaultTTL: 300, // 5 minutes
        enableCompression: true,
        enableMetrics: true,
        enableProfiling: true,
        maxRequestSize: '10mb',
        requestTimeout: 30000, // 30 seconds
    },

    featureFlags: {
        enableClinicalInterventions: true,
        enableAdvancedReporting: true,
        enablePerformanceMonitoring: true,
        enableAuditLogging: true,
        enableNotifications: true,
        enableMTRIntegration: true,
        enableBulkOperations: true,
        enableExportFeatures: true,
    },

    logging: {
        level: 'debug',
        format: 'simple',
        enableFileLogging: true,
        enableConsoleLogging: true,
        maxFiles: 5,
        maxSize: '10m',
    },

    monitoring: {
        enableHealthChecks: true,
        enableMetrics: true,
        enableTracing: false,
        metricsPort: 9090,
    },

    deployment: {
        version: process.env.APP_VERSION || '1.0.0-dev',
        buildNumber: process.env.BUILD_NUMBER || 'local',
        deployedAt: new Date().toISOString(),
        gitCommit: process.env.GIT_COMMIT || 'unknown',
    },
};

/**
 * Staging environment configuration
 */
const stagingConfig: EnvironmentConfig = {
    ...developmentConfig,
    environment: 'staging',

    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmatech_staging',
        options: {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        },
    },

    security: {
        ...developmentConfig.security,
        jwtSecret: process.env.JWT_SECRET || 'staging-secret-key',
        rateLimiting: {
            windowMs: 15 * 60 * 1000,
            max: 500, // More restrictive than dev
            skipSuccessfulRequests: true,
        },
        cors: {
            origin: process.env.FRONTEND_URL?.split(',') || ['https://staging.pharmatech.com'],
            credentials: true,
            optionsSuccessStatus: 200,
        },
    },

    logging: {
        level: 'info',
        format: 'json',
        enableFileLogging: true,
        enableConsoleLogging: true,
        maxFiles: 10,
        maxSize: '50m',
    },

    monitoring: {
        enableHealthChecks: true,
        enableMetrics: true,
        enableTracing: true,
        metricsPort: 9090,
    },
};

/**
 * Production environment configuration
 */
const productionConfig: EnvironmentConfig = {
    ...stagingConfig,
    environment: 'production',

    database: {
        uri: process.env.MONGODB_URI!,
        options: {
            maxPoolSize: 20,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        },
    },

    security: {
        ...stagingConfig.security,
        jwtSecret: process.env.JWT_SECRET!,
        bcryptRounds: 12, // Higher security in production
        rateLimiting: {
            windowMs: 15 * 60 * 1000,
            max: 100, // Strict rate limiting
            skipSuccessfulRequests: true,
        },
        cors: {
            origin: process.env.FRONTEND_URL?.split(',') || ['https://app.pharmatech.com'],
            credentials: true,
            optionsSuccessStatus: 200,
        },
    },

    performance: {
        ...stagingConfig.performance,
        enableProfiling: false, // Disable profiling in production
        requestTimeout: 15000, // Shorter timeout in production
    },

    featureFlags: {
        enableClinicalInterventions: true,
        enableAdvancedReporting: true,
        enablePerformanceMonitoring: true,
        enableAuditLogging: true,
        enableNotifications: true,
        enableMTRIntegration: true,
        enableBulkOperations: false, // Disable bulk operations in production initially
        enableExportFeatures: true,
    },

    logging: {
        level: 'warn',
        format: 'json',
        enableFileLogging: true,
        enableConsoleLogging: false, // Only file logging in production
        maxFiles: 30,
        maxSize: '100m',
    },
};

/**
 * Test environment configuration
 */
const testConfig: EnvironmentConfig = {
    ...developmentConfig,
    environment: 'test',
    port: parseInt(process.env.TEST_PORT || '5001'),

    database: {
        uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pharmatech_test',
        options: {
            maxPoolSize: 5,
            minPoolSize: 1,
            maxIdleTimeMS: 10000,
            serverSelectionTimeoutMS: 2000,
            socketTimeoutMS: 10000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        },
    },

    performance: {
        ...developmentConfig.performance,
        enableCaching: false, // Disable caching in tests
        enableMetrics: false,
        enableProfiling: false,
    },

    logging: {
        level: 'error', // Minimal logging in tests
        format: 'simple',
        enableFileLogging: false,
        enableConsoleLogging: false,
        maxFiles: 1,
        maxSize: '1m',
    },

    monitoring: {
        enableHealthChecks: false,
        enableMetrics: false,
        enableTracing: false,
        metricsPort: 9091,
    },
};

/**
 * Get configuration for current environment
 */
export const getConfig = (): EnvironmentConfig => {
    const environment = getCurrentEnvironment();

    switch (environment) {
        case 'development':
            return developmentConfig;
        case 'staging':
            return stagingConfig;
        case 'production':
            return productionConfig;
        case 'test':
            return testConfig;
        default:
            logger.warn(`Unknown environment: ${environment}, using development config`);
            return developmentConfig;
    }
};

/**
 * Validate required environment variables
 */
export const validateEnvironmentConfig = (config: EnvironmentConfig): void => {
    const requiredVars: Array<{ key: string; value: any; env: Environment[] }> = [
        { key: 'JWT_SECRET', value: config.security.jwtSecret, env: ['production', 'staging'] },
        { key: 'MONGODB_URI', value: config.database.uri, env: ['production', 'staging'] },
    ];

    const missingVars = requiredVars
        .filter(({ env }) => env.includes(config.environment))
        .filter(({ value }) => !value || value === 'dev-secret-key' || value === 'staging-secret-key')
        .map(({ key }) => key);

    if (missingVars.length > 0) {
        const error = `Missing required environment variables for ${config.environment}: ${missingVars.join(', ')}`;
        logger.error(error);
        throw new Error(error);
    }

    logger.info(`Environment configuration validated for ${config.environment}`);
};

/**
 * Log configuration summary (without sensitive data)
 */
export const logConfigSummary = (config: EnvironmentConfig): void => {
    const summary = {
        environment: config.environment,
        port: config.port,
        database: {
            host: config.database.uri.split('@')[1]?.split('/')[0] || 'localhost',
            poolSize: config.database.options.maxPoolSize,
        },
        redis: {
            host: config.redis.host,
            port: config.redis.port,
            db: config.redis.db,
        },
        features: config.featureFlags,
        logging: {
            level: config.logging.level,
            format: config.logging.format,
        },
        deployment: config.deployment,
    };

    logger.info('Application configuration:', summary);
};

// Export the current configuration
export const config = getConfig();

// Validate configuration on import
validateEnvironmentConfig(config);

// Log configuration summary
logConfigSummary(config);