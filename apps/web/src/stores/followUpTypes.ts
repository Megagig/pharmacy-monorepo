// Follow-up Task Store Types

export type FollowUpType =
  | 'medication_start_followup'
  | 'lab_result_review'
  | 'hospital_discharge_followup'
  | 'medication_change_followup'
  | 'chronic_disease_monitoring'
  | 'adherence_check'
  | 'refill_reminder'
  | 'preventive_care'
  | 'general_followup';

export type FollowUpPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

export type FollowUpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue'
  | 'converted_to_appointment';

export type TriggerType =
  | 'manual'
  | 'medication_start'
  | 'lab_result'
  | 'hospital_discharge'
  | 'medication_change'
  | 'scheduled_monitoring'
  | 'missed_appointment'
  | 'system_rule';

export interface FollowUpTask {
  _id: string;
  workplaceId: string;
  locationId?: string;
  patientId: string;
  assignedTo: string;
  type: FollowUpType;
  title: string;
  description: string;
  objectives: string[];
  priority: FollowUpPriority;
  dueDate: Date;
  estimatedDuration?: number;
  status: FollowUpStatus;
  completedAt?: Date;
  completedBy?: string;
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    appointmentCreated: boolean;
    appointmentId?: string;
  };
  trigger: {
    type: TriggerType;
    sourceId?: string;
    sourceType?: string;
    triggerDate: Date;
    triggerDetails?: Record<string, any>;
  };
  relatedRecords?: {
    medicationId?: string;
    labResultId?: string;
    clinicalInterventionId?: string;
    mtrSessionId?: string;
    appointmentId?: string;
  };
  escalationHistory: Array<{
    escalatedAt: Date;
    escalatedBy: string;
    fromPriority: string;
    toPriority: string;
    reason: string;
  }>;
  remindersSent: Array<{
    sentAt: Date;
    channel: 'email' | 'sms' | 'push' | 'system';
    recipientId: string;
  }>;
  createdBy: string;
  updatedBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUpFilters {
  search?: string;
  status?: FollowUpStatus | FollowUpStatus[];
  priority?: FollowUpPriority | FollowUpPriority[];
  type?: FollowUpType | FollowUpType[];
  patientId?: string;
  assignedTo?: string;
  locationId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  overdue?: boolean;
  sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FollowUpFormData {
  patientId: string;
  type: FollowUpType;
  title: string;
  description: string;
  objectives: string[];
  priority: FollowUpPriority;
  dueDate: Date;
  estimatedDuration?: number;
  assignedTo?: string;
  trigger?: {
    type: TriggerType;
    sourceId?: string;
    sourceType?: string;
    triggerDetails?: Record<string, any>;
  };
}

export interface FollowUpSummary {
  total: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  byPriority: Record<FollowUpPriority, number>;
  byStatus: Record<FollowUpStatus, number>;
  byType: Record<FollowUpType, number>;
}
