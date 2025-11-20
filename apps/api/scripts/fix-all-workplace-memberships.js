#!/usr/bin/env node

/**
 * Script to fix workplace memberships for ALL users
 * Ensures all users are properly members of their workplaces
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixAllWorkplaceMemberships() {
  try {
    console.log('🔧 Fixing workplace memberships for ALL users...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find all users who have a workplaceId
    const usersWithWorkplace = await db.collection('users').find({
      workplaceId: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`👥 Found ${usersWithWorkplace.length} users with workplaces`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;

    for (const user of usersWithWorkplace) {
      try {
        console.log(`\\n👤 Processing user: ${user.email} (${user.role})`);

        // Find their workplace
        const workplace = await db.collection('workplaces').findOne({
          _id: user.workplaceId
        });

        if (!workplace) {
          console.log(`   ⚠️ Workplace not found for user ${user.email}`);
          errorCount++;
          continue;
        }

        const currentMembers = workplace.members || [];
        const existingMembership = currentMembers.find(member => 
          member.userId?.toString() === user._id.toString()
        );

        if (existingMembership) {
          // Check if role is appropriate for diagnostic analytics
          const validRoles = ['Owner', 'Pharmacist'];
          if (validRoles.includes(existingMembership.role)) {
            console.log(`   ✅ Already correct: ${existingMembership.role}`);
            alreadyCorrectCount++;
          } else {
            console.log(`   🔧 Updating role from '${existingMembership.role}' to 'Owner'`);
            
            await db.collection('workplaces').updateOne(
              { 
                _id: workplace._id,
                'members.userId': user._id
              },
              { 
                $set: { 
                  'members.$.role': 'Owner',
                  'members.$.updatedAt': new Date()
                } 
              }
            );
            
            fixedCount++;
          }
        } else {
          console.log(`   🔧 Adding as Owner (was not a member)`);

          // Determine appropriate role based on user role
          let workplaceRole = 'Owner';
          if (user.role === 'pharmacist' || user.role === 'senior_pharmacist') {
            workplaceRole = 'Pharmacist';
          } else if (user.role === 'pharmacy_outlet') {
            workplaceRole = 'Owner';
          }

          const newMember = {
            userId: user._id,
            role: workplaceRole,
            joinedAt: new Date(),
            status: 'active',
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await db.collection('workplaces').updateOne(
            { _id: workplace._id },
            { 
              $push: { members: newMember },
              $set: { updatedAt: new Date() }
            }
          );

          fixedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing user ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\\n📊 Summary:`);
    console.log(`   - Users processed: ${usersWithWorkplace.length}`);
    console.log(`   - Already correct: ${alreadyCorrectCount}`);
    console.log(`   - Fixed: ${fixedCount}`);
    console.log(`   - Errors: ${errorCount}`);

    if (fixedCount > 0) {
      console.log(`\\n✅ Fixed ${fixedCount} workplace memberships!`);
    }

    console.log('\\n🎯 All users should now have proper workplace access for diagnostic analytics.');

  } catch (error) {
    console.error('❌ Failed to fix workplace memberships:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixAllWorkplaceMemberships()
    .then(() => {
      console.log('All workplace memberships fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('All workplace memberships fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllWorkplaceMemberships };