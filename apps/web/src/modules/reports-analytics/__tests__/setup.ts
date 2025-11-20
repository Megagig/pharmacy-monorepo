import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Recharts components
vi.mock('recharts', () => ({
    LineChart: ({ children }: any) => <div data - testid="line-chart"> { children } </div>,
  AreaChart: ({ children }: any) => <div data - testid="area-chart"> { children } </div>,
  BarChart: ({ children }: any) => <div data - testid="bar-chart"> { children } </div>,
  PieChart: ({ children }: any) => <div data - testid="pie-chart"> { children } </div>,
  ScatterChart: ({ children }: any) => <div data - testid="scatter-chart"> { children } </div>,
  ResponsiveContainer: ({ children }: any) => <div data - testid="responsive-container"> { children } </div>,
  XAxis: () => <div data - testid="x-axis" />,
  YAxis: () => <div data - testid="y-axis" />,
  CartesianGrid: () => <div data - testid="cartesian-grid" />,
  Tooltip: () => <div data - testid="tooltip" />,
  Legend: () => <div data - testid="legend" />,
  Line: () => <div data - testid="line" />,
  Area: () => <div data - testid="area" />,
  Bar: () => <div data - testid="bar" />,
  Cell: () => <div data - testid="cell" />,
  Pie: () => <div data - testid="pie" />,
  Scatter: () => <div data - testid="scatter" />,
}));

// Mock Material-UI components that might cause issues
vi.mock('@mui/material/Skeleton', () => ({
    default: ({ children, ...props }: any) => <div data - testid="skeleton" { ...props } > { children } </div>,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
    format: vi.fn((date, formatStr) => `formatted-${formatStr}`),
    parseISO: vi.fn((dateStr) => new Date(dateStr)),
    isValid: vi.fn(() => true),
    startOfDay: vi.fn((date) => date),
    endOfDay: vi.fn((date) => date),
    subDays: vi.fn((date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000)),
    subMonths: vi.fn((date, months) => new Date(date.getFullYear(), date.getMonth() - months, date.getDate())),
}));

// Mock API calls
global.fetch = vi.fn();

// Mock window.URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Mock file download
const mockDownload = vi.fn();
Object.defineProperty(document, 'createElement', {
    value: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'a') {
            return {
                href: '',
                download: '',
                click: mockDownload,
                style: {},
            };
        }
        return document.createElement(tagName);
    }),
});