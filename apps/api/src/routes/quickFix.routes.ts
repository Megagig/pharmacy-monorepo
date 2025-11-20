import { Router } from 'express';
import PatientUser from '../models/PatientUser';
import Patient from '../models/Patient';
import logger from '../utils/logger';

const router = Router();

/**
 * Test endpoint to verify API is working
 * GET /api/quick-fix/test
 */
router.get('/test', (req, res) => {
  console.log('🔧 Quick fix test endpoint hit');
  res.json({
    success: true,
    message: 'Quick fix API is working!',
    timestamp: new Date().toISOString()
  });
});

/**
 * Check specific user status
 * GET /api/quick-fix/check-user/:email
 */
router.get('/check-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`🔍 Checking user: ${email}`);
    
    const patientUser = await PatientUser.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false 
    }).select('_id firstName lastName email status patientId workplaceId isActive');
    
    if (!patientUser) {
      return res.json({
        success: false,
        message: 'PatientUser not found',
        email
      });
    }
    
    let patientRecord = null;
    if (patientUser.patientId) {
      patientRecord = await Patient.findById(patientUser.patientId).select('_id mrn firstName lastName');
    }
    
    const result = {
      success: true,
      patientUser: {
        id: patientUser._id,
        email: patientUser.email,
        firstName: patientUser.firstName,
        lastName: patientUser.lastName,
        status: patientUser.status,
        isActive: patientUser.isActive,
        hasPatientId: !!patientUser.patientId,
        patientId: patientUser.patientId
      },
      patientRecord: patientRecord ? {
        id: patientRecord._id,
        mrn: patientRecord.mrn,
        firstName: patientRecord.firstName,
        lastName: patientRecord.lastName
      } : null
    };
    
    console.log('🔍 User check result:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Quick fix endpoint for patient linking
 * GET /api/quick-fix/link-patients
 */
router.get('/link-patients', async (req, res) => {
  try {
    console.log('🔗 Quick fix link-patients endpoint hit');
    console.log('🔗 Starting Patient linking process...');

    // Find all active PatientUsers without linked Patient records
    const unlinkedUsers = await PatientUser.find({
      status: 'active',
      isActive: true,
      patientId: { $exists: false },
      isDeleted: false,
    }).select('_id firstName lastName email workplaceId');

    // Also check all PatientUsers to see their status
    const allUsers = await PatientUser.find({
      isDeleted: false,
    }).select('_id firstName lastName email status patientId').limit(10);
    
    console.log('📊 All PatientUsers status:', allUsers.map(u => ({
      email: u.email,
      status: u.status,
      hasPatientId: !!u.patientId
    })));

    console.log(`📊 Found ${unlinkedUsers.length} unlinked PatientUsers`);

    if (unlinkedUsers.length === 0) {
      return res.json({
        success: true,
        message: 'All PatientUsers are already linked to Patient records',
        data: { processed: 0, successful: 0, failed: 0 }
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const patientUser of unlinkedUsers) {
      try {
        console.log(`🔄 Processing: ${patientUser.firstName} ${patientUser.lastName} (${patientUser.email})`);
        
        // Get workplace for MRN generation
        const Workplace = require('../models/Workplace').default;
        const workplace = await Workplace.findById(patientUser.workplaceId);
        if (!workplace) {
          throw new Error('Workplace not found');
        }

        // Generate MRN
        const mrn = await Patient.generateNextMRN(patientUser.workplaceId, workplace.inviteCode);

        // Create new patient
        const newPatient = new Patient({
          workplaceId: patientUser.workplaceId,
          mrn,
          firstName: patientUser.firstName,
          lastName: patientUser.lastName,
          email: patientUser.email,
          phone: patientUser.phone,
          dob: patientUser.dateOfBirth,
          allergies: [],
          chronicConditions: [],
          enhancedEmergencyContacts: [],
          patientLoggedVitals: [],
          insuranceInfo: { isActive: false },
          createdBy: patientUser._id, // Created by the patient user themselves
          isDeleted: false,
        });

        await newPatient.save();

        // Link to PatientUser
        patientUser.patientId = newPatient._id;
        await patientUser.save();

        console.log(`✅ Created Patient record ${newPatient._id} for PatientUser ${patientUser._id}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error processing PatientUser ${patientUser._id}:`, error.message);
        errors.push(`${patientUser.email}: ${error.message}`);
        errorCount++;
      }
    }

    const results = {
      processed: unlinkedUsers.length,
      successful: successCount,
      failed: errorCount,
      errors: errors.slice(0, 10) // Limit error details
    };

    console.log('\n📈 Linking Summary:');
    console.log(`✅ Successfully linked: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${unlinkedUsers.length}`);

    logger.info('Patient linking completed via quick fix:', results);

    res.json({
      success: true,
      message: `Patient linking completed! ${successCount} successful, ${errorCount} failed.`,
      data: results
    });

  } catch (error) {
    console.error('💥 Fatal error in linking process:', error);
    logger.error('Error in quick fix patient linking:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to link patients',
      error: error.message
    });
  }
});

/**
 * Force create patient record for specific user
 * POST /api/quick-fix/force-link/:email
 */
router.post('/force-link/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`🔗 Force linking user: ${email}`);
    
    const patientUser = await PatientUser.findOne({ 
      email: email.toLowerCase(),
      isDeleted: false 
    });
    
    if (!patientUser) {
      return res.json({
        success: false,
        message: 'PatientUser not found',
        email
      });
    }
    
    if (patientUser.patientId) {
      return res.json({
        success: true,
        message: 'PatientUser already has a linked Patient record',
        patientId: patientUser.patientId
      });
    }
    
    // Get workplace for MRN generation
    const Workplace = require('../models/Workplace').default;
    const workplace = await Workplace.findById(patientUser.workplaceId);
    if (!workplace) {
      throw new Error('Workplace not found');
    }

    // Generate MRN
    const mrn = await Patient.generateNextMRN(patientUser.workplaceId, workplace.inviteCode);

    // Create new patient
    const newPatient = new Patient({
      workplaceId: patientUser.workplaceId,
      mrn,
      firstName: patientUser.firstName,
      lastName: patientUser.lastName,
      email: patientUser.email,
      phone: patientUser.phone,
      dob: patientUser.dateOfBirth,
      allergies: [],
      chronicConditions: [],
      enhancedEmergencyContacts: [],
      patientLoggedVitals: [],
      insuranceInfo: { isActive: false },
      createdBy: patientUser._id,
      isDeleted: false,
    });

    await newPatient.save();

    // Link to PatientUser
    patientUser.patientId = newPatient._id;
    await patientUser.save();

    console.log(`✅ Force created Patient record ${newPatient._id} for PatientUser ${patientUser._id}`);
    
    res.json({
      success: true,
      message: 'Patient record created and linked successfully',
      patientUser: {
        id: patientUser._id,
        email: patientUser.email,
        patientId: newPatient._id
      },
      patientRecord: {
        id: newPatient._id,
        mrn: newPatient.mrn,
        firstName: newPatient.firstName,
        lastName: newPatient.lastName
      }
    });
    
  } catch (error) {
    console.error('❌ Error force linking user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;