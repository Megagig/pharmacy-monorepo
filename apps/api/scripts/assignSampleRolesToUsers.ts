import connectDB from '../src/config/db';
import User from '../src/models/User';
import Role from '../src/models/Role';
import UserRole from '../src/models/UserRole';
import dotenv from 'dotenv';

dotenv.config();

async function assignSampleRolesToUsers() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    // Get all roles
    const roles = await Role.find({});
    console.log(`Found ${roles.length} roles`);

    if (roles.length === 0) {
      console.log('No roles found. Please create roles first.');
      return;
    }

    // Assign roles to users
    for (const user of users) {
      // Skip if user already has roles
      const existingUserRoles = await UserRole.find({ userId: user._id, isActive: true });
      if (existingUserRoles.length > 0) {
        console.log(`User ${user.email} already has roles assigned`);
        continue;
      }

      // Assign roles based on system role
      let rolesToAssign = [];
      switch (user.role) {
        case 'super_admin':
          // Super admin gets all roles
          rolesToAssign = roles.map(r => r._id);
          break;
        case 'pharmacy_outlet':
          // Owner gets manager role
          const managerRole = roles.find(r => r.name === 'pharmacy_manager');
          if (managerRole) rolesToAssign = [managerRole._id];
          break;
        case 'pharmacist':
          // Pharmacist gets staff pharmacist role
          const pharmacistRole = roles.find(r => r.name === 'staff_pharmacist');
          if (pharmacistRole) rolesToAssign = [pharmacistRole._id];
          break;
        default:
          // Default users get technician role
          const technicianRole = roles.find(r => r.name === 'pharmacy_technician');
          if (technicianRole) rolesToAssign = [technicianRole._id];
      }

      if (rolesToAssign.length > 0) {
        // Create UserRole assignments
        const userRoleAssignments = rolesToAssign.map(roleId => ({
          userId: user._id,
          roleId: roleId,
          assignedBy: user._id, // Self-assigned for testing
          isActive: true,
          isTemporary: false,
          lastModifiedBy: user._id
        }));

        await UserRole.insertMany(userRoleAssignments);

        // Update user's assignedRoles array
        await User.findByIdAndUpdate(user._id, {
          $set: { assignedRoles: rolesToAssign },
          $set: { roleLastModifiedBy: user._id },
          $set: { roleLastModifiedAt: new Date() }
        });

        console.log(`Assigned ${rolesToAssign.length} roles to user ${user.email}`);
      }
    }

    console.log('✅ Role assignment completed');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

assignSampleRolesToUsers();
