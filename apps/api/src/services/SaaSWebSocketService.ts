// WebSocket Service for Real-time Updates in SaaS Settings Module
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { RedisCacheService } from './RedisCacheService';
import { CacheInvalidationService } from './CacheInvalidationService';
import { SystemAnalyticsService } from './SystemAnalyticsService';
import { SecurityMonitoringService } from './SaaSSecurityMonitoringService';
import logger from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  workspaceId?: string;
  role?: string;
  permissions?: string[];
}

interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  workspaceId?: string;
}

interface SubscriptionFilter {
  eventTypes?: string[];
  workspaceId?: string;
  tenantId?: string;
  userId?: string;
}

export class SaaSWebSocketService {
  private static instance: SaaSWebSocketService;
  private io: SocketIOServer;
  private cacheService: RedisCacheService;
  private cacheInvalidation: CacheInvalidationService;
  private systemAnalytics: SystemAnalyticsService;
  private securityMonitoring: SecurityMonitoringService;

  // Connection management
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map(); // userId -> Set of event types
  private workspaceSubscriptions: Map<string, Set<string>> = new Map(); // workspaceId -> Set of socketIds

  // Rate limiting
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_EVENTS = 100; // Max events per minute per user

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.cacheService = RedisCacheService.getInstance();
    this.cacheInvalidation = CacheInvalidationService.getInstance();
    this.systemAnalytics = SystemAnalyticsService.getInstance();
    this.securityMonitoring = SecurityMonitoringService.getInstance();

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startPeriodicUpdates();

    logger.info('SaaS WebSocket service initialized');
  }

  static getInstance(httpServer?: HttpServer): SaaSWebSocketService {
    if (!SaaSWebSocketService.instance && httpServer) {
      SaaSWebSocketService.instance = new SaaSWebSocketService(httpServer);
    }
    return SaaSWebSocketService.instance;
  }

  /**
   * Setup authentication and authorization middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        socket.userId = decoded.userId;
        socket.workspaceId = decoded.workspaceId;
        socket.role = decoded.role;
        socket.permissions = decoded.permissions || [];

        // Check if user has permission to connect to WebSocket
        if (!this.hasWebSocketPermission(socket)) {
          return next(new Error('Insufficient permissions for WebSocket connection'));
        }

        logger.debug(`WebSocket authentication successful for user ${socket.userId}`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);

      // Handle subscription requests
      socket.on('subscribe', (data: { eventTypes: string[]; filters?: SubscriptionFilter }) => {
        this.handleSubscription(socket, data);
      });

      // Handle unsubscription requests
      socket.on('unsubscribe', (data: { eventTypes: string[] }) => {
        this.handleUnsubscription(socket, data);
      });

      // Handle real-time data requests
      socket.on('request_data', (data: { type: string; filters?: any }) => {
        this.handleDataRequest(socket, data);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error for user ${socket.userId}:`, error);
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, workspaceId } = socket;

    if (!userId) return;

    // Store connection
    this.connectedClients.set(socket.id, socket);

    // Add to workspace subscriptions
    if (workspaceId) {
      if (!this.workspaceSubscriptions.has(workspaceId)) {
        this.workspaceSubscriptions.set(workspaceId, new Set());
      }
      this.workspaceSubscriptions.get(workspaceId)!.add(socket.id);
    }

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join workspace room if applicable
    if (workspaceId) {
      socket.join(`workspace:${workspaceId}`);
    }

    // Send initial connection data
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      workspaceId,
      timestamp: new Date().toISOString(),
    });

    // Log security event
    (this.securityMonitoring as any).logSecurityEvent({
      userId,
      action: 'websocket_connect',
      resource: 'websocket',
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      success: true,
      details: { socketId: socket.id },
    });

    logger.info(`WebSocket connected: user ${userId}, socket ${socket.id}`);
  }

  /**
   * Handle subscription to event types
   */
  private handleSubscription(socket: AuthenticatedSocket, data: { eventTypes: string[]; filters?: SubscriptionFilter }): void {
    const { userId } = socket;
    if (!userId) return;

    const { eventTypes, filters } = data;

    // Validate event types and permissions
    const allowedEventTypes = this.getAllowedEventTypes(socket);
    const validEventTypes = eventTypes.filter(type => allowedEventTypes.includes(type));

    if (validEventTypes.length === 0) {
      socket.emit('subscription_error', { message: 'No valid event types provided' });
      return;
    }

    // Store user subscriptions
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }

    const userSubs = this.userSubscriptions.get(userId)!;
    validEventTypes.forEach(type => userSubs.add(type));

    // Join event-specific rooms
    validEventTypes.forEach(eventType => {
      socket.join(`event:${eventType}`);

      // Join filtered rooms if applicable
      if (filters?.workspaceId) {
        socket.join(`event:${eventType}:workspace:${filters.workspaceId}`);
      }
      if (filters?.tenantId) {
        socket.join(`event:${eventType}:tenant:${filters.tenantId}`);
      }
    });

    socket.emit('subscribed', {
      eventTypes: validEventTypes,
      filters,
      timestamp: new Date().toISOString(),
    });

    logger.debug(`User ${userId} subscribed to events: ${validEventTypes.join(', ')}`);
  }

  /**
   * Handle unsubscription from event types
   */
  private handleUnsubscription(socket: AuthenticatedSocket, data: { eventTypes: string[] }): void {
    const { userId } = socket;
    if (!userId) return;

    const { eventTypes } = data;
    const userSubs = this.userSubscriptions.get(userId);

    if (!userSubs) return;

    // Remove from user subscriptions
    eventTypes.forEach(type => {
      userSubs.delete(type);
      socket.leave(`event:${type}`);
    });

    socket.emit('unsubscribed', {
      eventTypes,
      timestamp: new Date().toISOString(),
    });

    logger.debug(`User ${userId} unsubscribed from events: ${eventTypes.join(', ')}`);
  }

  /**
   * Handle real-time data requests
   */
  private async handleDataRequest(socket: AuthenticatedSocket, data: { type: string; filters?: any }): Promise<void> {
    const { userId, workspaceId } = socket;
    if (!userId) return;

    // Rate limiting
    if (!this.checkRateLimit(userId)) {
      socket.emit('rate_limit_exceeded', { message: 'Too many requests' });
      return;
    }

    try {
      let responseData: any;

      switch (data.type) {
        case 'system_metrics':
          responseData = await this.systemAnalytics.getSystemMetrics();
          break;
        case 'user_analytics':
          responseData = await this.systemAnalytics.getUserAnalytics(data.filters);
          break;
        case 'active_sessions':
          responseData = await this.securityMonitoring.getActiveSessions();
          break;
        case 'recent_activities':
          responseData = await this.systemAnalytics.getRecentActivities(data.filters?.limit || 10);
          break;
        case 'security_alerts':
          responseData = await (this.securityMonitoring as any).getSecurityAlerts(data.filters);
          break;
        default:
          socket.emit('data_error', { message: `Unknown data type: ${data.type}` });
          return;
      }

      socket.emit('data_response', {
        type: data.type,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error handling data request for user ${userId}:`, error);
      socket.emit('data_error', { message: 'Failed to fetch data' });
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const { userId, workspaceId } = socket;

    // Remove from connected clients
    this.connectedClients.delete(socket.id);

    // Remove from workspace subscriptions
    if (workspaceId) {
      const workspaceSubs = this.workspaceSubscriptions.get(workspaceId);
      if (workspaceSubs) {
        workspaceSubs.delete(socket.id);
        if (workspaceSubs.size === 0) {
          this.workspaceSubscriptions.delete(workspaceId);
        }
      }
    }

    // Log security event
    if (userId) {
      (this.securityMonitoring as any).logSecurityEvent({
        userId,
        action: 'websocket_disconnect',
        resource: 'websocket',
        ipAddress: socket.handshake.address,
        success: true,
        details: { socketId: socket.id, reason },
      });
    }

    logger.info(`WebSocket disconnected: user ${userId}, socket ${socket.id}, reason: ${reason}`);
  }

  /**
   * Broadcast event to subscribed clients
   */
  async broadcastEvent(event: WebSocketEvent): Promise<void> {
    try {
      const { type, data, userId, workspaceId } = event;

      // Broadcast to all subscribers of this event type
      this.io.to(`event:${type}`).emit('event', {
        type,
        data,
        timestamp: event.timestamp,
      });

      // Broadcast to workspace-specific subscribers if applicable
      if (workspaceId) {
        this.io.to(`event:${type}:workspace:${workspaceId}`).emit('event', {
          type,
          data,
          timestamp: event.timestamp,
          workspaceId,
        });
      }

      // Broadcast to user-specific room if applicable
      if (userId) {
        this.io.to(`user:${userId}`).emit('event', {
          type,
          data,
          timestamp: event.timestamp,
          userId,
        });
      }

      logger.debug(`Broadcasted event ${type} to subscribers`);
    } catch (error) {
      logger.error('Error broadcasting WebSocket event:', error);
    }
  }

  /**
   * Broadcast system metrics update
   */
  async broadcastSystemMetricsUpdate(metrics: any): Promise<void> {
    await this.broadcastEvent({
      type: 'system_metrics_updated',
      data: metrics,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast user activity update
   */
  async broadcastUserActivityUpdate(activity: any, workspaceId?: string): Promise<void> {
    await this.broadcastEvent({
      type: 'user_activity_updated',
      data: activity,
      timestamp: new Date(),
      workspaceId,
    });
  }

  /**
   * Broadcast security alert
   */
  async broadcastSecurityAlert(alert: any, workspaceId?: string): Promise<void> {
    await this.broadcastEvent({
      type: 'security_alert',
      data: alert,
      timestamp: new Date(),
      workspaceId,
    });
  }

  /**
   * Broadcast notification
   */
  async broadcastNotification(notification: any, userId?: string, workspaceId?: string): Promise<void> {
    await this.broadcastEvent({
      type: 'notification',
      data: notification,
      timestamp: new Date(),
      userId,
      workspaceId,
    });
  }

  /**
   * Start periodic updates for real-time data
   */
  private startPeriodicUpdates(): void {
    // Update system metrics every 30 seconds
    setInterval(async () => {
      try {
        const metrics = await this.systemAnalytics.getSystemMetrics();
        await this.broadcastSystemMetricsUpdate(metrics);
      } catch (error) {
        logger.error('Error in periodic system metrics update:', error);
      }
    }, 30000);

    // Update active sessions every 2 minutes
    setInterval(async () => {
      try {
        const sessions = await this.securityMonitoring.getActiveSessions();
        await this.broadcastEvent({
          type: 'active_sessions_updated',
          data: sessions,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Error in periodic active sessions update:', error);
      }
    }, 120000);
  }

  /**
   * Check if user has WebSocket permission
   */
  private hasWebSocketPermission(socket: AuthenticatedSocket): boolean {
    const { role, permissions } = socket;

    // Admin users always have access
    if (role === 'admin' || role === 'super_admin') {
      return true;
    }

    // Check specific permissions
    return permissions?.includes('websocket:connect') || permissions?.includes('saas:read') || false;
  }

  /**
   * Get allowed event types for user
   */
  private getAllowedEventTypes(socket: AuthenticatedSocket): string[] {
    const { role, permissions } = socket;

    const baseEvents = ['system_metrics_updated', 'notification'];

    if (role === 'admin' || role === 'super_admin') {
      return [
        ...baseEvents,
        'user_activity_updated',
        'security_alert',
        'active_sessions_updated',
        'cache_invalidated',
        'job_completed',
        'job_failed',
      ];
    }

    const allowedEvents = [...baseEvents];

    if (permissions?.includes('analytics:read')) {
      allowedEvents.push('user_activity_updated');
    }

    if (permissions?.includes('security:read')) {
      allowedEvents.push('security_alert', 'active_sessions_updated');
    }

    return allowedEvents;
  }

  /**
   * Check rate limit for user
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      this.rateLimits.set(userId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return true;
    }

    if (userLimit.count >= this.RATE_LIMIT_MAX_EVENTS) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectionsByWorkspace: Record<string, number>;
    connectionsByEventType: Record<string, number>;
  } {
    const connectionsByWorkspace: Record<string, number> = {};
    const connectionsByEventType: Record<string, number> = {};

    // Count connections by workspace
    for (const [workspaceId, socketIds] of this.workspaceSubscriptions) {
      connectionsByWorkspace[workspaceId] = socketIds.size;
    }

    // Count subscriptions by event type
    for (const [userId, eventTypes] of this.userSubscriptions) {
      for (const eventType of eventTypes) {
        connectionsByEventType[eventType] = (connectionsByEventType[eventType] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connectedClients.size,
      connectionsByWorkspace,
      connectionsByEventType,
    };
  }

  /**
   * Disconnect user sessions
   */
  disconnectUser(userId: string, reason: string = 'Admin disconnect'): void {
    for (const [socketId, socket] of this.connectedClients) {
      if (socket.userId === userId) {
        socket.emit('force_disconnect', { reason });
        socket.disconnect(true);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SaaS WebSocket service...');

    // Notify all connected clients
    this.io.emit('server_shutdown', { message: 'Server is shutting down' });

    // Close all connections
    this.io.close();

    // Clear internal state
    this.connectedClients.clear();
    this.userSubscriptions.clear();
    this.workspaceSubscriptions.clear();
    this.rateLimits.clear();

    logger.info('SaaS WebSocket service shut down successfully');
  }
}

export default SaaSWebSocketService;