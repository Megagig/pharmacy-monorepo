import { useState, useEffect, useCallback } from 'react';
import { roleBasedDashboardService, SuperAdminActivities } from '../services/roleBasedDashboardService';

interface UseSuperAdminActivitiesReturn {
    data: SuperAdminActivities | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useSuperAdminActivities = (limit: number = 20): UseSuperAdminActivitiesReturn => {
    const [data, setData] = useState<SuperAdminActivities | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const activitiesData = await roleBasedDashboardService.getActivitiesSystemWide(limit);
            setData(activitiesData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activities data');
            console.error('Error fetching activities:', err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    const refresh = useCallback(async () => {
        await fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        loading,
        error,
        refresh
    };
};
