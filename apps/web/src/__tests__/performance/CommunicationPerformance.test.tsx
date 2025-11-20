import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VirtualizedMessageList from '../../components/communication/VirtualizedMessageList';
import VirtualizedConversationList from '../../components/communication/VirtualizedConversationList';
import LazyImage from '../../components/communication/LazyImage';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { communicationCache } from '../../services/cacheService';
import { offlineStorage } from '../../services/offlineStorageService';
import { Message, Conversation } from '../../stores/types';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
};

Object.defineProperty(window, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: { contains: vi.fn(() => false) },
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn(),
      })),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(() => ({ onsuccess: null, onerror: null })),
          get: vi.fn(() => ({ onsuccess: null, onerror: null })),
          getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
          delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
          count: vi.fn(() => ({ onsuccess: null, onerror: null })),
          index: vi.fn(() => ({
            getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
            openCursor: vi.fn(() => ({ onsuccess: null, onerror: null })),
          })),
        })),
      })),
    },
  })),
};
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Generate test data
const generateMessages = (count: number): Message[] => {
  return Array.from({ length: count }, (_, index) => ({
    _id: `message-${index}`,
    conversationId: 'test-conversation',
    senderId: `user-${index % 3}`,
    content: {
      text: `Test message ${index}`,
      type: 'text' as const,
    },
    status: 'sent' as const,
    priority: 'normal' as const,
    mentions: [],
    reactions: [],
    readBy: [],
    editHistory: [],
    isDeleted: false,
    createdAt: new Date(Date.now() - (count - index) * 60000).toISOString(),
    updatedAt: new Date(Date.now() - (count - index) * 60000).toISOString(),
  }));
};

const generateConversations = (count: number): Conversation[] => {
  return Array.from({ length: count }, (_, index) => ({
    _id: `conversation-${index}`,
    title: `Test Conversation ${index}`,
    type: 'group' as const,
    participants: [
      {
        userId: `user-${index % 3}`,
        role: 'pharmacist' as const,
        joinedAt: new Date().toISOString(),
        permissions: [],
      },
    ],
    status: 'active' as const,
    priority: 'normal' as const,
    tags: [],
    lastMessageAt: new Date(Date.now() - index * 60000).toISOString(),
    createdBy: 'user-1',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: false,
    },
    unreadCount: Math.floor(Math.random() * 10),
    createdAt: new Date(Date.now() - index * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - index * 60000).toISOString(),
  }));
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Communication Performance Tests', () => {
  let startTime: number;

  beforeEach(() => {
    startTime = Date.now();
    performanceMonitor.clearMetrics();
    communicationCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    const testDuration = Date.now() - startTime;
    console.log(`Test completed in ${testDuration}ms`);
  });

  describe('VirtualizedMessageList Performance', () => {
    it('should render large message lists efficiently', async () => {
      const messages = generateMessages(1000);
      const renderStart = performance.now();

      render(
        <TestWrapper>
          <VirtualizedMessageList
            messages={messages}
            height={600}
            currentUserId="user-1"
          />
        </TestWrapper>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;

      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(100);

      // Check that only visible items are rendered
      const messageElements = screen.queryAllByText(/Test message/);
      expect(messageElements.length).toBeLessThan(50); // Should virtualize
    });

    it('should handle scrolling performance', async () => {
      const messages = generateMessages(500);

      render(
        <TestWrapper>
          <VirtualizedMessageList
            messages={messages}
            height={400}
            currentUserId="user-1"
          />
        </TestWrapper>
      );

      const scrollContainer = screen.getByRole('list', { hidden: true });

      // Measure scroll performance
      const scrollStart = performance.now();

      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const scrollEnd = performance.now();
      const scrollTime = scrollEnd - scrollStart;

      // Scrolling should be smooth
      expect(scrollTime).toBeLessThan(200);
    });

    it('should efficiently load more messages', async () => {
      const initialMessages = generateMessages(50);
      let allMessages = [...initialMessages];

      const mockLoadMore = vi.fn(() => {
        const newMessages = generateMessages(50);
        allMessages = [...newMessages, ...allMessages];
      });

      const { rerender } = render(
        <TestWrapper>
          <VirtualizedMessageList
            messages={initialMessages}
            height={400}
            onLoadMore={mockLoadMore}
            hasMore={true}
            currentUserId="user-1"
          />
        </TestWrapper>
      );

      // Trigger load more by scrolling to top
      const scrollContainer = screen.getByRole('list', { hidden: true });
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 0 } });

      await waitFor(() => {
        expect(mockLoadMore).toHaveBeenCalled();
      });

      // Re-render with new messages
      const rerenderStart = performance.now();

      rerender(
        <TestWrapper>
          <VirtualizedMessageList
            messages={allMessages}
            height={400}
            onLoadMore={mockLoadMore}
            hasMore={true}
            currentUserId="user-1"
          />
        </TestWrapper>
      );

      const rerenderEnd = performance.now();
      const rerenderTime = rerenderEnd - rerenderStart;

      // Re-rendering with more messages should be fast
      expect(rerenderTime).toBeLessThan(50);
    });
  });

  describe('VirtualizedConversationList Performance', () => {
    it('should render large conversation lists efficiently', async () => {
      const conversations = generateConversations(500);
      const renderStart = performance.now();

      render(
        <TestWrapper>
          <VirtualizedConversationList
            conversations={conversations}
            height={600}
          />
        </TestWrapper>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;

      expect(renderTime).toBeLessThan(100);

      // Check virtualization
      const conversationElements = screen.queryAllByText(/Test Conversation/);
      expect(conversationElements.length).toBeLessThan(20);
    });

    it('should handle conversation selection efficiently', async () => {
      const conversations = generateConversations(100);
      const mockSelect = vi.fn();

      render(
        <TestWrapper>
          <VirtualizedConversationList
            conversations={conversations}
            height={400}
            onSelectConversation={mockSelect}
          />
        </TestWrapper>
      );

      const firstConversation = screen.getByText('Test Conversation 0');

      const clickStart = performance.now();
      fireEvent.click(firstConversation);
      const clickEnd = performance.now();
      const clickTime = clickEnd - clickStart;

      expect(clickTime).toBeLessThan(10);
      expect(mockSelect).toHaveBeenCalledWith(conversations[0]);
    });
  });

  describe('LazyImage Performance', () => {
    it('should load images lazily', async () => {
      const mockIntersect = vi.fn();
      mockIntersectionObserver.mockImplementation((callback) => {
        setTimeout(() => {
          callback([{ isIntersecting: true }]);
        }, 100);
        return {
          observe: mockIntersect,
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      });

      render(
        <LazyImage
          src="https://example.com/test-image.jpg"
          alt="Test Image"
          width={200}
          height={200}
        />
      );

      expect(mockIntersect).toHaveBeenCalled();

      // Should show placeholder initially
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for intersection
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('should handle progressive loading', async () => {
      render(
        <LazyImage
          src="https://example.com/high-res-image.jpg"
          alt="Progressive Image"
          width={400}
          height={300}
          progressive={true}
        />
      );

      // Should start with low-res version
      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cache Performance', () => {
    it('should cache and retrieve data efficiently', () => {
      const testData = { id: 'test', data: 'cached data' };

      const setStart = performance.now();
      communicationCache.set('test-key', testData);
      const setEnd = performance.now();
      const setTime = setEnd - setStart;

      const getStart = performance.now();
      const retrieved = communicationCache.get('test-key');
      const getEnd = performance.now();
      const getTime = getEnd - getStart;

      expect(setTime).toBeLessThan(1);
      expect(getTime).toBeLessThan(1);
      expect(retrieved).toEqual(testData);
    });

    it('should handle cache eviction efficiently', () => {
      // Fill cache to capacity
      for (let i = 0; i < 1100; i++) {
        communicationCache.set(`key-${i}`, { data: `value-${i}` });
      }

      const stats = communicationCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(1000); // Should respect max size
    });

    it('should invalidate related cache entries efficiently', () => {
      const conversationId = 'test-conversation';

      // Cache conversation and messages
      communicationCache.cacheConversation({
        _id: conversationId,
      } as Conversation);

      communicationCache.cacheMessageList(conversationId, generateMessages(10));

      const invalidateStart = performance.now();
      communicationCache.invalidateConversation(conversationId);
      const invalidateEnd = performance.now();
      const invalidateTime = invalidateEnd - invalidateStart;

      expect(invalidateTime).toBeLessThan(10);
      expect(
        communicationCache.getCachedConversation(conversationId)
      ).toBeNull();
    });
  });

  describe('Offline Storage Performance', () => {
    it('should store messages efficiently', async () => {
      const messages = generateMessages(100);

      const storeStart = performance.now();

      for (const message of messages) {
        await offlineStorage.storeMessage(message);
      }

      const storeEnd = performance.now();
      const storeTime = storeEnd - storeStart;

      // Should store 100 messages in reasonable time
      expect(storeTime).toBeLessThan(1000);
    });

    it('should retrieve stored data efficiently', async () => {
      const conversations = generateConversations(50);

      // Store conversations
      for (const conversation of conversations) {
        await offlineStorage.storeConversation(conversation);
      }

      const retrieveStart = performance.now();
      const retrieved = await offlineStorage.getStoredConversations(
        'workplace-1'
      );
      const retrieveEnd = performance.now();
      const retrieveTime = retrieveEnd - retrieveStart;

      expect(retrieveTime).toBeLessThan(100);
      expect(retrieved.length).toBe(conversations.length);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and destroy large datasets
      for (let i = 0; i < 10; i++) {
        const messages = generateMessages(1000);
        const conversations = generateConversations(100);

        // Simulate usage
        messages.forEach((m) => communicationCache.cacheMessage(m));
        conversations.forEach((c) => communicationCache.cacheConversation(c));

        // Clear cache
        communicationCache.clear();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      performanceMonitor.recordMetric('test_metric', 100);
      performanceMonitor.recordMetric('test_metric', 200);
      performanceMonitor.recordMetric('test_metric', 150);

      const stats = performanceMonitor.getStats('test_metric');

      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.avg).toBe(150);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
    });

    it('should measure function execution time', async () => {
      const testFunction = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await performanceMonitor.measureFunction(
        'test_function',
        testFunction
      );

      expect(result).toBe('result');

      const metrics = performanceMonitor.getMetrics({ name: 'test_function' });
      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBeGreaterThan(40); // Should be around 50ms
    });
  });
});
