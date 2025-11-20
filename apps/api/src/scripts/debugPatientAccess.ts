import mongoose from 'mongoose';
import Patient from '../models/Patient';
import User from '../models/User';
import DiagnosticCase from '../models/DiagnosticCase';
import logger from '../utils/logger';

async function debugPatientAccess() {
    try {
        const patientId = '68ee8f3f78edb485fc1bbcd3';
        logger.info(`🔍 Debugging patient access for ID: ${patientId}`);

        // Check if the patient exists at all
        const patient = await Patient.findById(patientId);
        logger.info('Patient exists:', patient ? 'YES' : 'NO');

        if (patient) {
            logger.info('Patient details:', {
                _id: patient._id,
                firstName: patient.firstName,
                lastName: patient.lastName,
                workplaceId: patient.workplaceId,
                isDeleted: patient.isDeleted,
                createdAt: patient.createdAt
            });

            // Check all users to see who might have access to this workplace
            const usersInWorkplace = await User.find({ 
                workplaceId: patient.workplaceId,
                isDeleted: false 
            }).select('firstName lastName email role');
            
            logger.info(`👥 Users in patient's workplace (${patient.workplaceId}):`, usersInWorkplace.length);
            usersInWorkplace.forEach(user => {
                logger.info(`- ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
            });

            // Check recent diagnostic cases for this patient
            const recentCases = await DiagnosticCase.find({ patientId })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('pharmacistId', 'firstName lastName email');
            
            logger.info(`📋 Recent diagnostic cases: ${recentCases.length}`);
            recentCases.forEach(case_ => {
                logger.info(`- Case ${case_._id}: ${case_.status} by ${(case_.pharmacistId as any)?.firstName || 'Unknown'} (${case_.createdAt})`);
            });

            // Test patient query with different workplace contexts
            logger.info('\n🔍 Testing patient queries with workplace filter...');
            
            // Get all workplaces
            const allWorkplaces = await mongoose.connection.db.collection('workplaces').find({}).toArray();
            logger.info(`Found ${allWorkplaces.length} workplaces`);
            
            for (const workplace of allWorkplaces) {
                const patientInWorkplace = await Patient.findOne({
                    _id: patientId,
                    workplaceId: workplace._id
                });
                
                if (patientInWorkplace) {
                    logger.info(`✅ Patient found in workplace: ${workplace.name} (${workplace._id})`);
                } else {
                    logger.info(`❌ Patient NOT found in workplace: ${workplace.name} (${workplace._id})`);
                }
            }
        } else {
            logger.error('❌ Patient not found in database!');
            
            // Check if there are any patients with similar IDs
            const similarPatients = await Patient.find({
                _id: { $regex: patientId.substring(0, 10) }
            }).limit(5);
            
            logger.info(`Found ${similarPatients.length} patients with similar IDs`);
            similarPatients.forEach(p => {
                logger.info(`- ${p._id}: ${p.firstName} ${p.lastName}`);
            });
        }

    } catch (error) {
        logger.error('❌ Debug error:', error);
    }
}

// Run the debug function
debugPatientAccess()
    .then(() => {
        logger.info('✅ Debug completed');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('❌ Debug failed:', error);
        process.exit(1);
    });