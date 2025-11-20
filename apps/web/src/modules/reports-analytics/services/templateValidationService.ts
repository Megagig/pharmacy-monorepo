// Template Validation Service - Comprehensive validation for templates
import {
    ReportTemplate,
    TemplateSection,
    SectionContent,
    LayoutConfig,
    ValidationError,
    VisibilityCondition
} from '../types/templates';
import { ChartConfig } from '../types/charts';
import { FilterDefinition } from '../types/filters';

export interface ValidationContext {
    template: ReportTemplate;
    availableCharts: string[];
    availableTables: string[];
    availableFilters: string[];
    userPermissions: string[];
    userRoles: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    suggestions: ValidationSuggestion[];
    performance: ValidationPerformance;
}

export interface ValidationSuggestion {
    type: 'optimization' | 'best-practice' | 'accessibility' | 'performance';
    field: string;
    message: string;
    action?: string;
    priority: 'low' | 'medium' | 'high';
}

export interface ValidationPerformance {
    validationTime: number;
    rulesApplied: number;
    sectionsValidated: number;
    chartsValidated: number;
    tablesValidated: number;
}

export interface ValidationRule {
    id: string;
    name: string;
    description: string;
    category: 'structure' | 'content' | 'layout' | 'accessibility' | 'performance' | 'security';
    severity: 'error' | 'warning' | 'info';
    validator: (context: ValidationContext) => ValidationError[];
}

export class TemplateValidationService {
    private rules: Map<string, ValidationRule> = new Map();
    private customValidators: Map<string, (value: any, context: ValidationContext) => ValidationError[]> = new Map();

    constructor() {
        this.initializeDefaultRules();
    }

    /**
     * Validate a complete template
     */
    async validate(context: ValidationContext): Promise<ValidationResult> {
        const startTime = performance.now();
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const suggestions: ValidationSuggestion[] = [];

        let rulesApplied = 0;
        let sectionsValidated = 0;
        let chartsValidated = 0;
        let tablesValidated = 0;

        try {
            // Apply all validation rules
            for (const [ruleId, rule] of this.rules) {
                try {
                    const ruleResults = rule.validator(context);
                    rulesApplied++;

                    for (const result of ruleResults) {
                        if (rule.severity === 'error') {
                            errors.push(result);
                        } else if (rule.severity === 'warning') {
                            warnings.push(result);
                        }
                    }
                } catch (error) {
                    console.warn(`Validation rule ${ruleId} failed:`, error);
                }
            }

            // Validate sections
            for (const section of context.template.sections || []) {
                const sectionResults = await this.validateSection(section, context);
                errors.push(...sectionResults.errors);
                warnings.push(...sectionResults.warnings);
                suggestions.push(...sectionResults.suggestions);
                sectionsValidated++;
            }

            // Generate suggestions
            const additionalSuggestions = this.generateSuggestions(context, errors, warnings);
            suggestions.push(...additionalSuggestions);

            const validationTime = performance.now() - startTime;

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                suggestions,
                performance: {
                    validationTime,
                    rulesApplied,
                    sectionsValidated,
                    chartsValidated,
                    tablesValidated,
                },
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    type: 'error',
                    field: 'template',
                    message: `Validation failed: ${error.message}`,
                }],
                warnings: [],
                suggestions: [],
                performance: {
                    validationTime: performance.now() - startTime,
                    rulesApplied,
                    sectionsValidated,
                    chartsValidated,
                    tablesValidated,
                },
            };
        }
    }

    /**
     * Validate individual section
     */
    private async validateSection(
        section: TemplateSection,
        context: ValidationContext
    ): Promise<{
        errors: ValidationError[];
        warnings: ValidationError[];
        suggestions: ValidationSuggestion[];
    }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const suggestions: ValidationSuggestion[] = [];

        // Basic section validation
        if (!section.id) {
            errors.push({
                type: 'error',
                field: `section.${section.id || 'unknown'}.id`,
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

        // Validate section content
        if (section.content) {
            const contentResults = await this.validateSectionContent(section, context);
            errors.push(...contentResults.errors);
            warnings.push(...contentResults.warnings);
            suggestions.push(...contentResults.suggestions);
        }

        // Validate section layout
        if (section.layout) {
            const layoutResults = this.validateSectionLayout(section.layout, section.id);
            errors.push(...layoutResults.errors);
            warnings.push(...layoutResults.warnings);
            suggestions.push(...layoutResults.suggestions);
        }

        // Validate visibility conditions
        if (section.visibility) {
            const visibilityResults = this.validateVisibilityConditions(section.visibility, section.id);
            errors.push(...visibilityResults.errors);
            warnings.push(...visibilityResults.warnings);
        }

        return { errors, warnings, suggestions };
    }

    /**
     * Validate section content based on type
     */
    private async validateSectionContent(
        section: TemplateSection,
        context: ValidationContext
    ): Promise<{
        errors: ValidationError[];
        warnings: ValidationError[];
        suggestions: ValidationSuggestion[];
    }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const suggestions: ValidationSuggestion[] = [];

        const sectionId = section.id;
        const content = section.content;

        switch (section.type) {
            case 'header':
                if (!content.title && !content.logo) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.content`,
                        message: 'Header section should have either a title or logo',
                    });
                }
                break;

            case 'summary':
                if (!content.kpis && !content.metrics) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.content`,
                        message: 'Summary section should have KPIs or metrics',
                    });
                }

                // Validate KPI references
                if (content.kpis) {
                    for (const kpiId of content.kpis) {
                        if (!context.availableCharts.includes(kpiId)) {
                            errors.push({
                                type: 'error',
                                field: `section.${sectionId}.content.kpis`,
                                message: `KPI '${kpiId}' is not available`,
                            });
                        }
                    }
                }
                break;

            case 'charts':
                if (!content.charts || content.charts.length === 0) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.content.charts`,
                        message: 'Charts section has no charts defined',
                    });
                } else {
                    // Validate chart references
                    for (const chartId of content.charts) {
                        if (!context.availableCharts.includes(chartId)) {
                            errors.push({
                                type: 'error',
                                field: `section.${sectionId}.content.charts`,
                                message: `Chart '${chartId}' is not available`,
                            });
                        }
                    }

                    // Performance suggestion for too many charts
                    if (content.charts.length > 6) {
                        suggestions.push({
                            type: 'performance',
                            field: `section.${sectionId}.content.charts`,
                            message: 'Consider using tabs or carousel for better performance with many charts',
                            action: 'Set arrangement to "tabs" or "carousel"',
                            priority: 'medium',
                        });
                    }
                }
                break;

            case 'tables':
                if (!content.tables || content.tables.length === 0) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.content.tables`,
                        message: 'Tables section has no tables defined',
                    });
                } else {
                    // Validate table references
                    for (const tableId of content.tables) {
                        if (!context.availableTables.includes(tableId)) {
                            errors.push({
                                type: 'error',
                                field: `section.${sectionId}.content.tables`,
                                message: `Table '${tableId}' is not available`,
                            });
                        }
                    }

                    // Accessibility suggestion
                    if (!content.pagination && content.tables.length > 1) {
                        suggestions.push({
                            type: 'accessibility',
                            field: `section.${sectionId}.content.pagination`,
                            message: 'Consider enabling pagination for better accessibility with multiple tables',
                            action: 'Enable pagination',
                            priority: 'low',
                        });
                    }
                }
                break;

            case 'text':
                if (!content.text || content.text.trim().length === 0) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.content.text`,
                        message: 'Text section has no content',
                    });
                }

                // Check for unresolved variables
                if (content.text) {
                    const unresolvedVars = content.text.match(/\{\{(\w+)\}\}/g);
                    if (unresolvedVars) {
                        warnings.push({
                            type: 'warning',
                            field: `section.${sectionId}.content.text`,
                            message: `Text contains unresolved variables: ${unresolvedVars.join(', ')}`,
                        });
                    }
                }
                break;

            case 'spacer':
                // Spacer sections don't need content validation
                break;

            case 'footer':
                // Footer validation similar to header
                break;

            default:
                warnings.push({
                    type: 'warning',
                    field: `section.${sectionId}.type`,
                    message: `Unknown section type: ${section.type}`,
                });
        }

        return { errors, warnings, suggestions };
    }

    /**
     * Validate section layout
     */
    private validateSectionLayout(
        layout: any,
        sectionId: string
    ): {
        errors: ValidationError[];
        warnings: ValidationError[];
        suggestions: ValidationSuggestion[];
    } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const suggestions: ValidationSuggestion[] = [];

        // Validate span
        if (layout.span) {
            if (layout.span.columns <= 0 || layout.span.columns > 24) {
                errors.push({
                    type: 'error',
                    field: `section.${sectionId}.layout.span.columns`,
                    message: 'Column span must be between 1 and 24',
                });
            }

            if (layout.span.rows <= 0) {
                errors.push({
                    type: 'error',
                    field: `section.${sectionId}.layout.span.rows`,
                    message: 'Row span must be greater than 0',
                });
            }

            // Performance suggestion
            if (layout.span.rows > 20) {
                suggestions.push({
                    type: 'performance',
                    field: `section.${sectionId}.layout.span.rows`,
                    message: 'Very tall sections may impact scrolling performance',
                    priority: 'low',
                });
            }
        }

        // Validate padding and margin
        const validateSpacing = (spacing: any, type: 'padding' | 'margin') => {
            if (spacing) {
                const values = [spacing.top, spacing.right, spacing.bottom, spacing.left];
                for (const value of values) {
                    if (typeof value === 'number' && value < 0) {
                        errors.push({
                            type: 'error',
                            field: `section.${sectionId}.layout.${type}`,
                            message: `${type} values cannot be negative`,
                        });
                    }
                }

                // Accessibility suggestion
                if (type === 'padding' && Math.max(...values) < 8) {
                    suggestions.push({
                        type: 'accessibility',
                        field: `section.${sectionId}.layout.${type}`,
                        message: 'Consider increasing padding for better touch targets',
                        priority: 'low',
                    });
                }
            }
        };

        validateSpacing(layout.padding, 'padding');
        validateSpacing(layout.margin, 'margin');

        // Validate border
        if (layout.border) {
            if (layout.border.width < 0) {
                errors.push({
                    type: 'error',
                    field: `section.${sectionId}.layout.border.width`,
                    message: 'Border width cannot be negative',
                });
            }

            if (layout.border.radius < 0) {
                errors.push({
                    type: 'error',
                    field: `section.${sectionId}.layout.border.radius`,
                    message: 'Border radius cannot be negative',
                });
            }
        }

        return { errors, warnings, suggestions };
    }

    /**
     * Validate visibility conditions
     */
    private validateVisibilityConditions(
        visibility: any,
        sectionId: string
    ): {
        errors: ValidationError[];
        warnings: ValidationError[];
    } {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Validate conditions
        if (visibility.conditions) {
            for (let i = 0; i < visibility.conditions.length; i++) {
                const condition = visibility.conditions[i];

                if (!condition.type) {
                    errors.push({
                        type: 'error',
                        field: `section.${sectionId}.visibility.conditions[${i}].type`,
                        message: 'Condition type is required',
                    });
                }

                if (!condition.operator) {
                    errors.push({
                        type: 'error',
                        field: `section.${sectionId}.visibility.conditions[${i}].operator`,
                        message: 'Condition operator is required',
                    });
                }

                // Validate operator
                const validOperators = ['equals', 'not-equals', 'greater', 'less', 'contains', 'exists'];
                if (condition.operator && !validOperators.includes(condition.operator)) {
                    errors.push({
                        type: 'error',
                        field: `section.${sectionId}.visibility.conditions[${i}].operator`,
                        message: `Invalid operator: ${condition.operator}`,
                    });
                }

                // Validate custom functions
                if (condition.type === 'custom' && condition.function) {
                    try {
                        new Function('context', 'condition', condition.function);
                    } catch (error) {
                        errors.push({
                            type: 'error',
                            field: `section.${sectionId}.visibility.conditions[${i}].function`,
                            message: `Invalid custom function: ${error.message}`,
                        });
                    }
                }
            }
        }

        // Validate responsive visibility
        if (visibility.responsive) {
            const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl'];
            for (const [breakpoint, visible] of Object.entries(visibility.responsive)) {
                if (!breakpoints.includes(breakpoint)) {
                    warnings.push({
                        type: 'warning',
                        field: `section.${sectionId}.visibility.responsive.${breakpoint}`,
                        message: `Unknown breakpoint: ${breakpoint}`,
                    });
                }
            }
        }

        return { errors, warnings };
    }

    /**
     * Generate optimization and best practice suggestions
     */
    private generateSuggestions(
        context: ValidationContext,
        errors: ValidationError[],
        warnings: ValidationError[]
    ): ValidationSuggestion[] {
        const suggestions: ValidationSuggestion[] = [];

        // Template-level suggestions
        const template = context.template;

        // Performance suggestions
        if (template.sections.length > 10) {
            suggestions.push({
                type: 'performance',
                field: 'template.sections',
                message: 'Consider breaking large templates into multiple smaller templates',
                priority: 'medium',
            });
        }

        // Accessibility suggestions
        const hasHeaderSection = template.sections.some(s => s.type === 'header');
        if (!hasHeaderSection) {
            suggestions.push({
                type: 'accessibility',
                field: 'template.sections',
                message: 'Consider adding a header section for better document structure',
                priority: 'low',
            });
        }

        // Best practice suggestions
        if (!template.description || template.description.trim().length === 0) {
            suggestions.push({
                type: 'best-practice',
                field: 'template.description',
                message: 'Add a description to help users understand the template purpose',
                priority: 'low',
            });
        }

        // Layout suggestions
        if (template.layout.grid.columns > 12) {
            suggestions.push({
                type: 'best-practice',
                field: 'template.layout.grid.columns',
                message: 'Consider using 12 columns or fewer for better responsive behavior',
                priority: 'low',
            });
        }

        // Security suggestions
        const hasCustomFunctions = template.sections.some(section =>
            section.visibility?.conditions?.some((condition: VisibilityCondition) =>
                condition.type === 'custom' && condition.function
            )
        );

        if (hasCustomFunctions) {
            suggestions.push({
                type: 'optimization',
                field: 'template.sections',
                message: 'Custom functions in visibility conditions may impact performance',
                priority: 'medium',
            });
        }

        return suggestions;
    }

    /**
     * Initialize default validation rules
     */
    private initializeDefaultRules(): void {
        // Template structure rules
        this.rules.set('template-id-required', {
            id: 'template-id-required',
            name: 'Template ID Required',
            description: 'Template must have a unique ID',
            category: 'structure',
            severity: 'error',
            validator: (context) => {
                const errors: ValidationError[] = [];
                if (!context.template.id || context.template.id.trim().length === 0) {
                    errors.push({
                        type: 'error',
                        field: 'template.id',
                        message: 'Template ID is required',
                    });
                }
                return errors;
            },
        });

        this.rules.set('template-name-required', {
            id: 'template-name-required',
            name: 'Template Name Required',
            description: 'Template must have a name',
            category: 'structure',
            severity: 'error',
            validator: (context) => {
                const errors: ValidationError[] = [];
                if (!context.template.name || context.template.name.trim().length === 0) {
                    errors.push({
                        type: 'error',
                        field: 'template.name',
                        message: 'Template name is required',
                    });
                }
                return errors;
            },
        });

        this.rules.set('template-version-format', {
            id: 'template-version-format',
            name: 'Template Version Format',
            description: 'Template version should follow semantic versioning',
            category: 'structure',
            severity: 'warning',
            validator: (context) => {
                const errors: ValidationError[] = [];
                if (context.template.version) {
                    const semverRegex = /^\d+\.\d+\.\d+$/;
                    if (!semverRegex.test(context.template.version)) {
                        errors.push({
                            type: 'warning',
                            field: 'template.version',
                            message: 'Template version should follow semantic versioning (e.g., 1.0.0)',
                        });
                    }
                }
                return errors;
            },
        });

        // Layout rules
        this.rules.set('layout-grid-valid', {
            id: 'layout-grid-valid',
            name: 'Valid Grid Configuration',
            description: 'Grid configuration must be valid',
            category: 'layout',
            severity: 'error',
            validator: (context) => {
                const errors: ValidationError[] = [];
                const grid = context.template.layout.grid;

                if (grid.columns <= 0 || grid.columns > 24) {
                    errors.push({
                        type: 'error',
                        field: 'template.layout.grid.columns',
                        message: 'Grid columns must be between 1 and 24',
                    });
                }

                if (grid.rows <= 0) {
                    errors.push({
                        type: 'error',
                        field: 'template.layout.grid.rows',
                        message: 'Grid rows must be greater than 0',
                    });
                }

                return errors;
            },
        });

        // Performance rules
        this.rules.set('section-count-performance', {
            id: 'section-count-performance',
            name: 'Section Count Performance',
            description: 'Too many sections may impact performance',
            category: 'performance',
            severity: 'warning',
            validator: (context) => {
                const errors: ValidationError[] = [];
                if (context.template.sections.length > 15) {
                    errors.push({
                        type: 'warning',
                        field: 'template.sections',
                        message: 'Large number of sections may impact rendering performance',
                        suggestion: 'Consider breaking into multiple templates or using lazy loading',
                    });
                }
                return errors;
            },
        });

        // Accessibility rules
        this.rules.set('accessibility-structure', {
            id: 'accessibility-structure',
            name: 'Accessibility Structure',
            description: 'Template should have proper structure for accessibility',
            category: 'accessibility',
            severity: 'warning',
            validator: (context) => {
                const errors: ValidationError[] = [];
                const hasHeader = context.template.sections.some(s => s.type === 'header');

                if (!hasHeader) {
                    errors.push({
                        type: 'warning',
                        field: 'template.sections',
                        message: 'Consider adding a header section for better accessibility',
                        suggestion: 'Add a header section with template title',
                    });
                }

                return errors;
            },
        });

        // Security rules
        this.rules.set('security-custom-functions', {
            id: 'security-custom-functions',
            name: 'Custom Function Security',
            description: 'Custom functions should be validated for security',
            category: 'security',
            severity: 'warning',
            validator: (context) => {
                const errors: ValidationError[] = [];

                for (const section of context.template.sections) {
                    if (section.visibility?.conditions) {
                        for (const condition of section.visibility.conditions) {
                            if (condition.type === 'custom' && condition.function) {
                                // Check for potentially dangerous functions
                                const dangerousPatterns = [
                                    /eval\s*\(/,
                                    /Function\s*\(/,
                                    /setTimeout\s*\(/,
                                    /setInterval\s*\(/,
                                    /document\./,
                                    /window\./,
                                    /global\./,
                                ];

                                for (const pattern of dangerousPatterns) {
                                    if (pattern.test(condition.function)) {
                                        errors.push({
                                            type: 'warning',
                                            field: `section.${section.id}.visibility.conditions`,
                                            message: 'Custom function contains potentially unsafe code',
                                            suggestion: 'Review custom function for security issues',
                                        });
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                return errors;
            },
        });
    }

    /**
     * Add custom validation rule
     */
    addRule(rule: ValidationRule): void {
        this.rules.set(rule.id, rule);
    }

    /**
     * Remove validation rule
     */
    removeRule(ruleId: string): void {
        this.rules.delete(ruleId);
    }

    /**
     * Get all validation rules
     */
    getRules(): ValidationRule[] {
        return Array.from(this.rules.values());
    }

    /**
     * Add custom validator for specific field types
     */
    addCustomValidator(
        fieldType: string,
        validator: (value: any, context: ValidationContext) => ValidationError[]
    ): void {
        this.customValidators.set(fieldType, validator);
    }
}

// Export singleton instance
export const templateValidationService = new TemplateValidationService();