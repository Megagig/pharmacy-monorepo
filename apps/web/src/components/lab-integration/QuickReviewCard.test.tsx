import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuickReviewCard from './QuickReviewCard';
import type { LabIntegration } from '../../services/labIntegrationService';

// Mock the navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockLabIntegration: LabIntegration = {
  _id: 'test-id',
  workplaceId: 'workplace-id',
  patientId: 'patient-id',
  pharmacistId: 'pharmacist-id',
  labResultIds: ['result-1'],
  source: 'manual_entry',
  therapyRecommendations: [],
  safetyChecks: [],
  medicationAdjustments: [],
  status: 'pending_review',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('QuickReviewCard', () => {
  it('should render without crashing when aiInterpretation is undefined', () => {
    renderWithRouter(
      <QuickReviewCard labIntegration={mockLabIntegration} />
    );
    
    expect(screen.getByText('Lab Integration Case')).toBeInTheDocument();
    expect(screen.getByText('Patient ID: patient-id')).toBeInTheDocument();
  });

  it('should render without crashing when aiInterpretation.summary is undefined', () => {
    const labIntegrationWithEmptyAI = {
      ...mockLabIntegration,
      aiInterpretation: {
        clinicalSignificance: 'normal' as const,
        confidence: 0.8,
        recommendedActions: [],
        interpretedAt: new Date(),
        modelUsed: 'test-model',
        // summary is intentionally undefined
      } as any,
    };

    renderWithRouter(
      <QuickReviewCard labIntegration={labIntegrationWithEmptyAI} />
    );
    
    expect(screen.getByText('AI interpretation in progress...')).toBeInTheDocument();
  });

  it('should render AI summary when available', () => {
    const labIntegrationWithAI = {
      ...mockLabIntegration,
      aiInterpretation: {
        summary: 'Test AI summary',
        clinicalSignificance: 'normal' as const,
        confidence: 0.8,
        recommendedActions: [],
        interpretedAt: new Date(),
        modelUsed: 'test-model',
      },
    };

    renderWithRouter(
      <QuickReviewCard labIntegration={labIntegrationWithAI} />
    );
    
    expect(screen.getByText('Test AI summary')).toBeInTheDocument();
  });

  it('should truncate long AI summaries', () => {
    const longSummary = 'A'.repeat(200);
    const labIntegrationWithLongAI = {
      ...mockLabIntegration,
      aiInterpretation: {
        summary: longSummary,
        clinicalSignificance: 'normal' as const,
        confidence: 0.8,
        recommendedActions: [],
        interpretedAt: new Date(),
        modelUsed: 'test-model',
      },
    };

    renderWithRouter(
      <QuickReviewCard labIntegration={labIntegrationWithLongAI} />
    );
    
    expect(screen.getByText(/A{150}\.\.\.$/)).toBeInTheDocument();
  });
});