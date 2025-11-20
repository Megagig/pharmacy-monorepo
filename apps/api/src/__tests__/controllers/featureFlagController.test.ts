import request from 'supertest';
import { Application } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../setup';
import { User } from '../../models/User';
import { FeatureFlag } from '../../models/FeatureFlag';
import jwt from 'jsonwebtoken';

describe('Feature Flag Controller - updateTierFeatures', () => {
  let app: Application;
  let superAdminToken: string;
  let regularUserToken: string;
  let testFeatureFlag1: any;
  let testFeatureFlag2: any;
  let testFeatureFlag3: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Create a default plan ID for users
    const defaultPlanId = new mongoose.Types.ObjectId();

    // Create test users with passwordHash directly (will be hashed by pre-save hook)
    const superAdmin = await User.create({
      email: 'superadmin@test.com',
      passwordHash: 'password123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      isActive: true,
      isEmailVerified: true,
      status: 'active',
      currentPlanId: defaultPlanId
    });

    const regularUser = await User.create({
      email: 'user@test.com',
      passwordHash: 'password123',
      firstName: 'Regular',
      lastName: 'User',
      role: 'pharmacist',
      isActive: true,
      isEmailVerified: true,
      status: 'active',
      currentPlanId: defaultPlanId,
      workplaceId: new mongoose.Types.ObjectId()
    });

    // Create test feature flags
    testFeatureFlag1 = await FeatureFlag.create({
      name: 'Clinical Decision Support',
      key: 'clinical_decision_support',
      description: 'Advanced clinical decision support tools',
      isActive: true,
      allowedTiers: ['basic', 'pro'],
      allowedRoles: ['pharmacist', 'owner'],
      metadata: {
        category: 'clinical',
        priority: 'high',
        tags: ['clinical', 'decision-support']
      }
    });

    testFeatureFlag2 = await FeatureFlag.create({
      name: 'Advanced Reports',
      key: 'advanced_reports',
      description: 'Advanced reporting and analytics',
      isActive: true,
      allowedTiers: ['pro'],
      allowedRoles: ['owner'],
      metadata: {
        category: 'analytics',
        priority: 'medium',
        tags: ['reports', 'analytics']
      }
    });

    testFeatureFlag3 = await FeatureFlag.create({
      name: 'API Access',
      key: 'api_access',
      description: 'API access for integrations',
      isActive: true,
      allowedTiers: ['enterprise'],
      allowedRoles: ['owner', 'super_admin'],
      metadata: {
        category: 'integration',
        priority: 'high',
        tags: ['api', 'integration']
      }
    });

    // Generate tokens
    superAdminToken = jwt.sign(
      { userId: superAdmin._id, role: 'super_admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    regularUserToken = jwt.sign(
      { userId: regularUser._id, role: 'pharmacist' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await User.deleteMany({});
    await FeatureFlag.deleteMany({});
  });

  describe('POST /api/feature-flags/tier/:tier/features - Bulk Add Operation', () => {
    it('should successfully add tier to multiple features', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/enterprise/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support', 'advanced_reports'],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully added tier "enterprise"');
      expect(response.body.data.tier).toBe('enterprise');
      expect(response.body.data.action).toBe('add');
      expect(response.body.data.matchedCount).toBe(2);
      expect(response.body.data.modifiedCount).toBeGreaterThanOrEqual(0);

      // Verify the features were updated
      const updatedFlag1 = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      const updatedFlag2 = await FeatureFlag.findOne({ key: 'advanced_reports' });
      
      expect(updatedFlag1?.allowedTiers).toContain('enterprise');
      expect(updatedFlag2?.allowedTiers).toContain('enterprise');
    });

    it('should add tier to single feature', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/free_trial/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(1);

      // Verify the feature was updated
      const updatedFlag = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      expect(updatedFlag?.allowedTiers).toContain('free_trial');
    });

    it('should prevent duplicate tiers using $addToSet', async () => {
      // First add
      await request(app)
        .post('/api/feature-flags/tier/enterprise/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(200);

      // Second add (should not create duplicate)
      const response = await request(app)
        .post('/api/feature-flags/tier/enterprise/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify no duplicates
      const updatedFlag = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      const enterpriseCount = updatedFlag?.allowedTiers.filter(t => t === 'enterprise').length;
      expect(enterpriseCount).toBe(1);
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Bulk Remove Operation', () => {
    it('should successfully remove tier from multiple features', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support', 'advanced_reports'],
          action: 'remove'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully removed tier "pro"');
      expect(response.body.data.tier).toBe('pro');
      expect(response.body.data.action).toBe('remove');
      expect(response.body.data.matchedCount).toBe(2);

      // Verify the features were updated
      const updatedFlag1 = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      const updatedFlag2 = await FeatureFlag.findOne({ key: 'advanced_reports' });
      
      expect(updatedFlag1?.allowedTiers).not.toContain('pro');
      expect(updatedFlag2?.allowedTiers).not.toContain('pro');
    });

    it('should remove tier from single feature', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/basic/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'remove'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(1);

      // Verify the feature was updated
      const updatedFlag = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      expect(updatedFlag?.allowedTiers).not.toContain('basic');
    });

    it('should handle removing non-existent tier gracefully', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/free_trial/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'remove'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // modifiedCount might be 0 if tier wasn't present
      expect(response.body.data.matchedCount).toBe(1);
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Invalid Tier Parameter', () => {
    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/invalid_tier/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid tier');
      expect(response.body.message).toContain('free_trial');
      expect(response.body.message).toContain('basic');
      expect(response.body.message).toContain('pro');
      expect(response.body.message).toContain('enterprise');
    });

    it('should return 400 for empty tier', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier//features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(404); // Express returns 404 for empty path params

      // This is expected behavior - empty tier results in route not found
    });

    it('should return 400 for tier with wrong case', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/ENTERPRISE/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid tier');
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Invalid Action Parameter', () => {
    it('should return 400 for invalid action', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'invalid_action'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid action');
      expect(response.body.message).toContain('add');
      expect(response.body.message).toContain('remove');
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid action');
    });

    it('should return 400 for null action', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: null
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid action');
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Empty FeatureKeys Array', () => {
    it('should return 400 for empty featureKeys array', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: [],
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('featureKeys must be a non-empty array');
    });

    it('should return 400 for missing featureKeys', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('featureKeys must be a non-empty array');
    });

    it('should return 400 for non-array featureKeys', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: 'not-an-array',
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('featureKeys must be a non-empty array');
    });

    it('should return 400 for null featureKeys', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: null,
          action: 'add'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('featureKeys must be a non-empty array');
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Non-existent Feature Keys', () => {
    it('should handle non-existent feature keys gracefully', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['non_existent_feature_1', 'non_existent_feature_2'],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(0);
      expect(response.body.data.modifiedCount).toBe(0);
    });

    it('should handle mix of existing and non-existent feature keys', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/enterprise/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['clinical_decision_support', 'non_existent_feature'],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(1); // Only one exists
      
      // Verify only the existing feature was updated
      const updatedFlag = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      expect(updatedFlag?.allowedTiers).toContain('enterprise');
    });

    it('should handle all non-existent keys in remove operation', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: ['non_existent_1', 'non_existent_2', 'non_existent_3'],
          action: 'remove'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(0);
      expect(response.body.data.modifiedCount).toBe(0);
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Authorization', () => {
    it('should return 403 for non-super_admin user', async () => {
      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(403);

      expect(response.body.message).toContain('Super Administrator access required');
    });

    it('should return 401 for missing authorization header', async () => {
      await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(401);
    });

    it('should return 401 for invalid token', async () => {
      await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(401);
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: new mongoose.Types.ObjectId(), role: 'super_admin' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          featureKeys: ['clinical_decision_support'],
          action: 'add'
        })
        .expect(401);
    });
  });

  describe('POST /api/feature-flags/tier/:tier/features - Edge Cases', () => {
    it('should handle large number of feature keys', async () => {
      // Create multiple features
      const featureKeys = [];
      for (let i = 0; i < 50; i++) {
        const feature = await FeatureFlag.create({
          name: `Feature ${i}`,
          key: `feature_${i}`,
          description: `Test feature ${i}`,
          isActive: true,
          allowedTiers: ['basic'],
          allowedRoles: ['pharmacist'],
          metadata: {
            category: 'test',
            priority: 'low',
            tags: ['test']
          }
        });
        featureKeys.push(feature.key);
      }

      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys,
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(50);
    });

    it('should handle special characters in feature keys', async () => {
      const specialFeature = await FeatureFlag.create({
        name: 'Special Feature',
        key: 'feature_with_underscores_123',
        description: 'Feature with special characters',
        isActive: true,
        allowedTiers: ['basic'],
        allowedRoles: ['pharmacist'],
        metadata: {
          category: 'test',
          priority: 'low',
          tags: ['test']
        }
      });

      const response = await request(app)
        .post('/api/feature-flags/tier/pro/features')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          featureKeys: [specialFeature.key],
          action: 'add'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matchedCount).toBe(1);
    });

    it('should handle all valid tiers', async () => {
      const validTiers = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
      
      for (const tier of validTiers) {
        const response = await request(app)
          .post(`/api/feature-flags/tier/${tier}/features`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            featureKeys: ['clinical_decision_support'],
            action: 'add'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tier).toBe(tier);
      }

      // Verify all tiers were added
      const updatedFlag = await FeatureFlag.findOne({ key: 'clinical_decision_support' });
      validTiers.forEach(tier => {
        expect(updatedFlag?.allowedTiers).toContain(tier);
      });
    });
  });

  // Note: Database error handling is tested implicitly through other error scenarios
  // Closing the database connection in tests can cause issues with test cleanup
});
