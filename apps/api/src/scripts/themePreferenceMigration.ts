import mongoose from 'mongoose';
import User from '../models/User';

/**
 * Migration script to add themePreference field to existing users
 * This script adds the themePreference field with default value 'system'
 * to all users who don't have this field
 */

const MIGRATION_NAME = 'add_theme_preference_to_users';

export const addThemePreferenceField = async (): Promise<void> => {
  try {
    console.log(`Starting migration: ${MIGRATION_NAME}`);

    // Count users without themePreference field
    const usersWithoutThemePreference = await User.countDocuments({
      themePreference: { $exists: false },
    });

    console.log(
      `Found ${usersWithoutThemePreference} users without themePreference field`
    );

    if (usersWithoutThemePreference === 0) {
      console.log(
        'No users need migration. All users already have themePreference field.'
      );
      return;
    }

    // Update all users without themePreference field
    const result = await User.updateMany(
      { themePreference: { $exists: false } },
      {
        $set: {
          themePreference: 'system', // Set default to system preference
        },
      }
    );

    console.log(`Migration completed successfully:`);
    console.log(`- Updated ${result.modifiedCount} users`);
    console.log(`- Matched ${result.matchedCount} users`);

    // Verify the migration
    const remainingUsers = await User.countDocuments({
      themePreference: { $exists: false },
    });

    if (remainingUsers === 0) {
      console.log(
        '✅ Migration verification passed: All users now have themePreference field'
      );
    } else {
      console.warn(
        `⚠️  Migration verification failed: ${remainingUsers} users still missing themePreference field`
      );
    }
  } catch (error) {
    console.error(`Migration ${MIGRATION_NAME} failed:`, error);
    throw error;
  }
};

export const rollbackThemePreferenceField = async (): Promise<void> => {
  try {
    console.log(`Starting rollback for migration: ${MIGRATION_NAME}`);

    const result = await User.updateMany(
      {},
      {
        $unset: {
          themePreference: 1,
        },
      }
    );

    console.log(
      `Rollback completed: Removed themePreference field from ${result.modifiedCount} users`
    );
  } catch (error) {
    console.error(`Rollback for ${MIGRATION_NAME} failed:`, error);
    throw error;
  }
};

// CLI execution
if (require.main === module) {
  const action = process.argv[2];

  const connectDB = async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  };

  const disconnectDB = async () => {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  };

  switch (action) {
    case 'up':
      connectDB()
        .then(addThemePreferenceField)
        .then(disconnectDB)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Migration failed:', error);
          process.exit(1);
        });
      break;

    case 'down':
      connectDB()
        .then(rollbackThemePreferenceField)
        .then(disconnectDB)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Rollback failed:', error);
          process.exit(1);
        });
      break;

    case 'status':
      connectDB()
        .then(async () => {
          const totalUsers = await User.countDocuments();
          const usersWithTheme = await User.countDocuments({
            themePreference: { $exists: true },
          });
          const usersWithoutTheme = totalUsers - usersWithTheme;

          console.log(`Migration Status: ${MIGRATION_NAME}`);
          console.log(`Total users: ${totalUsers}`);
          console.log(`Users with themePreference: ${usersWithTheme}`);
          console.log(`Users without themePreference: ${usersWithoutTheme}`);
          console.log(
            `Migration status: ${
              usersWithoutTheme === 0 ? '✅ Complete' : '❌ Incomplete'
            }`
          );
        })
        .then(disconnectDB)
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('Status check failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(
        'Usage: ts-node themePreferenceMigration.ts [up|down|status]'
      );
      console.log('  up     - Apply migration (add themePreference field)');
      console.log(
        '  down   - Rollback migration (remove themePreference field)'
      );
      console.log('  status - Check migration status');
      process.exit(1);
  }
}
