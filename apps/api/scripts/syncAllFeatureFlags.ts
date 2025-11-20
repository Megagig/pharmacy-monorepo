#!/usr/bin/env ts-node

/**
 * Sync All Feature Flags Script
 * 
 * This script syncs all feature flags from the inventory to the database,
 * making them accessible via the Feature Management UI.
 * 
 * Usage:
 *   npx ts-node scripts/syncAllFeatureFlags.ts
 * 
 * Or with options:
 *   npx ts-node scripts/syncAllFeatureFlags.ts --preserve-existing
 *   npx ts-node scripts/syncAllFeatureFlags.ts --force
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';
import User from '../src/models/User';

// Load environment variables
dotenv.config();

// Command line arguments
const args = process.argv.slice(2);
const preserveExisting = args.includes('--preserve-existing');
const force = args.includes('--force');

// Complete feature flags inventory
const ALL_FEATURE_FLAGS = [
    // ===========================
    // CORE FEATURES
    // ===========================
    {
        key: 'patient_management',
        name: 'Patient Management',
        description: 'Create, view, and manage patient records',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'core',
            priority: 'critical',
            tags: ['patients', 'records', 'core'],
        },
    },
    {
        key: 'medication_management',
        name: 'Medication Management',
        description: 'Core functionality for managing medication records and inventory',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'core',
            priority: 'critical',
            tags: ['medications', 'inventory', 'core'],
        },
    },
    {
        key: 'basic_clinical_notes',
        name: 'Basic Clinical Notes',
        description: 'Basic clinical note creation and management',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist'],
        isActive: true,
        metadata: {
            category: 'core',
            priority: 'high',
            tags: ['clinical', 'notes', 'core'],
        },
    },
    {
        key: 'clinical_decision_support',
        name: 'Clinical Decision Support',
        description: 'AI-powered clinical decision support system and diagnostic workflows',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        customRules: {
            requiredLicense: true,
        },
        metadata: {
            category: 'core',
            priority: 'high',
            tags: ['ai', 'diagnostics', 'clinical'],
        },
    },
    {
        key: 'drug_information',
        name: 'Drug Information',
        description: 'Comprehensive drug database and interaction checking',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'intern_pharmacist'],
        isActive: true,
        metadata: {
            category: 'clinical',
            priority: 'high',
            tags: ['drugs', 'interactions', 'database'],
        },
    },
    {
        key: 'ai_diagnostics',
        name: 'AI Diagnostics',
        description: 'Advanced AI-powered diagnostic capabilities with machine learning',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        customRules: {
            requiredLicense: true,
        },
        metadata: {
            category: 'ai',
            priority: 'critical',
            tags: ['ai', 'diagnostics', 'advanced'],
        },
    },

    // ===========================
    // ANALYTICS FEATURES
    // ===========================
    {
        key: 'basic_reports',
        name: 'Basic Reports',
        description: 'Access to basic system reports and analytics',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'analytics',
            priority: 'medium',
            tags: ['reports', 'analytics', 'statistics'],
        },
    },
    {
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Detailed analytics and reporting capabilities with business intelligence dashboards',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'analytics',
            priority: 'high',
            tags: ['analytics', 'dashboard', 'business-intelligence'],
        },
    },
    {
        key: 'predictive_analytics',
        name: 'Predictive Analytics',
        description: 'AI-powered predictive analytics for business forecasting and trend analysis',
        allowedTiers: ['enterprise'],
        allowedRoles: ['pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'analytics',
            priority: 'medium',
            tags: ['ai', 'analytics', 'predictions', 'forecasting'],
        },
    },
    {
        key: 'diagnostic_analytics',
        name: 'Diagnostic Analytics',
        description: 'Access to diagnostic analytics and reporting features',
        allowedTiers: ['free', 'basic', 'pro', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'analytics',
            priority: 'medium',
            tags: ['diagnostics', 'analytics', 'reports'],
        },
    },

    // ===========================
    // COLLABORATION FEATURES
    // ===========================
    {
        key: 'user_management',
        name: 'User Management',
        description: 'Manage team members and user permissions',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['owner', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'management',
            priority: 'medium',
            tags: ['users', 'team', 'permissions'],
        },
    },
    {
        key: 'team_management',
        name: 'Team Management',
        description: 'Create and manage pharmacy team members with role-based access',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        customRules: {
            maxUsers: 10,
        },
        metadata: {
            category: 'collaboration',
            priority: 'high',
            tags: ['team', 'users', 'collaboration'],
        },
    },
    {
        key: 'role_management',
        name: 'Role Management',
        description: 'Advanced role and permission management with custom roles',
        allowedTiers: ['enterprise'],
        allowedRoles: ['pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'collaboration',
            priority: 'medium',
            tags: ['rbac', 'permissions', 'roles'],
        },
    },
    {
        key: 'pharmacy_network',
        name: 'Pharmacy Network',
        description: 'Connect and collaborate with other pharmacies in the network',
        allowedTiers: ['network', 'enterprise'],
        allowedRoles: ['pharmacy_outlet', 'owner'],
        isActive: false, // Feature not yet active
        metadata: {
            category: 'collaboration',
            priority: 'low',
            tags: ['network', 'collaboration', 'partnerships'],
        },
    },

    // ===========================
    // LOCATION MANAGEMENT
    // ===========================
    {
        key: 'multi_location',
        name: 'Multi-Location Management',
        description: 'Manage multiple pharmacy locations from a single dashboard',
        allowedTiers: ['pharmily', 'network', 'enterprise'],
        allowedRoles: ['owner', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'management',
            priority: 'medium',
            tags: ['locations', 'multi-site', 'management'],
        },
    },

    // ===========================
    // INTEGRATION FEATURES
    // ===========================
    {
        key: 'api_access',
        name: 'API Access',
        description: 'Access to REST API endpoints for external integrations',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['owner', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'integration',
            priority: 'medium',
            tags: ['api', 'integration', 'development'],
        },
    },
    {
        key: 'health_system_integration',
        name: 'Health System Integration',
        description: 'Integration with external healthcare systems and EHR platforms',
        allowedTiers: ['enterprise'],
        allowedRoles: ['pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'integration',
            priority: 'high',
            tags: ['integrations', 'health-systems', 'ehr'],
        },
    },
    {
        key: 'mtr_integration',
        name: 'MTR Integration',
        description: 'Medication Therapy Review integration features',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'integration',
            priority: 'medium',
            tags: ['mtr', 'medication-review', 'integration'],
        },
    },

    // ===========================
    // COMPLIANCE FEATURES
    // ===========================
    {
        key: 'compliance_tracking',
        name: 'Compliance Tracking',
        description: 'Track regulatory compliance requirements and maintain records',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        customRules: {
            requiredLicense: true,
        },
        metadata: {
            category: 'compliance',
            priority: 'high',
            tags: ['compliance', 'regulatory', 'tracking'],
        },
    },
    {
        key: 'audit_logs',
        name: 'Audit Logs',
        description: 'Detailed audit logs for compliance and security monitoring',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'compliance',
            priority: 'high',
            tags: ['audit', 'security', 'compliance'],
        },
    },

    // ===========================
    // ADMINISTRATION FEATURES
    // ===========================
    {
        key: 'feature_flag_management',
        name: 'Feature Flag Management',
        description: 'Manage and control system feature flags through the admin panel',
        allowedTiers: ['enterprise'],
        allowedRoles: ['super_admin'],
        isActive: true,
        metadata: {
            category: 'administration',
            priority: 'medium',
            tags: ['admin', 'features', 'configuration'],
        },
    },
    {
        key: 'system_settings',
        name: 'System Settings',
        description: 'Control system-wide configuration and settings',
        allowedTiers: ['enterprise'],
        allowedRoles: ['super_admin'],
        isActive: true,
        metadata: {
            category: 'administration',
            priority: 'high',
            tags: ['admin', 'settings', 'configuration'],
        },
    },

    // ===========================
    // CLINICAL INTERVENTIONS MODULE
    // ===========================
    {
        key: 'clinical_interventions',
        name: 'Clinical Interventions',
        description: 'Clinical interventions module for medication therapy management',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'clinical',
            priority: 'high',
            tags: ['interventions', 'clinical', 'mtm'],
        },
    },
    {
        key: 'advanced_reporting',
        name: 'Advanced Reporting',
        description: 'Advanced reporting features for clinical interventions',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'reporting',
            priority: 'medium',
            tags: ['reports', 'interventions', 'clinical'],
        },
    },
    {
        key: 'bulk_operations',
        name: 'Bulk Operations',
        description: 'Enable bulk operations for interventions and data management',
        allowedTiers: ['enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: false, // Start disabled
        metadata: {
            category: 'operations',
            priority: 'low',
            tags: ['bulk', 'operations', 'efficiency'],
        },
    },
    {
        key: 'performance_monitoring',
        name: 'Performance Monitoring',
        description: 'Enable performance monitoring and metrics collection',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'monitoring',
            priority: 'medium',
            tags: ['performance', 'monitoring', 'metrics'],
        },
    },
    {
        key: 'export_features',
        name: 'Data Export',
        description: 'Enable data export features for reports and analytics',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'export',
            priority: 'medium',
            tags: ['export', 'data', 'reports'],
        },
    },
    {
        key: 'notifications',
        name: 'Notifications',
        description: 'Enable notification features for alerts and reminders',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'notifications',
            priority: 'medium',
            tags: ['notifications', 'alerts', 'reminders'],
        },
    },
    {
        key: 'intervention_templates',
        name: 'Intervention Templates',
        description: 'Enable pre-built intervention templates for common scenarios',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: false, // Experimental
        metadata: {
            category: 'templates',
            priority: 'low',
            tags: ['templates', 'interventions', 'experimental'],
            experimental: true,
        },
    },
    {
        key: 'ai_recommendations',
        name: 'AI Recommendations',
        description: 'AI-powered intervention recommendations based on patient data',
        allowedTiers: ['enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: false, // Experimental
        metadata: {
            category: 'ai',
            priority: 'low',
            tags: ['ai', 'recommendations', 'experimental'],
            experimental: true,
        },
    },

    // ===========================
    // PATIENT ENGAGEMENT
    // ===========================
    {
        key: 'patient_portal',
        name: 'Patient Portal',
        description: 'Enable patient portal for self-service access',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'patient-engagement',
            priority: 'high',
            tags: ['portal', 'patients', 'engagement'],
        },
    },
    {
        key: 'appointment_scheduling',
        name: 'Appointment Scheduling',
        description: 'Enable appointment scheduling functionality',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'patient-engagement',
            priority: 'medium',
            tags: ['appointments', 'scheduling', 'patients'],
        },
    },
    {
        key: 'follow_up_management',
        name: 'Follow-up Management',
        description: 'Manage patient follow-ups and care continuity',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'patient-engagement',
            priority: 'medium',
            tags: ['follow-up', 'care-continuity', 'patients'],
        },
    },
    {
        key: 'reminder_system',
        name: 'Reminder System',
        description: 'Automated reminder system for medications and appointments',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'patient-engagement',
            priority: 'medium',
            tags: ['reminders', 'automation', 'patients'],
        },
    },

    // ===========================
    // INVENTORY & OPERATIONS
    // ===========================
    {
        key: 'inventory_management',
        name: 'Inventory Management',
        description: 'Track and manage pharmacy inventory',
        allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'operations',
            priority: 'high',
            tags: ['inventory', 'stock', 'management'],
        },
    },
    {
        key: 'purchase_orders',
        name: 'Purchase Orders',
        description: 'Create and manage purchase orders for inventory',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'operations',
            priority: 'medium',
            tags: ['orders', 'purchasing', 'inventory'],
        },
    },
    {
        key: 'supplier_management',
        name: 'Supplier Management',
        description: 'Manage supplier relationships and contacts',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'operations',
            priority: 'medium',
            tags: ['suppliers', 'vendors', 'management'],
        },
    },

    // ===========================
    // FINANCIAL FEATURES
    // ===========================
    {
        key: 'billing_invoicing',
        name: 'Billing & Invoicing',
        description: 'Generate and manage billing and invoices',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_team', 'pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'financial',
            priority: 'high',
            tags: ['billing', 'invoicing', 'finance'],
        },
    },
    {
        key: 'insurance_claims',
        name: 'Insurance Claims',
        description: 'Process and track insurance claims',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet'],
        isActive: true,
        metadata: {
            category: 'financial',
            priority: 'high',
            tags: ['insurance', 'claims', 'reimbursement'],
        },
    },
    {
        key: 'financial_reports',
        name: 'Financial Reports',
        description: 'Access detailed financial reports and analytics',
        allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacy_outlet', 'owner'],
        isActive: true,
        metadata: {
            category: 'financial',
            priority: 'high',
            tags: ['finance', 'reports', 'analytics'],
        },
    },
];

/**
 * Connect to MongoDB
 */
async function connectDB() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is required');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

/**
 * Sync all feature flags to database
 */
async function syncFeatureFlags() {
    try {
        console.log('🚀 Starting feature flags synchronization...\n');

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const flagData of ALL_FEATURE_FLAGS) {
            try {
                const existingFlag = await FeatureFlag.findOne({ key: flagData.key });

                if (existingFlag) {
                    if (preserveExisting && !force) {
                        console.log(`⏭️  Skipped (exists): ${flagData.key}`);
                        skipped++;
                    } else {
                        // Update existing flag
                        await FeatureFlag.findByIdAndUpdate(existingFlag._id, {
                            ...flagData,
                            updatedAt: new Date(),
                        });
                        console.log(`🔄 Updated: ${flagData.key}`);
                        updated++;
                    }
                } else {
                    // Create new flag
                    const newFlag = new FeatureFlag({
                        ...flagData,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                    await newFlag.save();
                    console.log(`✨ Created: ${flagData.key}`);
                    created++;
                }
            } catch (error) {
                console.error(`❌ Error processing ${flagData.key}:`, error);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Synchronization Summary:');
        console.log('='.repeat(60));
        console.log(`✨ Created:  ${created} new feature flags`);
        console.log(`🔄 Updated:  ${updated} existing feature flags`);
        console.log(`⏭️  Skipped:  ${skipped} feature flags`);
        console.log(`❌ Errors:   ${errors} feature flags`);
        console.log(`📝 Total:    ${ALL_FEATURE_FLAGS.length} feature flags processed`);
        console.log('='.repeat(60));

        if (errors > 0) {
            console.warn('\n⚠️  Some feature flags had errors. Please review the logs above.');
        } else {
            console.log('\n🎉 All feature flags synced successfully!');
        }

    } catch (error) {
        console.error('❌ Synchronization failed:', error);
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       Feature Flags Synchronization Script              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    if (preserveExisting) {
        console.log('ℹ️  Mode: PRESERVE EXISTING (only create new flags)');
    } else if (force) {
        console.log('ℹ️  Mode: FORCE UPDATE (update all existing flags)');
    } else {
        console.log('ℹ️  Mode: STANDARD (create new, update existing)');
    }
    console.log('');

    try {
        await connectDB();
        await syncFeatureFlags();

        console.log('\n✅ Script completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Refresh the Feature Management page in your browser');
        console.log('   2. All feature flags should now be visible in the UI');
        console.log('   3. You can now manage them directly from the admin panel\n');

    } catch (error) {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB\n');
    }
}

// Run the script
if (require.main === module) {
    main();
}

export default syncFeatureFlags;
