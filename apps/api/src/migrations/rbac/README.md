# RBAC Migration System

This directory contains a comprehensive migration system for converting from static to dynamic RBAC (Role-Based Access Control) in the pharma-care-saas application.

## Overview

The migration system provides a complete solution for transitioning from hardcoded permission matrices to a flexible, database-driven RBAC system while maintaining backward compatibility and zero downtime.

## Components

### 1. System Role and Permission Seeding (`001-seed-system-roles-permissions.ts`)

**Purpose**: Creates the foundation for dynamic RBAC by converting static permissions to database records.

**Features**:

- Converts static permission matrix to Permission documents
- Creates system roles with proper hierarchy
- Creates workplace roles for workspace-specific permissions
- Establishes role-permission mappings
- Validates data integrity during seeding
- Handles duplicate seeding gracefully

**Usage**:

```bash
# Run seeding
node 001-seed-system-roles-permissions.ts

# Or use the orchestrator
node migration-orchestrator.js migrate
```

### 2. User Role Migration (`002-migrate-user-roles.ts`)

**Purpose**: Migrates existing user role assignments from static fields to dynamic role assignments.

**Features**:

- Migrates `user.role` to dynamic system role assignments
- Migrates `user.workplaceRole` to dynamic workplace role assignments
- Converts `user.permissions` array to direct permissions
- Maintains audit trail with migration context
- Provides rollback capabilities
- Handles migration errors gracefully

**Usage**:

```bash
# Run user migration
node 002-migrate-user-roles.ts

# Rollback user migration
node 002-migrate-user-roles.ts rollback
```

### 3. Migration Validation and Rollback (`003-migration-validation-rollback.ts`)

**Purpose**: Provides comprehensive validation and rollback capabilities for the migration process.

**Features**:

- Data integrity validation
- Permission consistency checking
- Role hierarchy validation
- Performance validation
- Security validation
- Complete rollback procedures
- Migration readiness assessment

**Usage**:

```bash
# Validate migration
node 003-migration-validation-rollback.ts

# Rollback entire migration
node 003-migration-validation-rollback.ts rollback
```

### 4. Migration Orchestrator (`migration-orchestrator.ts`)

**Purpose**: Coordinates the complete migration process with configuration options and monitoring.

**Features**:

- Complete migration workflow orchestration
- Gradual rollout support with percentage-based deployment
- Feature flag integration
- Automatic rollback on failure
- Migration status monitoring
- Dry-run mode for testing

**Usage**:

```bash
# Full migration
node migration-orchestrator.js migrate

# Dry run
node migration-orchestrator.js migrate --dry-run

# Gradual rollout (50% of users)
node migration-orchestrator.js migrate --rollout=50

# Check status
node migration-orchestrator.js status

# Update rollout percentage
node migration-orchestrator.js rollout 75

# Complete migration (100% rollout)
node migration-orchestrator.js complete

# Rollback
node migration-orchestrator.js rollback
```

### 5. Backward Compatibility Service (`../services/BackwardCompatibilityService.ts`)

**Purpose**: Provides seamless transition between static and dynamic RBAC systems.

**Features**:

- Intelligent method selection (dynamic vs legacy)
- Automatic fallback to legacy system
- Feature flag-based configuration
- Performance metrics collection
- Deprecation warnings
- Permission consistency validation

## Migration Phases

The migration system supports four distinct phases:

1. **Preparation**: System setup and validation
2. **Migration**: Active migration of users and data
3. **Validation**: Testing and consistency checking
4. **Cleanup**: Finalization and legacy system removal

## Feature Flags

The system uses feature flags for safe deployment:

- `rbac_enable_dynamic`: Enable/disable dynamic RBAC
- `rbac_enable_legacy_fallback`: Enable fallback to legacy system
- `rbac_enable_deprecation_warnings`: Show deprecation warnings
- `rbac_migration_phase`: Current migration phase
- `rbac_rollout_percentage`: Percentage of users using dynamic RBAC

## Safety Features

### Backward Compatibility

- Legacy permission checks continue to work during migration
- Automatic fallback when dynamic checks fail
- Gradual rollout prevents system-wide issues

### Validation

- Comprehensive data integrity checks
- Permission consistency validation
- Role hierarchy validation
- Performance impact assessment

### Rollback

- Complete rollback procedures for all migration steps
- User-specific rollback capabilities
- Automatic rollback on critical failures
- Data backup and restoration

## Testing

Comprehensive test suite included in `__tests__/migrations/rbac-migration.test.ts`:

- Unit tests for all migration components
- Integration tests for complete workflows
- Error handling and edge case testing
- Performance and concurrency testing

**Run tests**:

```bash
npm test -- --testPathPattern=rbac-migration
```

## Monitoring and Metrics

The system provides detailed metrics and monitoring:

- Migration progress tracking
- Permission check performance metrics
- Error rates and fallback usage
- User adoption statistics
- System health indicators

## Best Practices

### Before Migration

1. Create full database backup
2. Run validation in dry-run mode
3. Test with small user subset
4. Verify all feature flags are configured

### During Migration

1. Monitor system performance
2. Watch error rates and logs
3. Be prepared to rollback if issues arise
4. Communicate with users about potential changes

### After Migration

1. Validate permission consistency
2. Monitor system performance
3. Gradually increase rollout percentage
4. Plan legacy system cleanup

## Troubleshooting

### Common Issues

**Migration fails with validation errors**:

- Check data integrity
- Verify role hierarchy
- Ensure all required roles exist

**Permission inconsistencies**:

- Run consistency validation
- Check role-permission mappings
- Verify user role assignments

**Performance issues**:

- Check permission cache configuration
- Monitor database query performance
- Consider increasing cache TTL

**Rollback failures**:

- Ensure database backup exists
- Check for data dependencies
- Run rollback in stages

### Support

For issues or questions:

1. Check the logs for detailed error messages
2. Run validation to identify specific problems
3. Use dry-run mode to test changes safely
4. Consult the test suite for usage examples

## Security Considerations

- All migration operations are audited
- Permission changes are logged with full context
- Super admin permissions are preserved during migration
- Sensitive operations require explicit confirmation
- Rollback procedures maintain security boundaries

## Performance Impact

The migration system is designed for minimal performance impact:

- Efficient database queries with proper indexing
- Permission caching to reduce database load
- Gradual rollout to prevent system overload
- Background processing for non-critical operations

## Future Enhancements

Planned improvements:

- Real-time migration monitoring dashboard
- Advanced permission analytics
- Automated permission optimization
- Integration with external identity providers
- Enhanced audit reporting
