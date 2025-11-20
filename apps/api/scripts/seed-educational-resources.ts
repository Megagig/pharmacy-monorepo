import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import EducationalResource from '../src/models/EducationalResource';
import Workplace from '../src/models/Workplace';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const sampleResources = [
  // Global Resources (workplaceId: null)
  {
    title: 'Understanding Blood Pressure Medications',
    slug: 'understanding-blood-pressure-medications',
    description: 'Learn about different types of blood pressure medications, how they work, and important considerations when taking them.',
    content: 'Comprehensive guide covering ACE inhibitors, beta blockers, calcium channel blockers, and diuretics.',
    category: 'medication',
    mediaType: 'article',
    tags: ['hypertension', 'cardiovascular', 'medication-guide'],
    difficulty: 'beginner',
    duration: 600, // 10 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null, // Global resource
    averageRating: 4.5,
    totalRatings: 120,
    viewCount: 1500,
  },
  {
    title: 'Managing Diabetes: A Complete Guide',
    slug: 'managing-diabetes-complete-guide',
    description: 'Essential information for people living with diabetes, including diet, exercise, and medication management.',
    content: 'Complete guide covering Type 1 and Type 2 diabetes management strategies.',
    category: 'condition',
    mediaType: 'video',
    tags: ['diabetes', 'blood-sugar', 'lifestyle'],
    difficulty: 'intermediate',
    duration: 1200, // 20 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.8,
    totalRatings: 250,
    viewCount: 3200,
  },
  {
    title: 'Heart-Healthy Eating Habits',
    slug: 'heart-healthy-eating-habits',
    description: 'Discover nutritional strategies to support cardiovascular health and reduce heart disease risk.',
    content: 'Dietary guidelines, meal planning tips, and recipes for heart health.',
    category: 'nutrition',
    mediaType: 'article',
    tags: ['heart-health', 'diet', 'prevention'],
    difficulty: 'beginner',
    duration: 480, // 8 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.6,
    totalRatings: 180,
    viewCount: 2100,
  },
  {
    title: 'Exercise and Physical Activity Guidelines',
    slug: 'exercise-physical-activity-guidelines',
    description: 'Learn about recommended exercise levels for different age groups and health conditions.',
    content: 'Evidence-based physical activity recommendations from health organizations.',
    category: 'lifestyle',
    mediaType: 'pdf',
    tags: ['exercise', 'fitness', 'wellness'],
    difficulty: 'beginner',
    duration: 900, // 15 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.4,
    totalRatings: 95,
    viewCount: 1100,
  },
  {
    title: 'Understanding Your Lab Results',
    slug: 'understanding-lab-results',
    description: 'A patient-friendly guide to interpreting common laboratory test results.',
    content: 'Explanations of blood tests, cholesterol levels, kidney function, and more.',
    category: 'prevention',
    mediaType: 'interactive',
    tags: ['lab-tests', 'diagnosis', 'health-monitoring'],
    difficulty: 'intermediate',
    duration: 1500, // 25 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.7,
    totalRatings: 160,
    viewCount: 1800,
  },
  {
    title: 'Medication Safety and Side Effects',
    slug: 'medication-safety-side-effects',
    description: 'Important information about taking medications safely and recognizing side effects.',
    content: 'Safety tips, drug interactions, when to call your doctor, and emergency signs.',
    category: 'medication',
    mediaType: 'article',
    tags: ['medication-safety', 'side-effects', 'drug-interactions'],
    difficulty: 'beginner',
    duration: 720, // 12 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.9,
    totalRatings: 310,
    viewCount: 4500,
  },
  {
    title: 'Asthma Management and Prevention',
    slug: 'asthma-management-prevention',
    description: 'Learn to control asthma symptoms, identify triggers, and use inhalers correctly.',
    content: 'Comprehensive asthma action plan, inhaler techniques, and trigger management.',
    category: 'condition',
    mediaType: 'video',
    tags: ['asthma', 'respiratory', 'inhaler-technique'],
    difficulty: 'intermediate',
    duration: 1080, // 18 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.6,
    totalRatings: 145,
    viewCount: 1950,
  },
  {
    title: 'Healthy Sleep Habits',
    slug: 'healthy-sleep-habits',
    description: 'Improve your sleep quality with evidence-based sleep hygiene practices.',
    content: 'Sleep hygiene tips, creating a sleep-friendly environment, and addressing insomnia.',
    category: 'wellness',
    mediaType: 'audio',
    tags: ['sleep', 'wellness', 'mental-health'],
    difficulty: 'beginner',
    duration: 600, // 10 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.5,
    totalRatings: 220,
    viewCount: 2600,
  },
  {
    title: 'Frequently Asked Questions About Vaccines',
    slug: 'faq-vaccines',
    description: 'Common questions and answers about vaccinations for adults and children.',
    content: 'Vaccine safety, effectiveness, recommended schedules, and addressing concerns.',
    category: 'faq',
    mediaType: 'article',
    tags: ['vaccines', 'immunization', 'prevention'],
    difficulty: 'beginner',
    duration: 540, // 9 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.7,
    totalRatings: 280,
    viewCount: 3400,
  },
  {
    title: 'Stress Management Techniques',
    slug: 'stress-management-techniques',
    description: 'Practical strategies for managing stress and improving mental well-being.',
    content: 'Relaxation techniques, mindfulness, breathing exercises, and stress reduction tips.',
    category: 'wellness',
    mediaType: 'interactive',
    tags: ['stress', 'mental-health', 'mindfulness'],
    difficulty: 'beginner',
    duration: 900, // 15 minutes
    language: 'en',
    localizedFor: 'general',
    accessLevel: 'patient',
    workplaceId: null,
    averageRating: 4.8,
    totalRatings: 340,
    viewCount: 4200,
  },
];

async function seedEducationalResources() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-db';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Clear existing educational resources (optional - comment out to keep existing)
    // await EducationalResource.deleteMany({});
    // console.log('✓ Cleared existing educational resources');

    // Get first 3 workplaces for workspace-specific resources
    const workplaces = await Workplace.find().limit(3);
    console.log(`✓ Found ${workplaces.length} workplaces`);

    // Insert global resources
    console.log('\nCreating global educational resources...');
    for (const resource of sampleResources) {
      const existing = await EducationalResource.findOne({ slug: resource.slug });
      if (!existing) {
        await EducationalResource.create(resource);
        console.log(`  ✓ Created: ${resource.title}`);
      } else {
        console.log(`  - Skipped (exists): ${resource.title}`);
      }
    }

    // Create workspace-specific resources
    if (workplaces.length > 0) {
      console.log('\nCreating workspace-specific educational resources...');
      
      for (const workplace of workplaces) {
        const workspaceResource = {
          title: `${workplace.name} - Patient Medication Guide`,
          slug: `${workplace.name.toLowerCase().replace(/\s+/g, '-')}-medication-guide`,
          description: `Customized medication guide specifically for ${workplace.name} patients.`,
          content: `This guide contains information specific to medications commonly prescribed at ${workplace.name}.`,
          category: 'medication',
          mediaType: 'pdf',
          tags: ['pharmacy-specific', 'medication-guide', workplace.name.toLowerCase()],
          difficulty: 'beginner',
          duration: 600,
          language: 'en',
          localizedFor: 'general',
          accessLevel: 'patient',
          workplaceId: workplace._id,
          averageRating: 4.5,
          totalRatings: 25,
          viewCount: 150,
        };

        const existing = await EducationalResource.findOne({ slug: workspaceResource.slug });
        if (!existing) {
          await EducationalResource.create(workspaceResource);
          console.log(`  ✓ Created workspace resource for: ${workplace.name}`);
        } else {
          console.log(`  - Skipped (exists): ${workplace.name} resource`);
        }
      }
    }

    // Display statistics
    console.log('\n========================================');
    console.log('Seeding Complete!');
    console.log('========================================');
    
    const totalResources = await EducationalResource.countDocuments();
    const globalResources = await EducationalResource.countDocuments({ workplaceId: null });
    const workspaceResources = await EducationalResource.countDocuments({ workplaceId: { $ne: null } });
    
    console.log(`\nTotal Resources: ${totalResources}`);
    console.log(`  - Global Resources: ${globalResources}`);
    console.log(`  - Workspace-specific Resources: ${workspaceResources}`);
    
    console.log('\nCategories:');
    const categories = await EducationalResource.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    categories.forEach(cat => {
      console.log(`  - ${cat._id}: ${cat.count}`);
    });

    console.log('\n✓ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding educational resources:', error);
    process.exit(1);
  }
}

// Run the seeder
seedEducationalResources();
