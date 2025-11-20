import React from 'react';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import {
  NavigateNext as NavigateNextIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface DiagnosticBreadcrumbsProps {
  customItems?: BreadcrumbItem[];
}

export const DiagnosticBreadcrumbs: React.FC<DiagnosticBreadcrumbsProps> = ({
  customItems = [],
}) => {
  const location = useLocation();
  const params = useParams();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const baseBreadcrumbs: BreadcrumbItem[] = [
      {
        label: 'Dashboard',
        path: '/dashboard',
      },
      {
        label: 'AI Diagnostics & Therapeutics',
        path: '/pharmacy/diagnostics',
        icon: <ScienceIcon sx={{ fontSize: 16, mr: 0.5 }} />,
      },
    ];

    // Add path-specific breadcrumbs
    const pathSegments = location.pathname.split('/').filter(Boolean);

    if (pathSegments.includes('case')) {
      if (pathSegments.includes('new')) {
        baseBreadcrumbs.push({
          label: 'New Case',
          path: '/pharmacy/diagnostics/case/new',
        });
      } else if (params.requestId) {
        baseBreadcrumbs.push({
          label: 'Cases',
          path: '/pharmacy/diagnostics',
        });
        baseBreadcrumbs.push({
          label: `Case ${params.requestId.slice(-8)}`,
          path: `/pharmacy/diagnostics/case/${params.requestId}`,
        });
      }
    } else if (pathSegments.includes('demo')) {
      baseBreadcrumbs.push({
        label: 'Component Demo',
        path: '/pharmacy/diagnostics/demo',
      });
    }

    // Add any custom items
    return [...baseBreadcrumbs, ...customItems];
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="diagnostic navigation breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-separator': {
            color: 'text.secondary',
          },
        }}
      >
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          if (isLast || !item.path) {
            return (
              <Typography
                key={index}
                color="text.primary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: isLast ? 600 : 400,
                }}
              >
                {item.icon}
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={index}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

export default DiagnosticBreadcrumbs;
