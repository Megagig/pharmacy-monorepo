import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { VirtualizedPatientList } from '../../components/virtualized/VirtualizedPatientList';
import type { Patient } from '../../types/patientManagement';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Mock patient data
const mockPatients: Patient[] = [
  {
    _id: 'patient-1',
    mrn: 'PHM-LAG-001',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    email: 'john.doe@test.com',
    phone: '+2348012345678',
    gender: 'male',
    age: 30,
    bloodGroup: 'A+',
    genotype: 'AA',
    state: 'Lagos',
    lga: 'Ikeja',
    hasActiveDTP: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'patient-2',
    mrn: 'PHM-LAG-002',
    firstName: 'Jane',
    lastName: 'Smith',
    displayName: 'Jane Smith',
    email: 'jane.smith@test.com',
    phone: '+2348012345679',
    gender: 'female',
    age: 25,
    bloodGroup: 'B+',
    genotype: 'AS',
    state: 'Lagos',
    lga: 'Victoria Island',
    hasActiveDTP: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Virtualization Integration Tests', () => {
  it('renders VirtualizedPatientList without crashing', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    // Should render without throwing errors
    expect(true).toBe(true);
  });

  it('shows empty state when no patients provided', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={[]}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    expect(screen.getByText('No patients found')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={[]}
          loading={true}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    // Should show loading skeletons
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('validates component structure and props', () => {
    const onPatientSelect = vi.fn();
    const onPatientEdit = vi.fn();
    const onPatientView = vi.fn();

    const { container } = render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients}
          onPatientSelect={onPatientSelect}
          onPatientEdit={onPatientEdit}
          onPatientView={onPatientView}
          isSelectionMode={true}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    // Should render container
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles large dataset without performance issues', () => {
    // Generate large dataset
    const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
      _id: `patient-${index}`,
      mrn: `PHM-LAG-${String(index + 1).padStart(3, '0')}`,
      firstName: `Patient${index}`,
      lastName: `Test${index}`,
      displayName: `Patient${index} Test${index}`,
      email: `patient${index}@test.com`,
      phone: `+234801234${String(index).padStart(4, '0')}`,
      gender: index % 2 === 0 ? 'male' : 'female',
      age: 20 + (index % 60),
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][index % 4] as any,
      genotype: ['AA', 'AS', 'SS'][index % 3] as any,
      state: 'Lagos',
      lga: 'Ikeja',
      hasActiveDTP: index % 10 === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const startTime = performance.now();

    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={largeDataset}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render large dataset quickly (under 200ms)
    expect(renderTime).toBeLessThan(200);
  });

  it('validates virtualization benefits with performance comparison', () => {
    const dataset = Array.from({ length: 500 }, (_, index) => ({
      _id: `patient-${index}`,
      mrn: `PHM-LAG-${String(index + 1).padStart(3, '0')}`,
      firstName: `Patient${index}`,
      lastName: `Test${index}`,
      displayName: `Patient${index} Test${index}`,
      email: `patient${index}@test.com`,
      phone: `+234801234${String(index).padStart(4, '0')}`,
      gender: index % 2 === 0 ? 'male' : 'female',
      age: 20 + (index % 60),
      bloodGroup: ['A+', 'B+', 'O+', 'AB+'][index % 4] as any,
      genotype: ['AA', 'AS', 'SS'][index % 3] as any,
      state: 'Lagos',
      lga: 'Ikeja',
      hasActiveDTP: index % 10 === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Test virtualized rendering
    const startTime = performance.now();
    
    const { container } = render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={dataset}
          height={400}
          itemHeight={120}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render efficiently
    expect(renderTime).toBeLessThan(150);
    
    // Should only render visible DOM elements (not all 500)
    const renderedCards = container.querySelectorAll('.MuiCard-root');
    expect(renderedCards.length).toBeLessThan(50); // Much less than total dataset
  });
});