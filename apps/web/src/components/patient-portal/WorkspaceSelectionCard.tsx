import React from 'react';
import {
    Card,
    CardContent,
    CardActionArea,
    Box,
    Typography,
    Chip,
    Avatar,
    Button,
    Divider,
} from '@mui/material';
import {
    LocationOn as LocationOnIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Schedule as ScheduleIcon,
    VerifiedUser as VerifiedUserIcon,
    LocalPharmacy as LocalPharmacyIcon,
    PersonAdd as PersonAddIcon,
    Login as LoginIcon,
} from '@mui/icons-material';

export interface WorkspaceCardData {
    id: string;
    workspaceId: string;
    name: string;
    type: string;
    email: string;
    phone?: string;
    address: string;
    state?: string;
    lga?: string;
    logoUrl?: string;
    operatingHours?: string;
    services?: string[];
    description?: string;
    distance?: number; // Optional distance in km
}

interface WorkspaceSelectionCardProps {
    workspace: WorkspaceCardData;
    onSelect?: (workspace: WorkspaceCardData) => void;
    onRegister?: (workspace: WorkspaceCardData) => void;
    onLogin?: (workspace: WorkspaceCardData) => void;
    variant?: 'default' | 'compact';
}

const WorkspaceSelectionCard: React.FC<WorkspaceSelectionCardProps> = ({
    workspace,
    onSelect,
    onRegister,
    onLogin,
    variant = 'default',
}) => {
    const getWorkspaceInitial = (name: string) => {
        return name.charAt(0).toUpperCase();
    };

    const getTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' | 'default' => {
        const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error' } = {
            community: 'primary',
            hospital: 'secondary',
            clinic: 'info',
            laboratory: 'success',
            pharmacy: 'primary',
        };
        return colors[type.toLowerCase()] || 'default';
    };

    const handleCardClick = () => {
        if (onSelect) {
            onSelect(workspace);
        }
    };

    const handleRegisterClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRegister) {
            onRegister(workspace);
        }
    };

    const handleLoginClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onLogin) {
            onLogin(workspace);
        }
    };

    if (variant === 'compact') {
        return (
            <Card
                sx={{
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(8, 145, 178, 0.12)',
                    },
                }}
            >
                <CardActionArea onClick={handleCardClick}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                                src={workspace.logoUrl}
                                sx={{
                                    width: 48,
                                    height: 48,
                                    bgcolor: 'primary.main',
                                    fontSize: '1.25rem',
                                }}
                            >
                                {getWorkspaceInitial(workspace.name)}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {workspace.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {workspace.address}
                                    {workspace.state && `, ${workspace.state}`}
                                </Typography>
                            </Box>
                            <Chip
                                label={workspace.type}
                                color={getTypeColor(workspace.type)}
                                size="small"
                            />
                        </Box>
                    </CardContent>
                </CardActionArea>
            </Card>
        );
    }

    return (
        <Card
            sx={{
                height: '100%',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(8, 145, 178, 0.15)',
                },
            }}
        >
            <CardActionArea onClick={handleCardClick} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {/* Logo */}
                        <Avatar
                            src={workspace.logoUrl}
                            sx={{
                                width: 64,
                                height: 64,
                                bgcolor: 'primary.main',
                                fontSize: '1.5rem',
                            }}
                        >
                            {getWorkspaceInitial(workspace.name)}
                        </Avatar>

                        {/* Content */}
                        <Box sx={{ flex: 1 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    mb: 1,
                                }}
                            >
                                <Box sx={{ flex: 1 }}>
                                    <Typography
                                        variant="h6"
                                        sx={{ fontWeight: 600, lineHeight: 1.3, mb: 0.5 }}
                                    >
                                        {workspace.name}
                                    </Typography>
                                    {workspace.distance !== undefined && (
                                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                                            {workspace.distance < 1
                                                ? `${(workspace.distance * 1000).toFixed(0)}m away`
                                                : `${workspace.distance.toFixed(1)}km away`
                                            }
                                        </Typography>
                                    )}
                                </Box>
                                <Chip
                                    label={workspace.type}
                                    color={getTypeColor(workspace.type)}
                                    size="small"
                                    sx={{ ml: 1 }}
                                />
                            </Box>

                            {workspace.description && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                >
                                    {workspace.description}
                                </Typography>
                            )}

                            {/* Address */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <LocationOnIcon
                                    sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {workspace.address}
                                    {workspace.state && `, ${workspace.state}`}
                                    {workspace.lga && ` (${workspace.lga})`}
                                </Typography>
                            </Box>

                            {/* Phone */}
                            {workspace.phone && (
                                <Box
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                                >
                                    <PhoneIcon
                                        sx={{ fontSize: 18, color: 'text.secondary' }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        {workspace.phone}
                                    </Typography>
                                </Box>
                            )}

                            {/* Email */}
                            {workspace.email && (
                                <Box
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                                >
                                    <EmailIcon
                                        sx={{ fontSize: 18, color: 'text.secondary' }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        {workspace.email}
                                    </Typography>
                                </Box>
                            )}

                            {/* Operating Hours */}
                            {workspace.operatingHours && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <ScheduleIcon
                                        sx={{ fontSize: 18, color: 'text.secondary' }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        {workspace.operatingHours}
                                    </Typography>
                                </Box>
                            )}

                            {/* Services */}
                            {workspace.services && workspace.services.length > 0 && (
                                <>
                                    <Divider sx={{ my: 2 }} />
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                            Services Offered:
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {workspace.services.slice(0, 3).map((service, index) => (
                                                <Chip
                                                    key={index}
                                                    label={service}
                                                    size="small"
                                                    variant="outlined"
                                                    icon={<LocalPharmacyIcon />}
                                                />
                                            ))}
                                            {workspace.services.length > 3 && (
                                                <Chip
                                                    label={`+${workspace.services.length - 3} more`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                </>
                            )}

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                                {onRegister && (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<PersonAddIcon />}
                                        onClick={handleRegisterClick}
                                        sx={{ borderRadius: 2, flex: 1 }}
                                    >
                                        Register
                                    </Button>
                                )}
                                {onLogin && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<LoginIcon />}
                                        onClick={handleLoginClick}
                                        sx={{ borderRadius: 2, flex: 1 }}
                                    >
                                        Sign In
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </CardActionArea>
        </Card>
    );
};

export default WorkspaceSelectionCard;
