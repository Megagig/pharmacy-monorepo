/**
 * Test Script for Slot Generation Service
 * Run this to verify the slot generation system is working correctly
 */

import mongoose from 'mongoose';
import { SlotGenerationService } from '../services/SlotGenerationService';
import PharmacistSchedule from '../models/PharmacistSchedule';
import User from '../models/User';
import { format, addDays } from 'date-fns';

// Test configuration
const TEST_CONFIG = {
  workplaceId: new mongoose.Types.ObjectId(),
  pharmacistId: new mongoose.Types.ObjectId(),
  testDate: new Date(),
  duration: 30,
  appointmentType: 'general_followup'
};

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function createTestPharmacist() {
  try {
    // Create test pharmacist user
    const pharmacist = await User.findOneAndUpdate(
      { _id: TEST_CONFIG.pharmacistId },
      {
        workplaceId: TEST_CONFIG.workplaceId,
        firstName: 'Test',
        lastName: 'Pharmacist',
        email: 'test.pharmacist@example.com',
        role: 'pharmacist',
        isActive: true,
        isDeleted: false
      },
      { upsert: true, new: true }
    );

    console.log('✅ Created/Updated test pharmacist:', pharmacist.firstName, pharmacist.lastName);
    return pharmacist;
  } catch (error) {
    console.error('❌ Failed to create test pharmacist:', error);
    throw error;
  }
}

async function createTestSchedule() {
  try {
    // Create test schedule
    const schedule = await PharmacistSchedule.findOneAndUpdate(
      { 
        workplaceId: TEST_CONFIG.workplaceId,
        pharmacistId: TEST_CONFIG.pharmacistId 
      },
      {
        workplaceId: TEST_CONFIG.workplaceId,
        pharmacistId: TEST_CONFIG.pharmacistId,
        workingHours: [
          // Monday to Friday
          ...Array.from({ length: 5 }, (_, i) => ({
            dayOfWeek: i + 1, // 1 = Monday, 5 = Friday
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00'
              }
            ]
          })),
          // Saturday
          {
            dayOfWeek: 6,
            isWorkingDay: true,
            shifts: [
              {
                startTime: '09:00',
                endTime: '14:00'
              }
            ]
          },
          // Sunday
          {
            dayOfWeek: 0,
            isWorkingDay: false,
            shifts: []
          }
        ],
        timeOff: [],
        appointmentPreferences: {
          maxAppointmentsPerDay: 16,
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
          bufferBetweenAppointments: 5
        },
        capacityStats: {
          totalSlotsAvailable: 0,
          slotsBooked: 0,
          utilizationRate: 0,
          lastCalculatedAt: new Date()
        },
        isActive: true,
        effectiveFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        createdBy: TEST_CONFIG.pharmacistId,
        isDeleted: false
      },
      { upsert: true, new: true }
    );

    console.log('✅ Created/Updated test schedule for pharmacist');
    return schedule;
  } catch (error) {
    console.error('❌ Failed to create test schedule:', error);
    throw error;
  }
}

async function testSlotGeneration() {
  console.log('\n🧪 Testing Slot Generation...\n');

  try {
    // Test 1: Generate slots for today
    console.log('📅 Test 1: Generate slots for today');
    const todayResult = await SlotGenerationService.generateAvailableSlots({
      date: TEST_CONFIG.testDate,
      pharmacistId: TEST_CONFIG.pharmacistId,
      duration: TEST_CONFIG.duration,
      appointmentType: TEST_CONFIG.appointmentType,
      workplaceId: TEST_CONFIG.workplaceId
    });

    console.log(`   Total slots: ${todayResult.summary.totalSlots}`);
    console.log(`   Available slots: ${todayResult.summary.availableSlots}`);
    console.log(`   Utilization rate: ${todayResult.summary.utilizationRate}%`);
    console.log(`   Pharmacists found: ${todayResult.pharmacists.length}`);

    if (todayResult.slots.length > 0) {
      console.log(`   First slot: ${todayResult.slots[0].time} (${todayResult.slots[0].available ? 'Available' : 'Unavailable'})`);
      console.log(`   Last slot: ${todayResult.slots[todayResult.slots.length - 1].time}`);
    }

    // Test 2: Generate slots for tomorrow
    console.log('\n📅 Test 2: Generate slots for tomorrow');
    const tomorrow = addDays(TEST_CONFIG.testDate, 1);
    const tomorrowResult = await SlotGenerationService.generateAvailableSlots({
      date: tomorrow,
      pharmacistId: TEST_CONFIG.pharmacistId,
      duration: TEST_CONFIG.duration,
      workplaceId: TEST_CONFIG.workplaceId
    });

    console.log(`   Total slots: ${tomorrowResult.summary.totalSlots}`);
    console.log(`   Available slots: ${tomorrowResult.summary.availableSlots}`);

    // Test 3: Test slot validation
    console.log('\n🔍 Test 3: Test slot validation');
    if (todayResult.slots.length > 0) {
      const firstAvailableSlot = todayResult.slots.find(s => s.available);
      if (firstAvailableSlot) {
        const validation = await SlotGenerationService.validateSlotAvailability(
          TEST_CONFIG.pharmacistId,
          TEST_CONFIG.testDate,
          firstAvailableSlot.time,
          TEST_CONFIG.duration,
          TEST_CONFIG.workplaceId,
          TEST_CONFIG.appointmentType
        );

        console.log(`   Validating slot ${firstAvailableSlot.time}: ${validation.available ? 'Available' : 'Not Available'}`);
        if (!validation.available) {
          console.log(`   Reason: ${validation.reason}`);
        }
      }
    }

    // Test 4: Find next available slot
    console.log('\n🔍 Test 4: Find next available slot');
    const nextSlot = await SlotGenerationService.getNextAvailableSlot(
      TEST_CONFIG.pharmacistId,
      TEST_CONFIG.workplaceId,
      TEST_CONFIG.duration,
      TEST_CONFIG.appointmentType,
      7 // Look 7 days ahead
    );

    if (nextSlot) {
      console.log(`   Next available: ${format(nextSlot.date, 'yyyy-MM-dd')} at ${nextSlot.time}`);
      console.log(`   Pharmacist: ${nextSlot.pharmacistName}`);
    } else {
      console.log('   No available slots found in the next 7 days');
    }

    // Test 5: Test with different appointment types
    console.log('\n🔍 Test 5: Test with different appointment types');
    const mtmResult = await SlotGenerationService.generateAvailableSlots({
      date: TEST_CONFIG.testDate,
      pharmacistId: TEST_CONFIG.pharmacistId,
      duration: 45, // MTM sessions are typically longer
      appointmentType: 'mtm_session',
      workplaceId: TEST_CONFIG.workplaceId
    });

    console.log(`   MTM Session slots: ${mtmResult.summary.availableSlots} available`);

    console.log('\n✅ All slot generation tests completed successfully!');

  } catch (error) {
    console.error('❌ Slot generation test failed:', error);
    throw error;
  }
}

async function testWithIncludeUnavailable() {
  console.log('\n🧪 Testing with includeUnavailable option...\n');

  try {
    const result = await SlotGenerationService.generateAvailableSlots({
      date: TEST_CONFIG.testDate,
      pharmacistId: TEST_CONFIG.pharmacistId,
      duration: TEST_CONFIG.duration,
      workplaceId: TEST_CONFIG.workplaceId,
      includeUnavailable: true
    });

    console.log(`   Total slots (including unavailable): ${result.slots.length}`);
    console.log(`   Available slots: ${result.summary.availableSlots}`);
    console.log(`   Unavailable slots: ${result.summary.unavailableSlots}`);

    // Show breakdown by slot type
    const breakSlots = result.slots.filter(s => s.slotType === 'break').length;
    const bufferSlots = result.slots.filter(s => s.slotType === 'buffer').length;
    const regularSlots = result.slots.filter(s => s.slotType === 'regular').length;

    console.log(`   Break slots: ${breakSlots}`);
    console.log(`   Buffer slots: ${bufferSlots}`);
    console.log(`   Regular slots: ${regularSlots}`);

  } catch (error) {
    console.error('❌ Include unavailable test failed:', error);
    throw error;
  }
}

async function cleanup() {
  try {
    // Clean up test data
    await User.deleteOne({ _id: TEST_CONFIG.pharmacistId });
    await PharmacistSchedule.deleteOne({ 
      workplaceId: TEST_CONFIG.workplaceId,
      pharmacistId: TEST_CONFIG.pharmacistId 
    });
    
    console.log('\n🧹 Cleaned up test data');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

async function main() {
  console.log('🚀 Starting Slot Generation Service Tests\n');
  console.log('Test Configuration:');
  console.log(`   Workplace ID: ${TEST_CONFIG.workplaceId}`);
  console.log(`   Pharmacist ID: ${TEST_CONFIG.pharmacistId}`);
  console.log(`   Test Date: ${format(TEST_CONFIG.testDate, 'yyyy-MM-dd')}`);
  console.log(`   Duration: ${TEST_CONFIG.duration} minutes`);
  console.log(`   Appointment Type: ${TEST_CONFIG.appointmentType}\n`);

  try {
    await connectToDatabase();
    await createTestPharmacist();
    await createTestSchedule();
    await testSlotGeneration();
    await testWithIncludeUnavailable();
    
    console.log('\n🎉 All tests passed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

export { main as runSlotGenerationTests };