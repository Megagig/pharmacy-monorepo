import mongoose from 'mongoose';
import { TenantSettings, ITenantSettings } from '../../models/TenantSettings';

describe('TenantSettings Model', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_PharmacyCopilot';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await TenantSettings.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create valid TenantSettings with default values', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      
      expect(settings._id).toBeDefined();
      expect(settings.tenantId.toString()).toBe(tenantId.toString());
      expect(settings.general.tenantName).toBe('Test Pharmacy');
      expect(settings.general.displayName).toBe('Test Pharmacy');
      expect(settings.features.enabledModules).toContain('patient-management');
      expect(settings.features.enabledModules).toContain('prescription-processing');
      expect(settings.version).toBe(1);
      expect(settings.isActive).toBe(true);
    });

    it('should require mandatory fields', async () => {
      const incompleteSettings = new TenantSettings({
        tenantId: new mongoose.Types.ObjectId(),
        // Missing required fields
      });

      await expect(incompleteSettings.save()).rejects.toThrow();
    });

    it('should validate time format for notification quiet hours', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new TenantSettings({
        tenantId,
        general: {
          tenantName: 'Test Pharmacy',
          displayName: 'Test Pharmacy',
          timezone: 'UTC',
          locale: 'en-US',
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '12h',
        },
        features: {
          enabledModules: [],
          betaFeatures: [],
          experimentalFeatures: [],
          customFeatures: {},
        },
        workflows: {
          patientManagement: { requireApproval: false, approvalWorkflow: { steps: [] }, autoAssignment: { enabled: false, rules: [] } },
          prescriptionProcessing: { requireApproval: false, approvalWorkflow: { steps: [] }, autoAssignment: { enabled: false, rules: [] } },
          inventoryManagement: { requireApproval: false, approvalWorkflow: { steps: [] }, autoAssignment: { enabled: false, rules: [] } },
          clinicalReviews: { requireApproval: false, approvalWorkflow: { steps: [] }, autoAssignment: { enabled: false, rules: [] } },
        },
        notifications: {
          channels: { email: true, sms: false, push: true, inApp: true },
          frequency: 'immediate',
          quietHours: {
            enabled: true,
            startTime: '25:00', // Invalid time format
            endTime: '08:00',
          },
          categories: { system: true, billing: true, security: true, updates: false },
        },
        security: {
          passwordPolicy: { enforceComplexity: true, minLength: 8, requireMFA: false, sessionTimeout: 480 },
          accessControl: { ipWhitelist: [], allowedDomains: [], restrictToBusinessHours: false, businessHours: { start: '09:00', end: '17:00', timezone: 'UTC' } },
          auditSettings: { logAllActions: true, retentionDays: 365, alertOnSuspiciousActivity: true },
        },
        integrations: {
          apiAccess: { enabled: false, rateLimits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000 }, allowedIPs: [] },
          webhooks: { enabled: false, endpoints: [] },
          dataSync: { enabled: false, frequency: 'daily', syncStatus: 'pending' },
        },
        customization: {
          theme: { mode: 'light', primaryColor: '#3B82F6', secondaryColor: '#6B7280', accentColor: '#10B981', borderRadius: 'medium' },
          layout: { sidebarCollapsed: false, density: 'comfortable', showBreadcrumbs: true, showQuickActions: true },
          dashboard: { widgets: [], refreshInterval: 300 },
        },
        businessRules: {
          operatingHours: {
            monday: { open: '09:00', close: '17:00', isOpen: true },
            tuesday: { open: '09:00', close: '17:00', isOpen: true },
            wednesday: { open: '09:00', close: '17:00', isOpen: true },
            thursday: { open: '09:00', close: '17:00', isOpen: true },
            friday: { open: '09:00', close: '17:00', isOpen: true },
            saturday: { open: '09:00', close: '17:00', isOpen: false },
            sunday: { open: '09:00', close: '17:00', isOpen: false },
          },
          holidays: [],
          autoLogout: { enabled: true, idleTimeMinutes: 30, warningTimeMinutes: 5 },
        },
        compliance: {
          regulations: ['HIPAA'],
          dataRetention: { patientRecords: 7, auditLogs: 3, backups: 2 },
          consentManagement: { required: true, types: ['treatment'], renewalPeriodDays: 365 },
        },
        backup: {
          enabled: true,
          frequency: 'daily',
          retentionDays: 30,
          includeFiles: true,
          encryptBackups: true,
        },
        lastModifiedBy: adminId,
      });

      await expect(invalidSettings.save()).rejects.toThrow();
    });

    it('should validate IP address format in security settings', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      settings.security.accessControl.ipWhitelist = ['invalid-ip-address'];

      await expect(settings.save()).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      settings.notifications.frequency = 'invalid_frequency' as any;

      await expect(settings.save()).rejects.toThrow();
    });

    it('should enforce unique tenantId', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy 1', adminId);
      
      await expect(
        TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy 2', adminId)
      ).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    let settings: ITenantSettings;
    const tenantId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
    });

    it('should check if feature is enabled', () => {
      expect(settings.isFeatureEnabled('patient-management')).toBe(true);
      expect(settings.isFeatureEnabled('non-existent-feature')).toBe(false);
      
      // Add beta feature
      settings.features.betaFeatures.push('beta-feature');
      expect(settings.isFeatureEnabled('beta-feature')).toBe(true);
      
      // Add experimental feature
      settings.features.experimentalFeatures.push('experimental-feature');
      expect(settings.isFeatureEnabled('experimental-feature')).toBe(true);
    });

    it('should check operating hours', () => {
      // Mock current time to be 10:00 (within business hours)
      const mockTime = new Date();
      mockTime.setHours(10, 0, 0, 0);
      
      expect(settings.isOperatingHoursActive('monday', mockTime)).toBe(true);
      expect(settings.isOperatingHoursActive('saturday', mockTime)).toBe(false); // Closed on Saturday
      
      // Mock current time to be 20:00 (outside business hours)
      mockTime.setHours(20, 0, 0, 0);
      expect(settings.isOperatingHoursActive('monday', mockTime)).toBe(false);
    });

    it('should update version', () => {
      const newAdminId = new mongoose.Types.ObjectId();
      const originalVersion = settings.version;
      
      settings.updateVersion(newAdminId);
      
      expect(settings.version).toBe(originalVersion + 1);
      expect(settings.lastModifiedBy.toString()).toBe(newAdminId.toString());
    });

    it('should enable and disable features', () => {
      const featureName = 'new-feature';
      
      // Enable as regular feature
      settings.enableFeature(featureName, 'enabled');
      expect(settings.features.enabledModules).toContain(featureName);
      expect(settings.isFeatureEnabled(featureName)).toBe(true);
      
      // Move to beta
      settings.enableFeature(featureName, 'beta');
      expect(settings.features.enabledModules).not.toContain(featureName);
      expect(settings.features.betaFeatures).toContain(featureName);
      expect(settings.isFeatureEnabled(featureName)).toBe(true);
      
      // Move to experimental
      settings.enableFeature(featureName, 'experimental');
      expect(settings.features.betaFeatures).not.toContain(featureName);
      expect(settings.features.experimentalFeatures).toContain(featureName);
      expect(settings.isFeatureEnabled(featureName)).toBe(true);
      
      // Disable completely
      settings.disableFeature(featureName);
      expect(settings.features.experimentalFeatures).not.toContain(featureName);
      expect(settings.isFeatureEnabled(featureName)).toBe(false);
    });

    it('should exclude sensitive data in JSON output', () => {
      // Add webhook with secret
      settings.integrations.webhooks.enabled = true;
      settings.integrations.webhooks.endpoints.push({
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'super-secret-key',
        isActive: true,
      });
      
      const jsonOutput = settings.toJSON();
      
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput.integrations.webhooks.endpoints[0].secret).toBe('***');
    });
  });

  describe('Static Methods', () => {
    const tenantId1 = new mongoose.Types.ObjectId();
    const tenantId2 = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      await TenantSettings.createDefaultSettings(tenantId1, 'Active Pharmacy', adminId);
      
      const inactiveSettings = await TenantSettings.createDefaultSettings(tenantId2, 'Inactive Pharmacy', adminId);
      inactiveSettings.isActive = false;
      await inactiveSettings.save();
    });

    it('should find settings by tenant ID', async () => {
      const settings = await TenantSettings.findByTenantId(tenantId1);
      
      expect(settings).toBeDefined();
      expect(settings?.general.tenantName).toBe('Active Pharmacy');
      expect(settings?.isActive).toBe(true);
    });

    it('should not find inactive settings', async () => {
      const settings = await TenantSettings.findByTenantId(tenantId2);
      
      expect(settings).toBeNull(); // Should not find inactive settings
    });

    it('should create default settings with proper structure', async () => {
      const newTenantId = new mongoose.Types.ObjectId();
      const settings = await TenantSettings.createDefaultSettings(newTenantId, 'New Pharmacy', adminId);
      
      expect(settings.general.tenantName).toBe('New Pharmacy');
      expect(settings.general.displayName).toBe('New Pharmacy');
      expect(settings.general.timezone).toBe('UTC');
      expect(settings.general.currency).toBe('USD');
      
      // Check default features
      expect(settings.features.enabledModules).toContain('patient-management');
      expect(settings.features.enabledModules).toContain('prescription-processing');
      
      // Check default workflows
      expect(settings.workflows.patientManagement.requireApproval).toBe(false);
      expect(settings.workflows.prescriptionProcessing.requireApproval).toBe(false);
      
      // Check default notifications
      expect(settings.notifications.channels.email).toBe(true);
      expect(settings.notifications.channels.inApp).toBe(true);
      expect(settings.notifications.frequency).toBe('immediate');
      
      // Check default security
      expect(settings.security.passwordPolicy.enforceComplexity).toBe(true);
      expect(settings.security.passwordPolicy.minLength).toBe(8);
      expect(settings.security.auditSettings.logAllActions).toBe(true);
      
      // Check default customization
      expect(settings.customization.theme.mode).toBe('light');
      expect(settings.customization.layout.density).toBe('comfortable');
      
      // Check default business rules
      expect(settings.businessRules.operatingHours.monday.isOpen).toBe(true);
      expect(settings.businessRules.operatingHours.saturday.isOpen).toBe(false);
      expect(settings.businessRules.autoLogout.enabled).toBe(true);
      
      // Check default compliance
      expect(settings.compliance.regulations).toContain('HIPAA');
      expect(settings.compliance.dataRetention.patientRecords).toBe(7);
      
      // Check default backup
      expect(settings.backup.enabled).toBe(true);
      expect(settings.backup.frequency).toBe('daily');
      expect(settings.backup.encryptBackups).toBe(true);
    });
  });

  describe('Nested Schema Validation', () => {
    it('should validate workflow approval steps order', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      
      settings.workflows.patientManagement.requireApproval = true;
      settings.workflows.patientManagement.approvalWorkflow.steps = [
        { name: 'Step 1', approverRole: 'pharmacist', required: true, order: 0 }, // Invalid order < 1
      ];

      await expect(settings.save()).rejects.toThrow();
    });

    it('should validate dashboard widget position', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      
      settings.customization.dashboard.widgets = [
        {
          id: 'widget1',
          type: 'chart',
          position: { x: 0, y: 0, w: 4, h: 3 },
          config: {},
          isVisible: true,
        },
      ];

      const savedSettings = await settings.save();
      expect(savedSettings.customization.dashboard.widgets).toHaveLength(1);
    });

    it('should validate compliance data retention limits', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      settings.compliance.dataRetention.patientRecords = 100; // Exceeds max of 50

      await expect(settings.save()).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes', async () => {
      const indexes = await TenantSettings.collection.getIndexes();
      
      expect(indexes).toHaveProperty('tenantId_1');
      expect(indexes).toHaveProperty('isActive_1');
      expect(indexes).toHaveProperty('version_-1');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple feature type changes correctly', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      const settings = await TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId);
      
      // Start with feature in enabled modules
      settings.enableFeature('test-feature', 'enabled');
      expect(settings.features.enabledModules).toContain('test-feature');
      expect(settings.features.betaFeatures).not.toContain('test-feature');
      
      // Move to beta
      settings.enableFeature('test-feature', 'beta');
      expect(settings.features.enabledModules).not.toContain('test-feature');
      expect(settings.features.betaFeatures).toContain('test-feature');
      expect(settings.features.experimentalFeatures).not.toContain('test-feature');
      
      // Move to experimental
      settings.enableFeature('test-feature', 'experimental');
      expect(settings.features.enabledModules).not.toContain('test-feature');
      expect(settings.features.betaFeatures).not.toContain('test-feature');
      expect(settings.features.experimentalFeatures).toContain('test-feature');
      
      // Should still be considered enabled
      expect(settings.isFeatureEnabled('test-feature')).toBe(true);
    });

    it('should handle operating hours edge cases', () => {
      const tenantId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      
      TenantSettings.createDefaultSettings(tenantId, 'Test Pharmacy', adminId).then(settings => {
        // Test with exact opening time
        const openingTime = new Date();
        openingTime.setHours(9, 0, 0, 0);
        expect(settings.isOperatingHoursActive('monday', openingTime)).toBe(true);
        
        // Test with exact closing time
        const closingTime = new Date();
        closingTime.setHours(17, 0, 0, 0);
        expect(settings.isOperatingHoursActive('monday', closingTime)).toBe(true);
        
        // Test one minute after closing
        const afterClosing = new Date();
        afterClosing.setHours(17, 1, 0, 0);
        expect(settings.isOperatingHoursActive('monday', afterClosing)).toBe(false);
      });
    });
  });
});