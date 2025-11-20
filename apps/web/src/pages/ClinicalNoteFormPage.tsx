import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  Paper,
  Container,
  Fade,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Note as NoteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import ClinicalNoteForm from '../components/ClinicalNoteForm';
import ClinicalNotesUXEnhancer from '../components/ClinicalNotesUXEnhancer';

const ClinicalNoteFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const noteId = params.id;
  const isEditing = location.pathname.includes('/edit');
  const patientId = location.state?.patientId || params.patientId;

  // Navigation handlers
  const handleBackNavigation = () => {
    const fromState = location.state?.from;
    if (fromState) {
      navigate(fromState);
    } else {
      navigate('/notes');
    }
  };

  const handleNoteCreated = (note: any) => {
    navigate(`/notes/${note._id}`, {
      replace: true,
      state: {
        from: '/notes',
        message: 'Note created successfully',
      },
    });
  };

  const handleNoteUpdated = (note: unknown) => {
    navigate(`/notes/${note._id}`, {
      replace: true,
      state: {
        from: '/notes',
        message: 'Note updated successfully',
      },
    });
  };

  // Breadcrumb generation
  const getBreadcrumbs = () => {
    const breadcrumbs = [
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
    ];

    if (isEditing) {
      breadcrumbs.push(
        {
          label: 'Note Details',
          path: `/notes/${noteId}`,
          icon: <NoteIcon fontSize="small" />,
        },
        {
          label: 'Edit',
          path: `/notes/${noteId}/edit`,
          icon: <AddIcon fontSize="small" />,
        }
      );
    } else {
      breadcrumbs.push({
        label: 'New Note',
        path: '/notes/new',
        icon: <AddIcon fontSize="small" />,
      });
    }

    return breadcrumbs;
  };

  // Render breadcrumbs
  const renderBreadcrumbs = () => {
    const breadcrumbs = getBreadcrumbs();

    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          mb: 2,
          '& .MuiBreadcrumbs-separator': {
            mx: 1,
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
                  color: 'text.primary',
                  fontWeight: 500,
                }}
              >
                {crumb.icon}
                <Typography variant="body2" color="textPrimary">
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
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
            >
              {crumb.icon}
              <Typography variant="body2">{crumb.label}</Typography>
            </Link>
          );
        })}
      </Breadcrumbs>
    );
  };

  return (
    <ClinicalNotesUXEnhancer context="clinical-note-form-page">
      <Container
        maxWidth="xl"
        sx={{
          py: 3,
          px: { xs: 2, sm: 3 },
          minHeight: 'calc(100vh - 120px)',
        }}
      >
        {/* Page Header */}
        <Box sx={{ mb: 3 }}>
          {renderBreadcrumbs()}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBackNavigation}
                size="sm"
              >
                Back
              </Button>

              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                {isEditing ? 'Edit Clinical Note' : 'Create New Clinical Note'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Form Content */}
        <Fade in timeout={300}>
          <Paper elevation={1} sx={{ p: 3 }}>
            <ClinicalNoteForm
              noteId={noteId}
              patientId={patientId}
              onSave={isEditing ? handleNoteUpdated : handleNoteCreated}
              onCancel={handleBackNavigation}
            />
          </Paper>
        </Fade>
      </Container>
    </ClinicalNotesUXEnhancer>
  );
};

export default ClinicalNoteFormPage;
