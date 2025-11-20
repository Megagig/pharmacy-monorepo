import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Avatar,
    IconButton,
    Tooltip,
    Collapse,
    useTheme,
    alpha,
    Divider,
    Stack,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ComputerIcon from '@mui/icons-material/Computer';
import VerifiedIcon from '@mui/icons-material/Verified';
import { formatDistanceToNow } from 'date-fns';
import { AuditLog } from '../../services/superAdminAuditService';

interface ActivityCardProps {
    activity: AuditLog;
    onFlag?: (auditId: string, flagged: boolean) => void;
    onViewDetails?: (activity: AuditLog) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onFlag }) => {
    const [expanded, setExpanded] = React.useState(false);
    const theme = useTheme();

    const getRiskLevelColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'critical':
                return theme.palette.error.main;
            case 'high':
                return theme.palette.warning.main;
            case 'medium':
                return theme.palette.info.main;
            case 'low':
            default:
                return theme.palette.success.main;
        }
    };

    const getRiskLevelIcon = (riskLevel: string) => {
        switch (riskLevel) {
            case 'critical':
                return <ErrorIcon fontSize="small" />;
            case 'high':
                return <WarningIcon fontSize="small" />;
            case 'medium':
                return <InfoIcon fontSize="small" />;
            case 'low':
            default:
                return <CheckCircleIcon fontSize="small" />;
        }
    };

    const getActivityTypeColor = (activityType: string): any => {
        const colors: Record<string, any> = {
            authentication: 'primary',
            authorization: 'secondary',
            user_management: 'info',
            patient_management: 'success',
            medication_management: 'warning',
            mtr_session: 'info',
            clinical_intervention: 'success',
            communication: 'primary',
            workspace_management: 'secondary',
            security_event: 'error',
            system_configuration: 'warning',
            file_operation: 'default',
            report_generation: 'info',
            audit_export: 'warning',
            diagnostic_ai: 'secondary',
            subscription_management: 'primary',
            payment_transaction: 'success',
            compliance_event: 'warning',
            data_export: 'error',
            data_import: 'info',
            other: 'default',
        };
        return colors[activityType] || 'default';
    };

    const handleToggleFlag = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onFlag) {
            onFlag(activity._id, !activity.flagged);
        }
    };

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    const riskColor = getRiskLevelColor(activity.riskLevel);

    return (
        <Card
            elevation={0}
            sx={{
                position: 'relative',
                border: `1px solid ${activity.flagged ? theme.palette.error.main : theme.palette.divider}`,
                borderRadius: 2,
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: activity.flagged
                    ? `linear-gradient(to right, ${alpha(theme.palette.error.main, 0.05)}, transparent)`
                    : 'background.paper',
                '&:hover': {
                    boxShadow: `0 4px 20px ${alpha(riskColor, 0.15)}`,
                    transform: 'translateY(-2px)',
                    borderColor: riskColor,
                },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: riskColor,
                },
            }}
        >
            <CardContent sx={{ p: 2.5 }}>
                <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
                    {/* Main Content */}
                    <Box display="flex" alignItems="flex-start" flex={1} gap={2}>
                        {/* User Avatar */}
                        <Avatar
                            src={activity.userDetails?.avatarUrl}
                            sx={{
                                width: 48,
                                height: 48,
                                bgcolor: riskColor,
                                border: `2px solid ${alpha(riskColor, 0.2)}`,
                                boxShadow: `0 0 0 4px ${alpha(riskColor, 0.1)}`,
                            }}
                        >
                            {activity.userDetails?.firstName?.charAt(0) || 'U'}
                            {activity.userDetails?.lastName?.charAt(0) || 'N'}
                        </Avatar>

                        <Box flex={1}>
                            {/* User Info */}
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                <Typography variant="subtitle1" fontWeight="600">
                                    {activity.userDetails?.firstName || 'Unknown'} {activity.userDetails?.lastName || 'User'}
                                </Typography>
                                {activity.success ? (
                                    <Tooltip title="Success">
                                        <VerifiedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="Failed">
                                        <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                    </Tooltip>
                                )}
                            </Box>

                            <Typography
                                variant="caption"
                                color="text.secondary"
                                display="flex"
                                alignItems="center"
                                gap={1}
                                mb={1.5}
                            >
                                {activity.userDetails?.email || 'N/A'} · {activity.userDetails?.role || 'Unknown'}
                                {activity.userDetails?.workplaceRole && ` · ${activity.userDetails.workplaceRole}`}
                            </Typography>

                            {/* Description */}
                            <Typography
                                variant="body2"
                                sx={{
                                    mb: 1.5,
                                    fontWeight: 500,
                                    color: 'text.primary',
                                }}
                            >
                                {activity.description}
                            </Typography>

                            {/* Target Entity */}
                            {activity.targetEntity && (
                                <Box
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        px: 1.5,
                                        py: 0.5,
                                        mb: 1.5,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        borderRadius: 1,
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    }}
                                >
                                    <Typography variant="caption" fontWeight="600" color="primary.main">
                                        Target:
                                    </Typography>
                                    <Typography variant="caption" fontWeight="500">
                                        {activity.targetEntity.entityType}: {activity.targetEntity.entityName}
                                    </Typography>
                                </Box>
                            )}

                            {/* Activity Tags */}
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                    label={activity.activityType.replace(/_/g, ' ').toUpperCase()}
                                    size="small"
                                    color={getActivityTypeColor(activity.activityType)}
                                    sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                />
                                <Chip
                                    icon={getRiskLevelIcon(activity.riskLevel)}
                                    label={activity.riskLevel.toUpperCase()}
                                    size="small"
                                    sx={{
                                        bgcolor: alpha(riskColor, 0.1),
                                        color: riskColor,
                                        borderColor: riskColor,
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        '& .MuiChip-icon': {
                                            color: riskColor,
                                        },
                                    }}
                                />
                                {activity.complianceCategory && (
                                    <Chip
                                        label={activity.complianceCategory}
                                        size="small"
                                        color="secondary"
                                        variant="outlined"
                                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                    />
                                )}
                            </Stack>

                            {/* Metadata Footer */}
                            <Stack
                                direction="row"
                                spacing={2}
                                mt={2}
                                flexWrap="wrap"
                                sx={{ opacity: 0.8 }}
                            >
                                <Box display="flex" alignItems="center" gap={0.5}>
                                    <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary" fontWeight="500">
                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                    </Typography>
                                </Box>
                                {activity.ipAddress && (
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <ComputerIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                                            {activity.ipAddress}
                                        </Typography>
                                    </Box>
                                )}
                                {activity.location && (
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary" fontWeight="500">
                                            {[activity.location.city, activity.location.region, activity.location.country]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    </Box>

                    {/* Actions */}
                    <Box display="flex" flexDirection="column" gap={0.5}>
                        <Tooltip title={activity.flagged ? 'Unflag' : 'Flag for review'}>
                            <IconButton
                                size="small"
                                onClick={handleToggleFlag}
                                sx={{
                                    color: activity.flagged ? theme.palette.error.main : theme.palette.text.secondary,
                                    bgcolor: activity.flagged ? alpha(theme.palette.error.main, 0.1) : 'transparent',
                                    '&:hover': {
                                        bgcolor: activity.flagged ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.action.hover, 0.5),
                                    },
                                }}
                            >
                                {activity.flagged ? <FlagIcon /> : <FlagOutlinedIcon />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={expanded ? 'Show less' : 'Show more'}>
                            <IconButton
                                size="small"
                                onClick={handleExpandClick}
                                sx={{
                                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s',
                                }}
                            >
                                <ExpandMoreIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Expanded Details */}
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 2 }} />
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : alpha(theme.palette.grey[100], 0.5),
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight="600" mb={2} color="primary">
                            Detailed Information
                        </Typography>

                        {/* Request Details */}
                        {activity.requestMethod && activity.requestPath && (
                            <Box mb={2}>
                                <Typography variant="caption" fontWeight="600" color="text.secondary" display="block" mb={0.5}>
                                    Request Details
                                </Typography>
                                <Box
                                    sx={{
                                        p: 1.5,
                                        bgcolor: 'background.paper',
                                        borderRadius: 1,
                                        border: `1px solid ${theme.palette.divider}`,
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    <Typography variant="body2">
                                        <strong>{activity.requestMethod}</strong> {activity.requestPath}
                                        {activity.responseStatus && (
                                            <Chip
                                                label={activity.responseStatus}
                                                size="small"
                                                color={activity.responseStatus < 400 ? 'success' : 'error'}
                                                sx={{ ml: 1, fontWeight: 600 }}
                                            />
                                        )}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Changes */}
                        {activity.changes && activity.changes.length > 0 && (
                            <Box mb={2}>
                                <Typography variant="caption" fontWeight="600" color="text.secondary" display="block" mb={0.5}>
                                    Changes Made
                                </Typography>
                                <Stack spacing={1}>
                                    {activity.changes.map((change, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                p: 1.5,
                                                bgcolor: 'background.paper',
                                                borderRadius: 1,
                                                border: `1px solid ${theme.palette.divider}`,
                                            }}
                                        >
                                            <Typography variant="caption" fontWeight="600" color="primary" display="block" mb={0.5}>
                                                {change.field}
                                            </Typography>
                                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                                <Chip
                                                    label={JSON.stringify(change.oldValue)}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: alpha(theme.palette.error.main, 0.1),
                                                        color: theme.palette.error.main,
                                                        textDecoration: 'line-through',
                                                        fontFamily: 'monospace',
                                                    }}
                                                />
                                                <Typography variant="body2">→</Typography>
                                                <Chip
                                                    label={JSON.stringify(change.newValue)}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: alpha(theme.palette.success.main, 0.1),
                                                        color: theme.palette.success.main,
                                                        fontFamily: 'monospace',
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {/* Metadata */}
                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <Box mb={2}>
                                <Typography variant="caption" fontWeight="600" color="text.secondary" display="block" mb={0.5}>
                                    Additional Metadata
                                </Typography>
                                <Box
                                    component="pre"
                                    sx={{
                                        fontSize: '0.75rem',
                                        bgcolor: 'background.paper',
                                        p: 1.5,
                                        borderRadius: 1,
                                        border: `1px solid ${theme.palette.divider}`,
                                        overflow: 'auto',
                                        maxHeight: '200px',
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {JSON.stringify(activity.metadata, null, 2)}
                                </Box>
                            </Box>
                        )}

                        {/* Error Details */}
                        {activity.errorMessage && (
                            <Box
                                mb={2}
                                sx={{
                                    p: 1.5,
                                    bgcolor: alpha(theme.palette.error.main, 0.1),
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                }}
                            >
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                    <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                    <Typography variant="caption" fontWeight="600" color="error.main">
                                        Error Details
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="error.main">
                                    {activity.errorMessage}
                                </Typography>
                            </Box>
                        )}

                        {/* Review Notes */}
                        {activity.reviewNotes && (
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: alpha(theme.palette.info.main, 0.1),
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                                }}
                            >
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                    <InfoIcon sx={{ fontSize: 16, color: 'info.main' }} />
                                    <Typography variant="caption" fontWeight="600" color="info.main">
                                        Review Notes
                                    </Typography>
                                </Box>
                                <Typography variant="body2">{activity.reviewNotes}</Typography>
                                {activity.reviewedAt && (
                                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                                        Reviewed {formatDistanceToNow(new Date(activity.reviewedAt), { addSuffix: true })}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </CardContent>
        </Card>
    );
};

export default ActivityCard;
