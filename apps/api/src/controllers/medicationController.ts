import { Request, Response } from 'express';
import Medication from '../models/Medication';
import Patient from '../models/Patient';

interface AuthRequest extends Request {
  user?: any;
}

export const getMedications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, patient } = req.query;
    const query: any = { pharmacist: req.user.id };

    if (status) query.status = status;
    if (patient) query.patient = patient;

    const medications = await Medication.find(query)
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('patient', 'firstName lastName')
      .sort({ createdAt: -1 });

    const total = await Medication.countDocuments(query);

    res.json({
      medications,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getMedication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      pharmacist: req.user.id
    }).populate('patient');

    if (!medication) {
      res.status(404).json({ message: 'Medication not found' });
      return;
    }

    res.json({ medication });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createMedication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medication = await Medication.create({
      ...req.body,
      pharmacist: req.user.id
    });
    res.status(201).json({ medication });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateMedication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medication = await Medication.findOneAndUpdate(
      { _id: req.params.id, pharmacist: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!medication) {
      res.status(404).json({ message: 'Medication not found' });
      return;
    }

    res.json({ medication });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteMedication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medication = await Medication.findOneAndDelete({
      _id: req.params.id,
      pharmacist: req.user.id
    });

    if (!medication) {
      res.status(404).json({ message: 'Medication not found' });
      return;
    }

    res.json({ message: 'Medication deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getPatientMedications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medications = await Medication.find({
      patient: req.params.patientId,
      pharmacist: req.user.id
    }).sort({ createdAt: -1 });

    res.json({ medications });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const checkInteractions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { medicationIds } = req.body;

    // This is a simplified interaction check
    // In a real application, you would integrate with a drug interaction database
    const medications = await Medication.find({
      _id: { $in: medicationIds },
      pharmacist: req.user.id
    });

    const interactions = [];

    // Simple interaction logic (would be more complex in real implementation)
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];

        // Check if there are any recorded interactions
        if (med1 && med2 && med1.interactions) {
          const hasInteraction = med1.interactions.some(interaction =>
            interaction.interactingDrug === med2.drugName
          );

          if (hasInteraction) {
            interactions.push({
              medication1: med1.drugName,
              medication2: med2.drugName,
              severity: 'moderate',
              description: 'Potential drug interaction detected'
            });
          }
        }
      }
    }

    res.json({ interactions });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};