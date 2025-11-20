import mongoose from 'mongoose';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Migration to add new license fields to User model
 * - pharmacySchool
 * - yearOfGraduation
 */
export async function up(): Promise<void> {
  try {
    logger.info('Starting migration: add-license-fields');

    // Update all users to have the new fields (set to undefined/null initially)
    const result = await User.updateMany(
      {
        $or: [
          { pharmacySchool: { $exists: false } },
          { yearOfGraduation: { $exists: false } },
        ],
      },
      {
        $set: {
          pharmacySchool: undefined,
          yearOfGraduation: undefined,
        },
      }
    );

    logger.info(`Migration completed: Updated ${result.modifiedCount} users`);
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback migration
 */
export async function down(): Promise<void> {
  try {
    logger.info('Rolling back migration: add-license-fields');

    // Remove the new fields
    const result = await User.updateMany(
      {},
      {
        $unset: {
          pharmacySchool: '',
          yearOfGraduation: '',
        },
      }
    );

    logger.info(`Rollback completed: Updated ${result.modifiedCount} users`);
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    logger.error('MONGODB_URI not found in environment variables');
    process.exit(1);
  }
  
  mongoose
    .connect(mongoUri)
    .then(async () => {
      logger.info('Connected to MongoDB');
      await up();
      await mongoose.disconnect();
      logger.info('Migration completed and disconnected');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration execution failed:', error);
      process.exit(1);
    });
}
