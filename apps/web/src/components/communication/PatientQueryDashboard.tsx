import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  Badge,
  LinearProgress,
  Alert,
  Grid,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import FilterList from '@mui/icons-material/FilterList';
import Refresh from '@mui/icons-material/Refresh';
import Assignment from '@mui/icons-material/Assignment';
import Schedule from '@mui/icons-material/Schedule';
import CheckCircle from '@mui/icons-material/CheckCircle';
import PriorityHigh from '@mui/icons-material/PriorityHigh';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Assessment from '@mui/icons-material/Assessment';
import Download from '@mui/icons-material/Download';
import Add from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import QueryCard from './QueryCard';
import NewConversationModal from './NewConversationModal';
import { useCommunicationStore } from '../../stores/communicationStore';
import { Conversation, ConversationFilters } from '../../stores/types';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';
import {
  ReplyDialog,
  AssignDialog,
  EditQueryDialog,
  ForwardDialog,
  ConfirmDialog,
} from './dialogs';

interface PatientQueryDashboardProps {
  patientId?: string;
  height?: string | number;
  showAnalytics?: boolean;
  onQuerySelect?: (query: Conversation) => void;
  onCreateQuery?: () => void;
}

interface QueryAnalytics {
  totalQueries: number;
  openQueries: number;
  resolvedQueries: number;
  averageResponseTime: number;
  urgentQueries: number;
  queryTrends: {
    period: string;
    count: number;
  }[];
}

const PatientQueryDashboard: React.FC<PatientQueryDashboardProps> = ({
  patientId,
  height = '600px',
  showAnalytics = true,
  onQuerySelect,
  onCreateQuery,
}) => {
  // Helper to normalize various ID shapes to a stable string for React keys and comparisons
  const toIdString = (id: any): string => {
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object') {
      if (typeof (id as any)._id === 'string') return (id as any)._id;
      if (typeof (id as any)._id === 'object') return toIdString((id as any)._id);
      if (typeof (id as any).$oid === 'string') return (id as any).$oid;
      if (typeof (id as any).toHexString === 'function') return (id as any).toHexString();
      const str = typeof (id as any).toString === 'function' ? (id as any).toString() : '';
      if (str && str !== '[object Object]') return str;
      try { return JSON.stringify(id); } catch { return String(id ?? ''); }
    }
    return String(id ?? '');
  };
  const {
    conversations,
    loading,
    errors,
    fetchConversations,
    clearConversationFilters,
    resolveConversation,
    archiveConversation,
    updateConversation,
    deleteConversation,
    sendMessage,
    addParticipant,
    setActiveConversation,
  } = useCommunicationStore();

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  // const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null,
  });
  const [showNewQueryModal, setShowNewQueryModal] = useState(false);
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  // Dialog state
  const [replyState, setReplyState] = useState<{ open: boolean; query: Conversation | null }>({ open: false, query: null });
  const [assignState, setAssignState] = useState<{ open: boolean; query: Conversation | null }>({ open: false, query: null });
  const [editState, setEditState] = useState<{ open: boolean; query: Conversation | null }>({ open: false, query: null });
  const [forwardState, setForwardState] = useState<{ open: boolean; query: Conversation | null }>({ open: false, query: null });
  const [confirmState, setConfirmState] = useState<{ open: boolean; query: Conversation | null; action?: 'delete' }>(
    { open: false, query: null }
  );

  // Filter conversations to only patient queries
  const patientQueries = useMemo(() => {
    return conversations.filter((conv) => {
      // Filter by type
      if (conv.type !== 'patient_query') return false;

      // Filter by patient ID if provided
      if (patientId && toIdString(conv.patientId) !== patientId) return false;

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = conv.title?.toLowerCase().includes(searchLower);
        const participantMatch = conv.participants.some((p) =>
          p.role.toLowerCase().includes(searchLower)
        );
        const tagMatch = conv.tags.some((tag) =>
          tag.toLowerCase().includes(searchLower)
        );

        if (!titleMatch && !participantMatch && !tagMatch) return false;
      }

      // Apply status filter
      if (statusFilter !== 'all' && conv.status !== statusFilter) return false;

      // Apply priority filter
      if (priorityFilter !== 'all' && conv.priority !== priorityFilter)
        return false;

      // Apply date range filter
      if (dateRange.start || dateRange.end) {
        const queryDate = new Date(conv.createdAt);
        if (dateRange.start && queryDate < startOfDay(dateRange.start))
          return false;
        if (dateRange.end && queryDate > endOfDay(dateRange.end)) return false;
      }

      return true;
    });
  }, [
    conversations,
    patientId,
    searchTerm,
    statusFilter,
    priorityFilter,
    dateRange,
  ]);

  // Group queries by status for tabs
  const queriesByStatus = useMemo(() => {
    return {
      all: patientQueries,
      open: patientQueries.filter((q) => q.status === 'active'),
      pending: patientQueries.filter(
        (q) => q.status === 'active' && q.priority === 'high'
      ),
      resolved: patientQueries.filter((q) => q.status === 'resolved'),
      archived: patientQueries.filter((q) => q.status === 'archived'),
    };
  }, [patientQueries]);

  // Calculate analytics
  const analytics: QueryAnalytics = useMemo(() => {
    const totalQueries = patientQueries.length;
    const openQueries = queriesByStatus.open.length;
    const resolvedQueries = queriesByStatus.resolved.length;
    const urgentQueries = patientQueries.filter(
      (q) => q.priority === 'urgent'
    ).length;

    // Calculate average response time (mock calculation)
    const averageResponseTime =
      resolvedQueries > 0 ? Math.round(Math.random() * 24 + 2) : 0; // Mock: 2-26 hours

    // Generate trend data for the last 7 days
    const queryTrends = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayQueries = patientQueries.filter((q) => {
        const queryDate = new Date(q.createdAt);
        return format(queryDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });

      return {
        period: format(date, 'MMM dd'),
        count: dayQueries.length,
      };
    });

    return {
      totalQueries,
      openQueries,
      resolvedQueries,
      averageResponseTime,
      urgentQueries,
      queryTrends,
    };
  }, [patientQueries, queriesByStatus]);

  // Tab configuration
  const tabs = [
    { label: 'All Queries', value: 'all', count: queriesByStatus.all.length },
    { label: 'Open', value: 'open', count: queriesByStatus.open.length },
    {
      label: 'Pending',
      value: 'pending',
      count: queriesByStatus.pending.length,
    },
    {
      label: 'Resolved',
      value: 'resolved',
      count: queriesByStatus.resolved.length,
    },
    {
      label: 'Archived',
      value: 'archived',
      count: queriesByStatus.archived.length,
    },
  ];

  // Get current tab queries
  const currentTabQueries =
    queriesByStatus[tabs[activeTab].value as keyof typeof queriesByStatus];

  // Load conversations on mount
  useEffect(() => {
    const filters: ConversationFilters = {
      type: 'patient_query',
      ...(patientId && { patientId }),
      sortBy: 'lastMessageAt',
      sortOrder: 'desc',
    };

    fetchConversations(filters);
  }, [patientId, fetchConversations]);

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle query actions
  const handleQueryAction = async (action: string, queryId: string) => {
    try {
      const query = conversations.find(c => c._id === queryId) || null;
      switch (action) {
        case 'resolve':
          await resolveConversation(queryId);
          toast.success('Marked as resolved');
          break;
        case 'archive':
          await archiveConversation(queryId);
          toast.success('Archived');
          break;
        case 'assign':
          setAssignState({ open: true, query });
          break;
        case 'escalate':
          await updateConversation(queryId, { priority: 'urgent' });
          try {
            await apiClient.put(`/communication/conversations/${queryId}`, { priority: 'urgent' });
          } catch { }
          toast.success('Escalated to urgent');
          break;
        case 'reply':
          setReplyState({ open: true, query });
          break;
        case 'edit':
          setEditState({ open: true, query });
          break;
        case 'forward':
          setForwardState({ open: true, query });
          break;
        case 'delete':
          setConfirmState({ open: true, query, action: 'delete' });
          break;
        case 'view':
          if (query) {
            setActiveConversation(query);
            onQuerySelect?.(query);
          }
          break;
        default:

      }
    } catch (error) {
      console.error('Query action failed:', error);
      toast.error('Action failed');
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    try {
      const promises = selectedQueries.map((queryId) => {
        switch (action) {
          case 'resolve':
            return resolveConversation(queryId);
          case 'archive':
            return archiveConversation(queryId);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      setSelectedQueries([]);
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    const filters: ConversationFilters = {
      type: 'patient_query',
      ...(patientId && { patientId }),
      sortBy: 'lastMessageAt',
      sortOrder: 'desc',
    };

    fetchConversations(filters);
  };

  // Handle export
  const handleExport = () => {
    // TODO: Implement export functionality

  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateRange({ start: null, end: null });
    clearConversationFilters();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="h5" component="h1">
              Patient Query Dashboard
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh">
                <IconButton
                  onClick={handleRefresh}
                  disabled={loading.fetchConversations}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>

              <Tooltip title="Export">
                <IconButton onClick={handleExport}>
                  <Download />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  if (onCreateQuery) {
                    onCreateQuery();
                  } else {
                    setShowNewQueryModal(true);
                  }
                }}
              >
                New Query
              </Button>
            </Box>
          </Box>

          {/* Analytics Cards */}
          {showAnalytics && (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assignment color="primary" />
                      <Box>
                        <Typography variant="h6">
                          {analytics.totalQueries}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total Queries
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule color="warning" />
                      <Box>
                        <Typography variant="h6">
                          {analytics.openQueries}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Open Queries
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle color="success" />
                      <Box>
                        <Typography variant="h6">
                          {analytics.resolvedQueries}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Resolved
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PriorityHigh color="error" />
                      <Box>
                        <Typography variant="h6">
                          {analytics.urgentQueries}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Urgent
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp color="info" />
                      <Box>
                        <Typography variant="h6">
                          {analytics.averageResponseTime}h
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Avg Response
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Filters */}
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Priority"
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value="all">All Priority</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <DatePicker
                label="Start Date"
                value={dateRange.start}
                onChange={(date) =>
                  setDateRange((prev) => ({ ...prev, start: date as Date | null }))
                }
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <DatePicker
                label="End Date"
                value={dateRange.end}
                onChange={(date) =>
                  setDateRange((prev) => ({ ...prev, end: date as Date | null }))
                }
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 1 }}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={handleClearFilters}
                size="small"
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Loading indicator */}
        {loading.fetchConversations && <LinearProgress />}

        {/* Error display */}
        {errors.fetchConversations && (
          <Alert severity="error" sx={{ m: 2 }}>
            {errors.fetchConversations}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            {tabs.map((tab) => (
              <Tab
                key={tab.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {tab.label}
                    <Badge badgeContent={tab.count} color="primary" />
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        {/* Bulk actions */}
        {selectedQueries.length > 0 && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'action.selected',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography variant="body2">
              {selectedQueries.length} queries selected
            </Typography>

            <Button
              size="small"
              variant="outlined"
              onClick={() => handleBulkAction('resolve')}
            >
              Resolve Selected
            </Button>

            <Button
              size="small"
              variant="outlined"
              onClick={() => handleBulkAction('archive')}
            >
              Archive Selected
            </Button>

            <Button
              size="small"
              variant="text"
              onClick={() => setSelectedQueries([])}
            >
              Clear Selection
            </Button>
          </Box>
        )}

        {/* Query List */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {currentTabQueries.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
              }}
            >
              <Assessment
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No queries found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {activeTab === 0
                  ? 'No patient queries match your current filters.'
                  : `No ${tabs[activeTab].label.toLowerCase()} queries found.`}
              </Typography>
              {activeTab === 0 && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowNewQueryModal(true)}
                >
                  Create First Query
                </Button>
              )}
            </Box>
          ) : (
            <Grid container spacing={2}>
              {currentTabQueries.map((query) => (
                <Grid size={{ xs: 12 }} key={toIdString(query._id)}>
                  <QueryCard
                    query={query}
                    selected={selectedQueries.includes(toIdString(query._id))}
                    onSelect={(selected) => {
                      if (selected) {
                        setSelectedQueries((prev) => [...prev, toIdString(query._id)]);
                      } else {
                        setSelectedQueries((prev) =>
                          prev.filter((id) => id !== toIdString(query._id))
                        );
                      }
                    }}
                    onClick={() => onQuerySelect?.(query)}
                    onAction={handleQueryAction}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* New Query Modal */}
        <NewConversationModal
          open={showNewQueryModal}
          onClose={() => setShowNewQueryModal(false)}
          defaultType="patient_query"
          patientId={patientId}
        />
      </Box>
      {/* Action Dialogs */}
      <ReplyDialog
        open={replyState.open}
        onClose={() => setReplyState({ open: false, query: null })}
        onSubmit={async (message: string) => {
          if (!replyState.query) return;
          const res = await sendMessage({
            conversationId: replyState.query._id,
            content: { text: message, type: 'text' },
          } as any);
          if (res) {
            toast.success('Reply sent');
            setReplyState({ open: false, query: null });
          } else {
            toast.error('Failed to send reply');
          }
        }}
      />

      <AssignDialog
        open={assignState.open}
        onClose={() => setAssignState({ open: false, query: null })}
        onSubmit={async ({ userId, role }: { userId: string; role: string }) => {
          if (!assignState.query) return;
          const ok = await addParticipant(assignState.query._id, userId, role);
          if (ok) {
            toast.success('Assigned');
            setAssignState({ open: false, query: null });
          } else {
            toast.error('Failed to assign');
          }
        }}
      />

      <EditQueryDialog
        open={editState.open}
        initialTitle={editState.query?.title || ''}
        initialPriority={(editState.query?.priority || 'normal') as any}
        onClose={() => setEditState({ open: false, query: null })}
        onSubmit={async ({ title, priority }: { title: string; priority: 'low' | 'normal' | 'high' | 'urgent' }) => {
          if (!editState.query) return;
          try {
            updateConversation(editState.query._id, { title, priority } as any);
            await apiClient.put(`/communication/conversations/${editState.query._id}`, { title, priority });
            toast.success('Query updated');
            setEditState({ open: false, query: null });
          } catch (e) {
            toast.error('Failed to update');
          }
        }}
      />

      <ForwardDialog
        open={forwardState.open}
        onClose={() => setForwardState({ open: false, query: null })}
        onSubmit={async ({ userId, note }: { userId: string; note?: string }) => {
          if (!forwardState.query) return;
          const ok = await addParticipant(forwardState.query._id, userId, 'forwarded');
          if (ok) {
            if (note) {
              await sendMessage({
                conversationId: forwardState.query._id,
                content: { text: `Forwarded to ${userId}: ${note}`, type: 'text' },
              } as any);
            }
            toast.success('Forwarded');
            setForwardState({ open: false, query: null });
          } else {
            toast.error('Failed to forward');
          }
        }}
      />

      <ConfirmDialog
        open={confirmState.open}
        title="Delete Query"
        description="This will permanently delete the conversation. This action cannot be undone."
        confirmText="Delete"
        onClose={() => setConfirmState({ open: false, query: null })}
        onConfirm={async () => {
          if (!confirmState.query) return;
          const ok = await deleteConversation(confirmState.query._id);
          if (ok) {
            toast.success('Deleted');
          } else {
            toast.error('Failed to delete');
          }
          setConfirmState({ open: false, query: null });
        }}
      />
    </LocalizationProvider>
  );
};

export default PatientQueryDashboard;
