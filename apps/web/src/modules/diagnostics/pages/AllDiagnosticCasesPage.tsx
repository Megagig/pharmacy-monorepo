import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Avatar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Skeleton,
  Alert,
  Tooltip,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAllDiagnosticCases } from '../../../queries/useDiagnosticHistory';
import { DiagnosticCase } from '../../../services/diagnosticHistoryService';

const AllDiagnosticCasesPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCase, setSelectedCase] = useState<DiagnosticCase | null>(null);

  const {
    data: casesData,
    isLoading,
    error,
    refetch,
  } = useAllDiagnosticCases({
    page: page + 1,
    limit: rowsPerPage,
    search: search || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortOrder,
  });

  const cases = casesData?.cases || [];
  const pagination = casesData?.pagination || {
    current: 1,
    total: 1,
    count: 0,
    totalCases: 0,
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleStatusFilterChange = (event: any) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleViewCase = (caseId: string) => {
    navigate(`/pharmacy/diagnostics/case/${caseId}/results`);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, case_: DiagnosticCase) => {
    setAnchorEl(event.currentTarget);
    setSelectedCase(case_);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCase(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'warning';
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/pharmacy/diagnostics')}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 'bold', flex: 1 }}>
            All Diagnostic Cases
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Search cases..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 300 }}
              />
              
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={handleStatusFilterChange}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="createdAt">Created Date</MenuItem>
                  <MenuItem value="updatedAt">Updated Date</MenuItem>
                  <MenuItem value="caseId">Case ID</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Order"
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <MenuItem value="desc">Newest First</MenuItem>
                  <MenuItem value="asc">Oldest First</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Cases Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {error ? (
            <Alert severity="error" sx={{ m: 3 }}>
              Failed to load diagnostic cases. Please try refreshing the page.
            </Alert>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Case ID</TableCell>
                      <TableCell>Patient</TableCell>
                      <TableCell>Pharmacist</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Symptoms</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? (
                      // Loading skeletons
                      [...Array(rowsPerPage)].map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton width={100} /></TableCell>
                          <TableCell><Skeleton width={150} /></TableCell>
                          <TableCell><Skeleton width={150} /></TableCell>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell><Skeleton width={200} /></TableCell>
                          <TableCell><Skeleton width={100} /></TableCell>
                          <TableCell><Skeleton width={50} /></TableCell>
                        </TableRow>
                      ))
                    ) : cases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                          <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No diagnostic cases found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {search || statusFilter
                              ? 'Try adjusting your search or filter criteria'
                              : 'No diagnostic cases have been created yet'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cases.map((case_) => (
                        <TableRow
                          key={case_._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleViewCase(case_.caseId)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {case_.caseId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                                <PersonIcon fontSize="small" />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {case_.patientId?.firstName} {case_.patientId?.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {case_.patientId?.age}y, {case_.patientId?.gender}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {case_.pharmacistId?.firstName} {case_.pharmacistId?.lastName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={case_.status}
                              color={getStatusColor(case_.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {case_.symptoms?.subjective?.slice(0, 2).join(', ')}
                                {case_.symptoms?.subjective?.length > 2 && '...'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {case_.symptoms?.severity} • {case_.symptoms?.onset}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {format(new Date(case_.createdAt), 'MMM dd, yyyy')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(case_.createdAt), 'HH:mm')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewCase(case_.caseId);
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="More Actions">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMenuOpen(e, case_);
                                }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <TablePagination
                rowsPerPageOptions={[10, 20, 50, 100]}
                component="div"
                count={pagination.totalCases}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuList>
          <MenuItemComponent
            onClick={() => {
              if (selectedCase) {
                handleViewCase(selectedCase.caseId);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent
            onClick={() => {
              // TODO: Implement export functionality
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export Case</ListItemText>
          </MenuItemComponent>
        </MenuList>
      </Menu>
    </Container>
  );
};

export default AllDiagnosticCasesPage;