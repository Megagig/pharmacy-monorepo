import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import LabTestTemplate from '../models/LabTestTemplate';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';

/**
 * Lab Template Controller
 * Handles lab test template operations (system and workplace templates)
 */

/**
 * @route   GET /api/laboratory/templates
 * @desc    Get all lab test templates (system + workplace)
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getLabTemplates = async (
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

        const templates = await LabTestTemplate.findAllActive(
            new mongoose.Types.ObjectId(workplaceId as string)
        )
            .populate('createdBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: templates
        });

    } catch (error) {
        logger.error('Error fetching lab templates', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/templates/system
 * @desc    Get system lab test templates
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getSystemTemplates = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const templates = await LabTestTemplate.findSystemTemplates()
            .lean();

        res.status(200).json({
            success: true,
            data: templates
        });

    } catch (error) {
        logger.error('Error fetching system templates', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/templates/workplace
 * @desc    Get workplace-specific lab test templates
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const getWorkplaceTemplates = async (
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

        const templates = await LabTestTemplate.findWorkplaceTemplates(
            new mongoose.Types.ObjectId(workplaceId as string)
        )
            .populate('createdBy', 'firstName lastName')
            .lean();

        res.status(200).json({
            success: true,
            data: templates
        });

    } catch (error) {
        logger.error('Error fetching workplace templates', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   GET /api/laboratory/templates/:id
 * @desc    Get a specific lab test template by ID
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
export const getLabTemplateById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const template = await LabTestTemplate.findOne({
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
        })
            .populate('createdBy', 'firstName lastName')
            .lean();

        if (!template) {
            res.status(404).json({
                success: false,
                message: 'Template not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: template
        });

    } catch (error) {
        logger.error('Error fetching lab template by ID', {
            error: error instanceof Error ? error.message : 'Unknown error',
            templateId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/templates
 * @desc    Create a new lab test template
 * @access  Pharmacist, Owner, Super Admin
 */
export const createLabTemplate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const {
            name,
            description,
            category,
            items,
            isSystemTemplate = false
        } = req.body;

        if (!name || !items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Template name and items are required'
            });
            return;
        }

        const template = await LabTestTemplate.create({
            name,
            description,
            category,
            items,
            isSystemTemplate,
            workplaceId: isSystemTemplate ? null : new mongoose.Types.ObjectId(workplaceId as string),
            createdBy: new mongoose.Types.ObjectId(userId as string),
            usageCount: 0
        });

        logger.info('Lab template created successfully', {
            templateId: template._id,
            name,
            userId
        });

        res.status(201).json({
            success: true,
            message: 'Template created successfully',
            data: template
        });

    } catch (error) {
        logger.error('Error creating lab template', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   PUT /api/laboratory/templates/:id
 * @desc    Update a lab test template
 * @access  Pharmacist, Owner, Super Admin
 */
export const updateLabTemplate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const template = await LabTestTemplate.findOne({
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
        });

        if (!template) {
            res.status(404).json({
                success: false,
                message: 'Template not found'
            });
            return;
        }

        // Only allow updating workplace templates or if user is super admin
        if (template.isSystemTemplate && req.user?.role !== 'super_admin') {
            res.status(403).json({
                success: false,
                message: 'Cannot update system templates'
            });
            return;
        }

        // Only allow updating own workplace templates
        if (template.workplaceId && template.workplaceId.toString() !== workplaceId) {
            res.status(403).json({
                success: false,
                message: 'Cannot update templates from other workplaces'
            });
            return;
        }

        const allowedFields = ['name', 'description', 'category', 'items'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                (template as any)[field] = req.body[field];
            }
        });

        template.updatedBy = new mongoose.Types.ObjectId(userId as string);
        await template.save();

        logger.info('Lab template updated successfully', {
            templateId: template._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Template updated successfully',
            data: template
        });

    } catch (error) {
        logger.error('Error updating lab template', {
            error: error instanceof Error ? error.message : 'Unknown error',
            templateId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   DELETE /api/laboratory/templates/:id
 * @desc    Delete a lab test template (soft delete)
 * @access  Owner, Super Admin
 */
export const deleteLabTemplate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const workplaceId = req.user?.workplaceId;

        const template = await LabTestTemplate.findOne({
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
        });

        if (!template) {
            res.status(404).json({
                success: false,
                message: 'Template not found'
            });
            return;
        }

        // Cannot delete system templates
        if (template.isSystemTemplate) {
            res.status(403).json({
                success: false,
                message: 'Cannot delete system templates'
            });
            return;
        }

        // Only allow deleting own workplace templates
        if (template.workplaceId && template.workplaceId.toString() !== workplaceId) {
            res.status(403).json({
                success: false,
                message: 'Cannot delete templates from other workplaces'
            });
            return;
        }

        template.isDeleted = true;
        template.updatedBy = new mongoose.Types.ObjectId(userId as string);
        await template.save();

        logger.info('Lab template deleted successfully', {
            templateId: template._id,
            userId
        });

        res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting lab template', {
            error: error instanceof Error ? error.message : 'Unknown error',
            templateId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

/**
 * @route   POST /api/laboratory/templates/:id/increment-usage
 * @desc    Increment usage count for a template
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
export const incrementTemplateUsage = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const template = await LabTestTemplate.findOne({
            _id: new mongoose.Types.ObjectId(id),
            isDeleted: false
        });

        if (!template) {
            res.status(404).json({
                success: false,
                message: 'Template not found'
            });
            return;
        }

        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsedAt = new Date();
        await template.save();

        res.status(200).json({
            success: true,
            message: 'Template usage incremented',
            data: {
                usageCount: template.usageCount,
                lastUsedAt: template.lastUsedAt
            }
        });

    } catch (error) {
        logger.error('Error incrementing template usage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            templateId: req.params.id,
            userId: req.user?.id
        });
        next(error);
    }
};

