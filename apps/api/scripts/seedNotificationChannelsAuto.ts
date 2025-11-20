import mongoose from 'mongoose';
import dotenv from 'dotenv';
import NotificationChannel from '../src/models/NotificationChannel';
import Workplace from '../src/models/Workplace';
import User from '../src/models/User';

// Load environment variables
dotenv.config();

interface WorkspaceDoc {
    _id: mongoose.Types.ObjectId;
    name?: string;
}

interface UserDoc {
    _id: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    role: string;
}

async function seedNotificationChannels() {
    try {
        console.log('🌱 Starting notification channels seeding...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            console.error('❌ MONGODB_URI environment variable is not set!');
            console.log('Please set MONGODB_URI in your .env file');
            process.exit(1);
        }

        console.log('📡 Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Try to get an actual workplace from the database
        const workspace = await Workplace.findOne({}).lean() as WorkspaceDoc | null;

        if (!workspace) {
            console.error('❌ No workplace found in database!');
            console.log('Please create a workplace first or run the basic seed script.');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`📍 Using workplace: ${workspace.name || 'Unknown'} (${workspace._id})`);

        // Try to get an admin user
        const adminUser = await User.findOne({
            workplaceId: workspace._id,
            role: { $in: ['admin', 'super_admin'] }
        }).lean() as UserDoc | null;

        const createdBy = adminUser?._id || workspace._id;
        console.log(`👤 Using user ID: ${createdBy}`);

        // Check if channels already exist for this workspace
        const existingChannels = await NotificationChannel.find({
            workplaceId: workspace._id
        });

        if (existingChannels.length > 0) {
            console.log(`⚠️  Found ${existingChannels.length} existing channels for this workspace.`);
            console.log('Channels:');
            existingChannels.forEach((channel) => {
                console.log(`   - ${channel.name} (${channel.type}) - ${channel.enabled ? 'Enabled' : 'Disabled'}`);
            });
            console.log('\nTo re-seed, delete existing channels first.');
            await mongoose.disconnect();
            return;
        }

        // Default notification channels
        const defaultChannels = [
            {
                name: 'Primary Email',
                type: 'email',
                enabled: true,
                config: {
                    provider: 'smtp',
                    fromAddress: 'noreply@pharmacycopilot.com',
                    smtpHost: 'smtp.gmail.com',
                    smtpPort: 587,
                },
                dailyLimit: 10000,
                monthlyLimit: 300000,
                workplaceId: workspace._id,
                createdBy: createdBy,
            },
            {
                name: 'Primary SMS',
                type: 'sms',
                enabled: false,
                config: {
                    provider: 'twilio',
                    fromNumber: '+1234567890',
                },
                dailyLimit: 1000,
                monthlyLimit: 30000,
                workplaceId: workspace._id,
                createdBy: createdBy,
            },
            {
                name: 'Push Notifications',
                type: 'push',
                enabled: true,
                config: {
                    provider: 'firebase',
                },
                dailyLimit: 50000,
                monthlyLimit: 1500000,
                workplaceId: workspace._id,
                createdBy: createdBy,
            },
            {
                name: 'WhatsApp Business',
                type: 'whatsapp',
                enabled: false,
                config: {
                    provider: 'twilio',
                    fromNumber: '+1234567890',
                },
                dailyLimit: 1000,
                monthlyLimit: 30000,
                workplaceId: workspace._id,
                createdBy: createdBy,
            },
        ];

        // Insert channels
        const createdChannels = await NotificationChannel.insertMany(defaultChannels);
        console.log(`\n✅ Successfully created ${createdChannels.length} notification channels:`);

        createdChannels.forEach((channel) => {
            console.log(`   - ${channel.name} (${channel.type}) - ${channel.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`     Daily: 0/${channel.dailyLimit} | Monthly: 0/${channel.monthlyLimit}`);
        });

        console.log('\n🎉 Seeding completed successfully!');
        console.log('You can now view these channels in the Notifications Management UI.');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding notification channels:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the seed function
seedNotificationChannels();
