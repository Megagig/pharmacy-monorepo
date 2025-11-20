import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import Patient, { IPatient } from '../models/Patient';
import Medication, { IMedication } from '../models/Medication';
import Visit, { IVisit } from '../models/Visit';
import DiagnosticCase, { IDiagnosticCase } from '../models/DiagnosticCase';
import Workplace, { IWorkplace } from '../models/Workplace';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

export interface IPDFOptions {
  includeProfile?: boolean;
  includeMedications?: boolean;
  includeVitals?: boolean;
  includeLabResults?: boolean;
  includeVisitHistory?: boolean;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export class PDFGenerationService {
  /**
   * Generate comprehensive medical records PDF for a patient
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID for tenancy and branding
   * @param options - PDF generation options
   */
  static async generateMedicalRecordsPDF(
    patientId: string,
    workplaceId: string,
    options: IPDFOptions = {}
  ): Promise<Buffer> {
    try {
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new AppError('Invalid patient ID', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(workplaceId)) {
        throw new AppError('Invalid workplace ID', 400);
      }

      // Set default options
      const pdfOptions: Required<IPDFOptions> = {
        includeProfile: true,
        includeMedications: true,
        includeVitals: true,
        includeLabResults: true,
        includeVisitHistory: true,
        dateRange: {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
          endDate: new Date()
        },
        ...options
      };

      // Fetch patient data
      const patient = await Patient.findOne({
        _id: new mongoose.Types.ObjectId(patientId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isDeleted: false
      }).lean();

      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Fetch workplace data for branding
      const workplace = await Workplace.findById(workplaceId).lean();
      if (!workplace) {
        throw new AppError('Workplace not found', 404);
      }

      // Fetch additional data based on options
      const [medications, visits, labResults] = await Promise.all([
        pdfOptions.includeMedications ? this.fetchPatientMedications(patientId, workplaceId) : [],
        pdfOptions.includeVisitHistory ? this.fetchPatientVisits(patientId, workplaceId, pdfOptions.dateRange) : [],
        pdfOptions.includeLabResults ? this.fetchPatientLabResults(patientId, workplaceId, pdfOptions.dateRange) : []
      ]);

      // Generate PDF
      const pdfBuffer = await this.createPDFDocument(
        patient,
        workplace,
        {
          medications,
          visits,
          labResults
        },
        pdfOptions
      );

      logger.info('Medical records PDF generated successfully:', {
        patientId,
        workplaceId,
        pdfSize: pdfBuffer.length,
        options: pdfOptions
      });

      return pdfBuffer;
    } catch (error) {
      logger.error('Error generating medical records PDF:', {
        error: error.message,
        patientId,
        workplaceId,
        options,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate medical records PDF', 500);
    }
  }

  /**
   * Generate medication list PDF
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID
   */
  static async generateMedicationListPDF(
    patientId: string,
    workplaceId: string
  ): Promise<Buffer> {
    return this.generateMedicalRecordsPDF(patientId, workplaceId, {
      includeProfile: true,
      includeMedications: true,
      includeVitals: false,
      includeLabResults: false,
      includeVisitHistory: false
    });
  }

  /**
   * Generate lab results PDF
   * @param patientId - Patient ID
   * @param workplaceId - Workplace ID
   * @param resultIds - Specific lab result IDs to include
   */
  static async generateLabResultsPDF(
    patientId: string,
    workplaceId: string,
    resultIds?: string[]
  ): Promise<Buffer> {
    try {
      // If specific result IDs provided, fetch only those
      let labResults: IDiagnosticCase[] = [];

      if (resultIds && resultIds.length > 0) {
        const validIds = resultIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
          throw new AppError('No valid result IDs provided', 400);
        }

        labResults = await DiagnosticCase.find({
          _id: { $in: validIds.map(id => new mongoose.Types.ObjectId(id)) },
          patientId: new mongoose.Types.ObjectId(patientId),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          labResults: { $exists: true, $ne: [] }
        })
          .populate('pharmacistId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean();
      }

      return this.generateMedicalRecordsPDF(patientId, workplaceId, {
        includeProfile: true,
        includeMedications: false,
        includeVitals: false,
        includeLabResults: true,
        includeVisitHistory: false
      });
    } catch (error) {
      logger.error('Error generating lab results PDF:', {
        error: error.message,
        patientId,
        workplaceId,
        resultIds,
        stack: error.stack
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate lab results PDF', 500);
    }
  }

  /**
   * Fetch patient medications
   */
  private static async fetchPatientMedications(
    patientId: string,
    workplaceId: string
  ): Promise<IMedication[]> {
    return Medication.find({
      patientId: new mongoose.Types.ObjectId(patientId),
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      isDeleted: false
    })
      .populate('prescribedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Fetch patient visits within date range
   */
  private static async fetchPatientVisits(
    patientId: string,
    workplaceId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<IVisit[]> {
    return Visit.find({
      patientId: new mongoose.Types.ObjectId(patientId),
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      date: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      },
      isDeleted: false
    })
      .populate('createdBy', 'firstName lastName')
      .sort({ date: -1 })
      .lean();
  }

  /**
   * Fetch patient lab results within date range
   */
  private static async fetchPatientLabResults(
    patientId: string,
    workplaceId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<IDiagnosticCase[]> {
    return DiagnosticCase.find({
      patientId: new mongoose.Types.ObjectId(patientId),
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      },
      labResults: { $exists: true, $ne: [] },
      status: { $in: ['completed', 'follow_up'] }
    })
      .populate('pharmacistId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Create PDF document with patient data
   */
  private static async createPDFDocument(
    patient: IPatient,
    workplace: IWorkplace,
    data: {
      medications: IMedication[];
      visits: IVisit[];
      labResults: IDiagnosticCase[];
    },
    options: Required<IPDFOptions>
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Medical Records - ${patient.firstName} ${patient.lastName}`,
            Author: workplace.name,
            Subject: 'Patient Medical Records',
            Creator: 'PharmaCare Patient Portal',
            Producer: 'PharmaCare SaaS Platform'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add header with workplace branding
        this.addHeader(doc, workplace, patient);

        // Add patient profile section
        if (options.includeProfile) {
          this.addPatientProfile(doc, patient);
        }

        // Add medications section
        if (options.includeMedications && data.medications.length > 0) {
          this.addMedicationsSection(doc, data.medications);
        }

        // Add vitals section
        if (options.includeVitals && patient.patientLoggedVitals && patient.patientLoggedVitals.length > 0) {
          this.addVitalsSection(doc, patient.patientLoggedVitals, options.dateRange);
        }

        // Add lab results section
        if (options.includeLabResults && data.labResults.length > 0) {
          this.addLabResultsSection(doc, data.labResults);
        }

        // Add visit history section
        if (options.includeVisitHistory && data.visits.length > 0) {
          this.addVisitHistorySection(doc, data.visits);
        }

        // Add footer
        this.addFooter(doc, workplace);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add header with workplace branding
   */
  private static addHeader(doc: PDFKit.PDFDocument, workplace: IWorkplace, patient: IPatient): void {
    // Workplace logo placeholder (if available)
    if (workplace.logoUrl) {
      // doc.image(workplace.logoUrl, 50, 50, { width: 100 });
    }

    // Workplace name and details
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text(workplace.name, 50, 50)
      .fontSize(12)
      .font('Helvetica')
      .text(workplace.address || '', 50, 75)
      .text(`Phone: ${workplace.phone || 'N/A'}`, 50, 90)
      .text(`Email: ${workplace.email || 'N/A'}`, 50, 105);

    // Document title
    doc.fontSize(18)
      .font('Helvetica-Bold')
      .text('MEDICAL RECORDS', 400, 50, { align: 'right' })
      .fontSize(12)
      .font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString()}`, 400, 75, { align: 'right' })
      .text(`Patient: ${patient.firstName} ${patient.lastName}`, 400, 90, { align: 'right' })
      .text(`MRN: ${patient.mrn}`, 400, 105, { align: 'right' });

    // Add line separator
    doc.moveTo(50, 130)
      .lineTo(550, 130)
      .stroke();

    doc.y = 150;
  }

  /**
   * Add patient profile section
   */
  private static addPatientProfile(doc: PDFKit.PDFDocument, patient: IPatient): void {
    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('PATIENT INFORMATION', 50, doc.y)
      .moveDown();

    const profileData = [
      ['Name:', `${patient.firstName} ${patient.otherNames || ''} ${patient.lastName}`.trim()],
      ['MRN:', patient.mrn],
      ['Date of Birth:', patient.dob ? patient.dob.toLocaleDateString() : 'N/A'],
      ['Age:', patient.age?.toString() || (patient.dob ? this.calculateAge(patient.dob).toString() : 'N/A')],
      ['Gender:', patient.gender || 'N/A'],
      ['Phone:', patient.phone || 'N/A'],
      ['Email:', patient.email || 'N/A'],
      ['Address:', patient.address || 'N/A'],
      ['Blood Group:', patient.bloodGroup || 'N/A'],
      ['Genotype:', patient.genotype || 'N/A'],
      ['Weight:', patient.weightKg ? `${patient.weightKg} kg` : 'N/A']
    ];

    doc.fontSize(12).font('Helvetica');
    profileData.forEach(([label, value]) => {
      doc.text(`${label}`, 70, doc.y, { continued: true, width: 120 })
        .font('Helvetica-Bold')
        .text(value, { width: 300 })
        .font('Helvetica')
        .moveDown(0.5);
    });

    // Add allergies if present
    if (patient.allergies && patient.allergies.length > 0) {
      doc.moveDown()
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('ALLERGIES:', 70, doc.y)
        .fontSize(12)
        .font('Helvetica');

      patient.allergies.forEach(allergy => {
        doc.text(`• ${allergy.allergen} (${allergy.severity}): ${allergy.reaction}`, 90, doc.y)
          .moveDown(0.5);
      });
    }

    // Add chronic conditions if present
    if (patient.chronicConditions && patient.chronicConditions.length > 0) {
      doc.moveDown()
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('CHRONIC CONDITIONS:', 70, doc.y)
        .fontSize(12)
        .font('Helvetica');

      patient.chronicConditions.forEach(condition => {
        doc.text(`• ${condition.condition} (${condition.status}) - Diagnosed: ${condition.diagnosedDate.toLocaleDateString()}`, 90, doc.y)
          .moveDown(0.5);
      });
    }

    doc.moveDown(2);
  }

  /**
   * Add medications section
   */
  private static addMedicationsSection(doc: PDFKit.PDFDocument, medications: IMedication[]): void {
    this.checkPageBreak(doc, 100);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('CURRENT MEDICATIONS', 50, doc.y)
      .moveDown();

    medications.forEach((medication, index) => {
      this.checkPageBreak(doc, 80);

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${medication.drugName}`, 70, doc.y)
        .font('Helvetica')
        .text(`Dosage: ${medication.instructions?.dosage || 'N/A'}`, 90, doc.y + 15)
        .text(`Frequency: ${medication.instructions?.frequency || 'N/A'}`, 90, doc.y + 30)
        .text(`Instructions: ${medication.instructions?.specialInstructions || 'N/A'}`, 90, doc.y + 45)
        .text(`Prescribed: ${medication.createdAt.toLocaleDateString()}`, 90, doc.y + 60);

      doc.y += 80;
      doc.moveDown(0.5);
    });

    doc.moveDown(2);
  }

  /**
   * Add vitals section
   */
  private static addVitalsSection(
    doc: PDFKit.PDFDocument,
    vitals: any[],
    dateRange: { startDate: Date; endDate: Date }
  ): void {
    this.checkPageBreak(doc, 100);

    // Filter vitals within date range
    const filteredVitals = vitals
      .filter(vital => vital.recordedDate >= dateRange.startDate && vital.recordedDate <= dateRange.endDate)
      .sort((a, b) => b.recordedDate.getTime() - a.recordedDate.getTime())
      .slice(0, 10); // Show last 10 entries

    if (filteredVitals.length === 0) return;

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('RECENT VITALS', 50, doc.y)
      .moveDown();

    filteredVitals.forEach((vital, index) => {
      this.checkPageBreak(doc, 60);

      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(`${vital.recordedDate.toLocaleDateString()}`, 70, doc.y)
        .font('Helvetica');

      const vitalEntries = [];
      if (vital.bloodPressure) {
        vitalEntries.push(`BP: ${vital.bloodPressure.systolic}/${vital.bloodPressure.diastolic} mmHg`);
      }
      if (vital.heartRate) vitalEntries.push(`HR: ${vital.heartRate} bpm`);
      if (vital.temperature) vitalEntries.push(`Temp: ${vital.temperature}°C`);
      if (vital.weight) vitalEntries.push(`Weight: ${vital.weight} kg`);
      if (vital.glucose) vitalEntries.push(`Glucose: ${vital.glucose} mg/dL`);
      if (vital.oxygenSaturation) vitalEntries.push(`O2 Sat: ${vital.oxygenSaturation}%`);

      doc.text(vitalEntries.join(', '), 90, doc.y + 15);
      if (vital.notes) {
        doc.text(`Notes: ${vital.notes}`, 90, doc.y + 30);
      }

      doc.y += 50;
      doc.moveDown(0.5);
    });

    doc.moveDown(2);
  }

  /**
   * Add lab results section
   */
  private static addLabResultsSection(doc: PDFKit.PDFDocument, labResults: IDiagnosticCase[]): void {
    this.checkPageBreak(doc, 100);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('LABORATORY RESULTS', 50, doc.y)
      .moveDown();

    labResults.forEach((result, index) => {
      this.checkPageBreak(doc, 120);

      doc.fontSize(14)
        .font('Helvetica-Bold')
        .text(`${result.createdAt.toLocaleDateString()} - Case ID: ${result.caseId}`, 70, doc.y)
        .fontSize(12)
        .font('Helvetica')
        .moveDown(0.5);

      if (result.labResults && result.labResults.length > 0) {
        result.labResults.forEach(lab => {
          doc.text(`• ${lab.testName}: ${lab.value}`, 90, doc.y)
            .text(`  Reference Range: ${lab.referenceRange}`, 110, doc.y + 15)
            .text(`  Status: ${lab.abnormal ? 'ABNORMAL' : 'Normal'}`, 110, doc.y + 30);
          doc.y += 50;
        });
      }

      doc.moveDown();
    });

    doc.moveDown(2);
  }

  /**
   * Add visit history section
   */
  private static addVisitHistorySection(doc: PDFKit.PDFDocument, visits: IVisit[]): void {
    this.checkPageBreak(doc, 100);

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text('VISIT HISTORY', 50, doc.y)
      .moveDown();

    visits.forEach((visit, index) => {
      this.checkPageBreak(doc, 150);

      doc.fontSize(14)
        .font('Helvetica-Bold')
        .text(`${visit.date.toLocaleDateString()}`, 70, doc.y)
        .fontSize(12)
        .font('Helvetica')
        .moveDown(0.5);

      if (visit.soap.subjective) {
        doc.font('Helvetica-Bold').text('Subjective:', 90, doc.y)
          .font('Helvetica').text(visit.soap.subjective, 90, doc.y + 15, { width: 450 });
        doc.y += 35;
      }

      if (visit.soap.objective) {
        doc.font('Helvetica-Bold').text('Objective:', 90, doc.y)
          .font('Helvetica').text(visit.soap.objective, 90, doc.y + 15, { width: 450 });
        doc.y += 35;
      }

      if (visit.soap.assessment) {
        doc.font('Helvetica-Bold').text('Assessment:', 90, doc.y)
          .font('Helvetica').text(visit.soap.assessment, 90, doc.y + 15, { width: 450 });
        doc.y += 35;
      }

      if (visit.soap.plan) {
        doc.font('Helvetica-Bold').text('Plan:', 90, doc.y)
          .font('Helvetica').text(visit.soap.plan, 90, doc.y + 15, { width: 450 });
        doc.y += 35;
      }

      doc.moveDown();
    });

    doc.moveDown(2);
  }

  /**
   * Add footer
   */
  private static addFooter(doc: PDFKit.PDFDocument, workplace: IWorkplace): void {
    const bottomMargin = 50;
    const pageHeight = doc.page.height;

    doc.fontSize(10)
      .font('Helvetica')
      .text(
        'This document contains confidential medical information. Please handle with appropriate care.',
        50,
        pageHeight - bottomMargin - 30,
        { align: 'center', width: 500 }
      )
      .text(
        `Generated by ${workplace.name} - PharmaCare Patient Portal`,
        50,
        pageHeight - bottomMargin - 15,
        { align: 'center', width: 500 }
      );
  }

  /**
   * Check if page break is needed
   */
  private static checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number): void {
    if (doc.y + requiredSpace > doc.page.height - 100) {
      doc.addPage();
    }
  }

  /**
   * Calculate age from date of birth
   */
  private static calculateAge(dob: Date): number {
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      return age - 1;
    }

    return age;
  }
}