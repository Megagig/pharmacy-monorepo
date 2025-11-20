import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HelpFAQ from '../models/HelpFAQ';
import HelpVideo from '../models/HelpVideo';
import HelpSettings from '../models/HelpSettings';
import { KnowledgeBaseArticle } from '../models/KnowledgeBaseArticle';
import User from '../models/User';

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Atlas connected for seeding');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedHelpData = async () => {
  try {
    // Find or create a super admin user for authoring content
    let superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      superAdmin = await User.create({
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@pharmacycopilot.ng',
        password: 'hashedpassword', // This should be properly hashed
        role: 'super_admin',
        isEmailVerified: true,
      });
    }

    // Clear existing data
    await Promise.all([
      HelpFAQ.deleteMany({}),
      HelpVideo.deleteMany({}),
      KnowledgeBaseArticle.deleteMany({}),
    ]);

    // Seed FAQs
    const faqs = [
      {
        question: 'How do I add a new patient to the system?',
        answer: 'To add a new patient, navigate to the Patients section from the sidebar, click the "Add Patient" button, and fill out the required information including name, contact details, medical information, and insurance details. Make sure to verify the patient\'s identity and obtain necessary consents.',
        category: 'patient-management',
        tags: ['patients', 'add', 'register', 'new patient'],
        status: 'published',
        priority: 'high',
        displayOrder: 1,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 45,
        notHelpfulVotes: 2,
        viewCount: 234,
      },
      {
        question: 'How can I manage my subscription plan?',
        answer: 'You can manage your subscription by going to the Billing & Subscriptions page from the sidebar. There you can view your current plan, upgrade or downgrade, update payment methods, and view billing history. For plan changes, contact our support team for assistance.',
        category: 'billing-payments',
        tags: ['subscription', 'billing', 'payment', 'upgrade'],
        status: 'published',
        priority: 'medium',
        displayOrder: 2,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 38,
        notHelpfulVotes: 1,
        viewCount: 189,
      },
      {
        question: 'What should I do if I forgot my password?',
        answer: 'Click the "Forgot Password" link on the login page. Enter your email address and check your inbox for a password reset link. Follow the instructions in the email to create a new password. If you don\'t receive the email, check your spam folder or contact support.',
        category: 'security-privacy',
        tags: ['password', 'login', 'security', 'reset'],
        status: 'published',
        priority: 'high',
        displayOrder: 1,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 52,
        notHelpfulVotes: 0,
        viewCount: 312,
      },
      {
        question: 'How do I generate reports for my pharmacy?',
        answer: 'Go to the Reports & Analytics section and select the type of report you want to generate (sales, inventory, patients, clinical interventions, etc.). Choose your date range, apply filters as needed, and click "Generate Report". You can export reports in PDF, Excel, or CSV formats.',
        category: 'dashboards-reports',
        tags: ['reports', 'analytics', 'data', 'export'],
        status: 'published',
        priority: 'medium',
        displayOrder: 3,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 29,
        notHelpfulVotes: 3,
        viewCount: 156,
      },
      {
        question: 'How do I conduct a Medication Therapy Review (MTR)?',
        answer: 'Navigate to the MTR section, select a patient, and click "Start New MTR". Follow the structured workflow to review medications, identify drug therapy problems, assess adherence, and document interventions. The system will guide you through each step of the comprehensive review process.',
        category: 'mtr',
        tags: ['mtr', 'medication review', 'therapy', 'clinical'],
        status: 'published',
        priority: 'high',
        displayOrder: 1,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 67,
        notHelpfulVotes: 4,
        viewCount: 298,
      },
      {
        question: 'How do I manage medication inventory and stock levels?',
        answer: 'Use the Inventory & Stock Management module to track medication levels, set reorder points, manage suppliers, and receive low stock alerts. You can scan barcodes, bulk import inventory data, and generate inventory reports. The system automatically tracks dispensing and adjusts stock levels.',
        category: 'inventory-stock',
        tags: ['inventory', 'stock', 'medications', 'reorder'],
        status: 'published',
        priority: 'medium',
        displayOrder: 2,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 41,
        notHelpfulVotes: 6,
        viewCount: 203,
      },
      {
        question: 'How do I use the Drug Information Center?',
        answer: 'Access the Drug Information Center to search for comprehensive drug information, check drug interactions, view contraindications, and access clinical guidelines. Use the search function to find specific medications or browse by therapeutic categories. All information is evidence-based and regularly updated.',
        category: 'drug-information',
        tags: ['drug information', 'interactions', 'contraindications', 'search'],
        status: 'published',
        priority: 'medium',
        displayOrder: 4,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 33,
        notHelpfulVotes: 2,
        viewCount: 178,
      },
      {
        question: 'How do I communicate with patients and healthcare providers?',
        answer: 'Use the Communication Hub to send secure messages, appointment reminders, medication adherence notifications, and clinical updates. You can create message templates, schedule automated messages, and maintain communication logs. All communications are HIPAA-compliant and encrypted.',
        category: 'communication-hub',
        tags: ['communication', 'messages', 'patients', 'providers'],
        status: 'published',
        priority: 'medium',
        displayOrder: 5,
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        helpfulVotes: 28,
        notHelpfulVotes: 1,
        viewCount: 145,
      },
    ];

    await HelpFAQ.insertMany(faqs);

    // Seed Knowledge Base Articles
    const articles = [
      {
        title: 'Getting Started with PharmacyCopilot',
        slug: 'getting-started-pharmacycopilot',
        content: `# Getting Started with PharmacyCopilot

Welcome to PharmacyCopilot, your comprehensive pharmacy management solution. This guide will help you get started with the platform and understand its key features.

## Initial Setup

1. **Account Verification**: Ensure your email is verified and your profile is complete
2. **Workspace Configuration**: Set up your pharmacy details, operating hours, and preferences
3. **User Management**: Add team members and assign appropriate roles
4. **System Integration**: Connect with existing systems and import data

## Key Features Overview

### Patient Management
- Comprehensive patient profiles
- Medical history tracking
- Insurance and billing information
- Communication preferences

### Medication Management
- Prescription processing
- Drug interaction checking
- Inventory tracking
- Adherence monitoring

### Clinical Services
- Medication Therapy Reviews (MTR)
- Clinical interventions
- Diagnostic case management
- Care plan development

## Next Steps

After completing the initial setup, explore each module to familiarize yourself with the interface and workflows. Use the help system and video tutorials for detailed guidance on specific features.`,
        excerpt: 'A comprehensive guide to setting up and getting started with PharmacyCopilot platform',
        category: 'getting-started',
        tags: ['setup', 'onboarding', 'basics', 'introduction'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 456,
        helpfulVotes: 78,
        notHelpfulVotes: 3,
      },
      {
        title: 'Advanced Patient Management Features',
        slug: 'advanced-patient-management',
        content: `# Advanced Patient Management Features

Learn about the advanced features available in the Patient Management module to enhance your patient care and workflow efficiency.

## Patient Profile Management

### Comprehensive Health Records
- Medical history documentation
- Allergy and adverse reaction tracking
- Current medications and therapy plans
- Laboratory results integration

### Communication Tools
- Secure messaging system
- Appointment scheduling
- Medication reminders
- Educational material sharing

## Clinical Documentation

### Progress Notes
- SOAP note templates
- Clinical assessment tools
- Treatment plan documentation
- Outcome tracking

### Care Coordination
- Provider communication
- Referral management
- Care team collaboration
- Transition of care documentation

## Advanced Features

### Population Health Management
- Patient cohort analysis
- Risk stratification
- Preventive care tracking
- Quality measure reporting

### Integration Capabilities
- EHR system integration
- Insurance verification
- Prescription benefit tools
- Clinical decision support

Use these features to provide comprehensive, coordinated care while maintaining efficient workflows.`,
        excerpt: 'Learn about advanced features for managing patient records, care coordination, and clinical documentation',
        category: 'patient-management',
        tags: ['patients', 'advanced', 'clinical', 'documentation'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 234,
        helpfulVotes: 45,
        notHelpfulVotes: 2,
      },
      {
        title: 'Medication Therapy Review (MTR) Best Practices',
        slug: 'mtr-best-practices',
        content: `# Medication Therapy Review (MTR) Best Practices

This guide provides best practices for conducting comprehensive Medication Therapy Reviews using PharmacyCopilot's MTR module.

## Preparation Phase

### Patient Assessment
- Review complete medication list
- Assess medical history and conditions
- Identify potential drug therapy problems
- Gather patient-reported outcomes

### Documentation Review
- Previous MTR reports
- Clinical notes and assessments
- Laboratory results
- Provider communications

## Conducting the MTR

### Systematic Approach
1. **Indication Assessment**: Ensure each medication has a clear indication
2. **Effectiveness Evaluation**: Assess therapeutic outcomes
3. **Safety Review**: Identify adverse effects and interactions
4. **Adherence Assessment**: Evaluate patient compliance

### Drug Therapy Problem Identification
- Unnecessary drug therapy
- Need for additional drug therapy
- Ineffective drug product
- Dosage too low or too high
- Adverse drug reactions
- Drug interactions

## Documentation and Follow-up

### Comprehensive Reporting
- Problem identification and prioritization
- Intervention recommendations
- Patient education provided
- Follow-up plan development

### Quality Assurance
- Peer review processes
- Outcome measurement
- Continuous improvement
- Professional development

Follow these best practices to ensure high-quality, comprehensive MTR services that improve patient outcomes.`,
        excerpt: 'Best practices and guidelines for conducting comprehensive Medication Therapy Reviews',
        category: 'mtr',
        tags: ['mtr', 'best practices', 'clinical', 'medication review'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 189,
        helpfulVotes: 67,
        notHelpfulVotes: 1,
      },
    ];

    await KnowledgeBaseArticle.insertMany(articles);

    // Seed Video Tutorials
    const videos = [
      {
        title: 'PharmacyCopilot Dashboard Overview',
        description: 'Get familiar with your dashboard and key features. Learn how to navigate the interface, customize your workspace, and access important information at a glance.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        category: 'getting-started',
        difficulty: 'beginner',
        duration: '3:45',
        tags: ['dashboard', 'navigation', 'overview', 'basics'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 1247,
        likeCount: 89,
        dislikeCount: 3,
      },
      {
        title: 'Managing Inventory and Stock Levels',
        description: 'Learn how to track and manage your medication inventory, set reorder points, and handle stock alerts effectively.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        category: 'inventory-stock',
        difficulty: 'intermediate',
        duration: '7:22',
        tags: ['inventory', 'stock', 'management', 'reorder'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 892,
        likeCount: 67,
        dislikeCount: 2,
      },
      {
        title: 'Conducting Medication Therapy Reviews',
        description: 'Step-by-step guide to conducting comprehensive MTRs, documenting findings, and creating intervention plans.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        category: 'mtr',
        difficulty: 'advanced',
        duration: '12:15',
        tags: ['mtr', 'clinical', 'review', 'documentation'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 634,
        likeCount: 78,
        dislikeCount: 1,
      },
      {
        title: 'Patient Communication Best Practices',
        description: 'Learn effective communication strategies, how to use the messaging system, and maintain professional patient relationships.',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        category: 'communication-hub',
        difficulty: 'intermediate',
        duration: '8:30',
        tags: ['communication', 'patients', 'messaging', 'best practices'],
        status: 'published',
        authorId: superAdmin._id,
        authorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        viewCount: 445,
        likeCount: 52,
        dislikeCount: 0,
      },
    ];

    await HelpVideo.insertMany(videos);

    // Create or update help settings
    await HelpSettings.findOneAndUpdate(
      {},
      {
        whatsappNumber: '+2348060374755',
        supportEmail: 'support@pharmacycopilot.ng',
        supportPhone: '+234-1-234-5678',
        businessHours: {
          timezone: 'Africa/Lagos',
          monday: { start: '09:00', end: '18:00', isOpen: true },
          tuesday: { start: '09:00', end: '18:00', isOpen: true },
          wednesday: { start: '09:00', end: '18:00', isOpen: true },
          thursday: { start: '09:00', end: '18:00', isOpen: true },
          friday: { start: '09:00', end: '18:00', isOpen: true },
          saturday: { start: '10:00', end: '16:00', isOpen: true },
          sunday: { start: '10:00', end: '16:00', isOpen: false },
        },
        systemStatus: {
          status: 'operational',
          message: 'All PharmacyCopilot services are running normally.',
          lastUpdated: new Date(),
          updatedBy: superAdmin._id,
        },
        features: {
          enableLiveChat: true,
          enableWhatsappSupport: true,
          enableVideoTutorials: true,
          enableFeedbackSystem: true,
          enablePDFGeneration: true,
          enableSearchAnalytics: true,
        },
        customization: {
          primaryColor: '#1976d2',
          secondaryColor: '#dc004e',
          welcomeMessage: 'How can we help you today?',
          footerText: 'Need more help? Contact our support team.',
        },
        lastUpdatedBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    console.log('Help system data seeded successfully!');
    console.log(`- ${faqs.length} FAQs created`);
    console.log(`- ${articles.length} Articles created`);
    console.log(`- ${videos.length} Videos created`);
    console.log('- Help settings configured');

  } catch (error) {
    console.error('Error seeding help data:', error);
  }
};

const main = async () => {
  await connectDB();
  await seedHelpData();
  await mongoose.disconnect();
  console.log('Seeding completed and database disconnected');
};

main().catch(console.error);