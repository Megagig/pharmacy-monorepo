import React, { useState, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  School as EducationIcon,
  Article as ArticleIcon,
  VideoLibrary as VideoIcon,
  PictureAsPdf as PdfIcon,
  Headset as AudioIcon,
  TouchApp as InteractiveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
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
  averageRating?: number;
  totalRatings?: number;
  viewCount?: number;
  slug: string;
  language?: string;
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
      id={`education-tabpanel-${index}`}
      aria-labelledby={`education-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'medication', label: 'Medications' },
  { value: 'condition', label: 'Conditions' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'prevention', label: 'Prevention' },
  { value: 'faq', label: 'FAQs' },
];

const mediaTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'article', label: 'Articles', icon: ArticleIcon },
  { value: 'video', label: 'Videos', icon: VideoIcon },
  { value: 'pdf', label: 'PDFs', icon: PdfIcon },
  { value: 'audio', label: 'Audio', icon: AudioIcon },
  { value: 'interactive', label: 'Interactive', icon: InteractiveIcon },
];

const PatientEducation: React.FC = () => {
  const { user } = usePatientAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [resources, setResources] = useState<EducationalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMediaType, setSelectedMediaType] = useState('all');
  const [recommendations, setRecommendations] = useState<EducationalResource[]>([]);
  const [bookmarkedResources, setBookmarkedResources] = useState<Set<string>>(new Set());
  const [selectedResource, setSelectedResource] = useState<EducationalResource | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchResources();
    fetchRecommendations();
    fetchBookmarkedStatus();
  }, [selectedCategory, selectedMediaType]);

  const fetchBookmarkedStatus = async () => {
    try {
      const response = await apiClient.get('/educational-resources/patient/bookmarks');
      const bookmarked = new Set(
        response.data.data.bookmarks.map((b: any) => b.resourceId._id || b.resourceId)
      );
      setBookmarkedResources(bookmarked);
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        limit: 50,
        sortBy: 'popularity',
      };

      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      if (selectedMediaType !== 'all') {
        params.mediaType = selectedMediaType;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await apiClient.get('/educational-resources/patient', {
        params,
      });

      // Handle response structure: { data: { resources: [...], pagination: {...} } }
      const resourcesData = response.data.data?.resources || response.data.data || response.data || [];
      setResources(Array.isArray(resourcesData) ? resourcesData : []);
    } catch (err: any) {
      console.error('Error fetching educational resources:', err);
      setError(err.response?.data?.message || 'Failed to load educational resources');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await apiClient.get('/educational-resources/patient/recommendations', {
        params: { limit: 6 },
      });
      const recommendationsData = response.data.data || response.data || [];
      setRecommendations(Array.isArray(recommendationsData) ? recommendationsData : []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  const handleSearch = () => {
    fetchResources();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleResourceClick = async (resource: EducationalResource) => {
    try {
      // Track view
      await apiClient.post(`/educational-resources/patient/${resource._id}/view`);

      // Always show content in modal
      setSelectedResource(resource);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Error tracking view:', err);
      // Still show the modal even if tracking fails
      setSelectedResource(resource);
      setViewDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setViewDialogOpen(false);
    setSelectedResource(null);
  };

  // Helper function to decode HTML entities if they exist
  const decodeHtmlEntities = (html: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const handleRating = async (resourceId: string, rating: number) => {
    try {
      await apiClient.post(`/educational-resources/patient/${resourceId}/rate`, {
        rating,
      });
      fetchResources(); // Refresh to get updated rating
    } catch (err) {
      console.error('Error rating resource:', err);
    }
  };

  const handleBookmarkToggle = async (resourceId: string) => {
    try {
      const isBookmarked = bookmarkedResources.has(resourceId);
      
      if (isBookmarked) {
        await apiClient.delete(`/educational-resources/patient/${resourceId}/bookmark`);
        setBookmarkedResources((prev) => {
          const newSet = new Set(prev);
          newSet.delete(resourceId);
          return newSet;
        });
      } else {
        await apiClient.post(`/educational-resources/patient/${resourceId}/bookmark`);
        setBookmarkedResources((prev) => new Set(prev).add(resourceId));
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'video':
        return <VideoIcon />;
      case 'pdf':
        return <PdfIcon />;
      case 'audio':
        return <AudioIcon />;
      case 'interactive':
        return <InteractiveIcon />;
      default:
        return <ArticleIcon />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const renderResourceCard = (resource: EducationalResource) => (
    <Grid item xs={12} sm={6} md={4} key={resource._id}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 6,
          },
        }}
      >
        {resource.thumbnail && (
          <CardMedia
            component="img"
            height="200"
            image={resource.thumbnail}
            alt={resource.title}
            sx={{ objectFit: 'cover' }}
          />
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {getMediaIcon(resource.mediaType)}
            <Chip
              label={resource.category}
              size="small"
              color="primary"
              variant="outlined"
            />
            {resource.difficulty && (
              <Chip
                label={resource.difficulty}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {resource.title}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 2,
            }}
          >
            {resource.description}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {resource.averageRating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="body2">
                  {resource.averageRating.toFixed(1)} ({resource.totalRatings})
                </Typography>
              </Box>
            )}

            {resource.viewCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ViewIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2">{resource.viewCount} views</Typography>
              </Box>
            )}

            {resource.duration && (
              <Typography variant="body2" color="text.secondary">
                {formatDuration(resource.duration)}
              </Typography>
            )}
          </Box>

          {resource.tags && resource.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
              {resource.tags.slice(0, 3).map((tag, index) => (
                <Chip key={index} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => handleResourceClick(resource)}
              startIcon={<ViewIcon />}
            >
              View
            </Button>
            <IconButton
              size="small"
              onClick={() => handleBookmarkToggle(resource._id)}
              color={bookmarkedResources.has(resource._id) ? 'primary' : 'default'}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              {bookmarkedResources.has(resource._id) ? (
                <BookmarkIcon fontSize="small" />
              ) : (
                <BookmarkBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <IconButton
                key={star}
                size="small"
                onClick={() => handleRating(resource._id, star)}
              >
                {star <= (resource.averageRating || 0) ? (
                  <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                ) : (
                  <StarBorderIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            ))}
          </Box>
        </CardActions>
      </Card>
    </Grid>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <EducationIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Health Education
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Learn about your health, medications, and wellness
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Media Type</InputLabel>
                <Select
                  value={selectedMediaType}
                  label="Media Type"
                  onChange={(e) => setSelectedMediaType(e.target.value)}
                >
                  {mediaTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                startIcon={<SearchIcon />}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="education tabs">
          <Tab label="All Resources" />
          <Tab label="Recommended for You" />
          <Tab label="My Bookmarks" icon={<BookmarkIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* All Resources Tab */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Grid item xs={12} sm={6} md={4} key={n}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="60%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : resources.length > 0 ? (
          <Grid container spacing={3}>
            {resources.map((resource) => renderResourceCard(resource))}
          </Grid>
        ) : (
          <Alert severity="info">
            No educational resources found. Try adjusting your search filters.
          </Alert>
        )}
      </TabPanel>

      {/* Recommendations Tab */}
      <TabPanel value={activeTab} index={1}>
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((n) => (
              <Grid item xs={12} sm={6} md={4} key={n}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="60%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : recommendations.length > 0 ? (
          <Grid container spacing={3}>
            {recommendations.map((resource) => renderResourceCard(resource))}
          </Grid>
        ) : (
          <Alert severity="info">
            No personalized recommendations available yet. Complete your health profile to get
            tailored educational content.
          </Alert>
        )}
      </TabPanel>

      {/* Bookmarks Tab */}
      <TabPanel value={activeTab} index={2}>
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((n) => (
              <Grid item xs={12} sm={6} md={4} key={n}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="60%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : resources.filter((r) => bookmarkedResources.has(r._id)).length > 0 ? (
          <Grid container spacing={3}>
            {resources
              .filter((r) => bookmarkedResources.has(r._id))
              .map((resource) => renderResourceCard(resource))}
          </Grid>
        ) : (
          <Alert severity="info">
            You haven't bookmarked any resources yet. Click the bookmark icon on any resource to
            save it for later.
          </Alert>
        )}
      </TabPanel>

      {/* Resource Detail Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        {selectedResource && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getMediaIcon(selectedResource.mediaType)}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h5" component="div">
                    {selectedResource.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip
                      label={selectedResource.category}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {selectedResource.difficulty && (
                      <Chip
                        label={selectedResource.difficulty}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {selectedResource.duration && (
                      <Chip
                        label={formatDuration(selectedResource.duration)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {selectedResource.thumbnail && (
                <Box sx={{ mb: 3 }}>
                  <img
                    src={selectedResource.thumbnail}
                    alt={selectedResource.title}
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                    }}
                  />
                </Box>
              )}

              <Typography variant="body1" paragraph>
                {selectedResource.description}
              </Typography>

              {selectedResource.content && (
                <Box 
                  className="ql-editor"
                  sx={{ 
                    mt: 3,
                    padding: 0,
                    '& p': { 
                      marginBottom: '1em',
                      fontSize: '1rem',
                      lineHeight: 1.6,
                    },
                    '& h1': { 
                      fontSize: '2em',
                      fontWeight: 'bold',
                      marginTop: '0.67em',
                      marginBottom: '0.67em',
                    },
                    '& h2': { 
                      fontSize: '1.5em',
                      fontWeight: 'bold',
                      marginTop: '0.83em',
                      marginBottom: '0.83em',
                    },
                    '& h3': { 
                      fontSize: '1.17em',
                      fontWeight: 'bold',
                      marginTop: '1em',
                      marginBottom: '1em',
                    },
                    '& h4': { 
                      fontSize: '1em',
                      fontWeight: 'bold',
                      marginTop: '1.33em',
                      marginBottom: '1.33em',
                    },
                    '& ul, & ol': { 
                      paddingLeft: '1.5em',
                      marginBottom: '1em',
                    },
                    '& li': {
                      marginBottom: '0.5em',
                    },
                    '& blockquote': {
                      borderLeft: '4px solid #ccc',
                      paddingLeft: '16px',
                      marginLeft: 0,
                      marginRight: 0,
                      fontStyle: 'italic',
                      color: 'rgba(0, 0, 0, 0.6)',
                    },
                    '& pre': {
                      backgroundColor: '#f5f5f5',
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      marginBottom: '1em',
                    },
                    '& code': {
                      backgroundColor: '#f5f5f5',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                    },
                    '& a': {
                      color: '#1976d2',
                      textDecoration: 'underline',
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: '4px',
                      marginTop: '1em',
                      marginBottom: '1em',
                    },
                    '& strong': {
                      fontWeight: 'bold',
                    },
                    '& em': {
                      fontStyle: 'italic',
                    },
                    '& u': {
                      textDecoration: 'underline',
                    },
                    '& s': {
                      textDecoration: 'line-through',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: decodeHtmlEntities(selectedResource.content) }}
                />
              )}

              {selectedResource.tags && selectedResource.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ width: '100%', mb: 1 }}>
                    Tags:
                  </Typography>
                  {selectedResource.tags.map((tag, index) => (
                    <Chip key={index} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              )}

              {selectedResource.averageRating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
                  <StarIcon sx={{ color: 'warning.main' }} />
                  <Typography variant="body1">
                    {selectedResource.averageRating.toFixed(1)} / 5.0
                    {selectedResource.totalRatings && (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        ({selectedResource.totalRatings} ratings)
                      </Typography>
                    )}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <IconButton
                    onClick={() => handleBookmarkToggle(selectedResource._id)}
                    color={bookmarkedResources.has(selectedResource._id) ? 'primary' : 'default'}
                    title="Bookmark"
                  >
                    {bookmarkedResources.has(selectedResource._id) ? (
                      <BookmarkIcon />
                    ) : (
                      <BookmarkBorderIcon />
                    )}
                  </IconButton>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <IconButton
                        key={star}
                        size="small"
                        onClick={() => {
                          handleRating(selectedResource._id, star);
                        }}
                        title={`Rate ${star} stars`}
                      >
                        {star <= (selectedResource.averageRating || 0) ? (
                          <StarIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                        ) : (
                          <StarBorderIcon sx={{ fontSize: 20 }} />
                        )}
                      </IconButton>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {selectedResource.mediaUrl && (
                    <Button
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => window.open(selectedResource.mediaUrl, '_blank')}
                    >
                      Open External Media
                    </Button>
                  )}
                  <Button onClick={handleCloseDialog} variant="contained">
                    Close
                  </Button>
                </Box>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default PatientEducation;
