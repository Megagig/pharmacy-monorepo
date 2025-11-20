import promClient from 'prom-client';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
    register,
    prefix: 'PharmacyCopilot_',
});

// Custom metrics for PharmacyCopilot application

// HTTP request metrics
export const httpRequestDuration = new promClient.Histogram({
    name: 'PharmacyCopilot_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestsTotal = new promClient.Counter({
    name: 'PharmacyCopilot_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

// Subscription metrics
export const subscriptionsTotal = new promClient.Gauge({
    name: 'PharmacyCopilot_subscriptions_total',
    help: 'Total number of subscriptions by status',
    labelNames: ['status', 'tier'],
});

export const trialConversionsTotal = new promClient.Counter({
    name: 'PharmacyCopilot_trial_conversions_total',
    help: 'Total number of trial conversions',
    labelNames: ['from_tier', 'to_tier'],
});

export const trialsExpiredTotal = new promClient.Counter({
    name: 'PharmacyCopilot_trials_expired_total',
    help: 'Total number of expired trials',
});

export const paymentFailuresTotal = new promClient.Counter({
    name: 'PharmacyCopilot_payment_failures_total',
    help: 'Total number of payment failures',
    labelNames: ['reason', 'tier'],
});

// Workspace metrics
export const workspacesActiveTotal = new promClient.Gauge({
    name: 'PharmacyCopilot_workspaces_active_total',
    help: 'Total number of active workspaces',
});

export const workspacesCreatedTotal = new promClient.Counter({
    name: 'PharmacyCopilot_workspaces_created_total',
    help: 'Total number of workspaces created',
});

// Invitation metrics
export const invitationsSentTotal = new promClient.Counter({
    name: 'PharmacyCopilot_invitations_sent_total',
    help: 'Total number of invitations sent',
    labelNames: ['workspace_id', 'role'],
});

export const invitationsAcceptedTotal = new promClient.Counter({
    name: 'PharmacyCopilot_invitations_accepted_total',
    help: 'Total number of invitations accepted',
    labelNames: ['workspace_id', 'role'],
});

export const invitationsFailedTotal = new promClient.Counter({
    name: 'PharmacyCopilot_invitations_failed_total',
    help: 'Total number of failed invitations',
    labelNames: ['reason'],
});

export const invitationsPendingTotal = new promClient.Gauge({
    name: 'PharmacyCopilot_invitations_pending_total',
    help: 'Total number of pending invitations',
});

// Usage limit metrics
export const usageLimitViolationsTotal = new promClient.Counter({
    name: 'PharmacyCopilot_usage_limit_violations_total',
    help: 'Total number of usage limit violations',
    labelNames: ['resource', 'workspace_id', 'tier'],
});

export const usageStatsGauge = new promClient.Gauge({
    name: 'PharmacyCopilot_usage_stats',
    help: 'Current usage statistics',
    labelNames: ['resource', 'workspace_id', 'tier'],
});

// Email metrics
export const emailsSentTotal = new promClient.Counter({
    name: 'PharmacyCopilot_emails_sent_total',
    help: 'Total number of emails sent',
    labelNames: ['type', 'status'],
});

export const emailsFailedTotal = new promClient.Counter({
    name: 'PharmacyCopilot_emails_failed_total',
    help: 'Total number of failed emails',
    labelNames: ['type', 'reason'],
});

export const emailQueueSize = new promClient.Gauge({
    name: 'PharmacyCopilot_email_queue_size',
    help: 'Current size of email queue',
});

// Authentication metrics
export const authFailuresTotal = new promClient.Counter({
    name: 'PharmacyCopilot_auth_failures_total',
    help: 'Total number of authentication failures',
    labelNames: ['reason', 'ip'],
});

export const authSuccessTotal = new promClient.Counter({
    name: 'PharmacyCopilot_auth_success_total',
    help: 'Total number of successful authentications',
});

// Rate limiting metrics
export const rateLimitViolationsTotal = new promClient.Counter({
    name: 'PharmacyCopilot_rate_limit_violations_total',
    help: 'Total number of rate limit violations',
    labelNames: ['endpoint', 'ip'],
});

// Database metrics
export const databaseOperationDuration = new promClient.Histogram({
    name: 'PharmacyCopilot_database_operation_duration_seconds',
    help: 'Duration of database operations in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
});

export const databaseConnectionsActive = new promClient.Gauge({
    name: 'PharmacyCopilot_database_connections_active',
    help: 'Number of active database connections',
});

// Business metrics
export const patientsTotal = new promClient.Gauge({
    name: 'PharmacyCopilot_patients_total',
    help: 'Total number of patients',
    labelNames: ['workspace_id'],
});

export const usersTotal = new promClient.Gauge({
    name: 'PharmacyCopilot_users_total',
    help: 'Total number of users',
    labelNames: ['role', 'status'],
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(subscriptionsTotal);
register.registerMetric(trialConversionsTotal);
register.registerMetric(trialsExpiredTotal);
register.registerMetric(paymentFailuresTotal);
register.registerMetric(workspacesActiveTotal);
register.registerMetric(workspacesCreatedTotal);
register.registerMetric(invitationsSentTotal);
register.registerMetric(invitationsAcceptedTotal);
register.registerMetric(invitationsFailedTotal);
register.registerMetric(invitationsPendingTotal);
register.registerMetric(usageLimitViolationsTotal);
register.registerMetric(usageStatsGauge);
register.registerMetric(emailsSentTotal);
register.registerMetric(emailsFailedTotal);
register.registerMetric(emailQueueSize);
register.registerMetric(authFailuresTotal);
register.registerMetric(authSuccessTotal);
register.registerMetric(rateLimitViolationsTotal);
register.registerMetric(databaseOperationDuration);
register.registerMetric(databaseConnectionsActive);
register.registerMetric(patientsTotal);
register.registerMetric(usersTotal);

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path || 'unknown';
        const method = req.method;
        const statusCode = res.statusCode.toString();

        httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration
        );

        httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
        });
    });

    next();
};

// Function to update subscription metrics
export const updateSubscriptionMetrics = async () => {
    try {
        const mongoose = require('mongoose');
        const Subscription = mongoose.model('Subscription');

        // Get subscription counts by status and tier
        const subscriptionStats = await Subscription.aggregate([
            {
                $group: {
                    _id: { status: '$status', tier: '$tier' },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Reset gauge
        subscriptionsTotal.reset();

        // Update metrics
        subscriptionStats.forEach((stat: any) => {
            subscriptionsTotal.set(
                { status: stat._id.status, tier: stat._id.tier },
                stat.count
            );
        });
    } catch (error) {
        console.error('Error updating subscription metrics:', error);
    }
};

// Function to update workspace metrics
export const updateWorkspaceMetrics = async () => {
    try {
        const mongoose = require('mongoose');
        const Workplace = mongoose.model('Workplace');

        // Count active workspaces
        const activeCount = await Workplace.countDocuments({
            subscriptionStatus: { $in: ['trial', 'active'] },
        });

        workspacesActiveTotal.set(activeCount);
    } catch (error) {
        console.error('Error updating workspace metrics:', error);
    }
};

// Function to update invitation metrics
export const updateInvitationMetrics = async () => {
    try {
        const mongoose = require('mongoose');
        const Invitation = mongoose.model('Invitation');

        // Count pending invitations
        const pendingCount = await Invitation.countDocuments({
            status: 'active',
            expiresAt: { $gt: new Date() },
        });

        invitationsPendingTotal.set(pendingCount);
    } catch (error) {
        console.error('Error updating invitation metrics:', error);
    }
};

// Function to update usage metrics
export const updateUsageMetrics = async () => {
    try {
        const mongoose = require('mongoose');
        const Workplace = mongoose.model('Workplace');

        // Get usage statistics for all workspaces
        const workspaces = await Workplace.find({
            subscriptionStatus: { $in: ['trial', 'active'] },
        }).populate('currentSubscriptionId');

        // Reset usage stats gauge
        usageStatsGauge.reset();

        workspaces.forEach((workspace: any) => {
            if (workspace.stats && workspace.currentSubscriptionId) {
                const tier = workspace.currentSubscriptionId.tier;

                // Update patient count
                usageStatsGauge.set(
                    { resource: 'patients', workspace_id: workspace._id.toString(), tier },
                    workspace.stats.patientsCount || 0
                );

                // Update user count
                usageStatsGauge.set(
                    { resource: 'users', workspace_id: workspace._id.toString(), tier },
                    workspace.stats.usersCount || 0
                );
            }
        });
    } catch (error) {
        console.error('Error updating usage metrics:', error);
    }
};

// Function to update all metrics
export const updateAllMetrics = async () => {
    await Promise.all([
        updateSubscriptionMetrics(),
        updateWorkspaceMetrics(),
        updateInvitationMetrics(),
        updateUsageMetrics(),
    ]);
};

// Export the registry and promClient for use in routes
export { register, promClient };