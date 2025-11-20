/**
 * Mobile Responsiveness Testing Suite for Manual Lab Order Components
 * Tests responsive design, touch interactions, and mobile-specific features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../../../theme';

// Import components to test
import { ManualLabOrderForm } from '../ManualLabOrderForm';
import { LabOrderList } from '../LabOrderList';
import { ResultEntryForm } from '../ResultEntryForm';
import { QRScanner } from '../QRScanner';
import { LabOrderMobileView } from '../LabOrderMobileView';

// Mock data
const mockTestCatalog = [
  {
    _id: '1',
    code: 'CBC',
    name: 'Complete Blood Count',
    category: 'Hematology',
    specimenType: 'Blood',
    units: 'cells/μL',
    referenceRange: '4000-11000',
    cost: 25.0,
    isActive: true,
  },
];

const mockPatient = {
  _id: 'patient1',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  gender: 'male',
  phone: '+1234567890',
  email: 'john.doe@test.com',
};

const mockLabOrders = [
  {
    _id: 'order1',
    orderId: 'LAB-2024-0001',
    patient: mockPatient,
    tests: [mockTestCatalog[0]],
    status: 'requested',
    indication: 'Routine checkup',
    priority: 'routine',
    createdAt: '2024-01-01T10:00:00Z',
    createdBy: {
      firstName: 'Dr.',
      lastName: 'Smith',
    },
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Viewport size configurations
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1200, height: 800 },
};

// Helper function to set viewport size
const setViewport = (viewport: keyof typeof viewports) => {
  const { width, height } = viewports[viewport];

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });

  // Trigger resize event
  fireEvent(window, new Event('resize'));
};

describe('Manual Lab Order Components - Mobile Responsiveness Tests', () => {
  beforeEach(() => {
    // Reset viewport to mobile by default
    setViewport('mobile');

    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ManualLabOrderForm Mobile Responsiveness', () => {
    const defaultProps = {
      testCatalog: mockTestCatalog,
      patients: [mockPatient],
      onSubmit: jest.fn(),
      isLoading: false,
    };

    it('should adapt layout for mobile viewport', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveClass('mobile-layout');

      // Form fields should stack vertically on mobile
      const formFields = screen.getAllByRole('textbox');
      formFields.forEach((field) => {
        const styles = window.getComputedStyle(field.parentElement!);
        expect(styles.width).toBe('100%');
      });
    });

    it('should have touch-friendly input sizes', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach((input) => {
        const styles = window.getComputedStyle(input);
        const minHeight = parseInt(styles.minHeight);

        // Touch targets should be at least 44px
        expect(minHeight).toBeGreaterThanOrEqual(44);
      });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight);

        expect(minHeight).toBeGreaterThanOrEqual(44);
      });
    });

    it('should handle tablet layout appropriately', () => {
      setViewport('tablet');

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveClass('tablet-layout');

      // Some fields might be in two columns on tablet
      const container = form.querySelector('.form-container');
      expect(container).toHaveStyle('display: grid');
    });

    it('should support swipe gestures for test selection', async () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      const testSelector = screen.getByLabelText(/tests/i);

      // Simulate swipe gesture
      fireEvent.touchStart(testSelector, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(testSelector, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchEnd(testSelector);

      // Should show swipe indicator or action
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('should optimize keyboard for mobile input types', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ManualLabOrderForm {...defaultProps} />
        </TestWrapper>
      );

      // Phone number input should have tel keyboard
      const phoneInput = screen.getByLabelText(/phone/i);
      expect(phoneInput).toHaveAttribute('inputMode', 'tel');

      // Email input should have email keyboard
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('inputMode', 'email');
    });
  });

  describe('LabOrderList Mobile Responsiveness', () => {
    const defaultProps = {
      orders: mockLabOrders,
      onOrderSelect: jest.fn(),
      isLoading: false,
    };

    it('should switch to card layout on mobile', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      // Should use card layout instead of table on mobile
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByTestId('mobile-card-list')).toBeInTheDocument();
    });

    it('should maintain table layout on tablet and desktop', () => {
      setViewport('tablet');

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-card-list')).not.toBeInTheDocument();
    });

    it('should support pull-to-refresh on mobile', async () => {
      setViewport('mobile');
      const onRefresh = jest.fn();

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} onRefresh={onRefresh} />
        </TestWrapper>
      );

      const listContainer = screen.getByTestId('mobile-card-list');

      // Simulate pull-to-refresh gesture
      fireEvent.touchStart(listContainer, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(listContainer, {
        touches: [{ clientX: 100, clientY: 200 }],
      });

      fireEvent.touchEnd(listContainer);

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
    });

    it('should show condensed information on mobile cards', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} />
        </TestWrapper>
      );

      const card = screen.getByTestId('order-card-order1');

      // Should show essential info only
      expect(card).toHaveTextContent('LAB-2024-0001');
      expect(card).toHaveTextContent('John Doe');
      expect(card).toHaveTextContent('Requested');

      // Detailed info should be hidden or in expandable section
      expect(card.querySelector('.detailed-info')).toHaveStyle('display: none');
    });

    it('should support swipe actions on mobile cards', async () => {
      setViewport('mobile');
      const onOrderSelect = jest.fn();

      render(
        <TestWrapper>
          <LabOrderList {...defaultProps} onOrderSelect={onOrderSelect} />
        </TestWrapper>
      );

      const card = screen.getByTestId('order-card-order1');

      // Simulate swipe right for quick action
      fireEvent.touchStart(card, {
        touches: [{ clientX: 50, clientY: 100 }],
      });

      fireEvent.touchMove(card, {
        touches: [{ clientX: 150, clientY: 100 }],
      });

      fireEvent.touchEnd(card);

      // Should reveal action buttons
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /view details/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /add results/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('ResultEntryForm Mobile Responsiveness', () => {
    const defaultProps = {
      order: mockLabOrders[0],
      onSubmit: jest.fn(),
      isLoading: false,
    };

    it('should optimize input layout for mobile', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveClass('mobile-result-form');

      // Numeric inputs should have number keyboard
      const valueInput = screen.getByLabelText(/value/i);
      expect(valueInput).toHaveAttribute('inputMode', 'decimal');
    });

    it('should provide large touch targets for result selection', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach((radio) => {
        const label = radio.closest('label');
        const styles = window.getComputedStyle(label!);
        const minHeight = parseInt(styles.minHeight);

        expect(minHeight).toBeGreaterThanOrEqual(44);
      });
    });

    it('should support voice input for result entry', async () => {
      setViewport('mobile');

      // Mock speech recognition
      const mockSpeechRecognition = {
        start: jest.fn(),
        stop: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      (window as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
      (window as any).webkitSpeechRecognition = jest.fn(
        () => mockSpeechRecognition
      );

      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const voiceButton = screen.getByRole('button', { name: /voice input/i });
      expect(voiceButton).toBeInTheDocument();

      fireEvent.click(voiceButton);
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should show mobile-optimized validation messages', async () => {
      setViewport('mobile');
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ResultEntryForm {...defaultProps} />
        </TestWrapper>
      );

      const valueInput = screen.getByLabelText(/value/i);
      await user.type(valueInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveClass('mobile-error-message');
        expect(errorMessage).toHaveStyle('position: fixed');
      });
    });
  });

  describe('QRScanner Mobile Optimization', () => {
    const defaultProps = {
      onScan: jest.fn(),
      onError: jest.fn(),
      isActive: true,
    };

    beforeEach(() => {
      // Mock camera API
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
          }),
        },
      });
    });

    it('should optimize camera view for mobile', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      const cameraView = screen.getByTestId('camera-view');
      expect(cameraView).toHaveClass('mobile-camera');

      // Should use full viewport on mobile
      expect(cameraView).toHaveStyle('width: 100vw');
      expect(cameraView).toHaveStyle('height: 100vh');
    });

    it('should provide mobile-friendly scanning interface', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      // Should have large scan area
      const scanArea = screen.getByTestId('scan-area');
      const styles = window.getComputedStyle(scanArea);
      expect(parseInt(styles.width)).toBeGreaterThan(200);
      expect(parseInt(styles.height)).toBeGreaterThan(200);

      // Should have touch-friendly controls
      const flashButton = screen.getByRole('button', { name: /flash/i });
      expect(flashButton).toHaveClass('mobile-control-button');
    });

    it('should support device orientation changes', async () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      // Simulate orientation change
      Object.defineProperty(window, 'orientation', {
        writable: true,
        value: 90,
      });

      fireEvent(window, new Event('orientationchange'));

      await waitFor(() => {
        const cameraView = screen.getByTestId('camera-view');
        expect(cameraView).toHaveClass('landscape-mode');
      });
    });

    it('should handle camera switching on mobile', async () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <QRScanner {...defaultProps} />
        </TestWrapper>
      );

      const switchCameraButton = screen.getByRole('button', {
        name: /switch camera/i,
      });
      expect(switchCameraButton).toBeInTheDocument();

      fireEvent.click(switchCameraButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
          video: { facingMode: 'environment' },
        });
      });
    });
  });

  describe('Cross-Device Consistency', () => {
    it('should maintain functionality across all viewport sizes', () => {
      const viewportSizes = ['mobile', 'tablet', 'desktop'] as const;

      viewportSizes.forEach((viewport) => {
        setViewport(viewport);

        render(
          <TestWrapper>
            <ManualLabOrderForm
              testCatalog={mockTestCatalog}
              patients={[mockPatient]}
              onSubmit={jest.fn()}
              isLoading={false}
            />
          </TestWrapper>
        );

        // Core functionality should work on all devices
        expect(screen.getByLabelText(/patient/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/tests/i)).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /create order/i })
        ).toBeInTheDocument();
      });
    });

    it('should adapt navigation patterns for different devices', () => {
      // Mobile: Bottom navigation
      setViewport('mobile');
      render(
        <TestWrapper>
          <LabOrderMobileView orders={mockLabOrders} />
        </TestWrapper>
      );

      expect(screen.getByTestId('bottom-navigation')).toBeInTheDocument();

      // Tablet: Side navigation
      setViewport('tablet');
      render(
        <TestWrapper>
          <LabOrderMobileView orders={mockLabOrders} />
        </TestWrapper>
      );

      expect(screen.getByTestId('side-navigation')).toBeInTheDocument();
    });

    it('should handle touch and mouse interactions appropriately', async () => {
      const user = userEvent.setup();

      // Test touch interactions on mobile
      setViewport('mobile');
      render(
        <TestWrapper>
          <LabOrderList
            orders={mockLabOrders}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      const card = screen.getByTestId('order-card-order1');

      // Touch should work
      fireEvent.touchStart(card);
      fireEvent.touchEnd(card);

      // Test mouse interactions on desktop
      setViewport('desktop');
      render(
        <TestWrapper>
          <LabOrderList
            orders={mockLabOrders}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      const row = screen.getByRole('row', { name: /LAB-2024-0001/i });

      // Mouse hover should work
      await user.hover(row);
      expect(row).toHaveClass('hover-state');
    });
  });

  describe('Performance on Mobile Devices', () => {
    it('should lazy load images and heavy components', async () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <LabOrderList
            orders={Array(50)
              .fill(mockLabOrders[0])
              .map((order, index) => ({
                ...order,
                _id: `order${index}`,
                orderId: `LAB-2024-${String(index).padStart(4, '0')}`,
              }))}
            onOrderSelect={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Only visible items should be rendered initially
      const visibleCards = screen.getAllByTestId(/order-card-/);
      expect(visibleCards.length).toBeLessThan(20); // Virtual scrolling
    });

    it('should optimize animations for mobile performance', () => {
      setViewport('mobile');

      render(
        <TestWrapper>
          <ManualLabOrderForm
            testCatalog={mockTestCatalog}
            patients={[mockPatient]}
            onSubmit={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      const form = screen.getByRole('form');

      // Should use transform-based animations for better performance
      const styles = window.getComputedStyle(form);
      expect(styles.willChange).toBe('transform');
    });

    it('should handle offline scenarios gracefully', async () => {
      setViewport('mobile');

      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(
        <TestWrapper>
          <ManualLabOrderForm
            testCatalog={mockTestCatalog}
            patients={[mockPatient]}
            onSubmit={jest.fn()}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Should show offline indicator
      expect(screen.getByText(/offline mode/i)).toBeInTheDocument();

      // Form should still be usable with cached data
      const patientSelect = screen.getByLabelText(/patient/i);
      expect(patientSelect).not.toBeDisabled();
    });
  });
});
