// Template Services
export {
    templateRenderingEngine,
    TemplateRenderingEngine,
    MemoryTemplateCache
} from './templateRenderingService';

export {
    templateValidationService,
    TemplateValidationService
} from './templateValidationService';

export {
    templateInheritanceService,
    TemplateInheritanceService
} from './templateInheritanceService';

export {
    templatePerformanceService,
    TemplatePerformanceService
} from './templatePerformanceService';

// Export Services
export { exportServices } from './exportServices';
export { scheduleService } from './scheduleService';
export { emailService } from './emailService';

// Export Types
export type {
    RenderContext,
    RenderResult,
    RenderedSection,
    RenderedContent,
    RenderedKPI,
    RenderedMetric,
    RenderedChart,
    RenderedTable,
    ComputedLayout,
    RenderMetadata,
    PerformanceMetrics,
    TemplateCache,
    ParameterBinding
} from './templateRenderingService';

export type {
    ValidationContext,
    ValidationResult,
    ValidationSuggestion,
    ValidationPerformance,
    ValidationRule
} from './templateValidationService';

export type {
    TemplateInheritance,
    TemplateOverrides,
    SectionOverride,
    CompositionConfig,
    CompositionSource,
    CompositionRule,
    InheritanceResult,
    InheritanceConflict,
    TemplateComposition
} from './templateInheritanceService';

export type {
    PerformanceOptimization,
    CacheConfig,
    LazyLoadConfig,
    VirtualizationConfig,
    CompressionConfig,
    PrecomputeConfig,
    OptimizationResult,
    OptimizationRecommendation,
    CacheEntry
} from './templatePerformanceService';