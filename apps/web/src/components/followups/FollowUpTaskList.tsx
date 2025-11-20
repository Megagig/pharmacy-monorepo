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
  ListItemSecondaryAction,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  InputAdornment,
  Fab,
  Badge,
  useTheme,
  useMediaQuery,
  Skeleton,
  Pagination,
  Divider,
  Menu,
  MenuList,
  ListItemButton,
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
} from '@mui/icons-material';
import { format, formatDistanceToNow, isAfter, isBefore, isToday, isPast } from 'date-fns';

// Hooks and types
import { useFollowUpTasks, useCompleteFollowUp, useConvertToAppointment, useEscalateFollowUp } from '../../hooks/useFollowUps';
import { useFollowUpStore, useFollowUpFilters, useFollowUpList } from '../../stores/followUpStore';
import {
  FollowUpTask,
  FollowUpFilters,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
} from '../../stores/followUpTypes';

interface FollowUpTaskListProps {
  /** Optional patient filter */
  patientId?: string;
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Height of the task list */
  height?: number | string;
  /** Whether to show summary statistics */
  showSummary?: boolean;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Whether to enable quick actions */
  enableQuickActions?: boolean;
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

// Type labels
const TYPE_LABELS: Record<FollowUpType, string> = {
  medication_start_followup: 'Medication Start',
  lab_result_review: 'Lab Result Review',
  hospital_discharge_followup: 'Hospital Discharge',
  medication_change_followup: 'Medication Change',
  chronic_disease_monitoring: 'Chronic Disease',
  adherence_check: 'Adherence Check',
  refill_reminder: 'Refill Reminder',
  preventive_care: 'Preventive Care',
  general_followup: 'General Follow-up',
};

const FollowUpTaskList: React.FC<FollowUpTaskListProps> = ({
  patientId,
  pharmacistId,
  locationId,
  height = 'calc(100vh - 200px)',
  showSummary = true,
  showFilters = true,
  enableQuickActions = true,
  onTaskSelect,
  onCreateTask,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState<{
    type: 'complete' | 'convert' | 'escalate' | null;
    task: FollowUpTask | null;
    open: boolean;
  }>({ type: null, task: null, open: false });
  const [completionNotes, setCompletionNotes] = useState('');
  const [nextActions, setNextActions] = useState<string[]>(['']);
  const [escalationReason, setEscalationReason] = useState('');
  const [newPriority, setNewPriority] = useState<FollowUpPriority>('high');
  const [appointmentData, setAppointmentData] = useState({
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    scheduledTime: '10:00',
    duration: 30,
    type: 'general_followup',
  });

  // Store hooks
  const { filters, setFilters, clearFilters, filterByStatus, filterByPriority, filterByOverdue } = useFollowUpFilters();
  const { tasks, summary, pagination, loading, errors, setPage, setLimit } = useFollowUpList();
  const { selectTask } = useFollowUpStore();

  // Build filters with props
  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...(patientId && { patientId }),
    ...(pharmacistId && { assignedTo: pharmacistId }),
    ...(locationId && { locationId }),
    ...(searchTerm && { search: searchTerm }),
  }), [filters, patientId, pharmacistId, locationId, searchTerm]);

  // Query hooks
  const { data: tasksData, isLoading, error, refetch } = useFollowUpTasks(effectiveFilters);
  const completeTaskMutation = useCompleteFollowUp();
  const convertToAppointmentMutation = useConvertToAppointment();
  const escalateTaskMutation = useEscalateFollowUp();

  // Memoized filtered and sorted tasks
  const displayTasks = useMemo(() => {
    if (!tasksData?.data?.tasks) return [];
    
    let filteredTasks = tasksData.data.tasks;

    // Apply local search if not handled by server
    if (searchTerm && !effectiveFilters.search) {
      const searchLower = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.type.toLowerCase().includes(searchLower)
      );
    }

    return filteredTasks;
  }, [tasksData?.data?.tasks, searchTerm, effectiveFilters.search]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (summary) return summary;
    
    // Calculate from current tasks if summary not available
    const stats = {
      total: displayTasks.length,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      byPriority: {} as Record<FollowUpPriority, number>,
      byStatus: {} as Record<FollowUpStatus, number>,
      byType: {} as Record<FollowUpType, number>,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    displayTasks.forEach(task => {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Count overdue
      if (dueDate < today && task.status !== 'completed' && task.status !== 'cancelled') {
        stats.overdue++;
      }

      // Count due today
      if (dueDate.getTime() === today.getTime() && task.status !== 'completed' && task.status !== 'cancelled') {
        stats.dueToday++;
      }

      // Count due this week
      if (dueDate >= today && dueDate < nextWeek && task.status !== 'completed' && task.status !== 'cancelled') {
        stats.dueThisWeek++;
      }

      // Count by priority
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

      // Count by status
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;

      // Count by type
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
    });

    return stats;
  }, [displayTasks, summary]);

  // Event handlers
  const handleTaskClick = useCallback((task: FollowUpTask) => {
    selectTask(task);
    onTaskSelect?.(task);
  }, [selectTask, onTaskSelect]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleFilterClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  }, []);

  const handleSortClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSortMenuAnchor(event.currentTarget);
  }, []);

  const handleQuickAction = useCallback((action: 'complete' | 'convert' | 'escalate', task: FollowUpTask) => {
    setActionDialogOpen({ type: action, task, open: true });
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
            nextActions: nextActions.filter(action => action.trim()),
            appointmentCreated: false,
          },
        },
      });
      
      setActionDialogOpen({ type: null, task: null, open: false });
      setCompletionNotes('');
      setNextActions(['']);
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  }, [actionDialogOpen, completionNotes, nextActions, completeTaskMutation]);

  const handleConvertToAppointment = useCallback(async () => {
    const { task } = actionDialogOpen;
    if (!task) return;

    try {
      await convertToAppointmentMutation.mutateAsync({
        taskId: task._id,
        appointmentData,
      });
      
      setActionDialogOpen({ type: null, task: null, open: false });
    } catch (error) {
      console.error('Failed to convert to appointment:', error);
    }
  }, [actionDialogOpen, appointmentData, convertToAppointmentMutation]);

  const handleEscalateTask = useCallback(async () => {
    const { task } = actionDialogOpen;
    if (!task) return;

    try {
      await escalateTaskMutation.mutateAsync({
        taskId: task._id,
        escalationData: {
          newPriority,
          reason: escalationReason,
        },
      });
      
      setActionDialogOpen({ type: null, task: null, open: false });
      setEscalationReason('');
    } catch (error) {
      console.error('Failed to escalate task:', error);
    }
  }, [actionDialogOpen, newPriority, escalationReason, escalateTaskMutation]);

  const handlePageChange = useCallback((event: React.ChangeEvent<unknown>, page: number) => {
    setPage(page);
  }, [setPage]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    setSearchTerm('');
  }, [clearFilters]);

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
        return <FlagIcon sx={{ color: PRIORITY_COLORS.critical }} />;
      case 'urgent':
        return <WarningIcon sx={{ color: PRIORITY_COLORS.urgent }} />;
      case 'high':
        return <TrendingUpIcon sx={{ color: PRIORITY_COLORS.high }} />;
      default:
        return <FlagIcon sx={{ color: PRIORITY_COLORS[priority] }} />;
    }
  }, []);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load follow-up tasks: {error.message}
        <Button onClick={() => refetch()} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Summary Statistics */}
      {showSummary && (
        <Grid container spacing={2} sx={{ mb: 2, px: 2 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="primary">
                  {summaryStats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Tasks
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="error">
                  {summaryStats.overdue}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overdue
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="warning.main">
                  {summaryStats.dueToday}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Due Today
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h4" color="info.main">
                  {summaryStats.dueThisWeek}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Due This Week
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters and Search */}
      {showFilters && (
        <Card sx={{ mb: 2, mx: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="center">
              {/* Search */}
              <TextField
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={handleSearchChange}
                size="small"
                sx={{ flexGrow: 1, minWidth: isMobile ? '100%' : 300 }}
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

              {/* Quick Filters */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant={filters.overdue ? 'contained' : 'outlined'}
                  size="small"
                  color="error"
                  onClick={() => filterByOverdue(!filters.overdue)}
                  startIcon={<WarningIcon />}
                >
                  Overdue ({summaryStats.overdue})
                </Button>
                
                <Button
                  variant={filters.status === 'pending' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => filterByStatus(filters.status === 'pending' ? [] : 'pending')}
                  startIcon={<AssignmentIcon />}
                >
                  Pending
                </Button>

                <Button
                  variant={filters.priority === 'high' || filters.priority === 'urgent' || filters.priority === 'critical' ? 'contained' : 'outlined'}
                  size="small"
                  color="warning"
                  onClick={() => filterByPriority(
                    Array.isArray(filters.priority) && filters.priority.includes('high') 
                      ? [] 
                      : ['high', 'urgent', 'critical']
                  )}
                  startIcon={<FlagIcon />}
                >
                  High Priority
                </Button>
              </Stack>

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <IconButton onClick={handleFilterClick} size="small">
                  <FilterIcon />
                </IconButton>
                
                <IconButton onClick={handleSortClick} size="small">
                  <SortIcon />
                </IconButton>
                
                <IconButton onClick={() => refetch()} size="small" disabled={isLoading}>
                  <RefreshIcon />
                </IconButton>
                
                {(Object.keys(filters).length > 2 || searchTerm) && (
                  <Button size="small" onClick={handleClearFilters} startIcon={<ClearIcon />}>
                    Clear
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      <Card sx={{ flexGrow: 1, mx: 2, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 0 }}>
          {isLoading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Skeleton variant="rectangular" height={80} />
                </Box>
              ))}
            </Box>
          ) : displayTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No follow-up tasks found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm || Object.keys(filters).length > 2
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
                  <ListItem
                    button
                    onClick={() => handleTaskClick(task)}
                    sx={{
                      py: 2,
                      px: 3,
                      borderLeft: `4px solid ${PRIORITY_COLORS[task.priority]}`,
                      backgroundColor: isTaskOverdue(task) ? 'error.light' : 'transparent',
                      '&:hover': {
                        backgroundColor: isTaskOverdue(task) ? 'error.light' : 'action.hover',
                      },
                      ...(isTaskOverdue(task) && {
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'error.main',
                          opacity: 0.05,
                          pointerEvents: 'none',
                        },
                      }),
                    }}
                  >
                    <ListItemIcon>
                      <Avatar
                        sx={{
                          bgcolor: STATUS_COLORS[task.status],
                          width: 40,
                          height: 40,
                        }}
                      >
                        {getPriorityIcon(task.priority)}
                      </Avatar>
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            {task.title}
                          </Typography>
                          
                          {isTaskOverdue(task) && (
                            <Chip
                              label="OVERDUE"
                              size="small"
                              color="error"
                              variant="filled"
                            />
                          )}
                          
                          <Chip
                            label={task.status.replace('_', ' ').toUpperCase()}
                            size="small"
                            sx={{
                              bgcolor: STATUS_COLORS[task.status],
                              color: 'white',
                              fontWeight: 'bold',
                            }}
                          />
                          
                          <Chip
                            label={TYPE_LABELS[task.type]}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {task.description}
                          </Typography>
                          
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption">
                                Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PersonIcon sx={{ fontSize: 16 }} />
                              <Typography variant="caption">
                                Patient ID: {typeof task.patientId === 'object' ? (task.patientId as any)?._id || 'N/A' : task.patientId}
                              </Typography>
                            </Box>
                            
                            {task.estimatedDuration && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TimeIcon sx={{ fontSize: 16 }} />
                                <Typography variant="caption">
                                  {task.estimatedDuration} min
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      }
                    />

                    {enableQuickActions && task.status === 'pending' && (
                      <ListItemSecondaryAction>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Complete Task">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAction('complete', task);
                              }}
                              color="success"
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Convert to Appointment">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAction('convert', task);
                              }}
                              color="primary"
                            >
                              <EventIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {(task.priority === 'low' || task.priority === 'medium') && (
                            <Tooltip title="Escalate Priority">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction('escalate', task);
                                }}
                                color="warning"
                              >
                                <TrendingUpIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                  
                  {index < displayTasks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </Typography>
              
              <Pagination
                count={pagination.pages}
                page={pagination.page}
                onChange={handlePageChange}
                size={isMobile ? 'small' : 'medium'}
                showFirstButton
                showLastButton
              />
            </Stack>
          </Box>
        )}
      </Card>

      {/* Floating Action Button for Mobile */}
      {isMobile && onCreateTask && (
        <Fab
          color="primary"
          aria-label="add task"
          onClick={onCreateTask}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuList>
          <ListItemButton onClick={() => filterByStatus('pending')}>
            <ListItemText primary="Pending Tasks" />
          </ListItemButton>
          <ListItemButton onClick={() => filterByStatus('in_progress')}>
            <ListItemText primary="In Progress" />
          </ListItemButton>
          <ListItemButton onClick={() => filterByStatus('completed')}>
            <ListItemText primary="Completed" />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={() => filterByPriority('critical')}>
            <ListItemText primary="Critical Priority" />
          </ListItemButton>
          <ListItemButton onClick={() => filterByPriority('urgent')}>
            <ListItemText primary="Urgent Priority" />
          </ListItemButton>
          <ListItemButton onClick={() => filterByPriority('high')}>
            <ListItemText primary="High Priority" />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={() => filterByOverdue(true)}>
            <ListItemText primary="Overdue Tasks" />
          </ListItemButton>
        </MenuList>
      </Menu>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
      >
        <MenuList>
          <ListItemButton onClick={() => setFilters({ sortBy: 'dueDate', sortOrder: 'asc' })}>
            <ListItemText primary="Due Date (Earliest)" />
          </ListItemButton>
          <ListItemButton onClick={() => setFilters({ sortBy: 'dueDate', sortOrder: 'desc' })}>
            <ListItemText primary="Due Date (Latest)" />
          </ListItemButton>
          <ListItemButton onClick={() => setFilters({ sortBy: 'priority', sortOrder: 'desc' })}>
            <ListItemText primary="Priority (High to Low)" />
          </ListItemButton>
          <ListItemButton onClick={() => setFilters({ sortBy: 'createdAt', sortOrder: 'desc' })}>
            <ListItemText primary="Recently Created" />
          </ListItemButton>
        </MenuList>
      </Menu>

      {/* Complete Task Dialog */}
      <Dialog
        open={actionDialogOpen.open && actionDialogOpen.type === 'complete'}
        onClose={() => setActionDialogOpen({ type: null, task: null, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Complete Follow-up Task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complete "{actionDialogOpen.task?.title}"
          </Typography>
          
          <TextField
            label="Completion Notes"
            multiline
            rows={4}
            fullWidth
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Next Actions (Optional)
          </Typography>
          {nextActions.map((action, index) => (
            <TextField
              key={index}
              label={`Action ${index + 1}`}
              fullWidth
              value={action}
              onChange={(e) => {
                const newActions = [...nextActions];
                newActions[index] = e.target.value;
                setNextActions(newActions);
              }}
              sx={{ mb: 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {index === nextActions.length - 1 ? (
                      <IconButton
                        size="small"
                        onClick={() => setNextActions([...nextActions, ''])}
                      >
                        <AddIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => {
                          const newActions = nextActions.filter((_, i) => i !== index);
                          setNextActions(newActions);
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    )}
                  </InputAdornment>
                ),
              }}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen({ type: null, task: null, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleCompleteTask}
            variant="contained"
            disabled={!completionNotes.trim() || completeTaskMutation.isPending}
          >
            {completeTaskMutation.isPending ? <CircularProgress size={20} /> : 'Complete Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Convert to Appointment Dialog */}
      <Dialog
        open={actionDialogOpen.open && actionDialogOpen.type === 'convert'}
        onClose={() => setActionDialogOpen({ type: null, task: null, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Convert to Appointment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Convert "{actionDialogOpen.task?.title}" to an appointment
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={appointmentData.scheduledDate}
                onChange={(e) => setAppointmentData({ ...appointmentData, scheduledDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Time"
                type="time"
                fullWidth
                value={appointmentData.scheduledTime}
                onChange={(e) => setAppointmentData({ ...appointmentData, scheduledTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Duration (minutes)"
                type="number"
                fullWidth
                value={appointmentData.duration}
                onChange={(e) => setAppointmentData({ ...appointmentData, duration: parseInt(e.target.value) })}
                inputProps={{ min: 15, max: 120, step: 15 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Appointment Type</InputLabel>
                <Select
                  value={appointmentData.type}
                  onChange={(e) => setAppointmentData({ ...appointmentData, type: e.target.value })}
                  label="Appointment Type"
                >
                  <MenuItem value="general_followup">General Follow-up</MenuItem>
                  <MenuItem value="mtm_session">MTM Session</MenuItem>
                  <MenuItem value="chronic_disease_review">Chronic Disease Review</MenuItem>
                  <MenuItem value="new_medication_consultation">New Medication Consultation</MenuItem>
                  <MenuItem value="health_check">Health Check</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen({ type: null, task: null, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleConvertToAppointment}
            variant="contained"
            disabled={convertToAppointmentMutation.isPending}
          >
            {convertToAppointmentMutation.isPending ? <CircularProgress size={20} /> : 'Create Appointment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Escalate Task Dialog */}
      <Dialog
        open={actionDialogOpen.open && actionDialogOpen.type === 'escalate'}
        onClose={() => setActionDialogOpen({ type: null, task: null, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Escalate Task Priority</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Escalate "{actionDialogOpen.task?.title}" priority
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>New Priority</InputLabel>
            <Select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as FollowUpPriority)}
              label="New Priority"
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Escalation Reason"
            multiline
            rows={3}
            fullWidth
            value={escalationReason}
            onChange={(e) => setEscalationReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen({ type: null, task: null, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleEscalateTask}
            variant="contained"
            color="warning"
            disabled={!escalationReason.trim() || escalateTaskMutation.isPending}
          >
            {escalateTaskMutation.isPending ? <CircularProgress size={20} /> : 'Escalate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FollowUpTaskList;