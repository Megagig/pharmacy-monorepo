import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    AreaChart,
    BarChart,
    PieChart,
    Line,
    Area,
    Bar,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import { useTheme, alpha } from '@mui/material';

interface ChartDataPoint {
    [key: string]: any;
}

interface SimpleChartProps {
    data: ChartDataPoint[];
    type: 'line' | 'area' | 'bar' | 'pie';
    height?: number;
    dataKey?: string;
    xAxisKey?: string;
    colors?: string[];
}

const SimpleChart: React.FC<SimpleChartProps> = ({
    data,
    type,
    height = 300,
    dataKey = 'value',
    xAxisKey = 'name',
    colors,
}) => {
    const theme = useTheme();

    const defaultColors = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
        alpha(theme.palette.primary.main, 0.7),
        alpha(theme.palette.secondary.main, 0.7),
        alpha(theme.palette.info.main, 0.7),
        alpha(theme.palette.success.main, 0.7),
    ];

    const chartColors = colors || defaultColors;

    const commonTooltipStyle = {
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
    };

    if (!data || data.length === 0) {
        return (
            <div
                style={{
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.palette.text.secondary,
                }}
            >
                No data available
            </div>
        );
    }

    const renderChart = () => {
        switch (type) {
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <YAxis
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <Tooltip contentStyle={commonTooltipStyle} />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={chartColors[0]}
                            strokeWidth={3}
                            dot={{ fill: chartColors[0], strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: chartColors[0], strokeWidth: 2 }}
                        />
                    </LineChart>
                );

            case 'area':
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <YAxis
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <Tooltip contentStyle={commonTooltipStyle} />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={chartColors[0]}
                            fill={alpha(chartColors[0], 0.3)}
                            strokeWidth={2}
                        />
                    </AreaChart>
                );

            case 'bar':
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <YAxis
                            stroke={theme.palette.text.secondary}
                            fontSize={12}
                        />
                        <Tooltip contentStyle={commonTooltipStyle} />
                        <Legend />
                        <Bar
                            dataKey={dataKey}
                            fill={chartColors[0]}
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                );

            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) => `${entry.name} ${((entry.value / data.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey={dataKey}
                        >
                            {data.map((_entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={chartColors[index % chartColors.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={commonTooltipStyle} />
                        <Legend />
                    </PieChart>
                );

            default:
                return <div>Unsupported chart type</div>;
        }
    };

    return (
        <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
        </ResponsiveContainer>
    );
};

export default SimpleChart;