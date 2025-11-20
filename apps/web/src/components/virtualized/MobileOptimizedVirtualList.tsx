import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material';

interface MobileOptimizedVirtualListProps<T> {
  items: T[];
  loading?: boolean;
  hasNextPage?: boolean;
  isNextPageLoading?: boolean;
  loadNextPage?: () => Promise<void>;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderSkeleton?: () => React.ReactNode;
  getItemHeight?: (index: number, item?: T) => number;
  height?: number;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  estimatedItemSize?: number;
  overscanCount?: number;
  threshold?: number;
  className?: string;
}

interface VirtualItemProps<T> {
  index: number;
  style: React.CSSProperties;
  data: {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    renderSkeleton?: () => React.ReactNode;
    onItemClick?: (item: T, index: number) => void;
    isItemLoaded: (index: number) => boolean;
    isMobile: boolean;
  };
}

// Virtual item component with mobile optimizations
const VirtualItem = React.memo(<T,>({ index, style, data }: VirtualItemProps<T>) => {
  const { items, renderItem, renderSkeleton, onItemClick, isItemLoaded, isMobile } = data;
  
  const isLoaded = isItemLoaded(index);
  const item = items[index];

  // Touch handling for mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !touchStart) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, [isMobile, touchStart]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !touchStart || !touchEnd || !item) return;

    const deltaX = Math.abs(touchEnd.x - touchStart.x);
    const deltaY = Math.abs(touchEnd.y - touchStart.y);

    // Only trigger click if it's a tap (minimal movement)
    if (deltaX < 10 && deltaY < 10) {
      onItemClick?.(item, index);
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [isMobile, touchStart, touchEnd, item, index, onItemClick]);

  if (!isLoaded) {
    return (
      <div style={style}>
        <Box sx={{ p: 1 }}>
          {renderSkeleton ? (
            renderSkeleton()
          ) : (
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="80%" height={20} />
              </CardContent>
            </Card>
          )}
        </Box>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={style}>
        <Box sx={{ p: 1 }}>
          <Card>
            <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">Loading...</Typography>
            </CardContent>
          </Card>
        </Box>
      </div>
    );
  }

  return (
    <div
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={!isMobile ? () => onItemClick?.(item, index) : undefined}
    >
      <Box sx={{ p: 1 }}>
        {renderItem(item, index)}
      </Box>
    </div>
  );
});

VirtualItem.displayName = 'VirtualItem';

// Main mobile-optimized virtual list component
export const MobileOptimizedVirtualList = <T,>({
  items,
  loading = false,
  hasNextPage = false,
  isNextPageLoading = false,
  loadNextPage,
  renderItem,
  renderSkeleton,
  getItemHeight,
  height = 600,
  emptyMessage = 'No items found',
  emptyIcon,
  onItemClick,
  estimatedItemSize = 120,
  overscanCount = 5,
  threshold = 5,
  className,
}: MobileOptimizedVirtualListProps<T>) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const listRef = useRef<List>(null);

  // Performance monitoring
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState(Date.now());

  useEffect(() => {
    setRenderCount(prev => prev + 1);
    setLastRenderTime(Date.now());
  }, [items.length]);

  // Calculate total item count (including loading items)
  const itemCount = hasNextPage ? items.length + 1 : items.length;

  // Check if an item is loaded
  const isItemLoaded = useCallback(
    (index: number) => !!items[index],
    [items]
  );

  // Load more items with throttling for mobile
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      if (loadNextPage && !isNextPageLoading) {
        // Add small delay on mobile to prevent excessive loading
        if (isMobile) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await loadNextPage();
      }
    },
    [loadNextPage, isNextPageLoading, isMobile]
  );

  // Dynamic item size calculation
  const getItemSize = useCallback(
    (index: number) => {
      if (getItemHeight) {
        const item = items[index];
        return getItemHeight(index, item);
      }
      
      // Adaptive sizing based on device
      if (isMobile) {
        return estimatedItemSize * 0.8; // Smaller on mobile
      }
      
      return estimatedItemSize;
    },
    [getItemHeight, items, isMobile, estimatedItemSize]
  );

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(
    () => ({
      items,
      renderItem,
      renderSkeleton,
      onItemClick,
      isItemLoaded,
      isMobile,
    }),
    [items, renderItem, renderSkeleton, onItemClick, isItemLoaded, isMobile]
  );

  // Scroll to top when items change significantly
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      // Only scroll to top if it's a new search/filter (not pagination)
      const isNewData = renderCount === 1 || (Date.now() - lastRenderTime > 5000);
      if (isNewData) {
        listRef.current.scrollToItem(0, 'start');
      }
    }
  }, [items.length, renderCount, lastRenderTime]);

  // Performance optimization: reduce overscan on mobile
  const effectiveOverscanCount = isMobile ? Math.max(2, overscanCount / 2) : overscanCount;

  // Loading state
  if (loading && items.length === 0) {
    const skeletonCount = Math.floor(height / estimatedItemSize);
    
    return (
      <Box sx={{ height, overflow: 'hidden' }} className={className}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <Box key={index}>
              {renderSkeleton ? (
                renderSkeleton()
              ) : (
                <Card>
                  <CardContent sx={{ p: 2 }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={20} />
                    <Skeleton variant="text" width="80%" height={20} />
                  </CardContent>
                </Card>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
        className={className}
      >
        {emptyIcon}
        <Typography variant="h6" color="text.secondary" textAlign="center">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: '100%' }} className={className}>
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
        threshold={threshold}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={(list) => {
              ref(list);
              listRef.current = list;
            }}
            height={height}
            itemCount={itemCount}
            itemSize={getItemSize}
            itemData={itemData}
            onItemsRendered={onItemsRendered}
            overscanCount={effectiveOverscanCount}
            // Mobile-specific optimizations
            useIsScrolling={isMobile} // Enable scroll optimization on mobile
            style={{
              // Improve scrolling performance on mobile
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: isMobile ? 'auto' : 'smooth',
            }}
          >
            {VirtualItem}
          </List>
        )}
      </InfiniteLoader>
      
      {/* Performance debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(0,0,0,0.7)',
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          Items: {items.length} | Renders: {renderCount} | Mobile: {isMobile ? 'Y' : 'N'}
        </Box>
      )}
    </Box>
  );
};

export default MobileOptimizedVirtualList;