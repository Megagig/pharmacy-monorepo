import { Box, Typography, useTheme } from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface AdherenceTrend {
  name: string;
  adherence: number;
}

interface MedicationChartProps {
  data: AdherenceTrend[];
}

const MedicationChart = ({ data }: MedicationChartProps) => {
  const theme = useTheme();

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      name: string;
      dataKey: string;
    }>;
    label?: string;
  }

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            p: 1.5,
            boxShadow: theme.shadows[2],
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle2">{label}</Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.primary.main,
              fontWeight: 'medium',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Adherence: {payload[0].value}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  // If no data, show a message
  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Data Available
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          There is no adherence data available for the selected time period.
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 20,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis
          dataKey="name"
          tick={{ fill: theme.palette.text.secondary }}
          tickMargin={10}
          angle={-15}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Line
          type="monotone"
          dataKey="adherence"
          name="Medication Adherence"
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 1, fill: theme.palette.background.paper }}
          activeDot={{
            r: 6,
            stroke: theme.palette.primary.main,
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MedicationChart;
