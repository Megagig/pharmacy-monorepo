import mongoose from 'mongoose';
import dotenv from 'dotenv';
import UnifiedAuditLog from '../models/UnifiedAuditLog';
import { WorkspaceAuditLog } from '../models/WorkspaceAuditLog';
import { SecurityAuditLog } from '../models/SecurityAuditLog';
import MTRAuditLog from '../models/MTRAuditLog';
import CommunicationAuditLog from '../models/CommunicationAuditLog';

dotenv.config();

/**
 * Migration Script: Populate Unified Audit Log
 * 
 * This script migrates existing audit logs from various specialized
 * audit log collections into the new unified audit log system.
 */

interface MigrationStats {
    workspace: number;
    security: number;
    mtr: number;
    communication: number;
    total: number;
    errors: number;
}

const stats: MigrationStats = {
    workspace: 0,
    security: 0,
    mtr: 0,
    communication: 0,
    total: 0,
    errors: 0,
};

async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function migrateWorkspaceAuditLogs() {
    console.log('\n📋 Migrating Workspace Audit Logs...');

    try {
        const workspaceLogs = await WorkspaceAuditLog.find({}).lean();
        console.log(`Found ${workspaceLogs.length} workspace audit logs`);

        for (const log of workspaceLogs) {
            try {
                // Check if already migrated
                const existing = await UnifiedAuditLog.findOne({
                    userId: log.actorId,
                    timestamp: log.timestamp,
                    action: `WORKSPACE_${log.action}`,
                });

                if (existing) {
                    continue;
                }

                await UnifiedAuditLog.create({
                    userId: log.actorId,
                    workplaceId: log.workplaceId,
                    activityType: 'workspace_management',
                    action: `WORKSPACE_${log.action}`,
                    description: `Workspace activity: ${log.action}`,
                    targetEntity: log.targetId ? {
                        entityType: 'User',
                        entityId: log.targetId,
                        entityName: 'Team Member',
                    } : undefined,
                    changes: log.details?.before && log.details?.after ? [{
                        field: 'status',
                        oldValue: log.details.before,
                        newValue: log.details.after,
                    }] : undefined,
                    metadata: log.details?.metadata || {},
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                    riskLevel: log.severity || 'low',
                    success: true,
                    timestamp: log.timestamp,
                });

                stats.workspace++;
            } catch (error) {
                console.error(`Error migrating workspace log ${log._id}:`, error);
                stats.errors++;
            }
        }

        console.log(`✅ Migrated ${stats.workspace} workspace audit logs`);
    } catch (error) {
        console.error('❌ Error in workspace migration:', error);
    }
}

async function migrateSecurityAuditLogs() {
    console.log('\n🔒 Migrating Security Audit Logs...');

    try {
        const securityLogs = await SecurityAuditLog.find({}).lean();
        console.log(`Found ${securityLogs.length} security audit logs`);

        for (const log of securityLogs) {
            try {
                // Check if already migrated
                const existing = await UnifiedAuditLog.findOne({
                    userId: log.userId,
                    timestamp: log.timestamp,
                    action: `SECURITY_${log.action}`,
                });

                if (existing) {
                    continue;
                }

                await UnifiedAuditLog.create({
                    userId: log.userId,
                    workplaceId: log.workspaceId,
                    activityType: log.category === 'authentication' ? 'authentication' : 'security_event',
                    action: `SECURITY_${log.action}`,
                    description: `Security event: ${log.action} on ${log.resource}`,
                    targetEntity: log.resourceId ? {
                        entityType: log.resource,
                        entityId: log.resourceId,
                        entityName: log.resource,
                    } : undefined,
                    metadata: log.details || {},
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                    riskLevel: log.severity || 'medium',
                    success: log.success,
                    errorMessage: log.errorMessage,
                    timestamp: log.timestamp,
                    location: log.location,
                    sessionId: log.sessionId,
                    flagged: log.flagged || false,
                    reviewedBy: log.reviewedBy,
                    reviewedAt: log.reviewedAt,
                    reviewNotes: log.reviewNotes,
                });

                stats.security++;
            } catch (error) {
                console.error(`Error migrating security log ${log._id}:`, error);
                stats.errors++;
            }
        }

        console.log(`✅ Migrated ${stats.security} security audit logs`);
    } catch (error) {
        console.error('❌ Error in security migration:', error);
    }
}

async function migrateMTRAuditLogs() {
    console.log('\n💊 Migrating MTR Audit Logs...');

    try {
        const mtrLogs = await MTRAuditLog.find({}).lean();
        console.log(`Found ${mtrLogs.length} MTR audit logs`);

        for (const log of mtrLogs) {
            try {
                // Check if already migrated
                const existing = await UnifiedAuditLog.findOne({
                    userId: log.userId,
                    timestamp: log.timestamp,
                    action: `MTR_${log.action}`,
                });

                if (existing) {
                    continue;
                }

                await UnifiedAuditLog.create({
                    userId: log.userId,
                    activityType: 'mtr_session',
                    action: `MTR_${log.action}`,
                    description: `MTR activity: ${log.action}`,
                    targetEntity: log.resourceId ? {
                        entityType: log.resourceType || 'MTRSession',
                        entityId: log.resourceId,
                        entityName: log.resourceType || 'MTR Resource',
                    } : undefined,
                    metadata: {
                        resourceType: log.resourceType,
                        userRole: log.userRole,
                    },
                    riskLevel: 'low',
                    complianceCategory: 'HIPAA',
                    success: true,
                    timestamp: log.timestamp,
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                }); stats.mtr++;
            } catch (error) {
                console.error(`Error migrating MTR log ${log._id}:`, error);
                stats.errors++;
            }
        }

        console.log(`✅ Migrated ${stats.mtr} MTR audit logs`);
    } catch (error) {
        console.error('❌ Error in MTR migration:', error);
    }
}

async function migrateCommunicationAuditLogs() {
    console.log('\n💬 Migrating Communication Audit Logs...');

    try {
        const commLogs = await CommunicationAuditLog.find({}).lean();
        console.log(`Found ${commLogs.length} communication audit logs`);

        for (const log of commLogs) {
            try {
                // Check if already migrated
                const existing = await UnifiedAuditLog.findOne({
                    userId: log.userId,
                    timestamp: log.timestamp,
                    action: `COMM_${log.action}`,
                });

                if (existing) {
                    continue;
                }

                await UnifiedAuditLog.create({
                    userId: log.userId,
                    workplaceId: log.workplaceId,
                    activityType: 'communication',
                    action: `COMM_${log.action}`,
                    description: `Communication activity: ${log.action}`,
                    targetEntity: log.targetId ? {
                        entityType: log.targetType || 'Conversation',
                        entityId: log.targetId,
                        entityName: log.targetType || 'Communication Entity',
                    } : undefined,
                    metadata: {
                        details: log.details,
                        complianceCategory: log.complianceCategory,
                    },
                    ipAddress: log.ipAddress,
                    userAgent: log.userAgent,
                    riskLevel: log.riskLevel || 'low',
                    complianceCategory: 'HIPAA',
                    success: log.success !== undefined ? log.success : true,
                    timestamp: log.timestamp,
                    sessionId: log.sessionId,
                }); stats.communication++;
            } catch (error) {
                console.error(`Error migrating communication log ${log._id}:`, error);
                stats.errors++;
            }
        }

        console.log(`✅ Migrated ${stats.communication} communication audit logs`);
    } catch (error) {
        console.error('❌ Error in communication migration:', error);
    }
}

async function migrate() {
    console.log('🚀 Starting Unified Audit Log Migration...\n');
    console.log('='.repeat(60));

    await connectDB();

    // Run migrations
    await migrateWorkspaceAuditLogs();
    await migrateSecurityAuditLogs();
    await migrateMTRAuditLogs();
    await migrateCommunicationAuditLogs();

    // Calculate total
    stats.total = stats.workspace + stats.security + stats.mtr + stats.communication;

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Workspace Audit Logs:      ${stats.workspace}`);
    console.log(`Security Audit Logs:       ${stats.security}`);
    console.log(`MTR Audit Logs:            ${stats.mtr}`);
    console.log(`Communication Audit Logs:  ${stats.communication}`);
    console.log('-'.repeat(60));
    console.log(`Total Migrated:            ${stats.total}`);
    console.log(`Errors:                    ${stats.errors}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n✅ Migration completed and database connection closed');
}

// Run migration
migrate().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
