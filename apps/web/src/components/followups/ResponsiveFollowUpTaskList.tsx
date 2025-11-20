import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import FollowUpTaskList from './FollowUpTaskList';
import MobileFollowUpTaskList from './MobileFollowUpTaskList';
import { FollowUpTask } from '../../stores/followUpTypes';

interface ResponsiveFollowUpTaskListProps {
  /** Optional patient filter */
  patientId?: string;
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Height of the task list (desktop only) */
  height?: number | string;
  /** Whether to show summary statistics (desktop only) */
  showSummary?: boolean;
  /** Whether to show filters (desktop only) */
  showFilters?: boolean;
  /** Whether to enable quick actions */
  enableQuickActions?: boolean;
  /** Callback when task is selected */
  onTaskSelect?: (task: FollowUpTask | null) => void;
  /** Callback when new task is requested */
  onCreateTask?: () => void;
  /** Force mobile or desktop view */
  forceView?: 'mobile' | 'desktop';
}

/**
 * Responsive wrapper component that automatically switches between
 * desktop and mobile follow-up task list implementations based on screen size
 */
const ResponsiveFollowUpTaskList: React.FC<ResponsiveFollowUpTaskListProps> = ({
  patientId,
  pharmacistId,
  locationId,
  height = 'calc(100vh - 200px)',
  showSummary = true,
  showFilters = true,
  enableQuickActions = true,
  onTaskSelect,
  onCreateTask,
  forceView,
}) => {
  const { isMobile } = useResponsive();
  
  // Determine which view to use
  const useMobileView = forceView === 'mobile' || (forceView !== 'desktop' && isMobile);

  if (useMobileView) {
    return (
      <MobileFollowUpTaskList
        patientId={patientId}
        pharmacistId={pharmacistId}
        locationId={locationId}
        onTaskSelect={onTaskSelect}
        onCreateTask={onCreateTask}
      />
    );
  }

  return (
    <FollowUpTaskList
      patientId={patientId}
      pharmacistId={pharmacistId}
      locationId={locationId}
      height={height}
      showSummary={showSummary}
      showFilters={showFilters}
      enableQuickActions={enableQuickActions}
      onTaskSelect={onTaskSelect}
      onCreateTask={onCreateTask}
    />
  );
};

export default ResponsiveFollowUpTaskList;