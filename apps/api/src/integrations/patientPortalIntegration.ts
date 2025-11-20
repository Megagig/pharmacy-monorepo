import { Express } from 'express';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import patientMessagingRoutes from '../routes/patientMessaging.routes';
import PatientPortalWebSocketIntegration from '../services/PatientPortalWebSocketIntegration';
import logger from '../utils/logger';

/**
 * Patient Portal Integration
 * Integrates all patient portal components with the main application
 */
export class PatientPortalIntegration {
  private app: Express;
  private httpServer: HttpServer;
  private io: SocketIOServer;
  private webSocketIntegration: PatientPortalWebSocketIntegration;

  constructor(app: Express, httpServer: HttpServer, io: SocketIOServer) {
    this.app = app;
    this.httpServer = httpServer;
    this.io = io;
    this.webSocketIntegration = PatientPortalWebSocketIntegration.getInstance();
  }

  /**
   * Initialize all patient portal components
   */
  async initialize(): Promise<void> {
    try {
      // Initialize WebSocket integration
      this.webSocketIntegration.initialize(this.io);

      // Setup REST API routes
      this.setupRoutes();

      // Setup middleware integrations
      this.setupMiddlewareIntegrations();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Patient portal integration initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize patient portal integration', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Patient messaging routes
    this.app.use('/api/patient-portal/messaging', patientMessagingRoutes);

    logger.info('Patient portal routes registered');
  }

  /**
   * Setup middleware integrations
   */
  private setupMiddlewareIntegrations(): void {
    // Add WebSocket integration to request context for controllers
    this.app.use('/api/patient-portal', (req: any, res, next) => {
      req.webSocketIntegration = this.webSocketIntegration;
      next();
    });

    logger.info('Patient portal middleware integrations setup');
  }

  /**
   * Setup graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown of patient portal`);
      
      // Shutdown WebSocket connections
      this.webSocketIntegration.shutdown();
      
      // Close HTTP server
      this.httpServer.close(() => {
        logger.info('Patient portal HTTP server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Get WebSocket integration instance
   */
  getWebSocketIntegration(): PatientPortalWebSocketIntegration {
    return this.webSocketIntegration;
  }

  /**
   * Health check for patient portal components
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: {
      webSocket: 'healthy' | 'unhealthy';
      routes: 'healthy' | 'unhealthy';
    };
    stats?: any;
  }> {
    try {
      const webSocketHealthy = this.webSocketIntegration.getHandler() !== null;
      const routesHealthy = true; // Routes are always healthy if app is running
      
      const stats = this.webSocketIntegration.getConnectionStats();
      
      return {
        status: webSocketHealthy && routesHealthy ? 'healthy' : 'unhealthy',
        components: {
          webSocket: webSocketHealthy ? 'healthy' : 'unhealthy',
          routes: routesHealthy ? 'healthy' : 'unhealthy',
        },
        stats,
      };
    } catch (error: any) {
      logger.error('Patient portal health check failed', {
        error: error.message,
      });
      
      return {
        status: 'unhealthy',
        components: {
          webSocket: 'unhealthy',
          routes: 'unhealthy',
        },
      };
    }
  }

  /**
   * Enable maintenance mode for patient portal
   */
  enableMaintenanceMode(workplaceId?: string): void {
    this.webSocketIntegration.enableMaintenanceMode(workplaceId);
    logger.info('Patient portal maintenance mode enabled', { workplaceId });
  }

  /**
   * Disable maintenance mode for patient portal
   */
  disableMaintenanceMode(workplaceId?: string): void {
    this.webSocketIntegration.disableMaintenanceMode(workplaceId);
    logger.info('Patient portal maintenance mode disabled', { workplaceId });
  }

  /**
   * Broadcast system notification to patients
   */
  broadcastSystemNotification(workplaceId: string, notification: {
    type: string;
    title: string;
    message: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    data?: any;
  }): void {
    this.webSocketIntegration.broadcastSystemNotification(workplaceId, notification);
    logger.info('System notification broadcasted to patient portal', {
      workplaceId,
      notificationType: notification.type,
      priority: notification.priority,
    });
  }

  /**
   * Get patient portal metrics
   */
  getMetrics(): {
    connections: any;
    onlinePatients: string[];
    activeConversations: number;
  } {
    const stats = this.webSocketIntegration.getConnectionStats();
    
    return {
      connections: stats,
      onlinePatients: [], // Would need to implement patient tracking
      activeConversations: stats.activeConversations,
    };
  }
}

/**
 * Factory function to create and initialize patient portal integration
 */
export async function createPatientPortalIntegration(
  app: Express,
  httpServer: HttpServer,
  io: SocketIOServer
): Promise<PatientPortalIntegration> {
  const integration = new PatientPortalIntegration(app, httpServer, io);
  await integration.initialize();
  return integration;
}

export default PatientPortalIntegration;