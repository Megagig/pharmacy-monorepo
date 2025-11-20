import mongoose from 'mongoose';
import { config } from 'dotenv';
import HealthBlogPost from '../models/HealthBlogPost';
import User from '../models/User';
import connectDB from '../config/db';

config();

// Function to get or create an admin user for blog posts
async function getAdminUser() {
    try {
        // Try to find an existing super admin
        let adminUser = await User.findOne({ role: 'superadmin' });

        if (!adminUser) {
            // Try to find any admin
            adminUser = await User.findOne({ role: 'admin' });
        }

        if (!adminUser) {
            // Try to find any user
            adminUser = await User.findOne({});
        }

        if (!adminUser) {
            console.log('⚠️  No users found in database. Creating a blog author user...');
            // Create a basic user for blog authorship
            adminUser = await User.create({
                email: 'blog@pharmacare.com',
                password: 'TempPassword123!',
                firstName: 'PharmaCare',
                lastName: 'Team',
                role: 'admin',
                phoneNumber: '0000000000',
                isEmailVerified: true,
                isActive: true
            });
        }

        return adminUser;
    } catch (error) {
        console.error('Error getting admin user:', error);
        throw error;
    }
}

const createSampleBlogPosts = (userId: mongoose.Types.ObjectId) => [
    {
        title: 'Understanding Your Medications: A Complete Guide',
        slug: 'understanding-your-medications-complete-guide',
        excerpt: 'Learn how to manage your medications effectively, understand dosages, and recognize potential side effects.',
        content: `
      <h2>Introduction</h2>
      <p>Managing medications is crucial for maintaining good health. This comprehensive guide will help you understand your prescriptions better.</p>
      
      <h3>Key Points to Remember</h3>
      <ul>
        <li>Always take medications as prescribed</li>
        <li>Keep a list of all your medications</li>
        <li>Understand potential side effects</li>
        <li>Know when to take each medication</li>
        <li>Store medications properly</li>
      </ul>
      
      <h3>Common Medication Questions</h3>
      <p>Here are answers to frequently asked questions about medication management...</p>
    `,
        category: 'medication',
        tags: ['medication', 'safety', 'prescription', 'health'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3683041/pexels-photo-3683041.jpeg',
            alt: 'Medications and prescription bottle'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        readTime: 8,
        viewCount: 0,
        seo: {
            metaTitle: 'Understanding Your Medications: A Complete Guide',
            metaDescription: 'Learn how to manage your medications effectively, understand dosages, and recognize potential side effects.',
            keywords: ['medication management', 'prescription safety', 'health tips']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'The Importance of Medication Adherence',
        slug: 'importance-of-medication-adherence',
        excerpt: 'Discover why taking medications as prescribed is crucial for treatment success and overall health outcomes.',
        content: `
      <h2>Why Medication Adherence Matters</h2>
      <p>Taking your medications as prescribed is one of the most important things you can do for your health.</p>
      
      <h3>Benefits of Adherence</h3>
      <ul>
        <li>Better health outcomes</li>
        <li>Reduced hospitalizations</li>
        <li>Lower healthcare costs</li>
        <li>Improved quality of life</li>
      </ul>
      
      <h3>Tips for Staying on Track</h3>
      <p>Use medication reminders, pill organizers, and set routines to help remember your doses.</p>
    `,
        category: 'medication',
        tags: ['adherence', 'compliance', 'medication', 'health'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3786126/pexels-photo-3786126.jpeg',
            alt: 'Person organizing medications'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        readTime: 6,
        viewCount: 0,
        seo: {
            keywords: ['medication adherence', 'compliance', 'health']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Managing Chronic Conditions with Pharmacy Support',
        slug: 'managing-chronic-conditions-pharmacy-support',
        excerpt: 'How your pharmacist can be your partner in managing long-term health conditions like diabetes and hypertension.',
        content: `
      <h2>Your Pharmacist: A Partner in Chronic Disease Management</h2>
      <p>Living with a chronic condition requires ongoing care and support. Your pharmacist plays a vital role.</p>
      
      <h3>Services Your Pharmacist Can Provide</h3>
      <ul>
        <li>Medication therapy management</li>
        <li>Blood pressure monitoring</li>
        <li>Diabetes education and monitoring</li>
        <li>Immunizations and vaccinations</li>
        <li>Health screenings</li>
      </ul>
    `,
        category: 'chronic_diseases',
        tags: ['chronic disease', 'diabetes', 'hypertension', 'pharmacy services'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg',
            alt: 'Pharmacist consultation'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: true,
        readTime: 7,
        viewCount: 0,
        seo: {
            keywords: ['chronic disease', 'pharmacy services', 'diabetes']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: '10 Tips for a Healthier Lifestyle',
        slug: '10-tips-healthier-lifestyle',
        excerpt: 'Simple, practical steps you can take today to improve your overall health and wellbeing.',
        content: `
      <h2>Small Changes, Big Impact</h2>
      <p>You don't need a complete lifestyle overhaul to improve your health. Start with these simple tips.</p>
      
      <h3>Our Top 10 Health Tips</h3>
      <ol>
        <li>Stay hydrated - drink 8 glasses of water daily</li>
        <li>Get 7-8 hours of sleep each night</li>
        <li>Exercise for at least 30 minutes daily</li>
        <li>Eat a balanced diet with plenty of fruits and vegetables</li>
        <li>Manage stress through meditation or yoga</li>
        <li>Avoid smoking and limit alcohol</li>
        <li>Regular health check-ups</li>
        <li>Take medications as prescribed</li>
        <li>Stay socially connected</li>
        <li>Practice good hygiene</li>
      </ol>
    `,
        category: 'wellness',
        tags: ['lifestyle', 'wellness', 'prevention', 'health tips'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
            alt: 'Healthy lifestyle choices'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 5,
        viewCount: 0,
        seo: {
            keywords: ['wellness', 'healthy lifestyle', 'prevention']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Understanding Antibiotic Resistance',
        slug: 'understanding-antibiotic-resistance',
        excerpt: 'Learn why antibiotic resistance is a growing concern and how you can help prevent it.',
        content: `
      <h2>What is Antibiotic Resistance?</h2>
      <p>Antibiotic resistance occurs when bacteria evolve to resist the drugs designed to kill them.</p>
      
      <h3>How to Help Prevent Resistance</h3>
      <ul>
        <li>Only use antibiotics when prescribed</li>
        <li>Complete the full course of treatment</li>
        <li>Never share antibiotics</li>
        <li>Don't save antibiotics for later</li>
        <li>Practice good hygiene to prevent infections</li>
      </ul>
    `,
        category: 'preventive_care',
        tags: ['antibiotics', 'resistance', 'infection', 'prevention'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3683056/pexels-photo-3683056.jpeg',
            alt: 'Antibiotics and prescription'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 6,
        viewCount: 0,
        seo: {
            keywords: ['antibiotic resistance', 'infection prevention']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Vaccination: Protecting Yourself and Others',
        slug: 'vaccination-protecting-yourself-others',
        excerpt: 'Why vaccines are important for individual and community health protection.',
        content: `
      <h2>The Power of Vaccination</h2>
      <p>Vaccines are one of the most effective ways to prevent serious diseases and protect public health.</p>
      
      <h3>Common Vaccines for Adults</h3>
      <ul>
        <li>Influenza (Flu) - annually</li>
        <li>COVID-19 and boosters</li>
        <li>Pneumococcal</li>
        <li>Shingles (Herpes Zoster)</li>
        <li>Tdap (Tetanus, Diphtheria, Pertussis)</li>
      </ul>
      
      <h3>Available at Your Pharmacy</h3>
      <p>Most pharmacies offer vaccination services - ask your pharmacist about scheduling.</p>
    `,
        category: 'preventive_care',
        tags: ['vaccination', 'immunization', 'prevention', 'pharmacy services'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg',
            alt: 'Vaccination syringe'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 5,
        viewCount: 0,
        seo: {
            keywords: ['vaccination', 'immunization', 'disease prevention']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Managing Seasonal Allergies',
        slug: 'managing-seasonal-allergies',
        excerpt: 'Tips and treatments for dealing with seasonal allergy symptoms.',
        content: `
      <h2>Relief from Seasonal Allergies</h2>
      <p>Don't let spring or fall allergies keep you indoors. Learn how to manage symptoms effectively.</p>
      
      <h3>Common Symptoms</h3>
      <ul>
        <li>Sneezing and runny nose</li>
        <li>Itchy, watery eyes</li>
        <li>Congestion</li>
        <li>Coughing</li>
        <li>Fatigue</li>
      </ul>
      
      <h3>Treatment Options</h3>
      <p>From antihistamines to nasal sprays, your pharmacist can recommend the best options for you.</p>
    `,
        category: 'wellness',
        tags: ['allergies', 'seasonal', 'symptoms', 'treatment'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/6942026/pexels-photo-6942026.jpeg',
            alt: 'Person with seasonal allergies'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 6,
        viewCount: 0,
        seo: {
            keywords: ['seasonal allergies', 'allergy treatment', 'symptoms']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Heart Health: Prevention and Management',
        slug: 'heart-health-prevention-management',
        excerpt: 'Essential tips for maintaining a healthy heart and managing cardiovascular conditions.',
        content: `
      <h2>Your Heart Health Matters</h2>
      <p>Heart disease is preventable. Learn how to keep your heart healthy.</p>
      
      <h3>Key Prevention Strategies</h3>
      <ul>
        <li>Regular physical activity</li>
        <li>Healthy diet low in saturated fats</li>
        <li>Maintain healthy weight</li>
        <li>Don't smoke</li>
        <li>Manage stress</li>
        <li>Control blood pressure and cholesterol</li>
      </ul>
      
      <h3>Know Your Numbers</h3>
      <p>Regular monitoring of blood pressure, cholesterol, and blood sugar is essential.</p>
    `,
        category: 'chronic_diseases',
        tags: ['heart health', 'cardiovascular', 'prevention', 'chronic disease'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg',
            alt: 'Heart health concept'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 7,
        viewCount: 0,
        seo: {
            keywords: ['heart health', 'cardiovascular disease', 'prevention']
        },
        createdBy: userId,
        updatedBy: userId
    },
    {
        title: 'Diabetes Management: Beyond Medication',
        slug: 'diabetes-management-beyond-medication',
        excerpt: 'Comprehensive approach to managing diabetes through lifestyle, diet, and medication.',
        content: `
      <h2>Living Well with Diabetes</h2>
      <p>Diabetes management involves more than just taking medication. A holistic approach is key.</p>
      
      <h3>Essential Management Components</h3>
      <ul>
        <li>Blood glucose monitoring</li>
        <li>Healthy eating plan</li>
        <li>Regular physical activity</li>
        <li>Medication adherence</li>
        <li>Regular check-ups</li>
        <li>Foot care</li>
        <li>Eye exams</li>
      </ul>
      
      <h3>Your Pharmacy Team Can Help</h3>
      <p>Pharmacists provide diabetes education, monitoring services, and medication consultations.</p>
    `,
        category: 'chronic_diseases',
        tags: ['diabetes', 'blood sugar', 'chronic disease', 'lifestyle'],
        author: {
            id: userId,
            name: 'PharmaCare Team',
        },
        featuredImage: {
            url: 'https://images.pexels.com/photos/3683056/pexels-photo-3683056.jpeg',
            alt: 'Diabetes management'
        },
        status: 'published',
        publishedAt: new Date(),
        isFeatured: false,
        readTime: 8,
        viewCount: 0,
        seo: {
            keywords: ['diabetes management', 'blood sugar', 'chronic disease']
        },
        createdBy: userId,
        updatedBy: userId
    }
];


async function seedBlogPosts() {
    try {
        console.log('🌱 Starting blog posts seeding...');

        // Connect to database
        await connectDB();
        console.log('✅ Database connected');

        // Get admin user for blog authorship
        const adminUser = await getAdminUser();
        console.log(`✅ Using user: ${adminUser.email} (${adminUser._id})`);

        // Clear existing blog posts
        const deleteResult = await HealthBlogPost.deleteMany({});
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing blog posts`);

        // Create sample blog posts with the admin user ID
        const sampleBlogPosts = createSampleBlogPosts(adminUser._id);

        // Insert sample blog posts
        const createdPosts = await HealthBlogPost.insertMany(sampleBlogPosts);
        console.log(`✅ Created ${createdPosts.length} blog posts`);

        console.log('\n📊 Blog Posts Summary:');
        console.log(`   - Featured Posts: ${createdPosts.filter((p: any) => p.isFeatured).length}`);
        console.log(`   - Regular Posts: ${createdPosts.filter((p: any) => !p.isFeatured).length}`);
        console.log(`   - Categories: ${[...new Set(createdPosts.map((p: any) => p.category))].join(', ')}`);

        console.log('\n🎉 Blog posts seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding blog posts:', error);
        process.exit(1);
    }
}

// Run the seeder
seedBlogPosts();

