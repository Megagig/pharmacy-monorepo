// Lazy imports for new SaaS management components
import { lazyWithRetry } from '../utils/chunkLoadingUtils';


// Tenant Management
export const LazyTenantManagement = lazyWithRetry(() =>
    import('../components/saas/TenantManagement')
);

export const LazyProvisionTenantModal = lazyWithRetry(() =>
    import('../components/saas/ProvisionTenantModal')
);

// User Management
export const LazyUserApprovalQueue = lazyWithRetry(() =>
    import('../components/saas/UserApprovalQueue')
);

export const LazyUserManagement = lazyWithRetry(() =>
    import('../components/saas/UserManagement')
);

// Security Management
export const LazyActiveSessionsMonitor = lazyWithRetry(() =>
    import('../components/saas/ActiveSessionsMonitor')
);

export const LazySecuritySettings = lazyWithRetry(() =>
    import('../components/saas/SecuritySettings')
);

// Analytics
export const LazyAnalyticsReports = lazyWithRetry(() =>
    import('../components/saas/AnalyticsReports')
);

// Notifications
export const LazyNotificationsManagement = lazyWithRetry(() =>
    import('../components/saas/NotificationsManagement')
);

// Audit
export const LazyAuditDashboard = lazyWithRetry(() =>
    import('../components/admin/AuditDashboard')
);
