/**
 * Patient Management Types
 * Comprehensive types for patient demographics, medical records, and clinical data
 */
import type { ObjectId, AuditFields, NigerianState, BloodGroup, Genotype, Gender, MaritalStatus, SeverityLevel } from './common';
export interface Patient extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    firstName: string;
    lastName: string;
    otherNames?: string;
    mrn: string;
    dob?: string;
    age?: number;
    gender?: Gender;
    phone?: string;
    email?: string;
    address?: string;
    state?: NigerianState;
    lga?: string;
    maritalStatus?: MaritalStatus;
    bloodGroup?: BloodGroup;
    genotype?: Genotype;
    weightKg?: number;
    latestVitals?: VitalSigns;
    hasActiveDTP?: boolean;
    displayName?: string;
    calculatedAge?: number;
}
export interface Allergy extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    substance: string;
    reaction?: string;
    severity?: SeverityLevel;
    notedAt?: string;
}
export interface Condition extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    name: string;
    snomedId?: string;
    onsetDate?: string;
    status: 'active' | 'resolved' | 'remission';
    notes?: string;
}
export interface MedicationRecord extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    phase: 'past' | 'current';
    medicationName: string;
    purposeIndication?: string;
    dose?: string;
    frequency?: string;
    route?: string;
    duration?: string;
    startDate?: string;
    endDate?: string;
    adherence?: 'good' | 'fair' | 'poor' | 'unknown';
    notes?: string;
    status?: 'active' | 'completed' | 'expired';
    treatmentDurationDays?: number;
}
export interface VitalSigns {
    bpSys?: number;
    bpDia?: number;
    rr?: number;
    tempC?: number;
    heartSounds?: string;
    pallor?: 'none' | 'mild' | 'moderate' | 'severe';
    dehydration?: 'none' | 'mild' | 'moderate' | 'severe';
    recordedAt?: string;
}
export interface LabResults {
    pcv?: number;
    mcs?: string;
    eucr?: string;
    fbc?: string;
    fbs?: number;
    hba1c?: number;
    misc?: Record<string, string | number>;
}
export interface ClinicalAssessment extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    vitals?: VitalSigns;
    labs?: LabResults;
    visitId?: ObjectId;
    recordedAt: string;
}
export type DTPType = 'untreated_condition' | 'improper_drug_selection' | 'sub_therapeutic_dosage' | 'overdosage' | 'adverse_drug_reaction' | 'drug_interaction' | 'unnecessary_therapy' | 'non_adherence';
export interface DrugTherapyProblem extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    type: DTPType;
    description?: string;
    visitId?: ObjectId;
    status: 'unresolved' | 'resolved';
}
export interface CarePlan extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    goals: string[];
    objectives: string[];
    visitId?: ObjectId;
    followUpDate?: string;
    planQuality: 'adequate' | 'needsReview';
    dtpSummary?: 'resolved' | 'unresolved';
    notes?: string;
}
export interface SOAPNotes {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
}
export interface VisitAttachment {
    kind: 'lab' | 'image' | 'audio' | 'other';
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt?: string;
}
export interface Visit extends AuditFields {
    _id: ObjectId;
    pharmacyId: ObjectId;
    patientId: ObjectId;
    appointmentId?: ObjectId;
    date: string;
    soap: SOAPNotes;
    attachments?: VisitAttachment[];
    patientSummary?: {
        summary: string;
        keyPoints: string[];
        nextSteps: string[];
        visibleToPatient: boolean;
        summarizedBy?: ObjectId;
        summarizedAt?: string;
    };
}
export interface PatientSummary {
    patient: {
        id: ObjectId;
        name: string;
        mrn: string;
        age?: number;
        latestVitals?: VitalSigns;
    };
    counts: {
        allergies: number;
        conditions: number;
        currentMedications: number;
        visits: number;
        hasActiveDTP: boolean;
    };
}
export interface PatientFormData {
    firstName: string;
    lastName: string;
    otherNames?: string;
    dob?: string;
    age?: number;
    gender?: Gender;
    phone?: string;
    email?: string;
    address?: string;
    state?: NigerianState;
    lga?: string;
    maritalStatus?: MaritalStatus;
    bloodGroup?: BloodGroup;
    genotype?: Genotype;
    weightKg?: number;
    allergies?: Omit<Allergy, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>[];
    conditions?: Omit<Condition, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>[];
    medications?: Omit<MedicationRecord, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>[];
    assessment?: Omit<ClinicalAssessment, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
    dtps?: Omit<DrugTherapyProblem, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>[];
    carePlan?: Omit<CarePlan, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
}
export interface PatientSearchParams {
    q?: string;
    name?: string;
    mrn?: string;
    phone?: string;
    state?: NigerianState;
    bloodGroup?: BloodGroup;
    genotype?: Genotype;
    page?: number;
    limit?: number;
    sort?: string;
}
export interface AllergySearchParams {
    severity?: SeverityLevel;
    page?: number;
    limit?: number;
}
export interface MedicationSearchParams {
    phase?: 'current' | 'past';
    page?: number;
    limit?: number;
}
export interface DTPSearchParams {
    status?: 'unresolved' | 'resolved';
    page?: number;
    limit?: number;
}
export type CreatePatientData = Omit<Patient, '_id' | 'pharmacyId' | 'mrn' | keyof AuditFields>;
export type UpdatePatientData = Partial<CreatePatientData>;
export type CreateAllergyData = Omit<Allergy, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateAllergyData = Partial<CreateAllergyData>;
export type CreateConditionData = Omit<Condition, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateConditionData = Partial<CreateConditionData>;
export type CreateMedicationData = Omit<MedicationRecord, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateMedicationData = Partial<CreateMedicationData>;
export type CreateAssessmentData = Omit<ClinicalAssessment, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateAssessmentData = Partial<CreateAssessmentData>;
export type CreateDTPData = Omit<DrugTherapyProblem, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateDTPData = Partial<CreateDTPData>;
export type CreateCarePlanData = Omit<CarePlan, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateCarePlanData = Partial<CreateCarePlanData>;
export type CreateVisitData = Omit<Visit, '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields>;
export type UpdateVisitData = Partial<CreateVisitData>;
//# sourceMappingURL=patient.d.ts.map