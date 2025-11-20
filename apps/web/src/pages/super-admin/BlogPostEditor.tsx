import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Autocomplete,
  Grid,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Paper,
} from '@mui/material';
import {
  Save as SaveIcon,
  Publish as PublishIcon,
  Preview as PreviewIcon,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Editor } from '@tinymce/tinymce-react';
import { useHealthBlog, BlogPost } from '../../hooks/useHealthBlog';
import { useHealthBlogAdmin } from '../../hooks/useHealthBlogAdmin';

interface BlogPostFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  status: 'draft' | 'published' | 'archived';
  featuredImage?: {
    url: string;
    alt: string;
    caption?: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
}

interface BlogPostEditorProps {
  className?: string;
}

const BlogPostEditor: React.FC<BlogPostEditorProps> = ({ className }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id && id !== 'new');

  // State
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Fetch existing post if editing
  const {
    data: postResponse,
    isLoading: postLoading
  } = useHealthBlogAdmin.useAdminPost(id || '', isEditing);

  // Fetch categories and tags for form options
  const { data: categoriesResponse } = useHealthBlog.useCategories();
  const { data: tagsResponse } = useHealthBlog.useTags();

  // Mutations
  const createPostMutation = useHealthBlogAdmin.useCreatePost();
  const updatePostMutation = useHealthBlogAdmin.useUpdatePost();
  const uploadImageMutation = useHealthBlogAdmin.useUploadImage();

  const post = postResponse?.data;
  const categories = categoriesResponse?.data || [];
  const availableTags = tagsResponse?.data?.map(t => t.tag) || [];

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<BlogPostFormData>({
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: 'wellness',
      tags: [],
      isFeatured: false,
      status: 'draft',
      seo: {
        metaTitle: '',
        metaDescription: '',
        keywords: [],
      },
    },
  });

  const watchedTitle = watch('title');
  const watchedContent = watch('content');
  const watchedFeaturedImage = watch('featuredImage');

  // Auto-generate slug from title
  useEffect(() => {
    if (watchedTitle && !isEditing) {
      const slug = watchedTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setValue('slug', slug);
    }
  }, [watchedTitle, setValue, isEditing]);

  // Load existing post data
  useEffect(() => {
    if (post && isEditing) {
      reset({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        tags: post.tags || [],
        isFeatured: post.isFeatured || false,
        status: post.status,
        featuredImage: post.featuredImage,
        seo: {
          metaTitle: post.seo?.metaTitle || '',
          metaDescription: post.seo?.metaDescription || '',
          keywords: post.seo?.keywords || [],
        },
      });
    }
  }, [post, isEditing, reset]);

  // Calculate read time based on content
  const calculateReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const textContent = content.replace(/<[^>]*>/g, '');
    const wordCount = textContent.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  const handleSave = async (data: BlogPostFormData, publish = false) => {
    try {
      const readTime = calculateReadTime(data.content);
      const postData = {
        ...data,
        readTime,
        status: publish ? 'published' as const : data.status,
      };

      if (isEditing && id) {
        await updatePostMutation.mutateAsync({ id, data: postData });
      } else {
        await createPostMutation.mutateAsync(postData);
      }

      navigate('/super-admin/blog');
    } catch (error) {
      console.error('Failed to save post:', error);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImageFile) return;

    try {
      const formData = new FormData();
      formData.append('image', selectedImageFile);

      const response = await uploadImageMutation.mutateAsync(formData);

      setValue('featuredImage', {
        url: response.data.url,
        alt: response.data.alt || selectedImageFile.name,
        caption: response.data.caption,
      });

      setImageUploadDialogOpen(false);
      setSelectedImageFile(null);
      setImagePreview('');
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setValue('featuredImage', undefined);
  };

  if (postLoading && isEditing) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" sx={{ fontSize: '2rem', mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" className={className} sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/super-admin/blog')}
          sx={{ mb: 2 }}
        >
          Back to Blog Management
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit((data) => handleSave(data))}>
        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Post Content
                </Typography>

                {/* Title */}
                <Controller
                  name="title"
                  control={control}
                  rules={{ required: 'Title is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Title"
                      error={!!errors.title}
                      helperText={errors.title?.message}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                {/* Slug */}
                <Controller
                  name="slug"
                  control={control}
                  rules={{ required: 'Slug is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Slug"
                      helperText="URL-friendly version of the title"
                      error={!!errors.slug}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                {/* Excerpt */}
                <Controller
                  name="excerpt"
                  control={control}
                  rules={{ required: 'Excerpt is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Excerpt"
                      helperText="Brief summary of the post (used in previews)"
                      error={!!errors.excerpt}
                      sx={{ mb: 3 }}
                    />
                  )}
                />

                {/* Content Editor */}
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Content
                </Typography>
                <Controller
                  name="content"
                  control={control}
                  rules={{ required: 'Content is required' }}
                  render={({ field }) => (
                    <Box sx={{ mb: 2 }}>
                      <Editor
                        apiKey={import.meta.env.VITE_TINYMCE_API_KEY || 'no-api-key'}
                        value={field.value}
                        onEditorChange={field.onChange}
                        init={{
                          height: 500,
                          menubar: true,
                          plugins: [
                            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                          ],
                          toolbar: 'undo redo | blocks | ' +
                            'bold italic forecolor | alignleft aligncenter ' +
                            'alignright alignjustify | bullist numlist outdent indent | ' +
                            'removeformat | help',
                          content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                          branding: false,
                        }}
                      />
                      {errors.content && (
                        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                          {errors.content.message}
                        </Typography>
                      )}
                    </Box>
                  )}
                />

                {/* Read Time Display */}
                {watchedContent && (
                  <Typography variant="body2" color="text.secondary">
                    Estimated read time: {calculateReadTime(watchedContent)} minutes
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* SEO Section */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  SEO Settings
                </Typography>

                <Controller
                  name="seo.metaTitle"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Meta Title"
                      helperText="SEO title (leave empty to use post title)"
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="seo.metaDescription"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={2}
                      label="Meta Description"
                      helperText="SEO description (leave empty to use excerpt)"
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="seo.keywords"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      multiple
                      freeSolo
                      options={[]}
                      value={field.value}
                      onChange={(_, value) => field.onChange(value)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="SEO Keywords"
                          helperText="Press Enter to add keywords"
                        />
                      )}
                    />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {/* Publish Settings */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Publish Settings
                </Typography>

                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="published">Published</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="isFeatured"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Featured Post"
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Divider sx={{ my: 2 }} />

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={createPostMutation.isPending || updatePostMutation.isPending}
                  >
                    {createPostMutation.isPending || updatePostMutation.isPending
                      ? 'Saving...'
                      : 'Save Draft'
                    }
                  </Button>

                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PublishIcon />}
                    onClick={handleSubmit((data) => handleSave(data, true))}
                    disabled={createPostMutation.isPending || updatePostMutation.isPending}
                  >
                    {createPostMutation.isPending || updatePostMutation.isPending
                      ? 'Publishing...'
                      : 'Publish'
                    }
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={() => setPreviewDialogOpen(true)}
                  >
                    Preview
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Category and Tags */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Classification
                </Typography>

                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        {categories.map((cat) => (
                          <MenuItem key={cat.category} value={cat.category}>
                            {cat.category.replace('_', ' ').toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      multiple
                      freeSolo
                      options={availableTags}
                      value={field.value}
                      onChange={(_, value) => field.onChange(value)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Tags"
                          helperText="Press Enter to add tags"
                        />
                      )}
                    />
                  )}
                />
              </CardContent>
            </Card>

            {/* Featured Image */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Featured Image
                </Typography>

                {watchedFeaturedImage ? (
                  <Box>
                    <Box
                      component="img"
                      src={watchedFeaturedImage.url}
                      alt={watchedFeaturedImage.alt}
                      sx={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                        borderRadius: 1,
                        mb: 2,
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setImageUploadDialogOpen(true)}
                      >
                        Change Image
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleRemoveImage}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => setImageUploadDialogOpen(true)}
                    fullWidth
                  >
                    Upload Featured Image
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>

      {/* Image Upload Dialog */}
      <Dialog open={imageUploadDialogOpen} onClose={() => setImageUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Featured Image</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label htmlFor="image-upload">
              <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />}>
                Select Image
              </Button>
            </label>

            {imagePreview && (
              <Box sx={{ mt: 2 }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    borderRadius: 8,
                  }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleImageUpload}
            variant="contained"
            disabled={!selectedImageFile || uploadImageMutation.isPending}
          >
            {uploadImageMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Post Preview</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              {watchedTitle || 'Untitled Post'}
            </Typography>
            <Box
              sx={{ '& img': { maxWidth: '100%' } }}
              dangerouslySetInnerHTML={{ __html: watchedContent || '<p>No content yet...</p>' }}
            />
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BlogPostEditor;