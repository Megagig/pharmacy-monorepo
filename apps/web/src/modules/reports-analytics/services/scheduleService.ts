// Schedule Service - Handle report schedule execution and monitoring
import {
    ReportSchedule,
    ScheduleRun,
    ScheduleDeliveryResult,
    ScheduleLog,
    ExportResult
} from '../types/exports';
import { EmailService, EmailDeliveryResult } from './emailService';
import { ExportService } from './exportServices';

export interface ScheduleExecutionContext {
    schedule: ReportSchedule;
    reportData: any;
    runId: string;
    startTime: Date;
}

export class ScheduleService {
    private static runningSchedules = new Map<string, ScheduleExecutionContext>();
    private static scheduleHistory = new Map<string, ScheduleRun[]>();

    /**
     * Execute a scheduled report
     */
    static async executeSchedule(
        schedule: ReportSchedule,
        reportData: any,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ScheduleRun> {
        const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = new Date();

        const context: ScheduleExecutionContext = {
            schedule,
            reportData,
            runId,
            startTime,
        };

        this.runningSchedules.set(runId, context);

        const scheduleRun: ScheduleRun = {
            id: runId,
            scheduleId: schedule.id,
            status: 'running',
            startedAt: startTime,
            deliveryResults: [],
            logs: [],
        };

        try {
            onProgress?.(10, 'Starting report generation...');
            this.addLog(scheduleRun, 'info', 'Schedule execution started');

            // Generate the report
            onProgress?.(20, 'Generating report...');
            const exportResult = await this.generateReport(schedule, reportData, (progress) => {
                onProgress?.(20 + (progress * 0.6), 'Generating report...');
            });

            this.addLog(scheduleRun, 'info', `Report generated successfully: ${exportResult.filename}`);

            // Deliver to recipients
            onProgress?.(80, 'Delivering to recipients...');
            const deliveryResults = await this.deliverReport(schedule, exportResult, (progress) => {
                onProgress?.(80 + (progress * 0.15), 'Delivering to recipients...');
            });

            scheduleRun.deliveryResults = deliveryResults;
            scheduleRun.exportResult = exportResult;

            // Check delivery success
            const failedDeliveries = deliveryResults.filter(r => r.status === 'failed');
            if (failedDeliveries.length > 0) {
                this.addLog(scheduleRun, 'warn', `${failedDeliveries.length} deliveries failed`);

                // Send error notifications for failed deliveries
                await this.sendErrorNotifications(schedule, failedDeliveries);
            }

            scheduleRun.status = failedDeliveries.length === deliveryResults.length ? 'failed' : 'completed';
            scheduleRun.completedAt = new Date();
            scheduleRun.duration = scheduleRun.completedAt.getTime() - startTime.getTime();

            this.addLog(scheduleRun, 'info', `Schedule execution completed with status: ${scheduleRun.status}`);
            onProgress?.(100, 'Completed');

        } catch (error) {
            scheduleRun.status = 'failed';
            scheduleRun.error = error instanceof Error ? error.message : 'Unknown error';
            scheduleRun.completedAt = new Date();
            scheduleRun.duration = scheduleRun.completedAt.getTime() - startTime.getTime();

            this.addLog(scheduleRun, 'error', `Schedule execution failed: ${scheduleRun.error}`);

            // Send error notification to recipients
            await this.sendErrorNotifications(schedule, [], scheduleRun.error);

            onProgress?.(100, 'Failed');
        } finally {
            this.runningSchedules.delete(runId);
            this.saveScheduleRun(scheduleRun);
        }

        return scheduleRun;
    }

    /**
     * Generate report using export service
     */
    private static async generateReport(
        schedule: ReportSchedule,
        reportData: any,
        onProgress?: (progress: number) => void
    ): Promise<ExportResult> {
        return await ExportService.exportReport(
            reportData,
            schedule.exportConfig,
            onProgress
        );
    }

    /**
     * Deliver report to all recipients
     */
    private static async deliverReport(
        schedule: ReportSchedule,
        exportResult: ExportResult,
        onProgress?: (progress: number) => void
    ): Promise<ScheduleDeliveryResult[]> {
        const deliveryResults: ScheduleDeliveryResult[] = [];
        const totalRecipients = schedule.recipients.length;

        for (let i = 0; i < schedule.recipients.length; i++) {
            const recipient = schedule.recipients[i];
            onProgress?.((i / totalRecipients) * 100);

            try {
                let deliveryResult: ScheduleDeliveryResult;

                switch (recipient.type) {
                    case 'email':
                        const emailResults = await EmailService.sendReport(schedule, exportResult, [recipient]);
                        const emailResult = emailResults[0];
                        deliveryResult = {
                            recipientType: 'email',
                            recipientAddress: recipient.address,
                            status: emailResult.status === 'delivered' ? 'delivered' : 'failed',
                            deliveredAt: emailResult.deliveredAt,
                            error: emailResult.error,
                            retryCount: 0,
                        };
                        break;

                    case 'webhook':
                        deliveryResult = await this.deliverToWebhook(recipient, exportResult);
                        break;

                    case 'ftp':
                    case 'sftp':
                        deliveryResult = await this.deliverToFtp(recipient, exportResult);
                        break;

                    default:
                        deliveryResult = {
                            recipientType: recipient.type as any,
                            recipientAddress: recipient.address,
                            status: 'failed',
                            error: `Unsupported recipient type: ${recipient.type}`,
                            retryCount: 0,
                        };
                }

                deliveryResults.push(deliveryResult);

            } catch (error) {
                deliveryResults.push({
                    recipientType: recipient.type as any,
                    recipientAddress: recipient.address,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    retryCount: 0,
                });
            }
        }

        onProgress?.(100);
        return deliveryResults;
    }

    /**
     * Deliver report to webhook
     */
    private static async deliverToWebhook(
        recipient: any,
        exportResult: ExportResult
    ): Promise<ScheduleDeliveryResult> {
        try {
            const payload = {
                reportId: exportResult.id,
                filename: exportResult.filename,
                format: exportResult.format,
                downloadUrl: exportResult.downloadUrl,
                fileSize: exportResult.fileSize,
                generatedAt: exportResult.createdAt,
            };

            // In a real implementation, this would make an HTTP request

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Simulate success (95% success rate)
            if (Math.random() > 0.05) {
                return {
                    recipientType: 'webhook',
                    recipientAddress: recipient.address,
                    status: 'delivered',
                    deliveredAt: new Date(),
                    retryCount: 0,
                };
            } else {
                throw new Error('Webhook delivery failed');
            }

        } catch (error) {
            return {
                recipientType: 'webhook',
                recipientAddress: recipient.address,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount: 0,
            };
        }
    }

    /**
     * Deliver report to FTP/SFTP
     */
    private static async deliverToFtp(
        recipient: any,
        exportResult: ExportResult
    ): Promise<ScheduleDeliveryResult> {
        try {
            // In a real implementation, this would upload to FTP/SFTP

            // Simulate upload delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate success (90% success rate)
            if (Math.random() > 0.1) {
                return {
                    recipientType: recipient.type,
                    recipientAddress: recipient.address,
                    status: 'delivered',
                    deliveredAt: new Date(),
                    retryCount: 0,
                };
            } else {
                throw new Error('FTP upload failed');
            }

        } catch (error) {
            return {
                recipientType: recipient.type,
                recipientAddress: recipient.address,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount: 0,
            };
        }
    }

    /**
     * Send error notifications
     */
    private static async sendErrorNotifications(
        schedule: ReportSchedule,
        failedDeliveries: ScheduleDeliveryResult[],
        generalError?: string
    ): Promise<void> {
        try {
            const error = generalError ||
                `Failed to deliver to ${failedDeliveries.length} recipients: ${failedDeliveries.map(d => d.recipientAddress).join(', ')
                }`;

            await EmailService.sendErrorNotification(schedule, error, 1, 3);
        } catch (emailError) {
            console.error('Failed to send error notification:', emailError);
        }
    }

    /**
     * Add log entry to schedule run
     */
    private static addLog(
        scheduleRun: ScheduleRun,
        level: 'info' | 'warn' | 'error',
        message: string,
        details?: any
    ): void {
        scheduleRun.logs.push({
            timestamp: new Date(),
            level,
            message,
            details,
        });
    }

    /**
     * Save schedule run to history
     */
    private static saveScheduleRun(scheduleRun: ScheduleRun): void {
        const scheduleId = scheduleRun.scheduleId;
        const history = this.scheduleHistory.get(scheduleId) || [];

        history.unshift(scheduleRun);

        // Keep only last 50 runs per schedule
        if (history.length > 50) {
            history.splice(50);
        }

        this.scheduleHistory.set(scheduleId, history);
    }

    /**
     * Get schedule run history
     */
    static getScheduleHistory(scheduleId: string, limit: number = 10): ScheduleRun[] {
        const history = this.scheduleHistory.get(scheduleId) || [];
        return history.slice(0, limit);
    }

    /**
     * Get currently running schedules
     */
    static getRunningSchedules(): ScheduleExecutionContext[] {
        return Array.from(this.runningSchedules.values());
    }

    /**
     * Cancel running schedule
     */
    static cancelSchedule(runId: string): boolean {
        const context = this.runningSchedules.get(runId);
        if (context) {
            this.runningSchedules.delete(runId);

            // Create cancelled run record
            const cancelledRun: ScheduleRun = {
                id: runId,
                scheduleId: context.schedule.id,
                status: 'skipped',
                startedAt: context.startTime,
                completedAt: new Date(),
                duration: Date.now() - context.startTime.getTime(),
                deliveryResults: [],
                logs: [{
                    timestamp: new Date(),
                    level: 'info',
                    message: 'Schedule execution cancelled by user',
                }],
            };

            this.saveScheduleRun(cancelledRun);
            return true;
        }

        return false;
    }

    /**
     * Calculate next run time for a schedule
     */
    static calculateNextRun(schedule: ReportSchedule): Date {
        const now = new Date();
        const [hours, minutes] = schedule.schedule.time.split(':').map(Number);
        const nextRun = new Date();

        nextRun.setHours(hours, minutes, 0, 0);

        switch (schedule.schedule.frequency) {
            case 'daily':
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
                break;

            case 'weekly':
                const currentDay = now.getDay();
                const daysOfWeek = schedule.schedule.daysOfWeek || [1]; // Default to Monday
                const nextDay = daysOfWeek.find(day => day > currentDay) || daysOfWeek[0];
                const daysUntilNext = nextDay > currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;
                nextRun.setDate(nextRun.getDate() + daysUntilNext);
                if (nextDay === currentDay && nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 7);
                }
                break;

            case 'monthly':
                const dayOfMonth = schedule.schedule.dayOfMonth || 1;
                nextRun.setDate(dayOfMonth);
                if (nextRun <= now) {
                    nextRun.setMonth(nextRun.getMonth() + 1);
                }
                break;

            case 'quarterly':
                const currentMonth = now.getMonth();
                const nextQuarter = Math.ceil((currentMonth + 1) / 3) * 3;
                nextRun.setMonth(nextQuarter, schedule.schedule.dayOfMonth || 1);
                if (nextRun <= now) {
                    nextRun.setMonth(nextQuarter + 3, schedule.schedule.dayOfMonth || 1);
                }
                break;

            case 'yearly':
                nextRun.setMonth(0, schedule.schedule.dayOfMonth || 1); // January
                if (nextRun <= now) {
                    nextRun.setFullYear(nextRun.getFullYear() + 1);
                }
                break;

            case 'custom':
                const interval = schedule.schedule.interval || 1;
                nextRun.setDate(nextRun.getDate() + interval);
                break;
        }

        return nextRun;
    }

    /**
     * Check if schedule should run now
     */
    static shouldScheduleRun(schedule: ReportSchedule): boolean {
        if (!schedule.isActive) return false;
        if (!schedule.nextRun) return false;

        const now = new Date();
        const timeDiff = now.getTime() - schedule.nextRun.getTime();

        // Allow 5 minute window for execution
        return timeDiff >= 0 && timeDiff <= 5 * 60 * 1000;
    }

    /**
     * Get schedule execution statistics
     */
    static getScheduleStats(scheduleId: string): {
        totalRuns: number;
        successfulRuns: number;
        failedRuns: number;
        successRate: number;
        averageDuration: number;
        lastRun?: Date;
        nextRun?: Date;
    } {
        const history = this.getScheduleHistory(scheduleId, 100);
        const totalRuns = history.length;
        const successfulRuns = history.filter(r => r.status === 'completed').length;
        const failedRuns = history.filter(r => r.status === 'failed').length;
        const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

        const durations = history.filter(r => r.duration).map(r => r.duration!);
        const averageDuration = durations.length > 0
            ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
            : 0;

        const lastRun = history.length > 0 ? history[0].startedAt : undefined;

        return {
            totalRuns,
            successfulRuns,
            failedRuns,
            successRate,
            averageDuration,
            lastRun,
        };
    }
}