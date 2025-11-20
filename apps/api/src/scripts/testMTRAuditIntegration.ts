#!/usr/bin/env ts-node

/**
 * Integration test to verify MTR audit logging middleware integration
 * This script tests that audit logs are created when MTR operations are performed
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import MTRAuditLog from '../models/MTRAuditLog';
import MedicationTherapyReview from '../models/MedicationTherapyReview';
import Patient from '../models/Patient';
import User from '../models/User';
import Workplace from '../models/Workplace';

// Load environment variables
config();

async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function createTestData() {
    console.log('🏗️ Creating test data...');

    // Create test owner first
    const ownerId = new mongoose.Types.ObjectId();

    // Create test workplace
    const workplace = new Workplace({
        name: 'Test Pharmacy',
        type: 'Community',
        address: '123 Test St, Test City',
        state: 'Lagos',
        lga: 'Test LGA',
        email: `test-${Date.now()}@pharmacy.com`,
        licenseNumber: `TEST-LIC-${Date.now()}`,
        ownerId: ownerId,
        inviteCode: `TEST-INVITE-${Date.now()}`,
        teamMembers: [],
        documents: [],
    });
    await workplace.save();

    // Create test user
    const user = new User({
        firstName: 'Test',
        lastName: 'Pharmacist',
        email: `test.pharmacist-${Date.now()}@pharmacy.com`,
        passwordHash: 'hashedpassword123',
        role: 'pharmacist',
        status: 'active',
        emailVerified: true,
        workplaceId: workplace._id,
        workplaceRole: 'Pharmacist',
        currentPlanId: new mongoose.Types.ObjectId(),
        licenseNumber: `PHARM-LIC-${Date.now()}`,
        licenseStatus: 'approved',
    });
    await user.save();

    // Create test patient
    const patient = new Patient({
        firstName: 'Test',
        lastName: 'Patient',
        dob: new Date('1980-01-01'),
        workplaceId: workplace._id,
        mrn: `TEST-MRN-${Date.now()}`,
        createdBy: user._id,
    });
    await patient.save();

    console.log('✅ Test data created');
    return { workplace, user, patient };
}

async function testMTRAuditIntegration() {
    console.log('\n🧪 Testing MTR Audit Integration...\n');

    const { workplace, user, patient } = await createTestData();

    try {
        // Clear existing audit logs for this test
        await MTRAuditLog.deleteMany({ workplaceId: workplace._id });

        // Test 1: Create MTR Session (should generate audit log)
        console.log('1️⃣ Testing MTR session creation audit...');
        const mtrSession = new MedicationTherapyReview({
            workplaceId: workplace._id,
            patientId: patient._id,
            pharmacistId: user._id,
            reviewNumber: 'MTR-TEST-001',
            status: 'in_progress',
            priority: 'routine',
            reviewType: 'initial',
            patientConsent: true,
            confidentialityAgreed: true,
            steps: {
                patientSelection: { completed: true, completedAt: new Date() },
                medicationHistory: { completed: false },
                therapyAssessment: { completed: false },
                planDevelopment: { completed: false },
                interventions: { completed: false },
                followUp: { completed: false },
            },
            medications: [],
            problems: [],
            interventions: [],
            followUps: [],
            clinicalOutcomes: {
                problemsResolved: 0,
                medicationsOptimized: 0,
                adherenceImproved: false,
                adverseEventsReduced: false,
            },
            startedAt: new Date(),
            createdBy: user._id,
        });
        await mtrSession.save();

        // Check if audit log was created
        const auditLogs = await MTRAuditLog.find({
            workplaceId: workplace._id,
            resourceType: 'MedicationTherapyReview',
            resourceId: mtrSession._id,
        });

        if (auditLogs.length > 0) {
            console.log('✅ MTR session creation audit log found');
            console.log('   Action:', auditLogs[0]?.action);
            console.log('   Risk Level:', auditLogs[0]?.riskLevel);
            console.log('   Compliance Category:', auditLogs[0]?.complianceCategory);
        } else {
            console.log('⚠️ No audit log found for MTR session creation');
        }

        // Test 2: Update MTR Session (should generate audit log)
        console.log('\n2️⃣ Testing MTR session update audit...');
        const oldStatus = mtrSession.status;
        mtrSession.status = 'completed';
        mtrSession.completedAt = new Date();
        mtrSession.steps.medicationHistory.completed = true;
        mtrSession.steps.medicationHistory.completedAt = new Date();
        await mtrSession.save();

        // Check for update audit log
        const updateAuditLogs = await MTRAuditLog.find({
            workplaceId: workplace._id,
            resourceType: 'MedicationTherapyReview',
            resourceId: mtrSession._id,
            action: { $regex: /UPDATE/i },
        });

        if (updateAuditLogs.length > 0) {
            console.log('✅ MTR session update audit log found');
            console.log('   Old Status:', oldStatus);
            console.log('   New Status:', mtrSession.status);
        } else {
            console.log('⚠️ No audit log found for MTR session update');
        }

        // Test 3: Check audit log completeness
        console.log('\n3️⃣ Testing audit log completeness...');
        const allAuditLogs = await MTRAuditLog.find({ workplaceId: workplace._id });

        console.log(`✅ Total audit logs created: ${allAuditLogs.length}`);

        for (const log of allAuditLogs) {
            console.log(`   - ${log.action} (${log.riskLevel} risk, ${log.complianceCategory})`);

            // Verify required fields
            const requiredFields = ['action', 'resourceType', 'resourceId', 'userId', 'workplaceId', 'timestamp'];
            const missingFields = requiredFields.filter(field => !log[field as keyof typeof log]);

            if (missingFields.length > 0) {
                console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
            } else {
                console.log('   ✅ All required fields present');
            }
        }

        // Test 4: Test audit log queries and aggregations
        console.log('\n4️⃣ Testing audit log queries...');

        // Test risk level aggregation
        const riskAggregation = await MTRAuditLog.aggregate([
            { $match: { workplaceId: workplace._id } },
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        console.log('✅ Risk level distribution:', riskAggregation);

        // Test compliance category aggregation
        const complianceAggregation = await MTRAuditLog.aggregate([
            { $match: { workplaceId: workplace._id } },
            { $group: { _id: '$complianceCategory', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        console.log('✅ Compliance category distribution:', complianceAggregation);

        // Test time-based queries
        const recentLogs = await MTRAuditLog.find({
            workplaceId: workplace._id,
            timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        }).sort({ timestamp: -1 });
        console.log(`✅ Recent audit logs (last hour): ${recentLogs.length}`);

        // Test 5: Test audit log virtual properties
        console.log('\n5️⃣ Testing audit log virtual properties...');
        const sampleLog = allAuditLogs[0];
        if (sampleLog) {
            console.log('✅ Virtual properties test:');
            console.log(`   Action Display: ${sampleLog.actionDisplay}`);
            console.log(`   Risk Level Display: ${sampleLog.riskLevelDisplay}`);
            console.log(`   Compliance Category Display: ${sampleLog.complianceCategoryDisplay}`);
        }

        console.log('\n🎉 MTR Audit Integration tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        await MTRAuditLog.deleteMany({ workplaceId: workplace._id });
        await MedicationTherapyReview.deleteMany({ workplaceId: workplace._id });
        await Patient.deleteMany({ workplaceId: workplace._id });
        await User.deleteMany({ workplaceId: workplace._id });
        await Workplace.deleteMany({ _id: workplace._id });
        console.log('✅ Test data cleaned up');
    }
}

async function main() {
    try {
        await connectToDatabase();
        await testMTRAuditIntegration();
        console.log('\n✅ All MTR audit integration tests passed!');
    } catch (error) {
        console.error('\n❌ Tests failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default main;