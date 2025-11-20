import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Drawer,
  AppBar,
  Toolbar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Alert,
  Snackbar,
  LinearProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Slider,
  Stack,
} from '@mui/material';
import {
  DragIndicator,
  Add,
  Delete,
  Edit,
  Save,
  Preview,
  Undo,
  Redo,
  ContentCopy,
  ContentPaste,
  Settings,
  Palette,
  ViewModule,
  BarChart,
  TableChart,
  Assessment,
  TextFields,
  Image,
  ExpandMore,
  Close,
  Visibility,
  VisibilityOff,
  GridOn,
  FormatPaint,
  Code,
  Share,
  Download,
  Upload,
  Help,
} from '@mui/icons-material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTemplatesStore } from '../../stores/templatesStore';
import { useChartsStore } from '../../stores/chartsStore';
import { useFiltersStore } from '../../stores/filtersStore';
import {
  ReportTemplate,
  TemplateBuilder,
  TemplateSection,
  SectionContent,
  LayoutConfig,
  DraggedItem,
  ValidationError,
  HistoryEntry,
} from '../../types/templates';
import { ChartType, ChartConfig } from '../../types/charts';
import { FilterDefinition } from '../../types/filters';
import { generateId } from '../../utils/chartHelpers';
import { maxWidth } from '@mui/system';

interface ReportTemplateBuilderProps {
  templateId?: string;
  onSave?: (template: ReportTemplate) => void;
  onCancel?: () => void;
  onPreview?: (template: ReportTemplate) => void;
}

interface DraggableItemProps {
  type: 'section' | 'chart' | 'table' | 'metric';
  data: any;
  children: React.ReactNode;
}

interface DropZoneProps {
  onDrop: (item: DraggedItem, position: number) => void;
  children: React.ReactNode;
  position: number;
}

const ITEM_TYPES = {
  SECTION: 'section',
  CHART: 'chart',
  TABLE: 'table',
  METRIC: 'metric',
};

const DraggableItem: React.FC<DraggableItemProps> = ({
  type,
  data,
  children,
}) => {
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPES.SECTION,
    item: { type, data, source: 'palette' },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <Box
      ref={drag}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      {children}
    </Box>
  );
};

const DropZone: React.FC<DropZoneProps> = ({ onDrop, children, position }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPES.SECTION,
    drop: (item: DraggedItem) => {
      onDrop(item, position);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <Box
      ref={drop}
      sx={{
        minHeight: 100,
        border:
          isOver && canDrop ? '2px dashed #1976d2' : '2px dashed transparent',
        borderRadius: 1,
        backgroundColor:
          isOver && canDrop ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {children}
      {isOver && canDrop && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'primary.main',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            typography: 'body2',
            fontWeight: 'bold',
          }}
        >
          Drop here
        </Box>
      )}
    </Box>
  );
};

export const ReportTemplateBuilder: React.FC<ReportTemplateBuilderProps> = ({
  templateId,
  onSave,
  onCancel,
  onPreview,
}) => {
  const {
    builder,
    setBuilder,
    updateBuilder,
    addTemplate,
    updateTemplate,
    getTemplate,
  } = useTemplatesStore();

  const { charts } = useChartsStore();
  const { filterDefinitions } = useFiltersStore();

  // UI State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Template state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');

  // Initialize builder
  useEffect(() => {
    if (templateId) {
      const existingTemplate = getTemplate(templateId);
      if (existingTemplate) {
        const newBuilder: TemplateBuilder = {
          template: existingTemplate,
          currentSection: null,
          draggedItem: null,
          clipboard: null,
          history: [],
          historyIndex: -1,
          isDirty: false,
          isValid: true,
          errors: [],
        };
        setBuilder(newBuilder);
        setTemplateName(existingTemplate.name);
        setTemplateDescription(existingTemplate.description);
        setTemplateCategory(existingTemplate.metadata.category);
      }
    } else {
      // Create new template
      const newTemplate: ReportTemplate = {
        id: generateId(),
        name: 'New Template',
        description: '',
        reportType: 'custom',
        layout: {
          type: 'custom',
          grid: {
            columns: 12,
            rows: 10,
            gap: 16,
            autoFlow: 'row',
          },
          responsive: true,
          theme: 'default',
          spacing: {
            top: 16,
            right: 16,
            bottom: 16,
            left: 16,
          },
          breakpoints: {
            xs: { columns: 1 },
            sm: { columns: 2 },
            md: { columns: 4 },
            lg: { columns: 6 },
            xl: { columns: 12 },
          },
        },
        filters: [],
        charts: [],
        tables: [],
        sections: [],
        metadata: {
          category: 'custom',
          tags: [],
          difficulty: 'beginner',
          estimatedTime: 30,
          dataRequirements: [],
          dependencies: [],
          changelog: [],
        },
        permissions: {
          view: ['*'],
          edit: ['owner'],
          delete: ['owner'],
          share: ['owner'],
          export: ['*'],
        },
        createdBy: 'current-user', // TODO: Get from auth context
        workspaceId: 'current-workspace', // TODO: Get from workspace context
        isPublic: false,
        isDefault: false,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newBuilder: TemplateBuilder = {
        template: newTemplate,
        currentSection: null,
        draggedItem: null,
        clipboard: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
        isValid: true,
        errors: [],
      };
      setBuilder(newBuilder);
    }
  }, [templateId, getTemplate, setBuilder]);

  // Handle drag and drop
  const handleDrop = useCallback(
    (item: DraggedItem, position: number) => {
      if (!builder) return;

      const newSection: TemplateSection = {
        id: generateId(),
        type: item.type as any,
        title: item.data.title || `New ${item.type}`,
        content: item.data,
        layout: {
          span: { columns: 6, rows: 4 },
          alignment: { horizontal: 'stretch', vertical: 'stretch' },
          padding: { top: 16, right: 16, bottom: 16, left: 16 },
          margin: { top: 0, right: 0, bottom: 16, left: 0 },
        },
        visibility: {
          conditions: [],
          roles: [],
          permissions: [],
        },
        order: position,
      };

      const updatedSections = [...builder.template.sections];
      updatedSections.splice(position, 0, newSection);

      // Update order for subsequent sections
      updatedSections.forEach((section, index) => {
        section.order = index;
      });

      const historyEntry: HistoryEntry = {
        action: 'add',
        target: newSection.id,
        before: null,
        after: newSection,
        timestamp: new Date(),
      };

      updateBuilder({
        template: {
          ...builder.template,
          sections: updatedSections,
        },
        history: [
          ...builder.history.slice(0, builder.historyIndex + 1),
          historyEntry,
        ],
        historyIndex: builder.historyIndex + 1,
        isDirty: true,
      });

      setSnackbar({
        open: true,
        message: `${item.type} section added successfully`,
        severity: 'success',
      });
    },
    [builder, updateBuilder]
  );

  // Handle section selection
  const handleSectionSelect = useCallback((sectionId: string) => {
    setSelectedSection(sectionId);
    setPropertiesOpen(true);
  }, []);

  // Handle section deletion
  const handleSectionDelete = useCallback(
    (sectionId: string) => {
      if (!builder) return;

      const sectionIndex = builder.template.sections.findIndex(
        (s) => s.id === sectionId
      );
      if (sectionIndex === -1) return;

      const section = builder.template.sections[sectionIndex];
      const updatedSections = builder.template.sections.filter(
        (s) => s.id !== sectionId
      );

      // Update order for subsequent sections
      updatedSections.forEach((section, index) => {
        section.order = index;
      });

      const historyEntry: HistoryEntry = {
        action: 'remove',
        target: sectionId,
        before: section,
        after: null,
        timestamp: new Date(),
      };

      updateBuilder({
        template: {
          ...builder.template,
          sections: updatedSections,
        },
        history: [
          ...builder.history.slice(0, builder.historyIndex + 1),
          historyEntry,
        ],
        historyIndex: builder.historyIndex + 1,
        isDirty: true,
      });

      if (selectedSection === sectionId) {
        setSelectedSection(null);
        setPropertiesOpen(false);
      }

      setSnackbar({
        open: true,
        message: 'Section deleted successfully',
        severity: 'success',
      });
    },
    [builder, updateBuilder, selectedSection]
  );

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    if (!builder || builder.historyIndex < 0) return;

    const historyEntry = builder.history[builder.historyIndex];
    let updatedTemplate = { ...builder.template };

    switch (historyEntry.action) {
      case 'add':
        updatedTemplate.sections = updatedTemplate.sections.filter(
          (s) => s.id !== historyEntry.target
        );
        break;
      case 'remove':
        if (historyEntry.before) {
          updatedTemplate.sections.push(historyEntry.before as TemplateSection);
          updatedTemplate.sections.sort((a, b) => a.order - b.order);
        }
        break;
      case 'modify':
        const sectionIndex = updatedTemplate.sections.findIndex(
          (s) => s.id === historyEntry.target
        );
        if (sectionIndex !== -1 && historyEntry.before) {
          updatedTemplate.sections[sectionIndex] =
            historyEntry.before as TemplateSection;
        }
        break;
    }

    updateBuilder({
      template: updatedTemplate,
      historyIndex: builder.historyIndex - 1,
      isDirty: true,
    });
  }, [builder, updateBuilder]);

  const handleRedo = useCallback(() => {
    if (!builder || builder.historyIndex >= builder.history.length - 1) return;

    const historyEntry = builder.history[builder.historyIndex + 1];
    let updatedTemplate = { ...builder.template };

    switch (historyEntry.action) {
      case 'add':
        if (historyEntry.after) {
          updatedTemplate.sections.push(historyEntry.after as TemplateSection);
          updatedTemplate.sections.sort((a, b) => a.order - b.order);
        }
        break;
      case 'remove':
        updatedTemplate.sections = updatedTemplate.sections.filter(
          (s) => s.id !== historyEntry.target
        );
        break;
      case 'modify':
        const sectionIndex = updatedTemplate.sections.findIndex(
          (s) => s.id === historyEntry.target
        );
        if (sectionIndex !== -1 && historyEntry.after) {
          updatedTemplate.sections[sectionIndex] =
            historyEntry.after as TemplateSection;
        }
        break;
    }

    updateBuilder({
      template: updatedTemplate,
      historyIndex: builder.historyIndex + 1,
      isDirty: true,
    });
  }, [builder, updateBuilder]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!builder) return;

    const updatedTemplate: ReportTemplate = {
      ...builder.template,
      name: templateName,
      description: templateDescription,
      metadata: {
        ...builder.template.metadata,
        category: templateCategory,
      },
      updatedAt: new Date(),
    };

    if (templateId) {
      updateTemplate(templateId, updatedTemplate);
    } else {
      addTemplate(updatedTemplate);
    }

    updateBuilder({
      template: updatedTemplate,
      isDirty: false,
    });

    setSaveDialogOpen(false);
    onSave?.(updatedTemplate);

    setSnackbar({
      open: true,
      message: 'Template saved successfully',
      severity: 'success',
    });
  }, [
    builder,
    templateName,
    templateDescription,
    templateCategory,
    templateId,
    updateTemplate,
    addTemplate,
    updateBuilder,
    onSave,
  ]);

  // Handle preview
  const handlePreview = useCallback(() => {
    if (!builder) return;

    const previewTemplate: ReportTemplate = {
      ...builder.template,
      name: templateName,
      description: templateDescription,
      metadata: {
        ...builder.template.metadata,
        category: templateCategory,
      },
    };

    onPreview?.(previewTemplate);
    setPreviewMode(true);
  }, [builder, templateName, templateDescription, templateCategory, onPreview]);

  if (!builder) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <LinearProgress sx={{ width: 300 }} />
      </Box>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Drawer
          variant="persistent"
          anchor="left"
          open={drawerOpen}
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Template Builder
            </Typography>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
            >
              <Tab label="Components" />
              <Tab label="Settings" />
            </Tabs>
          </Box>

          <Divider />

          {activeTab === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sections
              </Typography>
              <List dense>
                <DraggableItem
                  type="section"
                  data={{ type: 'header', title: 'Header Section' }}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <TextFields />
                    </ListItemIcon>
                    <ListItemText primary="Header" />
                  </ListItemButton>
                </DraggableItem>

                <DraggableItem
                  type="section"
                  data={{ type: 'summary', title: 'Summary Section' }}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <Assessment />
                    </ListItemIcon>
                    <ListItemText primary="Summary" />
                  </ListItemButton>
                </DraggableItem>

                <DraggableItem
                  type="section"
                  data={{ type: 'charts', title: 'Charts Section' }}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <BarChart />
                    </ListItemIcon>
                    <ListItemText primary="Charts" />
                  </ListItemButton>
                </DraggableItem>

                <DraggableItem
                  type="section"
                  data={{ type: 'tables', title: 'Tables Section' }}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <TableChart />
                    </ListItemIcon>
                    <ListItemText primary="Tables" />
                  </ListItemButton>
                </DraggableItem>

                <DraggableItem
                  type="section"
                  data={{ type: 'text', title: 'Text Section' }}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <TextFields />
                    </ListItemIcon>
                    <ListItemText primary="Text" />
                  </ListItemButton>
                </DraggableItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Charts
              </Typography>
              <List dense>
                {Object.entries(charts)
                  .slice(0, 5)
                  .map(([id, chart]) => (
                    <DraggableItem
                      key={id}
                      type="chart"
                      data={{ chartId: id, title: chart.title }}
                    >
                      <ListItemButton>
                        <ListItemIcon>
                          <BarChart />
                        </ListItemIcon>
                        <ListItemText
                          primary={chart.title}
                          secondary={chart.type}
                        />
                      </ListItemButton>
                    </DraggableItem>
                  ))}
              </List>
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                multiline
                rows={3}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Category</InputLabel>
                <Select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                >
                  <MenuItem value="patient-outcomes">Patient Outcomes</MenuItem>
                  <MenuItem value="pharmacist-interventions">
                    Pharmacist Interventions
                  </MenuItem>
                  <MenuItem value="therapy-effectiveness">
                    Therapy Effectiveness
                  </MenuItem>
                  <MenuItem value="quality-improvement">
                    Quality Improvement
                  </MenuItem>
                  <MenuItem value="regulatory-compliance">
                    Regulatory Compliance
                  </MenuItem>
                  <MenuItem value="cost-effectiveness">
                    Cost Effectiveness
                  </MenuItem>
                  <MenuItem value="operational-efficiency">
                    Operational Efficiency
                  </MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Layout Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={builder.template.layout.responsive}
                    onChange={(e) =>
                      updateBuilder({
                        template: {
                          ...builder.template,
                          layout: {
                            ...builder.template.layout,
                            responsive: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Responsive Layout"
              />

              <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                Grid Columns: {builder.template.layout.grid.columns}
              </Typography>
              <Slider
                value={builder.template.layout.grid.columns}
                onChange={(_, value) =>
                  updateBuilder({
                    template: {
                      ...builder.template,
                      layout: {
                        ...builder.template.layout,
                        grid: {
                          ...builder.template.layout.grid,
                          columns: value as number,
                        },
                      },
                    },
                  })
                }
                min={1}
                max={24}
                step={1}
                marks
              />
            </Box>
          )}
        </Drawer>

        {/* Main Content */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
              <IconButton
                edge="start"
                onClick={() => setDrawerOpen(!drawerOpen)}
              >
                <ViewModule />
              </IconButton>

              <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
                {templateName || 'New Template'}
              </Typography>

              <Stack direction="row" spacing={1}>
                <Tooltip title="Undo">
                  <span>
                    <IconButton
                      onClick={handleUndo}
                      disabled={builder.historyIndex < 0}
                    >
                      <Undo />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Redo">
                  <span>
                    <IconButton
                      onClick={handleRedo}
                      disabled={
                        builder.historyIndex >= builder.history.length - 1
                      }
                    >
                      <Redo />
                    </IconButton>
                  </span>
                </Tooltip>

                <Divider orientation="vertical" flexItem />

                <Button
                  startIcon={<Preview />}
                  onClick={handlePreview}
                  variant="outlined"
                >
                  Preview
                </Button>

                <Button
                  startIcon={<Save />}
                  onClick={() => setSaveDialogOpen(true)}
                  variant="contained"
                  disabled={!builder.isDirty}
                >
                  Save
                </Button>

                <IconButton onClick={onCancel}>
                  <Close />
                </IconButton>
              </Stack>
            </Toolbar>
          </AppBar>

          {/* Canvas */}
          <Box
            sx={{
              flexGrow: 1,
              p: 2,
              overflow: 'auto',
              backgroundColor: 'grey.50',
            }}
          >
            <Paper sx={{ minHeight: '100%', p: 2 }}>
              <Grid container spacing={2}>
                {builder.template.sections.length === 0 ? (
                  <Grid item xs={12}>
                    <DropZone onDrop={handleDrop} position={0}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 400,
                          border: '2px dashed',
                          borderColor: 'grey.300',
                          borderRadius: 1,
                          color: 'grey.500',
                        }}
                      >
                        <ViewModule sx={{ fontSize: 48, mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Start Building Your Template
                        </Typography>
                        <Typography variant="body2" textAlign="center">
                          Drag components from the sidebar to create your custom
                          report template
                        </Typography>
                      </Box>
                    </DropZone>
                  </Grid>
                ) : (
                  builder.template.sections
                    .sort((a, b) => a.order - b.order)
                    .map((section, index) => (
                      <Grid
                        key={section.id}
                        item
                        xs={12}
                        md={section.layout.span.columns}
                      >
                        <DropZone onDrop={handleDrop} position={index}>
                          <Card
                            sx={{
                              minHeight: section.layout.span.rows * 50,
                              cursor: 'pointer',
                              border: selectedSection === section.id ? 2 : 1,
                              borderColor:
                                selectedSection === section.id
                                  ? 'primary.main'
                                  : 'grey.300',
                              '&:hover': {
                                borderColor: 'primary.main',
                                boxShadow: 2,
                              },
                            }}
                            onClick={() => handleSectionSelect(section.id)}
                          >
                            <CardContent>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  mb: 1,
                                }}
                              >
                                <DragIndicator
                                  sx={{ mr: 1, color: 'grey.400' }}
                                />
                                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                  {section.title}
                                </Typography>
                                <Chip
                                  label={section.type}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {section.type === 'header' &&
                                  'Header section with title and metadata'}
                                {section.type === 'summary' &&
                                  'Summary metrics and KPIs'}
                                {section.type === 'charts' &&
                                  'Data visualizations and charts'}
                                {section.type === 'tables' &&
                                  'Tabular data display'}
                                {section.type === 'text' &&
                                  'Custom text content'}
                              </Typography>
                            </CardContent>
                            <CardActions>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSectionSelect(section.id);
                                }}
                              >
                                <Edit />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSectionDelete(section.id);
                                }}
                              >
                                <Delete />
                              </IconButton>
                            </CardActions>
                          </Card>
                        </DropZone>
                        {index < builder.template.sections.length - 1 && (
                          <DropZone onDrop={handleDrop} position={index + 1}>
                            <Box sx={{ height: 20 }} />
                          </DropZone>
                        )}
                      </Grid>
                    ))
                )}
              </Grid>
            </Paper>
          </Box>
        </Box>

        {/* Properties Panel */}
        <Drawer
          variant="temporary"
          anchor="right"
          open={propertiesOpen}
          onClose={() => setPropertiesOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 400,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="h6">Section Properties</Typography>
              <IconButton onClick={() => setPropertiesOpen(false)}>
                <Close />
              </IconButton>
            </Box>

            {selectedSection && (
              <SectionPropertiesPanel
                section={
                  builder.template.sections.find(
                    (s) => s.id === selectedSection
                  )!
                }
                onUpdate={(updatedSection) => {
                  const updatedSections = builder.template.sections.map((s) =>
                    s.id === selectedSection ? updatedSection : s
                  );

                  const historyEntry: HistoryEntry = {
                    action: 'modify',
                    target: selectedSection,
                    before: builder.template.sections.find(
                      (s) => s.id === selectedSection
                    )!,
                    after: updatedSection,
                    timestamp: new Date(),
                  };

                  updateBuilder({
                    template: {
                      ...builder.template,
                      sections: updatedSections,
                    },
                    history: [
                      ...builder.history.slice(0, builder.historyIndex + 1),
                      historyEntry,
                    ],
                    historyIndex: builder.historyIndex + 1,
                    isDirty: true,
                  });
                }}
              />
            )}
          </Box>
        </Drawer>

        {/* Save Dialog */}
        <Dialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Save Template</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              multiline
              rows={3}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
              >
                <MenuItem value="patient-outcomes">Patient Outcomes</MenuItem>
                <MenuItem value="pharmacist-interventions">
                  Pharmacist Interventions
                </MenuItem>
                <MenuItem value="therapy-effectiveness">
                  Therapy Effectiveness
                </MenuItem>
                <MenuItem value="quality-improvement">
                  Quality Improvement
                </MenuItem>
                <MenuItem value="regulatory-compliance">
                  Regulatory Compliance
                </MenuItem>
                <MenuItem value="cost-effectiveness">
                  Cost Effectiveness
                </MenuItem>
                <MenuItem value="operational-efficiency">
                  Operational Efficiency
                </MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Template Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sections: {builder.template.sections.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Charts: {builder.template.charts.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tables: {builder.template.tables.length}
              </Typography>
            </Box>

            {builder.errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Validation Errors:
                </Typography>
                {builder.errors.map((error, index) => (
                  <Typography key={index} variant="body2">
                    • {error.message}
                  </Typography>
                ))}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={!templateName.trim() || builder.errors.length > 0}
            >
              Save Template
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DndProvider>
  );
};

// Section Properties Panel Component
interface SectionPropertiesPanelProps {
  section: TemplateSection;
  onUpdate: (section: TemplateSection) => void;
}

const SectionPropertiesPanel: React.FC<SectionPropertiesPanelProps> = ({
  section,
  onUpdate,
}) => {
  const [localSection, setLocalSection] = useState(section);

  useEffect(() => {
    setLocalSection(section);
  }, [section]);

  const handleUpdate = (updates: Partial<TemplateSection>) => {
    const updatedSection = { ...localSection, ...updates };
    setLocalSection(updatedSection);
    onUpdate(updatedSection);
  };

  return (
    <Box>
      <TextField
        fullWidth
        label="Section Title"
        value={localSection.title}
        onChange={(e) => handleUpdate({ title: e.target.value })}
        margin="normal"
      />

      <FormControl fullWidth margin="normal">
        <InputLabel>Section Type</InputLabel>
        <Select
          value={localSection.type}
          onChange={(e) =>
            handleUpdate({ type: e.target.value as TemplateSection['type'] })
          }
        >
          <MenuItem value="header">Header</MenuItem>
          <MenuItem value="summary">Summary</MenuItem>
          <MenuItem value="charts">Charts</MenuItem>
          <MenuItem value="tables">Tables</MenuItem>
          <MenuItem value="text">Text</MenuItem>
        </Select>
      </FormControl>

      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Layout Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Column Span: {localSection.layout.span.columns}
          </Typography>
          <Slider
            value={localSection.layout.span.columns}
            onChange={(_, value) =>
              handleUpdate({
                layout: {
                  ...localSection.layout,
                  span: {
                    ...localSection.layout.span,
                    columns: value as number,
                  },
                },
              })
            }
            min={1}
            max={12}
            step={1}
            marks
          />

          <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
            Row Span: {localSection.layout.span.rows}
          </Typography>
          <Slider
            value={localSection.layout.span.rows}
            onChange={(_, value) =>
              handleUpdate({
                layout: {
                  ...localSection.layout,
                  span: {
                    ...localSection.layout.span,
                    rows: value as number,
                  },
                },
              })
            }
            min={1}
            max={10}
            step={1}
            marks
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Horizontal Alignment</InputLabel>
            <Select
              value={localSection.layout.alignment.horizontal}
              onChange={(e) =>
                handleUpdate({
                  layout: {
                    ...localSection.layout,
                    alignment: {
                      ...localSection.layout.alignment,
                      horizontal: e.target.value as any,
                    },
                  },
                })
              }
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
              <MenuItem value="stretch">Stretch</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Vertical Alignment</InputLabel>
            <Select
              value={localSection.layout.alignment.vertical}
              onChange={(e) =>
                handleUpdate({
                  layout: {
                    ...localSection.layout,
                    alignment: {
                      ...localSection.layout.alignment,
                      vertical: e.target.value as any,
                    },
                  },
                })
              }
            >
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
              <MenuItem value="stretch">Stretch</MenuItem>
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Visibility Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Configure when this section should be visible based on user roles,
            permissions, or data conditions.
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={localSection.visibility.conditions.length === 0}
                onChange={(e) =>
                  handleUpdate({
                    visibility: {
                      ...localSection.visibility,
                      conditions: e.target.checked ? [] : ['always-visible'],
                    },
                  })
                }
              />
            }
            label="Always Visible"
          />

          {localSection.visibility.conditions.length > 0 && (
            <TextField
              fullWidth
              label="Visibility Conditions"
              value={localSection.visibility.conditions.join(', ')}
              onChange={(e) =>
                handleUpdate({
                  visibility: {
                    ...localSection.visibility,
                    conditions: e.target.value
                      .split(',')
                      .map((c) => c.trim())
                      .filter(Boolean),
                  },
                })
              }
              margin="normal"
              helperText="Enter conditions separated by commas"
            />
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Content Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {localSection.type === 'text' && (
            <TextField
              fullWidth
              label="Text Content"
              value={(localSection.content as any)?.text || ''}
              onChange={(e) =>
                handleUpdate({
                  content: {
                    ...localSection.content,
                    text: e.target.value,
                  },
                })
              }
              multiline
              rows={4}
              margin="normal"
            />
          )}

          {localSection.type === 'charts' && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Chart Configuration
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={(localSection.content as any)?.chartType || 'bar'}
                  onChange={(e) =>
                    handleUpdate({
                      content: {
                        ...localSection.content,
                        chartType: e.target.value,
                      },
                    })
                  }
                >
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="pie">Pie Chart</MenuItem>
                  <MenuItem value="area">Area Chart</MenuItem>
                  <MenuItem value="scatter">Scatter Plot</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {localSection.type === 'summary' && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Summary Metrics
              </Typography>
              <TextField
                fullWidth
                label="Metric Keys"
                value={(localSection.content as any)?.metrics?.join(', ') || ''}
                onChange={(e) =>
                  handleUpdate({
                    content: {
                      ...localSection.content,
                      metrics: e.target.value
                        .split(',')
                        .map((m) => m.trim())
                        .filter(Boolean),
                    },
                  })
                }
                margin="normal"
                helperText="Enter metric keys separated by commas"
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

// Properties Panel Component
const PropertiesPanel: React.FC<{ selectedSection: string | null }> = ({ selectedSection }) => (
  <Drawer
    anchor="right"
    open={!!selectedSection}
    variant="persistent"
    sx={{
      '& .MuiDrawer-paper': {
        width: 400,
      },
    }}
  >
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Section Properties
      </Typography>
            {selectedSection && (
              <Box>
                {/* Section properties form would go here */}
                <Typography variant="body2">
                  Properties for section: {selectedSection}
                </Typography>
              </Box>
            )}
          </Box>
        </Drawer>

        {/* Save Dialog */}
        <Dialog
          open={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Save Template</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              multiline
              rows={3}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Category</InputLabel>
              <Select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
              >
                <MenuItem value="patient-outcomes">Patient Outcomes</MenuItem>
                <MenuItem value="pharmacist-interventions">
                  Pharmacist Interventions
                </MenuItem>
                <MenuItem value="therapy-effectiveness">
                  Therapy Effectiveness
                </MenuItem>
                <MenuItem value="quality-improvement">
                  Quality Improvement
                </MenuItem>
                <MenuItem value="regulatory-compliance">
                  Regulatory Compliance
                </MenuItem>
                <MenuItem value="cost-effectiveness">
                  Cost Effectiveness
                </MenuItem>
                <MenuItem value="operational-efficiency">
                  Operational Efficiency
                </MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DndProvider>
  );
};

export default ReportTemplateBuilder;
