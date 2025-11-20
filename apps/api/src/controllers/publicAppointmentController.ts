import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PublicAppointmentService from '../services/PublicAppointmentService';
import {
  sendSuccess,
  sendError,
  asyncHandler,
} from '../utils/responseHelpers';

/**
 * Public Appointment Controller
 * Handles public appointment confirmation and related operations
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */

/**
 * POST /api/public/appointments/:id/confirm
 * Confirm an appointment using a secure token
 * Public endpoint - no authentication required
 */
export const confirmAppointmentPublic = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { token, patientNotes, specialRequirements } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid appointment ID', 400);
    }

    if (!token) {
      return sendError(res, 'BAD_REQUEST', 'Confirmation token is required', 400);
    }

    const result = await PublicAppointmentService.confirmAppointmentWithToken(
      new mongoose.Types.ObjectId(id),
      token,
      {
        patientNotes,
        specialRequirements,
      }
    );

    sendSuccess(res, result, 'Appointment confirmed successfully');
  }
);

/**
 * GET /api/public/appointments/:id
 * Get appointment details for confirmation page
 * Public endpoint - requires valid token in query params
 */
export const getAppointmentDetailsPublic = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { token } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid appointment ID', 400);
    }

    if (!token || typeof token !== 'string') {
      return sendError(res, 'BAD_REQUEST', 'Valid confirmation token is required', 400);
    }

    const result = await PublicAppointmentService.getAppointmentDetailsWithToken(
      new mongoose.Types.ObjectId(id),
      token
    );

    sendSuccess(res, result, 'Appointment details retrieved successfully');
  }
);