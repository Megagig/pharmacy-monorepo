/**
 * Public Appointment Service
 * Handles public appointment confirmation and related operations
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Appointment, { IAppointment } from '../models/Appointment';
import Patient from '../models/Patient';
import User from '../models/User';
import { AppointmentNotificationService } from './AppointmentNotificationService';
import logger from '../utils/logger';

export interface ConfirmationData {
  patientNotes?: string;
  specialRequirements?: string;
}

export interface AppointmentDetailsResponse {
  appointment: {
    _id: string;
    type: string;
    title: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    status: string;
    description?: string;
  };
  patient: {
    firstName: string;
    lastName: string;
  };
  pharmacist: {
    firstName: string;
    lastName: string;
  };
  workplace: {
    name: string;
    address?: string;
    phone?: string;
  };
}

export interface ConfirmationResponse {
  appointment: IAppointment;
  confirmationReceipt: {
    confirmationNumber: string;
    confirmedAt: string;
    message: string;
  };
  notificationSent: boolean;
}

/**
 * Custom error classes
 */
export class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

export class AppointmentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentNotFoundError';
  }
}

export class AppointmentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentStateError';
  }
}

/**
 * Public Appointment Service
 * Handles token-based appointment confirmation without authentication
 */
export default class PublicAppointmentService {
  private static getNotificationService() {
    return AppointmentNotificationService.getInstance();
  }

  /**
   * Confirm an appointment using a secure token
   * Requirements: 2.1, 2.2, 6.3, 6.4
   */
  static async confirmAppointmentWithToken(
    appointmentId: mongoose.Types.ObjectId,
    token: string,
    confirmationData: ConfirmationData
  ): Promise<ConfirmationResponse> {
    try {
      // Verify the confirmation token
      const tokenPayload = await this.verifyConfirmationToken(appointmentId, token);

      // Get the appointment with populated details
      const appointment = await this.getAppointmentWithDetails(appointmentId);

      // Validate appointment can be confirmed
      this.validateAppointmentForConfirmation(appointment);

      // Validate token matches appointment
      if (appointment.patientId._id.toString() !== tokenPayload.patientId) {
        throw new TokenValidationError('Token does not match appointment patient');
      }

      // Update appointment status and add confirmation data
      const updateData: any = {
        status: 'confirmed',
        confirmationStatus: 'confirmed',
        confirmedAt: new Date(),
        updatedBy: appointment.patientId._id, // Patient confirmed it themselves
      };

      // Add patient notes to description if provided
      if (confirmationData.patientNotes) {
        const existingDescription = appointment.description || '';
        const patientNotesSection = `\\n\\nPatient Notes (added during confirmation):\\n${confirmationData.patientNotes}`;
        updateData.description = existingDescription + patientNotesSection;
      }

      // Add special requirements to patient preferences
      if (confirmationData.specialRequirements) {
        updateData['patientPreferences.specialRequirements'] = confirmationData.specialRequirements;
      }

      // Clear the confirmation token (one-time use)
      updateData['metadata.confirmationToken'] = null;
      updateData['metadata.confirmationTokenExpiry'] = null;

      // Update the appointment
      const confirmedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        updateData,
        { new: true }
      ).populate('patientId assignedTo');

      if (!confirmedAppointment) {
        throw new AppointmentNotFoundError('Failed to update appointment');
      }

      // Generate confirmation receipt
      const confirmationReceipt = this.generateConfirmationReceipt(confirmedAppointment);

      // Send confirmation receipt notification
      let notificationSent = false;
      try {
        const notificationResult = await PublicAppointmentService.getNotificationService().sendAppointmentConfirmation(
          appointmentId,
          {
            customMessage: `Confirmation Number: ${confirmationReceipt.confirmationNumber}`,
          }
        );
        notificationSent = notificationResult.success;
      } catch (error) {
        logger.error('Failed to send confirmation receipt notification:', error);
        // Don't fail the confirmation if notification fails
      }

      // Log the successful confirmation
      logger.info('Appointment confirmed via public token', {
        appointmentId: appointmentId.toString(),
        patientId: appointment.patientId._id.toString(),
        workplaceId: appointment.workplaceId.toString(),
        confirmationNumber: confirmationReceipt.confirmationNumber,
        hasPatientNotes: !!confirmationData.patientNotes,
        hasSpecialRequirements: !!confirmationData.specialRequirements,
      });

      return {
        appointment: confirmedAppointment,
        confirmationReceipt,
        notificationSent,
      };
    } catch (error) {
      logger.error('Error confirming appointment with public token:', {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      });

      // Re-throw known errors
      if (
        error instanceof TokenValidationError ||
        error instanceof AppointmentNotFoundError ||
        error instanceof AppointmentStateError
      ) {
        throw error;
      }

      // Handle JWT errors
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError('Invalid or expired confirmation token');
      }

      // Generic error for unexpected issues
      throw new Error('Failed to confirm appointment. Please try again or contact support.');
    }
  }

  /**
   * Get appointment details using a confirmation token
   * Used to display appointment information before confirmation
   * Requirements: 6.3, 6.4
   */
  static async getAppointmentDetailsWithToken(
    appointmentId: mongoose.Types.ObjectId,
    token: string
  ): Promise<AppointmentDetailsResponse> {
    try {
      // Verify the confirmation token
      const tokenPayload = await this.verifyConfirmationToken(appointmentId, token);

      // Get the appointment with populated details
      const appointment = await this.getAppointmentWithDetails(appointmentId);

      // Validate token matches appointment
      if (appointment.patientId._id.toString() !== tokenPayload.patientId) {
        throw new TokenValidationError('Token does not match appointment patient');
      }

      // Get workplace details
      const Workplace = require('../models/Workplace').default;
      const workplace = await Workplace.findById(appointment.workplaceId).select('name address phone');

      // Return sanitized appointment details
      return {
        appointment: {
          _id: appointment._id.toString(),
          type: appointment.type,
          title: appointment.title,
          scheduledDate: appointment.scheduledDate.toISOString(),
          scheduledTime: appointment.scheduledTime,
          duration: appointment.duration,
          status: appointment.status,
          description: appointment.description,
        },
        patient: {
          firstName: (appointment.patientId as any).firstName,
          lastName: (appointment.patientId as any).lastName,
        },
        pharmacist: {
          firstName: (appointment.assignedTo as any).firstName,
          lastName: (appointment.assignedTo as any).lastName,
        },
        workplace: {
          name: workplace?.name || 'Pharmacy',
          address: workplace?.address,
          phone: workplace?.phone,
        },
      };
    } catch (error) {
      logger.error('Error getting appointment details with token:', {
        appointmentId: appointmentId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw known errors
      if (
        error instanceof TokenValidationError ||
        error instanceof AppointmentNotFoundError
      ) {
        throw error;
      }

      // Handle JWT errors
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError('Invalid or expired confirmation token');
      }

      throw new Error('Failed to retrieve appointment details');
    }
  }

  /**
   * Generate a secure confirmation token for an appointment
   * Requirements: 2.1, 2.2
   */
  static generateConfirmationToken(
    appointmentId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
  ): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const token = jwt.sign(
      {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        action: 'confirm_appointment',
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    return { token, expiresAt };
  }

  /**
   * Update appointment with confirmation token
   * Requirements: 2.1, 2.2
   */
  static async updateAppointmentWithConfirmationToken(
    appointmentId: mongoose.Types.ObjectId
  ): Promise<{ token: string; expiresAt: Date }> {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppointmentNotFoundError('Appointment not found');
    }

    const { token, expiresAt } = this.generateConfirmationToken(
      appointmentId,
      appointment.patientId
    );

    // Update appointment with token
    appointment.metadata = {
      ...appointment.metadata,
      confirmationToken: token,
      confirmationTokenExpiry: expiresAt,
    };

    await appointment.save();

    return { token, expiresAt };
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Verify confirmation token and return payload
   */
  private static async verifyConfirmationToken(
    appointmentId: mongoose.Types.ObjectId,
    token: string
  ): Promise<{ appointmentId: string; patientId: string; action: string }> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        appointmentId: string;
        patientId: string;
        action: string;
      };

      // Validate token is for appointment confirmation
      if (decoded.action !== 'confirm_appointment') {
        throw new TokenValidationError('Invalid token action');
      }

      // Validate token is for the correct appointment
      if (decoded.appointmentId !== appointmentId.toString()) {
        throw new TokenValidationError('Token does not match appointment');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenValidationError('Confirmation token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenValidationError('Invalid confirmation token');
      }
      throw error;
    }
  }

  /**
   * Get appointment with populated patient and pharmacist details
   */
  private static async getAppointmentWithDetails(
    appointmentId: mongoose.Types.ObjectId
  ): Promise<IAppointment> {
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email');

    if (!appointment) {
      throw new AppointmentNotFoundError('Appointment not found');
    }

    return appointment;
  }

  /**
   * Validate that an appointment can be confirmed
   */
  private static validateAppointmentForConfirmation(appointment: IAppointment): void {
    // Check if appointment is in a confirmable state
    if (appointment.status !== 'scheduled') {
      throw new AppointmentStateError(
        `Cannot confirm appointment with status: ${appointment.status}. Only scheduled appointments can be confirmed.`
      );
    }

    // Check if appointment is not in the past
    const appointmentDateTime = appointment.get('appointmentDateTime');
    if (appointmentDateTime && appointmentDateTime < new Date()) {
      throw new AppointmentStateError('Cannot confirm past appointments');
    }

    // Check if appointment is already confirmed
    if (appointment.confirmationStatus === 'confirmed') {
      throw new AppointmentStateError('Appointment is already confirmed');
    }
  }

  /**
   * Generate confirmation receipt
   */
  private static generateConfirmationReceipt(appointment: IAppointment): {
    confirmationNumber: string;
    confirmedAt: string;
    message: string;
  } {
    // Generate a unique confirmation number
    const timestamp = Date.now().toString(36).toUpperCase();
    const appointmentIdShort = appointment._id.toString().slice(-6).toUpperCase();
    const confirmationNumber = `CONF-${timestamp}-${appointmentIdShort}`;

    const confirmedAt = new Date().toISOString();
    const appointmentDate = appointment.scheduledDate.toLocaleDateString();
    const appointmentTime = appointment.scheduledTime;

    const message = `Your appointment has been confirmed for ${appointmentDate} at ${appointmentTime}. Please arrive 10 minutes early.`;

    return {
      confirmationNumber,
      confirmedAt,
      message,
    };
  }
}