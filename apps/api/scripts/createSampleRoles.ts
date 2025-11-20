import connectDB from '../src/config/db';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import dotenv from 'dotenv';

dotenv.config();

async function createSampleRoles() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Check if permissions exist
    const existingPermissions = await Permission.find({});
    console.log(`Found ${existingPermissions.length} existing permissions`);

    // Create sample permissions if none exist
    if (existingPermissions.length === 0) {
      console.log('Creating sample permissions...');
      const permissions = await Permission.insertMany([
        {
          action: 'user_management:read',
          displayName: 'Read Users',
          description: 'Can read user_management information',
          category: 'user_management',
          riskLevel: 'low' as const,
          isActive: true,
          isSystemPermission: true,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        },
        {
          action: 'user_management:manage',
          displayName: 'Manage Users',
          description: 'Can manage user_management accounts',
          category: 'user_management',
          riskLevel: 'medium' as const,
          isActive: true,
          isSystemPermission: true,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        },
        {
          action: 'administration:read',
          displayName: 'Read Patients',
          description: 'Can read administration information',
          category: 'administration',
          riskLevel: 'low' as const,
          isActive: true,
          isSystemPermission: true,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        },
        {
          action: 'administration:manage',
          displayName: 'Manage Patients',
          description: 'Can manage administration records',
          category: 'administration',
          riskLevel: 'medium' as const,
          isActive: true,
          isSystemPermission: true,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        }
      ]);
      console.log(`Created ${permissions.length} permissions`);
    }

    // Check if roles exist
    const existingRoles = await Role.find({});
    console.log(`Found ${existingRoles.length} existing roles`);

    if (existingRoles.length === 0) {
      console.log('Creating sample roles...');
      const permissions = await Permission.find({ action: { $in: ['user_management:read', 'user_management:manage', 'administration:read', 'administration:manage'] } });

      const roles = await Role.insertMany([
        {
          name: 'pharmacy_manager',
          displayName: 'Pharmacy Manager',
          description: 'Manages pharmacy operations and staff',
          category: 'workplace' as const,
          hierarchyLevel: 0,
          permissions: ['user_management:read', 'user_management:manage', 'administration:read'],
          isActive: true,
          isSystemRole: false,
          isDefault: false,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        },
        {
          name: 'staff_pharmacist',
          displayName: 'Staff Pharmacist',
          description: 'Handles administration care and medication management',
          category: 'workplace' as const,
          hierarchyLevel: 1,
          permissions: ['administration:read', 'administration:manage'],
          isActive: true,
          isSystemRole: false,
          isDefault: false,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        },
        {
          name: 'pharmacy_technician',
          displayName: 'Pharmacy Technician',
          description: 'Assists with pharmacy operations',
          category: 'workplace' as const,
          hierarchyLevel: 2,
          permissions: ['administration:read'],
          isActive: true,
          isSystemRole: false,
          isDefault: false,
          createdBy: new (require('mongoose')).Types.ObjectId(),
          lastModifiedBy: new (require('mongoose')).Types.ObjectId()
        }
      ]);
      console.log(`Created ${roles.length} roles`);
    } else {
      console.log('Roles already exist, skipping creation');
    }

    console.log('✅ Sample data setup complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

createSampleRoles();
