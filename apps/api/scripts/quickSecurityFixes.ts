#!/usr/bin/env ts-node

/**
 * Quick Security Fixes Script
 * 
 * This script applies immediate security fixes for the most critical vulnerabilities
 * identified in the security audit.
 */

import fs from 'fs';
import path from 'path';

class SecurityFixer {
  private baseDir: string;
  private fixesApplied: string[] = [];

  constructor() {
    this.baseDir = path.join(__dirname, '..');
  }

  /**
   * Apply all critical security fixes
   */
  async applyFixes(): Promise<void> {
    console.log('🔒 Applying Critical Security Fixes...\n');

    // 1. Fix PHI logging issues
    await this.fixPHILogging();

    // 2. Add authentication to routes
    await this.addAuthenticationToRoutes();

    // 3. Add rate limiting to routes
    await this.addRateLimitingToRoutes();

    // 4. Add audit logging to routes
    await this.addAuditLoggingToRoutes();

    // 5. Fix error message disclosure
    await this.fixErrorMessageDisclosure();

    // 6. Add input validation
    await this.addInputValidation();

    console.log('\n✅ Security fixes applied successfully!');
    console.log('\nFixes Applied:');
    this.fixesApplied.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix}`);
    });
  }

  /**
   * Fix PHI logging issues
   */
  private async fixPHILogging(): Promise<void> {
    console.log('🔐 Fixing PHI logging issues...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts',
      'src/controllers/appointmentController.ts',
      'src/controllers/followUpController.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add PHI-safe logging helper
        if (!content.includes('// PHI-safe logging')) {
          const phiSafeLogging = `
// PHI-safe logging helper
const logSafely = (message: string, data: any) => {
  const safeData = {
    ...data,
    // Remove PHI fields
    firstName: data.firstName ? '[REDACTED]' : undefined,
    lastName: data.lastName ? '[REDACTED]' : undefined,
    email: data.email ? '[REDACTED]' : undefined,
    phone: data.phone ? '[REDACTED]' : undefined,
    address: data.address ? '[REDACTED]' : undefined,
    dob: data.dob ? '[REDACTED]' : undefined
  };
  logger.info(message, safeData);
};

`;
          content = content.replace(
            "import logger from '../utils/logger';",
            `import logger from '../utils/logger';\n${phiSafeLogging}`
          );
        }

        // Replace direct logger calls with safe logging
        content = content.replace(
          /logger\.(info|warn|error)\([^)]*firstName[^)]*\)/g,
          'logSafely($1, { message: "Patient data accessed", userId: req.user?._id })'
        );

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Fixed PHI logging in ${routeFile}`);
      }
    }
  }

  /**
   * Add authentication to routes
   */
  private async addAuthenticationToRoutes(): Promise<void> {
    console.log('🔐 Adding authentication to routes...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Ensure auth middleware is applied globally
        if (!content.includes('router.use(auth)')) {
          content = content.replace(
            'const router = express.Router();',
            `const router = express.Router();

// Apply authentication to all routes
router.use(auth);`
          );
        }

        // Add RBAC to sensitive routes
        if (!content.includes('rbac.requireRole')) {
          content = content.replace(
            /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`],\s*(?!.*rbac)/g,
            `router.$1('$2',
  rbac.requireRole('pharmacist', 'pharmacy_manager', 'admin'),`
          );
        }

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Added authentication to ${routeFile}`);
      }
    }
  }

  /**
   * Add rate limiting to routes
   */
  private async addRateLimitingToRoutes(): Promise<void> {
    console.log('🚦 Adding rate limiting to routes...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add rate limiting import
        if (!content.includes('rateLimiting')) {
          content = content.replace(
            "import { validateRequest } from '../middlewares/validateRequest';",
            `import { validateRequest } from '../middlewares/validateRequest';
import { generalRateLimiters } from '../middlewares/rateLimiting';`
          );
        }

        // Apply rate limiting globally
        if (!content.includes('generalRateLimiters.api')) {
          content = content.replace(
            'router.use(auth);',
            `router.use(auth);

// Apply rate limiting
router.use(generalRateLimiters.api);`
          );
        }

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Added rate limiting to ${routeFile}`);
      }
    }
  }

  /**
   * Add audit logging to routes
   */
  private async addAuditLoggingToRoutes(): Promise<void> {
    console.log('📝 Adding audit logging to routes...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add audit logging import
        if (!content.includes('auditMiddleware')) {
          content = content.replace(
            "import { generalRateLimiters } from '../middlewares/rateLimiting';",
            `import { generalRateLimiters } from '../middlewares/rateLimiting';
import { auditMiddleware } from '../middlewares/auditLogging';`
          );
        }

        // Add audit logging to sensitive operations
        content = content.replace(
          /router\.post\(\s*['"`]([^'"`]+)['"`],/g,
          `router.post('$1',
  auditMiddleware({
    action: 'CREATE_OPERATION',
    category: 'data_access',
    severity: 'medium'
  }),`
        );

        content = content.replace(
          /router\.get\(\s*['"`]([^'"`]*patient[^'"`]*)['"`],/g,
          `router.get('$1',
  auditMiddleware({
    action: 'PATIENT_DATA_ACCESS',
    category: 'data_access',
    severity: 'high'
  }),`
        );

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Added audit logging to ${routeFile}`);
      }
    }
  }

  /**
   * Fix error message disclosure
   */
  private async fixErrorMessageDisclosure(): Promise<void> {
    console.log('🛡️ Fixing error message disclosure...');

    const controllerFiles = [
      'src/controllers/appointmentController.ts',
      'src/controllers/followUpController.ts'
    ];

    for (const controllerFile of controllerFiles) {
      const filePath = path.join(this.baseDir, controllerFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace error message disclosure
        content = content.replace(
          /res\.status\(500\)\.json\(\{\s*success:\s*false,\s*message:\s*[^}]*error[^}]*\}\)/g,
          `res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })`
        );

        // Add proper error logging
        content = content.replace(
          /catch \(error[^{]*\{/g,
          `catch (error) {
      logger.error('Operation failed:', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?._id,
        action: req.originalUrl
      });`
        );

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Fixed error disclosure in ${controllerFile}`);
      }
    }
  }

  /**
   * Add input validation
   */
  private async addInputValidation(): Promise<void> {
    console.log('✅ Adding input validation...');

    const routeFiles = [
      'src/routes/appointmentRoutes.ts',
      'src/routes/followUpRoutes.ts'
    ];

    for (const routeFile of routeFiles) {
      const filePath = path.join(this.baseDir, routeFile);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Ensure validateRequest is used on all routes with body
        content = content.replace(
          /router\.(post|put|patch)\([^,]+,\s*(?!.*validateRequest)/g,
          (match) => match.replace(/,\s*$/, '') + ',\n  validateRequest,'
        );

        fs.writeFileSync(filePath, content);
        this.fixesApplied.push(`Added input validation to ${routeFile}`);
      }
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const fixer = new SecurityFixer();
    await fixer.applyFixes();
    
    console.log('\n🎉 Security fixes completed successfully!');
    console.log('\n⚠️  IMPORTANT: Please review the changes and test thoroughly before deployment.');
    console.log('📋 Next steps:');
    console.log('1. Review all modified files');
    console.log('2. Run security audit again');
    console.log('3. Test all functionality');
    console.log('4. Deploy with monitoring');
    
  } catch (error) {
    console.error('❌ Security fix failed:', error);
    process.exit(1);
  }
}

// Run the fixes if this script is executed directly
if (require.main === module) {
  main();
}

export { SecurityFixer };