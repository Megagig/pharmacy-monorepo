import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import User from '../src/models/User';
import Workplace from '../src/models/Workplace';
import logger from '../src/utils/logger';

dotenv.config();

/**
 * Default Role Definitions with Hierarchy
 * Hierarchy: OWNER > ADMIN > MANAGER > PHARMACIST > STAFF
 */

// Helper function to get permission actions by pattern
async function getPermissionsByPattern(patterns: string[]): Promise<string[]> {
    const permissions = await Permission.find({ isActive: true }).lean();
    const matchedPermissions: string[] = [];

    for (const permission of permissions) {
        for (const pattern of patterns) {
            if (permission.action.includes(pattern)) {
                matchedPermissions.push(permission.action);
                break;
            }
        }
    }

    return matchedPermissions;
}

// Get all permissions
async function getAllPermissions(): Promise<string[]> {
    const permissions = await Permission.find({ isActive: true }).lean();
    return permissions.map(p => p.action);
}

async function seedRoles() {
    try {
        console.log('🌱 Starting role seeding...\n');

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ Connected to MongoDB\n');

        // Get a system admin user to use as creator (optional)
        console.log('Looking for system admin...');
        const systemAdmin = await User.findOne({ role: 'super_admin' });
        const creatorId = systemAdmin?._id || undefined;
        console.log(`System admin found: ${systemAdmin ? 'Yes' : 'No'}\n`);

        console.log('📝 Creating default workspace roles...\n');

        // ==================== OWNER ROLE ====================
        console.log('  Creating OWNER role...');
        const allPermissions = await getAllPermissions();

        const ownerRole = await Role.findOneAndUpdate(
            { name: 'owner' },
            {
                name: 'owner',
                displayName: 'Owner',
                description: 'Full access to all workspace features and settings. Can manage everything including workspace deletion.',
                category: 'workplace',
                permissions: allPermissions,
                hierarchyLevel: 0,
                isActive: true,
                isSystemRole: true,
                isDefault: false,
                ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
            },
            { upsert: true, new: true }
        );
        console.log('  ✓ OWNER role created/updated');

        // ==================== ADMIN ROLE ====================
        console.log('  Creating ADMIN role...');
        const adminPermissions = allPermissions.filter(
            p => !p.includes('workspace:delete') // Admins can't delete workspace
        );

        const adminRole = await Role.findOneAndUpdate(
            { name: 'admin' },
            {
                name: 'admin',
                displayName: 'Administrator',
                description: 'Administrative access to most features. Cannot delete workspace or change ownership.',
                category: 'workplace',
                parentRole: ownerRole._id,
                permissions: adminPermissions,
                hierarchyLevel: 1,
                isActive: true,
                isSystemRole: true,
                isDefault: false,
                ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
            },
            { upsert: true, new: true }
        );
        console.log('  ✓ ADMIN role created/updated');

        // ==================== MANAGER ROLE ====================
        console.log('  Creating MANAGER role...');
        const managerPatterns = [
            'dashboard:view',
            'patients:view',
            'patients:create',
            'patients:edit',
            'patient_engagement:view',
            'patient_engagement:create',
            'patient_engagement:edit',
            'appointments:view',
            'appointments:schedule',
            'appointments:cancel',
            'appointments:reschedule',
            'appointment_analytics:view',
            'schedules:view',
            'schedules:create',
            'schedules:edit',
            'prescriptions:view',
            'analytics:view',
            'medication_analytics:view',
            'reports:view',
            'reports:create',
            'team:view_members',
            'followups:view',
            'followups:create',
            'followups:edit',
        ];
        const managerPermissions = await getPermissionsByPattern(managerPatterns);

        const managerRole = await Role.findOneAndUpdate(
            { name: 'manager' },
            {
                name: 'manager',
                displayName: 'Manager',
                description: 'Can manage patients, appointments, schedules, and view analytics. Limited administrative capabilities.',
                category: 'workplace',
                parentRole: adminRole._id,
                permissions: managerPermissions,
                hierarchyLevel: 2,
                isActive: true,
                isSystemRole: true,
                isDefault: false,
                ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
            },
            { upsert: true, new: true }
        );
        console.log('  ✓ MANAGER role created/updated');

        // ==================== PHARMACIST ROLE ====================
        console.log('  Creating PHARMACIST role...');
        const pharmacistPatterns = [
            'dashboard:view',
            'patients:view',
            'patients:edit',
            'patient_engagement:view',
            'patient_engagement:create',
            'patient_engagement:edit',
            'appointments:view',
            'patient_portal',
            'clinical_decision',
            'drug_information:view',
            'communication:view',
            'communication:create',
            'lab_integrations:view',
            'lab_findings',
            'ai_diagnostics',
            'clinical_interventions',
            'clinical_notes',
            'mtr',
            'medications',
            'prescriptions',
            'followups:view',
            'followups:create',
            'followups:edit',
            'medication_analytics:view',
            'reports:view',
        ];
        const pharmacistPermissions = await getPermissionsByPattern(pharmacistPatterns);

        const pharmacistRole = await Role.findOneAndUpdate(
            { name: 'pharmacist' },
            {
                name: 'pharmacist',
                displayName: 'Pharmacist',
                description: 'Clinical access for patient care, medications, prescriptions, MTR, clinical interventions, and patient portal management.',
                category: 'workplace',
                parentRole: managerRole._id,
                permissions: pharmacistPermissions,
                hierarchyLevel: 3,
                isActive: true,
                isSystemRole: true,
                isDefault: false,
                ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
            },
            { upsert: true, new: true }
        );
        console.log('  ✓ PHARMACIST role created/updated');

        // ==================== STAFF ROLE ====================
        console.log('  Creating STAFF role...');
        const staffPatterns = [
            'dashboard:view',
            'patients:view:own',
            'patients:view:all', // Can view all patients
            'appointments:view',
            'appointments:schedule',
            'communication:view',
            'communication:create',
            'drug_information:view',
            'inventory:view',
            'followups:view',
            'reports:view',
        ];
        const staffPermissions = await getPermissionsByPattern(staffPatterns);

        const staffRole = await Role.findOneAndUpdate(
            { name: 'staff' },
            {
                name: 'staff',
                displayName: 'Staff',
                description: 'Basic operational access for front desk and support staff. Can view patients, schedule appointments, and access basic features.',
                category: 'workplace',
                parentRole: pharmacistRole._id,
                permissions: staffPermissions,
                hierarchyLevel: 4,
                isActive: true,
                isSystemRole: true,
                isDefault: true, // Default role for new team members
                ...(creatorId && { createdBy: creatorId, lastModifiedBy: creatorId }),
            },
            { upsert: true, new: true }
        );
        console.log('  ✓ STAFF role created/updated');

        // Update parent roles' childRoles arrays
        await Role.findByIdAndUpdate(ownerRole._id, {
            $addToSet: { childRoles: adminRole._id },
        });
        await Role.findByIdAndUpdate(adminRole._id, {
            $addToSet: { childRoles: managerRole._id },
        });
        await Role.findByIdAndUpdate(managerRole._id, {
            $addToSet: { childRoles: pharmacistRole._id },
        });
        await Role.findByIdAndUpdate(pharmacistRole._id, {
            $addToSet: { childRoles: staffRole._id },
        });

        console.log('\n✅ Role seeding completed!');
        console.log('\n📊 Role hierarchy:');
        console.log('   OWNER (Level 0) - All permissions');
        console.log('   └─ ADMIN (Level 1) - All except workspace deletion');
        console.log('      └─ MANAGER (Level 2) - Patient, appointments, analytics management');
        console.log('         └─ PHARMACIST (Level 3) - Clinical, medications, prescriptions');
        console.log('            └─ STAFF (Level 4) - Basic operations [DEFAULT]\n');

        console.log('📝 Permission counts:');
        console.log(`   OWNER: ${allPermissions.length} permissions`);
        console.log(`   ADMIN: ${adminPermissions.length} permissions`);
        console.log(`   MANAGER: ${managerPermissions.length} permissions`);
        console.log(`   PHARMACIST: ${pharmacistPermissions.length} permissions`);
        console.log(`   STAFF: ${staffPermissions.length} permissions\n`);

        // Optional: Apply roles to existing workspaces
        console.log('🔄 Checking existing workspaces...');
        const workspaces = await Workplace.find({}).lean();
        console.log(`   Found ${workspaces.length} workspaces\n`);

        if (workspaces.length > 0) {
            console.log('💡 To apply roles to workspace owners, run:');
            console.log('   npm run seed:workspace-roles\n');
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding roles:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seedRoles();
