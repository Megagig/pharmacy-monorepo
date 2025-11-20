import React, { useState } from 'react';
import {
    Drawer,
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Divider,
    IconButton,
    Chip,
    Stack,
    useTheme,
    useMediaQuery,
    SelectChangeEvent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export interface FilterConfig {
    key: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'dateRange' | 'multiSelect';
    options?: Array<{ label: string; value: any }>;
    placeholder?: string;
    defaultValue?: any;
}

export interface FilterPanelProps {
    filters: FilterConfig[];
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
    onReset: () => void;
    onApply: () => void;
    open?: boolean;
    onClose?: () => void;
    activeFilterCount?: number;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
    filters,
    values,
    onChange,
    onReset,
    onApply,
    open = false,
    onClose,
    activeFilterCount = 0,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [localValues, setLocalValues] = useState(values);

    const handleChange = (key: string, value: any) => {
        const newValues = { ...localValues, [key]: value };
        setLocalValues(newValues);
        onChange(newValues);
    };

    const handleReset = () => {
        const resetValues: Record<string, any> = {};
        filters.forEach(filter => {
            resetValues[filter.key] = filter.defaultValue || '';
        });
        setLocalValues(resetValues);
        onChange(resetValues);
        onReset();
    };

    const handleApply = () => {
        onApply();
        if (onClose) onClose();
    };

    const renderFilter = (filter: FilterConfig) => {
        const value = localValues[filter.key] || filter.defaultValue || '';

        switch (filter.type) {
            case 'text':
                return (
                    <TextField
                        fullWidth
                        label={filter.label}
                        placeholder={filter.placeholder}
                        value={value}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                        size="small"
                    />
                );

            case 'select':
                return (
                    <FormControl fullWidth size="small">
                        <InputLabel>{filter.label}</InputLabel>
                        <Select
                            value={value}
                            label={filter.label}
                            onChange={(e: SelectChangeEvent) => handleChange(filter.key, e.target.value)}
                        >
                            <MenuItem value="">
                                <em>All</em>
                            </MenuItem>
                            {filter.options?.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );

            case 'multiSelect':
                return (
                    <FormControl fullWidth size="small">
                        <InputLabel>{filter.label}</InputLabel>
                        <Select
                            multiple
                            value={Array.isArray(value) ? value : []}
                            label={filter.label}
                            onChange={(e: SelectChangeEvent<any>) => handleChange(filter.key, e.target.value)}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as any[]).map((val) => {
                                        const option = filter.options?.find(o => o.value === val);
                                        return <Chip key={val} label={option?.label || val} size="small" />;
                                    })}
                                </Box>
                            )}
                        >
                            {filter.options?.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );

            case 'date':
                return (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                            label={filter.label}
                            value={value || null}
                            onChange={(newValue) => handleChange(filter.key, newValue)}
                            slotProps={{
                                textField: { fullWidth: true, size: 'small' }
                            }}
                        />
                    </LocalizationProvider>
                );

            case 'dateRange':
                return (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <Stack spacing={2}>
                            <DatePicker
                                label={`${filter.label} (From)`}
                                value={value?.start || null}
                                onChange={(newValue) =>
                                    handleChange(filter.key, { ...value, start: newValue })
                                }
                                slotProps={{
                                    textField: { fullWidth: true, size: 'small' }
                                }}
                            />
                            <DatePicker
                                label={`${filter.label} (To)`}
                                value={value?.end || null}
                                onChange={(newValue) =>
                                    handleChange(filter.key, { ...value, end: newValue })
                                }
                                slotProps={{
                                    textField: { fullWidth: true, size: 'small' }
                                }}
                            />
                        </Stack>
                    </LocalizationProvider>
                );

            default:
                return null;
        }
    };

    const drawerContent = (
        <Box sx={{ width: isMobile ? '100%' : 320, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <Box display="flex" alignItems="center" gap={1}>
                    <FilterListIcon />
                    <Typography variant="h6">Filters</Typography>
                    {activeFilterCount > 0 && (
                        <Chip label={activeFilterCount} size="small" color="primary" />
                    )}
                </Box>
                {onClose && (
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                )}
            </Box>

            {/* Filter fields */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                <Stack spacing={3}>
                    {filters.map((filter) => (
                        <Box key={filter.key}>{renderFilter(filter)}</Box>
                    ))}
                </Stack>
            </Box>

            <Divider />

            {/* Actions */}
            <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                <Button variant="outlined" onClick={handleReset} fullWidth>
                    Reset
                </Button>
                <Button variant="contained" onClick={handleApply} fullWidth>
                    Apply Filters
                </Button>
            </Box>
        </Box>
    );

    return (
        <Drawer
            anchor={isMobile ? 'bottom' : 'right'}
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    height: isMobile ? '80vh' : '100%',
                    borderTopLeftRadius: isMobile ? 16 : 0,
                    borderTopRightRadius: isMobile ? 16 : 0,
                },
            }}
        >
            {drawerContent}
        </Drawer>
    );
};

export default FilterPanel;
