import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import EducationalResource, { IEducationalResource } from '../../models/EducationalResource';
import Patient, { IPatient } from '../../models/Patient';
import Medication, { IMedication } from '../../models/Medication';
import EducationalResourceService, { ResourceSearchOptions, ResourceRecommendationOptions } from '../../services/EducationalResourceService';

describe('EducationalResourceService', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let sampleResources: IEducationalResource[];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Disconnect any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await EducationalResource.deleteMany({});
    await Patient.deleteMany({});
    await Medication.deleteMany({});

    workplaceId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();

    // Create sample educational resources
    sampleResources = await EducationalResource.create([
      {
        title: 'Understanding Diabetes Management',
        description: 'Comprehensive guide to managing diabetes effectively',
        content: 'Detailed content about diabetes management...',
        category: 'condition',
        tags: ['diabetes', 'management', 'health'],
        mediaType: 'article',
        isPublished: true,
        publishedAt: new Date(),
        viewCount: 100,
        downloadCount: 20,
        targetAudience: {
          conditions: ['diabetes', 'type 2 diabetes'],
          ageGroups: ['adult', 'senior'],
        },
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'beginner',
        slug: 'understanding-diabetes-management',
        accessLevel: 'public',
        ratings: {
          averageRating: 4.5,
          totalRatings: 10,
          ratingBreakdown: { 1: 0, 2: 0, 3: 1, 4: 4, 5: 5 },
        },
        workplaceId,
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      },
      {
        title: 'Hypertension Medication Guide',
        description: 'Guide to understanding hypertension medications',
        content: 'Detailed content about hypertension medications...',
        category: 'medication',
        tags: ['hypertension', 'medication', 'blood pressure'],
        mediaType: 'article',
        isPublished: true,
        publishedAt: new Date(),
        viewCount: 75,
        downloadCount: 15,
        targetAudience: {
          conditions: ['hypertension', 'high blood pressure'],
          medications: ['lisinopril', 'amlodipine'],
        },
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'intermediate',
        slug: 'hypertension-medication-guide',
        accessLevel: 'patient_only',
        ratings: {
          averageRating: 4.2,
          totalRatings: 8,
          ratingBreakdown: { 1: 0, 2: 0, 3: 2, 4: 3, 5: 3 },
        },
        workplaceId,
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      },
      {
        title: 'General Wellness Tips',
        description: 'General tips for maintaining good health',
        content: 'Content about general wellness and healthy living...',
        category: 'wellness',
        tags: ['wellness', 'health', 'lifestyle'],
        mediaType: 'video',
        isPublished: true,
        publishedAt: new Date(),
        viewCount: 200,
        downloadCount: 0,
        duration: 600, // 10 minutes
        targetAudience: {
          ageGroups: ['adult'],
        },
        localizedFor: 'general',
        language: 'en',
        difficulty: 'beginner',
        slug: 'general-wellness-tips',
        accessLevel: 'public',
        ratings: {
          averageRating: 4.0,
          totalRatings: 15,
          ratingBreakdown: { 1: 0, 2: 1, 3: 2, 4: 7, 5: 5 },
        },
        workplaceId: null, // Global resource
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      },
      {
        title: 'Unpublished Draft Resource',
        description: 'This is a draft resource',
        content: 'Draft content...',
        category: 'faq',
        tags: ['draft'],
        mediaType: 'article',
        isPublished: false,
        viewCount: 0,
        downloadCount: 0,
        localizedFor: 'nigeria',
        language: 'en',
        difficulty: 'beginner',
        slug: 'unpublished-draft-resource',
        accessLevel: 'public',
        workplaceId,
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      },
    ]);

    // Create sample patient with conditions
    await Patient.create({
      _id: patientId,
      workplaceId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+2348012345678',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'male',
      chronicConditions: [
        {
          condition: 'diabetes',
          diagnosedDate: new Date('2020-01-01'),
          status: 'active',
        },
        {
          condition: 'hypertension',
          diagnosedDate: new Date('2021-01-01'),
          status: 'active',
        },
      ],
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    // Create sample medications
    await Medication.create([
      {
        patient: patientId,
        pharmacist: new mongoose.Types.ObjectId(),
        drugName: 'Lisinopril',
        genericName: 'lisinopril',
        dosageForm: 'tablet',
        instructions: {
          dosage: '10mg',
          frequency: 'once daily',
        },
        status: 'active',
      },
      {
        patient: patientId,
        pharmacist: new mongoose.Types.ObjectId(),
        drugName: 'Metformin',
        genericName: 'metformin',
        dosageForm: 'tablet',
        instructions: {
          dosage: '500mg',
          frequency: 'twice daily',
        },
        status: 'active',
      },
    ]);
  });

  describe('getResources', () => {
    it('should retrieve published resources with default options', async () => {
      const result = await EducationalResourceService.getResources();

      expect(result.resources).toHaveLength(3); // Only published resources
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
      expect(result.resources.every(r => r.isPublished)).toBe(true);
    });

    it('should filter resources by category', async () => {
      const options: ResourceSearchOptions = {
        category: 'condition',
        workplaceId,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].category).toBe('condition');
      expect(result.resources[0].title).toBe('Understanding Diabetes Management');
    });

    it('should filter resources by media type', async () => {
      const options: ResourceSearchOptions = {
        mediaType: 'video',
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].mediaType).toBe('video');
      expect(result.resources[0].title).toBe('General Wellness Tips');
    });

    it('should filter resources by tags', async () => {
      const options: ResourceSearchOptions = {
        tags: ['diabetes'],
        workplaceId,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].tags).toContain('diabetes');
    });

    it('should filter resources by difficulty level', async () => {
      const options: ResourceSearchOptions = {
        difficulty: 'intermediate',
        workplaceId,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].difficulty).toBe('intermediate');
    });

    it('should filter resources by access level', async () => {
      const options: ResourceSearchOptions = {
        accessLevel: 'patient_only',
        workplaceId,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].accessLevel).toBe('patient_only');
    });

    it('should include global resources when workplaceId is provided', async () => {
      const options: ResourceSearchOptions = {
        workplaceId,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(3); // 2 workplace + 1 global
      expect(result.resources.some(r => r.workplaceId === null)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const options: ResourceSearchOptions = {
        limit: 2,
        skip: 0,
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by popularity', async () => {
      const options: ResourceSearchOptions = {
        sortBy: 'popularity',
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources[0].viewCount).toBeGreaterThanOrEqual(result.resources[1].viewCount);
    });

    it('should sort by rating', async () => {
      const options: ResourceSearchOptions = {
        sortBy: 'rating',
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources[0].ratings.averageRating).toBeGreaterThanOrEqual(
        result.resources[1].ratings.averageRating
      );
    });

    it('should handle search query', async () => {
      const options: ResourceSearchOptions = {
        searchQuery: 'diabetes',
      };

      const result = await EducationalResourceService.getResources(options);

      expect(result.resources.length).toBeGreaterThan(0);
      // Note: Text search behavior depends on MongoDB text index
    });
  });

  describe('getResourceBySlug', () => {
    it('should retrieve resource by slug', async () => {
      const resource = await EducationalResourceService.getResourceBySlug(
        'understanding-diabetes-management',
        { workplaceId, incrementView: false }
      );

      expect(resource).toBeTruthy();
      expect(resource!.title).toBe('Understanding Diabetes Management');
      expect(resource!.slug).toBe('understanding-diabetes-management');
    });

    it('should return null for non-existent slug', async () => {
      const resource = await EducationalResourceService.getResourceBySlug(
        'non-existent-slug',
        { workplaceId }
      );

      expect(resource).toBeNull();
    });

    it('should return null for unpublished resource', async () => {
      const resource = await EducationalResourceService.getResourceBySlug(
        'unpublished-draft-resource',
        { workplaceId }
      );

      expect(resource).toBeNull();
    });

    it('should increment view count when requested', async () => {
      const initialResource = await EducationalResource.findOne({ slug: 'understanding-diabetes-management' });
      const initialViewCount = initialResource!.viewCount;

      await EducationalResourceService.getResourceBySlug(
        'understanding-diabetes-management',
        { workplaceId, incrementView: true }
      );

      const updatedResource = await EducationalResource.findOne({ slug: 'understanding-diabetes-management' });
      expect(updatedResource!.viewCount).toBe(initialViewCount + 1);
    });

    it('should check access permissions', async () => {
      const resource = await EducationalResourceService.getResourceBySlug(
        'hypertension-medication-guide',
        { workplaceId, userType: 'public' }
      );

      expect(resource).toBeNull(); // patient_only resource should not be accessible to public
    });

    it('should allow access for appropriate user type', async () => {
      const resource = await EducationalResourceService.getResourceBySlug(
        'hypertension-medication-guide',
        { workplaceId, userType: 'patient' }
      );

      expect(resource).toBeTruthy();
      expect(resource!.accessLevel).toBe('patient_only');
    });
  });

  describe('getRecommendationsForPatient', () => {
    it('should generate recommendations based on patient conditions', async () => {
      const options: ResourceRecommendationOptions = {
        patientId,
        workplaceId,
        limit: 10,
      };

      const recommendations = await EducationalResourceService.getRecommendationsForPatient(options);

      expect(recommendations.length).toBeGreaterThan(0);
      // Should include resources targeting diabetes and hypertension
      const hasConditionTargeted = recommendations.some(r => 
        r.targetAudience?.conditions?.some(c => ['diabetes', 'hypertension'].includes(c))
      );
      expect(hasConditionTargeted).toBe(true);
    });

    it('should include medication-specific recommendations', async () => {
      const options: ResourceRecommendationOptions = {
        patientId,
        workplaceId,
        limit: 10,
      };

      const recommendations = await EducationalResourceService.getRecommendationsForPatient(options);

      // Should include resources targeting patient's medications
      const hasMedicationTargeted = recommendations.some(r => 
        r.targetAudience?.medications?.some(m => ['lisinopril', 'metformin'].includes(m))
      );
      expect(hasMedicationTargeted).toBe(true);
    });

    it('should include general wellness content when requested', async () => {
      const options: ResourceRecommendationOptions = {
        patientId,
        workplaceId,
        limit: 10,
        includeGeneral: true,
      };

      const recommendations = await EducationalResourceService.getRecommendationsForPatient(options);

      const hasGeneralContent = recommendations.some(r => 
        ['wellness', 'prevention', 'nutrition', 'lifestyle'].includes(r.category)
      );
      expect(hasGeneralContent).toBe(true);
    });

    it('should return empty array for non-existent patient', async () => {
      const options: ResourceRecommendationOptions = {
        patientId: new mongoose.Types.ObjectId(),
        workplaceId,
      };

      const recommendations = await EducationalResourceService.getRecommendationsForPatient(options);

      expect(recommendations).toHaveLength(0);
    });

    it('should limit results correctly', async () => {
      const options: ResourceRecommendationOptions = {
        patientId,
        workplaceId,
        limit: 2,
      };

      const recommendations = await EducationalResourceService.getRecommendationsForPatient(options);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('trackResourceView', () => {
    it('should increment view count', async () => {
      const resource = sampleResources[0];
      const initialViewCount = resource.viewCount;

      await EducationalResourceService.trackResourceView(resource._id, {
        patientId,
        workplaceId,
        userType: 'patient',
      });

      const updatedResource = await EducationalResource.findById(resource._id);
      expect(updatedResource!.viewCount).toBe(initialViewCount + 1);
    });

    it('should throw error for non-existent resource', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        EducationalResourceService.trackResourceView(nonExistentId)
      ).rejects.toThrow('Failed to track resource view');
    });
  });

  describe('trackResourceDownload', () => {
    it('should increment download count', async () => {
      const resource = sampleResources[0];
      const initialDownloadCount = resource.downloadCount;

      await EducationalResourceService.trackResourceDownload(resource._id, {
        patientId,
        workplaceId,
        userType: 'patient',
      });

      const updatedResource = await EducationalResource.findById(resource._id);
      expect(updatedResource!.downloadCount).toBe(initialDownloadCount + 1);
    });

    it('should throw error for non-existent resource', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        EducationalResourceService.trackResourceDownload(nonExistentId)
      ).rejects.toThrow('Failed to track resource download');
    });
  });

  describe('getPopularResources', () => {
    it('should return resources sorted by popularity', async () => {
      const resources = await EducationalResourceService.getPopularResources(workplaceId, 10);

      expect(resources.length).toBeGreaterThan(0);
      // Should be sorted by view count descending
      for (let i = 0; i < resources.length - 1; i++) {
        expect(resources[i].viewCount).toBeGreaterThanOrEqual(resources[i + 1].viewCount);
      }
    });

    it('should include global resources when workplaceId provided', async () => {
      const resources = await EducationalResourceService.getPopularResources(workplaceId, 10);

      expect(resources.some(r => r.workplaceId === null)).toBe(true);
    });

    it('should limit results correctly', async () => {
      const resources = await EducationalResourceService.getPopularResources(workplaceId, 2);

      expect(resources.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getResourcesByCategory', () => {
    it('should return resources for specific category', async () => {
      const result = await EducationalResourceService.getResourcesByCategory('condition', {
        workplaceId,
      });

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].category).toBe('condition');
      expect(result.total).toBe(1);
    });

    it('should handle pagination', async () => {
      const result = await EducationalResourceService.getResourcesByCategory('wellness', {
        limit: 1,
        skip: 0,
      });

      expect(result.resources.length).toBeLessThanOrEqual(1);
    });

    it('should filter by language', async () => {
      const result = await EducationalResourceService.getResourcesByCategory('wellness', {
        language: 'en',
      });

      expect(result.resources.every(r => r.language === 'en')).toBe(true);
    });
  });

  describe('getAvailableCategories', () => {
    it('should return categories with counts', async () => {
      const categories = await EducationalResourceService.getAvailableCategories(workplaceId);

      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('category');
      expect(categories[0]).toHaveProperty('count');
      expect(typeof categories[0].count).toBe('number');
    });

    it('should sort categories by count descending', async () => {
      const categories = await EducationalResourceService.getAvailableCategories();

      for (let i = 0; i < categories.length - 1; i++) {
        expect(categories[i].count).toBeGreaterThanOrEqual(categories[i + 1].count);
      }
    });
  });

  describe('getAvailableTags', () => {
    it('should return tags with usage counts', async () => {
      const tags = await EducationalResourceService.getAvailableTags(workplaceId, 50);

      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]).toHaveProperty('tag');
      expect(tags[0]).toHaveProperty('count');
      expect(typeof tags[0].count).toBe('number');
    });

    it('should limit results correctly', async () => {
      const tags = await EducationalResourceService.getAvailableTags(workplaceId, 5);

      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('should sort tags by usage count descending', async () => {
      const tags = await EducationalResourceService.getAvailableTags();

      for (let i = 0; i < tags.length - 1; i++) {
        expect(tags[i].count).toBeGreaterThanOrEqual(tags[i + 1].count);
      }
    });
  });

  describe('rateResource', () => {
    it('should add rating to resource', async () => {
      const resource = sampleResources[0];
      const initialTotalRatings = resource.ratings.totalRatings;

      const updatedResource = await EducationalResourceService.rateResource(
        resource._id,
        5,
        { patientId, workplaceId }
      );

      expect(updatedResource.ratings.totalRatings).toBe(initialTotalRatings + 1);
      expect(updatedResource.ratings.ratingBreakdown[5]).toBe(resource.ratings.ratingBreakdown[5] + 1);
    });

    it('should throw error for invalid rating', async () => {
      const resource = sampleResources[0];

      await expect(
        EducationalResourceService.rateResource(resource._id, 6)
      ).rejects.toThrow('Failed to rate resource');

      await expect(
        EducationalResourceService.rateResource(resource._id, 0)
      ).rejects.toThrow('Failed to rate resource');
    });

    it('should throw error for non-existent resource', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        EducationalResourceService.rateResource(nonExistentId, 5)
      ).rejects.toThrow('Failed to rate resource');
    });
  });

  describe('getResourceAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const analytics = await EducationalResourceService.getResourceAnalytics(workplaceId);

      expect(analytics).toHaveProperty('totalResources');
      expect(analytics).toHaveProperty('publishedResources');
      expect(analytics).toHaveProperty('totalViews');
      expect(analytics).toHaveProperty('totalDownloads');
      expect(analytics).toHaveProperty('averageRating');
      expect(analytics).toHaveProperty('categoryBreakdown');
      expect(analytics).toHaveProperty('popularResources');

      expect(typeof analytics.totalResources).toBe('number');
      expect(typeof analytics.publishedResources).toBe('number');
      expect(Array.isArray(analytics.categoryBreakdown)).toBe(true);
      expect(Array.isArray(analytics.popularResources)).toBe(true);
    });

    it('should filter by date range', async () => {
      const dateRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      };

      const analytics = await EducationalResourceService.getResourceAnalytics(workplaceId, dateRange);

      expect(analytics).toHaveProperty('totalResources');
      expect(typeof analytics.totalResources).toBe('number');
    });

    it('should handle workspace without resources', async () => {
      const emptyWorkplaceId = new mongoose.Types.ObjectId();
      const analytics = await EducationalResourceService.getResourceAnalytics(emptyWorkplaceId);

      expect(analytics.totalResources).toBe(0);
      expect(analytics.publishedResources).toBe(0);
      expect(analytics.totalViews).toBe(0);
      expect(analytics.categoryBreakdown).toHaveLength(0);
      expect(analytics.popularResources).toHaveLength(0);
    });
  });
});