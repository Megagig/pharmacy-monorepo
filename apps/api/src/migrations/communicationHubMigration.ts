import mongoose from 'mongoose';
import logger from '../utils/logger';
import { createCommunicationIndexes } from '../utils/communicationIndexes';

/**
 * Communication Hub Database Migration
 * Sets up indexes and ensures data integrity for communication models
 */

export interface MigrationResult {
  success: boolean;
  message: string;
  details?: any;
  errors?: string[];
}

/**
 * Run the communication hub migration
 */
export async function runCommunicationHubMigration(): Promise<MigrationResult> {
  try {
    logger.info('Starting Communication Hub migration...');

    const results: any = {
      indexesCreated: false,
      dataValidated: false,
      errors: [],
    };

    // Step 1: Create database indexes
    try {
      await createCommunicationIndexes();
      results.indexesCreated = true;
      logger.info('✓ Communication indexes created successfully');
    } catch (error) {
      const errorMsg = `Failed to create indexes: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    // Step 2: Validate existing data integrity
    try {
      const validationResults = await validateExistingData();
      results.dataValidated = validationResults.success;

      if (!validationResults.success) {
        results.errors.push(...validationResults.errors);
      }

      logger.info('✓ Data validation completed');
    } catch (error) {
      const errorMsg = `Failed to validate data: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    // Step 3: Update existing documents with new fields
    try {
      const updateResults = await updateExistingDocuments();
      results.documentsUpdated = updateResults.totalUpdated;
      logger.info(`✓ Updated ${updateResults.totalUpdated} existing documents`);
    } catch (error) {
      const errorMsg = `Failed to update documents: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    // Step 4: Set up default permissions and metadata
    try {
      await setupDefaultPermissions();
      logger.info('✓ Default permissions configured');
    } catch (error) {
      const errorMsg = `Failed to setup permissions: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    const success = results.errors.length === 0;
    const message = success
      ? 'Communication Hub migration completed successfully'
      : `Migration completed with ${results.errors.length} errors`;

    logger.info(message);

    return {
      success,
      message,
      details: results,
      errors: results.errors.length > 0 ? results.errors : undefined,
    };
  } catch (error) {
    const errorMsg = `Communication Hub migration failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.error(errorMsg, error);

    return {
      success: false,
      message: errorMsg,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Validate existing data integrity
 */
async function validateExistingData(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    // Check for conversations without required fields
    const Conversation = mongoose.model('Conversation');
    const invalidConversations = await Conversation.find({
      $or: [
        { workplaceId: { $exists: false } },
        { participants: { $size: 0 } },
        { 'metadata.isEncrypted': { $exists: false } },
      ],
    }).countDocuments();

    if (invalidConversations > 0) {
      errors.push(
        `Found ${invalidConversations} conversations with missing required fields`
      );
    }

    // Check for messages without encryption metadata
    const Message = mongoose.model('Message');
    const unencryptedMessages = await Message.find({
      isEncrypted: { $ne: true },
    }).countDocuments();

    if (unencryptedMessages > 0) {
      errors.push(
        `Found ${unencryptedMessages} messages without encryption metadata`
      );
    }

    // Check for notifications without delivery channels
    const Notification = mongoose.model('Notification');
    const invalidNotifications = await Notification.find({
      deliveryChannels: { $exists: false },
    }).countDocuments();

    if (invalidNotifications > 0) {
      errors.push(
        `Found ${invalidNotifications} notifications without delivery channels`
      );
    }

    // Check for orphaned messages (messages without valid conversations)
    const orphanedMessages = await Message.aggregate([
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation',
        },
      },
      {
        $match: {
          conversation: { $size: 0 },
        },
      },
      {
        $count: 'orphanedCount',
      },
    ]);

    const orphanedCount =
      orphanedMessages.length > 0 ? orphanedMessages[0].orphanedCount : 0;
    if (orphanedCount > 0) {
      errors.push(
        `Found ${orphanedCount} orphaned messages without valid conversations`
      );
    }

    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    logger.error('Error during data validation:', error);
    return {
      success: false,
      errors: [
        `Data validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

/**
 * Update existing documents with new fields and structure
 */
async function updateExistingDocuments(): Promise<{ totalUpdated: number }> {
  let totalUpdated = 0;

  try {
    const Conversation = mongoose.model('Conversation');
    const Message = mongoose.model('Message');
    const Notification = mongoose.model('Notification');

    // Update conversations with missing metadata
    const conversationUpdates = await Conversation.updateMany(
      {
        $or: [
          { 'metadata.isEncrypted': { $exists: false } },
          { unreadCount: { $exists: false } },
          { status: { $exists: false } },
          { priority: { $exists: false } },
        ],
      },
      {
        $set: {
          'metadata.isEncrypted': true,
          unreadCount: {},
          status: 'active',
          priority: 'normal',
        },
      }
    );
    totalUpdated += conversationUpdates.modifiedCount;

    // Update messages with missing encryption metadata
    const messageUpdates = await Message.updateMany(
      {
        $or: [
          { isEncrypted: { $exists: false } },
          { status: { $exists: false } },
          { priority: { $exists: false } },
        ],
      },
      {
        $set: {
          isEncrypted: true,
          status: 'sent',
          priority: 'normal',
          reactions: [],
          readBy: [],
          editHistory: [],
        },
      }
    );
    totalUpdated += messageUpdates.modifiedCount;

    // Update notifications with missing delivery metadata
    const notificationUpdates = await Notification.updateMany(
      {
        $or: [
          { deliveryChannels: { $exists: false } },
          { deliveryStatus: { $exists: false } },
          { status: { $exists: false } },
        ],
      },
      {
        $set: {
          'deliveryChannels.inApp': true,
          'deliveryChannels.email': false,
          'deliveryChannels.sms': false,
          'deliveryChannels.push': true,
          deliveryStatus: [
            {
              channel: 'inApp',
              status: 'pending',
              attempts: 0,
            },
          ],
          status: 'unread',
        },
      }
    );
    totalUpdated += notificationUpdates.modifiedCount;

    // Generate encryption key IDs for encrypted content
    const conversationsNeedingKeys = await Conversation.find({
      'metadata.isEncrypted': true,
      'metadata.encryptionKeyId': { $exists: false },
    });

    for (const conversation of conversationsNeedingKeys) {
      conversation.metadata.encryptionKeyId = `conv_${
        conversation._id
      }_${Date.now()}`;
      await conversation.save();
      totalUpdated++;
    }

    const messagesNeedingKeys = await Message.find({
      isEncrypted: true,
      encryptionKeyId: { $exists: false },
    });

    for (const message of messagesNeedingKeys) {
      message.encryptionKeyId = `msg_${message._id}_${Date.now()}`;
      await message.save();
      totalUpdated++;
    }

    return { totalUpdated };
  } catch (error) {
    logger.error('Error updating existing documents:', error);
    throw error;
  }
}

/**
 * Set up default permissions for existing participants
 */
async function setupDefaultPermissions(): Promise<void> {
  try {
    const Conversation = mongoose.model('Conversation');

    // Find conversations with participants missing permissions
    const conversationsNeedingPermissions = await Conversation.find({
      'participants.permissions': { $exists: false },
    });

    for (const conversation of conversationsNeedingPermissions) {
      let updated = false;

      for (const participant of conversation.participants) {
        if (!participant.permissions || participant.permissions.length === 0) {
          // Set default permissions based on role
          switch (participant.role) {
            case 'patient':
              participant.permissions = [
                'read_messages',
                'send_messages',
                'upload_files',
              ];
              break;
            case 'pharmacist':
            case 'doctor':
              participant.permissions = [
                'read_messages',
                'send_messages',
                'upload_files',
                'view_patient_data',
                'manage_clinical_context',
              ];
              break;
            case 'pharmacy_team':
            case 'intern_pharmacist':
              participant.permissions = [
                'read_messages',
                'send_messages',
                'upload_files',
              ];
              break;
            default:
              participant.permissions = ['read_messages', 'send_messages'];
          }
          updated = true;
        }
      }

      if (updated) {
        await conversation.save();
      }
    }
  } catch (error) {
    logger.error('Error setting up default permissions:', error);
    throw error;
  }
}

/**
 * Rollback the migration (for testing or emergency)
 */
export async function rollbackCommunicationHubMigration(): Promise<MigrationResult> {
  try {
    logger.info('Starting Communication Hub migration rollback...');

    const results: any = {
      indexesDropped: false,
      fieldsRemoved: false,
      errors: [],
    };

    // Drop communication indexes
    try {
      const { dropCommunicationIndexes } = await import(
        '../utils/communicationIndexes'
      );
      await dropCommunicationIndexes();
      results.indexesDropped = true;
      logger.info('✓ Communication indexes dropped');
    } catch (error) {
      const errorMsg = `Failed to drop indexes: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    // Remove migration-added fields (optional - be careful with this)
    try {
      const Conversation = mongoose.model('Conversation');
      const Message = mongoose.model('Message');
      const Notification = mongoose.model('Notification');

      // Remove new fields added by migration
      await Conversation.updateMany(
        {},
        {
          $unset: {
            'metadata.encryptionKeyId': '',
            unreadCount: '',
          },
        }
      );

      await Message.updateMany(
        {},
        {
          $unset: {
            encryptionKeyId: '',
            reactions: '',
            editHistory: '',
          },
        }
      );

      await Notification.updateMany(
        {},
        {
          $unset: {
            deliveryStatus: '',
            groupKey: '',
            batchId: '',
          },
        }
      );

      results.fieldsRemoved = true;
      logger.info('✓ Migration fields removed');
    } catch (error) {
      const errorMsg = `Failed to remove fields: ${
        error instanceof Error ? error.message : String(error)
      }`;
      results.errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    const success = results.errors.length === 0;
    const message = success
      ? 'Communication Hub migration rollback completed successfully'
      : `Rollback completed with ${results.errors.length} errors`;

    logger.info(message);

    return {
      success,
      message,
      details: results,
      errors: results.errors.length > 0 ? results.errors : undefined,
    };
  } catch (error) {
    const errorMsg = `Communication Hub migration rollback failed: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.error(errorMsg, error);

    return {
      success: false,
      message: errorMsg,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Check migration status
 */
export async function checkCommunicationHubMigrationStatus(): Promise<{
  isComplete: boolean;
  details: any;
}> {
  try {
    const status = {
      indexesExist: false,
      dataIntegrity: false,
      permissionsConfigured: false,
      encryptionKeysGenerated: false,
    };

    // Check if indexes exist
    try {
      const db = mongoose.connection.db;
      const conversationIndexes = await db
        .collection('conversations')
        .indexes();
      status.indexesExist = conversationIndexes.length > 1; // More than just _id index
    } catch (error) {
      logger.warn('Could not check index status:', error);
    }

    // Check data integrity
    try {
      const validationResult = await validateExistingData();
      status.dataIntegrity = validationResult.success;
    } catch (error) {
      logger.warn('Could not check data integrity:', error);
    }

    // Check if permissions are configured
    try {
      const Conversation = mongoose.model('Conversation');
      const conversationsWithoutPermissions = await Conversation.find({
        'participants.permissions': { $exists: false },
      }).countDocuments();
      status.permissionsConfigured = conversationsWithoutPermissions === 0;
    } catch (error) {
      logger.warn('Could not check permissions status:', error);
    }

    // Check if encryption keys are generated
    try {
      const Conversation = mongoose.model('Conversation');
      const Message = mongoose.model('Message');

      const conversationsWithoutKeys = await Conversation.find({
        'metadata.isEncrypted': true,
        'metadata.encryptionKeyId': { $exists: false },
      }).countDocuments();

      const messagesWithoutKeys = await Message.find({
        isEncrypted: true,
        encryptionKeyId: { $exists: false },
      }).countDocuments();

      status.encryptionKeysGenerated =
        conversationsWithoutKeys === 0 && messagesWithoutKeys === 0;
    } catch (error) {
      logger.warn('Could not check encryption keys status:', error);
    }

    const isComplete = Object.values(status).every(Boolean);

    return {
      isComplete,
      details: status,
    };
  } catch (error) {
    logger.error('Error checking migration status:', error);
    return {
      isComplete: false,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export default {
  runCommunicationHubMigration,
  rollbackCommunicationHubMigration,
  checkCommunicationHubMigrationStatus,
};
