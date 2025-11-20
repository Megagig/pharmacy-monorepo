import mongoose from 'mongoose';
import LabTestTemplate, { ILabTestTemplate } from '../models/LabTestTemplate';
import logger from '../utils/logger';

/**
 * Pre-populated Lab Test Panel Templates
 * These are system templates that can be used across all workplaces
 */

const systemTemplates = [
    // 1. Lipid Panel
    {
        name: 'Lipid Panel',
        code: 'LIPID_PANEL',
        description: 'Comprehensive lipid profile including cholesterol, triglycerides, HDL, and LDL',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'Total Cholesterol',
                testCode: 'CHOL',
                loincCode: '2093-3',
                unit: 'mg/dL',
                referenceRange: '<200 mg/dL',
                referenceRangeLow: 0,
                referenceRangeHigh: 200,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'Triglycerides',
                testCode: 'TRIG',
                loincCode: '2571-8',
                unit: 'mg/dL',
                referenceRange: '<150 mg/dL',
                referenceRangeLow: 0,
                referenceRangeHigh: 150,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'HDL Cholesterol',
                testCode: 'HDL',
                loincCode: '2085-9',
                unit: 'mg/dL',
                referenceRange: '>40 mg/dL (M), >50 mg/dL (F)',
                referenceRangeLow: 40,
                referenceRangeHigh: 999,
                specimenType: 'Blood',
                order: 3
            },
            {
                testName: 'LDL Cholesterol',
                testCode: 'LDL',
                loincCode: '2089-1',
                unit: 'mg/dL',
                referenceRange: '<100 mg/dL',
                referenceRangeLow: 0,
                referenceRangeHigh: 100,
                specimenType: 'Blood',
                order: 4
            },
            {
                testName: 'VLDL Cholesterol',
                testCode: 'VLDL',
                unit: 'mg/dL',
                referenceRange: '5-40 mg/dL',
                referenceRangeLow: 5,
                referenceRangeHigh: 40,
                specimenType: 'Blood',
                order: 5
            }
        ]
    },

    // 2. Renal Function Panel
    {
        name: 'Renal Function Panel',
        code: 'RENAL_PANEL',
        description: 'Kidney function tests including creatinine, BUN, and electrolytes',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'Creatinine',
                testCode: 'CREAT',
                loincCode: '2160-0',
                unit: 'mg/dL',
                referenceRange: '0.7-1.3 mg/dL (M), 0.6-1.1 mg/dL (F)',
                referenceRangeLow: 0.6,
                referenceRangeHigh: 1.3,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'Blood Urea Nitrogen (BUN)',
                testCode: 'BUN',
                loincCode: '3094-0',
                unit: 'mg/dL',
                referenceRange: '7-20 mg/dL',
                referenceRangeLow: 7,
                referenceRangeHigh: 20,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'eGFR',
                testCode: 'EGFR',
                loincCode: '33914-3',
                unit: 'mL/min/1.73m²',
                referenceRange: '>60 mL/min/1.73m²',
                referenceRangeLow: 60,
                referenceRangeHigh: 999,
                specimenType: 'Blood',
                order: 3
            },
            {
                testName: 'Sodium',
                testCode: 'NA',
                loincCode: '2951-2',
                unit: 'mmol/L',
                referenceRange: '136-145 mmol/L',
                referenceRangeLow: 136,
                referenceRangeHigh: 145,
                specimenType: 'Blood',
                order: 4
            },
            {
                testName: 'Potassium',
                testCode: 'K',
                loincCode: '2823-3',
                unit: 'mmol/L',
                referenceRange: '3.5-5.0 mmol/L',
                referenceRangeLow: 3.5,
                referenceRangeHigh: 5.0,
                specimenType: 'Blood',
                order: 5
            },
            {
                testName: 'Chloride',
                testCode: 'CL',
                loincCode: '2075-0',
                unit: 'mmol/L',
                referenceRange: '98-107 mmol/L',
                referenceRangeLow: 98,
                referenceRangeHigh: 107,
                specimenType: 'Blood',
                order: 6
            }
        ]
    },

    // 3. Liver Function Panel
    {
        name: 'Liver Function Panel',
        code: 'LIVER_PANEL',
        description: 'Comprehensive liver function tests including ALT, AST, bilirubin, and albumin',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'ALT (Alanine Aminotransferase)',
                testCode: 'ALT',
                loincCode: '1742-6',
                unit: 'U/L',
                referenceRange: '7-56 U/L',
                referenceRangeLow: 7,
                referenceRangeHigh: 56,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'AST (Aspartate Aminotransferase)',
                testCode: 'AST',
                loincCode: '1920-8',
                unit: 'U/L',
                referenceRange: '10-40 U/L',
                referenceRangeLow: 10,
                referenceRangeHigh: 40,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'Alkaline Phosphatase (ALP)',
                testCode: 'ALP',
                loincCode: '6768-6',
                unit: 'U/L',
                referenceRange: '44-147 U/L',
                referenceRangeLow: 44,
                referenceRangeHigh: 147,
                specimenType: 'Blood',
                order: 3
            },
            {
                testName: 'Total Bilirubin',
                testCode: 'TBIL',
                loincCode: '1975-2',
                unit: 'mg/dL',
                referenceRange: '0.1-1.2 mg/dL',
                referenceRangeLow: 0.1,
                referenceRangeHigh: 1.2,
                specimenType: 'Blood',
                order: 4
            },
            {
                testName: 'Direct Bilirubin',
                testCode: 'DBIL',
                loincCode: '1968-7',
                unit: 'mg/dL',
                referenceRange: '0.0-0.3 mg/dL',
                referenceRangeLow: 0.0,
                referenceRangeHigh: 0.3,
                specimenType: 'Blood',
                order: 5
            },
            {
                testName: 'Albumin',
                testCode: 'ALB',
                loincCode: '1751-7',
                unit: 'g/dL',
                referenceRange: '3.5-5.5 g/dL',
                referenceRangeLow: 3.5,
                referenceRangeHigh: 5.5,
                specimenType: 'Blood',
                order: 6
            },
            {
                testName: 'Total Protein',
                testCode: 'TP',
                loincCode: '2885-2',
                unit: 'g/dL',
                referenceRange: '6.0-8.3 g/dL',
                referenceRangeLow: 6.0,
                referenceRangeHigh: 8.3,
                specimenType: 'Blood',
                order: 7
            }
        ]
    },

    // 4. Complete Blood Count (CBC)
    {
        name: 'Complete Blood Count (CBC)',
        code: 'CBC',
        description: 'Comprehensive blood cell count including RBC, WBC, hemoglobin, and platelets',
        category: 'Hematology',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'White Blood Cell Count (WBC)',
                testCode: 'WBC',
                loincCode: '6690-2',
                unit: '10³/µL',
                referenceRange: '4.5-11.0 10³/µL',
                referenceRangeLow: 4.5,
                referenceRangeHigh: 11.0,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'Red Blood Cell Count (RBC)',
                testCode: 'RBC',
                loincCode: '789-8',
                unit: '10⁶/µL',
                referenceRange: '4.5-5.9 10⁶/µL (M), 4.1-5.1 10⁶/µL (F)',
                referenceRangeLow: 4.1,
                referenceRangeHigh: 5.9,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'Hemoglobin',
                testCode: 'HGB',
                loincCode: '718-7',
                unit: 'g/dL',
                referenceRange: '13.5-17.5 g/dL (M), 12.0-15.5 g/dL (F)',
                referenceRangeLow: 12.0,
                referenceRangeHigh: 17.5,
                specimenType: 'Blood',
                order: 3
            },
            {
                testName: 'Hematocrit',
                testCode: 'HCT',
                loincCode: '4544-3',
                unit: '%',
                referenceRange: '38.8-50.0% (M), 34.9-44.5% (F)',
                referenceRangeLow: 34.9,
                referenceRangeHigh: 50.0,
                specimenType: 'Blood',
                order: 4
            },
            {
                testName: 'Platelet Count',
                testCode: 'PLT',
                loincCode: '777-3',
                unit: '10³/µL',
                referenceRange: '150-400 10³/µL',
                referenceRangeLow: 150,
                referenceRangeHigh: 400,
                specimenType: 'Blood',
                order: 5
            }
        ]
    },

    // 5. HbA1c Panel (Diabetes Monitoring)
    {
        name: 'HbA1c Panel',
        code: 'HBA1C_PANEL',
        description: 'Diabetes monitoring panel including HbA1c and fasting blood glucose',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'HbA1c (Glycated Hemoglobin)',
                testCode: 'HBA1C',
                loincCode: '4548-4',
                unit: '%',
                referenceRange: '<5.7% (Normal), 5.7-6.4% (Prediabetes), ≥6.5% (Diabetes)',
                referenceRangeLow: 0,
                referenceRangeHigh: 5.7,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'Fasting Blood Glucose',
                testCode: 'FBG',
                loincCode: '1558-6',
                unit: 'mg/dL',
                referenceRange: '70-100 mg/dL',
                referenceRangeLow: 70,
                referenceRangeHigh: 100,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'Random Blood Glucose',
                testCode: 'RBG',
                loincCode: '2345-7',
                unit: 'mg/dL',
                referenceRange: '<140 mg/dL',
                referenceRangeLow: 0,
                referenceRangeHigh: 140,
                specimenType: 'Blood',
                order: 3
            }
        ]
    },

    // 6. Thyroid Function Panel
    {
        name: 'Thyroid Function Panel',
        code: 'THYROID_PANEL',
        description: 'Comprehensive thyroid function tests including TSH, T3, and T4',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'TSH (Thyroid Stimulating Hormone)',
                testCode: 'TSH',
                loincCode: '3016-3',
                unit: 'mIU/L',
                referenceRange: '0.4-4.0 mIU/L',
                referenceRangeLow: 0.4,
                referenceRangeHigh: 4.0,
                specimenType: 'Blood',
                order: 1
            },
            {
                testName: 'Free T4 (Thyroxine)',
                testCode: 'FT4',
                loincCode: '3024-7',
                unit: 'ng/dL',
                referenceRange: '0.8-1.8 ng/dL',
                referenceRangeLow: 0.8,
                referenceRangeHigh: 1.8,
                specimenType: 'Blood',
                order: 2
            },
            {
                testName: 'Free T3 (Triiodothyronine)',
                testCode: 'FT3',
                loincCode: '3051-0',
                unit: 'pg/mL',
                referenceRange: '2.3-4.2 pg/mL',
                referenceRangeLow: 2.3,
                referenceRangeHigh: 4.2,
                specimenType: 'Blood',
                order: 3
            }
        ]
    },

    // 7. Urinalysis Panel
    {
        name: 'Urinalysis Panel',
        code: 'URINALYSIS',
        description: 'Comprehensive urine analysis including physical, chemical, and microscopic examination',
        category: 'Chemistry',
        isSystemTemplate: true,
        isActive: true,
        tests: [
            {
                testName: 'Urine Color',
                testCode: 'UCOLOR',
                loincCode: '5778-6',
                unit: '',
                referenceRange: 'Yellow to Amber',
                specimenType: 'Urine',
                order: 1
            },
            {
                testName: 'Urine pH',
                testCode: 'UPH',
                loincCode: '5803-2',
                unit: '',
                referenceRange: '4.5-8.0',
                referenceRangeLow: 4.5,
                referenceRangeHigh: 8.0,
                specimenType: 'Urine',
                order: 2
            },
            {
                testName: 'Urine Protein',
                testCode: 'UPROT',
                loincCode: '2888-6',
                unit: 'mg/dL',
                referenceRange: 'Negative',
                referenceRangeLow: 0,
                referenceRangeHigh: 0,
                specimenType: 'Urine',
                order: 3
            },
            {
                testName: 'Urine Glucose',
                testCode: 'UGLUC',
                loincCode: '2350-7',
                unit: 'mg/dL',
                referenceRange: 'Negative',
                referenceRangeLow: 0,
                referenceRangeHigh: 0,
                specimenType: 'Urine',
                order: 4
            },
            {
                testName: 'Urine Ketones',
                testCode: 'UKET',
                loincCode: '2514-8',
                unit: '',
                referenceRange: 'Negative',
                specimenType: 'Urine',
                order: 5
            }
        ]
    }
];

/**
 * Seed lab test templates into database
 */
export async function seedLabTestTemplates(): Promise<void> {
    try {
        logger.info('Starting lab test template seeding...');

        // Check if templates already exist
        const existingCount = await LabTestTemplate.countDocuments({ isSystemTemplate: true });

        if (existingCount > 0) {
            logger.info(`Found ${existingCount} existing system templates. Skipping seed.`);
            return;
        }

        // Create a system user ID for createdBy field
        const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');

        // Insert templates
        const templatesWithAudit = systemTemplates.map(template => ({
            ...template,
            createdBy: systemUserId,
            usageCount: 0
        }));

        const result = await LabTestTemplate.insertMany(templatesWithAudit);

        logger.info(`Successfully seeded ${result.length} lab test templates`);

        // Log template names
        result.forEach(template => {
            logger.info(`  - ${template.name} (${template.code}): ${template.tests.length} tests`);
        });

    } catch (error) {
        logger.error('Error seeding lab test templates:', error);
        throw error;
    }
}

/**
 * Remove all system templates (for testing/reset)
 */
export async function removeSystemTemplates(): Promise<void> {
    try {
        const result = await LabTestTemplate.deleteMany({ isSystemTemplate: true });
        logger.info(`Removed ${result.deletedCount} system templates`);
    } catch (error) {
        logger.error('Error removing system templates:', error);
        throw error;
    }
}

export default {
    seedLabTestTemplates,
    removeSystemTemplates,
    systemTemplates
};

