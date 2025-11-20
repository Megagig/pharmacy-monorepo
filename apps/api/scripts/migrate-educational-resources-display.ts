import mongoose from 'mongoose';
import EducationalResource from '../src/models/EducationalResource';
import logger from '../src/utils/logger';

/**
 * Migration script to add display settings to existing educational resources
 * This script adds the new fields: displayLocations, isPinned, displayOrder, pinnedAt
 */

async function migrateEducationalResources() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find all resources that don't have the new fields
    const resources = await EducationalResource.find({
      $or: [
        { displayLocations: { $exists: false } },
        { isPinned: { $exists: false } },
        { displayOrder: { $exists: false } }
      ]
    });

    logger.info(`Found ${resources.length} resources to migrate`);

    let successCount = 0;
    let errorCount = 0;

    // Update each resource
    for (const resource of resources) {
      try {
        // Set default values
        if (!resource.displayLocations || resource.displayLocations.length === 0) {
          (resource as any).displayLocations = ['education_page'];
        }
        
        if (typeof (resource as any).isPinned === 'undefined') {
          (resource as any).isPinned = false;
        }
        
        if (typeof (resource as any).displayOrder === 'undefined') {
          (resource as any).displayOrder = 0;
        }

        // Save the resource
        await resource.save();
        successCount++;
        
        if (successCount % 10 === 0) {
          logger.info(`Migrated ${successCount} resources...`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error migrating resource ${resource._id}:`, error);
      }
    }

    logger.info(`Migration completed!`);
    logger.info(`  - Successfully migrated: ${successCount}`);
    logger.info(`  - Errors: ${errorCount}`);

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the migration
migrateEducationalResources()
  .then(() => {
    logger.info('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration script failed:', error);
    process.exit(1);
  });
