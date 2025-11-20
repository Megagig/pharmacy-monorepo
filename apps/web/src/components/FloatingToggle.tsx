import React from 'react';
import { Fab, Tooltip, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useUIStore } from '../stores';

const FloatingToggle: React.FC = () => {
  const theme = useTheme();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <Tooltip
      title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      placement="right"
    >
      <Fab
        color="primary"
        size="medium"
        onClick={toggleSidebar}
        sx={{
          position: 'fixed',
          // Position exactly on top of "MAIN MENU" text
          top: sidebarOpen ? 95 : 85, // Right on top of MAIN MENU text
          left: sidebarOpen ? 140 : 28, // Centered over MAIN MENU when open, over sidebar when closed
          zIndex: theme.zIndex.speedDial,
          transition: theme.transitions.create(['left', 'top'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
          boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: '0 8px 28px rgba(25, 118, 210, 0.6)',
          },
          // Pulsing animation for visibility
          '@keyframes floatingPulse': {
            '0%': {
              boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
            },
            '50%': {
              boxShadow: '0 10px 32px rgba(25, 118, 210, 0.7)',
            },
            '100%': {
              boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
            },
          },
          animation: 'floatingPulse 3s ease-in-out infinite',
          // Mobile positioning
          [theme.breakpoints.down('md')]: {
            left: sidebarOpen ? 120 : 24,
            top: sidebarOpen ? 90 : 80,
          },
          [theme.breakpoints.down('sm')]: {
            left: sidebarOpen ? 100 : 20,
            top: sidebarOpen ? 85 : 75,
            transform: 'scale(0.9)',
          },
        }}
      >
        {sidebarOpen ? (
          <MenuOpenIcon sx={{ fontSize: 24 }} />
        ) : (
          <MenuIcon sx={{ fontSize: 24 }} />
        )}
      </Fab>
    </Tooltip>
  );
};

export default FloatingToggle;
