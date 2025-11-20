/**
 * Manual Lab Navigation Integration Component
 * Adds manual lab options to existing navigation without breaking changes
 */

import React from 'react';
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Tooltip,
  Collapse,
  List,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import {
  Science as ScienceIcon,
  Assignment as AssignmentIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  ExpandLess,
  ExpandMore,
  Add as AddIcon,
  List as ListIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { manualLabApi } from '../../services/manualLabApi';

interface ManualLabNavigationProps {
  isCollapsed?: boolean;
  onItemClick?: () => void;
}

export const ManualLabNavigation: React.FC<ManualLabNavigationProps> = ({
  isCollapsed = false,
  onItemClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Check if manual lab features are enabled
  const isManualLabEnabled = isFeatureEnabled('manual_lab_orders');
  const isQRScanningEnabled = isFeatureEnabled('manual_lab_qr_scanning');
  const isAnalyticsEnabled = isFeatureEnabled('manual_lab_analytics');
  const isSecurityEnabled = isFeatureEnabled('manual_lab_enhanced_security');

  // Get pending orders count for badge
  const { data: pendingOrdersCount } = useQuery({
    queryKey: ['manual-lab-pending-count'],
    queryFn: () => manualLabApi.getPendingOrdersCount(),
    enabled: isManualLabEnabled && !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });

  // Don't render if feature is disabled
  if (!isManualLabEnabled) {
    return null;
  }

  // Check if user has required permissions
  const hasLabPermissions =
    user?.role === 'pharmacist' || user?.role === 'owner';
  if (!hasLabPermissions) {
    return null;
  }

  const isActive = location.pathname.startsWith('/manual-lab');
  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleNavigation = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  const navigationItems = [
    {
      key: 'create-order',
      label: 'Create Order',
      icon: <AddIcon />,
      path: '/manual-lab/create',
      enabled: true,
    },
    {
      key: 'orders-list',
      label: 'Orders List',
      icon: <ListIcon />,
      path: '/manual-lab/orders',
      enabled: true,
      badge: pendingOrdersCount?.pending || 0,
    },
    {
      key: 'qr-scanner',
      label: 'QR Scanner',
      icon: <QrCodeScannerIcon />,
      path: '/manual-lab/scan',
      enabled: isQRScanningEnabled,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <AnalyticsIcon />,
      path: '/manual-lab/analytics',
      enabled: isAnalyticsEnabled,
    },
    {
      key: 'security',
      label: 'Security',
      icon: <SecurityIcon />,
      path: '/manual-lab/security',
      enabled: isSecurityEnabled && user?.role === 'owner',
    },
  ];

  const enabledItems = navigationItems.filter((item) => item.enabled);

  if (isCollapsed) {
    return (
      <Tooltip title="Manual Lab Orders" placement="right">
        <ListItem
          button
          onClick={() => handleNavigation('/manual-lab')}
          selected={isActive}
          sx={{
            minHeight: 48,
            justifyContent: 'center',
            px: 2.5,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: 0,
              justifyContent: 'center',
            }}
          >
            <Badge
              badgeContent={pendingOrdersCount?.pending || 0}
              color="error"
              max={99}
            >
              <ScienceIcon />
            </Badge>
          </ListItemIcon>
        </ListItem>
      </Tooltip>
    );
  }

  return (
    <>
      <ListItem
        button
        onClick={handleToggle}
        selected={isActive}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          '&.Mui-selected': {
            backgroundColor: 'primary.light',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
          },
        }}
      >
        <ListItemIcon>
          <Badge
            badgeContent={pendingOrdersCount?.pending || 0}
            color="error"
            max={99}
          >
            <ScienceIcon />
          </Badge>
        </ListItemIcon>
        <ListItemText
          primary="Manual Lab Orders"
          secondary={`${enabledItems.length} features available`}
        />
        {isExpanded ? <ExpandLess /> : <ExpandMore />}
      </ListItem>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {enabledItems.map((item) => (
            <ListItem
              key={item.key}
              button
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                pl: 4,
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color:
                    location.pathname === item.path
                      ? 'inherit'
                      : 'text.secondary',
                }}
              >
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error" max={99}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Collapse>

      {/* Feature status indicator for development */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ px: 2, py: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Manual Lab Features:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {[
              { key: 'manual_lab_orders', label: 'Orders' },
              { key: 'manual_lab_pdf_generation', label: 'PDF' },
              { key: 'manual_lab_qr_scanning', label: 'QR' },
              { key: 'manual_lab_ai_interpretation', label: 'AI' },
              { key: 'manual_lab_fhir_integration', label: 'FHIR' },
            ].map((feature) => (
              <Box
                key={feature.key}
                sx={{
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  backgroundColor: isFeatureEnabled(feature.key)
                    ? 'success.light'
                    : 'error.light',
                  color: isFeatureEnabled(feature.key)
                    ? 'success.contrastText'
                    : 'error.contrastText',
                  fontSize: '0.6rem',
                }}
              >
                {feature.label}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </>
  );
};

/**
 * Hook to get manual lab navigation state
 */
export const useManualLabNavigation = () => {
  const { isFeatureEnabled } = useFeatureFlags();
  const { user } = useAuth();
  const location = useLocation();

  const isManualLabEnabled = isFeatureEnabled('manual_lab_orders');
  const hasLabPermissions =
    user?.role === 'pharmacist' || user?.role === 'owner';
  const isInManualLabSection = location.pathname.startsWith('/manual-lab');

  return {
    isEnabled: isManualLabEnabled && hasLabPermissions,
    isActive: isInManualLabSection,
    availableFeatures: {
      orders: isFeatureEnabled('manual_lab_orders'),
      pdfGeneration: isFeatureEnabled('manual_lab_pdf_generation'),
      qrScanning: isFeatureEnabled('manual_lab_qr_scanning'),
      aiInterpretation: isFeatureEnabled('manual_lab_ai_interpretation'),
      fhirIntegration: isFeatureEnabled('manual_lab_fhir_integration'),
      mobileFeatures: isFeatureEnabled('manual_lab_mobile_features'),
      enhancedSecurity: isFeatureEnabled('manual_lab_enhanced_security'),
      analytics: isFeatureEnabled('manual_lab_analytics'),
      notifications: isFeatureEnabled('manual_lab_notifications'),
    },
  };
};

export default ManualLabNavigation;
