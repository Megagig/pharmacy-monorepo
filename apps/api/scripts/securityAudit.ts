#!/usr/bin/env ts-node

/**
 * Comprehensive Security Audit Script for Patient Engagement Module
 * 
 * This script performs a thorough security audit covering:
 * 1. Authentication and Authorization
 * 2. Input Validation and Sanitization
 * 3. SQL/NoSQL Injection Prevention
 * 4. HIPAA Compliance
 * 5. Rate Limiting and DDoS Protection
 * 6. Audit Logging Completeness
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface SecurityIssue {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

interface SecurityAuditReport {
  timestamp: Date;
  module: string;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  issues: SecurityIssue[];
  complianceStatus: {
    hipaa: boolean;
    authentication: boolean;
    authorization: boolean;
    inputValidation: boolean;
    rateLimiting: boolean;
    auditLogging: boolean;
  };
  recommendations: string[];
}

class SecurityAuditor {
  private issues: SecurityIssue[] = [];
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(__dirname, '..');
  }

  /**
   * Main audit function
   */
  async performAudit(): Promise<SecurityAuditReport> {
    console.log('🔒 Starting Security Audit for Patient Engagement Module...\n');

    // 1. Authentication and Authorization Audit
    await this.auditAuthentication();
    
    // 2. Input Validation Audit
    await this.auditInputValidation();
    
    // 3. SQL/NoSQL Injection Prevention
    await this.auditInjectionPrevention();
    
    // 4. HIPAA Compliance Audit
    await this.auditHIPAACompliance();
    
    // 5. Rate Limiting and DDoS Protection
    await this.auditRateLimiting();
    
    // 6. Audit Logging Completeness
    await this.auditLogging();
    
    // 7. Additional Security Checks
    await this.auditAdditionalSecurity();

    return this.generateReport();
  }

  /**
   * 1. Authentication and Authorization Audit
   */
  private async auditAuthentication(): Promise<void> {
    console.log('🔐 Auditing Authentication and Authorization...');

    // Check if all routes have authentication
    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for auth middleware
        if (!content.includes('router.use(auth)')) {
          this.addIssue({
            severity: 'CRITICAL',
            category: 'Authentication',
            description: `Route file ${routeFile} does not apply authentication middleware globally`,
            file: routeFile,
            recommendation: 'Add router.use(auth) to ensure all routes require authentication'
          });
        }

        // Check for RBAC middleware
        const routeMatches = content.match(/router\.(get|post|put|patch|delete)\(/g);
        const rbacMatches = content.match(/rbac\.requireRole|requirePermission|requireDynamicPermission/g);
        
        if (routeMatches && (!rbacMatches || rbacMatches.length < routeMatches.length * 0.8)) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Authorization',
            description: `Route file ${routeFile} has insufficient RBAC protection`,
            file: routeFile,
            recommendation: 'Ensure all sensitive routes have appropriate role-based access control'
          });
        }

        // Check for feature flag protection
        if (!content.includes('requirePatientEngagementModule')) {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Authorization',
            description: `Route file ${routeFile} missing feature flag protection`,
            file: routeFile,
            recommendation: 'Add feature flag middleware to control access to patient engagement features'
          });
        }

        // Check for super admin bypass vulnerabilities
        if (content.includes('super_admin') && !content.includes('bypass')) {
          this.addIssue({
            severity: 'LOW',
            category: 'Authorization',
            description: `Route file ${routeFile} may have uncontrolled super admin access`,
            file: routeFile,
            recommendation: 'Review super admin access patterns for potential security risks'
          });
        }
      }
    }

    // Check authentication middleware implementation
    const authMiddlewarePath = path.join(this.baseDir, 'src/middlewares/auth.ts');
    if (fs.existsSync(authMiddlewarePath)) {
      const authContent = fs.readFileSync(authMiddlewarePath, 'utf8');
      
      // Check for JWT secret validation
      if (!authContent.includes('process.env.JWT_SECRET')) {
        this.addIssue({
          severity: 'CRITICAL',
          category: 'Authentication',
          description: 'JWT secret not properly configured',
          file: 'src/middlewares/auth.ts',
          recommendation: 'Ensure JWT_SECRET environment variable is properly configured and used'
        });
      }

      // Check for token expiration handling
      if (!authContent.includes('TokenExpiredError')) {
        this.addIssue({
          severity: 'MEDIUM',
          category: 'Authentication',
          description: 'JWT token expiration not properly handled',
          file: 'src/middlewares/auth.ts',
          recommendation: 'Implement proper JWT token expiration handling'
        });
      }

      // Check for session security
      if (authContent.includes('httpOnly') && authContent.includes('secure')) {
        console.log('✅ Cookie security flags properly configured');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'Authentication',
          description: 'Cookie security flags not properly configured',
          file: 'src/middlewares/auth.ts',
          recommendation: 'Ensure cookies have httpOnly and secure flags set'
        });
      }
    }

    console.log('✅ Authentication audit completed\n');
  }

  /**
   * 2. Input Validation Audit
   */
  private async auditInputValidation(): Promise<void> {
    console.log('🛡️ Auditing Input Validation and Sanitization...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for express-validator usage
        if (!content.includes('express-validator')) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Input Validation',
            description: `Route file ${routeFile} does not import express-validator`,
            file: routeFile,
            recommendation: 'Import and use express-validator for input validation'
          });
        }

        // Check for validation middleware
        if (!content.includes('validateRequest')) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Input Validation',
            description: `Route file ${routeFile} does not use validation middleware`,
            file: routeFile,
            recommendation: 'Add validateRequest middleware to all routes that accept input'
          });
        }

        // Check for MongoDB ObjectId validation
        const objectIdParams = content.match(/:id|:patientId|:appointmentId|:taskId/g);
        const objectIdValidation = content.match(/isMongoId/g);
        
        if (objectIdParams && (!objectIdValidation || objectIdValidation.length < objectIdParams.length)) {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Input Validation',
            description: `Route file ${routeFile} has insufficient MongoDB ObjectId validation`,
            file: routeFile,
            recommendation: 'Validate all MongoDB ObjectId parameters using isMongoId()'
          });
        }

        // Check for XSS prevention
        if (content.includes('body(') && !content.includes('escape') && !content.includes('sanitize')) {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Input Validation',
            description: `Route file ${routeFile} may be vulnerable to XSS attacks`,
            file: routeFile,
            recommendation: 'Implement input sanitization to prevent XSS attacks'
          });
        }
      }
    }

    // Check input validation middleware
    const validationMiddlewarePath = path.join(this.baseDir, 'src/middlewares/inputValidation.ts');
    if (fs.existsSync(validationMiddlewarePath)) {
      const validationContent = fs.readFileSync(validationMiddlewarePath, 'utf8');
      
      // Check for DOMPurify usage
      if (validationContent.includes('DOMPurify')) {
        console.log('✅ XSS protection with DOMPurify implemented');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'Input Validation',
          description: 'XSS protection not implemented',
          file: 'src/middlewares/inputValidation.ts',
          recommendation: 'Implement DOMPurify for XSS protection'
        });
      }

      // Check for SQL injection prevention
      if (validationContent.includes('sqlPatterns') || validationContent.includes('SQL injection')) {
        console.log('✅ SQL injection prevention implemented');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'Input Validation',
          description: 'SQL injection prevention not implemented',
          file: 'src/middlewares/inputValidation.ts',
          recommendation: 'Implement SQL injection pattern detection and prevention'
        });
      }
    } else {
      this.addIssue({
        severity: 'CRITICAL',
        category: 'Input Validation',
        description: 'Input validation middleware not found',
        recommendation: 'Create comprehensive input validation middleware'
      });
    }

    console.log('✅ Input validation audit completed\n');
  }

  /**
   * 3. SQL/NoSQL Injection Prevention Audit
   */
  private async auditInjectionPrevention(): Promise<void> {
    console.log('💉 Auditing SQL/NoSQL Injection Prevention...');

    // Check for direct query construction
    const sourceFiles = this.getSourceFiles(['src/controllers', 'src/services', 'src/models']);
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /\$where.*\+/g,  // MongoDB $where with string concatenation
        /find\(.*\+.*\)/g,  // Direct string concatenation in queries
        /aggregate\(.*\+.*\)/g,  // String concatenation in aggregation
        /eval\(/g,  // Use of eval
        /new Function\(/g,  // Dynamic function creation
      ];

      dangerousPatterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Injection Prevention',
            description: `Potential NoSQL injection vulnerability in ${file}`,
            file: file.replace(this.baseDir + '/', ''),
            recommendation: 'Use parameterized queries and avoid string concatenation in database operations'
          });
        }
      });

      // Check for proper Mongoose usage
      if (content.includes('mongoose') && content.includes('find')) {
        if (!content.includes('sanitize') && content.includes('req.')) {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Injection Prevention',
            description: `Potential unsanitized input in database query in ${file}`,
            file: file.replace(this.baseDir + '/', ''),
            recommendation: 'Sanitize all user input before using in database queries'
          });
        }
      }
    }

    console.log('✅ Injection prevention audit completed\n');
  }

  /**
   * 4. HIPAA Compliance Audit
   */
  private async auditHIPAACompliance(): Promise<void> {
    console.log('🏥 Auditing HIPAA Compliance...');

    // Check for PHI handling
    const sourceFiles = this.getSourceFiles(['src/controllers', 'src/services', 'src/models']);
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for patient data fields
      const phiFields = [
        'firstName', 'lastName', 'email', 'phone', 'address', 
        'dob', 'ssn', 'medicalRecord', 'diagnosis', 'medication'
      ];

      phiFields.forEach(field => {
        if (content.includes(field) && content.includes('log')) {
          this.addIssue({
            severity: 'CRITICAL',
            category: 'HIPAA Compliance',
            description: `Potential PHI logging in ${file}`,
            file: file.replace(this.baseDir + '/', ''),
            recommendation: 'Ensure PHI is not logged or transmitted in plain text'
          });
        }
      });

      // Check for encryption
      if (content.includes('password') && !content.includes('hash') && !content.includes('encrypt')) {
        this.addIssue({
          severity: 'HIGH',
          category: 'HIPAA Compliance',
          description: `Potential unencrypted sensitive data in ${file}`,
          file: file.replace(this.baseDir + '/', ''),
          recommendation: 'Encrypt all sensitive data including passwords and PHI'
        });
      }
    }

    // Check audit logging for HIPAA compliance
    const auditMiddlewarePath = path.join(this.baseDir, 'src/middlewares/auditLogging.ts');
    if (fs.existsSync(auditMiddlewarePath)) {
      const auditContent = fs.readFileSync(auditMiddlewarePath, 'utf8');
      
      if (auditContent.includes('complianceRelevant')) {
        console.log('✅ HIPAA compliance tracking implemented in audit logs');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'HIPAA Compliance',
          description: 'HIPAA compliance tracking not implemented in audit logs',
          file: 'src/middlewares/auditLogging.ts',
          recommendation: 'Add compliance tracking to audit logs for HIPAA requirements'
        });
      }

      if (auditContent.includes('retentionPeriod')) {
        console.log('✅ Data retention policies implemented');
      } else {
        this.addIssue({
          severity: 'MEDIUM',
          category: 'HIPAA Compliance',
          description: 'Data retention policies not implemented',
          file: 'src/middlewares/auditLogging.ts',
          recommendation: 'Implement data retention policies as required by HIPAA'
        });
      }
    }

    // Check for access controls
    const rbacPath = path.join(this.baseDir, 'src/middlewares/rbac.ts');
    if (fs.existsSync(rbacPath)) {
      const rbacContent = fs.readFileSync(rbacPath, 'utf8');
      
      if (rbacContent.includes('patient') && rbacContent.includes('permission')) {
        console.log('✅ Patient data access controls implemented');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'HIPAA Compliance',
          description: 'Patient data access controls not properly implemented',
          file: 'src/middlewares/rbac.ts',
          recommendation: 'Implement proper access controls for patient data as required by HIPAA'
        });
      }
    }

    console.log('✅ HIPAA compliance audit completed\n');
  }

  /**
   * 5. Rate Limiting and DDoS Protection Audit
   */
  private async auditRateLimiting(): Promise<void> {
    console.log('🚦 Auditing Rate Limiting and DDoS Protection...');

    // Check rate limiting middleware
    const rateLimitingPath = path.join(this.baseDir, 'src/middlewares/rateLimiting.ts');
    if (fs.existsSync(rateLimitingPath)) {
      const rateLimitingContent = fs.readFileSync(rateLimitingPath, 'utf8');
      
      if (rateLimitingContent.includes('express-rate-limit')) {
        console.log('✅ Rate limiting middleware implemented');
      } else {
        this.addIssue({
          severity: 'HIGH',
          category: 'Rate Limiting',
          description: 'Rate limiting not properly implemented',
          file: 'src/middlewares/rateLimiting.ts',
          recommendation: 'Implement express-rate-limit for DDoS protection'
        });
      }

      // Check for different rate limits for different operations
      const rateLimitTypes = ['api', 'auth', 'sensitive', 'invitation'];
      rateLimitTypes.forEach(type => {
        if (!rateLimitingContent.includes(type)) {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Rate Limiting',
            description: `Missing rate limiting for ${type} operations`,
            file: 'src/middlewares/rateLimiting.ts',
            recommendation: `Implement specific rate limiting for ${type} operations`
          });
        }
      });

      // Check for abuse detection
      if (rateLimitingContent.includes('abuseDetection')) {
        console.log('✅ Abuse detection implemented');
      } else {
        this.addIssue({
          severity: 'MEDIUM',
          category: 'Rate Limiting',
          description: 'Abuse detection not implemented',
          file: 'src/middlewares/rateLimiting.ts',
          recommendation: 'Implement abuse detection patterns for enhanced security'
        });
      }
    } else {
      this.addIssue({
        severity: 'CRITICAL',
        category: 'Rate Limiting',
        description: 'Rate limiting middleware not found',
        recommendation: 'Create comprehensive rate limiting middleware for DDoS protection'
      });
    }

    // Check if routes use rate limiting
    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (!content.includes('rateLimit') && !content.includes('rateLimiting')) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Rate Limiting',
            description: `Route file ${routeFile} does not implement rate limiting`,
            file: routeFile,
            recommendation: 'Add rate limiting middleware to protect against DDoS attacks'
          });
        }
      }
    }

    console.log('✅ Rate limiting audit completed\n');
  }

  /**
   * 6. Audit Logging Completeness
   */
  private async auditLogging(): Promise<void> {
    console.log('📝 Auditing Audit Logging Completeness...');

    // Check audit middleware implementation
    const auditPaths = [
      'src/middlewares/auditLogging.ts',
      'src/middlewares/auditMiddleware.ts'
    ];

    let auditImplemented = false;
    for (const auditPath of auditPaths) {
      const filePath = path.join(this.baseDir, auditPath);
      if (fs.existsSync(filePath)) {
        auditImplemented = true;
        const auditContent = fs.readFileSync(filePath, 'utf8');
        
        // Check for comprehensive audit operations
        const requiredAuditOperations = [
          'login', 'logout', 'dataAccess', 'permissionDenied',
          'confidentialDataAccess', 'dataExport'
        ];

        requiredAuditOperations.forEach(operation => {
          if (!auditContent.includes(operation)) {
            this.addIssue({
              severity: 'MEDIUM',
              category: 'Audit Logging',
              description: `Missing audit logging for ${operation} operations`,
              file: auditPath,
              recommendation: `Implement audit logging for ${operation} operations`
            });
          }
        });

        // Check for security event logging
        if (auditContent.includes('suspicious') && auditContent.includes('riskScore')) {
          console.log('✅ Security event logging implemented');
        } else {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Audit Logging',
            description: 'Security event logging not comprehensive',
            file: auditPath,
            recommendation: 'Implement comprehensive security event logging with risk scoring'
          });
        }

        // Check for audit log retention
        if (auditContent.includes('retentionPeriod') || auditContent.includes('cleanup')) {
          console.log('✅ Audit log retention implemented');
        } else {
          this.addIssue({
            severity: 'MEDIUM',
            category: 'Audit Logging',
            description: 'Audit log retention not implemented',
            file: auditPath,
            recommendation: 'Implement audit log retention policies'
          });
        }
      }
    }

    if (!auditImplemented) {
      this.addIssue({
        severity: 'CRITICAL',
        category: 'Audit Logging',
        description: 'Audit logging middleware not found',
        recommendation: 'Implement comprehensive audit logging middleware'
      });
    }

    // Check if routes use audit logging
    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (!content.includes('audit')) {
          this.addIssue({
            severity: 'HIGH',
            category: 'Audit Logging',
            description: `Route file ${routeFile} does not implement audit logging`,
            file: routeFile,
            recommendation: 'Add audit logging middleware to track all operations'
          });
        }
      }
    }

    console.log('✅ Audit logging audit completed\n');
  }

  /**
   * 7. Additional Security Checks
   */
  private async auditAdditionalSecurity(): Promise<void> {
    console.log('🔍 Performing Additional Security Checks...');

    // Check for environment variable usage
    const sourceFiles = this.getSourceFiles(['src']);
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for hardcoded secrets
      const secretPatterns = [
        /password.*=.*['"][^'"]+['"]/gi,
        /secret.*=.*['"][^'"]+['"]/gi,
        /key.*=.*['"][^'"]+['"]/gi,
        /token.*=.*['"][^'"]+['"]/gi
      ];

      secretPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            if (!match.includes('process.env') && !match.includes('config')) {
              this.addIssue({
                severity: 'CRITICAL',
                category: 'Security Configuration',
                description: `Potential hardcoded secret in ${file}`,
                file: file.replace(this.baseDir + '/', ''),
                recommendation: 'Use environment variables for all secrets and sensitive configuration'
              });
            }
          });
        }
      });

      // Check for console.log in production code
      if (content.includes('console.log') && !file.includes('test') && !file.includes('script')) {
        this.addIssue({
          severity: 'LOW',
          category: 'Information Disclosure',
          description: `Console.log found in production code in ${file}`,
          file: file.replace(this.baseDir + '/', ''),
          recommendation: 'Remove console.log statements from production code'
        });
      }

      // Check for error message disclosure
      if (content.includes('error.message') && content.includes('res.')) {
        this.addIssue({
          severity: 'MEDIUM',
          category: 'Information Disclosure',
          description: `Potential error message disclosure in ${file}`,
          file: file.replace(this.baseDir + '/', ''),
          recommendation: 'Sanitize error messages before sending to client'
        });
      }
    }

    // Check for CORS configuration
    const appFiles = this.getSourceFiles(['src'], 'app.ts');
    for (const file of appFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes('cors')) {
        if (content.includes('origin: true') || content.includes('origin: "*"')) {
          this.addIssue({
            severity: 'HIGH',
            category: 'CORS Configuration',
            description: 'CORS configured to allow all origins',
            file: file.replace(this.baseDir + '/', ''),
            recommendation: 'Configure CORS to allow only trusted origins'
          });
        } else {
          console.log('✅ CORS properly configured');
        }
      } else {
        this.addIssue({
          severity: 'MEDIUM',
          category: 'CORS Configuration',
          description: 'CORS not configured',
          file: file.replace(this.baseDir + '/', ''),
          recommendation: 'Configure CORS to control cross-origin requests'
        });
      }
    }

    console.log('✅ Additional security checks completed\n');
  }

  /**
   * Helper method to add security issue
   */
  private addIssue(issue: SecurityIssue): void {
    this.issues.push(issue);
    console.log(`⚠️  ${issue.severity}: ${issue.description}`);
  }

  /**
   * Helper method to get source files
   */
  private getSourceFiles(directories: string[], filename?: string): string[] {
    const files: string[] = [];
    
    for (const dir of directories) {
      const dirPath = path.join(this.baseDir, dir);
      if (fs.existsSync(dirPath)) {
        const dirFiles = this.getAllFiles(dirPath, filename);
        files.push(...dirFiles);
      }
    }
    
    return files;
  }

  /**
   * Recursively get all TypeScript files
   */
  private getAllFiles(dirPath: string, filename?: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(itemPath, filename));
      } else if (filename) {
        if (item === filename) {
          files.push(itemPath);
        }
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  /**
   * Generate comprehensive security audit report
   */
  private generateReport(): SecurityAuditReport {
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL').length;
    const highIssues = this.issues.filter(i => i.severity === 'HIGH').length;
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM').length;
    const lowIssues = this.issues.filter(i => i.severity === 'LOW').length;

    const report: SecurityAuditReport = {
      timestamp: new Date(),
      module: 'Patient Engagement & Follow-up Management',
      totalIssues: this.issues.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      issues: this.issues,
      complianceStatus: {
        hipaa: criticalIssues === 0 && highIssues <= 2,
        authentication: !this.issues.some(i => i.category === 'Authentication' && ['CRITICAL', 'HIGH'].includes(i.severity)),
        authorization: !this.issues.some(i => i.category === 'Authorization' && ['CRITICAL', 'HIGH'].includes(i.severity)),
        inputValidation: !this.issues.some(i => i.category === 'Input Validation' && ['CRITICAL', 'HIGH'].includes(i.severity)),
        rateLimiting: !this.issues.some(i => i.category === 'Rate Limiting' && ['CRITICAL', 'HIGH'].includes(i.severity)),
        auditLogging: !this.issues.some(i => i.category === 'Audit Logging' && ['CRITICAL', 'HIGH'].includes(i.severity))
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.issues.some(i => i.category === 'Authentication')) {
      recommendations.push('Strengthen authentication mechanisms and implement multi-factor authentication');
    }

    if (this.issues.some(i => i.category === 'Input Validation')) {
      recommendations.push('Implement comprehensive input validation and sanitization');
    }

    if (this.issues.some(i => i.category === 'HIPAA Compliance')) {
      recommendations.push('Ensure full HIPAA compliance with proper PHI handling and audit trails');
    }

    if (this.issues.some(i => i.category === 'Rate Limiting')) {
      recommendations.push('Implement robust rate limiting and DDoS protection');
    }

    if (this.issues.some(i => i.category === 'Audit Logging')) {
      recommendations.push('Enhance audit logging for complete security monitoring');
    }

    if (this.issues.filter(i => i.severity === 'CRITICAL').length > 0) {
      recommendations.push('Address all critical security issues immediately before deployment');
    }

    if (this.issues.filter(i => i.severity === 'HIGH').length > 3) {
      recommendations.push('Conduct security code review and penetration testing');
    }

    return recommendations;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const auditor = new SecurityAuditor();
    const report = await auditor.performAudit();

    // Display summary
    console.log('📊 SECURITY AUDIT SUMMARY');
    console.log('========================');
    console.log(`Module: ${report.module}`);
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Total Issues: ${report.totalIssues}`);
    console.log(`Critical: ${report.criticalIssues}`);
    console.log(`High: ${report.highIssues}`);
    console.log(`Medium: ${report.mediumIssues}`);
    console.log(`Low: ${report.lowIssues}\n`);

    // Display compliance status
    console.log('🏥 COMPLIANCE STATUS');
    console.log('===================');
    Object.entries(report.complianceStatus).forEach(([key, status]) => {
      console.log(`${key.toUpperCase()}: ${status ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
    });
    console.log();

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS');
      console.log('==================');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      console.log();
    }

    // Save detailed report
    const reportPath = path.join(__dirname, '..', 'security-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (report.criticalIssues > 0) {
      console.log('\n❌ AUDIT FAILED: Critical security issues found');
      process.exit(1);
    } else if (report.highIssues > 5) {
      console.log('\n⚠️  AUDIT WARNING: Multiple high-severity issues found');
      process.exit(1);
    } else {
      console.log('\n✅ AUDIT PASSED: Security audit completed successfully');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  main();
}

export { SecurityAuditor, SecurityAuditReport, SecurityIssue };