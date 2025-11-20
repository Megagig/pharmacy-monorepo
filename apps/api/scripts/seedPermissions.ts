import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../src/models/Permission';
import User from '../src/models/User';
import logger from '../src/utils/logger';

dotenv.config();

/**
 * Comprehensive Permission Definitions
 * Format: resource:action:scope
 * Scope: own (user's own resources) | all (all resources) | assigned (assigned to user)
 */
const permissions = [
    // ==================== DASHBOARD ====================
    {
        action: 'dashboard:view',
        displayName: 'View Dashboard',
        description: 'Can view the main dashboard',
        category: 'system',
        riskLevel: 'low',
        isSystemPermission: true,
    },

    // ==================== PATIENT MANAGEMENT ====================
    {
        action: 'patients:view:all',
        displayName: 'View All Patients',
        description: 'Can view all patients in the workspace',
        category: 'patient',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'patients:view:own',
        displayName: 'View Own Patients',
        description: 'Can only view patients assigned to them',
        category: 'patient',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'patients:create',
        displayName: 'Create Patients',
        description: 'Can create new patient records',
        category: 'patient',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patients:edit:all',
        displayName: 'Edit All Patients',
        description: 'Can edit all patient records',
        category: 'patient',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patients:edit:own',
        displayName: 'Edit Own Patients',
        description: 'Can only edit patients assigned to them',
        category: 'patient',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patients:delete',
        displayName: 'Delete Patients',
        description: 'Can delete patient records',
        category: 'patient',
        riskLevel: 'critical',
        isSystemPermission: true,
    },

    // ==================== PATIENT ENGAGEMENT ====================
    {
        action: 'patient_engagement:view:all',
        displayName: 'View All Patient Engagements',
        description: 'Can view all patient engagement records',
        category: 'patient',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'patient_engagement:view:own',
        displayName: 'View Own Patient Engagements',
        description: 'Can only view their own patient engagements',
        category: 'patient',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'patient_engagement:create',
        displayName: 'Create Patient Engagements',
        description: 'Can create patient engagement records',
        category: 'patient',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patient_engagement:edit',
        displayName: 'Edit Patient Engagements',
        description: 'Can edit patient engagement records',
        category: 'patient',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patient_engagement:delete',
        displayName: 'Delete Patient Engagements',
        description: 'Can delete patient engagement records',
        category: 'patient',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== APPOINTMENTS ====================
    {
        action: 'appointments:view:all',
        displayName: 'View All Appointments',
        description: 'Can view all appointments in the workspace',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'appointments:view:own',
        displayName: 'View Own Appointments',
        description: 'Can only view appointments assigned to them',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'appointments:schedule',
        displayName: 'Schedule Appointments',
        description: 'Can schedule new appointments',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'appointments:cancel',
        displayName: 'Cancel Appointments',
        description: 'Can cancel appointments',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'appointments:reschedule',
        displayName: 'Reschedule Appointments',
        description: 'Can reschedule appointments',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },

    // ==================== PATIENT PORTAL ADMINISTRATION ====================
    {
        action: 'patient_portal:approve_users',
        displayName: 'Approve Patient Portal Users',
        description: 'Can approve patient portal user registrations',
        category: 'administration',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'patient_portal:suspend_users',
        displayName: 'Suspend Patient Portal Users',
        description: 'Can suspend patient portal users',
        category: 'administration',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'patient_portal:remove_users',
        displayName: 'Remove Patient Portal Users',
        description: 'Can remove patient portal users',
        category: 'administration',
        riskLevel: 'critical',
        isSystemPermission: true,
    },
    {
        action: 'patient_portal:refill_requests',
        displayName: 'Manage Refill Requests',
        description: 'Can manage patient refill requests',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'patient_portal:analytics',
        displayName: 'View Patient Portal Analytics',
        description: 'Can view patient portal analytics',
        category: 'analytics',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'patient_portal:settings',
        displayName: 'Manage Patient Portal Settings',
        description: 'Can manage patient portal settings',
        category: 'administration',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== APPOINTMENT ANALYTICS ====================
    {
        action: 'appointment_analytics:view',
        displayName: 'View Appointment Analytics',
        description: 'Can view appointment analytics and reports',
        category: 'analytics',
        riskLevel: 'low',
        isSystemPermission: true,
    },

    // ==================== SCHEDULE MANAGEMENT ====================
    {
        action: 'schedules:view',
        displayName: 'View Schedules',
        description: 'Can view staff schedules',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'schedules:create',
        displayName: 'Create Schedules',
        description: 'Can create staff schedules',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'schedules:edit',
        displayName: 'Edit Schedules',
        description: 'Can edit staff schedules',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'schedules:delete',
        displayName: 'Delete Schedules',
        description: 'Can delete staff schedules',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== CLINICAL DECISION SUPPORT ====================
    {
        action: 'clinical_decision:view',
        displayName: 'View Clinical Decision Support',
        description: 'Can view clinical decision support tools',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'clinical_decision:create',
        displayName: 'Create Clinical Decisions',
        description: 'Can create clinical decision records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_decision:edit',
        displayName: 'Edit Clinical Decisions',
        description: 'Can edit clinical decision records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_decision:delete',
        displayName: 'Delete Clinical Decisions',
        description: 'Can delete clinical decision records',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== DRUG INFORMATION CENTER ====================
    {
        action: 'drug_information:view',
        displayName: 'View Drug Information',
        description: 'Can access drug information database',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },

    // ==================== COMMUNICATION HUB ====================
    {
        action: 'communication:view',
        displayName: 'View Communications',
        description: 'Can view communication messages',
        category: 'communication',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'communication:create',
        displayName: 'Create Communications',
        description: 'Can create and send messages',
        category: 'communication',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'communication:edit',
        displayName: 'Edit Communications',
        description: 'Can edit messages',
        category: 'communication',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'communication:delete',
        displayName: 'Delete Communications',
        description: 'Can delete messages',
        category: 'communication',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== LAB INTEGRATIONS ====================
    {
        action: 'lab_integrations:view',
        displayName: 'View Lab Integrations',
        description: 'Can view lab integration settings',
        category: 'integration',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'lab_integrations:create',
        displayName: 'Create Lab Integrations',
        description: 'Can create lab integrations',
        category: 'integration',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'lab_integrations:edit',
        displayName: 'Edit Lab Integrations',
        description: 'Can edit lab integration settings',
        category: 'integration',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'lab_integrations:delete',
        displayName: 'Delete Lab Integrations',
        description: 'Can delete lab integrations',
        category: 'integration',
        riskLevel: 'critical',
        isSystemPermission: true,
    },

    // ==================== LAB FINDINGS ====================
    {
        action: 'lab_findings:view:all',
        displayName: 'View All Lab Findings',
        description: 'Can view all lab findings',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'lab_findings:view:own',
        displayName: 'View Own Lab Findings',
        description: 'Can only view lab findings for assigned patients',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'lab_findings:create',
        displayName: 'Create Lab Findings',
        description: 'Can create lab finding records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'lab_findings:edit',
        displayName: 'Edit Lab Findings',
        description: 'Can edit lab finding records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'lab_findings:delete',
        displayName: 'Delete Lab Findings',
        description: 'Can delete lab finding records',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== AI DIAGNOSTICS & THERAPEUTICS ====================
    {
        action: 'ai_diagnostics:view',
        displayName: 'View AI Diagnostics',
        description: 'Can view AI diagnostic results',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'ai_diagnostics:create',
        displayName: 'Create AI Diagnostics',
        description: 'Can run AI diagnostic analyses',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'ai_diagnostics:edit',
        displayName: 'Edit AI Diagnostics',
        description: 'Can edit AI diagnostic records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'ai_diagnostics:delete',
        displayName: 'Delete AI Diagnostics',
        description: 'Can delete AI diagnostic records',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== CLINICAL INTERVENTIONS ====================
    {
        action: 'clinical_interventions:view:all',
        displayName: 'View All Clinical Interventions',
        description: 'Can view all clinical interventions',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'clinical_interventions:view:own',
        displayName: 'View Own Clinical Interventions',
        description: 'Can only view their own clinical interventions',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'clinical_interventions:create',
        displayName: 'Create Clinical Interventions',
        description: 'Can create clinical intervention records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_interventions:edit',
        displayName: 'Edit Clinical Interventions',
        description: 'Can edit clinical intervention records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_interventions:delete',
        displayName: 'Delete Clinical Interventions',
        description: 'Can delete clinical intervention records',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== MEDICATION THERAPY REVIEW ====================
    {
        action: 'mtr:view:all',
        displayName: 'View All MTRs',
        description: 'Can view all medication therapy reviews',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'mtr:view:own',
        displayName: 'View Own MTRs',
        description: 'Can only view their own MTRs',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'mtr:create',
        displayName: 'Create MTRs',
        description: 'Can create medication therapy reviews',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'mtr:edit',
        displayName: 'Edit MTRs',
        description: 'Can edit medication therapy reviews',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'mtr:delete',
        displayName: 'Delete MTRs',
        description: 'Can delete medication therapy reviews',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== MEDICATIONS ====================
    {
        action: 'medications:view',
        displayName: 'View Medications',
        description: 'Can view medication records',
        category: 'medication',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'medications:create',
        displayName: 'Create Medications',
        description: 'Can create medication records',
        category: 'medication',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'medications:edit',
        displayName: 'Edit Medications',
        description: 'Can edit medication records',
        category: 'medication',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'medications:delete',
        displayName: 'Delete Medications',
        description: 'Can delete medication records',
        category: 'medication',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== CLINICAL NOTES ====================
    {
        action: 'clinical_notes:view:all',
        displayName: 'View All Clinical Notes',
        description: 'Can view all clinical notes',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'clinical_notes:view:own',
        displayName: 'View Own Clinical Notes',
        description: 'Can only view their own clinical notes',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'clinical_notes:create',
        displayName: 'Create Clinical Notes',
        description: 'Can create clinical notes',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_notes:edit',
        displayName: 'Edit Clinical Notes',
        description: 'Can edit clinical notes',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'clinical_notes:delete',
        displayName: 'Delete Clinical Notes',
        description: 'Can delete clinical notes',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== FOLLOW-UP MANAGEMENT ====================
    {
        action: 'followups:view:all',
        displayName: 'View All Follow-ups',
        description: 'Can view all follow-up records',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'followups:view:own',
        displayName: 'View Own Follow-ups',
        description: 'Can only view their own follow-ups',
        category: 'clinical',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'followups:create',
        displayName: 'Create Follow-ups',
        description: 'Can create follow-up records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'followups:edit',
        displayName: 'Edit Follow-ups',
        description: 'Can edit follow-up records',
        category: 'clinical',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'followups:delete',
        displayName: 'Delete Follow-ups',
        description: 'Can delete follow-up records',
        category: 'clinical',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== PRESCRIPTIONS ====================
    {
        action: 'prescriptions:view:all',
        displayName: 'View All Prescriptions',
        description: 'Can view all prescriptions',
        category: 'medication',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'prescriptions:view:own',
        displayName: 'View Own Prescriptions',
        description: 'Can only view prescriptions they created',
        category: 'medication',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'prescriptions:create',
        displayName: 'Create Prescriptions',
        description: 'Can create new prescriptions',
        category: 'medication',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'prescriptions:approve',
        displayName: 'Approve Prescriptions',
        description: 'Can approve prescriptions',
        category: 'medication',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'prescriptions:dispense',
        displayName: 'Dispense Prescriptions',
        description: 'Can dispense prescriptions',
        category: 'medication',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== FINANCIAL/BILLING ====================
    {
        action: 'billing:view_reports',
        displayName: 'View Billing Reports',
        description: 'Can view billing and financial reports',
        category: 'billing',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'billing:process_payments',
        displayName: 'Process Payments',
        description: 'Can process patient payments',
        category: 'billing',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== ANALYTICS ====================
    {
        action: 'analytics:view_dashboards',
        displayName: 'View Analytics Dashboards',
        description: 'Can view analytics dashboards',
        category: 'analytics',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'analytics:export_reports',
        displayName: 'Export Reports',
        description: 'Can export analytics reports',
        category: 'analytics',
        riskLevel: 'medium',
        isSystemPermission: true,
    },

    // ==================== TEAM MANAGEMENT ====================
    {
        action: 'team:invite_members',
        displayName: 'Invite Team Members',
        description: 'Can invite new team members',
        category: 'user_management',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'team:remove_members',
        displayName: 'Remove Team Members',
        description: 'Can remove team members',
        category: 'user_management',
        riskLevel: 'critical',
        isSystemPermission: true,
    },
    {
        action: 'team:view_members',
        displayName: 'View Team Members',
        description: 'Can view team member list',
        category: 'user_management',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'team:manage_roles',
        displayName: 'Manage Team Roles',
        description: 'Can assign and modify team member roles',
        category: 'user_management',
        riskLevel: 'critical',
        isSystemPermission: true,
    },

    // ==================== WORKSPACE SETTINGS ====================
    {
        action: 'workspace:view_settings',
        displayName: 'View Workspace Settings',
        description: 'Can view workspace settings',
        category: 'workspace',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'workspace:edit_settings',
        displayName: 'Edit Workspace Settings',
        description: 'Can edit workspace settings',
        category: 'workspace',
        riskLevel: 'high',
        isSystemPermission: true,
    },
    {
        action: 'workspace:delete',
        displayName: 'Delete Workspace',
        description: 'Can delete the entire workspace',
        category: 'workspace',
        riskLevel: 'critical',
        isSystemPermission: true,
    },
    {
        action: 'workspace:manage_integrations',
        displayName: 'Manage Integrations',
        description: 'Can manage workspace integrations',
        category: 'workspace',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== MEDICATION ANALYTICS ====================
    {
        action: 'medication_analytics:view',
        displayName: 'View Medication Analytics',
        description: 'Can view medication analytics and reports',
        category: 'analytics',
        riskLevel: 'low',
        isSystemPermission: true,
    },

    // ==================== REPORTS & ANALYTICS ====================
    {
        action: 'reports:view',
        displayName: 'View Reports',
        description: 'Can view system reports',
        category: 'reports',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'reports:create',
        displayName: 'Create Reports',
        description: 'Can create custom reports',
        category: 'reports',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'reports:edit',
        displayName: 'Edit Reports',
        description: 'Can edit existing reports',
        category: 'reports',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'reports:delete',
        displayName: 'Delete Reports',
        description: 'Can delete reports',
        category: 'reports',
        riskLevel: 'high',
        isSystemPermission: true,
    },

    // ==================== INVENTORY MANAGEMENT ====================
    {
        action: 'inventory:view',
        displayName: 'View Inventory',
        description: 'Can view inventory levels',
        category: 'inventory',
        riskLevel: 'low',
        isSystemPermission: true,
    },
    {
        action: 'inventory:add_stock',
        displayName: 'Add Stock',
        description: 'Can add inventory items',
        category: 'inventory',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'inventory:update_stock',
        displayName: 'Update Stock',
        description: 'Can update inventory quantities',
        category: 'inventory',
        riskLevel: 'medium',
        isSystemPermission: true,
    },
    {
        action: 'inventory:delete_stock',
        displayName: 'Delete Stock',
        description: 'Can delete inventory items',
        category: 'inventory',
        riskLevel: 'high',
        isSystemPermission: true,
    },
];

async function seedPermissions() {
    try {
        console.log('🌱 Starting permission seeding...\n');

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get a system admin user to use as creator (optional)
        const systemAdmin = await User.findOne({ role: 'super_admin' });
        const creatorId = systemAdmin?._id || undefined;

        console.log(`📝 Seeding ${permissions.length} permissions...\n`);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const permData of permissions) {
            const existing = await Permission.findOne({ action: permData.action });

            if (existing) {
                // Update existing permission
                await Permission.findByIdAndUpdate(existing._id, {
                    ...permData,
                    ...(creatorId && { lastModifiedBy: creatorId }),
                });
                updated++;
                console.log(`  ↻ Updated: ${permData.action}`);
            } else {
                // Create new permission
                await Permission.create({
                    ...permData,
                    ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
                });
                created++;
                console.log(`  ✓ Created: ${permData.action}`);
            }
        }

        console.log('\n✅ Permission seeding completed!');
        console.log(`   Created: ${created}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Total: ${permissions.length}\n`);

        // Display category breakdown
        const categories = [...new Set(permissions.map(p => p.category))];
        console.log('📊 Permissions by category:');
        for (const category of categories) {
            const count = permissions.filter(p => p.category === category).length;
            console.log(`   ${category}: ${count}`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding permissions:', error);
        process.exit(1);
    }
}

seedPermissions();
