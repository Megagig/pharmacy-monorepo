import mongoose from 'mongoose';
import '../src/config/db'; // This will establish the DB connection
import Patient from '../src/models/Patient';

async function checkPatients() {
  try {
    console.log('Checking database connection...');

    // Wait for the existing connection to be established
    await new Promise((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve(true);
      } else {
        mongoose.connection.on('connected', resolve);
        mongoose.connection.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      }
    });

    console.log('Connected to MongoDB');

    const patients = await Patient.find({}).select(
      'firstName lastName mrn workplaceId isDeleted createdAt'
    );
    console.log('Total patients found:', patients.length);

    patients.forEach((p) => {
      console.log(
        `Patient: ${p.firstName} ${p.lastName}, MRN: ${p.mrn}, WorkplaceID: ${p.workplaceId}, Deleted: ${p.isDeleted}, Created: ${p.createdAt}`
      );
    });

    // Also check for the specific workplace of our test users
    const workplaces = await mongoose.connection.db
      .collection('users')
      .distinct('workplaceId');
    console.log('Workplaces found in users:', workplaces);

    for (const workplaceId of workplaces) {
      const workplacePatients = await Patient.find({
        workplaceId,
        isDeleted: false,
      });
      console.log(
        `Workplace ${workplaceId}: ${workplacePatients.length} active patients`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPatients();
