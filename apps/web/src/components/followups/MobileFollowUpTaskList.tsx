import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  IconButton,
  Grid,
  Stack,
  Avatar,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogContent,
  TextField,
  OutlinedInput,
  InputAdornment,
  Fab,
  Badge,
  useTheme,
  Skeleton,
  AppBar,
  Toolbar,
  BottomNavigation,
  BottomNavigationAction,
  SwipeableDrawer,
  Slide,
  Zoom,
  Paper,
  Divider,
  Menu,
  MenuItem,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Event as EventIcon,
  Warning as WarningIcon,
  Flag as FlagIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingUpIcon,
  Done as DoneIcon,
  Close as CloseIcon,
  SwipeLeft as SwipeLeftIcon,
  SwipeRight as SwipeRightIcon,
  TouchApp as TouchAppIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, isAfter, isBefore, isToday, isPast } from 'date-fns';

// Hooks and types
import { useFollowUpTasks, useCompleteFollowUp, useConvertToAppointment, useEscalateFollowUp } from '../../hooks/useFollowUps';
import { useFollowUpStore, useFollowUpFilters, useFollowUpList } from '../../stores/followUpStore';
import { useResponsive, useIsTouchDevice, useSafeAreaInsets } from '../../hooks/useResponsive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import {
  FollowUpTask,
  FollowUpFilters,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
} from '../../stores/followUpTypes';

interface MobileFollowUpTaskListProps {
  /** Optional patient filter */
  patientId?: string;
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Callback when task is selected */
  onTaskSelect?: (task: FollowUpTask | null) => void;
  /** Callback when new task is requested */
  onCreateTask?: () => void;
}

// Priority color mapping
const PRIORITY_COLORS: Record<FollowUpPriority, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
  urgent: '#e91e63',
  critical: '#9c27b0',
};

// Status color mapping
const STATUS_COLORS: Record<FollowUpStatus, string> = {
  pending: '#2196f3',
  in_progress: '#ff9800',
  completed: '#4caf50',
  cancelled: '#9e9e9e',
  overdue: '#f44336',
  converted_to_appointment: '#673ab7',
};

// Type labels with emojis
const TYPE_LABELS: Record<FollowUpType, { label: string; emoji: string }> = {
  medication_start_followup: { label: 'Medication Start', emoji: '💊' },
  lab_result_review: { label: 'Lab Result Review', emoji: '🧪' },
  hospital_discharge_followup: { label: 'Hospital Discharge', emoji: '🏥' },
  medication_change_followup: { label: 'Medication Change', emoji: '🔄' },
  chronic_disease_monitoring: { label: 'Chronic Disease', emoji: '🩺' },
  adherence_check: { label: 'Adherence Check', emoji: '✅' },
  refill_reminder: { label: 'Refill Reminder', emoji: '🔔' },
  preventive_care: { label: 'Preventive Care', emoji: '🛡️' },
  general_followup: { label: 'General Follow-up', emoji: '📋' },
};

// Filter options for mobile
const FILTER_OPTIONS = [
  { key: 'all', label: 'All Tasks', icon: '📋', count: 0 },
  { key: 'pending', label: 'Pending', icon: '⏳', count: 0 },
  { key: 'overdue', label: 'Overdue', icon: '🚨', count: 0 },
  { key: 'high_priority', label: 'High Priority', icon: '🔥', count: 0 },
  { key: 'due_today', label: 'Due Today', icon: '📅', count: 0 },
];

const MobileFollowUpTaskList: React.FC<MobileFollowUpTaskListProps> = ({
  patientId,
  pharmacistId,
  locationId,
  onTaskSelect,
  onCreateTask,
}) => {
  const theme = useTheme();
  const { isMobile, isSmallMobile, getSpacing } = useResponsive();
  const isTouchDevice = useIsTouchDevice();
  const safeAreaInsets = useSafeAreaInsets();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<FollowUpTask | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [quickActionMenuAnchor, setQuickActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [quickActionTask, setQuickActionTask] = useState<FollowUpTask | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState<{
    type: 'complete' | 'convert' | 'escalate' | null;
    task: FollowUpTask | null;
    open: boolean;
  }>({ type: null, task: null, open: false });
  const [completionNotes, setCompletionNotes] = useState('');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Store hooks
  const { filters, setFilters, clearFilters } = useFollowUpFilters();
  const { selectTask } = useFollowUpStore();

  // Build filters with props
  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...(patientId && { patientId }),
    ...(pharmacistId && { assignedTo: pharmacistId }),
    ...(locationId && { locationId }),
    ...(searchTerm && { search: searchTerm }),
    ...(selectedFilter === 'pending' && { status: 'pending' }),
    ...(selectedFilter === 'overdue' && { overdue: true }),
    ...(selectedFilter === 'high_priority' && { priority: ['high', 'urgent', 'critical'] }),
    ...(selectedFilter === 'due_today' && { dueToday: true }),
  }), [filters, patientId, pharmacistId, locationId, searchTerm, selectedFilter]);

  // Query hooks
  const { data: tasksData, isLoading, error, refetch } = useFollowUpTasks(effectiveFilters);
  const completeTaskMutation = useCompleteFollowUp();
  const convertToAppointmentMutation = useConvertToAppointment();
  const escalateTaskMutation = useEscalateFollowUp();

  // Memoized tasks and statistics
  const { displayTasks, summaryStats } = useMemo(() => {
    const tasks = tasksData?.data?.tasks || [];
    
    // Calculate statistics
    const stats = {
      total: tasks.length,
      overdue: 0,
      dueToday: 0,
      pending: 0,
      highPriority: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach(task => {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today && task.status !== 'completed' && task.status !== 'cancelled') {
        stats.overdue++;
      }

      if (dueDate.getTime() === today.getTime() && task.status !== 'completed' && task.status !== 'cancelled') {
        stats.dueToday++;
      }

      if (task.status === 'pending') {
        stats.pending++;
      }

      if (['high', 'urgent', 'critical'].includes(task.priority)) {
        stats.highPriority++;
      }
    });

    return { displayTasks: tasks, summaryStats: stats };
  }, [tasksData?.data?.tasks]);

  // Update filter options with counts
  const filterOptionsWithCounts = useMemo(() => 
    FILTER_OPTIONS.map(option => ({
      ...option,
      count: option.key === 'all' ? summaryStats.total :
             option.key === 'pending' ? summaryStats.pending :
             option.key === 'overdue' ? summaryStats.overdue :
             option.key === 'high_priority' ? summaryStats.highPriority :
             option.key === 'due_today' ? summaryStats.dueToday : 0,
    })), [summaryStats]
  );

  // Touch gesture handlers for task actions
  const { attachGestures } = useTouchGestures({
    onSwipeLeft: (element) => {
      // Find the task associated with the swiped element
      const taskId = element?.getAttribute('data-task-id');
      const task = displayTasks.find(t => t._id === taskId);
      if (task && task.status === 'pending') {
        handleQuickAction('complete', task);
      }
    },
    onSwipeRight: (element) => {
      // Find the task associated with the swiped element
      const taskId = element?.getAttribute('data-task-id');
      const task = displayTasks.find(t => t._id === taskId);
      if (task && task.status === 'pending') {
        handleQuickAction('convert', task);
      }
    },
  }, {
    swipeThreshold: 80,
  });

  // Event handlers
  const handleTaskClick = useCallback((task: FollowUpTask) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
    selectTask(task);
    onTaskSelect?.(task);
  }, [selectTask, onTaskSelect]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleFilterChange = useCallback((filter: string) => {
    setSelectedFilter(filter);
  }, []);

  const handleQuickAction = useCallback((action: 'complete' | 'convert' | 'escalate', task: FollowUpTask) => {
    setActionDialogOpen({ type: action, task, open: true });
  }, []);

  const handleQuickActionMenu = useCallback((event: React.MouseEvent<HTMLElement>, task: FollowUpTask) => {
    event.stopPropagation();
    setQuickActionMenuAnchor(event.currentTarget);
    setQuickActionTask(task);
  }, []);

  const handleCompleteTask = useCallback(async () => {
    const { task } = actionDialogOpen;
    if (!task) return;

    try {
      await completeTaskMutation.mutateAsync({
        taskId: task._id,
        completionData: {
          outcome: {
            status: 'successful',
            notes: completionNotes,
            nextActions: [],
            appointmentCreated: false,
          },
        },
      });
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
      
      setActionDialogOpen({ type: null, task: null, open: false });
      setCompletionNotes('');
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  }, [actionDialogOpen, completionNotes, completeTaskMutation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Check if task is overdue
  const isTaskOverdue = useCallback((task: FollowUpTask) => {
    return isPast(new Date(task.dueDate)) && 
           task.status !== 'completed' && 
           task.status !== 'cancelled';
  }, []);

  // Get priority icon
  const getPriorityIcon = useCallback((priority: FollowUpPriority) => {
    switch (priority) {
      case 'critical':
        return '🔴';
      case 'urgent':
        return '🟠';
      case 'high':
        return '🟡';
      case 'medium':
        return '🔵';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  }, []);

  if (error) {
    return (
      <Box sx={{ 
        p: 2,
        paddingTop: `${safeAreaInsets.top + 16}px`,
        paddingBottom: `${safeAreaInsets.bottom + 16}px`,
      }}>
        <Alert severity="error">
          Failed to load follow-up tasks: {error.message}
          <Button onClick={handleRefresh} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        height: '100vh',
        paddingTop: `${safeAreaInsets.top}px`,
        paddingBottom: `${safeAreaInsets.bottom + 80}px`,
        overflow: 'hidden',
      }}
    >
      {/* Mobile Toolbar */}
      <AppBar 
        position="sticky" 
        elevation={1}
        sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Follow-up Tasks
          </Typography>
          
          <Badge badgeContent={summaryStats.overdue} color="error" max={99}>
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              size="small"
            >
              <RefreshIcon sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }} />
            </IconButton>
          </Badge>
        </Toolbar>
      </AppBar>

      {/* Search Bar */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          placeholder="Search tasks..."
          value={searchTerm}
          onChange={handleSearchChange}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Filter Chips */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
          {filterOptionsWithCounts.map((option) => (
            <Chip
              key={option.key}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                  {option.count > 0 && (
                    <Badge 
                      badgeContent={option.count} 
                      color={option.key === 'overdue' ? 'error' : 'primary'}
                      max={99}
                      sx={{ ml: 0.5 }}
                    />
                  )}
                </Box>
              }
              variant={selectedFilter === option.key ? 'filled' : 'outlined'}
              color={selectedFilter === option.key ? 'primary' : 'default'}
              onClick={() => handleFilterChange(option.key)}
              sx={{ 
                cursor: 'pointer',
                minWidth: 'fit-content',
                whiteSpace: 'nowrap',
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Task List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
              </Box>
            ))}
          </Box>
        ) : displayTasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No follow-up tasks found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm || selectedFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first follow-up task to get started'
              }
            </Typography>
            {onCreateTask && (
              <Button variant="contained" onClick={onCreateTask} startIcon={<AddIcon />}>
                Create Task
              </Button>
            )}
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {displayTasks.map((task, index) => (
              <React.Fragment key={task._id}>
                <ListItemButton
                  onClick={() => handleTaskClick(task)}
                  data-task-id={task._id}
                  ref={(el) => el && attachGestures(el)}
                  sx={{
                    py: 2,
                    px: 2,
                    borderLeft: `4px solid ${PRIORITY_COLORS[task.priority]}`,
                    backgroundColor: isTaskOverdue(task) ? 'error.light' : 'transparent',
                    '&:hover': {
                      backgroundColor: isTaskOverdue(task) ? 'error.light' : 'action.hover',
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                      transition: 'transform 0.1s ease',
                    },
                  }}
                >
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        bgcolor: STATUS_COLORS[task.status],
                        width: 40,
                        height: 40,
                        fontSize: '1.2rem',
                      }}
                    >
                      {getPriorityIcon(task.priority)}
                    </Avatar>
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'medium', flex: 1 }}>
                          {task.title}
                        </Typography>
                        
                        {isTaskOverdue(task) && (
                          <Chip
                            label="OVERDUE"
                            size="small"
                            color="error"
                            variant="filled"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {TYPE_LABELS[task.type].emoji} {TYPE_LABELS[task.type].label}
                        </Typography>
                        
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                          <Chip
                            label={task.status.replace('_', ' ').toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: STATUS_COLORS[task.status],
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                          
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarIcon sx={{ fontSize: 12 }} />
                            Due: {format(new Date(task.dueDate), 'MMM dd')}
                          </Typography>
                          
                          {task.estimatedDuration && (
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TimeIcon sx={{ fontSize: 12 }} />
                              {task.estimatedDuration}m
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    }
                  />

                  {task.status === 'pending' && (
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={(e) => handleQuickActionMenu(e, task)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItemButton>
                
                {index < displayTasks.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Floating Action Button */}
      {onCreateTask && (
        <Zoom in={!taskDetailsOpen}>
          <Fab
            color="primary"
            aria-label="add task"
            onClick={onCreateTask}
            sx={{
              position: 'fixed',
              bottom: safeAreaInsets.bottom + 16,
              right: 16,
              zIndex: 1000,
            }}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      )}

      {/* Touch Gesture Hint */}
      {isTouchDevice && displayTasks.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: safeAreaInsets.bottom + 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        >
          <Chip
            icon={<TouchAppIcon />}
            label="Swipe left: Complete • Swipe right: Convert"
            size="small"
            variant="outlined"
            sx={{
              bgcolor: 'background.paper',
              backdropFilter: 'blur(8px)',
            }}
          />
        </Box>
      )}

      {/* Quick Action Menu */}
      <Menu
        anchorEl={quickActionMenuAnchor}
        open={Boolean(quickActionMenuAnchor)}
        onClose={() => setQuickActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (quickActionTask) handleQuickAction('complete', quickActionTask);
          setQuickActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText primary="Complete Task" />
        </MenuItem>
        
        <MenuItem onClick={() => {
          if (quickActionTask) handleQuickAction('convert', quickActionTask);
          setQuickActionMenuAnchor(null);
        }}>
          <ListItemIcon>
            <EventIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Convert to Appointment" />
        </MenuItem>
        
        {quickActionTask && ['low', 'medium'].includes(quickActionTask.priority) && (
          <MenuItem onClick={() => {
            if (quickActionTask) handleQuickAction('escalate', quickActionTask);
            setQuickActionMenuAnchor(null);
          }}>
            <ListItemIcon>
              <TrendingUpIcon color="warning" />
            </ListItemIcon>
            <ListItemText primary="Escalate Priority" />
          </MenuItem>
        )}
      </Menu>

      {/* Task Details Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={taskDetailsOpen}
        onClose={() => setTaskDetailsOpen(false)}
        onOpen={() => setTaskDetailsOpen(true)}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            height: '80vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: `${safeAreaInsets.bottom}px`,
          },
        }}
      >
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              bgcolor: 'divider',
              borderRadius: 2,
              mx: 'auto',
            }}
          />
        </Box>
        
        {selectedTask && (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {selectedTask.title}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              {selectedTask.description}
            </Typography>
            
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Details
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Type:</Typography>
                    <Typography variant="body2">
                      {TYPE_LABELS[selectedTask.type].emoji} {TYPE_LABELS[selectedTask.type].label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Priority:</Typography>
                    <Chip
                      label={selectedTask.priority.toUpperCase()}
                      size="small"
                      sx={{ bgcolor: PRIORITY_COLORS[selectedTask.priority], color: 'white' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Due Date:</Typography>
                    <Typography variant="body2">
                      {format(new Date(selectedTask.dueDate), 'PPP')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Status:</Typography>
                    <Chip
                      label={selectedTask.status.replace('_', ' ').toUpperCase()}
                      size="small"
                      sx={{ bgcolor: STATUS_COLORS[selectedTask.status], color: 'white' }}
                    />
                  </Box>
                </Stack>
              </Box>
              
              {selectedTask.status === 'pending' && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleQuickAction('complete', selectedTask)}
                    fullWidth
                  >
                    Complete
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<EventIcon />}
                    onClick={() => handleQuickAction('convert', selectedTask)}
                    fullWidth
                  >
                    Convert
                  </Button>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </SwipeableDrawer>

      {/* Complete Task Dialog */}
      <Dialog
        open={actionDialogOpen.open && actionDialogOpen.type === 'complete'}
        onClose={() => setActionDialogOpen({ type: null, task: null, open: false })}
        fullScreen
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        <AppBar position="sticky">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setActionDialogOpen({ type: null, task: null, open: false })}
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              Complete Task
            </Typography>
            <Button
              color="inherit"
              onClick={handleCompleteTask}
              disabled={!completionNotes.trim() || completeTaskMutation.isLoading}
            >
              {completeTaskMutation.isLoading ? 'Saving...' : 'Complete'}
            </Button>
          </Toolbar>
        </AppBar>
        
        <DialogContent sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complete "{actionDialogOpen.task?.title}"
          </Typography>
          
          <TextField
            label="Completion Notes"
            multiline
            rows={6}
            fullWidth
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            placeholder="Describe what was accomplished and any follow-up actions needed..."
            required
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MobileFollowUpTaskList;