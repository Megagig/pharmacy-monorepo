import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Rating,
  TextField,
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Divider,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Collapse,
} from '@mui/material';
import {
  Star,
  StarBorder,
  Send,
  Close,
  Visibility,
  VisibilityOff,
  ThumbUp,
  ThumbDown,
  Comment,
  Person,
  Schedule,
  ExpandMore,
  ExpandLess,
  Refresh,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';

import { usePatientAuth } from '../../hooks/usePatientAuth';

interface RatingCategory {
  id: string;
  name: string;
  description: string;
  rating: number;
}

interface ConsultationRatingData {
  consultationId: string;
  overallRating: number;
  categories: RatingCategory[];
  feedback: string;
  isAnonymous: boolean;
  wouldRecommend: boolean;
  tags: string[];
}

interface RatingSubmission {
  _id: string;
  consultationId: string;
  patientId: string;
  pharmacistId: string;
  overallRating: number;
  categories: RatingCategory[];
  feedback: string;
  isAnonymous: boolean;
  wouldRecommend: boolean;
  tags: string[];
  status: 'pending' | 'published' | 'flagged';
  pharmacistResponse?: {
    message: string;
    respondedAt: string;
    respondedBy: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ConsultationInfo {
  _id: string;
  appointmentId: string;
  patientId: string;
  pharmacistId: string;
  pharmacistName: string;
  type: string;
  date: string;
  duration: number;
  status: 'completed' | 'cancelled';
  hasRating: boolean;
}

interface ConsultationRatingProps {
  consultationId?: string;
  onRatingSubmitted?: (rating: RatingSubmission) => void;
  onClose?: () => void;
  showHistory?: boolean;
}

const ratingCategories: Omit<RatingCategory, 'rating'>[] = [
  {
    id: 'communication',
    name: 'Communication',
    description: 'How well did the pharmacist explain things and listen to your concerns?',
  },
  {
    id: 'knowledge',
    name: 'Professional Knowledge',
    description: 'How knowledgeable was the pharmacist about medications and health topics?',
  },
  {
    id: 'timeliness',
    name: 'Timeliness',
    description: 'Was the consultation on time and efficient?',
  },
  {
    id: 'helpfulness',
    name: 'Helpfulness',
    description: 'How helpful was the pharmacist in addressing your needs?',
  },
  {
    id: 'environment',
    name: 'Environment',
    description: 'How comfortable and professional was the consultation environment?',
  },
];

const predefinedTags = [
  'Excellent service',
  'Very knowledgeable',
  'Great communication',
  'On time',
  'Professional',
  'Helpful advice',
  'Patient and understanding',
  'Thorough explanation',
  'Comfortable environment',
  'Would recommend',
  'Needs improvement',
  'Could be more thorough',
];

// Mock API service
class ConsultationRatingService {
  private static baseUrl = '/api/patient-portal';

  static async getConsultationInfo(consultationId: string): Promise<ConsultationInfo> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      _id: consultationId,
      appointmentId: 'apt_123',
      patientId: 'patient_123',
      pharmacistId: 'pharmacist_456',
      pharmacistName: 'Dr. Sarah Johnson',
      type: 'Medication Therapy Review',
      date: '2024-03-10T10:00:00.000Z',
      duration: 30,
      status: 'completed',
      hasRating: false,
    };
  }

  static async submitRating(data: ConsultationRatingData): Promise<RatingSubmission> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      _id: `rating_${Date.now()}`,
      consultationId: data.consultationId,
      patientId: 'patient_123',
      pharmacistId: 'pharmacist_456',
      overallRating: data.overallRating,
      categories: data.categories,
      feedback: data.feedback,
      isAnonymous: data.isAnonymous,
      wouldRecommend: data.wouldRecommend,
      tags: data.tags,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  static async getRatingHistory(patientId: string): Promise<RatingSubmission[]> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return [
      {
        _id: 'rating_001',
        consultationId: 'consultation_001',
        patientId: patientId,
        pharmacistId: 'pharmacist_456',
        overallRating: 5,
        categories: [
          { id: 'communication', name: 'Communication', description: '', rating: 5 },
          { id: 'knowledge', name: 'Professional Knowledge', description: '', rating: 5 },
          { id: 'timeliness', name: 'Timeliness', description: '', rating: 4 },
          { id: 'helpfulness', name: 'Helpfulness', description: '', rating: 5 },
          { id: 'environment', name: 'Environment', description: '', rating: 4 },
        ],
        feedback: 'Excellent consultation! Dr. Johnson was very thorough and explained everything clearly.',
        isAnonymous: false,
        wouldRecommend: true,
        tags: ['Excellent service', 'Very knowledgeable', 'Great communication'],
        status: 'published',
        pharmacistResponse: {
          message: 'Thank you for your feedback! I\'m glad I could help with your medication questions.',
          respondedAt: '2024-03-11T14:30:00.000Z',
          respondedBy: 'Dr. Sarah Johnson',
        },
        createdAt: '2024-03-10T15:30:00.000Z',
        updatedAt: '2024-03-11T14:30:00.000Z',
      },
    ];
  }
}

const ConsultationRating: React.FC<ConsultationRatingProps> = ({
  consultationId,
  onRatingSubmitted,
  onClose,
  showHistory = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated } = usePatientAuth();
  
  // State management
  const [consultationInfo, setConsultationInfo] = useState<ConsultationInfo | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingSubmission[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showRatingForm, setShowRatingForm] = useState<boolean>(!showHistory);
  const [expandedRating, setExpandedRating] = useState<string | null>(null);

  // Form management
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ConsultationRatingData>({
    defaultValues: {
      consultationId: consultationId || '',
      overallRating: 0,
      categories: ratingCategories.map(cat => ({ ...cat, rating: 0 })),
      feedback: '',
      isAnonymous: false,
      wouldRecommend: true,
      tags: [],
    },
  });

  const watchedValues = watch();

  // Load consultation info
  useEffect(() => {
    if (consultationId && !showHistory) {
      loadConsultationInfo();
    }
  }, [consultationId, showHistory]);

  // Load rating history
  useEffect(() => {
    if (showHistory && user?.id) {
      loadRatingHistory();
    }
  }, [showHistory, user?.id]);

  const loadConsultationInfo = async () => {
    if (!consultationId) return;

    setLoading(true);
    setError(null);

    try {
      const info = await ConsultationRatingService.getConsultationInfo(consultationId);
      setConsultationInfo(info);
      setValue('consultationId', info._id);
    } catch (err: any) {
      console.error('Failed to load consultation info:', err);
      setError(err.message || 'Failed to load consultation information');
    } finally {
      setLoading(false);
    }
  };

  const loadRatingHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const history = await ConsultationRatingService.getRatingHistory(user.id);
      setRatingHistory(history);
    } catch (err: any) {
      console.error('Failed to load rating history:', err);
      setError(err.message || 'Failed to load rating history');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSubmit = async (data: ConsultationRatingData) => {
    if (!isAuthenticated || !user) {
      setError('User not authenticated');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submission = await ConsultationRatingService.submitRating(data);
      onRatingSubmitted?.(submission);
      
      // Reset form or close
      if (onClose) {
        onClose();
      } else {
        setShowRatingForm(false);
        loadRatingHistory();
      }
    } catch (err: any) {
      console.error('Failed to submit rating:', err);
      setError(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryRatingChange = (categoryId: string, rating: number) => {
    const updatedCategories = watchedValues.categories.map(cat =>
      cat.id === categoryId ? { ...cat, rating } : cat
    );
    setValue('categories', updatedCategories);
    
    // Update overall rating based on category averages
    const totalRating = updatedCategories.reduce((sum, cat) => sum + cat.rating, 0);
    const averageRating = totalRating / updatedCategories.length;
    setValue('overallRating', Math.round(averageRating));
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = watchedValues.tags;
    const updatedTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setValue('tags', updatedTags);
  };

  const handleToggleExpand = (ratingId: string) => {
    setExpandedRating(expandedRating === ratingId ? null : ratingId);
  };

  // Render rating form
  const renderRatingForm = () => (
    <Box component="form" onSubmit={handleSubmit(handleRatingSubmit)}>
      {consultationInfo && (
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Rate Your Consultation
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Pharmacist: {consultationInfo.pharmacistName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Type: {consultationInfo.type}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Date: {format(parseISO(consultationInfo.date), 'MMM d, yyyy')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Duration: {consultationInfo.duration} minutes
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Overall Rating */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Overall Rating
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Controller
              name="overallRating"
              control={control}
              rules={{ min: { value: 1, message: 'Please provide a rating' } }}
              render={({ field }) => (
                <Rating
                  {...field}
                  size="large"
                  precision={1}
                  emptyIcon={<StarBorder fontSize="inherit" />}
                />
              )}
            />
            <Typography variant="h6" color="primary">
              {watchedValues.overallRating}/5
            </Typography>
          </Box>
          {errors.overallRating && (
            <Typography variant="caption" color="error">
              {errors.overallRating.message}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Category Ratings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Rate Specific Areas
          </Typography>
          <Grid container spacing={3}>
            {ratingCategories.map((category) => {
              const categoryRating = watchedValues.categories.find(c => c.id === category.id)?.rating || 0;
              
              return (
                <Grid item xs={12} key={category.id}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {category.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {category.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Rating
                        value={categoryRating}
                        onChange={(_, value) => handleCategoryRatingChange(category.id, value || 0)}
                        size="medium"
                        precision={1}
                        emptyIcon={<StarBorder fontSize="inherit" />}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {categoryRating}/5
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Written Feedback
          </Typography>
          <Controller
            name="feedback"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                multiline
                rows={4}
                fullWidth
                placeholder="Share your experience and any specific feedback about your consultation..."
                helperText="Your feedback helps us improve our services"
              />
            )}
          />
        </CardContent>
      </Card>

      {/* Tags */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Tags (Optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select tags that describe your experience
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {predefinedTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onClick={() => handleTagToggle(tag)}
                color={watchedValues.tags.includes(tag) ? 'primary' : 'default'}
                variant={watchedValues.tags.includes(tag) ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Options */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Additional Options
          </Typography>
          
          <Controller
            name="wouldRecommend"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={field.value}
                    icon={<ThumbDown />}
                    checkedIcon={<ThumbUp />}
                  />
                }
                label="I would recommend this pharmacist to others"
                sx={{ mb: 2 }}
              />
            )}
          />

          <Controller
            name="isAnonymous"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={field.value}
                    icon={<Visibility />}
                    checkedIcon={<VisibilityOff />}
                  />
                }
                label="Submit this rating anonymously"
              />
            )}
          />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        {onClose && (
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || watchedValues.overallRating === 0}
          startIcon={submitting ? <CircularProgress size={20} /> : <Send />}
          size="large"
        >
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </Box>
    </Box>
  );

  // Render rating history
  const renderRatingHistory = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Your Rating History
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadRatingHistory}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {!ratingHistory || ratingHistory.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Star sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No ratings yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Your consultation ratings will appear here after you submit them.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {ratingHistory.map((rating) => {
            const isExpanded = expandedRating === rating._id;
            
            return (
              <Card key={rating._id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Rating value={rating.overallRating} readOnly size="small" />
                        <Typography variant="h6">
                          {rating.overallRating}/5
                        </Typography>
                        <Chip
                          label={rating.status}
                          size="small"
                          color={rating.status === 'published' ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary">
                        {format(parseISO(rating.createdAt), 'MMM d, yyyy HH:mm')}
                      </Typography>
                      
                      {rating.isAnonymous && (
                        <Chip label="Anonymous" size="small" sx={{ mt: 1 }} />
                      )}
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(rating._id)}
                    >
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>

                  {rating.feedback && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      "{rating.feedback}"
                    </Typography>
                  )}

                  {rating.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {rating.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}

                  <Collapse in={isExpanded}>
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Category Ratings
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {rating.categories.map((category) => (
                        <Grid item xs={12} sm={6} key={category.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                              {category.name}
                            </Typography>
                            <Rating value={category.rating} readOnly size="small" />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>

                    {rating.pharmacistResponse && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Pharmacist Response
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              <Person fontSize="small" />
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              {rating.pharmacistResponse.respondedBy} • {format(parseISO(rating.pharmacistResponse.respondedAt), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                          <Typography variant="body2">
                            {rating.pharmacistResponse.message}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );

  if (!isAuthenticated || !user) {
    return (
      <Alert severity="warning">
        Please log in to rate consultations.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {showHistory ? (
        <Box>
          {renderRatingHistory()}
          
          {!showRatingForm && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => setShowRatingForm(true)}
                startIcon={<Star />}
              >
                Rate a New Consultation
              </Button>
            </Box>
          )}
          
          {showRatingForm && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                Rate New Consultation
              </Typography>
              {renderRatingForm()}
            </Box>
          )}
        </Box>
      ) : (
        renderRatingForm()
      )}
    </Box>
  );
};

export default ConsultationRating;