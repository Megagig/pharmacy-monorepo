import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { usePatientAuth } from '../usePatientAuth';
import { PatientAuthProvider } from '../../contexts/PatientAuthContext';

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const auth = usePatientAuth();

  return (
    <div>
      <div data-testid="loading">{auth.loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user">{auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : 'No User'}</div>
      <div data-testid="methods">
        {typeof auth.login === 'function' ? 'Has login' : 'No login'}
        {typeof auth.register === 'function' ? ', Has register' : ', No register'}
        {typeof auth.logout === 'function' ? ', Has logout' : ', No logout'}
      </div>
    </div>
  );
};

describe('usePatientAuth', () => {
  it('returns auth context when used within provider', () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByTestId('authenticated')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toBeInTheDocument();
    expect(screen.getByText('Has login, Has register, Has logout')).toBeInTheDocument();
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('usePatientAuth must be used within a PatientAuthProvider');

    consoleSpy.mockRestore();
  });

  it('provides all required methods and properties', () => {
    const TestMethodsComponent: React.FC = () => {
      const auth = usePatientAuth();

      const methods = [
        'user',
        'loading',
        'isAuthenticated',
        'login',
        'register',
        'logout',
        'verifyEmail',
        'forgotPassword',
        'resetPassword',
        'updateProfile',
        'refreshToken',
        'checkAuthStatus',
      ];

      return (
        <div>
          {methods.map((method) => (
            <div key={method} data-testid={`has-${method}`}>
              {method in auth ? `Has ${method}` : `Missing ${method}`}
            </div>
          ))}
        </div>
      );
    };

    render(
      <PatientAuthProvider>
        <TestMethodsComponent />
      </PatientAuthProvider>
    );

    const expectedMethods = [
      'user',
      'loading',
      'isAuthenticated',
      'login',
      'register',
      'logout',
      'verifyEmail',
      'forgotPassword',
      'resetPassword',
      'updateProfile',
      'refreshToken',
      'checkAuthStatus',
    ];

    expectedMethods.forEach((method) => {
      expect(screen.getByText(`Has ${method}`)).toBeInTheDocument();
    });
  });

  it('provides correct initial state', () => {
    render(
      <PatientAuthProvider>
        <TestComponent />
      </PatientAuthProvider>
    );

    // Initially should not be loading (in mock context)
    expect(screen.getByText('Not Loading')).toBeInTheDocument();
    expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    expect(screen.getByText('No User')).toBeInTheDocument();
  });
});