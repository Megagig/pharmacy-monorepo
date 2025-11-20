import { useState, useEffect } from 'react';
import { dashboardService, ChartDataPoint } from '../services/dashboardService';

interface DashboardChartsData {
    clinicalNotesByType: ChartDataPoint[];
    mtrsByStatus: ChartDataPoint[];
    patientsByMonth: ChartDataPoint[];
    medicationsByStatus: ChartDataPoint[];
    patientAgeDistribution: ChartDataPoint[];
    monthlyActivity: ChartDataPoint[];
    loading: boolean;
    error: string | null;
}

export const useDashboardCharts = (skip: boolean = false) => {
    const [data, setData] = useState<DashboardChartsData>({
        clinicalNotesByType: [],
        mtrsByStatus: [],
        patientsByMonth: [],
        medicationsByStatus: [],
        patientAgeDistribution: [],
        monthlyActivity: [],
        loading: true,
        error: null,
    });

    const [refreshKey, setRefreshKey] = useState(0);

    const fetchChartData = async () => {
        try {
            setData(prev => ({ ...prev, loading: true, error: null }));

            const analytics = await dashboardService.getDashboardAnalytics();

            setData({
                clinicalNotesByType: analytics.clinicalNotesByType,
                mtrsByStatus: analytics.mtrsByStatus,
                patientsByMonth: analytics.patientsByMonth,
                medicationsByStatus: analytics.medicationsByStatus,
                patientAgeDistribution: analytics.patientAgeDistribution,
                monthlyActivity: analytics.monthlyActivity,
                loading: false,
                error: null,
            });

        } catch (error) {
            console.error('Error fetching chart data:', error);
            setData(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to load chart data',
            }));
        }
    };

    const refresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    useEffect(() => {
        // Skip fetching if skip flag is true (e.g., for super admins)
        if (skip) {
            setData(prev => ({ ...prev, loading: false }));
            return;
        }

        fetchChartData();
    }, [refreshKey, skip]);

    return {
        ...data,
        refresh,
    };
};

export default useDashboardCharts;