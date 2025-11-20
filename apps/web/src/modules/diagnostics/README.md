# AI-Powered Diagnostics & Therapeutics Frontend Module

This frontend module provides the user interface for the AI-Powered Diagnostics & Therapeutics system, enabling pharmacists to conduct comprehensive patient assessments with AI assistance.

## Overview

The frontend module includes:

- **Patient Assessment Forms**: Structured symptom and vital signs input
- **Lab Management Interface**: Order creation and result visualization
- **AI Results Dashboard**: Diagnostic analysis display and review
- **Interaction Checking**: Real-time drug interaction alerts
- **Analytics Dashboard**: Performance metrics and reporting
- **Mobile-Responsive Design**: Optimized for tablets and mobile devices

## Architecture

The module follows React best practices with TypeScript:

```
frontend/src/modules/diagnostics/
├── api/                 # API integration layer
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── pages/              # Main page components
├── store/              # Zustand state management
├── types/              # TypeScript type definitions
└── index.ts            # Module exports
```

## State Management

### Zustand Stores

#### DiagnosticStore

Manages diagnostic requests and results:

```typescript
interface DiagnosticStore {
  requests: DiagnosticRequest[];
  results: DiagnosticResult[];
  selectedRequest: DiagnosticRequest | null;
  selectedResult: DiagnosticResult | null;
  loading: LoadingStates;
  errors: ErrorStates;

  // Actions
  createRequest: (
    data: DiagnosticRequestForm
  ) => Promise<DiagnosticRequest | null>;
  fetchResult: (requestId: string) => Promise<DiagnosticResult | null>;
  approveResult: (resultId: string) => Promise<boolean>;
  // ... other actions
}
```

#### LabStore

Manages lab orders and results:

```typescript
interface LabStore {
  orders: LabOrder[];
  results: LabResult[];
  selectedOrder: LabOrder | null;
  selectedResult: LabResult | null;
  loading: LoadingStates;
  errors: ErrorStates;

  // Actions
  createOrder: (data: LabOrderForm) => Promise<LabOrder | null>;
  addResult: (data: LabResultForm) => Promise<LabResult | null>;
  // ... other actions
}
```

## API Integration

### React Query Hooks

The module uses React Query for server state management:

```typescript
// Diagnostic hooks
const useDiagnosticRequest = (requestId: string) => {
  return useQuery({
    queryKey: ['diagnostic', requestId],
    queryFn: () => diagnosticApi.getResult(requestId),
    refetchInterval: (data) => (data?.status === 'processing' ? 5000 : false),
  });
};

// Lab hooks
const useLabResults = (patientId: string) => {
  return useQuery({
    queryKey: ['labResults', patientId],
    queryFn: () => labApi.getResults({ patientId }),
  });
};
```

### API Client Configuration

```typescript
// Automatic retry and error handling
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 30000,
  withCredentials: true,
});

// Request/response interceptors for auth and error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => handleApiError(error)
);
```

## Components

### Core Input Components

#### SymptomInput

Structured symptom data entry:

```typescript
interface SymptomInputProps {
  value: DiagnosticRequestForm['symptoms'];
  onChange: (symptoms: DiagnosticRequestForm['symptoms']) => void;
  error?: string;
  disabled?: boolean;
}
```

#### VitalSignsInput

Clinical measurements with validation:

```typescript
interface VitalSignsInputProps {
  value?: DiagnosticRequestForm['vitals'];
  onChange: (vitals: DiagnosticRequestForm['vitals']) => void;
  error?: string;
  disabled?: boolean;
}
```

#### MedicationHistoryInput

Current medications with drug search:

```typescript
interface MedicationHistoryInputProps {
  value?: DiagnosticRequestForm['currentMedications'];
  onChange: (medications: DiagnosticRequestForm['currentMedications']) => void;
  error?: string;
  disabled?: boolean;
}
```

### Lab Management Components

#### LabOrderForm

Create new lab orders:

```typescript
interface LabOrderFormProps {
  patientId: string;
  onSubmit: (data: LabOrderForm) => void;
  loading?: boolean;
  error?: string;
}
```

#### LabResultViewer

Display and analyze lab results:

```typescript
interface LabResultViewerProps {
  results: LabResult[];
  showTrends?: boolean;
  onResultClick?: (result: LabResult) => void;
}
```

### Diagnostic Results Components

#### DiagnosticResultsPanel

Display AI analysis with review options:

```typescript
interface DiagnosticResultsPanelProps {
  result: DiagnosticResult;
  onApprove?: () => void;
  onModify?: (modifications: string) => void;
  onReject?: (reason: string) => void;
  loading?: boolean;
  error?: string;
}
```

#### InteractionAlerts

Real-time drug interaction warnings:

```typescript
interface InteractionAlertsProps {
  medications: string[];
  allergies?: string[];
  onInteractionFound?: (interactions: DrugInteraction[]) => void;
}
```

## Pages

### DiagnosticDashboard

Main dashboard with case overview:

- Recent diagnostic requests
- Pending reviews
- Analytics summary
- Quick action buttons

### CaseIntakePage

Step-by-step patient assessment:

- Symptom documentation
- Vital signs entry
- Medication history
- Lab result selection
- Consent management

### ResultsReviewPage

AI analysis review and approval:

- Differential diagnoses display
- Confidence indicators
- Red flag alerts
- Pharmacist review panel
- Intervention creation

### LabResultsPage

Lab management interface:

- Order creation and tracking
- Result entry and validation
- Trend visualization
- Reference range checking

## Styling and Theming

### Material-UI Integration

The module integrates with the existing MUI theme:

```typescript
// Custom theme extensions for diagnostics
const diagnosticTheme = {
  components: {
    MuiDiagnosticPanel: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: theme.shadows[2],
        },
      },
    },
  },
};
```

### Responsive Design

Mobile-first approach with breakpoints:

- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+

### Accessibility

WCAG 2.1 AA compliance:

- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management
- Alternative text for images

## Form Validation

### Real-time Validation

```typescript
const useSymptomValidation = () => {
  return useCallback((symptoms: SymptomData) => {
    const errors: ValidationError[] = [];

    if (!symptoms.subjective?.length) {
      errors.push({
        field: 'subjective',
        message: 'At least one subjective symptom is required',
        code: 'required',
      });
    }

    if (!symptoms.duration?.trim()) {
      errors.push({
        field: 'duration',
        message: 'Duration is required',
        code: 'required',
      });
    }

    return errors;
  }, []);
};
```

### Form State Management

```typescript
const useDiagnosticForm = () => {
  const [formData, setFormData] = useState<DiagnosticRequestForm>(initialState);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: string, value: any) => {
    // Field-specific validation logic
  }, []);

  const handleSubmit = useCallback(async (data: DiagnosticRequestForm) => {
    // Form submission with validation
  }, []);

  return { formData, errors, touched, validateField, handleSubmit };
};
```

## Error Handling

### Error Boundaries

```typescript
class DiagnosticErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    errorReportingService.captureException(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <DiagnosticErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
const handleApiError = (error: AxiosError) => {
  if (error.response?.status === 401) {
    // Redirect to login
    authStore.logout();
  } else if (error.response?.status === 403) {
    // Show permission error
    toast.error('Insufficient permissions');
  } else if (error.response?.status >= 500) {
    // Show server error
    toast.error('Server error. Please try again later.');
  } else {
    // Show generic error
    toast.error(error.message || 'An unexpected error occurred');
  }
};
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load diagnostic components
const DiagnosticDashboard = lazy(() => import('./pages/DiagnosticDashboard'));
const CaseIntakePage = lazy(() => import('./pages/CaseIntakePage'));

// Route-based code splitting
const DiagnosticRoutes = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/dashboard" element={<DiagnosticDashboard />} />
      <Route path="/intake" element={<CaseIntakePage />} />
    </Routes>
  </Suspense>
);
```

### Memoization

```typescript
// Expensive calculations
const diagnosticSummary = useMemo(() => {
  return calculateDiagnosticMetrics(results);
}, [results]);

// Component memoization
const DiagnosticCard = memo(({ result }: { result: DiagnosticResult }) => {
  return <Card>{/* Component content */}</Card>;
});
```

### Virtual Scrolling

```typescript
// Large lists of lab results
const VirtualizedLabResults = ({ results }: { results: LabResult[] }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={results.length}
      itemSize={80}
      itemData={results}
    >
      {LabResultRow}
    </FixedSizeList>
  );
};
```

## Testing

### Component Testing

```typescript
describe('SymptomInput', () => {
  it('should validate required fields', async () => {
    render(<SymptomInput value={emptySymptoms} onChange={mockOnChange} />);

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least one symptom is required/i)).toBeInTheDocument();
    });
  });
});
```

### Hook Testing

```typescript
describe('useDiagnosticStore', () => {
  it('should create diagnostic request', async () => {
    const { result } = renderHook(() => useDiagnosticStore());

    await act(async () => {
      await result.current.createRequest(mockRequestData);
    });

    expect(result.current.requests).toHaveLength(1);
  });
});
```

### Integration Testing

```typescript
describe('Diagnostic Workflow', () => {
  it('should complete full diagnostic process', async () => {
    render(<DiagnosticApp />);

    // Fill out symptom form
    fireEvent.change(screen.getByLabelText(/symptoms/i), {
      target: { value: 'chest pain' }
    });

    // Submit request
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    // Wait for AI results
    await waitFor(() => {
      expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
    });

    // Approve results
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
    });
  });
});
```

## Deployment

### Build Configuration

```typescript
// Vite configuration for diagnostics module
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'diagnostics-core': ['./src/modules/diagnostics/index.ts'],
          'diagnostics-components': ['./src/modules/diagnostics/components'],
          'diagnostics-pages': ['./src/modules/diagnostics/pages'],
        },
      },
    },
  },
});
```

### Environment Configuration

```env
# API Configuration
REACT_APP_API_URL=https://api.PharmacyCopilot.com
REACT_APP_AI_TIMEOUT=30000

# Feature Flags
REACT_APP_ENABLE_AI_DIAGNOSTICS=true
REACT_APP_ENABLE_LAB_INTEGRATION=true
REACT_APP_ENABLE_FHIR=false

# Analytics
REACT_APP_ANALYTICS_ID=your_analytics_id
```

## Browser Support

### Supported Browsers

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Polyfills

```typescript
// Core-js polyfills for older browsers
import 'core-js/stable';
import 'regenerator-runtime/runtime';
```

## Security Considerations

### Input Sanitization

```typescript
const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};
```

### Content Security Policy

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';
               connect-src 'self' https://api.PharmacyCopilot.com;"
/>
```

## Future Enhancements

### Planned Features

- Offline support with service workers
- Real-time collaboration features
- Advanced data visualization
- Voice input for symptom documentation
- Integration with wearable devices

### Performance Improvements

- Server-side rendering (SSR)
- Progressive web app (PWA) features
- Advanced caching strategies
- WebAssembly for complex calculations
