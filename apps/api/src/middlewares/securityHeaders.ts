import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import logger from '../utils/logger';

/**
 * Security Headers Middleware
 * Implements comprehensive security headers for protection against various attacks
 */

interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    enabled: boolean;
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
  };
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string[]>;
  customHeaders?: Record<string, string>;
}

class SecurityHeaders {
  private config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = {
      contentSecurityPolicy: {
        enabled: true,
        reportOnly: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'font-src': ["'self'", 'https:'],
          'connect-src': ["'self'", 'http://localhost:5000', 'http://127.0.0.1:5000'],
          'media-src': ["'self'"],
          'object-src': ["'none'"],
          'child-src': ["'self'"],
          'worker-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
          'manifest-src': ["'self'"]
        }
      },
      hsts: {
        enabled: true,
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      frameOptions: 'DENY',
      contentTypeOptions: true,
      xssProtection: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        'camera': [],
        'microphone': [],
        'geolocation': [],
        'payment': ["'self'"],
        'usb': [],
        'magnetometer': [],
        'gyroscope': [],
        'accelerometer': []
      },
      customHeaders: {
        'X-Powered-By': '', // Remove X-Powered-By header
        'Server': '', // Remove Server header
        'X-Content-Type-Options': 'nosniff',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none'
      },
      ...config
    };
  }

  /**
   * Apply all security headers
   */
  applySecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Apply Content Security Policy
      if (this.config.contentSecurityPolicy?.enabled) {
        this.setContentSecurityPolicy(res);
      }

      // Apply HSTS
      if (this.config.hsts?.enabled) {
        this.setHSTS(res);
      }

      // Apply X-Frame-Options
      if (this.config.frameOptions) {
        res.setHeader('X-Frame-Options', this.config.frameOptions);
      }

      // Apply X-Content-Type-Options
      if (this.config.contentTypeOptions) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // Apply X-XSS-Protection
      if (this.config.xssProtection) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }

      // Apply Referrer Policy
      if (this.config.referrerPolicy) {
        res.setHeader('Referrer-Policy', this.config.referrerPolicy);
      }

      // Apply Permissions Policy
      if (this.config.permissionsPolicy) {
        this.setPermissionsPolicy(res);
      }

      // Apply custom headers
      if (this.config.customHeaders) {
        this.setCustomHeaders(res);
      }

      // Additional security headers
      this.setAdditionalSecurityHeaders(res);

      next();
    } catch (error) {
      logger.error('Error applying security headers:', error);
      next(); // Continue on error to avoid breaking the application
    }
  };

  /**
   * Set Content Security Policy header
   */
  private setContentSecurityPolicy(res: Response): void {
    if (!this.config.contentSecurityPolicy?.directives) return;

    const directives = this.config.contentSecurityPolicy.directives;
    const cspString = Object.entries(directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

    const headerName = this.config.contentSecurityPolicy.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    res.setHeader(headerName, cspString);
  }

  /**
   * Set HTTP Strict Transport Security header
   */
  private setHSTS(res: Response): void {
    if (!this.config.hsts) return;

    let hstsValue = `max-age=${this.config.hsts.maxAge || 31536000}`;

    if (this.config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (this.config.hsts.preload) {
      hstsValue += '; preload';
    }

    res.setHeader('Strict-Transport-Security', hstsValue);
  }

  /**
   * Set Permissions Policy header
   */
  private setPermissionsPolicy(res: Response): void {
    if (!this.config.permissionsPolicy) return;

    const policies = Object.entries(this.config.permissionsPolicy)
      .map(([feature, allowlist]) => {
        if (allowlist.length === 0) {
          return `${feature}=()`;
        }
        return `${feature}=(${allowlist.join(' ')})`;
      })
      .join(', ');

    res.setHeader('Permissions-Policy', policies);
  }

  /**
   * Set custom headers
   */
  private setCustomHeaders(res: Response): void {
    if (!this.config.customHeaders) return;

    Object.entries(this.config.customHeaders).forEach(([header, value]) => {
      if (value === '') {
        res.removeHeader(header);
      } else {
        res.setHeader(header, value);
      }
    });
  }

  /**
   * Set additional security headers
   */
  private setAdditionalSecurityHeaders(res: Response): void {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS filtering
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Prevent Adobe Flash and PDF files from including content from your site
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Prevent Internet Explorer from executing downloads in your site's context
    res.setHeader('X-Download-Options', 'noopen');

    // DNS prefetch control
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Disable client-side caching for sensitive pages
    if (this.isSensitivePage(res.req as Request)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // Cross-Origin policies
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }

  /**
   * Check if the current page is sensitive (admin, auth, etc.)
   */
  private isSensitivePage(req: Request): boolean {
    const sensitivePaths = [
      '/admin',
      '/auth',
      '/login',
      '/register',
      '/password',
      '/api/admin',
      '/api/auth',
      '/saas-settings'
    ];

    return sensitivePaths.some(path => req.originalUrl.includes(path));
  }

  /**
   * Create CSP nonce for inline scripts
   */
  generateCSPNonce = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
      (res as any).locals.cspNonce = nonce;

      // Update CSP header to include nonce
      if (this.config.contentSecurityPolicy?.enabled) {
        const directives = { ...this.config.contentSecurityPolicy.directives };
        if (directives['script-src']) {
          directives['script-src'] = [...directives['script-src'], `'nonce-${nonce}'`];
        }
        if (directives['style-src']) {
          directives['style-src'] = [...directives['style-src'], `'nonce-${nonce}'`];
        }

        const cspString = Object.entries(directives)
          .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
          .join('; ');

        const headerName = this.config.contentSecurityPolicy.reportOnly
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';

        res.setHeader(headerName, cspString);
      }

      next();
    } catch (error) {
      logger.error('Error generating CSP nonce:', error);
      next();
    }
  };

  /**
   * Handle CSP violation reports
   */
  handleCSPViolation = (req: Request, res: Response): void => {
    try {
      const violation = req.body;

      logger.warn('CSP Violation Report', {
        documentURI: violation['document-uri'],
        violatedDirective: violation['violated-directive'],
        blockedURI: violation['blocked-uri'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number'],
        originalPolicy: violation['original-policy'],
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        service: 'security-headers'
      });

      // You could store violations in database for analysis
      // await this.storeCSPViolation(violation);

      res.status(204).send();
    } catch (error) {
      logger.error('Error handling CSP violation:', error);
      res.status(500).json({ error: 'Failed to process CSP violation report' });
    }
  };
}

// Create security headers instance with production-ready configuration
const securityHeaders = new SecurityHeaders({
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: process.env.NODE_ENV !== 'production',
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for some React functionality
        "'unsafe-eval'", // Required for development
        'https://cdn.jsdelivr.net',
        'https://unpkg.com'
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net'
      ],
      'connect-src': [
        "'self'",
        'https://api.nomba.com', // Payment provider
        'wss:', // WebSocket connections
        'ws:' // WebSocket connections (dev)
      ],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'report-uri': ['/api/security/csp-violation']
    }
  },
  hsts: {
    enabled: process.env.NODE_ENV === 'production',
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    'camera': [],
    'microphone': [],
    'geolocation': [],
    'payment': ["'self'"],
    'usb': [],
    'magnetometer': [],
    'gyroscope': [],
    'accelerometer': [],
    'autoplay': [],
    'encrypted-media': [],
    'fullscreen': ["'self'"],
    'picture-in-picture': []
  }
});

// Helmet configuration for additional security
export const helmetConfig = helmet({
  contentSecurityPolicy: false, // We handle CSP manually for more control
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  permittedCrossDomainPolicies: false,
  hidePoweredBy: true
});

// Export middleware functions
export const applySecurityHeaders = securityHeaders.applySecurityHeaders;
export const generateCSPNonce = securityHeaders.generateCSPNonce;
export const handleCSPViolation = securityHeaders.handleCSPViolation;

// Security headers for different environments
export const developmentSecurityHeaders = new SecurityHeaders({
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: true, // Report-only mode for development
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:', 'http:'],
      'connect-src': ["'self'", 'localhost:*', 'ws:', 'wss:']
    }
  },
  hsts: { enabled: false } // Disable HSTS in development
});

export const productionSecurityHeaders = new SecurityHeaders({
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://api.nomba.com'],
      'report-uri': ['/api/security/csp-violation']
    }
  },
  hsts: {
    enabled: true,
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true
  }
});

// Export class for custom configurations
export { SecurityHeaders };

export default {
  applySecurityHeaders,
  generateCSPNonce,
  handleCSPViolation,
  helmetConfig,
  developmentSecurityHeaders,
  productionSecurityHeaders,
  SecurityHeaders
};