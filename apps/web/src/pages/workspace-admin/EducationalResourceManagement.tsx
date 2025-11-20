import React, { useState, useEffect, lazy, Suspense } from 'react';

const ResourceAnalyticsDashboard = lazy(() => import('../../components/analytics/ResourceAnalyticsDashboard'));
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tooltip,
  Stack,
  Checkbox,
  FormGroup,
  FormLabel,
} from '@mui/material';
import RichTextEditor from '../../components/RichTextEditor';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  School as EducationIcon,
  FilterList as FilterIcon,
  Public as PublicIcon,
  Business as BusinessIcon,
  BarChart as BarChartIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';

interface EducationalResource {
  _id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  mediaType: string;
  thumbnail?: string;
  mediaUrl?: string;
  difficulty?: string;
  duration?: number;
  tags: string[];
  workplaceId?: string | null;
  averageRating?: number;
  totalRatings?: number;
  viewCount?: number;
  slug: string;
  language?: string;
  accessLevel: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const categories = [
  { value: 'medication', label: 'Medications' },
  { value: 'condition', label: 'Conditions' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'prevention', label: 'Prevention' },
  { value: 'faq', label: 'FAQs' },
];

const mediaTypes = [
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'audio', label: 'Audio' },
  { value: 'interactive', label: 'Interactive' },
];

const difficulties = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const EducationalResourceManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [resources, setResources] = useState<EducationalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [openDialog, setOpenDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<EducationalResource | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'medication',
    mediaType: 'article',
    difficulty: 'beginner',
    duration: 600,
    tags: '',
    mediaUrl: '',
    thumbnail: '',
    language: 'en',
    accessLevel: 'patient_only',
    isPublished: true,
    isGlobal: false, // New field for workspace vs global
    displayLocations: ['education_page'] as string[],
    isPinned: false,
    displayOrder: 0,
    // Scheduling
    isScheduled: false,
    scheduledStartDate: '',
    scheduledEndDate: '',
    // Recommendations
    autoRecommend: false,
    recommendationConditions: '',
    recommendationMedications: '',
    recommendationAgeGroups: [] as string[],
  });

  useEffect(() => {
    if (activeTab === 2) {
      fetchAnalytics();
    } else {
      fetchResources();
    }
  }, [filterCategory, filterMediaType, activeTab]);

  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const response = await apiClient.get('/educational-resources/admin/analytics');
      setAnalytics(response.data.data.analytics);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit: 100,
        sortBy: 'createdAt',
      };

      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }

      if (filterMediaType !== 'all') {
        params.mediaType = filterMediaType;
      }

      // Tab 0: Workspace resources, Tab 1: Global resources
      if (activeTab === 0) {
        params.workplaceId = user?.pharmacyId; // Workspace-specific
      } else if (activeTab === 1) {
        params.workplaceId = 'null'; // Global resources
      }

      const response = await apiClient.get('/educational-resources/admin', {
        params,
      });

      // Handle both response formats: { data: resources } and { data: { resources } }
      const resourcesData = Array.isArray(response.data.data) 
        ? response.data.data 
        : response.data.data?.resources || response.data || [];
      setResources(Array.isArray(resourcesData) ? resourcesData : []);
    } catch (err: any) {
      console.error('Error fetching resources:', err);
      setError(err.response?.data?.message || 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (resource?: EducationalResource) => {
    setValidationErrors({}); // Clear validation errors
    setError(null); // Clear general error
    
    if (resource) {
      setEditingResource(resource);
      setFormData({
        title: resource.title,
        description: resource.description,
        content: resource.content,
        category: resource.category,
        mediaType: resource.mediaType,
        difficulty: resource.difficulty || 'beginner',
        duration: resource.duration || 600,
        tags: resource.tags.join(', '),
        mediaUrl: resource.mediaUrl || '',
        thumbnail: resource.thumbnail || '',
        language: resource.language || 'en',
        accessLevel: resource.accessLevel,
        isPublished: resource.isPublished,
        isGlobal: !resource.workplaceId,
        displayLocations: (resource as any).displayLocations || ['education_page'],
        isPinned: (resource as any).isPinned || false,
        displayOrder: (resource as any).displayOrder || 0,
        // Scheduling
        isScheduled: (resource as any).isScheduled || false,
        scheduledStartDate: (resource as any).scheduledStartDate || '',
        scheduledEndDate: (resource as any).scheduledEndDate || '',
        // Recommendations
        autoRecommend: (resource as any).autoRecommend || false,
        recommendationConditions: (resource as any).recommendationCriteria?.conditions?.join(', ') || '',
        recommendationMedications: (resource as any).recommendationCriteria?.medications?.join(', ') || '',
        recommendationAgeGroups: (resource as any).recommendationCriteria?.ageGroups || [],
      });
    } else {
      setEditingResource(null);
      setFormData({
        title: '',
        description: '',
        content: '',
        category: 'medication',
        mediaType: 'article',
        difficulty: 'beginner',
        duration: 600,
        tags: '',
        mediaUrl: '',
        thumbnail: '',
        language: 'en',
        accessLevel: 'patient_only',
        isPublished: true,
        isGlobal: false,
        displayLocations: ['education_page'],
        isPinned: false,
        displayOrder: 0,
        // Scheduling
        isScheduled: false,
        scheduledStartDate: '',
        scheduledEndDate: '',
        // Recommendations
        autoRecommend: false,
        recommendationConditions: '',
        recommendationMedications: '',
        recommendationAgeGroups: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingResource(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be 200 characters or less';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length < 10) {
      errors.content = 'Content must be at least 10 characters';
    }

    // URL validation
    const urlPattern = /^https?:\/\/.+/i;
    if (formData.mediaUrl.trim() && !urlPattern.test(formData.mediaUrl.trim())) {
      errors.mediaUrl = 'Please enter a valid URL (starting with http:// or https://)';
    }

    if (formData.thumbnail.trim() && !urlPattern.test(formData.thumbnail.trim())) {
      errors.thumbnail = 'Please enter a valid URL (starting with http:// or https://)';
    }

    // Duration validation
    if (formData.duration < 0) {
      errors.duration = 'Duration must be a positive number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      // Clear previous errors
      setValidationErrors({});
      setError(null);

      // Validate form
      if (!validateForm()) {
        setError('Please fix the validation errors below');
        return;
      }

      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        content: formData.content.trim(),
        category: formData.category,
        mediaType: formData.mediaType,
        difficulty: formData.difficulty,
        duration: formData.duration,
        tags: formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        language: formData.language,
        accessLevel: formData.accessLevel,
        isPublished: formData.isPublished,
        workplaceId: formData.isGlobal ? null : user?.pharmacyId,
        displayLocations: formData.displayLocations,
        isPinned: formData.isPinned,
        displayOrder: formData.displayOrder,
        // Scheduling
        isScheduled: formData.isScheduled,
        scheduledStartDate: formData.scheduledStartDate || undefined,
        scheduledEndDate: formData.scheduledEndDate || undefined,
        // Recommendations
        autoRecommend: formData.autoRecommend,
        recommendationCriteria: {
          conditions: formData.recommendationConditions.split(',').map(c => c.trim()).filter(Boolean),
          medications: formData.recommendationMedications.split(',').map(m => m.trim()).filter(Boolean),
          ageGroups: formData.recommendationAgeGroups,
        },
      };

      // Only include URLs if they are not empty
      if (formData.mediaUrl && formData.mediaUrl.trim()) {
        payload.mediaUrl = formData.mediaUrl.trim();
      }
      
      if (formData.thumbnail && formData.thumbnail.trim()) {
        payload.thumbnail = formData.thumbnail.trim();
      }

      if (editingResource) {
        await apiClient.put(`/educational-resources/admin/${editingResource._id}`, payload);
      } else {
        await apiClient.post('/educational-resources/admin', payload);
      }

      handleCloseDialog();
      fetchResources();
    } catch (err: any) {
      console.error('Error saving resource:', err);
      
      // Handle backend validation errors
      if (err.response?.data?.error?.details) {
        const backendErrors: Record<string, string> = {};
        err.response.data.error.details.forEach((detail: any) => {
          if (detail.field && detail.message) {
            backendErrors[detail.field] = detail.message;
          }
        });
        setValidationErrors(backendErrors);
        setError('Please fix the validation errors below');
      } else {
        setError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to save resource');
      }
    }
  };

  const handleDeleteClick = (resourceId: string) => {
    setResourceToDelete(resourceId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!resourceToDelete) return;

    try {
      await apiClient.delete(`/educational-resources/admin/${resourceToDelete}`);
      setDeleteConfirmOpen(false);
      setResourceToDelete(null);
      fetchResources();
    } catch (err: any) {
      console.error('Error deleting resource:', err);
      setError(err.response?.data?.message || 'Failed to delete resource');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <EducationIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Educational Resources Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage educational content for your workspace and global resources
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={showAnalytics ? "contained" : "outlined"}
            startIcon={<BarChartIcon />}
            onClick={() => setShowAnalytics(!showAnalytics)}
            size="large"
          >
            {showAnalytics ? 'Hide' : 'View'} Analytics
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            size="large"
          >
            Add Resource
          </Button>
        </Box>
      </Box>

      {/* Analytics Dashboard */}
      {showAnalytics && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Suspense fallback={
              <Box display="flex" justifyContent="center" alignItems="center" p={4}>
                <CircularProgress />
              </Box>
            }>
              <ResourceAnalyticsDashboard />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="resource tabs">
          <Tab
            icon={<BusinessIcon />}
            iconPosition="start"
            label={`Workspace Resources (${user?.pharmacyName || 'Your Workspace'})`}
          />
          <Tab icon={<PublicIcon />} iconPosition="start" label="Global Resources" />
          <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Analytics" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  label="Category"
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Media Type</InputLabel>
                <Select
                  value={filterMediaType}
                  label="Media Type"
                  onChange={(e) => setFilterMediaType(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  {mediaTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => {
                  setFilterCategory('all');
                  setFilterMediaType('all');
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Workspace Resources Tab */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : resources.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Difficulty</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Views</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {resource.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resource.description.substring(0, 60)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={resource.category} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={resource.mediaType} size="small" />
                    </TableCell>
                    <TableCell>
                      {resource.difficulty && (
                        <Chip label={resource.difficulty} size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={resource.isPublished ? 'Published' : 'Draft'}
                        size="small"
                        color={resource.isPublished ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{resource.viewCount || 0}</TableCell>
                    <TableCell align="center">
                      {resource.averageRating ? (
                        <Box>
                          <Typography variant="body2">
                            ⭐ {resource.averageRating.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({resource.totalRatings})
                          </Typography>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDialog(resource)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(resource._id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No workspace-specific resources yet. Click "Add Resource" to create your first resource for your workspace.
          </Alert>
        )}
      </TabPanel>

      {/* Global Resources Tab */}
      <TabPanel value={activeTab} index={1}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : resources.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="center">Views</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PublicIcon color="action" fontSize="small" />
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {resource.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Global resource
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={resource.category} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={resource.mediaType} size="small" />
                    </TableCell>
                    <TableCell align="center">{resource.viewCount || 0}</TableCell>
                    <TableCell align="center">
                      {resource.averageRating ? (
                        <Box>
                          <Typography variant="body2">
                            ⭐ {resource.averageRating.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({resource.totalRatings})
                          </Typography>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" color="primary">
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No global resources available.</Alert>
        )}
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={activeTab} index={2}>
        {loadingAnalytics ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : analytics ? (
          <Box>
            {/* Summary Statistics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Resources
                    </Typography>
                    <Typography variant="h3" component="div">
                      {analytics.totalStats?.totalResources || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analytics.totalStats?.publishedResources || 0} published
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Views
                    </Typography>
                    <Typography variant="h3" component="div">
                      {analytics.totalStats?.totalViews || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All time
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Average Rating
                    </Typography>
                    <Typography variant="h3" component="div">
                      {analytics.totalStats?.averageRating?.toFixed(1) || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ⭐ Out of 5
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Downloads
                    </Typography>
                    <Typography variant="h3" component="div">
                      {analytics.totalStats?.totalDownloads || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All time
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Category Breakdown */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Resources by Category
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Views</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.categoryStats?.map((cat: any) => (
                            <TableRow key={cat.category}>
                              <TableCell>
                                <Chip label={cat.category} size="small" />
                              </TableCell>
                              <TableCell align="right">{cat.count}</TableCell>
                              <TableCell align="right">{cat.views || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Popular Resources */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Most Popular Resources
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell align="right">Views</TableCell>
                            <TableCell align="right">Rating</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.popularResources?.slice(0, 5).map((resource: any) => (
                            <TableRow key={resource._id}>
                              <TableCell>
                                <Typography variant="body2" noWrap>
                                  {resource.title}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{resource.viewCount || 0}</TableCell>
                              <TableCell align="right">
                                {resource.ratings?.averageRating
                                  ? `⭐ ${resource.ratings.averageRating.toFixed(1)}`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Engagement Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Engagement Overview
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h4" color="primary">
                        {((analytics.totalStats?.publishedResources || 0) /
                          (analytics.totalStats?.totalResources || 1) *
                          100).toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Publish Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h4" color="primary">
                        {Math.round(
                          (analytics.totalStats?.totalViews || 0) /
                            (analytics.totalStats?.publishedResources || 1)
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Views per Resource
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h4" color="primary">
                        {analytics.categoryStats?.length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Categories
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h4" color="primary">
                        {Math.round(
                          (analytics.totalStats?.totalDownloads || 0) /
                            (analytics.totalStats?.publishedResources || 1)
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg Downloads per Resource
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        ) : (
          <Alert severity="info">No analytics data available</Alert>
        )}
      </TabPanel>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingResource ? 'Edit Educational Resource' : 'Add New Educational Resource'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                required
                error={!!validationErrors.title}
                helperText={validationErrors.title || 'Maximum 200 characters'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                multiline
                rows={2}
                required
                error={!!validationErrors.description}
                helperText={validationErrors.description || 'Maximum 500 characters'}
              />
            </Grid>
            <Grid item xs={12}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
                  Content *
                </Typography>
                <RichTextEditor
                  value={formData.content}
                  onChange={(value) => handleFormChange('content', value)}
                  placeholder="Enter the main content of the educational resource..."
                  minHeight="400px"
                />
                {validationErrors.content && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {validationErrors.content}
                  </Typography>
                )}
                {!validationErrors.content && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Main content of the educational resource (minimum 10 characters). Use the toolbar to format text, add links, images, and more.
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => handleFormChange('category', e.target.value)}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Media Type</InputLabel>
                <Select
                  value={formData.mediaType}
                  label="Media Type"
                  onChange={(e) => handleFormChange('mediaType', e.target.value)}
                >
                  {mediaTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={formData.difficulty}
                  label="Difficulty"
                  onChange={(e) => handleFormChange('difficulty', e.target.value)}
                >
                  {difficulties.map((diff) => (
                    <MenuItem key={diff.value} value={diff.value}>
                      {diff.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (seconds)"
                type="number"
                value={formData.duration}
                onChange={(e) => handleFormChange('duration', parseInt(e.target.value) || 0)}
                error={!!validationErrors.duration}
                helperText={validationErrors.duration || 'Estimated time to complete in seconds'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags"
                value={formData.tags}
                onChange={(e) => handleFormChange('tags', e.target.value)}
                error={!!validationErrors.tags}
                helperText={validationErrors.tags || 'Comma-separated tags (e.g., diabetes, medication, lifestyle)'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Media URL (Optional)"
                value={formData.mediaUrl}
                onChange={(e) => handleFormChange('mediaUrl', e.target.value)}
                error={!!validationErrors.mediaUrl}
                helperText={validationErrors.mediaUrl || 'External link to video, PDF, or other media (e.g., https://example.com/video.mp4)'}
                placeholder="https://example.com/video.mp4"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Thumbnail URL (Optional)"
                value={formData.thumbnail}
                onChange={(e) => handleFormChange('thumbnail', e.target.value)}
                error={!!validationErrors.thumbnail}
                helperText={validationErrors.thumbnail || 'URL to thumbnail image (e.g., https://example.com/image.jpg)'}
                placeholder="https://example.com/image.jpg"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublished}
                    onChange={(e) => handleFormChange('isPublished', e.target.checked)}
                  />
                }
                label="Published (visible to patients)"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isGlobal}
                    onChange={(e) => handleFormChange('isGlobal', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Make Global Resource</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formData.isGlobal
                        ? 'This resource will be available to all workspaces'
                        : 'This resource will only be available to your workspace'}
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            {/* Display Settings Section */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                  Display Settings
                </FormLabel>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Choose where this resource should be displayed
                </Typography>
                
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.displayLocations.includes('education_page')}
                        onChange={(e) => {
                          const locations = [...formData.displayLocations];
                          if (e.target.checked) {
                            if (!locations.includes('education_page')) {
                              locations.push('education_page');
                            }
                          } else {
                            const index = locations.indexOf('education_page');
                            if (index > -1) locations.splice(index, 1);
                          }
                          handleFormChange('displayLocations', locations.length > 0 ? locations : ['education_page']);
                        }}
                      />
                    }
                    label="Education Page (Default)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.displayLocations.includes('patient_dashboard')}
                        onChange={(e) => {
                          const locations = [...formData.displayLocations];
                          if (e.target.checked) {
                            if (!locations.includes('patient_dashboard')) {
                              locations.push('patient_dashboard');
                            }
                          } else {
                            const index = locations.indexOf('patient_dashboard');
                            if (index > -1) locations.splice(index, 1);
                          }
                          handleFormChange('displayLocations', locations.length > 0 ? locations : ['education_page']);
                        }}
                      />
                    }
                    label="Patient Dashboard"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.displayLocations.includes('workspace_dashboard')}
                        onChange={(e) => {
                          const locations = [...formData.displayLocations];
                          if (e.target.checked) {
                            if (!locations.includes('workspace_dashboard')) {
                              locations.push('workspace_dashboard');
                            }
                          } else {
                            const index = locations.indexOf('workspace_dashboard');
                            if (index > -1) locations.splice(index, 1);
                          }
                          handleFormChange('displayLocations', locations.length > 0 ? locations : ['education_page']);
                        }}
                      />
                    }
                    label="Workspace Dashboard"
                  />
                </FormGroup>

                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isPinned}
                        onChange={(e) => handleFormChange('isPinned', e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Pin to Top (Featured)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Pinned resources appear first on dashboards
                        </Typography>
                      </Box>
                    }
                  />
                </Box>

                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Display Order"
                    type="number"
                    size="small"
                    value={formData.displayOrder}
                    onChange={(e) => handleFormChange('displayOrder', parseInt(e.target.value) || 0)}
                    helperText="Lower numbers appear first (0 = default)"
                    InputProps={{ inputProps: { min: 0, max: 9999 } }}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Scheduling Section */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                  Scheduling (Optional)
                </FormLabel>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Schedule when this resource should be visible
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isScheduled}
                      onChange={(e) => handleFormChange('isScheduled', e.target.checked)}
                    />
                  }
                  label="Enable Scheduling"
                  sx={{ mb: 2 }}
                />

                {formData.isScheduled && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Start Date"
                        type="datetime-local"
                        value={formData.scheduledStartDate}
                        onChange={(e) => handleFormChange('scheduledStartDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        helperText="Resource becomes visible from this date"
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="End Date (Optional)"
                        type="datetime-local"
                        value={formData.scheduledEndDate}
                        onChange={(e) => handleFormChange('scheduledEndDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        helperText="Resource hides after this date"
                      />
                    </Grid>
                  </Grid>
                )}
              </Box>
            </Grid>

            {/* Recommendation Settings Section */}
            <Grid item xs={12}>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                  Recommendation Settings
                </FormLabel>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Configure automatic recommendations for patients
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.autoRecommend}
                      onChange={(e) => handleFormChange('autoRecommend', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">Auto-Recommend</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Include in personalized recommendations
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2 }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Target Conditions"
                      value={formData.recommendationConditions}
                      onChange={(e) => handleFormChange('recommendationConditions', e.target.value)}
                      placeholder="diabetes, hypertension, asthma"
                      helperText="Comma-separated list of conditions (recommend to patients with these conditions)"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Target Medications"
                      value={formData.recommendationMedications}
                      onChange={(e) => handleFormChange('recommendationMedications', e.target.value)}
                      placeholder="metformin, lisinopril, albuterol"
                      helperText="Comma-separated list of medications (recommend to patients taking these)"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Target Age Groups</InputLabel>
                      <Select
                        multiple
                        value={formData.recommendationAgeGroups}
                        onChange={(e) => handleFormChange('recommendationAgeGroups', e.target.value)}
                        label="Target Age Groups"
                        renderValue={(selected) => (selected as string[]).join(', ')}
                      >
                        <MenuItem value="child">
                          <Checkbox checked={formData.recommendationAgeGroups.includes('child')} />
                          Child (0-12)
                        </MenuItem>
                        <MenuItem value="teen">
                          <Checkbox checked={formData.recommendationAgeGroups.includes('teen')} />
                          Teen (13-17)
                        </MenuItem>
                        <MenuItem value="adult">
                          <Checkbox checked={formData.recommendationAgeGroups.includes('adult')} />
                          Adult (18-64)
                        </MenuItem>
                        <MenuItem value="senior">
                          <Checkbox checked={formData.recommendationAgeGroups.includes('senior')} />
                          Senior (65+)
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingResource ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this educational resource? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EducationalResourceManagement;
