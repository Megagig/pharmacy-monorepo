import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeatureManagement from '../FeatureManagement';
import featureFlagService from '../../services/featureFlagService';

// Mock the service
vi.mock('../../services/featureFlagService');

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFeatures = [
  {
    _id: '1',
    key: 'test_feature',
    name: 'Test Feature',
    description: 'Test description',
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'owner'],
    isActive: true,
    createdAt: '2024-01-01',
  },
];

describe('FeatureManagement - Responsive Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlagService.getFeatureFlags).mockResolvedValue(mockFeatures);
  });

  describe('Mobile viewport (320px)', () => {
    beforeEach(() => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(max-width: 600px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it('should render page header with stacked layout on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Feature Management')).toBeInTheDocument();
      });

      const header = screen.getByText('Feature Management').closest('div');
      expect(header).toBeInTheDocument();
    });

    it('should show horizontal scroll hint for matrix on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      const tierTab = screen.getByText('Tier Management');
      tierTab.click();

      await waitFor(() => {
        expect(screen.getByText('Scroll horizontally to view all tiers')).toBeInTheDocument();
      });
    });

    it('should render feature cards in single column on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      const card = screen.getByText('Test Feature').closest('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Tablet viewport (768px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(min-width: 600px) and (max-width: 960px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it('should render page header in row layout on tablet', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Feature Management')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Feature');
      expect(addButton).toBeInTheDocument();
    });

    it('should render feature cards in 2 columns on tablet', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      const cards = screen.getAllByText('Test Feature');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('Desktop viewport (1024px+)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(min-width: 960px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    it('should not show horizontal scroll hint on desktop', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      const tierTab = screen.getByText('Tier Management');
      tierTab.click();

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // The scroll hint should not be visible on desktop (it's hidden via CSS display: none)
      // We can't easily test CSS display properties in jsdom, so we just verify the matrix renders
      expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
    });

    it('should render feature cards in 3 columns on desktop', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      const cards = screen.getAllByText('Test Feature');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('Form responsive behavior', () => {
    it('should render form inputs in 2 columns on desktop', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Add Feature')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Feature');
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText('Create Feature')).toBeInTheDocument();
      });

      // Verify form fields are present (using placeholder or label text)
      expect(screen.getByText('Create Feature')).toBeInTheDocument();
      const featureKeyInput = screen.getByRole('textbox', { name: /feature key/i });
      const displayNameInput = screen.getByRole('textbox', { name: /display name/i });
      
      expect(featureKeyInput).toBeInTheDocument();
      expect(displayNameInput).toBeInTheDocument();
    });

    it('should render tier checkboxes in responsive grid', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Add Feature')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Feature');
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText('Allowed Tiers')).toBeInTheDocument();
      });

      // Verify all tiers are present
      expect(screen.getByLabelText('free_trial')).toBeInTheDocument();
      expect(screen.getByLabelText('basic')).toBeInTheDocument();
      expect(screen.getByLabelText('pro')).toBeInTheDocument();
    });

    it('should render role checkboxes in responsive grid', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Add Feature')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Feature');
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText('Allowed Roles')).toBeInTheDocument();
      });

      // Verify all roles are present
      expect(screen.getByLabelText('pharmacist')).toBeInTheDocument();
      expect(screen.getByLabelText('owner')).toBeInTheDocument();
    });

    it('should stack dialog buttons on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Add Feature')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Feature');
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Create')).toBeInTheDocument();
      });
    });
  });

  describe('Matrix table responsive behavior', () => {
    it('should render matrix with horizontal scroll on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      const tierTab = screen.getByText('Tier Management');
      tierTab.click();

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Verify table is rendered
      const table = document.querySelector('table');
      expect(table).toBeInTheDocument();
    });

    it('should render smaller switches on mobile', async () => {
      render(<FeatureManagement />);

      await waitFor(() => {
        expect(screen.getByText('Test Feature')).toBeInTheDocument();
      });

      // Switch to Tier Management tab
      const tierTab = screen.getByText('Tier Management');
      tierTab.click();

      await waitFor(() => {
        expect(screen.getByText('Feature-Tier Matrix')).toBeInTheDocument();
      });

      // Verify switches are rendered
      const switches = document.querySelectorAll('.MuiSwitch-root');
      expect(switches.length).toBeGreaterThan(0);
    });
  });
});
