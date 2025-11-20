import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
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
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  Pagination,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon,
  Article as ArticleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useHealthBlog, BlogPost } from '../../hooks/useHealthBlog';
import { useHealthBlogAdmin } from '../../hooks/useHealthBlogAdmin';

interface BlogManagementProps {
  className?: string;
}

const BlogManagement: React.FC<BlogManagementProps> = ({ className }) => {
  const navigate = useNavigate();

  // State for filters and pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // State for actions
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  // Fetch blog posts for admin
  const {
    data: postsResponse,
    isLoading: postsLoading,
    error: postsError
  } = useHealthBlogAdmin.useAdminPosts({
    page,
    limit: 10,
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });

  // Fetch analytics
  const {
    data: analyticsResponse,
    isLoading: analyticsLoading
  } = useHealthBlogAdmin.useBlogAnalytics();

  // Fetch categories for filter
  const { data: categoriesResponse } = useHealthBlog.useCategories();

  // Mutations
  const deletePostMutation = useHealthBlogAdmin.useDeletePost();
  const updatePostStatusMutation = useHealthBlogAdmin.useUpdatePostStatus();

  const posts = postsResponse?.data?.posts || [];
  const totalCount = postsResponse?.data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 10);
  const analytics = analyticsResponse?.data;
  const categories = categoriesResponse?.data || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' } = {
      nutrition: 'success',
      wellness: 'primary',
      medication: 'info',
      chronic_diseases: 'warning',
      preventive_care: 'secondary',
      mental_health: 'error',
    };
    return colors[category] || 'primary';
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, post: BlogPost) => {
    setAnchorEl(event.currentTarget);
    setSelectedPost(post);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPost(null);
  };

  const handleEdit = () => {
    if (selectedPost) {
      navigate(`/super-admin/blog/edit/${selectedPost._id}`);
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedPost) {
      window.open(`/blog/${selectedPost.slug}`, '_blank');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setPostToDelete(selectedPost);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (postToDelete) {
      try {
        await deletePostMutation.mutateAsync(postToDelete._id);
        setDeleteDialogOpen(false);
        setPostToDelete(null);
      } catch (error) {
        console.error('Failed to delete post:', error);
      }
    }
  };

  const handleStatusChange = async (postId: string, newStatus: 'draft' | 'published' | 'archived') => {
    try {
      await updatePostStatusMutation.mutateAsync({ postId, status: newStatus });
    } catch (error) {
      console.error('Failed to update post status:', error);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  return (
    <Container maxWidth="xl" className={className} sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Blog Management
          </Typography>
          <Button
            component={Link}
            to="/super-admin/blog/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ borderRadius: 2 }}
          >
            Create New Post
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage health blog posts, monitor analytics, and engage with your audience
        </Typography>
      </Box>

      {/* Analytics Cards */}
      {!analyticsLoading && analytics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'primary.light',
                      color: 'primary.main',
                    }}
                  >
                    <ArticleIcon />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {analytics.totalPosts || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Posts
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'success.light',
                      color: 'success.main',
                    }}
                  >
                    <VisibilityIcon />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {(analytics.totalViews || 0).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Views
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'info.light',
                      color: 'info.main',
                    }}
                  >
                    <TrendingUpIcon />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {analytics.avgViewsPerPost || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Views/Post
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'warning.light',
                      color: 'warning.main',
                    }}
                  >
                    <ScheduleIcon />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {analytics.publishedThisMonth || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Published This Month
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search posts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.category} value={cat.category}>
                      {cat.category.replace('_', ' ').toUpperCase()} ({cat.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {postsError && (
            <Alert severity="error" sx={{ m: 2 }}>
              Failed to load blog posts. Please try again.
            </Alert>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Views</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {postsLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : posts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No blog posts found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  posts.map((post) => (
                    <TableRow key={post._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {post.title}
                          </Typography>
                          {post.isFeatured && (
                            <Chip label="Featured" size="small" color="secondary" sx={{ mt: 0.5 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={post.category.replace('_', ' ').toUpperCase()}
                          size="small"
                          color={getCategoryColor(post.category)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={post.status.toUpperCase()}
                          size="small"
                          color={getStatusColor(post.status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {post.author.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {post.viewCount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {post.status === 'published' ? formatDate(post.publishedAt) : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, post)}
                          size="small"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleView}>
          <VisibilityIcon sx={{ mr: 1 }} />
          View
        </MenuItem>
        {selectedPost?.status === 'draft' && (
          <MenuItem onClick={() => selectedPost && handleStatusChange(selectedPost._id, 'published')}>
            <TrendingUpIcon sx={{ mr: 1 }} />
            Publish
          </MenuItem>
        )}
        {selectedPost?.status === 'published' && (
          <MenuItem onClick={() => selectedPost && handleStatusChange(selectedPost._id, 'archived')}>
            <ScheduleIcon sx={{ mr: 1 }} />
            Archive
          </MenuItem>
        )}
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Blog Post</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{postToDelete?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deletePostMutation.isPending}
          >
            {deletePostMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BlogManagement;