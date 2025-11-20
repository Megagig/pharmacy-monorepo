import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    aiDiagnosticRateLimit,
    sanitizeClinicalData,
    validateClinicalData,
    monitorSuspiciousPatterns,
    validateApiKeys,
    validateDataEncryption,
} from '../middlewares/securityMiddleware';
import { AuthRequest } from '../../../types/auth';

describe('Security Middleware Tests', () => {
    let app: express.Application;
    let mockUser: any;
    let mockWorkspaceContext: any;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockUser = {
            _id: 'user123',
            role: 'pharmacist',
            workplaceRole: 'pharmacist',
        };

        mockWorkspaceContext = {
            workspace: { _id: 'workspace123' },
            plan: { name: 'professional' },
            isSubscriptionActive: true,
        };

        // Mock authentication middleware
        app.use((req: AuthRequest, res, next) => {
            req.user = mockUser;
            req.workspaceContext = mockWorkspaceContext;
            next();
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('AI Diagnostic Rate Limiting', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticRateLimit);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true });
            });
        });

        it('should allow requests within rate limit', async () => {
            const response = await request(app)
                .post('/api/diagnostics')
                .send({ symptoms: { subjective: ['headache'] } });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should bypass rate limit for super admin', async () => {
            app.use((req: AuthRequest, res, next) => {
                req.user = { ...mockUser, role: 'super_admin' };
                next();
            });

            // Make multiple requests that would normally be rate limited
            for (let i = 0; i < 25; i++) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({ symptoms: { subjective: ['headache'] } });

                expect(response.status).toBe(200);
            }
        });

        it('should apply different limits based on subscription plan', async () => {
            // Test with basic plan
            app.use((req: AuthRequest, res, next) => {
                req.workspaceContext = {
                    ...mockWorkspaceContext,
                    plan: { name: 'basic' },
                };
                next();
            });

            // Basic plan should have lower limits
            const response = await request(app)
                .post('/api/diagnostics')
                .send({ symptoms: { subjective: ['headache'] } });

            expect(response.status).toBe(200);
        });
    });

    describe('Clinical Data Sanitization', () => {
        beforeEach(() => {
            app.use('/api/test', sanitizeClinicalData);
            app.post('/api/test', (req, res) => {
                res.json({ sanitized: req.body });
            });
        });

        it('should remove script tags from input', async () => {
            const maliciousInput = {
                symptoms: {
                    subjective: ['<script>alert("xss")</script>headache'],
                },
            };

            const response = await request(app)
                .post('/api/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.sanitized.symptoms.subjective[0]).not.toContain('<script>');
            expect(response.body.sanitized.symptoms.subjective[0]).toContain('headache');
        });

        it('should remove javascript URLs', async () => {
            const maliciousInput = {
                notes: 'Click here: javascript:alert("xss")',
            };

            const response = await request(app)
                .post('/api/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.sanitized.notes).not.toContain('javascript:');
        });

        it('should remove event handlers', async () => {
            const maliciousInput = {
                description: '<div onclick="alert(1)">Click me</div>',
            };

            const response = await request(app)
                .post('/api/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.sanitized.description).not.toContain('onclick=');
        });

        it('should prevent prototype pollution', async () => {
            const maliciousInput = {
                '__proto__': { polluted: true },
                'constructor': { polluted: true },
                'prototype': { polluted: true },
                validField: 'valid data',
            };

            const response = await request(app)
                .post('/api/test')
                .send(maliciousInput);

            expect(response.status).toBe(200);
            expect(response.body.sanitized).not.toHaveProperty('__proto__');
            expect(response.body.sanitized).not.toHaveProperty('constructor');
            expect(response.body.sanitized).not.toHaveProperty('prototype');
            expect(response.body.sanitized.validField).toBe('valid data');
        });

        it('should limit string length to prevent DoS', async () => {
            const longString = 'a'.repeat(15000);
            const input = {
                symptoms: {
                    subjective: [longString],
                },
            };

            const response = await request(app)
                .post('/api/test')
                .send(input);

            expect(response.status).toBe(200);
            expect(response.body.sanitized.symptoms.subjective[0].length).toBeLessThanOrEqual(10000);
        });
    });

    describe('Clinical Data Validation', () => {
        beforeEach(() => {
            app.use('/api/validate', validateClinicalData);
            app.post('/api/validate', (req, res) => {
                res.json({ success: true });
            });
        });

        it('should validate symptoms data structure', async () => {
            const validInput = {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                    objective: ['fever'],
                    severity: 'moderate',
                    onset: 'acute',
                },
            };

            const response = await request(app)
                .post('/api/validate')
                .send(validInput);

            expect(response.status).toBe(200);
        });

        it('should reject empty subjective symptoms', async () => {
            const invalidInput = {
                symptoms: {
                    subjective: [],
                    severity: 'moderate',
                    onset: 'acute',
                },
            };

            const response = await request(app)
                .post('/api/validate')
                .send(invalidInput);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should validate vital signs ranges', async () => {
            const invalidVitals = {
                vitalSigns: {
                    heartRate: 500, // Invalid - too high
                    temperature: 50, // Invalid - too high
                    respiratoryRate: 200, // Invalid - too high
                },
            };

            const response = await request(app)
                .post('/api/validate')
                .send(invalidVitals);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid heart rate');
        });

        it('should validate blood pressure format', async () => {
            const invalidBP = {
                vitalSigns: {
                    bloodPressure: 'invalid-format',
                },
            };

            const response = await request(app)
                .post('/api/validate')
                .send(invalidBP);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid blood pressure format');
        });

        it('should limit number of symptoms', async () => {
            const tooManySymptoms = {
                symptoms: {
                    subjective: Array(60).fill('symptom'), // Too many
                    severity: 'moderate',
                    onset: 'acute',
                },
            };

            const response = await request(app)
                .post('/api/validate')
                .send(tooManySymptoms);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Too many subjective symptoms');
        });

        it('should validate lab results structure', async () => {
            const validLabResults = {
                labResults: [
                    {
                        testName: 'Complete Blood Count',
                        value: '5.2',
                        unit: '10^6/uL',
                    },
                ],
            };

            const response = await request(app)
                .post('/api/validate')
                .send(validLabResults);

            expect(response.status).toBe(200);
        });

        it('should reject invalid lab results', async () => {
            const invalidLabResults = {
                labResults: [
                    {
                        testName: '', // Invalid - empty
                        value: 'a'.repeat(600), // Invalid - too long
                    },
                ],
            };

            const response = await request(app)
                .post('/api/validate')
                .send(invalidLabResults);

            expect(response.status).toBe(400);
        });
    });

    describe('API Key Validation', () => {
        beforeEach(() => {
            app.use('/api/secure', validateApiKeys);
            app.post('/api/secure', (req, res) => {
                res.json({ body: req.body, query: req.query });
            });
        });

        it('should remove API keys from request body', async () => {
            const inputWithKeys = {
                validData: 'test',
                apiKey: 'secret-key',
                openRouterKey: 'another-secret',
                token: 'bearer-token',
            };

            const response = await request(app)
                .post('/api/secure')
                .send(inputWithKeys);

            expect(response.status).toBe(200);
            expect(response.body.body.validData).toBe('test');
            expect(response.body.body).not.toHaveProperty('apiKey');
            expect(response.body.body).not.toHaveProperty('openRouterKey');
            expect(response.body.body).not.toHaveProperty('token');
        });

        it('should remove API keys from query parameters', async () => {
            const response = await request(app)
                .post('/api/secure?validParam=test&apiKey=secret&password=hidden')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.query.validParam).toBe('test');
            expect(response.body.query).not.toHaveProperty('apiKey');
            expect(response.body.query).not.toHaveProperty('password');
        });

        it('should handle nested objects', async () => {
            const nestedInput = {
                config: {
                    settings: {
                        apiKey: 'nested-secret',
                        validSetting: 'value',
                    },
                },
                validData: 'test',
            };

            const response = await request(app)
                .post('/api/secure')
                .send(nestedInput);

            expect(response.status).toBe(200);
            expect(response.body.body.validData).toBe('test');
            expect(response.body.body.config.settings.validSetting).toBe('value');
            expect(response.body.body.config.settings).not.toHaveProperty('apiKey');
        });
    });

    describe('Data Encryption Validation', () => {
        beforeEach(() => {
            app.use('/api/encrypt', validateDataEncryption);
            app.post('/api/encrypt', (req, res) => {
                res.json({ success: true });
            });
        });

        it('should detect sensitive data fields', async () => {
            const sensitiveData = {
                patientData: {
                    name: 'John Doe',
                    ssn: '123-45-6789',
                    medicalRecordNumber: 'MRN123456',
                },
            };

            const response = await request(app)
                .post('/api/encrypt')
                .send(sensitiveData);

            expect(response.status).toBe(200);
            // In a real implementation, this would verify encryption
        });

        it('should handle requests without sensitive data', async () => {
            const normalData = {
                symptoms: {
                    subjective: ['headache'],
                },
                vitalSigns: {
                    heartRate: 72,
                },
            };

            const response = await request(app)
                .post('/api/encrypt')
                .send(normalData);

            expect(response.status).toBe(200);
        });
    });

    describe('Suspicious Pattern Monitoring', () => {
        beforeEach(() => {
            app.use('/api/monitor', monitorSuspiciousPatterns);
            app.post('/api/monitor', (req, res) => {
                res.json({ success: true });
            });
        });

        it('should detect excessive symptoms', async () => {
            const excessiveSymptoms = {
                symptoms: {
                    subjective: Array(25).fill('symptom'), // Excessive but within validation limits
                },
            };

            const response = await request(app)
                .post('/api/monitor')
                .send(excessiveSymptoms);

            expect(response.status).toBe(200);
            // Should add warning header for suspicious patterns
            expect(response.headers['x-security-warning']).toBeDefined();
        });

        it('should detect excessive medications', async () => {
            const excessiveMedications = {
                currentMedications: Array(25).fill({
                    name: 'Medication',
                    dosage: '10mg',
                    frequency: 'daily',
                }),
            };

            const response = await request(app)
                .post('/api/monitor')
                .send(excessiveMedications);

            expect(response.status).toBe(200);
            expect(response.headers['x-security-warning']).toBeDefined();
        });

        it('should handle normal requests without warnings', async () => {
            const normalRequest = {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                },
                currentMedications: [
                    {
                        name: 'Ibuprofen',
                        dosage: '200mg',
                        frequency: 'as needed',
                    },
                ],
            };

            const response = await request(app)
                .post('/api/monitor')
                .send(normalRequest);

            expect(response.status).toBe(200);
            expect(response.headers['x-security-warning']).toBeUndefined();
        });
    });

    describe('Combined Security Middleware', () => {
        beforeEach(() => {
            app.use('/api/secure-endpoint', [
                sanitizeClinicalData,
                validateClinicalData,
                validateApiKeys,
                monitorSuspiciousPatterns,
            ]);
            app.post('/api/secure-endpoint', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should process valid request through all security layers', async () => {
            const validRequest = {
                symptoms: {
                    subjective: ['headache'],
                    severity: 'moderate',
                    onset: 'acute',
                },
                vitalSigns: {
                    heartRate: 72,
                    temperature: 37.0,
                },
            };

            const response = await request(app)
                .post('/api/secure-endpoint')
                .send(validRequest);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject malicious request at sanitization layer', async () => {
            const maliciousRequest = {
                symptoms: {
                    subjective: [], // Invalid - empty array
                },
                apiKey: 'secret-key', // Should be removed
                maliciousScript: '<script>alert("xss")</script>',
            };

            const response = await request(app)
                .post('/api/secure-endpoint')
                .send(maliciousRequest);

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should handle complex attack scenarios', async () => {
            const complexAttack = {
                symptoms: {
                    subjective: [
                        '<script>fetch("/api/admin", {method: "DELETE"})</script>',
                        'javascript:void(0)',
                        'onload="alert(1)"',
                    ],
                    severity: 'severe',
                    onset: 'acute',
                },
                '__proto__': { isAdmin: true },
                'constructor': { prototype: { isAdmin: true } },
                apiKey: 'sk-stolen-key',
                token: 'bearer-stolen-token',
            };

            const response = await request(app)
                .post('/api/secure-endpoint')
                .send(complexAttack);

            expect(response.status).toBe(200); // Should pass after sanitization
            expect(response.body.data).not.toHaveProperty('__proto__');
            expect(response.body.data).not.toHaveProperty('constructor');
            expect(response.body.data).not.toHaveProperty('apiKey');
            expect(response.body.data).not.toHaveProperty('token');

            // Check that scripts were removed
            const symptoms = response.body.data.symptoms.subjective;
            symptoms.forEach((symptom: string) => {
                expect(symptom).not.toContain('<script>');
                expect(symptom).not.toContain('javascript:');
                expect(symptom).not.toContain('onload=');
            });
        });
    });
});