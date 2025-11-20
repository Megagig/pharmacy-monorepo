// Manual Lab Module
// This module provides manual lab order and result entry functionality
// that operates alongside the existing FHIR-based lab integration

// Models
export * from './models';

// Types
export * from './types';

// Module metadata
export const MODULE_INFO = {
    name: 'Manual Lab Module',
    version: '1.0.0',
    description: 'Manual lab order workflow with printable requisitions, result entry, and AI interpretation',
    dependencies: [
        'diagnostics', // For AI integration
        'audit', // For audit logging
        'notification' // For alerts and notifications
    ],
    features: [
        'manual_lab_orders',
        'pdf_requisitions',
        'qr_barcode_scanning',
        'result_entry',
        'ai_interpretation',
        'audit_logging'
    ]
};