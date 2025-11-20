import mongoose from 'mongoose';
import Patient, { IPatient } from '../models/Patient';
import Visit, { IVisit } from '../models/Visit';
import DiagnosticCase, { IDiagnosticCase } from '../models/DiagnosticCase';
import LabResult, { ILabResult } from '../models/LabResult';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

export interface IVitalsData {
  bloodPressure?: { systolic: number; diastolic: number };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  glucose?: number;
  oxygenSaturation?: number;
  notes?: string;
}

export interface IHealthAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  parameter: string;
  value: number | string;
  referenceRange?: string;
  recommendation?: string;
}

export interface IVitalsTrend {
  parameter: string;
  data: Array<{
    date: Date;
    value: number;
    unit: string;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageChange: number;
}

export class PatientHealthRecordsService {
  /**
   * Get lab results for a patient using DiagnosticCase model
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy
   * @param limit - Number of results to return
   * @param skip - Number of results to skip for pagination
   */
  static async getLabResults(
    patientId: string,
    workplaceId: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<{
    results: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // logger.info('=== getLabResults DEBUG START ===');
      logger.info(`Patient ID: ${patientId}`);
      logger.info(`Workplace ID: ${workplaceId}`);
      logger.info(`Limit: ${limit}, Skip: ${skip}`);
      
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        logger.error('Invalid patient ID format');
        throw new AppError('Invalid patient ID', 400);
      }
      const patientObjectId = new mongoose.Types.ObjectId(patientId);

      let workplaceObjectId: mongoose.Types.ObjectId | undefined = undefined;
      if (workplaceId && mongoose.Types.ObjectId.isValid(workplaceId)) {
        workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);
      } else {
        logger.warn('Workplace ID missing or invalid. Proceeding without workplace filter.');
      }

      // logger.info('ObjectIds processed successfully');

      // Check if LabResult model is available
      // logger.info(`Registered models: ${mongoose.modelNames().join(', ')}`);
      if (!LabResult) {
        logger.error('LabResult model is undefined!');
        throw new AppError('LabResult model not available', 500);
      }
      // logger.info('LabResult model available');

      // Build query for lab results from LabResult model
      // Show all results except Cancelled ones
      const query: any = {
        patientId: patientObjectId,
        status: { $ne: 'Cancelled' }, // Show all except cancelled
      };
      if (workplaceObjectId) {
        query.workplaceId = workplaceObjectId;
      }


      // logger.debug('Query object:', JSON.stringify(query, null, 2));
      // logger.debug('Executing LabResult.find()...');

      const [results, total] = await Promise.all([
        LabResult.find(query)
          .select('testName testCode testCategory testValue unit referenceRange interpretation notes attachments testDate resultDate status patientId workplaceId createdAt updatedAt orderedBy reviewedBy')
          .sort({ testDate: -1, createdAt: -1 }) // Sort by test date, then creation date
          .limit(limit)
          .skip(skip)
          .lean(),
        LabResult.countDocuments(query)
      ]);

      // logger.info(`Found ${results.length} lab results out of ${total} total`);

      return {
        results,
        total,
        hasMore: skip + results.length < total
      };
    } catch (error: any) {
      logger.error('Error fetching lab results', {
        patientId,
        workplaceId,
        message: error?.message,
        name: error?.name,
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch lab results', 500);
    }
  }

  /**
   * Get detailed lab result by diagnostic case ID
   * @param patientId - Patient ID for security validation
   * @param resultId - Diagnostic case ID
   * @param workplaceId - Workplace ID for tenancy
   */
  static async getLabResultDetails(
    patientId: string,
    resultId: string,
    workplaceId: string
  ): Promise<IDiagnosticCase> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(resultId)) {
        throw new AppError('Invalid result ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      const result = await DiagnosticCase.findOne({
        _id: new mongoose.Types.ObjectId(resultId),
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        labResults: { $exists: true, $ne: [] }
      })
        .populate('pharmacistId', 'firstName lastName email')
        .lean();

      if (!result) {
        throw new AppError('Lab result not found', 404);
      }

      return result;
    } catch (error) {
      logger.error('Error fetching lab result details:', {
        error: error.message,
        patientId,
        resultId,
        workplaceId,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch lab result details', 500);
    }
  }

  /**
   * Get visit history for a patient using Visit model
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy
   * @param limit - Number of visits to return
   * @param skip - Number of visits to skip for pagination
   */
  static async getVisitHistory(
    patientId: string,
    workplaceId: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<{
    visits: IVisit[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      const query = {
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      };

      const [visits, total] = await Promise.all([
        Visit.find(query)
          .populate('createdBy', 'firstName lastName')
          .sort({ date: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Visit.countDocuments(query)
      ]);

      return {
        visits,
        total,
        hasMore: skip + visits.length < total
      };
    } catch (error) {
      logger.error('Error fetching visit history:', {
        error: error.message,
        patientId,
        workplaceId,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch visit history', 500);
    }
  }

  /**
   * Get detailed visit information by visit ID
   * @param patientId - Patient ID for security validation
   * @param visitId - Visit ID
   * @param workplaceId - Workplace ID for tenancy
   */
  static async getVisitDetails(
    patientId: string,
    visitId: string,
    workplaceId: string
  ): Promise<IVisit> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(visitId)) {
        throw new AppError('Invalid visit ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      const visit = await Visit.findOne({
        _id: new mongoose.Types.ObjectId(visitId),
        patientId: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      })
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName')
        .lean();

      if (!visit) {
        throw new AppError('Visit not found', 404);
      }

      return visit;
    } catch (error) {
      logger.error('Error fetching visit details:', {
        error: error.message,
        patientId,
        visitId,
        workplaceId,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch visit details', 500);
    }
  }

  /**
   * Log patient vitals to the patient portal vitals array
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy
   * @param vitalsData - Vitals data to log
   */
  static async logVitals(
    patientId: string,
    workplaceId: string,
    vitalsData: IVitalsData
  ): Promise<IPatient> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      // Validate vitals data
      this.validateVitalsData(vitalsData);

      const patient = await Patient.findOne({
        _id: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      });

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Add vitals to patient logged vitals array
      const vitalsEntry = {
        recordedDate: new Date(),
        ...vitalsData,
        source: 'patient_portal' as const,
        isVerified: false
      };

      patient.patientLoggedVitals.push(vitalsEntry);

      // Keep only last 100 vitals entries to prevent unlimited growth
      if (patient.patientLoggedVitals.length > 100) {
        patient.patientLoggedVitals = patient.patientLoggedVitals
          .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
          .slice(0, 100);
      }

      await patient.save();

      logger.info('Patient vitals logged successfully:', {
        patientId,
        workplaceId,
        vitalsCount: patient.patientLoggedVitals.length
      });

      return patient;
    } catch (error) {
      logger.error('Error logging patient vitals:', {
        error: error.message,
        patientId,
        workplaceId,
        vitalsData,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to log vitals', 500);
    }
  }

  /**
   * Get patient vitals history
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy
   * @param limit - Number of vitals entries to return
   */
  static async getVitalsHistory(
    patientId: string,
    workplaceId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      const patient = await Patient.findOne({
        _id: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      })
        .select('patientLoggedVitals')
        .lean();

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Sort by recorded date (newest first) and limit results
      const vitalsHistory = patient.patientLoggedVitals
        .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
        .slice(0, limit);

      return vitalsHistory;
    } catch (error) {
      logger.error('Error fetching vitals history:', {
        error: error.message,
        patientId,
        workplaceId,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch vitals history', 500);
    }
  }

  /**
   * Get vitals trends for a patient over a specified period
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy
   * @param days - Number of days to analyze (default 30)
   */
  static async getVitalsTrends(
    patientId: string,
    workplaceId: string,
    days: number = 30
  ): Promise<IVitalsTrend[]> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const patient = await Patient.findOne({
        _id: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      })
        .select('patientLoggedVitals')
        .lean();

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Filter vitals within the specified date range
      const recentVitals = patient.patientLoggedVitals
        .filter(vital => vital.recordedDate >= startDate)
        .sort((a, b) => a.recordedDate.getTime() - b.recordedDate.getTime());

      const trends: IVitalsTrend[] = [];

      // Analyze blood pressure trends
      if (recentVitals.some(v => v.bloodPressure)) {
        const bpData = recentVitals
          .filter(v => v.bloodPressure?.systolic && v.bloodPressure?.diastolic)
          .map(v => ({
            date: v.recordedDate,
            systolic: v.bloodPressure!.systolic,
            diastolic: v.bloodPressure!.diastolic
          }));

        if (bpData.length > 1) {
          trends.push(this.calculateTrend('systolic_bp', bpData.map(d => ({
            date: d.date,
            value: d.systolic,
            unit: 'mmHg'
          }))));

          trends.push(this.calculateTrend('diastolic_bp', bpData.map(d => ({
            date: d.date,
            value: d.diastolic,
            unit: 'mmHg'
          }))));
        }
      }

      // Analyze other vital parameters
      const vitalParameters = [
        { key: 'heartRate', name: 'heart_rate', unit: 'bpm' },
        { key: 'temperature', name: 'temperature', unit: '°C' },
        { key: 'weight', name: 'weight', unit: 'kg' },
        { key: 'glucose', name: 'glucose', unit: 'mg/dL' },
        { key: 'oxygenSaturation', name: 'oxygen_saturation', unit: '%' }
      ];

      vitalParameters.forEach(param => {
        const data = recentVitals
          .filter(v => v[param.key] != null)
          .map(v => ({
            date: v.recordedDate,
            value: v[param.key] as number,
            unit: param.unit
          }));

        if (data.length > 1) {
          trends.push(this.calculateTrend(param.name, data));
        }
      });

      return trends;
    } catch (error) {
      logger.error('Error calculating vitals trends:', {
        error: error.message,
        patientId,
        workplaceId,
        days,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to calculate vitals trends', 500);
    }
  }

  /**
   * Check for health alerts based on abnormal vitals
   * @param patientId - Patient ID
   * @param vitalsData - Latest vitals data
   */
  static async checkVitalsAlerts(
    patientId: string,
    vitalsData: IVitalsData
  ): Promise<IHealthAlert[]> {
    try {
      const alerts: IHealthAlert[] = [];

      // Blood pressure alerts
      if (vitalsData.bloodPressure) {
        const { systolic, diastolic } = vitalsData.bloodPressure;

        if (systolic >= 180 || diastolic >= 120) {
          alerts.push({
            type: 'critical',
            message: 'Hypertensive crisis - immediate medical attention required',
            parameter: 'blood_pressure',
            value: `${systolic}/${diastolic}`,
            referenceRange: '<140/90 mmHg',
            recommendation: 'Seek immediate medical care'
          });
        } else if (systolic >= 140 || diastolic >= 90) {
          alerts.push({
            type: 'warning',
            message: 'High blood pressure detected',
            parameter: 'blood_pressure',
            value: `${systolic}/${diastolic}`,
            referenceRange: '<140/90 mmHg',
            recommendation: 'Monitor closely and consult healthcare provider'
          });
        } else if (systolic < 90 || diastolic < 60) {
          alerts.push({
            type: 'warning',
            message: 'Low blood pressure detected',
            parameter: 'blood_pressure',
            value: `${systolic}/${diastolic}`,
            referenceRange: '90-140/60-90 mmHg',
            recommendation: 'Monitor for symptoms and consult healthcare provider if concerned'
          });
        }
      }

      // Heart rate alerts
      if (vitalsData.heartRate) {
        if (vitalsData.heartRate > 100) {
          alerts.push({
            type: vitalsData.heartRate > 120 ? 'critical' : 'warning',
            message: 'Elevated heart rate detected',
            parameter: 'heart_rate',
            value: vitalsData.heartRate,
            referenceRange: '60-100 bpm',
            recommendation: vitalsData.heartRate > 120 ? 'Seek immediate medical attention' : 'Monitor and rest, consult healthcare provider if persistent'
          });
        } else if (vitalsData.heartRate < 60) {
          alerts.push({
            type: 'warning',
            message: 'Low heart rate detected',
            parameter: 'heart_rate',
            value: vitalsData.heartRate,
            referenceRange: '60-100 bpm',
            recommendation: 'Monitor for symptoms and consult healthcare provider'
          });
        }
      }

      // Temperature alerts
      if (vitalsData.temperature) {
        if (vitalsData.temperature >= 38.5) {
          alerts.push({
            type: vitalsData.temperature >= 40 ? 'critical' : 'warning',
            message: 'Fever detected',
            parameter: 'temperature',
            value: vitalsData.temperature,
            referenceRange: '36.1-37.2°C',
            recommendation: vitalsData.temperature >= 40 ? 'Seek immediate medical attention' : 'Monitor temperature and stay hydrated'
          });
        } else if (vitalsData.temperature < 35) {
          alerts.push({
            type: 'critical',
            message: 'Hypothermia detected',
            parameter: 'temperature',
            value: vitalsData.temperature,
            referenceRange: '36.1-37.2°C',
            recommendation: 'Seek immediate medical attention'
          });
        }
      }

      // Glucose alerts
      if (vitalsData.glucose) {
        if (vitalsData.glucose > 250) {
          alerts.push({
            type: 'critical',
            message: 'Very high blood glucose detected',
            parameter: 'glucose',
            value: vitalsData.glucose,
            referenceRange: '70-140 mg/dL',
            recommendation: 'Seek immediate medical attention'
          });
        } else if (vitalsData.glucose > 180) {
          alerts.push({
            type: 'warning',
            message: 'High blood glucose detected',
            parameter: 'glucose',
            value: vitalsData.glucose,
            referenceRange: '70-140 mg/dL',
            recommendation: 'Monitor closely and consult healthcare provider'
          });
        } else if (vitalsData.glucose < 70) {
          alerts.push({
            type: 'critical',
            message: 'Low blood glucose detected',
            parameter: 'glucose',
            value: vitalsData.glucose,
            referenceRange: '70-140 mg/dL',
            recommendation: 'Treat hypoglycemia immediately and seek medical attention'
          });
        }
      }

      // Oxygen saturation alerts
      if (vitalsData.oxygenSaturation) {
        if (vitalsData.oxygenSaturation < 90) {
          alerts.push({
            type: 'critical',
            message: 'Low oxygen saturation detected',
            parameter: 'oxygen_saturation',
            value: vitalsData.oxygenSaturation,
            referenceRange: '95-100%',
            recommendation: 'Seek immediate medical attention'
          });
        } else if (vitalsData.oxygenSaturation < 95) {
          alerts.push({
            type: 'warning',
            message: 'Below normal oxygen saturation',
            parameter: 'oxygen_saturation',
            value: vitalsData.oxygenSaturation,
            referenceRange: '95-100%',
            recommendation: 'Monitor closely and consult healthcare provider'
          });
        }
      }

      // Log alerts for monitoring
      if (alerts.length > 0) {
        logger.warn('Health alerts generated for patient:', {
          patientId,
          alertCount: alerts.length,
          alerts: alerts.map(a => ({ type: a.type, parameter: a.parameter, value: a.value }))
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking vitals alerts:', {
        error: error.message,
        patientId,
        vitalsData,
        stack: error.stack
      });
      throw new AppError('Failed to check vitals alerts', 500);
    }
  }

  /**
   * Validate vitals data before logging
   * @param vitalsData - Vitals data to validate
   */
  private static validateVitalsData(vitalsData: IVitalsData): void {
    // Blood pressure validation
    if (vitalsData.bloodPressure) {
      const { systolic, diastolic } = vitalsData.bloodPressure;
      if (systolic < 50 || systolic > 300) {
        throw new AppError('Systolic blood pressure must be between 50-300 mmHg', 400);
      }
      if (diastolic < 30 || diastolic > 200) {
        throw new AppError('Diastolic blood pressure must be between 30-200 mmHg', 400);
      }
      if (systolic <= diastolic) {
        throw new AppError('Systolic pressure must be higher than diastolic pressure', 400);
      }
    }

    // Heart rate validation
    if (vitalsData.heartRate !== undefined) {
      if (vitalsData.heartRate < 30 || vitalsData.heartRate > 250) {
        throw new AppError('Heart rate must be between 30-250 bpm', 400);
      }
    }

    // Temperature validation
    if (vitalsData.temperature !== undefined) {
      if (vitalsData.temperature < 30 || vitalsData.temperature > 45) {
        throw new AppError('Temperature must be between 30-45°C', 400);
      }
    }

    // Weight validation
    if (vitalsData.weight !== undefined) {
      if (vitalsData.weight <= 0 || vitalsData.weight > 1000) {
        throw new AppError('Weight must be between 0-1000 kg', 400);
      }
    }

    // Glucose validation
    if (vitalsData.glucose !== undefined) {
      if (vitalsData.glucose < 20 || vitalsData.glucose > 800) {
        throw new AppError('Glucose level must be between 20-800 mg/dL', 400);
      }
    }

    // Oxygen saturation validation
    if (vitalsData.oxygenSaturation !== undefined) {
      if (vitalsData.oxygenSaturation < 50 || vitalsData.oxygenSaturation > 100) {
        throw new AppError('Oxygen saturation must be between 50-100%', 400);
      }
    }

    // Notes validation
    if (vitalsData.notes && vitalsData.notes.length > 500) {
      throw new AppError('Notes cannot exceed 500 characters', 400);
    }
  }

  /**
   * Calculate trend for a vital parameter
   * @param parameter - Parameter name
   * @param data - Data points for trend calculation
   */
  private static calculateTrend(
    parameter: string,
    data: Array<{ date: Date; value: number; unit: string }>
  ): IVitalsTrend {
    if (data.length < 2) {
      return {
        parameter,
        data,
        trend: 'stable',
        averageChange: 0
      };
    }

    // Calculate linear regression to determine trend
    const n = data.length;
    const sumX = data.reduce((sum, _, index) => sum + index, 0);
    const sumY = data.reduce((sum, point) => sum + point.value, 0);
    const sumXY = data.reduce((sum, point, index) => sum + index * point.value, 0);
    const sumXX = data.reduce((sum, _, index) => sum + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const averageChange = slope;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.1) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      parameter,
      data,
      trend,
      averageChange
    };
  }
}