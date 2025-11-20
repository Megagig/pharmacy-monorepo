// Template Types and Configurations

export interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    reportType: string;
    layout: LayoutConfig;
    filters: FilterDefinition[];
    charts: ChartConfig[];
    tables: TableConfig[];
    sections: TemplateSection[];
    metadata: TemplateMetadata;
    permissions: TemplatePermissions;
    createdBy: string;
    workspaceId: string;
    isPublic: boolean;
    isDefault: boolean;
    version: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface LayoutConfig {
    type: 'dashboard' | 'report' | 'executive' | 'detailed' | 'custom';
    grid: GridConfig;
    responsive: boolean;
    theme: string;
    spacing: SpacingConfig;
    breakpoints: BreakpointConfig;
}

export interface GridConfig {
    columns: number;
    rows: number;
    gap: number;
    autoFlow: 'row' | 'column' | 'dense';
    areas?: string[][];
}

export interface BreakpointConfig {
    xs: Partial<GridConfig>;
    sm: Partial<GridConfig>;
    md: Partial<GridConfig>;
    lg: Partial<GridConfig>;
    xl: Partial<GridConfig>;
}

export interface TemplateSection {
    id: string;
    type: 'header' | 'summary' | 'charts' | 'tables' | 'text' | 'spacer' | 'footer';
    title?: string;
    content: SectionContent;
    layout: SectionLayout;
    visibility: VisibilityConfig;
    order: number;
}

export interface SectionContent {
    // Header section
    logo?: string;
    title?: string;
    subtitle?: string;
    metadata?: boolean;

    // Summary section
    kpis?: string[]; // KPI chart IDs
    metrics?: MetricConfig[];

    // Charts section
    charts?: string[]; // Chart IDs
    arrangement?: 'grid' | 'carousel' | 'tabs' | 'accordion';

    // Tables section
    tables?: string[]; // Table IDs
    pagination?: boolean;
    sorting?: boolean;
    filtering?: boolean;

    // Text section
    text?: string;
    markdown?: boolean;
    variables?: Record<string, string>;

    // Custom content
    component?: string;
    props?: Record<string, any>;
}

export interface SectionLayout {
    gridArea?: string;
    span: {
        columns: number;
        rows: number;
    };
    alignment: {
        horizontal: 'left' | 'center' | 'right' | 'stretch';
        vertical: 'top' | 'center' | 'bottom' | 'stretch';
    };
    padding: SpacingValue;
    margin: SpacingValue;
    background?: string;
    border?: BorderConfig;
}

export interface SpacingValue {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface BorderConfig {
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
    color: string;
    radius: number;
}

export interface VisibilityConfig {
    conditions?: VisibilityCondition[];
    roles?: string[];
    permissions?: string[];
    responsive?: {
        xs?: boolean;
        sm?: boolean;
        md?: boolean;
        lg?: boolean;
        xl?: boolean;
    };
}

export interface VisibilityCondition {
    type: 'data' | 'filter' | 'permission' | 'custom';
    field?: string;
    operator: 'equals' | 'not-equals' | 'greater' | 'less' | 'contains' | 'exists';
    value?: any;
    function?: string;
}

export interface MetricConfig {
    id: string;
    label: string;
    value: string | number;
    unit?: string;
    format?: string;
    trend?: TrendConfig;
    target?: TargetConfig;
    status?: StatusConfig;
}

export interface TrendConfig {
    direction: 'up' | 'down' | 'stable';
    value: number;
    period: string;
    format: 'percentage' | 'absolute' | 'currency';
}

export interface TargetConfig {
    value: number;
    label: string;
    comparison: 'above' | 'below' | 'equal';
}

export interface StatusConfig {
    type: 'success' | 'warning' | 'error' | 'info';
    message?: string;
    icon?: string;
}

export interface TemplateMetadata {
    category: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number; // minutes
    dataRequirements: string[];
    dependencies: string[];
    changelog: ChangelogEntry[];
}

export interface ChangelogEntry {
    version: string;
    date: Date;
    changes: string[];
    author: string;
}

export interface TemplatePermissions {
    view: string[];
    edit: string[];
    delete: string[];
    share: string[];
    export: string[];
}

// Template Builder Types
export interface TemplateBuilder {
    template: ReportTemplate;
    currentSection?: string;
    draggedItem?: DraggedItem;
    clipboard?: ClipboardItem;
    history: HistoryEntry[];
    historyIndex: number;
    isDirty: boolean;
    isValid: boolean;
    errors: ValidationError[];
}

export interface DraggedItem {
    type: 'section' | 'chart' | 'table' | 'metric';
    id: string;
    data: any;
    source: 'palette' | 'template';
}

export interface ClipboardItem {
    type: 'section' | 'chart' | 'table' | 'metric';
    data: any;
    timestamp: Date;
}

export interface HistoryEntry {
    action: 'add' | 'remove' | 'modify' | 'move' | 'copy' | 'paste';
    target: string;
    before?: any;
    after?: any;
    timestamp: Date;
}

export interface ValidationError {
    type: 'error' | 'warning';
    field: string;
    message: string;
    suggestion?: string;
}

// Template Marketplace Types
export interface TemplateMarketplace {
    featured: ReportTemplate[];
    categories: TemplateCategory[];
    recent: ReportTemplate[];
    popular: ReportTemplate[];
    userTemplates: ReportTemplate[];
}

export interface TemplateCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    templates: ReportTemplate[];
    subcategories?: TemplateCategory[];
}

export interface TemplateRating {
    templateId: string;
    userId: string;
    rating: number; // 1-5
    review?: string;
    createdAt: Date;
}

export interface TemplateUsage {
    templateId: string;
    userId: string;
    workspaceId: string;
    usedAt: Date;
    customizations?: Record<string, any>;
}

// Template Import/Export Types
export interface TemplateExport {
    template: ReportTemplate;
    dependencies: {
        charts: ChartConfig[];
        tables: TableConfig[];
        filters: FilterDefinition[];
    };
    metadata: {
        exportedBy: string;
        exportedAt: Date;
        version: string;
        compatibility: string[];
    };
}

export interface TemplateImport {
    source: 'file' | 'url' | 'marketplace' | 'workspace';
    data: TemplateExport;
    options: ImportOptions;
    conflicts?: ImportConflict[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: ImportResult;
}

export interface ImportOptions {
    overwriteExisting: boolean;
    preserveIds: boolean;
    updateDependencies: boolean;
    validateCompatibility: boolean;
    createBackup: boolean;
}

export interface ImportConflict {
    type: 'template' | 'chart' | 'table' | 'filter';
    id: string;
    name: string;
    action: 'skip' | 'overwrite' | 'rename' | 'merge';
    newName?: string;
}

export interface ImportResult {
    imported: number;
    skipped: number;
    failed: number;
    warnings: string[];
    errors: string[];
    mapping: Record<string, string>; // old ID -> new ID
}

// Template Sharing Types
export interface TemplateShare {
    id: string;
    templateId: string;
    sharedBy: string;
    sharedWith: string[];
    permissions: SharePermissions;
    expiresAt?: Date;
    accessCount: number;
    lastAccessed?: Date;
    createdAt: Date;
}

export interface SharePermissions {
    view: boolean;
    edit: boolean;
    copy: boolean;
    share: boolean;
    export: boolean;
}

export interface TemplateCollaboration {
    templateId: string;
    collaborators: Collaborator[];
    changes: CollaborationChange[];
    conflicts: CollaborationConflict[];
    lastSyncAt: Date;
}

export interface Collaborator {
    userId: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    isOnline: boolean;
    lastSeen: Date;
    cursor?: {
        section: string;
        position: { x: number; y: number };
    };
}

export interface CollaborationChange {
    id: string;
    userId: string;
    action: string;
    target: string;
    data: any;
    timestamp: Date;
    applied: boolean;
}

export interface CollaborationConflict {
    id: string;
    type: 'concurrent-edit' | 'version-mismatch' | 'permission-denied';
    users: string[];
    target: string;
    resolution: 'manual' | 'auto-merge' | 'last-writer-wins';
    resolvedBy?: string;
    resolvedAt?: Date;
}