import {
    createDiagnosticRequestSchema,
    createLabOrderSchema,
    createLabResultSchema,
    drugInteractionCheckSchema,
    clinicalValidators,
    sanitizeInput
} from '../validators/diagnosticValidators';

describe('Diagnostic Validators - Simple Tests', () => {
    describe('createDiagnosticRequestSchema', () => {
        const validRequestData = {
            patientId: '507f1f77bcf86cd799439011',
            inputSnapshot: {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                    objective: ['fever'],
                    duration: '2 days',
                    severity: 'moderate',
                    onset: 'acute'
                },
                vitals: {
                    bloodPressure: '120/80',
                    heartRate: 75,
                    temperature: 37.5
                }
            },
            consentObtained: true
        };

        it('should validate correct diagnostic request data', () => {
            const result = createDiagnosticRequestSchema.safeParse(validRequestData);
            expect(result.success).toBe(true);
        });

        it('should require patient consent', () => {
            const invalidData = { ...validRequestData, consentObtained: false };
            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate blood pressure format', () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    vitals: {
                        bloodPressure: '120-80' // Invalid format
                    }
                }
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('createLabOrderSchema', () => {
        const validOrderData = {
            patientId: '507f1f77bcf86cd799439011',
            tests: [{
                code: 'CBC',
                name: 'Complete Blood Count',
                indication: 'Routine screening',
                priority: 'routine',
                loincCode: '57021-8'
            }],
            clinicalIndication: 'Annual health check'
        };

        it('should validate correct lab order data', () => {
            const result = createLabOrderSchema.safeParse(validOrderData);
            expect(result.success).toBe(true);
        });

        it('should require at least one test', () => {
            const invalidData = { ...validOrderData, tests: [] };
            const result = createLabOrderSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('createLabResultSchema', () => {
        const validResultData = {
            patientId: '507f1f77bcf86cd799439011',
            testCode: 'HGB',
            testName: 'Hemoglobin',
            value: '12.5',
            referenceRange: {
                low: 12.0,
                high: 16.0,
                unit: 'g/dL'
            },
            performedAt: '2024-12-01T10:00:00Z'
        };

        it('should validate correct lab result data', () => {
            const result = createLabResultSchema.safeParse(validResultData);
            expect(result.success).toBe(true);
        });

        it('should require reference range', () => {
            const invalidData = { ...validResultData };
            // @ts-ignore - intentionally removing required field for test
            delete invalidData.referenceRange;

            const result = createLabResultSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('drugInteractionCheckSchema', () => {
        const validInteractionData = {
            medications: ['Warfarin', 'Aspirin'],
            patientAllergies: ['Penicillin'],
            patientAge: 65,
            patientWeight: 70
        };

        it('should validate correct interaction check data', () => {
            const result = drugInteractionCheckSchema.safeParse(validInteractionData);
            expect(result.success).toBe(true);
        });

        it('should require at least one medication', () => {
            const invalidData = { ...validInteractionData, medications: [] };
            const result = drugInteractionCheckSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('Clinical Validators', () => {
        describe('validateVitalSigns', () => {
            it('should validate normal vital signs', () => {
                const vitals = {
                    bloodPressure: '120/80',
                    temperature: 37.0,
                    heartRate: 75,
                    oxygenSaturation: 98
                };

                expect(() => clinicalValidators.validateVitalSigns(vitals)).not.toThrow();
            });

            it('should reject invalid blood pressure', () => {
                const vitals = { bloodPressure: '80/120' }; // Diastolic > Systolic

                expect(() => clinicalValidators.validateVitalSigns(vitals)).toThrow();
            });
        });

        describe('validateMedicationList', () => {
            it('should validate unique medications', () => {
                const medications = [
                    { name: 'Aspirin' },
                    { name: 'Warfarin' }
                ];

                expect(() => clinicalValidators.validateMedicationList(medications)).not.toThrow();
            });

            it('should reject duplicate medications', () => {
                const medications = [
                    { name: 'Aspirin' },
                    { name: 'aspirin' } // Case-insensitive duplicate
                ];

                expect(() => clinicalValidators.validateMedicationList(medications)).toThrow();
            });
        });
    });

    describe('Sanitization Helpers', () => {
        describe('sanitizeClinicalText', () => {
            it('should remove script tags', () => {
                const maliciousText = 'Patient has <script>alert("xss")</script> symptoms';
                const sanitized = sanitizeInput.sanitizeClinicalText(maliciousText);

                expect(sanitized).not.toContain('<script>');
                expect(sanitized).toBe('Patient has  symptoms');
            });
        });

        describe('sanitizeMedicationName', () => {
            it('should remove HTML special characters', () => {
                const maliciousName = 'Aspirin<script>alert()</script>';
                const sanitized = sanitizeInput.sanitizeMedicationName(maliciousName);

                expect(sanitized).toBe('Aspirin');
            });
        });

        describe('sanitizeNumericValue', () => {
            it('should keep only numeric characters', () => {
                const messyValue = 'abc12.5def';
                const sanitized = sanitizeInput.sanitizeNumericValue(messyValue);

                expect(sanitized).toBe('12.5');
            });
        });
    });
});