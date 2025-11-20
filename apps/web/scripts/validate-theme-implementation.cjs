#!/usr/bin/env node

/**
 * Theme Implementation Validation Script
 * 
 * This script validates that the theme implementation meets the requirements:
 * - Inline theme script exists in index.html
 * - CSS variables are properly defined
 * - Theme store has performance monitoring
 * - Theme components are properly implemented
 */

const fs = require('fs');
const path = require('path');

class ThemeValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
  }

  log(message, type = 'info') {
    const prefix = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    }[type];
    
    console.log(`${prefix} ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
    if (type === 'success') this.successes.push(message);
  }

  validateIndexHtml() {
    this.log('Validating index.html inline theme script...', 'info');
    
    const indexPath = path.join(process.cwd(), 'index.html');
    
    if (!fs.existsSync(indexPath)) {
      this.log('index.html not found', 'error');
      return false;
    }
    
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for inline theme script
    if (!content.includes('__INITIAL_THEME__')) {
      this.log('Inline theme script not found in index.html', 'error');
      return false;
    }
    
    // Check for localStorage theme reading
    if (!content.includes('localStorage.getItem(\'theme-storage\')')) {
      this.log('Theme storage reading not found in inline script', 'error');
      return false;
    }
    
    // Check for system preference detection
    if (!content.includes('prefers-color-scheme: dark')) {
      this.log('System preference detection not found', 'error');
      return false;
    }
    
    // Check for error handling
    if (!content.includes('try') && content.includes('catch')) {
      this.log('Error handling found in inline script', 'success');
    } else {
      this.log('Error handling not found in inline script', 'warning');
    }
    
    // Check for performance measurement
    if (content.includes('performance.now()')) {
      this.log('Performance measurement found in inline script', 'success');
    } else {
      this.log('Performance measurement not found in inline script', 'warning');
    }
    
    this.log('Inline theme script validation passed', 'success');
    return true;
  }

  validateCSSVariables() {
    this.log('Validating CSS variables system...', 'info');
    
    const cssPath = path.join(process.cwd(), 'src', 'index.css');
    
    if (!fs.existsSync(cssPath)) {
      this.log('index.css not found', 'error');
      return false;
    }
    
    const content = fs.readFileSync(cssPath, 'utf8');
    
    // Check for CSS variables
    const requiredVariables = [
      '--bg-primary',
      '--bg-secondary',
      '--text-primary',
      '--text-secondary',
      '--border-primary',
      '--theme-transition'
    ];
    
    let missingVariables = [];
    
    requiredVariables.forEach(variable => {
      if (!content.includes(variable)) {
        missingVariables.push(variable);
      }
    });
    
    if (missingVariables.length > 0) {
      this.log(`Missing CSS variables: ${missingVariables.join(', ')}`, 'error');
      return false;
    }
    
    // Check for dark theme variables
    if (!content.includes('.dark {')) {
      this.log('Dark theme CSS variables not found', 'error');
      return false;
    }
    
    // Check for utility classes
    const utilityClasses = [
      '.bg-theme-primary',
      '.text-theme-primary',
      '.border-theme-primary',
      '.transition-theme'
    ];
    
    let missingUtilities = [];
    
    utilityClasses.forEach(className => {
      if (!content.includes(className)) {
        missingUtilities.push(className);
      }
    });
    
    if (missingUtilities.length > 0) {
      this.log(`Missing utility classes: ${missingUtilities.join(', ')}`, 'warning');
    }
    
    // Check for performance optimizations
    if (content.includes('prefers-reduced-motion')) {
      this.log('Reduced motion support found', 'success');
    } else {
      this.log('Reduced motion support not found', 'warning');
    }
    
    this.log('CSS variables validation passed', 'success');
    return true;
  }

  validateThemeStore() {
    this.log('Validating theme store implementation...', 'info');
    
    const storePath = path.join(process.cwd(), 'src', 'stores', 'themeStore.ts');
    
    if (!fs.existsSync(storePath)) {
      this.log('themeStore.ts not found', 'error');
      return false;
    }
    
    const content = fs.readFileSync(storePath, 'utf8');
    
    // Check for performance monitoring
    if (!content.includes('ThemePerformanceMetrics')) {
      this.log('Performance metrics interface not found', 'error');
      return false;
    }
    
    // Check for performance measurement in toggleTheme
    if (!content.includes('performance.now()')) {
      this.log('Performance measurement not found in theme store', 'error');
      return false;
    }
    
    // Check for synchronous DOM manipulation
    if (!content.includes('applyThemeToDOM')) {
      this.log('DOM manipulation function not found', 'error');
      return false;
    }
    
    // Check for performance methods
    const performanceMethods = [
      'getAverageToggleTime',
      'getLastToggleTime',
      'getPerformanceReport'
    ];
    
    let missingMethods = [];
    
    performanceMethods.forEach(method => {
      if (!content.includes(method)) {
        missingMethods.push(method);
      }
    });
    
    if (missingMethods.length > 0) {
      this.log(`Missing performance methods: ${missingMethods.join(', ')}`, 'error');
      return false;
    }
    
    // Check for 16ms performance target
    if (content.includes('16')) {
      this.log('16ms performance target found', 'success');
    } else {
      this.log('16ms performance target not explicitly mentioned', 'warning');
    }
    
    this.log('Theme store validation passed', 'success');
    return true;
  }

  validateThemeProvider() {
    this.log('Validating ThemeProvider component...', 'info');
    
    const providerPath = path.join(process.cwd(), 'src', 'components', 'providers', 'ThemeProvider.tsx');
    
    if (!fs.existsSync(providerPath)) {
      this.log('ThemeProvider.tsx not found', 'error');
      return false;
    }
    
    const content = fs.readFileSync(providerPath, 'utf8');
    
    // Check for initialization optimization
    if (!content.includes('__INITIAL_THEME__')) {
      this.log('Inline script sync not found in ThemeProvider', 'error');
      return false;
    }
    
    // Check for performance monitoring
    if (!content.includes('getPerformanceReport')) {
      this.log('Performance monitoring not found in ThemeProvider', 'warning');
    }
    
    this.log('ThemeProvider validation passed', 'success');
    return true;
  }

  validateThemeToggle() {
    this.log('Validating ThemeToggle component...', 'info');
    
    const togglePath = path.join(process.cwd(), 'src', 'components', 'common', 'ThemeToggle.tsx');
    
    if (!fs.existsSync(togglePath)) {
      this.log('ThemeToggle.tsx not found', 'error');
      return false;
    }
    
    const content = fs.readFileSync(togglePath, 'utf8');
    
    // Check for theme toggle functionality
    if (!content.includes('toggleTheme')) {
      this.log('toggleTheme function not found', 'error');
      return false;
    }
    
    // Check for accessibility
    if (!content.includes('aria-label')) {
      this.log('Accessibility labels not found', 'warning');
    }
    
    this.log('ThemeToggle validation passed', 'success');
    return true;
  }

  validateTestFiles() {
    this.log('Validating test files...', 'info');
    
    const testDir = path.join(process.cwd(), 'src', '__tests__', 'theme');
    
    if (!fs.existsSync(testDir)) {
      this.log('Theme test directory not found', 'error');
      return false;
    }
    
    const testFiles = [
      'ThemePerformance.test.tsx',
      'ThemeCLSValidation.test.tsx',
      'ThemeVisualRegression.test.tsx',
      'ThemePerformanceBenchmark.test.tsx'
    ];
    
    let missingTests = [];
    
    testFiles.forEach(file => {
      const filePath = path.join(testDir, file);
      if (!fs.existsSync(filePath)) {
        missingTests.push(file);
      }
    });
    
    if (missingTests.length > 0) {
      this.log(`Missing test files: ${missingTests.join(', ')}`, 'warning');
    } else {
      this.log('All theme test files found', 'success');
    }
    
    return true;
  }

  validatePackageScripts() {
    this.log('Validating package.json scripts...', 'info');
    
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.log('package.json not found', 'error');
      return false;
    }
    
    const content = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredScripts = [
      'test:theme',
      'test:theme:performance',
      'test:theme:cls',
      'test:theme:visual',
      'test:theme:benchmark'
    ];
    
    let missingScripts = [];
    
    requiredScripts.forEach(script => {
      if (!content.scripts || !content.scripts[script]) {
        missingScripts.push(script);
      }
    });
    
    if (missingScripts.length > 0) {
      this.log(`Missing package scripts: ${missingScripts.join(', ')}`, 'warning');
    } else {
      this.log('All theme test scripts found', 'success');
    }
    
    return true;
  }

  run() {
    console.log('🎯 Theme Implementation Validation');
    console.log('='.repeat(50));
    
    const validations = [
      () => this.validateIndexHtml(),
      () => this.validateCSSVariables(),
      () => this.validateThemeStore(),
      () => this.validateThemeProvider(),
      () => this.validateThemeToggle(),
      () => this.validateTestFiles(),
      () => this.validatePackageScripts()
    ];
    
    let passed = 0;
    let total = validations.length;
    
    validations.forEach(validation => {
      try {
        if (validation()) {
          passed++;
        }
      } catch (error) {
        this.log(`Validation error: ${error.message}`, 'error');
      }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    
    console.log(`✅ Passed: ${this.successes.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
    
    return this.errors.length === 0;
  }
}

// Run validation
if (require.main === module) {
  const validator = new ThemeValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = ThemeValidator;