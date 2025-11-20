import mongoose from 'mongoose';
import EducationalResource from '../src/models/EducationalResource';
import User from '../src/models/User';
import Workplace from '../src/models/Workplace';
import logger from '../src/utils/logger';

/**
 * Seed script to create sample educational resources with dashboard display enabled
 * This creates a variety of resources to showcase the dashboard integration
 */

const sampleResources = [
  // Patient Dashboard Resources (High Priority - Pinned)
  {
    title: 'Understanding Your Blood Pressure Medication',
    slug: 'understanding-blood-pressure-medication',
    description: 'Learn how blood pressure medications work, common side effects, and when to take them for best results.',
    content: `# Understanding Your Blood Pressure Medication

## What Are Blood Pressure Medications?

Blood pressure medications help control high blood pressure (hypertension) by relaxing blood vessels, reducing fluid in your body, or slowing your heart rate.

## Common Types:
- **ACE Inhibitors** (lisinopril, enalapril)
- **ARBs** (losartan, valsartan)
- **Beta Blockers** (metoprolol, atenolol)
- **Calcium Channel Blockers** (amlodipine, diltiazem)
- **Diuretics** (hydrochlorothiazide, furosemide)

## When to Take Your Medication:
- Most blood pressure medications work best when taken at the same time daily
- Some work better in the morning, others at night - follow your pharmacist's advice
- Never skip doses or stop suddenly without consulting your healthcare provider

## Common Side Effects:
- Dizziness or lightheadedness
- Fatigue
- Dry cough (ACE inhibitors)
- Swollen ankles (calcium channel blockers)

## When to Call Your Pharmacist:
- Blood pressure remains high or drops too low
- Persistent side effects
- Questions about drug interactions
- Need refill or dosage adjustment

## Tips for Success:
✓ Take medication at the same time daily
✓ Monitor your blood pressure at home
✓ Maintain a healthy diet (low sodium)
✓ Exercise regularly
✓ Limit alcohol intake`,
    category: 'medication',
    mediaType: 'article',
    difficulty: 'beginner',
    duration: 300,
    readingTime: 5,
    tags: ['blood pressure', 'hypertension', 'cardiovascular', 'medication management'],
    language: 'en',
    accessLevel: 'patient_only',
    isPublished: true,
    displayLocations: ['patient_dashboard', 'education_page'],
    isPinned: true,
    displayOrder: 10,
    viewCount: 245,
    targetAudience: {
      conditions: ['hypertension', 'cardiovascular disease'],
      ageGroups: ['adult', 'senior']
    }
  },
  
  {
    title: 'Diabetes Management: Essential Daily Tips',
    slug: 'diabetes-management-daily-tips',
    description: 'Practical tips for managing your diabetes effectively every day, including blood sugar monitoring and medication timing.',
    content: `# Diabetes Management: Essential Daily Tips

## Daily Routine for Better Control

### Morning:
1. **Check blood sugar** before breakfast
2. Take medications as prescribed
3. Eat a balanced breakfast with protein and fiber
4. Plan your meals for the day

### Throughout the Day:
- Monitor blood sugar levels as recommended
- Stay hydrated with water
- Take medications on schedule
- Keep healthy snacks available
- Track what you eat

### Evening:
- Check blood sugar before dinner
- Review your day's readings
- Prepare medications for tomorrow
- Get adequate sleep (7-9 hours)

## Blood Sugar Monitoring:
- **Target Range**: 80-130 mg/dL (before meals)
- **After Meals**: Less than 180 mg/dL
- Log all readings to identify patterns

## Medication Tips:
✓ Never skip doses
✓ Store insulin properly (refrigerate)
✓ Rotate injection sites
✓ Check expiration dates
✓ Keep emergency sugar available

## Warning Signs:
⚠️ **Low Blood Sugar (Hypoglycemia)**:
- Shaking, sweating, confusion
- Treat immediately with 15g fast-acting carbs

⚠️ **High Blood Sugar (Hyperglycemia)**:
- Excessive thirst, frequent urination
- Contact your healthcare provider

## Lifestyle Factors:
- Exercise regularly (check blood sugar before/after)
- Maintain healthy weight
- Manage stress
- Quit smoking
- Limit alcohol

**Remember**: Your pharmacist is here to help with medication questions, refills, and diabetes supplies!`,
    category: 'condition',
    mediaType: 'article',
    difficulty: 'intermediate',
    duration: 420,
    readingTime: 7,
    tags: ['diabetes', 'blood sugar', 'chronic disease', 'self-management'],
    
    language: 'en',
    accessLevel: 'patient_only',
    isPublished: true,
    displayLocations: ['patient_dashboard', 'education_page'],
    isPinned: true,
    displayOrder: 20,
    viewCount: 312,
    targetAudience: {
      conditions: ['diabetes', 'type 2 diabetes', 'type 1 diabetes'],
      ageGroups: ['adult', 'senior']
    }
  },

  {
    title: 'Flu Season: What You Need to Know',
    slug: 'flu-season-guide',
    description: 'Everything about flu prevention, symptoms, and when to seek care. Get your flu shot today!',
    content: `# Flu Season: What You Need to Know

## Flu Prevention

### Get Vaccinated:
- **Annual flu shot** is your best protection
- Safe for most people ages 6 months and older
- Available now at your pharmacy
- Takes 2 weeks for full protection

### Daily Prevention:
✓ Wash hands frequently (20 seconds)
✓ Avoid touching face
✓ Stay away from sick people
✓ Disinfect frequently touched surfaces
✓ Maintain healthy immune system

## Recognizing Flu Symptoms:
- Sudden onset fever (100°F or higher)
- Body aches and fatigue
- Dry cough
- Sore throat
- Headache
- Sometimes: nausea, vomiting, diarrhea

## Flu vs. Cold:
| Symptom | Flu | Cold |
|---------|-----|------|
| Onset | Sudden | Gradual |
| Fever | Common, high | Rare |
| Body aches | Severe | Mild |
| Fatigue | Extreme | Mild |
| Duration | 1-2 weeks | 7-10 days |

## Treatment:
- **Rest** and stay hydrated
- **Over-the-counter** medications for symptoms
- **Antiviral drugs** (if prescribed within 48 hours)
- **Isolate** to prevent spreading

## When to Seek Care:
⚠️ Call your doctor if you experience:
- Difficulty breathing
- Chest pain or pressure
- Persistent fever (3+ days)
- Confusion or dizziness
- Severe vomiting

## High-Risk Groups:
- Adults 65 and older
- Pregnant women
- Young children
- Chronic health conditions
- Weakened immune systems

**Get your flu shot today! No appointment needed at most pharmacies.**`,
    category: 'prevention',
    mediaType: 'article',
    difficulty: 'beginner',
    duration: 240,
    readingTime: 4,
    tags: ['flu', 'vaccination', 'prevention', 'seasonal'],
    
    language: 'en',
    accessLevel: 'public',
    isPublished: true,
    displayLocations: ['patient_dashboard', 'workspace_dashboard', 'education_page'],
    isPinned: true,
    displayOrder: 5,
    viewCount: 489,
    targetAudience: {
      ageGroups: ['adult', 'senior', 'child']
    }
  },

  // Workspace Dashboard Resources
  {
    title: 'New FDA Drug Interaction Alert: Warfarin & NSAIDs',
    slug: 'fda-alert-warfarin-nsaids',
    description: 'Critical update on managing patients taking warfarin with over-the-counter NSAIDs. Updated counseling protocols included.',
    content: `# FDA Alert: Warfarin & NSAIDs Drug Interaction

## Alert Summary
**Date**: Current Month
**Severity**: High
**Action Required**: Update patient counseling protocols

## Background:
Recent case reports have highlighted increased bleeding risk when warfarin patients use OTC NSAIDs (ibuprofen, naproxen) without proper monitoring.

## Key Points:
1. **Enhanced Bleeding Risk**: Combined use significantly increases INR
2. **Common OTC Products**: Many patients don't realize they're taking NSAIDs
3. **Alternative Options**: Acetaminophen preferred for pain relief

## Counseling Protocol:
✓ Ask ALL warfarin patients about OTC pain reliever use
✓ Explain bleeding risk in clear terms
✓ Recommend acetaminophen as first-line
✓ If NSAID needed, ensure close INR monitoring
✓ Document counseling in patient record

## Patient Education Points:
- Avoid OTC ibuprofen, naproxen without consulting pharmacist
- Read labels on combination cold/flu products
- Report unusual bruising, bleeding immediately
- Bring all medications to pharmacy consultations

## Documentation Requirements:
- Note counseling in profile
- Flag high-risk patients
- Schedule follow-up INR checks
- Coordinate with prescriber if NSAID needed

## Resources:
- FDA Safety Communication [link]
- Updated counseling handout [link]
- Sample documentation template [link]`,
    category: 'medication',
    mediaType: 'article',
    difficulty: 'advanced',
    duration: 360,
    readingTime: 6,
    tags: ['drug interaction', 'warfarin', 'NSAIDs', 'FDA alert', 'patient safety'],
    
    language: 'en',
    accessLevel: 'staff_only',
    isPublished: true,
    displayLocations: ['workspace_dashboard', 'education_page'],
    isPinned: true,
    displayOrder: 1,
    viewCount: 156,
    targetAudience: {
      ageGroups: ['adult', 'senior']
    }
  },

  {
    title: 'Immunization Administration Best Practices 2024',
    slug: 'immunization-best-practices-2024',
    description: 'Updated protocols for vaccine administration, storage, and documentation. Includes new CDC guidelines.',
    content: `# Immunization Best Practices 2024

## Updated CDC Guidelines

### Pre-Administration:
1. **Screening**:
   - Review immunization history
   - Check contraindications/precautions
   - Assess for allergies
   - Verify patient identification

2. **Storage Verification**:
   - Confirm proper temperature (35-46°F for refrigerated)
   - Check expiration dates
   - Inspect for discoloration or particles
   - Document lot numbers

### Administration Technique:

**Intramuscular (IM) Injections:**
- **Site Selection**:
  - Adults: Deltoid (preferred) or vastus lateralis
  - Infants/toddlers: Vastus lateralis (thigh)
- **Needle Size**:
  - Adults: 22-25 gauge, 1-1.5 inch
  - Children: 22-25 gauge, 5/8-1 inch
- **Angle**: 90 degrees to skin

**Subcutaneous (SC) Injections:**
- Outer triceps or thigh
- 23-25 gauge, 5/8 inch needle
- 45-degree angle

### Post-Administration:
✓ Observe patient for 15 minutes
✓ Provide VIS (Vaccine Information Statement)
✓ Document administration immediately
✓ Schedule follow-up doses if applicable
✓ Report adverse events to VAERS

## Common Vaccines & Schedules:

**COVID-19**: Updated boosters per CDC
**Influenza**: Annual, starting September
**Tdap**: Every 10 years
**Shingles**: 2 doses, ages 50+
**Pneumococcal**: Per ACIP schedule

## Documentation Requirements:
- Date of administration
- Vaccine name, manufacturer, lot number
- Expiration date
- Site and route
- VIS edition date
- Administrator name/credentials
- Patient consent

## Adverse Event Management:
- **Immediate Reactions**: Have epinephrine available
- **Vasovagal Response**: Most common, keep patient seated
- **Anaphylaxis Protocol**: Call 911, administer epinephrine
- **Report All Significant Events**: VAERS within 24-48 hours

## Billing & Documentation:
- CPT codes for administration
- Record in immunization registry
- Insurance verification
- Proper claim submission

**Review protocols monthly. Attend annual certification updates.**`,
    category: 'wellness',
    mediaType: 'article',
    difficulty: 'advanced',
    duration: 600,
    readingTime: 10,
    tags: ['vaccination', 'immunization', 'protocols', 'CDC guidelines', 'staff training'],
    
    language: 'en',
    accessLevel: 'staff_only',
    isPublished: true,
    displayLocations: ['workspace_dashboard', 'education_page'],
    isPinned: false,
    displayOrder: 50,
    viewCount: 89,
    targetAudience: {
      ageGroups: ['adult', 'senior', 'child']
    }
  },

  // Patient Dashboard - General Health
  {
    title: 'Healthy Eating on a Budget: Meal Planning Tips',
    slug: 'healthy-eating-budget-tips',
    description: 'Learn how to eat nutritious meals without breaking the bank. Includes meal planning strategies and shopping tips.',
    content: `# Healthy Eating on a Budget

## Smart Shopping Strategies

### Plan Ahead:
1. **Make a weekly meal plan**
2. **Create a shopping list** and stick to it
3. **Check for sales** and use coupons
4. **Buy generic brands** (same quality, lower cost)
5. **Shop seasonal produce**

### Budget-Friendly Protein:
- **Eggs**: Versatile and inexpensive
- **Canned tuna/salmon**: Rich in omega-3s
- **Dried beans and lentils**: High in fiber
- **Chicken thighs**: More affordable than breasts
- **Peanut butter**: Shelf-stable protein source

### Affordable Vegetables:
- Frozen vegetables (just as nutritious!)
- Carrots, cabbage, and onions
- Seasonal produce on sale
- Canned tomatoes (no added salt)
- Buy in bulk when possible

### Whole Grains:
- Brown rice (buy in large bags)
- Oats (breakfast and baking)
- Whole wheat pasta
- Popcorn (healthy snack!)

## Meal Planning Tips:

**Monday**: Slow cooker chili with beans
**Tuesday**: Egg fried rice with frozen vegetables
**Wednesday**: Baked chicken thighs with roasted vegetables
**Thursday**: Pasta with canned tomato sauce and vegetables
**Friday**: Bean and cheese quesadillas
**Saturday**: Homemade pizza with whole wheat crust
**Sunday**: Large salad with tuna or hard-boiled eggs

### Batch Cooking:
- Cook once, eat multiple times
- Freeze portions for busy days
- Use leftovers creatively
- Prep vegetables on weekends

### Reduce Food Waste:
✓ Store produce properly
✓ Use oldest items first
✓ Freeze leftovers
✓ Make soup with vegetable scraps
✓ Check expiration dates regularly

## Cost-Saving Tips:
- Drink water instead of sugary drinks
- Limit eating out
- Pack lunches
- Buy store brands
- Use loyalty programs
- Compare unit prices

## Nutrition on a Budget:
You don't need expensive "superfoods" to be healthy!
- Water is free and the best beverage
- Frozen vegetables are nutritious and affordable
- Dried beans are protein powerhouses
- Eggs are nature's multivitamin

**Remember**: Healthy eating doesn't have to be expensive. With planning and smart choices, you can nourish your body affordably!`,
    category: 'nutrition',
    mediaType: 'article',
    difficulty: 'beginner',
    duration: 360,
    readingTime: 6,
    tags: ['nutrition', 'budget', 'meal planning', 'healthy eating'],
    
    language: 'en',
    accessLevel: 'public',
    isPublished: true,
    displayLocations: ['patient_dashboard', 'education_page'],
    isPinned: false,
    displayOrder: 30,
    viewCount: 178
  },

  {
    title: 'Better Sleep: A Guide to Healthy Sleep Habits',
    slug: 'healthy-sleep-habits-guide',
    description: 'Improve your sleep quality with evidence-based strategies. Learn about sleep hygiene and when to seek help.',
    content: `# Better Sleep: A Guide to Healthy Sleep Habits

## Why Sleep Matters

Quality sleep is essential for:
- Physical health and healing
- Mental health and mood
- Memory and concentration
- Immune system function
- Weight management

**Most adults need 7-9 hours per night.**

## Sleep Hygiene Basics

### Create a Sleep Schedule:
- Go to bed at the same time nightly
- Wake up at the same time daily
- Yes, even on weekends!
- Your body loves routine

### Optimize Your Bedroom:
✓ **Dark**: Use blackout curtains
✓ **Quiet**: White noise or earplugs if needed
✓ **Cool**: 60-67°F is ideal
✓ **Comfortable**: Good mattress and pillows
✓ **Reserved**: Bedroom is for sleep (and intimacy) only

### Evening Routine (2-3 hours before bed):
- Dim lights
- Avoid screens (blue light disrupts melatonin)
- Read a book
- Take a warm bath
- Light stretching or meditation
- Avoid heavy meals

### Lifestyle Factors:

**Do:**
- Exercise regularly (but not close to bedtime)
- Get morning sunlight exposure
- Manage stress with relaxation techniques
- Keep a worry journal

**Don't:**
- Consume caffeine after 2 PM
- Drink alcohol close to bedtime (disrupts sleep cycles)
- Take long naps (limit to 20-30 minutes)
- Use tobacco products
- Exercise vigorously within 3 hours of bedtime

## Common Sleep Problems:

### Difficulty Falling Asleep:
- Try the "4-7-8" breathing technique
- Progressive muscle relaxation
- If awake >20 minutes, get up and do quiet activity

### Frequent Waking:
- Evaluate medications with pharmacist
- Check for sleep apnea symptoms
- Limit evening fluids
- Address anxiety/stress

### Early Morning Waking:
- May indicate depression
- Check medication timing
- Ensure adequate sleep time

## When to See a Healthcare Provider:

⚠️ Seek help if you have:
- Loud snoring or gasping during sleep
- Persistent insomnia (3+ nights/week for 3+ months)
- Excessive daytime sleepiness
- Restless legs or periodic limb movements
- Concerns about sleep medication side effects

## Medications & Sleep:

**Sleep Aids:**
- Use short-term only
- Discuss with pharmacist about:
  - Proper timing
  - Drug interactions
  - Side effects (morning grogginess)
  - Dependency risk

**Medications That Affect Sleep:**
- Some blood pressure medications
- Steroids
- Antidepressants
- Decongestants
- Some pain medications

**Talk to your pharmacist if you think your medication is affecting your sleep!**

## Natural Sleep Support:
- Melatonin (discuss dosing with pharmacist)
- Magnesium
- Chamomile tea
- Lavender aromatherapy

**Remember**: Good sleep habits take time to develop. Be patient and consistent!`,
    category: 'wellness',
    mediaType: 'article',
    difficulty: 'beginner',
    duration: 480,
    readingTime: 8,
    tags: ['sleep', 'insomnia', 'sleep hygiene', 'wellness'],
    
    language: 'en',
    accessLevel: 'public',
    isPublished: true,
    displayLocations: ['patient_dashboard', 'education_page'],
    isPinned: false,
    displayOrder: 40,
    viewCount: 203
  }
];

async function seedDashboardResources() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find first admin user or any user to be the creator
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      logger.warn('No admin user found, looking for any user...');
      adminUser = await User.findOne();
      if (!adminUser) {
        logger.error('No users found in database. Please create a user first.');
        process.exit(1);
      }
      logger.info(`Using user: ${adminUser.email} as creator`);
    }

    // Get first workplace (optional, some resources are global)
    const workplace = await Workplace.findOne();

    logger.info(`Creating ${sampleResources.length} sample educational resources...`);

    let successCount = 0;
    let errorCount = 0;

    for (const resourceData of sampleResources) {
      try {
        // Check if resource already exists
        const existingResource = await EducationalResource.findOne({ slug: resourceData.slug });
        
        if (existingResource) {
          logger.info(`Resource "${resourceData.title}" already exists, skipping...`);
          continue;
        }

        // Create resource
        const resource = new EducationalResource({
          ...resourceData,
          workplaceId: workplace?._id || null, // Some global, some workspace-specific
          createdBy: adminUser._id,
          isDeleted: false,
          publishedAt: new Date(),
          ratings: {
            averageRating: 4.5 + Math.random() * 0.5, // Random rating 4.5-5.0
            totalRatings: Math.floor(Math.random() * 50) + 10
          }
        });

        await resource.save();
        successCount++;
        logger.info(`✓ Created: "${resourceData.title}"`);
        
      } catch (error) {
        errorCount++;
        logger.error(`✗ Error creating "${resourceData.title}":`, error);
      }
    }

    logger.info('\n=== Seeding Complete ===');
    logger.info(`✓ Successfully created: ${successCount} resources`);
    logger.info(`✗ Errors: ${errorCount}`);
    logger.info('\nResources by display location:');
    
    const patientDashboard = await EducationalResource.countDocuments({
      displayLocations: 'patient_dashboard',
      isPublished: true
    });
    const workspaceDashboard = await EducationalResource.countDocuments({
      displayLocations: 'workspace_dashboard',
      isPublished: true
    });
    const educationPage = await EducationalResource.countDocuments({
      displayLocations: 'education_page',
      isPublished: true
    });

    logger.info(`  Patient Dashboard: ${patientDashboard} resources`);
    logger.info(`  Workspace Dashboard: ${workspaceDashboard} resources`);
    logger.info(`  Education Page: ${educationPage} resources`);

  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the seeding
seedDashboardResources()
  .then(() => {
    logger.info('Seeding script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Seeding script failed:', error);
    process.exit(1);
  });
