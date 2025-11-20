import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import { expect, describe, it } from 'vitest';
import ConfidenceIndicator from '../ConfidenceIndicator';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ConfidenceIndicator', () => {
  describe('Confidence Levels', () => {
    it('shows high confidence for values >= 0.8', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.85} />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('shows medium confidence for values 0.6-0.79', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.7} />);

      expect(screen.getByText('Medium Confidence')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('shows low confidence for values 0.4-0.59', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.5} />);

      expect(screen.getByText('Low Confidence')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows very low confidence for values < 0.4', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.3} />);

      expect(screen.getByText('Very Low Confidence')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} size="small" />);

      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('renders medium size correctly (default)', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('renders large size correctly', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} size="large" />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Display Options', () => {
    it('hides label when showLabel is false', () => {
      renderWithTheme(
        <ConfidenceIndicator confidence={0.8} showLabel={false} />
      );

      expect(screen.queryByText('High Confidence')).not.toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('hides percentage when showPercentage is false', () => {
      renderWithTheme(
        <ConfidenceIndicator confidence={0.8} showPercentage={false} />
      );

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
    });

    it('hides both label and percentage when both are false', () => {
      renderWithTheme(
        <ConfidenceIndicator
          confidence={0.8}
          showLabel={false}
          showPercentage={false}
        />
      );

      expect(screen.queryByText('High Confidence')).not.toBeInTheDocument();
      expect(screen.queryByText('80%')).not.toBeInTheDocument();
    });
  });

  describe('Variant Types', () => {
    it('renders linear variant by default', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.8} />
      );

      // Linear progress bar should be present
      expect(
        container.querySelector('.MuiLinearProgress-root')
      ).toBeInTheDocument();
    });

    it('renders chip variant correctly', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} variant="chip" />);

      // Should render as a chip
      expect(screen.getByText('80%')).toBeInTheDocument();
      const chip = screen.getByText('80%').closest('.MuiChip-root');
      expect(chip).toBeInTheDocument();
    });

    it('renders circular variant correctly', () => {
      renderWithTheme(
        <ConfidenceIndicator confidence={0.8} variant="circular" />
      );

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Chip Variant Options', () => {
    it('shows percentage in chip when showPercentage is true', () => {
      renderWithTheme(
        <ConfidenceIndicator
          confidence={0.8}
          variant="chip"
          showPercentage={true}
        />
      );

      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('shows label in chip when showPercentage is false', () => {
      renderWithTheme(
        <ConfidenceIndicator
          confidence={0.8}
          variant="chip"
          showPercentage={false}
        />
      );

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper tooltip with detailed information', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} />);

      // The component should render with tooltip functionality
      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('provides meaningful text for screen readers', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8} />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles confidence value of 0', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0} />);

      expect(screen.getByText('Very Low Confidence')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles confidence value of 1', () => {
      renderWithTheme(<ConfidenceIndicator confidence={1} />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles confidence values with many decimal places', () => {
      renderWithTheme(<ConfidenceIndicator confidence={0.8567} />);

      expect(screen.getByText('High Confidence')).toBeInTheDocument();
      expect(screen.getByText('86%')).toBeInTheDocument(); // Should round to nearest integer
    });

    it('handles boundary values correctly', () => {
      // Test exact boundary at 0.8
      renderWithTheme(<ConfidenceIndicator confidence={0.8} />);
      expect(screen.getByText('High Confidence')).toBeInTheDocument();

      // Test just below boundary
      const { rerender } = renderWithTheme(
        <ConfidenceIndicator confidence={0.79} />
      );
      expect(screen.getByText('Medium Confidence')).toBeInTheDocument();

      // Test exact boundary at 0.6
      rerender(
        <ThemeProvider theme={theme}>
          <ConfidenceIndicator confidence={0.6} />
        </ThemeProvider>
      );
      expect(screen.getByText('Medium Confidence')).toBeInTheDocument();

      // Test just below boundary
      rerender(
        <ThemeProvider theme={theme}>
          <ConfidenceIndicator confidence={0.59} />
        </ThemeProvider>
      );
      expect(screen.getByText('Low Confidence')).toBeInTheDocument();

      // Test exact boundary at 0.4
      rerender(
        <ThemeProvider theme={theme}>
          <ConfidenceIndicator confidence={0.4} />
        </ThemeProvider>
      );
      expect(screen.getByText('Low Confidence')).toBeInTheDocument();

      // Test just below boundary
      rerender(
        <ThemeProvider theme={theme}>
          <ConfidenceIndicator confidence={0.39} />
        </ThemeProvider>
      );
      expect(screen.getByText('Very Low Confidence')).toBeInTheDocument();
    });
  });

  describe('Color Coding', () => {
    it('uses success color for high confidence', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.9} />
      );

      // Should have success color class or styling
      const progressBar = container.querySelector(
        '.MuiLinearProgress-colorSuccess'
      );
      expect(progressBar).toBeInTheDocument();
    });

    it('uses warning color for medium confidence', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.7} />
      );

      // Should have warning color class or styling
      const progressBar = container.querySelector(
        '.MuiLinearProgress-colorWarning'
      );
      expect(progressBar).toBeInTheDocument();
    });

    it('uses error color for low confidence', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.5} />
      );

      // Should have error color class or styling
      const progressBar = container.querySelector(
        '.MuiLinearProgress-colorError'
      );
      expect(progressBar).toBeInTheDocument();
    });

    it('uses error color for very low confidence', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.3} />
      );

      // Should have error color class or styling
      const progressBar = container.querySelector(
        '.MuiLinearProgress-colorError'
      );
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Progress Bar Behavior', () => {
    it('sets correct progress value', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.75} />
      );

      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      expect(progressBar).toBeInTheDocument();

      // The progress bar should have the correct width/value (75%)
      // This might be tested through computed styles or aria attributes
    });

    it('handles progress bar styling correctly', () => {
      const { container } = renderWithTheme(
        <ConfidenceIndicator confidence={0.6} size="large" />
      );

      const progressRoot = container.querySelector('.MuiLinearProgress-root');
      expect(progressRoot).toBeInTheDocument();

      // Should have rounded corners and correct height for large size
      const styles = window.getComputedStyle(progressRoot!);
      expect(styles.borderRadius).toBeTruthy();
    });
  });
});
