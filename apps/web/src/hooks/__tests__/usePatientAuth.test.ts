import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { usePatientAuth } from '../usePatientAuth';
import { PatientAuthContext } from '../../contexts/PatientAuthContext';
import React from 'react';

const mockContextValue = {
  user: {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    workspaceId: 'workspace-456',
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(PatientAuthContext.Provider, { value: mockContextValue }, children)
);

describe('usePatientAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns context value when used within provider', () => {
    const { result } = renderHook(() => usePatientAuth(), { wrapper });

    expect(result.current).toEqual(mockContextValue);
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => usePatientAuth());
    }).toThrow('usePatientAuth must be used within a PatientAuthProvider');
    
    consoleSpy.mockRestore();
  });

  it('provides access to user data', () => {
    const { result } = renderHook(() => usePatientAuth(), { wrapper });

    expect(result.current.user).toEqual({
      _id: 'patient-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      workspaceId: 'workspace-456',
    });
  });

  it('provides authentication status', () => {
    const { result } = renderHook(() => usePatientAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('provides authentication methods', () => {
    const { result } = renderHook(() => usePatientAuth(), { wrapper });

    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.refreshUser).toBe('function');
  });
});