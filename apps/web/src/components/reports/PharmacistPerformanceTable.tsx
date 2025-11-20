import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
  Box,
  Avatar,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import type { PharmacistPerformanceReport } from '../../types/mtr';

interface PharmacistPerformanceTableProps {
  data: PharmacistPerformanceReport;
  loading?: boolean;
}

type SortField =
  | 'qualityScore'
  | 'completionRate'
  | 'totalReviews'
  | 'interventionAcceptanceRate';
type SortDirection = 'asc' | 'desc';

const PharmacistPerformanceTable: React.FC<PharmacistPerformanceTableProps> = ({
  data,
  loading = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('qualityScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pharmacist Performance
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data.pharmacistPerformance].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (sortDirection === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'warning';
    if (score >= 60) return 'info';
    return 'error';
  };

  const getPerformanceIcon = (score: number, avgScore: number) => {
    if (score > avgScore) {
      return <TrendingUpIcon color="success" fontSize="small" />;
    } else if (score < avgScore) {
      return <TrendingDownIcon color="error" fontSize="small" />;
    }
    return null;
  };

  const renderQualityScoreBar = (score: number) => (
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress
          variant="determinate"
          value={score}
          color={getPerformanceColor(score)}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      <Typography variant="body2" color="textSecondary">
        {score.toFixed(0)}
      </Typography>
    </Box>
  );

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6">Pharmacist Performance Rankings</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Total Pharmacists: {data.summary.totalPharmacists}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Avg Quality Score: {data.summary.avgQualityScore.toFixed(1)}
            </Typography>
          </Box>
        </Box>

        {/* Top Performer Highlight */}
        {data.summary.topPerformer && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              bgcolor: 'success.light',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <StarIcon color="warning" />
            <Typography variant="subtitle1" color="success.contrastText">
              Top Performer: {data.summary.topPerformer.pharmacistName}
            </Typography>
            <Chip
              label={`Quality Score: ${
                data.summary.topPerformer.qualityScore?.toFixed(1) || 'N/A'
              }`}
              color="warning"
              size="small"
            />
          </Box>
        )}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Pharmacist</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'qualityScore'}
                    direction={
                      sortField === 'qualityScore' ? sortDirection : 'desc'
                    }
                    onClick={() => handleSort('qualityScore')}
                  >
                    Quality Score
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'totalReviews'}
                    direction={
                      sortField === 'totalReviews' ? sortDirection : 'desc'
                    }
                    onClick={() => handleSort('totalReviews')}
                  >
                    Reviews
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'completionRate'}
                    direction={
                      sortField === 'completionRate' ? sortDirection : 'desc'
                    }
                    onClick={() => handleSort('completionRate')}
                  >
                    Completion Rate
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'interventionAcceptanceRate'}
                    direction={
                      sortField === 'interventionAcceptanceRate'
                        ? sortDirection
                        : 'desc'
                    }
                    onClick={() => handleSort('interventionAcceptanceRate')}
                  >
                    Intervention Rate
                  </TableSortLabel>
                </TableCell>
                <TableCell>Efficiency</TableCell>
                <TableCell>Problems Resolved</TableCell>
                <TableCell>Cost Savings</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.map((pharmacist, index) => (
                <TableRow
                  key={pharmacist._id}
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    ...(index === 0 && { bgcolor: 'success.light' }),
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {index + 1}
                      {index === 0 && (
                        <StarIcon color="warning" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{ width: 32, height: 32, fontSize: '0.875rem' }}
                      >
                        {pharmacist.pharmacistName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {pharmacist.pharmacistName}
                      </Typography>
                      {getPerformanceIcon(
                        pharmacist.qualityScore,
                        data.summary.avgQualityScore
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    {renderQualityScoreBar(pharmacist.qualityScore)}
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {pharmacist.totalReviews}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ({pharmacist.completedReviews} completed)
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={`${pharmacist.completionRate.toFixed(1)}%`}
                      color={getPerformanceColor(pharmacist.completionRate)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {pharmacist.interventionAcceptanceRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ({pharmacist.acceptedInterventions}/
                        {pharmacist.totalInterventions})
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Tooltip
                      title={`Avg completion time: ${
                        pharmacist.avgCompletionTime?.toFixed(1) || 0
                      } days`}
                    >
                      <Chip
                        label={`${pharmacist.efficiencyScore?.toFixed(0) || 0}`}
                        color={getPerformanceColor(
                          pharmacist.efficiencyScore || 0
                        )}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>

                  <TableCell>
                    <Box>
                      <Typography variant="body2" color="success.main">
                        {pharmacist.totalProblemsResolved}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Rate: {pharmacist.problemResolutionRate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="primary.main">
                      ${pharmacist.totalCostSavings?.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Performance Legend */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="textSecondary">
            Quality Score Legend:
          </Typography>
          <Chip label="Excellent (90+)" color="success" size="small" />
          <Chip label="Good (75-89)" color="warning" size="small" />
          <Chip label="Fair (60-74)" color="info" size="small" />
          <Chip label="Needs Improvement (<60)" color="error" size="small" />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PharmacistPerformanceTable;
