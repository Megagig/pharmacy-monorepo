/**
 * Communication Hub Security Configuration
 * Centralized security settings and policies
 */

export interface SecurityConfig {
    rateLimiting: {
        message: {
            windowMs: number;
            limits: {
                pharmacist: number;
                doctor: number;
                patient: number;
                pharmacy_team: number;
                intern_pharmacist: number;
                default: number;
            };
        };
        conversation: {
            windowMs: number;
            limits: {
                pharmacist: number;
                doctor: number;
                patient: number;
                pharmacy_team: number;
                intern_pharmacist: number;
                default: number;
            };
        };
        fileUpload: {
            windowMs: number;
            limits: {
                pharmacist: number;
                doctor: number;
                patient: number;
                pharmacy_team: number;
                intern_pharmacist: number;
                default: number;
            };
        };
        search: {
            windowMs: number;
            limits: {
                pharmacist: number;
                doctor: number;
                patient: number;
                pharmacy_team: number;
                intern_pharmacist: number;
                default: number;
            };
        };
        burstProtection: {
            windowMs: number;
            limits: {
                patient: number;
                default: number;
            };
        };
    };

    sessionManagement: {
        maxConcurrentSessions: number;
        sessionTimeout: number;
        inactivityTimeout: number;
        maxFailedAttempts: number;
        lockoutDuration: number;
        deviceFingerprintRequired: boolean;
    };

    fileUpload: {
        maxFileSize: number;
        maxTotalSize: number;
        allowedMimeTypes: string[];
        dangerousExtensions: string[];
    };

    contentSecurity: {
        maxMessageLength: number;
        maxTitleLength: number;
        maxSearchLength: number;
        maxFilenameLength: number;
        allowedEmojis: string[];
        allowedMessageTags: string[];
    };

    encryption: {
        algorithm: string;
        keyLength: number;
        ivLength: number;
        tagLength: number;
        keyRotationInterval: number;
    };

    auditLogging: {
        retentionPeriod: number;
        sensitiveActions: string[];
        highRiskActions: string[];
        exportFormats: string[];
    };

    rbac: {
        roleHierarchy: {
            [role: string]: {
                permissions: string[];
                inherits?: string[];
            };
        };
        conversationTypeRestrictions: {
            [type: string]: {
                requiredRoles: string[];
                maxParticipants: number;
                minParticipants: number;
            };
        };
    };
}

export const COMMUNICATION_SECURITY_CONFIG: SecurityConfig = {
    rateLimiting: {
        message: {
            windowMs: 60 * 1000, // 1 minute
            limits: {
                pharmacist: 100,
                doctor: 100,
                patient: 30,
                pharmacy_team: 60,
                intern_pharmacist: 60,
                default: 20,
            },
        },
        conversation: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            limits: {
                pharmacist: 20,
                doctor: 20,
                patient: 5,
                pharmacy_team: 10,
                intern_pharmacist: 10,
                default: 3,
            },
        },
        fileUpload: {
            windowMs: 10 * 60 * 1000, // 10 minutes
            limits: {
                pharmacist: 50,
                doctor: 50,
                patient: 20,
                pharmacy_team: 30,
                intern_pharmacist: 30,
                default: 10,
            },
        },
        search: {
            windowMs: 5 * 60 * 1000, // 5 minutes
            limits: {
                pharmacist: 100,
                doctor: 100,
                patient: 30,
                pharmacy_team: 60,
                intern_pharmacist: 60,
                default: 20,
            },
        },
        burstProtection: {
            windowMs: 10 * 1000, // 10 seconds
            limits: {
                patient: 3,
                default: 5,
            },
        },
    },

    sessionManagement: {
        maxConcurrentSessions: 5,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
        maxFailedAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        deviceFingerprintRequired: true,
    },

    fileUpload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxTotalSize: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        dangerousExtensions: [
            '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
            '.js', '.vbs', '.jar', '.app', '.deb', '.pkg',
        ],
    },

    contentSecurity: {
        maxMessageLength: 10000,
        maxTitleLength: 200,
        maxSearchLength: 100,
        maxFilenameLength: 255,
        allowedEmojis: [
            '👍', '👎', '❤️', '😊', '😢', '😮', '😡', '🤔',
            '✅', '❌', '⚠️', '🚨', '📋', '💊', '🩺', '📊',
        ],
        allowedMessageTags: [
            'b', 'i', 'u', 'strong', 'em', 'br', 'p',
            'ul', 'ol', 'li', 'code', 'pre',
        ],
    },

    encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32, // 256 bits
        ivLength: 16, // 128 bits
        tagLength: 16, // 128 bits
        keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
    },

    auditLogging: {
        retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        sensitiveActions: [
            'message_sent',
            'message_read',
            'message_edited',
            'message_deleted',
            'conversation_created',
            'participant_added',
            'participant_removed',
            'file_uploaded',
            'file_downloaded',
        ],
        highRiskActions: [
            'message_deleted',
            'conversation_archived',
            'participant_removed',
            'file_deleted',
            'bulk_operation',
            'admin_access',
        ],
        exportFormats: ['json', 'csv', 'pdf'],
    },

    rbac: {
        roleHierarchy: {
            super_admin: {
                permissions: ['*'], // All permissions
            },
            pharmacist: {
                permissions: [
                    'conversation.create',
                    'conversation.view',
                    'conversation.update',
                    'conversation.moderate',
                    'message.send',
                    'message.edit',
                    'message.delete',
                    'message.moderate',
                    'participant.add',
                    'participant.remove',
                    'file.upload',
                    'file.download',
                    'file.manage',
                    'patient.access',
                    'audit.view',
                    'search.advanced',
                    'thread.create',
                    'thread.manage',
                ],
            },
            doctor: {
                permissions: [
                    'conversation.create',
                    'conversation.view',
                    'conversation.update',
                    'message.send',
                    'message.edit',
                    'message.delete',
                    'participant.add',
                    'file.upload',
                    'file.download',
                    'file.manage',
                    'patient.access',
                    'search.advanced',
                    'thread.create',
                ],
            },
            pharmacy_team: {
                permissions: [
                    'conversation.view',
                    'message.send',
                    'message.edit',
                    'file.upload',
                    'file.download',
                    'search.basic',
                    'thread.create',
                ],
            },
            intern_pharmacist: {
                permissions: [
                    'conversation.view',
                    'message.send',
                    'message.edit',
                    'file.upload',
                    'file.download',
                    'search.basic',
                    'thread.create',
                ],
            },
            patient: {
                permissions: [
                    'conversation.create', // Can initiate queries
                    'conversation.view',
                    'message.send',
                    'message.edit', // Own messages only
                    'file.upload',
                    'search.basic',
                ],
            },
        },

        conversationTypeRestrictions: {
            patient_query: {
                requiredRoles: ['patient', 'pharmacist', 'doctor'],
                maxParticipants: 10,
                minParticipants: 2,
            },
            clinical_consultation: {
                requiredRoles: ['pharmacist', 'doctor'],
                maxParticipants: 20,
                minParticipants: 2,
            },
            direct: {
                requiredRoles: [],
                maxParticipants: 2,
                minParticipants: 2,
            },
            group: {
                requiredRoles: [],
                maxParticipants: 50,
                minParticipants: 3,
            },
        },
    },
};

/**
 * Security policy enforcement functions
 */
export class SecurityPolicyEnforcer {
    private config: SecurityConfig;

    constructor(config: SecurityConfig = COMMUNICATION_SECURITY_CONFIG) {
        this.config = config;
    }

    /**
     * Check if user has permission for action
     */
    hasPermission(userRole: string, action: string): boolean {
        const roleConfig = this.config.rbac.roleHierarchy[userRole];
        if (!roleConfig) return false;

        // Super admin has all permissions
        if (roleConfig.permissions.includes('*')) return true;

        // Check direct permission
        if (roleConfig.permissions.includes(action)) return true;

        // Check inherited permissions
        if (roleConfig.inherits) {
            for (const inheritedRole of roleConfig.inherits) {
                if (this.hasPermission(inheritedRole, action)) return true;
            }
        }

        return false;
    }

    /**
     * Get rate limit for user role and action type
     */
    getRateLimit(userRole: string, actionType: keyof SecurityConfig['rateLimiting']): number {
        const limits = this.config.rateLimiting[actionType].limits;
        return limits[userRole as keyof typeof limits] || limits.default;
    }

    /**
     * Validate conversation type restrictions
     */
    validateConversationType(
        type: string,
        participants: Array<{ role: string }>
    ): { valid: boolean; reason?: string } {
        const restrictions = this.config.rbac.conversationTypeRestrictions[type];
        if (!restrictions) {
            return { valid: false, reason: 'Invalid conversation type' };
        }

        // Check participant count
        if (participants.length < restrictions.minParticipants) {
            return {
                valid: false,
                reason: `Minimum ${restrictions.minParticipants} participants required`
            };
        }

        if (participants.length > restrictions.maxParticipants) {
            return {
                valid: false,
                reason: `Maximum ${restrictions.maxParticipants} participants allowed`
            };
        }

        // Check required roles
        if (restrictions.requiredRoles.length > 0) {
            const participantRoles = participants.map(p => p.role);
            const hasRequiredRoles = restrictions.requiredRoles.every(role =>
                participantRoles.includes(role)
            );

            if (!hasRequiredRoles) {
                return {
                    valid: false,
                    reason: `Required roles: ${restrictions.requiredRoles.join(', ')}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Check if file type is allowed
     */
    isFileTypeAllowed(mimeType: string, filename: string): boolean {
        // Check MIME type
        if (!this.config.fileUpload.allowedMimeTypes.includes(mimeType)) {
            return false;
        }

        // Check dangerous extensions
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        if (this.config.fileUpload.dangerousExtensions.includes(extension)) {
            return false;
        }

        return true;
    }

    /**
     * Check if action requires audit logging
     */
    requiresAuditLogging(action: string): boolean {
        return this.config.auditLogging.sensitiveActions.includes(action) ||
            this.config.auditLogging.highRiskActions.includes(action);
    }

    /**
     * Check if action is high risk
     */
    isHighRiskAction(action: string): boolean {
        return this.config.auditLogging.highRiskActions.includes(action);
    }
}

export const securityPolicyEnforcer = new SecurityPolicyEnforcer();

export default {
    COMMUNICATION_SECURITY_CONFIG,
    SecurityPolicyEnforcer,
    securityPolicyEnforcer,
};