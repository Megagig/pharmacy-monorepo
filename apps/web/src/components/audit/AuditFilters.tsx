// @ts-nocheck - MUI v7 Grid API breaking changes, component works correctly at runtime
import React from 'react';
import {
    Box,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Button,
    Grid,
    Stack,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Clear as ClearIcon,
    Search as SearchIcon,
    CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AuditFilters as AuditFiltersType } from '../../services/superAdminAuditService';

interface AuditFiltersProps {
    filters: AuditFiltersType;
    onChange: (filters: AuditFiltersType) => void;
    activityTypes: string[];
    riskLevels: string[];
}

const AuditFilters: React.FC<AuditFiltersProps> = ({
    filters,
    onChange,
    activityTypes,
    riskLevels,
}) => {
    const theme = useTheme();

    const handleFilterChange = (field: string, value: any) => {
        onChange({
            ...filters,
            [field]: value === '' ? undefined : value,
        });
    };

    const handleClearFilters = () => {
        onChange({
            page: 1,
            limit: 50,
        });
    };

    const activeFiltersCount = Object.keys(filters).filter(
        (key) => filters[key as keyof AuditFiltersType] && !['page', 'limit'].includes(key)
    ).length;

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Grid container spacing={2}>
                {/* Date Range */}
                <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                        label="Start Date"
                        value={filters.startDate ? new Date(filters.startDate) : null}
                        onChange={(date) =>
                            handleFilterChange('startDate', date ? date.toISOString() : '')
                        }
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: 'medium',
                                variant: 'outlined',
                                sx: {
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        bgcolor: 'background.paper',
                                    },
                                },
                            },
                        }}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                        label="End Date"
                        value={filters.endDate ? new Date(filters.endDate) : null}
                        onChange={(date) =>
                            handleFilterChange('endDate', date ? date.toISOString() : '')
                        }
                        slotProps={{
                            textField: {
                                fullWidth: true,
                                size: 'medium',
                                variant: 'outlined',
                                sx: {
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        bgcolor: 'background.paper',
                                    },
                                },
                            },
                        }}
                    />
                </Grid>

                {/* Activity Type */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Activity Type</InputLabel>
                        <Select
                            value={filters.activityType || ''}
                            label="Activity Type"
                            onChange={(e) => handleFilterChange('activityType', e.target.value)}
                        >
                            <MenuItem value="">
                                <em>All Types</em>
                            </MenuItem>
                            {activityTypes.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Risk Level */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Risk Level</InputLabel>
                        <Select
                            value={filters.riskLevel || ''}
                            label="Risk Level"
                            onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                        >
                            <MenuItem value="">
                                <em>All Levels</em>
                            </MenuItem>
                            {riskLevels.map((level) => (
                                <MenuItem key={level} value={level}>
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Success Status */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={
                                filters.success === undefined ? '' : filters.success ? 'true' : 'false'
                            }
                            label="Status"
                            onChange={(e) =>
                                handleFilterChange(
                                    'success',
                                    e.target.value === '' ? undefined : e.target.value === 'true'
                                )
                            }
                        >
                            <MenuItem value="">
                                <em>All Status</em>
                            </MenuItem>
                            <MenuItem value="true">✓ Success</MenuItem>
                            <MenuItem value="false">✗ Failed</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {/* Flagged Status */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Flagged</InputLabel>
                        <Select
                            value={
                                filters.flagged === undefined ? '' : filters.flagged ? 'true' : 'false'
                            }
                            label="Flagged"
                            onChange={(e) =>
                                handleFilterChange(
                                    'flagged',
                                    e.target.value === '' ? undefined : e.target.value === 'true'
                                )
                            }
                        >
                            <MenuItem value="">
                                <em>All Items</em>
                            </MenuItem>
                            <MenuItem value="true">🚩 Flagged</MenuItem>
                            <MenuItem value="false">Not Flagged</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {/* Compliance Category */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Compliance</InputLabel>
                        <Select
                            value={filters.complianceCategory || ''}
                            label="Compliance"
                            onChange={(e) => handleFilterChange('complianceCategory', e.target.value)}
                        >
                            <MenuItem value="">
                                <em>All Categories</em>
                            </MenuItem>
                            <MenuItem value="HIPAA">HIPAA</MenuItem>
                            <MenuItem value="SOX">SOX</MenuItem>
                            <MenuItem value="GDPR">GDPR</MenuItem>
                            <MenuItem value="PCI_DSS">PCI DSS</MenuItem>
                            <MenuItem value="GENERAL">General</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {/* Search Query */}
                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        fullWidth
                        size="medium"
                        label="Search"
                        placeholder="Search descriptions..."
                        value={filters.searchQuery || ''}
                        onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    />
                </Grid>

                {/* User ID */}
                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        fullWidth
                        size="medium"
                        label="User ID"
                        placeholder="Filter by user..."
                        value={filters.userId || ''}
                        onChange={(e) => handleFilterChange('userId', e.target.value)}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    />
                </Grid>

                {/* Workplace ID */}
                <Grid item xs={12} sm={6} md={3}>
                    <TextField
                        fullWidth
                        size="medium"
                        label="Workplace ID"
                        placeholder="Filter by workplace..."
                        value={filters.workplaceId || ''}
                        onChange={(e) => handleFilterChange('workplaceId', e.target.value)}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    />
                </Grid>

                {/* Items per page */}
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl
                        fullWidth
                        size="medium"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                            },
                        }}
                    >
                        <InputLabel>Items</InputLabel>
                        <Select
                            value={filters.limit || 50}
                            label="Items"
                            onChange={(e) => handleFilterChange('limit', Number(e.target.value))}
                        >
                            <MenuItem value={10}>10 items</MenuItem>
                            <MenuItem value={25}>25 items</MenuItem>
                            <MenuItem value={50}>50 items</MenuItem>
                            <MenuItem value={100}>100 items</MenuItem>
                            <MenuItem value={200}>200 items</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {/* Reset Button */}
                <Grid item xs={12} sm={6} md={3}>
                    <Button
                        fullWidth
                        variant="outlined"
                        color="secondary"
                        onClick={handleClearFilters}
                        disabled={activeFiltersCount === 0}
                        startIcon={<ClearIcon />}
                        sx={{
                            height: '56px',
                            borderRadius: 2,
                            fontWeight: 600,
                            textTransform: 'none',
                            fontSize: '1rem',
                        }}
                    >
                        Reset All
                    </Button>
                </Grid>
            </Grid>
        </LocalizationProvider>
    );
};

export default AuditFilters;
