import { describe, test, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import FHIRService, { FHIRBundle, FHIRObservation, FHIRServiceRequest } from '../services/fhirService';
import LabOrder from '../models/LabOrder';
import LabResult from '../models/LabResult';

describe('FHIR Integration Tests', () => {
    let workplaceId: string;
    let userId: string;
    let patientId: string;

    beforeEach(() => {
        // Create test IDs
        workplaceId = new mongoose.Types.ObjectId().toString();
        userId = new mongoose.Types.ObjectId().toString();
        patientId = new mongoose.Types.ObjectId().toString();
    });

    describe('FHIR Service', () => {
        test('should create FHIR service with valid configuration', () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);
            expect(fhirService).toBeDefined();
        });

        test('should handle OAuth2 authentication configuration', () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const authConfig = {
                type: 'oauth2' as const,
                tokenUrl: 'http://localhost:8080/auth/token',
                clientId: 'test-client',
                clientSecret: 'test-secret',
                scope: 'system/*.read system/*.write',
            };

            const fhirService = new FHIRService(config, authConfig);
            expect(fhirService).toBeDefined();
        });

        test('should process FHIR Observation correctly', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            const observation: FHIRObservation = {
                resourceType: 'Observation',
                id: 'test-obs-1',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '2345-7',
                        display: 'Glucose [Mass/volume] in Serum or Plasma',
                    }],
                    text: 'Glucose',
                },
                subject: {
                    reference: `Patient/${patientId}`,
                },
                effectiveDateTime: '2024-01-15T10:30:00Z',
                valueQuantity: {
                    value: 95,
                    unit: 'mg/dL',
                    system: 'http://unitsofmeasure.org',
                    code: 'mg/dL',
                },
                referenceRange: [{
                    low: {
                        value: 70,
                        unit: 'mg/dL',
                        system: 'http://unitsofmeasure.org',
                        code: 'mg/dL',
                    },
                    high: {
                        value: 100,
                        unit: 'mg/dL',
                        system: 'http://unitsofmeasure.org',
                        code: 'mg/dL',
                    },
                }],
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal',
                    }],
                }],
            };

            const bundle: FHIRBundle = {
                resourceType: 'Bundle',
                id: 'test-bundle-1',
                type: 'collection',
                entry: [{
                    resource: observation,
                }],
            };

            const patientMappings = [{
                fhirPatientId: patientId,
                internalPatientId: patientId,
                workplaceId,
            }];

            const result = await fhirService.importLabResults(bundle, patientMappings);

            expect(result.imported).toHaveLength(1);
            expect(result.failed).toHaveLength(0);
            expect(result.imported[0]?.type).toBe('observation');
            expect(result.imported[0]?.status).toBe('success');
        });

        test('should process FHIR ServiceRequest correctly', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            const serviceRequest: FHIRServiceRequest = {
                resourceType: 'ServiceRequest',
                id: 'test-sr-1',
                status: 'active',
                intent: 'order',
                priority: 'routine',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '2345-7',
                        display: 'Glucose [Mass/volume] in Serum or Plasma',
                    }],
                    text: 'Glucose',
                },
                subject: {
                    reference: `Patient/${patientId}`,
                },
                authoredOn: '2024-01-15T09:00:00Z',
                reasonCode: [{
                    text: 'Routine screening',
                    coding: [],
                }],
            };

            const bundle: FHIRBundle = {
                resourceType: 'Bundle',
                id: 'test-bundle-2',
                type: 'collection',
                entry: [{
                    resource: serviceRequest,
                }],
            };

            const patientMappings = [{
                fhirPatientId: patientId,
                internalPatientId: patientId,
                workplaceId,
            }];

            const result = await fhirService.importLabResults(bundle, patientMappings);

            expect(result.imported).toHaveLength(1);
            expect(result.failed).toHaveLength(0);
            expect(result.imported[0]?.type).toBe('serviceRequest');
            expect(result.imported[0]?.status).toBe('success');
        });

        test('should handle invalid FHIR resources gracefully', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            const invalidObservation = {
                resourceType: 'Observation',
                id: 'invalid-obs',
                status: 'final',
                // Missing required code field - this should cause failure
                subject: {
                    reference: `Patient/${patientId}`,
                },
            };

            const bundle: FHIRBundle = {
                resourceType: 'Bundle',
                id: 'test-bundle-invalid',
                type: 'collection',
                entry: [{
                    resource: invalidObservation as any,
                }],
            };

            const patientMappings = [{
                fhirPatientId: patientId, // This should match the patient reference
                internalPatientId: patientId,
                workplaceId,
            }];

            const result = await fhirService.importLabResults(bundle, patientMappings);

            expect(result.imported).toHaveLength(0);
            expect(result.failed).toHaveLength(1);
            expect(result.failed[0]?.status).toBe('failed');
            expect(result.failed[0]?.error).toBeDefined();
        });

        test('should export lab order to FHIR ServiceRequest', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            // Create a lab order
            const labOrder = new LabOrder({
                patientId: new mongoose.Types.ObjectId(patientId),
                orderedBy: new mongoose.Types.ObjectId(userId),
                workplaceId: new mongoose.Types.ObjectId(workplaceId),
                tests: [{
                    code: 'GLU',
                    name: 'Glucose',
                    loincCode: '2345-7',
                    indication: 'Routine screening',
                    priority: 'routine',
                }],
                status: 'ordered',
                orderDate: new Date(),
                // Required fields
                clinicalIndication: 'Routine screening',
                orderNumber: 'TEST-ORDER-001',
                createdBy: new mongoose.Types.ObjectId(userId),
            });

            await labOrder.save();

            const fhirServiceRequest = await fhirService.exportLabOrder(labOrder);

            expect(fhirServiceRequest.resourceType).toBe('ServiceRequest');
            expect(fhirServiceRequest.id).toBe(labOrder._id.toString());
            expect(fhirServiceRequest.status).toBe('active');
            expect(fhirServiceRequest.intent).toBe('order');
            expect(fhirServiceRequest.priority).toBe('routine');
            expect(fhirServiceRequest.code.coding).toHaveLength(1);
            expect(fhirServiceRequest.code.coding[0]?.code).toBe('2345-7');
            expect(fhirServiceRequest.subject.reference).toBe(`Patient/${patientId}`);
        });
    });

    // Note: API endpoint tests would require more complex setup with authentication
    // and database connections. These tests focus on the core FHIR service functionality.

    describe('FHIR Configuration', () => {
        test('should handle environment-based FHIR configuration', () => {
            // Set environment variables
            process.env.FHIR_BASE_URL = 'http://test.fhir.org/fhir';
            process.env.FHIR_VERSION = 'R4';
            process.env.FHIR_AUTH_TYPE = 'oauth2';
            process.env.FHIR_TOKEN_URL = 'http://test.fhir.org/auth/token';
            process.env.FHIR_CLIENT_ID = 'test-client';
            process.env.FHIR_CLIENT_SECRET = 'test-secret';

            const { getEnvironmentFHIRConfig } = require('../config/fhirConfig');
            const config = getEnvironmentFHIRConfig();

            expect(config).toBeDefined();
            expect(config.config.baseUrl).toBe('http://test.fhir.org/fhir');
            expect(config.config.version).toBe('R4');
            expect(config.auth?.type).toBe('oauth2');
            expect(config.auth?.tokenUrl).toBe('http://test.fhir.org/auth/token');
            expect(config.auth?.clientId).toBe('test-client');

            // Clean up
            delete process.env.FHIR_BASE_URL;
            delete process.env.FHIR_VERSION;
            delete process.env.FHIR_AUTH_TYPE;
            delete process.env.FHIR_TOKEN_URL;
            delete process.env.FHIR_CLIENT_ID;
            delete process.env.FHIR_CLIENT_SECRET;
        });

        test('should validate FHIR configuration', () => {
            const { validateFHIRConfig } = require('../config/fhirConfig');

            const validConfig = {
                id: 'test-server',
                name: 'Test FHIR Server',
                enabled: true,
                config: {
                    baseUrl: 'http://localhost:8080/fhir',
                    version: 'R4',
                    timeout: 30000,
                    retryAttempts: 3,
                },
                auth: {
                    type: 'oauth2',
                    tokenUrl: 'http://localhost:8080/auth/token',
                    clientId: 'test-client',
                    clientSecret: 'test-secret',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const validation = validateFHIRConfig(validConfig);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect invalid FHIR configuration', () => {
            const { validateFHIRConfig } = require('../config/fhirConfig');

            const invalidConfig = {
                // Missing required fields
                config: {
                    baseUrl: 'invalid-url',
                    version: 'InvalidVersion',
                    timeout: -1,
                    retryAttempts: 20,
                },
                auth: {
                    type: 'oauth2',
                    // Missing required OAuth2 fields
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const validation = validateFHIRConfig(invalidConfig);
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should sanitize FHIR configuration for client use', () => {
            const { sanitizeFHIRConfig } = require('../config/fhirConfig');

            const config = {
                id: 'test-server',
                name: 'Test FHIR Server',
                enabled: true,
                config: {
                    baseUrl: 'http://localhost:8080/fhir',
                    version: 'R4',
                    timeout: 30000,
                    retryAttempts: 3,
                },
                auth: {
                    type: 'oauth2',
                    tokenUrl: 'http://localhost:8080/auth/token',
                    clientId: 'test-client',
                    clientSecret: 'secret-should-be-removed',
                    scope: 'system/*.read',
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const sanitized = sanitizeFHIRConfig(config);

            expect(sanitized.id).toBe(config.id);
            expect(sanitized.name).toBe(config.name);
            expect(sanitized.config?.baseUrl).toBe(config.config.baseUrl);
            expect(sanitized.auth?.type).toBe('oauth2');
            expect(sanitized.auth?.tokenUrl).toBe(config.auth.tokenUrl);
            expect(sanitized.auth?.scope).toBe(config.auth.scope);

            // Sensitive data should be removed
            expect((sanitized.auth as any)?.clientSecret).toBeUndefined();
        });
    });

    describe('FHIR Data Mapping', () => {
        test('should correctly map FHIR Observation to internal LabResult', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            const observation: FHIRObservation = {
                resourceType: 'Observation',
                id: 'mapping-test-1',
                status: 'final',
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'laboratory',
                        display: 'Laboratory',
                    }],
                }],
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '2160-0',
                        display: 'Creatinine [Mass/volume] in Serum or Plasma',
                    }],
                    text: 'Creatinine',
                },
                subject: {
                    reference: `Patient/${patientId}`,
                    display: 'Test Patient',
                },
                effectiveDateTime: '2024-01-15T10:30:00Z',
                issued: '2024-01-15T11:00:00Z',
                valueQuantity: {
                    value: 1.2,
                    unit: 'mg/dL',
                    system: 'http://unitsofmeasure.org',
                    code: 'mg/dL',
                },
                referenceRange: [{
                    low: {
                        value: 0.6,
                        unit: 'mg/dL',
                        system: 'http://unitsofmeasure.org',
                        code: 'mg/dL',
                    },
                    high: {
                        value: 1.3,
                        unit: 'mg/dL',
                        system: 'http://unitsofmeasure.org',
                        code: 'mg/dL',
                    },
                    text: 'Normal range for adults',
                }],
                interpretation: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: 'N',
                        display: 'Normal',
                    }],
                    text: 'Normal',
                }],
                note: [{
                    text: 'Sample collected after 12-hour fast',
                }],
            };

            const bundle: FHIRBundle = {
                resourceType: 'Bundle',
                id: 'mapping-test-bundle',
                type: 'collection',
                entry: [{
                    resource: observation,
                }],
            };

            const patientMappings = [{
                fhirPatientId: patientId,
                internalPatientId: patientId,
                workplaceId,
            }];

            const result = await fhirService.importLabResults(bundle, patientMappings);

            expect(result.imported).toHaveLength(1);

            // Verify the imported lab result
            const importedResult = await LabResult.findById(result.imported[0]?.internalId);
            expect(importedResult).toBeDefined();
            expect(importedResult?.testCode).toBe('2160-0');
            expect(importedResult?.testName).toBe('Creatinine [Mass/volume] in Serum or Plasma');
            expect(importedResult?.loincCode).toBe('2160-0');
            expect(importedResult?.value).toBe('1.2');
            expect(importedResult?.numericValue).toBe(1.2);
            expect(importedResult?.unit).toBe('mg/dL');
            expect(importedResult?.referenceRange.low).toBe(0.6);
            expect(importedResult?.referenceRange.high).toBe(1.3);
            expect(importedResult?.interpretation).toBe('normal');
            expect(importedResult?.source).toBe('fhir');
            expect(importedResult?.externalResultId).toBe('mapping-test-1');
            expect(importedResult?.fhirReference).toBe('Observation/mapping-test-1');
            expect(importedResult?.technicalNotes).toBe('Sample collected after 12-hour fast');
        });

        test('should handle different FHIR value types', async () => {
            const config = {
                baseUrl: 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(config);

            // Test string value
            const stringObservation: FHIRObservation = {
                resourceType: 'Observation',
                id: 'string-value-test',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '33747-0',
                        display: 'General appearance',
                    }],
                },
                subject: {
                    reference: `Patient/${patientId}`,
                },
                effectiveDateTime: '2024-01-15T10:30:00Z',
                valueString: 'Well-appearing',
            };

            // Test coded value
            const codedObservation: FHIRObservation = {
                resourceType: 'Observation',
                id: 'coded-value-test',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '32451-7',
                        display: 'Physical findings',
                    }],
                },
                subject: {
                    reference: `Patient/${patientId}`,
                },
                effectiveDateTime: '2024-01-15T10:30:00Z',
                valueCodeableConcept: {
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '17621005',
                        display: 'Normal',
                    }],
                    text: 'Normal findings',
                },
            };

            const bundle: FHIRBundle = {
                resourceType: 'Bundle',
                id: 'value-types-test-bundle',
                type: 'collection',
                entry: [
                    { resource: stringObservation },
                    { resource: codedObservation },
                ],
            };

            const patientMappings = [{
                fhirPatientId: patientId,
                internalPatientId: patientId,
                workplaceId,
            }];

            const result = await fhirService.importLabResults(bundle, patientMappings);

            expect(result.imported).toHaveLength(2);
            expect(result.failed).toHaveLength(0);

            // Verify string value mapping
            const stringResult = await LabResult.findById(result.imported[0]?.internalId);
            expect(stringResult?.value).toBe('Well-appearing');
            expect(stringResult?.numericValue).toBeUndefined();

            // Verify coded value mapping
            const codedResult = await LabResult.findById(result.imported[1]?.internalId);
            expect(codedResult?.value).toBe('Normal findings');
            expect(codedResult?.numericValue).toBeUndefined();
        });
    });
});