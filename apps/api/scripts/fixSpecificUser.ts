import mongoose from 'mongoose';
import User from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import dotenv from 'dotenv';

dotenv.config();

async function fixSpecificUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || '');
        console.log('Connected to MongoDB\n');

        // Fix the specific user who slipped through
        const user = await User.findOne({ email: 'yacakis834@arqsis.com' });

        if (user && user.workplaceId) {
            // Check if they're a workspace owner
            const isOwner = await Workplace.findOne({
                _id: user.workplaceId,
                ownerId: user._id
            });

            if (!isOwner) {
                console.log(`Fixing ${user.email} - they should be pending, not active`);
                user.status = 'pending';
                await user.save();
                console.log('✅ User status fixed to pending');
            } else {
                console.log(`${user.email} is a workspace owner - status should remain active`);
            }
        }

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
    }
}

fixSpecificUser();