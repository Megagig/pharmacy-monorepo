import mongoose from 'mongoose';
import { mtrNotificationService } from '../../services/mtrNotificationService';
import MTRFollowUp from '../../models/MTRFollowUp';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import DrugTherapyProblem from '../../models/DrugTherapyProblem';
import User from '../../models/User';
import Patient from '../../models/Patient';
import { sendEmail } from '../../utils/email';
import { sendSMS } from '../../utils/sms';

// Mock external dependencies
jest.mock('../../utils/email');
jest.mock('../../utils/sms');
jest.mock('../../utils/logger');

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockSendSMS = sendSMS as jest.MockedFunction<typeof sendSMS>;

describe('MTRNotificationService', () => {
    let testWorkplaceId: mongoose.Types.ObjectId;
    let testUserId: mongoose.Types.ObjectId;
    let testPatientId: mongoose.Types.ObjectId;
    let testReviewId: mongoose.Types.ObjectId;
    let testFollowUpId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create test IDs
        testWorkplaceId = new mongoose.Types.ObjectId();
        testUserId = new mongoose.Types.ObjectId();
        testPatientId = new mongoose.Types.ObjectId();
        testReviewId = new mongoose.Types.ObjectId();
        testFollowUpId = new mongoose.Types.ObjectId();

        // Mock successful email/SMS sending
        mockSendEmail.mockResolvedValue({ messageId: 'test-email-id' });
        mockSendSMS.mockResolvedValue({ sid: 'test-sms-id' });
    });

    describe('scheduleFollowUpReminder', () => {
        it('should schedule email reminder for follow-up', async () => {
            // Create mock follow-up with populated fields
            const mockFollowUp = {
                _id: testFollowUpId,
                assignedTo: {
                    _id: testUserId,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@test.com',
                    phone: '+2348012345678',
                    notificationPreferences: {
                        followUpReminders: true,
                        email: true,
                        sms: false
                    }
                },
                patientId: {
                    _id: testPatientId,
                    firstName: 'Jane',
                    lastName: 'Patient'
                },
                reviewId: {
                    _id: testReviewId,
                    reviewNumber: 'MTR-2024-001',
                    priority: 'routine'
                },
                type: 'phone_call',
                priority: 'medium',
                description: 'Follow-up call to check medication adherence',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                estimatedDuration: 30,
                reminders: [],
                save: jest.fn().mockResolvedValue(true)
            };

            // Mock MTRFollowUp.findById
            jest.spyOn(MTRFollowUp, 'findById').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockFollowUp)
                    })
                })
            } as any);

            await mtrNotificationService.scheduleFollowUpReminder(
                testFollowUpId,
                'email'
            );

            // Verify follow-up was found and reminder was added
            expect(MTRFollowUp.findById).toHaveBeenCalledWith(testFollowUpId);
            expect(mockFollowUp.save).toHaveBeenCalled();
            expect(mockFollowUp.reminders).toHaveLength(1);
            expect(mockFollowUp.reminders[0].type).toBe('email');
        });

        it('should not schedule reminder if user has disabled follow-up reminders', async () => {
            const mockFollowUp = {
                _id: testFollowUpId,
                assignedTo: {
                    _id: testUserId,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@test.com',
                    notificationPreferences: {
                        followUpReminders: false // Disabled
                    }
                },
                patientId: {
                    _id: testPatientId,
                    firstName: 'Jane',
                    lastName: 'Patient'
                },
                reviewId: {
                    _id: testReviewId,
                    reviewNumber: 'MTR-2024-001'
                },
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                reminders: [],
                save: jest.fn()
            };

            jest.spyOn(MTRFollowUp, 'findById').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockFollowUp)
                    })
                })
            } as any);

            await mtrNotificationService.scheduleFollowUpReminder(testFollowUpId);

            // Should not save or add reminders
            expect(mockFollowUp.save).not.toHaveBeenCalled();
            expect(mockFollowUp.reminders).toHaveLength(0);
        });

        it('should throw error if follow-up not found', async () => {
            jest.spyOn(MTRFollowUp, 'findById').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(null)
                    })
                })
            } as any);

            await expect(
                mtrNotificationService.scheduleFollowUpReminder(testFollowUpId)
            ).rejects.toThrow('Follow-up not found');
        });
    });

    describe('sendCriticalAlert', () => {
        it('should send critical alert to all pharmacists in workplace', async () => {
            const mockPatient = {
                _id: testPatientId,
                firstName: 'Jane',
                lastName: 'Patient',
                mrn: 'MRN-12345',
                workplaceId: testWorkplaceId
            };

            const mockPharmacists = [
                {
                    _id: testUserId,
                    firstName: 'John',
                    lastName: 'Pharmacist',
                    email: 'john@pharmacy.com',
                    phone: '+2348012345679',
                    notificationPreferences: {
                        criticalAlerts: true,
                        email: true,
                        sms: true
                    }
                }
            ];

            jest.spyOn(Patient, 'findById').mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockPatient)
            } as any);

            jest.spyOn(User, 'find').mockResolvedValue(mockPharmacists as any);

            const alert = {
                type: 'drug_interaction' as const,
                severity: 'critical' as const,
                patientId: testPatientId,
                message: 'Critical drug interaction detected',
                details: { medications: ['Drug A', 'Drug B'] },
                requiresImmediate: true
            };

            await mtrNotificationService.sendCriticalAlert(alert);

            // Verify patient and pharmacists were queried
            expect(Patient.findById).toHaveBeenCalledWith(testPatientId);
            expect(User.find).toHaveBeenCalledWith({
                workplaceId: testWorkplaceId,
                role: 'pharmacist',
                status: 'active',
                'notificationPreferences.criticalAlerts': { $ne: false }
            });
        });

        it('should throw error if patient not found', async () => {
            jest.spyOn(Patient, 'findById').mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            } as any);

            const alert = {
                type: 'drug_interaction' as const,
                severity: 'critical' as const,
                patientId: testPatientId,
                message: 'Test alert',
                details: {},
                requiresImmediate: false
            };

            await expect(
                mtrNotificationService.sendCriticalAlert(alert)
            ).rejects.toThrow('Patient not found');
        });
    });

    describe('checkOverdueFollowUps', () => {
        it('should find and alert for overdue follow-ups', async () => {
            const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

            const mockOverdueFollowUps = [
                {
                    _id: testFollowUpId,
                    scheduledDate: overdueDate,
                    assignedTo: {
                        _id: testUserId,
                        firstName: 'John',
                        lastName: 'Pharmacist',
                        email: 'john@pharmacy.com',
                        notificationPreferences: { email: true }
                    },
                    patientId: {
                        _id: testPatientId,
                        firstName: 'Jane',
                        lastName: 'Patient',
                        mrn: 'MRN-12345'
                    },
                    reviewId: {
                        _id: testReviewId,
                        reviewNumber: 'MTR-2024-001',
                        priority: 'routine'
                    },
                    type: 'phone_call',
                    priority: 'medium',
                    reminders: [],
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            jest.spyOn(MTRFollowUp, 'find').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockOverdueFollowUps)
                    })
                })
            } as any);

            await mtrNotificationService.checkOverdueFollowUps();

            // Verify overdue follow-ups were queried
            expect(MTRFollowUp.find).toHaveBeenCalledWith({
                status: { $in: ['scheduled', 'in_progress'] },
                scheduledDate: { $lt: expect.any(Date) }
            });

            // Verify reminder was added and follow-up was saved
            expect(mockOverdueFollowUps[0].save).toHaveBeenCalled();
            expect(mockOverdueFollowUps[0].reminders).toHaveLength(1);
            expect(mockOverdueFollowUps[0].reminders[0].type).toBe('system');
        });

        it('should skip follow-ups that already have recent overdue alerts', async () => {
            const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentAlertDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago

            const mockOverdueFollowUps = [
                {
                    _id: testFollowUpId,
                    scheduledDate: overdueDate,
                    assignedTo: {
                        _id: testUserId,
                        email: 'john@pharmacy.com'
                    },
                    patientId: {
                        _id: testPatientId,
                        firstName: 'Jane',
                        lastName: 'Patient'
                    },
                    reviewId: {
                        _id: testReviewId,
                        reviewNumber: 'MTR-2024-001'
                    },
                    reminders: [
                        {
                            type: 'system',
                            message: 'Follow-up overdue by 1 days',
                            scheduledFor: recentAlertDate
                        }
                    ],
                    save: jest.fn()
                }
            ];

            jest.spyOn(MTRFollowUp, 'find').mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(mockOverdueFollowUps)
                    })
                })
            } as any);

            await mtrNotificationService.checkOverdueFollowUps();

            // Should not save since recent alert exists
            expect(mockOverdueFollowUps[0].save).not.toHaveBeenCalled();
        });
    });

    describe('updateNotificationPreferences', () => {
        it('should update user notification preferences', async () => {
            const preferences = {
                email: true,
                sms: false,
                followUpReminders: true,
                criticalAlerts: true
            };

            jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({} as any);

            await mtrNotificationService.updateNotificationPreferences(
                testUserId,
                preferences
            );

            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                testUserId,
                { $set: { notificationPreferences: preferences } },
                { new: true }
            );
        });
    });

    describe('processPendingReminders', () => {
        it('should process pending reminders that are due', async () => {
            const dueDate = new Date(Date.now() - 60 * 1000); // 1 minute ago

            const mockPendingFollowUps = [
                {
                    _id: testFollowUpId,
                    assignedTo: {
                        _id: testUserId,
                        email: 'john@pharmacy.com',
                        notificationPreferences: { followUpReminders: true }
                    },
                    reminders: [
                        {
                            type: 'email',
                            scheduledFor: dueDate,
                            sent: false,
                            sentAt: undefined
                        }
                    ],
                    save: jest.fn().mockResolvedValue(true)
                }
            ];

            jest.spyOn(MTRFollowUp, 'find').mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockPendingFollowUps)
            } as any);

            await mtrNotificationService.processPendingReminders();

            // Verify pending reminders were queried
            expect(MTRFollowUp.find).toHaveBeenCalledWith({
                'reminders.sent': false,
                'reminders.scheduledFor': { $lte: expect.any(Date) },
                status: { $in: ['scheduled', 'in_progress'] }
            });

            // Verify reminder was marked as sent
            expect(mockPendingFollowUps[0].reminders[0].sent).toBe(true);
            expect(mockPendingFollowUps[0].reminders[0].sentAt).toBeDefined();
            expect(mockPendingFollowUps[0].save).toHaveBeenCalled();
        });
    });

    describe('getNotificationStatistics', () => {
        it('should return notification statistics', async () => {
            const stats = await mtrNotificationService.getNotificationStatistics();

            expect(stats).toHaveProperty('totalScheduled');
            expect(stats).toHaveProperty('sent');
            expect(stats).toHaveProperty('pending');
            expect(stats).toHaveProperty('failed');
            expect(stats).toHaveProperty('byType');
            expect(stats).toHaveProperty('byChannel');
        });
    });
});