import { MTRTestData } from './mtr-helper';

export const testPatients = [
    {
        firstName: 'John',
        lastName: 'Doe',
        mrn: 'E2E001',
        dob: '1980-01-01',
    },
    {
        firstName: 'Jane',
        lastName: 'Smith',
        mrn: 'E2E002',
        dob: '1975-05-15',
    },
];

export const sampleMTRData: MTRTestData = {
    patient: testPatients[0],
    medications: [
        {
            drugName: 'Warfarin',
            strength: '5 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Anticoagulation',
        },
        {
            drugName: 'Aspirin',
            strength: '81 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Cardioprotection',
        },
        {
            drugName: 'Metformin',
            strength: '500 mg',
            dosageForm: 'tablet',
            frequency: 'twice daily',
            indication: 'Type 2 Diabetes',
        },
    ],
    problems: [
        {
            type: 'interaction',
            severity: 'major',
            description: 'Warfarin-Aspirin interaction increases bleeding risk',
        },
        {
            type: 'adherence',
            severity: 'moderate',
            description: 'Patient reports missing doses occasionally',
        },
    ],
    interventions: [
        {
            type: 'recommendation',
            description: 'Recommend discontinuing aspirin and monitoring INR more frequently',
            targetAudience: 'prescriber',
        },
        {
            type: 'counseling',
            description: 'Counsel patient on importance of medication adherence',
            targetAudience: 'patient',
        },
    ],
};

export const complexMTRData: MTRTestData = {
    patient: testPatients[1],
    medications: [
        {
            drugName: 'Lisinopril',
            strength: '10 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Hypertension',
        },
        {
            drugName: 'Amlodipine',
            strength: '5 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Hypertension',
        },
        {
            drugName: 'Atorvastatin',
            strength: '20 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Hyperlipidemia',
        },
        {
            drugName: 'Metoprolol',
            strength: '50 mg',
            dosageForm: 'tablet',
            frequency: 'twice daily',
            indication: 'Hypertension',
        },
        {
            drugName: 'Furosemide',
            strength: '40 mg',
            dosageForm: 'tablet',
            frequency: 'once daily',
            indication: 'Heart Failure',
        },
    ],
    problems: [
        {
            type: 'duplication',
            severity: 'moderate',
            description: 'Multiple antihypertensive agents may cause excessive BP reduction',
        },
        {
            type: 'monitoring',
            severity: 'minor',
            description: 'Electrolyte monitoring needed with furosemide therapy',
        },
        {
            type: 'dosing',
            severity: 'moderate',
            description: 'Atorvastatin dose may be too high for patient age',
        },
    ],
    interventions: [
        {
            type: 'recommendation',
            description: 'Consider reducing number of antihypertensive agents',
            targetAudience: 'prescriber',
        },
        {
            type: 'monitoring',
            description: 'Schedule regular electrolyte monitoring',
            targetAudience: 'healthcare_team',
        },
        {
            type: 'education',
            description: 'Educate patient on signs of hypotension',
            targetAudience: 'patient',
        },
    ],
};

export const errorScenarios = {
    invalidPatientData: {
        firstName: '',
        lastName: '',
        mrn: '',
        dob: 'invalid-date',
    },
    invalidMedicationData: {
        drugName: '',
        strength: 'invalid',
        dosageForm: '',
        frequency: '',
        indication: '',
    },
    networkFailure: {
        simulateOffline: true,
        delayResponse: 30000,
    },
};

export const performanceTestData = {
    largeMedicationList: Array.from({ length: 50 }, (_, index) => ({
        drugName: `Medication${index + 1}`,
        strength: `${10 + index} mg`,
        dosageForm: 'tablet',
        frequency: 'once daily',
        indication: `Indication ${index + 1}`,
    })),

    multipleProblems: Array.from({ length: 20 }, (_, index) => ({
        type: index % 2 === 0 ? 'interaction' : 'adherence',
        severity: ['minor', 'moderate', 'major'][index % 3] as 'minor' | 'moderate' | 'major',
        description: `Test problem ${index + 1} for performance testing`,
    })),
};