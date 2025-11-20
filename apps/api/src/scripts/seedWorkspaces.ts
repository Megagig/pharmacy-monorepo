import mongoose from 'mongoose';
import { Workplace } from '../models/Workplace';
import User from '../models/User';
import logger from '../utils/logger';

async function seedWorkspaces() {
  try {
    // Verify MongoDB connection is ready
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, skipping workspace seeding');
      return;
    }

    // Check if workspaces already exist
    const existingCount = await Workplace.countDocuments();
    if (existingCount > 0) {
      logger.info(`${existingCount} workspaces already exist. Skipping seed.`);
      return;
    }

    // Create sample workspaces
    const sampleWorkspaces = [
      {
        name: 'Central Pharmacy',
        type: 'Community',
        email: 'admin@centralpharmacy.com',
        phone: '+1234567890',
        address: '123 Main Street',
        state: 'Lagos',
        lga: 'Ikeja',
        licenseNumber: 'PCN001',
        subscriptionStatus: 'active',
        ownerId: new mongoose.Types.ObjectId(),
      },
      {
        name: 'City Hospital Pharmacy',
        type: 'Hospital',
        email: 'pharmacy@cityhospital.com',
        phone: '+1234567891',
        address: '456 Hospital Road',
        state: 'Abuja',
        lga: 'Garki',
        licenseNumber: 'PCN002',
        subscriptionStatus: 'trial',
        ownerId: new mongoose.Types.ObjectId(),
      },
      {
        name: 'University Pharmacy',
        type: 'Academia',
        email: 'pharmacy@university.edu',
        phone: '+1234567892',
        address: '789 University Avenue',
        state: 'Ogun',
        lga: 'Abeokuta South',
        licenseNumber: 'PCN003',
        subscriptionStatus: 'active',
        ownerId: new mongoose.Types.ObjectId(),
      },
      {
        name: 'MedCorp Industries',
        type: 'Industry',
        email: 'contact@medcorp.com',
        phone: '+1234567893',
        address: '321 Industrial Estate',
        state: 'Rivers',
        lga: 'Port Harcourt',
        licenseNumber: 'PCN004',
        subscriptionStatus: 'canceled',
        ownerId: new mongoose.Types.ObjectId(),
      },
      {
        name: 'QuickCare Pharmacy',
        type: 'Community',
        email: 'info@quickcare.com',
        phone: '+1234567894',
        address: '654 Shopping Mall',
        state: 'Kano',
        lga: 'Nassarawa',
        licenseNumber: 'PCN005',
        subscriptionStatus: 'trial',
        ownerId: new mongoose.Types.ObjectId(),
      },
    ];

    const createdWorkspaces = await Workplace.insertMany(sampleWorkspaces);
    logger.info(`Created ${createdWorkspaces.length} sample workspaces`);

    // Create some sample users for each workspace
    for (const workspace of createdWorkspaces) {
      const sampleUsers = [
        {
          email: `owner@${workspace.name.toLowerCase().replace(/\s+/g, '')}.com`,
          firstName: 'John',
          lastName: 'Owner',
          passwordHash: '$2a$12$dummy.hash.for.testing',
          role: 'owner',
          workplaceId: workspace._id,
          workplaceRole: 'Owner',
          status: 'active',
          emailVerified: true,
          currentPlanId: new mongoose.Types.ObjectId(),
        },
        {
          email: `pharmacist@${workspace.name.toLowerCase().replace(/\s+/g, '')}.com`,
          firstName: 'Jane',
          lastName: 'Pharmacist',
          passwordHash: '$2a$12$dummy.hash.for.testing',
          role: 'pharmacist',
          workplaceId: workspace._id,
          workplaceRole: 'Pharmacist',
          status: 'active',
          emailVerified: true,
          currentPlanId: new mongoose.Types.ObjectId(),
        },
      ];

      await User.insertMany(sampleUsers);
      
      // Update workspace stats
      workspace.stats.usersCount = sampleUsers.length;
      workspace.stats.patientsCount = Math.floor(Math.random() * 100) + 10;
      workspace.stats.lastUpdated = new Date();
      await workspace.save();
    }

    logger.info('Sample workspaces and users created successfully');
  } catch (error) {
    logger.error('Error seeding workspaces:', error);
    throw error;
  }
}

export default seedWorkspaces;