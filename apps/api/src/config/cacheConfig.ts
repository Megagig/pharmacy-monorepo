// Cache Configuration for SaaS Settings Module
export interface CacheConfig {
  // Cache TTL settings (in seconds)
  ttl: {
    systemMetrics: number;
    userAnalytics: number;
    securitySettings: number;
    notifications: number;
    featureFlags: number;
    tenantData: number;
    billingData: number;
    supportTickets: number;
    apiMetrics: number;
  };
  
  // Cache warming settings
  warming: {
    enabled: boolean;
    interval: number; // in milliseconds
    criticalKeys: string[];
  };
  
  // Cache invalidation settings
  invalidation: {
    patterns: {
      userUpdate: string[];
      systemUpdate: string[];
      securityUpdate: string[];
      tenantUpdate: string[];
    };
  };
  
  // Performance settings
  performance: {
    compressionThreshold: number; // bytes
    maxKeyLength: number;
    batchSize: number;
  };
}

export const defaultCacheConfig: CacheConfig = {
  ttl: {
    systemMetrics: 300, // 5 minutes
    userAnalytics: 600, // 10 minutes
    securitySettings: 1800, // 30 minutes
    notifications: 300, // 5 minutes
    featureFlags: 900, // 15 minutes
    tenantData: 1800, // 30 minutes
    billingData: 600, // 10 minutes
    supportTickets: 180, // 3 minutes
    apiMetrics: 120, // 2 minutes
  },
  
  warming: {
    enabled: process.env.NODE_ENV === 'production',
    interval: 4 * 60 * 1000, // 4 minutes (before 5-minute TTL expires)
    criticalKeys: [
      'system:metrics',
      'system:health',
      'feature:flags:active',
      'security:settings:global',
    ],
  },
  
  invalidation: {
    patterns: {
      userUpdate: [
        'user:*',
        'users:list:*',
        'system:metrics',
        'analytics:users:*',
      ],
      systemUpdate: [
        'system:*',
        'health:*',
        'metrics:*',
      ],
      securityUpdate: [
        'security:*',
        'sessions:*',
        'audit:*',
      ],
      tenantUpdate: [
        'tenant:*',
        'tenants:list:*',
        'system:metrics',
      ],
    },
  },
  
  performance: {
    compressionThreshold: 1024, // 1KB
    maxKeyLength: 250,
    batchSize: 100,
  },
};

// Cache key generators for SaaS Settings
export class SaaSCacheKeys {
  // System metrics keys
  static systemMetrics(): string {
    return 'saas:system:metrics';
  }
  
  static systemHealth(): string {
    return 'saas:system:health';
  }
  
  static recentActivities(limit: number = 10): string {
    return `saas:system:activities:${limit}`;
  }
  
  // User management keys
  static usersList(page: number, limit: number, filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:users:list:${page}:${limit}:${filterHash}`;
  }
  
  static userDetails(userId: string): string {
    return `saas:user:${userId}`;
  }
  
  static userSessions(userId: string): string {
    return `saas:user:${userId}:sessions`;
  }
  
  static userActivityLogs(userId: string): string {
    return `saas:user:${userId}:activity`;
  }
  
  // Feature flags keys
  static featureFlags(): string {
    return 'saas:feature:flags';
  }
  
  static featureFlagUsage(flagId: string): string {
    return `saas:feature:${flagId}:usage`;
  }
  
  // Security keys
  static securitySettings(): string {
    return 'saas:security:settings';
  }
  
  static activeSessions(): string {
    return 'saas:security:sessions:active';
  }
  
  static loginHistory(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:security:login:history:${filterHash}`;
  }
  
  static auditLogs(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:security:audit:${filterHash}`;
  }
  
  // Analytics keys
  static subscriptionAnalytics(timeRange: string): string {
    return `saas:analytics:subscriptions:${timeRange}`;
  }
  
  static userAnalytics(timeRange: string): string {
    return `saas:analytics:users:${timeRange}`;
  }
  
  static revenueMetrics(timeRange: string): string {
    return `saas:analytics:revenue:${timeRange}`;
  }
  
  // Notification keys
  static notificationSettings(): string {
    return 'saas:notifications:settings';
  }
  
  static notificationHistory(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:notifications:history:${filterHash}`;
  }
  
  static notificationTemplates(): string {
    return 'saas:notifications:templates';
  }
  
  // Tenant management keys
  static tenantsList(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:tenants:list:${filterHash}`;
  }
  
  static tenantDetails(tenantId: string): string {
    return `saas:tenant:${tenantId}`;
  }
  
  static tenantAnalytics(tenantId: string, timeRange: string): string {
    return `saas:tenant:${tenantId}:analytics:${timeRange}`;
  }
  
  // Billing keys
  static billingOverview(): string {
    return 'saas:billing:overview';
  }
  
  static subscriptionDetails(subscriptionId: string): string {
    return `saas:billing:subscription:${subscriptionId}`;
  }
  
  static paymentHistory(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:billing:payments:${filterHash}`;
  }
  
  // Support keys
  static supportTickets(filters?: any): string {
    const filterHash = filters ? this.hashObject(filters) : 'all';
    return `saas:support:tickets:${filterHash}`;
  }
  
  static supportMetrics(): string {
    return 'saas:support:metrics';
  }
  
  static knowledgeBase(): string {
    return 'saas:support:kb';
  }
  
  // API management keys
  static apiEndpoints(): string {
    return 'saas:api:endpoints';
  }
  
  static apiUsageMetrics(timeRange: string): string {
    return `saas:api:usage:${timeRange}`;
  }
  
  static developerAccounts(): string {
    return 'saas:api:developers';
  }
  
  // Helper method to hash objects for consistent cache keys
  private static hashObject(obj: any): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex').substring(0, 8);
  }
}

// Cache tags for invalidation
export class SaaSCacheTags {
  static readonly SYSTEM = 'saas:system';
  static readonly USERS = 'saas:users';
  static readonly SECURITY = 'saas:security';
  static readonly ANALYTICS = 'saas:analytics';
  static readonly NOTIFICATIONS = 'saas:notifications';
  static readonly TENANTS = 'saas:tenants';
  static readonly BILLING = 'saas:billing';
  static readonly SUPPORT = 'saas:support';
  static readonly API = 'saas:api';
  static readonly FEATURE_FLAGS = 'saas:features';
  
  static user(userId: string): string {
    return `saas:user:${userId}`;
  }
  
  static tenant(tenantId: string): string {
    return `saas:tenant:${tenantId}`;
  }
  
  static subscription(subscriptionId: string): string {
    return `saas:subscription:${subscriptionId}`;
  }
}