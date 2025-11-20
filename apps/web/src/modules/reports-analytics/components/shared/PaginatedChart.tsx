// Paginated Chart Component with Progressive Loading
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  Chip,
  LinearProgress,
  Skeleton,
  Fade,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  Refresh as RefreshIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import ChartComponent from './ChartComponent';
import { ChartData, ChartConfig } from '../../types/charts';

interface PaginatedChartProps {
  data: any[];
  chartConfig: ChartConfig;
  pageSize?: number;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onPageChange?: (page: number, pageData: any[]) => void;
  onRefresh?: () => void;
  onFullscreen?: () => void;
  height?: number;
  showControls?: boolean;
  showProgress?: boolean;
  progressiveLoading?: boolean;
  className?: string;
}

const PaginatedChart: React.FC<PaginatedChartProps> = ({
  data,
  chartConfig,
  pageSize = 50,
  title,
  subtitle,
  loading = false,
  error,
  onPageChange,
  onRefresh,
  onFullscreen,
  height = 400,
  showControls = true,
  showProgress = true,
  progressiveLoading = true,
  className,
}) => {
  const theme = useTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([0]));
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Calculate pagination info
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);

  // Get current page data
  const currentPageData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Progressive loading simulation
  const loadPage = useCallback(
    async (pageIndex: number) => {
      if (loadedPages.has(pageIndex) || !progressiveLoading) {
        return;
      }

      setIsLoadingPage(true);

      // Simulate loading delay for progressive loading
      await new Promise((resolve) => setTimeout(resolve, 300));

      setLoadedPages((prev) => new Set([...prev, pageIndex]));
      setIsLoadingPage(false);
    },
    [loadedPages, progressiveLoading]
  );

  // Handle page navigation
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (newPage < 0 || newPage >= totalPages || newPage === currentPage) {
        return;
      }

      setCurrentPage(newPage);

      // Load page if using progressive loading
      if (progressiveLoading) {
        await loadPage(newPage);
      }

      // Notify parent component
      const newPageData = data.slice(
        newPage * pageSize,
        (newPage + 1) * pageSize
      );
      onPageChange?.(newPage, newPageData);
    },
    [
      currentPage,
      totalPages,
      data,
      pageSize,
      onPageChange,
      loadPage,
      progressiveLoading,
    ]
  );

  // Navigation handlers
  const goToFirstPage = useCallback(
    () => handlePageChange(0),
    [handlePageChange]
  );
  const goToPreviousPage = useCallback(
    () => handlePageChange(currentPage - 1),
    [handlePageChange, currentPage]
  );
  const goToNextPage = useCallback(
    () => handlePageChange(currentPage + 1),
    [handlePageChange, currentPage]
  );
  const goToLastPage = useCallback(
    () => handlePageChange(totalPages - 1),
    [handlePageChange, totalPages]
  );

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Preload adjacent pages
  useEffect(() => {
    if (progressiveLoading) {
      const preloadPages = [currentPage - 1, currentPage + 1].filter(
        (page) => page >= 0 && page < totalPages && !loadedPages.has(page)
      );

      preloadPages.forEach((page) => {
        setTimeout(() => loadPage(page), 100);
      });
    }
  }, [currentPage, totalPages, loadedPages, loadPage, progressiveLoading]);

  // Create chart data for current page
  const chartData: ChartData = useMemo(
    () => ({
      type: chartConfig.type || 'line',
      data: currentPageData,
      config: {
        ...chartConfig,
        animations: {
          ...chartConfig.animations,
          duration: isLoadingPage ? 0 : chartConfig.animations?.duration || 300,
        },
      },
    }),
    [currentPageData, chartConfig, isLoadingPage]
  );

  // Loading state
  if (loading) {
    return (
      <Paper className={className} sx={{ p: 3, height }}>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="text" width="60%" height={20} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={height - 120} />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Skeleton variant="rectangular" width={200} height={36} />
        </Box>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper
        className={className}
        sx={{
          p: 3,
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          Failed to Load Chart Data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error}
        </Typography>
        {onRefresh && (
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
          >
            Retry
          </Button>
        )}
      </Paper>
    );
  }

  return (
    <Paper
      className={className}
      sx={{
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            {title && (
              <Typography variant="h6" gutterBottom>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>

          {showControls && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Data info */}
              <Chip
                label={`${startIndex + 1}-${endIndex} of ${data.length}`}
                size="small"
                variant="outlined"
                color="primary"
              />

              {/* Zoom controls */}
              <ButtonGroup size="small" variant="outlined">
                <Tooltip title="Zoom Out">
                  <IconButton
                    size="small"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.5}
                  >
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button size="small" onClick={resetZoom} sx={{ minWidth: 60 }}>
                  {Math.round(zoomLevel * 100)}%
                </Button>
                <Tooltip title="Zoom In">
                  <IconButton
                    size="small"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 3}
                  >
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>

              {/* Action buttons */}
              {onRefresh && (
                <Tooltip title="Refresh Data">
                  <IconButton size="small" onClick={onRefresh}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {onFullscreen && (
                <Tooltip title="Fullscreen">
                  <IconButton size="small" onClick={onFullscreen}>
                    <FullscreenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {/* Progress indicator */}
        {showProgress &&
          (isLoadingPage ||
            (progressiveLoading && !loadedPages.has(currentPage))) && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                sx={{
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 1,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  },
                }}
              />
            </Box>
          )}
      </Box>

      {/* Chart */}
      <Box
        sx={{
          height: height - 120,
          position: 'relative',
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {progressiveLoading && !loadedPages.has(currentPage) ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <Skeleton
              variant="rectangular"
              width="80%"
              height="60%"
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              Loading page {currentPage + 1}...
            </Typography>
          </Box>
        ) : (
          <Fade in timeout={300}>
            <Box sx={{ height: '100%' }}>
              <ChartComponent
                data={chartData}
                height={height - 120}
                loading={isLoadingPage}
              />
            </Box>
          </Fade>
        )}
      </Box>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.grey[50], 0.5),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="First Page">
              <span>
                <IconButton
                  size="small"
                  onClick={goToFirstPage}
                  disabled={currentPage === 0}
                >
                  <FirstPageIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Previous Page">
              <span>
                <IconButton
                  size="small"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Box sx={{ mx: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Page
              </Typography>
              <Chip
                label={`${currentPage + 1} of ${totalPages}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>

            <Tooltip title="Next Page">
              <span>
                <IconButton
                  size="small"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages - 1}
                >
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Last Page">
              <span>
                <IconButton
                  size="small"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages - 1}
                >
                  <LastPageIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default PaginatedChart;
