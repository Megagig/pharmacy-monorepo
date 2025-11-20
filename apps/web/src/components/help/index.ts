// MTR Help System Components
export { default as MTRHelpSystem, MTRTooltip, MTRHelpButton } from './MTRHelpSystem';
export {
    MTRContextualHelp,
    QuickReference,
    KeyboardShortcuts,
    StatusIndicators,
    StepHelp
} from './MTRContextualHelp';
export { default as MTRDocumentation } from './MTRDocumentation';

// Help system types and interfaces
export interface HelpSystemProps {
    currentStep?: number;
    onStartTour?: () => void;
    onShowGuide?: () => void;
}

export interface TooltipHelpProps {
    title: string;
    content: string;
    children: React.ReactElement;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface HelpButtonProps {
    topic: string;
    size?: 'small' | 'medium' | 'large';
}

// Help content constants
export const HELP_TOPICS = {
    PATIENT_SELECTION: 'patient-selection',
    MEDICATION_HISTORY: 'medication-history',
    DRUG_INTERACTIONS: 'drug-interactions',
    RECOMMENDATIONS: 'recommendations',
    DOCUMENTATION: 'documentation',
    SYSTEM_ERRORS: 'system-errors',
} as const;

export const TOUR_STEPS = {
    DASHBOARD: 0,
    PATIENT_SELECTION: 1,
    MEDICATION_HISTORY: 2,
    THERAPY_ASSESSMENT: 3,
    PLAN_DEVELOPMENT: 4,
    INTERVENTIONS: 5,
    FOLLOW_UP: 6,
} as const;

// Utility functions for help system
export const getHelpContentForStep = (step: number): string => {
    const stepContent = {
        1: 'Select an appropriate patient for medication therapy review.',
        2: 'Collect comprehensive medication information including all prescriptions, OTC medications, and supplements.',
        3: 'Review automated alerts and identify drug-related problems systematically.',
        4: 'Create evidence-based recommendations to address identified problems.',
        5: 'Document all pharmacist actions and track intervention outcomes.',
        6: 'Schedule appropriate follow-up activities and monitoring.',
    };

    return stepContent[step as keyof typeof stepContent] || 'Complete this step to continue with your MTR.';
};

export const getKeyboardShortcuts = () => ({
    'Ctrl + S': 'Save current progress',
    'Ctrl + N': 'Start new MTR session',
    'Ctrl + F': 'Search patients or medications',
    'Tab': 'Navigate between form fields',
    'Enter': 'Submit forms or confirm actions',
    'Esc': 'Close dialogs or cancel actions',
    'Ctrl + ?': 'Show help system',
});

export const getProblemSeverityInfo = () => ({
    critical: {
        color: 'error',
        description: 'Immediate intervention required',
        examples: ['Life-threatening interactions', 'Contraindicated combinations'],
        action: 'Contact prescriber immediately'
    },
    major: {
        color: 'warning',
        description: 'Significant clinical risk',
        examples: ['Major drug interactions', 'Inappropriate dosing'],
        action: 'Recommend intervention within 24-48 hours'
    },
    moderate: {
        color: 'info',
        description: 'Monitor closely and consider intervention',
        examples: ['Moderate interactions', 'Suboptimal therapy'],
        action: 'Monitor and intervene as appropriate'
    },
    minor: {
        color: 'default',
        description: 'Document and monitor',
        examples: ['Minor interactions', 'Counseling opportunities'],
        action: 'Document findings and monitor trends'
    }
});

// Help system configuration
export const HELP_CONFIG = {
    FLOATING_BUTTON_POSITION: { bottom: 16, right: 16 },
    QUICK_REFERENCE_POSITION: { bottom: 80, left: 16, width: 300 },
    TOOLTIP_DELAY: { enter: 500, leave: 200 },
    DRAWER_WIDTH: 400,
    TOUR_DIALOG_MAX_WIDTH: 'md' as const,
} as const;