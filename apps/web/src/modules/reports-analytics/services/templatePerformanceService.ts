// Template Performance Service - Optimize template rendering and caching
import { ReportTemplate, TemplateSection } from '../types/templates';
import { ChartData } from '../types/charts';
import { ReportData } from '../types/reports';
import { RenderResult, RenderContext } from './templateRenderingService';

export interface PerformanceOptimization {
    type: 'cache' | 'lazy-load' | 'virtualization' | 'compression' | 'precompute';
    enabled: boolean;
    config: any;
}

export interface CacheConfig {
    ttl: number; // Time to live in seconds
    maxSize: number; // Maximum cache size
    strategy: 'lru' | 'lfu' | 'fifo';
    compression: boolean;
    persistent: boolean;
}

export interface LazyLoadConfig {
    threshold: number; // Distance from viewport to start loading
    placeholder: 'skeleton' | 'spinner' | 'custom';
    batchSize: number; // Number of items to load at once
    priority: 'high' | 'medium' | 'low';
}

export interface VirtualizationConfig {
    enabled: boolean;
    itemHeight: number;
    overscan: number; // Number of items to render outside viewport
    scrollDebounce: number;
}

export interface CompressionConfig {
    algorithm: 'gzip' | 'brotli' | 'lz4';
    level: number; // Compression level 1-9
    threshold: number; // Minimum size to compress
}

export interface PrecomputeConfig {
    enabled: boolean;
    triggers: ('data-change' | 'filter-change' | 'template-change')[];
    background: boolean;
    priority: number;
}

export interface PerformanceMetrics {
    renderTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    networkRequests: number;
    dataProcessingTime: number;
    chartRenderTime: number;
    layoutTime: number;
    paintTime: number;
}

export interface OptimizationResult {
    originalMetrics: PerformanceMetrics;
    optimizedMetrics: PerformanceMetrics;
    improvement: number; // Percentage improvement
    recommendations: OptimizationRecommendation[];
}

export interface OptimizationRecommendation {
    type: 'performance' | 'memory' | 'network' | 'user-experience';
    priority: 'high' | 'medium' | 'low';
    description: string;
    action: string;
    estimatedImpact: number; // Percentage improvement
    effort: 'low' | 'medium' | 'high';
}

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    compressed: boolean;
}

export class TemplatePerformanceService {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private cacheConfig: CacheConfig = {
        ttl: 300, // 5 minutes
        maxSize: 100,
        strategy: 'lru',
        compression: true,
        persistent: false,
    };
    private metrics: Map<string, PerformanceMetrics> = new Map();

    constructor() {
        this.startCacheCleanup();
    }

    /**
     * Optimize template for performance
     */
    async optimizeTemplate(
        template: ReportTemplate,
        context: RenderContext,
        optimizations: PerformanceOptimization[]
    ): Promise<{
        optimizedTemplate: ReportTemplate;
        optimizedContext: RenderContext;
        recommendations: OptimizationRecommendation[];
    }> {
        let optimizedTemplate = { ...template };
        let optimizedContext = { ...context };
        const recommendations: OptimizationRecommendation[] = [];

        // Apply each optimization
        for (const optimization of optimizations) {
            if (!optimization.enabled) continue;

            switch (optimization.type) {
                case 'cache':
                    const cacheResult = this.applyCacheOptimization(optimizedTemplate, optimization.config);
                    optimizedTemplate = cacheResult.template;
                    recommendations.push(...cacheResult.recommendations);
                    break;

                case 'lazy-load':
                    const lazyResult = this.applyLazyLoadOptimization(optimizedTemplate, optimization.config);
                    optimizedTemplate = lazyResult.template;
                    recommendations.push(...lazyResult.recommendations);
                    break;

                case 'virtualization':
                    const virtualResult = this.applyVirtualizationOptimization(optimizedTemplate, optimization.config);
                    optimizedTemplate = virtualResult.template;
                    recommendations.push(...virtualResult.recommendations);
                    break;

                case 'compression':
                    const compressResult = this.applyCompressionOptimization(optimizedContext, optimization.config);
                    optimizedContext = compressResult.context;
                    recommendations.push(...compressResult.recommendations);
                    break;

                case 'precompute':
                    const precomputeResult = this.applyPrecomputeOptimization(optimizedTemplate, optimization.config);
                    optimizedTemplate = precomputeResult.template;
                    recommendations.push(...precomputeResult.recommendations);
                    break;
            }
        }

        // Generate additional recommendations
        const additionalRecommendations = this.generateOptimizationRecommendations(optimizedTemplate, optimizedContext);
        recommendations.push(...additionalRecommendations);

        return {
            optimizedTemplate,
            optimizedContext,
            recommendations,
        };
    }

    /**
     * Apply cache optimization
     */
    private applyCacheOptimization(
        template: ReportTemplate,
        config: CacheConfig
    ): {
        template: ReportTemplate;
        recommendations: OptimizationRecommendation[];
    } {
        const recommendations: OptimizationRecommendation[] = [];

        // Update cache configuration
        this.cacheConfig = { ...this.cacheConfig, ...config };

        // Add cache hints to template sections
        const optimizedSections = template.sections.map(section => {
            const sectionCopy = { ...section };

            // Add cache metadata
            (sectionCopy as any).cacheConfig = {
                cacheable: this.isSectionCacheable(section),
                ttl: this.getSectionCacheTTL(section),
                dependencies: this.getSectionDependencies(section),
            };

            return sectionCopy;
        });

        // Generate recommendations
        const cacheableCount = optimizedSections.filter(s => (s as any).cacheConfig.cacheable).length;
        const totalCount = optimizedSections.length;

        if (cacheableCount / totalCount < 0.5) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                description: 'Low cache utilization detected',
                action: 'Consider making more sections cacheable by reducing dynamic content',
                estimatedImpact: 25,
                effort: 'medium',
            });
        }

        return {
            template: { ...template, sections: optimizedSections },
            recommendations,
        };
    }

    /**
     * Apply lazy loading optimization
     */
    private applyLazyLoadOptimization(
        template: ReportTemplate,
        config: LazyLoadConfig
    ): {
        template: ReportTemplate;
        recommendations: OptimizationRecommendation[];
    } {
        const recommendations: OptimizationRecommendation[] = [];

        // Mark sections for lazy loading
        const optimizedSections = template.sections.map((section, index) => {
            const sectionCopy = { ...section };

            // Determine if section should be lazy loaded
            const shouldLazyLoad = this.shouldLazyLoadSection(section, index, config);

            if (shouldLazyLoad) {
                (sectionCopy as any).lazyLoad = {
                    enabled: true,
                    threshold: config.threshold,
                    placeholder: config.placeholder,
                    priority: this.getSectionLoadPriority(section),
                };
            }

            return sectionCopy;
        });

        // Generate recommendations
        const lazyLoadCount = optimizedSections.filter(s => (s as any).lazyLoad?.enabled).length;

        if (lazyLoadCount > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                description: `${lazyLoadCount} sections optimized for lazy loading`,
                action: 'Sections will load as they come into view',
                estimatedImpact: lazyLoadCount * 10,
                effort: 'low',
            });
        }

        return {
            template: { ...template, sections: optimizedSections },
            recommendations,
        };
    }

    /**
     * Apply virtualization optimization
     */
    private applyVirtualizationOptimization(
        template: ReportTemplate,
        config: VirtualizationConfig
    ): {
        template: ReportTemplate;
        recommendations: OptimizationRecommendation[];
    } {
        const recommendations: OptimizationRecommendation[] = [];

        // Add virtualization config to sections with large datasets
        const optimizedSections = template.sections.map(section => {
            const sectionCopy = { ...section };

            if (this.shouldVirtualizeSection(section)) {
                (sectionCopy as any).virtualization = {
                    enabled: config.enabled,
                    itemHeight: config.itemHeight,
                    overscan: config.overscan,
                    scrollDebounce: config.scrollDebounce,
                };

                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    description: `Section "${section.title}" optimized with virtualization`,
                    action: 'Large datasets will be rendered efficiently',
                    estimatedImpact: 40,
                    effort: 'low',
                });
            }

            return sectionCopy;
        });

        return {
            template: { ...template, sections: optimizedSections },
            recommendations,
        };
    }

    /**
     * Apply compression optimization
     */
    private applyCompressionOptimization(
        context: RenderContext,
        config: CompressionConfig
    ): {
        context: RenderContext;
        recommendations: OptimizationRecommendation[];
    } {
        const recommendations: OptimizationRecommendation[] = [];

        // Compress large data payloads
        const optimizedData = { ...context.data };

        if (optimizedData.charts) {
            optimizedData.charts = optimizedData.charts.map(chart => {
                const dataSize = JSON.stringify(chart.data).length;

                if (dataSize > config.threshold) {
                    // Mark for compression
                    (chart as any).compressed = true;
                    (chart as any).compressionConfig = config;

                    recommendations.push({
                        type: 'network',
                        priority: 'medium',
                        description: `Chart "${chart.title}" data will be compressed`,
                        action: `${config.algorithm} compression applied`,
                        estimatedImpact: 30,
                        effort: 'low',
                    });
                }

                return chart;
            });
        }

        return {
            context: { ...context, data: optimizedData },
            recommendations,
        };
    }

    /**
     * Apply precompute optimization
     */
    private applyPrecomputeOptimization(
        template: ReportTemplate,
        config: PrecomputeConfig
    ): {
        template: ReportTemplate;
        recommendations: OptimizationRecommendation[];
    } {
        const recommendations: OptimizationRecommendation[] = [];

        // Mark sections for precomputation
        const optimizedSections = template.sections.map(section => {
            const sectionCopy = { ...section };

            if (this.shouldPrecomputeSection(section)) {
                (sectionCopy as any).precompute = {
                    enabled: config.enabled,
                    triggers: config.triggers,
                    background: config.background,
                    priority: config.priority,
                };

                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    description: `Section "${section.title}" will be precomputed`,
                    action: 'Expensive calculations will be cached',
                    estimatedImpact: 20,
                    effort: 'medium',
                });
            }

            return sectionCopy;
        });

        return {
            template: { ...template, sections: optimizedSections },
            recommendations,
        };
    }

    /**
     * Generate optimization recommendations
     */
    private generateOptimizationRecommendations(
        template: ReportTemplate,
        context: RenderContext
    ): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];

        // Check template complexity
        if (template.sections.length > 10) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                description: 'Template has many sections',
                action: 'Consider breaking into multiple templates or using lazy loading',
                estimatedImpact: 30,
                effort: 'medium',
            });
        }

        // Check chart count
        const chartSections = template.sections.filter(s => s.type === 'charts');
        const totalCharts = chartSections.reduce((sum, section) =>
            sum + (section.content.charts?.length || 0), 0
        );

        if (totalCharts > 8) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                description: 'Many charts may impact performance',
                action: 'Consider using tabs or carousel layout for charts',
                estimatedImpact: 25,
                effort: 'low',
            });
        }

        // Check data size
        const dataSize = JSON.stringify(context.data).length;
        if (dataSize > 1024 * 1024) { // 1MB
            recommendations.push({
                type: 'network',
                priority: 'high',
                description: 'Large data payload detected',
                action: 'Enable compression and consider data pagination',
                estimatedImpact: 40,
                effort: 'medium',
            });
        }

        // Check responsive design
        if (!template.layout.responsive) {
            recommendations.push({
                type: 'user-experience',
                priority: 'medium',
                description: 'Template is not responsive',
                action: 'Enable responsive layout for better mobile experience',
                estimatedImpact: 20,
                effort: 'low',
            });
        }

        return recommendations;
    }

    /**
     * Cache management methods
     */
    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.cacheConfig.ttl * 1000) {
            this.cache.delete(key);
            return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        // Decompress if needed
        let value = entry.value;
        if (entry.compressed) {
            value = await this.decompress(value);
        }

        return value;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // Check cache size limit
        if (this.cache.size >= this.cacheConfig.maxSize) {
            this.evictEntries();
        }

        let finalValue = value;
        let compressed = false;
        let size = JSON.stringify(value).length;

        // Compress if enabled and value is large enough
        if (this.cacheConfig.compression && size > 1024) {
            finalValue = await this.compress(value);
            compressed = true;
            size = JSON.stringify(finalValue).length;
        }

        const entry: CacheEntry<T> = {
            key,
            value: finalValue,
            timestamp: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now(),
            size,
            compressed,
        };

        this.cache.set(key, entry);
    }

    /**
     * Section analysis methods
     */
    private isSectionCacheable(section: TemplateSection): boolean {
        // Sections with dynamic content are less cacheable
        if (section.type === 'text' && section.content.variables) {
            return false;
        }

        // Chart sections are generally cacheable
        if (section.type === 'charts') {
            return true;
        }

        // Header and footer are highly cacheable
        if (section.type === 'header' || section.type === 'footer') {
            return true;
        }

        return true;
    }

    private getSectionCacheTTL(section: TemplateSection): number {
        // Different sections have different cache lifetimes
        switch (section.type) {
            case 'header':
            case 'footer':
                return 3600; // 1 hour
            case 'charts':
                return 300; // 5 minutes
            case 'tables':
                return 180; // 3 minutes
            case 'summary':
                return 120; // 2 minutes
            default:
                return 300; // 5 minutes
        }
    }

    private getSectionDependencies(section: TemplateSection): string[] {
        const dependencies: string[] = [];

        if (section.content.charts) {
            dependencies.push(...section.content.charts);
        }

        if (section.content.tables) {
            dependencies.push(...section.content.tables);
        }

        if (section.content.kpis) {
            dependencies.push(...section.content.kpis);
        }

        return dependencies;
    }

    private shouldLazyLoadSection(section: TemplateSection, index: number, config: LazyLoadConfig): boolean {
        // Don't lazy load first few sections
        if (index < 2) {
            return false;
        }

        // Always lazy load charts sections beyond the first few
        if (section.type === 'charts' && index > 3) {
            return true;
        }

        // Lazy load tables sections
        if (section.type === 'tables') {
            return true;
        }

        return false;
    }

    private getSectionLoadPriority(section: TemplateSection): 'high' | 'medium' | 'low' {
        switch (section.type) {
            case 'header':
            case 'summary':
                return 'high';
            case 'charts':
                return 'medium';
            case 'tables':
            case 'text':
                return 'low';
            default:
                return 'medium';
        }
    }

    private shouldVirtualizeSection(section: TemplateSection): boolean {
        // Virtualize sections with many items
        if (section.type === 'tables' && section.content.tables && section.content.tables.length > 5) {
            return true;
        }

        if (section.type === 'charts' && section.content.charts && section.content.charts.length > 10) {
            return true;
        }

        return false;
    }

    private shouldPrecomputeSection(section: TemplateSection): boolean {
        // Precompute sections with complex calculations
        if (section.type === 'summary' && section.content.metrics) {
            return true;
        }

        // Precompute chart sections with aggregations
        if (section.type === 'charts') {
            return true;
        }

        return false;
    }

    /**
     * Evict cache entries based on strategy
     */
    private evictEntries(): void {
        const entries = Array.from(this.cache.entries());

        switch (this.cacheConfig.strategy) {
            case 'lru':
                entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
                break;
            case 'lfu':
                entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
                break;
            case 'fifo':
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                break;
        }

        // Remove oldest 25% of entries
        const toRemove = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }

    /**
     * Compression methods
     */
    private async compress(data: any): Promise<any> {
        // Simple compression simulation
        const jsonString = JSON.stringify(data);
        return {
            compressed: true,
            data: btoa(jsonString),
            originalSize: jsonString.length,
        };
    }

    private async decompress(compressedData: any): Promise<any> {
        // Simple decompression simulation
        if (compressedData.compressed) {
            const jsonString = atob(compressedData.data);
            return JSON.parse(jsonString);
        }
        return compressedData;
    }

    /**
     * Cache cleanup
     */
    private startCacheCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            const ttlMs = this.cacheConfig.ttl * 1000;

            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > ttlMs) {
                    this.cache.delete(key);
                }
            }
        }, 60000); // Clean up every minute
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        cacheSize: number;
        cacheHitRate: number;
        averageRenderTime: number;
        memoryUsage: number;
    } {
        const metrics = Array.from(this.metrics.values());

        return {
            cacheSize: this.cache.size,
            cacheHitRate: 0, // Would be calculated from hit/miss tracking
            averageRenderTime: metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length || 0,
            memoryUsage: (performance as unknown).memory?.usedJSHeapSize || 0,
        };
    }

    /**
     * Clear all caches and metrics
     */
    clearAll(): void {
        this.cache.clear();
        this.metrics.clear();
    }
}

// Export singleton instance
export const templatePerformanceService = new TemplatePerformanceService();