import mongoose from 'mongoose';
import DiagnosticRequest from '../src/modules/diagnostics/models/DiagnosticRequest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

async function clearPendingRequests() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all pending/processing requests
        const pendingRequests = await DiagnosticRequest.find({
            status: { $in: ['pending', 'processing'] },
            isDeleted: false,
        }).select('_id patientId status createdAt pharmacistId');

        console.log(`\n📋 Found ${pendingRequests.length} pending/processing diagnostic requests:\n`);

        if (pendingRequests.length === 0) {
            console.log('✅ No pending requests to clear!');
            process.exit(0);
        }

        // Display requests
        pendingRequests.forEach((req, index) => {
            console.log(`${index + 1}. Request ID: ${req._id}`);
            console.log(`   Patient ID: ${req.patientId}`);
            console.log(`   Status: ${req.status}`);
            console.log(`   Created: ${req.createdAt}`);
            console.log(`   Pharmacist ID: ${req.pharmacistId}`);
            console.log('');
        });

        // Ask for confirmation
        console.log('⚠️  Do you want to mark these requests as "completed"? (y/n)');

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        readline.question('', async (answer: string) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                // Update all pending requests to completed
                const result = await DiagnosticRequest.updateMany(
                    {
                        status: { $in: ['pending', 'processing'] },
                        isDeleted: false,
                    },
                    {
                        $set: {
                            status: 'completed',
                            errorMessage: 'Manually cleared by admin',
                            updatedAt: new Date(),
                        },
                    }
                );

                console.log(`\n✅ Successfully updated ${result.modifiedCount} requests to "completed"`);
            } else {
                console.log('\n❌ Operation cancelled');
            }

            readline.close();
            await mongoose.disconnect();
            console.log('✅ Disconnected from MongoDB');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Alternative: Clear by specific patient ID
async function clearByPatient(patientId: string) {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const result = await DiagnosticRequest.updateMany(
            {
                patientId: new mongoose.Types.ObjectId(patientId),
                status: { $in: ['pending', 'processing'] },
                isDeleted: false,
            },
            {
                $set: {
                    status: 'completed',
                    errorMessage: 'Manually cleared by admin',
                    updatedAt: new Date(),
                },
            }
        );

        console.log(`\n✅ Updated ${result.modifiedCount} requests for patient ${patientId}`);

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Check if patient ID is provided as argument
const args = process.argv.slice(2);
if (args.length > 0 && args[0] === '--patient') {
    const patientId = args[1];
    if (!patientId) {
        console.error('❌ Please provide a patient ID: npm run clear-diagnostics -- --patient <patientId>');
        process.exit(1);
    }
    clearByPatient(patientId);
} else {
    clearPendingRequests();
}
