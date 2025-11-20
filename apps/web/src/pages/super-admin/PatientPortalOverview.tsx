import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Stack,
} from '@mui/material';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  LocalPharmacy as LocalPharmacyIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/apiClient';

interface WorkspacePortalStats {
  workspaceId: string;
  workspaceName: string;
  workspaceType: string;
  workspaceEmail: string;
  totalPatients: number;
  activePatients: number;
  pendingApprovals: number;
  suspendedPatients: number;
  pendingRefills: number;
  patientPortalEnabled: boolean;
}

interface WorkspaceResponse {
  success: boolean;
  data: WorkspacePortalStats[];
  summary: {
    totalWorkspaces: number;
    totalPatientsAcrossAll: number;
    totalActivePatients: number;
    totalPendingApprovals: number;
    totalPendingRefills: number;
  };
  message: string;
}

/**
 * Patient Portal Overview - Super Admin View
 * 
 * Displays all workspaces with patient portal enabled and their key metrics.
 * Allows super admins to search, filter, and drill down into specific workspace portals.
 */
const PatientPortalOverview: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('workspaceName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch all workspaces with patient portal stats
  const { data: response, isLoading, error } = useQuery<WorkspaceResponse>({
    queryKey: ['super-admin-patient-portal-overview', searchTerm, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await apiClient.get(`/super-admin/patient-portal/workspaces?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleWorkspaceClick = (workspaceId: string) => {
    // Navigate to the existing workspace admin patient portal with workspace context
    // This preserves all existing functionality while allowing super admin access
    navigate(`/workspace-admin/patient-portal/${workspaceId}`);
  };

  const workspaces = response?.data || [];
  const summary = response?.summary;

  // Client-side filtering by workspace type
  const filteredWorkspaces = workspaces.filter((workspace) => {
    if (filterType === 'all') return true;
    return workspace.workspaceType.toLowerCase() === filterType.toLowerCase();
  });

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Patient Portal Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Oversee and manage patient portals across all workspaces
        </Typography>
      </Box>

      {/* Summary Statistics */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BusinessIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {summary.totalWorkspaces}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Workspaces
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <PeopleIcon color="success" fontSize="large" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {summary.totalPatientsAcrossAll}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Patients
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <HourglassEmptyIcon color="warning" fontSize="large" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {summary.totalPendingApprovals}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Approvals
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <LocalPharmacyIcon color="info" fontSize="large" />
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {summary.totalPendingRefills}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Refills
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Filters and Search */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={5}>
          <TextField
            fullWidth
            label="Search Workspaces"
            placeholder="Search by name, email, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <TextField
            select
            fullWidth
            label="Filter by Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="pharmacy">Pharmacy</MenuItem>
            <MenuItem value="hospital">Hospital</MenuItem>
            <MenuItem value="clinic">Clinic</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <TextField
            select
            fullWidth
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="workspaceName">Workspace Name</MenuItem>
            <MenuItem value="totalPatients">Total Patients</MenuItem>
            <MenuItem value="activePatients">Active Patients</MenuItem>
            <MenuItem value="pendingApprovals">Pending Approvals</MenuItem>
            <MenuItem value="pendingRefills">Pending Refills</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4} md={2}>
          <TextField
            select
            fullWidth
            label="Order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <MenuItem value="asc">Ascending</MenuItem>
            <MenuItem value="desc">Descending</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      {/* Loading State */}
      {isLoading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load workspace data. Please try again later.
        </Alert>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredWorkspaces.length === 0 && (
        <Paper elevation={1} sx={{ p: 6, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Workspaces Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No verified workspaces found in the system.'}
          </Typography>
        </Paper>
      )}

      {/* Workspace Cards */}
      {!isLoading && !error && filteredWorkspaces.length > 0 && (
        <Grid container spacing={3}>
          {filteredWorkspaces.map((workspace) => (
            <Grid item xs={12} md={6} lg={4} key={workspace.workspaceId}>
              <Card elevation={2} sx={{ height: '100%' }}>
                <CardActionArea onClick={() => handleWorkspaceClick(workspace.workspaceId)}>
                  <CardContent>
                    {/* Workspace Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <BusinessIcon sx={{ mr: 1, color: 'primary.main', flexShrink: 0 }} />
                        <Typography variant="h6" component="div" noWrap>
                          {workspace.workspaceName}
                        </Typography>
                      </Box>
                      {/* Portal Status Badge */}
                      {workspace.patientPortalEnabled ? (
                        <Chip
                          label="Portal Active"
                          size="small"
                          color="success"
                          sx={{ ml: 1 }}
                        />
                      ) : (
                        <Chip
                          label="Portal Disabled"
                          size="small"
                          color="default"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>

                    {/* Workspace Type Chip */}
                    <Chip
                      label={workspace.workspaceType}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ mb: 2, textTransform: 'capitalize' }}
                    />

                    <Divider sx={{ my: 2 }} />

                    {/* Statistics Grid */}
                    <Grid container spacing={2}>
                      {/* Total Patients */}
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PeopleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {workspace.totalPatients}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Total Patients
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      {/* Active Patients */}
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                          <Box>
                            <Typography variant="h6" fontWeight="bold" color="success.main">
                              {workspace.activePatients}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Active
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      {/* Pending Approvals */}
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HourglassEmptyIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                          <Box>
                            <Typography variant="h6" fontWeight="bold" color="warning.main">
                              {workspace.pendingApprovals}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pending
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      {/* Pending Refills */}
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocalPharmacyIcon sx={{ fontSize: 20, color: 'info.main' }} />
                          <Box>
                            <Typography variant="h6" fontWeight="bold" color="info.main">
                              {workspace.pendingRefills}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Refills
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      {/* Suspended Patients (if any) */}
                      {workspace.suspendedPatients > 0 && (
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BlockIcon sx={{ fontSize: 20, color: 'error.main' }} />
                            <Typography variant="body2" color="error.main">
                              {workspace.suspendedPatients} Suspended
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* Workspace Email */}
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {workspace.workspaceEmail}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default PatientPortalOverview;
