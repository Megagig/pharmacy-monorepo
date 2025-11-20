import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { PatientPortalRequest } from '../middlewares/patientPortalAuth';
import AppointmentService from '../services/AppointmentService';
import CalendarService from '../services/CalendarService';
import PatientPortalService from '../services/PatientPortalService';
import Appointment from '../models/Appointment';
import MedicationRecord from '../models/MedicationRecord';
import AdherenceLog from '../models/AdherenceLog';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import PatientUser from '../models/PatientUser';
import Patient from '../models/Patient';
import Workplace from '../models/Workplace';
import EducationalResource from '../models/EducationalResource';
import {
  sendSuccess,
  sendError,
  asyncHandler,
  getRequestContext,
} from '../utils/responseHelpers';

/**
 * Patient Portal Controller
 * Handles patient-facing appointment booking and management
 */

/**
 * GET /api/patient-portal/appointment-types
 * Get available appointment types for booking
 * Public endpoint - no authentication required
 */
export const getAppointmentTypes = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    // For public endpoint, we need to determine workspace from query parameter or default
    const workplaceId = req.query.workplaceId as string;

    if (!workplaceId || !mongoose.Types.ObjectId.isValid(workplaceId)) {
      return sendError(res, 'BAD_REQUEST', 'Valid workplace ID is required', 400);
    }

    const appointmentTypes = await PatientPortalService.getAppointmentTypes(
      new mongoose.Types.ObjectId(workplaceId)
    );

    sendSuccess(res, appointmentTypes, 'Appointment types retrieved successfully');
  }
);

/**
 * GET /api/patient-portal/available-slots
 * Get available appointment slots
 * Public endpoint - no authentication required
 */
export const getAvailableSlots = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const {
      workplaceId,
      date,
      type,
      duration = 30,
      pharmacistId,
      locationId
    } = req.query as any;

    if (!workplaceId || !mongoose.Types.ObjectId.isValid(workplaceId)) {
      return sendError(res, 'BAD_REQUEST', 'Valid workplace ID is required', 400);
    }

    const targetDate = date ? new Date(date) : new Date();

    const availableSlots = await PatientPortalService.getAvailableSlots(
      new mongoose.Types.ObjectId(workplaceId),
      targetDate,
      {
        type,
        duration: parseInt(duration),
        pharmacistId: pharmacistId ? new mongoose.Types.ObjectId(pharmacistId) : undefined,
        locationId,
      }
    );

    sendSuccess(res, availableSlots, 'Available slots retrieved successfully');
  }
);

/**
 * POST /api/patient-portal/appointments
 * Book a new appointment
 * Requires authentication
 */
export const bookAppointment = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    const appointmentData = {
      ...req.body,
      workplaceId: req.patientUser.workplaceId,
      patientId: req.patientUser._id,
      createdBy: req.patientUser._id,
    };

    const result = await PatientPortalService.bookAppointment(
      appointmentData,
      new mongoose.Types.ObjectId(req.patientUser.workplaceId),
      new mongoose.Types.ObjectId(req.patientUser._id)
    );

    sendSuccess(res, result, 'Appointment booked successfully', 201);
  }
);

/**
 * GET /api/patient-portal/appointments
 * Get my appointments (patient's own appointments)
 * Requires authentication
 */
export const getMyAppointments = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    const {
      status,
      type,
      startDate,
      endDate,
      limit,
      cursor,
      includeCompleted,
      includeCancelled,
    } = req.query as any;

    const result = await PatientPortalService.getPatientAppointments(
      new mongoose.Types.ObjectId(req.patientUser.workplaceId),
      new mongoose.Types.ObjectId(req.patientUser._id),
      {
        status,
        type,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        includeCompleted: includeCompleted === 'true',
        includeCancelled: includeCancelled === 'true',
      },
      {
        limit: parseInt(limit) || 20,
        cursor,
      }
    );

    sendSuccess(res, result, 'Appointments retrieved successfully');
  }
);

/**
 * POST /api/patient-portal/appointments/:id/reschedule
 * Reschedule an appointment
 * Requires authentication
 */
export const rescheduleAppointment = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    const { id } = req.params;
    const { newDate, newTime, reason, notifyPharmacist = true } = req.body;

    const result = await PatientPortalService.rescheduleAppointment(
      new mongoose.Types.ObjectId(id),
      {
        newDate: new Date(newDate),
        newTime,
        reason,
        notifyPharmacist,
      },
      new mongoose.Types.ObjectId(req.patientUser.workplaceId),
      new mongoose.Types.ObjectId(req.patientUser._id)
    );

    sendSuccess(res, result, 'Appointment rescheduled successfully');
  }
);

/**
 * POST /api/patient-portal/appointments/:id/cancel
 * Cancel an appointment
 * Requires authentication
 */
export const cancelAppointment = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    const { id } = req.params;
    const { reason, notifyPharmacist = true } = req.body;

    const result = await PatientPortalService.cancelAppointment(
      new mongoose.Types.ObjectId(id),
      {
        reason,
        notifyPharmacist,
      },
      new mongoose.Types.ObjectId(req.patientUser.workplaceId),
      new mongoose.Types.ObjectId(req.patientUser._id)
    );

    sendSuccess(res, result, 'Appointment cancelled successfully');
  }
);

/**
 * POST /api/patient-portal/appointments/:id/confirm
 * Confirm an appointment
 * Supports both authenticated users and confirmation tokens
 */
export const confirmAppointment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { confirmationToken, patientNotes, specialRequirements } = req.body;

    // If user is authenticated, use their context
    if (req.user) {
      const context = getRequestContext(req);

      const result = await PatientPortalService.confirmAppointment(
        new mongoose.Types.ObjectId(id),
        {
          patientNotes,
          specialRequirements,
        },
        new mongoose.Types.ObjectId(context.workplaceId),
        context.userId
      );

      return sendSuccess(res, result, 'Appointment confirmed successfully');
    }

    // If no user but has confirmation token, use token-based confirmation
    if (confirmationToken) {
      const result = await PatientPortalService.confirmAppointmentWithToken(
        new mongoose.Types.ObjectId(id),
        confirmationToken,
        {
          patientNotes,
          specialRequirements,
        }
      );

      return sendSuccess(res, result, 'Appointment confirmed successfully');
    }

    // Neither authenticated user nor token provided
    return sendError(res, 'UNAUTHORIZED', 'Authentication or confirmation token required', 401);
  }
);

/**
 * GET /api/patient-portal/dashboard
 * Get comprehensive dashboard data for patient
 * Returns stats, appointments, medications, messages, vitals, and health records
 * Requires authentication
 */
export const getDashboardData = asyncHandler(
  async (req: PatientPortalRequest, res: Response) => {
    if (!req.patientUser) {
      return sendError(res, 'UNAUTHORIZED', 'Patient authentication required', 401);
    }

    const patientUserId = req.patientUser._id;
    const workplaceId = new mongoose.Types.ObjectId(req.patientUser.workplaceId);
    const patientRecordId = req.patientUser.patientId
      ? new mongoose.Types.ObjectId(req.patientUser.patientId)
      : null;

    try {
      // Fetch patient user details and workspace info in parallel
      const [patientUser, workplace] = await Promise.all([
        PatientUser.findById(patientUserId).select('firstName lastName onboardingCompleted'),
        Workplace.findById(workplaceId).select('name type')
      ]);

      if (!patientUser) {
        return sendError(res, 'NOT_FOUND', 'Patient user not found', 404);
      }

      // Get linked patient record if exists
      let linkedPatient = null;
      if (patientRecordId) {
        linkedPatient = await Patient.findById(patientRecordId).select('firstName lastName');
      }

      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));
      const endOfToday = new Date(today.setHours(23, 59, 59, 999));

      // Fetch all dashboard data in parallel
      const [
        upcomingAppointments,
        appointmentCounts,
        currentMedications,
        refillRequests,
        recentConversations,
        unreadMessagesCount,
        recentVitals,
        recentLabResults,
        recentVisits,
        featuredResources
      ] = await Promise.all([
        // Upcoming appointments (next 2-3)
        Appointment.find({
          workplaceId,
          patientId: patientRecordId || patientUserId,
          scheduledDate: { $gte: startOfToday },
          status: { $in: ['scheduled', 'confirmed'] },
          isDeleted: false
        })
          .sort({ scheduledDate: 1, scheduledTime: 1 })
          .limit(3)
          .populate('assignedTo', 'firstName lastName')
          .select('type scheduledDate scheduledTime status duration assignedTo')
          .lean(),

        // Count total upcoming appointments
        Appointment.countDocuments({
          workplaceId,
          patientId: patientRecordId || patientUserId,
          scheduledDate: { $gte: startOfToday },
          status: { $in: ['scheduled', 'confirmed'] },
          isDeleted: false
        }),

        // Current medications (active, limit 3-4)
        MedicationRecord.find({
          workplaceId,
          patientId: patientRecordId || patientUserId,
          phase: 'current',
          isDeleted: false
        })
          .sort({ createdAt: -1 })
          .limit(4)
          .select('medicationName dose frequency startDate endDate adherence')
          .lean(),

        // Pending refill requests (using MedicationRecord as proxy)
        MedicationRecord.countDocuments({
          workplaceId,
          patientId: patientRecordId || patientUserId,
          phase: 'current',
          endDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // Within 7 days
          isDeleted: false
        }),

        // Recent conversations (limit 3)
        Conversation.find({
          'participants.userId': patientUserId,
          status: { $in: ['active', 'resolved'] },
          isDeleted: false
        })
          .sort({ lastMessageAt: -1 })
          .limit(3)
          .populate('participants.userId', 'firstName lastName')
          .select('title lastMessageAt participants status')
          .lean(),

        // Unread messages count
        Conversation.aggregate([
          {
            $match: {
              'participants.userId': patientUserId,
              status: { $in: ['active', 'resolved'] },
              isDeleted: false
            }
          },
          {
            $project: {
              unreadForUser: {
                $ifNull: [
                  { $arrayElemAt: [{ $objectToArray: '$unreadCount' }, 0] },
                  { k: patientUserId.toString(), v: 0 }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$unreadForUser.v' }
            }
          }
        ]),

        // Recent vitals from Patient model (if exists) - limit 3
        patientRecordId ? Patient.findById(patientRecordId)
          .select('metadata')
          .lean()
          .then(patient => {
            // Assuming vitals might be in metadata or another field
            // For now, return empty array as vitals structure needs clarification
            return [];
          })
          : [],

        // Recent lab results - would come from a LabResult model if exists
        // For now, return empty array as placeholder
        Promise.resolve([]),

        // Recent visits - limit 3
        // Assuming Visit model exists
        Promise.resolve([]),

        // Featured educational resources for patient dashboard (3-5 resources)
        EducationalResource.find({
          $or: [
            { workplaceId },
            { workplaceId: null } // Include global resources
          ],
          isPublished: true,
          isDeleted: false,
          displayLocations: 'patient_dashboard',
          accessLevel: { $in: ['public', 'patient_only'] }
        })
          .sort({ isPinned: -1, displayOrder: 1, viewCount: -1 })
          .limit(5)
          .select('title description slug thumbnail category mediaType readingTime viewCount ratings')
          .lean()
      ]);

      // Calculate adherence scores for medications
      const medicationsWithAdherence = await Promise.all(
        currentMedications.map(async (med: any) => {
          // Get latest adherence log for this medication
          const adherenceLog = await AdherenceLog.findOne({
            patientId: patientRecordId || patientUserId,
            medicationId: med._id,
            workplaceId
          })
            .sort({ refillDate: -1 })
            .select('adherenceScore')
            .lean();

          return {
            id: med._id.toString(),
            name: med.medicationName,
            dosage: med.dose || 'N/A',
            frequency: med.frequency || 'As needed',
            refillsRemaining: med.endDate ?
              Math.max(0, Math.floor((new Date(med.endDate).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
              : 0,
            nextRefillDate: med.endDate || null,
            adherenceScore: adherenceLog?.adherenceScore || 0
          };
        })
      );

      // Format appointments
      const formattedAppointments = upcomingAppointments.map((apt: any) => ({
        id: apt._id.toString(),
        type: apt.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        date: apt.scheduledDate,
        time: apt.scheduledTime,
        pharmacistName: apt.assignedTo
          ? `${apt.assignedTo.firstName} ${apt.assignedTo.lastName}`
          : 'TBA',
        status: apt.status,
        duration: apt.duration
      }));

      // Format conversations/messages
      const formattedMessages = recentConversations.map((conv: any) => {
        const otherParticipant = conv.participants.find(
          (p: any) => p.userId._id.toString() !== patientUserId.toString()
        );

        return {
          id: conv._id.toString(),
          from: otherParticipant?.userId
            ? `${otherParticipant.userId.firstName} ${otherParticipant.userId.lastName}`
            : 'Pharmacy Team',
          subject: conv.title || 'Conversation',
          preview: '',
          timestamp: conv.lastMessageAt,
          isRead: true // Would need to check actual read status
        };
      });

      // Format vitals
      const formattedVitals = recentVitals.map((vital: any) => {
        let value = '';
        let unit = '';
        let type = '';
        let status = 'normal';

        if (vital.bloodPressure) {
          type = 'blood_pressure';
          value = `${vital.bloodPressure.systolic}/${vital.bloodPressure.diastolic}`;
          unit = 'mmHg';
          status = vital.bloodPressure.systolic > 140 || vital.bloodPressure.diastolic > 90 ? 'high' : 'normal';
        } else if (vital.weight) {
          type = 'weight';
          value = vital.weight.toString();
          unit = 'kg';
          status = 'normal';
        } else if (vital.glucose) {
          type = 'glucose';
          value = vital.glucose.toString();
          unit = 'mg/dL';
          status = vital.glucose > 125 ? 'high' : vital.glucose < 70 ? 'low' : 'normal';
        } else if (vital.temperature) {
          type = 'temperature';
          value = vital.temperature.toString();
          unit = '°C';
          status = vital.temperature > 37.5 ? 'high' : 'normal';
        }

        return {
          type,
          value,
          unit,
          date: vital.recordedAt || vital.createdAt,
          status
        };
      }).filter((v: any) => v.type);

      // Format educational resources
      const formattedEducationalResources = featuredResources.map((resource: any) => ({
        id: resource._id.toString(),
        title: resource.title,
        description: resource.description,
        slug: resource.slug,
        thumbnail: resource.thumbnail,
        category: resource.category,
        mediaType: resource.mediaType,
        readingTime: resource.readingTime,
        viewCount: resource.viewCount || 0,
        rating: resource.ratings?.averageRating || 0
      }));

      // Construct dashboard response
      const dashboardData = {
        user: {
          firstName: linkedPatient?.firstName || patientUser.firstName,
          lastName: linkedPatient?.lastName || patientUser.lastName,
          workspaceName: workplace?.name || 'Pharmacy',
          onboardingCompleted: patientUser.onboardingCompleted
        },
        stats: {
          upcomingAppointments: appointmentCounts,
          activeMedications: currentMedications.length,
          unreadMessages: unreadMessagesCount[0]?.total || 0,
          pendingRefills: refillRequests
        },
        upcomingAppointments: formattedAppointments,
        currentMedications: medicationsWithAdherence,
        recentMessages: formattedMessages,
        recentVitals: formattedVitals,
        recentHealthRecords: [], // Placeholder
        educationalResources: formattedEducationalResources
      };

      sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return sendError(
        res,
        'SERVER_ERROR',
        'Failed to fetch dashboard data',
        500
      );
    }
  }
);