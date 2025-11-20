import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Collapse,
  IconButton,
  Alert,
  Divider,
  Tooltip,
  LinearProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import ViewIcon from '@mui/icons-material/Visibility';

interface LabTestResult {
  testName: string;
  value: number | string;
  unit: string;
  referenceRange: {
    min?: number;
    max?: number;
    normal?: string;
  };
  status: 'normal' | 'high' | 'low' | 'critical';
  flag?: string;
}

interface LabResult {
  _id: string;
  patientId: string;
  testDate: string;
  testType?: string;
  orderingPhysician?: string;
  pharmacistName?: string;
  labName?: string;
  status: 'pending' | 'completed' | 'reviewed' | string;
  results?: LabTestResult[]; // Optional array form
  // Optional single-result shape from backend
  testName?: string;
  testValue?: number | string;
  unit?: string;
  referenceRange?: { min?: number; max?: number; normal?: string };
  interpretation?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
  patientInterpretation?: {
    summary: string;
    keyFindings: string[];
    whatThisMeans: string;
    recommendations: string[];
    whenToSeekCare: string;
    visibleToPatient: boolean;
    interpretedBy?: {
      firstName: string;
      lastName: string;
      professionalTitle?: string;
    };
    interpretedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface LabResultCardProps {
  result: LabResult;
  onDownload?: (attachmentUrl: string, filename: string) => void;
  onView?: (resultId: string) => void;
}

const LabResultCard: React.FC<LabResultCardProps> = ({
  result,
  onDownload,
  onView
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'success';
      case 'high':
      case 'low':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircleIcon fontSize="small" />;
      case 'high':
      case 'low':
        return <WarningIcon fontSize="small" />;
      case 'critical':
        return <ErrorIcon fontSize="small" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  const getResultStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'reviewed':
        return 'primary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculatePercentageInRange = (value: number, min?: number, max?: number) => {
    if (min === undefined || max === undefined) return null;

    const range = max - min;
    const position = value - min;
    return Math.max(0, Math.min(100, (position / range) * 100));
  };

  const formatValue = (value: number | string, unit: string) => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)} ${unit}`;
    }
    return `${value} ${unit}`;
  };

  const normalizedResults: LabTestResult[] = Array.isArray(result.results)
    ? result.results
    : (result.testName
        ? [{
            testName: result.testName,
            value: (result as any).testValue ?? '',
            unit: (result as any).unit ?? '',
            referenceRange: (result as any).referenceRange ?? {},
            status: 'normal'
          }]
        : []);

  const getAbnormalResultsCount = () => {
    return normalizedResults.filter(r => r.status !== 'normal').length;
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {result.testType}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {new Date(result.testDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Typography>

              <Chip
                label={result.status}
                size="small"
                color={getResultStatusColor(result.status) as any}
                variant="outlined"
              />

              {getAbnormalResultsCount() > 0 && (
                <Chip
                  label={`${getAbnormalResultsCount()} abnormal`}
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<WarningIcon />}
                />
              )}
            </Box>

            {result.labName && (
              <Typography variant="body2" color="text.secondary">
                Lab: {result.labName}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {result.attachments && result.attachments.length > 0 && (
              <Tooltip title="Download lab report">
                <IconButton
                  size="small"
                  onClick={() => onDownload?.(result.attachments![0].url, result.attachments![0].filename)}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="View detailed results">
              <IconButton size="small" onClick={() => onView?.(result._id)}>
                <ViewIcon />
              </IconButton>
            </Tooltip>

            <IconButton
              onClick={handleExpandClick}
              aria-expanded={expanded}
              aria-label="show more"
              size="small"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Patient-Friendly Interpretation (Prominent Display) */}
        {result.patientInterpretation && result.patientInterpretation.visibleToPatient && (
          <Alert
            severity="info"
            icon={<InfoIcon />}
            sx={{
              mb: 2,
              bgcolor: 'info.50',
              border: 2,
              borderColor: 'info.main',
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ color: 'info.main', fontWeight: 'bold' }}>
              📋 Your Pharmacist's Interpretation
            </Typography>

            <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
              {result.patientInterpretation.summary}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
              🔍 Key Findings:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 1.5, pl: 3 }}>
              {result.patientInterpretation.keyFindings.map((finding, index) => (
                <li key={index}>
                  <Typography variant="body2">{finding}</Typography>
                </li>
              ))}
            </Box>

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              💡 What This Means for You:
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
              {result.patientInterpretation.whatThisMeans}
            </Typography>

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              ✅ Recommendations:
            </Typography>
            <Box component="ul" sx={{ mt: 0.5, mb: 1.5, pl: 3 }}>
              {result.patientInterpretation.recommendations.map((rec, index) => (
                <li key={index}>
                  <Typography variant="body2">{rec}</Typography>
                </li>
              ))}
            </Box>

            {result.patientInterpretation.whenToSeekCare && (
              <>
                <Alert severity="warning" sx={{ mt: 2, mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    ⚠️ When to Seek Care:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {result.patientInterpretation.whenToSeekCare}
                  </Typography>
                </Alert>
              </>
            )}

            {result.patientInterpretation.interpretedBy && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Interpreted by:{' '}
                  <strong>
                    {result.patientInterpretation.interpretedBy.professionalTitle}{' '}
                    {result.patientInterpretation.interpretedBy.firstName}{' '}
                    {result.patientInterpretation.interpretedBy.lastName}
                  </strong>
                  {' on '}
                  {new Date(result.patientInterpretation.interpretedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        {/* Quick Summary */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
          {normalizedResults.slice(0, 3).map((test, index) => (
            <Box key={index} sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'grey.50',
              border: test.status !== 'normal' ? 2 : 1,
              borderColor: test.status !== 'normal' ? `${getStatusColor(test.status)}.main` : 'grey.200'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {getStatusIcon(test.status)}
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {test.testName}
                </Typography>
              </Box>

              <Typography variant="h6" color={test.status !== 'normal' ? `${getStatusColor(test.status)}.main` : 'text.primary'}>
                {formatValue(test.value, test.unit)}
              </Typography>

              {test.referenceRange.min !== undefined && test.referenceRange.max !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  Normal: {test.referenceRange.min}-{test.referenceRange.max} {test.unit}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {normalizedResults.length > 3 && !expanded && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            +{result.results.length - 3} more results. Click to expand.
          </Typography>
        )}

        {/* Expanded Content */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 2 }} />

          {/* All Results */}
          <Typography variant="subtitle1" gutterBottom>
            Detailed Results
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mb: 3 }}>
            {normalizedResults.map((test, index) => (
              <Card variant="outlined" key={index}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {test.testName}
                    </Typography>

                    <Chip
                      label={test.status}
                      size="small"
                      color={getStatusColor(test.status) as any}
                      variant="outlined"
                      icon={getStatusIcon(test.status)}
                    />
                  </Box>

                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {formatValue(test.value, test.unit)}
                  </Typography>

                  {/* Reference Range Visualization */}
                  {test.referenceRange.min !== undefined && test.referenceRange.max !== undefined && typeof test.value === 'number' && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Reference Range: {test.referenceRange.min}-{test.referenceRange.max} {test.unit}
                      </Typography>

                      <Box sx={{ position: 'relative', mt: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={100}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: 'success.light'
                            }
                          }}
                        />

                        {/* Value indicator */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -2,
                            left: `${calculatePercentageInRange(test.value, test.referenceRange.min, test.referenceRange.max) || 50}%`,
                            transform: 'translateX(-50%)',
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: test.status === 'normal' ? 'success.main' : getStatusColor(test.status) + '.main',
                            border: 2,
                            borderColor: 'white',
                            boxShadow: 1
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  {test.referenceRange.normal && (
                    <Typography variant="caption" color="text.secondary">
                      Normal: {test.referenceRange.normal}
                    </Typography>
                  )}

                  {test.flag && (
                    <Alert severity={getStatusColor(test.status) as any} sx={{ mt: 1 }}>
                      <Typography variant="caption">
                        {test.flag}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Pharmacist Interpretation */}
          {result.interpretation && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Pharmacist Interpretation
              </Typography>
              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2">
                  {result.interpretation}
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Recommendations */}
          {result.recommendations && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Recommendations
              </Typography>
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2">
                  {result.recommendations}
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Follow-up Required */}
          {result.followUpRequired && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                Follow-up Required
              </Typography>
              <Typography variant="body2">
                Please schedule a follow-up appointment to discuss these results with your pharmacist.
              </Typography>
            </Alert>
          )}

          {/* Provider Information */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box>
              {result.pharmacistName && (
                <Typography variant="body2" color="text.secondary">
                  Reviewed by: <strong>{result.pharmacistName}</strong>
                </Typography>
              )}
              {result.orderingPhysician && (
                <Typography variant="body2" color="text.secondary">
                  Ordered by: {result.orderingPhysician}
                </Typography>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date(result.updatedAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default LabResultCard;