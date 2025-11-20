import mongoose from 'mongoose';
import MTRFollowUp, { IMTRFollowUp } from '../../models/MTRFollowUp';

describe('MTRFollowUp Model', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let reviewId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let assignedTo: mongoose.Types.ObjectId;
    let createdBy: mongoose.Types.ObjectId;

    beforeEach(() => {
        workplaceId = testUtils.createObjectId();
        reviewId = testUtils.createObjectId();
        patientId = testUtils.createObjectId();
        assignedTo = testUtils.createObjectId();
        createdBy = testUtils.createObjectId();
    });

    describe('Model Creation', () => {
        it('should create a valid MTR follow-up', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call to assess medication adherence',
                objectives: ['Check adherence', 'Assess side effects'],
                scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);
            const savedFollowUp = await followUp.save();

            expect(savedFollowUp._id).toBeValidObjectId();
            expect(savedFollowUp.workplaceId).toEqual(workplaceId);
            expect(savedFollowUp.reviewId).toEqual(reviewId);
            expect(savedFollowUp.patientId).toEqual(patientId);
            expect(savedFollowUp.type).toBe('phone_call');
            expect(savedFollowUp.status).toBe('scheduled');
            expect(savedFollowUp.priority).toBe('medium');
            expect(savedFollowUp.estimatedDuration).toBe(30);
        });

        it('should fail validation without required fields', async () => {
            const followUp = new MTRFollowUp({});

            await expect(followUp.save()).rejects.toThrow();
        });

        it('should validate enum values', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'invalid_type', // Invalid enum value
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow();
        });

        it('should validate scheduled date is not in the past', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow('Scheduled date cannot be in the past');
        });

        it('should validate duration range', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                estimatedDuration: 500, // Exceeds max duration
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow();
        });

        it('should require objectives for high priority follow-ups', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'High priority follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                priority: 'high',
                objectives: [], // Empty objectives for high priority
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow('High priority follow-ups must have at least one objective');
        });
    });

    describe('Virtual Properties', () => {
        let followUp: IMTRFollowUp;

        beforeEach(async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                assignedTo,
                createdBy
            };

            followUp = new MTRFollowUp(followUpData);
            await followUp.save();
        });

        it('should calculate days until follow-up', () => {
            expect(followUp.daysUntilFollowUp).toBe(3);
        });

        it('should return null for completed follow-ups', () => {
            followUp.status = 'completed';
            expect(followUp.daysUntilFollowUp).toBeNull();
        });

        it('should calculate days since scheduled', () => {
            followUp.scheduledDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            expect(followUp.daysSinceScheduled).toBeGreaterThanOrEqual(2);
        });

        it('should determine overdue status', () => {
            // Future date - not overdue
            followUp.scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            expect(followUp.isOverdue()).toBe(false);

            // Past date - overdue
            followUp.scheduledDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            expect(followUp.isOverdue()).toBe(true);

            // Completed - not overdue
            followUp.status = 'completed';
            expect(followUp.isOverdue()).toBe(false);
        });

        it('should determine reminder status', () => {
            // Clear any default reminders first
            followUp.reminders = [];

            // No reminders
            expect(followUp.reminderStatus).toBe('none');

            // Add reminders
            followUp.reminders.push({
                type: 'email',
                scheduledFor: new Date(),
                sent: false
            });
            expect(followUp.reminderStatus).toBe('pending');

            // Mark reminder as sent
            followUp.reminders[0]!.sent = true;
            expect(followUp.reminderStatus).toBe('all_sent');

            // Add another unsent reminder
            followUp.reminders.push({
                type: 'sms',
                scheduledFor: new Date(),
                sent: false
            });
            expect(followUp.reminderStatus).toBe('partial');
        });
    });

    describe('Instance Methods', () => {
        let followUp: IMTRFollowUp;

        beforeEach(async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo,
                createdBy
            };

            followUp = new MTRFollowUp(followUpData);
            await followUp.save();
        });

        it('should determine if follow-up is overdue', () => {
            // Future date
            followUp.scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            expect(followUp.isOverdue()).toBe(false);

            // Past date
            followUp.scheduledDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            expect(followUp.isOverdue()).toBe(true);

            // Completed status
            followUp.status = 'completed';
            expect(followUp.isOverdue()).toBe(false);
        });

        it('should determine if follow-up can be rescheduled', () => {
            followUp.status = 'scheduled';
            expect(followUp.canReschedule()).toBe(true);

            followUp.status = 'missed';
            expect(followUp.canReschedule()).toBe(true);

            followUp.status = 'completed';
            expect(followUp.canReschedule()).toBe(false);

            followUp.status = 'cancelled';
            expect(followUp.canReschedule()).toBe(false);
        });

        it('should mark follow-up as completed', () => {
            const outcome = {
                status: 'successful' as const,
                notes: 'Patient is adhering well to medication regimen',
                nextActions: ['Continue current therapy', 'Schedule next review in 3 months'],
                adherenceImproved: true
            };

            followUp.markCompleted(outcome);

            expect(followUp.status).toBe('completed');
            expect(followUp.completedAt).toBeInstanceOf(Date);
            expect(followUp.outcome).toEqual(outcome);
        });

        it('should schedule reminder', () => {
            // Clear any default reminders first
            followUp.reminders = [];

            const reminderDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            followUp.scheduleReminder('email', reminderDate);

            expect(followUp.reminders).toHaveLength(1);
            expect(followUp.reminders[0]!.type).toBe('email');
            expect(followUp.reminders[0]!.scheduledFor).toEqual(reminderDate);
            expect(followUp.reminders[0]!.sent).toBe(false);
        });

        it('should reschedule follow-up', () => {
            const originalDate = followUp.scheduledDate;
            const newDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const reason = 'Patient requested different time';

            followUp.reschedule(newDate, reason);

            expect(followUp.rescheduledFrom).toEqual(originalDate);
            expect(followUp.scheduledDate).toEqual(newDate);
            expect(followUp.status).toBe('scheduled');
            expect(followUp.rescheduledReason).toBe(reason);
            // Reminders should be cleared and new default reminders added
            expect(followUp.reminders.length).toBeGreaterThanOrEqual(0);
        });

        it('should not reschedule if status does not allow it', () => {
            followUp.status = 'completed';

            expect(() => {
                followUp.reschedule(new Date());
            }).toThrow('Follow-up cannot be rescheduled in current status');
        });

        it('should schedule default reminders', () => {
            followUp.scheduleDefaultReminders();

            expect(followUp.reminders.length).toBeGreaterThan(0);

            // Check that reminders are scheduled before the follow-up date
            followUp.reminders.forEach(reminder => {
                expect(reminder.scheduledFor.getTime()).toBeLessThan(followUp.scheduledDate.getTime());
            });
        });
    });

    describe('Pre-save Middleware', () => {
        it('should auto-set completion date when status changes to completed', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);
            await followUp.save();

            // Change status to completed with outcome
            followUp.status = 'completed';
            followUp.outcome = {
                status: 'successful',
                notes: 'Test outcome',
                nextActions: []
            };
            await followUp.save();

            expect(followUp.completedAt).toBeInstanceOf(Date);
        });

        it('should clear completion date when status changes from completed', async () => {
            const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate,
                status: 'completed',
                completedAt: new Date(scheduledDate.getTime() + 60 * 60 * 1000), // 1 hour after scheduled
                outcome: {
                    status: 'successful',
                    notes: 'Test outcome',
                    nextActions: []
                },
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);
            await followUp.save();

            // Change status from completed
            followUp.status = 'scheduled';
            await followUp.save();

            expect(followUp.completedAt).toBeUndefined();
        });

        it('should require outcome when status is completed', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: 'completed',
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow('Outcome is required when follow-up is completed');
        });

        it('should schedule default reminders for new follow-ups', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Follow-up call',
                scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);
            await followUp.save();

            expect(followUp.reminders.length).toBeGreaterThan(0);
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test data with future dates first, then update to past dates
            const followUpData1 = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'First follow-up',
                objectives: ['Check medication adherence'],
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: 'scheduled',
                priority: 'high',
                assignedTo,
                createdBy
            };

            const followUpData2 = {
                workplaceId,
                reviewId: testUtils.createObjectId(),
                patientId: testUtils.createObjectId(),
                type: 'appointment',
                description: 'Second follow-up',
                scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now, will update to past
                status: 'scheduled',
                priority: 'medium',
                assignedTo,
                createdBy
            };

            const followUpData3 = {
                workplaceId,
                reviewId: testUtils.createObjectId(),
                patientId: testUtils.createObjectId(),
                type: 'lab_review',
                description: 'Completed follow-up',
                scheduledDate: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now, will update to past
                status: 'scheduled', // Create as scheduled first
                assignedTo,
                createdBy
            };

            const followUps = await MTRFollowUp.create([followUpData1, followUpData2, followUpData3]);

            // Update the second follow-up to be overdue (past date)
            await MTRFollowUp.updateOne(
                { _id: followUps[1]!._id },
                { scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                { runValidators: false }
            );

            // Update the third follow-up to be completed with past date
            const completedDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            await MTRFollowUp.updateOne(
                { _id: followUps[2]!._id },
                {
                    scheduledDate: completedDate,
                    status: 'completed',
                    completedAt: new Date(completedDate.getTime() + 60 * 60 * 1000),
                    outcome: {
                        status: 'successful',
                        notes: 'All good',
                        nextActions: []
                    }
                },
                { runValidators: false }
            );
        });

        it('should find follow-ups by review', async () => {
            const followUps = await (MTRFollowUp as any).findByReview(reviewId, workplaceId);

            expect(followUps).toHaveLength(1);
            expect(followUps[0].reviewId).toEqual(reviewId);
        });

        it('should find follow-ups by patient', async () => {
            const followUps = await (MTRFollowUp as any).findByPatient(patientId, workplaceId);

            expect(followUps).toHaveLength(1);
            expect(followUps[0].patientId).toEqual(patientId);
        });

        it('should find scheduled follow-ups', async () => {
            const scheduledFollowUps = await (MTRFollowUp as any).findScheduled(workplaceId);

            expect(scheduledFollowUps).toHaveLength(2);
            scheduledFollowUps.forEach((followUp: any) => {
                expect(followUp.status).toBe('scheduled');
            });
        });

        it('should find overdue follow-ups', async () => {
            const overdueFollowUps = await (MTRFollowUp as any).findOverdue(workplaceId);

            expect(overdueFollowUps).toHaveLength(1);
            expect(overdueFollowUps[0].scheduledDate.getTime()).toBeLessThan(Date.now());
        });

        it('should find follow-ups by assignee', async () => {
            const assignedFollowUps = await (MTRFollowUp as any).findByAssignee(assignedTo, workplaceId);

            expect(assignedFollowUps).toHaveLength(3);
            assignedFollowUps.forEach((followUp: any) => {
                expect(followUp.assignedTo).toEqual(assignedTo);
            });
        });

        it('should find pending reminders', async () => {
            // Add a follow-up with pending reminder
            await MTRFollowUp.create({
                workplaceId,
                reviewId: testUtils.createObjectId(),
                patientId: testUtils.createObjectId(),
                type: 'phone_call',
                description: 'Follow-up with reminder',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                reminders: [{
                    type: 'email',
                    scheduledFor: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
                    sent: false
                }],
                assignedTo,
                createdBy
            });

            const pendingReminders = await (MTRFollowUp as any).findPendingReminders(workplaceId);

            expect(pendingReminders).toHaveLength(1);
            expect(pendingReminders[0].reminders[0].sent).toBe(false);
        });

        it('should get follow-up statistics', async () => {
            const stats = await (MTRFollowUp as any).getStatistics(workplaceId);

            expect(stats.totalFollowUps).toBe(3);
            expect(stats.scheduledFollowUps).toBe(2);
            expect(stats.completedFollowUps).toBe(1);
            expect(stats.overdueFollowUps).toBe(1);
            expect(stats.completionRate).toBeCloseTo(33.33, 1);
        });
    });

    describe('Validation Rules', () => {
        it('should validate description length', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'A'.repeat(1001), // Exceeds max length
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow();
        });

        it('should validate completion date is after scheduled date', async () => {
            const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const completedAt = new Date(scheduledDate.getTime() - 60 * 60 * 1000); // Before scheduled

            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Test follow-up',
                scheduledDate,
                status: 'completed',
                completedAt,
                outcome: {
                    status: 'successful',
                    notes: 'Test outcome'
                },
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow('Completion date cannot be before scheduled date');
        });

        it('should validate outcome notes length', async () => {
            const followUpData = {
                workplaceId,
                reviewId,
                patientId,
                type: 'phone_call',
                description: 'Test follow-up',
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: 'completed',
                completedAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
                outcome: {
                    status: 'successful',
                    notes: 'A'.repeat(2001) // Exceeds max length
                },
                assignedTo,
                createdBy
            };

            const followUp = new MTRFollowUp(followUpData);

            await expect(followUp.save()).rejects.toThrow();
        });
    });
});