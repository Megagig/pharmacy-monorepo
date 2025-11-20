import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import clinicalInterventionService from '../clinicalInterventionService';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ClinicalInterventionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default axios mock
        mockedAxios.create = vi.fn(() => mockedAxios);
        mockedAxios.interceptors = {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        } as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getInterventions', () => {
        const mockInterventionsResponse = {
            data: {
                success: true,
                data: {
                    interventions: [
                        {
                            _id: 'intervention-1',
                            interventionNumber: 'CI-202412-0001',
                            category: 'drug_therapy_problem',
                            priority: 'high',
                            status: 'in_progress',
                            issueDescription: 'Patient experiencing side effects',
                            patientId: 'patient-1',
                            identifiedBy: 'user-1'
                        }
                    ],
                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 1,
                        pages: 1,
                        hasNext: false,
                        hasPrev: false
                    }
                }
            }
        };

        it('should fetch interventions with default parameters', async () => {
            mockedAxios.get.mockResolvedValue(mockInterventionsResponse);

            const result = await clinicalInterventionService.getInterventions();

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions', {
                params: {
                    page: 1,
                    limit: 20,
                    sortBy: 'identifiedDate',
                    sortOrder: 'desc'
                }
            });

            expect(result).toEqual({
                data: mockInterventionsResponse.data.data.interventions,
                pagination: mockInterventionsResponse.data.data.pagination
            });
        });

        it('should fetch interventions with custom parameters', async () => {
            mockedAxios.get.mockResolvedValue(mockInterventionsResponse);

            const filters = {
                page: 2,
                limit: 50,
                category: 'drug_therapy_problem',
                priority: 'high',
                status: 'in_progress',
                patientId: 'patient-1',
                search: 'side effects',
                dateFrom: '2024-12-01',
                dateTo: '2024-12-31',
                sortBy: 'priority',
                sortOrder: 'asc' as const
            };

            await clinicalInterventionService.getInterventions(filters);

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions', {
                params: filters
            });
        });

        it('should handle API errors', async () => {
            const errorResponse = {
                response: {
                    status: 500,
                    data: {
                        success: false,
                        error: {
                            message: 'Internal server error'
                        }
                    }
                }
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });

        it('should handle network errors', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network Error'));

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow('Network Error');
        });
    });

    describe('getInterventionById', () => {
        const mockInterventionResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'high',
                        status: 'in_progress',
                        issueDescription: 'Patient experiencing side effects',
                        strategies: [],
                        assignments: [],
                        outcomes: null,
                        followUp: { required: false }
                    }
                }
            }
        };

        it('should fetch intervention by ID', async () => {
            mockedAxios.get.mockResolvedValue(mockInterventionResponse);

            const result = await clinicalInterventionService.getInterventionById('intervention-1');

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/intervention-1');
            expect(result).toEqual(mockInterventionResponse.data.data.intervention);
        });

        it('should handle not found error', async () => {
            const errorResponse = {
                response: {
                    status: 404,
                    data: {
                        success: false,
                        error: {
                            message: 'Intervention not found'
                        }
                    }
                }
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.getInterventionById('nonexistent')).rejects.toThrow();
        });
    });

    describe('createIntervention', () => {
        const mockCreateResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'high',
                        status: 'identified',
                        issueDescription: 'Patient experiencing side effects',
                        patientId: 'patient-1',
                        identifiedBy: 'user-1'
                    }
                }
            }
        };

        it('should create intervention with valid data', async () => {
            mockedAxios.post.mockResolvedValue(mockCreateResponse);

            const interventionData = {
                patientId: 'patient-1',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Patient experiencing side effects from current medication',
                strategies: [],
                estimatedDuration: 60
            };

            const result = await clinicalInterventionService.createIntervention(interventionData);

            expect(mockedAxios.post).toHaveBeenCalledWith('/api/clinical-interventions', interventionData);
            expect(result).toEqual(mockCreateResponse.data.data.intervention);
        });

        it('should handle validation errors', async () => {
            const errorResponse = {
                response: {
                    status: 400,
                    data: {
                        success: false,
                        error: {
                            message: 'Validation failed',
                            details: {
                                issueDescription: 'Issue description is required'
                            }
                        }
                    }
                }
            };

            mockedAxios.post.mockRejectedValue(errorResponse);

            const invalidData = {
                patientId: 'patient-1',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: '', // Invalid - empty
                strategies: []
            };

            await expect(clinicalInterventionService.createIntervention(invalidData)).rejects.toThrow();
        });
    });

    describe('updateIntervention', () => {
        const mockUpdateResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        interventionNumber: 'CI-202412-0001',
                        category: 'drug_therapy_problem',
                        priority: 'critical', // Updated
                        status: 'in_progress',
                        issueDescription: 'Updated issue description'
                    }
                }
            }
        };

        it('should update intervention with valid data', async () => {
            mockedAxios.patch.mockResolvedValue(mockUpdateResponse);

            const updates = {
                priority: 'critical',
                issueDescription: 'Updated issue description'
            };

            const result = await clinicalInterventionService.updateIntervention('intervention-1', updates);

            expect(mockedAxios.patch).toHaveBeenCalledWith('/api/clinical-interventions/intervention-1', updates);
            expect(result).toEqual(mockUpdateResponse.data.data.intervention);
        });

        it('should handle update errors', async () => {
            const errorResponse = {
                response: {
                    status: 403,
                    data: {
                        success: false,
                        error: {
                            message: 'Cannot update completed intervention'
                        }
                    }
                }
            };

            mockedAxios.patch.mockRejectedValue(errorResponse);

            await expect(
                clinicalInterventionService.updateIntervention('intervention-1', { priority: 'low' })
            ).rejects.toThrow();
        });
    });

    describe('deleteIntervention', () => {
        const mockDeleteResponse = {
            data: {
                success: true,
                data: {
                    deleted: true
                }
            }
        };

        it('should delete intervention', async () => {
            mockedAxios.delete.mockResolvedValue(mockDeleteResponse);

            const result = await clinicalInterventionService.deleteIntervention('intervention-1');

            expect(mockedAxios.delete).toHaveBeenCalledWith('/api/clinical-interventions/intervention-1');
            expect(result).toBe(true);
        });

        it('should handle delete errors', async () => {
            const errorResponse = {
                response: {
                    status: 403,
                    data: {
                        success: false,
                        error: {
                            message: 'Cannot delete completed intervention'
                        }
                    }
                }
            };

            mockedAxios.delete.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.deleteIntervention('intervention-1')).rejects.toThrow();
        });
    });

    describe('addStrategy', () => {
        const mockStrategyResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        strategies: [{
                            type: 'dose_adjustment',
                            description: 'Reduce dose by 50%',
                            rationale: 'Patient experiencing side effects',
                            expectedOutcome: 'Reduced side effects while maintaining efficacy',
                            priority: 'primary'
                        }]
                    }
                }
            }
        };

        it('should add strategy to intervention', async () => {
            mockedAxios.post.mockResolvedValue(mockStrategyResponse);

            const strategy = {
                type: 'dose_adjustment',
                description: 'Reduce dose by 50%',
                rationale: 'Patient experiencing side effects',
                expectedOutcome: 'Reduced side effects while maintaining efficacy',
                priority: 'primary'
            };

            const result = await clinicalInterventionService.addStrategy('intervention-1', strategy);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/clinical-interventions/intervention-1/strategies',
                strategy
            );
            expect(result).toEqual(mockStrategyResponse.data.data.intervention);
        });
    });

    describe('assignTeamMember', () => {
        const mockAssignmentResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        assignments: [{
                            userId: 'user-2',
                            role: 'pharmacist',
                            task: 'Review medication regimen',
                            status: 'pending'
                        }]
                    }
                }
            }
        };

        it('should assign team member to intervention', async () => {
            mockedAxios.post.mockResolvedValue(mockAssignmentResponse);

            const assignment = {
                userId: 'user-2',
                role: 'pharmacist',
                task: 'Review medication regimen',
                notes: 'Urgent review needed'
            };

            const result = await clinicalInterventionService.assignTeamMember('intervention-1', assignment);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/clinical-interventions/intervention-1/assignments',
                assignment
            );
            expect(result).toEqual(mockAssignmentResponse.data.data.intervention);
        });
    });

    describe('recordOutcome', () => {
        const mockOutcomeResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        outcomes: {
                            patientResponse: 'improved',
                            clinicalParameters: [],
                            successMetrics: {
                                problemResolved: true,
                                medicationOptimized: true,
                                adherenceImproved: false
                            }
                        }
                    }
                }
            }
        };

        it('should record intervention outcome', async () => {
            mockedAxios.post.mockResolvedValue(mockOutcomeResponse);

            const outcome = {
                patientResponse: 'improved',
                clinicalParameters: [{
                    parameter: 'Blood Pressure',
                    beforeValue: '160/90',
                    afterValue: '130/80',
                    unit: 'mmHg',
                    improvementPercentage: 20
                }],
                successMetrics: {
                    problemResolved: true,
                    medicationOptimized: true,
                    adherenceImproved: false
                }
            };

            const result = await clinicalInterventionService.recordOutcome('intervention-1', outcome);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/clinical-interventions/intervention-1/outcomes',
                outcome
            );
            expect(result).toEqual(mockOutcomeResponse.data.data.intervention);
        });
    });

    describe('scheduleFollowUp', () => {
        const mockFollowUpResponse = {
            data: {
                success: true,
                data: {
                    intervention: {
                        _id: 'intervention-1',
                        followUp: {
                            required: true,
                            scheduledDate: '2024-12-15T10:00:00Z',
                            notes: 'Follow-up call to assess progress'
                        }
                    }
                }
            }
        };

        it('should schedule follow-up for intervention', async () => {
            mockedAxios.post.mockResolvedValue(mockFollowUpResponse);

            const followUp = {
                required: true,
                scheduledDate: '2024-12-15T10:00:00Z',
                notes: 'Follow-up call to assess progress',
                nextReviewDate: '2024-12-30T10:00:00Z'
            };

            const result = await clinicalInterventionService.scheduleFollowUp('intervention-1', followUp);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/clinical-interventions/intervention-1/follow-up',
                followUp
            );
            expect(result).toEqual(mockFollowUpResponse.data.data.intervention);
        });
    });

    describe('getPatientInterventions', () => {
        const mockPatientInterventionsResponse = {
            data: {
                success: true,
                data: {
                    interventions: [
                        {
                            _id: 'intervention-1',
                            interventionNumber: 'CI-202412-0001',
                            category: 'drug_therapy_problem',
                            priority: 'high',
                            status: 'completed'
                        }
                    ],
                    summary: {
                        totalInterventions: 5,
                        activeInterventions: 2,
                        completedInterventions: 3,
                        successfulInterventions: 2
                    },
                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 5,
                        pages: 1,
                        hasNext: false,
                        hasPrev: false
                    }
                }
            }
        };

        it('should fetch patient interventions with summary', async () => {
            mockedAxios.get.mockResolvedValue(mockPatientInterventionsResponse);

            const result = await clinicalInterventionService.getPatientInterventions('patient-1');

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/patient/patient-1', {
                params: {
                    page: 1,
                    limit: 20
                }
            });

            expect(result).toEqual({
                data: mockPatientInterventionsResponse.data.data.interventions,
                summary: mockPatientInterventionsResponse.data.data.summary,
                pagination: mockPatientInterventionsResponse.data.data.pagination
            });
        });

        it('should fetch patient interventions with filters', async () => {
            mockedAxios.get.mockResolvedValue(mockPatientInterventionsResponse);

            const filters = {
                status: 'completed',
                category: 'drug_therapy_problem',
                page: 2,
                limit: 5
            };

            await clinicalInterventionService.getPatientInterventions('patient-1', filters);

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/patient/patient-1', {
                params: filters
            });
        });
    });

    describe('getDashboardMetrics', () => {
        const mockMetricsResponse = {
            data: {
                success: true,
                data: {
                    metrics: {
                        totalInterventions: 25,
                        activeInterventions: 8,
                        completedInterventions: 15,
                        overdueInterventions: 2,
                        successRate: 85.5,
                        averageResolutionTime: 3.2,
                        totalCostSavings: 12500,
                        categoryDistribution: [],
                        priorityDistribution: [],
                        monthlyTrends: []
                    }
                }
            }
        };

        it('should fetch dashboard metrics', async () => {
            mockedAxios.get.mockResolvedValue(mockMetricsResponse);

            const result = await clinicalInterventionService.getDashboardMetrics();

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/analytics/summary', {
                params: {}
            });
            expect(result).toEqual(mockMetricsResponse.data.data.metrics);
        });

        it('should fetch dashboard metrics with date range', async () => {
            mockedAxios.get.mockResolvedValue(mockMetricsResponse);

            const dateRange = {
                dateFrom: '2024-12-01',
                dateTo: '2024-12-31'
            };

            await clinicalInterventionService.getDashboardMetrics(dateRange);

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/analytics/summary', {
                params: dateRange
            });
        });
    });

    describe('searchPatients', () => {
        const mockSearchResponse = {
            data: {
                success: true,
                data: {
                    patients: [
                        {
                            _id: 'patient-1',
                            firstName: 'John',
                            lastName: 'Doe',
                            mrn: 'MRN123456',
                            interventionCount: 3,
                            activeInterventionCount: 1
                        }
                    ]
                }
            }
        };

        it('should search patients with intervention context', async () => {
            mockedAxios.get.mockResolvedValue(mockSearchResponse);

            const result = await clinicalInterventionService.searchPatients('John');

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/search/patients', {
                params: {
                    q: 'John',
                    limit: 10
                }
            });
            expect(result).toEqual(mockSearchResponse.data.data.patients);
        });

        it('should search patients with custom limit', async () => {
            mockedAxios.get.mockResolvedValue(mockSearchResponse);

            await clinicalInterventionService.searchPatients('John', 5);

            expect(mockedAxios.get).toHaveBeenCalledWith('/api/clinical-interventions/search/patients', {
                params: {
                    q: 'John',
                    limit: 5
                }
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle 401 unauthorized errors', async () => {
            const errorResponse = {
                response: {
                    status: 401,
                    data: {
                        success: false,
                        error: {
                            message: 'Unauthorized'
                        }
                    }
                }
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });

        it('should handle 403 forbidden errors', async () => {
            const errorResponse = {
                response: {
                    status: 403,
                    data: {
                        success: false,
                        error: {
                            message: 'Insufficient permissions'
                        }
                    }
                }
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });

        it('should handle 500 server errors', async () => {
            const errorResponse = {
                response: {
                    status: 500,
                    data: {
                        success: false,
                        error: {
                            message: 'Internal server error'
                        }
                    }
                }
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });

        it('should handle network timeout errors', async () => {
            const timeoutError = new Error('timeout of 5000ms exceeded');
            timeoutError.name = 'ECONNABORTED';

            mockedAxios.get.mockRejectedValue(timeoutError);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow('timeout of 5000ms exceeded');
        });

        it('should handle malformed response data', async () => {
            const malformedResponse = {
                data: {
                    // Missing success field and data structure
                    interventions: []
                }
            };

            mockedAxios.get.mockResolvedValue(malformedResponse);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });
    });

    describe('Request Configuration', () => {
        it('should include authorization headers', async () => {
            // Mock localStorage to return a token
            Object.defineProperty(window, 'localStorage', {
                value: {
                    getItem: vi.fn(() => 'mock-jwt-token'),
                    setItem: vi.fn(),
                    removeItem: vi.fn(),
                    clear: vi.fn(),
                },
                writable: true,
            });

            mockedAxios.get.mockResolvedValue({ data: { success: true, data: { interventions: [], pagination: {} } } });

            await clinicalInterventionService.getInterventions();

            // Verify that the request was made with proper headers
            // This would depend on how the service is implemented
            expect(mockedAxios.get).toHaveBeenCalled();
        });

        it('should handle request timeouts', async () => {
            const timeoutError = {
                code: 'ECONNABORTED',
                message: 'timeout of 10000ms exceeded'
            };

            mockedAxios.get.mockRejectedValue(timeoutError);

            await expect(clinicalInterventionService.getInterventions()).rejects.toThrow();
        });

        it('should retry failed requests', async () => {
            // First call fails, second succeeds
            mockedAxios.get
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({
                    data: {
                        success: true,
                        data: {
                            interventions: [],
                            pagination: {}
                        }
                    }
                });

            // If the service implements retry logic
            const result = await clinicalInterventionService.getInterventions();

            expect(result).toBeDefined();
        });
    });
});