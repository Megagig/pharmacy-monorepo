// Appointment Store Types

export type AppointmentType =
  | 'mtm_session'
  | 'chronic_disease_review'
  | 'new_medication_consultation'
  | 'vaccination'
  | 'health_check'
  | 'smoking_cessation'
  | 'general_followup';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export type CalendarView = 'day' | 'week' | 'month';

export interface Appointment {
  _id: string;
  workplaceId: string;
  locationId?: string;
  patientId: string;
  assignedTo: string;
  type: AppointmentType;
  title: string;
  description?: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  timezone: string;
  status: AppointmentStatus;
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  confirmedAt?: Date;
  confirmedBy?: string;
  completedAt?: Date;
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    visitCreated: boolean;
    visitId?: string;
  };
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  rescheduledFrom?: Date;
  rescheduledTo?: Date;
  rescheduledReason?: string;
  rescheduledBy?: string;
  rescheduledAt?: Date;
  isRecurring: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    interval: number;
    endDate?: Date;
    endAfterOccurrences?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  recurringSeriesId?: string;
  isRecurringException: boolean;
  reminders: Array<{
    type: 'email' | 'sms' | 'push' | 'whatsapp';
    scheduledFor: Date;
    sent: boolean;
    sentAt?: Date;
    deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed';
    failureReason?: string;
  }>;
  relatedRecords?: {
    visitId?: string;
    mtrSessionId?: string;
    clinicalInterventionId?: string;
    diagnosticCaseId?: string;
    followUpTaskId?: string;
  };
  patientPreferences?: {
    preferredChannel: 'email' | 'sms' | 'whatsapp' | 'phone';
    language: string;
    specialRequirements?: string;
  };
  metadata?: {
    source: 'manual' | 'patient_portal' | 'automated_trigger' | 'recurring';
    triggerEvent?: string;
    customFields?: Record<string, any>;
  };
  createdBy: string;
  updatedBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentFilters {
  search?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  type?: AppointmentType | AppointmentType[];
  patientId?: string;
  assignedTo?: string;
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'scheduledDate' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AppointmentFormData {
  patientId: string;
  type: AppointmentType;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  assignedTo?: string;
  description?: string;
  isRecurring?: boolean;
  recurrencePattern?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    interval: number;
    endDate?: Date;
    endAfterOccurrences?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  patientPreferences?: {
    preferredChannel: 'email' | 'sms' | 'whatsapp' | 'phone';
    language: string;
    specialRequirements?: string;
  };
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  pharmacistId: string;
  pharmacistName?: string;
  conflictReason?: string;
  conflictingAppointment?: Appointment;
  slotType?: 'regular' | 'break' | 'buffer';
}

export interface PharmacistSlotStats {
  _id: string;
  name: string;
  email: string;
  totalSlots: number;
  availableSlots: number;
  utilizationRate: number;
  workingHours: string;
  nextAvailableSlot?: string;
}

export interface SlotSummary {
  totalSlots: number;
  availableSlots: number;
  unavailableSlots: number;
  utilizationRate: number;
}

export interface AvailableSlotsResponse {
  date: Date;
  slots: AvailableSlot[];
  pharmacists: PharmacistSlotStats[];
  summary: SlotSummary;
  totalAvailable: number;
  message?: string;
}

export interface NextAvailableSlotResponse {
  date: Date;
  time: string;
  pharmacistName: string;
}

export interface SlotValidationResponse {
  available: boolean;
  reason?: string;
  conflictingAppointment?: Appointment;
}

export interface PharmacistAvailabilityDay {
  date: Date;
  totalSlots: number;
  availableSlots: number;
  utilizationRate: number;
  firstAvailableSlot: string | null;
  lastAvailableSlot: string | null;
}

export interface PharmacistAvailabilityResponse {
  pharmacistId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  availability: PharmacistAvailabilityDay[];
  summary: {
    totalDays: number;
    daysWithAvailability: number;
    averageUtilization: number;
  };
}

export interface AppointmentSummary {
  total: number;
  byStatus: Record<AppointmentStatus, number>;
  byType: Record<AppointmentType, number>;
  today: number;
  tomorrow: number;
  thisWeek: number;
}
