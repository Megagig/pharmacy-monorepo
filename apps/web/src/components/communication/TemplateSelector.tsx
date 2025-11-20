import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  Typography,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search,
  Close,
  TrendingUp,
  LocalPharmacy,
  EventNote,
  Warning,
  ChatBubble,
} from '@mui/icons-material';
import { apiClient } from '../../services/apiClient';

interface MessageTemplate {
  _id: string;
  title: string;
  content: string;
  category: 'medication_instructions' | 'follow_up' | 'side_effects' | 'general';
  variables: string[];
  usageCount: number;
  lastUsedAt?: string;
}

interface TemplateSelectorProps {
  onSelect: (renderedContent: string, template: MessageTemplate) => void;
  onClose: () => void;
  open: boolean;
  initialCategory?: string;
}

const categoryIcons = {
  medication_instructions: <LocalPharmacy fontSize="small" />,
  follow_up: <EventNote fontSize="small" />,
  side_effects: <Warning fontSize="small" />,
  general: <ChatBubble fontSize="small" />,
};

const categoryLabels = {
  medication_instructions: 'Medication Instructions',
  follow_up: 'Follow-up',
  side_effects: 'Side Effects',
  general: 'General',
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  onClose,
  open,
  initialCategory,
}) => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  // Fetch templates
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = { includeGlobal: true };
      if (selectedCategory !== 'all' && selectedCategory !== 'popular') {
        params.category = selectedCategory;
      }

      const endpoint =
        selectedCategory === 'popular'
          ? '/communication/templates/popular?limit=20'
          : '/communication/templates';

      const response = await apiClient.get(endpoint, { params });

      if (response.data.success) {
        setTemplates(response.data.data);
      } else {
        setError('Failed to load templates');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Handle template selection
  const handleTemplateClick = (template: MessageTemplate) => {
    if (template.variables.length > 0) {
      // Show variable input dialog
      setSelectedTemplate(template);
      setVariableValues({});
      setShowVariableDialog(true);
    } else {
      // No variables, use template directly
      useTemplate(template, {});
    }
  };

  // Use template with variables
  const useTemplate = async (template: MessageTemplate, variables: Record<string, string>) => {
    try {
      const response = await apiClient.post(`/communication/templates/${template._id}/use`, {
        variables,
      });

      if (response.data.success) {
        const renderedContent = response.data.data.renderedContent;
        onSelect(renderedContent, template);
        onClose();
      }
    } catch (err) {
      console.error('Error using template:', err);
      setError('Failed to use template');
    }
  };

  // Handle variable dialog submit
  const handleVariableSubmit = () => {
    if (selectedTemplate) {
      // Check if all variables are filled
      const missingVariables = selectedTemplate.variables.filter(
        (variable) => !variableValues[variable]?.trim()
      );

      if (missingVariables.length > 0) {
        setError(`Please fill in: ${missingVariables.join(', ')}`);
        return;
      }

      useTemplate(selectedTemplate, variableValues);
      setShowVariableDialog(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (_event: React.SyntheticEvent, newValue: string) => {
    setSelectedCategory(newValue);
    setSearchQuery('');
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', display: 'flex', flexDirection: 'column' },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Select Message Template</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
          {/* Search */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Category Tabs */}
          <Tabs
            value={selectedCategory}
            onChange={handleCategoryChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="All" value="all" />
            <Tab
              label="Popular"
              value="popular"
              icon={<TrendingUp fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              label="Medication"
              value="medication_instructions"
              icon={categoryIcons.medication_instructions}
              iconPosition="start"
            />
            <Tab
              label="Follow-up"
              value="follow_up"
              icon={categoryIcons.follow_up}
              iconPosition="start"
            />
            <Tab
              label="Side Effects"
              value="side_effects"
              icon={categoryIcons.side_effects}
              iconPosition="start"
            />
            <Tab
              label="General"
              value="general"
              icon={categoryIcons.general}
              iconPosition="start"
            />
          </Tabs>

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {/* Template List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredTemplates.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery ? 'No templates found' : 'No templates available'}
                </Typography>
              </Box>
            ) : (
              <List>
                {filteredTemplates.map((template) => (
                  <ListItem key={template._id} disablePadding>
                    <ListItemButton onClick={() => handleTemplateClick(template)}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">{template.title}</Typography>
                            {template.variables.length > 0 && (
                              <Chip
                                label={`${template.variables.length} variables`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {template.usageCount > 0 && (
                              <Chip
                                label={`Used ${template.usageCount}x`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {template.content}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Variable Input Dialog */}
      <Dialog
        open={showVariableDialog}
        onClose={() => setShowVariableDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Fill in Template Variables</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Template: {selectedTemplate.title}
              </Typography>

              {selectedTemplate.variables.map((variable) => (
                <TextField
                  key={variable}
                  fullWidth
                  label={variable.replace(/([A-Z])/g, ' $1').trim()}
                  value={variableValues[variable] || ''}
                  onChange={(e) =>
                    setVariableValues((prev) => ({
                      ...prev,
                      [variable]: e.target.value,
                    }))
                  }
                  margin="normal"
                  placeholder={`Enter ${variable}`}
                />
              ))}

              {/* Preview */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Preview:
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedTemplate.content.replace(/{{(\w+)}}/g, (match, variable) => {
                    return variableValues[variable] || match;
                  })}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVariableDialog(false)}>Cancel</Button>
          <Button onClick={handleVariableSubmit} variant="contained">
            Use Template
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TemplateSelector;
