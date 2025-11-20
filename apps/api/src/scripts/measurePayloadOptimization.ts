#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FieldProjection, PayloadOptimizer, OptimizationPresets } from '../utils/payloadOptimization';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Script to measure the impact of payload optimization
 * Tests different optimization strategies on real data
 */

interface OptimizationTestResult {
  testName: string;
  originalSize: number;
  optimizedSize: number;
  reductionBytes: number;
  reductionPercent: number;
  processingTime: number;
  recordCount: number;
}

async function measurePayloadOptimization() {
  try {
    logger.info('Starting payload optimization measurement');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const results: OptimizationTestResult[] = [];

    // Test different collections and optimization strategies
    await testPatientOptimization(results);
    await testClinicalNotesOptimization(results);
    await testMedicationOptimization(results);
    await testAuditLogOptimization(results);

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      summary: {
        averageReduction: results.reduce((sum, r) => sum + r.reductionPercent, 0) / results.length,
        totalBytesReduced: results.reduce((sum, r) => sum + r.reductionBytes, 0),
        bestOptimization: results.reduce((best, current) => 
          current.reductionPercent > best.reductionPercent ? current : best
        ),
        worstOptimization: results.reduce((worst, current) => 
          current.reductionPercent < worst.reductionPercent ? current : worst
        ),
      },
      results,
      recommendations: generateRecommendations(results),
    };

    // Log summary
    logger.info('Payload Optimization Summary:', {
      averageReduction: `${report.summary.averageReduction.toFixed(2)}%`,
      totalBytesReduced: `${(report.summary.totalBytesReduced / 1024).toFixed(2)} KB`,
      bestTest: report.summary.bestOptimization.testName,
      bestReduction: `${report.summary.bestOptimization.reductionPercent.toFixed(2)}%`,
    });

    // Write detailed report to file
    const fs = await import('fs');
    const path = await import('path');
    const reportPath = path.join(process.cwd(), 'payload-optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`Detailed report written to: ${reportPath}`);

    // Print results table
    console.log('\n=== PAYLOAD OPTIMIZATION RESULTS ===\n');
    console.table(results.map(r => ({
      'Test Name': r.testName,
      'Records': r.recordCount,
      'Original (KB)': (r.originalSize / 1024).toFixed(2),
      'Optimized (KB)': (r.optimizedSize / 1024).toFixed(2),
      'Reduction %': `${r.reductionPercent.toFixed(2)}%`,
      'Processing (ms)': r.processingTime.toFixed(2),
    })));

    console.log('\n=== RECOMMENDATIONS ===\n');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('Payload optimization measurement failed:', error);
    process.exit(1);
  }
}

async function testPatientOptimization(results: OptimizationTestResult[]): Promise<void> {
  try {
    const Patient = mongoose.model('Patient');
    const patients = await Patient.find({}).limit(100).lean();

    if (patients.length === 0) {
      logger.warn('No patients found for testing');
      return;
    }

    // Test different optimization presets
    const presets = [
      { name: 'Mobile Preset', ...OptimizationPresets.mobile },
      { name: 'List Preset', ...OptimizationPresets.list },
      { name: 'Detail Preset', ...OptimizationPresets.detail },
    ];

    for (const preset of presets) {
      const startTime = Date.now();
      
      let optimizedData = FieldProjection.project(patients, preset.projection);
      optimizedData = PayloadOptimizer.optimize(optimizedData, preset.optimization);
      
      const processingTime = Date.now() - startTime;
      
      const originalSize = Buffer.byteLength(JSON.stringify(patients));
      const optimizedSize = Buffer.byteLength(JSON.stringify(optimizedData));
      const reductionBytes = originalSize - optimizedSize;
      const reductionPercent = (reductionBytes / originalSize) * 100;

      results.push({
        testName: `Patients - ${preset.name}`,
        originalSize,
        optimizedSize,
        reductionBytes,
        reductionPercent,
        processingTime,
        recordCount: patients.length,
      });
    }

  } catch (error) {
    logger.error('Error testing patient optimization:', error);
  }
}

async function testClinicalNotesOptimization(results: OptimizationTestResult[]): Promise<void> {
  try {
    const ClinicalNote = mongoose.model('ClinicalNote');
    const notes = await ClinicalNote.find({}).limit(50).lean();

    if (notes.length === 0) {
      logger.warn('No clinical notes found for testing');
      return;
    }

    // Test aggressive optimization for clinical notes (often have large text content)
    const optimizations = [
      {
        name: 'Standard',
        projection: { exclude: ['__v', 'internalNotes'] },
        optimization: { removeNullValues: true, removeEmptyArrays: true },
      },
      {
        name: 'Aggressive',
        projection: { exclude: ['__v', 'internalNotes', 'attachments'], maxDepth: 3 },
        optimization: { 
          removeNullValues: true, 
          removeEmptyArrays: true, 
          removeEmptyObjects: true,
          maxStringLength: 500,
        },
      },
      {
        name: 'Mobile',
        projection: { 
          include: ['_id', 'patientId', 'noteType', 'summary', 'createdAt', 'authorId'],
          maxDepth: 2,
        },
        optimization: { 
          removeNullValues: true, 
          maxStringLength: 200,
          dateFormat: 'timestamp' as const,
        },
      },
    ];

    for (const opt of optimizations) {
      const startTime = Date.now();
      
      let optimizedData = FieldProjection.project(notes, opt.projection);
      optimizedData = PayloadOptimizer.optimize(optimizedData, opt.optimization);
      
      const processingTime = Date.now() - startTime;
      
      const originalSize = Buffer.byteLength(JSON.stringify(notes));
      const optimizedSize = Buffer.byteLength(JSON.stringify(optimizedData));
      const reductionBytes = originalSize - optimizedSize;
      const reductionPercent = (reductionBytes / originalSize) * 100;

      results.push({
        testName: `Clinical Notes - ${opt.name}`,
        originalSize,
        optimizedSize,
        reductionBytes,
        reductionPercent,
        processingTime,
        recordCount: notes.length,
      });
    }

  } catch (error) {
    logger.error('Error testing clinical notes optimization:', error);
  }
}

async function testMedicationOptimization(results: OptimizationTestResult[]): Promise<void> {
  try {
    const Medication = mongoose.model('Medication');
    const medications = await Medication.find({}).limit(100).lean();

    if (medications.length === 0) {
      logger.warn('No medications found for testing');
      return;
    }

    // Test medication-specific optimizations
    const startTime = Date.now();
    
    const optimizedData = FieldProjection.project(medications, {
      exclude: ['__v', 'internalNotes', 'auditTrail'],
      maxDepth: 4,
    });
    
    const finalData = PayloadOptimizer.optimize(optimizedData, {
      removeNullValues: true,
      removeEmptyArrays: true,
      removeEmptyObjects: true,
    });
    
    const processingTime = Date.now() - startTime;
    
    const originalSize = Buffer.byteLength(JSON.stringify(medications));
    const optimizedSize = Buffer.byteLength(JSON.stringify(finalData));
    const reductionBytes = originalSize - optimizedSize;
    const reductionPercent = (reductionBytes / originalSize) * 100;

    results.push({
      testName: 'Medications - Standard',
      originalSize,
      optimizedSize,
      reductionBytes,
      reductionPercent,
      processingTime,
      recordCount: medications.length,
    });

  } catch (error) {
    logger.error('Error testing medication optimization:', error);
  }
}

async function testAuditLogOptimization(results: OptimizationTestResult[]): Promise<void> {
  try {
    const AuditLog = mongoose.model('AuditLog');
    const auditLogs = await AuditLog.find({}).limit(200).lean();

    if (auditLogs.length === 0) {
      logger.warn('No audit logs found for testing');
      return;
    }

    // Test audit log optimization (typically have large details objects)
    const startTime = Date.now();
    
    const optimizedData = FieldProjection.project(auditLogs, {
      exclude: ['__v', 'rawRequest', 'rawResponse'],
      maxDepth: 3,
      maxArrayLength: 10,
    });
    
    const finalData = PayloadOptimizer.optimize(optimizedData, {
      removeNullValues: true,
      removeEmptyArrays: true,
      removeEmptyObjects: true,
      maxStringLength: 1000,
      dateFormat: 'timestamp' as const,
    });
    
    const processingTime = Date.now() - startTime;
    
    const originalSize = Buffer.byteLength(JSON.stringify(auditLogs));
    const optimizedSize = Buffer.byteLength(JSON.stringify(finalData));
    const reductionBytes = originalSize - optimizedSize;
    const reductionPercent = (reductionBytes / originalSize) * 100;

    results.push({
      testName: 'Audit Logs - Optimized',
      originalSize,
      optimizedSize,
      reductionBytes,
      reductionPercent,
      processingTime,
      recordCount: auditLogs.length,
    });

  } catch (error) {
    logger.error('Error testing audit log optimization:', error);
  }
}

function generateRecommendations(results: OptimizationTestResult[]): string[] {
  const recommendations: string[] = [];

  // Find best performing optimizations
  const bestReduction = Math.max(...results.map(r => r.reductionPercent));
  const avgReduction = results.reduce((sum, r) => sum + r.reductionPercent, 0) / results.length;

  if (avgReduction > 30) {
    recommendations.push(
      `EXCELLENT: Average payload reduction of ${avgReduction.toFixed(1)}% achieved. Deploy optimizations to production.`
    );
  } else if (avgReduction > 15) {
    recommendations.push(
      `GOOD: Average payload reduction of ${avgReduction.toFixed(1)}% achieved. Consider deploying for high-traffic endpoints.`
    );
  } else {
    recommendations.push(
      `MODERATE: Average payload reduction of ${avgReduction.toFixed(1)}% achieved. Focus on endpoints with large payloads.`
    );
  }

  // Identify high-impact optimizations
  const highImpact = results.filter(r => r.reductionPercent > 40);
  if (highImpact.length > 0) {
    recommendations.push(
      `HIGH IMPACT: ${highImpact.map(r => r.testName).join(', ')} show >40% reduction. Prioritize these optimizations.`
    );
  }

  // Performance considerations
  const slowOptimizations = results.filter(r => r.processingTime > 100);
  if (slowOptimizations.length > 0) {
    recommendations.push(
      `PERFORMANCE: ${slowOptimizations.map(r => r.testName).join(', ')} take >100ms to process. Consider caching optimized responses.`
    );
  }

  // Compression recommendations
  const totalReduction = results.reduce((sum, r) => sum + r.reductionBytes, 0);
  if (totalReduction > 100 * 1024) { // 100KB
    recommendations.push(
      `COMPRESSION: Total reduction of ${(totalReduction / 1024).toFixed(1)}KB suggests gzip/brotli compression will be highly effective.`
    );
  }

  // Mobile optimization
  const mobileTests = results.filter(r => r.testName.includes('Mobile'));
  if (mobileTests.length > 0) {
    const avgMobileReduction = mobileTests.reduce((sum, r) => sum + r.reductionPercent, 0) / mobileTests.length;
    recommendations.push(
      `MOBILE: Mobile optimizations achieve ${avgMobileReduction.toFixed(1)}% reduction on average. Implement for mobile API endpoints.`
    );
  }

  return recommendations;
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Payload Optimization Measurement Tool

Usage:
  npm run measure:payload-optimization              # Run full measurement
  npm run measure:payload-optimization -- --help   # Show this help

This tool measures the impact of different payload optimization strategies
on real data from your MongoDB collections.

The measurement includes:
- Field projection optimization
- Payload size reduction techniques
- Processing time analysis
- Compression effectiveness estimation

Output:
- Console summary with recommendations
- Detailed JSON report: payload-optimization-report.json
  `);
  process.exit(0);
}

// Run the measurement
measurePayloadOptimization();

export default measurePayloadOptimization;