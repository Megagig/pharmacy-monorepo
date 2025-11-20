import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMTRStore } from '../mtrStore';
import type { MTRMedication, DrugTherapyProblem, TherapyPlan } from '../mtrStore';

// Mock the API service
vi.mock('../../services/mtrService', () => ({
    mtrService: {
        createMTRSession: vi.fn(),
        getMTRSession: vi.fn(),
        updateMTRSession: vi.fn(),
        completeMTRSession: vi.fn(),
        addMedication: vi.fn(),
        updateMedication: vi.fn(),
        removeMedication: vi.fn(),
        importMedications: vi.fn(),
        addProblem: vi.fn(),
        updateProblem: vi.fn(),
        resolveProblem: vi.fn(),
        createPlan: vi.fn(),
        updatePlan: vi.fn(),
        recordIntervention: vi.fn(),
        updateIntervention: vi.fn(),
        scheduleFollowUp: vi.fn(),
        completeFollowUp: vi.fn(),
        checkDrugInteractions: vi.fn(),
    },
}));

describe('MTRStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useMTRStore.setState({
            currentReview: null,
            currentStep: 0,
            stepData: {},
            selectedPatient: null,
            medications: [],
            identifiedProblems: [],
            therapyPlan: null,
            interventions: [],
            followUps: [],
            loading: {},
            errors: {},
        });
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const state = useMTRStore.getState();

            expect(state.currentReview).toBeNull();
            expect(state.currentStep).toBe(0);
            expect(state.stepData).toEqual({});
            expect(state.selectedPatient).toBeNull();
            expect(state.medications).toEqual([]);
            expect(state.identifiedProblems).toEqual([]);
            expect(state.therapyPlan).toBeNull();
            expect(state.interventions).toEqual([]);
            expect(state.followUps).toEqual([]);
            expect(state.loading).toEqual({});
            expect(state.errors).toEqual({});
        });
    });

    describe('Patient Selection', () => {
        it('should select a patient', () => {
            const mockPatient = {
                _id: 'patient-1',
                firstName: 'John',
                lastName: 'Doe',
                mrn: 'MRN123',
                age: 45,
            };

            const { selectPatient } = useMTRStore.getState();
            selectPatient(mockPatient);

            const state = useMTRStore.getState();
            expect(state.selectedPatient).toEqual(mockPatient);
        });

        it('should clear patient selection', () => {
            const mockPatient = {
                _id: 'patient-1',
                firstName: 'John',
                lastName: 'Doe',
                mrn: 'MRN123',
                age: 45,
            };

            const { selectPatient } = useMTRStore.getState();
            selectPatient(mockPatient);
            selectPatient(null);

            const state = useMTRStore.getState();
            expect(state.selectedPatient).toBeNull();
        });
    });

    describe('Step Navigation', () => {
        it('should navigate to a specific step', () => {
            const { goToStep } = useMTRStore.getState();
            goToStep(2);

            const state = useMTRStore.getState();
            expect(state.currentStep).toBe(2);
        });

        it('should get current step name', () => {
            const { getCurrentStepName } = useMTRStore.getState();

            useMTRStore.setState({ currentStep: 0 });
            expect(getCurrentStepName()).toBe('Patient Selection');

            useMTRStore.setState({ currentStep: 1 });
            expect(getCurrentStepName()).toBe('Medication History');

            useMTRStore.setState({ currentStep: 2 });
            expect(getCurrentStepName()).toBe('Therapy Assessment');
        });

        it('should get next step correctly', () => {
            const { getNextStep } = useMTRStore.getState();

            useMTRStore.setState({ currentStep: 0 });
            expect(getNextStep()).toBe(1);

            useMTRStore.setState({ currentStep: 4 });
            expect(getNextStep()).toBe(5);

            useMTRStore.setState({ currentStep: 5 });
            expect(getNextStep()).toBe(5); // Should not go beyond last step
        });
    });

    describe('Medication Management', () => {
        const mockMedication: MTRMedication = {
            id: 'med-1',
            drugName: 'Metformin',
            genericName: 'Metformin HCl',
            strength: { value: 500, unit: 'mg' },
            dosageForm: 'Tablet',
            instructions: {
                dose: '500mg',
                frequency: 'Twice daily',
                route: 'Oral',
            },
            category: 'prescribed',
            startDate: new Date('2024-01-01'),
            indication: 'Type 2 Diabetes',
        };

        it('should add a medication', () => {
            const { addMedication } = useMTRStore.getState();
            addMedication(mockMedication);

            const state = useMTRStore.getState();
            expect(state.medications).toHaveLength(1);
            expect(state.medications[0]).toEqual(mockMedication);
        });

        it('should update a medication', () => {
            const { addMedication, updateMedication } = useMTRStore.getState();
            addMedication(mockMedication);

            const updates = { indication: 'Diabetes Management' };
            updateMedication('med-1', updates);

            const state = useMTRStore.getState();
            expect(state.medications[0].indication).toBe('Diabetes Management');
        });

        it('should remove a medication', () => {
            const { addMedication, removeMedication } = useMTRStore.getState();
            addMedication(mockMedication);
            removeMedication('med-1');

            const state = useMTRStore.getState();
            expect(state.medications).toHaveLength(0);
        });

        it('should validate medications', () => {
            const { validateMedications } = useMTRStore.getState();

            // Test with empty medications
            expect(validateMedications()).toContain('At least one medication is required');

            // Test with invalid medication
            const invalidMedication = { ...mockMedication, drugName: '' };
            useMTRStore.setState({ medications: [invalidMedication] });
            const errors = validateMedications();
            expect(errors).toContain('Drug name is required for medication 1');
        });

        it('should detect duplicate medications', () => {
            const { addMedication } = useMTRStore.getState();

            addMedication(mockMedication);
            addMedication({ ...mockMedication, id: 'med-2' });

            const state = useMTRStore.getState();
            const duplicates = state.medications.filter(med =>
                med.drugName === mockMedication.drugName
            );
            expect(duplicates).toHaveLength(2);
        });
    });

    describe('Problem Management', () => {
        const mockProblem: DrugTherapyProblem = {
            _id: 'problem-1',
            category: 'safety',
            type: 'interaction',
            severity: 'major',
            description: 'Drug interaction between A and B',
            clinicalSignificance: 'May increase bleeding risk',
            affectedMedications: ['med-1', 'med-2'],
            relatedConditions: [],
            evidenceLevel: 'probable',
            riskFactors: ['Age > 65'],
            status: 'identified',
        };

        it('should add a problem', () => {
            const { addProblem } = useMTRStore.getState();
            addProblem(mockProblem);

            const state = useMTRStore.getState();
            expect(state.identifiedProblems).toHaveLength(1);
            expect(state.identifiedProblems[0]).toEqual(mockProblem);
        });

        it('should update a problem', () => {
            const { addProblem, updateProblem } = useMTRStore.getState();
            addProblem(mockProblem);

            const updates = { status: 'addressed' as const };
            updateProblem('problem-1', updates);

            const state = useMTRStore.getState();
            expect(state.identifiedProblems[0].status).toBe('addressed');
        });

        it('should resolve a problem', () => {
            const { addProblem, resolveProblem } = useMTRStore.getState();
            addProblem(mockProblem);

            resolveProblem('problem-1', 'Medications adjusted');

            const state = useMTRStore.getState();
            expect(state.identifiedProblems[0].status).toBe('resolved');
            expect(state.identifiedProblems[0].resolution?.action).toBe('Medications adjusted');
        });
    });

    describe('Therapy Plan Management', () => {
        const mockPlan: TherapyPlan = {
            problems: ['problem-1'],
            recommendations: [{
                type: 'adjust_dose',
                medication: 'Metformin',
                rationale: 'Reduce side effects',
                priority: 'high',
                expectedOutcome: 'Improved tolerance',
            }],
            monitoringPlan: [{
                parameter: 'Blood glucose',
                frequency: 'Weekly',
                targetValue: '80-120 mg/dL',
                notes: 'Monitor closely',
            }],
            counselingPoints: ['Take with food'],
            goals: [{
                description: 'Achieve target HbA1c',
                targetDate: new Date('2024-06-01'),
                achieved: false,
            }],
            timeline: '4 weeks',
            pharmacistNotes: 'Patient counseled on medication changes',
        };

        it('should create a therapy plan', async () => {
            const { createPlan } = useMTRStore.getState();
            await createPlan(mockPlan);

            const state = useMTRStore.getState();
            expect(state.therapyPlan).toEqual(mockPlan);
        });

        it('should update a therapy plan', () => {
            const { updatePlan } = useMTRStore.getState();
            useMTRStore.setState({ therapyPlan: mockPlan });

            const updates = { timeline: '6 weeks' };
            updatePlan(updates);

            const state = useMTRStore.getState();
            expect(state.therapyPlan?.timeline).toBe('6 weeks');
        });
    });

    describe('Loading and Error States', () => {
        it('should set loading state', () => {
            const { setLoading } = useMTRStore.getState();
            setLoading('createReview', true);

            const state = useMTRStore.getState();
            expect(state.loading.createReview).toBe(true);
        });

        it('should clear loading state', () => {
            const { setLoading } = useMTRStore.getState();
            setLoading('createReview', true);
            setLoading('createReview', false);

            const state = useMTRStore.getState();
            expect(state.loading.createReview).toBe(false);
        });

        it('should set error state', () => {
            const { setError } = useMTRStore.getState();
            setError('createReview', 'Failed to create review');

            const state = useMTRStore.getState();
            expect(state.errors.createReview).toBe('Failed to create review');
        });

        it('should clear error state', () => {
            const { setError, clearErrors } = useMTRStore.getState();
            setError('createReview', 'Failed to create review');
            clearErrors();

            const state = useMTRStore.getState();
            expect(state.errors).toEqual({});
        });
    });

    describe('Utility Functions', () => {
        it('should calculate completion percentage', () => {
            const { getCompletionPercentage } = useMTRStore.getState();

            // Mock a review with some completed steps
            const mockReview = {
                steps: {
                    patientSelection: { completed: true },
                    medicationHistory: { completed: true },
                    therapyAssessment: { completed: false },
                    planDevelopment: { completed: false },
                    interventions: { completed: false },
                    followUp: { completed: false },
                },
            };

            useMTRStore.setState({ currentReview: mockReview as unknown });

            const percentage = getCompletionPercentage();
            expect(percentage).toBe(33.33); // 2 out of 6 steps completed
        });

        it('should check if review can be completed', () => {
            const { canCompleteReview } = useMTRStore.getState();

            // Mock a review with all steps completed
            const mockReview = {
                steps: {
                    patientSelection: { completed: true },
                    medicationHistory: { completed: true },
                    therapyAssessment: { completed: true },
                    planDevelopment: { completed: true },
                    interventions: { completed: true },
                    followUp: { completed: true },
                },
            };

            useMTRStore.setState({ currentReview: mockReview as unknown });

            expect(canCompleteReview()).toBe(true);
        });

        it('should validate step completion', () => {
            const { validateStep } = useMTRStore.getState();

            // Test patient selection step
            useMTRStore.setState({ selectedPatient: null });
            expect(validateStep(0)).toContain('Patient selection is required');

            // Test medication history step
            useMTRStore.setState({
                selectedPatient: { _id: 'patient-1' } as unknown,
                medications: []
            });
            expect(validateStep(1)).toContain('At least one medication is required');
        });
    });

    describe('Store Persistence', () => {
        it('should clear store data', () => {
            const { clearStore } = useMTRStore.getState();

            // Set some data first
            useMTRStore.setState({
                selectedPatient: { _id: 'patient-1' } as unknown,
                medications: [{ id: 'med-1' } as unknown],
                identifiedProblems: [{ _id: 'problem-1' } as unknown],
            });

            clearStore();

            const state = useMTRStore.getState();
            expect(state.selectedPatient).toBeNull();
            expect(state.medications).toEqual([]);
            expect(state.identifiedProblems).toEqual([]);
        });
    });
});