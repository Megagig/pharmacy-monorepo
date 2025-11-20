/**
 * RBAC Performance Metrics Collector
 * Collects and exports performance metrics for the Dynamic RBAC system
 */

const prometheus = require('prom-client');
const EventEmitter = require('events');

class RBACMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      prefix: 'rbac_',
      collectDefaultMetrics: true,
      ...options,
    };

    // Initialize Prometheus metrics
    this.initializeMetrics();

    // Collect default Node.js metrics
    if (this.options.collectDefaultMetrics) {
      prometheus.collectDefaultMetrics({ prefix: this.options.prefix });
    }
  }

  initializeMetrics() {
    const prefix = this.options.prefix;

    // Permission check metrics
    this.permissionCheckDuration = new prometheus.Histogram({
      name: `${prefix}permission_check_duration_seconds`,
      help: 'Duration of permission checks in seconds',
      labelNames: ['permission', 'result', 'cache_hit', 'workspace_id'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.permissionChecksTotal = new prometheus.Counter({
      name: `${prefix}permission_checks_total`,
      help: 'Total number of permission checks',
      labelNames: [
        'permission',
        'result',
        'cache_hit',
        'workspace_id',
        'user_role',
      ],
    });

    // Cache metrics
    this.cacheHitsTotal = new prometheus.Counter({
      name: `${prefix}cache_hits_total`,
      help: 'Total number of cache hits',
      labelNames: ['cache_type', 'workspace_id'],
    });

    this.cacheMissesTotal = new prometheus.Counter({
      name: `${prefix}cache_misses_total`,
      help: 'Total number of cache misses',
      labelNames: ['cache_type', 'workspace_id'],
    });

    this.cacheInvalidationsTotal = new prometheus.Counter({
      name: `${prefix}cache_invalidations_total`,
      help: 'Total number of cache invalidations',
      labelNames: ['cache_type', 'reason', 'workspace_id'],
    });

    this.cacheSize = new prometheus.Gauge({
      name: `${prefix}cache_size_bytes`,
      help: 'Current cache size in bytes',
      labelNames: ['cache_type', 'workspace_id'],
    });

    this.cacheEntries = new prometheus.Gauge({
      name: `${prefix}cache_entries_total`,
      help: 'Current number of cache entries',
      labelNames: ['cache_type', 'workspace_id'],
    });

    // Database metrics
    this.dbQueryDuration = new prometheus.Histogram({
      name: `${prefix}db_query_duration_seconds`,
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });

    this.dbConnectionsActive = new prometheus.Gauge({
      name: `${prefix}db_pool_active_connections`,
      help: 'Number of active database connections',
      labelNames: ['pool_name'],
    });

    this.dbConnectionsMax = new prometheus.Gauge({
      name: `${prefix}db_pool_max_connections`,
      help: 'Maximum number of database connections',
      labelNames: ['pool_name'],
    });

    this.dbConnectionErrors = new prometheus.Counter({
      name: `${prefix}db_connection_errors_total`,
      help: 'Total number of database connection errors',
      labelNames: ['error_type', 'pool_name'],
    });

    // Session metrics
    this.activeSessions = new prometheus.Gauge({
      name: `${prefix}active_sessions`,
      help: 'Number of active user sessions',
      labelNames: ['workspace_id'],
    });

    this.sessionDuration = new prometheus.Histogram({
      name: `${prefix}session_duration_seconds`,
      help: 'Duration of user sessions in seconds',
      labelNames: ['workspace_id', 'user_role'],
      buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400],
    });

    // Security metrics
    this.failedLoginAttempts = new prometheus.Counter({
      name: `${prefix}failed_login_attempts_total`,
      help: 'Total number of failed login attempts',
      labelNames: ['reason', 'ip_address', 'workspace_id'],
    });

    this.privilegeEscalationAttempts = new prometheus.Counter({
      name: `${prefix}privilege_escalation_attempts_total`,
      help: 'Total number of privilege escalation attempts',
      labelNames: ['user_id', 'requested_permission', 'workspace_id'],
    });

    this.suspiciousAccessTotal = new prometheus.Counter({
      name: `${prefix}suspicious_access_total`,
      help: 'Total number of suspicious access events',
      labelNames: ['event_type', 'user_id', 'workspace_id'],
    });

    this.afterHoursAccessTotal = new prometheus.Counter({
      name: `${prefix}after_hours_access_total`,
      help: 'Total number of after-hours access events',
      labelNames: ['user_id', 'workspace_id'],
    });

    this.bulkDataAccessTotal = new prometheus.Counter({
      name: `${prefix}bulk_data_access_total`,
      help: 'Total number of bulk data access events',
      labelNames: ['user_id', 'data_type', 'workspace_id'],
    });

    // System metrics
    this.errorsTotal = new prometheus.Counter({
      name: `${prefix}errors_total`,
      help: 'Total number of RBAC errors',
      labelNames: ['error_type', 'component', 'workspace_id'],
    });

    this.memoryUsage = new prometheus.Gauge({
      name: `${prefix}memory_usage_bytes`,
      help: 'Memory usage of RBAC system in bytes',
      labelNames: ['component'],
    });

    this.cacheAvailability = new prometheus.Gauge({
      name: `${prefix}cache_availability`,
      help: 'Cache service availability (1 = available, 0 = unavailable)',
      labelNames: ['cache_type'],
    });

    // Business metrics
    this.totalRoles = new prometheus.Gauge({
      name: `${prefix}total_roles`,
      help: 'Total number of roles in the system',
      labelNames: ['workspace_id', 'role_type'],
    });

    this.totalPermissions = new prometheus.Gauge({
      name: `${prefix}total_permissions`,
      help: 'Total number of permissions in the system',
      labelNames: ['category'],
    });

    this.totalUsersWithRoles = new prometheus.Gauge({
      name: `${prefix}total_users_with_roles`,
      help: 'Total number of users with role assignments',
      labelNames: ['workspace_id'],
    });

    this.roleAssignmentsTotal = new prometheus.Counter({
      name: `${prefix}role_assignments_total`,
      help: 'Total number of role assignments',
      labelNames: ['role_name', 'assigned_by', 'workspace_id'],
    });

    // Compliance metrics
    this.auditLogGapsTotal = new prometheus.Counter({
      name: `${prefix}audit_log_gaps_total`,
      help: 'Total number of audit log gaps detected',
      labelNames: ['gap_type', 'workspace_id'],
    });

    this.overdueAccessReviews = new prometheus.Gauge({
      name: `${prefix}overdue_access_reviews`,
      help: 'Number of overdue access reviews',
      labelNames: ['workspace_id'],
    });

    this.expiredTemporaryPermissions = new prometheus.Gauge({
      name: `${prefix}expired_temporary_permissions`,
      help: 'Number of expired temporary permissions',
      labelNames: ['workspace_id'],
    });

    this.inactiveUsersWithRoles = new prometheus.Gauge({
      name: `${prefix}inactive_users_with_roles`,
      help: 'Number of inactive users with active roles',
      labelNames: ['workspace_id'],
    });

    // Configuration change tracking
    this.configurationChangesTotal = new prometheus.Counter({
      name: `${prefix}configuration_changes_total`,
      help: 'Total number of RBAC configuration changes',
      labelNames: ['change_type', 'changed_by', 'workspace_id'],
    });
  }

  // Permission check metrics
  recordPermissionCheck(permission, result, duration, options = {}) {
    const labels = {
      permission,
      result,
      cache_hit: options.cacheHit ? 'true' : 'false',
      workspace_id: options.workspaceId || 'default',
      user_role: options.userRole || 'unknown',
    };

    this.permissionCheckDuration.observe(labels, duration);
    this.permissionChecksTotal.inc(labels);

    this.emit('permission_check', { permission, result, duration, ...options });
  }

  // Cache metrics
  recordCacheHit(cacheType, workspaceId = 'default') {
    this.cacheHitsTotal.inc({
      cache_type: cacheType,
      workspace_id: workspaceId,
    });
    this.emit('cache_hit', { cacheType, workspaceId });
  }

  recordCacheMiss(cacheType, workspaceId = 'default') {
    this.cacheMissesTotal.inc({
      cache_type: cacheType,
      workspace_id: workspaceId,
    });
    this.emit('cache_miss', { cacheType, workspaceId });
  }

  recordCacheInvalidation(cacheType, reason, workspaceId = 'default') {
    this.cacheInvalidationsTotal.inc({
      cache_type: cacheType,
      reason,
      workspace_id: workspaceId,
    });
    this.emit('cache_invalidation', { cacheType, reason, workspaceId });
  }

  updateCacheMetrics(cacheType, size, entries, workspaceId = 'default') {
    const labels = { cache_type: cacheType, workspace_id: workspaceId };
    this.cacheSize.set(labels, size);
    this.cacheEntries.set(labels, entries);
  }

  // Database metrics
  recordDatabaseQuery(queryType, table, operation, duration) {
    this.dbQueryDuration.observe(
      {
        query_type: queryType,
        table,
        operation,
      },
      duration
    );
    this.emit('db_query', { queryType, table, operation, duration });
  }

  updateDatabaseConnectionMetrics(poolName, active, max) {
    this.dbConnectionsActive.set({ pool_name: poolName }, active);
    this.dbConnectionsMax.set({ pool_name: poolName }, max);
  }

  recordDatabaseError(errorType, poolName) {
    this.dbConnectionErrors.inc({ error_type: errorType, pool_name: poolName });
    this.emit('db_error', { errorType, poolName });
  }

  // Session metrics
  updateActiveSessions(count, workspaceId = 'default') {
    this.activeSessions.set({ workspace_id: workspaceId }, count);
  }

  recordSessionEnd(duration, userRole, workspaceId = 'default') {
    this.sessionDuration.observe(
      {
        workspace_id: workspaceId,
        user_role: userRole,
      },
      duration
    );
  }

  // Security metrics
  recordFailedLogin(reason, ipAddress, workspaceId = 'default') {
    this.failedLoginAttempts.inc({
      reason,
      ip_address: ipAddress,
      workspace_id: workspaceId,
    });
    this.emit('failed_login', { reason, ipAddress, workspaceId });
  }

  recordPrivilegeEscalationAttempt(
    userId,
    requestedPermission,
    workspaceId = 'default'
  ) {
    this.privilegeEscalationAttempts.inc({
      user_id: userId,
      requested_permission: requestedPermission,
      workspace_id: workspaceId,
    });
    this.emit('privilege_escalation', {
      userId,
      requestedPermission,
      workspaceId,
    });
  }

  recordSuspiciousAccess(eventType, userId, workspaceId = 'default') {
    this.suspiciousAccessTotal.inc({
      event_type: eventType,
      user_id: userId,
      workspace_id: workspaceId,
    });
    this.emit('suspicious_access', { eventType, userId, workspaceId });
  }

  recordAfterHoursAccess(userId, workspaceId = 'default') {
    this.afterHoursAccessTotal.inc({
      user_id: userId,
      workspace_id: workspaceId,
    });
    this.emit('after_hours_access', { userId, workspaceId });
  }

  recordBulkDataAccess(userId, dataType, workspaceId = 'default') {
    this.bulkDataAccessTotal.inc({
      user_id: userId,
      data_type: dataType,
      workspace_id: workspaceId,
    });
    this.emit('bulk_data_access', { userId, dataType, workspaceId });
  }

  // System metrics
  recordError(errorType, component, workspaceId = 'default') {
    this.errorsTotal.inc({
      error_type: errorType,
      component,
      workspace_id: workspaceId,
    });
    this.emit('error', { errorType, component, workspaceId });
  }

  updateMemoryUsage(component, bytes) {
    this.memoryUsage.set({ component }, bytes);
  }

  updateCacheAvailability(cacheType, available) {
    this.cacheAvailability.set({ cache_type: cacheType }, available ? 1 : 0);
  }

  // Business metrics
  updateRoleCount(count, workspaceId = 'default', roleType = 'all') {
    this.totalRoles.set(
      { workspace_id: workspaceId, role_type: roleType },
      count
    );
  }

  updatePermissionCount(count, category = 'all') {
    this.totalPermissions.set({ category }, count);
  }

  updateUsersWithRolesCount(count, workspaceId = 'default') {
    this.totalUsersWithRoles.set({ workspace_id: workspaceId }, count);
  }

  recordRoleAssignment(roleName, assignedBy, workspaceId = 'default') {
    this.roleAssignmentsTotal.inc({
      role_name: roleName,
      assigned_by: assignedBy,
      workspace_id: workspaceId,
    });
    this.emit('role_assignment', { roleName, assignedBy, workspaceId });
  }

  // Compliance metrics
  recordAuditLogGap(gapType, workspaceId = 'default') {
    this.auditLogGapsTotal.inc({
      gap_type: gapType,
      workspace_id: workspaceId,
    });
    this.emit('audit_log_gap', { gapType, workspaceId });
  }

  updateComplianceMetrics(metrics, workspaceId = 'default') {
    if (metrics.overdueAccessReviews !== undefined) {
      this.overdueAccessReviews.set(
        { workspace_id: workspaceId },
        metrics.overdueAccessReviews
      );
    }

    if (metrics.expiredTemporaryPermissions !== undefined) {
      this.expiredTemporaryPermissions.set(
        { workspace_id: workspaceId },
        metrics.expiredTemporaryPermissions
      );
    }

    if (metrics.inactiveUsersWithRoles !== undefined) {
      this.inactiveUsersWithRoles.set(
        { workspace_id: workspaceId },
        metrics.inactiveUsersWithRoles
      );
    }
  }

  // Configuration change tracking
  recordConfigurationChange(changeType, changedBy, workspaceId = 'default') {
    this.configurationChangesTotal.inc({
      change_type: changeType,
      changed_by: changedBy,
      workspace_id: workspaceId,
    });
    this.emit('configuration_change', { changeType, changedBy, workspaceId });
  }

  // Utility methods
  getMetrics() {
    return prometheus.register.metrics();
  }

  getMetricsAsJSON() {
    return prometheus.register.getMetricsAsJSON();
  }

  clearMetrics() {
    prometheus.register.clear();
    this.initializeMetrics();
  }

  // Health check method
  getHealthStatus() {
    const metrics = this.getMetricsAsJSON();
    const now = Date.now();

    // Calculate basic health indicators
    const permissionCheckLatency = this.getMetricValue(
      metrics,
      'rbac_permission_check_duration_seconds'
    );
    const errorRate = this.getMetricValue(metrics, 'rbac_errors_total');
    const cacheHitRate = this.calculateCacheHitRate(metrics);

    return {
      timestamp: now,
      status: this.determineOverallHealth(
        permissionCheckLatency,
        errorRate,
        cacheHitRate
      ),
      metrics: {
        permissionCheckLatency,
        errorRate,
        cacheHitRate,
        activeConnections: this.getMetricValue(
          metrics,
          'rbac_db_pool_active_connections'
        ),
        activeSessions: this.getMetricValue(metrics, 'rbac_active_sessions'),
      },
    };
  }

  getMetricValue(metrics, metricName) {
    const metric = metrics.find((m) => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) {
      return 0;
    }

    // For histograms, return the average
    if (metric.type === 'histogram') {
      const sum = metric.values.find((v) => v.labels && v.labels.le === '+Inf');
      const count = metric.values.find(
        (v) => v.labels && v.labels.le === '+Inf'
      );
      return sum && count && count.value > 0 ? sum.value / count.value : 0;
    }

    // For counters and gauges, return the sum
    return metric.values.reduce((sum, v) => sum + v.value, 0);
  }

  calculateCacheHitRate(metrics) {
    const hits = this.getMetricValue(metrics, 'rbac_cache_hits_total');
    const misses = this.getMetricValue(metrics, 'rbac_cache_misses_total');
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  determineOverallHealth(latency, errorRate, cacheHitRate) {
    if (latency > 1.0 || errorRate > 10 || cacheHitRate < 50) {
      return 'unhealthy';
    } else if (latency > 0.5 || errorRate > 1 || cacheHitRate < 80) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // Middleware for Express.js to automatically collect metrics
  middleware() {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;

        // Record request metrics if this is an RBAC-related endpoint
        if (
          req.path.includes('/rbac') ||
          req.path.includes('/roles') ||
          req.path.includes('/permissions')
        ) {
          this.recordPermissionCheck(
            req.path,
            res.statusCode < 400 ? 'success' : 'error',
            duration,
            {
              workspaceId: req.headers['workspace-id'] || 'default',
              userRole: req.user?.primaryRole || 'unknown',
            }
          );
        }
      });

      next();
    };
  }
}

module.exports = RBACMetricsCollector;
