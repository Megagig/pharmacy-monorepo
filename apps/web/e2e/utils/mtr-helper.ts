import { Page, expect } from '@playwright/test';

export interface MTRTestData {
    patient: {
        firstName: string;
        lastName: string;
        mrn: string;
        dob: string;
    };
    medications: Array<{
        drugName: string;
        strength: string;
        dosageForm: string;
        frequency: string;
        indication: string;
    }>;
    problems: Array<{
        type: string;
        severity: string;
        description: string;
    }>;
    interventions: Array<{
        type: string;
        description: string;
        targetAudience: string;
    }>;
}

export class MTRHelper {
    constructor(private page: Page) { }

    async navigateToMTR() {
        console.log('🧭 Navigating to MTR module...');

        // Navigate to MTR page
        await this.page.goto('/medication-therapy-review');

        // Wait for page to load
        await expect(this.page.locator('[data-testid="mtr-dashboard"]')).toBeVisible();

        console.log('✅ MTR module loaded');
    }

    async startNewMTRSession(patientData: MTRTestData['patient']) {
        console.log('🆕 Starting new MTR session...');

        // Click new MTR button
        await this.page.click('[data-testid="new-mtr-button"]');

        // Wait for patient selection step
        await expect(this.page.locator('[data-testid="patient-selection-step"]')).toBeVisible();

        // Search for patient
        await this.page.fill('[data-testid="patient-search-input"]', patientData.mrn);
        await this.page.waitForTimeout(1000); // Wait for search results

        // Select patient from results
        await this.page.click(`[data-testid="patient-result-${patientData.mrn}"]`);

        // Confirm patient selection
        await this.page.click('[data-testid="confirm-patient-button"]');

        // Wait for medication history step
        await expect(this.page.locator('[data-testid="medication-history-step"]')).toBeVisible();

        console.log('✅ MTR session started');
    }

    async addMedications(medications: MTRTestData['medications']) {
        console.log('💊 Adding medications...');

        for (const medication of medications) {
            // Click add medication button
            await this.page.click('[data-testid="add-medication-button"]');

            // Fill medication form
            await this.page.fill('[data-testid="drug-name-input"]', medication.drugName);
            await this.page.fill('[data-testid="strength-input"]', medication.strength);
            await this.page.selectOption('[data-testid="dosage-form-select"]', medication.dosageForm);
            await this.page.fill('[data-testid="frequency-input"]', medication.frequency);
            await this.page.fill('[data-testid="indication-input"]', medication.indication);

            // Save medication
            await this.page.click('[data-testid="save-medication-button"]');

            // Wait for medication to be added to list
            await expect(this.page.locator(`[data-testid="medication-item-${medication.drugName}"]`)).toBeVisible();
        }

        // Proceed to next step
        await this.page.click('[data-testid="next-step-button"]');

        // Wait for therapy assessment step
        await expect(this.page.locator('[data-testid="therapy-assessment-step"]')).toBeVisible();

        console.log('✅ Medications added');
    }

    async performTherapyAssessment(problems: MTRTestData['problems']) {
        console.log('🔍 Performing therapy assessment...');

        // Run automated assessment
        await this.page.click('[data-testid="run-assessment-button"]');

        // Wait for assessment to complete
        await this.page.waitForSelector('[data-testid="assessment-results"]', { timeout: 10000 });

        // Add manual problems if any
        for (const problem of problems) {
            await this.page.click('[data-testid="add-problem-button"]');

            await this.page.selectOption('[data-testid="problem-type-select"]', problem.type);
            await this.page.selectOption('[data-testid="problem-severity-select"]', problem.severity);
            await this.page.fill('[data-testid="problem-description-input"]', problem.description);

            await this.page.click('[data-testid="save-problem-button"]');

            // Wait for problem to be added
            await expect(this.page.locator(`[data-testid="problem-item"]`)).toBeVisible();
        }

        // Proceed to next step
        await this.page.click('[data-testid="next-step-button"]');

        // Wait for plan development step
        await expect(this.page.locator('[data-testid="plan-development-step"]')).toBeVisible();

        console.log('✅ Therapy assessment completed');
    }

    async developTherapyPlan() {
        console.log('📋 Developing therapy plan...');

        // Add recommendations for each identified problem
        const problems = await this.page.locator('[data-testid="identified-problem"]').all();

        for (let i = 0; i < problems.length; i++) {
            await this.page.click(`[data-testid="add-recommendation-${i}"]`);

            await this.page.fill(
                `[data-testid="recommendation-text-${i}"]`,
                `Recommendation for problem ${i + 1}: Adjust therapy as clinically appropriate.`
            );

            await this.page.click(`[data-testid="save-recommendation-${i}"]`);
        }

        // Add monitoring parameters
        await this.page.click('[data-testid="add-monitoring-button"]');
        await this.page.fill('[data-testid="monitoring-parameter-input"]', 'Monitor blood pressure weekly');
        await this.page.click('[data-testid="save-monitoring-button"]');

        // Proceed to next step
        await this.page.click('[data-testid="next-step-button"]');

        // Wait for interventions step
        await expect(this.page.locator('[data-testid="interventions-step"]')).toBeVisible();

        console.log('✅ Therapy plan developed');
    }

    async recordInterventions(interventions: MTRTestData['interventions']) {
        console.log('📞 Recording interventions...');

        for (const intervention of interventions) {
            await this.page.click('[data-testid="add-intervention-button"]');

            await this.page.selectOption('[data-testid="intervention-type-select"]', intervention.type);
            await this.page.fill('[data-testid="intervention-description-input"]', intervention.description);
            await this.page.selectOption('[data-testid="target-audience-select"]', intervention.targetAudience);

            await this.page.click('[data-testid="save-intervention-button"]');

            // Wait for intervention to be added
            await expect(this.page.locator('[data-testid="intervention-item"]')).toBeVisible();
        }

        // Proceed to next step
        await this.page.click('[data-testid="next-step-button"]');

        // Wait for follow-up step
        await expect(this.page.locator('[data-testid="follow-up-step"]')).toBeVisible();

        console.log('✅ Interventions recorded');
    }

    async scheduleFollowUp() {
        console.log('📅 Scheduling follow-up...');

        // Schedule follow-up appointment
        await this.page.click('[data-testid="schedule-followup-button"]');

        // Set follow-up date (7 days from now)
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 7);
        const dateString = followUpDate.toISOString().split('T')[0];

        await this.page.fill('[data-testid="followup-date-input"]', dateString);
        await this.page.fill('[data-testid="followup-description-input"]', 'Follow up on therapy changes and patient response');

        await this.page.click('[data-testid="save-followup-button"]');

        // Wait for follow-up to be scheduled
        await expect(this.page.locator('[data-testid="scheduled-followup"]')).toBeVisible();

        console.log('✅ Follow-up scheduled');
    }

    async completeMTRSession() {
        console.log('✅ Completing MTR session...');

        // Click complete MTR button
        await this.page.click('[data-testid="complete-mtr-button"]');

        // Add completion summary
        await this.page.fill(
            '[data-testid="completion-summary-input"]',
            'MTR completed successfully. All identified problems addressed with appropriate interventions.'
        );

        // Confirm completion
        await this.page.click('[data-testid="confirm-completion-button"]');

        // Wait for completion confirmation
        await expect(this.page.locator('[data-testid="mtr-completed-message"]')).toBeVisible();

        console.log('✅ MTR session completed');
    }

    async verifyMTRInHistory(patientMRN: string) {
        console.log('🔍 Verifying MTR in history...');

        // Navigate to MTR history
        await this.page.click('[data-testid="mtr-history-tab"]');

        // Search for the completed MTR
        await this.page.fill('[data-testid="history-search-input"]', patientMRN);

        // Verify MTR appears in history
        await expect(this.page.locator(`[data-testid="mtr-history-item-${patientMRN}"]`)).toBeVisible();

        // Verify status is completed
        await expect(
            this.page.locator(`[data-testid="mtr-status-${patientMRN}"]`)
        ).toContainText('Completed');

        console.log('✅ MTR verified in history');
    }

    async testStepNavigation() {
        console.log('🧭 Testing step navigation...');

        // Test forward navigation
        const steps = [
            'patient-selection-step',
            'medication-history-step',
            'therapy-assessment-step',
            'plan-development-step',
            'interventions-step',
            'follow-up-step'
        ];

        for (let i = 0; i < steps.length - 1; i++) {
            await this.page.click('[data-testid="next-step-button"]');
            await expect(this.page.locator(`[data-testid="${steps[i + 1]}"]`)).toBeVisible();
        }

        // Test backward navigation
        for (let i = steps.length - 1; i > 0; i--) {
            await this.page.click('[data-testid="previous-step-button"]');
            await expect(this.page.locator(`[data-testid="${steps[i - 1]}"]`)).toBeVisible();
        }

        console.log('✅ Step navigation tested');
    }

    async testDataPersistence() {
        console.log('💾 Testing data persistence...');

        // Add a medication
        await this.page.click('[data-testid="add-medication-button"]');
        await this.page.fill('[data-testid="drug-name-input"]', 'Test Medication');
        await this.page.click('[data-testid="save-medication-button"]');

        // Navigate to next step and back
        await this.page.click('[data-testid="next-step-button"]');
        await this.page.click('[data-testid="previous-step-button"]');

        // Verify medication is still there
        await expect(this.page.locator('[data-testid="medication-item-Test Medication"]')).toBeVisible();

        console.log('✅ Data persistence tested');
    }
}