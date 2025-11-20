// Report Types and Enumerations

export enum ReportType {
    PATIENT_OUTCOMES = 'patient-outcomes',
    PHARMACIST_INTERVENTIONS = 'pharmacist-interventions',
    THERAPY_EFFECTIVENESS = 'therapy-effectiveness',
    QUALITY_IMPROVEMENT = 'quality-improvement',
    REGULATORY_COMPLIANCE = 'regulatory-compliance',
    COST_EFFECTIVENESS = 'cost-effectiveness',
    TREND_FORECASTING = 'trend-forecasting',
    OPERATIONAL_EFFICIENCY = 'operational-efficiency',
    MEDICATION_INVENTORY = 'medication-inventory',
    PATIENT_DEMOGRAPHICS = 'patient-demographics',
    ADVERSE_EVENTS = 'adverse-events',
    CUSTOM_TEMPLATES = 'custom-templates',
}

export interface ReportMetadata {
    id: string;
    title: string;
    description: string;
    category: string;
    generatedAt: Date;
    generatedBy: string;
    workspaceId: string;
    filters: ReportFilters;
    dataPoints: number;
    version: string;
}

export interface SummaryMetrics {
    totalRecords: number;
    primaryMetric: {
        label: string;
        value: number | string;
        unit?: string;
        trend?: 'up' | 'down' | 'stable';
        changePercent?: number;
    };
    secondaryMetrics: Array<{
        label: string;
        value: number | string;
        unit?: string;
        icon?: string;
        color?: string;
    }>;
}

export interface TableData {
    id: string;
    title: string;
    columns: TableColumn[];
    rows: TableRow[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
}

export interface TableColumn {
    key: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'status';
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
}

export interface TableRow {
    id: string;
    [key: string]: string | number | boolean | Date;
}

export interface ReportData {
    summary: SummaryMetrics;
    charts: ChartData[];
    tables: TableData[];
    metadata: ReportMetadata;
}

// Specific Report Data Interfaces
export interface PatientOutcomeData {
    therapyEffectiveness: {
        improved: number;
        stable: number;
        declined: number;
        total: number;
    };
    clinicalParameters: Array<{
        parameter: string;
        beforeValue: number;
        afterValue: number;
        improvement: number;
        unit: string;
    }>;
    adverseEvents: {
        reduced: number;
        prevented: number;
        total: number;
    };
    qualityOfLife: {
        improved: number;
        maintained: number;
        declined: number;
        total: number;
    };
}

export interface PharmacistInterventionData {
    interventionMetrics: {
        total: number;
        accepted: number;
        rejected: number;
        pending: number;
        acceptanceRate: number;
    };
    interventionTypes: Array<{
        type: string;
        count: number;
        acceptanceRate: number;
        effectiveness: number;
    }>;
    pharmacistPerformance: Array<{
        pharmacistId: string;
        name: string;
        interventions: number;
        acceptanceRate: number;
        qualityScore: number;
    }>;
}

export interface TherapyEffectivenessData {
    adherenceMetrics: {
        excellent: number; // >90%
        good: number; // 70-90%
        poor: number; // <70%
        average: number;
    };
    completionRates: {
        completed: number;
        ongoing: number;
        discontinued: number;
        total: number;
    };
    effectivenessByCategory: Array<{
        category: string;
        effectiveness: number;
        patientCount: number;
        adherenceRate: number;
    }>;
}

export interface CostEffectivenessData {
    costSavings: {
        total: number;
        perPatient: number;
        perIntervention: number;
        currency: string;
    };
    revenueImpact: {
        increased: number;
        maintained: number;
        decreased: number;
        total: number;
    };
    roi: {
        percentage: number;
        paybackPeriod: number; // months
        netBenefit: number;
    };
    costBreakdown: Array<{
        category: string;
        cost: number;
        savings: number;
        netImpact: number;
    }>;
}

export interface QualityImprovementData {
    completionTimes: {
        average: number;
        median: number;
        target: number;
        unit: string;
    };
    problemPatterns: Array<{
        pattern: string;
        frequency: number;
        severity: 'low' | 'medium' | 'high' | 'critical';
        trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    followUpCompliance: {
        rate: number;
        onTime: number;
        delayed: number;
        missed: number;
    };
    documentationQuality: {
        complete: number;
        incomplete: number;
        missing: number;
        qualityScore: number;
    };
}

export interface RegulatoryComplianceData {
    complianceMetrics: {
        overall: number;
        documentation: number;
        procedures: number;
        reporting: number;
    };
    auditTrail: Array<{
        activity: string;
        timestamp: Date;
        user: string;
        status: 'compliant' | 'non-compliant' | 'pending';
    }>;
    complianceIssues: Array<{
        issue: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        status: 'open' | 'in-progress' | 'resolved';
        dueDate: Date;
    }>;
}

export interface OperationalEfficiencyData {
    workflowMetrics: {
        averageProcessingTime: number;
        bottlenecks: Array<{
            process: string;
            delay: number;
            impact: 'low' | 'medium' | 'high';
        }>;
        throughput: number;
        capacity: number;
        utilization: number;
    };
    resourceUtilization: Array<{
        resource: string;
        utilization: number;
        capacity: number;
        efficiency: number;
    }>;
    performanceBenchmarks: Array<{
        metric: string;
        current: number;
        target: number;
        benchmark: number;
        unit: string;
    }>;
}

export interface MedicationInventoryData {
    usagePatterns: Array<{
        medication: string;
        usage: number;
        trend: 'increasing' | 'stable' | 'decreasing';
        seasonality: boolean;
    }>;
    inventoryTurnover: {
        average: number;
        fast: Array<{ medication: string; turnover: number }>;
        slow: Array<{ medication: string; turnover: number }>;
    };
    demandForecasting: Array<{
        medication: string;
        currentStock: number;
        predictedDemand: number;
        recommendedOrder: number;
        confidence: number;
    }>;
    expirationTracking: {
        expiringSoon: number; // within 30 days
        expired: number;
        wasteValue: number;
        currency: string;
    };
}

export interface TrendForecastingData {
    historicalTrends: Array<{
        period: string;
        value: number;
        trend: 'up' | 'down' | 'stable';
    }>;
    predictions: Array<{
        period: string;
        predicted: number;
        confidence: number;
        upperBound: number;
        lowerBound: number;
    }>;
    seasonalPatterns: Array<{
        season: string;
        pattern: 'high' | 'medium' | 'low';
        variance: number;
    }>;
    anomalies: Array<{
        date: Date;
        value: number;
        expected: number;
        deviation: number;
        significance: 'low' | 'medium' | 'high';
    }>;
}

export interface PatientDemographicsData {
    ageDistribution: Array<{
        ageGroup: string;
        count: number;
        percentage: number;
    }>;
    geographicPatterns: Array<{
        location: string;
        patientCount: number;
        serviceUtilization: number;
    }>;
    patientJourney: Array<{
        stage: string;
        patients: number;
        conversionRate: number;
        averageDuration: number;
    }>;
    serviceUtilization: Array<{
        service: string;
        utilization: number;
        satisfaction: number;
        frequency: number;
    }>;
}

export interface AdverseEventData {
    incidentFrequency: Array<{
        eventType: string;
        frequency: number;
        severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
        trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    severityDistribution: {
        mild: number;
        moderate: number;
        severe: number;
        lifeThreatening: number;
    };
    rootCauseAnalysis: Array<{
        cause: string;
        frequency: number;
        impact: number;
        preventable: boolean;
    }>;
    safetyPatterns: Array<{
        pattern: string;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        recommendation: string;
    }>;
}