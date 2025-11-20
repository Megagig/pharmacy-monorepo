import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectDB = async (): Promise<void> => {
  try {
    const disableProfiling = process.env.DISABLE_PROFILING === 'true';
    const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10');
    const minPoolSize = parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2');
    const maxIdleTimeMS = parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000');
    const serverSelectionTimeoutMS = parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000');

    const options: mongoose.ConnectOptions = {
      maxPoolSize,
      minPoolSize,
      maxIdleTimeMS,
      serverSelectionTimeoutMS,
      // Disable profiling for Atlas compatibility
      autoIndex: false,
      // Buffering settings
      bufferCommands: false,
    };

    // Only set profiling options if not disabled
    if (!disableProfiling) {
      logger.info('MongoDB profiling enabled');
    } else {
      logger.info('MongoDB profiling disabled for Atlas compatibility');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI!, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`MongoDB Connection Pool: ${minPoolSize}-${maxPoolSize} connections`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
