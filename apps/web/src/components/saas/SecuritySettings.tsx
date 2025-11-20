import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon,
  AccountCircle as SessionsIcon,
  History as HistoryIcon,
  Block as BlockIcon,
  LockOpen as LockOpenIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSaasSettings } from '../../queries/useSaasSettings';
import { format } from 'date-fns';

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
      id={`security-tabpanel-${index}`}
      aria-labelledby={`security-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number;
  preventReuse: number;
}

interface AccountLockout {
  maxFailedAttempts: number;
  lockoutDuration: number;
  autoUnlock: boolean;
  notifyOnLockout: boolean;
}

interface SecuritySettingsData {
  passwordPolicy: PasswordPolicy;
  accountLockout: AccountLockout;
}

interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  loginTime: string;
  lastActivity: string;
  isActive: boolean;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
}

interface SecurityAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  ipAddress: string;
  timestamp: string;
  success: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

const SecuritySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90,
    preventReuse: 5,
  });
  const [accountLockout, setAccountLockout] = useState<AccountLockout>({
    maxFailedAttempts: 5,
    lockoutDuration: 30,
    autoUnlock: true,
    notifyOnLockout: true,
  });
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [sessionFilters, setSessionFilters] = useState({
    isActive: '',
    ipAddress: '',
    userEmail: '',
  });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    success: '',
    severity: '',
    startDate: '',
    endDate: '',
  });

  const { 
    getSecuritySettings, 
    updatePasswordPolicy,
    updateAccountLockout,
    getActiveSessions, 
    terminateSession,
    getSecurityAuditLogs,
    lockUserAccount,
    unlockUserAccount 
  } = useSaasSettings();

  useEffect(() => {
    loadSecuritySettings();
    if (activeTab === 1) {
      loadActiveSessions();
    } else if (activeTab === 2) {
      loadAuditLogs();
    }
  }, [activeTab]);

  const loadSecuritySettings = async () => {
    try {
      setLoading(true);
      const response = await getSecuritySettings();
      if (response.success && response.data.settings) {
        setPasswordPolicy(response.data.settings.passwordPolicy);
        setAccountLockout(response.data.settings.accountLockout);
      }
    } catch (err: any) {
      console.error('Error loading security settings:', err);
      setError(err.response?.data?.message || 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getActiveSessions(sessionFilters);
      if (response.success && response.data.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (err: any) {
      console.error('Error loading active sessions:', err);
      setError(err.response?.data?.message || 'Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSecurityAuditLogs(auditFilters);
      if (response.success && response.data.auditLogs) {
        setAuditLogs(response.data.auditLogs);
      }
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordPolicyChange = (field: keyof PasswordPolicy, value: any) => {
    setPasswordPolicy(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAccountLockoutChange = (field: keyof AccountLockout, value: any) => {
    setAccountLockout(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSavePasswordPolicy = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Save password policy
      const policyResponse = await updatePasswordPolicy(passwordPolicy);
      
      // Save account lockout settings
      const lockoutResponse = await updateAccountLockout(accountLockout);
      
      if (policyResponse.success && lockoutResponse.success) {
        setSuccess('Security settings updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Error updating security settings:', err);
      setError(err.response?.data?.message || 'Failed to update security settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminateSession = async () => {
    if (!selectedSession) return;

    try {
      setSaving(true);
      setError(null);
      const response = await terminateSession(selectedSession.sessionId, { reason: terminateReason });
      if (response.success) {
        setSuccess('Session terminated successfully');
        setTerminateDialogOpen(false);
        setSelectedSession(null);
        setTerminateReason('');
        loadActiveSessions();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Error terminating session:', err);
      setError(err.response?.data?.message || 'Failed to terminate session');
    } finally {
      setSaving(false);
    }
  };

  const handleLockAccount = async (userId: string, userEmail: string) => {
    const reason = prompt(`Enter reason for locking account ${userEmail}:`);
    if (!reason || reason.length < 10) {
      setError('Lock reason must be at least 10 characters');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await lockUserAccount(userId, { reason });
      if (response.success) {
        setSuccess(`Account ${userEmail} locked successfully`);
        loadActiveSessions();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Error locking account:', err);
      setError(err.response?.data?.message || 'Failed to lock account');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockAccount = async (userId: string, userEmail: string) => {
    try {
      setSaving(true);
      setError(null);
      const response = await unlockUserAccount(userId);
      if (response.success) {
        setSuccess(`Account ${userEmail} unlocked successfully`);
        loadActiveSessions();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Error unlocking account:', err);
      setError(err.response?.data?.message || 'Failed to unlock account');
    } finally {
      setSaving(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile')) return '📱';
    if (userAgent.includes('Tablet')) return '📱';
    return '💻';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab 
                icon={<VpnKeyIcon />} 
                label="Password Policy" 
                id="security-tab-0"
                aria-controls="security-tabpanel-0"
              />
              <Tab 
                icon={<SessionsIcon />} 
                label="Active Sessions" 
                id="security-tab-1"
                aria-controls="security-tabpanel-1"
              />
              <Tab 
                icon={<HistoryIcon />} 
                label="Audit Logs" 
                id="security-tab-2"
                aria-controls="security-tabpanel-2"
              />
            </Tabs>
          </Box>

          {/* Password Policy Tab */}
          <TabPanel value={activeTab} index={0}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon />
              Password Policy Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Password Requirements
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Minimum Length"
                      type="number"
                      value={passwordPolicy.minLength}
                      onChange={(e) => handlePasswordPolicyChange('minLength', parseInt(e.target.value))}
                      inputProps={{ min: 6, max: 128 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={passwordPolicy.requireUppercase}
                          onChange={(e) => handlePasswordPolicyChange('requireUppercase', e.target.checked)}
                        />
                      }
                      label="Require Uppercase Letters"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={passwordPolicy.requireLowercase}
                          onChange={(e) => handlePasswordPolicyChange('requireLowercase', e.target.checked)}
                        />
                      }
                      label="Require Lowercase Letters"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={passwordPolicy.requireNumbers}
                          onChange={(e) => handlePasswordPolicyChange('requireNumbers', e.target.checked)}
                        />
                      }
                      label="Require Numbers"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={passwordPolicy.requireSpecialChars}
                          onChange={(e) => handlePasswordPolicyChange('requireSpecialChars', e.target.checked)}
                        />
                      }
                      label="Require Special Characters"
                    />
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Security Settings
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Password Max Age (days)"
                      type="number"
                      value={passwordPolicy.maxAge}
                      onChange={(e) => handlePasswordPolicyChange('maxAge', parseInt(e.target.value))}
                      inputProps={{ min: 30, max: 365 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Prevent Password Reuse (count)"
                      type="number"
                      value={passwordPolicy.preventReuse}
                      onChange={(e) => handlePasswordPolicyChange('preventReuse', parseInt(e.target.value))}
                      inputProps={{ min: 0, max: 24 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Account Lockout Threshold"
                      type="number"
                      value={accountLockout.maxFailedAttempts}
                      onChange={(e) => handleAccountLockoutChange('maxFailedAttempts', parseInt(e.target.value))}
                      inputProps={{ min: 3, max: 20 }}
                      sx={{ mb: 2 }}
                      helperText="Number of failed login attempts before account lockout"
                    />
                    
                    <TextField
                      fullWidth
                      label="Lockout Duration (minutes)"
                      type="number"
                      value={accountLockout.lockoutDuration}
                      onChange={(e) => handleAccountLockoutChange('lockoutDuration', parseInt(e.target.value))}
                      inputProps={{ min: 5, max: 1440 }}
                      helperText="How long the account remains locked"
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSavePasswordPolicy}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SecurityIcon />}
              >
                {saving ? 'Saving...' : 'Save Password Policy'}
              </Button>
            </Box>
          </TabPanel>

          {/* Active Sessions Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SessionsIcon />
                Active User Sessions
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadActiveSessions}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>

            {/* Session Filters */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Filters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={sessionFilters.isActive}
                        onChange={(e) => setSessionFilters(prev => ({ ...prev, isActive: e.target.value }))}
                        label="Status"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="true">Active</MenuItem>
                        <MenuItem value="false">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="IP Address"
                      value={sessionFilters.ipAddress}
                      onChange={(e) => setSessionFilters(prev => ({ ...prev, ipAddress: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="User Email"
                      value={sessionFilters.userEmail}
                      onChange={(e) => setSessionFilters(prev => ({ ...prev, userEmail: e.target.value }))}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" size="small" onClick={loadActiveSessions}>
                    Apply Filters
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Login Time</TableCell>
                    <TableCell>Last Activity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No active sessions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.sessionId}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {session.userEmail}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {session.userId.slice(-8)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{getDeviceIcon(session.userAgent)}</span>
                            <Box>
                              <Typography variant="body2">
                                {session.deviceInfo?.browser || 'Unknown Browser'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {session.deviceInfo?.os || 'Unknown OS'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{session.ipAddress}</Typography>
                            {session.location && (
                              <Typography variant="caption" color="text.secondary">
                                {session.location}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {format(new Date(session.loginTime), 'MMM dd, HH:mm')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {format(new Date(session.lastActivity), 'MMM dd, HH:mm')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={session.isActive ? 'Active' : 'Inactive'}
                            color={session.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Terminate Session">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedSession(session);
                                  setTerminateDialogOpen(true);
                                }}
                                disabled={!session.isActive}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Lock Account">
                              <IconButton
                                size="small"
                                onClick={() => handleLockAccount(session.userId, session.userEmail)}
                                color="error"
                              >
                                <BlockIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Audit Logs Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                Security Audit Logs
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  size="small"
                >
                  Export
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadAuditLogs}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Box>
            </Box>

            {/* Audit Filters */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Filters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Action"
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Success</InputLabel>
                      <Select
                        value={auditFilters.success}
                        onChange={(e) => setAuditFilters(prev => ({ ...prev, success: e.target.value }))}
                        label="Success"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="true">Success</MenuItem>
                        <MenuItem value="false">Failed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={auditFilters.severity}
                        onChange={(e) => setAuditFilters(prev => ({ ...prev, severity: e.target.value }))}
                        label="Severity"
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={2.5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Start Date"
                      type="date"
                      value={auditFilters.startDate}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2.5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="End Date"
                      type="date"
                      value={auditFilters.endDate}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" size="small" onClick={loadAuditLogs}>
                    Apply Filters
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.userEmail || 'System'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {log.action}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.resource}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.ipAddress}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {log.success ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : (
                              <ErrorIcon color="error" fontSize="small" />
                            )}
                            <Typography variant="body2">
                              {log.success ? 'Success' : 'Failed'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.severity.toUpperCase()}
                            color={getSeverityColor(log.severity) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Terminate Session Dialog */}
      <Dialog open={terminateDialogOpen} onClose={() => setTerminateDialogOpen(false)}>
        <DialogTitle>Terminate Session</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to terminate the session for {selectedSession?.userEmail}?
          </Typography>
          <TextField
            fullWidth
            label="Reason (optional)"
            multiline
            rows={3}
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Enter reason for terminating this session..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTerminateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleTerminateSession}
            color="error"
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Terminating...' : 'Terminate Session'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecuritySettings;