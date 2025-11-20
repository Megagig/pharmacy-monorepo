import logger from '../../../utils/logger';

/**
 * Deployment Configuration Management
 * Environment-specific configuration for AI diagnostics and external APIs
 */

export interface DeploymentEnvironment {
    name: 'development' | 'staging' | 'production';
    apiEndpoints: {
        openRouter: string;
        rxNorm: string;
        openFDA: string;
        fhir: string;
        loinc: string;
    };
    aiConfig: {
        model: string;
        maxTokens: number;
        temperature: number;
        timeout: number;
        retryAttempts: number;
        rateLimits: {
            requestsPerMinute: number;
            tokensPerHour: number;
        };
    };
    cacheConfig: {
        enabled: boolean;
        maxSize: number;
        defaultTTL: number;
        redisUrl?: string;
    };
    databaseConfig: {
        connectionPoolSize: number;
        queryTimeout: number;
        indexingStrategy: 'background' | 'foreground';
    };
    securityConfig: {
        encryptionEnabled: boolean;
        auditLogging: boolean;
        rateLimitingEnabled: boolean;
        ipWhitelist?: string[];
    };
    monitoringConfig: {
        metricsEnabled: boolean;
        healthCheckInterval: number;
        alertThresholds: {
            responseTime: number;
            errorRate: number;
            memoryUsage: number;
        };
    };
    featureFlags: {
        aiDiagnostics: boolean;
        labIntegration: boolean;
        drugInteractions: boolean;
        fhirIntegration: boolean;
        advancedAnalytics: boolean;
    };
}

class DeploymentConfigManager {
    private currentEnvironment: DeploymentEnvironment['name'];
    private config: DeploymentEnvironment;

    constructor() {
        this.currentEnvironment = this.detectEnvironment();
        this.config = this.loadEnvironmentConfig();
        this.validateConfiguration();
    }

    /**
     * Detect current environment
     */
    private detectEnvironment(): DeploymentEnvironment['name'] {
        const nodeEnv = process.env.NODE_ENV?.toLowerCase();

        if (nodeEnv === 'production') {
            return 'production';
        } else if (nodeEnv === 'staging') {
            return 'staging';
        } else {
            return 'development';
        }
    }

    /**
     * Load environment-specific configuration
     */
    private loadEnvironmentConfig(): DeploymentEnvironment {
        const baseConfig = this.getBaseConfiguration();
        const envOverrides = this.getEnvironmentOverrides();

        return {
            ...baseConfig,
            ...envOverrides,
            name: this.currentEnvironment,
        };
    }

    /**
     * Get base configuration (common across all environments)
     */
    private getBaseConfiguration(): Omit<DeploymentEnvironment, 'name'> {
        return {
            apiEndpoints: {
                openRouter: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1',
                rxNorm: process.env.RXNORM_API_URL || 'https://rxnav.nlm.nih.gov/REST',
                openFDA: process.env.OPENFDA_API_URL || 'https://api.fda.gov',
                fhir: process.env.FHIR_API_URL || 'https://hapi.fhir.org/baseR4',
                loinc: process.env.LOINC_API_URL || 'https://fhir.loinc.org',
            },
            aiConfig: {
                model: process.env.AI_MODEL || 'deepseek/deepseek-chat-v3.1',
                maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000'),
                temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
                timeout: parseInt(process.env.AI_TIMEOUT || '300000'), // 5 minutes
                retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || '3'),
                rateLimits: {
                    requestsPerMinute: parseInt(process.env.AI_REQUESTS_PER_MINUTE || '60'),
                    tokensPerHour: parseInt(process.env.AI_TOKENS_PER_HOUR || '100000'),
                },
            },
            cacheConfig: {
                enabled: process.env.CACHE_ENABLED !== 'false',
                maxSize: parseInt(process.env.CACHE_MAX_SIZE || '104857600'), // 100MB
                defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600000'), // 1 hour
                redisUrl: process.env.REDIS_URL,
            },
            databaseConfig: {
                connectionPoolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
                queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
                indexingStrategy: (process.env.DB_INDEXING_STRATEGY as 'background' | 'foreground') || 'background',
            },
            securityConfig: {
                encryptionEnabled: process.env.ENCRYPTION_ENABLED !== 'false',
                auditLogging: process.env.AUDIT_LOGGING !== 'false',
                rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false',
                ipWhitelist: process.env.IP_WHITELIST?.split(','),
            },
            monitoringConfig: {
                metricsEnabled: process.env.METRICS_ENABLED !== 'false',
                healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
                alertThresholds: {
                    responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000'),
                    errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '0.05'),
                    memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '0.8'),
                },
            },
            featureFlags: {
                aiDiagnostics: process.env.FEATURE_AI_DIAGNOSTICS !== 'false',
                labIntegration: process.env.FEATURE_LAB_INTEGRATION !== 'false',
                drugInteractions: process.env.FEATURE_DRUG_INTERACTIONS !== 'false',
                fhirIntegration: process.env.FEATURE_FHIR_INTEGRATION === 'true',
                advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
            },
        };
    }

    /**
     * Get environment-specific overrides
     */
    private getEnvironmentOverrides(): Partial<Omit<DeploymentEnvironment, 'name'>> {
        switch (this.currentEnvironment) {
            case 'development':
                return {
                    aiConfig: {
                        model: 'deepseek/deepseek-chat-v3.1',
                        maxTokens: 2000,
                        temperature: 0.2,
                        timeout: 30000,
                        retryAttempts: 2,
                        rateLimits: {
                            requestsPerMinute: 30,
                            tokensPerHour: 50000,
                        },
                    },
                    cacheConfig: {
                        enabled: true,
                        maxSize: 52428800, // 50MB
                        defaultTTL: 1800000, // 30 minutes
                    },
                    databaseConfig: {
                        connectionPoolSize: 5,
                        queryTimeout: 15000,
                        indexingStrategy: 'foreground',
                    },
                    monitoringConfig: {
                        metricsEnabled: true,
                        healthCheckInterval: 60000, // 1 minute
                        alertThresholds: {
                            responseTime: 10000, // More lenient in dev
                            errorRate: 0.1,
                            memoryUsage: 0.9,
                        },
                    },
                };

            case 'staging':
                return {
                    aiConfig: {
                        model: 'deepseek/deepseek-chat-v3.1',
                        maxTokens: 3000,
                        temperature: 0.1,
                        timeout: 45000,
                        retryAttempts: 3,
                        rateLimits: {
                            requestsPerMinute: 45,
                            tokensPerHour: 75000,
                        },
                    },
                    cacheConfig: {
                        enabled: true,
                        maxSize: 104857600, // 100MB
                        defaultTTL: 3600000, // 1 hour
                    },
                    databaseConfig: {
                        connectionPoolSize: 8,
                        queryTimeout: 25000,
                        indexingStrategy: 'background',
                    },
                    monitoringConfig: {
                        metricsEnabled: true,
                        healthCheckInterval: 30000,
                        alertThresholds: {
                            responseTime: 7000,
                            errorRate: 0.07,
                            memoryUsage: 0.85,
                        },
                    },
                };

            case 'production':
                return {
                    aiConfig: {
                        model: 'deepseek/deepseek-chat-v3.1',
                        maxTokens: 4000,
                        temperature: 0.1,
                        timeout: 300000, // 5 minutes
                        retryAttempts: 3,
                        rateLimits: {
                            requestsPerMinute: 60,
                            tokensPerHour: 100000,
                        },
                    },
                    cacheConfig: {
                        enabled: true,
                        maxSize: 209715200, // 200MB
                        defaultTTL: 3600000, // 1 hour
                    },
                    databaseConfig: {
                        connectionPoolSize: 15,
                        queryTimeout: 30000,
                        indexingStrategy: 'background',
                    },
                    securityConfig: {
                        encryptionEnabled: true,
                        auditLogging: true,
                        rateLimitingEnabled: true,
                    },
                    monitoringConfig: {
                        metricsEnabled: true,
                        healthCheckInterval: 15000,
                        alertThresholds: {
                            responseTime: 5000,
                            errorRate: 0.05,
                            memoryUsage: 0.8,
                        },
                    },
                };

            default:
                return {};
        }
    }

    /**
     * Validate configuration
     */
    private validateConfiguration(): void {
        const errors: string[] = [];

        // Validate API endpoints
        if (!this.config.apiEndpoints.openRouter) {
            errors.push('OpenRouter API URL is required');
        }

        // Validate AI configuration
        if (this.config.aiConfig.maxTokens <= 0) {
            errors.push('AI max tokens must be greater than 0');
        }

        if (this.config.aiConfig.temperature < 0 || this.config.aiConfig.temperature > 2) {
            errors.push('AI temperature must be between 0 and 2');
        }

        // Validate cache configuration
        if (this.config.cacheConfig.enabled && this.config.cacheConfig.maxSize <= 0) {
            errors.push('Cache max size must be greater than 0 when cache is enabled');
        }

        // Validate database configuration
        if (this.config.databaseConfig.connectionPoolSize <= 0) {
            errors.push('Database connection pool size must be greater than 0');
        }

        // Validate monitoring thresholds
        const thresholds = this.config.monitoringConfig.alertThresholds;
        if (thresholds.errorRate < 0 || thresholds.errorRate > 1) {
            errors.push('Error rate threshold must be between 0 and 1');
        }

        if (thresholds.memoryUsage < 0 || thresholds.memoryUsage > 1) {
            errors.push('Memory usage threshold must be between 0 and 1');
        }

        if (errors.length > 0) {
            logger.error('Configuration validation failed', { errors });
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }

        logger.info('Configuration validated successfully', {
            environment: this.currentEnvironment,
            aiModel: this.config.aiConfig.model,
            cacheEnabled: this.config.cacheConfig.enabled,
            metricsEnabled: this.config.monitoringConfig.metricsEnabled,
        });
    }

    /**
     * Get current configuration
     */
    getConfig(): DeploymentEnvironment {
        return { ...this.config };
    }

    /**
     * Get specific configuration section
     */
    getAIConfig() {
        return { ...this.config.aiConfig };
    }

    getCacheConfig() {
        return { ...this.config.cacheConfig };
    }

    getDatabaseConfig() {
        return { ...this.config.databaseConfig };
    }

    getSecurityConfig() {
        return { ...this.config.securityConfig };
    }

    getMonitoringConfig() {
        return { ...this.config.monitoringConfig };
    }

    getFeatureFlags() {
        return { ...this.config.featureFlags };
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(feature: keyof DeploymentEnvironment['featureFlags']): boolean {
        return this.config.featureFlags[feature];
    }

    /**
     * Get environment name
     */
    getEnvironment(): DeploymentEnvironment['name'] {
        return this.currentEnvironment;
    }

    /**
     * Check if running in production
     */
    isProduction(): boolean {
        return this.currentEnvironment === 'production';
    }

    /**
     * Check if running in development
     */
    isDevelopment(): boolean {
        return this.currentEnvironment === 'development';
    }

    /**
     * Get API endpoint for service
     */
    getApiEndpoint(service: keyof DeploymentEnvironment['apiEndpoints']): string {
        return this.config.apiEndpoints[service];
    }

    /**
     * Update configuration at runtime (for testing)
     */
    updateConfig(updates: Partial<DeploymentEnvironment>): void {
        if (this.isProduction()) {
            logger.warn('Attempted to update configuration in production environment');
            return;
        }

        this.config = { ...this.config, ...updates };
        logger.info('Configuration updated', { updates });
    }

    /**
     * Export configuration for backup
     */
    exportConfig(): string {
        const exportData = {
            environment: this.currentEnvironment,
            config: this.config,
            timestamp: new Date().toISOString(),
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Get configuration summary for monitoring
     */
    getConfigSummary(): {
        environment: string;
        aiModel: string;
        cacheEnabled: boolean;
        securityEnabled: boolean;
        monitoringEnabled: boolean;
        enabledFeatures: string[];
    } {
        const enabledFeatures = Object.entries(this.config.featureFlags)
            .filter(([, enabled]) => enabled)
            .map(([feature]) => feature);

        return {
            environment: this.currentEnvironment,
            aiModel: this.config.aiConfig.model,
            cacheEnabled: this.config.cacheConfig.enabled,
            securityEnabled: this.config.securityConfig.encryptionEnabled,
            monitoringEnabled: this.config.monitoringConfig.metricsEnabled,
            enabledFeatures,
        };
    }

    /**
     * Validate external service connectivity
     */
    async validateExternalServices(): Promise<{
        service: string;
        status: 'healthy' | 'unhealthy' | 'unknown';
        responseTime?: number;
        error?: string;
    }[]> {
        const services = Object.entries(this.config.apiEndpoints);
        const results = [];

        for (const [serviceName, endpoint] of services) {
            try {
                const startTime = Date.now();

                // Simple connectivity check (in production, use proper health check endpoints)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`${endpoint}/health`, {
                    method: 'GET',
                    signal: controller.signal,
                }).catch(() => null);

                clearTimeout(timeoutId);

                const responseTime = Date.now() - startTime;

                results.push({
                    service: serviceName,
                    status: response?.ok ? 'healthy' as const : 'unhealthy' as const,
                    responseTime,
                });
            } catch (error) {
                results.push({
                    service: serviceName,
                    status: 'unhealthy' as const,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return results;
    }
}

export default new DeploymentConfigManager();