import { useState, useEffect, useCallback } from 'react';
import { roleBasedDashboardService, SuperAdminClinicalInterventions } from '../services/roleBasedDashboardService';

interface UseSuperAdminClinicalInterventionsReturn {
    data: SuperAdminClinicalInterventions | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useSuperAdminClinicalInterventions = (): UseSuperAdminClinicalInterventionsReturn => {
    const [data, setData] = useState<SuperAdminClinicalInterventions | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const interventionsData = await roleBasedDashboardService.getClinicalInterventionsSystemWide();
            setData(interventionsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch clinical interventions data');
            console.error('Error fetching clinical interventions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

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
