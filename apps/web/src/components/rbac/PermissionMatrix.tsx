import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Analytics as AnalyticsIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useRBAC } from '../../hooks/useRBAC';
import {
  getPermissionMatrix,
  getPermissionCategories,
  updatePermissionMatrix,
  getPermissionUsageAnalytics,
  exportRoleAssignments,
} from '../../services/rbacService';
import type { Role, Permission, PermissionCategory } from '../../types/rbac';

interface PermissionMatrixProps {
  selectedRole?: Role | null;
  onRoleSelect?: (role: Role) => void;
  workspaceScoped?: boolean;
  workspaceId?: string;
}

interface MatrixData {
  roles: Role[];
  permissions: Permission[];
  matrix: Record<string, Record<string, boolean>>;
}

interface PermissionUsage {
  permission: string;
  roleCount: number;
  userCount: number;
  displayName: string;
  category: string;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  selectedRole,
  onRoleSelect,
  workspaceScoped = false,
  workspaceId,
}) => {
  const { canAccess } = useRBAC();

  // State management
  const [matrixData, setMatrixData] = useState<MatrixData>({
    roles: [],
    permissions: [],
    matrix: {},
  });
  const [permissionCategories, setPermissionCategories] = useState<
    PermissionCategory[]
  >([]);

  const [permissionUsage, setPermissionUsage] = useState<PermissionUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Dialog states
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<
    Array<{
      type: string;
      message: string;
      severity: 'warning' | 'error';
    }>
  >([]);

  // Analytics dialog
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);

  // Notification state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matrixResponse, categoriesResponse, usageResponse] =
        await Promise.all([
          getPermissionMatrix(),
          getPermissionCategories(),
          getPermissionUsageAnalytics().catch(() => ({ success: false, data: { permissionUsage: [] } })),
        ]);

      if (matrixResponse.success && matrixResponse.data) {
        setMatrixData({
          roles: matrixResponse.data.roles || [],
          permissions: matrixResponse.data.permissions || [],
          matrix: matrixResponse.data.matrix || {},
        });
      }

      if (categoriesResponse.success) {
        // Backend returns array of category objects directly
        const categories = Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : [];
        setPermissionCategories(categories);
        // Expand all categories by default
        if (categories.length > 0 && categories[0].name) {
          setExpandedCategories(
            new Set(categories.map((cat) => cat.name))
          );
        }
      }

      if (usageResponse.success && usageResponse.data?.permissionUsage) {
        setPermissionUsage(usageResponse.data.permissionUsage);
      }
    } catch (error) {
      console.error('Error loading permission matrix:', error);
      showSnackbar('Failed to load permission matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Permission matrix operations
  const handlePermissionToggle = async (roleId: string, permission: string) => {
    if (!canAccess('canUpdate')) {
      showSnackbar('You do not have permission to modify roles', 'error');
      return;
    }

    try {
      setSaving(true);
      const currentValue = matrixData.matrix[roleId]?.[permission] || false;
      const newValue = !currentValue;

      // Update local state immediately for better UX
      setMatrixData((prev) => ({
        ...prev,
        matrix: {
          ...prev.matrix,
          [roleId]: {
            ...prev.matrix[roleId],
            [permission]: newValue,
          },
        },
      }));

      // Update on server
      const response = await updatePermissionMatrix(roleId, {
        [permission]: newValue,
      });

      if (response.success) {
        showSnackbar(
          `Permission ${newValue ? 'granted' : 'revoked'} successfully`,
          'success'
        );
      } else {
        // Revert local state if server update failed
        setMatrixData((prev) => ({
          ...prev,
          matrix: {
            ...prev.matrix,
            [roleId]: {
              ...prev.matrix[roleId],
              [permission]: currentValue,
            },
          },
        }));
        showSnackbar('Failed to update permission', 'error');
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      showSnackbar('Failed to update permission', 'error');
      // Reload data to ensure consistency
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPermissionUpdate = async (
    roleId: string,
    permissions: Record<string, boolean>
  ) => {
    if (!canAccess('canUpdate')) {
      showSnackbar('You do not have permission to modify roles', 'error');
      return;
    }

    try {
      setSaving(true);

      // Convert permissions object to array
      const permissionArray = Object.entries(permissions)
        .filter(([_, granted]) => granted)
        .map(([permission]) => permission);

      const response = await updateRole(roleId, {
        permissions: permissionArray,
      });

      if (response.success) {
        showSnackbar('Permissions updated successfully', 'success');
        await loadData(); // Reload to get fresh data
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      showSnackbar('Failed to update permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Category expansion handling
  const handleCategoryToggle = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Filter permissions and roles
  const filteredCategories = permissionCategories.filter((category) => {
    if (categoryFilter && category.name !== categoryFilter) return false;

    // Safety check: ensure category.permissions exists and is an array
    if (!category.permissions || !Array.isArray(category.permissions)) {
      return false;
    }

    const hasMatchingPermissions = category.permissions.some((permission) => {
      const matchesSearch =
        !searchTerm ||
        permission.displayName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        permission.action.toLowerCase().includes(searchTerm.toLowerCase());

      if (showOnlyAssigned) {
        const hasAssignments = (matrixData.roles || []).some(
          (role) => matrixData.matrix[role._id]?.[permission.action]
        );
        return matchesSearch && hasAssignments;
      }

      return matchesSearch;
    });

    return hasMatchingPermissions;
  });

  const filteredRoles = (matrixData.roles || []).filter((role) => {
    if (roleFilter && role._id !== roleFilter) return false;
    return true;
  });

  // Get permission conflicts
  const getPermissionConflicts = (
    permission: string
  ): Array<{ type: string; message: string }> => {
    const conflicts: Array<{ type: string; message: string }> = [];

    // Find permission object
    const permissionObj = matrixData.permissions.find(
      (p) => p.action === permission
    );
    if (!permissionObj) return conflicts;

    // Check for dependency conflicts
    if (permissionObj.dependsOn && Array.isArray(permissionObj.dependsOn)) {
      permissionObj.dependsOn.forEach((dependency) => {
        const rolesWithPermission = filteredRoles.filter(
          (role) => matrixData.matrix[role._id]?.[permission]
        );

        rolesWithPermission.forEach((role) => {
          if (!matrixData.matrix[role._id]?.[dependency]) {
            conflicts.push({
              type: 'dependency',
              message: `Role "${role.displayName}" has "${permission}" but missing dependency "${dependency}"`,
            });
          }
        });
      });
    }

    // Check for direct conflicts
    if (permissionObj.conflicts && Array.isArray(permissionObj.conflicts)) {
      permissionObj.conflicts.forEach((conflictPermission) => {
        const rolesWithBoth = filteredRoles.filter(
          (role) =>
            matrixData.matrix[role._id]?.[permission] &&
            matrixData.matrix[role._id]?.[conflictPermission]
        );

        rolesWithBoth.forEach((role) => {
          conflicts.push({
            type: 'conflict',
            message: `Role "${role.displayName}" has conflicting permissions: "${permission}" and "${conflictPermission}"`,
          });
        });
      });
    }

    return conflicts;
  };

  // Get usage statistics for a permission
  const getPermissionUsageStats = (permission: string) => {
    return permissionUsage.find((usage) => usage.permission === permission);
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h5"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <SecurityIcon color="primary" />
          Permission Matrix
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={() => setAnalyticsDialogOpen(true)}
          >
            Analytics
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={async () => {
              try {
                const blob = await exportRoleAssignments('csv');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'permission-matrix.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showSnackbar('Export successful', 'success');
              } catch (error) {
                showSnackbar('Failed to export matrix', 'error');
              }
            }}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              placeholder="Search permissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All</MenuItem>
                {permissionCategories
                  .filter((cat) => cat && cat.name && cat.displayName)
                  .map((category) => (
                    <MenuItem key={category.name} value={category.name}>
                      {category.displayName}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="Role"
              >
                <MenuItem value="">All</MenuItem>
                {(matrixData.roles || []).map((role) => (
                  <MenuItem key={role._id} value={role._id}>
                    {role.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyAssigned}
                  onChange={(e) => setShowOnlyAssigned(e.target.checked)}
                />
              }
              label="Show only assigned"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={() =>
                  setExpandedCategories(
                    new Set(
                      permissionCategories
                        .filter((cat) => cat && cat.name)
                        .map((cat) => cat.name)
                    )
                  )
                }
              >
                Expand All
              </Button>
              <Button
                size="small"
                onClick={() => setExpandedCategories(new Set())}
              >
                Collapse All
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Permission Matrix */}
      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 800 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 250, fontWeight: 'bold' }}>
                  Permission
                </TableCell>
                {filteredRoles.map((role) => (
                  <TableCell
                    key={role._id}
                    align="center"
                    sx={{
                      minWidth: 120,
                      fontWeight: 'bold',
                      cursor: onRoleSelect ? 'pointer' : 'default',
                      '&:hover': onRoleSelect
                        ? { backgroundColor: 'action.hover' }
                        : {},
                    }}
                    onClick={() => onRoleSelect?.(role)}
                  >
                    <Box>
                      <Typography variant="subtitle2" noWrap>
                        {role.displayName}
                      </Typography>
                      <Chip
                        label={role.category}
                        size="small"
                        variant="outlined"
                        color={
                          role.category === 'system' ? 'primary' : 'default'
                        }
                      />
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCategories.map((category) => (
                <React.Fragment key={category.name}>
                  {/* Category Header */}
                  <TableRow>
                    <TableCell
                      colSpan={filteredRoles.length + 1}
                      sx={{
                        backgroundColor: 'action.hover',
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.selected' },
                      }}
                      onClick={() => handleCategoryToggle(category.name)}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {expandedCategories.has(category.name) ? (
                          <KeyboardArrowDownIcon />
                        ) : (
                          <KeyboardArrowRightIcon />
                        )}
                        <Typography variant="subtitle1" fontWeight="bold">
                          {category.displayName}
                        </Typography>
                        <Chip
                          label={`${category.permissions?.length || 0} permissions`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Category Permissions */}
                  {expandedCategories.has(category.name) &&
                    (category.permissions || [])
                      .filter((permission) => {
                        const matchesSearch =
                          !searchTerm ||
                          permission.displayName
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          permission.action
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase());

                        if (showOnlyAssigned) {
                          const hasAssignments = filteredRoles.some(
                            (role) =>
                              matrixData.matrix[role._id]?.[permission.action]
                          );
                          return matchesSearch && hasAssignments;
                        }

                        return matchesSearch;
                      })
                      .map((permission) => {
                        if (!permission || !permission.action) {
                          return null;
                        }

                        const conflicts = getPermissionConflicts(
                          permission.action
                        );
                        const usage = getPermissionUsageStats(
                          permission.action
                        );

                        return (
                          <TableRow key={permission.action} hover>
                            <TableCell>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                }}
                              >
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {permission.displayName}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                  >
                                    {permission.action}
                                  </Typography>
                                  {permission.description && (
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      color="textSecondary"
                                    >
                                      {permission.description}
                                    </Typography>
                                  )}
                                </Box>

                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                  }}
                                >
                                  {conflicts.length > 0 && (
                                    <Tooltip
                                      title={`${conflicts.length} conflicts detected`}
                                    >
                                      <WarningIcon
                                        color="warning"
                                        fontSize="small"
                                      />
                                    </Tooltip>
                                  )}

                                  {permission.requiresSubscription && (
                                    <Tooltip title="Requires subscription">
                                      <InfoIcon color="info" fontSize="small" />
                                    </Tooltip>
                                  )}

                                  {usage && (
                                    <Tooltip
                                      title={`Used by ${usage.roleCount} roles, ${usage.userCount} users`}
                                    >
                                      <Chip
                                        label={usage.userCount}
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                      />
                                    </Tooltip>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>

                            {filteredRoles.map((role) => {
                              const hasPermission =
                                matrixData.matrix[role._id]?.[
                                permission.action
                                ] || false;
                              const isSystemRole = role.isSystemRole;
                              const canModify =
                                canAccess('canUpdate') && !isSystemRole;

                              return (
                                <TableCell key={role._id} align="center">
                                  <Checkbox
                                    checked={hasPermission}
                                    onChange={() =>
                                      handlePermissionToggle(
                                        role._id,
                                        permission.action
                                      )
                                    }
                                    disabled={!canModify || saving}
                                    color="primary"
                                    size="small"
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Analytics Dialog */}
      <Dialog
        open={analyticsDialogOpen}
        onClose={() => setAnalyticsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Permission Usage Analytics</DialogTitle>
        <DialogContent>
          {permissionUsage.length > 0 ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Most Used Permissions
                    </Typography>
                    <List dense>
                      {permissionUsage
                        .sort((a, b) => b.userCount - a.userCount)
                        .slice(0, 10)
                        .map((usage) => (
                          <ListItem key={usage.permission}>
                            <ListItemText
                              primary={usage.displayName}
                              secondary={`${usage.userCount} users, ${usage.roleCount} roles`}
                            />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Unused Permissions
                    </Typography>
                    <List dense>
                      {permissionUsage
                        .filter((usage) => usage.userCount === 0)
                        .slice(0, 10)
                        .map((usage) => (
                          <ListItem key={usage.permission}>
                            <ListItemIcon>
                              <WarningIcon color="warning" />
                            </ListItemIcon>
                            <ListItemText
                              primary={usage.displayName}
                              secondary={usage.category}
                            />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <InfoIcon color="info" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Analytics Data Available
              </Typography>
              <Typography color="textSecondary">
                Permission usage analytics will be available once data is collected.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnalyticsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PermissionMatrix;
