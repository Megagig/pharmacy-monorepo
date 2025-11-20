import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import LabOrder, { ILabOrder } from '../models/LabOrder';
import LabResult, { ILabResult } from '../models/LabResult';
import Patient from '../../../models/Patient';
import FHIRService, { FHIRBundle, PatientMapping, FHIRImportResult } from './fhirService';

export interface CreateLabOrderRequest {
    patientId: string;
    orderedBy: string;
    workplaceId: string;
    locationId?: string;
    tests: Array<{
        code: string;
        name: string;
        loincCode?: string;
        indication: string;
        priority: 'stat' | 'urgent' | 'routine';
    }>;
    expectedDate?: Date;
    externalOrderId?: string;
}

export interface CreateLabResultRequest {
    orderId?: string;
    patientId: string;
    workplaceId: string;
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange: {
        low?: number;
        high?: number;
        text?: string;
    };
    performedAt: Date;
    recordedBy: string;
    source?: 'manual' | 'fhir' | 'lis' | 'external';
    externalResultId?: string;
    loincCode?: string;
}

export interface ValidationResult {
    isValid: boolean;
    interpretation: 'low' | 'normal' | 'high' | 'critical' | 'abnormal';
    flags: string[];
    recommendations: string[];
}

export interface TrendData {
    testCode: string;
    testName: string;
    results: Array<{
        value: number;
        unit: string;
        performedAt: Date;
        interpretation: string;
    }>;
    trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
    analysis: {
        averageValue: number;
        changePercent: number;
        timeSpan: number; // days
    };
}

export interface LabOrderFilters {
    patientId?: string;
    status?: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
    priority?: 'stat' | 'urgent' | 'routine';
    dateFrom?: Date;
    dateTo?: Date;
    testCode?: string;
}

export interface LabResultFilters {
    patientId?: string;
    testCode?: string;
    interpretation?: 'low' | 'normal' | 'high' | 'critical' | 'abnormal';
    dateFrom?: Date;
    dateTo?: Date;
    source?: 'manual' | 'fhir' | 'lis' | 'external';
}

export class LabService {
    /**
     * Create a new lab order
     */
    async createLabOrder(orderData: CreateLabOrderRequest): Promise<ILabOrder> {
        try {
            // Validate patient exists and belongs to workplace
            const patient = await Patient.findOne({
                _id: orderData.patientId,
                workplaceId: orderData.workplaceId,
            });

            if (!patient) {
                throw new Error('Patient not found or does not belong to this workplace');
            }

            // Create lab order
            const labOrder = new LabOrder({
                patientId: new Types.ObjectId(orderData.patientId),
                orderedBy: new Types.ObjectId(orderData.orderedBy),
                workplaceId: new Types.ObjectId(orderData.workplaceId),
                locationId: orderData.locationId,
                tests: orderData.tests,
                status: 'ordered',
                orderDate: new Date(),
                expectedDate: orderData.expectedDate,
                externalOrderId: orderData.externalOrderId,
            });

            const savedOrder = await labOrder.save();

            logger.info('Lab order created successfully', {
                orderId: savedOrder._id,
                patientId: orderData.patientId,
                testsCount: orderData.tests.length,
                workplaceId: orderData.workplaceId,
            });

            return savedOrder;
        } catch (error) {
            logger.error('Failed to create lab order:', error);
            throw new Error(`Failed to create lab order: ${error}`);
        }
    }

    /**
     * Get lab orders with filtering and pagination
     */
    async getLabOrders(
        workplaceId: string,
        filters: LabOrderFilters = {},
        page: number = 1,
        limit: number = 20
    ): Promise<{
        orders: ILabOrder[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const query: any = { workplaceId: new Types.ObjectId(workplaceId) };

            // Apply filters
            if (filters.patientId) {
                query.patientId = new Types.ObjectId(filters.patientId);
            }
            if (filters.status) {
                query.status = filters.status;
            }
            if (filters.priority) {
                query['tests.priority'] = filters.priority;
            }
            if (filters.testCode) {
                query['tests.code'] = filters.testCode;
            }
            if (filters.dateFrom || filters.dateTo) {
                query.orderDate = {};
                if (filters.dateFrom) {
                    query.orderDate.$gte = filters.dateFrom;
                }
                if (filters.dateTo) {
                    query.orderDate.$lte = filters.dateTo;
                }
            }

            const skip = (page - 1) * limit;

            const [orders, total] = await Promise.all([
                LabOrder.find(query)
                    .populate('patientId', 'firstName lastName dateOfBirth')
                    .populate('orderedBy', 'firstName lastName')
                    .sort({ orderDate: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                LabOrder.countDocuments(query),
            ]);

            const totalPages = Math.ceil(total / limit);

            logger.info('Lab orders retrieved', {
                workplaceId,
                total,
                page,
                filters: Object.keys(filters).length,
            });

            return {
                orders: orders as ILabOrder[],
                total,
                page,
                totalPages,
            };
        } catch (error) {
            logger.error('Failed to get lab orders:', error);
            throw new Error(`Failed to retrieve lab orders: ${error}`);
        }
    }

    /**
     * Update lab order status
     */
    async updateLabOrderStatus(
        orderId: string,
        status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled',
        workplaceId: string
    ): Promise<ILabOrder> {
        try {
            const updatedOrder = await LabOrder.findOneAndUpdate(
                {
                    _id: orderId,
                    workplaceId: new Types.ObjectId(workplaceId),
                },
                {
                    status,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!updatedOrder) {
                throw new Error('Lab order not found or access denied');
            }

            logger.info('Lab order status updated', {
                orderId,
                status,
                workplaceId,
            });

            return updatedOrder;
        } catch (error) {
            logger.error('Failed to update lab order status:', error);
            throw new Error(`Failed to update lab order status: ${error}`);
        }
    }  /**
   
* Add lab result
   */
    async addLabResult(resultData: CreateLabResultRequest): Promise<ILabResult> {
        try {
            // Validate patient exists and belongs to workplace
            const patient = await Patient.findOne({
                _id: resultData.patientId,
                workplaceId: resultData.workplaceId,
            });

            if (!patient) {
                throw new Error('Patient not found or does not belong to this workplace');
            }

            // Validate lab order if provided
            if (resultData.orderId) {
                const labOrder = await LabOrder.findOne({
                    _id: resultData.orderId,
                    workplaceId: new Types.ObjectId(resultData.workplaceId),
                });

                if (!labOrder) {
                    throw new Error('Lab order not found or access denied');
                }
            }

            // Validate and interpret the result
            const validation = await this.validateResult({
                testCode: resultData.testCode,
                testName: resultData.testName,
                value: resultData.value,
                unit: resultData.unit,
                referenceRange: resultData.referenceRange,
            } as any);

            // Create lab result
            const labResult = new LabResult({
                orderId: resultData.orderId ? new Types.ObjectId(resultData.orderId) : undefined,
                patientId: new Types.ObjectId(resultData.patientId),
                workplaceId: new Types.ObjectId(resultData.workplaceId),
                testCode: resultData.testCode,
                testName: resultData.testName,
                value: resultData.value,
                unit: resultData.unit,
                referenceRange: resultData.referenceRange,
                interpretation: validation.interpretation,
                flags: validation.flags,
                source: resultData.source || 'manual',
                performedAt: resultData.performedAt,
                recordedAt: new Date(),
                recordedBy: new Types.ObjectId(resultData.recordedBy),
                externalResultId: resultData.externalResultId,
                loincCode: resultData.loincCode,
            });

            const savedResult = await labResult.save();

            // Update lab order status if applicable
            if (resultData.orderId) {
                await this.updateLabOrderStatus(resultData.orderId, 'completed', resultData.workplaceId);
            }

            logger.info('Lab result added successfully', {
                resultId: savedResult._id,
                patientId: resultData.patientId,
                testCode: resultData.testCode,
                interpretation: validation.interpretation,
                workplaceId: resultData.workplaceId,
            });

            return savedResult;
        } catch (error) {
            logger.error('Failed to add lab result:', error);
            throw new Error(`Failed to add lab result: ${error}`);
        }
    }

    /**
     * Get lab results with filtering and pagination
     */
    async getLabResults(
        workplaceId: string,
        filters: LabResultFilters = {},
        page: number = 1,
        limit: number = 20
    ): Promise<{
        results: ILabResult[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            const query: any = { workplaceId: new Types.ObjectId(workplaceId) };

            // Apply filters
            if (filters.patientId) {
                query.patientId = new Types.ObjectId(filters.patientId);
            }
            if (filters.testCode) {
                query.testCode = filters.testCode;
            }
            if (filters.interpretation) {
                query.interpretation = filters.interpretation;
            }
            if (filters.source) {
                query.source = filters.source;
            }
            if (filters.dateFrom || filters.dateTo) {
                query.performedAt = {};
                if (filters.dateFrom) {
                    query.performedAt.$gte = filters.dateFrom;
                }
                if (filters.dateTo) {
                    query.performedAt.$lte = filters.dateTo;
                }
            }

            const skip = (page - 1) * limit;

            const [results, total] = await Promise.all([
                LabResult.find(query)
                    .populate('patientId', 'firstName lastName dateOfBirth')
                    .populate('recordedBy', 'firstName lastName')
                    .sort({ performedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                LabResult.countDocuments(query),
            ]);

            const totalPages = Math.ceil(total / limit);

            logger.info('Lab results retrieved', {
                workplaceId,
                total,
                page,
                filters: Object.keys(filters).length,
            });

            return {
                results: results as ILabResult[],
                total,
                page,
                totalPages,
            };
        } catch (error) {
            logger.error('Failed to get lab results:', error);
            throw new Error(`Failed to retrieve lab results: ${error}`);
        }
    }
    /**
      * Validate lab result and determine interpretation
      */
    async validateResult(result: ILabResult): Promise<ValidationResult> {
        try {
            const flags: string[] = [];
            const recommendations: string[] = [];
            let interpretation: 'low' | 'normal' | 'high' | 'critical' | 'abnormal' = 'normal';

            // Parse numeric value if possible
            const numericValue = this.parseNumericValue(result.value);

            if (numericValue !== null && result.referenceRange) {
                // Numeric validation
                if (result.referenceRange.low !== undefined && numericValue < result.referenceRange.low) {
                    interpretation = 'low';
                    flags.push('Below reference range');

                    // Check for critical low values
                    if (this.isCriticalLow(result.testCode, numericValue)) {
                        interpretation = 'critical';
                        flags.push('CRITICAL LOW');
                        recommendations.push('Immediate clinical attention required');
                    }
                } else if (result.referenceRange.high !== undefined && numericValue > result.referenceRange.high) {
                    interpretation = 'high';
                    flags.push('Above reference range');

                    // Check for critical high values
                    if (this.isCriticalHigh(result.testCode, numericValue)) {
                        interpretation = 'critical';
                        flags.push('CRITICAL HIGH');
                        recommendations.push('Immediate clinical attention required');
                    }
                }
            } else {
                // Non-numeric or qualitative results
                interpretation = this.interpretQualitativeResult(result.value, result.testCode);
                if (interpretation === 'abnormal') {
                    flags.push('Abnormal result');
                    recommendations.push('Clinical correlation recommended');
                }
            }

            // Add test-specific recommendations
            const testRecommendations = this.getTestSpecificRecommendations(
                result.testCode,
                interpretation,
                numericValue
            );
            recommendations.push(...testRecommendations);

            return {
                isValid: true,
                interpretation,
                flags,
                recommendations,
            };
        } catch (error) {
            logger.error('Failed to validate lab result:', error);
            return {
                isValid: false,
                interpretation: 'abnormal',
                flags: ['Validation error'],
                recommendations: ['Manual review required'],
            };
        }
    }

    /**
     * Get result trends for a specific test
     */
    async getResultTrends(
        patientId: string,
        testCode: string,
        workplaceId: string,
        daysBack: number = 90
    ): Promise<TrendData> {
        try {
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - daysBack);

            const results = await LabResult.find({
                patientId: new Types.ObjectId(patientId),
                testCode,
                workplaceId: new Types.ObjectId(workplaceId),
                performedAt: { $gte: dateFrom },
            })
                .sort({ performedAt: 1 })
                .lean();

            if (results.length < 2) {
                return {
                    testCode,
                    testName: results[0]?.testName || testCode,
                    results: [],
                    trend: 'insufficient_data',
                    analysis: {
                        averageValue: 0,
                        changePercent: 0,
                        timeSpan: 0,
                    },
                };
            }

            // Convert to numeric values for trend analysis
            const numericResults = results
                .map(result => ({
                    value: this.parseNumericValue(result.value),
                    unit: result.unit || '',
                    performedAt: result.performedAt,
                    interpretation: result.interpretation,
                }))
                .filter(result => result.value !== null) as Array<{
                    value: number;
                    unit: string;
                    performedAt: Date;
                    interpretation: string;
                }>;

            if (numericResults.length < 2) {
                return {
                    testCode,
                    testName: results[0]?.testName || testCode,
                    results: [],
                    trend: 'insufficient_data',
                    analysis: {
                        averageValue: 0,
                        changePercent: 0,
                        timeSpan: 0,
                    },
                };
            }

            // Calculate trend
            const firstValue = numericResults[0]!.value;
            const lastValue = numericResults[numericResults.length - 1]!.value;
            const averageValue = numericResults.reduce((sum, r) => sum + r.value, 0) / numericResults.length;
            const changePercent = ((lastValue - firstValue) / firstValue) * 100;
            const timeSpan = Math.ceil(
                (numericResults[numericResults.length - 1]!.performedAt.getTime() -
                    numericResults[0]!.performedAt.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Determine trend direction
            let trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data' = 'stable';

            if (Math.abs(changePercent) < 5) {
                trend = 'stable';
            } else {
                // Trend interpretation depends on the test type
                const isImprovingTrend = this.isImprovingTrend(testCode, changePercent);
                trend = isImprovingTrend ? 'improving' : 'worsening';
            }

            logger.info('Result trends calculated', {
                patientId,
                testCode,
                resultsCount: numericResults.length,
                trend,
                changePercent: Math.round(changePercent * 100) / 100,
            });

            return {
                testCode,
                testName: results[0]!.testName,
                results: numericResults,
                trend,
                analysis: {
                    averageValue: Math.round(averageValue * 100) / 100,
                    changePercent: Math.round(changePercent * 100) / 100,
                    timeSpan,
                },
            };
        } catch (error) {
            logger.error('Failed to get result trends:', error);
            throw new Error(`Failed to get result trends: ${error}`);
        }
    }  /**

   * Parse numeric value from string
   */
    private parseNumericValue(value: string): number | null {
        // Remove common non-numeric characters and parse
        const cleaned = value.replace(/[<>≤≥±~]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Check if value is critically low for specific test
     */
    private isCriticalLow(testCode: string, value: number): boolean {
        const criticalLowValues: Record<string, number> = {
            'GLU': 40,      // Glucose < 40 mg/dL
            'K': 2.5,       // Potassium < 2.5 mEq/L
            'NA': 120,      // Sodium < 120 mEq/L
            'HGB': 6.0,     // Hemoglobin < 6.0 g/dL
            'PLT': 20000,   // Platelets < 20,000
            'WBC': 1.0,     // WBC < 1.0 K/uL
        };

        const threshold = criticalLowValues[testCode.toUpperCase()];
        return threshold !== undefined && value < threshold;
    }

    /**
     * Check if value is critically high for specific test
     */
    private isCriticalHigh(testCode: string, value: number): boolean {
        const criticalHighValues: Record<string, number> = {
            'GLU': 400,     // Glucose > 400 mg/dL
            'K': 6.5,       // Potassium > 6.5 mEq/L
            'CREA': 5.0,    // Creatinine > 5.0 mg/dL
            'WBC': 50.0,    // WBC > 50.0 K/uL
            'TEMP': 40.0,   // Temperature > 40°C
        };

        const threshold = criticalHighValues[testCode.toUpperCase()];
        return threshold !== undefined && value > threshold;
    }

    /**
     * Interpret qualitative results
     */
    private interpretQualitativeResult(value: string, testCode: string): 'normal' | 'abnormal' {
        const normalValues = ['negative', 'normal', 'within normal limits', 'wnl', 'neg'];
        const abnormalValues = ['positive', 'abnormal', 'elevated', 'pos'];

        const lowerValue = value.toLowerCase().trim();

        if (normalValues.some(normal => lowerValue.includes(normal))) {
            return 'normal';
        }

        if (abnormalValues.some(abnormal => lowerValue.includes(abnormal))) {
            return 'abnormal';
        }

        // Default to abnormal for safety if unclear
        return 'abnormal';
    }

    /**
     * Get test-specific recommendations
     */
    private getTestSpecificRecommendations(
        testCode: string,
        interpretation: string,
        value: number | null
    ): string[] {
        const recommendations: string[] = [];

        switch (testCode.toUpperCase()) {
            case 'GLU':
                if (interpretation === 'high') {
                    recommendations.push('Monitor for diabetes', 'Consider HbA1c if not recent');
                } else if (interpretation === 'low') {
                    recommendations.push('Evaluate for hypoglycemia causes', 'Monitor symptoms');
                }
                break;

            case 'CREA':
                if (interpretation === 'high') {
                    recommendations.push('Assess kidney function', 'Review medications for nephrotoxicity');
                }
                break;

            case 'K':
                if (interpretation === 'high') {
                    recommendations.push('Check ECG for hyperkalemia changes', 'Review ACE inhibitors');
                } else if (interpretation === 'low') {
                    recommendations.push('Consider potassium supplementation', 'Monitor for arrhythmias');
                }
                break;

            case 'HGB':
                if (interpretation === 'low') {
                    recommendations.push('Evaluate for anemia causes', 'Consider iron studies');
                }
                break;

            default:
                if (interpretation === 'critical') {
                    recommendations.push('Immediate clinical correlation required');
                } else if (interpretation === 'abnormal') {
                    recommendations.push('Clinical correlation recommended');
                }
        }

        return recommendations;
    }

    /**
     * Determine if trend is improving based on test type
     */
    private isImprovingTrend(testCode: string, changePercent: number): boolean {
        // For some tests, increasing values are good, for others decreasing is good
        const increasingIsBetter = ['HGB', 'PLT', 'ALB']; // Hemoglobin, Platelets, Albumin
        const decreasingIsBetter = ['GLU', 'CREA', 'CHOL', 'LDL']; // Glucose, Creatinine, Cholesterol, LDL

        const upperTestCode = testCode.toUpperCase();

        if (increasingIsBetter.includes(upperTestCode)) {
            return changePercent > 0;
        }

        if (decreasingIsBetter.includes(upperTestCode)) {
            return changePercent < 0;
        }

        // For other tests, stable is generally better
        return Math.abs(changePercent) < 10;
    }

    /**
     * Get lab order by ID
     */
    async getLabOrderById(orderId: string, workplaceId: string): Promise<ILabOrder | null> {
        try {
            const order = await LabOrder.findOne({
                _id: orderId,
                workplaceId: new Types.ObjectId(workplaceId),
            })
                .populate('patientId', 'firstName lastName dateOfBirth')
                .populate('orderedBy', 'firstName lastName')
                .lean();

            return order as ILabOrder | null;
        } catch (error) {
            logger.error('Failed to get lab order by ID:', error);
            throw new Error(`Failed to get lab order: ${error}`);
        }
    }

    /**
     * Get lab result by ID
     */
    async getLabResultById(resultId: string, workplaceId: string): Promise<ILabResult | null> {
        try {
            const result = await LabResult.findOne({
                _id: resultId,
                workplaceId: new Types.ObjectId(workplaceId),
            })
                .populate('patientId', 'firstName lastName dateOfBirth')
                .populate('recordedBy', 'firstName lastName')
                .lean();

            return result as ILabResult | null;
        } catch (error) {
            logger.error('Failed to get lab result by ID:', error);
            throw new Error(`Failed to get lab result: ${error}`);
        }
    }

    /**
     * Update lab order
     */
    async updateLabOrder(
        orderId: string,
        updates: Partial<ILabOrder>,
        updatedBy: string
    ): Promise<ILabOrder> {
        try {
            const updatedOrder = await LabOrder.findByIdAndUpdate(
                orderId,
                {
                    ...updates,
                    updatedAt: new Date(),
                    updatedBy: new Types.ObjectId(updatedBy),
                },
                { new: true }
            );

            if (!updatedOrder) {
                throw new Error('Lab order not found');
            }

            logger.info('Lab order updated', { orderId, updates: Object.keys(updates) });
            return updatedOrder;
        } catch (error) {
            logger.error('Failed to update lab order:', error);
            throw new Error(`Failed to update lab order: ${error}`);
        }
    }

    /**
     * Cancel lab order
     */
    async cancelLabOrder(orderId: string, cancelledBy: string): Promise<ILabOrder> {
        try {
            const cancelledOrder = await LabOrder.findByIdAndUpdate(
                orderId,
                {
                    status: 'cancelled',
                    updatedAt: new Date(),
                    updatedBy: new Types.ObjectId(cancelledBy),
                },
                { new: true }
            );

            if (!cancelledOrder) {
                throw new Error('Lab order not found');
            }

            logger.info('Lab order cancelled', { orderId, cancelledBy });
            return cancelledOrder;
        } catch (error) {
            logger.error('Failed to cancel lab order:', error);
            throw new Error(`Failed to cancel lab order: ${error}`);
        }
    }

    /**
     * Update lab result
     */
    async updateLabResult(
        resultId: string,
        updates: Partial<ILabResult>,
        updatedBy: string
    ): Promise<ILabResult> {
        try {
            const updatedResult = await LabResult.findByIdAndUpdate(
                resultId,
                {
                    ...updates,
                    updatedAt: new Date(),
                    updatedBy: new Types.ObjectId(updatedBy),
                },
                { new: true }
            );

            if (!updatedResult) {
                throw new Error('Lab result not found');
            }

            logger.info('Lab result updated', { resultId, updates: Object.keys(updates) });
            return updatedResult;
        } catch (error) {
            logger.error('Failed to update lab result:', error);
            throw new Error(`Failed to update lab result: ${error}`);
        }
    }

    /**
     * Import lab results from FHIR bundle
     */
    async importFHIRResults(
        fhirBundle: FHIRBundle,
        patientMappings: PatientMapping[],
        workplaceId: string,
        importedBy: string
    ): Promise<FHIRImportResult> {
        try {
            // Create FHIR service instance (configuration would come from environment/settings)
            const fhirConfig = {
                baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(fhirConfig);

            // Import the bundle
            const importResult = await fhirService.importLabResults(fhirBundle, patientMappings);

            logger.info('FHIR lab results import completed', {
                workplaceId,
                importedBy,
                bundleId: fhirBundle.id,
                imported: importResult.imported.length,
                failed: importResult.failed.length,
            });

            return importResult;
        } catch (error) {
            logger.error('Failed to import FHIR lab results:', error);
            throw new Error(`Failed to import FHIR lab results: ${error}`);
        }
    }

    /**
     * Export lab order to FHIR format
     */
    async exportLabOrderToFHIR(orderId: string, workplaceId: string): Promise<any> {
        try {
            const labOrder = await LabOrder.findOne({
                _id: orderId,
                workplaceId: new Types.ObjectId(workplaceId),
            });

            if (!labOrder) {
                throw new Error('Lab order not found');
            }

            // Create FHIR service instance
            const fhirConfig = {
                baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(fhirConfig);

            // Export to FHIR format
            const fhirServiceRequest = await fhirService.exportLabOrder(labOrder);

            logger.info('Lab order exported to FHIR format', {
                orderId,
                workplaceId,
                fhirId: fhirServiceRequest.id,
            });

            return fhirServiceRequest;
        } catch (error) {
            logger.error('Failed to export lab order to FHIR:', error);
            throw new Error(`Failed to export lab order to FHIR: ${error}`);
        }
    }

    /**
     * Sync lab results from external FHIR server
     */
    async syncLabResultsFromFHIR(
        patientId: string,
        workplaceId: string,
        fromDate?: Date,
        toDate?: Date
    ): Promise<{ synced: number; errors: string[] }> {
        try {
            // Create FHIR service instance
            const fhirConfig = {
                baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(fhirConfig);

            // Fetch lab results from FHIR server
            const fhirBundle = await fhirService.fetchLabResults(patientId, fromDate, toDate);

            // Create patient mapping
            const patientMappings: PatientMapping[] = [{
                fhirPatientId: patientId,
                internalPatientId: patientId,
                workplaceId,
            }];

            // Import the results
            const importResult = await fhirService.importLabResults(fhirBundle, patientMappings);

            logger.info('Lab results synced from FHIR server', {
                patientId,
                workplaceId,
                synced: importResult.imported.length,
                errors: importResult.failed.length,
            });

            return {
                synced: importResult.imported.length,
                errors: importResult.failed.map(f => f.error),
            };
        } catch (error) {
            logger.error('Failed to sync lab results from FHIR:', error);
            throw new Error(`Failed to sync lab results from FHIR: ${error}`);
        }
    }

    /**
     * Test FHIR server connection
     */
    async testFHIRConnection(): Promise<{ connected: boolean; error?: string }> {
        try {
            const fhirConfig = {
                baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
                version: 'R4' as const,
                timeout: 30000,
                retryAttempts: 3,
            };

            const fhirService = new FHIRService(fhirConfig);
            const connected = await fhirService.testConnection();

            return { connected };
        } catch (error) {
            logger.error('FHIR connection test failed:', error);
            return {
                connected: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Delete lab order (soft delete by setting status to cancelled)
     */
    async deleteLabOrder(orderId: string, workplaceId: string): Promise<boolean> {
        try {
            const result = await LabOrder.findOneAndUpdate(
                {
                    _id: orderId,
                    workplaceId: new Types.ObjectId(workplaceId),
                },
                {
                    status: 'cancelled',
                    updatedAt: new Date(),
                }
            );

            if (!result) {
                throw new Error('Lab order not found or access denied');
            }

            logger.info('Lab order cancelled', { orderId, workplaceId });
            return true;
        } catch (error) {
            logger.error('Failed to delete lab order:', error);
            throw new Error(`Failed to delete lab order: ${error}`);
        }
    }
}

export default new LabService();