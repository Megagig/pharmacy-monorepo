import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
    action: string;
    timestamp: Date;
    userId: mongoose.Types.ObjectId;
    interventionId?: mongoose.Types.ObjectId;
    details: Record<string, any>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory: string;
    changedFields?: string[];
    ipAddress?: string;
    userAgent?: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    workspaceId?: mongoose.Types.ObjectId;
    sessionId?: string;
    metadata?: {
        source: string;
        version: string;
        environment: string;
    };
    // RBAC-specific fields
    roleId?: mongoose.Types.ObjectId;
    roleName?: string;
    targetUserId?: mongoose.Types.ObjectId;
    permissionAction?: string;
    permissionSource?: 'direct' | 'role' | 'inherited' | 'legacy';
    hierarchyLevel?: number;
    bulkOperationId?: string;
    securityContext?: {
        riskScore: number;
        anomalyDetected: boolean;
        escalationReason?: string;
        previousPermissions?: string[];
        newPermissions?: string[];
    };
}

const auditLogSchema = new Schema<IAuditLog>({
    action: {
        type: String,
        required: true,
        enum: [
            'INTERVENTION_CREATED',
            'INTERVENTION_UPDATED',
            'INTERVENTION_DELETED',
            'INTERVENTION_REVIEWED',
            'INTERVENTION_APPROVED',
            'INTERVENTION_REJECTED',
            'INTERVENTION_COMPLETED',
            'INTERVENTION_CANCELLED',
            'INTERVENTION_ASSIGNED',
            'INTERVENTION_ESCALATED',
            'PATIENT_DATA_ACCESSED',
            'MEDICATION_CHANGED',
            'DOSAGE_MODIFIED',
            'ALLERGY_UPDATED',
            'CONTRAINDICATION_FLAGGED',
            'RISK_ASSESSMENT_UPDATED',
            'COMPLIANCE_CHECK',
            'EXPORT_PERFORMED',
            'REPORT_GENERATED',
            'USER_LOGIN',
            'USER_LOGOUT',
            'PERMISSION_CHANGED',
            'SYSTEM_BACKUP',
            'DATA_MIGRATION',
            // Clinical Notes Actions
            'CLINICAL_NOTE_ROUTE_ACCESS',
            'LIST_CLINICAL_NOTES',
            'CREATE_CLINICAL_NOTE',
            'VIEW_CLINICAL_NOTE',
            'UPDATE_CLINICAL_NOTE',
            'DELETE_CLINICAL_NOTE',
            'SEARCH_CLINICAL_NOTES',
            'FILTER_CLINICAL_NOTES',
            'VIEW_NOTE_STATISTICS',
            'BULK_UPDATE_NOTES',
            'BULK_DELETE_NOTES',
            'VIEW_PATIENT_NOTES',
            'UPLOAD_NOTE_ATTACHMENT',
            'DELETE_NOTE_ATTACHMENT',
            'DOWNLOAD_NOTE_ATTACHMENT',
            // RBAC Actions
            'ROLE_CREATED',
            'ROLE_UPDATED',
            'ROLE_DELETED',
            'ROLE_ASSIGNED',
            'ROLE_REVOKED',
            'ROLE_HIERARCHY_MODIFIED',
            'PERMISSION_GRANTED',
            'PERMISSION_REVOKED',
            'PERMISSION_CHECKED',
            'PERMISSION_DENIED',
            'BULK_ROLE_ASSIGNMENT',
            'BULK_PERMISSION_UPDATE',
            'PRIVILEGE_ESCALATION_ATTEMPT',
            'UNAUTHORIZED_ACCESS_ATTEMPT',
            'ROLE_INHERITANCE_MODIFIED',
            // Diagnostic Actions
            'AI_DIAGNOSTIC_REQUEST',
            'AI_DIAGNOSTIC_ANALYSIS',
            'VIEW_DIAGNOSTIC_CASE',
            'VIEW_DIAGNOSTIC_ANALYTICS',
            'VIEW_DIAGNOSTIC_REFERRALS',
            'VIEW_ALL_DIAGNOSTIC_CASES',
            'VIEW_PATIENT_DIAGNOSTIC_HISTORY',
            'ADD_DIAGNOSTIC_HISTORY_NOTE',
            'GENERATE_REFERRAL_DOCUMENT',
            'COMPARE_DIAGNOSTIC_HISTORIES',
            'EXPORT_DIAGNOSTIC_HISTORY_PDF',
            'PERMISSION_CACHE_INVALIDATED',
            'SECURITY_POLICY_VIOLATION',
            'ADMIN_ROLE_ASSIGNMENT',
            'SUPER_ADMIN_ACCESS',
            'RBAC_MIGRATION_EXECUTED',
            'RBAC_ROLLBACK_EXECUTED',
            // Diagnostic Actions
            'VIEW_DIAGNOSTIC_HISTORY',
            'DIAGNOSTIC_ANALYSIS_REQUESTED',
            'DIAGNOSTIC_CASE_CREATED',
            'DIAGNOSTIC_CASE_UPDATED',
            'DIAGNOSTIC_CASE_DELETED',
            // MTR (Medication Therapy Review) Actions
            'CREATE_MTR_SESSION',
            'VIEW_MTR_SESSION',
            'VIEW_MTR_SESSIONS',
            'UPDATE_MTR_SESSION',
            'DELETE_MTR_SESSION',
            'MTR_CREATE_MTR_SESSION',
            'MTR_VIEW_MTR_SESSION',
            'MTR_VIEW_MTR_SESSIONS',
            'MTR_UPDATE_MTR_SESSION',
            'MTR_DELETE_MTR_SESSION',
            // Security Settings Actions
            'PASSWORD_POLICY_UPDATED',
            'ACCOUNT_LOCKOUT_UPDATED',
            'SECURITY_SETTINGS_UPDATED',
            'SESSION_TERMINATED',
            'ACCOUNT_LOCKED',
            'ACCOUNT_UNLOCKED'
        ]
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    interventionId: {
        type: Schema.Types.ObjectId,
        ref: 'ClinicalIntervention',
        required: false
    },
    details: {
        type: Schema.Types.Mixed,
        required: true
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        default: 'low'
    },
    complianceCategory: {
        type: String,
        required: true,
        enum: [
            'clinical_documentation',
            'medication_safety',
            'patient_privacy',
            'data_integrity',
            'quality_assurance',
            'regulatory_compliance',
            'patient_care',
            'system_security',
            'workflow_management',
            'risk_management',
            'data_access',
            'rbac_management',
            'security_monitoring',
            'privilege_management',
            'access_control',
            'security_management'
        ]
    },
    changedFields: [{
        type: String
    }],
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    oldValues: {
        type: Schema.Types.Mixed,
        required: false
    },
    newValues: {
        type: Schema.Types.Mixed,
        required: false
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workspace',
        required: false
    },
    sessionId: {
        type: String,
        required: false
    },
    metadata: {
        source: {
            type: String,
            default: 'clinical-intervention-system'
        },
        version: {
            type: String,
            default: '1.0.0'
        },
        environment: {
            type: String,
            default: process.env.NODE_ENV || 'development'
        }
    },
    // RBAC-specific fields
    roleId: {
        type: Schema.Types.ObjectId,
        ref: 'Role',
        required: false
    },
    roleName: {
        type: String,
        required: false
    },
    targetUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    permissionAction: {
        type: String,
        required: false
    },
    permissionSource: {
        type: String,
        enum: ['direct', 'role', 'inherited', 'legacy'],
        required: false
    },
    hierarchyLevel: {
        type: Number,
        required: false
    },
    bulkOperationId: {
        type: String,
        required: false
    },
    securityContext: {
        riskScore: {
            type: Number,
            min: 0,
            max: 100,
            required: false
        },
        anomalyDetected: {
            type: Boolean,
            default: false
        },
        escalationReason: {
            type: String,
            required: false
        },
        previousPermissions: [{
            type: String
        }],
        newPermissions: [{
            type: String
        }]
    }
}, {
    timestamps: true,
    collection: 'audit_logs'
});

// Indexes for performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ interventionId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ riskLevel: 1, timestamp: -1 });
auditLogSchema.index({ complianceCategory: 1, timestamp: -1 });
auditLogSchema.index({ workspaceId: 1, timestamp: -1 });

// Compound indexes for common queries
auditLogSchema.index({ interventionId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ riskLevel: 1, complianceCategory: 1, timestamp: -1 });

// RBAC-specific indexes
auditLogSchema.index({ roleId: 1, timestamp: -1 });
auditLogSchema.index({ targetUserId: 1, timestamp: -1 });
auditLogSchema.index({ permissionAction: 1, timestamp: -1 });
auditLogSchema.index({ bulkOperationId: 1, timestamp: -1 });
auditLogSchema.index({ 'securityContext.anomalyDetected': 1, timestamp: -1 });
auditLogSchema.index({ 'securityContext.riskScore': 1, timestamp: -1 });

// Compound indexes for RBAC queries
auditLogSchema.index({ roleId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ targetUserId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ permissionAction: 1, permissionSource: 1, timestamp: -1 });
auditLogSchema.index({ complianceCategory: 1, action: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);