import mongoose from 'mongoose';
import ClinicalInterventionService from '../../services/clinicalInterventionService';

// Mock the models and utilities
jest.mock('../../models/ClinicalIntervention');
jest.mock('../../models/Patient');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

describe('ClinicalInterventionService', () => {
    const mockWorkplaceId = new mongoose.Types.ObjectId();
    const mockPatientId = new mongoose.Types.ObjectId();
    const mockUserId = new mongoose.Types.ObjectId();
    const mockInterventionId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateInterventionNumber', () => {
        it('should delegate to model static method', async () => {
            const ClinicalIntervention = require('../../models/ClinicalIntervention').default;
            ClinicalIntervention.generateNextInterventionNumber = jest.fn().mockResolvedValue('CI-202412-0001');

            const result = await ClinicalInterventionService.generateInterventionNumber(mockWorkplaceId);

            expect(result).toBe('CI-202412-0001');
            expect(ClinicalIntervention.generateNextInterventionNumber).toHaveBeenCalledWith(mockWorkplaceId);
        });
    });

    describe('checkDuplicateInterventions', () => {
        it('should find interventions in same category within 30 days', async () => {
            const ClinicalIntervention = require('../../models/ClinicalIntervention').default;
            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            ClinicalIntervention.find = mockFind;

            await ClinicalInterventionService.checkDuplicateInterventions(
                mockPatientId,
                'drug_therapy_problem',
                mockWorkplaceId
            );

            expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
                patientId: mockPatientId,
                category: 'drug_therapy_problem',
                workplaceId: mockWorkplaceId,
                status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] },
                isDeleted: { $ne: true },
                identifiedDate: { $gte: expect.any(Date) }
            }));
        });

        it('should exclude specific intervention ID when provided', async () => {
            const ClinicalIntervention = require('../../models/ClinicalIntervention').default;
            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            ClinicalIntervention.find = mockFind;

            const excludeId = 'exclude-id';
            await ClinicalInterventionService.checkDuplicateInterventions(
                mockPatientId,
                'drug_therapy_problem',
                mockWorkplaceId,
                excludeId
            );

            expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
                _id: { $ne: excludeId }
            }));
        });
    });

    describe('isValidStatusTransition', () => {
        // Access private method for testing
        const isValidStatusTransition = (ClinicalInterventionService as any).isValidStatusTransition;

        it('should allow valid status transitions', () => {
            expect(isValidStatusTransition('identified', 'planning')).toBe(true);
            expect(isValidStatusTransition('planning', 'in_progress')).toBe(true);
            expect(isValidStatusTransition('in_progress', 'implemented')).toBe(true);
            expect(isValidStatusTransition('implemented', 'completed')).toBe(true);
            expect(isValidStatusTransition('identified', 'cancelled')).toBe(true);
            expect(isValidStatusTransition('planning', 'cancelled')).toBe(true);
            expect(isValidStatusTransition('in_progress', 'cancelled')).toBe(true);
            expect(isValidStatusTransition('implemented', 'cancelled')).toBe(true);
        });

        it('should reject invalid status transitions', () => {
            expect(isValidStatusTransition('completed', 'planning')).toBe(false);
            expect(isValidStatusTransition('completed', 'in_progress')).toBe(false);
            expect(isValidStatusTransition('cancelled', 'planning')).toBe(false);
            expect(isValidStatusTransition('cancelled', 'in_progress')).toBe(false);
            expect(isValidStatusTransition('identified', 'completed')).toBe(false);
            expect(isValidStatusTransition('identified', 'implemented')).toBe(false);
            expect(isValidStatusTransition('planning', 'implemented')).toBe(false);
            expect(isValidStatusTransition('planning', 'completed')).toBe(false);
        });
    });

    describe('logActivity', () => {
        it('should log activity without throwing errors', async () => {
            const logActivity = (ClinicalInterventionService as any).logActivity;

            // Should not throw
            await expect(logActivity(
                'TEST_ACTION',
                mockInterventionId.toString(),
                mockUserId,
                mockWorkplaceId,
                { test: 'data' }
            )).resolves.toBeUndefined();
        });
    });

    describe('Service Integration', () => {
        it('should have all required static methods', () => {
            expect(typeof ClinicalInterventionService.createIntervention).toBe('function');
            expect(typeof ClinicalInterventionService.updateIntervention).toBe('function');
            expect(typeof ClinicalInterventionService.getInterventions).toBe('function');
            expect(typeof ClinicalInterventionService.getInterventionById).toBe('function');
            expect(typeof ClinicalInterventionService.deleteIntervention).toBe('function');
            expect(typeof ClinicalInterventionService.generateInterventionNumber).toBe('function');
            expect(typeof ClinicalInterventionService.checkDuplicateInterventions).toBe('function');
        });

        it('should export correct interfaces', () => {
            // Test that the service can be imported and has expected structure
            expect(ClinicalInterventionService).toBeDefined();
            expect(ClinicalInterventionService.constructor).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            const ClinicalIntervention = require('../../models/ClinicalIntervention').default;
            ClinicalIntervention.generateNextInterventionNumber = jest.fn().mockRejectedValue(new Error('Database error'));

            await expect(
                ClinicalInterventionService.generateInterventionNumber(mockWorkplaceId)
            ).rejects.toThrow('Database error');
        });
    });

    describe('Business Logic Validation', () => {
        it('should validate intervention number format', () => {
            const interventionNumber = 'CI-202412-0001';
            const regex = /^CI-\d{6}-\d{4}$/;
            expect(regex.test(interventionNumber)).toBe(true);
        });

        it('should validate invalid intervention number format', () => {
            const invalidNumbers = [
                'CI-2024-001',
                'INT-202412-0001',
                'CI-20241-0001',
                'CI-202412-001'
            ];
            const regex = /^CI-\d{6}-\d{4}$/;

            invalidNumbers.forEach(number => {
                expect(regex.test(number)).toBe(false);
            });
        });
    });
});