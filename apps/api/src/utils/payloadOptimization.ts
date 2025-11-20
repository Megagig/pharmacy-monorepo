import logger from './logger';

export interface FieldProjectionOptions {
  include?: string[];
  exclude?: string[];
  maxDepth?: number;
  maxArrayLength?: number;
}

export interface PayloadOptimizationOptions {
  removeNullValues?: boolean;
  removeEmptyArrays?: boolean;
  removeEmptyObjects?: boolean;
  compactArrays?: boolean;
  maxStringLength?: number;
  dateFormat?: 'iso' | 'timestamp' | 'short';
}

/**
 * Field projection utility for optimizing API payloads
 * Reduces payload size by including only necessary fields
 */
export class FieldProjection {
  /**
   * Project fields from an object or array of objects
   */
  static project<T>(
    data: T | T[],
    options: FieldProjectionOptions = {}
  ): Partial<T> | Partial<T>[] {
    if (Array.isArray(data)) {
      return data.map(item => this.projectSingle(item, options));
    }
    
    return this.projectSingle(data, options);
  }

  /**
   * Project fields from a single object
   */
  private static projectSingle<T>(
    obj: T,
    options: FieldProjectionOptions,
    currentDepth: number = 0
  ): Partial<T> {
    if (!obj || typeof obj !== 'object') {
      return obj as Partial<T>;
    }

    const { include, exclude, maxDepth = 10, maxArrayLength = 100 } = options;

    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return {} as Partial<T>;
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip excluded fields
      if (exclude && exclude.includes(key)) {
        continue;
      }

      // Include only specified fields if include list is provided
      if (include && include.length > 0 && !include.includes(key)) {
        continue;
      }

      // Handle nested objects
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          // Limit array length and recursively project array items
          const limitedArray = value.slice(0, maxArrayLength);
          result[key] = limitedArray.map(item => 
            this.projectSingle(item, options, currentDepth + 1)
          );
        } else {
          // Recursively project nested objects
          result[key] = this.projectSingle(value, options, currentDepth + 1);
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create projection for MongoDB queries
   */
  static createMongoProjection(options: FieldProjectionOptions): Record<string, 1 | 0> {
    const projection: Record<string, 1 | 0> = {};

    if (options.include && options.include.length > 0) {
      // Include only specified fields
      options.include.forEach(field => {
        projection[field] = 1;
      });
    } else if (options.exclude && options.exclude.length > 0) {
      // Exclude specified fields
      options.exclude.forEach(field => {
        projection[field] = 0;
      });
    }

    return projection;
  }
}

/**
 * Payload optimization utility for reducing response sizes
 */
export class PayloadOptimizer {
  /**
   * Optimize payload by removing unnecessary data
   */
  static optimize<T>(
    data: T,
    options: PayloadOptimizationOptions = {}
  ): T {
    const {
      removeNullValues = true,
      removeEmptyArrays = true,
      removeEmptyObjects = true,
      compactArrays = false,
      maxStringLength,
      dateFormat = 'iso',
    } = options;

    return this.optimizeValue(data, options) as T;
  }

  /**
   * Optimize a single value recursively
   */
  private static optimizeValue(
    value: any,
    options: PayloadOptimizationOptions
  ): any {
    if (value === null || value === undefined) {
      return options.removeNullValues ? undefined : value;
    }

    if (Array.isArray(value)) {
      const optimizedArray = value
        .map(item => this.optimizeValue(item, options))
        .filter(item => item !== undefined);

      if (options.removeEmptyArrays && optimizedArray.length === 0) {
        return undefined;
      }

      return optimizedArray;
    }

    if (value instanceof Date) {
      return this.formatDate(value, options.dateFormat!);
    }

    if (typeof value === 'string') {
      if (options.maxStringLength && value.length > options.maxStringLength) {
        return value.substring(0, options.maxStringLength) + '...';
      }
      return value;
    }

    if (typeof value === 'object') {
      const optimizedObject: any = {};
      let hasProperties = false;

      for (const [key, val] of Object.entries(value)) {
        const optimizedVal = this.optimizeValue(val, options);
        
        if (optimizedVal !== undefined) {
          optimizedObject[key] = optimizedVal;
          hasProperties = true;
        }
      }

      if (options.removeEmptyObjects && !hasProperties) {
        return undefined;
      }

      return optimizedObject;
    }

    return value;
  }

  /**
   * Format date based on specified format
   */
  private static formatDate(date: Date, format: 'iso' | 'timestamp' | 'short'): any {
    switch (format) {
      case 'timestamp':
        return date.getTime();
      case 'short':
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Calculate payload size reduction
   */
  static calculateReduction(original: any, optimized: any): {
    originalSize: number;
    optimizedSize: number;
    reductionBytes: number;
    reductionPercent: number;
  } {
    const originalSize = Buffer.byteLength(JSON.stringify(original));
    const optimizedSize = Buffer.byteLength(JSON.stringify(optimized));
    const reductionBytes = originalSize - optimizedSize;
    const reductionPercent = (reductionBytes / originalSize) * 100;

    return {
      originalSize,
      optimizedSize,
      reductionBytes,
      reductionPercent,
    };
  }
}

/**
 * Response optimization middleware
 */
export const responseOptimizationMiddleware = (
  projectionOptions?: FieldProjectionOptions,
  optimizationOptions?: PayloadOptimizationOptions
) => {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      let optimizedData = data;

      try {
        // Apply field projection if specified
        if (projectionOptions) {
          optimizedData = FieldProjection.project(optimizedData, projectionOptions);
        }

        // Apply payload optimization
        if (optimizationOptions) {
          optimizedData = PayloadOptimizer.optimize(optimizedData, optimizationOptions);
        }

        // Log optimization results for large payloads
        const originalSize = Buffer.byteLength(JSON.stringify(data));
        if (originalSize > 10 * 1024) { // 10KB threshold
          const optimizedSize = Buffer.byteLength(JSON.stringify(optimizedData));
          const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

          if (reduction > 10) { // Log if >10% reduction
            logger.info('Payload optimization applied', {
              endpoint: req.originalUrl,
              originalSize,
              optimizedSize,
              reductionPercent: reduction.toFixed(2),
            });
          }
        }

      } catch (error) {
        logger.error('Error optimizing payload:', error);
        // Fall back to original data if optimization fails
        optimizedData = data;
      }

      return originalJson(optimizedData);
    };

    next();
  };
};

/**
 * Predefined optimization presets for common use cases
 */
export const OptimizationPresets = {
  // Minimal payload for mobile clients
  mobile: {
    projection: {
      exclude: ['__v', 'createdBy', 'updatedBy', 'internalNotes'],
      maxArrayLength: 20,
      maxDepth: 3,
    },
    optimization: {
      removeNullValues: true,
      removeEmptyArrays: true,
      removeEmptyObjects: true,
      maxStringLength: 200,
      dateFormat: 'timestamp' as const,
    },
  },

  // Compact payload for list views
  list: {
    projection: {
      include: ['_id', 'name', 'status', 'createdAt', 'updatedAt'],
      maxArrayLength: 50,
    },
    optimization: {
      removeNullValues: true,
      removeEmptyArrays: true,
      dateFormat: 'short' as const,
    },
  },

  // Full payload for detailed views
  detail: {
    projection: {
      exclude: ['__v'],
      maxDepth: 5,
    },
    optimization: {
      removeNullValues: false,
      removeEmptyArrays: false,
      removeEmptyObjects: false,
    },
  },

  // Export-optimized payload
  export: {
    projection: {
      exclude: ['__v', 'password', 'tokens'],
      maxDepth: 10,
    },
    optimization: {
      removeNullValues: true,
      removeEmptyArrays: true,
      removeEmptyObjects: true,
      dateFormat: 'iso' as const,
    },
  },
};

export default {
  FieldProjection,
  PayloadOptimizer,
  responseOptimizationMiddleware,
  OptimizationPresets,
};