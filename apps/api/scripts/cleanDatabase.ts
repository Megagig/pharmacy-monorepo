import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from '../src/models/User';
import Session from '../src/models/Session';
import Subscription from '../src/models/Subscription';
import Pharmacy from '../src/models/Pharmacy';

// Load environment variables
config();

const cleanDatabase = async (): Promise<void> => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        // Only clean if we're in development or test environment
        if (process.env.NODE_ENV === 'production') {
            console.log('❌ Cannot clean database in production environment');
            return;
        }

        console.log('🧹 Cleaning database...');

        // Delete all users (except keep subscription plans)
        const deletedUsers = await User.deleteMany({});
        console.log(`✅ Deleted ${deletedUsers.deletedCount} users`);

        // Delete all sessions
        const deletedSessions = await Session.deleteMany({});
        console.log(`✅ Deleted ${deletedSessions.deletedCount} sessions`);

        // Delete all subscriptions
        const deletedSubscriptions = await Subscription.deleteMany({});
        console.log(`✅ Deleted ${deletedSubscriptions.deletedCount} subscriptions`);

        // Delete all pharmacies
        const deletedPharmacies = await Pharmacy.deleteMany({});
        console.log(`✅ Deleted ${deletedPharmacies.deletedCount} pharmacies`);

        console.log('✅ Database cleaned successfully!');
        console.log('ℹ️ Subscription plans were preserved');
    } catch (error) {
        console.error('❌ Error cleaning database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the cleanup function if this file is executed directly
if (require.main === module) {
    cleanDatabase();
}

export default cleanDatabase;