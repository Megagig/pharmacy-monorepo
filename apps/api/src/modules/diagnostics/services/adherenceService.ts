import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import AdherenceTracking, { IAdherenceTracking, IMedicationAdherence, IAdherenceAlert, IAdherenceIntervention } from '../models/AdherenceTracking';
import DiagnosticResult, { IDiagnosticResult } from '../models/DiagnosticResult';
import Patient from '../../../models/Patient';
import User from '../../../models/User';

export interface CreateAdherenceTrackingRequest {
    patientId: mongoose.Types.ObjectId;
    diagnosticRequestId?: mongoose.Types.ObjectId;
    diagnosticResultId?: mongoose.Types.ObjectId;
    medications: Array<Omit<IMedicationAdherence, 'adherenceScore' | 'adherenceStatus' | 'refillHistory'>>;
    monitoringFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    alertPreferences?: IAdherenceTracking['alertPreferences'];
}

export interface RefillData {
    medicationName: string;
    date: Date;
    daysSupply: number;
    source: 'pharmacy' | 'patient_report' | 'system_estimate';
    notes?: string;
}

export interface AdherenceAssessment {
    patientId: mongoose.Types.ObjectId;
    overallScore: number;
    category: 'excellent' | 'good' | 'fair' | 'poor';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    medicationsAtRisk: Array<{
        name: string;
        score: number;
        status: string;
        issues: string[];
    }>;
    recommendations: string[];
    nextAssessmentDate: Date;
}

export interface AdherenceReport {
    patientId: mongoose.Types.ObjectId;
    reportPeriod: { start: Date; end: Date };
    overallAdherence: number;
    medicationDetails: Array<{
        name: string;
        adherenceScore: number;
        refillPattern: string;
        issues: string[];
        interventions: number;
    }>;
    alerts: {
        total: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
    };
    interventions: {
        total: number;
        byType: Record<string, number>;
        effectiveness: Record<string, number>;
    };
    outcomes: {
        symptomsImproved: boolean;
        adherenceImproved: boolean;
        qualityOfLife?: number;
    };
}

class AdherenceService {
    /**
     * Create adherence tracking for a patient
     */
    async createAdherenceTracking(
        workplaceId: mongoose.Types.ObjectId,
        trackingData: CreateAdherenceTrackingRequest,
        createdBy: mongoose.Types.ObjectId
    ): Promise<IAdherenceTracking> {
        try {
            // Validate patient exists
            const patient = await Patient.findById(trackingData.patientId);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Check if tracking already exists for this patient
            const existingTracking = await AdherenceTracking.findByPatient(trackingData.patientId, workplaceId);
            if (existingTracking) {
                throw new Error('Adherence tracking already exists for this patient');
            }

            // Create adherence tracking
            const adherenceTracking = new AdherenceTracking({
                workplaceId,
                patientId: trackingData.patientId,
                diagnosticRequestId: trackingData.diagnosticRequestId,
                diagnosticResultId: trackingData.diagnosticResultId,
                medications: trackingData.medications.map(med => ({
                    ...med,
                    adherenceScore: 0,
                    adherenceStatus: 'unknown',
                    refillHistory: []
                })),
                monitoringFrequency: trackingData.monitoringFrequency || 'weekly',
                alertPreferences: trackingData.alertPreferences || {
                    enableRefillReminders: true,
                    enableAdherenceAlerts: true,
                    reminderDaysBefore: 7,
                    escalationThreshold: 3
                },
                createdBy
            });

            await adherenceTracking.save();

            logger.info(`Adherence tracking created for patient ${patient.mrn}`);
            return adherenceTracking;

        } catch (error) {
            logger.error('Error creating adherence tracking:', error);
            throw error;
        }
    }

    /**
     * Create adherence tracking from diagnostic result
     */
    async createFromDiagnosticResult(
        diagnosticResult: IDiagnosticResult,
        createdBy: mongoose.Types.ObjectId
    ): Promise<IAdherenceTracking | null> {
        try {
            if (!diagnosticResult.medicationSuggestions || diagnosticResult.medicationSuggestions.length === 0) {
                return null; // No medications to track
            }

            const medications = diagnosticResult.medicationSuggestions.map(suggestion => ({
                medicationName: suggestion.drugName,
                rxcui: suggestion.rxcui,
                dosage: suggestion.dosage,
                frequency: suggestion.frequency,
                prescribedDate: new Date()
            }));

            const trackingData: CreateAdherenceTrackingRequest = {
                patientId: diagnosticResult.requestId, // This should be linked to patient through request
                diagnosticResultId: diagnosticResult._id,
                medications,
                monitoringFrequency: this.determineMonitoringFrequency(diagnosticResult),
                alertPreferences: this.determineAlertPreferences(diagnosticResult)
            };

            return await this.createAdherenceTracking(
                diagnosticResult.workplaceId,
                trackingData,
                createdBy
            );

        } catch (error) {
            logger.error('Error creating adherence tracking from diagnostic result:', error);
            throw error;
        }
    }

    /**
     * Add medication refill
     */
    async addRefill(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        refillData: RefillData
    ): Promise<IAdherenceTracking> {
        try {
            const tracking = await AdherenceTracking.findByPatient(patientId, workplaceId);
            if (!tracking) {
                throw new Error('Adherence tracking not found for patient');
            }

            tracking.addRefill(refillData.medicationName, {
                date: refillData.date,
                daysSupply: refillData.daysSupply,
                source: refillData.source,
                notes: refillData.notes
            });

            await tracking.save();

            // Check for adherence alerts after refill
            await this.checkAdherenceAlerts(tracking);

            logger.info(`Refill added for patient ${patientId}: ${refillData.medicationName}`);
            return tracking;

        } catch (error) {
            logger.error('Error adding refill:', error);
            throw error;
        }
    }

    /**
     * Update medication adherence score
     */
    async updateMedicationAdherence(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        medicationName: string,
        adherenceData: Partial<IMedicationAdherence>
    ): Promise<IAdherenceTracking> {
        try {
            const tracking = await AdherenceTracking.findByPatient(patientId, workplaceId);
            if (!tracking) {
                throw new Error('Adherence tracking not found for patient');
            }

            tracking.updateMedicationAdherence(medicationName, adherenceData);
            await tracking.save();

            // Check for adherence alerts after update
            await this.checkAdherenceAlerts(tracking);

            logger.info(`Adherence updated for patient ${patientId}: ${medicationName}`);
            return tracking;

        } catch (error) {
            logger.error('Error updating medication adherence:', error);
            throw error;
        }
    }

    /**
     * Assess patient adherence
     */
    async assessPatientAdherence(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId
    ): Promise<AdherenceAssessment> {
        try {
            const tracking = await AdherenceTracking.findByPatient(patientId, workplaceId);
            if (!tracking) {
                throw new Error('Adherence tracking not found for patient');
            }

            const overallScore = tracking.calculateOverallAdherence();
            const riskLevel = tracking.assessAdherenceRisk();
            const medicationsAtRisk = tracking.medicationsAtRisk;

            const recommendations = this.generateAdherenceRecommendations(tracking);

            return {
                patientId,
                overallScore,
                category: tracking.adherenceCategory,
                riskLevel,
                medicationsAtRisk: medicationsAtRisk.map(med => ({
                    name: med.medicationName,
                    score: med.adherenceScore,
                    status: med.adherenceStatus,
                    issues: this.identifyMedicationIssues(med)
                })),
                recommendations,
                nextAssessmentDate: tracking.nextAssessmentDate
            };

        } catch (error) {
            logger.error('Error assessing patient adherence:', error);
            throw error;
        }
    }

    /**
     * Check for adherence alerts
     */
    async checkAdherenceAlerts(tracking: IAdherenceTracking): Promise<void> {
        try {
            const alerts: Omit<IAdherenceAlert, 'triggeredAt' | 'acknowledged' | 'resolved'>[] = [];

            // Check for missed refills
            for (const medication of tracking.medications) {
                if (medication.expectedRefillDate && medication.expectedRefillDate < new Date()) {
                    const daysOverdue = Math.floor(
                        (Date.now() - medication.expectedRefillDate.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    if (daysOverdue > 0) {
                        alerts.push({
                            type: 'missed_refill',
                            severity: daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low',
                            message: `${medication.medicationName} refill is ${daysOverdue} days overdue`
                        });
                    }
                }

                // Check for low adherence
                if (medication.adherenceScore < 70) {
                    alerts.push({
                        type: 'low_adherence',
                        severity: medication.adherenceScore < 50 ? 'critical' : 'high',
                        message: `Low adherence detected for ${medication.medicationName} (${medication.adherenceScore}%)`
                    });
                }

                // Check for medication gaps
                if (medication.refillHistory.length >= 2) {
                    const lastTwoRefills = medication.refillHistory
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .slice(0, 2);

                    const daysBetween = Math.floor(
                        ((lastTwoRefills[0]!.date.getTime()) - (lastTwoRefills[1]!.date.getTime())) / (1000 * 60 * 60 * 24)
                    );

                    const expectedDays = lastTwoRefills[1]!.daysSupply || 0;
                    const gap = daysBetween - expectedDays;

                    if (gap > 3) {
                        alerts.push({
                            type: 'medication_gap',
                            severity: gap > 7 ? 'high' : 'medium',
                            message: `${gap}-day gap detected in ${medication.medicationName} therapy`
                        });
                    }
                }
            }

            // Add alerts to tracking
            for (const alert of alerts) {
                tracking.createAlert(alert);
            }

            if (alerts.length > 0) {
                await tracking.save();
                logger.info(`Created ${alerts.length} adherence alerts for patient ${tracking.patientId}`);
            }

        } catch (error) {
            logger.error('Error checking adherence alerts:', error);
            throw error;
        }
    }

    /**
     * Add adherence intervention
     */
    async addIntervention(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        intervention: Omit<IAdherenceIntervention, 'implementedAt'>,
        implementedBy: mongoose.Types.ObjectId
    ): Promise<IAdherenceTracking> {
        try {
            const tracking = await AdherenceTracking.findByPatient(patientId, workplaceId);
            if (!tracking) {
                throw new Error('Adherence tracking not found for patient');
            }

            tracking.addIntervention({
                ...intervention,
                implementedBy
            });

            await tracking.save();

            logger.info(`Adherence intervention added for patient ${patientId}: ${intervention.type}`);
            return tracking;

        } catch (error) {
            logger.error('Error adding adherence intervention:', error);
            throw error;
        }
    }

    /**
     * Generate adherence report
     */
    async generateAdherenceReport(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        reportPeriod: { start: Date; end: Date }
    ): Promise<AdherenceReport> {
        try {
            const tracking = await AdherenceTracking.findByPatient(patientId, workplaceId);
            if (!tracking) {
                throw new Error('Adherence tracking not found for patient');
            }

            // Filter alerts and interventions by report period
            const periodAlerts = tracking.alerts.filter(alert =>
                alert.triggeredAt >= reportPeriod.start && alert.triggeredAt <= reportPeriod.end
            );

            const periodInterventions = tracking.interventions.filter(intervention =>
                intervention.implementedAt >= reportPeriod.start && intervention.implementedAt <= reportPeriod.end
            );

            // Calculate alert statistics
            const alertsByType: Record<string, number> = {};
            const alertsBySeverity: Record<string, number> = {};
            periodAlerts.forEach(alert => {
                alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
                alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
            });

            // Calculate intervention statistics
            const interventionsByType: Record<string, number> = {};
            const interventionEffectiveness: Record<string, number> = {};
            periodInterventions.forEach(intervention => {
                interventionsByType[intervention.type] = (interventionsByType[intervention.type] || 0) + 1;
                if (intervention.effectiveness) {
                    interventionEffectiveness[intervention.effectiveness] =
                        (interventionEffectiveness[intervention.effectiveness] || 0) + 1;
                }
            });

            return {
                patientId,
                reportPeriod,
                overallAdherence: tracking.overallAdherenceScore,
                medicationDetails: tracking.medications.map(med => ({
                    name: med.medicationName,
                    adherenceScore: med.adherenceScore,
                    refillPattern: this.analyzeRefillPattern(med),
                    issues: this.identifyMedicationIssues(med),
                    interventions: periodInterventions.filter(i =>
                        i.description.includes(med.medicationName)
                    ).length
                })),
                alerts: {
                    total: periodAlerts.length,
                    byType: alertsByType,
                    bySeverity: alertsBySeverity
                },
                interventions: {
                    total: periodInterventions.length,
                    byType: interventionsByType,
                    effectiveness: interventionEffectiveness
                },
                outcomes: {
                    symptomsImproved: tracking.clinicalOutcomes?.symptomsImproved || false,
                    adherenceImproved: this.calculateAdherenceImprovement(tracking, reportPeriod),
                    qualityOfLife: tracking.clinicalOutcomes?.qualityOfLifeScore
                }
            };

        } catch (error) {
            logger.error('Error generating adherence report:', error);
            throw error;
        }
    }

    /**
     * Get patients with poor adherence
     */
    async getPatientsWithPoorAdherence(
        workplaceId: mongoose.Types.ObjectId,
        threshold: number = 70
    ): Promise<IAdherenceTracking[]> {
        try {
            const poorAdherencePatients = await AdherenceTracking.findPoorAdherence(workplaceId, threshold);

            return poorAdherencePatients;

        } catch (error) {
            logger.error('Error getting patients with poor adherence:', error);
            throw error;
        }
    }

    /**
     * Process adherence assessments
     */
    async processAdherenceAssessments(): Promise<void> {
        try {
            const dueAssessments = await AdherenceTracking.findDueForAssessment();

            for (const tracking of dueAssessments) {
                // Recalculate adherence scores
                tracking.calculateOverallAdherence();

                // Check for new alerts
                await this.checkAdherenceAlerts(tracking);

                // Update next assessment date
                const nextDate = new Date();
                switch (tracking.monitoringFrequency) {
                    case 'daily':
                        nextDate.setDate(nextDate.getDate() + 1);
                        break;
                    case 'weekly':
                        nextDate.setDate(nextDate.getDate() + 7);
                        break;
                    case 'biweekly':
                        nextDate.setDate(nextDate.getDate() + 14);
                        break;
                    case 'monthly':
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        break;
                }
                tracking.nextAssessmentDate = nextDate;

                await tracking.save();
            }

            logger.info(`Processed ${dueAssessments.length} adherence assessments`);

        } catch (error) {
            logger.error('Error processing adherence assessments:', error);
            throw error;
        }
    }

    /**
     * Private helper methods
     */
    private determineMonitoringFrequency(diagnosticResult: IDiagnosticResult): 'daily' | 'weekly' | 'biweekly' | 'monthly' {
        if (diagnosticResult.riskAssessment.overallRisk === 'critical') {
            return 'daily';
        }
        if (diagnosticResult.riskAssessment.overallRisk === 'high') {
            return 'weekly';
        }
        return 'biweekly';
    }

    private determineAlertPreferences(diagnosticResult: IDiagnosticResult): IAdherenceTracking['alertPreferences'] {
        const riskLevel = diagnosticResult.riskAssessment.overallRisk;

        return {
            enableRefillReminders: true,
            enableAdherenceAlerts: true,
            reminderDaysBefore: riskLevel === 'critical' ? 3 : riskLevel === 'high' ? 5 : 7,
            escalationThreshold: riskLevel === 'critical' ? 1 : riskLevel === 'high' ? 2 : 3
        };
    }

    private generateAdherenceRecommendations(tracking: IAdherenceTracking): string[] {
        const recommendations: string[] = [];

        if (tracking.overallAdherenceScore < 70) {
            recommendations.push('Consider medication adherence counseling');
            recommendations.push('Evaluate barriers to adherence');
        }

        if (tracking.medicationsAtRisk.length > 0) {
            recommendations.push('Focus on high-risk medications');
            recommendations.push('Consider dose simplification or alternative formulations');
        }

        if (tracking.activeAlerts.length > 2) {
            recommendations.push('Implement intensive monitoring program');
            recommendations.push('Consider medication synchronization');
        }

        const missedRefills = tracking.alerts.filter(a => a.type === 'missed_refill' && !a.resolved);
        if (missedRefills.length > 0) {
            recommendations.push('Set up automated refill reminders');
            recommendations.push('Consider 90-day supplies where appropriate');
        }

        return recommendations;
    }

    private identifyMedicationIssues(medication: IMedicationAdherence): string[] {
        const issues: string[] = [];

        if (medication.adherenceScore < 70) {
            issues.push('Low adherence score');
        }

        if (medication.expectedRefillDate && medication.expectedRefillDate < new Date()) {
            issues.push('Overdue refill');
        }

        if (medication.refillHistory.length >= 2) {
            const gaps = this.calculateRefillGaps(medication);
            if (gaps.some(gap => gap > 3)) {
                issues.push('Therapy gaps detected');
            }
        }

        if (medication.missedDoses && medication.totalDoses &&
            (medication.missedDoses / medication.totalDoses) > 0.2) {
            issues.push('Frequent missed doses');
        }

        return issues;
    }

    private analyzeRefillPattern(medication: IMedicationAdherence): string {
        if (medication.refillHistory.length < 2) {
            return 'Insufficient data';
        }

        const gaps = this.calculateRefillGaps(medication);
        const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

        if (avgGap <= 1) return 'Excellent';
        if (avgGap <= 3) return 'Good';
        if (avgGap <= 7) return 'Fair';
        return 'Poor';
    }

    private calculateRefillGaps(medication: IMedicationAdherence): number[] {
        const refills = medication.refillHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
        const gaps: number[] = [];

        for (let i = 1; i < refills.length; i++) {
            const currentRefill = refills[i];
            const previousRefill = refills[i - 1];

            if (currentRefill && previousRefill) {
                const daysBetween = Math.floor(
                    (currentRefill.date.getTime() - previousRefill.date.getTime()) / (1000 * 60 * 60 * 24)
                );
                const expectedDays = previousRefill.daysSupply || 30;
                gaps.push(Math.max(0, daysBetween - expectedDays));
            }
        }

        return gaps;
    }

    private calculateAdherenceImprovement(
        tracking: IAdherenceTracking,
        reportPeriod: { start: Date; end: Date }
    ): boolean {
        // This would need historical adherence data to calculate improvement
        // For now, return true if current adherence is good and there are interventions
        return tracking.overallAdherenceScore >= 80 &&
            tracking.interventions.some(i => i.implementedAt >= reportPeriod.start);
    }
}

export const adherenceService = new AdherenceService();
export default adherenceService;