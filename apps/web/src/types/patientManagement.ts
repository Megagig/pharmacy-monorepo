/**
 * Comprehensive TypeScript Interfaces for Patient Management
 * Matches backend models and API structures for type safety
 */

// Common types
export type ObjectId = string;

export interface AuditFields {
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

// Nigerian healthcare specific types
export type NigerianState =
  | 'Abia'
  | 'Adamawa'
  | 'Akwa Ibom'
  | 'Anambra'
  | 'Bauchi'
  | 'Bayelsa'
  | 'Benue'
  | 'Borno'
  | 'Cross River'
  | 'Delta'
  | 'Ebonyi'
  | 'Edo'
  | 'Ekiti'
  | 'Enugu'
  | 'FCT'
  | 'Gombe'
  | 'Imo'
  | 'Jigawa'
  | 'Kaduna'
  | 'Kano'
  | 'Katsina'
  | 'Kebbi'
  | 'Kogi'
  | 'Kwara'
  | 'Lagos'
  | 'Nasarawa'
  | 'Niger'
  | 'Ogun'
  | 'Ondo'
  | 'Osun'
  | 'Oyo'
  | 'Plateau'
  | 'Rivers'
  | 'Sokoto'
  | 'Taraba'
  | 'Yobe'
  | 'Zamfara';

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';
export type Genotype = 'AA' | 'AS' | 'SS' | 'AC' | 'SC' | 'CC';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';

// Core Patient Interface
export interface Patient extends AuditFields {
  _id: ObjectId;
  pharmacyId: ObjectId;

  // Demographics
  firstName: string;
  lastName: string;
  otherNames?: string;
  mrn: string; // Medical Record Number (PHM-{STATE}-{NUMBER})
  dob?: string;
  age?: number;
  gender?: Gender;
  phone?: string; // Nigerian E.164 format (+234)
  email?: string;
  address?: string;
  state?: NigerianState;
  lga?: string; // Local Government Area
  maritalStatus?: MaritalStatus;

  // Medical Information
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  weightKg?: number;

  // Clinical Status
  latestVitals?: VitalSigns;
  hasActiveDTP?: boolean;

  // Computed properties
  displayName?: string;
  calculatedAge?: number;
}

// Allergy Management
export interface Allergy extends AuditFields {
  _id: ObjectId;
  pharmacyId: ObjectId;
  patientId: ObjectId;
  substance: string;
  reaction?: string;
  severity?: SeverityLevel;
  notedAt?: string;
}

// Condition Management
export interface Condition extends AuditFields {
  _id: ObjectId;
  pharmacyId: ObjectId;
  patientId: ObjectId;
  name: string;
  snomedId?: string; // SNOMED CT identifier
  onsetDate?: string;
  status: 'active' | 'resolved' | 'remission';
  notes?: string;
}

// Medication Management
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

  // Computed properties
  status?: 'active' | 'completed' | 'expired';
  treatmentDurationDays?: number;
}

// Clinical Assessment
export interface VitalSigns {
  bpSys?: number;
  bpDia?: number;
  rr?: number; // Respiratory Rate
  tempC?: number;
  heartSounds?: string;
  pallor?: 'none' | 'mild' | 'moderate' | 'severe';
  dehydration?: 'none' | 'mild' | 'moderate' | 'severe';
  recordedAt?: string;
}

export interface LabResults {
  pcv?: number; // Packed Cell Volume
  mcs?: string; // Microscopy, Culture and Sensitivity
  eucr?: string; // Electrolytes, Urea, Creatinine
  fbc?: string; // Full Blood Count
  fbs?: number; // Fasting Blood Sugar
  hba1c?: number; // Hemoglobin A1c
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

// Drug Therapy Problem (DTP)
export type DTPType =
  | 'untreated_condition'
  | 'improper_drug_selection'
  | 'sub_therapeutic_dosage'
  | 'overdosage'
  | 'adverse_drug_reaction'
  | 'drug_interaction'
  | 'unnecessary_therapy'
  | 'non_adherence';

export interface DrugTherapyProblem extends AuditFields {
  _id: ObjectId;
  pharmacyId: ObjectId;
  patientId: ObjectId;
  type: DTPType;
  description?: string;
  visitId?: ObjectId;
  status: 'unresolved' | 'resolved';
}

// Care Plan
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

// Visit Management
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
  appointmentId?: ObjectId; // Link to appointment if created from one
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

// API Response Interfaces
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  timestamp: string;
}

// Helper type for handling union API responses
export type ResourceResponse<T> = PaginatedResponse<T> | { results: T[] };

export interface PaginatedResponse<T> extends ApiResponse<{ results: T[] }> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Patient Summary Interface
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

// Form Data Interfaces
export interface PatientFormData {
  // Demographics
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

  // Medical Information
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  weightKg?: number;

  // Initial clinical data (for new patients)
  allergies?: Omit<
    Allergy,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >[];
  conditions?: Omit<
    Condition,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >[];
  medications?: Omit<
    MedicationRecord,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >[];
  assessment?: Omit<
    ClinicalAssessment,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >;
  dtps?: Omit<
    DrugTherapyProblem,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >[];
  carePlan?: Omit<
    CarePlan,
    '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
  >;
}

// Search and Filter Interfaces
export interface PatientSearchParams {
  q?: string; // General search query
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

// RBAC Types
export type UserRole =
  | 'owner'
  | 'pharmacist'
  | 'technician'
  | 'admin'
  | 'super_admin';

export interface RBACPermissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManage: boolean;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[] | unknown;
  statusCode?: number;
}

// Utility Types
export type CreatePatientData = Omit<
  Patient,
  '_id' | 'pharmacyId' | 'mrn' | keyof AuditFields
>;
export type UpdatePatientData = Partial<CreatePatientData>;

export type CreateAllergyData = Omit<
  Allergy,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateAllergyData = Partial<CreateAllergyData>;

export type CreateConditionData = Omit<
  Condition,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateConditionData = Partial<CreateConditionData>;

export type CreateMedicationData = Omit<
  MedicationRecord,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateMedicationData = Partial<CreateMedicationData>;

export type CreateAssessmentData = Omit<
  ClinicalAssessment,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateAssessmentData = Partial<CreateAssessmentData>;

export type CreateDTPData = Omit<
  DrugTherapyProblem,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateDTPData = Partial<CreateDTPData>;

export type CreateCarePlanData = Omit<
  CarePlan,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateCarePlanData = Partial<CreateCarePlanData>;

export type CreateVisitData = Omit<
  Visit,
  '_id' | 'pharmacyId' | 'patientId' | keyof AuditFields
>;
export type UpdateVisitData = Partial<CreateVisitData>;
