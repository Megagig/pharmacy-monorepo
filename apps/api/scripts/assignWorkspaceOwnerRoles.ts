import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Role from '../src/models/Role';
import UserRole from '../src/models/UserRole';
import Workplace from '../src/models/Workplace';

dotenv.config();

/**
 * Assign OWNER role to all existing workspace owners
 * This script ensures all pharmacy_outlet users get the OWNER RBAC role
 */

async function assignWorkspaceOwnerRoles() {
    try {
        console.log('🌱 Assigning OWNER roles to workspace owners...\n');

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get the OWNER role
        const ownerRole = await Role.findOne({ name: 'owner', category: 'workplace' });
        if (!ownerRole) {
            throw new Error('OWNER role not found. Please run seedRoles.ts first.');
        }

        // Get the STAFF role (default)
        const staffRole = await Role.findOne({ name: 'staff', category: 'workplace' });
        if (!staffRole) {
            throw new Error('STAFF role not found. Please run seedRoles.ts first.');
        }

        // Find all workspace owners (pharmacy_outlet role)
        const workspaceOwners = await User.find({
            role: 'pharmacy_outlet',
            workplaceId: { $exists: true, $ne: null },
        });

        console.log(`📝 Found ${workspaceOwners.length} workspace owners\n`);

        let assigned = 0;
        let skipped = 0;
        let teamMembersAssigned = 0;

        for (const owner of workspaceOwners) {
            // Check if owner already has this role assigned
            const existingAssignment = await UserRole.findOne({
                userId: owner._id,
                roleId: ownerRole._id,
                workspaceId: owner.workplaceId,
                isActive: true,
            });

            if (existingAssignment) {
                console.log(`  ⏭  Skipped: ${owner.email} (already has OWNER role)`);
                skipped++;
            } else {
                // Assign OWNER role
                await UserRole.create({
                    userId: owner._id,
                    roleId: ownerRole._id,
                    workspaceId: owner.workplaceId,
                    isTemporary: false,
                    isActive: true,
                    assignedBy: owner._id, // Self-assigned during migration
                    assignedAt: new Date(),
                    lastModifiedBy: owner._id,
                    assignmentReason: 'Initial workspace owner role assignment',
                });

                // Update user's assignedRoles array
                if (!owner.assignedRoles.includes(ownerRole._id)) {
                    owner.assignedRoles.push(ownerRole._id);
                    owner.roleLastModifiedAt = new Date();
                    owner.roleLastModifiedBy = owner._id;
                    await owner.save();
                }

                console.log(`  ✓ Assigned OWNER to: ${owner.email}`);
                assigned++;

                // Assign STAFF role to other team members in this workspace
                const teamMembers = await User.find({
                    workplaceId: owner.workplaceId,
                    _id: { $ne: owner._id },
                    role: { $in: ['pharmacist', 'pharmacy_team'] },
                });

                for (const member of teamMembers) {
                    const existingMemberAssignment = await UserRole.findOne({
                        userId: member._id,
                        workspaceId: owner.workplaceId,
                        isActive: true,
                    });

                    if (!existingMemberAssignment) {
                        await UserRole.create({
                            userId: member._id,
                            roleId: staffRole._id,
                            workspaceId: owner.workplaceId,
                            isTemporary: false,
                            isActive: true,
                            assignedBy: owner._id,
                            assignedAt: new Date(),
                            lastModifiedBy: owner._id,
                            assignmentReason: 'Default role assignment for team member',
                        });

                        if (!member.assignedRoles.includes(staffRole._id)) {
                            member.assignedRoles.push(staffRole._id);
                            member.roleLastModifiedAt = new Date();
                            member.roleLastModifiedBy = owner._id;
                            await member.save();
                        }

                        console.log(`    └─ Assigned STAFF to team member: ${member.email}`);
                        teamMembersAssigned++;
                    }
                }
            }
        }

        console.log('\n✅ Role assignment completed!');
        console.log(`   Owners assigned: ${assigned}`);
        console.log(`   Owners skipped: ${skipped}`);
        console.log(`   Team members assigned: ${teamMembersAssigned}`);
        console.log(`   Total assignments: ${assigned + teamMembersAssigned}\n`);

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error assigning workspace owner roles:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

assignWorkspaceOwnerRoles();
