import ClinicalIntervention from '../../models/ClinicalIntervention';

describe('ClinicalIntervention Model - Simple Test', () => {
    it('should import the model without errors', () => {
        expect(ClinicalIntervention).toBeDefined();
        expect(ClinicalIntervention.modelName).toBe('ClinicalIntervention');
    });

    it('should have the correct schema structure', () => {
        const schema = ClinicalIntervention.schema;

        // Check required fields exist in schema
        expect(schema.paths.workplaceId).toBeDefined();
        expect(schema.paths.patientId).toBeDefined();
        expect(schema.paths.interventionNumber).toBeDefined();
        expect(schema.paths.category).toBeDefined();
        expect(schema.paths.priority).toBeDefined();
        expect(schema.paths.issueDescription).toBeDefined();
        expect(schema.paths.identifiedBy).toBeDefined();
        expect(schema.paths.strategies).toBeDefined();
        expect(schema.paths.assignments).toBeDefined();
        expect(schema.paths.status).toBeDefined();
        expect(schema.paths.outcomes || schema.paths['outcomes.patientResponse']).toBeDefined();
        expect(schema.paths.followUp || schema.paths['followUp.required']).toBeDefined();
        expect(schema.paths.startedAt).toBeDefined();
    });

    it('should have correct enum values for category', () => {
        const categoryPath = ClinicalIntervention.schema.paths.category as any;
        const enumValues = categoryPath.enumValues;

        expect(enumValues).toContain('drug_therapy_problem');
        expect(enumValues).toContain('adverse_drug_reaction');
        expect(enumValues).toContain('medication_nonadherence');
        expect(enumValues).toContain('drug_interaction');
        expect(enumValues).toContain('dosing_issue');
        expect(enumValues).toContain('contraindication');
        expect(enumValues).toContain('other');
    });

    it('should have correct enum values for priority', () => {
        const priorityPath = ClinicalIntervention.schema.paths.priority as any;
        const enumValues = priorityPath.enumValues;

        expect(enumValues).toContain('low');
        expect(enumValues).toContain('medium');
        expect(enumValues).toContain('high');
        expect(enumValues).toContain('critical');
    });

    it('should have correct enum values for status', () => {
        const statusPath = ClinicalIntervention.schema.paths.status as any;
        const enumValues = statusPath.enumValues;

        expect(enumValues).toContain('identified');
        expect(enumValues).toContain('planning');
        expect(enumValues).toContain('in_progress');
        expect(enumValues).toContain('implemented');
        expect(enumValues).toContain('completed');
        expect(enumValues).toContain('cancelled');
    });

    it('should have static methods defined', () => {
        expect(typeof (ClinicalIntervention as any).generateNextInterventionNumber).toBe('function');
        expect(typeof (ClinicalIntervention as any).findActive).toBe('function');
        expect(typeof (ClinicalIntervention as any).findOverdue).toBe('function');
        expect(typeof (ClinicalIntervention as any).findByPatient).toBe('function');
        expect(typeof (ClinicalIntervention as any).findAssignedToUser).toBe('function');
    });
});