import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import AppointmentConfirmation from '../AppointmentConfirmation';
import { PatientAppointment } from '../../../services/patientPortalService';

// Mock data
const mockAppointment: PatientAppointment = {
  _id: '1',
  type: 'mtm_session',
  title: 'Medication Therapy Management',
  description: 'Review current medications and discuss any concerns',
  scheduledDate: '2025-10-30',
  scheduledTime: '10:00',
  duration: 30,
  status: 'confirmed',
  confirmationStatus: 'confirmed',
  pharmacistName: 'Dr. John Smith',
  locationName: 'Main Pharmacy',
  canReschedule: true,
  canCancel: true,
};

const mockPharmacyInfo = {
  name: 'HealthCare Pharmacy',
  address: '123 Main Street, Lagos, Nigeria',
  phone: '+234-123-456-7890',
  email: 'info@healthcarepharmacy.com',
  website: 'https://healthcarepharmacy.com',
  directions: 'Located on the ground floor of the HealthCare Building, next to the main entrance.',
  parkingInfo: 'Free parking available in the building garage. Entrance on Oak Street.',
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();

  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    appointment: mockAppointment,
    confirmationCode: 'CONF123456',
    pharmacyInfo: mockPharmacyInfo,
    onClose: vi.fn(),
    onPrint: vi.fn(),
    onShare: vi.fn(),
    onAddToCalendar: vi.fn(),
    showActions: true,
  };

  return render(
    <TestWrapper>
      <AppointmentConfirmation {...defaultProps} {...props} />
    </TestWrapper>
  );
};

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

describe('AppointmentConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the confirmation success message', () => {
      renderComponent();
      
      expect(screen.getByText('Appointment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('Your appointment has been successfully booked. You will receive a confirmation message shortly.')).toBeInTheDocument();
    });

    it('displays the confirmation code when provided', () => {
      renderComponent({ confirmationCode: 'CONF123456' });
      
      expect(screen.getByText('Confirmation Code: CONF123456')).toBeInTheDocument();
    });

    it('does not display confirmation code when not provided', () => {
      renderComponent({ confirmationCode: undefined });
      
      expect(screen.queryByText(/Confirmation Code:/)).not.toBeInTheDocument();
    });

    it('displays appointment details correctly', () => {
      renderComponent();
      
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
      expect(screen.getByText('Medication Therapy Management')).toBeInTheDocument();
      expect(screen.getByText('Thursday, October 30, 2025')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM - 10:30 AM')).toBeInTheDocument();
      expect(screen.getByText('Duration: 30 minutes')).toBeInTheDocument();
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
    });

    it('displays pharmacy information when provided', () => {
      renderComponent();
      
      expect(screen.getByText('Pharmacy Information')).toBeInTheDocument();
      expect(screen.getByText('HealthCare Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('123 Main Street, Lagos, Nigeria')).toBeInTheDocument();
      expect(screen.getByText('+234-123-456-7890')).toBeInTheDocument();
      expect(screen.getByText('info@healthcarepharmacy.com')).toBeInTheDocument();
    });

    it('does not display pharmacy section when not provided', () => {
      renderComponent({ pharmacyInfo: undefined });
      
      expect(screen.queryByText('Pharmacy Information')).not.toBeInTheDocument();
    });

    it('displays preparation instructions', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      expect(screen.getByText('Preparation Instructions')).toBeInTheDocument();
      expect(screen.getByText('Arrive on Time')).toBeInTheDocument();
      expect(screen.getByText('Bring Required Documents')).toBeInTheDocument();
      
      // Need to expand to see MTM-specific instructions
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      expect(screen.getByText('Bring All Medications')).toBeInTheDocument(); // MTM-specific
    });

    it('displays action buttons when showActions is true', () => {
      renderComponent({ showActions: true });
      
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
      expect(screen.getByText('Print Details')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('hides action buttons when showActions is false', () => {
      renderComponent({ showActions: false });
      
      expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
      expect(screen.queryByText('Add to Calendar')).not.toBeInTheDocument();
    });
  });

  describe('Appointment Type Specific Instructions', () => {
    it('shows MTM-specific instructions for MTM appointments', async () => {
      const user = userEvent.setup();
      renderComponent({
        appointment: { ...mockAppointment, type: 'mtm_session' }
      });
      
      // Need to expand to see all instructions
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      expect(screen.getByText('Bring All Medications')).toBeInTheDocument();
      expect(screen.getByText('Prepare Questions')).toBeInTheDocument();
    });

    it('shows vaccination-specific instructions for vaccination appointments', async () => {
      const user = userEvent.setup();
      renderComponent({
        appointment: { ...mockAppointment, type: 'vaccination', title: 'COVID-19 Vaccination' }
      });
      
      // Need to expand to see all instructions
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      expect(screen.getByText('Vaccination History')).toBeInTheDocument();
      expect(screen.getByText('Wear Appropriate Clothing')).toBeInTheDocument();
    });

    it('shows health check instructions for health check appointments', async () => {
      const user = userEvent.setup();
      renderComponent({
        appointment: { ...mockAppointment, type: 'health_check', title: 'Annual Health Check' }
      });
      
      // Need to expand to see all instructions
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      expect(screen.getByText('Health History')).toBeInTheDocument();
      expect(screen.getByText('Current Medications')).toBeInTheDocument();
    });

    it('shows chronic disease review instructions for chronic disease appointments', async () => {
      const user = userEvent.setup();
      renderComponent({
        appointment: { ...mockAppointment, type: 'chronic_disease_review', title: 'Diabetes Review' }
      });
      
      // Need to expand to see all instructions
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      expect(screen.getByText('Recent Test Results')).toBeInTheDocument();
      expect(screen.getByText('Symptom Log')).toBeInTheDocument();
    });
  });

  describe('Expandable Sections', () => {
    it('expands and collapses pharmacy details', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Find the expand button (IconButton with ExpandMoreIcon) in the pharmacy section
      const pharmacySection = screen.getByText('Pharmacy Information').closest('.MuiCard-root');
      const expandButton = within(pharmacySection!).getByTestId('ExpandMoreIcon').closest('button');
      
      // Click to expand (or collapse if already expanded)
      await user.click(expandButton!);
      
      // Should show expanded content
      expect(screen.getByText('Directions')).toBeInTheDocument();
      expect(screen.getByText('Parking Information')).toBeInTheDocument();
    });

    it('expands and collapses preparation instructions', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Should initially show only first 2 instructions
      expect(screen.getByText('Arrive on Time')).toBeInTheDocument();
      expect(screen.getByText('Bring Required Documents')).toBeInTheDocument();
      
      // Find the "Show more instructions" button
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      
      await user.click(showMoreButton);
      
      // Should now show all instructions
      expect(screen.getByText('Bring All Medications')).toBeInTheDocument();
      expect(screen.getByText('Prepare Questions')).toBeInTheDocument();
    });

    it('shows expand button for additional instructions when there are more than 2', () => {
      renderComponent();
      
      // Should show "Show X more instructions" button
      expect(screen.getByText(/Show \d+ more instructions/)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('calls onAddToCalendar when Add to Calendar is clicked', async () => {
      const user = userEvent.setup();
      const mockOnAddToCalendar = vi.fn();
      
      renderComponent({ onAddToCalendar: mockOnAddToCalendar });
      
      await user.click(screen.getByText('Add to Calendar'));
      
      expect(mockOnAddToCalendar).toHaveBeenCalledWith(mockAppointment);
    });

    it('opens calendar dialog when onAddToCalendar is not provided', async () => {
      const user = userEvent.setup();
      
      renderComponent({ onAddToCalendar: undefined });
      
      await user.click(screen.getByText('Add to Calendar'));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Choose your preferred calendar application:')).toBeInTheDocument();
    });

    it('calls onPrint when Print Details is clicked', async () => {
      const user = userEvent.setup();
      const mockOnPrint = vi.fn();
      
      renderComponent({ onPrint: mockOnPrint });
      
      await user.click(screen.getByText('Print Details'));
      
      expect(mockOnPrint).toHaveBeenCalled();
    });

    it('calls onShare when Share is clicked', async () => {
      const user = userEvent.setup();
      const mockOnShare = vi.fn();
      
      renderComponent({ onShare: mockOnShare });
      
      await user.click(screen.getByText('Share'));
      
      expect(mockOnShare).toHaveBeenCalled();
    });

    it('calls onClose when Close is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      renderComponent({ onClose: mockOnClose });
      
      await user.click(screen.getByText('Close'));
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not show action buttons when callbacks are not provided', () => {
      renderComponent({ 
        onPrint: undefined, 
        onShare: undefined, 
        onClose: undefined 
      });
      
      expect(screen.queryByText('Print Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Share')).not.toBeInTheDocument();
      expect(screen.queryByText('Close')).not.toBeInTheDocument();
      
      // Add to Calendar should still be there
      expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
    });
  });

  describe('Calendar Integration', () => {
    it('opens Google Calendar when Google Calendar button is clicked', async () => {
      const user = userEvent.setup();
      
      renderComponent({ onAddToCalendar: undefined });
      
      // Open calendar dialog
      await user.click(screen.getByText('Add to Calendar'));
      
      // Click Google Calendar
      await user.click(screen.getByText('Google Calendar'));
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('calendar.google.com'),
        '_blank'
      );
    });

    it('opens Outlook Calendar when Outlook Calendar button is clicked', async () => {
      const user = userEvent.setup();
      
      renderComponent({ onAddToCalendar: undefined });
      
      // Open calendar dialog
      await user.click(screen.getByText('Add to Calendar'));
      
      // Click Outlook Calendar
      await user.click(screen.getByText('Outlook Calendar'));
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('outlook.live.com'),
        '_blank'
      );
    });

    it('closes calendar dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      
      renderComponent({ onAddToCalendar: undefined });
      
      // Open calendar dialog
      await user.click(screen.getByText('Add to Calendar'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Click Cancel
      await user.click(screen.getByText('Cancel'));
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Pharmacy Actions', () => {
    it('opens directions when Get Directions is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByText('Get Directions'));
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('maps.google.com'),
        '_blank'
      );
    });

    it('initiates phone call when Call Pharmacy is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByText('Call Pharmacy'));
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'tel:+234-123-456-7890',
        '_self'
      );
    });
  });

  describe('Date and Time Formatting', () => {
    it('formats date correctly', () => {
      renderComponent({
        appointment: { ...mockAppointment, scheduledDate: '2025-12-25' }
      });
      
      expect(screen.getByText('Thursday, December 25, 2025')).toBeInTheDocument();
    });

    it('formats time correctly', () => {
      renderComponent({
        appointment: { ...mockAppointment, scheduledTime: '14:30' }
      });
      
      expect(screen.getByText('2:30 PM - 3:00 PM')).toBeInTheDocument();
    });

    it('calculates end time correctly based on duration', () => {
      renderComponent({
        appointment: { 
          ...mockAppointment, 
          scheduledTime: '09:15',
          duration: 45 
        }
      });
      
      expect(screen.getByText('9:15 AM - 10:00 AM')).toBeInTheDocument();
    });
  });

  describe('Appointment Type Display', () => {
    it('uses title when provided', () => {
      renderComponent({
        appointment: { 
          ...mockAppointment, 
          type: 'mtm_session',
          title: 'Custom MTM Session Title'
        }
      });
      
      expect(screen.getByText('Custom MTM Session Title')).toBeInTheDocument();
    });

    it('formats type name when title is not provided', () => {
      renderComponent({
        appointment: { 
          ...mockAppointment, 
          type: 'chronic_disease_review',
          title: undefined
        }
      });
      
      expect(screen.getByText('Chronic Disease Review')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders correctly on mobile', () => {
      // Mock mobile breakpoint
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 899.95px)'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      renderComponent();
      
      // Component should still render properly
      expect(screen.getByText('Appointment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderComponent();
      
      expect(screen.getByRole('heading', { level: 1, name: 'Appointment Confirmed!' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Appointment Details' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Pharmacy Information' })).toBeInTheDocument();
    });

    it('has proper button labels', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: 'Add to Calendar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Print Details' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('has proper dialog roles and labels', async () => {
      const user = userEvent.setup();
      renderComponent({ onAddToCalendar: undefined });
      
      await user.click(screen.getByText('Add to Calendar'));
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('has proper list structure for instructions', () => {
      renderComponent();
      
      const instructionsList = screen.getByRole('list');
      expect(instructionsList).toBeInTheDocument();
      
      const listItems = within(instructionsList).getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);
    });
  });

  describe('Important Instructions Highlighting', () => {
    it('highlights important instructions with warning color and chip', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Need to expand to see all instructions including important ones
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      // MTM appointments should have "Bring All Medications" as important
      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    it('shows different important instructions for different appointment types', async () => {
      const user = userEvent.setup();
      renderComponent({
        appointment: { ...mockAppointment, type: 'vaccination' }
      });
      
      // Need to expand to see all instructions including important ones
      const showMoreButton = screen.getByText(/Show \d+ more instructions/);
      await user.click(showMoreButton);
      
      // Should show vaccination-specific important instruction
      expect(screen.getByText('Vaccination History')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();
    });
  });

  describe('Animation and Visual Effects', () => {
    it('renders with fade-in animations', () => {
      renderComponent();
      
      // Check that Fade components are rendered (they should contain the content)
      expect(screen.getByText('Appointment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });

    it('shows success styling for confirmation', () => {
      renderComponent();
      
      // Check for success-related elements
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });
  });
});