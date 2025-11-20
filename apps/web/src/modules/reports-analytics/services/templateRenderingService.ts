// Template Rendering Service - Core engine for dynamic template rendering
import {
    ReportTemplate,
    TemplateSection,
    SectionContent,
    VisibilityCondition,
    MetricConfig,
    ValidationError
} from '../types/templates';
import { ChartData, ChartConfig, KPICardData, ProgressRingData } from '../types/charts';
import { ReportFilters, FilterDefinition } from '../types/filters';
import { ReportData } from '../types/reports';

export interface RenderContext {
    template: ReportTemplate;
    data: ReportData;
    filters: ReportFilters;
    userPermissions: string[];
    userRoles: string[];
    variables: Record<string, any>;
    theme: string;
    responsive: boolean;
    breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface RenderResult {
    sections: RenderedSection[];
    metadata: RenderMetadata;
    errors: ValidationError[];
    warnings: string[];
    performance: PerformanceMetrics;
}

export interface RenderedSection {
    id: string;
    type: string;
    title: string;
    content: RenderedContent;
    layout: ComputedLayout;
    visible: boolean;
    order: number;
    dependencies: string[];
}

export interface RenderedContent {
    // Header content
    logo?: string;
    title?: string;
    subtitle?: string;
    metadata?: Record<string, any>;

    // Summary content
    kpis?: RenderedKPI[];
    metrics?: RenderedMetric[];

    // Charts content
    charts?: RenderedChart[];
    arrangement?: 'grid' | 'carousel' | 'tabs' | 'accordion';

    // Tables content
    tables?: RenderedTable[];
    pagination?: PaginationConfig;

    // Text content
    text?: string;
    html?: string;
    variables?: Record<string, any>;

    // Custom content
    component?: string;
    props?: Record<string, any>;
}

export interface RenderedKPI {
    id: string;
    title: string;
    value: number | string;
    unit?: string;
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: number;
        period: string;
        color: string;
    };
    target?: {
        value: number;
        label: string;
        status: 'above' | 'below' | 'equal';
    };
    sparkline?: Array<{ x: string | number; y: number }>;
    status: 'success' | 'warning' | 'error' | 'info';
    color: string;
    icon?: string;
}

export interface RenderedMetric {
    id: string;
    label: string;
    value: string | number;
    unit?: string;
    format?: string;
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: number;
        period: string;
        color: string;
    };
    target?: {
        value: number;
        label: string;
        comparison: 'above' | 'below' | 'equal';
        status: 'success' | 'warning' | 'error';
    };
    status?: {
        type: 'success' | 'warning' | 'error' | 'info';
        message?: string;
        icon?: string;
    };
}

export interface RenderedChart {
    id: string;
    title: string;
    subtitle?: string;
    type: string;
    data: any[];
    config: ChartConfig;
    loading: boolean;
    error?: string;
    isEmpty: boolean;
    dataSource: string;
}

export interface RenderedTable {
    id: string;
    title: string;
    columns: TableColumn[];
    data: any[];
    pagination?: PaginationConfig;
    sorting?: SortingConfig;
    filtering?: boolean;
    loading: boolean;
    error?: string;
    isEmpty: boolean;
}

export interface TableColumn {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'status' | 'action';
    width?: number;
    sortable: boolean;
    filterable: boolean;
    format?: string;
    align: 'left' | 'center' | 'right';
}

export interface PaginationConfig {
    enabled: boolean;
    pageSize: number;
    currentPage: number;
    totalItems: number;
    showSizeOptions: boolean;
    sizeOptions: number[];
}

export interface SortingConfig {
    enabled: boolean;
    column?: string;
    direction?: 'asc' | 'desc';
    multiSort: boolean;
}

export interface ComputedLayout {
    gridArea?: string;
    span: {
        columns: number;
        rows: number;
    };
    alignment: {
        horizontal: 'left' | 'center' | 'right' | 'stretch';
        vertical: 'top' | 'center' | 'bottom' | 'stretch';
    };
    padding: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    margin: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    background?: string;
    border?: {
        width: number;
        style: string;
        color: string;
        radius: number;
    };
    responsive: ResponsiveLayout;
}

export interface ResponsiveLayout {
    xs?: Partial<ComputedLayout>;
    sm?: Partial<ComputedLayout>;
    md?: Partial<ComputedLayout>;
    lg?: Partial<ComputedLayout>;
    xl?: Partial<ComputedLayout>;
}

export interface RenderMetadata {
    templateId: string;
    templateVersion: string;
    renderedAt: Date;
    renderDuration: number;
    dataTimestamp: Date;
    filtersApplied: ReportFilters;
    sectionsRendered: number;
    chartsRendered: number;
    tablesRendered: number;
    cacheHits: number;
    cacheMisses: number;
}

export interface PerformanceMetrics {
    totalRenderTime: number;
    sectionRenderTimes: Record<string, number>;
    dataProcessingTime: number;
    validationTime: number;
    cacheOperationTime: number;
    memoryUsage: number;
}

export interface TemplateCache {
    get(key: string): any;
    set(key: string, value: any, ttl?: number): void;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    size(): number;
}

export interface ParameterBinding {
    key: string;
    value: any;
    type: 'data' | 'filter' | 'variable' | 'computed';
    source: string;
    dependencies: string[];
}

export class TemplateRenderingEngine {
    private cache: TemplateCache;
    private validators: Map<string, (value: any) => ValidationError[]>;
    private processors: Map<string, (content: any, context: RenderContext) => any>;
    private computedProperties: Map<string, (context: RenderContext) => any>;

    constructor(cache?: TemplateCache) {
        this.cache = cache || new Map();
        this.validators = new Map();
        this.processors = new Map();
        this.computedProperties = new Map();
        this.initializeDefaultProcessors();
        this.initializeDefaultValidators();
        this.initializeComputedProperties();
    }

    /**
     * Render a template with the given context
     */
    async render(context: RenderContext): Promise<RenderResult> {
        const startTime = performance.now();
        const performanceMetrics: PerformanceMetrics = {
            totalRenderTime: 0,
            sectionRenderTimes: {},
            dataProcessingTime: 0,
            validationTime: 0,
            cacheOperationTime: 0,
            memoryUsage: 0,
        };

        try {
            // Validate template
            const validationStart = performance.now();
            const validationErrors = await this.validateTemplate(context.template);
            performanceMetrics.validationTime = performance.now() - validationStart;

            if (validationErrors.length > 0) {
                return {
                    sections: [],
                    metadata: this.createMetadata(context, performanceMetrics),
                    errors: validationErrors,
                    warnings: [],
                    performance: performanceMetrics,
                };
            }

            // Process data
            const dataProcessingStart = performance.now();
            const processedData = await this.processData(context.data, context);
            performanceMetrics.dataProcessingTime = performance.now() - dataProcessingStart;

            // Render sections
            const sections: RenderedSection[] = [];
            const warnings: string[] = [];

            for (const section of context.template.sections.sort((a, b) => a.order - b.order)) {
                const sectionStart = performance.now();

                try {
                    const renderedSection = await this.renderSection(section, {
                        ...context,
                        data: processedData,
                    });

                    if (renderedSection) {
                        sections.push(renderedSection);
                    }
                } catch (error) {
                    warnings.push(`Failed to render section ${section.id}: ${error.message}`);
                }

                performanceMetrics.sectionRenderTimes[section.id] = performance.now() - sectionStart;
            }

            performanceMetrics.totalRenderTime = performance.now() - startTime;

            return {
                sections,
                metadata: this.createMetadata(context, performanceMetrics),
                errors: [],
                warnings,
                performance: performanceMetrics,
            };
        } catch (error) {
            performanceMetrics.totalRenderTime = performance.now() - startTime;

            return {
                sections: [],
                metadata: this.createMetadata(context, performanceMetrics),
                errors: [{
                    type: 'error',
                    field: 'template',
                    message: `Template rendering failed: ${error.message}`,
                }],
                warnings: [],
                performance: performanceMetrics,
            };
        }
    }

    /**
     * Validate template structure and configuration
     */
    private async validateTemplate(template: ReportTemplate): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        // Basic template validation
        if (!template.id) {
            errors.push({
                type: 'error',
                field: 'id',
                message: 'Template ID is required',
            });
        }

        if (!template.name) {
            errors.push({
                type: 'error',
                field: 'name',
                message: 'Template name is required',
            });
        }

        if (!template.sections || template.sections.length === 0) {
            errors.push({
                type: 'warning',
                field: 'sections',
                message: 'Template has no sections defined',
            });
        }

        // Validate sections
        for (const section of template.sections || []) {
            const sectionErrors = await this.validateSection(section);
            errors.push(...sectionErrors);
        }

        // Validate layout
        if (template.layout) {
            const layoutErrors = this.validateLayout(template.layout);
            errors.push(...layoutErrors);
        }

        return errors;
    }

    /**
     * Validate individual section
     */
    private async validateSection(section: TemplateSection): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (!section.id) {
            errors.push({
                type: 'error',
                field: `section.${section.id}.id`,
                message: 'Section ID is required',
            });
        }

        if (!section.type) {
            errors.push({
                type: 'error',
                field: `section.${section.id}.type`,
                message: 'Section type is required',
            });
        }

        // Validate section content based on type
        if (section.content) {
            const contentErrors = await this.validateSectionContent(section.type, section.content);
            errors.push(...contentErrors.map(error => ({
                ...error,
                field: `section.${section.id}.${error.field}`,
            })));
        }

        return errors;
    }

    /**
     * Validate section content based on type
     */
    private async validateSectionContent(
        sectionType: string,
        content: SectionContent
    ): Promise<ValidationError[]> {
        const validator = this.validators.get(sectionType);
        if (validator) {
            return validator(content);
        }
        return [];
    }

    /**
     * Validate layout configuration
     */
    private validateLayout(layout: any): ValidationError[] {
        const errors: ValidationError[] = [];

        if (layout.grid) {
            if (layout.grid.columns <= 0) {
                errors.push({
                    type: 'error',
                    field: 'layout.grid.columns',
                    message: 'Grid columns must be greater than 0',
                });
            }

            if (layout.grid.rows <= 0) {
                errors.push({
                    type: 'error',
                    field: 'layout.grid.rows',
                    message: 'Grid rows must be greater than 0',
                });
            }
        }

        return errors;
    }

    /**
     * Process and transform data for rendering
     */
    private async processData(data: ReportData, context: RenderContext): Promise<ReportData> {
        // Apply filters to data
        const filteredData = this.applyFilters(data, context.filters);

        // Apply variable substitutions
        const processedData = this.applyVariableSubstitutions(filteredData, context.variables);

        // Apply computed properties
        const enrichedData = await this.applyComputedProperties(processedData, context);

        return enrichedData;
    }

    /**
     * Apply filters to data
     */
    private applyFilters(data: ReportData, filters: ReportFilters): ReportData {
        // Implementation would filter data based on applied filters
        // This is a simplified version
        return {
            ...data,
            // Apply date range filter
            charts: data.charts?.map(chart => ({
                ...chart,
                data: this.filterChartDataByDateRange(chart.data, filters.dateRange),
            })),
            tables: data.tables?.map(table => ({
                ...table,
                data: this.filterTableDataByFilters(table.data, filters),
            })),
        };
    }

    /**
     * Filter chart data by date range
     */
    private filterChartDataByDateRange(data: any[], dateRange: any): any[] {
        if (!dateRange || !data) return data;

        // Implementation would filter data points based on date range
        return data.filter(point => {
            if (point.date) {
                const pointDate = new Date(point.date);
                return pointDate >= dateRange.startDate && pointDate <= dateRange.endDate;
            }
            return true;
        });
    }

    /**
     * Filter table data by filters
     */
    private filterTableDataByFilters(data: any[], filters: ReportFilters): any[] {
        if (!data) return data;

        return data.filter(row => {
            // Apply various filters
            if (filters.therapyType && filters.therapyType.length > 0) {
                if (!filters.therapyType.includes(row.therapyType)) {
                    return false;
                }
            }

            if (filters.pharmacistId && filters.pharmacistId.length > 0) {
                if (!filters.pharmacistId.includes(row.pharmacistId)) {
                    return false;
                }
            }

            // Add more filter logic as needed
            return true;
        });
    }

    /**
     * Apply variable substitutions
     */
    private applyVariableSubstitutions(data: ReportData, variables: Record<string, any>): ReportData {
        // Replace variables in text content, titles, etc.
        const processedData = JSON.parse(JSON.stringify(data));

        const replaceVariables = (obj: any): any => {
            if (typeof obj === 'string') {
                return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                    return variables[key] !== undefined ? variables[key] : match;
                });
            } else if (Array.isArray(obj)) {
                return obj.map(replaceVariables);
            } else if (obj && typeof obj === 'object') {
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    result[key] = replaceVariables(value);
                }
                return result;
            }
            return obj;
        };

        return replaceVariables(processedData);
    }

    /**
     * Apply computed properties
     */
    private async applyComputedProperties(data: ReportData, context: RenderContext): Promise<ReportData> {
        const enrichedData = { ...data };

        // Apply computed properties to charts
        if (enrichedData.charts) {
            enrichedData.charts = await Promise.all(
                enrichedData.charts.map(async chart => {
                    const processor = this.computedProperties.get(`chart.${chart.type}`);
                    if (processor) {
                        return {
                            ...chart,
                            data: await processor({ ...context, data: enrichedData }),
                        };
                    }
                    return chart;
                })
            );
        }

        return enrichedData;
    }

    /**
     * Render individual section
     */
    private async renderSection(
        section: TemplateSection,
        context: RenderContext
    ): Promise<RenderedSection | null> {
        // Check visibility conditions
        const isVisible = await this.evaluateVisibility(section.visibility, context);
        if (!isVisible) {
            return null;
        }

        // Process section content
        const processor = this.processors.get(section.type);
        const renderedContent = processor
            ? await processor(section.content, context)
            : await this.processDefaultContent(section.content, context);

        // Compute responsive layout
        const computedLayout = this.computeLayout(section.layout, context);

        return {
            id: section.id,
            type: section.type,
            title: section.title || '',
            content: renderedContent,
            layout: computedLayout,
            visible: true,
            order: section.order,
            dependencies: this.extractDependencies(section.content),
        };
    }

    /**
     * Evaluate visibility conditions
     */
    private async evaluateVisibility(
        visibility: any,
        context: RenderContext
    ): Promise<boolean> {
        if (!visibility) return true;

        // Check role-based visibility
        if (visibility.roles && visibility.roles.length > 0) {
            const hasRole = visibility.roles.some((role: string) =>
                context.userRoles.includes(role)
            );
            if (!hasRole) return false;
        }

        // Check permission-based visibility
        if (visibility.permissions && visibility.permissions.length > 0) {
            const hasPermission = visibility.permissions.some((permission: string) =>
                context.userPermissions.includes(permission)
            );
            if (!hasPermission) return false;
        }

        // Check responsive visibility
        if (visibility.responsive) {
            const breakpointVisible = visibility.responsive[context.breakpoint];
            if (breakpointVisible === false) return false;
        }

        // Check conditional visibility
        if (visibility.conditions && visibility.conditions.length > 0) {
            for (const condition of visibility.conditions) {
                const conditionMet = await this.evaluateCondition(condition, context);
                if (!conditionMet) return false;
            }
        }

        return true;
    }

    /**
     * Evaluate individual visibility condition
     */
    private async evaluateCondition(
        condition: VisibilityCondition,
        context: RenderContext
    ): Promise<boolean> {
        switch (condition.type) {
            case 'data':
                return this.evaluateDataCondition(condition, context);
            case 'filter':
                return this.evaluateFilterCondition(condition, context);
            case 'permission':
                return this.evaluatePermissionCondition(condition, context);
            case 'custom':
                return this.evaluateCustomCondition(condition, context);
            default:
                return true;
        }
    }

    /**
     * Evaluate data-based condition
     */
    private evaluateDataCondition(condition: VisibilityCondition, context: RenderContext): boolean {
        if (!condition.field) return true;

        const value = this.getNestedValue(context.data, condition.field);

        switch (condition.operator) {
            case 'exists':
                return value !== undefined && value !== null;
            case 'equals':
                return value === condition.value;
            case 'not-equals':
                return value !== condition.value;
            case 'greater':
                return typeof value === 'number' && value > condition.value;
            case 'less':
                return typeof value === 'number' && value < condition.value;
            case 'contains':
                return typeof value === 'string' && value.includes(condition.value);
            default:
                return true;
        }
    }

    /**
     * Evaluate filter-based condition
     */
    private evaluateFilterCondition(condition: VisibilityCondition, context: RenderContext): boolean {
        if (!condition.field) return true;

        const filterValue = this.getNestedValue(context.filters, condition.field);

        switch (condition.operator) {
            case 'exists':
                return filterValue !== undefined && filterValue !== null;
            case 'equals':
                return filterValue === condition.value;
            case 'not-equals':
                return filterValue !== condition.value;
            default:
                return true;
        }
    }

    /**
     * Evaluate permission-based condition
     */
    private evaluatePermissionCondition(condition: VisibilityCondition, context: RenderContext): boolean {
        if (!condition.value) return true;
        return context.userPermissions.includes(condition.value);
    }

    /**
     * Evaluate custom condition
     */
    private evaluateCustomCondition(condition: VisibilityCondition, context: RenderContext): boolean {
        if (!condition.function) return true;

        try {
            // This would evaluate a custom function
            // For security, this should be sandboxed
            const func = new Function('context', 'condition', condition.function);
            return func(context, condition);
        } catch (error) {
            console.warn('Custom condition evaluation failed:', error);
            return false;
        }
    }

    /**
     * Get nested value from object
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Process default content
     */
    private async processDefaultContent(content: SectionContent, context: RenderContext): Promise<RenderedContent> {
        return {
            ...content,
            // Apply variable substitutions to text content
            text: content.text ? this.applyVariableSubstitutions({ text: content.text }, context.variables).text : undefined,
        };
    }

    /**
     * Compute responsive layout
     */
    private computeLayout(layout: any, context: RenderContext): ComputedLayout {
        const baseLayout = {
            span: layout.span || { columns: 12, rows: 4 },
            alignment: layout.alignment || { horizontal: 'stretch', vertical: 'stretch' },
            padding: layout.padding || { top: 16, right: 16, bottom: 16, left: 16 },
            margin: layout.margin || { top: 0, right: 0, bottom: 16, left: 0 },
            background: layout.background,
            border: layout.border,
            responsive: {},
        };

        // Apply responsive overrides
        if (context.responsive && context.template.layout.breakpoints) {
            const breakpointConfig = context.template.layout.breakpoints[context.breakpoint];
            if (breakpointConfig) {
                Object.assign(baseLayout, breakpointConfig);
            }
        }

        return baseLayout;
    }

    /**
     * Extract dependencies from content
     */
    private extractDependencies(content: SectionContent): string[] {
        const dependencies: string[] = [];

        // Extract chart dependencies
        if (content.charts) {
            dependencies.push(...content.charts);
        }

        // Extract table dependencies
        if (content.tables) {
            dependencies.push(...content.tables);
        }

        // Extract KPI dependencies
        if (content.kpis) {
            dependencies.push(...content.kpis);
        }

        return dependencies;
    }

    /**
     * Create render metadata
     */
    private createMetadata(context: RenderContext, performance: PerformanceMetrics): RenderMetadata {
        return {
            templateId: context.template.id,
            templateVersion: context.template.version,
            renderedAt: new Date(),
            renderDuration: performance.totalRenderTime,
            dataTimestamp: new Date(), // This should come from actual data
            filtersApplied: context.filters,
            sectionsRendered: context.template.sections.length,
            chartsRendered: context.data.charts?.length || 0,
            tablesRendered: context.data.tables?.length || 0,
            cacheHits: 0, // Would be tracked by cache implementation
            cacheMisses: 0, // Would be tracked by cache implementation
        };
    }

    /**
     * Initialize default content processors
     */
    private initializeDefaultProcessors(): void {
        // Header processor
        this.processors.set('header', async (content: SectionContent, context: RenderContext) => {
            return {
                logo: content.logo,
                title: content.title || context.template.name,
                subtitle: content.subtitle || context.template.description,
                metadata: content.metadata ? {
                    generatedAt: new Date().toLocaleString(),
                    filters: Object.keys(context.filters).length,
                    ...content.metadata,
                } : undefined,
            };
        });

        // Summary processor
        this.processors.set('summary', async (content: SectionContent, context: RenderContext) => {
            const renderedKPIs: RenderedKPI[] = [];
            const renderedMetrics: RenderedMetric[] = [];

            // Process KPIs
            if (content.kpis && context.data.summary?.kpis) {
                for (const kpiId of content.kpis) {
                    const kpiData = context.data.summary.kpis.find((k: any) => k.id === kpiId);
                    if (kpiData) {
                        renderedKPIs.push(this.processKPI(kpiData));
                    }
                }
            }

            // Process metrics
            if (content.metrics) {
                for (const metric of content.metrics) {
                    renderedMetrics.push(this.processMetric(metric, context));
                }
            }

            return {
                kpis: renderedKPIs,
                metrics: renderedMetrics,
            };
        });

        // Charts processor
        this.processors.set('charts', async (content: SectionContent, context: RenderContext) => {
            const renderedCharts: RenderedChart[] = [];

            if (content.charts && context.data.charts) {
                for (const chartId of content.charts) {
                    const chartData = context.data.charts.find(c => c.id === chartId);
                    if (chartData) {
                        renderedCharts.push({
                            id: chartData.id,
                            title: chartData.title,
                            subtitle: chartData.subtitle,
                            type: chartData.type,
                            data: chartData.data,
                            config: chartData.config,
                            loading: chartData.loading || false,
                            error: chartData.error,
                            isEmpty: !chartData.data || chartData.data.length === 0,
                            dataSource: 'api', // This would be determined dynamically
                        });
                    }
                }
            }

            return {
                charts: renderedCharts,
                arrangement: content.arrangement || 'grid',
            };
        });

        // Tables processor
        this.processors.set('tables', async (content: SectionContent, context: RenderContext) => {
            const renderedTables: RenderedTable[] = [];

            if (content.tables && context.data.tables) {
                for (const tableId of content.tables) {
                    const tableData = context.data.tables.find(t => t.id === tableId);
                    if (tableData) {
                        renderedTables.push({
                            id: tableData.id,
                            title: tableData.title,
                            columns: this.processTableColumns(tableData.columns),
                            data: tableData.data,
                            pagination: content.pagination ? {
                                enabled: true,
                                pageSize: 10,
                                currentPage: 1,
                                totalItems: tableData.data.length,
                                showSizeOptions: true,
                                sizeOptions: [5, 10, 25, 50],
                            } : undefined,
                            sorting: content.sorting ? {
                                enabled: true,
                                multiSort: false,
                            } : undefined,
                            filtering: content.filtering,
                            loading: false,
                            isEmpty: !tableData.data || tableData.data.length === 0,
                        });
                    }
                }
            }

            return {
                tables: renderedTables,
                pagination: content.pagination,
            };
        });

        // Text processor
        this.processors.set('text', async (content: SectionContent, context: RenderContext) => {
            let processedText = content.text || '';

            // Apply variable substitutions
            if (content.variables) {
                for (const [key, value] of Object.entries(content.variables)) {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                    processedText = processedText.replace(regex, String(value));
                }
            }

            // Apply context variables
            for (const [key, value] of Object.entries(context.variables)) {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                processedText = processedText.replace(regex, String(value));
            }

            return {
                text: processedText,
                html: content.markdown ? this.markdownToHtml(processedText) : undefined,
                variables: { ...content.variables, ...context.variables },
            };
        });
    }

    /**
     * Process KPI data
     */
    private processKPI(kpiData: any): RenderedKPI {
        return {
            id: kpiData.id,
            title: kpiData.title,
            value: kpiData.value,
            unit: kpiData.unit,
            trend: kpiData.trend ? {
                ...kpiData.trend,
                color: this.getTrendColor(kpiData.trend.direction),
            } : undefined,
            target: kpiData.target ? {
                ...kpiData.target,
                status: this.getTargetStatus(kpiData.value, kpiData.target),
            } : undefined,
            sparkline: kpiData.sparkline,
            status: kpiData.status || 'info',
            color: this.getStatusColor(kpiData.status || 'info'),
            icon: kpiData.icon,
        };
    }

    /**
     * Process metric data
     */
    private processMetric(metric: MetricConfig, context: RenderContext): RenderedMetric {
        return {
            id: metric.id,
            label: metric.label,
            value: metric.value,
            unit: metric.unit,
            format: metric.format,
            trend: metric.trend ? {
                ...metric.trend,
                color: this.getTrendColor(metric.trend.direction),
            } : undefined,
            target: metric.target ? {
                ...metric.target,
                status: this.getTargetStatus(Number(metric.value), metric.target),
            } : undefined,
            status: metric.status,
        };
    }

    /**
     * Process table columns
     */
    private processTableColumns(columns: any[]): TableColumn[] {
        return columns.map(col => ({
            key: col.key,
            label: col.label,
            type: col.type || 'text',
            width: col.width,
            sortable: col.sortable !== false,
            filterable: col.filterable !== false,
            format: col.format,
            align: col.align || 'left',
        }));
    }

    /**
     * Get trend color based on direction
     */
    private getTrendColor(direction: string): string {
        switch (direction) {
            case 'up': return '#4caf50';
            case 'down': return '#f44336';
            case 'stable': return '#ff9800';
            default: return '#757575';
        }
    }

    /**
     * Get target status
     */
    private getTargetStatus(value: number, target: any): 'success' | 'warning' | 'error' {
        if (target.comparison === 'above') {
            return value >= target.value ? 'success' : 'error';
        } else if (target.comparison === 'below') {
            return value <= target.value ? 'success' : 'error';
        } else {
            return value === target.value ? 'success' : 'warning';
        }
    }

    /**
     * Get status color
     */
    private getStatusColor(status: string): string {
        switch (status) {
            case 'success': return '#4caf50';
            case 'warning': return '#ff9800';
            case 'error': return '#f44336';
            case 'info': return '#2196f3';
            default: return '#757575';
        }
    }

    /**
     * Convert markdown to HTML (simplified)
     */
    private markdownToHtml(markdown: string): string {
        // This is a very basic markdown parser
        // In a real implementation, you'd use a proper markdown library
        return markdown
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    /**
     * Initialize default validators
     */
    private initializeDefaultValidators(): void {
        this.validators.set('header', (content: SectionContent) => {
            const errors: ValidationError[] = [];
            // Add header-specific validation
            return errors;
        });

        this.validators.set('summary', (content: SectionContent) => {
            const errors: ValidationError[] = [];
            // Add summary-specific validation
            return errors;
        });

        this.validators.set('charts', (content: SectionContent) => {
            const errors: ValidationError[] = [];
            if (content.charts && content.charts.length === 0) {
                errors.push({
                    type: 'warning',
                    field: 'charts',
                    message: 'No charts specified for charts section',
                });
            }
            return errors;
        });

        this.validators.set('tables', (content: SectionContent) => {
            const errors: ValidationError[] = [];
            if (content.tables && content.tables.length === 0) {
                errors.push({
                    type: 'warning',
                    field: 'tables',
                    message: 'No tables specified for tables section',
                });
            }
            return errors;
        });

        this.validators.set('text', (content: SectionContent) => {
            const errors: ValidationError[] = [];
            if (!content.text || content.text.trim().length === 0) {
                errors.push({
                    type: 'warning',
                    field: 'text',
                    message: 'Text section has no content',
                });
            }
            return errors;
        });
    }

    /**
     * Initialize computed properties
     */
    private initializeComputedProperties(): void {
        // Add computed property processors for different chart types
        this.computedProperties.set('chart.line', async (context: RenderContext) => {
            // Process line chart data with computed properties
            return context.data;
        });

        this.computedProperties.set('chart.bar', async (context: RenderContext) => {
            // Process bar chart data with computed properties
            return context.data;
        });

        // Add more chart type processors as needed
    }
}

// Simple in-memory cache implementation
export class MemoryTemplateCache implements TemplateCache {
    private cache = new Map<string, { value: any; expires?: number }>();

    get(key: string): any {
        const item = this.cache.get(key);
        if (!item) return undefined;

        if (item.expires && Date.now() > item.expires) {
            this.cache.delete(key);
            return undefined;
        }

        return item.value;
    }

    set(key: string, value: any, ttl?: number): void {
        const expires = ttl ? Date.now() + ttl * 1000 : undefined;
        this.cache.set(key, { value, expires });
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

// Export singleton instance
export const templateRenderingEngine = new TemplateRenderingEngine(new MemoryTemplateCache());