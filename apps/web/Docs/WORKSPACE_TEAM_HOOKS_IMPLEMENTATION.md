# Workspace Team Management - TanStack Query Hooks Implementation

## Overview

This document summarizes the implementation of TanStack Query hooks for the Workspace Team Management system (Task 9).

## Implementation Date

October 10, 2025

## Files Created

### 1. Query Hooks File
**Location**: `frontend/src/queries/useWorkspaceTeam.ts`

This file contains all TanStack Query hooks for workspace team management, organized into the following categories:

#### Member Management Hooks
- `useWorkspaceMembers(filters, pagination)` - Fetch workspace members with filters and pagination
- `useUpdateMemberRole()` - Update a member's role
- `useRemoveMember()` - Remove a member from the workspace
- `useSuspendMember()` - Suspend a member
- `useActivateMember()` - Activate a suspended member

#### Invite Management Hooks
- `useWorkspaceInvites(filters)` - Fetch workspace invites with optional filters
- `useGenerateInvite()` - Generate a new invite link
- `useRevokeInvite()` - Revoke an invite link

#### Pending Member Approval Hooks
- `usePendingMembers()` - Fetch pending member approvals
- `useApproveMember()` - Approve a pending member
- `useRejectMember()` - Reject a pending member

#### Audit Trail Hooks
- `useAuditLogs(filters, pagination)` - Fetch audit logs with filters and pagination
- `useExportAuditLogs()` - Export audit logs as CSV

#### Statistics Hook
- `useWorkspaceStats()` - Fetch workspace statistics (refetches every minute)

### 2. Test File
**Location**: `frontend/src/queries/__tests__/useWorkspaceTeam.test.tsx`

Comprehensive test suite with 22 tests covering:
- All query hooks with successful responses
- Error handling scenarios
- Filter and pagination parameters
- Cache invalidation on mutations

### 3. Index Export
**Location**: `frontend/src/queries/index.ts`

Added export for `useWorkspaceTeam` hooks to make them available throughout the application.

## Key Features

### Query Keys Factory
Implemented a structured query keys factory pattern:
```typescript
export const workspaceTeamKeys = {
  all: ['workspace', 'team'],
  members: () => [...workspaceTeamKeys.all, 'members'],
  membersList: (filters, pagination) => [...workspaceTeamKeys.members(), 'list', { filters, pagination }],
  invites: () => [...workspaceTeamKeys.all, 'invites'],
  // ... and more
};
```

This pattern enables:
- Precise cache invalidation
- Easy query refetching
- Hierarchical query organization

### Automatic Cache Invalidation
All mutation hooks automatically invalidate related queries:

**Example**: When updating a member's role:
- Invalidates `members` queries (to show updated role)
- Invalidates `audit` queries (role changes are logged)
- Invalidates `stats` queries (may affect active member count)

### Optimized Refetching
- `useWorkspaceStats()` automatically refetches every 60 seconds for real-time statistics
- Other queries use default TanStack Query caching behavior

## Integration with Existing Service

All hooks use the `workspaceTeamService` created in Task 8:
- Proper error handling from service layer
- Type-safe request/response interfaces
- Consistent API patterns

## Testing

### Test Coverage
- **22 tests** covering all hooks
- **100% pass rate**
- Tests include:
  - Successful data fetching
  - Error handling
  - Filter and pagination parameters
  - Mutation success callbacks
  - Cache invalidation

### Running Tests
```bash
npm test -- useWorkspaceTeam.test.tsx --run
```

## Usage Examples

### Fetching Members with Filters
```typescript
const { data, isLoading, error } = useWorkspaceMembers(
  { search: 'john', role: 'Pharmacist', status: 'active' },
  { page: 1, limit: 20 }
);
```

### Updating Member Role
```typescript
const updateRole = useUpdateMemberRole();

updateRole.mutate({
  memberId: 'member123',
  data: {
    workplaceRole: 'Admin',
    reason: 'Promotion'
  }
});
```

### Generating Invite
```typescript
const generateInvite = useGenerateInvite();

generateInvite.mutate({
  email: 'newuser@example.com',
  workplaceRole: 'Pharmacist',
  expiresInDays: 7,
  maxUses: 1,
  requiresApproval: true,
  personalMessage: 'Welcome to our team!'
});
```

### Approving Pending Member
```typescript
const approveMember = useApproveMember();

approveMember.mutate({
  memberId: 'member123',
  data: { workplaceRole: 'Pharmacist' } // Optional role override
});
```

## Design Patterns

### 1. Query Keys Factory
Centralized query key management for consistent cache operations.

### 2. Automatic Cache Invalidation
Mutations automatically invalidate related queries to keep UI in sync.

### 3. Type Safety
Full TypeScript support with imported types from `workspace.ts`.

### 4. Error Handling
Errors from service layer are properly propagated to components.

### 5. Optimistic Updates
Ready for optimistic updates (can be added in future iterations).

## Requirements Satisfied

✅ **REQ-009**: User Interface
- Created intuitive hooks for all team management operations
- Proper loading states and error handling
- Type-safe interfaces

## Next Steps

The following tasks can now proceed:
- **Task 10**: Create TypeScript interfaces and types (already completed in Task 8)
- **Task 11**: Create main WorkspaceTeam page component
- **Task 12**: Create MemberList component
- And subsequent UI component tasks...

## Notes

- All hooks follow existing patterns from `useSaasSettings.ts` and `featureFlagQueries.ts`
- Query keys are structured hierarchically for efficient cache management
- Mutations include proper cache invalidation to keep data fresh
- Tests use the same patterns as existing query tests in the codebase
- The hooks are ready to be used in React components

## Verification Checklist

- [x] All hooks implemented as specified in task details
- [x] Query keys factory created
- [x] Cache invalidation configured for all mutations
- [x] Comprehensive tests written (22 tests)
- [x] All tests passing
- [x] TypeScript compilation successful
- [x] Exported from queries/index.ts
- [x] Follows existing codebase patterns
- [x] Documentation complete

---

**Status**: ✅ Complete  
**Test Results**: 22/22 passing  
**TypeScript**: No errors  
**Ready for**: Task 11 (Create main WorkspaceTeam page component)
