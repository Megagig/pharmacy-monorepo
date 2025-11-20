import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import Patient from '../models/Patient';
import connectDB from '../config/db';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

/**
 * Simple script to test diagnostic endpoints with actual data
 */

async function testDiagnosticEndpointsSimple() {
    try {
        // Connect to database
        await connectDB();
        logger.info('Connected to database');

        // Find a super admin user
        const superAdmin = await User.findOne({ role: 'super_admin' });
        if (!superAdmin) {
            logger.error('No super admin user found');
            return;
        }

        logger.info(`Found super admin: ${superAdmin.firstName} ${superAdmin.lastName}`);

        // Generate a JWT token for the super admin
        const token = jwt.sign(
            { userId: superAdmin._id },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        logger.info('Generated JWT token for testing');

        // Find a patient in the same workplace
        const patient = await Patient.findOne({
            workplaceId: superAdmin.workplaceId
        });

        if (!patient) {
            logger.warn('No patient found in super admin workplace');
            logger.info('Creating a test patient...');

            // Create a test patient
            const testPatient = new Patient({
                firstName: 'Test',
                lastName: 'Patient',
                email: 'test.patient@example.com',
                phone: '+1234567890',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'male',
                workplaceId: superAdmin.workplaceId,
                createdBy: superAdmin._id
            });

            await testPatient.save();
            logger.info(`Created test patient: ${testPatient._id}`);

            // Test the diagnostic endpoint
            const diagnosticPayload = {
                patientId: testPatient._id.toString(),
                symptoms: {
                    subjective: ['Headache', 'Nausea'],
                    objective: ['Elevated blood pressure'],
                    duration: '2 days',
                    severity: 'moderate',
                    onset: 'acute'
                },
                labResults: [],
                currentMedications: [],
                vitalSigns: {
                    bloodPressure: '150/90',
                    heartRate: 80,
                    temperature: 98.6,
                    respiratoryRate: 16
                },
                patientConsent: {
                    provided: true,
                    method: 'electronic'
                }
            };

            logger.info('Test payload prepared:', {
                patientId: diagnosticPayload.patientId,
                symptomsCount: diagnosticPayload.symptoms.subjective.length + diagnosticPayload.symptoms.objective.length
            });

            logger.info('\n🧪 To test the diagnostic endpoint, use this curl command:');
            logger.info(`curl -X POST http://localhost:5000/api/diagnostics/ai \\`);
            logger.info(`  -H "Authorization: Bearer ${token}" \\`);
            logger.info(`  -H "Content-Type: application/json" \\`);
            logger.info(`  -d '${JSON.stringify(diagnosticPayload, null, 2)}'`);

            logger.info('\n📋 Or use this information in your frontend:');
            logger.info(`- Patient ID: ${testPatient._id}`);
            logger.info(`- JWT Token: ${token}`);
            logger.info(`- Endpoint: POST /api/diagnostics/ai`);

        } else {
            logger.info(`Found existing patient: ${patient.firstName} ${patient.lastName} (${patient._id})`);

            logger.info('\n🧪 To test the diagnostic endpoint with existing patient:');
            logger.info(`curl -X POST http://localhost:5000/api/diagnostics/ai \\`);
            logger.info(`  -H "Authorization: Bearer ${token}" \\`);
            logger.info(`  -H "Content-Type: application/json" \\`);
            logger.info(`  -d '{
        "patientId": "${patient._id}",
        "symptoms": {
          "subjective": ["Headache", "Nausea"],
          "objective": ["Elevated blood pressure"],
          "duration": "2 days",
          "severity": "moderate",
          "onset": "acute"
        },
        "labResults": [],
        "currentMedications": [],
        "vitalSigns": {
          "bloodPressure": "150/90",
          "heartRate": 80,
          "temperature": 98.6,
          "respiratoryRate": 16
        },
        "patientConsent": {
          "provided": true,
          "method": "electronic"
        }
      }'`);
        }

        logger.info('\n✅ Test setup completed successfully!');
        logger.info('\nNow you can:');
        logger.info('1. Use the curl command above to test the backend directly');
        logger.info('2. Use the JWT token in your frontend application');
        logger.info('3. Test the diagnostic case submission in the UI');

    } catch (error) {
        logger.error('❌ Failed to setup diagnostic test:', error);
    } finally {
        await mongoose.connection.close();
        logger.info('Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    testDiagnosticEndpointsSimple()
        .then(() => {
            logger.info('Test setup script completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test setup script failed:', error);
            process.exit(1);
        });
}

export default testDiagnosticEndpointsSimple;