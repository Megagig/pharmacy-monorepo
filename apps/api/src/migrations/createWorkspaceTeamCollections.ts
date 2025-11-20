import mongoose from 'mongoose';
import { WorkspaceInvite } from '../models/WorkspaceInvite';
import { WorkspaceAuditLog } from '../models/WorkspaceAuditLog';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to create WorkspaceInvite and WorkspaceAuditLog collections
 * with proper indexes for the Workspace Team Management system.
 * 
 * This script:
 * 1. Creates the workspace_invites collection with all required indexes
 * 2. Creates the workspace_audit_logs collection with all required indexes
 * 3. Validates that indexes are created correctly
 * 4. Reports on the migration status
 */

interface MigrationResult {
  success: boolean;
  collection: string;
  indexesCreated: number;
  error?: string;
}

async function createWorkspaceInviteCollection(): Promise<MigrationResult> {
  try {
    console.log('\n📋 Creating WorkspaceInvite collection...');
    
    // Get the collection
    const collection = mongoose.connection.collection('workspace_invites');
    
    // Check if collection exists
    const collections = await mongoose.connection.db.listCollections({ name: 'workspace_invites' }).toArray();
    
    if (collections.length === 0) {
      console.log('  ✓ Collection does not exist, will be created on first document insert');
    } else {
      console.log('  ✓ Collection already exists');
    }
    
    // Create indexes by accessing the model (this triggers index creation)
    await WorkspaceInvite.init();
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log(`  ✓ Total indexes: ${indexes.length}`);
    
    // List all indexes
    console.log('\n  Indexes created:');
    indexes.forEach((index: any) => {
      const keys = Object.keys(index.key).join(', ');
      const unique = index.unique ? ' (unique)' : '';
      const ttl = index.expireAfterSeconds ? ` (TTL: ${index.expireAfterSeconds}s)` : '';
      console.log(`    - ${index.name}: ${keys}${unique}${ttl}`);
    });
    
    return {
      success: true,
      collection: 'workspace_invites',
      indexesCreated: indexes.length,
    };
  } catch (error: any) {
    console.error('  ✗ Error creating WorkspaceInvite collection:', error.message);
    return {
      success: false,
      collection: 'workspace_invites',
      indexesCreated: 0,
      error: error.message,
    };
  }
}

async function createWorkspaceAuditLogCollection(): Promise<MigrationResult> {
  try {
    console.log('\n📋 Creating WorkspaceAuditLog collection...');
    
    // Get the collection
    const collection = mongoose.connection.collection('workspace_audit_logs');
    
    // Check if collection exists
    const collections = await mongoose.connection.db.listCollections({ name: 'workspace_audit_logs' }).toArray();
    
    if (collections.length === 0) {
      console.log('  ✓ Collection does not exist, will be created on first document insert');
    } else {
      console.log('  ✓ Collection already exists');
    }
    
    // Create indexes by accessing the model (this triggers index creation)
    await WorkspaceAuditLog.init();
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log(`  ✓ Total indexes: ${indexes.length}`);
    
    // List all indexes
    console.log('\n  Indexes created:');
    indexes.forEach((index: any) => {
      const keys = Object.keys(index.key).join(', ');
      const unique = index.unique ? ' (unique)' : '';
      const ttl = index.expireAfterSeconds ? ` (TTL: ${index.expireAfterSeconds}s)` : '';
      console.log(`    - ${index.name}: ${keys}${unique}${ttl}`);
    });
    
    return {
      success: true,
      collection: 'workspace_audit_logs',
      indexesCreated: indexes.length,
    };
  } catch (error: any) {
    console.error('  ✗ Error creating WorkspaceAuditLog collection:', error.message);
    return {
      success: false,
      collection: 'workspace_audit_logs',
      indexesCreated: 0,
      error: error.message,
    };
  }
}

async function validateIndexes(): Promise<void> {
  console.log('\n🔍 Validating indexes...');
  
  try {
    // Validate WorkspaceInvite indexes
    const inviteCollection = mongoose.connection.collection('workspace_invites');
    const inviteIndexes = await inviteCollection.indexes();
    
    const requiredInviteIndexes = [
      'inviteToken_1',
      'workplaceId_1_status_1',
      'workplaceId_1_email_1',
      'expiresAt_1',
    ];
    
    console.log('\n  WorkspaceInvite indexes:');
    const missingInviteIndexes = requiredInviteIndexes.filter(
      (indexName) => !inviteIndexes.some((idx: any) => idx.name === indexName)
    );
    
    if (missingInviteIndexes.length === 0) {
      console.log('    ✓ All required indexes are present');
    } else {
      console.log('    ⚠ Missing indexes:', missingInviteIndexes.join(', '));
    }
    
    // Validate WorkspaceAuditLog indexes
    const auditCollection = mongoose.connection.collection('workspace_audit_logs');
    const auditIndexes = await auditCollection.indexes();
    
    const requiredAuditIndexes = [
      'workplaceId_1_timestamp_-1',
      'workplaceId_1_actorId_1_timestamp_-1',
      'workplaceId_1_category_1_timestamp_-1',
      'timestamp_1',
    ];
    
    console.log('\n  WorkspaceAuditLog indexes:');
    const missingAuditIndexes = requiredAuditIndexes.filter(
      (indexName) => !auditIndexes.some((idx: any) => idx.name === indexName)
    );
    
    if (missingAuditIndexes.length === 0) {
      console.log('    ✓ All required indexes are present');
    } else {
      console.log('    ⚠ Missing indexes:', missingAuditIndexes.join(', '));
    }
  } catch (error: any) {
    console.error('  ✗ Error validating indexes:', error.message);
  }
}

async function runMigration(): Promise<void> {
  console.log('🚀 Starting Workspace Team Management Collections Migration');
  console.log('=' .repeat(60));
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmily';
    console.log(`\n📡 Connecting to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    
    await mongoose.connect(mongoUri);
    console.log('  ✓ Connected to MongoDB');
    
    // Create collections and indexes
    const results: MigrationResult[] = [];
    
    results.push(await createWorkspaceInviteCollection());
    results.push(await createWorkspaceAuditLogCollection());
    
    // Validate indexes
    await validateIndexes();
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    
    results.forEach((result) => {
      const status = result.success ? '✓' : '✗';
      console.log(`\n${status} ${result.collection}`);
      console.log(`  Indexes: ${result.indexesCreated}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    const allSuccessful = results.every((r) => r.success);
    
    if (allSuccessful) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('  1. Verify the collections in MongoDB');
      console.log('  2. Run tests to ensure models work correctly');
      console.log('  3. Proceed with implementing the API endpoints');
    } else {
      console.log('\n⚠️  Migration completed with errors');
      console.log('Please review the errors above and fix them before proceeding.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✨ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration, createWorkspaceInviteCollection, createWorkspaceAuditLogCollection };
