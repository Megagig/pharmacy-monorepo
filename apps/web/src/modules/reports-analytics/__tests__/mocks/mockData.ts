import {
    ReportData,
    ChartData,
    ReportFilters,
    ReportType,
    ChartType,
    DateRange,
    SummaryMetrics,
    TableData,
    ReportMetadata
} from '../../types';

export const mockDateRange: DateRange = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    preset: '1year',
};

export const mockFilters: ReportFilters = {
    dateRange: mockDateRange,
    patientCriteria: {
        ageRange: { min: 18, max: 65 },
        conditions: ['diabetes', 'hypertension'],
    },
    therapyType: ['medication-therapy', 'clinical-intervention'],
    pharmacistId: ['pharmacist-1', 'pharmacist-2'],
    location: ['location-1'],
    priority: ['high', 'medium'],
    status: ['active', 'completed'],
};

export const mockChartData: ChartData[] = [
    {
        id: 'chart-1',
        name: 'January',
        value: 100,
        category: 'outcomes',
        timestamp: new Date('2024-01-01'),
        metadata: { trend: 'up', percentage: 15 },
    },
    {
        id: 'chart-2',
        name: 'February',
        value: 120,
        category: 'outcomes',
        timestamp: new Date('2024-02-01'),
        metadata: { trend: 'up', percentage: 20 },
    },
    {
        id: 'chart-3',
        name: 'March',
        value: 90,
        category: 'outcomes',
        timestamp: new Date('2024-03-01'),
        metadata: { trend: 'down', percentage: -10 },
    },
];

export const mockSummaryMetrics: SummaryMetrics = {
    totalPatients: 1250,
    totalInterventions: 450,
    successRate: 85.5,
    costSavings: 125000,
    trends: {
        patients: { value: 12, direction: 'up' },
        interventions: { value: 8, direction: 'up' },
        successRate: { value: 2.5, direction: 'up' },
        costSavings: { value: 15, direction: 'up' },
    },
};

export const mockTableData: TableData[] = [
    {
        id: 'table-1',
        columns: [
            { key: 'patient', label: 'Patient ID', type: 'string' },
            { key: 'intervention', label: 'Intervention', type: 'string' },
            { key: 'outcome', label: 'Outcome', type: 'string' },
            { key: 'date', label: 'Date', type: 'date' },
        ],
        rows: [
            { patient: 'P001', intervention: 'Medication Review', outcome: 'Improved', date: '2024-01-15' },
            { patient: 'P002', intervention: 'Therapy Adjustment', outcome: 'Stable', date: '2024-01-16' },
        ],
        pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
        },
    },
];

export const mockReportMetadata: ReportMetadata = {
    generatedAt: new Date('2024-01-01T10:00:00Z'),
    generatedBy: 'user-123',
    reportType: ReportType.PATIENT_OUTCOMES,
    filters: mockFilters,
    dataSource: 'primary',
    version: '1.0',
    executionTime: 1500,
};

export const mockReportData: ReportData = {
    summary: mockSummaryMetrics,
    charts: mockChartData,
    tables: mockTableData,
    metadata: mockReportMetadata,
};

export const mockChartConfig = {
    type: 'line' as ChartType,
    title: {
        text: 'Test Chart',
        subtitle: 'Test Subtitle',
        alignment: 'center' as const,
        style: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#333',
        },
    },
    theme: {
        colorPalette: ['#1f77b4', '#ff7f0e', '#2ca02c'],
        gradients: [],
        typography: {
            fontFamily: 'Roboto',
            fontSize: 12,
        },
        spacing: {
            margin: 10,
            padding: 5,
        },
        borderRadius: 4,
        shadows: [],
    },
    animations: {
        duration: 300,
        easing: 'ease-in-out' as const,
        stagger: false,
        entrance: 'fade' as const,
    },
    responsive: true,
    showTooltip: true,
    showLegend: true,
};

// Mock data generators
export const generateMockChartData = (count: number = 10): ChartData[] => {
    return Array.from({ length: count }, (_, index) => ({
        id: `chart-${index + 1}`,
        name: `Item ${index + 1}`,
        value: Math.floor(Math.random() * 100) + 1,
        category: 'test',
        timestamp: new Date(2024, 0, index + 1),
        metadata: {
            trend: Math.random() > 0.5 ? 'up' : 'down',
            percentage: Math.floor(Math.random() * 20) - 10,
        },
    }));
};

export const generateMockReportData = (reportType: ReportType): ReportData => ({
    ...mockReportData,
    metadata: {
        ...mockReportMetadata,
        reportType,
    },
});

export const createMockApiResponse = (data: unknown, delay: number = 100) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                ok: true,
                json: () => Promise.resolve(data),
            });
        }, delay);
    });
};

export const createMockApiError = (message: string, status: number = 500) => {
    return Promise.reject({
        ok: false,
        status,
        message,
    });
};