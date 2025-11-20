import mongoose from 'mongoose';
import ClinicalNote, { IClinicalNote } from '../../../models/ClinicalNote';
import MedicationTherapyReview, { IMedicationTherapyReview } from '../../../models/MedicationTherapyReview';
import DiagnosticRequest, { IDiagnosticRequest } from '../models/DiagnosticRequest';
import DiagnosticResult, { IDiagnosticResult } from '../models/DiagnosticResult';
import logger from '../../../utils/logger';

export interface DiagnosticIntegrationData {
    diagnosticRequestId: mongoose.Types.ObjectId;
    diagnosticResultId?: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    pharmacistId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;
}

export interface ClinicalNoteFromDiagnostic {
    title: string;
    content: {
        subjective?: string;
        objective?: string;
        assessment?: string;
        plan?: string;
    };
    type: 'consultation' | 'medication_review' | 'follow_up' | 'adverse_event' | 'other';
    priority: 'low' | 'medium' | 'high';
    followUpRequired: boolean;
    followUpDate?: Date;
    tags: string[];
    recommendations: string[];
}

export interface MTRIntegrationData {
    diagnosticData: {
        symptoms: string[];
        diagnoses: Array<{
            condition: string;
            probability: number;
            reasoning: string;
        }>;
        medicationSuggestions: Array<{
            drugName: string;
            dosage: string;
            frequency: string;
            reasoning: string;
        }>;
        redFlags: Array<{
            flag: string;
            severity: string;
            action: string;
        }>;
    };
    reviewReason: string;
    priority: 'routine' | 'urgent' | 'high_risk';
}

export class DiagnosticIntegrationService {
    /**
     * Create a clinical note from diagnostic results
     */
    async createClinicalNoteFromDiagnostic(
        integrationData: DiagnosticIntegrationData,
        noteData?: Partial<ClinicalNoteFromDiagnostic>
    ): Promise<IClinicalNote> {
        try {
            const diagnosticRequest = await DiagnosticRequest.findById(integrationData.diagnosticRequestId);
            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            let diagnosticResult: IDiagnosticResult | null = null;
            if (integrationData.diagnosticResultId) {
                diagnosticResult = await DiagnosticResult.findById(integrationData.diagnosticResultId);
            }

            // Build clinical note content from diagnostic data
            const clinicalNoteData = this.buildClinicalNoteFromDiagnostic(
                diagnosticRequest,
                diagnosticResult,
                noteData
            );

            const clinicalNote = new ClinicalNote({
                patient: integrationData.patientId,
                pharmacist: integrationData.pharmacistId,
                workplaceId: integrationData.workplaceId,
                locationId: integrationData.locationId,
                ...clinicalNoteData,
                createdBy: integrationData.pharmacistId,
                lastModifiedBy: integrationData.pharmacistId,
            });

            await clinicalNote.save();

            logger.info('Clinical note created from diagnostic', {
                diagnosticRequestId: integrationData.diagnosticRequestId,
                clinicalNoteId: clinicalNote._id,
                patientId: integrationData.patientId,
            });

            return clinicalNote;
        } catch (error) {
            logger.error('Error creating clinical note from diagnostic', {
                error: error instanceof Error ? error.message : 'Unknown error',
                integrationData,
            });
            throw error;
        }
    }

    /**
     * Add diagnostic data to existing MTR
     */
    async addDiagnosticDataToMTR(
        mtrId: mongoose.Types.ObjectId,
        integrationData: DiagnosticIntegrationData
    ): Promise<IMedicationTherapyReview> {
        try {
            const mtr = await MedicationTherapyReview.findById(mtrId);
            if (!mtr) {
                throw new Error('MTR not found');
            }

            const diagnosticRequest = await DiagnosticRequest.findById(integrationData.diagnosticRequestId);
            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            let diagnosticResult: IDiagnosticResult | null = null;
            if (integrationData.diagnosticResultId) {
                diagnosticResult = await DiagnosticResult.findById(integrationData.diagnosticResultId);
            }

            // Update MTR with diagnostic insights
            await this.enrichMTRWithDiagnosticData(mtr, diagnosticRequest, diagnosticResult);

            await mtr.save();

            logger.info('MTR enriched with diagnostic data', {
                mtrId,
                diagnosticRequestId: integrationData.diagnosticRequestId,
                patientId: integrationData.patientId,
            });

            return mtr;
        } catch (error) {
            logger.error('Error adding diagnostic data to MTR', {
                error: error instanceof Error ? error.message : 'Unknown error',
                mtrId,
                integrationData,
            });
            throw error;
        }
    }

    /**
     * Create new MTR from diagnostic results
     */
    async createMTRFromDiagnostic(
        integrationData: DiagnosticIntegrationData,
        mtrData?: Partial<MTRIntegrationData>
    ): Promise<IMedicationTherapyReview> {
        try {
            const diagnosticRequest = await DiagnosticRequest.findById(integrationData.diagnosticRequestId);
            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            let diagnosticResult: IDiagnosticResult | null = null;
            if (integrationData.diagnosticResultId) {
                diagnosticResult = await DiagnosticResult.findById(integrationData.diagnosticResultId);
            }

            // Build MTR data from diagnostic results
            const mtrReviewData = this.buildMTRFromDiagnostic(
                diagnosticRequest,
                diagnosticResult,
                mtrData
            );

            const mtr = new MedicationTherapyReview({
                workplaceId: integrationData.workplaceId,
                patientId: integrationData.patientId,
                pharmacistId: integrationData.pharmacistId,
                ...mtrReviewData,
                patientConsent: true, // Assuming consent from diagnostic process
                confidentialityAgreed: true,
                createdBy: integrationData.pharmacistId,
                updatedBy: integrationData.pharmacistId,
            });

            await mtr.save();

            logger.info('MTR created from diagnostic', {
                diagnosticRequestId: integrationData.diagnosticRequestId,
                mtrId: mtr._id,
                patientId: integrationData.patientId,
            });

            return mtr;
        } catch (error) {
            logger.error('Error creating MTR from diagnostic', {
                error: error instanceof Error ? error.message : 'Unknown error',
                integrationData,
            });
            throw error;
        }
    }

    /**
     * Get unified patient timeline with diagnostic events
     */
    async getUnifiedPatientTimeline(
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        options: {
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        } = {}
    ): Promise<Array<{
        type: 'diagnostic' | 'clinical_note' | 'mtr';
        id: mongoose.Types.ObjectId;
        date: Date;
        title: string;
        summary: string;
        priority?: string;
        status?: string;
        data: any;
    }>> {
        try {
            const { startDate, endDate, limit = 50 } = options;
            const dateFilter: any = {};

            if (startDate) dateFilter.$gte = startDate;
            if (endDate) dateFilter.$lte = endDate;

            const baseFilter = {
                workplaceId,
                ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
            };

            // Get diagnostic requests
            const diagnosticRequestsQuery = await DiagnosticRequest.find({
                ...baseFilter,
                patientId,
            }).sort({ createdAt: -1 }).limit(limit).exec();

            // Get clinical notes
            const clinicalNotesQuery = ClinicalNote.findActive({
                ...baseFilter,
                patient: patientId,
            }).sort({ createdAt: -1 }).limit(limit);

            // Get MTRs
            const mtrsQuery = MedicationTherapyReview.find({
                ...baseFilter,
                patientId,
                isDeleted: false,
            }).sort({ createdAt: -1 }).limit(limit);

            const [diagnosticRequests, clinicalNotes, mtrs] = await Promise.all([
                diagnosticRequestsQuery,
                clinicalNotesQuery.exec(),
                mtrsQuery.exec(),
            ]);

            // Combine and format timeline events
            const timelineEvents = [
                ...diagnosticRequests.map((req: IDiagnosticRequest) => ({
                    type: 'diagnostic' as const,
                    id: req._id,
                    date: req.createdAt,
                    title: `Diagnostic Assessment - ${req.clinicalContext?.chiefComplaint || 'General Assessment'}`,
                    summary: this.summarizeDiagnosticRequest(req),
                    priority: req.priority,
                    status: req.status,
                    data: req,
                })),
                ...clinicalNotes.map((note: IClinicalNote) => ({
                    type: 'clinical_note' as const,
                    id: note._id,
                    date: note.createdAt,
                    title: note.title,
                    summary: this.summarizeClinicalNote(note),
                    priority: note.priority,
                    data: note,
                })),
                ...mtrs.map((mtr: IMedicationTherapyReview) => ({
                    type: 'mtr' as const,
                    id: mtr._id,
                    date: mtr.createdAt,
                    title: `MTR - ${mtr.reviewNumber}`,
                    summary: this.summarizeMTR(mtr),
                    priority: mtr.priority,
                    status: mtr.status,
                    data: mtr,
                })),
            ];

            // Sort by date (most recent first) and limit
            return timelineEvents
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, limit);

        } catch (error) {
            logger.error('Error getting unified patient timeline', {
                error: error instanceof Error ? error.message : 'Unknown error',
                patientId,
                workplaceId,
            });
            throw error;
        }
    }

    /**
     * Cross-reference diagnostic data with existing clinical records
     */
    async crossReferenceWithExistingRecords(
        diagnosticRequestId: mongoose.Types.ObjectId
    ): Promise<{
        relatedClinicalNotes: IClinicalNote[];
        relatedMTRs: IMedicationTherapyReview[];
        correlations: Array<{
            type: 'medication_match' | 'symptom_match' | 'diagnosis_match';
            recordType: 'clinical_note' | 'mtr';
            recordId: mongoose.Types.ObjectId;
            correlation: string;
            confidence: number;
        }>;
    }> {
        try {
            const diagnosticRequest = await DiagnosticRequest.findById(diagnosticRequestId);
            if (!diagnosticRequest) {
                throw new Error('Diagnostic request not found');
            }

            const patientId = diagnosticRequest.patientId;
            const workplaceId = diagnosticRequest.workplaceId;

            // Get recent clinical notes for the patient
            const recentClinicalNotes = await ClinicalNote.findActive({
                patient: patientId,
                workplaceId,
                createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
            }).sort({ createdAt: -1 }).limit(10).exec();

            // Get recent MTRs for the patient
            const recentMTRs = await MedicationTherapyReview.find({
                patientId,
                workplaceId,
                isDeleted: false,
                createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
            }).sort({ createdAt: -1 }).limit(5).exec();

            // Find correlations
            const correlations = this.findCorrelations(
                diagnosticRequest,
                recentClinicalNotes,
                recentMTRs
            );

            return {
                relatedClinicalNotes: recentClinicalNotes,
                relatedMTRs: recentMTRs,
                correlations,
            };

        } catch (error) {
            logger.error('Error cross-referencing diagnostic data', {
                error: error instanceof Error ? error.message : 'Unknown error',
                diagnosticRequestId,
            });
            throw error;
        }
    }

    /**
     * Build clinical note content from diagnostic data
     */
    private buildClinicalNoteFromDiagnostic(
        diagnosticRequest: IDiagnosticRequest,
        diagnosticResult: IDiagnosticResult | null,
        noteData?: Partial<ClinicalNoteFromDiagnostic>
    ): ClinicalNoteFromDiagnostic {
        const symptoms = diagnosticRequest.inputSnapshot?.symptoms;
        const vitals = diagnosticRequest.inputSnapshot?.vitals;

        // Build SOAP note structure
        const subjective = [
            symptoms?.subjective?.join(', ') || '',
            symptoms?.duration ? `Duration: ${symptoms.duration}` : '',
            symptoms?.onset ? `Onset: ${symptoms.onset}` : '',
        ].filter(Boolean).join('. ');

        const objective = [
            symptoms?.objective?.join(', ') || '',
            vitals ? this.formatVitals(vitals) : '',
        ].filter(Boolean).join('. ');

        let assessment = '';
        let plan = '';
        let recommendations: string[] = [];
        let priority: 'low' | 'medium' | 'high' = 'medium';
        let followUpRequired = false;
        let followUpDate: Date | undefined;

        if (diagnosticResult) {
            // Build assessment from AI diagnoses
            assessment = diagnosticResult.diagnoses
                .map(d => `${d.condition} (${Math.round(d.probability * 100)}% confidence): ${d.reasoning}`)
                .join('. ');

            // Build plan from medication suggestions
            plan = diagnosticResult.medicationSuggestions
                .map(m => `${m.drugName} ${m.dosage} ${m.frequency}: ${m.reasoning}`)
                .join('. ');

            // Extract recommendations
            recommendations = [
                ...diagnosticResult.medicationSuggestions.map(m => `Consider ${m.drugName} ${m.dosage} ${m.frequency}`),
                ...diagnosticResult.suggestedTests?.map(t => `Order ${t.testName} (${t.priority})`) || [],
            ];

            // Determine priority from red flags
            const hasCriticalFlags = diagnosticResult.redFlags.some(f => f.severity === 'critical');
            const hasHighFlags = diagnosticResult.redFlags.some(f => f.severity === 'high');

            if (hasCriticalFlags) priority = 'high';
            else if (hasHighFlags) priority = 'medium';
            else priority = 'low';

            // Set follow-up based on referral recommendations
            if (diagnosticResult.referralRecommendation?.recommended) {
                followUpRequired = true;
                const urgency = diagnosticResult.referralRecommendation.urgency;
                if (urgency === 'immediate') {
                    followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
                } else if (urgency === 'within_24h') {
                    followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
                } else {
                    followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
                }
            }
        }

        return {
            title: noteData?.title || `Diagnostic Assessment - ${symptoms?.subjective?.[0] || 'General'}`,
            content: {
                subjective: noteData?.content?.subjective || subjective,
                objective: noteData?.content?.objective || objective,
                assessment: noteData?.content?.assessment || assessment,
                plan: noteData?.content?.plan || plan,
            },
            type: noteData?.type || 'consultation',
            priority: noteData?.priority || priority,
            followUpRequired: noteData?.followUpRequired ?? followUpRequired,
            followUpDate: noteData?.followUpDate || followUpDate,
            tags: noteData?.tags || ['diagnostic', 'ai-assisted'],
            recommendations: noteData?.recommendations || recommendations,
        };
    }

    /**
     * Build MTR data from diagnostic results
     */
    private buildMTRFromDiagnostic(
        diagnosticRequest: IDiagnosticRequest,
        diagnosticResult: IDiagnosticResult | null,
        mtrData?: Partial<MTRIntegrationData>
    ): Partial<IMedicationTherapyReview> {
        let priority: 'routine' | 'urgent' | 'high_risk' = 'routine';
        let reviewReason = 'Diagnostic assessment indicated medication review';

        if (diagnosticResult) {
            // Determine priority from red flags and medication suggestions
            const hasCriticalFlags = diagnosticResult.redFlags.some(f => f.severity === 'critical');
            const hasHighFlags = diagnosticResult.redFlags.some(f => f.severity === 'high');
            const hasMedicationSuggestions = diagnosticResult.medicationSuggestions.length > 0;

            if (hasCriticalFlags) priority = 'high_risk';
            else if (hasHighFlags || hasMedicationSuggestions) priority = 'urgent';

            reviewReason = `Diagnostic assessment revealed: ${diagnosticResult.diagnoses.map(d => d.condition).join(', ')}`;
        }

        return {
            reviewType: 'targeted',
            priority: mtrData?.priority || priority,
            reviewReason: mtrData?.reviewReason || reviewReason,
            // Initialize with patient selection step completed since we have diagnostic data
            steps: {
                patientSelection: {
                    completed: true,
                    completedAt: new Date(),
                    data: {
                        source: 'diagnostic_assessment',
                        diagnosticRequestId: diagnosticRequest._id,
                    },
                },
                medicationHistory: { completed: false },
                therapyAssessment: { completed: false },
                planDevelopment: { completed: false },
                interventions: { completed: false },
                followUp: { completed: false },
            },
        };
    }

    /**
     * Enrich existing MTR with diagnostic data
     */
    private async enrichMTRWithDiagnosticData(
        mtr: IMedicationTherapyReview,
        diagnosticRequest: IDiagnosticRequest,
        diagnosticResult: IDiagnosticResult | null
    ): Promise<void> {
        // Add diagnostic context to review reason
        if (diagnosticResult) {
            const diagnosticFindings = diagnosticResult.diagnoses.map(d => d.condition).join(', ');
            mtr.reviewReason = `${mtr.reviewReason || 'MTR'}. Diagnostic findings: ${diagnosticFindings}`;
        }

        // Update therapy assessment step with diagnostic data
        if (diagnosticResult && !mtr.steps.therapyAssessment.completed) {
            mtr.steps.therapyAssessment.data = {
                ...mtr.steps.therapyAssessment.data,
                diagnosticFindings: {
                    diagnoses: diagnosticResult.diagnoses,
                    redFlags: diagnosticResult.redFlags,
                    medicationSuggestions: diagnosticResult.medicationSuggestions,
                    source: 'ai_diagnostic_assessment',
                    requestId: diagnosticRequest._id,
                },
            };
        }

        // Adjust priority if diagnostic results indicate higher risk
        if (diagnosticResult) {
            const hasCriticalFlags = diagnosticResult.redFlags.some(f => f.severity === 'critical');
            if (hasCriticalFlags && mtr.priority !== 'high_risk') {
                mtr.priority = 'high_risk';
            }
        }
    }

    /**
     * Format vital signs for clinical note
     */
    private formatVitals(vitals: any): string {
        const vitalStrings: string[] = [];

        if (vitals.bloodPressure) {
            vitalStrings.push(`BP: ${vitals.bloodPressure}`);
        }
        if (vitals.heartRate) {
            vitalStrings.push(`HR: ${vitals.heartRate} bpm`);
        }
        if (vitals.temperature) {
            vitalStrings.push(`Temp: ${vitals.temperature}°C`);
        }
        if (vitals.bloodGlucose) {
            vitalStrings.push(`BG: ${vitals.bloodGlucose} mg/dL`);
        }
        if (vitals.respiratoryRate) {
            vitalStrings.push(`RR: ${vitals.respiratoryRate}/min`);
        }

        return vitalStrings.join(', ');
    }

    /**
     * Summarize diagnostic request for timeline
     */
    private summarizeDiagnosticRequest(request: IDiagnosticRequest): string {
        const symptoms = request.inputSnapshot?.symptoms?.subjective?.slice(0, 2).join(', ') || 'Assessment';
        return `${symptoms}. Status: ${request.status}`;
    }

    /**
     * Summarize clinical note for timeline
     */
    private summarizeClinicalNote(note: IClinicalNote): string {
        const assessment = note.content?.assessment?.substring(0, 100) || '';
        return assessment + (assessment.length === 100 ? '...' : '');
    }

    /**
     * Summarize MTR for timeline
     */
    private summarizeMTR(mtr: IMedicationTherapyReview): string {
        const completion = mtr.getCompletionPercentage();
        const medicationCount = mtr.medications?.length || 0;
        return `${medicationCount} medications reviewed. ${completion}% complete.`;
    }

    /**
     * Find correlations between diagnostic data and existing records
     */
    private findCorrelations(
        diagnosticRequest: IDiagnosticRequest,
        clinicalNotes: IClinicalNote[],
        mtrs: IMedicationTherapyReview[]
    ): Array<{
        type: 'medication_match' | 'symptom_match' | 'diagnosis_match';
        recordType: 'clinical_note' | 'mtr';
        recordId: mongoose.Types.ObjectId;
        correlation: string;
        confidence: number;
    }> {
        const correlations: Array<{
            type: 'medication_match' | 'symptom_match' | 'diagnosis_match';
            recordType: 'clinical_note' | 'mtr';
            recordId: mongoose.Types.ObjectId;
            correlation: string;
            confidence: number;
        }> = [];

        const diagnosticSymptoms = diagnosticRequest.inputSnapshot?.symptoms?.subjective || [];
        const diagnosticMedications = diagnosticRequest.inputSnapshot?.currentMedications || [];

        // Check clinical notes for correlations
        clinicalNotes.forEach(note => {
            // Symptom correlations
            const noteContent = [
                note.content?.subjective || '',
                note.content?.objective || '',
                note.content?.assessment || '',
            ].join(' ').toLowerCase();

            diagnosticSymptoms.forEach(symptom => {
                if (noteContent.includes(symptom.toLowerCase())) {
                    correlations.push({
                        type: 'symptom_match',
                        recordType: 'clinical_note',
                        recordId: note._id,
                        correlation: `Symptom "${symptom}" mentioned in previous note`,
                        confidence: 0.8,
                    });
                }
            });
        });

        // Check MTRs for medication correlations
        mtrs.forEach(mtr => {
            diagnosticMedications.forEach(diagMed => {
                const matchingMedication = mtr.medications?.find(mtrMed =>
                    mtrMed.drugName.toLowerCase().includes(diagMed.name.toLowerCase()) ||
                    diagMed.name.toLowerCase().includes(mtrMed.drugName.toLowerCase())
                );

                if (matchingMedication) {
                    correlations.push({
                        type: 'medication_match',
                        recordType: 'mtr',
                        recordId: mtr._id,
                        correlation: `Medication "${diagMed.name}" was reviewed in previous MTR`,
                        confidence: 0.9,
                    });
                }
            });
        });

        return correlations;
    }
}

export default new DiagnosticIntegrationService();