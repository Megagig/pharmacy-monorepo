import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';

// Import middlewares to test
import communicationRBAC from '../../middlewares/communicationRBAC';
import communicationRateLimiting from '../../middlewares/communicationRateLimiting';
import communicationSecurity from '../../middlewares/communicationSecurity';
import communicationCSRF from '../../middlewares/communicationCSRF';
import communicationSessionManagement from '../../middlewares/communicationSessionManagement';

// Import models
import User from '../../models/User';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import Workplace from '../../models/Workplace';

describe('Communication Security Tests', () => {
    let mongoServer: MongoMemoryServer;
    let app: express.Application;
    let testUser: any;
    let testWorkplace: any;
    let testConversation: any;
    let authToken: string;

    beforeAll(async () => {
        // Setup in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test app
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Setup test data
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'Test Country',
            },
            contactInfo: {
                phone: '+1234567890',
                email: 'test@pharmacy.com',
            },
        });

        testUser = await User.create({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'test@pharmacy.com',
            password: 'hashedPassword123',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            workplaceRole: 'admin',
            isEmailVerified: true,
        });

        testConversation = await Conversation.create({
            type: 'group',
            participants: [
                {
                    userId: testUser._id,
                    role: 'pharmacist',
                    joinedAt: new Date(),
                },
            ],
            workplaceId: testWorkplace._id,
            createdBy: testUser._id,
        });

        // Generate auth token
        authToken = jwt.sign(
            {
                id: testUser._id,
                workplaceId: testWorkplace._id,
                role: testUser.role,
            },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('RBAC Security Tests', () => {
        beforeEach(() => {
            // Setup test routes with RBAC
            app.get('/test/conversation/:id',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRBAC.requireConversationAccess('canViewConversation'),
                (req, res) => res.json({ success: true })
            );

            app.post('/test/message/:id/edit',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRBAC.requireMessageAccess('canEditMessage'),
                (req, res) => res.json({ success: true })
            );
        });

        test('should allow conversation access for participants', async () => {
            const response = await request(app)
                .get(`/test/conversation/${testConversation._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should deny conversation access for non-participants', async () => {
            // Create another user not in conversation
            const otherUser = await User.create({
                firstName: 'Other',
                lastName: 'User',
                email: 'other@pharmacy.com',
                password: 'hashedPassword123',
                role: 'patient',
                workplaceId: testWorkplace._id,
                isEmailVerified: true,
            });

            app.get('/test/conversation-deny/:id',
                (req: any, res, next) => {
                    req.user = otherUser;
                    next();
                },
                communicationRBAC.requireConversationAccess('canViewConversation'),
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .get(`/test/conversation-deny/${testConversation._id}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        test('should validate participant roles correctly', async () => {
            app.post('/test/validate-participants',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRBAC.validateParticipantRoles,
                (req, res) => res.json({ success: true })
            );

            // Test invalid role combination
            const response = await request(app)
                .post('/test/validate-participants')
                .send({
                    participants: [
                        { userId: testUser._id, role: 'patient' }
                    ]
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('healthcare provider');
        });
    });

    describe('Rate Limiting Security Tests', () => {
        beforeEach(() => {
            // Setup test routes with rate limiting
            app.post('/test/message-rate-limit',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRateLimiting.messageRateLimit,
                (req, res) => res.json({ success: true })
            );

            app.post('/test/burst-protection',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRateLimiting.burstProtection,
                (req, res) => res.json({ success: true })
            );
        });

        test('should enforce message rate limits', async () => {
            // Send messages rapidly to trigger rate limit
            const promises = Array(35).fill(0).map(() =>
                request(app)
                    .post('/test/message-rate-limit')
                    .send({ content: { text: 'Test message', type: 'text' } })
            );

            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(r => r.status === 429);

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });

        test('should detect message bursts', async () => {
            // Send messages in rapid succession
            const promises = Array(6).fill(0).map(() =>
                request(app)
                    .post('/test/burst-protection')
                    .send({ content: { text: 'Burst message', type: 'text' } })
            );

            const responses = await Promise.all(promises);
            const burstBlocked = responses.some(r =>
                r.status === 429 && r.body.code === 'MESSAGE_BURST_DETECTED'
            );

            expect(burstBlocked).toBe(true);
        });

        test('should detect spam patterns', async () => {
            app.post('/test/spam-detection',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationRateLimiting.spamDetection,
                (req, res) => {
                    if ((req as any).potentialSpam) {
                        res.json({ success: true, spam: true });
                    } else {
                        res.json({ success: true, spam: false });
                    }
                }
            );

            const spamMessage = 'AAAAAAAAAAAAAAAAAAAAAA!!!!!!!!!!!!';
            const response = await request(app)
                .post('/test/spam-detection')
                .send({ content: { text: spamMessage, type: 'text' } });

            expect(response.body.spam).toBe(true);
        });
    });

    describe('Input Sanitization Security Tests', () => {
        beforeEach(() => {
            app.post('/test/sanitize-message',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationSecurity.sanitizeMessageContent,
                (req, res) => res.json({
                    success: true,
                    sanitizedContent: req.body.content
                })
            );

            app.post('/test/validate-input',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationSecurity.validateCommunicationInput,
                (req, res) => res.json({ success: true })
            );
        });

        test('should sanitize XSS attempts in messages', async () => {
            const maliciousContent = '<script>alert("XSS")</script>Hello';

            const response = await request(app)
                .post('/test/sanitize-message')
                .send({
                    content: {
                        text: maliciousContent,
                        type: 'text'
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.sanitizedContent.text).not.toContain('<script>');
            expect(response.body.sanitizedContent.text).not.toContain('alert');
        });

        test('should detect XSS patterns', async () => {
            const xssPayload = 'javascript:alert("XSS")';

            const response = await request(app)
                .post('/test/validate-input')
                .send({
                    content: {
                        text: xssPayload,
                        type: 'text'
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid input detected');
        });

        test('should prevent NoSQL injection', async () => {
            app.post('/test/nosql-injection',
                communicationSecurity.preventNoSQLInjection,
                (req, res) => res.json({
                    success: true,
                    body: req.body
                })
            );

            const maliciousQuery = {
                $where: 'function() { return true; }',
                userId: { $ne: null }
            };

            const response = await request(app)
                .post('/test/nosql-injection')
                .send(maliciousQuery);

            expect(response.body.body).not.toHaveProperty('$where');
            expect(response.body.body.userId).not.toHaveProperty('$ne');
        });

        test('should validate file uploads', async () => {
            app.post('/test/file-validation',
                communicationSecurity.validateFileUpload,
                (req, res) => res.json({ success: true })
            );

            // Mock dangerous file
            const response = await request(app)
                .post('/test/file-validation')
                .attach('files', Buffer.from('fake exe content'), 'malware.exe');

            expect(response.status).toBe(400);
            expect(response.body.errors).toContain('malware.exe: Executable files not allowed');
        });
    });

    describe('CSRF Protection Tests', () => {
        beforeEach(() => {
            app.get('/test/csrf-token',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationCSRF.provideCSRFToken
            );

            app.post('/test/csrf-protected',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationCSRF.requireCSRFToken,
                (req, res) => res.json({ success: true })
            );

            app.post('/test/origin-validation',
                communicationCSRF.validateOrigin,
                (req, res) => res.json({ success: true })
            );
        });

        test('should provide CSRF token', async () => {
            const response = await request(app)
                .get('/test/csrf-token')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.csrfToken).toBeDefined();
            expect(response.body.expires).toBeDefined();
        });

        test('should reject requests without CSRF token', async () => {
            const response = await request(app)
                .post('/test/csrf-protected')
                .send({ data: 'test' });

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
        });

        test('should validate origin header', async () => {
            const response = await request(app)
                .post('/test/origin-validation')
                .set('Origin', 'https://malicious-site.com')
                .send({ data: 'test' });

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('ORIGIN_MISMATCH');
        });
    });

    describe('Session Management Security Tests', () => {
        beforeEach(() => {
            app.post('/test/create-session',
                (req: any, res, next) => {
                    req.user = testUser;
                    req.sessionID = 'test-session-123';
                    next();
                },
                (req, res) => {
                    const session = communicationSessionManagement.createUserSession(
                        testUser._id.toString(),
                        'test-session-123',
                        req
                    );
                    res.json({ success: true, session });
                }
            );

            app.get('/test/validate-session',
                (req: any, res, next) => {
                    req.user = testUser;
                    req.sessionID = 'test-session-123';
                    next();
                },
                communicationSessionManagement.validateSession,
                (req, res) => res.json({ success: true })
            );
        });

        test('should create user session', async () => {
            const response = await request(app)
                .post('/test/create-session')
                .set('User-Agent', 'Test Browser');

            expect(response.status).toBe(200);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.sessionId).toBe('test-session-123');
        });

        test('should validate active session', async () => {
            // First create session
            await request(app)
                .post('/test/create-session')
                .set('User-Agent', 'Test Browser');

            // Then validate it
            const response = await request(app)
                .get('/test/validate-session')
                .set('User-Agent', 'Test Browser');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should detect device fingerprint mismatch', async () => {
            // Create session with one user agent
            await request(app)
                .post('/test/create-session')
                .set('User-Agent', 'Test Browser 1.0');

            // Try to validate with different user agent
            const response = await request(app)
                .get('/test/validate-session')
                .set('User-Agent', 'Different Browser 2.0');

            expect(response.status).toBe(401);
            expect(response.body.reason).toBe('device_mismatch');
        });

        test('should enforce concurrent session limits', async () => {
            app.post('/test/session-limit',
                (req: any, res, next) => {
                    req.user = testUser;
                    next();
                },
                communicationSessionManagement.enforceConcurrentSessionLimit,
                (req, res) => res.json({ success: true })
            );

            // Create multiple sessions to exceed limit
            for (let i = 0; i < 6; i++) {
                communicationSessionManagement.createUserSession(
                    testUser._id.toString(),
                    `session-${i}`,
                    {
                        ip: '127.0.0.1',
                        get: () => 'Test Browser',
                        connection: { remoteAddress: '127.0.0.1' }
                    } as any
                );
            }

            const response = await request(app)
                .post('/test/session-limit');

            expect(response.status).toBe(429);
            expect(response.body.code).toBe('TOO_MANY_SESSIONS');
        });
    });

    describe('Penetration Testing Scenarios', () => {
        test('should resist SQL injection attempts', async () => {
            app.get('/test/sql-injection',
                communicationSecurity.preventNoSQLInjection,
                (req, res) => res.json({
                    success: true,
                    query: req.query
                })
            );

            const sqlInjectionAttempts = [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "admin'/*",
                "' UNION SELECT * FROM users --"
            ];

            for (const injection of sqlInjectionAttempts) {
                const response = await request(app)
                    .get('/test/sql-injection')
                    .query({ search: injection });

                expect(response.status).toBe(200);
                expect(response.body.query.search).not.toContain('DROP');
                expect(response.body.query.search).not.toContain('UNION');
            }
        });

        test('should resist XSS attempts', async () => {
            const xssPayloads = [
                '<script>alert("XSS")</script>',
                'javascript:alert("XSS")',
                '<img src="x" onerror="alert(\'XSS\')">',
                '<svg onload="alert(\'XSS\')">',
                '"><script>alert("XSS")</script>'
            ];

            for (const payload of xssPayloads) {
                const response = await request(app)
                    .post('/test/validate-input')
                    .send({
                        content: {
                            text: payload,
                            type: 'text'
                        }
                    });

                expect(response.status).toBe(400);
            }
        });

        test('should resist CSRF attacks', async () => {
            // Simulate cross-origin request without proper CSRF protection
            const response = await request(app)
                .post('/test/csrf-protected')
                .set('Origin', 'https://attacker-site.com')
                .send({ maliciousData: 'attack' });

            expect(response.status).toBe(403);
        });

        test('should resist session hijacking', async () => {
            // Create legitimate session
            const sessionId = 'legitimate-session';
            communicationSessionManagement.createUserSession(
                testUser._id.toString(),
                sessionId,
                {
                    ip: '192.168.1.100',
                    get: () => 'Legitimate Browser',
                    connection: { remoteAddress: '192.168.1.100' }
                } as any
            );

            // Try to use session from different IP/browser
            app.get('/test/session-hijack',
                (req: any, res, next) => {
                    req.user = testUser;
                    req.sessionID = sessionId;
                    next();
                },
                communicationSessionManagement.validateSession,
                (req, res) => res.json({ success: true })
            );

            const response = await request(app)
                .get('/test/session-hijack')
                .set('User-Agent', 'Attacker Browser')
                .set('X-Forwarded-For', '10.0.0.1');

            expect(response.status).toBe(401);
        });

        test('should resist brute force attacks', async () => {
            // Simulate multiple failed authentication attempts
            const attempts = Array(10).fill(0).map(() =>
                request(app)
                    .get('/test/validate-session')
                    .set('User-Agent', 'Brute Force Bot')
            );

            const responses = await Promise.all(attempts);
            const lockedResponses = responses.filter(r => r.status === 423);

            expect(lockedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Security Headers Tests', () => {
        beforeEach(() => {
            app.get('/test/security-headers',
                communicationSecurity.setCommunicationCSP,
                (req, res) => res.json({ success: true })
            );
        });

        test('should set proper security headers', async () => {
            const response = await request(app)
                .get('/test/security-headers');

            expect(response.headers['content-security-policy']).toBeDefined();
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        });
    });
});