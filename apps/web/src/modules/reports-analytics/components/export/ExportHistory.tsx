import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tooltip,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useExportsStore } from '../../stores/exportsStore';
import { ExportJob, ExportResult, ExportFormat } from '../../types/exports';

interface ExportHistoryProps {
  maxHeight?: number;
}

export const ExportHistory: React.FC<ExportHistoryProps> = ({
  maxHeight = 600,
}) => {
  const { exportJobs, exportResults, removeExportJob, removeExportResult } =
    useExportsStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Combine jobs and results for display
  const allExports = useMemo(() => {
    return Object.values(exportJobs)
      .map((job) => ({
        ...job,
        result: exportResults[job.id],
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [exportJobs, exportResults]);

  // Filter exports based on search and filters
  const filteredExports = useMemo(() => {
    return allExports.filter((exportItem) => {
      const matchesSearch =
        searchTerm === '' ||
        exportItem.reportType
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        exportItem.config.format
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || exportItem.status === statusFilter;
      const matchesFormat =
        formatFilter === 'all' || exportItem.config.format === formatFilter;

      return matchesSearch && matchesStatus && matchesFormat;
    });
  }, [allExports, searchTerm, statusFilter, formatFilter]);

  // Paginated exports
  const paginatedExports = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredExports.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredExports, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    jobId: string
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedJobId(jobId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedJobId(null);
  };

  const handleDownload = (result: ExportResult) => {
    if (result.downloadUrl) {
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    handleMenuClose();
  };

  const handleDelete = (jobId: string) => {
    removeExportJob(jobId);
    const result = Object.values(exportResults).find((r) => r.id === jobId);
    if (result) {
      removeExportResult(jobId);
    }
    handleMenuClose();
  };

  const handleRetry = (jobId: string) => {
    // TODO: Implement retry logic

    handleMenuClose();
  };

  const getStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      case 'processing':
        return 'primary';
      case 'queued':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const end = endTime || new Date();
    const duration = end.getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const uniqueFormats = Array.from(
    new Set(allExports.map((e) => e.config.format))
  );
  const uniqueStatuses = Array.from(new Set(allExports.map((e) => e.status)));

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
          <Typography variant="h6" component="div">
            Export History
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => {
              // TODO: Refresh export history

            }}
            size="small"
          >
            Refresh
          </Button>
        </Box>

        {/* Filters */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search exports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              {uniqueStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              label="Format"
            >
              <MenuItem value="all">All Formats</MenuItem>
              {uniqueFormats.map((format) => (
                <MenuItem key={format} value={format}>
                  {format.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Export Table */}
        <TableContainer sx={{ maxHeight }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Report Type</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedExports.map((exportItem) => (
                <TableRow key={exportItem.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {exportItem.reportType
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Typography>
                    {exportItem.error && (
                      <Tooltip title={exportItem.error}>
                        <Typography
                          variant="caption"
                          color="error"
                          display="block"
                        >
                          Error: {exportItem.error.substring(0, 50)}...
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={exportItem.config.format.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        exportItem.status.charAt(0).toUpperCase() +
                        exportItem.status.slice(1)
                      }
                      size="small"
                      color={getStatusColor(exportItem.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatFileSize(exportItem.result?.fileSize)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDuration(
                        exportItem.createdAt,
                        exportItem.completedAt
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {exportItem.createdAt.toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {exportItem.createdAt.toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, exportItem.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredExports.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuList>
            {selectedJobId &&
              exportJobs[selectedJobId]?.status === 'completed' &&
              exportResults[selectedJobId]?.downloadUrl && (
                <MenuItemComponent
                  onClick={() => handleDownload(exportResults[selectedJobId])}
                >
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download</ListItemText>
                </MenuItemComponent>
              )}

            {selectedJobId &&
              exportJobs[selectedJobId]?.status === 'failed' && (
                <MenuItemComponent onClick={() => handleRetry(selectedJobId)}>
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Retry</ListItemText>
                </MenuItemComponent>
              )}

            <MenuItemComponent
              onClick={() => selectedJobId && handleDelete(selectedJobId)}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItemComponent>
          </MenuList>
        </Menu>
      </CardContent>
    </Card>
  );
};
