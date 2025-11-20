import Notification from '../models/Notification';
import PatientUser from '../models/PatientUser';
import Patient from '../models/Patient';
import mongoose from 'mongoose';
import logger from '../utils/logger';

interface NotificationOptions {
    userId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    title: string;
    content: string;
    type: 'lab_result_available' | 'lab_result_interpretation' | 'vitals_verified' | 'visit_summary_available';
    priority?: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
    data: any;
    deliveryChannels?: {
        inApp?: boolean;
        email?: boolean;
        sms?: boolean;
        push?: boolean;
    };
}

class HealthRecordsNotificationService {
    /**
     * Create a notification for a patient
     */
    async createNotification(options: NotificationOptions): Promise<void> {
        try {
            const {
                userId,
                workplaceId,
                title,
                content,
                type,
                priority = 'normal',
                data,
                deliveryChannels = { inApp: true, email: true, sms: false, push: true },
            } = options;

            const notification = new Notification({
                userId,
                workplaceId,
                type,
                title,
                content,
                priority,
                data,
                status: 'unread',
                deliveryChannels,
                deliveryStatus: [],
                createdBy: userId,
            });

            await notification.save();
            logger.info(`Notification created: ${type} for user ${userId}`);

            // TODO: Trigger actual email/SMS/push delivery based on deliveryChannels
            // This would integrate with your email service (e.g., SendGrid) and SMS service (e.g., Twilio)
        } catch (error: any) {
            logger.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Notify patient when new lab results are available
     */
    async notifyLabResultAvailable(
        patientUserId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        diagnosticCaseId: mongoose.Types.ObjectId,
        testName: string
    ): Promise<void> {
        await this.createNotification({
            userId: patientUserId,
            workplaceId,
            title: 'New Lab Results Available',
            content: `Your lab results for ${testName} are now available. Please check your health records to review them.`,
            type: 'lab_result_available',
            priority: 'high',
            data: {
                diagnosticCaseId,
                labResultId: diagnosticCaseId,
                testName,
                actionUrl: '/patient-portal/health-records?tab=0', // Lab Results tab
            },
            deliveryChannels: {
                inApp: true,
                email: true,
                sms: true,
                push: true,
            },
        });
    }

    /**
     * Notify patient when pharmacist adds interpretation to lab results
     */
    async notifyLabInterpretationAdded(
        patientUserId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        diagnosticCaseId: mongoose.Types.ObjectId,
        testName: string
    ): Promise<void> {
        await this.createNotification({
            userId: patientUserId,
            workplaceId,
            title: 'Lab Result Interpretation Added',
            content: `Your pharmacist has added an interpretation to your ${testName} results. View the patient-friendly explanation in your health records.`,
            type: 'lab_result_interpretation',
            priority: 'normal',
            data: {
                diagnosticCaseId,
                labResultId: diagnosticCaseId,
                testName,
                actionUrl: '/patient-portal/health-records?tab=0',
            },
            deliveryChannels: {
                inApp: true,
                email: true,
                sms: false,
                push: true,
            },
        });
    }

    /**
     * Notify patient when vitals are verified by pharmacist
     */
    async notifyVitalsVerified(
        patientUserId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        vitalsId: string,
        verificationDate: Date
    ): Promise<void> {
        await this.createNotification({
            userId: patientUserId,
            workplaceId,
            title: 'Vitals Verified by Pharmacist',
            content: `Your vital signs recorded on ${verificationDate.toLocaleDateString()} have been reviewed and verified by a pharmacist.`,
            type: 'vitals_verified',
            priority: 'normal',
            data: {
                vitalsId,
                actionUrl: '/patient-portal/health-records?tab=1', // Vitals History tab
            },
            deliveryChannels: {
                inApp: true,
                email: false,
                sms: false,
                push: false,
            },
        });
    }

    /**
     * Notify patient when visit summary is made available
     */
    async notifyVisitSummaryAvailable(
        patientUserId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        visitId: mongoose.Types.ObjectId,
        visitDate: Date
    ): Promise<void> {
        await this.createNotification({
            userId: patientUserId,
            workplaceId,
            title: 'Visit Summary Available',
            content: `A summary of your consultation on ${visitDate.toLocaleDateString()} is now available. Your pharmacist has provided key points and next steps for your care.`,
            type: 'visit_summary_available',
            priority: 'normal',
            data: {
                visitId,
                actionUrl: '/patient-portal/health-records?tab=2', // Visit History tab
            },
            deliveryChannels: {
                inApp: true,
                email: true,
                sms: false,
                push: true,
            },
        });
    }

    /**
     * Get unread notifications for a patient
     */
    async getUnreadNotifications(
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        limit: number = 10
    ): Promise<any[]> {
        try {
            const notifications = await Notification.find({
                userId,
                workplaceId,
                status: 'unread',
                isDeleted: false,
            })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            return notifications;
        } catch (error: any) {
            logger.error('Error fetching unread notifications:', error);
            throw error;
        }
    }

    /**
     * Get all notifications for a patient (paginated)
     */
    async getNotifications(
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        page: number = 1,
        limit: number = 20,
        filter?: { status?: string; type?: string }
    ): Promise<{ notifications: any[]; total: number }> {
        try {
            const query: any = {
                userId,
                workplaceId,
                isDeleted: false,
            };

            if (filter?.status) {
                query.status = filter.status;
            }

            if (filter?.type) {
                query.type = filter.type;
            }

            const skip = (page - 1) * limit;

            const [notifications, total] = await Promise.all([
                Notification.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Notification.countDocuments(query),
            ]);

            return { notifications, total };
        } catch (error: any) {
            logger.error('Error fetching notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(
        notificationId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            const notification = await Notification.findOne({
                _id: notificationId,
                userId,
                isDeleted: false,
            });

            if (notification) {
                notification.markAsRead();
                await notification.save();
            }
        } catch (error: any) {
            logger.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId
    ): Promise<number> {
        try {
            const result = await Notification.updateMany(
                {
                    userId,
                    workplaceId,
                    status: 'unread',
                    isDeleted: false,
                },
                {
                    $set: {
                        status: 'read',
                        readAt: new Date(),
                    },
                }
            );

            return result.modifiedCount;
        } catch (error: any) {
            logger.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(
        notificationId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await Notification.updateOne(
                {
                    _id: notificationId,
                    userId,
                },
                {
                    $set: { isDeleted: true },
                }
            );
        } catch (error: any) {
            logger.error('Error deleting notification:', error);
            throw error;
        }
    }

    /**
     * Get unread count
     */
    async getUnreadCount(
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId
    ): Promise<number> {
        try {
            const count = await Notification.countDocuments({
                userId,
                workplaceId,
                status: 'unread',
                isDeleted: false,
            });

            return count;
        } catch (error: any) {
            logger.error('Error fetching unread count:', error);
            throw error;
        }
    }
}

export default new HealthRecordsNotificationService();
