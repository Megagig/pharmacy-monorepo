import React, { useState, useCallback, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Grid,
    Card,
    CardContent,
    CardActions,
    CardMedia,
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
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    Divider,
    Menu,
    MenuList,
    MenuItem as MenuItemComponent,
    Avatar,
    Badge,
    Tooltip,
    Alert,
    Snackbar,
    Tabs,
    Tab,
    InputAdornment,
    Fab,
    SpeedDial,
    SpeedDialAction,
    SpeedDialIcon,
    Breadcrumbs,
    Link,
    Stack,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    Share,
    Download,
    Upload,
    ContentCopy,
    Visibility,
    MoreVert,
    Search,
    FilterList,
    Sort,
    ViewModule,
    ViewList,
    Star,
    StarBorder,
    Public,
    Lock,
    Person,
    Group,
    Schedule,
    Assessment,
    BarChart,
    TableChart,
    TextFields,
    Image,
    Folder,
    FolderOpen,
    NavigateNext,
    Close,
    CloudUpload,
    GetApp,
    FileCopy,
} from '@mui/icons-material';
import { useTemplatesStore } from '../../stores/templatesStore';
import { ReportTemplate, TemplateCategory, TemplateShare } from '../../types/templates';
import { formatDistanceToNow } from 'date-fns';
import ReportTemplateBuilder from './ReportTemplateBuilder';
import TemplatePreview from './TemplatePreview';
import TemplateMarketplace from './TemplateMarketplace';
import TemplateSharing from './TemplateSharing';

interface TemplateManagementProps {
    onTemplateSelect?: (template: ReportTemplate) => void;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'created' | 'updated' | 'category' | 'usage';
type FilterBy = 'all' | 'my-templates' | 'shared' | 'public' | 'favorites';

export const TemplateManagement: React.FC<TemplateManagementProps> = ({
    onTemplateSelect,
}) => {
    const {
        templates,
        categories,
        selectedTemplate,
        setSelectedTemplate,
        addTemplate,
        updateTemplate,
        removeTemplate,
        getUserTemplates,
        getPublicTemplates,
        getFeaturedTemplates,
        getTemplatesByCategory,
    } = useTemplatesStore();

    // UI State
    const [activeTab, setActiveTab] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [sortBy, setSortBy] = useState<SortBy>('updated');
    const [filterBy, setFilterBy] = useState<FilterBy>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Dialog states
    const [builderOpen, setBuilderOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [marketplaceOpen, setMarketplaceOpen] = useState(false);
    const [sharingOpen, setSharingOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // Menu states
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTemplate, setMenuTemplate] = useState<ReportTemplate | null>(null);

    // Other states
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'warning' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'info',
    });

    // Load favorites from localStorage
    useEffect(() => {
        const savedFavorites = localStorage.getItem('template-favorites');
        if (savedFavorites) {
            setFavorites(new Set(JSON.parse(savedFavorites)));
        }
    }, []);

    // Save favorites to localStorage
    const saveFavorites = useCallback((newFavorites: Set<string>) => {
        setFavorites(newFavorites);
        localStorage.setItem('template-favorites', JSON.stringify(Array.from(newFavorites)));
    }, []);

    // Filter and sort templates
    const filteredTemplates = React.useMemo(() => {
        let result = Object.values(templates);

        // Apply filter
        switch (filterBy) {
            case 'my-templates':
                result = getUserTemplates('current-user'); // TODO: Get from auth context
                break;
            case 'shared':
                result = result.filter(t => !t.isPublic && t.createdBy !== 'current-user');
                break;
            case 'public':
                result = getPublicTemplates();
                break;
            case 'favorites':
                result = result.filter(t => favorites.has(t.id));
                break;
        }

        // Apply category filter
        if (selectedCategory !== 'all') {
            result = result.filter(t => t.metadata.category === selectedCategory);
        }

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.metadata.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'created':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'updated':
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                case 'category':
                    return a.metadata.category.localeCompare(b.metadata.category);
                case 'usage':
                    // TODO: Implement usage tracking
                    return 0;
                default:
                    return 0;
            }
        });

        return result;
    }, [templates, filterBy, selectedCategory, searchQuery, sortBy, getUserTemplates, getPublicTemplates, favorites]);

    // Handle template actions
    const handleTemplateEdit = useCallback((template: ReportTemplate) => {
        setSelectedTemplate(template.id);
        setBuilderOpen(true);
    }, [setSelectedTemplate]);

    const handleTemplatePreview = useCallback((template: ReportTemplate) => {
        setSelectedTemplate(template.id);
        setPreviewOpen(true);
    }, [setSelectedTemplate]);

    const handleTemplateDelete = useCallback((template: ReportTemplate) => {
        setMenuTemplate(template);
        setDeleteDialogOpen(true);
        setAnchorEl(null);
    }, []);

    const handleTemplateShare = useCallback((template: ReportTemplate) => {
        setSelectedTemplate(template.id);
        setSharingOpen(true);
        setAnchorEl(null);
    }, [setSelectedTemplate]);

    const handleTemplateDuplicate = useCallback((template: ReportTemplate) => {
        const duplicatedTemplate: ReportTemplate = {
            ...template,
            id: `${template.id}-copy-${Date.now()}`,
            name: `${template.name} (Copy)`,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'current-user', // TODO: Get from auth context
            isPublic: false,
        };

        addTemplate(duplicatedTemplate);
        setAnchorEl(null);

        setSnackbar({
            open: true,
            message: 'Template duplicated successfully',
            severity: 'success',
        });
    }, [addTemplate]);

    const handleFavoriteToggle = useCallback((templateId: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(templateId)) {
            newFavorites.delete(templateId);
        } else {
            newFavorites.add(templateId);
        }
        saveFavorites(newFavorites);
    }, [favorites, saveFavorites]);

    const confirmDelete = useCallback(() => {
        if (menuTemplate) {
            removeTemplate(menuTemplate.id);
            setDeleteDialogOpen(false);
            setMenuTemplate(null);

            setSnackbar({
                open: true,
                message: 'Template deleted successfully',
                severity: 'success',
            });
        }
    }, [menuTemplate, removeTemplate]);

    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, template: ReportTemplate) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setMenuTemplate(template);
    }, []);

    const handleMenuClose = useCallback(() => {
        setAnchorEl(null);
        setMenuTemplate(null);
    }, []);

    const renderTemplateCard = useCallback((template: ReportTemplate) => (
        <Card
            key={template.id}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease',
            }}
            onClick={() => onTemplateSelect?.(template)}
        >
            <CardMedia
                sx={{
                    height: 120,
                    backgroundColor: 'primary.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                <Assessment sx={{ fontSize: 48, color: 'white' }} />
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        '&:hover': {
                            backgroundColor: 'white',
                        },
                    }}
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleFavoriteToggle(template.id);
                    }}
                >
                    {favorites.has(template.id) ? (
                        <Star sx={{ color: 'warning.main' }} />
                    ) : (
                        <StarBorder />
                    )}
                </IconButton>
            </CardMedia>

            <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1, lineHeight: 1.2 }}>
                        {template.name}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, template)}
                    >
                        <MoreVert />
                    </IconButton>
                </Box>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                    }}
                >
                    {template.description || 'No description available'}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    <Chip
                        label={template.metadata.category}
                        size="small"
                        color="primary"
                        variant="outlined"
                    />
                    {template.isPublic && (
                        <Chip
                            label="Public"
                            size="small"
                            color="success"
                            variant="outlined"
                            icon={<Public />}
                        />
                    )}
                    {template.metadata.tags.slice(0, 2).map(tag => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                        />
                    ))}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                            <Person sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                            {template.createdBy}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                    </Typography>
                </Box>
            </CardContent>

            <CardActions>
                <Button
                    size="small"
                    startIcon={<Visibility />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleTemplatePreview(template);
                    }}
                >
                    Preview
                </Button>
                <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleTemplateEdit(template);
                    }}
                >
                    Edit
                </Button>
            </CardActions>
        </Card>
    ), [onTemplateSelect, favorites, handleFavoriteToggle, handleMenuOpen, handleTemplatePreview, handleTemplateEdit]);

    const renderTemplateList = useCallback((template: ReportTemplate) => (
        <ListItem
            key={template.id}
            button
            onClick={() => onTemplateSelect?.(template)}
            sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                '&:hover': {
                    backgroundColor: 'action.hover',
                },
            }}
        >
            <ListItemIcon>
                <Assessment />
            </ListItemIcon>
            <ListItemText
                primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">{template.name}</Typography>
                        <Chip
                            label={template.metadata.category}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                        {template.isPublic && (
                            <Chip
                                label="Public"
                                size="small"
                                color="success"
                                variant="outlined"
                                icon={<Public />}
                            />
                        )}
                    </Box>
                }
                secondary={
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {template.description || 'No description available'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Created by {template.createdBy} • {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                        </Typography>
                    </Box>
                }
            />
            <ListItemSecondaryAction>
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        handleFavoriteToggle(template.id);
                    }}
                >
                    {favorites.has(template.id) ? (
                        <Star sx={{ color: 'warning.main' }} />
                    ) : (
                        <StarBorder />
                    )}
                </IconButton>
                <IconButton onClick={(e) => handleMenuOpen(e, template)}>
                    <MoreVert />
                </IconButton>
            </ListItemSecondaryAction>
        </ListItem>
    ), [onTemplateSelect, favorites, handleFavoriteToggle, handleMenuOpen]);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h5">Template Management</Typography>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setBuilderOpen(true)}
                    >
                        Create Template
                    </Button>
                </Box>

                <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
                    <Tab label="My Templates" />
                    <Tab label="Shared Templates" />
                    <Tab label="Marketplace" />
                </Tabs>
            </Paper>

            {/* Filters and Search */}
            <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
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
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Filter</InputLabel>
                            <Select
                                value={filterBy}
                                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                            >
                                <MenuItem value="all">All Templates</MenuItem>
                                <MenuItem value="my-templates">My Templates</MenuItem>
                                <MenuItem value="shared">Shared with Me</MenuItem>
                                <MenuItem value="public">Public</MenuItem>
                                <MenuItem value="favorites">Favorites</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <MenuItem value="all">All Categories</MenuItem>
                                <MenuItem value="patient-outcomes">Patient Outcomes</MenuItem>
                                <MenuItem value="pharmacist-interventions">Pharmacist Interventions</MenuItem>
                                <MenuItem value="therapy-effectiveness">Therapy Effectiveness</MenuItem>
                                <MenuItem value="quality-improvement">Quality Improvement</MenuItem>
                                <MenuItem value="regulatory-compliance">Regulatory Compliance</MenuItem>
                                <MenuItem value="cost-effectiveness">Cost Effectiveness</MenuItem>
                                <MenuItem value="operational-efficiency">Operational Efficiency</MenuItem>
                                <MenuItem value="custom">Custom</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Sort by</InputLabel>
                            <Select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortBy)}
                            >
                                <MenuItem value="updated">Last Updated</MenuItem>
                                <MenuItem value="created">Date Created</MenuItem>
                                <MenuItem value="name">Name</MenuItem>
                                <MenuItem value="category">Category</MenuItem>
                                <MenuItem value="usage">Usage</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                                onClick={() => setViewMode('grid')}
                                color={viewMode === 'grid' ? 'primary' : 'default'}
                            >
                                <ViewModule />
                            </IconButton>
                            <IconButton
                                onClick={() => setViewMode('list')}
                                color={viewMode === 'list' ? 'primary' : 'default'}
                            >
                                <ViewList />
                            </IconButton>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Content */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {activeTab === 0 && (
                    <Box>
                        {filteredTemplates.length === 0 ? (
                            <Paper sx={{ p: 4, textAlign: 'center' }}>
                                <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>
                                    No templates found
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {searchQuery || filterBy !== 'all' || selectedCategory !== 'all'
                                        ? 'Try adjusting your search or filters'
                                        : 'Create your first template to get started'
                                    }
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => setBuilderOpen(true)}
                                >
                                    Create Template
                                </Button>
                            </Paper>
                        ) : viewMode === 'grid' ? (
                            <Grid container spacing={2}>
                                {filteredTemplates.map(template => (
                                    <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                                        {renderTemplateCard(template)}
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <List>
                                {filteredTemplates.map(renderTemplateList)}
                            </List>
  