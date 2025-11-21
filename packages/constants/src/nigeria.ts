/**
 * Nigerian Healthcare Constants
 * States, LGAs, and healthcare-specific constants
 */

// Nigerian States
export const NIGERIAN_STATES = [
    'Abia',
    'Adamawa',
    'Akwa Ibom',
    'Anambra',
    'Bauchi',
    'Bayelsa',
    'Benue',
    'Borno',
    'Cross River',
    'Delta',
    'Ebonyi',
    'Edo',
    'Ekiti',
    'Enugu',
    'FCT',
    'Gombe',
    'Imo',
    'Jigawa',
    'Kaduna',
    'Kano',
    'Katsina',
    'Kebbi',
    'Kogi',
    'Kwara',
    'Lagos',
    'Nasarawa',
    'Niger',
    'Ogun',
    'Ondo',
    'Osun',
    'Oyo',
    'Plateau',
    'Rivers',
    'Sokoto',
    'Taraba',
    'Yobe',
    'Zamfara',
] as const;

// Blood Groups
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// Genotypes
export const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'] as const;

// Gender Options
export const GENDERS = ['male', 'female', 'other'] as const;

// Marital Status
export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;

// Severity Levels
export const SEVERITY_LEVELS = ['mild', 'moderate', 'severe'] as const;

// Drug Therapy Problem Types
export const DTP_TYPES = [
    'untreated_condition',
    'improper_drug_selection',
    'sub_therapeutic_dosage',
    'overdosage',
    'adverse_drug_reaction',
    'drug_interaction',
    'unnecessary_therapy',
    'non_adherence',
] as const;

// Medication Adherence Levels
export const ADHERENCE_LEVELS = ['good', 'fair', 'poor', 'unknown'] as const;

// Condition Status
export const CONDITION_STATUSES = ['active', 'resolved', 'remission'] as const;

// Medication Phases
export const MEDICATION_PHASES = ['current', 'past'] as const;

// DTP Status
export const DTP_STATUSES = ['unresolved', 'resolved'] as const;

// Phone Number Prefix
export const NIGERIA_PHONE_PREFIX = '+234';

// MRN Prefix
export const MRN_PREFIX = 'PHM';

// Date Formats
export const DATE_FORMATS = {
    DISPLAY: 'MMM DD, YYYY',
    INPUT: 'YYYY-MM-DD',
    DATETIME: 'MMM DD, YYYY HH:mm',
    TIME: 'HH:mm',
} as const;

// Currency
export const CURRENCY = {
    CODE: 'NGN',
    SYMBOL: '₦',
    NAME: 'Nigerian Naira',
} as const;
