import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import { DrugTherapyProblem, TherapyPlan } from '../../../types/mtr';

interface PlanDevelopmentProps {
  patientId?: string;
  problems: DrugTherapyProblem[];
  onPlanCreated: (plan: TherapyPlan) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const PlanDevelopment: React.FC<PlanDevelopmentProps> = ({
  patientId,
  problems,
  onPlanCreated,
  onNext,
  onBack,
}) => {
  const [plan, setPlan] = useState<TherapyPlan>({
    problems: problems.map(p => p._id),
    recommendations: [],
    monitoringPlan: [],
    counselingPoints: [],
    goals: [],
    timeline: '',
    pharmacistNotes: '',
  });

  const [newRecommendation, setNewRecommendation] = useState({
    type: 'adjust_dose' as const,
    medication: '',
    rationale: '',
    priority: 'medium' as const,
    expectedOutcome: '',
  });

  const [newGoal, setNewGoal] = useState({
    description: '',
    targetDate: '',
    achieved: false,
  });

  const [newMonitoring, setNewMonitoring] = useState({
    parameter: '',
    frequency: '',
    targetValue: '',
    notes: '',
  });

  const [counselingPoint, setCounselingPoint] = useState('');

  const handleAddRecommendation = () => {
    if (newRecommendation.rationale && newRecommendation.expectedOutcome) {
      setPlan(prev => ({
        ...prev,
        recommendations: [...prev.recommendations, newRecommendation],
      }));
      setNewRecommendation({
        type: 'adjust_dose',
        medication: '',
        rationale: '',
        priority: 'medium',
        expectedOutcome: '',
      });
    }
  };

  const handleAddGoal = () => {
    if (newGoal.description) {
      setPlan(prev => ({
        ...prev,
        goals: [...prev.goals, { ...newGoal, achievedDate: undefined }],
      }));
      setNewGoal({
        description: '',
        targetDate: '',
        achieved: false,
      });
    }
  };

  const handleAddMonitoring = () => {
    if (newMonitoring.parameter && newMonitoring.frequency) {
      setPlan(prev => ({
        ...prev,
        monitoringPlan: [...prev.monitoringPlan, newMonitoring],
      }));
      setNewMonitoring({
        parameter: '',
        frequency: '',
        targetValue: '',
        notes: '',
      });
    }
  };

  const handleAddCounselingPoint = () => {
    if (counselingPoint.trim()) {
      setPlan(prev => ({
        ...prev,
        counselingPoints: [...prev.counselingPoints, counselingPoint.trim()],
      }));
      setCounselingPoint('');
    }
  };

  const handleSavePlan = () => {
    onPlanCreated(plan);
    if (onNext) onNext();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Plan Development
      </Typography>

      <Grid container spacing={3}>
        {/* Problems Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Identified Problems ({problems.length})
              </Typography>
              {problems.length === 0 ? (
                <Typography color="text.secondary">
                  No problems identified
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {problems.map((problem) => (
                    <Chip
                      key={problem._id}
                      label={problem.description}
                      size="small"
                      color={getPriorityColor(problem.severity) as any}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recommendations */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Therapy Recommendations
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Rationale"
                    multiline
                    rows={2}
                    value={newRecommendation.rationale}
                    onChange={(e) => setNewRecommendation(prev => ({ 
                      ...prev, 
                      rationale: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Expected Outcome"
                    value={newRecommendation.expectedOutcome}
                    onChange={(e) => setNewRecommendation(prev => ({ 
                      ...prev, 
                      expectedOutcome: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={handleAddRecommendation}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    Add Recommendation
                  </Button>
                </Grid>
              </Grid>

              {plan.recommendations.length > 0 && (
                <List dense>
                  {plan.recommendations.map((rec, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={rec.rationale}
                        secondary={`Expected: ${rec.expectedOutcome}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Goals */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Therapy Goals
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Goal Description"
                    value={newGoal.description}
                    onChange={(e) => setNewGoal(prev => ({ 
                      ...prev, 
                      description: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Target Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal(prev => ({ 
                      ...prev, 
                      targetDate: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={handleAddGoal}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    Add Goal
                  </Button>
                </Grid>
              </Grid>

              {plan.goals.length > 0 && (
                <List dense>
                  {plan.goals.map((goal, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={goal.description}
                        secondary={goal.targetDate ? `Target: ${goal.targetDate}` : undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Monitoring Plan */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Monitoring Plan
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Parameter"
                    value={newMonitoring.parameter}
                    onChange={(e) => setNewMonitoring(prev => ({ 
                      ...prev, 
                      parameter: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Frequency"
                    value={newMonitoring.frequency}
                    onChange={(e) => setNewMonitoring(prev => ({ 
                      ...prev, 
                      frequency: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={handleAddMonitoring}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    Add Monitoring
                  </Button>
                </Grid>
              </Grid>

              {plan.monitoringPlan.length > 0 && (
                <List dense>
                  {plan.monitoringPlan.map((monitor, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={monitor.parameter}
                        secondary={`Frequency: ${monitor.frequency}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Counseling Points */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Patient Counseling Points
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Counseling Point"
                    value={counselingPoint}
                    onChange={(e) => setCounselingPoint(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    onClick={handleAddCounselingPoint}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    Add Counseling Point
                  </Button>
                </Grid>
              </Grid>

              {plan.counselingPoints.length > 0 && (
                <List dense>
                  {plan.counselingPoints.map((point, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={point} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Timeline and Notes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Timeline"
                    value={plan.timeline}
                    onChange={(e) => setPlan(prev => ({ 
                      ...prev, 
                      timeline: e.target.value 
                    }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Pharmacist Notes"
                    multiline
                    rows={3}
                    value={plan.pharmacistNotes}
                    onChange={(e) => setPlan(prev => ({ 
                      ...prev, 
                      pharmacistNotes: e.target.value 
                    }))}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        {onBack && (
          <Button onClick={onBack} variant="outlined">
            Back
          </Button>
        )}
        <Button
          onClick={handleSavePlan}
          variant="contained"
          disabled={plan.recommendations.length === 0 && plan.goals.length === 0}
          sx={{ ml: 'auto' }}
        >
          Save Plan & Continue
        </Button>
      </Box>
    </Box>
  );
};

export default PlanDevelopment;