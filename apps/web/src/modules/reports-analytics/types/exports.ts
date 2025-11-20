// Export and Scheduling Types

export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'json' | 'png' | 'svg';

export interface ExportConfig {
    format: ExportFormat;
    options: ExportOptions;
    metadata: ExportMetadata;
}

export interface ExportOptions {
    // PDF options
    pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
    margins?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    includeCharts?: boolean;
    chartResolution?: 'low' | 'medium' | 'high';
    watermark?: {
        text: string;
        opacity: number;
        position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    };

    // CSV/Excel options
    includeHeaders?: boolean;
    delimiter?: string; // for CSV
    encoding?: 'utf-8' | 'utf-16' | 'ascii';
    dateFormat?: string;
    numberFormat?: string;
    sheets?: Array<{
        name: string;
        data: 'summary' | 'charts' | 'tables' | 'raw';
    }>;

    // Image options (PNG/SVG)
    width?: number;
    height?: number;
    dpi?: number;
    backgroundColor?: string;
    transparent?: boolean;

    // General options
    includeMetadata?: boolean;
    includeFilters?: boolean;
    includeTimestamp?: boolean;
    customFooter?: string;
    customHeader?: string;
}

export interface ExportMetadata {
    title: string;
    description?: string;
    author: string;
    organization: string;
    generatedAt: Date;
    reportType: string;
    filters: Record<string, any>;
    dataRange: {
        startDate: Date;
        endDate: Date;
    };
    version: string;
    confidentiality?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface ExportResult {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    format: ExportFormat;
    filename: string;
    fileSize?: number;
    downloadUrl?: string;
    expiresAt?: Date;
    error?: string;
    progress?: number;
    estimatedTimeRemaining?: number;
    createdAt: Date;
    completedAt?: Date;
}

export interface ExportJob {
    id: string;
    reportType: string;
    filters: Record<string, any>;
    config: ExportConfig;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'normal' | 'high';
    progress: number;
    result?: ExportResult;
    error?: string;
    createdBy: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retryCount: number;
    maxRetries: number;
}

// Scheduling Types
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface ScheduleConfig {
    frequency: ScheduleFrequency;
    interval?: number; // for custom frequency
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    time: string; // HH:MM format
    timezone: string;
    endDate?: Date;
    maxRuns?: number;
}

export interface ReportSchedule {
    id: string;
    name: string;
    description?: string;
    reportType: string;
    filters: Record<string, any>;
    exportConfig: ExportConfig;
    schedule: ScheduleConfig;
    recipients: ScheduleRecipient[];
    isActive: boolean;
    nextRun?: Date;
    lastRun?: Date;
    runCount: number;
    successCount: number;
    failureCount: number;
    createdBy: string;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScheduleRecipient {
    type: 'email' | 'webhook' | 'ftp' | 'sftp';
    address: string;
    name?: string;
    options?: {
        // Email options
        subject?: string;
        body?: string;
        attachmentName?: string;

        // Webhook options
        method?: 'POST' | 'PUT';
        headers?: Record<string, string>;

        // FTP/SFTP options
        path?: string;
        credentials?: {
            username: string;
            password?: string;
            privateKey?: string;
        };
    };
}

export interface ScheduleRun {
    id: string;
    scheduleId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    exportResult?: ExportResult;
    deliveryResults: ScheduleDeliveryResult[];
    error?: string;
    logs: ScheduleLog[];
}

export interface ScheduleDeliveryResult {
    recipientType: 'email' | 'webhook' | 'ftp' | 'sftp';
    recipientAddress: string;
    status: 'pending' | 'delivered' | 'failed';
    deliveredAt?: Date;
    error?: string;
    retryCount: number;
}

export interface ScheduleLog {
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
    details?: any;
}

// Template Types for Exports
export interface ExportTemplate {
    id: string;
    name: string;
    description?: string;
    format: ExportFormat;
    layout: ExportLayout;
    sections: ExportSection[];
    styles: ExportStyles;
    isDefault?: boolean;
    isPublic?: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ExportLayout {
    type: 'standard' | 'executive' | 'detailed' | 'custom';
    pageBreaks: 'auto' | 'section' | 'chart' | 'none';
    tableOfContents: boolean;
    headerFooter: {
        header?: string;
        footer?: string;
        pageNumbers: boolean;
    };
}

export interface ExportSection {
    id: string;
    type: 'title' | 'summary' | 'chart' | 'table' | 'text' | 'spacer';
    title?: string;
    content?: any;
    order: number;
    pageBreakBefore?: boolean;
    pageBreakAfter?: boolean;
    styles?: Partial<ExportStyles>;
}

export interface ExportStyles {
    fonts: {
        title: FontStyle;
        heading: FontStyle;
        body: FontStyle;
        caption: FontStyle;
    };
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        text: string;
        background: string;
    };
    spacing: {
        section: number;
        paragraph: number;
        line: number;
    };
    borders: {
        table: string;
        chart: string;
        section: string;
    };
}

export interface FontStyle {
    family: string;
    size: number;
    weight: 'normal' | 'bold' | number;
    color: string;
    lineHeight?: number;
}

// Batch Export Types
export interface BatchExportRequest {
    reports: Array<{
        reportType: string;
        filters: Record<string, any>;
        config: ExportConfig;
    }>;
    batchConfig: {
        format: 'zip' | 'folder';
        naming: 'sequential' | 'descriptive' | 'timestamp';
        includeIndex: boolean;
    };
    delivery?: ScheduleRecipient[];
}

export interface BatchExportResult {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalReports: number;
    completedReports: number;
    failedReports: number;
    results: ExportResult[];
    batchFile?: {
        filename: string;
        downloadUrl: string;
        fileSize: number;
        expiresAt: Date;
    };
    createdAt: Date;
    completedAt?: Date;
}