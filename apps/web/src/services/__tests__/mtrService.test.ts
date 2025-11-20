import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mtrService, MTRValidationError, MTRNotFoundError, MTRConflictError } from '../mtrService';
import { apiHelpers } from '../api';

// Mock the API helpers
vi.mock('../api', () => ({
    apiHelpers: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockApiHelpers = apiHelpers as unknown as {
    handleApiError: vi.MockedFunction<typeof apiHelpers.handleApiError>;
    transformDatesForFrontend: vi.MockedFunction<typeof apiHelpers.transformDatesForFrontend>;
    transformDatesForAPI: vi.MockedFunction<typeof apiHelpers.transformDatesForAPI>;
};

describe('mtrService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('MTR Session Operations', () => {
        describe('getMTRSessions', () => {
            it('should fetch MTR sessions successfully', async () => {
                const mockResponse = {
                    data: {
                        results: [
                            {
                                _id: 'session-1',
                                reviewNumber: 'MTR-001',
                                status: 'in_progress',
                                patientId: 'patient-1',
                            },
                        ],
                        total: 1,
                        page: 1,
                        limit: 10,
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getMTRSessions();

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr', { params: {} });
                expect(result).toEqual(mockResponse);
            });

            it('should handle search parameters correctly', async () => {
                const searchParams = {
                    status: 'in_progress' as const,
                    patientId: 'patient-1',
                    page: 2,
                    limit: 20,
                };

                mockApiHelpers.get.mockResolvedValue({ data: { results: [] } });

                await mtrService.getMTRSessions(searchParams);

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr', {
                    params: searchParams,
                });
            });

            it('should handle API errors', async () => {
                const error = new Error('Network error');
                mockApiHelpers.get.mockRejectedValue(error);

                await expect(mtrService.getMTRSessions()).rejects.toThrow('Network error');
            });
        });

        describe('getMTRSession', () => {
            it('should fetch single MTR session successfully', async () => {
                const mockResponse = {
                    data: {
                        _id: 'session-1',
                        reviewNumber: 'MTR-001',
                        status: 'in_progress',
                        patientId: 'patient-1',
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getMTRSession('session-1');

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/session-1');
                expect(result).toEqual(mockResponse);
            });

            it('should handle not found error', async () => {
                const error = { response: { status: 404, data: { message: 'Session not found' } } };
                mockApiHelpers.get.mockRejectedValue(error);

                await expect(mtrService.getMTRSession('invalid-id')).rejects.toThrow(MTRNotFoundError);
            });
        });

        describe('createMTRSession', () => {
            it('should create MTR session successfully', async () => {
                const createData = {
                    patientId: 'patient-1',
                    reviewType: 'initial' as const,
                    priority: 'routine' as const,
                };

                const mockResponse = {
                    data: {
                        _id: 'session-1',
                        reviewNumber: 'MTR-001',
                        ...createData,
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.createMTRSession(createData);

                expect(mockApiHelpers.post).toHaveBeenCalledWith('/api/mtr', createData);
                expect(result).toEqual(mockResponse);
            });

            it('should handle validation errors', async () => {
                const createData = {
                    patientId: '',
                    reviewType: 'initial' as const,
                    priority: 'routine' as const,
                };

                const error = {
                    response: {
                        status: 400,
                        data: {
                            message: 'Validation failed',
                            details: { patientId: 'Patient ID is required' },
                        },
                    },
                };

                mockApiHelpers.post.mockRejectedValue(error);

                await expect(mtrService.createMTRSession(createData)).rejects.toThrow(MTRValidationError);
            });

            it('should handle conflict errors', async () => {
                const createData = {
                    patientId: 'patient-1',
                    reviewType: 'initial' as const,
                    priority: 'routine' as const,
                };

                const error = {
                    response: {
                        status: 409,
                        data: { message: 'Active MTR session already exists for this patient' },
                    },
                };

                mockApiHelpers.post.mockRejectedValue(error);

                await expect(mtrService.createMTRSession(createData)).rejects.toThrow(MTRConflictError);
            });
        });

        describe('updateMTRSession', () => {
            it('should update MTR session successfully', async () => {
                const updateData = {
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                };

                const mockResponse = {
                    data: {
                        _id: 'session-1',
                        ...updateData,
                    },
                };

                mockApiHelpers.put.mockResolvedValue(mockResponse);

                const result = await mtrService.updateMTRSession('session-1', updateData);

                expect(mockApiHelpers.put).toHaveBeenCalledWith('/api/mtr/session-1', updateData);
                expect(result).toEqual(mockResponse);
            });
        });

        describe('completeMTRSession', () => {
            it('should complete MTR session successfully', async () => {
                const mockResponse = {
                    data: {
                        _id: 'session-1',
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                    },
                };

                mockApiHelpers.put.mockResolvedValue(mockResponse);

                const result = await mtrService.completeMTRSession('session-1');

                expect(mockApiHelpers.put).toHaveBeenCalledWith('/api/mtr/session-1/complete');
                expect(result).toEqual(mockResponse);
            });
        });

        describe('deleteMTRSession', () => {
            it('should delete MTR session successfully', async () => {
                const mockResponse = { data: { success: true } };

                mockApiHelpers.delete.mockResolvedValue(mockResponse);

                const result = await mtrService.deleteMTRSession('session-1');

                expect(mockApiHelpers.delete).toHaveBeenCalledWith('/api/mtr/session-1');
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('Drug Therapy Problem Operations', () => {
        describe('getDrugTherapyProblems', () => {
            it('should fetch drug therapy problems successfully', async () => {
                const mockResponse = {
                    data: {
                        results: [
                            {
                                _id: 'problem-1',
                                category: 'safety',
                                type: 'interaction',
                                severity: 'major',
                                description: 'Drug interaction detected',
                            },
                        ],
                        total: 1,
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getDrugTherapyProblems('review-1');

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/review-1/problems', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('createDrugTherapyProblem', () => {
            it('should create drug therapy problem successfully', async () => {
                const createData = {
                    reviewId: 'review-1',
                    category: 'safety' as const,
                    type: 'interaction' as const,
                    severity: 'major' as const,
                    description: 'Drug interaction detected',
                    clinicalSignificance: 'Monitor for bleeding',
                    affectedMedications: ['med-1', 'med-2'],
                    evidenceLevel: 'probable' as const,
                };

                const mockResponse = {
                    data: {
                        _id: 'problem-1',
                        ...createData,
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.createDrugTherapyProblem(createData);

                expect(mockApiHelpers.post).toHaveBeenCalledWith('/api/mtr/review-1/problems', createData);
                expect(result).toEqual(mockResponse);
            });
        });

        describe('updateDrugTherapyProblem', () => {
            it('should update drug therapy problem successfully', async () => {
                const updateData = {
                    problemId: 'problem-1',
                    data: {
                        status: 'resolved' as const,
                        resolution: {
                            action: 'Medications adjusted',
                            outcome: 'Problem resolved',
                        },
                    },
                };

                const mockResponse = {
                    data: {
                        _id: 'problem-1',
                        ...updateData.data,
                    },
                };

                mockApiHelpers.put.mockResolvedValue(mockResponse);

                const result = await mtrService.updateDrugTherapyProblem(updateData);

                expect(mockApiHelpers.put).toHaveBeenCalledWith(
                    '/api/mtr/problems/problem-1',
                    updateData.data
                );
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('MTR Intervention Operations', () => {
        describe('getMTRInterventions', () => {
            it('should fetch MTR interventions successfully', async () => {
                const mockResponse = {
                    data: {
                        results: [
                            {
                                _id: 'intervention-1',
                                type: 'recommendation',
                                description: 'Adjust medication dose',
                                outcome: 'pending',
                            },
                        ],
                        total: 1,
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getMTRInterventions('review-1');

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/review-1/interventions', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('createMTRIntervention', () => {
            it('should create MTR intervention successfully', async () => {
                const createData = {
                    reviewId: 'review-1',
                    type: 'recommendation' as const,
                    category: 'medication_change' as const,
                    description: 'Adjust dose',
                    rationale: 'Side effects reported',
                    targetAudience: 'prescriber' as const,
                    communicationMethod: 'phone' as const,
                    priority: 'high' as const,
                    urgency: 'within_24h' as const,
                };

                const mockResponse = {
                    data: {
                        _id: 'intervention-1',
                        ...createData,
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.createMTRIntervention(createData);

                expect(mockApiHelpers.post).toHaveBeenCalledWith(
                    '/api/mtr/review-1/interventions',
                    createData
                );
                expect(result).toEqual(mockResponse);
            });
        });

        describe('updateMTRIntervention', () => {
            it('should update MTR intervention successfully', async () => {
                const updateData = {
                    interventionId: 'intervention-1',
                    data: {
                        outcome: 'accepted' as const,
                        outcomeDetails: 'Prescriber agreed to dose adjustment',
                    },
                };

                const mockResponse = {
                    data: {
                        _id: 'intervention-1',
                        ...updateData.data,
                    },
                };

                mockApiHelpers.put.mockResolvedValue(mockResponse);

                const result = await mtrService.updateMTRIntervention(updateData);

                expect(mockApiHelpers.put).toHaveBeenCalledWith(
                    '/api/mtr/interventions/intervention-1',
                    updateData.data
                );
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('MTR Follow-Up Operations', () => {
        describe('getMTRFollowUps', () => {
            it('should fetch MTR follow-ups successfully', async () => {
                const mockResponse = {
                    data: {
                        results: [
                            {
                                _id: 'followup-1',
                                type: 'phone_call',
                                scheduledDate: '2024-01-15T10:00:00Z',
                                status: 'scheduled',
                            },
                        ],
                        total: 1,
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getMTRFollowUps('review-1');

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/review-1/followups', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('createMTRFollowUp', () => {
            it('should create MTR follow-up successfully', async () => {
                const createData = {
                    reviewId: 'review-1',
                    type: 'phone_call' as const,
                    priority: 'medium' as const,
                    description: 'Follow up on medication adherence',
                    scheduledDate: new Date('2024-01-15T10:00:00Z'),
                    assignedTo: 'Dr. Smith',
                };

                const mockResponse = {
                    data: {
                        _id: 'followup-1',
                        ...createData,
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.createMTRFollowUp(createData);

                expect(mockApiHelpers.post).toHaveBeenCalledWith('/api/mtr/review-1/followups', createData);
                expect(result).toEqual(mockResponse);
            });
        });

        describe('updateMTRFollowUp', () => {
            it('should update MTR follow-up successfully', async () => {
                const updateData = {
                    followUpId: 'followup-1',
                    data: {
                        status: 'completed' as const,
                        outcome: {
                            status: 'successful' as const,
                            notes: 'Patient adherence improved',
                            nextActions: ['Continue current therapy'],
                        },
                    },
                };

                const mockResponse = {
                    data: {
                        _id: 'followup-1',
                        ...updateData.data,
                    },
                };

                mockApiHelpers.put.mockResolvedValue(mockResponse);

                const result = await mtrService.updateMTRFollowUp(updateData);

                expect(mockApiHelpers.put).toHaveBeenCalledWith(
                    '/api/mtr/followups/followup-1',
                    updateData.data
                );
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('Drug Interaction Checking', () => {
        describe('checkDrugInteractions', () => {
            it('should check drug interactions successfully', async () => {
                const medications = [
                    { drugName: 'Warfarin', strength: '5mg' },
                    { drugName: 'Aspirin', strength: '81mg' },
                ];

                const mockResponse = {
                    data: {
                        interactions: [
                            {
                                severity: 'major',
                                description: 'Increased bleeding risk',
                                medications: ['Warfarin', 'Aspirin'],
                                clinicalSignificance: 'Monitor INR closely',
                            },
                        ],
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.checkDrugInteractions(medications);

                expect(mockApiHelpers.post).toHaveBeenCalledWith('/api/mtr/check-interactions', {
                    medications,
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('checkDuplicateTherapy', () => {
            it('should check duplicate therapy successfully', async () => {
                const medications = [
                    { drugName: 'Paracetamol', strength: '500mg' },
                    { drugName: 'Acetaminophen', strength: '1000mg' },
                ];

                const mockResponse = {
                    data: {
                        duplicates: [
                            {
                                medications: ['Paracetamol', 'Acetaminophen'],
                                reason: 'Same active ingredient',
                                recommendation: 'Consider consolidating doses',
                            },
                        ],
                    },
                };

                mockApiHelpers.post.mockResolvedValue(mockResponse);

                const result = await mtrService.checkDuplicateTherapy(medications);

                expect(mockApiHelpers.post).toHaveBeenCalledWith('/api/mtr/check-duplicates', {
                    medications,
                });
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('Reporting Operations', () => {
        describe('getMTRSummaryReport', () => {
            it('should fetch MTR summary report successfully', async () => {
                const mockResponse = {
                    data: {
                        summary: {
                            totalReviews: 100,
                            completedReviews: 85,
                            completionRate: 85.0,
                        },
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getMTRSummaryReport();

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/reports/summary', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('getInterventionEffectivenessReport', () => {
            it('should fetch intervention effectiveness report successfully', async () => {
                const mockResponse = {
                    data: {
                        summary: {
                            totalInterventions: 250,
                            acceptedInterventions: 200,
                            overallAcceptanceRate: 80.0,
                        },
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getInterventionEffectivenessReport();

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/reports/outcomes', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });

        describe('getPharmacistPerformanceReport', () => {
            it('should fetch pharmacist performance report successfully', async () => {
                const mockResponse = {
                    data: {
                        pharmacistPerformance: [
                            {
                                _id: '1',
                                pharmacistName: 'Dr. Smith',
                                totalReviews: 25,
                                completionRate: 92.0,
                            },
                        ],
                    },
                };

                mockApiHelpers.get.mockResolvedValue(mockResponse);

                const result = await mtrService.getPharmacistPerformanceReport();

                expect(mockApiHelpers.get).toHaveBeenCalledWith('/api/mtr/reports/audit', {
                    params: {},
                });
                expect(result).toEqual(mockResponse);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle 400 validation errors', async () => {
            const error = {
                response: {
                    status: 400,
                    data: {
                        message: 'Validation failed',
                        details: { patientId: 'Required field' },
                    },
                },
            };

            mockApiHelpers.post.mockRejectedValue(error);

            await expect(
                mtrService.createMTRSession({
                    patientId: '',
                    reviewType: 'initial',
                    priority: 'routine',
                })
            ).rejects.toThrow(MTRValidationError);
        });

        it('should handle 404 not found errors', async () => {
            const error = {
                response: {
                    status: 404,
                    data: { message: 'MTR session not found' },
                },
            };

            mockApiHelpers.get.mockRejectedValue(error);

            await expect(mtrService.getMTRSession('invalid-id')).rejects.toThrow(MTRNotFoundError);
        });

        it('should handle 409 conflict errors', async () => {
            const error = {
                response: {
                    status: 409,
                    data: { message: 'Active session already exists' },
                },
            };

            mockApiHelpers.post.mockRejectedValue(error);

            await expect(
                mtrService.createMTRSession({
                    patientId: 'patient-1',
                    reviewType: 'initial',
                    priority: 'routine',
                })
            ).rejects.toThrow(MTRConflictError);
        });

        it('should handle generic errors', async () => {
            const error = new Error('Network error');
            mockApiHelpers.get.mockRejectedValue(error);

            await expect(mtrService.getMTRSessions()).rejects.toThrow('Network error');
        });

        it('should handle errors without response object', async () => {
            const error = { message: 'Request timeout' };
            mockApiHelpers.get.mockRejectedValue(error);

            await expect(mtrService.getMTRSessions()).rejects.toThrow('Request timeout');
        });
    });

    describe('Request Validation', () => {
        it('should validate required fields for createMTRSession', async () => {
            const invalidData = {
                patientId: '',
                reviewType: 'initial' as const,
                priority: 'routine' as const,
            };

            // The service should validate locally before making API call
            await expect(mtrService.createMTRSession(invalidData)).rejects.toThrow();
        });

        it('should validate medication data for drug interaction check', async () => {
            const invalidMedications = [
                { drugName: '', strength: '5mg' }, // Missing drug name
            ];

            await expect(mtrService.checkDrugInteractions(invalidMedications)).rejects.toThrow();
        });
    });

    describe('Response Transformation', () => {
        it('should return raw API response without transformation', async () => {
            const mockResponse = {
                data: { _id: 'session-1' },
                status: 200,
                statusText: 'OK',
            };

            mockApiHelpers.get.mockResolvedValue(mockResponse);

            const result = await mtrService.getMTRSession('session-1');

            expect(result).toEqual(mockResponse);
        });
    });
});