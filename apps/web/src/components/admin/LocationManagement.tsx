import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Business as WorkspaceIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Star as PrimaryIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import { useUIStore } from '../../stores';
import { adminService } from '../../services/adminService';
import { useQuery } from '@tanstack/react-query';

interface LocationInfo {
  id: string;
  name: string;
  address: string;
  isPrimary: boolean;
  metadata?: any;
}

interface Workspace {
  _id: string;
  name: string;
  type: string;
  email: string;
  phone?: string;
  address?: string;
  state?: string;
  locations: LocationInfo[];
  subscriptionStatus: string;
}

const LocationManagement: React.FC = () => {
  const addNotification = useUIStore((state) => state.addNotification);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterType]);

  // Fetch workspaces data (which includes locations)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['locations', page, rowsPerPage, searchTerm],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        limit: rowsPerPage * 5, // Fetch more workspaces to get more locations
      };
      if (searchTerm) params.search = searchTerm;

      const response = await adminService.getLocations(params);
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Extract all locations from workspaces
  const workspaces: Workspace[] = data?.workspaces || [];
  const allLocations: Array<LocationInfo & { workspace: Workspace }> = [];
  
  workspaces.forEach((workspace) => {
    if (workspace.locations && workspace.locations.length > 0) {
      workspace.locations.forEach((location) => {
        allLocations.push({
          ...location,
          workspace,
        });
      });
    }
  });

  // Apply filters
  const filteredLocations = allLocations.filter((location) => {
    const matchesSearch =
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.workspace.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = 
      filterType === 'all' ||
      (filterType === 'primary' && location.isPrimary) ||
      (filterType === 'secondary' && !location.isPrimary);
    
    return matchesSearch && matchesType;
  });

  // Paginate filtered locations
  const paginatedLocations = filteredLocations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Calculate statistics
  const stats = {
    total: allLocations.length,
    primary: allLocations.filter((l) => l.isPrimary).length,
    secondary: allLocations.filter((l) => !l.isPrimary).length,
    workspaces: workspaces.length,
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LocationIcon sx={{ mr: 1, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="600">
            Location Management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.total}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Total Locations
                  </Typography>
                </Box>
                <MapIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.primary}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Primary Locations
                  </Typography>
                </Box>
                <PrimaryIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.secondary}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Secondary Locations
                  </Typography>
                </Box>
                <LocationIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {isLoading ? <Skeleton width={60} sx={{ bgcolor: alpha('#fff', 0.2) }} /> : stats.workspaces}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Workspaces
                  </Typography>
                </Box>
                <WorkspaceIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by location name, address, or workspace..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Type Filter</InputLabel>
                <Select
                  value={filterType}
                  label="Type Filter"
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <MenuItem value="all">All Locations</MenuItem>
                  <MenuItem value="primary">Primary Only</MenuItem>
                  <MenuItem value="secondary">Secondary Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Location Name</TableCell>
                <TableCell>Workspace</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                  </TableRow>
                ))
              ) : paginatedLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 4 }}>
                      No locations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLocations.map((location, index) => (
                  <TableRow key={`${location.workspace._id}-${location.id}-${index}`} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="body2" fontWeight="600">
                            {location.name}
                          </Typography>
                          {location.isPrimary && (
                            <Chip
                              icon={<PrimaryIcon />}
                              label="Primary"
                              size="small"
                              color="primary"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Chip
                          icon={<WorkspaceIcon />}
                          label={location.workspace.name}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          {location.workspace.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {location.address}
                      </Typography>
                      {location.workspace.state && (
                        <Typography variant="caption" color="text.secondary">
                          {location.workspace.state}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={location.workspace.type}
                        size="small"
                        color="default"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        {location.workspace.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption">
                              {location.workspace.phone}
                            </Typography>
                          </Box>
                        )}
                        {location.workspace.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <EmailIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption">
                              {location.workspace.email}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={location.workspace.subscriptionStatus.toUpperCase()}
                        size="small"
                        color={
                          location.workspace.subscriptionStatus === 'active' ? 'success' :
                          location.workspace.subscriptionStatus === 'trial' ? 'info' :
                          location.workspace.subscriptionStatus === 'expired' ? 'error' :
                          'default'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredLocations.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>
    </Box>
  );
};

export default LocationManagement;
