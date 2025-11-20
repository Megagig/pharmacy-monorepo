// Virtualized Data Table for Large Datasets with Smooth Animations
import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Typography,
  Skeleton,
  Fade,
  Zoom,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';
import { FixedSizeList as List } from 'react-window';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: any, row: any) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'custom';
}

interface VirtualizedDataTableProps {
  data: any[];
  columns: Column[];
  height?: number;
  rowHeight?: number | ((index: number) => number);
  loading?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  onRowClick?: (row: any, index: number) => void;
  onRowDoubleClick?: (row: any, index: number) => void;
  onExport?: () => void;
  className?: string;
  stickyHeader?: boolean;
  striped?: boolean;
  hover?: boolean;
  dense?: boolean;
  emptyMessage?: string;
  loadingRows?: number;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const VirtualizedDataTable: React.FC<VirtualizedDataTableProps> = ({
  data,
  columns,
  height = 400,
  rowHeight = 52,
  loading = false,
  searchable = true,
  sortable = true,
  filterable = false,
  exportable = false,
  onRowClick,
  onRowDoubleClick,
  onExport,
  className,
  stickyHeader = true,
  striped = true,
  hover = true,
  dense = false,
  emptyMessage = 'No data available',
  loadingRows = 10,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const listRef = useRef<any>(null);

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        columns.some((column) => {
          const value = row[column.id];
          if (value == null) return false;
          return String(value).toLowerCase().includes(query);
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnId, filterValue]) => {
      if (filterValue != null && filterValue !== '') {
        result = result.filter((row) => {
          const value = row[columnId];
          if (typeof filterValue === 'string') {
            return String(value)
              .toLowerCase()
              .includes(filterValue.toLowerCase());
          }
          return value === filterValue;
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  }, [data, searchQuery, filters, sortConfig, columns]);

  // Handle sorting
  const handleSort = useCallback(
    (columnId: string) => {
      if (!sortable) return;

      setSortConfig((prevConfig) => {
        if (prevConfig?.key === columnId) {
          if (prevConfig.direction === 'asc') {
            return { key: columnId, direction: 'desc' };
          } else {
            return null; // Remove sorting
          }
        } else {
          return { key: columnId, direction: 'asc' };
        }
      });
    },
    [sortable]
  );

  // Handle search
  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    []
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Get row height (support both fixed and variable heights)
  const getRowHeight = useCallback(
    (index: number) => {
      if (typeof rowHeight === 'function') {
        return rowHeight(index);
      }
      return rowHeight;
    },
    [rowHeight]
  );

  // Row renderer for virtualized list
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const row = processedData[index];
      const isEven = index % 2 === 0;

      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor:
              striped && !isEven
                ? alpha(theme.palette.primary.main, 0.02)
                : 'transparent',
            cursor: onRowClick || onRowDoubleClick ? 'pointer' : 'default',
            transition: 'all 0.2s ease-in-out',
          }}
          onClick={() => onRowClick?.(row, index)}
          onDoubleClick={() => onRowDoubleClick?.(row, index)}
          onMouseEnter={(e) => {
            if (hover) {
              e.currentTarget.style.backgroundColor = alpha(
                theme.palette.primary.main,
                0.08
              );
              e.currentTarget.style.transform = 'translateX(2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (hover) {
              e.currentTarget.style.backgroundColor =
                striped && !isEven
                  ? alpha(theme.palette.primary.main, 0.02)
                  : 'transparent';
              e.currentTarget.style.transform = 'translateX(0)';
            }
          }}
        >
          {columns.map((column, columnIndex) => {
            const value = row[column.id];
            const formattedValue = column.format
              ? column.format(value, row)
              : value;

            return (
              <Box
                key={column.id}
                sx={{
                  flex: `0 0 ${column.minWidth || 150}px`,
                  px: 2,
                  py: dense ? 1 : 1.5,
                  textAlign: column.align || 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRight:
                    columnIndex < columns.length - 1
                      ? `1px solid ${theme.palette.divider}`
                      : 'none',
                }}
              >
                {React.isValidElement(formattedValue) ? (
                  formattedValue
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: dense ? '0.75rem' : '0.875rem',
                      fontWeight: columnIndex === 0 ? 500 : 400,
                    }}
                  >
                    {formattedValue}
                  </Typography>
                )}
              </Box>
            );
          })}
        </div>
      );
    },
    [
      processedData,
      columns,
      theme,
      striped,
      hover,
      dense,
      onRowClick,
      onRowDoubleClick,
    ]
  );

  // Loading row renderer
  const LoadingRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {columns.map((column, columnIndex) => (
          <Box
            key={column.id}
            sx={{
              flex: `0 0 ${column.minWidth || 150}px`,
              px: 2,
              py: dense ? 1 : 1.5,
              borderRight:
                columnIndex < columns.length - 1
                  ? `1px solid ${theme.palette.divider}`
                  : 'none',
            }}
          >
            <Skeleton
              variant="text"
              width={`${Math.random() * 40 + 60}%`}
              height={dense ? 16 : 20}
              animation="wave"
            />
          </Box>
        ))}
      </div>
    ),
    [columns, theme, dense]
  );

  // Scroll to top when data changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [processedData]);

  return (
    <Paper
      className={className}
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
      }}
    >
      {/* Header with search and controls */}
      {(searchable || filterable || exportable) && (
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {searchable && (
              <TextField
                size="small"
                placeholder="Search data..."
                value={searchQuery}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={clearSearch} edge="end">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            )}

            <Box sx={{ flex: 1 }} />

            {filterable && (
              <IconButton size="small" color="primary">
                <FilterIcon />
              </IconButton>
            )}

            {exportable && (
              <IconButton size="small" color="primary" onClick={onExport}>
                <ExportIcon />
              </IconButton>
            )}

            <Chip
              label={`${processedData.length} rows`}
              size="small"
              variant="outlined"
              color="primary"
            />
          </Box>
        </Box>
      )}

      {/* Table Header */}
      {stickyHeader && (
        <Box
          sx={{
            display: 'flex',
            backgroundColor: theme.palette.grey[50],
            borderBottom: `2px solid ${theme.palette.divider}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          {columns.map((column, index) => (
            <Box
              key={column.id}
              sx={{
                flex: `0 0 ${column.minWidth || 150}px`,
                px: 2,
                py: 1.5,
                borderRight:
                  index < columns.length - 1
                    ? `1px solid ${theme.palette.divider}`
                    : 'none',
                cursor:
                  sortable && column.sortable !== false ? 'pointer' : 'default',
                '&:hover':
                  sortable && column.sortable !== false
                    ? {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.08
                        ),
                      }
                    : {},
                transition: 'background-color 0.2s ease-in-out',
              }}
              onClick={() => column.sortable !== false && handleSort(column.id)}
            >
              {sortable && column.sortable !== false ? (
                <TableSortLabel
                  active={sortConfig?.key === column.id}
                  direction={
                    sortConfig?.key === column.id ? sortConfig.direction : 'asc'
                  }
                  sx={{
                    '& .MuiTableSortLabel-root': {
                      fontSize: dense ? '0.75rem' : '0.875rem',
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    },
                  }}
                >
                  {column.label}
                </TableSortLabel>
              ) : (
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: dense ? '0.75rem' : '0.875rem',
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    textAlign: column.align || 'left',
                  }}
                >
                  {column.label}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Virtualized Table Body */}
      <Box sx={{ height: height - (stickyHeader ? 100 : 50) }}>
        {loading ? (
          <FixedSizeList
            ref={listRef}
            height={height - (stickyHeader ? 100 : 50)}
            itemCount={loadingRows}
            itemSize={getRowHeight(0)}
            overscanCount={5}
          >
            {LoadingRow}
          </FixedSizeList>
        ) : processedData.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {emptyMessage}
            </Typography>
            {searchQuery && (
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search terms
              </Typography>
            )}
          </Box>
        ) : typeof rowHeight === 'function' ? (
          <VariableSizeList
            ref={listRef}
            height={height - (stickyHeader ? 100 : 50)}
            itemCount={processedData.length}
            itemSize={getRowHeight}
            overscanCount={5}
          >
            {Row}
          </VariableSizeList>
        ) : (
          <FixedSizeList
            ref={listRef}
            height={height - (stickyHeader ? 100 : 50)}
            itemCount={processedData.length}
            itemSize={rowHeight as number}
            overscanCount={5}
          >
            {Row}
          </FixedSizeList>
        )}
      </Box>
    </Paper>
  );
};

export default VirtualizedDataTable;
