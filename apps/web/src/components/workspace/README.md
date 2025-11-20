# Workspace Team Management Components

This directory contains components for managing workspace team members.

## Components

### MemberActionsMenu

A dropdown menu component that provides actions for managing individual workspace members.

**Features:**
- Conditional action visibility based on member status
- Assign role action (for active members)
- Suspend action (for active members)
- Activate action (for suspended members)
- Remove member action (for active/suspended members)
- Loading state support
- Accessibility features with proper ARIA labels

**Usage:**
```tsx
import MemberActionsMenu from './MemberActionsMenu';

<MemberActionsMenu
  member={selectedMember}
  anchorEl={anchorElement}
  open={isOpen}
  onClose={handleClose}
  onAssignRole={handleAssignRole}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
  onRemove={handleRemove}
  loading={isLoading}
/>
```

**Props:**
- `member` (Member): The member for which actions are displayed
- `anchorEl` (HTMLElement | null): Anchor element for the menu positioning
- `open` (boolean): Whether the menu is open
- `onClose` (() => void): Callback when menu is closed
- `onAssignRole` ((member: Member) => void): Optional callback for assign role action
- `onSuspend` ((member: Member) => void): Optional callback for suspend action
- `onActivate` ((member: Member) => void): Optional callback for activate action
- `onRemove` ((member: Member) => void): Optional callback for remove member action
- `loading` (boolean): Optional loading state flag

**Action Visibility Rules:**
- **Assign Role**: Shown for active members only
- **Suspend**: Shown for active members only
- **Activate**: Shown for suspended members only
- **Remove**: Shown for active and suspended members (not pending)

### MemberList

Displays a table of workspace members with sorting, filtering, and pagination. Integrates with MemberActionsMenu for member actions.

**Features:**
- Sortable columns
- Pagination
- Loading skeletons
- Error handling
- Empty state
- Member avatars with initials
- Status and role badges
- Integrated actions menu

**Usage:**
```tsx
import MemberList from './MemberList';

<MemberList
  filters={{ search: 'John', role: 'Pharmacist', status: 'active' }}
  onAssignRole={handleAssignRole}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
  onRemove={handleRemove}
/>
```

### MemberFilters

Provides search and filter controls for the member list.

**Features:**
- Search by name or email (debounced)
- Filter by role
- Filter by status
- Clear filters button

### WorkspaceTeam (Page)

Main page component that orchestrates all workspace team management features.

**Features:**
- Tabbed interface (Members, Pending, Invites, Audit)
- Statistics cards
- Integration with all sub-components

## Testing

All components have comprehensive test coverage:

```bash
# Run all workspace component tests
npm run test -- src/components/workspace/__tests__

# Run specific component tests
npm run test -- src/components/workspace/__tests__/MemberActionsMenu.test.tsx
npm run test -- src/components/workspace/__tests__/MemberList.test.tsx
```

## Requirements Covered

- **REQ-002**: Role Assignment - MemberActionsMenu provides assign role action
- **REQ-004**: Member Suspension - MemberActionsMenu provides suspend/activate actions
- **REQ-009**: User Interface - All components follow Material-UI design patterns

## Future Enhancements

- Bulk actions (select multiple members)
- Export member list to CSV
- Advanced filtering options
- Member activity timeline
