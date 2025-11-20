import React, { useMemo, useCallback, forwardRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Typography,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';

interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => Promise<void>;
  height?: number;
  rowHeight?: number;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  emptyMessage?: string;
  getRowId?: (row: T, index: number) => string;
}

interface VirtualRowProps<T> {
  index: number;
  style: React.CSSProperties;
  data: {
    rows: any[];
    columns: ColumnDef<T>[];
    table: any;
    isItemLoaded: (index: number) => boolean;
    rowHeight: number;
  };
}

// Virtual row component
const VirtualRow = React.memo(<T,>({ index, style, data }: VirtualRowProps<T>) => {
  const { rows, table, isItemLoaded, rowHeight } = data;
  
  const isLoaded = isItemLoaded(index);
  const row = rows[index];

  if (!isLoaded) {
    return (
      <div style={style}>
        <TableRow sx={{ height: rowHeight }}>
          {table.getHeaderGroups()[0]?.headers.map((header: any, cellIndex: number) => (
            <TableCell key={cellIndex} sx={{ p: 1 }}>
              <Skeleton variant="text" height={20} />
            </TableCell>
          ))}
        </TableRow>
      </div>
    );
  }

  if (!row) {
    return (
      <div style={style}>
        <TableRow sx={{ height: rowHeight }}>
          <TableCell 
            colSpan={table.getHeaderGroups()[0]?.headers.length || 1}
            sx={{ textAlign: 'center', p: 2 }}
          >
            <Typography color="text.secondary">Loading...</Typography>
          </TableCell>
        </TableRow>
      </div>
    );
  }

  return (
    <div style={style}>
      <TableRow
        sx={{
          height: rowHeight,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        {row.getVisibleCells().map((cell: any) => (
          <TableCell
            key={cell.id}
            sx={{
              p: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </div>
  );
});

VirtualRow.displayName = 'VirtualRow';

// Sort indicator component
const SortIndicator: React.FC<{ direction: 'asc' | 'desc' | false }> = ({ direction }) => {
  if (direction === 'asc') {
    return <ArrowUpwardIcon fontSize="small" />;
  }
  if (direction === 'desc') {
    return <ArrowDownwardIcon fontSize="small" />;
  }
  return <UnfoldMoreIcon fontSize="small" sx={{ opacity: 0.5 }} />;
};

// Main virtualized data table component
export const VirtualizedDataTable = <T,>({
  data,
  columns,
  loading = false,
  hasNextPage = false,
  isNextPageLoading = false,
  loadNextPage,
  height = 600,
  rowHeight = 52,
  enableSorting = true,
  enableFiltering = false,
  sorting = [],
  onSortingChange,
  columnFilters = [],
  onColumnFiltersChange,
  emptyMessage = 'No data available',
  getRowId,
}: VirtualizedDataTableProps<T>) => {
  // Create table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    enableSorting,
    enableFiltering,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange,
    onColumnFiltersChange,
    getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined,
    manualSorting: false, // Set to true if sorting is handled server-side
    manualFiltering: false, // Set to true if filtering is handled server-side
  });

  const rows = table.getRowModel().rows;
  
  // Calculate total item count (including loading items)
  const itemCount = hasNextPage ? rows.length + 1 : rows.length;

  // Check if an item is loaded
  const isItemLoaded = useCallback(
    (index: number) => !!rows[index],
    [rows]
  );

  // Load more items if needed
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      if (loadNextPage && !isNextPageLoading) {
        await loadNextPage();
      }
    },
    [loadNextPage, isNextPageLoading]
  );

  // Memoized row data to prevent unnecessary re-renders
  const rowData = useMemo(
    () => ({
      rows,
      columns,
      table,
      isItemLoaded,
      rowHeight,
    }),
    [rows, columns, table, isItemLoaded, rowHeight]
  );

  // Calculate header height
  const headerHeight = 56;
  const tableBodyHeight = height - headerHeight;

  // Inner element type for react-window
  const innerElementType = forwardRef<HTMLDivElement>(({ style, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        paddingTop: 0,
        paddingBottom: 0,
      }}
      {...rest}
    />
  ));

  // Loading state
  if (loading && data.length === 0) {
    return (
      <TableContainer component={Paper} sx={{ height }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column, index) => (
                <TableCell key={index} sx={{ fontWeight: 600 }}>
                  <Skeleton variant="text" width="80%" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: Math.floor(tableBodyHeight / rowHeight) }).map((_, index) => (
              <TableRow key={index} sx={{ height: rowHeight }}>
                {columns.map((_, cellIndex) => (
                  <TableCell key={cellIndex} sx={{ p: 1 }}>
                    <Skeleton variant="text" height={20} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <TableContainer component={Paper} sx={{ height }}>
        <Table>
          <TableHead>
            <TableRow>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    sx={{
                      fontWeight: 600,
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <SortIndicator direction={header.column.getIsSorted()} />
                      )}
                    </Box>
                  </TableCell>
                ))
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={columns.length}
                sx={{
                  textAlign: 'center',
                  py: 8,
                }}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ height }}>
      <Table stickyHeader>
        {/* Table Header */}
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell
                  key={header.id}
                  sx={{
                    fontWeight: 600,
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none',
                    bgcolor: 'background.paper',
                    zIndex: 1,
                    '&:hover': header.column.getCanSort() ? {
                      bgcolor: 'action.hover',
                    } : {},
                  }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <Tooltip
                        title={
                          header.column.getIsSorted()
                            ? `Sorted ${header.column.getIsSorted()}`
                            : 'Click to sort'
                        }
                      >
                        <IconButton size="small" sx={{ p: 0.5 }}>
                          <SortIndicator direction={header.column.getIsSorted()} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>

        {/* Virtualized Table Body */}
        <TableBody component="div" sx={{ position: 'relative' }}>
          <Box sx={{ height: tableBodyHeight, width: '100%' }}>
            <InfiniteLoader
              isItemLoaded={isItemLoaded}
              itemCount={itemCount}
              loadMoreItems={loadMoreItems}
              threshold={5}
            >
              {({ onItemsRendered, ref }) => (
                <List
                  ref={ref}
                  height={tableBodyHeight}
                  itemCount={itemCount}
                  itemSize={rowHeight}
                  itemData={rowData}
                  onItemsRendered={onItemsRendered}
                  innerElementType={innerElementType}
                  overscanCount={5}
                >
                  {VirtualRow}
                </List>
              )}
            </InfiniteLoader>
          </Box>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default VirtualizedDataTable;