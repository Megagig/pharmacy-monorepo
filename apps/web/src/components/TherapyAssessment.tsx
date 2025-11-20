import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Checkbox,
  Rating,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useForm, Controller } from 'react-hook-form';
import FixedGrid from './common/FixedGrid';

import { useMTRStore } from '../stores/mtrStore';
import type { DrugTherapyProblem, MTRMedicationEntry } from '../types/mtr';

interface TherapyAssessmentProps {
  medications: MTRMedicationEntry[];
  patientInfo?: {
    id: string;
    name: string;
    age?: number;
    allergies?: string[];
    conditions?: string[];
  };
  onProblemsIdentified: (problems: DrugTherapyProblem[]) => void;
}

interface AssessmentStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  problems: DrugTherapyProblem[];
}

interface AdherenceAssessment {
  medicationId: string;
  medicationName: string;
  adherenceScore: number; // 0-10 scale
  barriers: string[];
  notes: string;
}

interface ProblemFormData {
  category: 'indication' | 'effectiveness' | 'safety' | 'adherence';
  subcategory: string;
  type:
    | 'unnecessary'
    | 'wrongDrug'
    | 'doseTooLow'
    | 'doseTooHigh'
    | 'adverseReaction'
    | 'inappropriateAdherence'
    | 'needsAdditional'
    | 'interaction'
    | 'duplication'
    | 'contraindication'
    | 'monitoring';
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  description: string;
  clinicalSignificance: string;
  affectedMedications: string[];
  relatedConditions: string[];
  evidenceLevel: 'definite' | 'probable' | 'possible' | 'unlikely';
  riskFactors: string[];
}

const PROBLEM_CATEGORIES = [
  {
    value: 'indication',
    label: 'Indication',
    description: 'Problems related to drug indication',
  },
  {
    value: 'effectiveness',
    label: 'Effectiveness',
    description: 'Problems with therapeutic effectiveness',
  },
  {
    value: 'safety',
    label: 'Safety',
    description: 'Safety-related drug problems',
  },
  {
    value: 'adherence',
    label: 'Adherence',
    description: 'Patient adherence issues',
  },
];

const PROBLEM_TYPES = {
  indication: [
    { value: 'unnecessary', label: 'Unnecessary Drug Therapy' },
    { value: 'needsAdditional', label: 'Needs Additional Drug Therapy' },
  ],
  effectiveness: [
    { value: 'wrongDrug', label: 'Wrong Drug' },
    { value: 'doseTooLow', label: 'Dose Too Low' },
  ],
  safety: [
    { value: 'doseTooHigh', label: 'Dose Too High' },
    { value: 'adverseReaction', label: 'Adverse Drug Reaction' },
    { value: 'interaction', label: 'Drug Interaction' },
    { value: 'duplication', label: 'Duplicate Therapy' },
    { value: 'contraindication', label: 'Contraindication' },
  ],
  adherence: [
    { value: 'inappropriateAdherence', label: 'Non-adherence' },
    { value: 'monitoring', label: 'Monitoring Required' },
  ],
};

const SEVERITY_LEVELS = [
  {
    value: 'critical',
    label: 'Critical',
    color: 'error',
    description: 'Immediate intervention required',
  },
  {
    value: 'major',
    label: 'Major',
    color: 'warning',
    description: 'Significant clinical impact',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    color: 'info',
    description: 'Moderate clinical impact',
  },
  {
    value: 'minor',
    label: 'Minor',
    color: 'success',
    description: 'Minor clinical impact',
  },
];

const EVIDENCE_LEVELS = [
  {
    value: 'definite',
    label: 'Definite',
    description: 'Clear causal relationship',
  },
  {
    value: 'probable',
    label: 'Probable',
    description: 'Likely causal relationship',
  },
  {
    value: 'possible',
    label: 'Possible',
    description: 'Possible causal relationship',
  },
  {
    value: 'unlikely',
    label: 'Unlikely',
    description: 'Unlikely causal relationship',
  },
];

const ADHERENCE_BARRIERS = [
  'Cost/Financial constraints',
  'Side effects',
  'Complex dosing regimen',
  'Forgetfulness',
  'Lack of understanding',
  'Cultural/Religious beliefs',
  'Physical limitations',
  'Multiple medications',
  'Lack of perceived benefit',
  'Poor provider communication',
];

const TherapyAssessment: React.FC<TherapyAssessmentProps> = ({
  medications,
  patientInfo,
  onProblemsIdentified,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [assessmentSteps, setAssessmentSteps] = useState<AssessmentStep[]>([
    {
      id: 'interactions',
      title: 'Drug Interactions',
      description: 'Check for drug-drug interactions',
      completed: false,
      problems: [],
    },
    {
      id: 'duplicates',
      title: 'Duplicate Therapy',
      description: 'Identify duplicate or redundant medications',
      completed: false,
      problems: [],
    },
    {
      id: 'contraindications',
      title: 'Contraindications',
      description: 'Check for contraindications and allergies',
      completed: false,
      problems: [],
    },
    {
      id: 'dosing',
      title: 'Dosing Assessment',
      description: 'Evaluate dosing appropriateness',
      completed: false,
      problems: [],
    },
    {
      id: 'adherence',
      title: 'Adherence Assessment',
      description: 'Assess patient adherence patterns',
      completed: false,
      problems: [],
    },
  ]);

  const [isRunningAssessment, setIsRunningAssessment] = useState(false);
  const [assessmentProgress, setAssessmentProgress] = useState(0);
  const [adherenceAssessments, setAdherenceAssessments] = useState<
    AdherenceAssessment[]
  >([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] =
    useState<DrugTherapyProblem | null>(null);

  const { addProblem, updateProblem, setLoading, setError } = useMTRStore();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProblemFormData>({
    defaultValues: {
      category: 'safety',
      severity: 'moderate',
      evidenceLevel: 'probable',
      affectedMedications: [],
      relatedConditions: [],
      riskFactors: [],
    },
  });

  const watchedCategory = watch('category');

  // Initialize adherence assessments when medications change
  useEffect(() => {
    const newAdherenceAssessments = medications.map((med) => ({
      medicationId: med.drugName, // Using drugName as ID for now
      medicationName: med.drugName,
      adherenceScore: med.adherenceScore || 8, // Default to good adherence
      barriers: [],
      notes: '',
    }));
    setAdherenceAssessments(newAdherenceAssessments);
  }, [medications]);

  // Calculate overall assessment progress
  const overallProgress = useMemo(() => {
    const completedSteps = assessmentSteps.filter(
      (step) => step.completed
    ).length;
    return (completedSteps / assessmentSteps.length) * 100;
  }, [assessmentSteps]);

  // Get all identified problems from all steps
  const allProblems = useMemo(() => {
    return assessmentSteps.reduce(
      (acc, step) => [...acc, ...step.problems],
      [] as DrugTherapyProblem[]
    );
  }, [assessmentSteps]);

  // Problem severity statistics
  const problemStats = useMemo(() => {
    const stats = { critical: 0, major: 0, moderate: 0, minor: 0 };
    allProblems.forEach((problem) => {
      stats[problem.severity]++;
    });
    return stats;
  }, [allProblems]);

  const runAutomatedAssessment = async () => {
    setIsRunningAssessment(true);
    setAssessmentProgress(0);

    try {
      setLoading('runAssessment', true);

      // Step 1: Drug Interactions
      setAssessmentProgress(20);
      const interactionProblems = await checkDrugInteractions();
      updateAssessmentStep('interactions', interactionProblems);

      // Step 2: Duplicate Therapy
      setAssessmentProgress(40);
      const duplicateProblems = await checkDuplicateTherapy();
      updateAssessmentStep('duplicates', duplicateProblems);

      // Step 3: Contraindications
      setAssessmentProgress(60);
      const contraindicationProblems = await checkContraindications();
      updateAssessmentStep('contraindications', contraindicationProblems);

      // Step 4: Dosing Assessment
      setAssessmentProgress(80);
      const dosingProblems = await checkDosingAppropriate();
      updateAssessmentStep('dosing', dosingProblems);

      // Step 5: Complete
      setAssessmentProgress(100);

      // Notify parent component
      const allIdentifiedProblems = [
        ...interactionProblems,
        ...duplicateProblems,
        ...contraindicationProblems,
        ...dosingProblems,
      ];
      onProblemsIdentified(allIdentifiedProblems);
    } catch (error) {
      console.error('Assessment failed:', error);
      setError(
        'runAssessment',
        error instanceof Error ? error.message : 'Assessment failed'
      );
    } finally {
      setIsRunningAssessment(false);
      setLoading('runAssessment', false);
    }
  };

  const updateAssessmentStep = (
    stepId: string,
    problems: DrugTherapyProblem[]
  ) => {
    setAssessmentSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: true, problems } : step
      )
    );
  };

  // Mock drug interaction checking (would integrate with real API)
  const checkDrugInteractions = async (): Promise<DrugTherapyProblem[]> => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

    const interactions: DrugTherapyProblem[] = [];

    // Simple mock logic for demonstration
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];

        // Mock interaction detection logic
        if (shouldCheckInteraction(med1.drugName, med2.drugName)) {
          interactions.push({
            _id: `interaction_${i}_${j}`,
            workplaceId: '',
            patientId: patientInfo?.id || '',
            category: 'safety',
            subcategory: 'Drug-Drug Interaction',
            type: 'interaction',
            severity: 'moderate',
            description: `Potential interaction between ${med1.drugName} and ${med2.drugName}`,
            clinicalSignificance:
              'Monitor for increased side effects or reduced efficacy',
            affectedMedications: [med1.drugName, med2.drugName],
            relatedConditions: [],
            evidenceLevel: 'probable',
            riskFactors: ['Multiple medications', 'Concurrent use'],
            status: 'identified',
            identifiedBy: '',
            identifiedAt: new Date().toISOString(),
            createdBy: '',
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return interactions;
  };

  // Mock duplicate therapy checking
  const checkDuplicateTherapy = async (): Promise<DrugTherapyProblem[]> => {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const duplicates: DrugTherapyProblem[] = [];
    const drugClasses: { [key: string]: MTRMedicationEntry[] } = {};

    // Group medications by therapeutic class (simplified)
    medications.forEach((med) => {
      const drugClass = getDrugClass(med.drugName);
      if (!drugClasses[drugClass]) {
        drugClasses[drugClass] = [];
      }
      drugClasses[drugClass].push(med);
    });

    // Check for duplicates within same class
    Object.entries(drugClasses).forEach(([drugClass, meds]) => {
      if (meds.length > 1 && drugClass !== 'other') {
        duplicates.push({
          _id: `duplicate_${drugClass}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'effectiveness',
          subcategory: 'Duplicate Therapy',
          type: 'duplication',
          severity: 'minor',
          description: `Multiple medications from the same therapeutic class: ${drugClass}`,
          clinicalSignificance:
            'Consider consolidating therapy or adjusting doses',
          affectedMedications: meds.map((m) => m.drugName),
          relatedConditions: [],
          evidenceLevel: 'definite',
          riskFactors: ['Polypharmacy', 'Multiple prescribers'],
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return duplicates;
  };

  // Mock contraindication checking
  const checkContraindications = async (): Promise<DrugTherapyProblem[]> => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const contraindications: DrugTherapyProblem[] = [];

    medications.forEach((med) => {
      // Check against patient allergies
      if (
        patientInfo?.allergies?.some((allergy) =>
          med.drugName.toLowerCase().includes(allergy.toLowerCase())
        )
      ) {
        contraindications.push({
          _id: `contraindication_allergy_${med.drugName}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'safety',
          subcategory: 'Allergy Contraindication',
          type: 'contraindication',
          severity: 'critical',
          description: `Patient has documented allergy to ${med.drugName}`,
          clinicalSignificance:
            'Discontinue medication immediately to prevent allergic reaction',
          affectedMedications: [med.drugName],
          relatedConditions: patientInfo?.allergies || [],
          evidenceLevel: 'definite',
          riskFactors: ['Known allergy', 'Previous adverse reaction'],
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Check against patient conditions
      if (
        patientInfo?.conditions?.some((condition) =>
          hasContraindication(med.drugName, condition)
        )
      ) {
        contraindications.push({
          _id: `contraindication_condition_${med.drugName}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'safety',
          subcategory: 'Disease Contraindication',
          type: 'contraindication',
          severity: 'major',
          description: `${med.drugName} is contraindicated with patient's condition`,
          clinicalSignificance:
            'Consider alternative therapy or close monitoring',
          affectedMedications: [med.drugName],
          relatedConditions: patientInfo?.conditions || [],
          evidenceLevel: 'probable',
          riskFactors: ['Comorbid conditions'],
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return contraindications;
  };

  // Mock dosing assessment
  const checkDosingAppropriate = async (): Promise<DrugTherapyProblem[]> => {
    await new Promise((resolve) => setTimeout(resolve, 700));

    const dosingProblems: DrugTherapyProblem[] = [];

    medications.forEach((med) => {
      // Simple dosing checks (would be more sophisticated in real implementation)
      const doseValue = parseFloat(med.instructions.dose);

      if (isNaN(doseValue)) return;

      // Check for potentially high doses
      if (isPotentiallyHighDose(med.drugName, doseValue)) {
        dosingProblems.push({
          _id: `dosing_high_${med.drugName}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'safety',
          subcategory: 'High Dose',
          type: 'doseTooHigh',
          severity: 'major',
          description: `${med.drugName} dose may be too high: ${med.instructions.dose}`,
          clinicalSignificance: 'Monitor for dose-related adverse effects',
          affectedMedications: [med.drugName],
          relatedConditions: [],
          evidenceLevel: 'probable',
          riskFactors: ['High dose', 'Patient age', 'Renal function'],
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Check for potentially low doses
      if (isPotentiallyLowDose(med.drugName, doseValue)) {
        dosingProblems.push({
          _id: `dosing_low_${med.drugName}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'effectiveness',
          subcategory: 'Subtherapeutic Dose',
          type: 'doseTooLow',
          severity: 'moderate',
          description: `${med.drugName} dose may be too low: ${med.instructions.dose}`,
          clinicalSignificance: 'May not achieve therapeutic effect',
          affectedMedications: [med.drugName],
          relatedConditions: [],
          evidenceLevel: 'possible',
          riskFactors: ['Low dose', 'Treatment failure'],
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return dosingProblems;
  };

  const completeAdherenceAssessment = () => {
    const adherenceProblems: DrugTherapyProblem[] = [];

    adherenceAssessments.forEach((assessment) => {
      if (assessment.adherenceScore < 7) {
        // Poor adherence threshold
        adherenceProblems.push({
          _id: `adherence_${assessment.medicationId}`,
          workplaceId: '',
          patientId: patientInfo?.id || '',
          category: 'adherence',
          subcategory: 'Poor Adherence',
          type: 'inappropriateAdherence',
          severity: assessment.adherenceScore < 4 ? 'major' : 'moderate',
          description: `Poor adherence to ${assessment.medicationName} (Score: ${assessment.adherenceScore}/10)`,
          clinicalSignificance:
            'May lead to treatment failure or disease progression',
          affectedMedications: [assessment.medicationName],
          relatedConditions: [],
          evidenceLevel: 'probable',
          riskFactors: assessment.barriers,
          status: 'identified',
          identifiedBy: '',
          identifiedAt: new Date().toISOString(),
          createdBy: '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    updateAssessmentStep('adherence', adherenceProblems);
    onProblemsIdentified([...allProblems, ...adherenceProblems]);
  };

  const handleOpenProblemDialog = (problem?: DrugTherapyProblem) => {
    if (problem) {
      setSelectedProblem(problem);
      reset({
        category: problem.category,
        subcategory: problem.subcategory || '',
        type: problem.type,
        severity: problem.severity,
        description: problem.description,
        clinicalSignificance: problem.clinicalSignificance,
        affectedMedications: problem.affectedMedications,
        relatedConditions: problem.relatedConditions,
        evidenceLevel: problem.evidenceLevel,
        riskFactors: problem.riskFactors,
      });
    } else {
      setSelectedProblem(null);
      reset();
    }
    setIsDialogOpen(true);
  };

  const handleCloseProblemDialog = () => {
    setIsDialogOpen(false);
    setSelectedProblem(null);
    reset();
  };

  const handleSaveProblem = async (formData: ProblemFormData) => {
    try {
      const problemData: DrugTherapyProblem = {
        _id: selectedProblem?._id || `manual_${Date.now()}`,
        workplaceId: '',
        patientId: patientInfo?.id || '',
        ...formData,
        status: 'identified',
        identifiedBy: '',
        identifiedAt: new Date().toISOString(),
        createdBy: '',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (selectedProblem) {
        updateProblem(selectedProblem._id, problemData);
      } else {
        addProblem(problemData);
      }

      handleCloseProblemDialog();
    } catch (error) {
      console.error('Error saving problem:', error);
    }
  };

  const updateAdherenceAssessment = (
    medicationId: string,
    updates: Partial<AdherenceAssessment>
  ) => {
    setAdherenceAssessments((prev) =>
      prev.map((assessment) =>
        assessment.medicationId === medicationId
          ? { ...assessment, ...updates }
          : assessment
      )
    );
  };

  const getSeverityColor = (severity: string) => {
    const severityLevel = SEVERITY_LEVELS.find((s) => s.value === severity);
    return severityLevel?.color || 'default';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'major':
        return <WarningIcon color="warning" />;
      case 'moderate':
        return <WarningIcon color="info" />;
      case 'minor':
        return <CheckCircleIcon color="success" />;
      default:
        return <WarningIcon />;
    }
  };

  // Helper functions (would be more sophisticated in real implementation)
  const shouldCheckInteraction = (drug1: string, drug2: string): boolean => {
    // Simple mock logic - in reality would check against drug interaction database
    const interactionPairs = [
      ['warfarin', 'aspirin'],
      ['metformin', 'contrast'],
      ['digoxin', 'furosemide'],
    ];

    return interactionPairs.some(
      ([d1, d2]) =>
        (drug1.toLowerCase().includes(d1) &&
          drug2.toLowerCase().includes(d2)) ||
        (drug1.toLowerCase().includes(d2) && drug2.toLowerCase().includes(d1))
    );
  };

  const getDrugClass = (drugName: string): string => {
    // Simplified drug classification
    const drugClasses: { [key: string]: string } = {
      metformin: 'antidiabetic',
      insulin: 'antidiabetic',
      lisinopril: 'ace_inhibitor',
      enalapril: 'ace_inhibitor',
      amlodipine: 'calcium_channel_blocker',
      nifedipine: 'calcium_channel_blocker',
      atorvastatin: 'statin',
      simvastatin: 'statin',
    };

    for (const [drug, drugClass] of Object.entries(drugClasses)) {
      if (drugName.toLowerCase().includes(drug)) {
        return drugClass;
      }
    }
    return 'other';
  };

  const hasContraindication = (
    drugName: string,
    condition: string
  ): boolean => {
    // Simplified contraindication checking
    const contraindications: { [key: string]: string[] } = {
      metformin: ['kidney disease', 'renal failure'],
      nsaid: ['kidney disease', 'heart failure'],
      'beta-blocker': ['asthma', 'copd'],
    };

    for (const [drug, conditions] of Object.entries(contraindications)) {
      if (drugName.toLowerCase().includes(drug)) {
        return conditions.some((c) => condition.toLowerCase().includes(c));
      }
    }
    return false;
  };

  const isPotentiallyHighDose = (drugName: string, dose: number): boolean => {
    // Simplified high dose checking
    const highDoseThresholds: { [key: string]: number } = {
      metformin: 2000,
      lisinopril: 40,
      atorvastatin: 80,
    };

    for (const [drug, threshold] of Object.entries(highDoseThresholds)) {
      if (drugName.toLowerCase().includes(drug)) {
        return dose > threshold;
      }
    }
    return false;
  };

  const isPotentiallyLowDose = (drugName: string, dose: number): boolean => {
    // Simplified low dose checking
    const lowDoseThresholds: { [key: string]: number } = {
      metformin: 500,
      lisinopril: 2.5,
      atorvastatin: 10,
    };

    for (const [drug, threshold] of Object.entries(lowDoseThresholds)) {
      if (drugName.toLowerCase().includes(drug)) {
        return dose < threshold;
      }
    }
    return false;
  };

  if (medications.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <AssessmentIcon
            sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
          />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Medications to Assess
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please add medications in the previous step before running therapy
            assessment
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AssessmentIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Therapy Assessment
          </Typography>
          <Chip
            label={`${medications.length} medications`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ ml: 2 }}
          />
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenProblemDialog()}
          >
            Add Problem
          </Button>
          <Button
            variant="contained"
            startIcon={
              isRunningAssessment ? (
                <CircularProgress size={16} />
              ) : (
                <PlayArrowIcon />
              )
            }
            onClick={runAutomatedAssessment}
            disabled={isRunningAssessment}
          >
            {isRunningAssessment ? 'Running Assessment...' : 'Run Assessment'}
          </Button>
        </Stack>
      </Box>

      {/* Assessment Progress */}
      {isRunningAssessment && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Assessment Progress
            </Typography>
            <LinearProgress
              variant="determinate"
              value={assessmentProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {assessmentProgress}% complete
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Overall Progress and Statistics */}
      <FixedGrid container spacing={3} sx={{ mb: 3 }}>
        <FixedGrid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Assessment Overview
              </Typography>
              <LinearProgress
                variant="determinate"
                value={overallProgress}
                sx={{ height: 8, borderRadius: 4, mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {assessmentSteps.filter((s) => s.completed).length} of{' '}
                {assessmentSteps.length} assessments completed
              </Typography>
            </CardContent>
          </Card>
        </FixedGrid>
        <FixedGrid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Problems Identified
              </Typography>
              <Stack spacing={1}>
                {SEVERITY_LEVELS.map((level) => (
                  <Box
                    key={level.value}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getSeverityIcon(level.value)}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {level.label}
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        problemStats[level.value as keyof typeof problemStats]
                      }
                      size="small"
                      color={
                        getSeverityColor(level.value) as
                          | 'default'
                          | 'primary'
                          | 'secondary'
                          | 'error'
                          | 'info'
                          | 'success'
                          | 'warning'
                      }
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </FixedGrid>
      </FixedGrid>

      {/* Assessment Steps */}
      <Stepper activeStep={activeStep} orientation="vertical">
        {assessmentSteps.map((step, index) => (
          <Step key={step.id} completed={step.completed}>
            <StepLabel
              optional={
                step.problems.length > 0 && (
                  <Typography variant="caption" color="error">
                    {step.problems.length} problem(s) found
                  </Typography>
                )
              }
            >
              {step.title}
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {step.description}
              </Typography>

              {/* Step-specific content */}
              {step.id === 'adherence' && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                      Adherence Assessment
                    </Typography>
                    <Stack spacing={2}>
                      {adherenceAssessments.map((assessment) => (
                        <Box key={assessment.medicationId}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, mb: 1 }}
                          >
                            {assessment.medicationName}
                          </Typography>
                          <FixedGrid container spacing={2}>
                            <FixedGrid item xs={12} sm={4}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Adherence Score (0-10)
                              </Typography>
                              <Rating
                                value={Number(assessment.adherenceScore) || 0}
                                max={10}
                                onChange={(_, value) =>
                                  updateAdherenceAssessment(
                                    assessment.medicationId,
                                    {
                                      adherenceScore: value || 0,
                                    }
                                  )
                                }
                              />
                            </FixedGrid>
                            <FixedGrid item xs={12} sm={8}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Adherence Barriers</InputLabel>
                                <Select
                                  multiple
                                  value={assessment.barriers}
                                  onChange={(e) =>
                                    updateAdherenceAssessment(
                                      assessment.medicationId,
                                      {
                                        barriers: e.target.value as string[],
                                      }
                                    )
                                  }
                                  renderValue={(selected) => (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.5,
                                      }}
                                    >
                                      {selected.map((value) => (
                                        <Chip
                                          key={value}
                                          label={value}
                                          size="small"
                                        />
                                      ))}
                                    </Box>
                                  )}
                                >
                                  {ADHERENCE_BARRIERS.map((barrier) => (
                                    <MenuItem key={barrier} value={barrier}>
                                      <Checkbox
                                        checked={assessment.barriers.includes(
                                          barrier
                                        )}
                                      />
                                      {barrier}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </FixedGrid>
                          </FixedGrid>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Additional notes..."
                            value={assessment.notes}
                            onChange={(e) =>
                              updateAdherenceAssessment(
                                assessment.medicationId,
                                {
                                  notes: e.target.value,
                                }
                              )
                            }
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Problems found in this step */}
              {step.problems.length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Problem</TableCell>
                        <TableCell>Severity</TableCell>
                        <TableCell>Affected Medications</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {step.problems.map((problem) => (
                        <TableRow key={problem._id}>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {problem.description}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {problem.clinicalSignificance}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={problem.severity}
                              size="small"
                              color={
                                getSeverityColor(problem.severity) as
                                  | 'default'
                                  | 'primary'
                                  | 'secondary'
                                  | 'error'
                                  | 'info'
                                  | 'success'
                                  | 'warning'
                              }
                              icon={getSeverityIcon(problem.severity)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 0.5,
                              }}
                            >
                              {problem.affectedMedications.map((med) => (
                                <Chip
                                  key={med}
                                  label={med}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit Problem">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenProblemDialog(problem)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (step.id === 'adherence') {
                      completeAdherenceAssessment();
                    }
                    setActiveStep((prev) => prev + 1);
                  }}
                  sx={{ mt: 1, mr: 1 }}
                  disabled={
                    step.id === 'adherence' &&
                    adherenceAssessments.some((a) => a.adherenceScore === 0)
                  }
                >
                  {index === assessmentSteps.length - 1
                    ? 'Complete Assessment'
                    : 'Continue'}
                </Button>
                <Button
                  disabled={index === 0}
                  onClick={() => setActiveStep((prev) => prev - 1)}
                  sx={{ mt: 1, mr: 1 }}
                >
                  Back
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* All Problems Summary */}
      {allProblems.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              All Identified Problems ({allProblems.length})
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Problem</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Evidence</TableCell>
                    <TableCell>Affected Medications</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allProblems.map((problem) => (
                    <TableRow key={problem._id}>
                      <TableCell>
                        <Chip
                          label={problem.category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {problem.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {problem.clinicalSignificance}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={problem.severity}
                          size="small"
                          color={
                            getSeverityColor(problem.severity) as
                              | 'default'
                              | 'primary'
                              | 'secondary'
                              | 'error'
                              | 'info'
                              | 'success'
                              | 'warning'
                          }
                          icon={getSeverityIcon(problem.severity)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {problem.evidenceLevel}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                        >
                          {problem.affectedMedications.map((med) => (
                            <Chip
                              key={med}
                              label={med}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit Problem">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenProblemDialog(problem)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Problem Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={handleCloseProblemDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
            <MedicalServicesIcon sx={{ mr: 1 }} />
            {selectedProblem ? 'Edit Drug Therapy Problem' : 'Add New Problem'}
          </Box>
          <IconButton
            onClick={handleCloseProblemDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <form onSubmit={handleSubmit(handleSaveProblem)}>
            <FixedGrid container spacing={3}>
              {/* Category */}
              <FixedGrid item xs={12} sm={6}>
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category}>
                      <InputLabel>Category</InputLabel>
                      <Select {...field} label="Category">
                        {PROBLEM_CATEGORIES.map((category) => (
                          <MenuItem key={category.value} value={category.value}>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {category.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {category.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </FixedGrid>

              {/* Type */}
              <FixedGrid item xs={12} sm={6}>
                <Controller
                  name="type"
                  control={control}
                  rules={{ required: 'Type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.type}>
                      <InputLabel>Problem Type</InputLabel>
                      <Select {...field} label="Problem Type">
                        {watchedCategory &&
                          PROBLEM_TYPES[watchedCategory]?.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                              {type.label}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </FixedGrid>

              {/* Severity */}
              <FixedGrid item xs={12} sm={6}>
                <Controller
                  name="severity"
                  control={control}
                  rules={{ required: 'Severity is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.severity}>
                      <InputLabel>Severity</InputLabel>
                      <Select {...field} label="Severity">
                        {SEVERITY_LEVELS.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getSeverityIcon(level.value)}
                              <Box sx={{ ml: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {level.label}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {level.description}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </FixedGrid>

              {/* Evidence Level */}
              <FixedGrid item xs={12} sm={6}>
                <Controller
                  name="evidenceLevel"
                  control={control}
                  rules={{ required: 'Evidence level is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.evidenceLevel}>
                      <InputLabel>Evidence Level</InputLabel>
                      <Select {...field} label="Evidence Level">
                        {EVIDENCE_LEVELS.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {level.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {level.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </FixedGrid>

              {/* Description */}
              <FixedGrid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  rules={{
                    required: 'Description is required',
                    minLength: {
                      value: 10,
                      message: 'Description must be at least 10 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Problem Description"
                      multiline
                      rows={3}
                      fullWidth
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </FixedGrid>

              {/* Clinical Significance */}
              <FixedGrid item xs={12}>
                <Controller
                  name="clinicalSignificance"
                  control={control}
                  rules={{
                    required: 'Clinical significance is required',
                    minLength: {
                      value: 10,
                      message:
                        'Clinical significance must be at least 10 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Clinical Significance"
                      multiline
                      rows={2}
                      fullWidth
                      error={!!errors.clinicalSignificance}
                      helperText={errors.clinicalSignificance?.message}
                    />
                  )}
                />
              </FixedGrid>

              {/* Affected Medications */}
              <FixedGrid item xs={12}>
                <Controller
                  name="affectedMedications"
                  control={control}
                  rules={{
                    required: 'At least one affected medication is required',
                    validate: (value) =>
                      value.length > 0 ||
                      'At least one medication must be selected',
                  }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.affectedMedications}>
                      <InputLabel>Affected Medications</InputLabel>
                      <Select
                        {...field}
                        multiple
                        label="Affected Medications"
                        renderValue={(selected) => (
                          <Box
                            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                          >
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {medications.map((med) => (
                          <MenuItem key={med.drugName} value={med.drugName}>
                            <Checkbox
                              checked={field.value.includes(med.drugName)}
                            />
                            {med.drugName}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.affectedMedications && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.affectedMedications.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </FixedGrid>
            </FixedGrid>
          </form>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseProblemDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(handleSaveProblem)}
            variant="contained"
            disabled={isSubmitting}
            sx={{ minWidth: 120 }}
          >
            {isSubmitting
              ? 'Saving...'
              : selectedProblem
              ? 'Update Problem'
              : 'Add Problem'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TherapyAssessment;
