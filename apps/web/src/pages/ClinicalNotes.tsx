import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  Paper,
  Container,
  Fade,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Home as HomeIcon,
  Note as NoteIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import ClinicalNotesDashboard from '../components/ClinicalNotesDashboard';
import ClinicalNotesUXEnhancer from '../components/ClinicalNotesUXEnhancer';

interface ClinicalNotesPageProps {
  patientId?: string;
}

const ClinicalNotes: React.FC<ClinicalNotesPageProps> = ({ patientId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Navigation handlers
  const handleNavigateToCreate = () => {
    navigate('/notes/new', {
      state: {
        from: location.pathname,
        patientId: patientId,
      },
    });
  };

  const handleNavigateToEdit = (id: string) => {
    navigate(`/notes/${id}/edit`, {
      state: { from: location.pathname },
    });
  };

  const handleNavigateToView = (id: string) => {
    navigate(`/notes/${id}`, {
      state: { from: location.pathname },
    });
  };

  // Render breadcrumbs
  const renderBreadcrumbs = () => {
    return (
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{
          mb: 3,
          '& .MuiBreadcrumbs-separator': {
            mx: 1,
            color: theme.palette.primary.main,
          },
        }}
      >
        <Link
          component={RouterLink}
          to="/dashboard"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            textDecoration: 'none',
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              color: 'primary.main',
              backgroundColor: `${theme.palette.primary.main}10`,
              transform: 'translateY(-1px)',
            },
          }}
        >
          <HomeIcon fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            Dashboard
          </Typography>
        </Link>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'primary.main',
            fontWeight: 600,
            px: 1.5,
            py: 0.5,
            backgroundColor: `${theme.palette.primary.main}15`,
            borderRadius: 2,
          }}
        >
          <NoteIcon fontSize="small" />
          <Typography variant="body2" color="primary" fontWeight={600}>
            Clinical Notes
          </Typography>
        </Box>
      </Breadcrumbs>
    );
  };

  // Render page header
  const renderPageHeader = () => (
    <Box sx={{ mb: 4 }}>
      {renderBreadcrumbs()}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.secondary.main}05 100%)`,
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.02"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.5,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
              mb: 0.5,
            }}
          >
            Clinical Notes
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ opacity: 0.8 }}
          >
            Manage SOAP notes and clinical documentation
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNavigateToCreate}
          sx={{
            minWidth: isMobile ? '100%' : 'auto',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
              boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
              transform: 'translateY(-1px)',
            },
            transition: 'all 0.3s ease-in-out',
            borderRadius: 2,
            px: 3,
            py: 1.5,
            position: 'relative',
            zIndex: 1,
          }}
        >
          New Clinical Note
        </Button>
      </Box>
    </Box>
  );

  return (
    <ClinicalNotesUXEnhancer context="clinical-notes-page">
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.grey[50]} 100%)`,
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            py: 3,
            px: { xs: 2, sm: 3 },
            minHeight: 'calc(100vh - 120px)',
          }}
        >
          {renderPageHeader()}

          <Fade in timeout={500}>
            <Paper
              elevation={0}
              sx={{
                height: 'calc(100vh - 200px)',
                borderRadius: 3,
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <ClinicalNotesDashboard
                patientId={patientId}
                onNoteSelect={handleNavigateToView}
                onNoteEdit={handleNavigateToEdit}
                onNoteCreate={handleNavigateToCreate}
              />
            </Paper>
          </Fade>
        </Container>
      </Box>
    </ClinicalNotesUXEnhancer>
  );
};

export default ClinicalNotes;
