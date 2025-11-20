import { Request, Response, NextFunction } from 'express';
import { PatientHealthRecordsService, IVitalsData } from '../services/PatientHealthRecordsService';
import { PDFGenerationService, IPDFOptions } from '../services/PDFGenerationService';
import AppError from '../utils/AppError';
import logger from '../utils/logger';
import { validationResult } from 'express-validator';

// Extend Request interface to include patient user information
interface PatientPortalRequest extends Request {
  patientUser?: {
    _id: string;
    patientId: string;
    workplaceId: string;
    email: string;
    status: string;
  };
}

export class PatientHealthRecordsController {
  /**
   * Get lab results list for the authenticated patient
   * GET /api/patient-portal/health-records/lab-results
   */
  static async getLabResults(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const result = await PatientHealthRecordsService.getLabResults(
        patientUser.patientId,
        patientUser.workplaceId,
        Number(limit),
        skip
      );

      logger.info('Lab results fetched successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        resultCount: result.results.length,
        total: result.total,
        page: Number(page)
      });

      res.status(200).json({
        success: true,
        data: {
          results: result.results,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(result.total / Number(limit)),
            totalResults: result.total,
            hasMore: result.hasMore,
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error in getLabResults:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get detailed lab result by ID
   * GET /api/patient-portal/health-records/lab-results/:resultId
   */
  static async getLabResultDetails(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { resultId } = req.params;

      const result = await PatientHealthRecordsService.getLabResultDetails(
        patientUser.patientId,
        resultId,
        patientUser.workplaceId
      );

      logger.info('Lab result details fetched successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        resultId
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getLabResultDetails:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        resultId: req.params.resultId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get visit history for the authenticated patient
   * GET /api/patient-portal/health-records/visits
   */
  static async getVisitHistory(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const result = await PatientHealthRecordsService.getVisitHistory(
        patientUser.patientId,
        patientUser.workplaceId,
        Number(limit),
        skip
      );

      logger.info('Visit history fetched successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        visitCount: result.visits.length,
        total: result.total,
        page: Number(page)
      });

      res.status(200).json({
        success: true,
        data: {
          visits: result.visits,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(result.total / Number(limit)),
            totalResults: result.total,
            hasMore: result.hasMore,
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error in getVisitHistory:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get detailed visit information by ID
   * GET /api/patient-portal/health-records/visits/:visitId
   */
  static async getVisitDetails(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { visitId } = req.params;

      const visit = await PatientHealthRecordsService.getVisitDetails(
        patientUser.patientId,
        visitId,
        patientUser.workplaceId
      );

      logger.info('Visit details fetched successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        visitId
      });

      res.status(200).json({
        success: true,
        data: visit
      });
    } catch (error) {
      logger.error('Error in getVisitDetails:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        visitId: req.params.visitId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Log patient vitals
   * POST /api/patient-portal/health-records/vitals
   */
  static async logVitals(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const vitalsData: IVitalsData = req.body;

      // Log the vitals
      const updatedPatient = await PatientHealthRecordsService.logVitals(
        patientUser.patientId,
        patientUser.workplaceId,
        vitalsData
      );

      // Check for health alerts
      const alerts = await PatientHealthRecordsService.checkVitalsAlerts(
        patientUser.patientId,
        vitalsData
      );

      logger.info('Patient vitals logged successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        vitalsData,
        alertsGenerated: alerts.length
      });

      res.status(201).json({
        success: true,
        message: 'Vitals logged successfully',
        data: {
          vitalsLogged: true,
          alerts: alerts.length > 0 ? alerts : undefined,
          latestVitals: updatedPatient.patientLoggedVitals[updatedPatient.patientLoggedVitals.length - 1]
        }
      });
    } catch (error) {
      logger.error('Error in logVitals:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        vitalsData: req.body,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get patient vitals history
   * GET /api/patient-portal/health-records/vitals
   */
  static async getVitalsHistory(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { limit = 50, page = 1 } = req.query as any;
      const limitNum = Number(limit) || 50;
      const pageNum = Number(page) || 1;
      const skip = (pageNum - 1) * limitNum;

      const { default: VitalsAggregationService } = await import('../services/VitalsAggregationService');
      const aggregated = await VitalsAggregationService.getUnifiedVitals(
        patientUser.patientId,
        patientUser.workplaceId,
        limitNum,
        skip
      );

      logger.info('Unified vitals history fetched:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        count: aggregated.results.length,
        total: aggregated.total,
        page: pageNum,
        limit: limitNum
      });

      res.status(200).json({
        success: true,
        data: {
          results: aggregated.results,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(aggregated.total / limitNum),
            totalResults: aggregated.total,
            hasMore: aggregated.hasMore,
            limit: limitNum
          }
        }
      });
    } catch (error: any) {
      logger.error('Error in getVitalsHistory:', {
        error: error?.message,
        patientUserId: req.patientUser?._id,
        stack: error?.stack
      });
      next(error);
    }
  }

  /**
   * Get patient vitals trends
   * GET /api/patient-portal/health-records/vitals/trends
   */
  static async getVitalsTrends(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { days = 30, limit = 500 } = req.query as any;
      const periodDays = Number(days) || 30;
      const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;

      // Build from unified vitals so trends include both pharmacist and patient entries
      const { default: VitalsAggregationService } = await import('../services/VitalsAggregationService');
      // Fetch enough entries to cover the period
      const aggregated = await VitalsAggregationService.getUnifiedVitals(
        patientUser.patientId,
        patientUser.workplaceId,
        Number(limit) || 500,
        0
      );

      // Filter by period and map to chart-friendly readings
      const readings = (aggregated.results || [])
        .filter((r) => new Date(r.recordedAt).getTime() >= since)
        .map((r) => ({
          date: r.recordedAt,
          source: r.source,
          verified: !!r.verified,
          bloodPressureSystolic: r.bloodPressure?.systolic,
          bloodPressureDiastolic: r.bloodPressure?.diastolic,
          heartRate: r.heartRate,
          weight: r.weight,
          glucose: r.bloodGlucose,
          temperature: r.temperature,
        }));

      // Basic trends/summary - can be enhanced later
      const summary = {
        totalReadings: readings.length,
        daysTracked: periodDays,
        lastReading: readings[0]?.date || null,
        averages: {
          bloodPressure: undefined as any,
          heartRate: undefined as any,
          weight: undefined as any,
          glucose: undefined as any,
        },
      };

      // Compute simple averages if data present
      if (readings.length > 0) {
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : undefined);
        const systolics = readings.map(r=>r.bloodPressureSystolic).filter((n)=>typeof n==='number') as number[];
        const diastolics = readings.map(r=>r.bloodPressureDiastolic).filter((n)=>typeof n==='number') as number[];
        const hrs = readings.map(r=>r.heartRate).filter((n)=>typeof n==='number') as number[];
        const weights = readings.map(r=>r.weight).filter((n)=>typeof n==='number') as number[];
        const glucoses = readings.map(r=>r.glucose).filter((n)=>typeof n==='number') as number[];
        if (systolics.length || diastolics.length) {
          summary.averages.bloodPressure = {
            systolic: avg(systolics) || 0,
            diastolic: avg(diastolics) || 0,
          };
        }
        summary.averages.heartRate = avg(hrs) as any;
        summary.averages.weight = avg(weights) as any;
        summary.averages.glucose = avg(glucoses) as any;
      }

      const data = {
        readings,
        trends: [],
        insights: [],
        summary,
      };

      logger.info('Unified vitals trends calculated:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        days: periodDays,
        readings: readings.length,
      });

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getVitalsTrends:', {
        error: error?.message,
        patientUserId: req.patientUser?._id,
        days: req.query.days,
        stack: error?.stack
      });
      next(error);
    }
  }

  /**
   * Download medical records as PDF
   * GET /api/patient-portal/health-records/download
   */
  static async downloadMedicalRecords(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      // Parse PDF options from query parameters
      const {
        includeProfile = 'true',
        includeMedications = 'true',
        includeVitals = 'true',
        includeLabResults = 'true',
        includeVisitHistory = 'true',
        startDate,
        endDate
      } = req.query;

      const pdfOptions: IPDFOptions = {
        includeProfile: includeProfile === 'true',
        includeMedications: includeMedications === 'true',
        includeVitals: includeVitals === 'true',
        includeLabResults: includeLabResults === 'true',
        includeVisitHistory: includeVisitHistory === 'true'
      };

      // Add date range if provided
      if (startDate && endDate) {
        pdfOptions.dateRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const pdfBuffer = await PDFGenerationService.generateMedicalRecordsPDF(
        patientUser.patientId,
        patientUser.workplaceId,
        pdfOptions
      );

      // Set response headers for PDF download
      const filename = `medical-records-${patientUser.patientId}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      logger.info('Medical records PDF downloaded successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        pdfSize: pdfBuffer.length,
        filename,
        options: pdfOptions
      });

      res.status(200).send(pdfBuffer);
    } catch (error) {
      logger.error('Error in downloadMedicalRecords:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        queryParams: req.query,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Download medication list as PDF
   * GET /api/patient-portal/health-records/medications/download
   */
  static async downloadMedicationList(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const pdfBuffer = await PDFGenerationService.generateMedicationListPDF(
        patientUser.patientId,
        patientUser.workplaceId
      );

      // Set response headers for PDF download
      const filename = `medication-list-${patientUser.patientId}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      logger.info('Medication list PDF downloaded successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        pdfSize: pdfBuffer.length,
        filename
      });

      res.status(200).send(pdfBuffer);
    } catch (error) {
      logger.error('Error in downloadMedicationList:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Download specific lab results as PDF
   * POST /api/patient-portal/health-records/lab-results/download
   */
  static async downloadLabResults(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      const { resultIds } = req.body;

      const pdfBuffer = await PDFGenerationService.generateLabResultsPDF(
        patientUser.patientId,
        patientUser.workplaceId,
        resultIds
      );

      // Set response headers for PDF download
      const filename = `lab-results-${patientUser.patientId}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      logger.info('Lab results PDF downloaded successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        pdfSize: pdfBuffer.length,
        filename,
        resultIds: resultIds?.length || 'all'
      });

      res.status(200).send(pdfBuffer);
    } catch (error) {
      logger.error('Error in downloadLabResults:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        resultIds: req.body.resultIds,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get health summary dashboard data
   * GET /api/patient-portal/health-records/summary
   */
  static async getHealthSummary(req: PatientPortalRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientUser } = req;
      if (!patientUser) {
        throw new AppError('Patient authentication required', 401);
      }

      // Fetch summary data in parallel
      const [
        recentLabResults,
        recentVisits,
        recentVitals,
        vitalsTrends
      ] = await Promise.all([
        PatientHealthRecordsService.getLabResults(patientUser.patientId, patientUser.workplaceId, 3, 0),
        PatientHealthRecordsService.getVisitHistory(patientUser.patientId, patientUser.workplaceId, 3, 0),
        PatientHealthRecordsService.getVitalsHistory(patientUser.patientId, patientUser.workplaceId, 5),
        PatientHealthRecordsService.getVitalsTrends(patientUser.patientId, patientUser.workplaceId, 30)
      ]);

      // Check for alerts in recent vitals
      let recentAlerts: any[] = [];
      if (recentVitals.length > 0) {
        const latestVitals = recentVitals[0];
        const vitalsData: IVitalsData = {
          bloodPressure: latestVitals.bloodPressure,
          heartRate: latestVitals.heartRate,
          temperature: latestVitals.temperature,
          weight: latestVitals.weight,
          glucose: latestVitals.glucose,
          oxygenSaturation: latestVitals.oxygenSaturation
        };
        recentAlerts = await PatientHealthRecordsService.checkVitalsAlerts(
          patientUser.patientId,
          vitalsData
        );
      }

      const summary = {
        recentLabResults: {
          results: recentLabResults.results,
          total: recentLabResults.total
        },
        recentVisits: {
          visits: recentVisits.visits,
          total: recentVisits.total
        },
        recentVitals: {
          vitals: recentVitals.slice(0, 3),
          total: recentVitals.length
        },
        vitalsTrends: vitalsTrends,
        healthAlerts: recentAlerts,
        lastUpdated: new Date()
      };

      logger.info('Health summary fetched successfully:', {
        patientId: patientUser.patientId,
        workplaceId: patientUser.workplaceId,
        labResultsCount: recentLabResults.results.length,
        visitsCount: recentVisits.visits.length,
        vitalsCount: recentVitals.length,
        trendsCount: vitalsTrends.length,
        alertsCount: recentAlerts.length
      });

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error in getHealthSummary:', {
        error: error.message,
        patientUserId: req.patientUser?._id,
        stack: error.stack
      });
      next(error);
    }
  }
}