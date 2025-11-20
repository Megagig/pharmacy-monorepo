#!/usr/bin/env node

/**
 * Script to fix user's workplace membership
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixWorkplaceMembership() {
  try {
    console.log('🔧 Fixing user workplace membership...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 User: ${user.email}`);
    console.log(`   - role: ${user.role}`);
    console.log(`   - workplaceId: ${user.workplaceId}`);

    // Find the workplace
    const workplace = await db.collection('workplaces').findOne({
      _id: user.workplaceId
    });

    if (!workplace) {
      console.error('❌ Workplace not found!');
      process.exit(1);
    }

    console.log(`🏢 Workplace: ${workplace.name}`);
    console.log(`   - _id: ${workplace._id}`);

    const currentMembers = workplace.members || [];
    console.log(`👥 Current members: ${currentMembers.length}`);

    // Check if user is already a member
    const existingMembership = currentMembers.find(member => 
      member.userId?.toString() === user._id.toString()
    );

    if (existingMembership) {
      console.log(`✅ User is already a member with role: ${existingMembership.role}`);
      
      // Check if role is correct for diagnostic analytics
      const validRoles = ['Owner', 'Pharmacist'];
      if (validRoles.includes(existingMembership.role)) {
        console.log('✅ User already has a valid role for diagnostic analytics');
        return;
      } else {
        console.log(`⚠️ User role '${existingMembership.role}' is not valid for diagnostic analytics`);
        console.log(`   Valid roles: ${validRoles.join(', ')}`);
        
        // Update the role to Owner
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
        
        console.log('✅ Updated user role to Owner');
      }
    } else {
      console.log('❌ User is NOT a member of the workplace');
      console.log('🔧 Adding user as Owner...');

      // Add user as Owner to the workplace
      const newMember = {
        userId: user._id,
        role: 'Owner',
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

      console.log('✅ Added user as Owner to workplace');
    }

    // Verify the fix
    const updatedWorkplace = await db.collection('workplaces').findOne({
      _id: workplace._id
    });

    const userMembership = updatedWorkplace.members?.find(member => 
      member.userId?.toString() === user._id.toString()
    );

    if (userMembership) {
      console.log(`\\n✅ Verification successful:`);
      console.log(`   - User is member: ✅`);
      console.log(`   - Workplace role: ${userMembership.role}`);
      console.log(`   - Status: ${userMembership.status}`);
      console.log(`   - Joined: ${userMembership.joinedAt}`);

      // Check if role is valid for diagnostic analytics
      const validRoles = ['Owner', 'Pharmacist'];
      const hasValidRole = validRoles.includes(userMembership.role);
      console.log(`   - Valid for diagnostic:analytics: ${hasValidRole ? '✅' : '❌'}`);

      if (hasValidRole) {
        console.log('\\n🎉 User should now have access to diagnostic analytics!');
      }
    } else {
      console.log('\\n❌ Verification failed - user still not found in members');
    }

  } catch (error) {
    console.error('❌ Failed to fix workplace membership:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixWorkplaceMembership()
    .then(() => {
      console.log('Workplace membership fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Workplace membership fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixWorkplaceMembership };