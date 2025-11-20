#!/usr/bin/env ts-node

/**
 * Patient Engagement Module - Staging Data Seeder
 * 
 * This script seeds the staging database with test data for the Patient Engagement
 * & Follow-up Management module to facilitate testing and development.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { faker } from '@faker-js/faker';

// Load staging environment
config({ path: '.env.staging' });

// Import models (these would be the actual models from your application)
interface IPatient {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  appointmentPreferences?: {
    preferredDays: number[];
    preferredTimeSlots: Array<{ start: string; end: string }>;
    reminderPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    language: string;
    timezone: string;
  };
}

interface IUser {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface IWorkplace {
  _id?: mongoose.Types.ObjectId;
  name: string;
  type: string;
  isActive: boolean;
}

interface IAppointment {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  type: string;
  title: string;
  description?: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  timezone: string;
  status: string;
  confirmationStatus: string;
  isRecurring: boolean;
  metadata?: {
    source: string;
    triggerEvent?: string;
  };
}

interface IFollowUpTask {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  type: string;
  title: string;
  description: string;
  objectives: string[];
  priority: string;
  dueDate: Date;
  status: string;
  trigger: {
    type: string;
    triggerDate: Date;
    triggerDetails?: Record<string, any>;
  };
}

interface IReminderTemplate {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  category: string;
  channels: string[];
  timing: {
    unit: string;
    value: number;
    relativeTo: string;
  };
  messageTemplates: {
    email?: {
      subject: string;
      body: string;
    };
    sms?: {
      message: string;
    };
  };
  isActive: boolean;
  isDefault: boolean;
}

interface IPharmacistSchedule {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  pharmacistId: mongoose.Types.ObjectId;
  workingHours: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    shifts: Array<{
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
    }>;
  }>;
  appointmentPreferences: {
    maxAppointmentsPerDay?: number;
    appointmentTypes: string[];
    defaultDuration: number;
    bufferBetweenAppointments?: number;
  };
  isActive: boolean;
  effectiveFrom: Date;
}

// Seeding configuration
const STAGING_CONFIG = {
  workplaces: 2,
  usersPerWorkplace: 5,
  patientsPerWorkplace: 50,
  appointmentsPerWorkplace: 100,
  followUpTasksPerWorkplace: 30,
  reminderTemplatesPerWorkplace: 10,
  schedulesPerWorkplace: 3,
};

// Utility functions
const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomElements = <T>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generateTimeSlot = () => {
  const hour = faker.number.int({ min: 8, max: 17 });
  const startTime = `${hour.toString().padStart(2, '0')}:00`;
  const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
  return { start: startTime, end: endTime };
};

// Seeding functions
class StagingDataSeeder {
  private workplaces: IWorkplace[] = [];
  private users: IUser[] = [];
  private patients: IPatient[] = [];
  private appointments: IAppointment[] = [];
  private followUpTasks: IFollowUpTask[] = [];
  private reminderTemplates: IReminderTemplate[] = [];
  private pharmacistSchedules: IPharmacistSchedule[] = [];

  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot-staging';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }

  async clearExistingData() {
    console.log('Clearing existing staging data...');
    
    const collections = [
      'workplaces',
      'users', 
      'patients',
      'appointments',
      'followuptasks',
      'remindertemplates',
      'pharmacistschedules'
    ];

    for (const collection of collections) {
      try {
        await mongoose.connection.db.collection(collection).deleteMany({});
        console.log(`Cleared ${collection} collection`);
      } catch (error) {
        console.warn(`Could not clear ${collection}:`, error);
      }
    }
  }

  generateWorkplaces() {
    console.log('Generating workplaces...');
    
    for (let i = 0; i < STAGING_CONFIG.workplaces; i++) {
      const workplace: IWorkplace = {
        _id: new mongoose.Types.ObjectId(),
        name: `${faker.company.name()} Pharmacy`,
        type: 'pharmacy',
        isActive: true,
      };
      
      this.workplaces.push(workplace);
    }
    
    console.log(`Generated ${this.workplaces.length} workplaces`);
  }

  generateUsers() {
    console.log('Generating users...');
    
    const roles = ['pharmacist', 'pharmacy_manager', 'pharmacy_technician'];
    
    for (const workplace of this.workplaces) {
      for (let i = 0; i < STAGING_CONFIG.usersPerWorkplace; i++) {
        const user: IUser = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email(),
          role: getRandomElement(roles),
          isActive: true,
        };
        
        this.users.push(user);
      }
    }
    
    console.log(`Generated ${this.users.length} users`);
  }

  generatePatients() {
    console.log('Generating patients...');
    
    const languages = ['en', 'yo', 'ig', 'ha'];
    const timezones = ['Africa/Lagos', 'Africa/Abuja'];
    
    for (const workplace of this.workplaces) {
      for (let i = 0; i < STAGING_CONFIG.patientsPerWorkplace; i++) {
        const patient: IPatient = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email(),
          phone: faker.phone.number(),
          dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
          gender: getRandomElement(['male', 'female', 'other']),
          appointmentPreferences: {
            preferredDays: getRandomElements([1, 2, 3, 4, 5], faker.number.int({ min: 2, max: 5 })),
            preferredTimeSlots: [generateTimeSlot(), generateTimeSlot()],
            reminderPreferences: {
              email: faker.datatype.boolean(),
              sms: faker.datatype.boolean(),
              push: faker.datatype.boolean(),
              whatsapp: faker.datatype.boolean(),
            },
            language: getRandomElement(languages),
            timezone: getRandomElement(timezones),
          },
        };
        
        this.patients.push(patient);
      }
    }
    
    console.log(`Generated ${this.patients.length} patients`);
  }

  generateAppointments() {
    console.log('Generating appointments...');
    
    const appointmentTypes = [
      'mtm_session',
      'chronic_disease_review',
      'new_medication_consultation',
      'vaccination',
      'health_check',
      'smoking_cessation',
      'general_followup'
    ];
    
    const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
    
    for (const workplace of this.workplaces) {
      const workplaceUsers = this.users.filter(u => u.workplaceId.equals(workplace._id!));
      const workplacePatients = this.patients.filter(p => p.workplaceId.equals(workplace._id!));
      
      for (let i = 0; i < STAGING_CONFIG.appointmentsPerWorkplace; i++) {
        const scheduledDate = faker.date.between({
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)    // 60 days from now
        });
        
        const appointment: IAppointment = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          patientId: getRandomElement(workplacePatients)._id!,
          assignedTo: getRandomElement(workplaceUsers)._id!,
          type: getRandomElement(appointmentTypes),
          title: `${getRandomElement(appointmentTypes).replace('_', ' ')} appointment`,
          description: faker.lorem.sentence(),
          scheduledDate,
          scheduledTime: `${faker.number.int({ min: 8, max: 17 })}:${getRandomElement(['00', '30'])}`,
          duration: getRandomElement([15, 30, 45, 60]),
          timezone: 'Africa/Lagos',
          status: getRandomElement(statuses),
          confirmationStatus: getRandomElement(['pending', 'confirmed', 'declined']),
          isRecurring: faker.datatype.boolean({ probability: 0.2 }),
          metadata: {
            source: getRandomElement(['manual', 'patient_portal', 'automated_trigger']),
          },
        };
        
        this.appointments.push(appointment);
      }
    }
    
    console.log(`Generated ${this.appointments.length} appointments`);
  }

  generateFollowUpTasks() {
    console.log('Generating follow-up tasks...');
    
    const taskTypes = [
      'medication_start_followup',
      'lab_result_review',
      'hospital_discharge_followup',
      'medication_change_followup',
      'chronic_disease_monitoring',
      'adherence_check',
      'refill_reminder',
      'preventive_care',
      'general_followup'
    ];
    
    const priorities = ['low', 'medium', 'high', 'urgent', 'critical'];
    const statuses = ['pending', 'in_progress', 'completed', 'cancelled', 'overdue'];
    const triggerTypes = ['manual', 'medication_start', 'lab_result', 'hospital_discharge', 'system_rule'];
    
    for (const workplace of this.workplaces) {
      const workplaceUsers = this.users.filter(u => u.workplaceId.equals(workplace._id!));
      const workplacePatients = this.patients.filter(p => p.workplaceId.equals(workplace._id!));
      
      for (let i = 0; i < STAGING_CONFIG.followUpTasksPerWorkplace; i++) {
        const taskType = getRandomElement(taskTypes);
        const dueDate = faker.date.between({
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // 7 days ago
          to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)   // 30 days from now
        });
        
        const followUpTask: IFollowUpTask = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          patientId: getRandomElement(workplacePatients)._id!,
          assignedTo: getRandomElement(workplaceUsers)._id!,
          type: taskType,
          title: `${taskType.replace(/_/g, ' ')} for patient`,
          description: faker.lorem.paragraph(),
          objectives: [
            faker.lorem.sentence(),
            faker.lorem.sentence(),
            faker.lorem.sentence()
          ],
          priority: getRandomElement(priorities),
          dueDate,
          status: getRandomElement(statuses),
          trigger: {
            type: getRandomElement(triggerTypes),
            triggerDate: faker.date.recent({ days: 7 }),
            triggerDetails: {
              reason: faker.lorem.sentence(),
              severity: getRandomElement(['low', 'medium', 'high'])
            }
          },
        };
        
        this.followUpTasks.push(followUpTask);
      }
    }
    
    console.log(`Generated ${this.followUpTasks.length} follow-up tasks`);
  }

  generateReminderTemplates() {
    console.log('Generating reminder templates...');
    
    const templateTypes = ['appointment', 'medication_refill', 'adherence_check', 'clinical_followup', 'preventive_care'];
    const categories = ['pre_appointment', 'post_appointment', 'medication', 'clinical', 'general'];
    const channels = ['email', 'sms', 'push', 'whatsapp'];
    const timeUnits = ['minutes', 'hours', 'days'];
    const relativeToOptions = ['before_appointment', 'after_appointment', 'before_due_date', 'after_event'];
    
    for (const workplace of this.workplaces) {
      for (let i = 0; i < STAGING_CONFIG.reminderTemplatesPerWorkplace; i++) {
        const templateType = getRandomElement(templateTypes);
        const selectedChannels = getRandomElements(channels, faker.number.int({ min: 1, max: 3 }));
        
        const reminderTemplate: IReminderTemplate = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          name: `${templateType.replace('_', ' ')} reminder template`,
          type: templateType,
          category: getRandomElement(categories),
          channels: selectedChannels,
          timing: {
            unit: getRandomElement(timeUnits),
            value: faker.number.int({ min: 1, max: 48 }),
            relativeTo: getRandomElement(relativeToOptions),
          },
          messageTemplates: {
            email: selectedChannels.includes('email') ? {
              subject: `Reminder: ${templateType.replace('_', ' ')}`,
              body: faker.lorem.paragraph(),
            } : undefined,
            sms: selectedChannels.includes('sms') ? {
              message: faker.lorem.sentence({ min: 10, max: 20 }),
            } : undefined,
          },
          isActive: faker.datatype.boolean({ probability: 0.8 }),
          isDefault: faker.datatype.boolean({ probability: 0.3 }),
        };
        
        this.reminderTemplates.push(reminderTemplate);
      }
    }
    
    console.log(`Generated ${this.reminderTemplates.length} reminder templates`);
  }

  generatePharmacistSchedules() {
    console.log('Generating pharmacist schedules...');
    
    const appointmentTypes = [
      'mtm_session',
      'chronic_disease_review',
      'new_medication_consultation',
      'vaccination',
      'health_check'
    ];
    
    for (const workplace of this.workplaces) {
      const pharmacists = this.users.filter(u => 
        u.workplaceId.equals(workplace._id!) && u.role === 'pharmacist'
      );
      
      for (let i = 0; i < Math.min(STAGING_CONFIG.schedulesPerWorkplace, pharmacists.length); i++) {
        const pharmacist = pharmacists[i];
        
        // Generate working hours for each day of the week
        const workingHours = [];
        for (let day = 0; day < 7; day++) {
          const isWorkingDay = day >= 1 && day <= 5; // Monday to Friday
          
          workingHours.push({
            dayOfWeek: day,
            isWorkingDay,
            shifts: isWorkingDay ? [{
              startTime: '08:00',
              endTime: '17:00',
              breakStart: '12:00',
              breakEnd: '13:00',
            }] : [],
          });
        }
        
        const schedule: IPharmacistSchedule = {
          _id: new mongoose.Types.ObjectId(),
          workplaceId: workplace._id!,
          pharmacistId: pharmacist._id!,
          workingHours,
          appointmentPreferences: {
            maxAppointmentsPerDay: faker.number.int({ min: 8, max: 16 }),
            appointmentTypes: getRandomElements(appointmentTypes, faker.number.int({ min: 3, max: 5 })),
            defaultDuration: getRandomElement([30, 45, 60]),
            bufferBetweenAppointments: getRandomElement([5, 10, 15]),
          },
          isActive: true,
          effectiveFrom: faker.date.recent({ days: 30 }),
        };
        
        this.pharmacistSchedules.push(schedule);
      }
    }
    
    console.log(`Generated ${this.pharmacistSchedules.length} pharmacist schedules`);
  }

  async insertData() {
    console.log('Inserting data into database...');
    
    try {
      // Insert workplaces
      if (this.workplaces.length > 0) {
        await mongoose.connection.db.collection('workplaces').insertMany(this.workplaces);
        console.log(`Inserted ${this.workplaces.length} workplaces`);
      }
      
      // Insert users
      if (this.users.length > 0) {
        await mongoose.connection.db.collection('users').insertMany(this.users);
        console.log(`Inserted ${this.users.length} users`);
      }
      
      // Insert patients
      if (this.patients.length > 0) {
        await mongoose.connection.db.collection('patients').insertMany(this.patients);
        console.log(`Inserted ${this.patients.length} patients`);
      }
      
      // Insert appointments
      if (this.appointments.length > 0) {
        await mongoose.connection.db.collection('appointments').insertMany(this.appointments);
        console.log(`Inserted ${this.appointments.length} appointments`);
      }
      
      // Insert follow-up tasks
      if (this.followUpTasks.length > 0) {
        await mongoose.connection.db.collection('followuptasks').insertMany(this.followUpTasks);
        console.log(`Inserted ${this.followUpTasks.length} follow-up tasks`);
      }
      
      // Insert reminder templates
      if (this.reminderTemplates.length > 0) {
        await mongoose.connection.db.collection('remindertemplates').insertMany(this.reminderTemplates);
        console.log(`Inserted ${this.reminderTemplates.length} reminder templates`);
      }
      
      // Insert pharmacist schedules
      if (this.pharmacistSchedules.length > 0) {
        await mongoose.connection.db.collection('pharmacistschedules').insertMany(this.pharmacistSchedules);
        console.log(`Inserted ${this.pharmacistSchedules.length} pharmacist schedules`);
      }
      
    } catch (error) {
      console.error('Error inserting data:', error);
      throw error;
    }
  }

  async seed() {
    try {
      await this.connect();
      await this.clearExistingData();
      
      this.generateWorkplaces();
      this.generateUsers();
      this.generatePatients();
      this.generateAppointments();
      this.generateFollowUpTasks();
      this.generateReminderTemplates();
      this.generatePharmacistSchedules();
      
      await this.insertData();
      
      console.log('\n✅ Staging data seeding completed successfully!');
      console.log('\nGenerated data summary:');
      console.log(`- Workplaces: ${this.workplaces.length}`);
      console.log(`- Users: ${this.users.length}`);
      console.log(`- Patients: ${this.patients.length}`);
      console.log(`- Appointments: ${this.appointments.length}`);
      console.log(`- Follow-up Tasks: ${this.followUpTasks.length}`);
      console.log(`- Reminder Templates: ${this.reminderTemplates.length}`);
      console.log(`- Pharmacist Schedules: ${this.pharmacistSchedules.length}`);
      
    } catch (error) {
      console.error('❌ Staging data seeding failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  console.log('🌱 Patient Engagement Module - Staging Data Seeder');
  console.log('==================================================\n');
  
  const seeder = new StagingDataSeeder();
  await seeder.seed();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default StagingDataSeeder;