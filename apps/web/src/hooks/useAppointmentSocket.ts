/**
 * React hooks for appointment socket integration
 * Requirements: 1.1, 1.4, 3.1, 10.1
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  appointmentSocketService,
  ConnectionStatus,
  AppointmentEventData,
  FollowUpEventData,
  CalendarUpdateData,
  AppointmentEventHandlers,
} from '../services/appointmentSocketService';

/**
 * Hook for managing appointment socket connection
 */
export const useAppointmentSocket = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up event handlers
    appointmentSocketService.setEventHandlers({
      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        setIsConnected(status === 'connected');
        if (status === 'connected') {
          setError(null);
        }
      },
      onError: (errorMessage) => {
        setError(errorMessage);
      },
    });

    // Connect to socket
    appointmentSocketService.connect().catch((err) => {
      setError(err.message);
    });

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount to keep connection alive
      // Only disconnect when user logs out or app closes
    };
  }, []);

  const forceReconnect = useCallback(() => {
    appointmentSocketService.forceReconnect();
  }, []);

  const getConnectionInfo = useCallback(() => {
    return appointmentSocketService.getConnectionInfo();
  }, []);

  return {
    connectionStatus,
    isConnected,
    error,
    forceReconnect,
    getConnectionInfo,
  };
};

/**
 * Hook for subscribing to calendar updates
 */
export const useCalendarSocket = (
  startDate: string,
  endDate: string,
  pharmacistId?: string,
  onCalendarUpdate?: (data: CalendarUpdateData) => void
) => {
  const [lastUpdate, setLastUpdate] = useState<CalendarUpdateData | null>(null);
  const subscriptionRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up calendar update handler
    const handlers: AppointmentEventHandlers = {};
    
    if (onCalendarUpdate) {
      handlers.onCalendarUpdate = (data) => {
        setLastUpdate(data);
        onCalendarUpdate(data);
      };
    } else {
      handlers.onCalendarUpdate = (data) => {
        setLastUpdate(data);
      };
    }

    appointmentSocketService.setEventHandlers(handlers);

    // Subscribe to calendar updates
    appointmentSocketService.subscribeToCalendar(startDate, endDate, pharmacistId);
    subscriptionRef.current = `${startDate}-${endDate}-${pharmacistId || 'all'}`;

    // Cleanup subscription on unmount or dependency change
    return () => {
      if (subscriptionRef.current) {
        appointmentSocketService.unsubscribeFromCalendar(startDate, endDate, pharmacistId);
        subscriptionRef.current = null;
      }
    };
  }, [startDate, endDate, pharmacistId, onCalendarUpdate]);

  return {
    lastUpdate,
  };
};

/**
 * Hook for subscribing to appointment events
 */
export const useAppointmentEvents = (handlers: Partial<AppointmentEventHandlers>) => {
  const [lastEvent, setLastEvent] = useState<{
    type: string;
    data: AppointmentEventData;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const wrappedHandlers: AppointmentEventHandlers = {};

    // Wrap handlers to track last event
    if (handlers.onAppointmentCreated) {
      wrappedHandlers.onAppointmentCreated = (data) => {
        setLastEvent({ type: 'created', data, timestamp: new Date() });
        handlers.onAppointmentCreated!(data);
      };
    }

    if (handlers.onAppointmentUpdated) {
      wrappedHandlers.onAppointmentUpdated = (data) => {
        setLastEvent({ type: 'updated', data, timestamp: new Date() });
        handlers.onAppointmentUpdated!(data);
      };
    }

    if (handlers.onAppointmentStatusChanged) {
      wrappedHandlers.onAppointmentStatusChanged = (data) => {
        setLastEvent({ type: 'status_changed', data, timestamp: new Date() });
        handlers.onAppointmentStatusChanged!(data);
      };
    }

    if (handlers.onAppointmentRescheduled) {
      wrappedHandlers.onAppointmentRescheduled = (data) => {
        setLastEvent({ type: 'rescheduled', data, timestamp: new Date() });
        handlers.onAppointmentRescheduled!(data);
      };
    }

    if (handlers.onAppointmentCancelled) {
      wrappedHandlers.onAppointmentCancelled = (data) => {
        setLastEvent({ type: 'cancelled', data, timestamp: new Date() });
        handlers.onAppointmentCancelled!(data);
      };
    }

    if (handlers.onAppointmentConfirmed) {
      wrappedHandlers.onAppointmentConfirmed = (data) => {
        setLastEvent({ type: 'confirmed', data, timestamp: new Date() });
        handlers.onAppointmentConfirmed!(data);
      };
    }

    appointmentSocketService.setEventHandlers(wrappedHandlers);

    // No cleanup needed as handlers are merged, not replaced
  }, [handlers]);

  return {
    lastEvent,
  };
};

/**
 * Hook for subscribing to follow-up task events
 */
export const useFollowUpEvents = (
  assignedTo?: string,
  patientId?: string,
  handlers?: Partial<Pick<AppointmentEventHandlers, 
    'onFollowUpCreated' | 'onFollowUpUpdated' | 'onFollowUpCompleted' | 
    'onFollowUpEscalated' | 'onFollowUpConvertedToAppointment'>>
) => {
  const [lastEvent, setLastEvent] = useState<{
    type: string;
    data: FollowUpEventData;
    timestamp: Date;
  } | null>(null);
  const subscriptionRef = useRef<string | null>(null);

  useEffect(() => {
    // Subscribe to follow-up updates
    appointmentSocketService.subscribeToFollowUps(assignedTo, patientId);
    subscriptionRef.current = `${assignedTo || 'all'}-${patientId || 'all'}`;

    // Set up event handlers if provided
    if (handlers) {
      const wrappedHandlers: AppointmentEventHandlers = {};

      if (handlers.onFollowUpCreated) {
        wrappedHandlers.onFollowUpCreated = (data) => {
          setLastEvent({ type: 'created', data, timestamp: new Date() });
          handlers.onFollowUpCreated!(data);
        };
      }

      if (handlers.onFollowUpUpdated) {
        wrappedHandlers.onFollowUpUpdated = (data) => {
          setLastEvent({ type: 'updated', data, timestamp: new Date() });
          handlers.onFollowUpUpdated!(data);
        };
      }

      if (handlers.onFollowUpCompleted) {
        wrappedHandlers.onFollowUpCompleted = (data) => {
          setLastEvent({ type: 'completed', data, timestamp: new Date() });
          handlers.onFollowUpCompleted!(data);
        };
      }

      if (handlers.onFollowUpEscalated) {
        wrappedHandlers.onFollowUpEscalated = (data) => {
          setLastEvent({ type: 'escalated', data, timestamp: new Date() });
          handlers.onFollowUpEscalated!(data);
        };
      }

      if (handlers.onFollowUpConvertedToAppointment) {
        wrappedHandlers.onFollowUpConvertedToAppointment = (data) => {
          setLastEvent({ type: 'converted_to_appointment', data, timestamp: new Date() });
          handlers.onFollowUpConvertedToAppointment!(data);
        };
      }

      appointmentSocketService.setEventHandlers(wrappedHandlers);
    }

    // Cleanup subscription on unmount or dependency change
    return () => {
      // Note: We don't unsubscribe here as other components might be using the same subscription
      // The service manages subscriptions internally
    };
  }, [assignedTo, patientId, handlers]);

  return {
    lastEvent,
  };
};

/**
 * Hook for optimistic UI updates
 */
export const useOptimisticUpdates = () => {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, any>>(new Map());

  const addPendingUpdate = useCallback((id: string, update: any) => {
    setPendingUpdates(prev => new Map(prev).set(id, update));
  }, []);

  const removePendingUpdate = useCallback((id: string) => {
    setPendingUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const getPendingUpdate = useCallback((id: string) => {
    return pendingUpdates.get(id);
  }, [pendingUpdates]);

  const hasPendingUpdate = useCallback((id: string) => {
    return pendingUpdates.has(id);
  }, [pendingUpdates]);

  // Set up event handlers to remove pending updates when real updates arrive
  useEffect(() => {
    const handlers: AppointmentEventHandlers = {
      onAppointmentUpdated: (data) => {
        removePendingUpdate(data.appointment._id || data.appointment.id);
      },
      onAppointmentStatusChanged: (data) => {
        removePendingUpdate(data.appointment._id || data.appointment.id);
      },
      onAppointmentRescheduled: (data) => {
        removePendingUpdate(data.appointment._id || data.appointment.id);
      },
      onAppointmentCancelled: (data) => {
        removePendingUpdate(data.appointment._id || data.appointment.id);
      },
      onFollowUpUpdated: (data) => {
        removePendingUpdate(data.followUpTask._id || data.followUpTask.id);
      },
      onFollowUpCompleted: (data) => {
        removePendingUpdate(data.followUpTask._id || data.followUpTask.id);
      },
      onFollowUpEscalated: (data) => {
        removePendingUpdate(data.followUpTask._id || data.followUpTask.id);
      },
    };

    appointmentSocketService.setEventHandlers(handlers);
  }, [removePendingUpdate]);

  return {
    addPendingUpdate,
    removePendingUpdate,
    getPendingUpdate,
    hasPendingUpdate,
    pendingUpdatesCount: pendingUpdates.size,
  };
};

/**
 * Hook for real-time appointment list updates
 */
export const useRealTimeAppointmentList = (
  initialAppointments: any[],
  filters?: {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
    patientId?: string;
  }
) => {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Subscribe to calendar updates if date range is provided
  useCalendarSocket(
    filters?.startDate || '',
    filters?.endDate || '',
    filters?.pharmacistId,
    () => {
      setLastUpdateTime(new Date());
    }
  );

  // Handle appointment events
  useAppointmentEvents({
    onAppointmentCreated: (data) => {
      // Add new appointment if it matches filters
      if (shouldIncludeAppointment(data.appointment, filters)) {
        setAppointments(prev => [...prev, data.appointment]);
        setLastUpdateTime(new Date());
      }
    },
    onAppointmentUpdated: (data) => {
      setAppointments(prev => 
        prev.map(apt => 
          apt._id === data.appointment._id ? data.appointment : apt
        )
      );
      setLastUpdateTime(new Date());
    },
    onAppointmentStatusChanged: (data) => {
      setAppointments(prev => 
        prev.map(apt => 
          apt._id === data.appointment._id ? data.appointment : apt
        )
      );
      setLastUpdateTime(new Date());
    },
    onAppointmentRescheduled: (data) => {
      setAppointments(prev => 
        prev.map(apt => 
          apt._id === data.appointment._id ? data.appointment : apt
        )
      );
      setLastUpdateTime(new Date());
    },
    onAppointmentCancelled: (data) => {
      setAppointments(prev => 
        prev.map(apt => 
          apt._id === data.appointment._id ? data.appointment : apt
        )
      );
      setLastUpdateTime(new Date());
    },
  });

  // Update appointments when initial data changes
  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  return {
    appointments,
    lastUpdateTime,
    setAppointments, // Allow manual updates for optimistic UI
  };
};

/**
 * Hook for real-time follow-up task list updates
 */
export const useRealTimeFollowUpList = (
  initialTasks: any[],
  assignedTo?: string,
  patientId?: string
) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Handle follow-up events
  useFollowUpEvents(assignedTo, patientId, {
    onFollowUpCreated: (data) => {
      setTasks(prev => [...prev, data.followUpTask]);
      setLastUpdateTime(new Date());
    },
    onFollowUpUpdated: (data) => {
      setTasks(prev => 
        prev.map(task => 
          task._id === data.followUpTask._id ? data.followUpTask : task
        )
      );
      setLastUpdateTime(new Date());
    },
    onFollowUpCompleted: (data) => {
      setTasks(prev => 
        prev.map(task => 
          task._id === data.followUpTask._id ? data.followUpTask : task
        )
      );
      setLastUpdateTime(new Date());
    },
    onFollowUpEscalated: (data) => {
      setTasks(prev => 
        prev.map(task => 
          task._id === data.followUpTask._id ? data.followUpTask : task
        )
      );
      setLastUpdateTime(new Date());
    },
    onFollowUpConvertedToAppointment: (data) => {
      setTasks(prev => 
        prev.map(task => 
          task._id === data.followUpTask._id ? data.followUpTask : task
        )
      );
      setLastUpdateTime(new Date());
    },
  });

  // Update tasks when initial data changes
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  return {
    tasks,
    lastUpdateTime,
    setTasks, // Allow manual updates for optimistic UI
  };
};

/**
 * Helper function to check if appointment matches filters
 */
function shouldIncludeAppointment(appointment: any, filters?: {
  startDate?: string;
  endDate?: string;
  pharmacistId?: string;
  patientId?: string;
}): boolean {
  if (!filters) return true;

  // Check date range
  if (filters.startDate || filters.endDate) {
    const appointmentDate = new Date(appointment.scheduledDate).toISOString().split('T')[0];
    
    if (filters.startDate && appointmentDate < filters.startDate) {
      return false;
    }
    
    if (filters.endDate && appointmentDate > filters.endDate) {
      return false;
    }
  }

  // Check pharmacist
  if (filters.pharmacistId && appointment.assignedTo !== filters.pharmacistId) {
    return false;
  }

  // Check patient
  if (filters.patientId && appointment.patientId !== filters.patientId) {
    return false;
  }

  return true;
}