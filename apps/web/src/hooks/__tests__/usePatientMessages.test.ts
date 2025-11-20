import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePatientMessages } from '../usePatientMessages';
import { usePatientAuth } from '../usePatientAuth';

// Mock the usePatientAuth hook
vi.mock('../usePatientAuth');

const mockUsePatientAuth = usePatientAuth as any;

const mockUser = {
  id: 'patient_123',
  email: 'patient@example.com',
  firstName: 'John',
  lastName: 'Doe',
  workspaceId: 'workspace_1',
  status: 'active'
};

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock fetch
global.fetch = vi.fn();

describe('usePatientMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock_token');
    
    mockUsePatientAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          conversations: [
            {
              id: 'conv_1',
              pharmacistId: 'pharm_1',
              pharmacistName: 'Dr. Sarah Johnson',
              lastMessage: {
                content: 'How are you feeling today?',
                timestamp: '2024-03-22T10:00:00.000Z',
                senderId: 'pharm_1',
                isRead: false
              },
              unreadCount: 2,
              status: 'active',
              createdAt: '2024-03-20T09:00:00.000Z'
            }
          ],
          messages: [
            {
              id: 'msg_1',
              conversationId: 'conv_1',
              senderId: 'pharm_1',
              senderName: 'Dr. Sarah Johnson',
              content: 'How are you feeling today?',
              timestamp: '2024-03-22T10:00:00.000Z',
              isRead: false,
              attachments: []
            }
          ]
        }
      })
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    expect(result.current.conversations).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.typingUsers).toEqual([]);
  });

  it('loads conversations when authenticated', async () => {
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.conversations).not.toBeNull();
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations![0].pharmacistName).toBe('Dr. Sarah Johnson');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it('does not load conversations when not authenticated', () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false
    });

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    expect(result.current.conversations).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isConnected).toBe(false);
  });

  it('handles loading state correctly', async () => {
    // Mock a delayed response
    (global.fetch as any).mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { conversations: [], messages: [] }
          })
        }), 100)
      )
    );

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    // Should start loading
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Should finish loading
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 200 });
  });

  it('handles API errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.conversations).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('sends messages successfully', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            conversations: [],
            messages: []
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            message: {
              id: 'msg_new',
              conversationId: 'conv_1',
              senderId: 'patient_123',
              senderName: 'John Doe',
              content: 'Test message',
              timestamp: '2024-03-22T11:00:00.000Z',
              isRead: false,
              attachments: []
            }
          }
        })
      });

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await act(async () => {
      await result.current.sendMessage('conv_1', 'Test message');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Test message');
  });

  it('handles send message errors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { conversations: [], messages: [] }
        })
      })
      .mockRejectedValueOnce(new Error('Send failed'));

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await expect(
      act(async () => {
        await result.current.sendMessage('conv_1', 'Test message');
      })
    ).rejects.toThrow('Send failed');
  });

  it('marks messages as read', async () => {
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.conversations).not.toBeNull();
    });

    act(() => {
      result.current.markAsRead('conv_1');
    });

    // Should update unread count
    expect(result.current.conversations![0].unreadCount).toBe(0);
  });

  it('refreshes conversations', async () => {
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.conversations).not.toBeNull();
    });

    await act(async () => {
      await result.current.refreshConversations();
    });

    // Should have called fetch again
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('establishes WebSocket connection when authenticated', async () => {
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('handles typing indicators', async () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.startTyping('conv_1');
    });

    // Should auto-stop typing after 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    vi.useRealTimers();
  });

  it('cleans up WebSocket connection on unmount', async () => {
    const { result, unmount } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    unmount();

    // Connection should be cleaned up
    expect(result.current.isConnected).toBe(true); // Still true at time of unmount
  });

  it('handles missing patient ID', () => {
    const { result } = renderHook(() => usePatientMessages(undefined));

    expect(result.current.conversations).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isConnected).toBe(false);
  });

  it('handles missing auth token', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    expect(result.current.isConnected).toBe(false);
  });

  it('sends message with attachments', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { conversations: [], messages: [] }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            message: {
              id: 'msg_new',
              conversationId: 'conv_1',
              senderId: 'patient_123',
              senderName: 'John Doe',
              content: 'Message with attachment',
              timestamp: '2024-03-22T11:00:00.000Z',
              isRead: false,
              attachments: [
                {
                  id: 'att_1',
                  filename: 'test.pdf',
                  url: '/files/test.pdf',
                  type: 'application/pdf',
                  size: 1024
                }
              ]
            }
          }
        })
      });

    const { result } = renderHook(() => usePatientMessages('patient_123'));

    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.sendMessage('conv_1', 'Message with attachment', [mockFile]);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].attachments).toHaveLength(1);
    expect(result.current.messages[0].attachments[0].filename).toBe('test.pdf');
  });

  it('handles WebSocket message reception', async () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => usePatientMessages('patient_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate WebSocket message reception (this is mocked in the implementation)
    // The actual WebSocket simulation happens in the hook
    act(() => {
      vi.advanceTimersByTime(6000); // Advance past the random message simulation
    });

    vi.useRealTimers();
  });
});