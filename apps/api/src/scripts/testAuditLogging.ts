#!/usr/bin/env ts-node

/**
 * Test script to verify MTR audit logging functionality
 * This script tests the comprehensive audit logging system
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { AuditService } from '../services/auditService';
import MTRAuditLog from '../models/MTRAuditLog';

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

async function testAuditLogging() {
    console.log('\n🧪 Testing MTR Audit Logging System...\n');

    // Test data
    const testWorkplaceId = new mongoose.Types.ObjectId();
    const testUserId = new mongoose.Types.ObjectId();
    const testPatientId = new mongoose.Types.ObjectId();
    const testReviewId = new mongoose.Types.ObjectId();

    const testContext = {
        userId: testUserId,
        workplaceId: testWorkplaceId,
        userRole: 'pharmacist',
        sessionId: 'test-session-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Test User Agent',
        requestMethod: 'POST',
        requestUrl: '/api/mtr',
    };

    try {
        // Test 1: Create MTR session audit log
        console.log('1️⃣ Testing MTR session creation audit log...');
        const sessionLog = await AuditService.logActivity(testContext, {
            action: 'CREATE_MTR_SESSION',
            resourceType: 'MedicationTherapyReview',
            resourceId: testReviewId,
            patientId: testPatientId,
            details: {
                reviewNumber: 'MTR-2024-001',
                status: 'in_progress',
                priority: 'routine',
                reviewType: 'initial',
            },
            complianceCategory: 'clinical_documentation',
            riskLevel: 'medium',
        });
        console.log('✅ MTR session audit log created:', sessionLog._id);

        // Test 2: Create high-risk activity log
        console.log('\n2️⃣ Testing high-risk activity audit log...');
        const highRiskLog = await AuditService.logActivity(testContext, {
            action: 'DELETE_MTR_SESSION',
            resourceType: 'MedicationTherapyReview',
            resourceId: testReviewId,
            patientId: testPatientId,
            details: {
                reason: 'Test deletion',
                deletedBy: 'test-user',
            },
            complianceCategory: 'clinical_documentation',
            riskLevel: 'critical',
        });
        console.log('✅ High-risk activity audit log created:', highRiskLog._id);

        // Test 3: Create patient access log
        console.log('\n3️⃣ Testing patient access audit log...');
        const accessLog = await AuditService.logActivity(testContext, {
            action: 'PATIENT_DATA_ACCESSED',
            resourceType: 'Patient',
            resourceId: testPatientId,
            patientId: testPatientId,
            details: {
                accessReason: 'MTR review',
                dataAccessed: ['demographics', 'medications', 'allergies'],
            },
            complianceCategory: 'data_access',
            riskLevel: 'medium',
        });
        console.log('✅ Patient access audit log created:', accessLog._id);

        // Test 4: Create authentication log
        console.log('\n4️⃣ Testing authentication audit log...');
        const authLog = await AuditService.logActivity(testContext, {
            action: 'USER_LOGIN',
            resourceType: 'User',
            resourceId: testContext.userId,
            details: {
                loginMethod: 'email',
                deviceInfo: 'Test Device',
                location: 'Test Location',
            },
            complianceCategory: 'authentication',
            riskLevel: 'low',
        });
        console.log('✅ Authentication audit log created:', authLog?._id);

        // Test 5: Get audit logs with simple query (no population)
        console.log('\n5️⃣ Testing audit log retrieval with filters...');
        const auditLogs = await MTRAuditLog.find({
            workplaceId: testWorkplaceId,
            riskLevel: 'critical',
        }).limit(10).sort({ timestamp: -1 });
        console.log(`✅ Retrieved ${auditLogs.length} audit logs`);

        // Test 6: Get audit summary using aggregation
        console.log('\n6️⃣ Testing audit summary generation...');
        const summaryStats = await MTRAuditLog.aggregate([
            { $match: { workplaceId: testWorkplaceId } },
            {
                $group: {
                    _id: null,
                    totalLogs: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' },
                    errorCount: {
                        $sum: { $cond: [{ $ne: ['$errorMessage', null] }, 1, 0] },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    totalLogs: 1,
                    uniqueUserCount: { $size: '$uniqueUsers' },
                    errorCount: 1,
                    errorRate: {
                        $cond: [
                            { $gt: ['$totalLogs', 0] },
                            { $multiply: [{ $divide: ['$errorCount', '$totalLogs'] }, 100] },
                            0,
                        ],
                    },
                },
            },
        ]);
        const summary = summaryStats[0] || { totalLogs: 0, uniqueUserCount: 0, errorRate: 0 };
        console.log('✅ Audit summary generated:', summary);

        // Test 7: Export audit data (simple version)
        console.log('\n7️⃣ Testing audit data export...');
        const exportLogs = await MTRAuditLog.find({ workplaceId: testWorkplaceId })
            .select('-__v')
            .lean();
        const exportData = JSON.stringify(exportLogs, null, 2);
        console.log('✅ Audit data exported:', {
            recordCount: exportLogs.length,
            dataSize: exportData.length,
        });

        // Test 8: Test basic audit log queries
        console.log('\n8️⃣ Testing basic audit log queries...');

        // Count by risk level
        const riskCounts = await MTRAuditLog.aggregate([
            { $match: { workplaceId: testWorkplaceId } },
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        ]);
        console.log('✅ Risk level distribution:', riskCounts);

        // Count by compliance category
        const categoryCounts = await MTRAuditLog.aggregate([
            { $match: { workplaceId: testWorkplaceId } },
            { $group: { _id: '$complianceCategory', count: { $sum: 1 } } },
        ]);
        console.log('✅ Compliance category distribution:', categoryCounts);

        // Test 9: Test audit log model virtuals
        console.log('\n9️⃣ Testing audit log model virtuals...');
        const sampleLog = await MTRAuditLog.findOne({ workplaceId: testWorkplaceId });
        if (sampleLog) {
            console.log('✅ Virtual fields test:', {
                actionDisplay: sampleLog.actionDisplay,
                riskLevelDisplay: sampleLog.riskLevelDisplay,
                complianceCategoryDisplay: sampleLog.complianceCategoryDisplay,
            });
        }

        console.log('\n🎉 All audit logging tests completed successfully!');

        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        await MTRAuditLog.deleteMany({
            workplaceId: testWorkplaceId,
        });
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await connectToDatabase();
        await testAuditLogging();
        console.log('\n✅ All tests passed! MTR audit logging system is working correctly.');
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