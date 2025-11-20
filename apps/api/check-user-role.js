const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserRole() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Define schemas inline to avoid module issues
        const userSchema = new mongoose.Schema({}, { strict: false });
        const User = mongoose.models.User || mongoose.model('User', userSchema);

        // Find user
        const user = await User.findOne({ email: { $regex: /megagig/i } });
        if (!user) {
            console.log('❌ User not found');
            process.exit(0);
        }

        console.log('✅ User:', user.email);
        console.log('\n📋 User Details:');
        console.log('- Role:', user.role);
        console.log('- Workplace Role:', user.workplaceRole);
        console.log('- Status:', user.status);
        console.log('- License Status:', user.licenseStatus);
        console.log('- Workplace ID:', user.workplaceId);

        // Check if role matches allowed roles for diagnostics
        const allowedSystemRoles = ['pharmacist', 'senior_pharmacist', 'chief_pharmacist', 'owner', 'super_admin'];
        const allowedWorkplaceRoles = ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'Owner'];

        const hasSystemRole = allowedSystemRoles.includes(user.role);
        const hasWorkplaceRole = user.workplaceRole && allowedWorkplaceRoles.includes(user.workplaceRole);

        console.log('\n🔐 Role Access Check:');
        console.log('- Has valid system role?', hasSystemRole);
        console.log('- Has valid workplace role?', hasWorkplaceRole);
        console.log('- Should have diagnostic access?', hasSystemRole || hasWorkplaceRole);

        if (!hasSystemRole && !hasWorkplaceRole) {
            console.log('\n❌ PROBLEM FOUND:');
            console.log('   Your role does not match diagnostic requirements!');
            console.log('   System role:', user.role);
            console.log('   Workplace role:', user.workplaceRole);
            console.log('   Required system roles:', allowedSystemRoles);
            console.log('   Required workplace roles:', allowedWorkplaceRoles);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkUserRole();
