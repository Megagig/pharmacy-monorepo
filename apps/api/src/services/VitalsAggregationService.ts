import mongoose from 'mongoose';
import ClinicalAssessment, { IClinicalAssessment } from '../models/ClinicalAssessment';
import Patient from '../models/Patient';
import VitalsVerification from '../models/VitalsVerification';

export interface UnifiedVitalItem {
  _id: string;
  patientId: string;
  recordedAt: string;
  source: 'patient' | 'pharmacist';
  verified: boolean;
  bloodPressure?: { systolic?: number; diastolic?: number };
  temperature?: number; // °C
  heartRate?: number; // bpm
  weight?: number; // kg
  bloodGlucose?: number; // mg/dL
  notes?: string;
}

export default class VitalsAggregationService {
  static async getUnifiedVitals(
    patientId: string,
    workplaceId?: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ results: UnifiedVitalItem[]; total: number; hasMore: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return { results: [], total: 0, hasMore: false };
    }

    const patientObjectId = new mongoose.Types.ObjectId(patientId);
    const workplaceObjectId = workplaceId && mongoose.Types.ObjectId.isValid(workplaceId)
      ? new mongoose.Types.ObjectId(workplaceId)
      : undefined;

    // 1) Pharmacist-entered vitals via ClinicalAssessment
    const assessQuery: any = { patientId: patientObjectId, isDeleted: { $ne: true } };
    if (workplaceObjectId) assessQuery.workplaceId = workplaceObjectId;

    const assessments = await ClinicalAssessment.find(assessQuery)
      .select('vitals labs soap recordedAt createdAt patientId')
      .sort({ recordedAt: -1, createdAt: -1 })
      .lean();

    const pharmacistItems: UnifiedVitalItem[] = (assessments || []).map((a: any) => {
      const v = a.vitals || {};
      const labs = a.labs || {};
      const misc = labs.misc || {};
      return {
        _id: String(a._id),
        patientId: String(a.patientId),
        recordedAt: a.recordedAt || a.createdAt,
        source: 'pharmacist',
        verified: true, // pharmacist entries are verified by default
        bloodPressure: (v.bpSys || v.bpDia) ? { systolic: v.bpSys, diastolic: v.bpDia } : undefined,
        temperature: typeof v.tempC === 'number' ? v.tempC : undefined,
        heartRate: typeof misc.hr_bpm === 'number' ? misc.hr_bpm : undefined,
        weight: typeof misc.weight_kg === 'number' ? misc.weight_kg : undefined,
        bloodGlucose: typeof labs.fbs === 'number' ? labs.fbs : undefined,
        notes: a.soap?.objective,
      };
    });

    // 2) Patient-entered vitals via Patient.patientLoggedVitals
    const patient = await Patient.findById(patientObjectId)
      .select('patientLoggedVitals workplaceId')
      .lean();

    const patientItems: UnifiedVitalItem[] = ((patient?.patientLoggedVitals as any[]) || []).map((p: any) => ({
      _id: String(p._id || p.id || Math.random()),
      patientId: String(patientObjectId),
      recordedAt: p.recordedDate || p.recordedAt || p.createdAt || new Date().toISOString(),
      source: 'patient',
      verified: false, // patient entries start unverified
      bloodPressure: p.bloodPressure,
      temperature: typeof p.temperature === 'number' ? p.temperature : undefined, // expect °C if used
      heartRate: typeof p.heartRate === 'number' ? p.heartRate : undefined,
      weight: typeof p.weight === 'number' ? p.weight : undefined,
      bloodGlucose: typeof p.bloodGlucose === 'number' ? p.bloodGlucose : undefined,
      notes: p.notes,
    }));

    // 3) Overlay verification for patient entries via VitalsVerification
    const entryIds = patientItems.map((i) => i._id);
    const verQuery: any = { patientId: patientObjectId, entryId: { $in: entryIds } };
    if (workplaceObjectId) verQuery.workplaceId = workplaceObjectId;

    const verDocs = await VitalsVerification.find(verQuery).select('entryId verified').lean();
    const verMap = new Map<string, boolean>((verDocs || []).map((d: any) => [String(d.entryId), !!d.verified]));

    const patientItemsWithVer = patientItems.map((i) => ({ ...i, verified: verMap.get(i._id) ?? i.verified }));

    // 4) Merge + sort + paginate
    const merged = [...pharmacistItems, ...patientItemsWithVer]
      .filter((i) => i.temperature || i.bloodPressure || i.heartRate || i.weight || i.bloodGlucose)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    const total = merged.length;
    const results = merged.slice(skip, skip + limit);

    return { results, total, hasMore: skip + results.length < total };
  }
}
