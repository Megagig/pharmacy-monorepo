import { useState, useEffect, useCallback } from 'react';
import { dashboardService, DashboardStats, ChartDataPoint } from '../services/dashboardService';

interface DashboardData {
    stats: DashboardStats;
    patientsByMonth: ChartDataPoint[];
    medicationsByStatus: ChartDataPoint[];
    clinicalNotesByType: ChartDataPoint[];
    mtrsByStatus: ChartDataPoint[];
    patientAgeDistribution: ChartDataPoint[];
    monthlyActivity: ChartDataPoint[];
    workspaceInfo?: any;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useDashboardData = (skip: boolean = false): DashboardData => {
    const [stats, setStats] = useState<DashboardStats>({
        totalPatients: 0,
        totalClinicalNotes: 0,
        totalMedications: 0,
        totalMTRs: 0,
        totalDiagnostics: 0,
        totalAppointments: 0,
        totalFollowUps: 0,
        completedToday: 0,
        portalUsers: 0,
    });
    const [patientsByMonth, setPatientsByMonth] = useState<ChartDataPoint[]>([]);
    const [medicationsByStatus, setMedicationsByStatus] = useState<ChartDataPoint[]>([]);
    const [clinicalNotesByType, setClinicalNotesByType] = useState<ChartDataPoint[]>([]);
    const [mtrsByStatus, setMtrsByStatus] = useState<ChartDataPoint[]>([]);
    const [patientAgeDistribution, setPatientAgeDistribution] = useState<ChartDataPoint[]>([]);
    const [monthlyActivity, setMonthlyActivity] = useState<ChartDataPoint[]>([]);
    const [workspaceInfo, setWorkspaceInfo] = useState<any>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Use the optimized dashboard service
            const analytics = await dashboardService.getDashboardAnalytics();

            setStats(analytics.stats);
            setPatientsByMonth(analytics.patientsByMonth || []);
            setMedicationsByStatus(analytics.medicationsByStatus || []);
            setClinicalNotesByType(analytics.clinicalNotesByType || []);
            setMtrsByStatus(analytics.mtrsByStatus || []);
            setPatientAgeDistribution(analytics.patientAgeDistribution || []);
            setMonthlyActivity(analytics.monthlyActivity || []);
            // WorkspaceInfo might be part of analytics in the future, for now it's undefined
            setWorkspaceInfo((analytics as any).workspaceInfo);
            setLoading(false);

        } catch (error) {
            console.error('❌ Error fetching dashboard data:', error);

            // Try to get just stats as fallback
            try {
                const statsData = await dashboardService.getDashboardAnalytics();
                setStats(statsData.stats);
                setError('Some dashboard data may be incomplete');
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
            }
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        await fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        // Skip fetching if skip flag is true (e.g., for super admins)
        if (skip) {
            setLoading(false);
            return;
        }

        fetchDashboardData();
    }, [fetchDashboardData, skip]);

    return {
        stats,
        patientsByMonth,
        medicationsByStatus,
        clinicalNotesByType,
        mtrsByStatus,
        patientAgeDistribution,
        monthlyActivity,
        workspaceInfo,
        loading,
        error,
        refresh,
    };
};