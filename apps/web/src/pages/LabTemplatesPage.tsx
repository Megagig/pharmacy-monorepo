import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Science as ScienceIcon,
  Star as StarIcon,
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Lab Templates Page
 * Manage test panel templates (system and custom)
 * Route: /laboratory/templates
 */

interface TemplateItem {
  testName: string;
  testCode?: string;
  loincCode?: string;
  testCategory: string;
  unit?: string;
  referenceRange?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
}

interface Template {
  _id: string;
  name: string;
  description?: string;
  category: string;
  isSystemTemplate: boolean;
  items: TemplateItem[];
  usageCount: number;
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
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const LabTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Fetch all templates
  const { data: allTemplates, isLoading: loadingAll } = useQuery({
    queryKey: ['lab-templates-all'],
    queryFn: async () => {
      const response = await api.get('/laboratory/templates');
      return response.data.data;
    },
  });

  // Fetch system templates
  const { data: systemTemplates, isLoading: loadingSystem } = useQuery({
    queryKey: ['lab-templates-system'],
    queryFn: async () => {
      const response = await api.get('/laboratory/templates/system');
      return response.data.data;
    },
  });

  // Fetch workplace templates
  const { data: workplaceTemplates, isLoading: loadingWorkplace } = useQuery({
    queryKey: ['lab-templates-workplace'],
    queryFn: async () => {
      const response = await api.get('/laboratory/templates/workplace');
      return response.data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/laboratory/templates/${id}`);
    },
    onSuccess: () => {
      toast.success('Template deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['lab-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['lab-templates-workplace'] });
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle view template
  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setViewDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Render template card
  const renderTemplateCard = (template: Template) => (
    <Grid item xs={12} md={6} lg={4} key={template._id}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="div" noWrap>
              {template.name}
            </Typography>
            {template.isSystemTemplate ? (
              <Tooltip title="System Template">
                <StarIcon color="primary" />
              </Tooltip>
            ) : (
              <Tooltip title="Custom Template">
                <BusinessIcon color="action" />
              </Tooltip>
            )}
          </Box>

          {template.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {template.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip label={template.category} size="small" color="primary" variant="outlined" />
            <Chip label={`${template.items.length} tests`} size="small" />
            <Chip label={`Used ${template.usageCount} times`} size="small" variant="outlined" />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary">
            Tests included:
          </Typography>
          <List dense>
            {template.items.slice(0, 3).map((item, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemText
                  primary={item.testName}
                  secondary={item.testCode}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
            {template.items.length > 3 && (
              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary={`+${template.items.length - 3} more tests`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => handleViewTemplate(template)}
          >
            View Details
          </Button>
          <Box>
            {!template.isSystemTemplate && (
              <>
                <Tooltip title="Edit Template">
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/laboratory/templates/${template._id}/edit`)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Template">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(template._id, template.name)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </CardActions>
      </Card>
    </Grid>
  );

  const templates = activeTab === 0 ? allTemplates : activeTab === 1 ? systemTemplates : workplaceTemplates;
  const isLoading = activeTab === 0 ? loadingAll : activeTab === 1 ? loadingSystem : loadingWorkplace;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/laboratory')} color="primary">
              <ArrowBackIcon />
            </IconButton>
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
                Test Panel Templates
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage reusable test panel templates
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/laboratory/templates/new')}
          >
            Create Template
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="All Templates" />
          <Tab label="System Templates" icon={<StarIcon />} iconPosition="end" />
          <Tab label="My Templates" icon={<BusinessIcon />} iconPosition="end" />
        </Tabs>
      </Paper>

      {/* Templates Grid */}
      <TabPanel value={activeTab} index={0}>
        {isLoading ? (
          <Typography>Loading...</Typography>
        ) : templates && templates.length > 0 ? (
          <Grid container spacing={3}>
            {templates.map((template: Template) => renderTemplateCard(template))}
          </Grid>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No templates found
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/laboratory/templates/new')}
              sx={{ mt: 2 }}
            >
              Create Your First Template
            </Button>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {isLoading ? (
          <Typography>Loading...</Typography>
        ) : templates && templates.length > 0 ? (
          <Grid container spacing={3}>
            {templates.map((template: Template) => renderTemplateCard(template))}
          </Grid>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No system templates found
            </Typography>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {isLoading ? (
          <Typography>Loading...</Typography>
        ) : templates && templates.length > 0 ? (
          <Grid container spacing={3}>
            {templates.map((template: Template) => renderTemplateCard(template))}
          </Grid>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No custom templates found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Create custom templates to streamline your workflow
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/laboratory/templates/new')}
              sx={{ mt: 2 }}
            >
              Create Template
            </Button>
          </Paper>
        )}
      </TabPanel>

      {/* View Template Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{selectedTemplate?.name}</Typography>
            {selectedTemplate?.isSystemTemplate && (
              <Chip label="System Template" color="primary" size="small" icon={<StarIcon />} />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTemplate && (
            <>
              {selectedTemplate.description && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  {selectedTemplate.description}
                </Alert>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Template Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Category
                    </Typography>
                    <Typography variant="body2">{selectedTemplate.category}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Usage Count
                    </Typography>
                    <Typography variant="body2">{selectedTemplate.usageCount} times</Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Tests Included ({selectedTemplate.items.length})
              </Typography>
              <List>
                {selectedTemplate.items.map((item, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={item.testName}
                        secondary={
                          <Box component="span">
                            {item.testCode && (
                              <Typography variant="caption" component="span">
                                Code: {item.testCode}
                              </Typography>
                            )}
                            {item.loincCode && (
                              <Typography variant="caption" component="span" sx={{ ml: 2 }}>
                                LOINC: {item.loincCode}
                              </Typography>
                            )}
                            <br />
                            {item.unit && (
                              <Typography variant="caption" component="span">
                                Unit: {item.unit}
                              </Typography>
                            )}
                            {item.referenceRange && (
                              <Typography variant="caption" component="span" sx={{ ml: 2 }}>
                                Range: {item.referenceRange}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Chip label={item.testCategory} size="small" variant="outlined" />
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < selectedTemplate.items.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedTemplate && !selectedTemplate.isSystemTemplate && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => {
                setViewDialogOpen(false);
                navigate(`/laboratory/templates/${selectedTemplate._id}/edit`);
              }}
            >
              Edit Template
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LabTemplatesPage;

