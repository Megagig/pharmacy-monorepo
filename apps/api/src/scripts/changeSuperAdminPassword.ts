#!/usr/bin/env ts-node

/**
 * Script to change superadmin password
 * Usage: npx ts-node src/scripts/changeSuperAdminPassword.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import logger from '../utils/logger';

const SUPERADMIN_EMAIL = 'superadmin@superadmin.com';
const NEW_PASSWORD = 'Superadmin@247';

async function changeSuperAdminPassword() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find the superadmin user
    const superAdmin = await User.findOne({ email: SUPERADMIN_EMAIL });
    
    if (!superAdmin) {
      logger.error(`Superadmin user with email ${SUPERADMIN_EMAIL} not found`);
      process.exit(1);
    }

    logger.info(`Found superadmin user: ${superAdmin.firstName} ${superAdmin.lastName}`);

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, saltRounds);

    // Update the password
    superAdmin.passwordHash = hashedPassword;
    await superAdmin.save();

    logger.info('✅ Superadmin password updated successfully!');
    logger.info(`New password: ${NEW_PASSWORD}`);

  } catch (error) {
    logger.error('❌ Error changing superadmin password:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
changeSuperAdminPassword();