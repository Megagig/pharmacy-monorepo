import { Router } from 'express';
import saasOverviewRoutes from './saasOverviewRoutes';
import saasUserManagementRoutes from './saasUserManagementRoutes';
import saasSecurityRoutes from './saasSecurityRoutes';
import saasAnalyticsRoutes from './saasAnalyticsRoutes';
import saasNotificationsRoutes from './saasNotificationsRoutes';
import saasAuditRoutes from './saasAuditRoutes';
import saasTenantManagementRoutes from './saasTenantManagementRoutes';
import supportRoutes from './supportRoutes';
import apiManagementRoutes from './apiManagementRoutes';
import developerPortalRoutes from './developerPortalRoutes';
import webhookRoutes from './webhookRoutes';
import integrationRoutes from './integrationRoutes';

const router = Router();

/**
 * SaaS Settings Module Routes
 * 
 * This module provides comprehensive system administration and configuration
 * interfaces for super administrators. All routes require super admin privileges.
 * 
 * Route Structure:
 * - /api/admin/saas/overview/* - System overview, metrics, and health monitoring
 * - /api/admin/saas/users/* - User management with RBAC operations
 * - /api/admin/saas/security/* - Security settings and audit capabilities
 * - /api/admin/saas/analytics/* - Analytics and reporting with export functionality
 * - /api/admin/saas/notifications/* - Notification management with multi-channel support
 * - /api/admin/saas/audit/* - Comprehensive audit trail and compliance reporting
 * - /api/admin/saas/tenant-management/* - Tenant workspace management and subscriptions
 * - /api/admin/saas/support/* - Support ticket management and knowledge base
 * - /api/admin/saas/api-management/* - API endpoint management and documentation
 * - /api/admin/saas/developer-portal/* - Developer portal and sandbox environment
 * - /api/admin/saas/webhooks/* - Webhook configuration and delivery management
 * - /api/admin/saas/integrations/* - External system integrations and data sync
 */

// System Overview Routes
router.use('/overview', saasOverviewRoutes);

// User Management Routes
router.use('/users', saasUserManagementRoutes);

// Security Management Routes
router.use('/security', saasSecurityRoutes);

// Analytics and Reporting Routes
router.use('/analytics', saasAnalyticsRoutes);

// Notifications Management Routes
router.use('/notifications', saasNotificationsRoutes);

// Audit Trail and Compliance Routes
router.use('/audit', saasAuditRoutes);

// Tenant Management Routes
router.use('/tenant-management', saasTenantManagementRoutes);

// Support and Helpdesk Routes
router.use('/support', supportRoutes);

// API Management Routes
router.use('/api-management', apiManagementRoutes);

// Developer Portal Routes
router.use('/developer-portal', developerPortalRoutes);

// Webhook Management Routes
router.use('/webhooks', webhookRoutes);

// Integration Management Routes
router.use('/integrations', integrationRoutes);

export default router;