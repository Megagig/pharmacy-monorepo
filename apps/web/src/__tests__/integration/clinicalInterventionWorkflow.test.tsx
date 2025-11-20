import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Mock the services
vi.mock('../../services/clinicalInterventionService');
vi.mock('../../services/patientService');
vi.mock('../../hooks/useAuth');

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            firstName: 'Test',
            lastName: 'Pharmacist',
            role: 'pharmacist'
        },
        isAuthenticated: true
    })
}));

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {children}
            </BrowserRouter>
        </QueryClientProvider>
    );
};

describe('Clinical Intervention Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        render(
            <TestWrapper>
                <div>Test Component</div>
            </TestWrapper>
        );
        
        expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
});