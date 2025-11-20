import React, { useState, useRef, useEffect } from 'react';
import { Box, CircularProgress, IconButton, Skeleton } from '@mui/material';
import { Visibility, VisibilityOff, Download } from '@mui/icons-material';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  style?: React.CSSProperties;
  progressive?: boolean;
  downloadable?: boolean;
  onDownload?: () => void;
}

/**
 * Lazy loading image component with progressive enhancement
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width = '100%',
  height = 'auto',
  maxWidth = '100%',
  maxHeight = '400px',
  placeholder,
  fallback,
  onLoad,
  onError,
  className,
  style,
  progressive = true,
  downloadable = false,
  onDownload,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [lowResLoaded, setLowResLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate low-resolution version URL for progressive loading
  const getLowResUrl = (originalUrl: string): string => {
    if (!progressive) return originalUrl;

    // For demonstration - in real implementation, you'd have a service
    // that generates low-res versions or use URL parameters
    const url = new URL(originalUrl);
    url.searchParams.set('w', '50');
    url.searchParams.set('q', '30');
    return url.toString();
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the image enters viewport
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setIsError(true);
    onError?.();
  };

  // Handle low-res image load
  const handleLowResLoad = () => {
    setLowResLoaded(true);
  };

  // Handle download
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const containerStyle: React.CSSProperties = {
    width,
    height,
    maxWidth,
    maxHeight,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    ...style,
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease',
  };

  // Show placeholder while not visible
  if (!isVisible) {
    return (
      <Box ref={containerRef} sx={containerStyle} className={className}>
        {placeholder || (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            animation="wave"
          />
        )}
      </Box>
    );
  }

  // Show error fallback
  if (isError) {
    return (
      <Box sx={containerStyle} className={className}>
        {fallback || (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              p: 2,
            }}
          >
            <VisibilityOff sx={{ fontSize: 48, mb: 1 }} />
            <Box sx={{ fontSize: '0.875rem', textAlign: 'center' }}>
              Failed to load image
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={containerStyle} className={className}>
      {/* Progressive loading: Low-res image first */}
      {progressive && !isLoaded && (
        <img
          src={getLowResUrl(src)}
          alt={alt}
          style={{
            ...imageStyle,
            filter: 'blur(2px)',
            opacity: lowResLoaded ? 1 : 0,
          }}
          onLoad={handleLowResLoad}
          onError={() => {}} // Ignore low-res errors
        />
      )}

      {/* High-res image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{
          ...imageStyle,
          opacity: isLoaded ? 1 : 0,
          position: progressive ? 'absolute' : 'static',
          top: 0,
          left: 0,
        }}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy" // Native lazy loading as fallback
      />

      {/* Loading indicator */}
      {!isLoaded && !isError && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Download button */}
      {downloadable && isLoaded && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            opacity: 0,
            transition: 'opacity 0.2s ease',
            '&:hover': { opacity: 1 },
            '.MuiBox-root:hover &': { opacity: 1 },
          }}
        >
          <IconButton
            size="small"
            onClick={handleDownload}
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.8)',
              },
            }}
          >
            <Download fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default LazyImage;
