import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  FileDownload as FileDownloadIcon,
  Science as ScienceIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  TrendingUp as TrendingUpIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import LabResultsTable from '../components/laboratory/LabResultsTable';
import StatisticsCards from '../components/laboratory/StatisticsCards';

/**
 * Laboratory Dashboard Page
 * Main page for Laboratory Findings module
 * Route: /laboratory
 */

interface LabStatistics {
  totalResults: number;
  pendingResults: number;
  criticalResults: number;
  abnormalResults: number;
  resultsThisWeek: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`lab-tabpanel-${index}`}
      aria-labelledby={`lab-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const LaboratoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    testCategory: 'all',
    interpretation: 'all',
  });

  // Check if we're in AI Analysis selection mode
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get('returnTo');
  const patientId = urlParams.get('patientId');
  const returnUrl = urlParams.get('returnUrl');
  const isAIAnalysisMode = returnTo === 'lab-integration';
  
  const [selectedLabResults, setSelectedLabResults] = useState<string[]>([]);

  // Handle lab result selection for AI Analysis
  const handleLabResultSelect = (labResultId: string) => {
    setSelectedLabResults(prev => 
      prev.includes(labResultId) 
        ? prev.filter(id => id !== labResultId)
        : [...prev, labResultId]
    );
  };

  // Handle return to Lab Integration with selected results
  const handleReturnToLabIntegration = () => {
    if (selectedLabResults.length === 0) {
      toast.error('Please select at least one lab result');
      return;
    }

    const selectedLabResultsParam = encodeURIComponent(JSON.stringify(selectedLabResults));
    const baseReturnUrl = returnUrl || '/pharmacy/lab-integration/new';
    const separator = baseReturnUrl.includes('?') ? '&' : '?';
    const finalReturnUrl = `${baseReturnUrl}${separator}selectedLabResults=${selectedLabResultsParam}`;
    
    navigate(finalReturnUrl);
  };

  // Fetch statistics
  const { data: statistics, isLoading: statsLoading, refetch: refetchStats } = useQuery<LabStatistics>({
    queryKey: ['lab-statistics'],
    queryFn: async () => {
      const response = await api.get('/laboratory/results/statistics');
      return response.data.data;
    },
  });

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle filter change
  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  // Handle refresh
  const handleRefresh = () => {
    refetchStats();
    toast.success('Data refreshed');
  };

  // Handle download CSV template
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/laboratory/batch-upload/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'lab_results_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        {/* AI Analysis Mode Banner */}
        {isAIAnalysisMode && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  Select Lab Results for AI Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose lab results to include in the AI diagnostic analysis for the selected patient
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Chip 
                  label={`${selectedLabResults.length} selected`} 
                  color="primary" 
                  variant="filled"
                />
                <Button
                  variant="contained"
                  onClick={handleReturnToLabIntegration}
                  disabled={selectedLabResults.length === 0}
                >
                  Use Selected Results
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate(returnUrl || '/pharmacy/lab-integration/new')}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScienceIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary">
                Laboratory Findings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isAIAnalysisMode 
                  ? `Select lab results for AI analysis${patientId ? ' for the selected patient' : ''}`
                  : 'Manage and analyze lab results across all patients'
                }
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<TrendingUpIcon />}
              onClick={() => navigate('/laboratory/trends')}
            >
              View Trends
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleDownloadTemplate}
            >
              CSV Template
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => navigate('/laboratory/upload')}
            >
              Upload Results
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/laboratory/add')}
            >
              Add Lab Result
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <StatisticsCards statistics={statistics} loading={statsLoading} />

      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search by test name, patient, or accession number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              select
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Reviewed">Reviewed</MenuItem>
              <MenuItem value="Signed Off">Signed Off</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              select
              label="Category"
              value={filters.testCategory}
              onChange={(e) => handleFilterChange('testCategory', e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="Hematology">Hematology</MenuItem>
              <MenuItem value="Chemistry">Chemistry</MenuItem>
              <MenuItem value="Microbiology">Microbiology</MenuItem>
              <MenuItem value="Immunology">Immunology</MenuItem>
              <MenuItem value="Pathology">Pathology</MenuItem>
              <MenuItem value="Radiology">Radiology</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              select
              label="Interpretation"
              value={filters.interpretation}
              onChange={(e) => handleFilterChange('interpretation', e.target.value)}
            >
              <MenuItem value="all">All Results</MenuItem>
              <MenuItem value="Normal">Normal</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="Abnormal">Abnormal</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => {
                setFilters({ status: 'all', testCategory: 'all', interpretation: 'all' });
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="All Results" icon={<ScienceIcon />} iconPosition="start" />
          <Tab
            label={`Critical (${statistics?.criticalResults || 0})`}
            icon={<WarningIcon />}
            iconPosition="start"
          />
          <Tab
            label={`Pending (${statistics?.pendingResults || 0})`}
            icon={<PendingIcon />}
            iconPosition="start"
          />
          <Tab label="Abnormal" icon={<TrendingUpIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <LabResultsTable
          searchQuery={searchQuery}
          filters={filters}
          view="all"
          selectionMode={isAIAnalysisMode}
          selectedLabResults={selectedLabResults}
          onLabResultSelect={handleLabResultSelect}
          patientId={patientId}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <LabResultsTable
          searchQuery={searchQuery}
          filters={{ ...filters, interpretation: 'Critical' }}
          view="critical"
          selectionMode={isAIAnalysisMode}
          selectedLabResults={selectedLabResults}
          onLabResultSelect={handleLabResultSelect}
          patientId={patientId}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <LabResultsTable
          searchQuery={searchQuery}
          filters={{ ...filters, status: 'Pending' }}
          view="pending"
          selectionMode={isAIAnalysisMode}
          selectedLabResults={selectedLabResults}
          onLabResultSelect={handleLabResultSelect}
          patientId={patientId}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <LabResultsTable
          searchQuery={searchQuery}
          filters={{ ...filters, interpretation: 'Abnormal' }}
          view="abnormal"
          selectionMode={isAIAnalysisMode}
          selectedLabResults={selectedLabResults}
          onLabResultSelect={handleLabResultSelect}
          patientId={patientId}
        />
      </TabPanel>
    </Container>
  );
};

export default LaboratoryDashboard;

