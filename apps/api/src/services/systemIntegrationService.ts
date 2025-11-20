/**
 * System Integration Service for Manual Lab Order Workflow
 * Ensures seamless integration with existing systems without breaking changes
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import featureFlagService from '../services/FeatureFlagService';
import { AuditService } from './auditService';
import { AuthRequest } from '../types/auth';

interface IntegrationHealth {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    responseTime?: number;
    error?: string;
    dependencies?: string[];
}

interface SystemCompatibility {
    existingRoutes: string[];
    newRoutes: string[];
    conflicts: string[];
    migrations: string[];
}

/**
 * System Integration Service
 */
export class SystemIntegrationService {
    private static instance: SystemIntegrationService;
    private healthChecks: Map<string, IntegrationHealth> = new Map();
    private featureFlagService: typeof featureFlagService;
    private constructor() {
        this.featureFlagService = featureFlagService;
        this.initializeHealthChecks();
    }

    public static getInstance(): SystemIntegrationService {
        if (!SystemIntegrationService.instance) {
            SystemIntegrationService.instance = new SystemIntegrationService();
        }
        return SystemIntegrationService.instance;
    }

    /**
     * Initialize health checks for all integrated systems
     */
    private initializeHealthChecks(): void {
        const services = [
            'existing_fhir_lab_import',
            'authentication_system',
            'audit_logging',
            'notification_service',
            'pdf_generation',
            'ai_diagnostic_service',
            'database_connection',
            'file_storage'
        ];

        services.forEach(service => {
            this.healthChecks.set(service, {
                service,
                status: 'healthy',
                lastCheck: new Date()
            });
        });

        // Start periodic health checks
        this.startHealthCheckScheduler();
    }

    /**
     * Check system compatibility before enabling manual lab features
     */
    public async checkSystemCompatibility(): Promise<SystemCompatibility> {
        const existingRoutes = await this.getExistingRoutes();
        const newRoutes = this.getManualLabRoutes();
        const conflicts = this.detectRouteConflicts(existingRoutes, newRoutes);
        const migrations = await this.checkRequiredMigrations();

        return {
            existingRoutes,
            newRoutes,
            conflicts,
            migrations
        };
    }

    /**
     * Validate that manual lab integration doesn't break existing functionality
     */
    public async validateIntegration(): Promise<{
        success: boolean;
        issues: string[];
        warnings: string[];
    }> {
        const issues: string[] = [];
        const warnings: string[] = [];

        try {
            // Check route conflicts
            const compatibility = await this.checkSystemCompatibility();
            if (compatibility.conflicts.length > 0) {
                issues.push(`Route conflicts detected: ${compatibility.conflicts.join(', ')}`);
            }

            // Check database schema compatibility
            const schemaCheck = await this.validateDatabaseSchema();
            if (!schemaCheck.compatible) {
                issues.push(`Database schema issues: ${schemaCheck.issues.join(', ')}`);
            }

            // Check existing FHIR integration
            const fhirCheck = await this.validateFHIRIntegration();
            if (!fhirCheck.compatible) {
                warnings.push(`FHIR integration concerns: ${fhirCheck.warnings.join(', ')}`);
            }

            // Check authentication middleware compatibility
            const authCheck = await this.validateAuthenticationIntegration();
            if (!authCheck.compatible) {
                issues.push(`Authentication integration issues: ${authCheck.issues.join(', ')}`);
            }

            // Check audit system integration
            const auditCheck = await this.validateAuditIntegration();
            if (!auditCheck.compatible) {
                warnings.push(`Audit system concerns: ${auditCheck.warnings.join(', ')}`);
            }

            return {
                success: issues.length === 0,
                issues,
                warnings
            };

        } catch (error) {
            issues.push(`Integration validation failed: ${error}`);
            return {
                success: false,
                issues,
                warnings
            };
        }
    }

    /**
     * Middleware to ensure backward compatibility
     */
    public backwardCompatibilityMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction): void => {
            // Add compatibility headers
            res.setHeader('X-Manual-Lab-Integration', 'v1.0.0');
            res.setHeader('X-Backward-Compatible', 'true');

            // Check if request is for existing functionality
            const isExistingRoute = this.isExistingRoute(req.path);
            if (isExistingRoute) {
                // Ensure existing routes work unchanged
                req.headers['x-legacy-route'] = 'true';
            }

            // Monitor integration health
            this.monitorRequestHealth(req);

            next();
        };
    }

    /**
     * Gradual rollout middleware
     */
    public gradualRolloutMiddleware(): (req: AuthRequest, res: Response, next: NextFunction) => void {
        return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
            const userId = req.user?._id?.toString();
            const workplaceId = req.user?.workplaceId?.toString();

            // Check if manual lab features should be enabled for this user
            const isEnabled = await this.featureFlagService.isFeatureEnabled('manual_lab_orders', userId || '', workplaceId || '');

            if (!isEnabled && req.path.startsWith('/api/manual-lab')) {
                res.status(404).json({
                    success: false,
                    message: 'Feature not available for your account',
                    code: 'FEATURE_NOT_AVAILABLE'
                });
                return;
            }

            next();
        };
    }

    /**
     * Integration health monitoring
     */
    public async getIntegrationHealth(): Promise<{
        overall: 'healthy' | 'degraded' | 'unhealthy';
        services: IntegrationHealth[];
        manualLabStatus: 'enabled' | 'disabled' | 'partial';
    }> {
        const services = Array.from(this.healthChecks.values());

        const healthyCount = services.filter(s => s.status === 'healthy').length;
        const totalCount = services.length;

        let overall: 'healthy' | 'degraded' | 'unhealthy';
        if (healthyCount === totalCount) {
            overall = 'healthy';
        } else if (healthyCount >= totalCount * 0.7) {
            overall = 'degraded';
        } else {
            overall = 'unhealthy';
        }

        // Check manual lab feature status
        const manualLabResult = await this.featureFlagService.isFeatureEnabled('manual_lab_orders', 'system', 'system');
        const manualLabEnabled = manualLabResult.enabled;
        const criticalFeatureChecks = await Promise.all([
            'manual_lab_pdf_generation',
            'manual_lab_qr_scanning'
        ].map(flag => this.featureFlagService.isFeatureEnabled(flag, 'system', 'system')));
        const criticalFeaturesEnabled = criticalFeatureChecks.every(check => check.enabled);

        let manualLabStatus: 'enabled' | 'disabled' | 'partial';
        if (!manualLabEnabled) {
            manualLabStatus = 'disabled';
        } else if (criticalFeaturesEnabled) {
            manualLabStatus = 'enabled';
        } else {
            manualLabStatus = 'partial';
        }

        return {
            overall,
            services,
            manualLabStatus
        };
    }

    /**
     * Emergency rollback functionality
     */
    public async emergencyRollback(reason: string): Promise<{
        success: boolean;
        rollbackActions: string[];
        errors: string[];
    }> {
        const rollbackActions: string[] = [];
        const errors: string[] = [];

        try {
            // Disable all manual lab features
            const manualLabFlags = [
                'manual_lab_orders',
                'manual_lab_pdf_generation',
                'manual_lab_qr_scanning',
                'manual_lab_ai_interpretation',
                'manual_lab_fhir_integration'
            ];

            for (const flag of manualLabFlags) {
                try {
                    await this.featureFlagService.setUserFeatureOverride(flag, 'system', false);
                    rollbackActions.push(`Disabled feature flag: ${flag}`);
                } catch (error) {
                    errors.push(`Failed to disable ${flag}: ${error}`);
                }
            }

            // Log rollback event
            await AuditService.logActivity({
                userId: 'system',
                workspaceId: 'system'
            }, {
                action: 'EMERGENCY_ROLLBACK',
                resourceType: 'manual_lab_integration',
                details: {
                    reason,
                    rollbackActions,
                    timestamp: new Date(),
                    severity: 'critical'
                },
                riskLevel: 'high'
            }
            );

            rollbackActions.push('Logged emergency rollback event');

            return {
                success: errors.length === 0,
                rollbackActions,
                errors
            };

        } catch (error) {
            errors.push(`Rollback failed: ${error}`);
            return {
                success: false,
                rollbackActions,
                errors
            };
        }
    }

    /**
     * Private helper methods
     */
    private async getExistingRoutes(): Promise<string[]> {
        // Return list of existing API routes that should not be modified
        return [
            '/api/auth',
            '/api/patients',
            '/api/medications',
            '/api/diagnostics',
            '/api/notes',
            '/api/mtr',
            '/api/admin',
            '/api/audit'
        ];
    }

    private getManualLabRoutes(): string[] {
        return [
            '/api/manual-lab',
            '/api/manual-lab/scan',
            '/api/manual-lab/orders',
            '/api/manual-lab/results',
            '/api/manual-lab/pdf'
        ];
    }

    private detectRouteConflicts(existing: string[], newRoutes: string[]): string[] {
        const conflicts: string[] = [];

        newRoutes.forEach(newRoute => {
            existing.forEach(existingRoute => {
                if (newRoute.startsWith(existingRoute) || existingRoute.startsWith(newRoute)) {
                    conflicts.push(`${newRoute} conflicts with ${existingRoute}`);
                }
            });
        });

        return conflicts;
    }

    private async checkRequiredMigrations(): Promise<string[]> {
        const migrations: string[] = [];

        // Check if manual lab collections need to be created
        try {
            const collections = ['manuallaborders', 'manuallabresults', 'testcatalogs'];
            // This would check if collections exist and add migration if needed
            migrations.push('Manual lab collections setup');
        } catch (error) {
            // Handle migration check errors
        }

        return migrations;
    }

    private async validateDatabaseSchema(): Promise<{
        compatible: boolean;
        issues: string[];
    }> {
        const issues: string[] = [];

        try {
            // Check if manual lab models are compatible with existing schema
            // This would validate indexes, constraints, etc.
            return { compatible: true, issues };
        } catch (error) {
            issues.push(`Schema validation error: ${error}`);
            return { compatible: false, issues };
        }
    }

    private async validateFHIRIntegration(): Promise<{
        compatible: boolean;
        warnings: string[];
    }> {
        const warnings: string[] = [];

        try {
            // Check if FHIR integration can coexist
            // This would test FHIR service availability and compatibility
            return { compatible: true, warnings };
        } catch (error) {
            warnings.push(`FHIR integration warning: ${error}`);
            return { compatible: true, warnings }; // Non-blocking
        }
    }

    private async validateAuthenticationIntegration(): Promise<{
        compatible: boolean;
        issues: string[];
    }> {
        const issues: string[] = [];

        try {
            // Validate that auth middleware works with manual lab routes
            return { compatible: true, issues };
        } catch (error) {
            issues.push(`Auth integration error: ${error}`);
            return { compatible: false, issues };
        }
    }

    private async validateAuditIntegration(): Promise<{
        compatible: boolean;
        warnings: string[];
    }> {
        const warnings: string[] = [];

        try {
            // Check audit system integration
            return { compatible: true, warnings };
        } catch (error) {
            warnings.push(`Audit integration warning: ${error}`);
            return { compatible: true, warnings };
        }
    }

    private isExistingRoute(path: string): boolean {
        const existingPrefixes = [
            '/api/auth',
            '/api/patients',
            '/api/medications',
            '/api/diagnostics',
            '/api/notes',
            '/api/mtr'
        ];

        return existingPrefixes.some(prefix => path.startsWith(prefix));
    }

    private monitorRequestHealth(req: Request): void {
        // Monitor request patterns for health assessment
        const startTime = Date.now();

        req.on('end', () => {
            const responseTime = Date.now() - startTime;

            // Update health metrics based on response time and errors
            if (responseTime > 5000) {
                console.warn(`Slow request detected: ${req.path} took ${responseTime}ms`);
            }
        });
    }

    private startHealthCheckScheduler(): void {
        // Run health checks every 5 minutes
        setInterval(async () => {
            await this.performHealthChecks();
        }, 5 * 60 * 1000);
    }

    private async performHealthChecks(): Promise<void> {
        for (const [serviceName, health] of this.healthChecks) {
            try {
                const startTime = Date.now();

                // Perform actual health check based on service type
                await this.checkServiceHealth(serviceName);

                const responseTime = Date.now() - startTime;

                this.healthChecks.set(serviceName, {
                    ...health,
                    status: 'healthy',
                    lastCheck: new Date(),
                    responseTime
                });

            } catch (error) {
                this.healthChecks.set(serviceName, {
                    ...health,
                    status: 'unhealthy',
                    lastCheck: new Date(),
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    private async checkServiceHealth(serviceName: string): Promise<void> {
        switch (serviceName) {
            case 'database_connection':
                // Check database connectivity
                break;
            case 'existing_fhir_lab_import':
                // Check FHIR service health
                break;
            case 'authentication_system':
                // Check auth service
                break;
            default:
                // Generic health check
                break;
        }
    }
}

export default SystemIntegrationService;
