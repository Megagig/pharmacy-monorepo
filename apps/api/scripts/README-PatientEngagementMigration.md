# Patient Engagement & Follow-up Management Migration Scripts

This directory contains comprehensive migration scripts for the Patient Engagement & Follow-up Management module. These scripts handle the migration of existing MTRFollowUp records to the new unified appointment system and add necessary fields to existing models.

## 📋 Overview

The Patient Engagement module introduces a unified appointment system that integrates with existing MTR follow-ups, patient records, and visits. The migration process ensures:

- **Zero Data Loss**: All existing MTRFollowUp records are preserved and linked to new Appointment records
- **Backward Compatibility**: Existing workflows continue to function during and after migration
- **Data Integrity**: Bidirectional relationships are maintained between old and new models
- **Performance**: Proper indexes are created for optimal query performance

## 🗂️ Migration Scripts

### 1. Main Migration Script
**File**: `migratePatientEngagementModule.ts`

**Purpose**: Primary migration script that handles all migration tasks in sequence.

**What it does**:
- Migrates existing MTRFollowUp records to Appointment model
- Adds `appointmentPreferences` field to Patient records
- Adds `appointmentId` field to Visit records  
- Creates indexes for new models
- Verifies migration integrity

**Usage**:
```bash
npx ts-node backend/scripts/migratePatientEngagementModule.ts
```

### 2. Rollback Script
**File**: `rollbackPatientEngagementMigration.ts`

**Purpose**: Safely rolls back the migration if issues are discovered.

**What it does**:
- Removes migrated Appointment records
- Clears `appointmentId` from MTRFollowUp records
- Removes `appointmentPreferences` from Patient records
- Removes `appointmentId` from Visit records
- Drops indexes for new models
- Optionally drops new model collections

**Usage**:
```bash
npx ts-node backend/scripts/rollbackPatientEngagementMigration.ts
```

⚠️ **WARNING**: This script permanently deletes migrated data. Use with extreme caution!

### 3. Test Script
**File**: `testPatientEngagementMigration.ts`

**Purpose**: Tests the migration process on staging data before production deployment.

**What it does**:
- Creates test data (patients, MTRFollowUps, visits)
- Runs migration on test data
- Verifies migration results
- Cleans up test data

**Usage**:
```bash
npx ts-node backend/scripts/testPatientEngagementMigration.ts
```

### 4. Verification Script
**File**: `verifyPatientEngagementMigration.ts`

**Purpose**: Comprehensive verification of migration integrity and performance.

**What it does**:
- Checks data consistency between old and new models
- Validates bidirectional relationships
- Verifies index creation and query performance
- Generates detailed migration report
- Provides recommendations for optimization

**Usage**:
```bash
npx ts-node backend/scripts/verifyPatientEngagementMigration.ts
```

## 🚀 Migration Process

### Pre-Migration Checklist

1. **Backup Database**:
   ```bash
   mongodump --uri="mongodb://localhost:27017/pharmacycopilot" --out=./backup-$(date +%Y%m%d)
   ```

2. **Ensure New Models Exist**:
   - `backend/src/models/Appointment.ts`
   - `backend/src/models/FollowUpTask.ts`
   - `backend/src/models/ReminderTemplate.ts`
   - `backend/src/models/PharmacistSchedule.ts`

3. **Test Environment Setup**:
   ```bash
   # Run tests first
   npx ts-node backend/scripts/testPatientEngagementMigration.ts
   ```

### Step-by-Step Migration

#### Step 1: Test Migration (Staging)
```bash
# Test on staging environment
NODE_ENV=staging npx ts-node backend/scripts/testPatientEngagementMigration.ts
```

#### Step 2: Run Migration (Production)
```bash
# Run main migration
NODE_ENV=production npx ts-node backend/scripts/migratePatientEngagementModule.ts
```

#### Step 3: Verify Migration
```bash
# Verify migration integrity
npx ts-node backend/scripts/verifyPatientEngagementMigration.ts
```

#### Step 4: Monitor and Validate
- Check application logs for errors
- Test key workflows (appointment creation, MTR follow-ups)
- Monitor database performance

### Rollback Process (If Needed)

```bash
# If issues are found, rollback immediately
npx ts-node backend/scripts/rollbackPatientEngagementMigration.ts
```

## 📊 Migration Details

### Data Transformations

#### MTRFollowUp → Appointment Mapping

| MTRFollowUp Field | Appointment Field | Transformation |
|-------------------|-------------------|----------------|
| `type` | `type` | Mapped via `mapMTRTypeToAppointmentType()` |
| `status` | `status` | Mapped via `mapMTRStatusToAppointmentStatus()` |
| `scheduledDate` | `scheduledDate` + `scheduledTime` | Date split into date and time components |
| `estimatedDuration` | `duration` | Direct copy |
| `description` | `title` + `description` | Title prefixed with "MTR Follow-up:" |
| `outcome` | `outcome` | Structure preserved with additional fields |
| `reminders` | `reminders` | Structure enhanced with delivery status |

#### Patient Model Extensions

```typescript
// Added to existing Patient model
appointmentPreferences?: {
  preferredDays: number[]; // 0-6 (Sunday-Saturday)
  preferredTimeSlots: Array<{ start: string; end: string }>;
  preferredPharmacist?: mongoose.Types.ObjectId;
  reminderPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  language: string; // 'en', 'yo', 'ig', 'ha'
  timezone: string; // 'Africa/Lagos'
};
lastAppointmentDate?: Date;
```

#### Visit Model Extensions

```typescript
// Added to existing Visit model
appointmentId?: mongoose.Types.ObjectId; // Link to appointment if created from one
```

### Database Indexes Created

#### Appointment Model Indexes
```javascript
{ workplaceId: 1, scheduledDate: 1, status: 1 }
{ workplaceId: 1, patientId: 1, scheduledDate: -1 }
{ workplaceId: 1, assignedTo: 1, scheduledDate: 1 }
{ workplaceId: 1, type: 1, status: 1 }
{ recurringSeriesId: 1, scheduledDate: 1 }
{ status: 1, scheduledDate: 1 }
{ 'reminders.scheduledFor': 1, 'reminders.sent': 1 }
```

#### FollowUpTask Model Indexes
```javascript
{ workplaceId: 1, status: 1, dueDate: 1 }
{ workplaceId: 1, patientId: 1, status: 1 }
{ workplaceId: 1, assignedTo: 1, status: 1, priority: -1 }
{ status: 1, dueDate: 1 }
```

## 🔍 Verification Checks

The verification script performs comprehensive checks:

### Data Integrity Checks
- **Bidirectional Links**: Ensures MTRFollowUp ↔ Appointment links are valid
- **Data Consistency**: Verifies patient, workplace, and pharmacist IDs match
- **Field Mapping**: Confirms proper transformation of data fields
- **Referential Integrity**: Checks that all referenced records exist

### Performance Checks
- **Index Verification**: Confirms all required indexes are created
- **Query Performance**: Measures response times for key queries
- **Collection Statistics**: Analyzes document counts and sizes

### Report Generation
- **JSON Report**: Detailed machine-readable report saved to `backend/reports/`
- **Console Summary**: Human-readable summary with recommendations
- **Issue Categorization**: Errors, warnings, and informational messages

## 🚨 Troubleshooting

### Common Issues

#### 1. "New models not found" Error
**Cause**: New model files haven't been created yet.
**Solution**: Ensure all new model files exist before running migration.

#### 2. Bidirectional Link Issues
**Cause**: Inconsistent references between MTRFollowUp and Appointment records.
**Solution**: Run verification script to identify specific issues, then fix manually or re-run migration.

#### 3. Performance Issues
**Cause**: Missing indexes or large dataset.
**Solution**: Ensure indexes are created and consider running migration in batches for very large datasets.

#### 4. Memory Issues
**Cause**: Processing too many records at once.
**Solution**: Modify migration script to process records in smaller batches.

### Recovery Procedures

#### Partial Migration Failure
1. Run verification script to assess damage
2. Fix specific issues identified
3. Re-run migration (it will skip already migrated records)

#### Complete Migration Failure
1. Run rollback script immediately
2. Investigate root cause
3. Fix issues and re-test on staging
4. Re-run migration

#### Data Corruption
1. Stop application immediately
2. Restore from backup
3. Investigate and fix migration script
4. Re-test thoroughly before re-attempting

## 📈 Performance Considerations

### Large Dataset Optimization

For databases with >10,000 MTRFollowUp records:

1. **Batch Processing**: Modify migration to process records in batches of 1,000
2. **Index Creation**: Create indexes before migration for better performance
3. **Memory Management**: Monitor memory usage during migration
4. **Parallel Processing**: Consider running migration during low-traffic periods

### Query Optimization

Post-migration query performance tips:

1. **Use Compound Indexes**: Leverage multi-field indexes for complex queries
2. **Projection**: Only select needed fields in queries
3. **Pagination**: Implement proper pagination for large result sets
4. **Caching**: Consider caching frequently accessed appointment data

## 🔒 Security Considerations

### Data Protection
- **Backup First**: Always backup before migration
- **Access Control**: Ensure migration scripts run with appropriate permissions
- **Audit Trail**: All migration actions are logged with timestamps and user context
- **Rollback Capability**: Always have a tested rollback procedure

### HIPAA Compliance
- **Data Integrity**: Migration preserves all audit trails and patient data
- **Access Logging**: All migration activities are logged
- **Encryption**: Ensure database connections use encryption
- **Minimal Exposure**: Migration scripts don't expose sensitive data in logs

## 📝 Maintenance

### Regular Checks
- **Monthly**: Run verification script to ensure data integrity
- **Quarterly**: Review migration logs and performance metrics
- **Annually**: Archive old migration reports and logs

### Updates
- **Version Control**: Keep migration scripts in version control
- **Documentation**: Update this README when scripts are modified
- **Testing**: Re-test migration scripts when database schema changes

## 📞 Support

For issues with migration scripts:

1. **Check Logs**: Review migration output and error messages
2. **Run Verification**: Use verification script to diagnose issues
3. **Consult Documentation**: Review this README and inline code comments
4. **Backup and Rollback**: If in doubt, rollback and seek assistance

## 📚 Related Documentation

- [Patient Engagement Module Design](../../.kiro/specs/patient-engagement-followup/design.md)
- [Requirements Document](../../.kiro/specs/patient-engagement-followup/requirements.md)
- [Implementation Tasks](../../.kiro/specs/patient-engagement-followup/tasks.md)
- [API Documentation](../../docs/PATIENT_ENGAGEMENT_API.md)

---

**Last Updated**: 2025-10-27  
**Version**: 1.0  
**Compatibility**: MongoDB 4.4+, Node.js 16+, TypeScript 4.5+