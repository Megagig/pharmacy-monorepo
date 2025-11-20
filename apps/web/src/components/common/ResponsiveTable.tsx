import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useResponsive } from '../../hooks/useResponsive';

// Generic type for table row data
type TableRowData = Record<string, unknown>;

export interface ResponsiveTableColumn<T = TableRowData> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  hideOnMobile?: boolean;
  priority?: number; // Lower numbers have higher priority on mobile
}

export interface ResponsiveTableAction<T = TableRowData> {
  label: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  onClick: (row: T) => void;
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
}

interface ResponsiveTableProps<T = TableRowData> {
  data: T[];
  columns: ResponsiveTableColumn<T>[];
  actions?: ResponsiveTableAction<T>[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  cardTitle?: (row: T) => string;
  cardSubtitle?: (row: T) => string;
  cardChips?: (
    row: T
  ) => Array<{
    label: string;
    color?:
      | 'default'
      | 'primary'
      | 'secondary'
      | 'error'
      | 'info'
      | 'success'
      | 'warning';
  }>;
}

export const ResponsiveTable = <T extends TableRowData = TableRowData>({
  data,
  columns,
  actions = [],
  loading = false,
  emptyMessage = 'No data available',
  keyExtractor = (_, index) => index.toString(),
  onRowClick,
  cardTitle,
  cardSubtitle,
  cardChips,
}: ResponsiveTableProps<T>) => {
  const { isMobile } = useResponsive();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = React.useState<T | null>(null);

  const handleActionMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    row: T
  ) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleActionMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleActionClick = (action: ResponsiveTableAction<T>) => {
    if (selectedRow) {
      action.onClick(selectedRow);
      handleActionMenuClose();
    }
  };

  // Filter and sort columns for mobile display
  const getMobileColumns = () => {
    return columns
      .filter((col) => !col.hideOnMobile)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))
      .slice(0, 3); // Show only top 3 columns on mobile
  };

  const getCellValue = (
    row: T,
    column: ResponsiveTableColumn<T>,
    index: number
  ) => {
    const value = (row as Record<string, unknown>)[column.key];
    return column.render ? column.render(value, row, index) : value;
  };

  const getVisibleActions = (row: T) => {
    return actions.filter((action) => !action.hidden || !action.hidden(row));
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  // Mobile card layout
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.map((row, index) => {
          const visibleActions = getVisibleActions(row);
          const mobileColumns = getMobileColumns();

          return (
            <Card
              key={keyExtractor(row, index)}
              onClick={() => onRowClick && onRowClick(row)}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? { elevation: 3 } : {},
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    {/* Card title and subtitle */}
                    {cardTitle && (
                      <Typography
                        variant="subtitle1"
                        component="div"
                        sx={{ fontWeight: 600 }}
                      >
                        {cardTitle(row)}
                      </Typography>
                    )}
                    {cardSubtitle && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {cardSubtitle(row)}
                      </Typography>
                    )}

                    {/* Mobile columns */}
                    <Stack spacing={0.5}>
                      {mobileColumns.map((column) => {
                        const value = getCellValue(row, column, index);
                        if (
                          value === undefined ||
                          value === null ||
                          value === ''
                        )
                          return null;

                        return (
                          <Box
                            key={column.key}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ minWidth: 60 }}
                            >
                              {column.label}:
                            </Typography>
                            <Typography variant="body2">
                              {value as React.ReactNode}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>

                    {/* Card chips */}
                    {cardChips && (
                      <Box
                        sx={{
                          mt: 1,
                          display: 'flex',
                          gap: 0.5,
                          flexWrap: 'wrap',
                        }}
                      >
                        {cardChips(row).map((chip, chipIndex) => (
                          <Chip
                            key={chipIndex}
                            label={chip.label}
                            size="small"
                            color={chip.color}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Actions menu */}
                  {visibleActions.length > 0 && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleActionMenuOpen(e, row)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}

        {/* Actions menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleActionMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {selectedRow &&
            getVisibleActions(selectedRow).map((action, index) => (
              <MenuItem
                key={index}
                onClick={() => handleActionClick(action)}
                disabled={action.disabled && action.disabled(selectedRow)}
              >
                {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                <ListItemText>{action.label}</ListItemText>
              </MenuItem>
            ))}
        </Menu>
      </Box>
    );
  }

  // Desktop table layout
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align || 'left'}
                sx={{
                  fontWeight: 600,
                  ...(column.width && { width: column.width }),
                  ...(column.minWidth && { minWidth: column.minWidth }),
                }}
              >
                {column.label}
              </TableCell>
            ))}
            {actions.length > 0 && (
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => {
            const visibleActions = getVisibleActions(row);

            return (
              <TableRow
                key={keyExtractor(row, index)}
                hover={!!onRowClick}
                onClick={() => onRowClick && onRowClick(row)}
                sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align || 'left'}>
                    {getCellValue(row, column, index) as React.ReactNode}
                  </TableCell>
                ))}
                {actions.length > 0 && (
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      {visibleActions.map((action, actionIndex) => (
                        <IconButton
                          key={actionIndex}
                          size="small"
                          color={action.color || 'default'}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          disabled={action.disabled && action.disabled(row)}
                        >
                          {action.icon}
                        </IconButton>
                      ))}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ResponsiveTable;
