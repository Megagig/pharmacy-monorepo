/**
 * MemberFilters Component
 * Provides search and filter controls for the member list
 * Includes debounced search, role filter, status filter, and clear filters functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  InputAdornment,
  Paper,
  Grid,
  SelectChangeEvent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useDebounce } from '../../hooks/useDebounce';
import type { MemberFilters, WorkplaceRole, MemberStatus } from '../../types/workspace';

interface MemberFiltersProps {
  filters: MemberFilters;
  onFiltersChange: (filters: MemberFilters) => void;
}

// Available workplace roles for filtering
const WORKPLACE_ROLES: WorkplaceRole[] = [
  'Owner',
  'Staff',
  'Pharmacist',
  'Cashier',
  'Technician',
  'Assistant',
];

// Available member statuses for filtering
const MEMBER_STATUSES: MemberStatus[] = [
  'active',
  'pending',
  'suspended',
  'inactive',
];

const MemberFilters: React.FC<MemberFiltersProps> = ({ filters, onFiltersChange }) => {
  // Local state for search input (before debouncing)
  const [searchInput, setSearchInput] = useState<string>(filters.search || '');
  
  // Debounced search value (300ms delay)
  const debouncedSearch = useDebounce<string>(searchInput, 300);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  }, []);

  /**
   * Handle role filter change
   */
  const handleRoleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      onFiltersChange({
        ...filters,
        role: value ? (value as WorkplaceRole) : undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Handle status filter change
   */
  const handleStatusChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      onFiltersChange({
        ...filters,
        status: value ? (value as MemberStatus) : undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    onFiltersChange({});
  }, [onFiltersChange]);

  /**
   * Update filters when debounced search value changes
   */
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({
        ...filters,
        search: debouncedSearch || undefined,
      });
    }
  }, [debouncedSearch]); // Intentionally omitting filters and onFiltersChange to avoid loops

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Boolean(
    searchInput || filters.role || filters.status
  );

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Search Input */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={() => setSearchInput('')}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </Button>
                </InputAdornment>
              ),
            }}
            aria-label="Search members"
          />
        </Grid>

        {/* Role Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="role-filter-label">Role</InputLabel>
            <Select
              labelId="role-filter-label"
              id="role-filter"
              value={filters.role || ''}
              label="Role"
              onChange={handleRoleChange}
              aria-label="Filter by role"
            >
              <MenuItem value="">
                <em>All Roles</em>
              </MenuItem>
              {WORKPLACE_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Status Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={filters.status || ''}
              label="Status"
              onChange={handleStatusChange}
              aria-label="Filter by status"
            >
              <MenuItem value="">
                <em>All Statuses</em>
              </MenuItem>
              {MEMBER_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Clear Filters Button */}
        <Grid item xs={12} md={2}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            aria-label="Clear all filters"
          >
            Clear Filters
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default MemberFilters;
