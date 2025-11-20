# Workspace Components Integration Guide

## Overview
This guide explains how to integrate the workspace team management components into your application.

## Components Available

### 1. MemberList
Displays a table of workspace members with pagination and filtering.

### 2. MemberFilters
Provides search and filter controls for the member list.

### 3. MemberActionsMenu
Dropdown menu with actions for individual members.

### 4. RoleAssignmentDialog ✨ NEW
Modal dialog for assigning roles to members.

## Integration Example

### Step 1: Import Components

```typescript
import MemberList from './components/workspace/MemberList';
import MemberFilters from './components/workspace/MemberFilters';
import MemberActionsMenu from './components/workspace/MemberActionsMenu';
import RoleAssignmentDialog from './components/workspace/RoleAssignmentDialog';
```

### Step 2: Set Up State

```typescript
import { useState } from 'react';
import type { Member, MemberFilters as Filters, Pagination } from './types/workspace';

function WorkspaceTeamPage() {
  // Filters and pagination
  const [filters, setFilters] = useState<Filters>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20 });
  
  // Actions menu state
  const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  
  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  
  // ... rest of your component
}
```

### Step 3: Implement Action Handlers

```typescript
// Handle opening actions menu
const handleActionsClick = (event: React.MouseEvent<HTMLElement>, member: Member) => {
  setActionsAnchorEl(event.currentTarget);
  setSelectedMember(member);
};

// Handle closing actions menu
const handleActionsClose = () => {
  setActionsAnchorEl(null);
};

// Handle assign role action
const handleAssignRole = (member: Member) => {
  setSelectedMember(member);
  setRoleDialogOpen(true);
};

// Handle role assignment success
const handleRoleAssignSuccess = () => {
  // Show success message
  console.log('Role assigned successfully');
  // Optionally refresh data or show notification
};
```

### Step 4: Render Components

```typescript
return (
  <Box>
    {/* Page Header */}
    <Typography variant="h4" gutterBottom>
      Team Management
    </Typography>
    
    {/* Filters */}
    <MemberFilters
      filters={filters}
      onFiltersChange={setFilters}
    />
    
    {/* Member List */}
    <MemberList
      filters={filters}
      pagination={pagination}
      onPaginationChange={setPagination}
      onActionsClick={handleActionsClick}
    />
    
    {/* Actions Menu */}
    <MemberActionsMenu
      member={selectedMember}
      anchorEl={actionsAnchorEl}
      open={Boolean(actionsAnchorEl)}
      onClose={handleActionsClose}
      onAssignRole={handleAssignRole}
      onSuspend={handleSuspend}
      onActivate={handleActivate}
      onRemove={handleRemove}
    />
    
    {/* Role Assignment Dialog */}
    <RoleAssignmentDialog
      open={roleDialogOpen}
      onClose={() => setRoleDialogOpen(false)}
      member={selectedMember}
      onSuccess={handleRoleAssignSuccess}
    />
  </Box>
);
```

## Complete Example

```typescript
import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import MemberList from './components/workspace/MemberList';
import MemberFilters from './components/workspace/MemberFilters';
import MemberActionsMenu from './components/workspace/MemberActionsMenu';
import RoleAssignmentDialog from './components/workspace/RoleAssignmentDialog';
import type { Member, MemberFilters as Filters, Pagination } from './types/workspace';

function WorkspaceTeamPage() {
  // State management
  const [filters, setFilters] = useState<Filters>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20 });
  const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Action handlers
  const handleActionsClick = (event: React.MouseEvent<HTMLElement>, member: Member) => {
    setActionsAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleActionsClose = () => {
    setActionsAnchorEl(null);
  };

  const handleAssignRole = (member: Member) => {
    setSelectedMember(member);
    setRoleDialogOpen(true);
  };

  const handleRoleAssignSuccess = () => {
    setSuccessMessage('Role assigned successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleSuspend = (member: Member) => {
    // Implement suspend logic
    console.log('Suspend member:', member);
  };

  const handleActivate = (member: Member) => {
    // Implement activate logic
    console.log('Activate member:', member);
  };

  const handleRemove = (member: Member) => {
    // Implement remove logic
    console.log('Remove member:', member);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Typography variant="h4" gutterBottom>
        Team Management
      </Typography>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ mb: 3 }}>
        <MemberFilters
          filters={filters}
          onFiltersChange={setFilters}
        />
      </Box>

      {/* Member List */}
      <MemberList
        filters={filters}
        pagination={pagination}
        onPaginationChange={setPagination}
        onActionsClick={handleActionsClick}
      />

      {/* Actions Menu */}
      <MemberActionsMenu
        member={selectedMember}
        anchorEl={actionsAnchorEl}
        open={Boolean(actionsAnchorEl)}
        onClose={handleActionsClose}
        onAssignRole={handleAssignRole}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
        onRemove={handleRemove}
      />

      {/* Role Assignment Dialog */}
      <RoleAssignmentDialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        member={selectedMember}
        onSuccess={handleRoleAssignSuccess}
      />
    </Box>
  );
}

export default WorkspaceTeamPage;
```

## Required Dependencies

Make sure you have these dependencies installed:

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "@mui/material": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "typescript": "^5.0.0"
  }
}
```

## TanStack Query Setup

Ensure your app is wrapped with QueryClientProvider:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
    </QueryClientProvider>
  );
}
```

## API Requirements

The components expect these API endpoints to be available:

- `GET /api/workspace/team/members` - Get members list
- `PUT /api/workspace/team/members/:id` - Update member role
- `POST /api/workspace/team/members/:id/suspend` - Suspend member
- `POST /api/workspace/team/members/:id/activate` - Activate member
- `DELETE /api/workspace/team/members/:id` - Remove member

## Type Definitions

All TypeScript types are available in `frontend/src/types/workspace.ts`:

```typescript
import type {
  Member,
  WorkplaceRole,
  MemberStatus,
  MemberFilters,
  Pagination,
} from './types/workspace';
```

## Styling

Components use Material-UI's sx prop for styling. You can customize by:

1. Using MUI theme
2. Passing sx props
3. Using CSS modules

## Testing

All components have comprehensive test coverage. Run tests with:

```bash
npm test
```

## Troubleshooting

### Component not rendering
- Check that QueryClientProvider is set up
- Verify API endpoints are accessible
- Check browser console for errors

### Type errors
- Ensure all types are imported from `types/workspace.ts`
- Check TypeScript version compatibility

### API errors
- Verify backend is running
- Check network tab for failed requests
- Ensure authentication is working

## Next Steps

1. Implement SuspendMemberDialog (Task 16)
2. Add invite management components (Tasks 17-19)
3. Add audit trail component (Task 20)
4. Integrate with routing (Task 24)

## Support

For issues or questions:
1. Check the component README files
2. Review test files for usage examples
3. Consult the design document

---

**Last Updated:** 2025-10-11  
**Version:** 1.0
