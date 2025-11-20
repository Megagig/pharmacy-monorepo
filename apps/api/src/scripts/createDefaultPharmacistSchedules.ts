/**
 * Create Default Pharmacist Schedules Script
 * 
 * This script creates default working schedules for all pharmacists who don't have schedules yet.
 * This will enable the appointment booking system to work immediately.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import PharmacistSchedule from '../models/PharmacistSchedule';
import User from '../models/User';
import logger from '../utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacopilot';

/**
 * Default working schedule (Monday to Friday, 9 AM to 5 PM)
 */
const createDefaultWorkingHours = () => [
  // Sunday (0) - Not working
  {
    dayOfWeek: 0,
    isWorkingDay: false,
    shifts: []
  },
  // Monday (1) - Working
  {
    dayOfWeek: 1,
    isWorkingDay: true,
    shifts: [{
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }]
  },
  // Tuesday (2) - Working
  {
    dayOfWeek: 2,
    isWorkingDay: true,
    shifts: [{
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }]
  },
  // Wednesday (3) - Working
  {
    dayOfWeek: 3,
    isWorkingDay: true,
    shifts: [{
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }]
  },
  // Thursday (4) - Working
  {
    dayOfWeek: 4,
    isWorkingDay: true,
    shifts: [{
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }]
  },
  // Friday (5) - Working
  {
    dayOfWeek: 5,
    isWorkingDay: true,
    shifts: [{
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    }]
  },
  // Saturday (6) - Not working
  {
    dayOfWeek: 6,
    isWorkingDay: false,
    shifts: []
  }
];

/**
 * Default appointment preferences
 */
const createDefaultAppointmentPreferences = () => ({
  maxAppointmentsPerDay: 16, // 8 hours with 30-minute slots
  maxConcurrentAppointments: 1,
  appointmentTypes: [
    'mtm_session',
    'chronic_disease_review',
    'new_medication_consultation',
    'vaccination',
    'health_check',
    'smoking_cessation',
    'general_followup'
  ],
  defaultDuration: 30,
  bufferBetweenAppointments: 0
});

/**
 * Main function to create default schedules
 */
async function createDefaultPharmacistSchedules() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB successfully');

    // Find all pharmacists who don't have schedules
    logger.info('Finding pharmacists without schedules...');
    
    // Get all active users (we'll be more inclusive to ensure schedules are created)
    const pharmacists = await User.find({
      status: 'active',
      isDeleted: false
    }).select('_id firstName lastName email role workplaceId');

    logger.info(`All users found:`, pharmacists.map(p => ({ 
      name: `${p.firstName} ${p.lastName}`, 
      email: p.email, 
      role: p.role 
    })));

    logger.info(`Found ${pharmacists.length} pharmacists`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const pharmacist of pharmacists) {
      try {
        // Check if pharmacist already has a schedule
        const existingSchedule = await PharmacistSchedule.findOne({
          pharmacistId: pharmacist._id,
          isActive: true
        });

        if (existingSchedule) {
          logger.debug(`Pharmacist ${pharmacist.firstName} ${pharmacist.lastName} already has a schedule`);
          skippedCount++;
          continue;
        }

        // Create default schedule
        const scheduleData = {
          workplaceId: pharmacist.workplaceId,
          pharmacistId: pharmacist._id,
          workingHours: createDefaultWorkingHours(),
          timeOff: [],
          appointmentPreferences: createDefaultAppointmentPreferences(),
          capacityStats: {
            totalSlotsAvailable: 0,
            slotsBooked: 0,
            utilizationRate: 0,
            lastCalculatedAt: new Date()
          },
          isActive: true,
          effectiveFrom: new Date(),
          createdBy: pharmacist._id, // Self-created
          isDeleted: false
        };

        await PharmacistSchedule.create(scheduleData);
        
        logger.info(`✅ Created default schedule for: ${pharmacist.firstName} ${pharmacist.lastName} (${pharmacist.email})`);
        createdCount++;

      } catch (error) {
        logger.error(`❌ Failed to create schedule for pharmacist ${pharmacist._id}:`, error);
      }
    }

    logger.info(`\n📊 Summary:`);
    logger.info(`  ✅ Created schedules: ${createdCount}`);
    logger.info(`  ⏭️  Skipped (already exists): ${skippedCount}`);
    logger.info(`  📋 Total pharmacists: ${pharmacists.length}`);

    if (createdCount > 0) {
      logger.info(`\n🎉 Default schedules created successfully!`);
      logger.info(`📅 Default working hours: Monday-Friday, 9:00 AM - 5:00 PM (with 12:00-1:00 PM break)`);
      logger.info(`⚙️  Default settings: 30-minute appointments, all appointment types enabled`);
      logger.info(`\n💡 Pharmacists can now customize their schedules through the Schedule Management UI.`);
    } else {
      logger.info(`\n✨ All pharmacists already have schedules configured.`);
    }

  } catch (error) {
    logger.error('❌ Error creating default pharmacist schedules:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
    process.exit(0);
  }
}

// Run the script
createDefaultPharmacistSchedules();