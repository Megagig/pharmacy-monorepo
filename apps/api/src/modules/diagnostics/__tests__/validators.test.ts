import { z } from 'zod';
import {
    createDiagnosticRequestSchema,
    updateDiagnosticRequestSchema,
    approveDiagnosticResultSchema,
    createLabOrderSchema,
    updateLabOrderSchema,
    createLabResultSchema,
    updateLabResultSchema,
    drugInteractionCheckSchema,
    fhirImportSchema,
    clinicalValidators,
    sanitizeInput
} from '../validators/diagnosticValidators';

describe('Diagnostic Validators', () => {
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
                },
                currentMedications: [{
                    name: 'Paracetamol',
                    dosage: '500mg',
                    frequency: 'TID'
                }],
                allergies: ['Penicillin'],
                medicalHistory: ['Hypertension']
            },
            consentObtained: true
        };

        it('should validate correct diagnostic request data', () => {
            const result = createDiagnosticRequestSchema.safeParse(validRequestData);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.priority).toBe('routine'); // default value
                expect(result.data.promptVersion).toBe('v1.0'); // default value
            }
        });

        it('should require patient consent', () => {
            const invalidData = { ...validRequestData, consentObtained: false };
            const result = createDiagnosticRequestSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('consent');
            }
        });

        it('should require at least one subjective symptom', () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    symptoms: {
                        ...validRequestData.inputSnapshot.symptoms,
                        subjective: []
                    }
                }
            };

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

        it('should validate vital signs ranges', () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    vitals: {
                        heartRate: 300, // Invalid heart rate
                        temperature: 50 // Invalid temperature
                    }
                }
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should limit array sizes', () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    symptoms: {
                        ...validRequestData.inputSnapshot.symptoms,
                        subjective: new Array(25).fill('symptom') // Too many symptoms
                    }
                }
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate medication entries', () => {
            const invalidData = {
                ...validRequestData,
                inputSnapshot: {
                    ...validRequestData.inputSnapshot,
                    currentMedications: [{
                        name: '', // Empty name
                        dosage: '500mg',
                        frequency: 'TID'
                    }]
                }
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate MongoDB ObjectId format', () => {
            const invalidData = { ...validRequestData, patientId: 'invalid-id' };
            const result = createDiagnosticRequestSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });
    });

    describe('approveDiagnosticResultSchema', () => {
        it('should validate approval with modifications', () => {
            const approvalData = {
                status: 'modified',
                modifications: 'Updated dosage recommendations',
                reviewNotes: 'Looks good overall'
            };

            const result = approveDiagnosticResultSchema.safeParse(approvalData);
            expect(result.success).toBe(true);
        });

        it('should require rejection reason for rejected status', () => {
            const rejectionData = {
                status: 'rejected'
                // Missing rejectionReason
            };

            const result = approveDiagnosticResultSchema.safeParse(rejectionData);
            expect(result.success).toBe(false);
        });

        it('should require modifications for modified status', () => {
            const modificationData = {
                status: 'modified'
                // Missing modifications
            };

            const result = approveDiagnosticResultSchema.safeParse(modificationData);
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

            if (result.success) {
                expect(result.data.tests[0].code).toBe('CBC'); // Should be uppercase
                expect(result.data.insurancePreAuth).toBe(false); // default value
            }
        });

        it('should require at least one test', () => {
            const invalidData = { ...validOrderData, tests: [] };
            const result = createLabOrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });

        it('should validate LOINC code format', () => {
            const invalidData = {
                ...validOrderData,
                tests: [{
                    ...validOrderData.tests[0],
                    loincCode: 'invalid-loinc'
                }]
            };

            const result = createLabOrderSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should limit number of tests', () => {
            const invalidData = {
                ...validOrderData,
                tests: new Array(25).fill(validOrderData.tests[0]) // Too many tests
            };

            const result = createLabOrderSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should transform test codes to uppercase', () => {
            const dataWithLowercase = {
                ...validOrderData,
                tests: [{
                    ...validOrderData.tests[0],
                    code: 'cbc'
                }]
            };

            const result = createLabOrderSchema.safeParse(dataWithLowercase);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.tests[0].code).toBe('CBC');
            }
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

            if (result.success) {
                expect(result.data.testCode).toBe('HGB'); // Should be uppercase
                expect(result.data.source).toBe('manual'); // default value
                expect(result.data.followUpRequired).toBe(false); // default value
            }
        });

        it('should require reference range', () => {
            const invalidData = { ...validResultData };
            delete invalidData.referenceRange;

            const result = createLabResultSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate reference range has numeric range or text', () => {
            const invalidData = {
                ...validResultData,
                referenceRange: {} // Empty reference range
            };

            const result = createLabResultSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate LOINC code format', () => {
            const invalidData = {
                ...validResultData,
                loincCode: 'invalid-loinc'
            };

            const result = createLabResultSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should transform dates correctly', () => {
            const result = createLabResultSchema.safeParse(validResultData);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.performedAt).toBeInstanceOf(Date);
            }
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

        it('should limit number of medications', () => {
            const invalidData = {
                ...validInteractionData,
                medications: new Array(25).fill('Medication') // Too many medications
            };

            const result = drugInteractionCheckSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate age ranges', () => {
            const invalidData = { ...validInteractionData, patientAge: 200 };
            const result = drugInteractionCheckSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });
    });

    describe('fhirImportSchema', () => {
        const validFhirData = {
            fhirBundle: {
                resourceType: 'Bundle',
                entry: []
            },
            patientMapping: {
                externalPatientId: 'EXT123',
                internalPatientId: '507f1f77bcf86cd799439011'
            }
        };

        it('should validate correct FHIR import data', () => {
            const result = fhirImportSchema.safeParse(validFhirData);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.validateOnly).toBe(false); // default value
                expect(result.data.overwriteExisting).toBe(false); // default value
            }
        });

        it('should allow FHIR bundle passthrough', () => {
            const complexFhirData = {
                fhirBundle: {
                    resourceType: 'Bundle',
                    entry: [
                        { resource: { resourceType: 'Patient' } },
                        { resource: { resourceType: 'Observation' } }
                    ]
                }
            };

            const result = fhirImportSchema.safeParse(complexFhirData);
            expect(result.success).toBe(true);
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

            it('should flag dangerous temperature', () => {
                const vitals = { temperature: 43 }; // Dangerous temperature

                expect(() => clinicalValidators.validateVitalSigns(vitals)).toThrow();
            });

            it('should flag critical vital signs combination', () => {
                const vitals = {
                    heartRate: 160,
                    oxygenSaturation: 85 // Critical combination
                };

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

        describe('validateLabResult', () => {
            it('should validate normal lab result', () => {
                const result = {
                    numericValue: 15,
                    referenceRange: { low: 12, high: 16 }
                };

                expect(() => clinicalValidators.validateLabResult(result)).not.toThrow();
            });

            it('should reject invalid reference range', () => {
                const result = {
                    numericValue: 15,
                    referenceRange: { low: 16, high: 12 } // Low > High
                };

                expect(() => clinicalValidators.validateLabResult(result)).toThrow();
            });

            it('should flag extremely abnormal values', () => {
                const result = {
                    numericValue: 0.5, // Extremely low (< 10% of low range)
                    referenceRange: { low: 12, high: 16 }
                };

                expect(() => clinicalValidators.validateLabResult(result)).toThrow();
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

            it('should remove javascript protocols', () => {
                const maliciousText = 'Click javascript:alert("xss") for more info';
                const sanitized = sanitizeInput.sanitizeClinicalText(maliciousText);

                expect(sanitized).not.toContain('javascript:');
            });

            it('should remove event handlers', () => {
                const maliciousText = 'Patient onclick="alert()" has symptoms';
                const sanitized = sanitizeInput.sanitizeClinicalText(maliciousText);

                expect(sanitized).not.toContain('onclick=');
            });
        });

        describe('sanitizeMedicationName', () => {
            it('should remove HTML special characters', () => {
                const maliciousName = 'Aspirin<script>alert()</script>';
                const sanitized = sanitizeInput.sanitizeMedicationName(maliciousName);

                expect(sanitized).toBe('Aspirin');
            });

            it('should normalize whitespace', () => {
                const messyName = 'Aspirin    500mg   tablets';
                const sanitized = sanitizeInput.sanitizeMedicationName(messyName);

                expect(sanitized).toBe('Aspirin 500mg tablets');
            });
        });

        describe('sanitizeNumericValue', () => {
            it('should keep only numeric characters', () => {
                const messyValue = 'abc12.5def';
                const sanitized = sanitizeInput.sanitizeNumericValue(messyValue);

                expect(sanitized).toBe('12.5');
            });

            it('should handle negative values', () => {
                const negativeValue = '--12.5';
                const sanitized = sanitizeInput.sanitizeNumericValue(negativeValue);

                expect(sanitized).toBe('-12.5');
            });

            it('should handle multiple decimal points', () => {
                const messyValue = '12.5.6.7';
                const sanitized = sanitizeInput.sanitizeNumericValue(messyValue);

                expect(sanitized).toBe('12.567');
            });
        });
    });

    describe('Error Handling', () => {
        it('should provide detailed error messages', () => {
            const invalidData = {
                patientId: 'invalid',
                inputSnapshot: {
                    symptoms: {
                        subjective: [],
                        duration: '',
                        severity: 'invalid',
                        onset: 'invalid'
                    }
                },
                consentObtained: false
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);

            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(1);
                expect(result.error.issues.some(issue => issue.path.includes('patientId'))).toBe(true);
                expect(result.error.issues.some(issue => issue.path.includes('consentObtained'))).toBe(true);
            }
        });

        it('should handle nested validation errors', () => {
            const invalidData = {
                patientId: '507f1f77bcf86cd799439011',
                inputSnapshot: {
                    symptoms: {
                        subjective: ['valid symptom'],
                        duration: '2 days',
                        severity: 'moderate',
                        onset: 'acute'
                    },
                    vitals: {
                        heartRate: 500 // Invalid
                    }
                },
                consentObtained: true
            };

            const result = createDiagnosticRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);

            if (!result.success) {
                const heartRateError = result.error.issues.find(
                    issue => issue.path.includes('heartRate')
                );
                expect(heartRateError).toBeDefined();
            }
        });
    });
});