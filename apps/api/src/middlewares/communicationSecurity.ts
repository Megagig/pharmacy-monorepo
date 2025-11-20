import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import logger from '../utils/logger';

/**
 * Security middleware for Communication Hub
 * Handles input sanitization, XSS protection, and content validation
 */

interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  maxLength?: number;
  stripHtml?: boolean;
}

/**
 * Default sanitization configuration for different content types
 */
const sanitizationConfigs = {
  message: {
    allowedTags: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    maxLength: 10000,
    stripHtml: false,
  },
  title: {
    allowedTags: [],
    allowedAttributes: {},
    maxLength: 200,
    stripHtml: true,
  },
  search: {
    allowedTags: [],
    allowedAttributes: {},
    maxLength: 100,
    stripHtml: true,
  },
  filename: {
    allowedTags: [],
    allowedAttributes: {},
    maxLength: 255,
    stripHtml: true,
  },
};

/**
 * Sanitize text content based on configuration
 */
const sanitizeContent = (
  content: string,
  config: SanitizationOptions
): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let sanitized = content;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Check length limits
  if (config.maxLength && sanitized.length > config.maxLength) {
    sanitized = sanitized.substring(0, config.maxLength);
  }

  // Strip or sanitize HTML
  if (config.stripHtml) {
    sanitized = validator.stripLow(sanitized);
    sanitized = sanitized.replace(/<[^>]*>/g, ''); // Remove all HTML tags
  } else {
    // Use DOMPurify for safe HTML sanitization
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: config.allowedTags || [],
      ALLOWED_ATTR: Object.keys(config.allowedAttributes || {}),
    });
  }

  // Escape special characters that could be used for injection
  sanitized = validator.escape(sanitized);

  // Remove null bytes and other dangerous characters
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
};

/**
 * Validate and sanitize message content
 */
export const sanitizeMessageContent = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.body.content) {
      // Sanitize text content
      if (req.body.content.text) {
        const originalText = req.body.content.text;
        req.body.content.text = sanitizeContent(
          originalText,
          sanitizationConfigs.message
        );

        // Log if content was modified
        if (originalText !== req.body.content.text) {
          logger.info('Message content sanitized', {
            userId: req.user?._id,
            originalLength: originalText.length,
            sanitizedLength: req.body.content.text.length,
            service: 'communication-security',
          });
        }
      }

      // Validate message type
      const allowedTypes = [
        'text',
        'file',
        'image',
        'clinical_note',
        'voice_note',
      ];
      if (
        req.body.content.type &&
        !allowedTypes.includes(req.body.content.type)
      ) {
        res.status(400).json({
          success: false,
          message: 'Invalid message type',
          allowedTypes,
        });
        return;
      }

      // Sanitize attachment metadata
      if (
        req.body.content.attachments &&
        Array.isArray(req.body.content.attachments)
      ) {
        req.body.content.attachments = req.body.content.attachments.map(
          (attachment: any) => ({
            ...attachment,
            fileName: sanitizeContent(
              attachment.fileName || '',
              sanitizationConfigs.filename
            ),
            mimeType: validator.escape(attachment.mimeType || ''),
          })
        );
      }
    }

    // Sanitize other message fields
    if (req.body.reason) {
      req.body.reason = sanitizeContent(
        req.body.reason,
        sanitizationConfigs.message
      );
    }

    next();
  } catch (error) {
    logger.error('Error sanitizing message content:', error);
    res.status(500).json({
      success: false,
      message: 'Content sanitization failed',
    });
  }
};

/**
 * Validate and sanitize conversation data
 */
export const sanitizeConversationData = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize conversation title
    if (req.body.title) {
      req.body.title = sanitizeContent(
        req.body.title,
        sanitizationConfigs.title
      );
    }

    // Validate conversation type
    const allowedTypes = [
      'direct',
      'group',
      'patient_query',
      'clinical_consultation',
    ];
    if (req.body.type && !allowedTypes.includes(req.body.type)) {
      res.status(400).json({
        success: false,
        message: 'Invalid conversation type',
        allowedTypes,
      });
      return;
    }

    // Validate priority
    const allowedPriorities = ['low', 'normal', 'high', 'urgent'];
    if (req.body.priority && !allowedPriorities.includes(req.body.priority)) {
      res.status(400).json({
        success: false,
        message: 'Invalid priority level',
        allowedPriorities,
      });
      return;
    }

    // Sanitize tags
    if (req.body.tags && Array.isArray(req.body.tags)) {
      req.body.tags = req.body.tags
        .map((tag: string) =>
          sanitizeContent(tag, { maxLength: 50, stripHtml: true })
        )
        .filter((tag: string) => tag.length > 0)
        .slice(0, 10); // Limit to 10 tags
    }

    // Validate case ID
    if (req.body.caseId) {
      req.body.caseId = sanitizeContent(req.body.caseId, {
        maxLength: 100,
        stripHtml: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Error sanitizing conversation data:', error);
    res.status(500).json({
      success: false,
      message: 'Conversation data sanitization failed',
    });
  }
};

/**
 * Validate and sanitize search queries
 */
export const sanitizeSearchQuery = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize search query
    if (req.query.q) {
      const originalQuery = req.query.q as string;
      req.query.q = sanitizeContent(originalQuery, sanitizationConfigs.search);

      // Prevent SQL injection patterns in search
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /(--|\/\*|\*\/|;)/,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      ];

      const hasSqlInjection = sqlPatterns.some((pattern) =>
        pattern.test(originalQuery)
      );
      if (hasSqlInjection) {
        logger.warn('Potential SQL injection in search query', {
          userId: req.user?._id,
          query: originalQuery,
          sanitizedQuery: req.query.q,
          service: 'communication-security',
        });

        res.status(400).json({
          success: false,
          message: 'Invalid search query format',
        });
        return;
      }
    }

    // Sanitize other search parameters
    const stringParams = [
      'conversationId',
      'senderId',
      'participantId',
      'fileType',
    ];
    stringParams.forEach((param) => {
      if (req.query[param]) {
        req.query[param] = sanitizeContent(
          req.query[param] as string,
          sanitizationConfigs.search
        );
      }
    });

    // Sanitize tags in search
    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags)
        ? req.query.tags
        : [String(req.query.tags)];

      req.query.tags = tags.map((tag: any) => {
        const tagString =
          typeof tag === 'string'
            ? tag
            : Array.isArray(tag)
            ? tag.join(',')
            : String(tag || '');
        return sanitizeContent(tagString, {
          maxLength: 50,
          stripHtml: true,
        });
      });
    }

    next();
  } catch (error) {
    logger.error('Error sanitizing search query:', error);
    res.status(500).json({
      success: false,
      message: 'Search query sanitization failed',
    });
  }
};

/**
 * Validate file upload security
 */
export const validateFileUpload = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const files = req.files as any[];

    if (files && files.length > 0) {
      // Define allowed file types and sizes
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const maxTotalSize = 50 * 1024 * 1024; // 50MB total

      let totalSize = 0;
      const invalidFiles: string[] = [];

      for (const file of files) {
        // Check file size
        if (file.size > maxFileSize) {
          invalidFiles.push(`${file.originalname}: File too large (max 10MB)`);
          continue;
        }

        totalSize += file.size;

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          invalidFiles.push(`${file.originalname}: File type not allowed`);
          continue;
        }

        // Sanitize filename
        const sanitizedName = sanitizeContent(
          file.originalname,
          sanitizationConfigs.filename
        );
        if (sanitizedName !== file.originalname) {
          logger.info('Filename sanitized', {
            userId: req.user?._id,
            original: file.originalname,
            sanitized: sanitizedName,
            service: 'communication-security',
          });
          file.originalname = sanitizedName;
        }

        // Check for executable file extensions
        const dangerousExtensions = [
          '.exe',
          '.bat',
          '.cmd',
          '.scr',
          '.pif',
          '.com',
          '.js',
          '.vbs',
        ];
        const fileExtension = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        if (dangerousExtensions.includes(fileExtension)) {
          invalidFiles.push(
            `${file.originalname}: Executable files not allowed`
          );
        }
      }

      // Check total size
      if (totalSize > maxTotalSize) {
        invalidFiles.push('Total file size exceeds 50MB limit');
      }

      if (invalidFiles.length > 0) {
        res.status(400).json({
          success: false,
          message: 'File validation failed',
          errors: invalidFiles,
          allowedTypes: allowedMimeTypes,
          maxFileSize: '10MB',
          maxTotalSize: '50MB',
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Error validating file upload:', error);
    res.status(500).json({
      success: false,
      message: 'File validation failed',
    });
  }
};

/**
 * Prevent NoSQL injection in MongoDB queries
 */
export const preventNoSQLInjection = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const sanitizeObject = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj === 'string') {
        // Remove MongoDB operators
        return obj.replace(/^\$/, '');
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Remove keys that start with $ (MongoDB operators)
            const sanitizedKey = key.replace(/^\$/, '');
            sanitized[sanitizedKey] = sanitizeObject(obj[key]);
          }
        }
        return sanitized;
      }

      return obj;
    };

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('Error preventing NoSQL injection:', error);
    res.status(500).json({
      success: false,
      message: 'Security validation failed',
    });
  }
};

/**
 * Content Security Policy headers for communication endpoints
 */
export const setCommunicationCSP = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' wss: ws:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

/**
 * Validate emoji reactions to prevent XSS
 */
export const validateEmojiReaction = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({
        success: false,
        message: 'Emoji is required',
      });
      return;
    }

    // Allowed healthcare-related emojis
    const allowedEmojis = [
      '👍',
      '',
      '❤️',
      '😊',
      '😢',
      '😮',
      '😡',
      '🤔',
      '✅',
      '❌',
      '⚠️',
      '🚨',
      '📋',
      '💊',
      '🩺',
      '📊',
    ];

    if (!allowedEmojis.includes(emoji)) {
      res.status(400).json({
        success: false,
        message: 'Invalid emoji reaction',
        allowedEmojis,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating emoji reaction:', error);
    res.status(500).json({
      success: false,
      message: 'Emoji validation failed',
    });
  }
};

/**
 * Comprehensive input validation middleware
 */
export const validateCommunicationInput = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Check for common attack patterns
    const attackPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
    ];

    const checkForAttacks = (value: string): boolean => {
      return attackPatterns.some((pattern) => pattern.test(value));
    };

    const validateValue = (value: any, path: string): boolean => {
      if (typeof value === 'string') {
        if (checkForAttacks(value)) {
          logger.warn('Potential XSS attack detected', {
            userId: req.user?._id,
            path,
            value: value.substring(0, 100),
            service: 'communication-security',
          });
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const key in value) {
          if (!validateValue(value[key], `${path}.${key}`)) {
            return false;
          }
        }
      }
      return true;
    };

    // Validate request body
    if (req.body && !validateValue(req.body, 'body')) {
      res.status(400).json({
        success: false,
        message: 'Invalid input detected',
      });
      return;
    }

    // Validate query parameters
    if (req.query && !validateValue(req.query, 'query')) {
      res.status(400).json({
        success: false,
        message: 'Invalid query parameters detected',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating communication input:', error);
    res.status(500).json({
      success: false,
      message: 'Input validation failed',
    });
  }
};

export default {
  sanitizeMessageContent,
  sanitizeConversationData,
  sanitizeSearchQuery,
  validateFileUpload,
  preventNoSQLInjection,
  setCommunicationCSP,
  validateEmojiReaction,
  validateCommunicationInput,
};
