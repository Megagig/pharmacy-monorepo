import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import DiagnosticFollowUp, { IDiagnosticFollowUp, IFollowUpOutcome } from '../models/DiagnosticFollowUp';
import DiagnosticRequest, { IDiagnosticRequest } from '../models/DiagnosticRequest';
import DiagnosticResult, { IDiagnosticResult } from '../models/DiagnosticResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';

export interface CreateFollowUpRequest {
    diagnosticRequestId: mongoose.Types.ObjectId;
    diagnosticResultId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    type: IDiagnosticFollowUp['type'];
    priority?: IDiagnosticFollowUp['priority'];
    description: string;
    objectives?: string[];
    scheduledDate: Date;
    estimatedDuration?: number;
    assignedTo: mongoose.Types.ObjectId;
    autoScheduled?: boolean;
    schedulingRule?: IDiagnosticFollowUp['schedulingRule'];
}

export interface FollowUpSchedulingRule {
    basedOn: 'diagnosis_severity' | 'medication_type' | 'red_flags' | 'patient_risk';
    interval: number; // days
    maxFollowUps?: number;
    conditions?: string[];
}

export interface FollowUpAnalytics {
    totalFollowUps: number;
    completedFollowUps: number;
    missedFollowUps: number;
    overdueFollowUps: number;
    completionRate: number;
    averageDuration: number;
    followUpsByType: Record<string, number>;
    followUpsByPriority: Record<string, number>;
    outcomeDistribution: Record<string, number>;
}

class DiagnosticFollowUpService {
    /**
     * Create a new diagnostic follow-up
     */
    async createFollowUp(
        workplaceId: mongoose.Types.ObjectId,
        followUpData: CreateFollowUpRequest,
        createdBy: mongoose.Types.ObjectId
    ): Promise<IDiagnosticFollowUp> {
        try {
            // Validate diagnostic request and result exist
            const diagnosticRequest = await DiagnosticRequest.findById(followUpData.diagnosticRequestId);
            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            const diagnosticResult = await DiagnosticResult.findById(followUpData.diagnosticResultId);
            if (!diagnosticResult) {
                throw new Error('Diagnostic result not found');
            }

            // Validate patient exists
            const patient = await Patient.findById(followUpData.patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Validate assigned user exists and has appropriate role
            const assignedUser = await User.findById(followUpData.assignedTo);
            if (!assignedUser || !['pharmacist', 'admin'].includes(assignedUser.role)) {
                throw new Error('Invalid assigned user or insufficient permissions');
            }

            // Create follow-up
            const followUp = new DiagnosticFollowUp({
                workplaceId,
                diagnosticRequestId: followUpData.diagnosticRequestId,
                diagnosticResultId: followUpData.diagnosticResultId,
                patientId: followUpData.patientId,
                type: followUpData.type,
                priority: followUpData.priority || 'medium',
                description: followUpData.description,
                objectives: followUpData.objectives || [],
                scheduledDate: followUpData.scheduledDate,
                estimatedDuration: followUpData.estimatedDuration || 30,
                assignedTo: followUpData.assignedTo,
                autoScheduled: followUpData.autoScheduled || false,
                schedulingRule: followUpData.schedulingRule,
                createdBy
            });

            // Set related data from diagnostic result
            if (diagnosticResult.diagnoses && diagnosticResult.diagnoses.length > 0) {
                followUp.relatedDiagnoses = diagnosticResult.diagnoses.map(d => d.condition);
            }

            if (diagnosticResult.medicationSuggestions && diagnosticResult.medicationSuggestions.length > 0) {
                followUp.relatedMedications = diagnosticResult.medicationSuggestions.map(m => m.drugName);
            }

            // Set trigger conditions based on red flags
            if (diagnosticResult.redFlags && diagnosticResult.redFlags.length > 0) {
                followUp.triggerConditions = diagnosticResult.redFlags.map(flag => ({
                    condition: flag.flag,
                    threshold: flag.severity,
                    action: flag.action
                }));
            }

            await followUp.save();

            logger.info(`Diagnostic follow-up created for patient ${patient.mrn}: ${followUp.type}`);
            return followUp;

        } catch (error) {
            logger.error('Error creating diagnostic follow-up:', error);
            throw error;
        }
    }

    /**
     * Auto-schedule follow-ups based on diagnostic results
     */
    async autoScheduleFollowUps(
        diagnosticResult: IDiagnosticResult,
        assignedTo: mongoose.Types.ObjectId
    ): Promise<IDiagnosticFollowUp[]> {
        try {
            const followUps: IDiagnosticFollowUp[] = [];
            const diagnosticRequest = await DiagnosticRequest.findById(diagnosticResult.requestId);

            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            // Schedule follow-ups based on different criteria
            const schedulingRules = this.determineSchedulingRules(diagnosticResult);

            for (const rule of schedulingRules) {
                const followUpDate = new Date();
                followUpDate.setDate(followUpDate.getDate() + rule.interval);

                const followUpData: CreateFollowUpRequest = {
                    diagnosticRequestId: diagnosticRequest._id,
                    diagnosticResultId: diagnosticResult._id,
                    patientId: diagnosticRequest.patientId,
                    type: this.getFollowUpTypeForRule(rule),
                    priority: this.getPriorityForRule(rule, diagnosticResult),
                    description: this.generateFollowUpDescription(rule, diagnosticResult),
                    objectives: this.generateFollowUpObjectives(rule, diagnosticResult),
                    scheduledDate: followUpDate,
                    estimatedDuration: this.getEstimatedDuration(rule),
                    assignedTo,
                    autoScheduled: true,
                    schedulingRule: rule
                };

                const followUp = await this.createFollowUp(
                    diagnosticResult.workplaceId,
                    followUpData,
                    assignedTo
                );

                followUps.push(followUp);
            }

            logger.info(`Auto-scheduled ${followUps.length} follow-ups for diagnostic result ${diagnosticResult._id}`);
            return followUps;

        } catch (error) {
            logger.error('Error auto-scheduling follow-ups:', error);
            throw error;
        }
    }

    /**
     * Complete a follow-up with outcome
     */
    async completeFollowUp(
        followUpId: mongoose.Types.ObjectId,
        outcome: IFollowUpOutcome,
        completedBy: mongoose.Types.ObjectId
    ): Promise<IDiagnosticFollowUp> {
        try {
            const followUp = await DiagnosticFollowUp.findById(followUpId);
            if (!followUp) {
                throw new Error('Follow-up not found');
            }

            if (followUp.status !== 'scheduled' && followUp.status !== 'in_progress') {
                throw new Error('Follow-up cannot be completed in current status');
            }

            await followUp.markCompleted(outcome);
            followUp.updatedBy = completedBy;
            await followUp.save();

            // Schedule next follow-up if needed
            if (outcome.nextFollowUpDate) {
                await this.scheduleNextFollowUp(followUp, outcome.nextFollowUpDate, completedBy);
            }

            logger.info(`Follow-up ${followUpId} completed with status: ${outcome.status}`);
            return followUp;

        } catch (error) {
            logger.error('Error completing follow-up:', error);
            throw error;
        }
    }

    /**
     * Reschedule a follow-up
     */
    async rescheduleFollowUp(
        followUpId: mongoose.Types.ObjectId,
        newDate: Date,
        reason: string,
        rescheduledBy: mongoose.Types.ObjectId
    ): Promise<IDiagnosticFollowUp> {
        try {
            const followUp = await DiagnosticFollowUp.findById(followUpId);
            if (!followUp) {
                throw new Error('Follow-up not found');
            }

            if (!followUp.canReschedule()) {
                throw new Error('Follow-up cannot be rescheduled in current status');
            }

            followUp.reschedule(newDate, reason);
            followUp.updatedBy = rescheduledBy;
            await followUp.save();

            logger.info(`Follow-up ${followUpId} rescheduled to ${newDate.toISOString()}`);
            return followUp;

        } catch (error) {
            logger.error('Error rescheduling follow-up:', error);
            throw error;
        }
    }

    /**
     * Get follow-ups for a patient
     */
    async getPatientFollowUps(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        options?: {
            status?: string;
            type?: string;
            limit?: number;
            skip?: number;
        }
    ): Promise<IDiagnosticFollowUp[]> {
        try {
            let query = DiagnosticFollowUp.findByPatient(patientId, workplaceId);

            if (options?.status) {
                query = query.where('status', options.status);
            }

            if (options?.type) {
                query = query.where('type', options.type);
            }

            if (options?.limit) {
                query = query.limit(options.limit);
            }

            if (options?.skip) {
                query = query.skip(options.skip);
            }

            const followUps = await query
                .populate('assignedTo', 'firstName lastName email')
                .populate('patientId', 'firstName lastName mrn')
                .exec();

            return followUps;

        } catch (error) {
            logger.error('Error getting patient follow-ups:', error);
            throw error;
        }
    }

    /**
     * Get overdue follow-ups
     */
    async getOverdueFollowUps(workplaceId: mongoose.Types.ObjectId): Promise<IDiagnosticFollowUp[]> {
        try {
            const overdueFollowUps = await DiagnosticFollowUp.findOverdue(workplaceId)
                .populate('assignedTo', 'firstName lastName email')
                .populate('patientId', 'firstName lastName mrn')
                .populate('diagnosticResultId', 'diagnoses riskAssessment')
                .exec();

            return overdueFollowUps;

        } catch (error) {
            logger.error('Error getting overdue follow-ups:', error);
            throw error;
        }
    }

    /**
     * Get follow-up analytics
     */
    async getFollowUpAnalytics(
        workplaceId: mongoose.Types.ObjectId,
        dateRange?: { start: Date; end: Date }
    ): Promise<FollowUpAnalytics> {
        try {
            const matchStage: any = { workplaceId };

            if (dateRange) {
                matchStage.scheduledDate = {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                };
            }

            const pipeline = [
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalFollowUps: { $sum: 1 },
                        completedFollowUps: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        missedFollowUps: {
                            $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
                        },
                        overdueFollowUps: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ['$status', ['scheduled', 'in_progress']] },
                                            { $lt: ['$scheduledDate', new Date()] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        avgDuration: { $avg: '$estimatedDuration' },
                        followUpsByType: {
                            $push: {
                                type: '$type',
                                status: '$status',
                                priority: '$priority'
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalFollowUps: 1,
                        completedFollowUps: 1,
                        missedFollowUps: 1,
                        overdueFollowUps: 1,
                        completionRate: {
                            $cond: [
                                { $gt: ['$totalFollowUps', 0] },
                                { $multiply: [{ $divide: ['$completedFollowUps', '$totalFollowUps'] }, 100] },
                                0
                            ]
                        },
                        averageDuration: { $round: ['$avgDuration', 1] },
                        followUpsByType: 1
                    }
                }
            ];

            const result = await DiagnosticFollowUp.aggregate(pipeline);
            const analytics = result[0] || {
                totalFollowUps: 0,
                completedFollowUps: 0,
                missedFollowUps: 0,
                overdueFollowUps: 0,
                completionRate: 0,
                averageDuration: 0,
                followUpsByType: []
            };

            // Process follow-ups by type and priority
            const followUpsByType: Record<string, number> = {};
            const followUpsByPriority: Record<string, number> = {};
            const outcomeDistribution: Record<string, number> = {};

            analytics.followUpsByType.forEach((item: any) => {
                followUpsByType[item.type] = (followUpsByType[item.type] || 0) + 1;
                followUpsByPriority[item.priority] = (followUpsByPriority[item.priority] || 0) + 1;
                if (item.status === 'completed') {
                    // This would need to be enhanced to get actual outcome status
                    outcomeDistribution['successful'] = (outcomeDistribution['successful'] || 0) + 1;
                }
            });

            return {
                ...analytics,
                followUpsByType,
                followUpsByPriority,
                outcomeDistribution
            };

        } catch (error) {
            logger.error('Error getting follow-up analytics:', error);
            throw error;
        }
    }

    /**
     * Check for missed follow-ups and update status
     */
    async processMissedFollowUps(): Promise<void> {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - 2); // 2 hours grace period

            const missedFollowUps = await DiagnosticFollowUp.find({
                status: 'scheduled',
                scheduledDate: { $lt: cutoffTime }
            });

            for (const followUp of missedFollowUps) {
                followUp.status = 'missed';
                await followUp.save();

                logger.info(`Follow-up ${followUp._id} marked as missed`);
            }

            logger.info(`Processed ${missedFollowUps.length} missed follow-ups`);

        } catch (error) {
            logger.error('Error processing missed follow-ups:', error);
            throw error;
        }
    }

    /**
     * Private helper methods
     */
    private determineSchedulingRules(diagnosticResult: IDiagnosticResult): FollowUpSchedulingRule[] {
        const rules: FollowUpSchedulingRule[] = [];

        // Rule based on risk assessment
        if (diagnosticResult.riskAssessment.overallRisk === 'critical') {
            rules.push({
                basedOn: 'patient_risk',
                interval: 1, // Next day
                maxFollowUps: 3,
                conditions: ['critical_risk']
            });
        } else if (diagnosticResult.riskAssessment.overallRisk === 'high') {
            rules.push({
                basedOn: 'patient_risk',
                interval: 3, // 3 days
                maxFollowUps: 2,
                conditions: ['high_risk']
            });
        }

        // Rule based on red flags
        const criticalFlags = diagnosticResult.redFlags.filter(flag => flag.severity === 'critical');
        if (criticalFlags.length > 0) {
            rules.push({
                basedOn: 'red_flags',
                interval: 1, // Next day
                maxFollowUps: 2,
                conditions: criticalFlags.map(flag => flag.flag)
            });
        }

        // Rule based on medication suggestions
        if (diagnosticResult.medicationSuggestions.length > 0) {
            rules.push({
                basedOn: 'medication_type',
                interval: 7, // 1 week
                maxFollowUps: 1,
                conditions: ['medication_adherence']
            });
        }

        // Rule based on diagnosis severity
        const highSeverityDiagnoses = diagnosticResult.diagnoses.filter(d => d.severity === 'high');
        if (highSeverityDiagnoses.length > 0) {
            rules.push({
                basedOn: 'diagnosis_severity',
                interval: 14, // 2 weeks
                maxFollowUps: 1,
                conditions: highSeverityDiagnoses.map(d => d.condition)
            });
        }

        return rules;
    }

    private getFollowUpTypeForRule(rule: FollowUpSchedulingRule): IDiagnosticFollowUp['type'] {
        switch (rule.basedOn) {
            case 'medication_type':
                return 'medication_review';
            case 'red_flags':
            case 'patient_risk':
                return 'symptom_check';
            case 'diagnosis_severity':
                return 'outcome_assessment';
            default:
                return 'symptom_check';
        }
    }

    private getPriorityForRule(rule: FollowUpSchedulingRule, diagnosticResult: IDiagnosticResult): IDiagnosticFollowUp['priority'] {
        if (rule.basedOn === 'red_flags' || diagnosticResult.riskAssessment.overallRisk === 'critical') {
            return 'high';
        }
        if (rule.interval <= 3 || diagnosticResult.riskAssessment.overallRisk === 'high') {
            return 'medium';
        }
        return 'low';
    }

    private generateFollowUpDescription(rule: FollowUpSchedulingRule, diagnosticResult: IDiagnosticResult): string {
        const primaryDiagnosis = diagnosticResult.diagnoses[0]?.condition || 'diagnostic assessment';

        switch (rule.basedOn) {
            case 'medication_type':
                return `Medication adherence and effectiveness review following ${primaryDiagnosis}`;
            case 'red_flags':
                return `Critical symptom monitoring following ${primaryDiagnosis} - red flags identified`;
            case 'patient_risk':
                return `High-risk patient monitoring following ${primaryDiagnosis}`;
            case 'diagnosis_severity':
                return `Outcome assessment and symptom progression review for ${primaryDiagnosis}`;
            default:
                return `Follow-up assessment for ${primaryDiagnosis}`;
        }
    }

    private generateFollowUpObjectives(rule: FollowUpSchedulingRule, diagnosticResult: IDiagnosticResult): string[] {
        const objectives: string[] = [];

        switch (rule.basedOn) {
            case 'medication_type':
                objectives.push('Assess medication adherence');
                objectives.push('Monitor for side effects');
                objectives.push('Evaluate therapeutic effectiveness');
                break;
            case 'red_flags':
                objectives.push('Monitor critical symptoms');
                objectives.push('Assess need for immediate intervention');
                objectives.push('Evaluate patient safety');
                break;
            case 'patient_risk':
                objectives.push('Monitor high-risk conditions');
                objectives.push('Assess symptom progression');
                objectives.push('Review care plan effectiveness');
                break;
            case 'diagnosis_severity':
                objectives.push('Evaluate treatment outcomes');
                objectives.push('Monitor symptom resolution');
                objectives.push('Assess need for referral');
                break;
        }

        return objectives;
    }

    private getEstimatedDuration(rule: FollowUpSchedulingRule): number {
        switch (rule.basedOn) {
            case 'red_flags':
            case 'patient_risk':
                return 45; // More time for high-risk patients
            case 'medication_type':
                return 30; // Standard medication review
            case 'diagnosis_severity':
                return 30; // Standard assessment
            default:
                return 30;
        }
    }

    private async scheduleNextFollowUp(
        currentFollowUp: IDiagnosticFollowUp,
        nextDate: Date,
        scheduledBy: mongoose.Types.ObjectId
    ): Promise<IDiagnosticFollowUp | null> {
        try {
            // Check if we've reached max follow-ups for this rule
            if (currentFollowUp.schedulingRule?.maxFollowUps) {
                const existingFollowUps = await DiagnosticFollowUp.countDocuments({
                    diagnosticRequestId: currentFollowUp.diagnosticRequestId,
                    'schedulingRule.basedOn': currentFollowUp.schedulingRule.basedOn
                });

                if (existingFollowUps >= currentFollowUp.schedulingRule.maxFollowUps) {
                    return null; // Max follow-ups reached
                }
            }

            const nextFollowUpData: CreateFollowUpRequest = {
                diagnosticRequestId: currentFollowUp.diagnosticRequestId,
                diagnosticResultId: currentFollowUp.diagnosticResultId,
                patientId: currentFollowUp.patientId,
                type: currentFollowUp.type,
                priority: currentFollowUp.priority,
                description: `Follow-up continuation: ${currentFollowUp.description}`,
                objectives: currentFollowUp.objectives,
                scheduledDate: nextDate,
                estimatedDuration: currentFollowUp.estimatedDuration,
                assignedTo: currentFollowUp.assignedTo,
                autoScheduled: true,
                schedulingRule: currentFollowUp.schedulingRule
            };

            const nextFollowUp = await this.createFollowUp(
                currentFollowUp.workplaceId,
                nextFollowUpData,
                scheduledBy
            );

            logger.info(`Next follow-up scheduled for ${nextDate.toISOString()}`);
            return nextFollowUp;

        } catch (error) {
            logger.error('Error scheduling next follow-up:', error);
            return null;
        }
    }
}

export const diagnosticFollowUpService = new DiagnosticFollowUpService();
export default diagnosticFollowUpService;