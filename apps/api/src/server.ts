// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { performanceCollector } from './utils/performanceMonitoring';
import { invitationCronService } from './services/InvitationCronService';
import WorkspaceStatsCronService from './services/WorkspaceStatsCronService';
import UsageAlertCronService from './services/UsageAlertCronService';
import { emailDeliveryCronService } from './services/EmailDeliveryCronService';
import CommunicationSocketService from './services/communicationSocketService';
import SocketNotificationService from './services/socketNotificationService';
import AppointmentSocketService from './services/AppointmentSocketService';
import { QueueService } from './services/QueueService';
import { initializeWorkers } from './jobs/workers';
import { closeRedis } from './config/redis'; // CRITICAL: Use shared connection

// Import models to ensure they are registered with Mongoose
import './models/Medication';
import './models/Conversation';
import './models/Message';
import './models/PricingPlan';  // ← CRITICAL: Register PricingPlan model for subscription populate
import StartupValidationService from './services/StartupValidationService';

const PORT: number = parseInt(process.env.PORT || '5000', 10);

// Global variables for graceful shutdown
let server: any;

// Async function to initialize server
async function initializeServer() {
  try {
    // Connect to MongoDB first
    await connectDB();
    console.log('✅ Database connected successfully');

    // Wait for MongoDB to be fully ready before running validations
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Run startup validations (sync pricing plans, validate subscriptions)
    if (mongoose.connection.readyState === 1) {
      try {
        await StartupValidationService.runStartupValidations();
      } catch (error) {
        console.error('⚠️ Startup validation failed:', error);
        // Continue anyway - admin can fix via UI
      }
    } else {
      console.log('⚠️ MongoDB not ready, skipping startup validations');
    }

    // Wait a moment for MongoDB Atlas connection to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify MongoDB connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not fully connected, skipping workspace seeding');
    } else {
      // Seed sample workspaces if none exist
      try {
        const seedWorkspaces = (await import('./scripts/seedWorkspaces')).default;
        await seedWorkspaces();
      } catch (error) {
        console.error('⚠️ Error seeding workspaces:', error);
      }
    }

    // Start performance monitoring after DB is connected
    performanceCollector.startSystemMetricsCollection();

    // Initialize Queue Service and Job Workers
    try {
      // Skip Bull queues on free tier Redis (connection limit)
      if (process.env.DISABLE_BULL_QUEUES === 'true') {
        console.log('ℹ️ Bull queues disabled (DISABLE_BULL_QUEUES=true)');
        console.log('ℹ️ Background jobs will not be processed');
      } else {
        const queueService = QueueService.getInstance();
        await queueService.initialize();
        await initializeWorkers();
        console.log('✅ Queue Service and Job Workers initialized successfully');
      }
    } catch (error) {
      console.error('⚠️ Queue Service initialization failed:', error);
      console.log('ℹ️ Continuing without background jobs');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Create HTTP server
  const httpServer = createServer(app);

  // Configure Socket.IO CORS origins
  const socketCorsOrigins = [
    'http://localhost:3000', // Create React App dev server
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5173', // Alternative Vite URL
    'http://192.168.8.167:5173', // Local network Vite URL
    'https://PharmaPilot-nttq.onrender.com', // Production frontend
    process.env.FRONTEND_URL || 'http://localhost:3000',
  ];

  // Add additional origins from environment variable
  if (process.env.CORS_ORIGINS) {
    socketCorsOrigins.push(...process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()));
  }

  // Setup Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketCorsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Initialize Socket.IO services
  const communicationSocketService = new CommunicationSocketService(io);
  const socketNotificationService = new SocketNotificationService(io);
  const appointmentSocketService = new AppointmentSocketService(io);

  // Initialize new Chat Socket Service
  const { initializeChatSocketService } = await import('./services/chat/ChatSocketService');
  const { initializePresenceModel } = await import('./models/chat/Presence');
  const { getRedisClient } = await import('./config/redis');

  // Initialize Redis for presence tracking (use SHARED connection)
  if (process.env.REDIS_URL) {
    try {
      console.log('📡 Initializing Redis presence tracking using shared connection...');
      console.log(`🔗 Redis URL configured: ${process.env.REDIS_URL.substring(0, 20)}...`);

      const sharedRedisClient = await getRedisClient();

      if (sharedRedisClient) {
        // Initialize presence model with shared connection
        initializePresenceModel(sharedRedisClient);
        console.log('✅ Redis presence tracking initialized with shared connection');
      } else {
        console.log('⚠️ Redis not available - presence tracking disabled');
        console.log('ℹ️ Application will continue without Redis caching');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Redis presence tracking:', error);
      console.log('ℹ️ Application will continue without Redis caching');
    }
  } else {
    console.log('ℹ️ Redis presence tracking disabled (no REDIS_URL configured)');
  }

  // Initialize chat socket service
  const chatSocketService = initializeChatSocketService(io);

  // Make socket services available globally for other services
  app.set('communicationSocket', communicationSocketService);
  app.set('socketNotification', socketNotificationService);
  app.set('appointmentSocket', appointmentSocketService);
  app.set('chatSocket', chatSocketService);

  const server = httpServer.listen(PORT, () => {
    console.log(
      `🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
    );
    console.log(`📡 Socket.IO server initialized for real-time communication`);

    // Start cron services with delays to reduce memory spike
    if (process.env.NODE_ENV !== 'test') {
      invitationCronService.start();

      // Stagger the other services to reduce memory pressure
      setTimeout(() => WorkspaceStatsCronService.start(), 1000);
      setTimeout(() => UsageAlertCronService.start(), 2000);
      setTimeout(() => emailDeliveryCronService.start(), 3000);
    }

    // Start memory optimization
    if (process.env.NODE_ENV === 'production') {
      // Force garbage collection every 5 minutes in production
      setInterval(() => {
        if (global.gc) {
          global.gc();
          console.log('Garbage collection triggered');
        }
      }, 5 * 60 * 1000);
    }

    // Trigger initial garbage collection after startup
    setTimeout(() => {
      if (global.gc) {
        global.gc();
        console.log('Initial garbage collection after startup');
      }
    }, 10000); // 10 seconds after startup
  });

  return server;
}

// Graceful shutdown function
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }

    // Close SHARED Redis connection (only once)
    try {
      await closeRedis();
      console.log('✅ Shared Redis connection closed');
    } catch (error) {
      console.error('Error closing shared Redis connection:', error);
    }

    // Cleanup Queue Service
    try {
      const { QueueService } = await import('./services/QueueService');
      const queueService = QueueService.getInstance();
      await queueService.closeAll();
      console.log('✅ Queue Service shut down successfully');
    } catch (error) {
      console.log('ℹ️ Queue Service not active or already shut down');
    }

    // Close database connection
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('✅ Database connection closed');

    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`);
  console.log('Promise:', promise);

  // Don't shutdown for certain expected errors
  if (err.message.includes('Cannot set headers after they are sent')) {
    console.warn('⚠️ Headers already sent error - this is likely a timing issue with async operations');
    return;
  }

  // Check for Redis connection errors
  if (err.message.includes('Reached the max retries per request limit') ||
    err.message.includes('MaxRetriesPerRequestError') ||
    err.message.includes('ERR max number of clients reached') ||
    err.message.includes('Connection is closed') ||
    err.message.includes('ECONNRESET') ||
    err.message.includes('ETIMEDOUT')) {
    console.error('❌ Redis connection error detected:', err.message);
    console.log('ℹ️ Application will continue without Redis caching');
    return; // Don't crash the server for Redis errors
  }

  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.log(`Uncaught Exception: ${err.message}`);
  console.error('Stack trace:', err.stack);

  // Check for Redis-related errors
  if (err.message && (
    err.message.includes('Reached the max retries per request limit') ||
    err.message.includes('MaxRetriesPerRequestError') ||
    err.message.includes('ERR max number of clients reached') ||
    err.message.includes('Connection is closed') ||
    err.message.includes('ECONNRESET') ||
    err.message.includes('ETIMEDOUT') ||
    err.message.includes('Redis')
  )) {
    console.error('❌ Redis-related uncaught exception:', err.message);
    console.log('ℹ️ Application will continue without Redis caching');
    return; // Don't crash the server for Redis errors
  }

  // For other uncaught exceptions, exit gracefully
  gracefulShutdown('uncaughtException');
});

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize server
initializeServer()
  .then((serverInstance) => {
    server = serverInstance;
  })
  .catch((error) => {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  });

export default server;