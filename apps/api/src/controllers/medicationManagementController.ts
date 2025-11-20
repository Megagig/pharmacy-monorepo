import { Request, Response } from 'express';
import MedicationManagement, {
  IMedicationManagement,
} from '../models/MedicationManagement';
import AdherenceLog from '../models/AdherenceLog';
import Patient from '../models/Patient';
import MedicationSettings, { IMedicationSettings } from '../models/MedicationSettings';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import moment from 'moment';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    [key: string]: any;
  };
}

// Helper function to check if patient exists
const checkPatientExists = async (patientId: string): Promise<boolean> => {
  try {
    const patient = await Patient.findById(patientId);
    return !!patient;
  } catch (error) {
    return false;
  }
};

/**
 * Create a new medication for a patient
 */
export const createMedication = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.body;
    // Check if patient exists
    const patientExists = await checkPatientExists(patientId as string);
    if (!patientExists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Add workplaceId from the request (set by auth middleware)
    const workplaceId = req.user?.workplaceId;

    // Create medication with user and workplace context
    const medication = new MedicationManagement({
      ...req.body,
      workplaceId,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    // Save the medication
    const savedMedication = await medication.save();

    // Return the created medication
    res.status(201).json({
      success: true,
      data: savedMedication,
    });
    return;
  } catch (error) {
    logger.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating medication',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Get all medications for a specific patient
 */
export const getMedicationsByPatient = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { patientId } = req.params;
    const { status = 'active' } = req.query;

    // Build query based on status filter
    let statusFilter = {};
    if (status !== 'all') {
      statusFilter = { status };
    }

    // Check if patient exists
    const patientExists = await checkPatientExists(patientId as string);
    if (!patientExists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Find medications for the patient with workplace tenancy
    const medications = await MedicationManagement.find({
      patientId,
      workplaceId: req.user?.workplaceId,
      ...statusFilter,
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: medications.length,
      data: medications,
    });
    return;
  } catch (error) {
    logger.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Get a specific medication by ID
 */
export const getMedicationById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const medication = await MedicationManagement.findOne({
      _id: id,
      workplaceId: req.user?.workplaceId,
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      data: medication,
    });
    return;
  } catch (error) {
    logger.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medication',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Update a medication
 */
export const updateMedication = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find the current medication
    const currentMedication = await MedicationManagement.findOne({
      _id: id,
      workplaceId: req.user?.workplaceId,
    });

    if (!currentMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Create a history entry from current medication state
    const historyEntry = {
      name: currentMedication.name,
      dosage: currentMedication.dosage,
      frequency: currentMedication.frequency,
      route: currentMedication.route,
      startDate: currentMedication.startDate,
      endDate: currentMedication.endDate,
      indication: currentMedication.indication,
      prescriber: currentMedication.prescriber,
      status: currentMedication.status,
      updatedAt: new Date(),
      updatedBy: req.user?._id,
      notes: updateData.historyNotes || 'Updated medication',
    };

    // Update the medication
    const updatedMedication = await MedicationManagement.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedBy: req.user?._id,
        $push: { history: historyEntry },
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedMedication,
    });
    return;
  } catch (error) {
    logger.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medication',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Archive a medication
 */
export const archiveMedication = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find the current medication
    const currentMedication = await MedicationManagement.findOne({
      _id: id,
      workplaceId: req.user?.workplaceId,
    });

    if (!currentMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Create a history entry for archival
    const historyEntry = {
      name: currentMedication.name,
      dosage: currentMedication.dosage,
      frequency: currentMedication.frequency,
      route: currentMedication.route,
      startDate: currentMedication.startDate,
      endDate: currentMedication.endDate,
      indication: currentMedication.indication,
      prescriber: currentMedication.prescriber,
      status: currentMedication.status,
      updatedAt: new Date(),
      updatedBy: req.user?._id,
      notes: reason || 'Medication archived',
    };

    // Update to archived status
    const archivedMedication = await MedicationManagement.findByIdAndUpdate(
      id,
      {
        status: 'archived',
        updatedBy: req.user?._id,
        $push: { history: historyEntry },
      },
      { new: true }
    );

    res.json({
      success: true,
      data: archivedMedication,
    });
    return;
  } catch (error) {
    logger.error('Error archiving medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving medication',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Log medication adherence
 */
export const logAdherence = async (req: AuthRequest, res: Response) => {
  try {
    const {
      medicationId,
      patientId,
      refillDate,
      adherenceScore,
      pillCount,
      notes,
    } = req.body;

    // Verify medication exists and belongs to patient
    const medication = await MedicationManagement.findOne({
      _id: medicationId,
      patientId,
      workplaceId: req.user?.workplaceId,
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found or does not belong to the patient',
      });
    }

    // Create new adherence log
    const adherenceLog = new AdherenceLog({
      medicationId,
      patientId,
      workplaceId: req.user?.workplaceId,
      refillDate: refillDate || new Date(),
      adherenceScore,
      pillCount,
      notes,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    const savedLog = await adherenceLog.save();

    res.status(201).json({
      success: true,
      data: savedLog,
    });
    return;
  } catch (error) {
    logger.error('Error logging adherence:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging adherence',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
};

/**
 * Get adherence logs for a patient
 */
export const getAdherenceLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate } = req.query;

    // Build date filter if provided
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        refillDate: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        },
      };
    }

    // Find adherence logs for the patient
    const adherenceLogs = await AdherenceLog.find({
      patientId,
      workplaceId: req.user?.workplaceId,
      ...dateFilter,
    })
      .populate('medicationId', 'name dosage frequency')
      .sort({ refillDate: -1 });

    res.json({
      success: true,
      count: adherenceLogs.length,
      data: adherenceLogs,
    });
  } catch (error) {
    logger.error('Error fetching adherence logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching adherence logs',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Check for medication interactions
 */
export const checkInteractions = async (req: AuthRequest, res: Response) => {
  try {
    const { medications } = req.body;

    // Implementation placeholder for RxNorm API integration
    // This would normally connect to an external API service like RxNorm

    // For demonstration, return a mock response
    const mockInteractions = [
      {
        drugPair: [medications[0]?.name, medications[1]?.name].filter(Boolean),
        severity: 'moderate',
        description: 'These medications may interact. Monitor patient closely.',
      },
    ];

    res.json({
      success: true,
      data: mockInteractions,
    });

    // TODO: Implement actual RxNorm API integration in the future
  } catch (error) {
    logger.error('Error checking interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking medication interactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get medication dashboard statistics including active medications, adherence, and interactions
 */
export const getMedicationDashboardStats = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const workplaceId = req.user?.workplaceId;

    // Count active medications across all patients in the workplace
    const activeMedicationsCount = await MedicationManagement.countDocuments({
      workplaceId,
      status: 'active',
    });

    // Calculate average adherence score from adherence logs
    const adherenceLogs = await AdherenceLog.find({
      workplaceId,
      // Get adherence logs from the past 90 days for a relevant timeframe
      refillDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    });

    let averageAdherence = 0;
    if (adherenceLogs.length > 0) {
      const totalAdherence = adherenceLogs.reduce(
        (sum, log) => sum + (log.adherenceScore || 0),
        0
      );
      // Check if scores are already percentages (0-100) or decimals (0-1)
      // Safely gather all non-null scores to check their range
      const validScores = adherenceLogs
        .map((log) => log.adherenceScore)
        .filter(
          (score): score is number => score !== undefined && score !== null
        );

      // Determine if the scores are decimals based on all values
      const isDecimal =
        validScores.length > 0 && validScores.every((score) => score <= 1);

      // If scores are already percentages (like 80), don't multiply by 100
      averageAdherence = Math.round(
        isDecimal
          ? (totalAdherence / adherenceLogs.length) * 100
          : totalAdherence / adherenceLogs.length
      );
    }

    // Count medication interactions that need attention
    // In a real implementation, this would query interactions flagged in the system
    // For now, we'll calculate this based on medications with multiple prescribers
    const medicationsWithMultiplePrescribers =
      await MedicationManagement.aggregate([
        {
          $match: {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$patientId',
            medications: { $push: '$prescriber' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
        {
          $addFields: {
            uniquePrescribers: { $size: { $setUnion: ['$medications'] } },
          },
        },
        { $match: { uniquePrescribers: { $gt: 1 } } },
      ]);

    const interactionsCount = medicationsWithMultiplePrescribers.length;

    res.json({
      success: true,
      data: {
        activeMedications: activeMedicationsCount,
        averageAdherence,
        interactionAlerts: interactionsCount,
      },
    });
  } catch (error) {
    logger.error('Error getting medication dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving medication dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get medication adherence trends for charting
 */
export const getMedicationAdherenceTrends = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const { period = 'monthly' } = req.query; // period can be 'weekly', 'monthly', 'quarterly'

    // Get start date based on period
    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'weekly':
        // Last 12 weeks
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        // Last 4 quarters (12 months)
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        // Last 6 months
        startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get adherence logs within the time period
    const adherenceLogs = await AdherenceLog.find({
      workplaceId,
      refillDate: { $gte: startDate },
    }).sort({ refillDate: 1 });

    // Format the data for the chart based on the period
    let chartData: { name: string; adherence: number }[] = [];

    if (period === 'weekly') {
      // Group by week
      const weeklyData: Record<string, number[]> = {};

      for (const log of adherenceLogs) {
        const date = new Date(log.refillDate);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().substring(0, 10);

        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = [];
        }

        if (log.adherenceScore) {
          weeklyData[weekKey].push(log.adherenceScore);
        }
      }

      chartData = Object.keys(weeklyData)
        .sort()
        .map((week) => {
          const scores = weeklyData[week] || [];
          // Check if scores are already percentages (like 80) or decimals (like 0.8)
          const totalScore = scores.reduce(
            (sum: number, score: number) => sum + score,
            0
          );
          // Safety check for valid scores
          const validScores = scores.filter(
            (score: number) => score !== undefined && score !== null
          );
          const isDecimal =
            validScores.length > 0 &&
            validScores.every((score: number) => score <= 1);
          const averageScore = scores.length
            ? Math.round(
                isDecimal
                  ? (totalScore / scores.length) * 100 // Convert decimal to percentage
                  : totalScore / scores.length // Already a percentage
              )
            : 0;

          // Format the week as "Jun 1-7" or similar
          const weekDate = new Date(week);
          const weekEnd = new Date(weekDate);
          weekEnd.setDate(weekDate.getDate() + 6);
          const monthName = weekDate.toLocaleString('default', {
            month: 'short',
          });
          const weekRange = `${monthName} ${weekDate.getDate()}-${weekEnd.getDate()}`;

          return {
            name: weekRange,
            adherence: averageScore,
          };
        });
    } else if (period === 'quarterly') {
      // Group by quarter
      const quarterlyData: Record<string, number[]> = {};

      for (const log of adherenceLogs) {
        const date = new Date(log.refillDate);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const year = date.getFullYear();
        const quarterKey = `Q${quarter} ${year}`;

        if (!quarterlyData[quarterKey]) {
          quarterlyData[quarterKey] = [];
        }

        if (log.adherenceScore) {
          quarterlyData[quarterKey].push(log.adherenceScore);
        }
      }

      chartData = Object.keys(quarterlyData)
        .sort()
        .map((quarter) => {
          const scores = quarterlyData[quarter] || [];
          // Check if scores are already percentages (like 80) or decimals (like 0.8)
          const totalScore = scores.reduce(
            (sum: number, score: number) => sum + score,
            0
          );
          // Safety check for valid scores
          const validScores = scores.filter(
            (score: number) => score !== undefined && score !== null
          );
          const isDecimal =
            validScores.length > 0 &&
            validScores.every((score: number) => score <= 1);
          const averageScore = scores.length
            ? Math.round(
                isDecimal
                  ? (totalScore / scores.length) * 100 // Convert decimal to percentage
                  : totalScore / scores.length // Already a percentage
              )
            : 0;

          return {
            name: quarter,
            adherence: averageScore,
          };
        });
    } else {
      // Group by month (default)
      const monthlyData: Record<string, number[]> = {};

      for (const log of adherenceLogs) {
        const date = new Date(log.refillDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const monthKey = `${monthNames[month]} ${year}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }

        if (log.adherenceScore) {
          monthlyData[monthKey].push(log.adherenceScore);
        }
      }

      chartData = Object.keys(monthlyData)
        .sort((a, b) => {
          // Sort by year and month
          const [monthA, yearA] = a.split(' ');
          const [monthB, yearB] = b.split(' ');
          if (yearA !== yearB)
            return parseInt(yearA || '0') - parseInt(yearB || '0');

          const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ];
          return (
            monthNames.indexOf(monthA || '') - monthNames.indexOf(monthB || '')
          );
        })
        .map((month) => {
          const scores = monthlyData[month] || [];
          // Check if scores are already percentages (like 80) or decimals (like 0.8)
          const totalScore = scores.reduce(
            (sum: number, score: number) => sum + score,
            0
          );
          // Safety check for valid scores
          const validScores = scores.filter(
            (score: number) => score !== undefined && score !== null
          );
          const isDecimal =
            validScores.length > 0 &&
            validScores.every((score: number) => score <= 1);
          const averageScore = scores.length
            ? Math.round(
                isDecimal
                  ? (totalScore / scores.length) * 100 // Convert decimal to percentage
                  : totalScore / scores.length // Already a percentage
              )
            : 0;

          return {
            name: month,
            adherence: averageScore,
          };
        });
    }

    // If no data points are available, provide sample data
    if (chartData.length === 0) {
      if (period === 'weekly') {
        chartData = [
          { name: 'Jul 1-7', adherence: 82 },
          { name: 'Jul 8-14', adherence: 85 },
          { name: 'Jul 15-21', adherence: 80 },
          { name: 'Jul 22-28', adherence: 84 },
          { name: 'Aug 1-7', adherence: 87 },
          { name: 'Aug 8-14', adherence: 83 },
        ];
      } else if (period === 'quarterly') {
        chartData = [
          { name: 'Q1 2025', adherence: 78 },
          { name: 'Q2 2025', adherence: 82 },
          { name: 'Q3 2025', adherence: 85 },
          { name: 'Q4 2025', adherence: 84 },
        ];
      } else {
        chartData = [
          { name: 'Apr 2025', adherence: 78 },
          { name: 'May 2025', adherence: 80 },
          { name: 'Jun 2025', adherence: 84 },
          { name: 'Jul 2025', adherence: 82 },
          { name: 'Aug 2025', adherence: 85 },
          { name: 'Sep 2025', adherence: 84 },
        ];
      }
    }

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error('Error getting medication adherence trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving medication adherence trends',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get recent patients with medication counts
 */
export const getRecentPatientsWithMedications = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const workplaceId = req.user?.workplaceId;
    const { limit = 3 } = req.query;

    // Find patients with active medications, sorted by most recent update
    const recentPatients = await MedicationManagement.aggregate([
      {
        $match: {
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$patientId',
          medicationCount: { $sum: 1 },
          lastUpdate: { $max: '$updatedAt' },
        },
      },
      { $sort: { lastUpdate: -1 } },
      { $limit: parseInt(limit as string) || 3 },
    ]);

    // Get patient details for each patient
    const patientDetails = await Promise.all(
      recentPatients.map(async (item) => {
        const patient = await Patient.findById(item._id).select(
          'firstName lastName'
        );

        if (!patient) {
          return null;
        }

        // Calculate how long ago the update was
        const lastUpdateDate = new Date(item.lastUpdate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastUpdateDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let timeAgo;
        if (diffDays === 0) {
          timeAgo = 'Today';
        } else if (diffDays === 1) {
          timeAgo = 'Yesterday';
        } else if (diffDays < 7) {
          timeAgo = `${diffDays} days ago`;
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          timeAgo = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        } else {
          const months = Math.floor(diffDays / 30);
          timeAgo = `${months} ${months === 1 ? 'month' : 'months'} ago`;
        }

        return {
          id: item._id,
          name: `${patient.firstName} ${patient.lastName}`,
          medicationCount: item.medicationCount,
          lastUpdate: timeAgo,
        };
      })
    );

    // Filter out nulls from patients that might have been deleted
    const filteredPatients = patientDetails.filter((p) => p !== null);

    res.json({
      success: true,
      data: filteredPatients,
    });
  } catch (error) {
    logger.error('Error getting recent patients with medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving recent patients with medications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get patient medication settings
 */
export const getPatientMedicationSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { patientId } = req.params;
    const workplaceId = req.user?.workplaceId;

    // Check if patient exists (skip check for system-wide settings)
    if (patientId !== 'system') {
      const patientExists = await checkPatientExists(patientId);
      if (!patientExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Patient not found' 
        });
      }
    }

    // Find existing settings or create default ones
    // For system-wide settings, use a special query
    const query = patientId === 'system' 
      ? { patientId: 'system', workplaceId }
      : { patientId, workplaceId };
    
    let settings = await MedicationSettings.findOne(query);

    if (!settings) {
      // Create default settings if none exist
      settings = new MedicationSettings({
        patientId,
        workplaceId,
        createdBy: req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : undefined,
        updatedBy: req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      });
      await settings.save();
    }

    res.json({
      success: true,
      data: {
        reminderSettings: settings.reminderSettings,
        monitoringSettings: settings.monitoringSettings,
      },
    });
  } catch (error) {
    logger.error('Error getting patient medication settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving medication settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update patient medication settings
 */
export const updatePatientMedicationSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { patientId } = req.params;
    const { reminderSettings, monitoringSettings } = req.body;
    const workplaceId = req.user?.workplaceId;

    // Check if patient exists (skip check for system-wide settings)
    if (patientId !== 'system') {
      const patientExists = await checkPatientExists(patientId);
      if (!patientExists) {
        return res.status(404).json({ 
          success: false, 
          message: 'Patient not found' 
        });
      }
    }

    // Find existing settings or create new ones
    // For system-wide settings, use a special query
    const query = patientId === 'system' 
      ? { patientId: 'system', workplaceId }
      : { patientId, workplaceId };
    
    let settings = await MedicationSettings.findOne(query);

    if (!settings) {
      settings = new MedicationSettings({
        patientId,
        workplaceId,
        createdBy: req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : undefined,
        updatedBy: req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      });
    } else {
      settings.updatedBy = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : undefined;
    }

    // Update settings
    if (reminderSettings) {
      settings.reminderSettings = {
        ...settings.reminderSettings,
        ...reminderSettings,
      };
    }

    if (monitoringSettings) {
      settings.monitoringSettings = {
        ...settings.monitoringSettings,
        ...monitoringSettings,
      };
    }

    await settings.save();

    res.json({
      success: true,
      data: {
        reminderSettings: settings.reminderSettings,
        monitoringSettings: settings.monitoringSettings,
      },
    });
  } catch (error) {
    logger.error('Error updating patient medication settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medication settings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Send test notification (removed as per requirements)
 * This endpoint is kept for backward compatibility but returns a message
 */
export const sendTestNotification = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    res.json({
      success: false,
      message: 'Test notifications have been removed from this version',
      details: 'Please use the production notification system for testing',
    });
  } catch (error) {
    logger.error('Error in test notification endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Test notification feature is not available',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};