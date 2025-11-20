"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancePatientProfile = enhancePatientProfile;
exports.rollbackPatientProfileEnhancement = rollbackPatientProfileEnhancement;
exports.createPatientPortalIndexes = createPatientPortalIndexes;
const mongoose_1 = __importDefault(require("mongoose"));
const Patient_1 = __importDefault(require("../../src/models/Patient"));
async function enhancePatientProfile() {
    const result = {
        success: false,
        patientsUpdated: 0,
        errors: [],
    };
    try {
        console.log('Starting Patient profile enhancement migration...');
        const patientsToUpdate = await Patient_1.default.find({
            $or: [
                { allergies: { $exists: false } },
                { chronicConditions: { $exists: false } },
                { enhancedEmergencyContacts: { $exists: false } },
                { insuranceInfo: { $exists: false } },
                { patientLoggedVitals: { $exists: false } },
            ],
        }).select('_id firstName lastName');
        console.log(`Found ${patientsToUpdate.length} patients to update`);
        if (patientsToUpdate.length === 0) {
            console.log('No patients need updating');
            result.success = true;
            return result;
        }
        const batchSize = 100;
        let updatedCount = 0;
        for (let i = 0; i < patientsToUpdate.length; i += batchSize) {
            const batch = patientsToUpdate.slice(i, i + batchSize);
            const patientIds = batch.map(p => p._id);
            try {
                const updateResult = await Patient_1.default.updateMany({ _id: { $in: patientIds } }, {
                    $set: {
                        allergies: [],
                        chronicConditions: [],
                        enhancedEmergencyContacts: [],
                        patientLoggedVitals: [],
                        insuranceInfo: {
                            isActive: false,
                        },
                    },
                    $setOnInsert: {
                        createdAt: new Date(),
                    },
                }, {
                    upsert: false,
                });
                updatedCount += updateResult.modifiedCount;
                console.log(`Updated batch ${Math.floor(i / batchSize) + 1}: ${updateResult.modifiedCount} patients`);
            }
            catch (batchError) {
                const errorMsg = `Error updating batch starting at index ${i}: ${batchError}`;
                console.error(errorMsg);
                result.errors.push(errorMsg);
            }
        }
        const verificationSample = await Patient_1.default.findOne({
            allergies: { $exists: true },
            chronicConditions: { $exists: true },
            enhancedEmergencyContacts: { $exists: true },
            insuranceInfo: { $exists: true },
            patientLoggedVitals: { $exists: true },
        });
        if (!verificationSample) {
            result.errors.push('Verification failed: Could not find any updated patients');
        }
        else {
            console.log('Verification successful: Found updated patient with new fields');
        }
        result.patientsUpdated = updatedCount;
        result.success = result.errors.length === 0;
        console.log(`Migration completed. Updated ${updatedCount} patients.`);
        if (result.errors.length > 0) {
            console.error('Migration completed with errors:', result.errors);
        }
    }
    catch (error) {
        const errorMsg = `Migration failed with error: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
    }
    return result;
}
async function rollbackPatientProfileEnhancement() {
    const result = {
        success: false,
        patientsUpdated: 0,
        errors: [],
    };
    try {
        console.log('Starting Patient profile enhancement rollback...');
        console.warn('WARNING: This will remove all patient portal data including allergies, conditions, and vitals!');
        const patientsToRollback = await Patient_1.default.find({
            $or: [
                { allergies: { $exists: true } },
                { chronicConditions: { $exists: true } },
                { enhancedEmergencyContacts: { $exists: true } },
                { insuranceInfo: { $exists: true } },
                { patientLoggedVitals: { $exists: true } },
            ],
        }).select('_id');
        console.log(`Found ${patientsToRollback.length} patients to rollback`);
        if (patientsToRollback.length === 0) {
            console.log('No patients need rollback');
            result.success = true;
            return result;
        }
        const rollbackResult = await Patient_1.default.updateMany({ _id: { $in: patientsToRollback.map(p => p._id) } }, {
            $unset: {
                allergies: '',
                chronicConditions: '',
                enhancedEmergencyContacts: '',
                insuranceInfo: '',
                patientLoggedVitals: '',
            },
        });
        result.patientsUpdated = rollbackResult.modifiedCount;
        result.success = true;
        console.log(`Rollback completed. Removed new fields from ${rollbackResult.modifiedCount} patients.`);
    }
    catch (error) {
        const errorMsg = `Rollback failed with error: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
    }
    return result;
}
async function createPatientPortalIndexes() {
    try {
        console.log('Creating indexes for patient portal fields...');
        const indexes = [
            { 'allergies.allergen': 1 },
            { 'allergies.severity': 1 },
            { 'chronicConditions.condition': 1 },
            { 'chronicConditions.status': 1 },
            { 'enhancedEmergencyContacts.isPrimary': 1 },
            { 'insuranceInfo.provider': 1 },
            { 'insuranceInfo.isActive': 1 },
            { 'patientLoggedVitals.recordedDate': -1 },
            { 'patientLoggedVitals.isVerified': 1 },
        ];
        for (const index of indexes) {
            await Patient_1.default.collection.createIndex(index);
            console.log(`Created index: ${JSON.stringify(index)}`);
        }
        console.log('All patient portal indexes created successfully');
    }
    catch (error) {
        console.error('Error creating indexes:', error);
        throw error;
    }
}
if (require.main === module) {
    const command = process.argv[2];
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare';
    mongoose_1.default.connect(mongoUri)
        .then(async () => {
        console.log('Connected to MongoDB');
        switch (command) {
            case 'migrate':
                await enhancePatientProfile();
                break;
            case 'rollback':
                await rollbackPatientProfileEnhancement();
                break;
            case 'indexes':
                await createPatientPortalIndexes();
                break;
            case 'all':
                await enhancePatientProfile();
                await createPatientPortalIndexes();
                break;
            default:
                console.log('Usage: ts-node enhance-patient-profile.ts [migrate|rollback|indexes|all]');
                console.log('  migrate  - Add new patient portal fields to existing patients');
                console.log('  rollback - Remove patient portal fields (WARNING: Data loss!)');
                console.log('  indexes  - Create indexes for patient portal fields');
                console.log('  all      - Run migration and create indexes');
        }
        await mongoose_1.default.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    });
}
exports.default = {
    enhancePatientProfile,
    rollbackPatientProfileEnhancement,
    createPatientPortalIndexes,
};
//# sourceMappingURL=enhance-patient-profile.js.map