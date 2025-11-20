import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SecurityAuditLog } from '../models/SecurityAuditLog';
import { User } from '../models/User';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

const categories = ['authentication', 'authorization', 'data_access', 'configuration', 'user_management', 'system'] as const;
const severities = ['low', 'medium', 'high', 'critical'] as const;
const actions = [
  'login',
  'login_failed',
  'logout',
  'password_change',
  'password_reset',
  'role_changed',
  'permission_granted',
  'permission_revoked',
  'user_created',
  'user_deleted',
  'data_export',
  'configuration_changed',
  'suspicious_activity',
  'account_locked',
  'account_unlocked',
];

const resources = ['User', 'Role', 'Permission', 'SecuritySettings', 'Session', 'Workspace'];

const ipAddresses = [
  '192.168.1.100',
  '192.168.1.101',
  '10.0.0.5',
  '172.16.0.10',
  '203.0.113.42',
];

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
];

const locations = [
  { country: 'Nigeria', region: 'Lagos', city: 'Lagos' },
  { country: 'Nigeria', region: 'FCT', city: 'Abuja' },
  { country: 'Nigeria', region: 'Oyo', city: 'Ibadan' },
  { country: 'Ghana', region: 'Greater Accra', city: 'Accra' },
  { country: 'Kenya', region: 'Nairobi', city: 'Nairobi' },
];

async function seedSecurityAuditLogs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Get some users
    const users = await User.find().limit(5);
    
    if (users.length === 0) {
      logger.warn('No users found. Please create users first.');
      process.exit(0);
    }

    logger.info(`Found ${users.length} users to use for seeding`);

    // Clear existing logs (optional)
    const deleteResult = await SecurityAuditLog.deleteMany({});
    logger.info(`Deleted ${deleteResult.deletedCount} existing security audit logs`);

    // Generate logs for the past 30 days
    const logsToCreate = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 500; i++) {
      // Random timestamp within last 30 days
      const timestamp = new Date(
        thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime())
      );

      const user = users[Math.floor(Math.random() * users.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const success = Math.random() > 0.15; // 85% success rate
      const resource = resources[Math.floor(Math.random() * resources.length)];
      const ipAddress = ipAddresses[Math.floor(Math.random() * ipAddresses.length)];
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];

      // Calculate risk score based on various factors
      let riskScore = 0;
      if (!success) riskScore += 30;
      if (severity === 'critical') riskScore += 40;
      else if (severity === 'high') riskScore += 30;
      else if (severity === 'medium') riskScore += 20;
      else riskScore += 10;

      if (action.includes('failed') || action.includes('suspicious')) riskScore += 20;
      if (action.includes('delete') || action.includes('lock')) riskScore += 15;

      riskScore = Math.min(100, Math.max(0, riskScore));

      const log = {
        userId: user._id,
        action,
        resource,
        resourceId: new mongoose.Types.ObjectId().toString(),
        ipAddress,
        userAgent,
        location,
        timestamp,
        success,
        errorMessage: !success ? `Action failed: ${action}` : undefined,
        severity,
        category,
        details: {
          timestamp: timestamp.toISOString(),
          resource,
          action,
          metadata: {
            browser: 'Chrome',
            os: 'Windows 10',
            device: 'Desktop',
          },
        },
        riskScore,
        flagged: riskScore >= 70,
      };

      logsToCreate.push(log);
    }

    // Batch insert logs
    const inserted = await SecurityAuditLog.insertMany(logsToCreate);
    logger.info(`✅ Successfully seeded ${inserted.length} security audit logs`);

    // Show summary statistics
    const stats = {
      total: inserted.length,
      byCategory: await SecurityAuditLog.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      bySeverity: await SecurityAuditLog.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      flagged: await SecurityAuditLog.countDocuments({ flagged: true }),
      failed: await SecurityAuditLog.countDocuments({ success: false }),
    };

    logger.info('📊 Security Audit Logs Statistics:', JSON.stringify(stats, null, 2));

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding security audit logs:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedSecurityAuditLogs();
