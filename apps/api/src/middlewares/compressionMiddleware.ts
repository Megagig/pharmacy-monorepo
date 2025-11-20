import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import logger from '../utils/logger';

export interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (1-9)
  filter?: (req: Request, res: Response) => boolean;
  chunkSize?: number;
}

/**
 * Enhanced compression middleware with intelligent compression strategies
 */
export const intelligentCompressionMiddleware = (options: CompressionOptions = {}) => {
  const {
    threshold = 1024, // 1KB minimum
    level = 6, // Balanced compression level
    chunkSize = 16 * 1024, // 16KB chunks
  } = options;

  // Create base compression middleware
  const compressionMiddleware = compression({
    threshold,
    level,
    chunkSize,
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (!req.headers['accept-encoding']) {
        return false;
      }

      // Don't compress already compressed content
      const contentType = res.getHeader('content-type') as string;
      if (contentType && (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')
      )) {
        return false;
      }

      // Don't compress small responses
      const contentLength = res.getHeader('content-length');
      if (contentLength && parseInt(contentLength as string) < threshold) {
        return false;
      }

      // Apply custom filter if provided
      if (options.filter && !options.filter(req, res)) {
        return false;
      }

      return true;
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Add compression metrics
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (data: any) {
      const originalSize = Buffer.byteLength(data);

      // Set compression headers for monitoring
      res.setHeader('X-Original-Size', originalSize);

      return originalSend.call(this, data);
    };

    res.json = function (data: any) {
      const originalSize = Buffer.byteLength(JSON.stringify(data));

      // Set compression headers for monitoring
      res.setHeader('X-Original-Size', originalSize);

      return originalJson.call(this, data);
    };

    // Apply compression middleware
    compressionMiddleware(req, res, next);
  };
};

/**
 * Brotli compression middleware for modern browsers
 */
export const brotliCompressionMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Check if client supports Brotli
    if (acceptEncoding.includes('br')) {
      // Set Brotli as preferred encoding
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Vary', 'Accept-Encoding');
    }

    next();
  };
};

/**
 * Response size monitoring middleware
 */
export const responseSizeMonitoringMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (data: any) {
      const responseTime = Date.now() - startTime;
      // Convert data to string for Buffer.byteLength
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const responseSize = Buffer.byteLength(dataString);
      const originalSize = res.getHeader('X-Original-Size') as string;

      // Log large responses
      if (responseSize > 100 * 1024) { // 100KB
        logger.warn('Large API response detected', {
          method: req.method,
          url: req.originalUrl,
          responseSize,
          originalSize: originalSize ? parseInt(originalSize) : responseSize,
          compressionRatio: originalSize ? (1 - responseSize / parseInt(originalSize)) * 100 : 0,
          responseTime,
        });
      }

      // Add performance headers
      res.setHeader('X-Response-Time', responseTime);
      res.setHeader('X-Response-Size', responseSize);

      return originalSend.call(this, data);
    };

    res.json = function (data: any) {
      const responseTime = Date.now() - startTime;
      const jsonString = JSON.stringify(data);
      const responseSize = Buffer.byteLength(jsonString);
      const originalSize = res.getHeader('X-Original-Size') as string;

      // Log large JSON responses
      if (responseSize > 100 * 1024) { // 100KB
        logger.warn('Large JSON API response detected', {
          method: req.method,
          url: req.originalUrl,
          responseSize,
          originalSize: originalSize ? parseInt(originalSize) : responseSize,
          compressionRatio: originalSize ? (1 - responseSize / parseInt(originalSize)) * 100 : 0,
          responseTime,
          recordCount: Array.isArray(data) ? data.length : (data?.data?.length || 'unknown'),
        });
      }

      // Add performance headers
      res.setHeader('X-Response-Time', responseTime);
      res.setHeader('X-Response-Size', responseSize);

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Conditional compression based on client capabilities
 */
export const adaptiveCompressionMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const userAgent = req.headers['user-agent'] || '';

    // Determine best compression method
    let compressionLevel = 6; // Default

    // Use higher compression for slow connections (mobile indicators)
    if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
      compressionLevel = 8; // Higher compression for mobile
    }

    // Use lower compression for fast connections (desktop browsers)
    if (userAgent.includes('Chrome') || userAgent.includes('Firefox')) {
      compressionLevel = 4; // Lower compression for desktop
    }

    // Store compression preference for this request
    (req as any).compressionLevel = compressionLevel;

    next();
  };
};

export default intelligentCompressionMiddleware;