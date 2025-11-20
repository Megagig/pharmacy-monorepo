/**
 * Tests for appointment socket hooks
 * Requirements: 1.1, 1.4, 3.1, 10.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { appointmentSocketService } from '../../services/appointmentSocketService';
import {
  useAppointmentSocket,
  useCalendarSocket,
  useAppointmentEvents,
  useFollowUpEvents,
  useOptimisticUpdates,
} from '../useAppointmentSocket';

// Mock the appointment socket service
vi.mock('../../services/appointmentSocketService', () => ({
  appointmentSocketService: {
    connect: vi.fn(),
    setEventHandlers: vi.fn(),
    subscribeToCalendar: vi.fn(),
    unsubscribeFromCalendar: vi.fn(),
    subscribeToFollowUps: vi.fn(),
    getConnectionInfo: vi.fn(),
    forceReconnect: vi.fn(),
  },
}));

describe('useAppointmentSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize connection on mount', async () => {
    const mockConnect = vi.mocked(appointmentSocketService.connect);
    mockConnect.mockResolvedValue();

    const { result } = renderHook(() => useAppointmentSocket());

    expect(mockConnect).toHaveBeenCalled();
    expect(appointmentSocketService.setEventHandlers).toHaveBeenCalled();
  });

  it('should handle connection status changes', async () => {
    const mockConnect = vi.mocked(appointmentSocketService.connect);
    mockConnect.mockResolvedValue();

    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    
    const { result } = renderHook(() => useAppointmentSocket());

    // Simulate connection status change
    const handlers = mockSetEventHandlers.mock.calls[0][0];
    
    act(() => {
      handlers.onConnectionStatusChange?.('connected');
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle connection errors', async () => {
    const mockConnect = vi.mocked(appointmentSocketService.connect);
    mockConnect.mockResolvedValue();

    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    
    const { result } = renderHook(() => useAppointmentSocket());

    // Simulate error
    const handlers = mockSetEventHandlers.mock.calls[0][0];
    
    act(() => {
      handlers.onError?.('Connection failed');
    });

    expect(result.current.error).toBe('Connection failed');
  });

  it('should provide force reconnect function', () => {
    const mockConnect = vi.mocked(appointmentSocketService.connect);
    mockConnect.mockResolvedValue();

    const { result } = renderHook(() => useAppointmentSocket());

    act(() => {
      result.current.forceReconnect();
    });

    expect(appointmentSocketService.forceReconnect).toHaveBeenCalled();
  });
});

describe('useCalendarSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to calendar updates', () => {
    const startDate = '2025-10-25';
    const endDate = '2025-10-31';
    const pharmacistId = 'pharmacist123';

    renderHook(() => useCalendarSocket(startDate, endDate, pharmacistId));

    expect(appointmentSocketService.subscribeToCalendar).toHaveBeenCalledWith(
      startDate,
      endDate,
      pharmacistId
    );
  });

  it('should unsubscribe on unmount', () => {
    const startDate = '2025-10-25';
    const endDate = '2025-10-31';
    const pharmacistId = 'pharmacist123';

    const { unmount } = renderHook(() => useCalendarSocket(startDate, endDate, pharmacistId));

    unmount();

    expect(appointmentSocketService.unsubscribeFromCalendar).toHaveBeenCalledWith(
      startDate,
      endDate,
      pharmacistId
    );
  });

  it('should handle calendar update events', () => {
    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    const onCalendarUpdate = vi.fn();

    const { result } = renderHook(() => 
      useCalendarSocket('2025-10-25', '2025-10-31', undefined, onCalendarUpdate)
    );

    // Simulate calendar update
    const handlers = mockSetEventHandlers.mock.calls[0][0];
    const updateData = {
      date: '2025-10-25',
      workplaceId: 'workplace123',
      updateType: 'appointment_change' as const,
    };

    act(() => {
      handlers.onCalendarUpdate?.(updateData);
    });

    expect(onCalendarUpdate).toHaveBeenCalledWith(updateData);
    expect(result.current.lastUpdate).toEqual(updateData);
  });
});

describe('useAppointmentEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set up appointment event handlers', () => {
    const handlers = {
      onAppointmentCreated: vi.fn(),
      onAppointmentUpdated: vi.fn(),
      onAppointmentStatusChanged: vi.fn(),
    };

    renderHook(() => useAppointmentEvents(handlers));

    expect(appointmentSocketService.setEventHandlers).toHaveBeenCalled();
  });

  it('should track last event', () => {
    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    const onAppointmentCreated = vi.fn();

    const { result } = renderHook(() => 
      useAppointmentEvents({ onAppointmentCreated })
    );

    // Simulate appointment created event
    const wrappedHandlers = mockSetEventHandlers.mock.calls[0][0];
    const eventData = {
      appointment: { _id: 'apt123', title: 'Test Appointment' },
      action: 'created' as const,
      actor: { userId: 'user123', name: 'Test User', role: 'pharmacist' },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      wrappedHandlers.onAppointmentCreated?.(eventData);
    });

    expect(onAppointmentCreated).toHaveBeenCalledWith(eventData);
    expect(result.current.lastEvent).toEqual({
      type: 'created',
      data: eventData,
      timestamp: expect.any(Date),
    });
  });
});

describe('useFollowUpEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to follow-up updates', () => {
    const assignedTo = 'pharmacist123';
    const patientId = 'patient123';

    renderHook(() => useFollowUpEvents(assignedTo, patientId));

    expect(appointmentSocketService.subscribeToFollowUps).toHaveBeenCalledWith(
      assignedTo,
      patientId
    );
  });

  it('should handle follow-up events', () => {
    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    const onFollowUpCreated = vi.fn();

    const { result } = renderHook(() => 
      useFollowUpEvents('pharmacist123', 'patient123', { onFollowUpCreated })
    );

    // Simulate follow-up created event
    const wrappedHandlers = mockSetEventHandlers.mock.calls[0][0];
    const eventData = {
      followUpTask: { _id: 'task123', title: 'Test Follow-up' },
      action: 'created' as const,
      actor: { userId: 'user123', name: 'Test User', role: 'pharmacist' },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      wrappedHandlers.onFollowUpCreated?.(eventData);
    });

    expect(onFollowUpCreated).toHaveBeenCalledWith(eventData);
    expect(result.current.lastEvent).toEqual({
      type: 'created',
      data: eventData,
      timestamp: expect.any(Date),
    });
  });
});

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should manage pending updates', () => {
    const { result } = renderHook(() => useOptimisticUpdates());

    // Add pending update
    act(() => {
      result.current.addPendingUpdate('apt123', { status: 'confirmed' });
    });

    expect(result.current.hasPendingUpdate('apt123')).toBe(true);
    expect(result.current.getPendingUpdate('apt123')).toEqual({ status: 'confirmed' });
    expect(result.current.pendingUpdatesCount).toBe(1);

    // Remove pending update
    act(() => {
      result.current.removePendingUpdate('apt123');
    });

    expect(result.current.hasPendingUpdate('apt123')).toBe(false);
    expect(result.current.pendingUpdatesCount).toBe(0);
  });

  it('should remove pending updates when real updates arrive', () => {
    const mockSetEventHandlers = vi.mocked(appointmentSocketService.setEventHandlers);
    
    const { result } = renderHook(() => useOptimisticUpdates());

    // Add pending update
    act(() => {
      result.current.addPendingUpdate('apt123', { status: 'confirmed' });
    });

    expect(result.current.hasPendingUpdate('apt123')).toBe(true);

    // Simulate real update arriving
    const handlers = mockSetEventHandlers.mock.calls[0][0];
    const eventData = {
      appointment: { _id: 'apt123', status: 'confirmed' },
      action: 'status_changed' as const,
      actor: { userId: 'user123', name: 'Test User', role: 'pharmacist' },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      handlers.onAppointmentStatusChanged?.(eventData);
    });

    expect(result.current.hasPendingUpdate('apt123')).toBe(false);
  });
});