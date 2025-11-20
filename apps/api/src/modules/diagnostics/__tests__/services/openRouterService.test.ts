import axios from 'axios';
import OpenRouterService, { DiagnosticInput, DiagnosticResponse } from '../../../../services/openRouterService';
import logger from '../../../../utils/logger';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('OpenRouterService', () => {
    let service: typeof OpenRouterService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset environment variables
        process.env.OPENROUTER_API_KEY = 'test-api-key';
        process.env.OPENROUTER_BASE_URL = 'https://test-openrouter.ai/api/v1';
        process.env.FRONTEND_URL = 'http://localhost:5173';

        // Re-import service to get fresh instance with new env vars
        jest.resetModules();
        service = require('../../../../services/openRouterService').default;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('generateDiagnosticAnalysis', () => {
        const mockInput: DiagnosticInput = {
            symptoms: {
                subjective: ['chest pain', 'shortness of breath'],
                objective: ['elevated heart rate'],
                duration: '2 hours',
                severity: 'moderate',
                onset: 'acute',
            },
            vitalSigns: {
                bloodPressure: '140/90',
                heartRate: 110,
                temperature: 37.2,
            },
            patientAge: 45,
            patientGender: 'male',
        };

        const mockValidResponse = {
            id: 'test-request-id',
            object: 'chat.completion',
            created: 1234567890,
            model: 'deepseek/deepseek-chat-v3.1:free',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: JSON.stringify({
                        differentialDiagnoses: [
                            {
                                condition: 'Acute Coronary Syndrome',
                                probability: 75,
                                reasoning: 'Chest pain with elevated heart rate in middle-aged male',
                                severity: 'high',
                            },
                        ],
                        recommendedTests: [
                            {
                                testName: 'ECG',
                                priority: 'urgent',
                                reasoning: 'Rule out acute MI',
                            },
                        ],
                        therapeuticOptions: [
                            {
                                medication: 'Aspirin',
                                dosage: '325mg',
                                frequency: 'once',
                                duration: 'immediate',
                                reasoning: 'Antiplatelet therapy for suspected ACS',
                                safetyNotes: ['Check for bleeding risk'],
                            },
                        ],
                        redFlags: [
                            {
                                flag: 'Chest pain with cardiac risk factors',
                                severity: 'high',
                                action: 'Immediate cardiology referral',
                            },
                        ],
                        referralRecommendation: {
                            recommended: true,
                            urgency: 'immediate',
                            specialty: 'Cardiology',
                            reason: 'Suspected acute coronary syndrome',
                        },
                        disclaimer: 'This AI-generated analysis is for pharmacist consultation only.',
                        confidenceScore: 85,
                    }),
                },
                finish_reason: 'stop',
            }],
            usage: {
                prompt_tokens: 500,
                completion_tokens: 300,
                total_tokens: 800,
            },
        };

        it('should successfully generate diagnostic analysis', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: mockValidResponse });

            const result = await service.generateDiagnosticAnalysis(mockInput);

            expect(result).toHaveProperty('analysis');
            expect(result).toHaveProperty('usage');
            expect(result).toHaveProperty('requestId', 'test-request-id');
            expect(result).toHaveProperty('processingTime');
            expect(result.analysis.differentialDiagnoses).toHaveLength(1);
            expect(result.analysis.differentialDiagnoses[0].condition).toBe('Acute Coronary Syndrome');
            expect(result.usage.total_tokens).toBe(800);
        });

        it('should retry on server errors', async () => {
            const serverError = {
                response: {
                    status: 500,
                    data: { error: 'Internal server error' },
                },
            };

            mockedAxios.post
                .mockRejectedValueOnce(serverError)
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce({ data: mockValidResponse });

            const result = await service.generateDiagnosticAnalysis(mockInput);

            expect(mockedAxios.post).toHaveBeenCalledTimes(3);
            expect(result.analysis.differentialDiagnoses[0].condition).toBe('Acute Coronary Syndrome');
            expect(logger.warn).toHaveBeenCalledTimes(2);
        });

        it('should retry on rate limit errors', async () => {
            const rateLimitError = {
                response: {
                    status: 429,
                    data: { error: 'Rate limit exceeded' },
                },
            };

            mockedAxios.post
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce({ data: mockValidResponse });

            const result = await service.generateDiagnosticAnalysis(mockInput);

            expect(mockedAxios.post).toHaveBeenCalledTimes(2);
            expect(result.analysis.differentialDiagnoses[0].condition).toBe('Acute Coronary Syndrome');
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });

        it('should not retry on authentication errors', async () => {
            const authError = {
                response: {
                    status: 401,
                    data: { error: 'Unauthorized' },
                },
            };

            mockedAxios.post.mockRejectedValueOnce(authError);

            await expect(service.generateDiagnosticAnalysis(mockInput)).rejects.toThrow(
                'AI diagnostic analysis failed: Invalid or missing OpenRouter API key'
            );

            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should fail after max retries', async () => {
            const serverError = {
                response: {
                    status: 500,
                    data: { error: 'Internal server error' },
                },
            };

            mockedAxios.post.mockRejectedValue(serverError);

            await expect(service.generateDiagnosticAnalysis(mockInput)).rejects.toThrow(
                'AI diagnostic analysis failed: OpenRouter API server error'
            );

            expect(mockedAxios.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
            expect(logger.warn).toHaveBeenCalledTimes(3);
        });

        it('should handle invalid JSON response', async () => {
            const invalidResponse = {
                ...mockValidResponse,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'This is not valid JSON',
                    },
                    finish_reason: 'stop',
                }],
            };

            mockedAxios.post.mockResolvedValueOnce({ data: invalidResponse });

            await expect(service.generateDiagnosticAnalysis(mockInput)).rejects.toThrow(
                'Failed to parse AI diagnostic response'
            );
        });

        it('should handle missing required fields in response', async () => {
            const invalidResponse = {
                ...mockValidResponse,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: JSON.stringify({
                            // Missing differentialDiagnoses
                            recommendedTests: [],
                        }),
                    },
                    finish_reason: 'stop',
                }],
            };

            mockedAxios.post.mockResolvedValueOnce({ data: invalidResponse });

            await expect(service.generateDiagnosticAnalysis(mockInput)).rejects.toThrow(
                'Failed to parse AI diagnostic response'
            );
        });

        it('should validate differential diagnoses structure', async () => {
            const invalidResponse = {
                ...mockValidResponse,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: JSON.stringify({
                            differentialDiagnoses: [
                                {
                                    condition: 'Test Condition',
                                    probability: 150, // Invalid: > 100
                                    reasoning: 'Test reasoning',
                                    severity: 'invalid', // Invalid severity
                                },
                            ],
                        }),
                    },
                    finish_reason: 'stop',
                }],
            };

            mockedAxios.post.mockResolvedValueOnce({ data: invalidResponse });

            await expect(service.generateDiagnosticAnalysis(mockInput)).rejects.toThrow(
                'Failed to parse AI diagnostic response'
            );
        });

        it('should set default values for optional fields', async () => {
            const minimalResponse = {
                ...mockValidResponse,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: JSON.stringify({
                            differentialDiagnoses: [
                                {
                                    condition: 'Test Condition',
                                    probability: 75,
                                    reasoning: 'Test reasoning',
                                    severity: 'medium',
                                },
                            ],
                            // Missing optional fields
                        }),
                    },
                    finish_reason: 'stop',
                }],
            };

            mockedAxios.post.mockResolvedValueOnce({ data: minimalResponse });

            const result = await service.generateDiagnosticAnalysis(mockInput);

            expect(result.analysis.recommendedTests).toEqual([]);
            expect(result.analysis.therapeuticOptions).toEqual([]);
            expect(result.analysis.redFlags).toEqual([]);
            expect(result.analysis.disclaimer).toContain('pharmacist consultation only');
            expect(result.analysis.confidenceScore).toBe(75);
        });

        it('should handle network timeout errors with retry', async () => {
            const timeoutError = {
                code: 'ETIMEDOUT',
                message: 'Request timeout',
            };

            mockedAxios.post
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValueOnce({ data: mockValidResponse });

            const result = await service.generateDiagnosticAnalysis(mockInput);

            expect(mockedAxios.post).toHaveBeenCalledTimes(2);
            expect(result.analysis.differentialDiagnoses[0].condition).toBe('Acute Coronary Syndrome');
        });

        it('should include proper headers in API request', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: mockValidResponse });

            await service.generateDiagnosticAnalysis(mockInput);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://test-openrouter.ai/api/v1/chat/completions',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-api-key',
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:5173',
                        'X-Title': 'PharmacyCopilot SaaS - AI Diagnostic Module',
                    }),
                })
            );
        });

        it('should format diagnostic prompt correctly', async () => {
            mockedAxios.post.mockResolvedValueOnce({ data: mockValidResponse });

            await service.generateDiagnosticAnalysis(mockInput);

            const requestBody = mockedAxios.post.mock.calls[0][1] as any;
            const userMessage = requestBody.messages.find((m: any) => m.role === 'user');

            expect(userMessage.content).toContain('PATIENT PRESENTATION FOR DIAGNOSTIC ANALYSIS');
            expect(userMessage.content).toContain('Age: 45 years');
            expect(userMessage.content).toContain('Gender: male');
            expect(userMessage.content).toContain('chest pain');
            expect(userMessage.content).toContain('Blood Pressure: 140/90');
        });
    });

    describe('testConnection', () => {
        it('should return true for successful connection', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                status: 200,
                data: { data: [{ id: 'model1' }, { id: 'model2' }] },
            });

            const result = await service.testConnection();

            expect(result).toBe(true);
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://test-openrouter.ai/api/v1/models',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-api-key',
                    }),
                })
            );
        });

        it('should return false for failed connection', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

            const result = await service.testConnection();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                'OpenRouter connection test failed',
                expect.any(Object)
            );
        });

        it('should handle authentication errors in connection test', async () => {
            mockedAxios.get.mockRejectedValueOnce({
                response: { status: 401 },
                message: 'Unauthorized',
            });

            const result = await service.testConnection();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                'OpenRouter connection test failed',
                expect.objectContaining({
                    statusCode: 401,
                })
            );
        });
    });

    describe('error handling', () => {
        it('should throw error when API key is missing', () => {
            delete process.env.OPENROUTER_API_KEY;

            expect(() => {
                jest.resetModules();
                require('../../../../services/openRouterService');
            }).toThrow('OpenRouter API key is required');
        });

        it('should handle empty response content', async () => {
            const emptyResponse = {
                ...mockValidResponse,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: '',
                    },
                    finish_reason: 'stop',
                }],
            };

            mockedAxios.post.mockResolvedValueOnce({ data: emptyResponse });

            await expect(service.generateDiagnosticAnalysis({
                symptoms: {
                    subjective: ['test'],
                    objective: [],
                    duration: '1 hour',
                    severity: 'mild',
                    onset: 'acute',
                },
            })).rejects.toThrow('No response generated from AI model or content is empty');
        });

        it('should handle malformed response structure', async () => {
            const malformedResponse = {
                id: 'test-id',
                // Missing choices array
            };

            mockedAxios.post.mockResolvedValueOnce({ data: malformedResponse });

            await expect(service.generateDiagnosticAnalysis({
                symptoms: {
                    subjective: ['test'],
                    objective: [],
                    duration: '1 hour',
                    severity: 'mild',
                    onset: 'acute',
                },
            })).rejects.toThrow('No response generated from AI model or content is empty');
        });
    });

    describe('retry logic', () => {
        it('should use exponential backoff for retries', async () => {
            const serverError = {
                response: {
                    status: 500,
                    data: { error: 'Internal server error' },
                },
            };

            // Mock setTimeout to track delay calls
            const originalSetTimeout = global.setTimeout;
            const setTimeoutSpy = jest.fn((callback, delay) => {
                callback();
                return 1 as any;
            });
            global.setTimeout = setTimeoutSpy;

            mockedAxios.post
                .mockRejectedValueOnce(serverError)
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce({ data: mockValidResponse });

            await service.generateDiagnosticAnalysis({
                symptoms: {
                    subjective: ['test'],
                    objective: [],
                    duration: '1 hour',
                    severity: 'mild',
                    onset: 'acute',
                },
            });

            // Check that delays increase exponentially
            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1000); // First retry: 1s
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 2000); // Second retry: 2s

            global.setTimeout = originalSetTimeout;
        });
    });
});