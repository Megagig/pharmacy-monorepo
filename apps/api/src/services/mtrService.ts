import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import models
import MedicationTherapyReview, { IMedicationTherapyReview, IMTRMedicationEntry } from '../models/MedicationTherapyReview';
import DrugTherapyProblem, { IDrugTherapyProblem } from '../models/DrugTherapyProblem';
import MTRIntervention from '../models/MTRIntervention';
import MTRFollowUp from '../models/MTRFollowUp';
import Patient from '../models/Patient';

// Import utilities
import {
    PatientManagementError,
    createValidationError,
    createBusinessRuleError,
    createNotFoundError
} from '../utils/responseHelpers';

/**
 * MTR Service Layer
 * Handles business logic for Medication Therapy Review workflow
 */

// ===============================
// INTERFACES AND TYPES
// ===============================

export interface MTRWorkflowStep {
    name: string;
    title: string;
    description: string;
    required: boolean;
    dependencies: string[];
    validationRules: string[];
}

export interface StepValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    canProceed: boolean;
}

export interface DrugInteractionResult {
    hasInteractions: boolean;
    interactions: DrugInteraction[];
    duplicateTherapies: DuplicateTherapy[];
    contraindications: Contraindication[];
    severity: 'critical' | 'major' | 'moderate' | 'minor' | 'none';
}

export interface DrugInteraction {
    drug1: string;
    drug2: string;
    severity: 'critical' | 'major' | 'moderate' | 'minor';
    mechanism: string;
    clinicalEffect: string;
    management: string;
    references: string[];
}

export interface DuplicateTherapy {
    medications: string[];
    therapeuticClass: string;
    reason: string;
    recommendation: string;
}

export interface Contraindication {
    medication: string;
    condition: string;
    severity: 'absolute' | 'relative';
    reason: string;
    alternatives: string[];
}

export interface AuditLogEntry {
    action: string;
    resourceType: string;
    resourceId: string;
    userId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    timestamp: Date;
    details: any;
    ipAddress?: string;
    userAgent?: string;
}

// ===============================
// MTR WORKFLOW MANAGEMENT
// ===============================

class MTRWorkflowService {
    private static readonly WORKFLOW_STEPS: MTRWorkflowStep[] = [
        {
            name: 'patientSelection',
            title: 'Patient Selection',
            description: 'Select and verify patient for MTR',
            required: true,
            dependencies: [],
            validationRules: ['patientExists', 'patientConsent', 'confidentialityAgreed']
        },
        {
            name: 'medicationHistory',
            title: 'Medication History Collection',
            description: 'Collect comprehensive medication history',
            required: true,
            dependencies: ['patientSelection'],
            validationRules: ['hasMedications', 'medicationDetailsComplete']
        },
        {
            name: 'therapyAssessment',
            title: 'Therapy Assessment',
            description: 'Assess therapy for drug-related problems',
            required: true,
            dependencies: ['medicationHistory'],
            validationRules: ['interactionsChecked', 'problemsIdentified']
        },
        {
            name: 'planDevelopment',
            title: 'Plan Development',
            description: 'Develop therapy optimization plan',
            required: true,
            dependencies: ['therapyAssessment'],
            validationRules: ['planCreated', 'recommendationsProvided']
        },
        {
            name: 'interventions',
            title: 'Interventions & Documentation',
            description: 'Record interventions and outcomes',
            required: true,
            dependencies: ['planDevelopment'],
            validationRules: ['interventionsRecorded']
        },
        {
            name: 'followUp',
            title: 'Follow-Up & Monitoring',
            description: 'Schedule follow-up and monitoring',
            required: false,
            dependencies: ['interventions'],
            validationRules: ['followUpScheduled']
        }
    ];

    /**
     * Get workflow steps configuration
     */
    static getWorkflowSteps(): MTRWorkflowStep[] {
        return this.WORKFLOW_STEPS;
    }

    /**
     * Get next step in workflow
     */
    static getNextStep(currentSteps: any): string | null {
        for (const step of this.WORKFLOW_STEPS) {
            if (!currentSteps[step.name]?.completed) {
                return step.name;
            }
        }
        return null;
    }

    /**
     * Validate step completion
     */
    static async validateStep(
        stepName: string,
        session: IMedicationTherapyReview,
        data?: any
    ): Promise<StepValidationResult> {
        const step = this.WORKFLOW_STEPS.find(s => s.name === stepName);
        if (!step) {
            return {
                isValid: false,
                errors: [`Invalid step name: ${stepName}`],
                warnings: [],
                canProceed: false
            };
        }

        const result: StepValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            canProceed: true
        };

        // Check dependencies
        for (const dependency of step.dependencies) {
            if (!session.steps[dependency as keyof typeof session.steps]?.completed) {
                result.errors.push(`Dependency not met: ${dependency} must be completed first`);
                result.isValid = false;
                result.canProceed = false;
            }
        }

        // Apply step-specific validation rules
        switch (stepName) {
            case 'patientSelection':
                await this.validatePatientSelection(session, result);
                break;
            case 'medicationHistory':
                await this.validateMedicationHistory(session, result);
                break;
            case 'therapyAssessment':
                await this.validateTherapyAssessment(session, result);
                break;
            case 'planDevelopment':
                await this.validatePlanDevelopment(session, result);
                break;
            case 'interventions':
                await this.validateInterventions(session, result);
                break;
            case 'followUp':
                await this.validateFollowUp(session, result);
                break;
        }

        return result;
    }

    /**
     * Validate patient selection step
     */
    private static async validatePatientSelection(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        // Check patient exists
        const patient = await Patient.findById(session.patientId);
        if (!patient) {
            result.errors.push('Patient not found');
            result.isValid = false;
            result.canProceed = false;
        }

        // Check consent
        if (!session.patientConsent) {
            result.errors.push('Patient consent is required');
            result.isValid = false;
            result.canProceed = false;
        }

        // Check confidentiality agreement
        if (!session.confidentialityAgreed) {
            result.errors.push('Confidentiality agreement is required');
            result.isValid = false;
            result.canProceed = false;
        }

        // Check for active MTR sessions
        const activeSessions = await MedicationTherapyReview.countDocuments({
            patientId: session.patientId,
            status: { $in: ['in_progress', 'on_hold'] },
            _id: { $ne: session._id }
        });

        if (activeSessions > 0) {
            result.warnings.push('Patient has other active MTR sessions');
        }
    }

    /**
     * Validate medication history step
     */
    private static async validateMedicationHistory(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        if (!session.medications || session.medications.length === 0) {
            result.errors.push('At least one medication must be recorded');
            result.isValid = false;
            result.canProceed = false;
        }

        // Validate medication entries
        for (const [index, medication] of session.medications.entries()) {
            if (!medication.drugName?.trim()) {
                result.errors.push(`Medication ${index + 1}: Drug name is required`);
                result.isValid = false;
            }

            if (!medication.indication?.trim()) {
                result.errors.push(`Medication ${index + 1}: Indication is required`);
                result.isValid = false;
            }

            if (!medication.instructions?.dose?.trim()) {
                result.errors.push(`Medication ${index + 1}: Dose is required`);
                result.isValid = false;
            }

            if (!medication.instructions?.frequency?.trim()) {
                result.errors.push(`Medication ${index + 1}: Frequency is required`);
                result.isValid = false;
            }
        }

        // Check for potential duplicates
        const drugNames = session.medications.map(m => m.drugName.toLowerCase());
        const duplicates = drugNames.filter((name, index) => drugNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            result.warnings.push(`Potential duplicate medications detected: ${duplicates.join(', ')}`);
        }
    }

    /**
     * Validate therapy assessment step
     */
    private static async validateTherapyAssessment(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        // Check if drug interactions have been assessed
        if (!session.steps.therapyAssessment?.data?.interactionsChecked) {
            result.warnings.push('Drug interactions should be checked');
        }

        // Check if problems have been identified or explicitly noted as none
        const problemCount = await DrugTherapyProblem.countDocuments({
            reviewId: session._id,
            isDeleted: { $ne: true }
        });

        if (problemCount === 0 && !session.steps.therapyAssessment?.data?.noProblemsConfirmed) {
            result.warnings.push('No drug therapy problems identified - please confirm this is correct');
        }
    }

    /**
     * Validate plan development step
     */
    private static async validatePlanDevelopment(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        if (!session.plan) {
            result.errors.push('Therapy plan must be created');
            result.isValid = false;
            result.canProceed = false;
            return;
        }

        // Check if plan addresses identified problems
        const problemCount = await DrugTherapyProblem.countDocuments({
            reviewId: session._id,
            isDeleted: { $ne: true }
        });

        if (problemCount > 0 && (!session.plan.recommendations || session.plan.recommendations.length === 0)) {
            result.errors.push('Plan must include recommendations for identified problems');
            result.isValid = false;
        }

        // Validate recommendations
        if (session.plan.recommendations) {
            for (const [index, recommendation] of session.plan.recommendations.entries()) {
                if (!recommendation.rationale?.trim()) {
                    result.errors.push(`Recommendation ${index + 1}: Rationale is required`);
                    result.isValid = false;
                }

                if (!recommendation.expectedOutcome?.trim()) {
                    result.errors.push(`Recommendation ${index + 1}: Expected outcome is required`);
                    result.isValid = false;
                }
            }
        }
    }

    /**
     * Validate interventions step
     */
    private static async validateInterventions(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        const interventionCount = await MTRIntervention.countDocuments({
            reviewId: session._id,
            isDeleted: { $ne: true }
        });

        if (interventionCount === 0 && session.plan?.recommendations && session.plan.recommendations.length > 0) {
            result.warnings.push('No interventions recorded for therapy plan recommendations');
        }
    }

    /**
     * Validate follow-up step
     */
    private static async validateFollowUp(
        session: IMedicationTherapyReview,
        result: StepValidationResult
    ): Promise<void> {
        const followUpCount = await MTRFollowUp.countDocuments({
            reviewId: session._id,
            isDeleted: { $ne: true }
        });

        const interventionCount = await MTRIntervention.countDocuments({
            reviewId: session._id,
            followUpRequired: true,
            isDeleted: { $ne: true }
        });

        if (interventionCount > 0 && followUpCount === 0) {
            result.warnings.push('Some interventions require follow-up but none scheduled');
        }
    }

    /**
     * Check if workflow can be completed
     */
    static async canCompleteWorkflow(session: IMedicationTherapyReview): Promise<StepValidationResult> {
        const result: StepValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            canProceed: true
        };

        // Check all required steps are completed
        for (const step of this.WORKFLOW_STEPS) {
            if (step.required && !session.steps[step.name as keyof typeof session.steps]?.completed) {
                result.errors.push(`Required step not completed: ${step.title}`);
                result.isValid = false;
                result.canProceed = false;
            }
        }

        // Additional completion validations
        if (!session.plan) {
            result.errors.push('Therapy plan is required for completion');
            result.isValid = false;
            result.canProceed = false;
        }

        return result;
    }
}

// ===============================
// DRUG INTERACTION CHECKING SERVICE
// ===============================

class DrugInteractionService {
    /**
     * Check for drug interactions, duplicates, and contraindications
     * This is a placeholder implementation with mock data
     * In production, this would integrate with drug databases like First Databank or Lexicomp
     */
    static async checkInteractions(medications: IMTRMedicationEntry[]): Promise<DrugInteractionResult> {
        const result: DrugInteractionResult = {
            hasInteractions: false,
            interactions: [],
            duplicateTherapies: [],
            contraindications: [],
            severity: 'none'
        };

        if (!medications || medications.length < 2) {
            return result;
        }

        // Mock drug interaction data
        const mockInteractions = await this.getMockInteractions();
        const mockDuplicates = await this.getMockDuplicateTherapies();
        const mockContraindications = await this.getMockContraindications();

        // Check for interactions
        for (let i = 0; i < medications.length; i++) {
            for (let j = i + 1; j < medications.length; j++) {
                const drug1 = medications[i]?.drugName?.toLowerCase();
                const drug2 = medications[j]?.drugName?.toLowerCase();

                if (!drug1 || !drug2) continue;

                // Check interactions
                const interaction = mockInteractions.find(
                    int => (int.drug1.toLowerCase() === drug1 && int.drug2.toLowerCase() === drug2) ||
                        (int.drug1.toLowerCase() === drug2 && int.drug2.toLowerCase() === drug1)
                );

                if (interaction) {
                    result.interactions.push(interaction);
                    result.hasInteractions = true;
                }
            }
        }

        // Check for duplicate therapies
        const drugClasses = this.groupMedicationsByClass(medications);
        for (const [therapeuticClass, drugs] of Object.entries(drugClasses)) {
            if (drugs.length > 1) {
                const duplicate = mockDuplicates.find(
                    dup => dup.therapeuticClass.toLowerCase() === therapeuticClass.toLowerCase()
                );

                if (duplicate) {
                    result.duplicateTherapies.push({
                        ...duplicate,
                        medications: drugs.map(d => d.drugName)
                    });
                    result.hasInteractions = true;
                }
            }
        }

        // Check for contraindications (would require patient conditions)
        // This is a simplified check - in reality would need patient's medical conditions
        for (const medication of medications) {
            const contraindication = mockContraindications.find(
                contra => contra.medication.toLowerCase() === medication.drugName.toLowerCase()
            );

            if (contraindication) {
                result.contraindications.push(contraindication);
                result.hasInteractions = true;
            }
        }

        // Determine overall severity
        result.severity = this.calculateOverallSeverity(result);

        return result;
    }

    /**
     * Get mock interaction data
     * In production, this would query a drug interaction database
     */
    private static async getMockInteractions(): Promise<DrugInteraction[]> {
        return [
            {
                drug1: 'Warfarin',
                drug2: 'Aspirin',
                severity: 'major',
                mechanism: 'Additive anticoagulant effects',
                clinicalEffect: 'Increased risk of bleeding',
                management: 'Monitor INR closely, consider dose adjustment',
                references: ['Lexicomp Drug Interactions']
            },
            {
                drug1: 'Metformin',
                drug2: 'Contrast Media',
                severity: 'major',
                mechanism: 'Increased risk of lactic acidosis',
                clinicalEffect: 'Potential kidney damage and lactic acidosis',
                management: 'Discontinue metformin 48 hours before contrast procedure',
                references: ['FDA Drug Safety Communication']
            },
            {
                drug1: 'Simvastatin',
                drug2: 'Clarithromycin',
                severity: 'major',
                mechanism: 'CYP3A4 inhibition',
                clinicalEffect: 'Increased risk of myopathy and rhabdomyolysis',
                management: 'Avoid combination or reduce simvastatin dose',
                references: ['Product Labeling']
            },
            {
                drug1: 'Digoxin',
                drug2: 'Furosemide',
                severity: 'moderate',
                mechanism: 'Hypokalemia increases digoxin toxicity',
                clinicalEffect: 'Increased risk of digoxin toxicity',
                management: 'Monitor potassium levels and digoxin levels',
                references: ['Clinical Pharmacology']
            },
            {
                drug1: 'ACE Inhibitor',
                drug2: 'Potassium Supplement',
                severity: 'moderate',
                mechanism: 'Additive hyperkalemic effects',
                clinicalEffect: 'Risk of hyperkalemia',
                management: 'Monitor serum potassium regularly',
                references: ['Drug Interaction Database']
            }
        ];
    }

    /**
     * Get mock duplicate therapy data
     */
    private static async getMockDuplicateTherapies(): Promise<DuplicateTherapy[]> {
        return [
            {
                medications: [],
                therapeuticClass: 'ACE Inhibitors',
                reason: 'Multiple ACE inhibitors prescribed',
                recommendation: 'Use single ACE inhibitor, discontinue duplicates'
            },
            {
                medications: [],
                therapeuticClass: 'Proton Pump Inhibitors',
                reason: 'Multiple PPIs prescribed',
                recommendation: 'Consolidate to single PPI therapy'
            },
            {
                medications: [],
                therapeuticClass: 'Statins',
                reason: 'Multiple statin medications',
                recommendation: 'Use single statin, adjust dose as needed'
            },
            {
                medications: [],
                therapeuticClass: 'Beta Blockers',
                reason: 'Multiple beta blockers prescribed',
                recommendation: 'Consolidate to single beta blocker therapy'
            }
        ];
    }

    /**
     * Get mock contraindication data
     */
    private static async getMockContraindications(): Promise<Contraindication[]> {
        return [
            {
                medication: 'Metformin',
                condition: 'Severe kidney disease (eGFR < 30)',
                severity: 'absolute',
                reason: 'Risk of lactic acidosis',
                alternatives: ['Insulin', 'DPP-4 inhibitors', 'SGLT-2 inhibitors']
            },
            {
                medication: 'NSAIDs',
                condition: 'Heart failure',
                severity: 'relative',
                reason: 'May worsen heart failure and kidney function',
                alternatives: ['Acetaminophen', 'Topical analgesics']
            },
            {
                medication: 'Beta Blockers',
                condition: 'Severe asthma',
                severity: 'absolute',
                reason: 'May cause bronchospasm',
                alternatives: ['Calcium channel blockers', 'ACE inhibitors']
            }
        ];
    }

    /**
     * Group medications by therapeutic class
     * Simplified implementation - in production would use drug classification database
     */
    private static groupMedicationsByClass(medications: IMTRMedicationEntry[]): Record<string, IMTRMedicationEntry[]> {
        const classes: Record<string, IMTRMedicationEntry[]> = {};

        // Mock therapeutic class mapping
        const classMapping: Record<string, string> = {
            'lisinopril': 'ACE Inhibitors',
            'enalapril': 'ACE Inhibitors',
            'captopril': 'ACE Inhibitors',
            'omeprazole': 'Proton Pump Inhibitors',
            'lansoprazole': 'Proton Pump Inhibitors',
            'pantoprazole': 'Proton Pump Inhibitors',
            'simvastatin': 'Statins',
            'atorvastatin': 'Statins',
            'rosuvastatin': 'Statins',
            'metoprolol': 'Beta Blockers',
            'propranolol': 'Beta Blockers',
            'atenolol': 'Beta Blockers'
        };

        for (const medication of medications) {
            const drugName = medication.drugName.toLowerCase();
            const therapeuticClass = classMapping[drugName] || 'Other';

            if (!classes[therapeuticClass]) {
                classes[therapeuticClass] = [];
            }
            classes[therapeuticClass].push(medication);
        }

        return classes;
    }

    /**
     * Calculate overall severity from all interactions
     */
    private static calculateOverallSeverity(result: DrugInteractionResult): 'critical' | 'major' | 'moderate' | 'minor' | 'none' {
        if (!result.hasInteractions) return 'none';

        const severities = [
            ...result.interactions.map(i => i.severity),
            ...result.contraindications.map(c => c.severity === 'absolute' ? 'critical' : 'major')
        ];

        if (severities.includes('critical')) return 'critical';
        if (severities.includes('major')) return 'major';
        if (severities.includes('moderate')) return 'moderate';
        return 'minor';
    }

    /**
     * Generate drug therapy problems from interaction results
     */
    static async generateProblemsFromInteractions(
        interactions: DrugInteractionResult,
        reviewId: mongoose.Types.ObjectId,
        patientId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        identifiedBy: mongoose.Types.ObjectId
    ): Promise<IDrugTherapyProblem[]> {
        const problems: IDrugTherapyProblem[] = [];

        // Create problems for drug interactions
        for (const interaction of interactions.interactions) {
            const problem = new DrugTherapyProblem({
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                subcategory: 'Drug Interaction',
                type: 'interaction',
                severity: interaction.severity,
                description: `Drug interaction between ${interaction.drug1} and ${interaction.drug2}: ${interaction.clinicalEffect}`,
                clinicalSignificance: `${interaction.mechanism}. ${interaction.management}`,
                affectedMedications: [interaction.drug1, interaction.drug2],
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            });

            problems.push(problem);
        }

        // Create problems for duplicate therapies
        for (const duplicate of interactions.duplicateTherapies) {
            const problem = new DrugTherapyProblem({
                workplaceId,
                patientId,
                reviewId,
                category: 'indication',
                subcategory: 'Duplicate Therapy',
                type: 'duplication',
                severity: 'moderate',
                description: `Duplicate therapy in ${duplicate.therapeuticClass}: ${duplicate.reason}`,
                clinicalSignificance: duplicate.recommendation,
                affectedMedications: duplicate.medications,
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            });

            problems.push(problem);
        }

        // Create problems for contraindications
        for (const contraindication of interactions.contraindications) {
            const problem = new DrugTherapyProblem({
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                subcategory: 'Contraindication',
                type: 'contraindication',
                severity: contraindication.severity === 'absolute' ? 'critical' : 'major',
                description: `Contraindication: ${contraindication.medication} in patient with ${contraindication.condition}`,
                clinicalSignificance: `${contraindication.reason}. Consider alternatives: ${contraindication.alternatives.join(', ')}`,
                affectedMedications: [contraindication.medication],
                relatedConditions: [contraindication.condition],
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            });

            problems.push(problem);
        }

        return problems;
    }
}

// ===============================
// AUDIT LOGGING SERVICE
// ===============================

class MTRAuditService {
    private static auditLogs: AuditLogEntry[] = [];

    /**
     * Log MTR activity for compliance tracking
     */
    static async logActivity(
        action: string,
        resourceType: string,
        resourceId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        details: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const auditEntry: AuditLogEntry = {
            action,
            resourceType,
            resourceId,
            userId,
            workplaceId,
            timestamp: new Date(),
            details,
            ipAddress,
            userAgent
        };

        // Store in memory (in production, this would be stored in database)
        this.auditLogs.push(auditEntry);

        // Log to winston logger for file storage
        logger.info('MTR Audit Log', {
            ...auditEntry,
            service: 'mtr-audit'
        });

        // In production, you might also:
        // 1. Store in dedicated audit database/collection
        // 2. Send to external audit service
        // 3. Trigger compliance notifications
    }

    /**
     * Get audit logs with filtering
     */
    static async getAuditLogs(
        workplaceId?: mongoose.Types.ObjectId,
        userId?: mongoose.Types.ObjectId,
        resourceType?: string,
        action?: string,
        startDate?: Date,
        endDate?: Date,
        limit: number = 100
    ): Promise<AuditLogEntry[]> {
        let filteredLogs = [...this.auditLogs];

        // Apply filters
        if (workplaceId) {
            filteredLogs = filteredLogs.filter(log => log.workplaceId.equals(workplaceId));
        }

        if (userId) {
            filteredLogs = filteredLogs.filter(log => log.userId.equals(userId));
        }

        if (resourceType) {
            filteredLogs = filteredLogs.filter(log => log.resourceType === resourceType);
        }

        if (action) {
            filteredLogs = filteredLogs.filter(log => log.action === action);
        }

        if (startDate) {
            filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
        }

        if (endDate) {
            filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
        }

        // Sort by timestamp (newest first) and limit
        return filteredLogs
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Log MTR session creation
     */
    static async logSessionCreation(
        sessionId: string,
        patientId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        sessionData: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            'MTR_SESSION_CREATED',
            'MedicationTherapyReview',
            sessionId,
            userId,
            workplaceId,
            {
                patientId,
                reviewType: sessionData.reviewType,
                priority: sessionData.priority,
                reviewNumber: sessionData.reviewNumber
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log step completion
     */
    static async logStepCompletion(
        sessionId: string,
        stepName: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        stepData: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            'MTR_STEP_COMPLETED',
            'MedicationTherapyReview',
            sessionId,
            userId,
            workplaceId,
            {
                stepName,
                stepData,
                completedAt: new Date()
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log problem identification
     */
    static async logProblemIdentification(
        problemId: string,
        sessionId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        problemData: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            'DTP_IDENTIFIED',
            'DrugTherapyProblem',
            problemId,
            userId,
            workplaceId,
            {
                sessionId,
                type: problemData.type,
                severity: problemData.severity,
                category: problemData.category,
                affectedMedications: problemData.affectedMedications
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log intervention recording
     */
    static async logInterventionRecording(
        interventionId: string,
        sessionId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        interventionData: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            'MTR_INTERVENTION_RECORDED',
            'MTRIntervention',
            interventionId,
            userId,
            workplaceId,
            {
                sessionId,
                type: interventionData.type,
                category: interventionData.category,
                targetAudience: interventionData.targetAudience,
                communicationMethod: interventionData.communicationMethod
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log session completion
     */
    static async logSessionCompletion(
        sessionId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        completionData: any,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            'MTR_SESSION_COMPLETED',
            'MedicationTherapyReview',
            sessionId,
            userId,
            workplaceId,
            {
                completedAt: new Date(),
                duration: completionData.duration,
                problemsIdentified: completionData.problemsIdentified,
                interventionsRecorded: completionData.interventionsRecorded,
                followUpsScheduled: completionData.followUpsScheduled
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log data access for compliance
     */
    static async logDataAccess(
        resourceType: string,
        resourceId: string,
        userId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        accessType: 'VIEW' | 'EDIT' | 'DELETE' | 'EXPORT',
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await this.logActivity(
            `DATA_${accessType}`,
            resourceType,
            resourceId,
            userId,
            workplaceId,
            {
                accessType,
                accessedAt: new Date()
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Generate compliance report
     */
    static async generateComplianceReport(
        workplaceId: mongoose.Types.ObjectId,
        startDate: Date,
        endDate: Date
    ): Promise<any> {
        const logs = await this.getAuditLogs(workplaceId, undefined, undefined, undefined, startDate, endDate, 10000);

        const report = {
            period: {
                startDate,
                endDate
            },
            summary: {
                totalActivities: logs.length,
                sessionsCreated: logs.filter(l => l.action === 'MTR_SESSION_CREATED').length,
                sessionsCompleted: logs.filter(l => l.action === 'MTR_SESSION_COMPLETED').length,
                problemsIdentified: logs.filter(l => l.action === 'DTP_IDENTIFIED').length,
                interventionsRecorded: logs.filter(l => l.action === 'MTR_INTERVENTION_RECORDED').length,
                dataAccesses: logs.filter(l => l.action.startsWith('DATA_')).length
            },
            userActivity: this.aggregateUserActivity(logs),
            dailyActivity: this.aggregateDailyActivity(logs, startDate, endDate),
            riskEvents: this.identifyRiskEvents(logs)
        };

        return report;
    }

    /**
     * Aggregate user activity for compliance report
     */
    private static aggregateUserActivity(logs: AuditLogEntry[]): any[] {
        const userStats: Record<string, any> = {};

        for (const log of logs) {
            const userId = log.userId.toString();
            if (!userStats[userId]) {
                userStats[userId] = {
                    userId,
                    totalActivities: 0,
                    sessionsCreated: 0,
                    sessionsCompleted: 0,
                    problemsIdentified: 0,
                    interventionsRecorded: 0,
                    lastActivity: log.timestamp
                };
            }

            userStats[userId].totalActivities++;

            switch (log.action) {
                case 'MTR_SESSION_CREATED':
                    userStats[userId].sessionsCreated++;
                    break;
                case 'MTR_SESSION_COMPLETED':
                    userStats[userId].sessionsCompleted++;
                    break;
                case 'DTP_IDENTIFIED':
                    userStats[userId].problemsIdentified++;
                    break;
                case 'MTR_INTERVENTION_RECORDED':
                    userStats[userId].interventionsRecorded++;
                    break;
            }

            if (log.timestamp > userStats[userId].lastActivity) {
                userStats[userId].lastActivity = log.timestamp;
            }
        }

        return Object.values(userStats);
    }

    /**
     * Aggregate daily activity for compliance report
     */
    private static aggregateDailyActivity(logs: AuditLogEntry[], startDate: Date, endDate: Date): any[] {
        const dailyStats: Record<string, any> = {};

        // Initialize all days in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            if (dateKey) {
                dailyStats[dateKey] = {
                    date: dateKey,
                    totalActivities: 0,
                    sessionsCreated: 0,
                    sessionsCompleted: 0,
                    problemsIdentified: 0,
                    interventionsRecorded: 0
                };
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Aggregate log data
        for (const log of logs) {
            const dateKey = log.timestamp.toISOString().split('T')[0];
            if (dateKey && dailyStats[dateKey]) {
                dailyStats[dateKey].totalActivities++;

                switch (log.action) {
                    case 'MTR_SESSION_CREATED':
                        dailyStats[dateKey]!.sessionsCreated++;
                        break;
                    case 'MTR_SESSION_COMPLETED':
                        dailyStats[dateKey]!.sessionsCompleted++;
                        break;
                    case 'DTP_IDENTIFIED':
                        dailyStats[dateKey]!.problemsIdentified++;
                        break;
                    case 'MTR_INTERVENTION_RECORDED':
                        dailyStats[dateKey]!.interventionsRecorded++;
                        break;
                }
            }
        }

        return Object.values(dailyStats);
    }

    /**
     * Identify risk events for compliance monitoring
     */
    private static identifyRiskEvents(logs: AuditLogEntry[]): any[] {
        const riskEvents: any[] = [];

        // Check for critical drug therapy problems
        const criticalProblems = logs.filter(
            l => l.action === 'DTP_IDENTIFIED' && l.details.severity === 'critical'
        );

        for (const problem of criticalProblems) {
            riskEvents.push({
                type: 'CRITICAL_DTP_IDENTIFIED',
                timestamp: problem.timestamp,
                userId: problem.userId,
                details: problem.details,
                riskLevel: 'HIGH'
            });
        }

        // Check for incomplete sessions (created but not completed within reasonable time)
        const sessionCreations = logs.filter(l => l.action === 'MTR_SESSION_CREATED');
        const sessionCompletions = logs.filter(l => l.action === 'MTR_SESSION_COMPLETED');

        for (const creation of sessionCreations) {
            const completion = sessionCompletions.find(
                c => c.resourceId === creation.resourceId
            );

            if (!completion) {
                const daysSinceCreation = Math.floor(
                    (Date.now() - creation.timestamp.getTime()) / (1000 * 60 * 60 * 24)
                );

                if (daysSinceCreation > 7) {
                    riskEvents.push({
                        type: 'INCOMPLETE_SESSION',
                        timestamp: creation.timestamp,
                        userId: creation.userId,
                        details: {
                            sessionId: creation.resourceId,
                            daysSinceCreation
                        },
                        riskLevel: 'MEDIUM'
                    });
                }
            }
        }

        return riskEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
}

// ===============================
// MAIN MTR SERVICE CLASS
// ===============================

class MTRService {
    /**
     * Create new MTR session with workflow initialization
     */
    static async createSession(
        patientId: mongoose.Types.ObjectId,
        pharmacistId: mongoose.Types.ObjectId,
        workplaceId: mongoose.Types.ObjectId,
        sessionData: any,
        context?: any
    ): Promise<IMedicationTherapyReview> {
        // Validate patient exists
        const patient = await Patient.findById(patientId);
        if (!patient) {
            throw createNotFoundError('Patient', patientId.toString());
        }

        // Check for active sessions
        const activeSession = await MedicationTherapyReview.findOne({
            patientId,
            status: { $in: ['in_progress', 'on_hold'] }
        });

        if (activeSession) {
            throw createBusinessRuleError('Patient already has an active MTR session');
        }

        // Generate review number
        const reviewNumber = await (MedicationTherapyReview as any).generateNextReviewNumber(workplaceId);

        // Create session
        const session = new MedicationTherapyReview({
            workplaceId,
            patientId,
            pharmacistId,
            reviewNumber,
            ...sessionData,
            createdBy: pharmacistId,
            clinicalOutcomes: {
                problemsResolved: 0,
                medicationsOptimized: 0,
                adherenceImproved: false,
                adverseEventsReduced: false,
            }
        });

        await session.save();

        // Mark patient selection as complete
        session.markStepComplete('patientSelection', {
            patientId,
            selectedAt: new Date()
        });
        await session.save();

        // Audit log
        await MTRAuditService.logSessionCreation(
            session._id.toString(),
            patientId.toString(),
            pharmacistId,
            workplaceId,
            sessionData,
            context?.ipAddress,
            context?.userAgent
        );

        return session;
    }

    /**
     * Complete workflow step with validation
     */
    static async completeStep(
        sessionId: mongoose.Types.ObjectId,
        stepName: string,
        stepData: any,
        userId: mongoose.Types.ObjectId,
        context?: any
    ): Promise<{ session: IMedicationTherapyReview; validation: StepValidationResult }> {
        const session = await MedicationTherapyReview.findById(sessionId);
        if (!session) {
            throw createNotFoundError('MTR Session', sessionId.toString());
        }

        // Validate step
        const validation = await MTRWorkflowService.validateStep(stepName, session, stepData);

        if (!validation.canProceed) {
            throw createValidationError(`Cannot complete step: ${validation.errors.join(', ')}`);
        }

        // Complete step
        session.markStepComplete(stepName, stepData);
        session.updatedBy = userId;
        await session.save();

        // Audit log
        await MTRAuditService.logStepCompletion(
            sessionId.toString(),
            stepName,
            userId,
            session.workplaceId,
            stepData,
            context?.ipAddress,
            context?.userAgent
        );

        return { session, validation };
    }

    /**
     * Run drug interaction assessment
     */
    static async runInteractionAssessment(
        sessionId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId,
        context?: any
    ): Promise<{ interactions: DrugInteractionResult; problems: IDrugTherapyProblem[] }> {
        const session = await MedicationTherapyReview.findById(sessionId);
        if (!session) {
            throw createNotFoundError('MTR Session', sessionId.toString());
        }

        if (!session.medications || session.medications.length === 0) {
            throw createValidationError('No medications available for interaction checking');
        }

        // Check interactions
        const interactions = await DrugInteractionService.checkInteractions(session.medications);

        // Generate problems from interactions
        const problems = await DrugInteractionService.generateProblemsFromInteractions(
            interactions,
            session._id,
            session.patientId,
            session.workplaceId,
            userId
        );

        // Save problems to database
        const savedProblems: IDrugTherapyProblem[] = [];
        for (const problem of problems) {
            await problem.save();
            savedProblems.push(problem);

            // Add to session
            session.problems.push(problem._id);

            // Audit log
            await MTRAuditService.logProblemIdentification(
                problem._id.toString(),
                sessionId.toString(),
                userId,
                session.workplaceId,
                problem.toObject(),
                context?.ipAddress,
                context?.userAgent
            );
        }

        // Update session
        session.updatedBy = userId;
        await session.save();

        return { interactions, problems: savedProblems };
    }

    /**
     * Complete MTR session
     */
    static async completeSession(
        sessionId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId,
        context?: any
    ): Promise<IMedicationTherapyReview> {
        const session = await MedicationTherapyReview.findById(sessionId);
        if (!session) {
            throw createNotFoundError('MTR Session', sessionId.toString());
        }

        // Validate completion
        const validation = await MTRWorkflowService.canCompleteWorkflow(session);
        if (!validation.canProceed) {
            throw createValidationError(`Cannot complete session: ${validation.errors.join(', ')}`);
        }

        // Complete session
        session.status = 'completed';
        session.completedAt = new Date();
        session.updatedBy = userId;
        await session.save();

        // Calculate completion metrics
        const problemCount = await DrugTherapyProblem.countDocuments({
            reviewId: sessionId,
            isDeleted: { $ne: true }
        });

        const interventionCount = await MTRIntervention.countDocuments({
            reviewId: sessionId,
            isDeleted: { $ne: true }
        });

        const followUpCount = await MTRFollowUp.countDocuments({
            reviewId: sessionId,
            isDeleted: { $ne: true }
        });

        // Audit log
        await MTRAuditService.logSessionCompletion(
            sessionId.toString(),
            userId,
            session.workplaceId,
            {
                duration: session.completedAt.getTime() - session.startedAt.getTime(),
                problemsIdentified: problemCount,
                interventionsRecorded: interventionCount,
                followUpsScheduled: followUpCount
            },
            context?.ipAddress,
            context?.userAgent
        );

        return session;
    }
}

// Export all services
export {
    MTRWorkflowService,
    DrugInteractionService,
    MTRAuditService
};