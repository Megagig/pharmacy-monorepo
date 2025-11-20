import mongoose from 'mongoose';
import Patient from './models/Patient';
import Allergy from './models/Allergy';
import Condition from './models/Condition';
import MedicationRecord from './models/MedicationRecord';
import ClinicalAssessment from './models/ClinicalAssessment';
import DrugTherapyProblem from './models/DrugTherapyProblem';
import CarePlan from './models/CarePlan';
import Visit from './models/Visit';
import { EmailDelivery } from './models/EmailDelivery';
import {
  tenancyGuardPlugin,
  addAuditFields,
  generateMRN,
} from './utils/tenancyGuard';

/**
 * BIT 1 - Patient Management Models Validation Test
 * This test ensures all models are properly defined and can be imported
 */
function validatePatientManagementModels() {
  console.log('🔍 Validating Patient Management Models (BIT 1)...');

  const models = [
    { name: 'Patient', model: Patient },
    { name: 'Allergy', model: Allergy },
    { name: 'Condition', model: Condition },
    { name: 'MedicationRecord', model: MedicationRecord },
    { name: 'ClinicalAssessment', model: ClinicalAssessment },
    { name: 'DrugTherapyProblem', model: DrugTherapyProblem },
    { name: 'CarePlan', model: CarePlan },
    { name: 'Visit', model: Visit },
  ];

  models.forEach(({ name, model }) => {
    if (model && typeof model === 'function') {
      console.log(`✅ ${name} model: Successfully imported and valid`);
    } else {
      console.log(`❌ ${name} model: Import failed or invalid`);
    }
  });

  // Test utility functions
  console.log('\n🔧 Testing utility functions...');

  if (typeof tenancyGuardPlugin === 'function') {
    console.log('✅ tenancyGuardPlugin: Available and valid');
  } else {
    console.log('❌ tenancyGuardPlugin: Not available or invalid');
  }

  if (typeof addAuditFields === 'function') {
    console.log('✅ addAuditFields: Available and valid');
  } else {
    console.log('❌ addAuditFields: Not available or invalid');
  }

  if (typeof generateMRN === 'function') {
    console.log('✅ generateMRN: Available and valid');

    // Test MRN generation
    const testMRN = generateMRN('LAG', 1);
    if (testMRN === 'PHM-LAG-00001') {
      console.log('✅ generateMRN: Function works correctly');
    } else {
      console.log('❌ generateMRN: Function output incorrect');
    }
  } else {
    console.log('❌ generateMRN: Not available or invalid');
  }

  console.log('\n🎉 BIT 1 - Data Models validation complete!');
  console.log('Ready to proceed to BIT 2 - Server: Routes & Controllers');
}

// Export for testing
export default validatePatientManagementModels;

// If run directly
if (require.main === module) {
  validatePatientManagementModels();
}
