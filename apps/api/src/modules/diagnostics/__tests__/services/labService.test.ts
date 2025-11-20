import { Types } from 'mongoose';
import { LabService, CreateLabOrderRequest, CreateLabResultRequest, ValidationResult, TrendData } from '../../services/labService';
import LabOrder from '../../models/LabOrder';
import LabResult from '../../models/LabResult';
import Patient from '../../../../models/Patient';
import logger from '../../../../utils/logger';

// Mock dependencies
jest.mock('../../models/LabOrder');
jest.mock('../../models/LabResult');
jest.mock('../../../../models/Patient');
jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const mockedLabOrder = LabOrder as jest.MockedClass<typeof LabOrder>;
const mockedLabResult = LabResult as jest.MockedClass<typeof LabResult>;
const mockedPatient = Patient as jest.MockedClass<typeof Patient>;

describe('LabService', () => {
    let service: LabService;
    const mockWorkplaceId = new Types.ObjectId().toString();
    const mockPatientId = new Types.ObjectId().toString();
    const mockUserId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        service = new LabService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createLabOrder', () => {
        const mockOrderData: CreateLabOrderRequest = {
            patientId: mockPatientId,
            orderedBy: mockUserId,
            workplaceId: mockWorkplaceId,
            tests: [
                {
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    loincCode: '58410-2',
                    indication: 'Routine screening',
                    priority: 'routine',
                },
            ],
        };

        const mockPatient = {
            _id: mockPatientId,
            workplaceId: mockWorkplaceId,
            firstName: 'John',
            lastName: 'Doe',
        };

        const mockSavedOrder = {
            _id: new Types.ObjectId(),
            ...mockOrderData,
            status: 'ordered',
            orderDate: new Date(),
            save: jest.fn().mockResolvedValue(this),
        };

        beforeEach(() => {
            mockedPatient.findOne.mockResolvedValue(mockPatient as any);
            mockedLabOrder.mockImplementation(() => mockSavedOrder as any);
            mockSavedOrder.save.mockResolvedValue(mockSavedOrder);
        });

        it('should create lab order successfully', async () => {
            const result = await service.createLabOrder(mockOrderData);

            expect(mockedPatient.findOne).toHaveBeenCalledWith({
                _id: mockPatientId,
                workplaceId: mockWorkplaceId,
            });

            expect(mockedLabOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: expect.any(Types.ObjectId),
                    orderedBy: expect.any(Types.ObjectId),
                    workplaceId: expect.any(Types.ObjectId),
                    tests: mockOrderData.tests,
                    status: 'ordered',
                })
            );

            expect(result).toBe(mockSavedOrder);
            expect(logger.info).toHaveBeenCalledWith(
                'Lab order created successfully',
                expect.objectContaining({
                    orderId: mockSavedOrder._id,
                    patientId: mockPatientId,
                    testsCount: 1,
                })
            );
        });

        it('should throw error when patient not found', async () => {
            mockedPatient.findOne.mockResolvedValue(null);

            await expect(service.createLabOrder(mockOrderData)).rejects.toThrow(
                'Patient not found or does not belong to this workplace'
            );
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockedPatient.findOne.mockRejectedValue(dbError);

            await expect(service.createLabOrder(mockOrderData)).rejects.toThrow(
                'Failed to create lab order: Error: Database connection failed'
            );

            expect(logger.error).toHaveBeenCalledWith('Failed to create lab order:', dbError);
        });
    });

    describe('getLabOrders', () => {
        const mockOrders = [
            {
                _id: new Types.ObjectId(),
                patientId: { firstName: 'John', lastName: 'Doe' },
                orderedBy: { firstName: 'Dr. Jane', lastName: 'Smith' },
                status: 'ordered',
                orderDate: new Date(),
                tests: [{ code: 'CBC', name: 'Complete Blood Count' }],
            },
        ];

        beforeEach(() => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockOrders),
            };

            mockedLabOrder.find.mockReturnValue(mockQuery as any);
            mockedLabOrder.countDocuments.mockResolvedValue(1);
        });

        it('should retrieve lab orders with pagination', async () => {
            const result = await service.getLabOrders(mockWorkplaceId, {}, 1, 10);

            expect(result).toEqual({
                orders: mockOrders,
                total: 1,
                page: 1,
                totalPages: 1,
            });

            expect(mockedLabOrder.find).toHaveBeenCalledWith({
                workplaceId: expect.any(Types.ObjectId),
            });
        });

        it('should apply filters correctly', async () => {
            const filters = {
                patientId: mockPatientId,
                status: 'completed' as const,
                priority: 'urgent' as const,
                testCode: 'CBC',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31'),
            };

            await service.getLabOrders(mockWorkplaceId, filters);

            expect(mockedLabOrder.find).toHaveBeenCalledWith({
                workplaceId: expect.any(Types.ObjectId),
                patientId: expect.any(Types.ObjectId),
                status: 'completed',
                'tests.priority': 'urgent',
                'tests.code': 'CBC',
                orderDate: {
                    $gte: filters.dateFrom,
                    $lte: filters.dateTo,
                },
            });
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database query failed');
            mockedLabOrder.find.mockImplementation(() => {
                throw dbError;
            });

            await expect(service.getLabOrders(mockWorkplaceId)).rejects.toThrow(
                'Failed to retrieve lab orders: Error: Database query failed'
            );
        });
    });

    describe('addLabResult', () => {
        const mockResultData: CreateLabResultRequest = {
            patientId: mockPatientId,
            workplaceId: mockWorkplaceId,
            testCode: 'GLU',
            testName: 'Glucose',
            value: '120',
            unit: 'mg/dL',
            referenceRange: { low: 70, high: 100 },
            performedAt: new Date(),
            recordedBy: mockUserId,
        };

        const mockPatient = {
            _id: mockPatientId,
            workplaceId: mockWorkplaceId,
        };

        const mockSavedResult = {
            _id: new Types.ObjectId(),
            ...mockResultData,
            interpretation: 'high',
            flags: ['Above reference range'],
            save: jest.fn().mockResolvedValue(this),
        };

        beforeEach(() => {
            mockedPatient.findOne.mockResolvedValue(mockPatient as any);
            mockedLabResult.mockImplementation(() => mockSavedResult as any);
            mockSavedResult.save.mockResolvedValue(mockSavedResult);

            // Mock validateResult method
            jest.spyOn(service, 'validateResult').mockResolvedValue({
                isValid: true,
                interpretation: 'high',
                flags: ['Above reference range'],
                recommendations: ['Monitor glucose levels'],
            });
        });

        it('should add lab result successfully', async () => {
            const result = await service.addLabResult(mockResultData);

            expect(mockedPatient.findOne).toHaveBeenCalledWith({
                _id: mockPatientId,
                workplaceId: mockWorkplaceId,
            });

            expect(service.validateResult).toHaveBeenCalled();
            expect(result).toBe(mockSavedResult);
            expect(logger.info).toHaveBeenCalledWith(
                'Lab result added successfully',
                expect.objectContaining({
                    resultId: mockSavedResult._id,
                    testCode: 'GLU',
                    interpretation: 'high',
                })
            );
        });

        it('should validate lab order when orderId provided', async () => {
            const orderId = new Types.ObjectId().toString();
            const resultDataWithOrder = { ...mockResultData, orderId };

            const mockLabOrder = { _id: orderId, workplaceId: mockWorkplaceId };
            mockedLabOrder.findOne.mockResolvedValue(mockLabOrder as any);

            // Mock updateLabOrderStatus method
            jest.spyOn(service, 'updateLabOrderStatus').mockResolvedValue(mockLabOrder as any);

            await service.addLabResult(resultDataWithOrder);

            expect(mockedLabOrder.findOne).toHaveBeenCalledWith({
                _id: orderId,
                workplaceId: expect.any(Types.ObjectId),
            });

            expect(service.updateLabOrderStatus).toHaveBeenCalledWith(
                orderId,
                'completed',
                mockWorkplaceId
            );
        });

        it('should throw error when lab order not found', async () => {
            const orderId = new Types.ObjectId().toString();
            const resultDataWithOrder = { ...mockResultData, orderId };

            mockedLabOrder.findOne.mockResolvedValue(null);

            await expect(service.addLabResult(resultDataWithOrder)).rejects.toThrow(
                'Lab order not found or access denied'
            );
        });
    });

    describe('validateResult', () => {
        it('should validate normal numeric result', async () => {
            const mockResult = {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '85',
                unit: 'mg/dL',
                referenceRange: { low: 70, high: 100 },
            } as any;

            const result = await service.validateResult(mockResult);

            expect(result).toEqual({
                isValid: true,
                interpretation: 'normal',
                flags: [],
                recommendations: [],
            });
        });

        it('should validate high numeric result', async () => {
            const mockResult = {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '150',
                unit: 'mg/dL',
                referenceRange: { low: 70, high: 100 },
            } as any;

            const result = await service.validateResult(mockResult);

            expect(result).toEqual({
                isValid: true,
                interpretation: 'high',
                flags: ['Above reference range'],
                recommendations: ['Monitor for diabetes', 'Consider HbA1c if not recent'],
            });
        });

        it('should validate critical high result', async () => {
            const mockResult = {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '450',
                unit: 'mg/dL',
                referenceRange: { low: 70, high: 100 },
            } as any;

            const result = await service.validateResult(mockResult);

            expect(result).toEqual({
                isValid: true,
                interpretation: 'critical',
                flags: ['Above reference range', 'CRITICAL HIGH'],
                recommendations: [
                    'Immediate clinical attention required',
                    'Monitor for diabetes',
                    'Consider HbA1c if not recent',
                ],
            });
        });

        it('should validate low numeric result', async () => {
            const mockResult = {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '50',
                unit: 'mg/dL',
                referenceRange: { low: 70, high: 100 },
            } as any;

            const result = await service.validateResult(mockResult);

            expect(result).toEqual({
                isValid: true,
                interpretation: 'low',
                flags: ['Below reference range'],
                recommendations: ['Evaluate for hypoglycemia causes', 'Monitor symptoms'],
            });
        });

        it('should validate qualitative results', async () => {
            const mockResult = {
                testCode: 'URINE',
                testName: 'Urinalysis',
                value: 'positive',
                unit: '',
                referenceRange: { text: 'negative' },
            } as any;

            const result = await service.validateResult(mockResult);

            expect(result.interpretation).toBe('abnormal');
            expect(result.flags).toContain('Abnormal result');
        });

        it('should handle validation errors gracefully', async () => {
            const mockResult = null as any;

            const result = await service.validateResult(mockResult);

            expect(result).toEqual({
                isValid: false,
                interpretation: 'abnormal',
                flags: ['Validation error'],
                recommendations: ['Manual review required'],
            });
        });
    }); desc
    ribe('getResultTrends', () => {
        const mockResults = [
            {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '100',
                unit: 'mg/dL',
                performedAt: new Date('2024-01-01'),
                interpretation: 'normal',
            },
            {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '110',
                unit: 'mg/dL',
                performedAt: new Date('2024-01-15'),
                interpretation: 'normal',
            },
            {
                testCode: 'GLU',
                testName: 'Glucose',
                value: '120',
                unit: 'mg/dL',
                performedAt: new Date('2024-02-01'),
                interpretation: 'high',
            },
        ];

        beforeEach(() => {
            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockResults),
            };
            mockedLabResult.find.mockReturnValue(mockQuery as any);
        });

        it('should calculate trends for sufficient data', async () => {
            const result = await service.getResultTrends(mockPatientId, 'GLU', mockWorkplaceId);

            expect(result).toMatchObject({
                testCode: 'GLU',
                testName: 'Glucose',
                trend: 'worsening', // Glucose increasing is worsening
                analysis: {
                    averageValue: 110,
                    changePercent: 20, // (120-100)/100 * 100
                    timeSpan: expect.any(Number),
                },
            });

            expect(result.results).toHaveLength(3);
        });

        it('should return insufficient_data for less than 2 results', async () => {
            const singleResult = [mockResults[0]];
            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(singleResult),
            };
            mockedLabResult.find.mockReturnValue(mockQuery as any);

            const result = await service.getResultTrends(mockPatientId, 'GLU', mockWorkplaceId);

            expect(result.trend).toBe('insufficient_data');
            expect(result.analysis.averageValue).toBe(0);
        });

        it('should handle non-numeric values', async () => {
            const nonNumericResults = [
                { ...mockResults[0], value: 'positive' },
                { ...mockResults[1], value: 'negative' },
            ];

            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(nonNumericResults),
            };
            mockedLabResult.find.mockReturnValue(mockQuery as any);

            const result = await service.getResultTrends(mockPatientId, 'URINE', mockWorkplaceId);

            expect(result.trend).toBe('insufficient_data');
        });

        it('should identify improving trends for hemoglobin', async () => {
            const hgbResults = [
                { ...mockResults[0], testCode: 'HGB', value: '8.0' },
                { ...mockResults[1], testCode: 'HGB', value: '9.0' },
                { ...mockResults[2], testCode: 'HGB', value: '10.0' },
            ];

            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(hgbResults),
            };
            mockedLabResult.find.mockReturnValue(mockQuery as any);

            const result = await service.getResultTrends(mockPatientId, 'HGB', mockWorkplaceId);

            expect(result.trend).toBe('improving'); // Hemoglobin increasing is improving
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database query failed');
            mockedLabResult.find.mockImplementation(() => {
                throw dbError;
            });

            await expect(
                service.getResultTrends(mockPatientId, 'GLU', mockWorkplaceId)
            ).rejects.toThrow('Failed to get result trends: Error: Database query failed');
        });
    });

    describe('updateLabOrderStatus', () => {
        const orderId = new Types.ObjectId().toString();
        const mockUpdatedOrder = {
            _id: orderId,
            status: 'completed',
            updatedAt: new Date(),
        };

        beforeEach(() => {
            mockedLabOrder.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder as any);
        });

        it('should update lab order status successfully', async () => {
            const result = await service.updateLabOrderStatus(orderId, 'completed', mockWorkplaceId);

            expect(mockedLabOrder.findOneAndUpdate).toHaveBeenCalledWith(
                {
                    _id: orderId,
                    workplaceId: expect.any(Types.ObjectId),
                },
                {
                    status: 'completed',
                    updatedAt: expect.any(Date),
                },
                { new: true }
            );

            expect(result).toBe(mockUpdatedOrder);
            expect(logger.info).toHaveBeenCalledWith(
                'Lab order status updated',
                {
                    orderId,
                    status: 'completed',
                    workplaceId: mockWorkplaceId,
                }
            );
        });

        it('should throw error when order not found', async () => {
            mockedLabOrder.findOneAndUpdate.mockResolvedValue(null);

            await expect(
                service.updateLabOrderStatus(orderId, 'completed', mockWorkplaceId)
            ).rejects.toThrow('Lab order not found or access denied');
        });
    });

    describe('getLabOrderById', () => {
        const orderId = new Types.ObjectId().toString();
        const mockOrder = {
            _id: orderId,
            patientId: { firstName: 'John', lastName: 'Doe' },
            orderedBy: { firstName: 'Dr. Jane', lastName: 'Smith' },
        };

        beforeEach(() => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockOrder),
            };
            mockedLabOrder.findOne.mockReturnValue(mockQuery as any);
        });

        it('should retrieve lab order by ID', async () => {
            const result = await service.getLabOrderById(orderId, mockWorkplaceId);

            expect(mockedLabOrder.findOne).toHaveBeenCalledWith({
                _id: orderId,
                workplaceId: expect.any(Types.ObjectId),
            });

            expect(result).toBe(mockOrder);
        });

        it('should return null when order not found', async () => {
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(null),
            };
            mockedLabOrder.findOne.mockReturnValue(mockQuery as any);

            const result = await service.getLabOrderById(orderId, mockWorkplaceId);

            expect(result).toBeNull();
        });
    });

    describe('deleteLabOrder', () => {
        const orderId = new Types.ObjectId().toString();
        const mockOrder = { _id: orderId };

        beforeEach(() => {
            mockedLabOrder.findOneAndUpdate.mockResolvedValue(mockOrder as any);
        });

        it('should soft delete lab order', async () => {
            const result = await service.deleteLabOrder(orderId, mockWorkplaceId);

            expect(mockedLabOrder.findOneAndUpdate).toHaveBeenCalledWith(
                {
                    _id: orderId,
                    workplaceId: expect.any(Types.ObjectId),
                },
                {
                    status: 'cancelled',
                    updatedAt: expect.any(Date),
                }
            );

            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('Lab order cancelled', {
                orderId,
                workplaceId: mockWorkplaceId,
            });
        });

        it('should throw error when order not found', async () => {
            mockedLabOrder.findOneAndUpdate.mockResolvedValue(null);

            await expect(service.deleteLabOrder(orderId, mockWorkplaceId)).rejects.toThrow(
                'Lab order not found or access denied'
            );
        });
    });

    describe('private helper methods', () => {
        it('should parse numeric values correctly', () => {
            // Access private method for testing
            const parseNumericValue = (service as any).parseNumericValue.bind(service);

            expect(parseNumericValue('123')).toBe(123);
            expect(parseNumericValue('123.45')).toBe(123.45);
            expect(parseNumericValue('>100')).toBe(100);
            expect(parseNumericValue('<50')).toBe(50);
            expect(parseNumericValue('≥75')).toBe(75);
            expect(parseNumericValue('positive')).toBeNull();
            expect(parseNumericValue('')).toBeNull();
        });

        it('should identify critical values correctly', () => {
            const isCriticalLow = (service as any).isCriticalLow.bind(service);
            const isCriticalHigh = (service as any).isCriticalHigh.bind(service);

            // Critical low values
            expect(isCriticalLow('GLU', 35)).toBe(true);  // < 40
            expect(isCriticalLow('GLU', 45)).toBe(false); // >= 40
            expect(isCriticalLow('K', 2.0)).toBe(true);   // < 2.5
            expect(isCriticalLow('HGB', 5.0)).toBe(true); // < 6.0

            // Critical high values
            expect(isCriticalHigh('GLU', 450)).toBe(true);  // > 400
            expect(isCriticalHigh('GLU', 350)).toBe(false); // <= 400
            expect(isCriticalHigh('K', 7.0)).toBe(true);    // > 6.5
            expect(isCriticalHigh('CREA', 6.0)).toBe(true); // > 5.0
        });

        it('should interpret qualitative results correctly', () => {
            const interpretQualitativeResult = (service as any).interpretQualitativeResult.bind(service);

            expect(interpretQualitativeResult('negative', 'URINE')).toBe('normal');
            expect(interpretQualitativeResult('normal', 'TEST')).toBe('normal');
            expect(interpretQualitativeResult('within normal limits', 'TEST')).toBe('normal');
            expect(interpretQualitativeResult('positive', 'URINE')).toBe('abnormal');
            expect(interpretQualitativeResult('elevated', 'TEST')).toBe('abnormal');
            expect(interpretQualitativeResult('unknown result', 'TEST')).toBe('abnormal');
        });

        it('should determine trend direction correctly', () => {
            const isImprovingTrend = (service as any).isImprovingTrend.bind(service);

            // For tests where increasing is better (HGB, PLT, ALB)
            expect(isImprovingTrend('HGB', 10)).toBe(true);  // Increasing hemoglobin is good
            expect(isImprovingTrend('HGB', -10)).toBe(false); // Decreasing hemoglobin is bad

            // For tests where decreasing is better (GLU, CREA, CHOL)
            expect(isImprovingTrend('GLU', -10)).toBe(true);  // Decreasing glucose is good
            expect(isImprovingTrend('GLU', 10)).toBe(false);  // Increasing glucose is bad

            // For other tests, stable is better
            expect(isImprovingTrend('OTHER', 5)).toBe(true);   // Small change is stable
            expect(isImprovingTrend('OTHER', 15)).toBe(false); // Large change is unstable
        });
    });
});