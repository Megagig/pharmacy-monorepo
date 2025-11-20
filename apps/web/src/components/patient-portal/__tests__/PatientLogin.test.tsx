import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import PatientLogin from '../PatientLogin';

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
const mockLogin = vi.fn();
const mockForgotPassword = vi.fn();

vi.mock('../../../hooks/usePatientAuth', () => ({
  usePatientAuth: () => ({
    login: mockLogin,
    forgotPassword: mockForgotPassword,
    loading: false,
    error: null,
  }),
}));

describe('PatientLogin', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    expect(screen.getByText('Login to Test Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Access your patient portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows workspace information', () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('123 Test St')).toBeInTheDocument();
    expect(screen.getByText('+234-801-234-5678')).toBeInTheDocument();
  });

  it('handles form submission with valid data', async () => {
    mockLogin.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        workspaceId: 'workspace123',
      });
    });
  });

  it('validates required fields', async () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password length', async () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const passwordInput = screen.getByLabelText('Password');
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('handles forgot password', async () => {
    mockForgotPassword.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    // Should show forgot password form
    expect(screen.getByText('Reset Password')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address and we\'ll send you a reset link')).toBeInTheDocument();

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        workspaceId: 'workspace123',
      });
    });
  });

  it('shows success message after password reset request', async () => {
    mockForgotPassword.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Reset link sent!')).toBeInTheDocument();
      expect(screen.getByText('Check your email for password reset instructions.')).toBeInTheDocument();
    });
  });

  it('handles back navigation', () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('handles back navigation from forgot password', async () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    const backToLoginLink = screen.getByText('Back to Login');
    fireEvent.click(backToLoginLink);

    expect(screen.getByText('Login to Test Pharmacy')).toBeInTheDocument();
  });

  it('shows loading state during login', async () => {
    vi.mocked(mockLogin).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(loginButton).toBeDisabled();
  });

  it('shows loading state during forgot password', async () => {
    vi.mocked(mockForgotPassword).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(sendButton);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });

  it('handles login error', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('handles forgot password error', async () => {
    mockForgotPassword.mockRejectedValue(new Error('Email not found'));

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const forgotPasswordLink = screen.getByText('Forgot Password?');
    fireEvent.click(forgotPasswordLink);

    const emailInput = screen.getByLabelText('Email Address');
    const sendButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Email not found')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation', () => {
    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');

    // Tab navigation
    emailInput.focus();
    fireEvent.keyDown(emailInput, { key: 'Tab' });
    expect(passwordInput).toHaveFocus();
  });

  it('clears form errors when user starts typing', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Start typing in email field
    fireEvent.change(emailInput, { target: { value: 'test2@example.com' } });

    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it('handles Enter key submission', async () => {
    mockLogin.mockResolvedValue({ success: true });

    renderWithProviders(
      <PatientLogin workspace={mockWorkspace} onBack={mockOnBack} />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.keyDown(passwordInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        workspaceId: 'workspace123',
      });
    });
  });
});