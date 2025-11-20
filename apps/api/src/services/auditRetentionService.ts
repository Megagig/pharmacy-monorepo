import { AuditLog, IAuditLog } from '../models/AuditLog';
import { RBACSecurityAuditService } from './rbacAuditService';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface RetentionPolicy {
    category: string;
    retentionDays: number;
    archiveAfterDays: number;
    compressionEnabled: boolean;
    exportFormat: 'json' | 'csv';
    archiveLocation: string;
}

export interface ArchiveJob {
    id: string;
    category: string;
    startDate: Date;
    endDate: Date;
    status: 'pending' | 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    recordsArchived: number;
    recordsDeleted: number;
    archiveFilePath?: string;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

class AuditRetentionService {
    private static instance: AuditRetentionService;
    private retentionPolicies: Map<string, RetentionPolicy> = new Map();
    private archiveJobs: Map<string, ArchiveJob> = new Map();

    // Default retention policies
    private readonly DEFAULT_POLICIES: RetentionPolicy[] = [
        {
            category: 'rbac_management',
            retentionDays: 2555, // 7 years for compliance
            archiveAfterDays: 365, // Archive after 1 year
            compressionEnabled: true,
            exportFormat: 'json',
            archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './archives/audit'
        },
        {
            category: 'security_monitoring',
            retentionDays: 2555, // 7 years for security compliance
            archiveAfterDays: 180, // Archive after 6 months
            compressionEnabled: true,
            exportFormat: 'json',
            archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './archives/audit'
        },
        {
            category: 'access_control',
            retentionDays: 1825, // 5 years
            archiveAfterDays: 365, // Archive after 1 year
            compressionEnabled: true,
            exportFormat: 'json',
            archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './archives/audit'
        },
        {
            category: 'clinical_documentation',
            retentionDays: 3650, // 10 years for medical records
            archiveAfterDays: 730, // Archive after 2 years
            compressionEnabled: true,
            exportFormat: 'json',
            archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './archives/audit'
        },
        {
            category: 'general',
            retentionDays: 1095, // 3 years
            archiveAfterDays: 365, // Archive after 1 year
            compressionEnabled: true,
            exportFormat: 'json',
            archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './archives/audit'
        }
    ];

    static getInstance(): AuditRetentionService {
        if (!AuditRetentionService.instance) {
            AuditRetentionService.instance = new AuditRetentionService();
            AuditRetentionService.instance.initializeDefaultPolicies();
        }
        return AuditRetentionService.instance;
    }

    /**
     * Initialize default retention policies
     */
    private initializeDefaultPolicies(): void {
        this.DEFAULT_POLICIES.forEach(policy => {
            this.retentionPolicies.set(policy.category, policy);
        });
    }

    /**
     * Set retention policy for a category
     */
    setRetentionPolicy(policy: RetentionPolicy): void {
        this.retentionPolicies.set(policy.category, policy);
    }

    /**
     * Get retention policy for a category
     */
    getRetentionPolicy(category: string): RetentionPolicy | undefined {
        return this.retentionPolicies.get(category) || this.retentionPolicies.get('general');
    }

    /**
     * Get all retention policies
     */
    getAllRetentionPolicies(): RetentionPolicy[] {
        return Array.from(this.retentionPolicies.values());
    }

    /**
     * Run retention cleanup for all categories
     */
    async runRetentionCleanup(): Promise<{
        totalProcessed: number;
        totalArchived: number;
        totalDeleted: number;
        jobResults: Array<{ category: string; result: any }>;
    }> {
        const results = {
            totalProcessed: 0,
            totalArchived: 0,
            totalDeleted: 0,
            jobResults: [] as Array<{ category: string; result: any }>
        };

        for (const [category, policy] of this.retentionPolicies.entries()) {
            try {
                const result = await this.runCategoryRetention(category, policy);
                results.totalProcessed += result.recordsProcessed;
                results.totalArchived += result.recordsArchived;
                results.totalDeleted += result.recordsDeleted;
                results.jobResults.push({ category, result });
            } catch (error) {
                console.error(`Error running retention for category ${category}:`, error);
                results.jobResults.push({
                    category,
                    result: { error: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        }

        return results;
    }

    /**
     * Run retention cleanup for specific category
     */
    async runCategoryRetention(
        category: string,
        policy: RetentionPolicy
    ): Promise<ArchiveJob> {
        const jobId = `retention_${category}_${Date.now()}`;
        const job: ArchiveJob = {
            id: jobId,
            category,
            startDate: new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - policy.archiveAfterDays * 24 * 60 * 60 * 1000),
            status: 'running',
            recordsProcessed: 0,
            recordsArchived: 0,
            recordsDeleted: 0,
            createdAt: new Date()
        };

        this.archiveJobs.set(jobId, job);

        try {
            // Step 1: Archive old records
            const archiveResult = await this.archiveOldRecords(category, policy, job);
            job.recordsArchived = archiveResult.recordsArchived;
            job.archiveFilePath = archiveResult.archiveFilePath;

            // Step 2: Delete expired records
            const deleteResult = await this.deleteExpiredRecords(category, policy);
            job.recordsDeleted = deleteResult.recordsDeleted;

            job.recordsProcessed = job.recordsArchived + job.recordsDeleted;
            job.status = 'completed';
            job.completedAt = new Date();

            // Log retention activity
            await RBACSecurityAuditService.logPermissionChange({
                userId: new mongoose.Types.ObjectId(), // System user
                action: 'AUDIT_RETENTION_EXECUTED',
                securityContext: {
                    riskScore: 10,
                    anomalyDetected: false
                }
            });

        } catch (error) {
            job.status = 'failed';
            job.error = error instanceof Error ? error.message : 'Unknown error';
            job.completedAt = new Date();
            console.error(`Retention job ${jobId} failed:`, error);
        }

        return job;
    }

    /**
     * Archive old records
     */
    private async archiveOldRecords(
        category: string,
        policy: RetentionPolicy,
        job: ArchiveJob
    ): Promise<{ recordsArchived: number; archiveFilePath: string }> {
        const archiveDate = new Date(Date.now() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);

        // Find records to archive
        const recordsToArchive = await AuditLog.find({
            complianceCategory: category,
            timestamp: { $lt: archiveDate },
            archived: { $ne: true }
        }).lean();

        if (recordsToArchive.length === 0) {
            return { recordsArchived: 0, archiveFilePath: '' };
        }

        // Create archive directory if it doesn't exist
        const archiveDir = path.resolve(policy.archiveLocation);
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }

        // Generate archive filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${category}_${timestamp}_${job.id}.${policy.exportFormat}`;
        const archiveFilePath = path.join(archiveDir, filename);

        // Export records
        let exportData: string;
        if (policy.exportFormat === 'csv') {
            exportData = await RBACSecurityAuditService.exportRBACLogs({
                startDate: job.startDate,
                endDate: archiveDate,
                format: 'csv',
                includeSecurityContext: true
            });
        } else {
            exportData = JSON.stringify(recordsToArchive, null, 2);
        }

        // Compress if enabled
        if (policy.compressionEnabled) {
            const compressedData = zlib.gzipSync(exportData);
            fs.writeFileSync(`${archiveFilePath}.gz`, compressedData);
        } else {
            fs.writeFileSync(archiveFilePath, exportData);
        }

        // Mark records as archived
        await AuditLog.updateMany(
            {
                _id: { $in: recordsToArchive.map(r => r._id) }
            },
            {
                $set: {
                    archived: true,
                    archivedAt: new Date(),
                    archiveFilePath: policy.compressionEnabled ? `${archiveFilePath}.gz` : archiveFilePath
                }
            }
        );

        return {
            recordsArchived: recordsToArchive.length,
            archiveFilePath: policy.compressionEnabled ? `${archiveFilePath}.gz` : archiveFilePath
        };
    }

    /**
     * Delete expired records
     */
    private async deleteExpiredRecords(
        category: string,
        policy: RetentionPolicy
    ): Promise<{ recordsDeleted: number }> {
        const expirationDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);

        const deleteResult = await AuditLog.deleteMany({
            complianceCategory: category,
            timestamp: { $lt: expirationDate },
            archived: true // Only delete records that have been archived
        });

        return { recordsDeleted: deleteResult.deletedCount || 0 };
    }

    /**
     * Get archive job status
     */
    getArchiveJob(jobId: string): ArchiveJob | undefined {
        return this.archiveJobs.get(jobId);
    }

    /**
     * Get all archive jobs
     */
    getAllArchiveJobs(): ArchiveJob[] {
        return Array.from(this.archiveJobs.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * Restore archived records
     */
    async restoreArchivedRecords(
        archiveFilePath: string,
        category: string
    ): Promise<{ recordsRestored: number }> {
        try {
            if (!fs.existsSync(archiveFilePath)) {
                throw new Error('Archive file not found');
            }

            let fileContent: string;

            // Handle compressed files
            if (archiveFilePath.endsWith('.gz')) {
                const compressedData = fs.readFileSync(archiveFilePath);
                fileContent = zlib.gunzipSync(compressedData).toString();
            } else {
                fileContent = fs.readFileSync(archiveFilePath, 'utf8');
            }

            // Parse the data
            let records: any[];
            if (archiveFilePath.includes('.csv')) {
                // For CSV files, we'd need a CSV parser
                throw new Error('CSV restoration not implemented yet');
            } else {
                records = JSON.parse(fileContent);
            }

            // Remove archive-specific fields and restore to database
            const recordsToRestore = records.map(record => {
                const { archived, archivedAt, archiveFilePath, ...cleanRecord } = record;
                return cleanRecord;
            });

            // Insert records back to database
            await AuditLog.insertMany(recordsToRestore);

            // Log restoration activity
            await RBACSecurityAuditService.logPermissionChange({
                userId: new mongoose.Types.ObjectId(), // System user
                action: 'AUDIT_RECORDS_RESTORED',
                securityContext: {
                    riskScore: 20,
                    anomalyDetected: false
                }
            });

            return { recordsRestored: recordsToRestore.length };
        } catch (error) {
            console.error('Error restoring archived records:', error);
            throw error;
        }
    }

    /**
     * Get retention statistics
     */
    async getRetentionStatistics(): Promise<{
        totalRecords: number;
        archivedRecords: number;
        recordsByCategory: Record<string, { total: number; archived: number }>;
        oldestRecord: Date | null;
        newestRecord: Date | null;
        archiveJobs: {
            total: number;
            completed: number;
            failed: number;
            running: number;
        };
    }> {
        const [
            totalRecords,
            archivedRecords,
            recordsByCategory,
            oldestRecord,
            newestRecord
        ] = await Promise.all([
            AuditLog.countDocuments(),
            AuditLog.countDocuments({ archived: true }),
            AuditLog.aggregate([
                {
                    $group: {
                        _id: '$complianceCategory',
                        total: { $sum: 1 },
                        archived: {
                            $sum: { $cond: [{ $eq: ['$archived', true] }, 1, 0] }
                        }
                    }
                }
            ]),
            AuditLog.findOne({}, 'timestamp').sort({ timestamp: 1 }).lean(),
            AuditLog.findOne({}, 'timestamp').sort({ timestamp: -1 }).lean()
        ]);

        const categoryStats = recordsByCategory.reduce((acc: any, item: any) => {
            acc[item._id] = {
                total: item.total,
                archived: item.archived
            };
            return acc;
        }, {});

        const archiveJobs = Array.from(this.archiveJobs.values());
        const jobStats = {
            total: archiveJobs.length,
            completed: archiveJobs.filter(job => job.status === 'completed').length,
            failed: archiveJobs.filter(job => job.status === 'failed').length,
            running: archiveJobs.filter(job => job.status === 'running').length
        };

        return {
            totalRecords,
            archivedRecords,
            recordsByCategory: categoryStats,
            oldestRecord: oldestRecord?.timestamp || null,
            newestRecord: newestRecord?.timestamp || null,
            archiveJobs: jobStats
        };
    }

    /**
     * Schedule automatic retention cleanup
     */
    scheduleRetentionCleanup(intervalHours: number = 24): void {
        const intervalMs = intervalHours * 60 * 60 * 1000;

        setInterval(async () => {
            try {
                console.log('Running scheduled audit retention cleanup...');
                const result = await this.runRetentionCleanup();
                console.log('Retention cleanup completed:', result);
            } catch (error) {
                console.error('Scheduled retention cleanup failed:', error);
            }
        }, intervalMs);

        console.log(`Audit retention cleanup scheduled every ${intervalHours} hours`);
    }

    /**
     * Clean up old archive jobs
     */
    cleanupOldArchiveJobs(daysToKeep: number = 90): void {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        for (const [jobId, job] of this.archiveJobs.entries()) {
            if (job.completedAt && job.completedAt < cutoffDate) {
                this.archiveJobs.delete(jobId);
            }
        }
    }
}

export { AuditRetentionService };
export default AuditRetentionService;