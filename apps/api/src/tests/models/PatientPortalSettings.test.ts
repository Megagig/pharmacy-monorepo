import mongoose from 'mongoose';
import PatientPortalSettings, { IPatientPortalSettings } from '../../models/PatientPortalSettings';

describe('PatientPortalSettings Model', () => {
  let testWorkplaceId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    testWorkplaceId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    await PatientPortalSettings.deleteMany({});
  });

  describe('Model Validation', () => {
    const validSettingsData = {
      workplaceId: new mongoose.Types.ObjectId(),
      isEnabled: true,
      requireApproval: true,
      allowedFeatures: {
        messaging: true,
        appointments: true,
        medications: true,
        vitals: true,
        labResults: true,
        billing: false,
        educationalResources: true,
        healthRecords: true,
      },
      appointmentSettings: {
        allowBooking: true,
        advanceBookingDays: 30,
        cancellationHours: 24,
        allowRescheduling: true,
        requireApproval: false,
        availableTimeSlots: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
        ],
        bufferMinutes: 15,
      },
      messagingSettings: {
        allowPatientInitiated: true,
        allowAttachments: true,
        maxAttachmentSize: 5,
        allowedFileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        autoResponseEnabled: false,
        businessHours: {
          enabled: false,
          timezone: 'Africa/Lagos',
          schedule: [],
        },
      },
      createdBy: new mongoose.Types.ObjectId(),
    };

    it('should create valid patient portal settings', async () => {
      const settings = new PatientPortalSettings(validSettingsData);
      const savedSettings = await settings.save();

      expect(savedSettings._id).toBeDefined();
      expect(savedSettings.workplaceId).toEqual(validSettingsData.workplaceId);
      expect(savedSettings.isEnabled).toBe(true);
      expect(savedSettings.requireApproval).toBe(true);
      expect(savedSettings.allowedFeatures.messaging).toBe(true);
    });

    it('should require workplaceId', async () => {
      const settingsData = { ...validSettingsData };
      delete (settingsData as any).workplaceId;

      const settings = new PatientPortalSettings(settingsData);
      await expect(settings.save()).rejects.toThrow('Workplace ID is required');
    });

    it('should enforce unique workplaceId', async () => {
      const settings1 = new PatientPortalSettings(validSettingsData);
      await settings1.save();

      const settings2 = new PatientPortalSettings(validSettingsData);
      await expect(settings2.save()).rejects.toThrow();
    });

    it('should validate advance booking days range', async () => {
      const invalidLow = {
        workplaceId: new mongoose.Types.ObjectId(),
        appointmentSettings: {
          advanceBookingDays: 0, // Invalid: too low
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const invalidHigh = {
        workplaceId: new mongoose.Types.ObjectId(),
        appointmentSettings: {
          advanceBookingDays: 400, // Invalid: too high
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      await expect(new PatientPortalSettings(invalidLow).save()).rejects.toThrow('Advance booking days must be at least 1');
      await expect(new PatientPortalSettings(invalidHigh).save()).rejects.toThrow('Advance booking days cannot exceed 365');
    });

    it('should validate cancellation hours range', async () => {
      const invalidLow = {
        workplaceId: new mongoose.Types.ObjectId(),
        appointmentSettings: {
          cancellationHours: 0, // Invalid: too low
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const invalidHigh = {
        workplaceId: new mongoose.Types.ObjectId(),
        appointmentSettings: {
          cancellationHours: 200, // Invalid: too high
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      await expect(new PatientPortalSettings(invalidLow).save()).rejects.toThrow('Cancellation hours must be at least 1');
      await expect(new PatientPortalSettings(invalidHigh).save()).rejects.toThrow('Cancellation hours cannot exceed 168');
    });

    it('should validate time format in appointment slots', async () => {
      const invalidTimeFormat = { ...validSettingsData };
      invalidTimeFormat.appointmentSettings.availableTimeSlots = [
        { dayOfWeek: 1, startTime: '25:00', endTime: '17:00', isActive: true },
      ];

      await expect(new PatientPortalSettings(invalidTimeFormat).save()).rejects.toThrow('Start time must be in HH:mm format');
    });

    it('should validate day of week range', async () => {
      const invalidDayOfWeek = { ...validSettingsData };
      invalidDayOfWeek.appointmentSettings.availableTimeSlots = [
        { dayOfWeek: 8, startTime: '09:00', endTime: '17:00', isActive: true },
      ];

      await expect(new PatientPortalSettings(invalidDayOfWeek).save()).rejects.toThrow('Day of week must be between 0-6');
    });

    it('should validate max attachment size range', async () => {
      const invalidLow = {
        workplaceId: new mongoose.Types.ObjectId(),
        messagingSettings: {
          maxAttachmentSize: 0, // Invalid: too low
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const invalidHigh = {
        workplaceId: new mongoose.Types.ObjectId(),
        messagingSettings: {
          maxAttachmentSize: 100, // Invalid: too high
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      await expect(new PatientPortalSettings(invalidLow).save()).rejects.toThrow('Max attachment size must be at least 1MB');
      await expect(new PatientPortalSettings(invalidHigh).save()).rejects.toThrow('Max attachment size cannot exceed 50MB');
    });

    it('should validate allowed file types', async () => {
      const invalidFileTypes = { ...validSettingsData };
      invalidFileTypes.messagingSettings.allowedFileTypes = ['exe', 'bat'];

      await expect(new PatientPortalSettings(invalidFileTypes).save()).rejects.toThrow('Invalid file type specified');
    });

    it('should validate hex color format', async () => {
      const invalidColor = { ...validSettingsData };
      (invalidColor as any).customization = {
        primaryColor: 'invalid-color',
      };

      await expect(new PatientPortalSettings(invalidColor).save()).rejects.toThrow('Primary color must be a valid hex color');
    });

    it('should validate email format in contact info', async () => {
      const invalidEmail = { ...validSettingsData };
      (invalidEmail as any).customization = {
        contactInfo: {
          email: 'invalid-email',
        },
      };

      await expect(new PatientPortalSettings(invalidEmail).save()).rejects.toThrow('Please enter a valid email');
    });

    it('should validate Nigerian phone format', async () => {
      const invalidPhone = { ...validSettingsData };
      (invalidPhone as any).customization = {
        contactInfo: {
          phone: '08012345678', // Missing +234 prefix
        },
      };

      await expect(new PatientPortalSettings(invalidPhone).save()).rejects.toThrow('Phone must be in Nigerian format');
    });

    it('should validate session timeout range', async () => {
      const invalidLow = { ...validSettingsData };
      (invalidLow as any).securitySettings = {
        sessionTimeout: 20, // Below minimum
      };

      const invalidHigh = { ...validSettingsData };
      (invalidHigh as any).securitySettings = {
        sessionTimeout: 2000, // Above maximum
      };

      await expect(new PatientPortalSettings(invalidLow).save()).rejects.toThrow('Session timeout must be at least 30 minutes');
      await expect(new PatientPortalSettings(invalidHigh).save()).rejects.toThrow('Session timeout cannot exceed 24 hours');
    });
  });

  describe('Pre-save Validation', () => {
    it('should validate appointment time slots order', async () => {
      const invalidTimeOrder = {
        workplaceId: testWorkplaceId,
        appointmentSettings: {
          availableTimeSlots: [
            { dayOfWeek: 1, startTime: '17:00', endTime: '09:00', isActive: true }, // End before start
          ],
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const settings = new PatientPortalSettings(invalidTimeOrder);
      await expect(settings.save()).rejects.toThrow('Invalid time slot: start time must be before end time');
    });

    it('should validate business hours order', async () => {
      const invalidBusinessHours = {
        workplaceId: testWorkplaceId,
        messagingSettings: {
          businessHours: {
            enabled: true,
            timezone: 'Africa/Lagos',
            schedule: [
              { dayOfWeek: 1, startTime: '17:00', endTime: '09:00', isActive: true }, // End before start
            ],
          },
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const settings = new PatientPortalSettings(invalidBusinessHours);
      await expect(settings.save()).rejects.toThrow('Invalid business hours: start time must be before end time');
    });

    it('should validate maintenance mode schedule', async () => {
      const invalidMaintenanceSchedule = {
        workplaceId: testWorkplaceId,
        maintenanceMode: {
          enabled: true,
          scheduledStart: new Date('2024-01-02'),
          scheduledEnd: new Date('2024-01-01'), // End before start
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const settings = new PatientPortalSettings(invalidMaintenanceSchedule);
      await expect(settings.save()).rejects.toThrow('Maintenance mode: scheduled start must be before scheduled end');
    });

    it('should require notification channels when notifications are enabled', async () => {
      const noChannels = {
        workplaceId: testWorkplaceId,
        notificationSettings: {
          appointmentReminders: {
            enabled: true,
            reminderTimes: [24],
            channels: [], // Empty channels array
          },
        },
        createdBy: new mongoose.Types.ObjectId(),
      };

      const settings = new PatientPortalSettings(noChannels);
      await expect(settings.save()).rejects.toThrow('At least one notification channel must be enabled');
    });
  });

  describe('Instance Methods', () => {
    let settings: IPatientPortalSettings;

    beforeEach(async () => {
      settings = await PatientPortalSettings.create({
        workplaceId: testWorkplaceId,
        isEnabled: true,
        allowedFeatures: {
          messaging: true,
          appointments: false,
          medications: true,
          vitals: true,
          labResults: true,
          billing: false,
          educationalResources: true,
          healthRecords: true,
        },
        messagingSettings: {
          businessHours: {
            enabled: true,
            timezone: 'Africa/Lagos',
            schedule: [
              { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }, // Monday
              { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true }, // Tuesday
            ],
          },
        },
        createdBy: new mongoose.Types.ObjectId(),
      });
    });

    it('should check if feature is enabled', () => {
      expect(settings.isFeatureEnabled('messaging')).toBe(true);
      expect(settings.isFeatureEnabled('appointments')).toBe(false);
      expect(settings.isFeatureEnabled('medications')).toBe(true);
    });

    it('should return false for features when portal is disabled', async () => {
      settings.isEnabled = false;
      expect(settings.isFeatureEnabled('messaging')).toBe(false);
      expect(settings.isFeatureEnabled('medications')).toBe(false);
    });

    it('should update feature status', () => {
      settings.updateFeature('appointments', true);
      expect(settings.allowedFeatures.appointments).toBe(true);

      settings.updateFeature('messaging', false);
      expect(settings.allowedFeatures.messaging).toBe(false);
    });

    it('should get business hours for specific day', () => {
      const mondayHours = settings.getBusinessHours(1); // Monday
      expect(mondayHours).toEqual({ startTime: '09:00', endTime: '17:00' });

      const sundayHours = settings.getBusinessHours(0); // Sunday (not configured)
      expect(sundayHours).toBeNull();
    });

    it('should return null for business hours when disabled', () => {
      settings.messagingSettings.businessHours.enabled = false;
      const mondayHours = settings.getBusinessHours(1);
      expect(mondayHours).toBeNull();
    });

    it('should check if current time is within business hours', () => {
      // Mock a Monday at 10:00 AM
      const mondayMorning = new Date('2024-01-01T10:00:00'); // Monday
      jest.spyOn(mondayMorning, 'getDay').mockReturnValue(1);
      jest.spyOn(mondayMorning, 'toTimeString').mockReturnValue('10:00:00 GMT+0100');

      expect(settings.isWithinBusinessHours(mondayMorning)).toBe(true);

      // Mock a Monday at 6:00 PM (after hours)
      const mondayEvening = new Date('2024-01-01T18:00:00');
      jest.spyOn(mondayEvening, 'getDay').mockReturnValue(1);
      jest.spyOn(mondayEvening, 'toTimeString').mockReturnValue('18:00:00 GMT+0100');

      expect(settings.isWithinBusinessHours(mondayEvening)).toBe(false);

      // Mock a Sunday (no business hours)
      const sunday = new Date('2024-01-07T10:00:00');
      jest.spyOn(sunday, 'getDay').mockReturnValue(0);

      expect(settings.isWithinBusinessHours(sunday)).toBe(false);
    });

    it('should return true for business hours when disabled', () => {
      settings.messagingSettings.businessHours.enabled = false;
      const anytime = new Date();
      expect(settings.isWithinBusinessHours(anytime)).toBe(true);
    });

    it('should validate settings and return errors', () => {
      // Create settings with no enabled features
      settings.allowedFeatures = {
        messaging: false,
        appointments: false,
        medications: false,
        vitals: false,
        labResults: false,
        billing: false,
        educationalResources: false,
        healthRecords: false,
      };

      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one feature must be enabled');
    });

    it('should validate appointment settings when appointments enabled', () => {
      settings.allowedFeatures.appointments = true;
      settings.appointmentSettings = {
        allowBooking: true,
        availableTimeSlots: [], // Empty time slots
      } as any;

      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Available time slots must be configured if appointment booking is enabled');
    });

    it('should validate messaging settings when messaging enabled', () => {
      settings.allowedFeatures.messaging = true;
      settings.messagingSettings.allowAttachments = true;
      settings.messagingSettings.allowedFileTypes = []; // Empty file types

      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Allowed file types must be specified if attachments are enabled');
    });

    it('should validate billing settings when billing enabled', () => {
      settings.allowedFeatures.billing = true;
      settings.billingSettings = {
        allowOnlinePayments: true,
        paymentMethods: [], // Empty payment methods
      } as any;

      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Payment methods must be specified if online payments are enabled');
    });

    it('should validate color differences', () => {
      settings.customization = {
        primaryColor: '#FF0000',
        secondaryColor: '#FF0000', // Same as primary
      } as any;

      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Primary and secondary colors should be different');
    });

    it('should return valid when all settings are correct', () => {
      const validation = settings.validateSettings();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Static Methods', () => {
    it('should generate default settings', () => {
      const workplaceId = new mongoose.Types.ObjectId();
      const defaultSettings = (PatientPortalSettings as any).getDefaultSettings(workplaceId);

      expect(defaultSettings.workplaceId).toEqual(workplaceId);
      expect(defaultSettings.isEnabled).toBe(true);
      expect(defaultSettings.requireApproval).toBe(true);
      expect(defaultSettings.allowedFeatures.messaging).toBe(true);
      expect(defaultSettings.allowedFeatures.appointments).toBe(true);
      expect(defaultSettings.allowedFeatures.billing).toBe(false);
      expect(defaultSettings.appointmentSettings.availableTimeSlots).toHaveLength(5); // Monday to Friday
      expect(defaultSettings.messagingSettings.allowedFileTypes).toContain('pdf');
      expect(defaultSettings.notificationSettings.appointmentReminders.enabled).toBe(true);
      expect(defaultSettings.securitySettings.sessionTimeout).toBe(480); // 8 hours
      expect(defaultSettings.billingSettings.currency).toBe('NGN');
    });
  });

  describe('Virtuals', () => {
    let settings: IPatientPortalSettings;

    beforeEach(async () => {
      settings = await PatientPortalSettings.create({
        workplaceId: testWorkplaceId,
        allowedFeatures: {
          messaging: true,
          appointments: true,
          medications: false,
          vitals: true,
          labResults: false,
          billing: false,
          educationalResources: true,
          healthRecords: true,
        },
        messagingSettings: {
          businessHours: {
            enabled: true,
            schedule: [
              { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
              { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: false },
            ],
          },
        },
        createdBy: new mongoose.Types.ObjectId(),
      });
    });

    it('should calculate active features count', () => {
      const activeFeaturesCount = settings.get('activeFeaturesCount');
      expect(activeFeaturesCount).toBe(5); // messaging, appointments, vitals, educationalResources, healthRecords
    });

    it('should check business hours active status', () => {
      const businessHoursActive = settings.get('businessHoursActive');
      expect(businessHoursActive).toBe(true); // Enabled and has at least one active schedule

      settings.messagingSettings.businessHours.enabled = false;
      expect(settings.get('businessHoursActive')).toBe(false);

      settings.messagingSettings.businessHours.enabled = true;
      settings.messagingSettings.businessHours.schedule.forEach(s => s.isActive = false);
      expect(settings.get('businessHoursActive')).toBe(false);
    });
  });

  describe('Indexes and Constraints', () => {
    it('should enforce unique workplaceId constraint', async () => {
      const settings1 = await PatientPortalSettings.create({
        workplaceId: testWorkplaceId,
        createdBy: new mongoose.Types.ObjectId(),
      });

      expect(settings1).toBeDefined();

      // Try to create another settings for the same workplace
      await expect(
        PatientPortalSettings.create({
          workplaceId: testWorkplaceId,
          createdBy: new mongoose.Types.ObjectId(),
        })
      ).rejects.toThrow();
    });

    it('should allow settings for different workplaces', async () => {
      const workplace1 = new mongoose.Types.ObjectId();
      const workplace2 = new mongoose.Types.ObjectId();

      const settings1 = await PatientPortalSettings.create({
        workplaceId: workplace1,
        createdBy: new mongoose.Types.ObjectId(),
      });

      const settings2 = await PatientPortalSettings.create({
        workplaceId: workplace2,
        createdBy: new mongoose.Types.ObjectId(),
      });

      expect(settings1.workplaceId).toEqual(workplace1);
      expect(settings2.workplaceId).toEqual(workplace2);
    });
  });
});