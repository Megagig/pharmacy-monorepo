import { useState, useEffect, useCallback } from 'react';
import { roleBasedDashboardService, SuperAdminCommunications } from '../services/roleBasedDashboardService';

interface UseSuperAdminCommunicationsReturn {
    data: SuperAdminCommunications | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useSuperAdminCommunications = (): UseSuperAdminCommunicationsReturn => {
    const [data, setData] = useState<SuperAdminCommunications | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const communicationsData = await roleBasedDashboardService.getCommunicationsSystemWide();
            setData(communicationsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch communications data');
            console.error('Error fetching communications:', err);
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
