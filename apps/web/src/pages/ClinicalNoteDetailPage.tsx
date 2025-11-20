import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  Container,
  Fade,
  Card,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import NoteIcon from '@mui/icons-material/Note';
import EditIcon from '@mui/icons-material/Edit';
import { Link as RouterLink } from 'react-router-dom';
import ClinicalNoteDetail from '../components/ClinicalNoteDetail';
import { useClinicalNoteStore } from '../stores/clinicalNoteStore';
import ErrorBoundary from '../components/ErrorBoundary';

const ClinicalNoteDetailPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const noteId = params.id!;
  const { selectedNote } = useClinicalNoteStore();

  // Navigation handlers
  const handleBackNavigation = () => {
    const fromState = location.state?.from;
    if (fromState) {
      navigate(fromState);
    } else {
      navigate('/notes');
    }
  };

  const handleNavigateToEdit = () => {
    navigate(`/notes/${noteId}/edit`, {
      state: { from: location.pathname },
    });
  };

  const handleNoteDeleted = () => {
    navigate('/notes', {
      replace: true,
      state: {
        message: 'Note deleted successfully',
      },
    });
  };

  // Breadcrumb generation
  const getBreadcrumbs = () => {
    return [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: <HomeIcon fontSize="small" />,
      },
      {
        label: 'Clinical Notes',
        path: '/notes',
        icon: <NoteIcon fontSize="small" />,
      },
      {
        label: selectedNote?.title || 'Note Details',
        path: `/notes/${noteId}`,
        icon: <NoteIcon fontSize="small" />,
      },
    ];
  };

  // Render breadcrumbs
  const renderBreadcrumbs = () => {
    const breadcrumbs = getBreadcrumbs();

    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          mb: 3,
          '& .MuiBreadcrumbs-separator': {
            mx: 1.5,
            color: 'text.secondary',
          },
        }}
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          if (isLast) {
            return (
              <Box
                key={crumb.path}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                {crumb.icon}
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {crumb.label}
                </Typography>
              </Box>
            );
          }

          return (
            <Link
              key={crumb.path}
              component={RouterLink}
              to={crumb.path}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              {crumb.icon}
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {crumb.label}
              </Typography>
            </Link>
          );
        })}
      </Breadcrumbs>
    );
  };

  return (
    <ErrorBoundary>
      <Container
        maxWidth="xl"
        sx={{
          py: 3,
          px: { xs: 2, sm: 3 },
          minHeight: 'calc(100vh - 120px)',
        }}
      >
        {/* Modern Page Header */}
        <Box sx={{ mb: 4 }}>
          {renderBreadcrumbs()}

          <Card
            elevation={1}
            sx={{
              p: 3,
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBackNavigation}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    py: 1.5,
                    fontWeight: 600,
                    borderColor: 'grey.300',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: 'grey.400',
                      backgroundColor: 'grey.50',
                    },
                  }}
                >
                  Back
                </Button>

                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.75rem', md: '2rem' },
                  }}
                >
                  {selectedNote?.title || 'Clinical Note Details'}
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleNavigateToEdit}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                Edit Note
              </Button>
            </Box>
          </Card>
        </Box>

        {/* Enhanced Detail Content */}
        <Fade in timeout={300}>
          <Box>
            <ClinicalNoteDetail
              noteId={noteId}
              onEdit={handleNavigateToEdit}
              onDelete={handleNoteDeleted}
            />
          </Box>
        </Fade>
      </Container>
    </ErrorBoundary>
  );
};

export default ClinicalNoteDetailPage;
