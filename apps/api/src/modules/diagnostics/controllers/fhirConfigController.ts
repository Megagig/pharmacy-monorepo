import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import {
    sendSuccess,
    sendError,
    asyncHandler,
    getRequestContext,
    createAuditLog,
} from '../../../utils/responseHelpers';

// Import FHIR configuration utilities
import {
    FHIRServerConfig,
    getEnvironmentFHIRConfig,
    validateFHIRConfig,
    sanitizeFHIRConfig,
    DEFAULT_FHIR_CONFIGS,
} from '../config/fhirConfig';

// Import FHIR service for testing connections
import FHIRService from '../services/fhirService';

/**
 * FHIR Configuration Controller
 * Handles FHIR server configuration management
 */

// ===============================
// FHIR CONFIGURATION OPERATIONS
// ===============================

/**
 * GET /api/lab/fhir/config
 * Get all FHIR server configurations
 */
export const getFHIRConfigs = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const configs: Partial<FHIRServerConfig>[] = [];

            // Add environment configuration if available
            const envConfig = getEnvironmentFHIRConfig();
            if (envConfig) {
                configs.push(sanitizeFHIRConfig(envConfig));
            }

            // Add default configurations (sanitized)
            DEFAULT_FHIR_CONFIGS.forEach(config => {
                if (config.id && config.name && config.config) {
                    configs.push({
                        ...config,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }
            });

            // TODO: Add database-stored configurations for the workplace
            // This would require implementing a FHIRConfig model

            logger.info('FHIR configurations retrieved', {
                workplaceId: context.workplaceId,
                configCount: configs.length,
            });

            sendSuccess(
                res,
                {
                    configs,
                    total: configs.length,
                    hasEnvironmentConfig: !!envConfig,
                },
                'FHIR configurations retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get FHIR configurations:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get FHIR configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/fhir/config/:id
 * Get specific FHIR server configuration
 */
export const getFHIRConfig = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const context = getRequestContext(req);

        try {
            let config: FHIRServerConfig | null = null;

            // Check if it's the environment configuration
            if (id === 'environment') {
                config = getEnvironmentFHIRConfig();
            } else {
                // Check default configurations
                const defaultConfig = DEFAULT_FHIR_CONFIGS.find(c => c.id === id);
                if (defaultConfig && defaultConfig.id && defaultConfig.name && defaultConfig.config) {
                    config = {
                        ...defaultConfig,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as FHIRServerConfig;
                }
            }

            // TODO: Check database-stored configurations

            if (!config) {
                return sendError(res, 'NOT_FOUND', 'FHIR configuration not found', 404);
            }

            // Sanitize configuration for client
            const sanitizedConfig = sanitizeFHIRConfig(config);

            logger.info('FHIR configuration retrieved', {
                configId: id,
                workplaceId: context.workplaceId,
            });

            sendSuccess(
                res,
                {
                    config: sanitizedConfig,
                },
                'FHIR configuration retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get FHIR configuration:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get FHIR configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * POST /api/lab/fhir/config/test
 * Test FHIR server configuration
 */
export const testFHIRConfig = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { config: fhirConfig, auth: authConfig } = req.body;

        try {
            // Validate configuration
            const validation = validateFHIRConfig({
                id: 'test',
                name: 'Test Configuration',
                enabled: true,
                config: fhirConfig,
                auth: authConfig,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            if (!validation.valid) {
                return sendError(
                    res,
                    'VALIDATION_ERROR',
                    'Invalid FHIR configuration',
                    422,
                    {
                        errors: validation.errors,
                    }
                );
            }

            // Create FHIR service instance and test connection
            const fhirService = new FHIRService(fhirConfig, authConfig);
            const connectionResult = await fhirService.testConnection();

            // Create audit log
            console.log(
                'FHIR configuration tested:',
                createAuditLog(
                    'TEST_FHIR_CONFIG',
                    'FHIRConfig',
                    'test_connection',
                    context,
                    {
                        baseUrl: fhirConfig.baseUrl,
                        version: fhirConfig.version,
                        authType: authConfig?.type || 'none',
                        connected: connectionResult,
                    }
                )
            );

            if (connectionResult) {
                sendSuccess(
                    res,
                    {
                        connected: true,
                        message: 'FHIR server connection successful',
                        timestamp: new Date().toISOString(),
                        config: {
                            baseUrl: fhirConfig.baseUrl,
                            version: fhirConfig.version,
                        },
                    },
                    'FHIR configuration test successful'
                );
            } else {
                sendError(
                    res,
                    'SERVICE_UNAVAILABLE',
                    'FHIR server connection failed',
                    503,
                    {
                        connected: false,
                        timestamp: new Date().toISOString(),
                        config: {
                            baseUrl: fhirConfig.baseUrl,
                            version: fhirConfig.version,
                        },
                    }
                );
            }
        } catch (error) {
            logger.error('Failed to test FHIR configuration:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to test FHIR configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/fhir/config/defaults
 * Get default FHIR server configurations
 */
export const getDefaultFHIRConfigs = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            // Return sanitized default configurations
            const sanitizedConfigs = DEFAULT_FHIR_CONFIGS.map(config => ({
                ...config,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            logger.info('Default FHIR configurations retrieved', {
                workplaceId: context.workplaceId,
                configCount: sanitizedConfigs.length,
            });

            sendSuccess(
                res,
                {
                    configs: sanitizedConfigs,
                    total: sanitizedConfigs.length,
                },
                'Default FHIR configurations retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get default FHIR configurations:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get default FHIR configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/fhir/capabilities
 * Get FHIR server capabilities and metadata
 */
export const getFHIRCapabilities = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const { serverId } = req.query;
        const context = getRequestContext(req);

        try {
            let config: FHIRServerConfig | null = null;

            // Get configuration
            if (serverId === 'environment') {
                config = getEnvironmentFHIRConfig();
            } else if (typeof serverId === 'string') {
                const defaultConfig = DEFAULT_FHIR_CONFIGS.find(c => c.id === serverId);
                if (defaultConfig && defaultConfig.id && defaultConfig.name && defaultConfig.config) {
                    config = {
                        ...defaultConfig,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as FHIRServerConfig;
                }
            }

            if (!config) {
                return sendError(res, 'NOT_FOUND', 'FHIR configuration not found', 404);
            }

            // Create FHIR service and get capabilities
            const fhirService = new FHIRService(config.config, config.auth);

            try {
                // This would make an actual call to /metadata endpoint
                // For now, we'll return a mock response
                const capabilities = {
                    fhirVersion: config.config.version,
                    software: {
                        name: 'Unknown',
                        version: 'Unknown',
                    },
                    implementation: {
                        description: 'FHIR Server',
                        url: config.config.baseUrl,
                    },
                    rest: [{
                        mode: 'server',
                        resource: [
                            {
                                type: 'Observation',
                                interaction: [
                                    { code: 'read' },
                                    { code: 'search-type' },
                                    { code: 'create' },
                                    { code: 'update' },
                                ],
                            },
                            {
                                type: 'ServiceRequest',
                                interaction: [
                                    { code: 'read' },
                                    { code: 'search-type' },
                                    { code: 'create' },
                                    { code: 'update' },
                                ],
                            },
                            {
                                type: 'Patient',
                                interaction: [
                                    { code: 'read' },
                                    { code: 'search-type' },
                                ],
                            },
                        ],
                    }],
                };

                logger.info('FHIR capabilities retrieved', {
                    serverId,
                    workplaceId: context.workplaceId,
                    baseUrl: config.config.baseUrl,
                });

                sendSuccess(
                    res,
                    {
                        capabilities,
                        serverId,
                        baseUrl: config.config.baseUrl,
                        version: config.config.version,
                    },
                    'FHIR capabilities retrieved successfully'
                );
            } catch (capabilityError) {
                logger.warn('Failed to retrieve FHIR capabilities:', capabilityError);
                sendError(
                    res,
                    'SERVICE_UNAVAILABLE',
                    'Unable to retrieve FHIR server capabilities',
                    503,
                    {
                        serverId,
                        baseUrl: config.config.baseUrl,
                        error: capabilityError instanceof Error ? capabilityError.message : 'Unknown error',
                    }
                );
            }
        } catch (error) {
            logger.error('Failed to get FHIR capabilities:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get FHIR capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

/**
 * GET /api/lab/fhir/status
 * Get FHIR integration status and health
 */
export const getFHIRStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const status = {
                enabled: !!process.env.FHIR_BASE_URL,
                environmentConfig: !!getEnvironmentFHIRConfig(),
                defaultConfigs: DEFAULT_FHIR_CONFIGS.length,
                lastChecked: new Date().toISOString(),
                features: {
                    import: true,
                    export: true,
                    sync: true,
                    realtime: false, // Not implemented yet
                },
                supportedVersions: ['R4', 'STU3', 'DSTU2'],
                supportedResources: [
                    'Observation',
                    'ServiceRequest',
                    'Patient',
                    'Practitioner',
                    'Organization',
                ],
            };

            // Test environment configuration if available
            const envConfig = getEnvironmentFHIRConfig();
            if (envConfig) {
                try {
                    const fhirService = new FHIRService(envConfig.config, envConfig.auth);
                    status.enabled = await fhirService.testConnection();
                } catch (error) {
                    logger.warn('Environment FHIR server not accessible:', error);
                    status.enabled = false;
                }
            }

            logger.info('FHIR status retrieved', {
                workplaceId: context.workplaceId,
                enabled: status.enabled,
                environmentConfig: status.environmentConfig,
            });

            sendSuccess(
                res,
                status,
                'FHIR integration status retrieved successfully'
            );
        } catch (error) {
            logger.error('Failed to get FHIR status:', error);
            sendError(
                res,
                'SERVER_ERROR',
                `Failed to get FHIR status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                500
            );
        }
    }
);

export default {
    getFHIRConfigs,
    getFHIRConfig,
    testFHIRConfig,
    getDefaultFHIRConfigs,
    getFHIRCapabilities,
    getFHIRStatus,
};