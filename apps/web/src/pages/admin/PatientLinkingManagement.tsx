import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Link as LinkIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Unlink as UnlinkIcon
} from '@mui/icons-material';

interface UnlinkedPatientUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: string;
  workplaceId: {
    name: string;
  };
}

interface LinkingStats {
  totalPatientUsers: number;
  linkedPatientUsers: number;
  unlinkedPatientUsers: number;
  linkingRate: number;
}

const PatientLinkingManagement: React.FC = () => {
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedPatientUser[]>([]);
  const [stats, setStats] = useState<LinkingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UnlinkedPatientUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // For now, we'll show a placeholder since the backend routes are commented out
      // In a real implementation, these would call the actual API endpoints
      
      // Simulated data for demonstration
      setStats({
        totalPatientUsers: 15,
        linkedPatientUsers: 8,
        unlinkedPatientUsers: 7,
        linkingRate: 53.33
      });

      setUnlinkedUsers([
        {
          _id: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+2348012345678',
          createdAt: new Date().toISOString(),
          workplaceId: { name: 'Main Pharmacy' }
        },
        {
          _id: '2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          createdAt: new Date().toISOString(),
          workplaceId: { name: 'Main Pharmacy' }
        }
      ]);
    } catch (error) {
      console.error('Error fetching patient linking data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePatientRecord = async (patientUserId: string) => {
    setActionLoading(true);
    try {
      // Placeholder for actual API call

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh data
      await fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error creating patient record:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRetry = async () => {
    setActionLoading(true);
    try {
      // Placeholder for actual API call

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error running batch retry:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Patient Linking Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={handleBatchRetry}
            disabled={actionLoading}
          >
            Batch Retry Linking
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        This feature helps you manage PatientUser accounts that are not yet linked to Patient medical records. 
        The patient health records feature requires proper linking between authentication and medical data.
      </Alert>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Patient Users
                </Typography>
                <Typography variant="h4">
                  {stats.totalPatientUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Linked Users
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.linkedPatientUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unlinked Users
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.unlinkedPatientUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Linking Rate
                </Typography>
                <Typography variant="h4" color={stats.linkingRate > 80 ? 'success.main' : 'warning.main'}>
                  {stats.linkingRate.toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Unlinked Users Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Unlinked Patient Users
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            These PatientUser accounts need to be linked to Patient medical records to access health records features.
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unlinkedUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {user.firstName} {user.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || 'N/A'}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Unlinked" 
                        color="warning" 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Find potential matches">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedUser(user);
                            setDialogOpen(true);
                          }}
                        >
                          <SearchIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Create new patient record">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleCreatePatientRecord(user._id)}
                          disabled={actionLoading}
                        >
                          <PersonAddIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {unlinkedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        No unlinked patient users found. All users are properly linked to patient records.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Patient Matching Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Find Patient Matches for {selectedUser?.firstName} {selectedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This feature will search for existing Patient records that might match this PatientUser account.
            The admin routes are currently being set up. Once available, you'll be able to:
          </Alert>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>Search by email, phone, and name</li>
            <li>View potential matches with confidence scores</li>
            <li>Manually link to existing records</li>
            <li>Create new patient records if no matches found</li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => selectedUser && handleCreatePatientRecord(selectedUser._id)}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Create New Patient Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PatientLinkingManagement;