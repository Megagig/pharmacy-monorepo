// Filter Types and Configurations

export interface ReportFilters {
    dateRange: DateRange;
    patientCriteria?: PatientCriteria;
    therapyType?: string[];
    pharmacistId?: string[];
    location?: string[];
    priority?: string[];
    status?: string[];
    customFilters?: Record<string, any>;
}

export interface DateRange {
    startDate: Date;
    endDate: Date;
    preset?: DatePreset;
}

export type DatePreset = '7d' | '30d' | '90d' | '6months' | '1year' | 'custom';

export interface PatientCriteria {
    ageRange?: {
        min: number;
        max: number;
    };
    gender?: 'male' | 'female' | 'other' | 'all';
    conditions?: string[];
    medications?: string[];
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface FilterDefinition {
    key: string;
    label: string;
    type: FilterType;
    options?: FilterOption[];
    validation?: ValidationRule[];
    dependencies?: string[]; // Other filter keys this depends on
    defaultValue?: any;
    required?: boolean;
    multiple?: boolean;
    searchable?: boolean;
    placeholder?: string;
    helpText?: string;
}

export type FilterType =
    | 'text'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'date'
    | 'daterange'
    | 'checkbox'
    | 'radio'
    | 'slider'
    | 'autocomplete'
    | 'tags';

export interface FilterOption {
    value: string | number | boolean;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
    disabled?: boolean;
    group?: string;
}

export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: any;
    message: string;
    validator?: (value: any) => boolean;
}

export interface FilterGroup {
    id: string;
    label: string;
    description?: string;
    collapsible: boolean;
    defaultExpanded: boolean;
    filters: FilterDefinition[];
}

export interface FilterPreset {
    id: string;
    name: string;
    description?: string;
    filters: ReportFilters;
    isDefault?: boolean;
    isPublic?: boolean;
    createdBy: string;
    createdAt: Date;
    tags?: string[];
}

export interface FilterState {
    values: Record<string, any>;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    isValid: boolean;
    isDirty: boolean;
}

export interface FilterPanelConfig {
    reportType: string;
    groups: FilterGroup[];
    presets: FilterPreset[];
    allowSavePreset: boolean;
    allowReset: boolean;
    autoApply: boolean;
    debounceMs: number;
}

// Specific filter configurations for different report types
export interface PatientOutcomeFilters extends ReportFilters {
    outcomeType?: 'clinical' | 'quality-of-life' | 'adherence' | 'adverse-events';
    measurementPeriod?: 'baseline' | '30-days' | '90-days' | '6-months' | '1-year';
    improvementThreshold?: number;
}

export interface PharmacistInterventionFilters extends ReportFilters {
    interventionType?: string[];
    interventionCategory?: string[];
    targetAudience?: string[];
    communicationMethod?: string[];
    outcome?: string[];
    urgency?: string[];
}

export interface TherapyEffectivenessFilters extends ReportFilters {
    medicationCategory?: string[];
    adherenceThreshold?: number;
    effectivenessMetric?: 'completion-rate' | 'clinical-outcome' | 'patient-satisfaction';
    therapyDuration?: 'short-term' | 'medium-term' | 'long-term';
}

export interface CostEffectivenessFilters extends ReportFilters {
    costCategory?: string[];
    savingsType?: 'direct' | 'indirect' | 'total';
    roiThreshold?: number;
    currency?: string;
}

export interface QualityImprovementFilters extends ReportFilters {
    qualityMetric?: string[];
    complianceThreshold?: number;
    improvementArea?: string[];
    benchmarkType?: 'internal' | 'external' | 'industry';
}

export interface RegulatoryComplianceFilters extends ReportFilters {
    regulationType?: string[];
    complianceStatus?: 'compliant' | 'non-compliant' | 'pending' | 'all';
    auditPeriod?: string;
    riskLevel?: string[];
}

export interface OperationalEfficiencyFilters extends ReportFilters {
    processType?: string[];
    efficiencyMetric?: string[];
    benchmarkComparison?: boolean;
    bottleneckAnalysis?: boolean;
}

export interface MedicationInventoryFilters extends ReportFilters {
    medicationCategory?: string[];
    inventoryStatus?: 'in-stock' | 'low-stock' | 'out-of-stock' | 'expiring';
    turnoverRate?: 'fast' | 'medium' | 'slow';
    forecastPeriod?: '30-days' | '90-days' | '6-months' | '1-year';
}

export interface TrendForecastingFilters extends ReportFilters {
    trendType?: string[];
    forecastPeriod?: '30-days' | '90-days' | '6-months' | '1-year' | '2-years';
    confidenceLevel?: number;
    seasonalAdjustment?: boolean;
}

export interface PatientDemographicsFilters extends ReportFilters {
    demographicType?: string[];
    segmentationCriteria?: string[];
    geographicLevel?: 'city' | 'state' | 'region' | 'country';
    serviceType?: string[];
}

export interface AdverseEventFilters extends ReportFilters {
    eventType?: string[];
    severity?: string[];
    causality?: string[];
    preventability?: 'preventable' | 'not-preventable' | 'unknown';
    reportingSource?: string[];
}

// Filter utility types
export interface FilterHistory {
    id: string;
    filters: ReportFilters;
    timestamp: Date;
    description?: string;
}

export interface FilterComparison {
    baseline: ReportFilters;
    comparison: ReportFilters;
    differences: Array<{
        key: string;
        baselineValue: any;
        comparisonValue: any;
        type: 'added' | 'removed' | 'changed';
    }>;
}

export interface FilterSuggestion {
    key: string;
    value: any;
    reason: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
}