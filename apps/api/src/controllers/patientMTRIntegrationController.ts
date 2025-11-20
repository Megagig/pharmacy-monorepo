import { Request, Response } from 'express';
import { patientMTRIntegrationService } from '../services/patientMTRIntegrationService';

// Define extended request interface
interface AuthenticatedRequest extends Request {
    user: {
        _id: string;
        workplaceId: string;
    };
}

// Simple async handler
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error: any) => {
        console.error('Async handler error:', error);
        res.status(500).json(new ApiResponse(false, 'Internal server error'));
    });
};

// Simple API response class
class ApiResponse {
    constructor(
        public success: boolean,
        public message: string,
        public data?: any
    ) { }
}

// Simple validation function
const validateObjectId = (id: string, fieldName: string) => {
    if (!id || typeof id !== 'string' || id.length !== 24) {
        throw new Error(`Invalid ${fieldName}`);
    }
};

/**
 * Controller for Patient-MTR Integration endpoints
 */
export class PatientMTRIntegrationController {
    /**
     * Get MTR summary for a patient
     */
    getPatientMTRSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json(new ApiResponse(false, 'Patient ID is required'));
        }

        validateObjectId(patientId, 'Patient ID');

        const summary = await patientMTRIntegrationService.getPatientMTRSummary(
            patientId,
            req.user.workplaceId
        );

        return res.json(new ApiResponse(true, 'Patient MTR summary retrieved successfully', {
            summary
        }));
    });

    /**
     * Get comprehensive patient data for MTR
     */
    getPatientDataForMTR = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json(new ApiResponse(false, 'Patient ID is required'));
        }

        validateObjectId(patientId, 'Patient ID');

        const patientData = await patientMTRIntegrationService.getPatientDataForMTR(
            patientId,
            req.user.workplaceId
        );

        return res.json(new ApiResponse(true, 'Patient data for MTR retrieved successfully', {
            patientData
        }));
    });

    /**
     * Get MTR dashboard data for patient
     */
    getPatientDashboardMTRData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json(new ApiResponse(false, 'Patient ID is required'));
        }

        validateObjectId(patientId, 'Patient ID');

        const dashboardData = await patientMTRIntegrationService.getPatientDashboardMTRData(
            patientId,
            req.user.workplaceId
        );

        return res.json(new ApiResponse(true, 'Patient dashboard MTR data retrieved successfully', {
            dashboardData
        }));
    });

    /**
     * Sync medications between patient records and MTR
     */
    syncMedicationsWithMTR = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { patientId, mtrId } = req.params;

        if (!patientId || !mtrId) {
            return res.status(400).json(new ApiResponse(false, 'Patient ID and MTR ID are required'));
        }

        validateObjectId(patientId, 'Patient ID');
        validateObjectId(mtrId, 'MTR ID');

        const syncResult = await patientMTRIntegrationService.syncMedicationsWithMTR(
            patientId,
            mtrId,
            req.user.workplaceId
        );

        return res.json(new ApiResponse(true, 'Medications synchronized successfully', {
            syncResult
        }));
    });

    /**
     * Search patients with MTR filters
     */
    searchPatientsWithMTR = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const searchParams = req.query;

        const results = await patientMTRIntegrationService.searchPatientsWithMTR(
            searchParams,
            req.user.workplaceId
        );

        return res.json(new ApiResponse(true, 'Patients with MTR data retrieved successfully', results));
    });
}

export const patientMTRIntegrationController = new PatientMTRIntegrationController();