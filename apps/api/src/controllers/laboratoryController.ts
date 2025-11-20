import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import LabResult from '../models/LabResult';
import Patient from '../models/Patient';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import { uploadDocument, deleteDocument } from '../config/cloudinary';
import fs from 'fs';
import path from 'path';
import { parseLabResultPDF } from '../services/pdfParsingService';
import { parseLabResultCSV, generateCSVTemplate } from '../services/csvParsingService';
import { sendCriticalValueAlert, sendAbnormalResultNotification, sendNewResultNotification } from '../services/labAlertService';

/**
 * Laboratory Controller
 * Handles all lab result operations including CRUD, statistics, file uploads
 */

/**
 * Helper function to build query filter for workspace isolation
 * Super admins can access all workspaces, others are restricted to their workplace
 */
const buildWorkspaceQuery = (req: AuthRequest, additionalFilters: any = {}): any => {
    const userRole = req.user?.role;
    const workplaceId = req.user?.workplaceId;

    const query = { ...additionalFilters };

    // Super admins can access all workspaces
    if (userRole === 'super_admin') {
        return query;
    }

    // Non-super admins must have a workplace and can only access their workplace data
    if (!workplaceId) {
        throw new Error('Workplace not found');
    }

    query.workplaceId = new mongoose.Types.ObjectId(workplaceId as string);
    return query;
};

/**
 * @route   POST /api/laboratory/results
 * @desc    Create a new lab result
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
export const createLabResult = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        let workplaceId = req.user?.workplaceId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        const {
            patientId,
            testName,
            testCode,
            loincCode,
            testCategory,
            specimenType,
            testValue,
            numericValue,
            unit,
            referenceRange,
            referenceRangeLow,
            referenceRangeHigh,
            interpretation,
            isCritical,
            isAbnormal,
            testDate,
            resultDate,
            orderingPhysician,
            performingLaboratory,
            laboratoryAddress,
            accessionNumber,
            notes,
            clinicalIndication,
            status,
            orderId,
            diagnosticCaseId,
            labIntegrationId
        } = req.body;

        // Validate patient exists and get their workplace
        const patient = await Patient.findById(patientId);
        if (!patient) {
            res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
            return;
        }

        // For super admins without a workplace, use the patient's workplace
        if (userRole === 'super_admin' && !workplaceId) {
            workplaceId = patient.workplaceId;
            logger.info('Super admin creating lab result - using patient workplace', {
                userId,
                patientId,
                workplaceId: workplaceId?.toString()
            });
        }

        // Now validate workplaceId exists
        if (!workplaceId) {
            res.status(400).json({
                success: false,
                message: 'Workplace not found. Please ensure the patient is associated with a workplace.'
            });
            return;
        }

        // Create lab result
        const labResult = await LabResult.create({
            patientId,
            workplaceId,
            testName,
            testCode,
            loincCode,
            testCategory,
            specimenType,
            testValue,
            numericValue,
            unit,
            referenceRange,
            referenceRangeLow,
            referenceRangeHigh,
            interpretation: interpretation || 'Pending',
            isCritical: isCritical || false,
            isAbnormal: isAbnormal || false,
            testDate: testDate || new Date(),
            resultDate,
            orderingPhysician,
            performingLaboratory,
            laboratoryAddress,
            accessionNumber,
            notes,
            clinicalIndication,
            status: status || 'Pending',
            orderId,
            diagnosticCaseId,
            labIntegrationId,
            createdBy: userId,
            aiProcessed: false,
            alertSent: false,
            attachments: []
        });

        // Populate patient details
        await labResult.populate('patientId', 'firstName lastName dateOfBirth mrn');

        // Send alerts asynchronously (don't wait for completion)
        if (labResult.isCritical) {
            sendCriticalValueAlert(labResult._id.toString(), workplaceId as string).catch(err =>
                logger.error('Failed to send critical value alert', { error: err.message })
            );
        } else if (labResult.isAbnormal) {
            sendAbnormalResultNotification(labResult._id.toString(), workplaceId as string).catch(err =>
                logger.error('Failed to send abnormal result notification', { error: err.message })
            );
        } else {
            sendNewResultNotification(labResult._id.toString(), workplaceId as string).catch(err =>
                logger.error('Failed to send new result notification', { error: err.message })
            );
        }

        logger.info('Lab result created successfully', {
            labResultId: labResult._id,
            patientId,
            testName,
            userId
        });

        res.status(201).json({
            success: true,
            message: 'Lab result created successfully',
            data: labResult
        });

    } catch (error) {
        logger.error('Error creating lab result', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results
 * @desc    Get all lab results with filtering and pagination
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            patientId,
            testCategory,
            status,
            isCritical,
            isAbnormal,
            performingLaboratory,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 20,
            sortBy = 'testDate',
            sortOrder = 'desc'
        } = req.query;

        // Build query with workspace isolation
        const query: any = buildWorkspaceQuery(req, { isDeleted: false });

        if (patientId) query.patientId = new mongoose.Types.ObjectId(patientId as string);
        if (testCategory) query.testCategory = testCategory;
        if (status) query.status = status;
        if (isCritical !== undefined) query.isCritical = isCritical === 'true';
        if (isAbnormal !== undefined) query.isAbnormal = isAbnormal === 'true';
        if (performingLaboratory) query.performingLaboratory = performingLaboratory;

        // Date range filter
        if (startDate || endDate) {
            query.testDate = {};
            if (startDate) query.testDate.$gte = new Date(startDate as string);
            if (endDate) query.testDate.$lte = new Date(endDate as string);
        }

        // Search filter (test name or accession number)
        if (search) {
            query.$or = [
                { testName: { $regex: search, $options: 'i' } },
                { accessionNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);
        const sort: any = {};
        sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const [results, total] = await Promise.all([
            LabResult.find(query)
                .populate('patientId', 'firstName lastName dateOfBirth mrn')
                .populate('createdBy', 'firstName lastName')
                .populate('signedOffBy', 'firstName lastName')
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            LabResult.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: {
                results,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/statistics
 * @desc    Get lab results statistics
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getLabResultStatistics = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userRole = req.user?.role;
        const workplaceId = req.user?.workplaceId;

        // Super admins get global statistics, others get workplace-specific
        const targetWorkplaceId = userRole === 'super_admin' && !workplaceId
            ? null
            : new mongoose.Types.ObjectId(workplaceId as string);

        const { startDate, endDate } = req.query;

        let dateRange: { start: Date; end: Date } | undefined;
        if (startDate && endDate) {
            dateRange = {
                start: new Date(startDate as string),
                end: new Date(endDate as string)
            };
        }

        const stats = targetWorkplaceId
            ? await LabResult.getStatistics(targetWorkplaceId, dateRange)
            : await LabResult.getStatistics(undefined as any, dateRange);

        // Get this week's count
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);

        const thisWeekCount = await LabResult.countDocuments({
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            testDate: { $gte: weekStart },
            isDeleted: false
        });

        res.status(200).json({
            success: true,
            data: {
                ...stats,
                thisWeek: thisWeekCount
            }
        });

    } catch (error) {
        logger.error('Error fetching lab result statistics', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/critical
 * @desc    Get all critical lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getCriticalLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const results = await LabResult.findCritical(
            new mongoose.Types.ObjectId(workplaceId as string)
        )
            .populate('patientId', 'firstName lastName dateOfBirth mrn')
            .populate('createdBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: results
        });

    } catch (error) {
        logger.error('Error fetching critical lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/pending
 * @desc    Get all pending lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getPendingLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const results = await LabResult.findPending(
            new mongoose.Types.ObjectId(workplaceId as string)
        )
            .populate('patientId', 'firstName lastName dateOfBirth mrn')
            .populate('createdBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: results
        });

    } catch (error) {
        logger.error('Error fetching pending lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/abnormal
 * @desc    Get all abnormal lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getAbnormalLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const workplaceId = req.user?.workplaceId;

        if (!workplaceId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Workplace not found'
            });
            return;
        }

        const results = await LabResult.findAbnormal(
            new mongoose.Types.ObjectId(workplaceId as string)
        )
            .populate('patientId', 'firstName lastName dateOfBirth mrn')
            .populate('createdBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: results
        });

    } catch (error) {
        logger.error('Error fetching abnormal lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/patient/:patientId
 * @desc    Get all lab results for a specific patient
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getPatientLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId } = req.params;
        const { startDate, endDate, testCategory, limit } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const workplaceId = req.user?.workplaceId;

        // Build query - super admins can see all results, others filtered by workplace
        const query: any = {
            patientId: new mongoose.Types.ObjectId(patientId),
            isDeleted: false
        };

        // Filter by workplace for non-super-admin users
        if (userRole !== 'super_admin' && workplaceId) {
            query.workplaceId = new mongoose.Types.ObjectId(workplaceId as string);
        }

        // Add date filters
        if (startDate || endDate) {
            query.testDate = {};
            if (startDate) query.testDate.$gte = new Date(startDate as string);
            if (endDate) query.testDate.$lte = new Date(endDate as string);
        }

        // Add category filter
        if (testCategory) {
            query.testCategory = testCategory;
        }

        // Build query with filters
        let queryBuilder = LabResult.find(query)
            .populate('createdBy', 'firstName lastName')
            .populate('signedOffBy', 'firstName lastName')
            .sort({ testDate: -1 });

        // Apply limit if specified
        if (limit) {
            queryBuilder = queryBuilder.limit(Number(limit));
        }

        const results = await queryBuilder.lean();

        logger.info('Patient lab results fetched', {
            patientId,
            resultCount: results.length,
            userId,
            userRole,
            workplaceId
        });

        res.status(200).json({
            success: true,
            data: results
        });

    } catch (error) {
        logger.error('Error fetching patient lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            patientId: req.params.patientId,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/patient/:patientId/trends
 * @desc    Get lab result trends for a patient (for graphs)
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getPatientLabTrends = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { patientId } = req.params;
        const { testName, testCode, startDate, endDate } = req.query;

        const query: any = {
            patientId: new mongoose.Types.ObjectId(patientId),
            isDeleted: false
        };

        if (testName) query.testName = testName;
        if (testCode) query.testCode = testCode;

        if (startDate || endDate) {
            query.testDate = {};
            if (startDate) query.testDate.$gte = new Date(startDate as string);
            if (endDate) query.testDate.$lte = new Date(endDate as string);
        }

        const results = await LabResult.find(query)
            .select('testName testCode testValue numericValue unit testDate interpretation isCritical isAbnormal referenceRangeLow referenceRangeHigh')
            .sort({ testDate: 1 })
            .lean();

        // Group by test name for trend analysis
        const trendsByTest: Record<string, any[]> = {};
        results.forEach(result => {
            const key = result.testName;
            if (!trendsByTest[key]) {
                trendsByTest[key] = [];
            }
            trendsByTest[key].push({
                date: result.testDate,
                value: result.numericValue || result.testValue,
                unit: result.unit,
                interpretation: result.interpretation,
                isCritical: result.isCritical,
                isAbnormal: result.isAbnormal,
                referenceRangeLow: result.referenceRangeLow,
                referenceRangeHigh: result.referenceRangeHigh
            });
        });

        res.status(200).json({
            success: true,
            data: {
                trends: trendsByTest,
                totalResults: results.length
            }
        });

    } catch (error) {
        logger.error('Error fetching patient lab trends', {
            error: error instanceof Error ? error.message : 'Unknown error',
            patientId: req.params.patientId,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/results/:id
 * @desc    Get a specific lab result by ID
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getLabResultById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const workplaceId = req.user?.workplaceId;

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        })
            .populate('patientId', 'firstName lastName dateOfBirth mrn gender phone')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('signedOffBy', 'firstName lastName')
            .populate('reviewedBy.userId', 'firstName lastName')
            .lean();

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: labResult
        });

    } catch (error) {
        logger.error('Error fetching lab result by ID', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   PUT /api/laboratory/results/:id
 * @desc    Update a lab result
 * @access  Pharmacist, Lab Technician, Owner, Super Admin
 */
export const updateLabResult = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const workplaceId = req.user?.workplaceId;

        // Build query - super admins can access any workspace
        const query: any = {
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
        };

        // Non-super admins must match workplace
        if (userRole !== 'super_admin') {
            if (!workplaceId) {
                res.status(400).json({
                    success: false,
                    message: 'Workplace not found'
                });
                return;
            }
            query.workplaceId = new mongoose.Types.ObjectId(workplaceId as string);
        }

        const labResult = await LabResult.findOne(query);

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        // Don't allow updates to signed-off results
        if (labResult.status === 'Signed Off') {
            res.status(400).json({
                success: false,
                message: 'Cannot update a signed-off lab result'
            });
            return;
        }

        const allowedFields = [
            'testName', 'testCode', 'loincCode', 'testCategory', 'specimenType',
            'testValue', 'numericValue', 'unit', 'referenceRange',
            'referenceRangeLow', 'referenceRangeHigh', 'interpretation',
            'isCritical', 'isAbnormal', 'testDate', 'resultDate',
            'orderingPhysician', 'performingLaboratory', 'laboratoryAddress',
            'accessionNumber', 'notes', 'clinicalIndication', 'status'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                (labResult as any)[field] = req.body[field];
            }
        });

        labResult.updatedBy = new mongoose.Types.ObjectId(userId as string);
        await labResult.save();

        await labResult.populate('patientId', 'firstName lastName dateOfBirth mrn');

        logger.info('Lab result updated successfully', {
            labResultId: labResult._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Lab result updated successfully',
            data: labResult
        });

    } catch (error) {
        logger.error('Error updating lab result', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   DELETE /api/laboratory/results/:id
 * @desc    Delete a lab result (soft delete)
 * @access  Owner, Super Admin
 */
export const deleteLabResult = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        labResult.isDeleted = true;
        labResult.updatedBy = new mongoose.Types.ObjectId(userId as string);
        await labResult.save();

        logger.info('Lab result deleted successfully', {
            labResultId: labResult._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Lab result deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting lab result', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/results/:id/signoff
 * @desc    Sign off a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
export const signOffLabResult = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        await labResult.signOff(new mongoose.Types.ObjectId(userId as string));

        logger.info('Lab result signed off successfully', {
            labResultId: labResult._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Lab result signed off successfully',
            data: labResult
        });

    } catch (error) {
        logger.error('Error signing off lab result', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/results/:id/review
 * @desc    Add review to a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
export const reviewLabResult = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        if (!notes) {
            res.status(400).json({
                success: false,
                message: 'Review notes are required'
            });
            return;
        }

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        await labResult.addReview(new mongoose.Types.ObjectId(userId as string), notes);

        logger.info('Lab result reviewed successfully', {
            labResultId: labResult._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Review added successfully',
            data: labResult
        });

    } catch (error) {
        logger.error('Error reviewing lab result', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/results/:id/mark-critical
 * @desc    Mark a lab result as critical
 * @access  Pharmacist, Owner, Super Admin
 */
export const markLabResultAsCritical = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        await labResult.markAsCritical();

        logger.info('Lab result marked as critical', {
            labResultId: labResult._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Lab result marked as critical',
            data: labResult
        });

    } catch (error) {
        logger.error('Error marking lab result as critical', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/results/:id/attachments
 * @desc    Upload attachment (PDF/image) to a lab result
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
export const uploadLabResultAttachment = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;
        const file = req.file;

        if (!file) {
            res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
            return;
        }

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        let fileUrl: string;
        let publicId: string | undefined;
        let storageType: 'cloudinary' | 'local' = 'local';

        try {
            // Try Cloudinary first
            const uploadResult = await uploadDocument(
                file.buffer.toString('base64'),
                'laboratory-results'
            );
            fileUrl = uploadResult.secure_url;
            publicId = uploadResult.public_id;
            storageType = 'cloudinary';
        } catch (cloudinaryError) {
            // Fallback to local storage
            logger.warn('Cloudinary upload failed, using local storage', {
                error: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error'
            });

            const uploadsDir = path.join(process.cwd(), 'uploads', 'laboratory-results');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const fileName = `${Date.now()}-${file.originalname}`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, file.buffer);
            fileUrl = `/uploads/laboratory-results/${fileName}`;
        }

        const attachment = {
            fileName: file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            uploadedBy: new mongoose.Types.ObjectId(userId as string),
            uploadedAt: new Date(),
            cloudinaryPublicId: publicId
        };

        await labResult.addAttachment(attachment);

        logger.info('Lab result attachment uploaded successfully', {
            labResultId: labResult._id,
            fileName: file.originalname,
            storageType,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Attachment uploaded successfully',
            data: {
                attachment,
                labResult
            }
        });

    } catch (error) {
        logger.error('Error uploading lab result attachment', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   DELETE /api/laboratory/results/:id/attachments/:attachmentId
 * @desc    Remove attachment from a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
export const removeLabResultAttachment = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id, attachmentId } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const labResult = await LabResult.findOne({
            _id: new mongoose.Types.ObjectId(id),
            workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
            isDeleted: false
        });

        if (!labResult) {
            res.status(404).json({
                success: false,
                message: 'Lab result not found'
            });
            return;
        }

        const attachment = labResult.attachments.find(
            att => att._id?.toString() === attachmentId
        );

        if (!attachment) {
            res.status(404).json({
                success: false,
                message: 'Attachment not found'
            });
            return;
        }

        // Delete from Cloudinary if applicable
        if (attachment.cloudinaryPublicId) {
            try {
                await deleteDocument(attachment.cloudinaryPublicId);
            } catch (error) {
                logger.warn('Failed to delete from Cloudinary', {
                    publicId: attachment.cloudinaryPublicId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Delete from local storage if applicable
        if (!attachment.cloudinaryPublicId && attachment.url) {
            try {
                const filePath = path.join(process.cwd(), attachment.url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                logger.warn('Failed to delete local file', {
                    fileUrl: attachment.url,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        await labResult.removeAttachment(attachmentId);

        logger.info('Lab result attachment removed successfully', {
            labResultId: labResult._id,
            attachmentId,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Attachment removed successfully',
            data: labResult
        });

    } catch (error) {
        logger.error('Error removing lab result attachment', {
            error: error instanceof Error ? error.message : 'Unknown error',
            labResultId: req.params.id,
            attachmentId: req.params.attachmentId,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/upload
 * @desc    Upload lab result document (PDF) and parse
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
export const uploadAndParseLabDocument = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;
        const file = req.file;

        if (!file) {
            res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
            return;
        }

        // Upload to Cloudinary or local storage
        let fileUrl: string;
        let publicId: string | undefined;
        let storageType: 'cloudinary' | 'local' = 'local';

        try {
            const uploadResult = await uploadDocument(
                file.buffer.toString('base64'),
                'laboratory-documents'
            );
            fileUrl = uploadResult.secure_url;
            publicId = uploadResult.public_id;
            storageType = 'cloudinary';
        } catch (cloudinaryError) {
            logger.warn('Cloudinary upload failed, using local storage', {
                error: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error'
            });

            const uploadsDir = path.join(process.cwd(), 'uploads', 'laboratory-documents');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const fileName = `${Date.now()}-${file.originalname}`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, file.buffer);
            fileUrl = `/uploads/laboratory-documents/${fileName}`;
        }

        // Parse PDF if it's a PDF file
        let parseResult = null;
        if (file.mimetype === 'application/pdf') {
            parseResult = await parseLabResultPDF(file.buffer);

            if (!parseResult.success) {
                logger.warn('PDF parsing failed', {
                    error: parseResult.error,
                    fileName: file.originalname
                });
            }
        }

        const parsedData = {
            fileName: file.originalname,
            fileUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            storageType,
            cloudinaryPublicId: publicId,
            uploadedAt: new Date(),
            // Parsed data from PDF
            extractedText: parseResult?.rawText || null,
            parsedResults: parseResult?.results || [],
            metadata: parseResult?.metadata || null,
            parseSuccess: parseResult?.success || false,
            parseError: parseResult?.error || null
        };

        logger.info('Lab document uploaded and parsed', {
            fileName: file.originalname,
            storageType,
            parseSuccess: parseResult?.success,
            resultsCount: parseResult?.results?.length || 0,
            userId
        });

        res.status(200).json({
            success: true,
            message: parseResult?.success
                ? `Document uploaded and ${parseResult.results.length} lab results extracted successfully`
                : 'Document uploaded successfully. PDF parsing failed or not applicable.',
            data: parsedData
        });

    } catch (error) {
        logger.error('Error uploading lab document', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/batch-upload
 * @desc    Batch upload lab results (CSV)
 * @access  Pharmacist, Owner, Super Admin
 */
export const batchUploadLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;
        const file = req.file;

        if (!file) {
            res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
            return;
        }

        if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
            res.status(400).json({
                success: false,
                message: 'Only CSV files are allowed for batch upload'
            });
            return;
        }

        // Parse CSV file
        const parseResult = await parseLabResultCSV(file.buffer);

        if (!parseResult.success || parseResult.validRows === 0) {
            res.status(400).json({
                success: false,
                message: 'Failed to parse CSV file',
                errors: parseResult.errors,
                warnings: parseResult.warnings
            });
            return;
        }

        // Create lab results from parsed data
        const createdResults: any[] = [];
        const failedResults: any[] = [];

        for (const csvResult of parseResult.results) {
            try {
                // Find patient by ID or name
                let patient = null;
                if (csvResult.patientId) {
                    patient = await Patient.findById(csvResult.patientId);
                } else if (csvResult.patientName) {
                    // Try to find patient by name (this is less reliable)
                    const nameParts = csvResult.patientName.split(' ');
                    patient = await Patient.findOne({
                        firstName: nameParts[0],
                        lastName: nameParts.slice(1).join(' '),
                        workplaceId: new mongoose.Types.ObjectId(workplaceId as string)
                    });
                }

                if (!patient) {
                    failedResults.push({
                        testName: csvResult.testName,
                        error: 'Patient not found',
                        patientId: csvResult.patientId,
                        patientName: csvResult.patientName
                    });
                    continue;
                }

                // Determine interpretation
                let interpretation: 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Pending' = 'Normal';
                let isCritical = false;
                let isAbnormal = false;

                if (csvResult.numericValue !== undefined &&
                    csvResult.referenceRangeLow !== undefined &&
                    csvResult.referenceRangeHigh !== undefined) {
                    if (csvResult.numericValue < csvResult.referenceRangeLow) {
                        interpretation = 'Low';
                        isAbnormal = true;
                        if (csvResult.numericValue < csvResult.referenceRangeLow * 0.5) {
                            interpretation = 'Critical';
                            isCritical = true;
                        }
                    } else if (csvResult.numericValue > csvResult.referenceRangeHigh) {
                        interpretation = 'High';
                        isAbnormal = true;
                        if (csvResult.numericValue > csvResult.referenceRangeHigh * 1.5) {
                            interpretation = 'Critical';
                            isCritical = true;
                        }
                    }
                }

                // Create lab result
                const labResult = await LabResult.create({
                    patientId: patient._id,
                    workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
                    testName: csvResult.testName,
                    testCode: csvResult.testCode,
                    testCategory: csvResult.testCategory as any || 'Other',
                    specimenType: csvResult.specimenType as any || 'Blood',
                    testValue: csvResult.testValue,
                    numericValue: csvResult.numericValue,
                    unit: csvResult.unit,
                    referenceRange: csvResult.referenceRange,
                    referenceRangeLow: csvResult.referenceRangeLow,
                    referenceRangeHigh: csvResult.referenceRangeHigh,
                    interpretation,
                    isCritical,
                    isAbnormal,
                    testDate: csvResult.testDate || new Date(),
                    performingLaboratory: csvResult.laboratoryName,
                    accessionNumber: csvResult.accessionNumber,
                    orderingPhysician: csvResult.orderingPhysician,
                    notes: csvResult.notes,
                    status: 'Completed',
                    createdBy: new mongoose.Types.ObjectId(userId as string),
                    aiProcessed: false,
                    alertSent: false
                });

                createdResults.push(labResult);

                // Send alerts asynchronously
                if (isCritical) {
                    sendCriticalValueAlert(labResult._id.toString(), workplaceId as string).catch(err =>
                        logger.error('Failed to send critical value alert', { error: err.message })
                    );
                } else if (isAbnormal) {
                    sendAbnormalResultNotification(labResult._id.toString(), workplaceId as string).catch(err =>
                        logger.error('Failed to send abnormal result notification', { error: err.message })
                    );
                }

            } catch (error) {
                failedResults.push({
                    testName: csvResult.testName,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.info('Batch upload completed', {
            fileName: file.originalname,
            totalRows: parseResult.totalRows,
            validRows: parseResult.validRows,
            createdCount: createdResults.length,
            failedCount: failedResults.length,
            userId
        });

        res.status(200).json({
            success: true,
            message: `Batch upload completed. ${createdResults.length} results created, ${failedResults.length} failed.`,
            data: {
                fileName: file.originalname,
                totalRows: parseResult.totalRows,
                validRows: parseResult.validRows,
                invalidRows: parseResult.invalidRows,
                createdCount: createdResults.length,
                failedCount: failedResults.length,
                createdResults: createdResults.map(r => ({ id: r._id, testName: r.testName })),
                failedResults,
                errors: parseResult.errors,
                warnings: parseResult.warnings
            }
        });

    } catch (error) {
        logger.error('Error batch uploading lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/batch-upload/template
 * @desc    Download CSV template for batch upload
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const downloadCSVTemplate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const csvTemplate = generateCSVTemplate();

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=lab_results_template.csv');
        res.status(200).send(csvTemplate);

        logger.info('CSV template downloaded', {
            userId: req.user?.id
        });

    } catch (error) {
        logger.error('Error downloading CSV template', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};
/**
 * @route   POST /api/laboratory/results/upload-and-process
 * @desc    Upload lab result files and process with AI/OCR
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
export const uploadAndProcessLabResults = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        let workplaceId = req.user?.workplaceId;
        const { patientId, processWithAI } = req.body;
        const files = req.files as Express.Multer.File[];

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: User not found'
            });
            return;
        }

        if (!files || files.length === 0) {
            res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
            return;
        }

        if (!patientId) {
            res.status(400).json({
                success: false,
                message: 'Patient ID is required'
            });
            return;
        }

        // Validate patient exists and get their workplace
        const patient = await Patient.findById(patientId);
        if (!patient) {
            res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
            return;
        }

        // For super admins without a workplace, use the patient's workplace
        if (userRole === 'super_admin' && !workplaceId) {
            workplaceId = patient.workplaceId;
        }

        if (!workplaceId) {
            res.status(400).json({
                success: false,
                message: 'Workplace not found'
            });
            return;
        }

        const processedResults = [];

        for (const file of files) {
            try {
                let extractedData: any = {};

                // Read file into buffer for processing
                const fileBuffer = fs.readFileSync(file.path);

                // Process file based on type
                if (file.mimetype === 'application/pdf') {
                    try {
                        const pdfResult = await parseLabResultPDF(fileBuffer);
                        if (pdfResult.success && pdfResult.results.length > 0) {
                            extractedData = pdfResult.results[0]; // Use first result
                            if (pdfResult.metadata) {
                                extractedData = { ...extractedData, ...pdfResult.metadata };
                            }
                        } else {
                            logger.warn('PDF parsing failed or no results found', {
                                fileName: file.originalname,
                                error: pdfResult.error
                            });
                        }
                    } catch (pdfError) {
                        logger.error('PDF parsing error', {
                            fileName: file.originalname,
                            error: pdfError instanceof Error ? pdfError.message : 'Unknown error'
                        });
                    }
                } else if (file.mimetype.startsWith('image/')) {
                    // For images, we would use OCR service (placeholder for now)
                    extractedData = {
                        testName: `Test from ${file.originalname}`,
                        testValue: 'Pending OCR processing',
                        notes: `Uploaded from image: ${file.originalname}`
                    };
                } else if (file.mimetype === 'text/csv') {
                    try {
                        const csvResult = await parseLabResultCSV(fileBuffer);
                        if (csvResult.success && csvResult.results.length > 0) {
                            extractedData = csvResult.results[0]; // Use first result
                        } else {
                            logger.warn('CSV parsing failed or no results found', {
                                fileName: file.originalname,
                                errors: csvResult.errors
                            });
                        }
                    } catch (csvError) {
                        logger.error('CSV parsing error', {
                            fileName: file.originalname,
                            error: csvError instanceof Error ? csvError.message : 'Unknown error'
                        });
                    }
                }

                // Ensure we have at least basic data
                if (!extractedData.testName) {
                    extractedData.testName = `Test from ${file.originalname}`;
                }
                if (!extractedData.testValue) {
                    extractedData.testValue = 'Pending processing';
                }

                // Upload file to Cloudinary
                const uploadResult = await uploadDocument(file.path, `lab-results/${workplaceId}/${patientId}/uploads`);

                // Create lab result record
                const labResult = await LabResult.create({
                    patientId: new mongoose.Types.ObjectId(patientId),
                    workplaceId: new mongoose.Types.ObjectId(workplaceId as string),
                    testName: extractedData.testName || `Test from ${file.originalname}`,
                    testCode: extractedData.testCode || '',
                    testCategory: extractedData.testCategory || 'Other',
                    specimenType: extractedData.specimenType || '',
                    testValue: extractedData.testValue || 'Processing...',
                    numericValue: extractedData.numericValue || null,
                    unit: extractedData.unit || '',
                    referenceRange: extractedData.referenceRange || '',
                    referenceRangeLow: extractedData.referenceRangeLow || null,
                    referenceRangeHigh: extractedData.referenceRangeHigh || null,
                    interpretation: extractedData.interpretation || 'Pending',
                    isCritical: extractedData.isCritical || false,
                    isAbnormal: extractedData.isAbnormal || false,
                    testDate: extractedData.testDate ? new Date(extractedData.testDate) : new Date(),
                    resultDate: extractedData.reportDate ? new Date(extractedData.reportDate) : new Date(),
                    orderingPhysician: extractedData.orderingPhysician || '',
                    performingLaboratory: extractedData.laboratoryName || extractedData.performingLaboratory || '',
                    laboratoryAddress: '',
                    accessionNumber: extractedData.accessionNumber || '',
                    notes: extractedData.notes || `Uploaded and processed from: ${file.originalname}`,
                    clinicalIndication: '',
                    status: 'Pending Review',
                    createdBy: new mongoose.Types.ObjectId(userId as string),
                    aiProcessed: processWithAI === 'true',
                    alertSent: false,
                    attachments: [{
                        fileName: file.originalname,
                        fileType: file.mimetype,
                        fileSize: file.size,
                        cloudinaryUrl: uploadResult.secure_url,
                        cloudinaryPublicId: uploadResult.public_id,
                        uploadedBy: new mongoose.Types.ObjectId(userId as string),
                        uploadedAt: new Date()
                    }]
                });

                // Populate patient details
                await labResult.populate('patientId', 'firstName lastName dateOfBirth mrn');

                processedResults.push(labResult);

                // Clean up temporary file
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }

                logger.info('Lab result created from uploaded file', {
                    labResultId: labResult._id,
                    fileName: file.originalname,
                    patientId,
                    userId
                });

            } catch (fileError) {
                logger.error('Failed to process uploaded file', {
                    fileName: file.originalname,
                    error: fileError instanceof Error ? fileError.message : 'Unknown error',
                    userId
                });

                // Clean up temporary file on error
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }

        if (processedResults.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Failed to process any of the uploaded files'
            });
            return;
        }

        res.status(201).json({
            success: true,
            message: `Successfully processed ${processedResults.length} lab result(s) from uploaded files`,
            data: processedResults
        });

    } catch (error) {
        logger.error('Error uploading and processing lab results', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};