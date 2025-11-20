import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import PatientRegistration from '../PatientRegistration';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockWorkspace = {
  _id: 'workspace123',
  name: 'Test Pharmacy',
  address: '123 Test St',
  phone: '+234-801-234-5678',
  email: 'test@pharmacy.com',
  isActive: true,
};

// Mock usePatientAuth hook
const mockRegister = vi.fn();

vi.mock('../../../hooks/usePatientAuth', () => ({
  usePatientAuth: () => ({
    register: mockRegister,
    loading: false,
    error: null,
  }),
}));

describe('PatientRegistration', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form correctly', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    expect(screen.getByText('Register for Test Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Create your patient portal account')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('shows workspace information', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('123 Test St')).toBeInTheDocument();
    expect(screen.getByText('+234-801-234-5678')).toBeInTheDocument();
  });

  it('handles form submission with valid data', async () => {
    mockRegister.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+234-801-234-5678' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });

    // Accept terms
    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
    fireEvent.click(termsCheckbox);

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+234-801-234-5678',
        dateOfBirth: '1990-01-01',
        password: 'password123',
        workspaceId: 'workspace123',
      });
    });
  });

  it('validates required fields', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates phone number format', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const phoneInput = screen.getByLabelText('Phone Number');
    fireEvent.change(phoneInput, { target: { value: '123' } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid Nigerian phone number')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates password strength', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: '123' } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates password confirmation', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates age requirement', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const dobInput = screen.getByLabelText('Date of Birth');
    const today = new Date();
    const futureDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    
    fireEvent.change(dobInput, { target: { value: futureDate.toISOString().split('T')[0] } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('You must be at least 13 years old')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('requires terms acceptance', async () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Fill out all required fields but don't accept terms
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+234-801-234-5678' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('You must agree to the terms and conditions')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows password strength indicator', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');

    // Weak password
    fireEvent.change(passwordInput, { target: { value: '123' } });
    expect(screen.getByText('Weak')).toBeInTheDocument();

    // Medium password
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(screen.getByText('Medium')).toBeInTheDocument();

    // Strong password
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('handles back navigation', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('shows loading state during registration', async () => {
    vi.mocked(mockRegister).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+234-801-234-5678' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });

    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
    fireEvent.click(termsCheckbox);

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(registerButton).toBeDisabled();
  });

  it('handles registration error', async () => {
    mockRegister.mockRejectedValue(new Error('Email already exists'));

    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+234-801-234-5678' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });

    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
    fireEvent.click(termsCheckbox);

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });

  it('shows success message after registration', async () => {
    mockRegister.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+234-801-234-5678' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });

    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
    fireEvent.click(termsCheckbox);

    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Registration Successful!')).toBeInTheDocument();
      expect(screen.getByText('Please check your email to verify your account.')).toBeInTheDocument();
    });
  });

  it('formats phone number input', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const phoneInput = screen.getByLabelText('Phone Number');
    
    // Should format Nigerian phone number
    fireEvent.change(phoneInput, { target: { value: '08012345678' } });
    expect(phoneInput).toHaveValue('+234-801-234-5678');
  });

  it('clears form errors when user starts typing', async () => {
    mockRegister.mockRejectedValue(new Error('Email already exists'));

    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    // Trigger error first
    const registerButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument();
    });

    // Start typing in first name field
    const firstNameInput = screen.getByLabelText('First Name');
    fireEvent.change(firstNameInput, { target: { value: 'John' } });

    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    renderWithProviders(
      <PatientRegistration workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');

    // Tab navigation
    firstNameInput.focus();
    fireEvent.keyDown(firstNameInput, { key: 'Tab' });
    expect(lastNameInput).toHaveFocus();
  });
});