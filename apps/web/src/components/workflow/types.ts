import type {
    ClinicalIntervention,
    InterventionStrategy,
    TeamAssignment,
    InterventionOutcome
} from '../../stores/clinicalInterventionStore';

// Issue Identification Step Types
export interface IssueIdentificationData {
    patientId: string;
    category: ClinicalIntervention['category'];
    priority: ClinicalIntervention['priority'];
    issueDescription: string;
    estimatedDuration?: number;
}

export interface IssueIdentificationStepProps {
    onNext: (data: IssueIdentificationData) => void;
    onCancel?: () => void;
    initialData?: Partial<IssueIdentificationData>;
    isLoading?: boolean;
}

// Strategy Recommendation Step Types
export interface StrategyFormData {
    type: InterventionStrategy['type'];
    description: string;
    rationale: string;
    expectedOutcome: string;
    priority: InterventionStrategy['priority'];
}

export interface StrategyRecommendationData {
    strategies: StrategyFormData[];
}

export interface StrategyRecommendationStepProps {
    onNext: (data: StrategyRecommendationData) => void;
    onBack?: () => void;
    onCancel?: () => void;
    initialData?: {
        category: ClinicalIntervention['category'];
        strategies?: StrategyFormData[];
    };
    isLoading?: boolean;
}

// Team Collaboration Step Types
export interface TeamCollaborationData {
    assignments: Omit<TeamAssignment, '_id' | 'assignedAt'>[];
}

export interface TeamCollaborationStepProps {
    onNext: (data: TeamCollaborationData) => void;
    onBack?: () => void;
    onCancel?: () => void;
    initialData?: {
        assignments?: Omit<TeamAssignment, '_id' | 'assignedAt'>[];
    };
    isLoading?: boolean;
}

// Outcome Tracking Step Types
export interface OutcomeTrackingData {
    outcome: InterventionOutcome;
}

export interface OutcomeTrackingStepProps {
    onNext: (data: OutcomeTrackingData) => void;
    onBack?: () => void;
    onCancel?: () => void;
    initialData?: {
        outcome?: InterventionOutcome;
    };
    isLoading?: boolean;
}

// Combined Workflow Data Type
export interface WorkflowData {
    issueIdentification: IssueIdentificationData;
    strategyRecommendation: StrategyRecommendationData;
    teamCollaboration: TeamCollaborationData;
    outcomeTracking: OutcomeTrackingData;
}

// Workflow Step Enum
export enum WorkflowStep {
    ISSUE_IDENTIFICATION = 0,
    STRATEGY_RECOMMENDATION = 1,
    TEAM_COLLABORATION = 2,
    OUTCOME_TRACKING = 3,
}

// Workflow Step Configuration
export interface WorkflowStepConfig {
    id: WorkflowStep;
    title: string;
    description: string;
    component: React.ComponentType<any>;
    isOptional?: boolean;
    requirements?: string[];
}

export const WORKFLOW_STEPS: WorkflowStepConfig[] = [
    {
        id: WorkflowStep.ISSUE_IDENTIFICATION,
        title: 'Issue Identification',
        description: 'Document the clinical issue or problem',
        component: null as any, // Will be set by importing components
        requirements: ['1.1', '1.2', '1.3', '1.4', '8.6'],
    },
    {
        id: WorkflowStep.STRATEGY_RECOMMENDATION,
        title: 'Strategy Recommendation',
        description: 'Select and customize intervention strategies',
        component: null as any,
        requirements: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6'],
    },
    {
        id: WorkflowStep.TEAM_COLLABORATION,
        title: 'Team Collaboration',
        description: 'Assign tasks to healthcare team members',
        component: null as any,
        isOptional: true,
        requirements: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
    },
    {
        id: WorkflowStep.OUTCOME_TRACKING,
        title: 'Outcome Tracking',
        description: 'Document and measure intervention outcomes',
        component: null as any,
        isOptional: true,
        requirements: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'],
    },
];