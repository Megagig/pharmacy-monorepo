// Template Inheritance Service - Handle template inheritance and composition
import {
    ReportTemplate,
    TemplateSection,
    SectionContent,
    LayoutConfig,
    ValidationError
} from '../types/templates';
import { ChartConfig } from '../types/charts';
import { FilterDefinition } from '../types/filters';

export interface TemplateInheritance {
    parentId: string;
    overrides: TemplateOverrides;
    composition: CompositionConfig;
}

export interface TemplateOverrides {
    name?: string;
    description?: string;
    layout?: Partial<LayoutConfig>;
    sections?: SectionOverride[];
    filters?: FilterDefinition[];
    charts?: ChartConfig[];
    metadata?: Record<string, any>;
}

export interface SectionOverride {
    id: string;
    action: 'replace' | 'modify' | 'remove' | 'insert-before' | 'insert-after';
    section?: TemplateSection;
    modifications?: Partial<TemplateSection>;
    position?: number;
    targetId?: string; // For insert-before/insert-after
}

export interface CompositionConfig {
    mode: 'inherit' | 'compose' | 'merge';
    sources: CompositionSource[];
    rules: CompositionRule[];
}

export interface CompositionSource {
    templateId: string;
    sections?: string[]; // Specific sections to include
    priority: number;
    prefix?: string; // Prefix for section IDs to avoid conflicts
}

export interface CompositionRule {
    type: 'section-order' | 'section-merge' | 'layout-merge' | 'filter-merge';
    config: any;
}

export interface InheritanceResult {
    template: ReportTemplate;
    inheritanceChain: string[];
    conflicts: InheritanceConflict[];
    warnings: string[];
}

export interface InheritanceConflict {
    type: 'section-id' | 'chart-id' | 'filter-id' | 'layout-property';
    id: string;
    sources: string[];
    resolution: 'use-first' | 'use-last' | 'merge' | 'manual';
    resolvedValue?: any;
}

export interface TemplateComposition {
    id: string;
    name: string;
    description: string;
    sources: CompositionSource[];
    result: ReportTemplate;
    conflicts: InheritanceConflict[];
    createdAt: Date;
    updatedAt: Date;
}

export class TemplateInheritanceService {
    private templateCache: Map<string, ReportTemplate> = new Map();
    private inheritanceCache: Map<string, InheritanceResult> = new Map();

    /**
     * Resolve template inheritance
     */
    async resolveInheritance(
        template: ReportTemplate,
        templateRepository: Map<string, ReportTemplate>
    ): Promise<InheritanceResult> {
        const cacheKey = this.generateCacheKey(template);

        // Check cache first
        if (this.inheritanceCache.has(cacheKey)) {
            return this.inheritanceCache.get(cacheKey)!;
        }

        try {
            const result = await this.performInheritanceResolution(template, templateRepository);

            // Cache the result
            this.inheritanceCache.set(cacheKey, result);

            return result;
        } catch (error) {
            throw new Error(`Failed to resolve template inheritance: ${error.message}`);
        }
    }

    /**
     * Perform the actual inheritance resolution
     */
    private async performInheritanceResolution(
        template: ReportTemplate,
        templateRepository: Map<string, ReportTemplate>
    ): Promise<InheritanceResult> {
        const inheritanceChain: string[] = [];
        const conflicts: InheritanceConflict[] = [];
        const warnings: string[] = [];

        // Check if template has inheritance configuration
        const inheritance = (template as any).inheritance as TemplateInheritance;
        if (!inheritance) {
            return {
                template,
                inheritanceChain: [template.id],
                conflicts: [],
                warnings: [],
            };
        }

        // Build inheritance chain
        const chain = await this.buildInheritanceChain(template.id, templateRepository, inheritanceChain);

        // Resolve inheritance based on mode
        let resolvedTemplate: ReportTemplate;

        switch (inheritance.composition.mode) {
            case 'inherit':
                resolvedTemplate = await this.resolveSimpleInheritance(template, inheritance, templateRepository, conflicts, warnings);
                break;
            case 'compose':
                resolvedTemplate = await this.resolveComposition(template, inheritance, templateRepository, conflicts, warnings);
                break;
            case 'merge':
                resolvedTemplate = await this.resolveMerge(template, inheritance, templateRepository, conflicts, warnings);
                break;
            default:
                throw new Error(`Unknown inheritance mode: ${inheritance.composition.mode}`);
        }

        return {
            template: resolvedTemplate,
            inheritanceChain: chain,
            conflicts,
            warnings,
        };
    }

    /**
     * Build inheritance chain to detect circular dependencies
     */
    private async buildInheritanceChain(
        templateId: string,
        templateRepository: Map<string, ReportTemplate>,
        visited: string[] = []
    ): Promise<string[]> {
        if (visited.includes(templateId)) {
            throw new Error(`Circular inheritance detected: ${visited.join(' -> ')} -> ${templateId}`);
        }

        const template = templateRepository.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const newVisited = [...visited, templateId];
        const inheritance = (template as any).inheritance as TemplateInheritance;

        if (inheritance?.parentId) {
            return this.buildInheritanceChain(inheritance.parentId, templateRepository, newVisited);
        }

        return newVisited;
    }

    /**
     * Resolve simple inheritance (single parent)
     */
    private async resolveSimpleInheritance(
        template: ReportTemplate,
        inheritance: TemplateInheritance,
        templateRepository: Map<string, ReportTemplate>,
        conflicts: InheritanceConflict[],
        warnings: string[]
    ): Promise<ReportTemplate> {
        const parent = templateRepository.get(inheritance.parentId);
        if (!parent) {
            throw new Error(`Parent template not found: ${inheritance.parentId}`);
        }

        // Start with parent template
        let resolvedTemplate: ReportTemplate = JSON.parse(JSON.stringify(parent));

        // Apply overrides
        if (inheritance.overrides.name) {
            resolvedTemplate.name = inheritance.overrides.name;
        }

        if (inheritance.overrides.description) {
            resolvedTemplate.description = inheritance.overrides.description;
        }

        // Merge layout
        if (inheritance.overrides.layout) {
            resolvedTemplate.layout = this.mergeLayout(resolvedTemplate.layout, inheritance.overrides.layout);
        }

        // Apply section overrides
        if (inheritance.overrides.sections) {
            resolvedTemplate.sections = this.applySectionOverrides(
                resolvedTemplate.sections,
                inheritance.overrides.sections,
                conflicts,
                warnings
            );
        }

        // Merge filters
        if (inheritance.overrides.filters) {
            resolvedTemplate.filters = this.mergeFilters(
                resolvedTemplate.filters,
                inheritance.overrides.filters,
                conflicts
            );
        }

        // Merge charts
        if (inheritance.overrides.charts) {
            resolvedTemplate.charts = this.mergeCharts(
                resolvedTemplate.charts,
                inheritance.overrides.charts,
                conflicts
            );
        }

        // Update metadata
        resolvedTemplate.id = template.id;
        resolvedTemplate.createdBy = template.createdBy;
        resolvedTemplate.workspaceId = template.workspaceId;
        resolvedTemplate.createdAt = template.createdAt;
        resolvedTemplate.updatedAt = new Date();

        return resolvedTemplate;
    }

    /**
     * Resolve composition (multiple sources)
     */
    private async resolveComposition(
        template: ReportTemplate,
        inheritance: TemplateInheritance,
        templateRepository: Map<string, ReportTemplate>,
        conflicts: InheritanceConflict[],
        warnings: string[]
    ): Promise<ReportTemplate> {
        // Start with base template
        let composedTemplate: ReportTemplate = {
            ...template,
            sections: [],
            filters: [],
            charts: [],
        };

        // Sort sources by priority
        const sortedSources = inheritance.composition.sources.sort((a, b) => a.priority - b.priority);

        // Compose from each source
        for (const source of sortedSources) {
            const sourceTemplate = templateRepository.get(source.templateId);
            if (!sourceTemplate) {
                warnings.push(`Source template not found: ${source.templateId}`);
                continue;
            }

            // Add sections from source
            const sectionsToAdd = source.sections
                ? sourceTemplate.sections.filter(s => source.sections!.includes(s.id))
                : sourceTemplate.sections;

            for (const section of sectionsToAdd) {
                const sectionCopy = JSON.parse(JSON.stringify(section));

                // Apply prefix if specified
                if (source.prefix) {
                    sectionCopy.id = `${source.prefix}_${sectionCopy.id}`;
                }

                // Check for conflicts
                const existingSection = composedTemplate.sections.find(s => s.id === sectionCopy.id);
                if (existingSection) {
                    conflicts.push({
                        type: 'section-id',
                        id: sectionCopy.id,
                        sources: [existingSection.id, source.templateId],
                        resolution: 'use-last',
                        resolvedValue: sectionCopy,
                    });
                }

                composedTemplate.sections.push(sectionCopy);
            }

            // Merge filters
            composedTemplate.filters = this.mergeFilters(
                composedTemplate.filters,
                sourceTemplate.filters,
                conflicts
            );

            // Merge charts
            composedTemplate.charts = this.mergeCharts(
                composedTemplate.charts,
                sourceTemplate.charts,
                conflicts
            );
        }

        // Apply composition rules
        composedTemplate = this.applyCompositionRules(composedTemplate, inheritance.composition.rules);

        return composedTemplate;
    }

    /**
     * Resolve merge (deep merge of all sources)
     */
    private async resolveMerge(
        template: ReportTemplate,
        inheritance: TemplateInheritance,
        templateRepository: Map<string, ReportTemplate>,
        conflicts: InheritanceConflict[],
        warnings: string[]
    ): Promise<ReportTemplate> {
        // Similar to composition but with deep merging
        return this.resolveComposition(template, inheritance, templateRepository, conflicts, warnings);
    }

    /**
     * Apply section overrides
     */
    private applySectionOverrides(
        sections: TemplateSection[],
        overrides: SectionOverride[],
        conflicts: InheritanceConflict[],
        warnings: string[]
    ): TemplateSection[] {
        let result = [...sections];

        for (const override of overrides) {
            switch (override.action) {
                case 'replace':
                    if (override.section) {
                        const index = result.findIndex(s => s.id === override.id);
                        if (index !== -1) {
                            result[index] = override.section;
                        } else {
                            warnings.push(`Section to replace not found: ${override.id}`);
                        }
                    }
                    break;

                case 'modify':
                    if (override.modifications) {
                        const index = result.findIndex(s => s.id === override.id);
                        if (index !== -1) {
                            result[index] = { ...result[index], ...override.modifications };
                        } else {
                            warnings.push(`Section to modify not found: ${override.id}`);
                        }
                    }
                    break;

                case 'remove':
                    result = result.filter(s => s.id !== override.id);
                    break;

                case 'insert-before':
                    if (override.section && override.targetId) {
                        const index = result.findIndex(s => s.id === override.targetId);
                        if (index !== -1) {
                            result.splice(index, 0, override.section);
                        } else {
                            warnings.push(`Target section for insert-before not found: ${override.targetId}`);
                        }
                    }
                    break;

                case 'insert-after':
                    if (override.section && override.targetId) {
                        const index = result.findIndex(s => s.id === override.targetId);
                        if (index !== -1) {
                            result.splice(index + 1, 0, override.section);
                        } else {
                            warnings.push(`Target section for insert-after not found: ${override.targetId}`);
                        }
                    }
                    break;
            }
        }

        // Update section orders
        result.forEach((section, index) => {
            section.order = index;
        });

        return result;
    }

    /**
     * Merge layout configurations
     */
    private mergeLayout(base: LayoutConfig, override: Partial<LayoutConfig>): LayoutConfig {
        return {
            ...base,
            ...override,
            grid: override.grid ? { ...base.grid, ...override.grid } : base.grid,
            spacing: override.spacing ? { ...base.spacing, ...override.spacing } : base.spacing,
            breakpoints: override.breakpoints ? { ...base.breakpoints, ...override.breakpoints } : base.breakpoints,
        };
    }

    /**
     * Merge filter definitions
     */
    private mergeFilters(
        base: FilterDefinition[],
        additional: FilterDefinition[],
        conflicts: InheritanceConflict[]
    ): FilterDefinition[] {
        const result = [...base];

        for (const filter of additional) {
            const existingIndex = result.findIndex(f => f.key === filter.key);
            if (existingIndex !== -1) {
                conflicts.push({
                    type: 'filter-id',
                    id: filter.key,
                    sources: ['base', 'additional'],
                    resolution: 'use-last',
                    resolvedValue: filter,
                });
                result[existingIndex] = filter;
            } else {
                result.push(filter);
            }
        }

        return result;
    }

    /**
     * Merge chart configurations
     */
    private mergeCharts(
        base: ChartConfig[],
        additional: ChartConfig[],
        conflicts: InheritanceConflict[]
    ): ChartConfig[] {
        const result = [...base];

        for (const chart of additional) {
            const existingIndex = result.findIndex(c => (c as any).id === (chart as any).id);
            if (existingIndex !== -1) {
                conflicts.push({
                    type: 'chart-id',
                    id: (chart as any).id,
                    sources: ['base', 'additional'],
                    resolution: 'use-last',
                    resolvedValue: chart,
                });
                result[existingIndex] = chart;
            } else {
                result.push(chart);
            }
        }

        return result;
    }

    /**
     * Apply composition rules
     */
    private applyCompositionRules(template: ReportTemplate, rules: CompositionRule[]): ReportTemplate {
        let result = { ...template };

        for (const rule of rules) {
            switch (rule.type) {
                case 'section-order':
                    result.sections = this.applySectionOrderRule(result.sections, rule.config);
                    break;
                case 'section-merge':
                    result.sections = this.applySectionMergeRule(result.sections, rule.config);
                    break;
                case 'layout-merge':
                    result.layout = this.applyLayoutMergeRule(result.layout, rule.config);
                    break;
                case 'filter-merge':
                    result.filters = this.applyFilterMergeRule(result.filters, rule.config);
                    break;
            }
        }

        return result;
    }

    /**
     * Apply section order rule
     */
    private applySectionOrderRule(sections: TemplateSection[], config: any): TemplateSection[] {
        if (config.order && Array.isArray(config.order)) {
            const ordered: TemplateSection[] = [];
            const remaining = [...sections];

            // Add sections in specified order
            for (const sectionId of config.order) {
                const sectionIndex = remaining.findIndex(s => s.id === sectionId);
                if (sectionIndex !== -1) {
                    const section = remaining.splice(sectionIndex, 1)[0];
                    ordered.push(section);
                }
            }

            // Add remaining sections
            ordered.push(...remaining);

            // Update order property
            ordered.forEach((section, index) => {
                section.order = index;
            });

            return ordered;
        }

        return sections;
    }

    /**
     * Apply section merge rule
     */
    private applySectionMergeRule(sections: TemplateSection[], config: any): TemplateSection[] {
        // Implementation for merging sections based on rules
        return sections;
    }

    /**
     * Apply layout merge rule
     */
    private applyLayoutMergeRule(layout: LayoutConfig, config: any): LayoutConfig {
        // Implementation for merging layout based on rules
        return layout;
    }

    /**
     * Apply filter merge rule
     */
    private applyFilterMergeRule(filters: FilterDefinition[], config: any): FilterDefinition[] {
        // Implementation for merging filters based on rules
        return filters;
    }

    /**
     * Create template composition
     */
    async createComposition(
        name: string,
        description: string,
        sources: CompositionSource[],
        templateRepository: Map<string, ReportTemplate>
    ): Promise<TemplateComposition> {
        const compositionId = this.generateId();
        const conflicts: InheritanceConflict[] = [];

        // Create base template for composition
        const baseTemplate: ReportTemplate = {
            id: compositionId,
            name,
            description,
            reportType: 'composed',
            layout: {
                type: 'custom',
                grid: { columns: 12, rows: 10, gap: 16, autoFlow: 'row' },
                responsive: true,
                theme: 'default',
                spacing: { top: 16, right: 16, bottom: 16, left: 16 },
                breakpoints: {
                    xs: { columns: 1 },
                    sm: { columns: 2 },
                    md: { columns: 4 },
                    lg: { columns: 6 },
                    xl: { columns: 12 },
                },
            },
            filters: [],
            charts: [],
            tables: [],
            sections: [],
            metadata: {
                category: 'composed',
                tags: ['composed'],
                difficulty: 'intermediate',
                estimatedTime: 45,
                dataRequirements: [],
                dependencies: sources.map(s => s.templateId),
                changelog: [],
            },
            permissions: {
                view: ['*'],
                edit: ['owner'],
                delete: ['owner'],
                share: ['owner'],
                export: ['*'],
            },
            createdBy: 'system',
            workspaceId: 'current',
            isPublic: false,
            isDefault: false,
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Apply composition
        const inheritance: TemplateInheritance = {
            parentId: '',
            overrides: {},
            composition: {
                mode: 'compose',
                sources,
                rules: [],
            },
        };

        const result = await this.resolveComposition(
            baseTemplate,
            inheritance,
            templateRepository,
            conflicts,
            []
        );

        return {
            id: compositionId,
            name,
            description,
            sources,
            result,
            conflicts,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    /**
     * Generate cache key for template
     */
    private generateCacheKey(template: ReportTemplate): string {
        const inheritance = (template as any).inheritance as TemplateInheritance;
        if (!inheritance) {
            return template.id;
        }

        const key = {
            id: template.id,
            parentId: inheritance.parentId,
            overrides: inheritance.overrides,
            composition: inheritance.composition,
        };

        return btoa(JSON.stringify(key));
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clear inheritance cache
     */
    clearCache(): void {
        this.inheritanceCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.inheritanceCache.size,
            hitRate: 0, // Would need to track hits/misses
        };
    }
}

// Export singleton instance
export const templateInheritanceService = new TemplateInheritanceService();