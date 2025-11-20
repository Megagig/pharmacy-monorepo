import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  InputAdornment,
  Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BookIcon from '@mui/icons-material/Book';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FlagIcon from '@mui/icons-material/Flag';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import CommentIcon from '@mui/icons-material/Comment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import TimerIcon from '@mui/icons-material/Timer';
import StarIcon from '@mui/icons-material/Star';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';

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
      id={`support-tabpanel-${index}`}
      aria-labelledby={`support-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'general';
  userId: string;
  userEmail: string;
  userName: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  tags: string[];
}

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  subcategory?: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  viewCount: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface SupportMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  criticalTickets: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  customerSatisfactionScore: number;
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
}

const SupportHelpdesk: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user is super admin
  const isSuperAdmin = user?.role === 'super_admin';
  
  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  
  // Knowledge base state
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [createArticleDialogOpen, setCreateArticleDialogOpen] = useState(false);
  
  // Video Tutorials state
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [createVideoDialogOpen, setCreateVideoDialogOpen] = useState(false);
  
  // Metrics state
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Assignment and status change state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedTicketForAction, setSelectedTicketForAction] = useState<SupportTicket | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Article form state
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: '',
    subcategory: '',
    tags: '',
    status: 'published',
    isPublic: true
  });

  // Ticket form state
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    tags: ''
  });

  // Video form state
  const [videoForm, setVideoForm] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    category: 'getting-started',
    difficulty: 'beginner',
    tags: '',
    status: 'published'
  });

  // Mock data for demonstration
  const mockTickets: SupportTicket[] = [
    {
      id: '1',
      ticketNumber: 'TKT-000001',
      title: 'Unable to access dashboard',
      description: 'I cannot log into my dashboard. Getting authentication errors.',
      status: 'open',
      priority: 'high',
      category: 'technical',
      userId: 'user1',
      userEmail: 'john@example.com',
      userName: 'John Doe',
      assignedTo: 'agent1',
      assignedToName: 'Sarah Wilson',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      responseCount: 0,
      tags: ['authentication', 'dashboard']
    },
    {
      id: '2',
      ticketNumber: 'TKT-000002',
      title: 'Billing inquiry about subscription',
      description: 'I have questions about my current subscription plan and billing cycle.',
      status: 'in_progress',
      priority: 'medium',
      category: 'billing',
      userId: 'user2',
      userEmail: 'jane@example.com',
      userName: 'Jane Smith',
      assignedTo: 'agent2',
      assignedToName: 'Mike Johnson',
      createdAt: '2024-01-14T14:20:00Z',
      updatedAt: '2024-01-15T09:15:00Z',
      responseCount: 2,
      tags: ['billing', 'subscription']
    },
    {
      id: '3',
      ticketNumber: 'TKT-000003',
      title: 'Feature request: Dark mode',
      description: 'Would love to see a dark mode option in the application.',
      status: 'resolved',
      priority: 'low',
      category: 'feature_request',
      userId: 'user3',
      userEmail: 'bob@example.com',
      userName: 'Bob Johnson',
      assignedTo: 'agent1',
      assignedToName: 'Sarah Wilson',
      createdAt: '2024-01-10T16:45:00Z',
      updatedAt: '2024-01-12T11:30:00Z',
      responseCount: 4,
      tags: ['feature', 'ui', 'dark-mode']
    }
  ];

  const mockArticles: KnowledgeBaseArticle[] = [
    {
      id: '1',
      title: 'How to Reset Your Password',
      slug: 'how-to-reset-password',
      excerpt: 'Step-by-step guide to reset your account password',
      category: 'Account Management',
      subcategory: 'Password',
      tags: ['password', 'reset', 'account'],
      status: 'published',
      isPublic: true,
      viewCount: 245,
      helpfulVotes: 18,
      notHelpfulVotes: 2,
      authorName: 'Support Team',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-10T15:30:00Z'
    },
    {
      id: '2',
      title: 'Understanding Billing Cycles',
      slug: 'understanding-billing-cycles',
      excerpt: 'Learn about how billing cycles work and when charges occur',
      category: 'Billing',
      subcategory: 'Cycles',
      tags: ['billing', 'cycles', 'charges'],
      status: 'published',
      isPublic: true,
      viewCount: 189,
      helpfulVotes: 15,
      notHelpfulVotes: 1,
      authorName: 'Billing Team',
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-08T12:00:00Z'
    },
    {
      id: '3',
      title: 'API Integration Guide',
      slug: 'api-integration-guide',
      excerpt: 'Complete guide for integrating with our API',
      category: 'Technical',
      subcategory: 'API',
      tags: ['api', 'integration', 'development'],
      status: 'published',
      isPublic: true,
      viewCount: 156,
      helpfulVotes: 22,
      notHelpfulVotes: 3,
      authorName: 'Technical Team',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-12T09:45:00Z'
    }
  ];

  const mockMetrics: SupportMetrics = {
    totalTickets: 156,
    openTickets: 23,
    resolvedTickets: 118,
    criticalTickets: 3,
    averageResponseTime: 4.2,
    averageResolutionTime: 18.5,
    customerSatisfactionScore: 4.3,
    ticketsByStatus: [
      { status: 'open', count: 23 },
      { status: 'in_progress', count: 15 },
      { status: 'resolved', count: 118 }
    ],
    ticketsByPriority: [
      { priority: 'low', count: 45 },
      { priority: 'medium', count: 78 },
      { priority: 'high', count: 30 },
      { priority: 'critical', count: 3 }
    ],
    ticketsByCategory: [
      { category: 'technical', count: 67 },
      { category: 'billing', count: 34 },
      { category: 'general', count: 28 },
      { category: 'feature_request', count: 27 }
    ]
  };

  useEffect(() => {
    // Load real data from API
    loadTickets();
    loadArticles();
    loadVideos();
    loadMetrics();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/saas/support/tickets');
      const apiTickets = response.data.data.tickets || [];
      
      // Map API tickets to match frontend interface (convert _id to id and map assignedTo)
      const mappedTickets = apiTickets.map((ticket: any) => ({
        ...ticket,
        id: ticket._id || ticket.id, // Use _id from API or fallback to id
        // Map assignedTo object to assignedToName string
        assignedToName: ticket.assignedTo 
          ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
          : null,
        // Keep the original assignedTo ID for API calls
        assignedTo: ticket.assignedTo?._id || ticket.assignedTo,
      }));

      setTickets(mappedTickets.length > 0 ? mappedTickets : mockTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Fallback to mock data
      setTickets(mockTickets);
    } finally {
      setLoading(false);
    }
  };

  const loadArticles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/saas/support/knowledge-base/articles');
      setArticles(response.data.data.articles || mockArticles);
    } catch (error) {
      console.error('Error loading articles:', error);
      // Fallback to mock data
      setArticles(mockArticles);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/saas/support/metrics');
      const metricsData = response.data.data || mockMetrics;
      
      // Ensure all required arrays exist
      const safeMetrics = {
        ...metricsData,
        ticketsByStatus: metricsData.ticketsByStatus || [],
        ticketsByPriority: metricsData.ticketsByPriority || [],
        ticketsByCategory: metricsData.ticketsByCategory || []
      };

      setMetrics(safeMetrics);
    } catch (error) {
      console.error('Error loading metrics:', error);

      // Fallback to mock data
      setMetrics(mockMetrics);
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/saas/support/help/content?contentType=videos');
      setVideos(response.data.data.videos || []);
    } catch (error) {
      console.error('Error loading videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AssignmentIcon color="error" />;
      case 'in_progress':
        return <PlayArrowIcon color="warning" />;
      case 'pending_customer':
        return <HourglassEmptyIcon color="info" />;
      case 'resolved':
        return <CheckCircleIcon color="success" />;
      case 'closed':
        return <CancelIcon color="disabled" />;
      default:
        return <AssignmentIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'pending_customer':
        return 'info';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const filteredArticles = articles.filter(article => {
    return article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
           article.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Article handlers
  const handleCreateArticle = async () => {
    try {
      setLoading(true);
      const articleData = {
        ...articleForm,
        tags: articleForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      if (selectedArticle) {
        await apiClient.put(`/admin/saas/support/knowledge-base/articles/${selectedArticle.id}`, articleData);
      } else {
        await apiClient.post('/admin/saas/support/knowledge-base/articles', articleData);
      }
      
      setCreateArticleDialogOpen(false);
      setSelectedArticle(null);
      setArticleForm({
        title: '',
        content: '',
        excerpt: '',
        category: '',
        subcategory: '',
        tags: '',
        status: 'published',
        isPublic: true
      });
      
      await loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      setError('Failed to save article');
    } finally {
      setLoading(false);
    }
  };

  const handleEditArticle = (article: KnowledgeBaseArticle) => {
    setSelectedArticle(article);
    setArticleForm({
      title: article.title,
      content: '', // We'll need to fetch full content
      excerpt: article.excerpt,
      category: article.category,
      subcategory: article.subcategory || '',
      tags: article.tags.join(', '),
      status: article.status,
      isPublic: article.isPublic
    });
    setCreateArticleDialogOpen(true);
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      try {
        setLoading(true);
        await apiClient.delete(`/admin/saas/support/knowledge-base/articles/${articleId}`);
        await loadArticles();
      } catch (error) {
        console.error('Error deleting article:', error);
        setError('Failed to delete article');
      } finally {
        setLoading(false);
      }
    }
  };

  // Video handlers
  const handleCreateVideo = async () => {
    try {
      setLoading(true);
      const videoData = {
        ...videoForm,
        tags: videoForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      const response = await apiClient.post('/admin/saas/support/help/videos', videoData);
      await loadVideos(); // Reload videos after creation
      setVideoDialogOpen(false);
      setVideoForm({
        title: '',
        description: '',
        youtubeUrl: '',
        category: 'getting-started',
        difficulty: 'beginner',
        tags: '',
        status: 'published'
      });
      setError(null);
    } catch (err) {
      console.error('Error creating video:', err);
      setError('Failed to create video tutorial');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVideo = (video: any) => {
    setSelectedVideo(video);
    setVideoForm({
      title: video.title,
      description: video.description,
      youtubeUrl: video.youtubeUrl,
      category: video.category,
      difficulty: video.difficulty,
      tags: video.tags ? video.tags.join(', ') : '',
      status: video.status
    });
    setVideoDialogOpen(true);
  };

  const handleUpdateVideo = async () => {
    try {
      setLoading(true);
      const videoData = {
        ...videoForm,
        tags: videoForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      await apiClient.put(`/admin/saas/support/help/videos/${selectedVideo._id}`, videoData);
      await loadVideos(); // Reload videos after update
      setVideoDialogOpen(false);
      setSelectedVideo(null);
      setVideoForm({
        title: '',
        description: '',
        youtubeUrl: '',
        category: 'getting-started',
        difficulty: 'beginner',
        tags: '',
        status: 'published'
      });
      setError(null);
    } catch (err) {
      console.error('Error updating video:', err);
      setError('Failed to update video tutorial');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (window.confirm('Are you sure you want to delete this video tutorial?')) {
      try {
        setLoading(true);
        await apiClient.delete(`/admin/saas/support/help/videos/${videoId}`);
        await loadVideos(); // Reload videos after deletion
        setError(null);
      } catch (err) {
        console.error('Error deleting video:', err);
        setError('Failed to delete video tutorial');
      } finally {
        setLoading(false);
      }
    }
  };

  // Ticket handlers
  const handleCreateTicket = async () => {
    try {
      setLoading(true);
      const ticketData = {
        ...ticketForm,
        tags: ticketForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      await apiClient.post('/admin/saas/support/tickets', ticketData);
      
      setCreateTicketDialogOpen(false);
      setTicketForm({
        title: '',
        description: '',
        priority: 'medium',
        category: 'general',
        tags: ''
      });
      
      await loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  // Assignment and status change handlers
  const handleAssignTicket = (ticket: SupportTicket) => {
    setSelectedTicketForAction(ticket);
    setSelectedAssignee(ticket.assignedTo || '');
    setAssignDialogOpen(true);
    loadAvailableUsers();
  };

  const handleChangeStatus = (ticket: SupportTicket) => {
    setSelectedTicketForAction(ticket);
    setSelectedStatus(ticket.status);
    setStatusDialogOpen(true);
  };

  const loadAvailableUsers = async () => {
    try {
      // Load all users and filter for support roles on frontend
      const response = await apiClient.get('/admin/saas/users?limit=100');
      const allUsers = response.data.data.users || [];
      
      // Filter for users with support-related roles
      const supportUsers = allUsers.filter((user: any) => 
        ['admin', 'super_admin', 'support_agent', 'senior_support_agent', 'technical_support'].includes(user.role)
      );
      
      setAvailableUsers(supportUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setAvailableUsers([]);
    }
  };

  const submitAssignment = async () => {
    if (!selectedTicketForAction || !selectedAssignee) return;
    
    try {
      setActionLoading(true);
      
      // Try multiple ways to get the ID - handle both frontend and backend formats
      const ticketId = selectedTicketForAction.id || 
                      (selectedTicketForAction as any)._id || 
                      (selectedTicketForAction as any).ticketId;
      
      if (!ticketId) {
        console.error('No ticket ID found. Ticket object:', selectedTicketForAction);
        throw new Error('Ticket ID not found');
      }
      
      await apiClient.put(`/admin/saas/support/tickets/${ticketId}/assign`, {
        assignedToId: selectedAssignee
      });
      
      // Find assigned user name for toast
      const assignedUser = availableUsers.find(user => user._id === selectedAssignee);
      const assignedUserName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'selected user';
      
      toast.success(
        selectedAssignee 
          ? `Ticket ${selectedTicketForAction.ticketNumber} assigned to ${assignedUserName}`
          : `Ticket ${selectedTicketForAction.ticketNumber} unassigned`,
        { duration: 4000, icon: '👤' }
      );
      
      setAssignDialogOpen(false);
      setSelectedTicketForAction(null);
      setSelectedAssignee('');
      await loadTickets();
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      toast.error(
        error.response?.data?.message || 'Failed to assign ticket',
        { duration: 4000, icon: '❌' }
      );
    } finally {
      setActionLoading(false);
    }
  };

  const submitStatusChange = async () => {
    if (!selectedTicketForAction || !selectedStatus) return;
    
    try {
      setActionLoading(true);
      
      // Try multiple ways to get the ID - handle both frontend and backend formats
      const ticketId = selectedTicketForAction.id || 
                      (selectedTicketForAction as any)._id || 
                      (selectedTicketForAction as any).ticketId;
      
      if (!ticketId) {
        throw new Error('Ticket ID not found');
      }
      
      await apiClient.put(`/admin/saas/support/tickets/${ticketId}/status`, {
        status: selectedStatus
      });
      
      toast.success(
        `Ticket ${selectedTicketForAction.ticketNumber} status changed to ${selectedStatus.replace('_', ' ').toUpperCase()}`,
        { duration: 4000, icon: '🔄' }
      );
      
      setStatusDialogOpen(false);
      setSelectedTicketForAction(null);
      setSelectedStatus('');
      await loadTickets();
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      toast.error(
        error.response?.data?.message || 'Failed to update ticket status',
        { duration: 4000, icon: '❌' }
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderTicketsTab = () => (
    <Box>
      {/* Tickets Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Support Tickets
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateTicketDialogOpen(true)}
        >
          Create Ticket
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="pending_customer">Pending Customer</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Priority"
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value="all">All Priority</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="technical">Technical</MenuItem>
                  <MenuItem value="billing">Billing</MenuItem>
                  <MenuItem value="feature_request">Feature Request</MenuItem>
                  <MenuItem value="bug_report">Bug Report</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCategoryFilter('all');
                }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket #</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow key={ticket.id || (ticket as any)._id || ticket.ticketNumber} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {ticket.ticketNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {ticket.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ticket.userName} ({ticket.userEmail})
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(ticket.status)}
                    label={ticket.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(ticket.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.priority.toUpperCase()}
                    color={getPriorityColor(ticket.priority) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={ticket.category.replace('_', ' ')}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {ticket.assignedToName ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" />
                      <Typography variant="body2">
                        {ticket.assignedToName}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Unassigned
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setTicketDialogOpen(true);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    {isSuperAdmin && (
                      <Tooltip title="Assign Ticket (Super Admin Only)">
                        <IconButton 
                          size="small"
                          onClick={() => handleAssignTicket(ticket)}
                          color="primary"
                        >
                          <PersonAddIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Change Status">
                      <IconButton 
                        size="small"
                        onClick={() => handleChangeStatus(ticket)}
                        color="secondary"
                      >
                        <ChangeCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderKnowledgeBaseTab = () => (
    <Box>
      {/* Knowledge Base Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Knowledge Base
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateArticleDialogOpen(true)}
        >
          Create Article
        </Button>
      </Box>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Articles Grid */}
      <Grid container spacing={3}>
        {filteredArticles.map((article) => (
          <Grid item xs={12} md={6} lg={4} key={article.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Chip
                    label={article.category}
                    color="primary"
                    size="small"
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      icon={<VisibilityIcon />}
                      label={article.viewCount}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                
                <Typography variant="h6" component="h3" gutterBottom>
                  {article.title}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {article.excerpt}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {article.tags.slice(0, 3).map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThumbUpIcon fontSize="small" color="success" />
                    <Typography variant="caption">
                      {article.helpfulVotes}
                    </Typography>
                    <ThumbDownIcon fontSize="small" color="error" />
                    <Typography variant="caption">
                      {article.notHelpfulVotes}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    by {article.authorName}
                  </Typography>
                </Box>
              </CardContent>
              
              <Box sx={{ p: 2, pt: 0 }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => {
                        setSelectedArticle(article);
                        setArticleDialogOpen(true);
                      }}
                    >
                      Read
                    </Button>
                  </Grid>
                  <Grid item xs={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="primary"
                      onClick={() => handleEditArticle(article)}
                    >
                      <EditIcon />
                    </Button>
                  </Grid>
                  <Grid item xs={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      onClick={() => handleDeleteArticle(article.id)}
                    >
                      <DeleteIcon />
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderMetricsTab = () => (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Support Metrics & Analytics
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Typography>Loading metrics...</Typography>
        </Box>
      )}

      {!loading && !metrics && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Typography color="text.secondary">No metrics data available</Typography>
        </Box>
      )}

      {!loading && metrics && (
        <>
          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Tickets
                      </Typography>
                      <Typography variant="h4">
                        {metrics.totalTickets || 0}
                      </Typography>
                    </Box>
                    <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Open Tickets
                      </Typography>
                      <Typography variant="h4" color="error">
                        {metrics.openTickets || 0}
                      </Typography>
                    </Box>
                    <Badge badgeContent={metrics.criticalTickets || 0} color="error">
                      <FlagIcon color="error" sx={{ fontSize: 40 }} />
                    </Badge>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Avg Response Time
                      </Typography>
                      <Typography variant="h4">
                        {metrics.averageResponseTime || 0}h
                      </Typography>
                    </Box>
                    <TimerIcon color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Satisfaction Score
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {metrics.customerSatisfactionScore || 0}/5
                      </Typography>
                    </Box>
                    <StarIcon color="warning" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tickets by Status
                  </Typography>
                  <List>
                    {(metrics.ticketsByStatus || []).map((item) => (
                      <ListItem key={item.status}>
                        <ListItemIcon>
                          {getStatusIcon(item.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.status.replace('_', ' ').toUpperCase()}
                          secondary={`${item.count} tickets`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tickets by Priority
                  </Typography>
                  <List>
                    {(metrics.ticketsByPriority || []).map((item) => (
                      <ListItem key={item.priority}>
                        <ListItemIcon>
                          <PriorityHighIcon color={getPriorityColor(item.priority) as any} />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.priority.toUpperCase()}
                          secondary={`${item.count} tickets`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Tickets by Category
                  </Typography>
                  <List>
                    {(metrics.ticketsByCategory || []).map((item) => (
                      <ListItem key={item.category}>
                        <ListItemText
                          primary={item.category.replace('_', ' ').toUpperCase()}
                          secondary={`${item.count} tickets`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );

  const renderVideoTutorialsTab = () => (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Video Tutorials Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage video tutorials that will be available to all users on the Help page
      </Typography>

      {/* Video Management Interface */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Video Tutorials
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setVideoDialogOpen(true)}
          sx={{
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          }}
        >
          Add Video Tutorial
        </Button>
      </Box>

      {/* Videos Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Difficulty</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Views</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video._id}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {video.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {video.description.substring(0, 100)}...
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={video.category} size="small" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={video.difficulty}
                    color={video.difficulty === 'beginner' ? 'success' : video.difficulty === 'intermediate' ? 'warning' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={video.status} 
                    color={video.status === 'published' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{video.viewCount || 0}</TableCell>
                <TableCell>{video.duration || 'N/A'}</TableCell>
                <TableCell>
                  <Tooltip title="Edit Video">
                    <IconButton 
                      onClick={() => handleEditVideo(video)} 
                      size="small"
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Video">
                    <IconButton 
                      onClick={() => handleDeleteVideo(video._id)} 
                      size="small" 
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {videos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No video tutorials found. Click "Add Video Tutorial" to create your first video.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="support helpdesk tabs">
          <Tab
            icon={<AssignmentIcon />}
            label="Tickets"
            id="support-tab-0"
            aria-controls="support-tabpanel-0"
          />
          <Tab
            icon={<BookIcon />}
            label="Knowledge Base"
            id="support-tab-1"
            aria-controls="support-tabpanel-1"
          />
          <Tab
            icon={<AnalyticsIcon />}
            label="Metrics"
            id="support-tab-2"
            aria-controls="support-tabpanel-2"
          />
          <Tab
            icon={<PlayArrowIcon />}
            label="Video Tutorials"
            id="support-tab-3"
            aria-controls="support-tabpanel-3"
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {renderTicketsTab()}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {renderKnowledgeBaseTab()}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {renderMetricsTab()}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {renderVideoTutorialsTab()}
      </TabPanel>

      {/* Ticket Details Dialog */}
      <Dialog
        open={ticketDialogOpen}
        onClose={() => setTicketDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Ticket Details - {selectedTicket?.ticketNumber}
        </DialogTitle>
        <DialogContent>
          {selectedTicket && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    {selectedTicket.title}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    icon={getStatusIcon(selectedTicket.status)}
                    label={selectedTicket.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(selectedTicket.status) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Priority
                  </Typography>
                  <Chip
                    label={selectedTicket.priority.toUpperCase()}
                    color={getPriorityColor(selectedTicket.priority) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedTicket.description}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography variant="body1">
                    {selectedTicket.userName} ({selectedTicket.userEmail})
                  </Typography>
                </Grid>
                {selectedTicket.assignedToName && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Assigned To
                    </Typography>
                    <Typography variant="body1">
                      {selectedTicket.assignedToName}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {selectedTicket.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTicketDialogOpen(false)}>
            Close
          </Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Edit Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* Article Details Dialog */}
      <Dialog
        open={articleDialogOpen}
        onClose={() => setArticleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedArticle?.title}
        </DialogTitle>
        <DialogContent>
          {selectedArticle && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body1" paragraph>
                {selectedArticle.excerpt}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={selectedArticle.category} color="primary" size="small" />
                {selectedArticle.subcategory && (
                  <Chip label={selectedArticle.subcategory} variant="outlined" size="small" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                This article would contain the full content here...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArticleDialogOpen(false)}>
            Close
          </Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Edit Article
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Article Dialog */}
      <Dialog
        open={createArticleDialogOpen}
        onClose={() => setCreateArticleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedArticle ? 'Edit Article' : 'Create New Article'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={articleForm.title}
                onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Excerpt"
                multiline
                rows={2}
                value={articleForm.excerpt}
                onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Content"
                multiline
                rows={8}
                value={articleForm.content}
                onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                >
                  <MenuItem value="getting-started">Getting Started</MenuItem>
                  <MenuItem value="patient-management">Patient Management</MenuItem>
                  <MenuItem value="inventory-stock">Inventory & Stock</MenuItem>
                  <MenuItem value="billing-payments">Billing & Payments</MenuItem>
                  <MenuItem value="medication-management">Medication Management</MenuItem>
                  <MenuItem value="mtr">Medication Therapy Review</MenuItem>
                  <MenuItem value="clinical-interventions">Clinical Interventions</MenuItem>
                  <MenuItem value="diagnostic-cases">Diagnostic Cases</MenuItem>
                  <MenuItem value="communication-hub">Communication Hub</MenuItem>
                  <MenuItem value="drug-information">Drug Information</MenuItem>
                  <MenuItem value="clinical-decision">Clinical Decision Support</MenuItem>
                  <MenuItem value="dashboards-reports">Dashboards & Reports</MenuItem>
                  <MenuItem value="user-management">User Management</MenuItem>
                  <MenuItem value="security-privacy">Security & Privacy</MenuItem>
                  <MenuItem value="api-integrations">API & Integrations</MenuItem>
                  <MenuItem value="account-settings">Account Settings</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subcategory (Optional)"
                value={articleForm.subcategory}
                onChange={(e) => setArticleForm({ ...articleForm, subcategory: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (comma separated)"
                value={articleForm.tags}
                onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })}
                helperText="Enter tags separated by commas (e.g., password, reset, account)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={articleForm.status}
                  onChange={(e) => setArticleForm({ ...articleForm, status: e.target.value })}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateArticleDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateArticle} 
            variant="contained"
            disabled={!articleForm.title || !articleForm.content || !articleForm.excerpt}
          >
            {selectedArticle ? 'Update Article' : 'Create Article'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog
        open={createTicketDialogOpen}
        onClose={() => setCreateTicketDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Support Ticket</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={ticketForm.title}
                onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                >
                  <MenuItem value="technical">Technical</MenuItem>
                  <MenuItem value="billing">Billing</MenuItem>
                  <MenuItem value="feature_request">Feature Request</MenuItem>
                  <MenuItem value="bug_report">Bug Report</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (comma separated)"
                value={ticketForm.tags}
                onChange={(e) => setTicketForm({ ...ticketForm, tags: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTicketDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTicket} 
            variant="contained"
            disabled={!ticketForm.title || !ticketForm.description}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Video Dialog */}
      <Dialog
        open={videoDialogOpen}
        onClose={() => setVideoDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedVideo ? 'Edit Video Tutorial' : 'Create New Video Tutorial'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={videoForm.description}
                onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="YouTube URL"
                value={videoForm.youtubeUrl}
                onChange={(e) => setVideoForm({ ...videoForm, youtubeUrl: e.target.value })}
                helperText="Enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)"
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={videoForm.category}
                  onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })}
                >
                  <MenuItem value="getting-started">Getting Started</MenuItem>
                  <MenuItem value="patient-management">Patient Management</MenuItem>
                  <MenuItem value="inventory-stock">Inventory & Stock</MenuItem>
                  <MenuItem value="billing-payments">Billing & Payments</MenuItem>
                  <MenuItem value="medication-management">Medication Management</MenuItem>
                  <MenuItem value="mtr">Medication Therapy Review</MenuItem>
                  <MenuItem value="clinical-interventions">Clinical Interventions</MenuItem>
                  <MenuItem value="communication-hub">Communication Hub</MenuItem>
                  <MenuItem value="drug-information">Drug Information</MenuItem>
                  <MenuItem value="dashboards-reports">Dashboards & Reports</MenuItem>
                  <MenuItem value="user-management">User Management</MenuItem>
                  <MenuItem value="security-privacy">Security & Privacy</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={videoForm.difficulty}
                  onChange={(e) => setVideoForm({ ...videoForm, difficulty: e.target.value })}
                >
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={videoForm.status}
                  onChange={(e) => setVideoForm({ ...videoForm, status: e.target.value })}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (comma separated)"
                value={videoForm.tags}
                onChange={(e) => setVideoForm({ ...videoForm, tags: e.target.value })}
                helperText="Enter tags separated by commas (e.g., tutorial, basics, setup)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVideoDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={selectedVideo ? handleUpdateVideo : handleCreateVideo} 
            variant="contained"
            disabled={!videoForm.title || !videoForm.description || !videoForm.youtubeUrl}
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            }}
          >
            {selectedVideo ? 'Update Video' : 'Create Video'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Ticket Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Ticket - {selectedTicketForAction?.ticketNumber}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Assign this ticket to a support agent or admin user.
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Assign To</InputLabel>
              <Select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                label="Assign To"
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {availableUsers.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName} ({user.email}) - {user.role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={submitAssignment}
            variant="contained"
            disabled={actionLoading}
            startIcon={<PersonAddIcon />}
          >
            {actionLoading ? 'Assigning...' : 'Assign Ticket'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Change Status - {selectedTicketForAction?.ticketNumber}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Update the status of this support ticket.
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="open">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon color="error" />
                    Open
                  </Box>
                </MenuItem>
                <MenuItem value="in_progress">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlayArrowIcon color="warning" />
                    In Progress
                  </Box>
                </MenuItem>
                <MenuItem value="pending_customer">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HourglassEmptyIcon color="info" />
                    Pending Customer
                  </Box>
                </MenuItem>
                <MenuItem value="resolved">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" />
                    Resolved
                  </Box>
                </MenuItem>
                <MenuItem value="closed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CancelIcon color="disabled" />
                    Closed
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={submitStatusChange}
            variant="contained"
            disabled={actionLoading || !selectedStatus}
            startIcon={<ChangeCircleIcon />}
          >
            {actionLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default SupportHelpdesk;