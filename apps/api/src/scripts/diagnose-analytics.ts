import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Appointment from '../models/Appointment';
import User from '../models/User';
import Role from '../models/Role';
import { subDays } from 'date-fns';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function diagnoseAnalytics() {
  try {
    console.log('🔍 Starting Analytics Diagnostics...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pharma-care';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // 1. Check for appointments
    console.log('📊 Checking Appointments...');
    const totalAppointments = await Appointment.countDocuments();
    console.log(`   Total Appointments: ${totalAppointments}`);

    if (totalAppointments > 0) {
      const last30Days = await Appointment.countDocuments({
        scheduledDate: { $gte: subDays(new Date(), 30) }
      });
      console.log(`   Appointments (Last 30 days): ${last30Days}`);

      const byStatus = await Appointment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      console.log('   By Status:', byStatus);

      const byWorkplace = await Appointment.aggregate([
        {
          $group: {
            _id: '$workplaceId',
            count: { $sum: 1 }
          }
        },
        { $limit: 5 }
      ]);
      console.log('   By Workplace (top 5):', byWorkplace);
    } else {
      console.log('   ⚠️  WARNING: No appointments found in the database!');
    }

    // 2. Check for users and their roles
    console.log('\n👥 Checking Users and Roles...');
    const totalUsers = await User.countDocuments();
    console.log(`   Total Users: ${totalUsers}`);

    if (totalUsers > 0) {
      const usersWithRoles = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);
      console.log('   Users by Role:', usersWithRoles);

      // Check a sample user's permissions
      const sampleUser = await User.findOne({ role: { $ne: 'patient' } });
      if (sampleUser) {
        console.log(`\n   Sample User: ${sampleUser.email}`);
        console.log(`   Role: ${sampleUser.role}`);
      }
    }

    // 3. Check roles and permissions
    console.log('\n🔐 Checking Roles and Permissions...');
    const roles = await Role.find().select('name permissions');
    for (const role of roles) {
      const analyticsPerms = role.permissions.filter(p => 
        p.includes('analytics') || p === 'view_appointments'
      );
      if (analyticsPerms.length > 0) {
        console.log(`   ${role.name}:`, analyticsPerms);
      }
    }

    // 4. Check if view_appointment_analytics permission exists
    console.log('\n🔍 Checking for specific analytics permissions...');
    const rolesWithAnalytics = await Role.find({
      permissions: { $in: ['view_appointment_analytics', 'view_analytics'] }
    }).select('name permissions');
    
    if (rolesWithAnalytics.length > 0) {
      console.log('   ✅ Roles with analytics permissions:');
      rolesWithAnalytics.forEach(role => {
        console.log(`      - ${role.name}`);
      });
    } else {
      console.log('   ⚠️  WARNING: No roles have view_appointment_analytics or view_analytics permission!');
    }

    // 5. Recommendations
    console.log('\n📝 Recommendations:');
    if (totalAppointments === 0) {
      console.log('   1. Create sample appointments for testing');
      console.log('   2. Use the seed script or create appointments via the UI');
    }
    if (rolesWithAnalytics.length === 0) {
      console.log('   1. Add "view_appointment_analytics" permission to appropriate roles');
      console.log('   2. Add "view_analytics" permission as a fallback');
    }

    console.log('\n✅ Diagnostics Complete!\n');

  } catch (error) {
    console.error('❌ Error during diagnostics:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run diagnostics
diagnoseAnalytics().then(() => process.exit(0));
