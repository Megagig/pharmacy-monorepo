import { useState, useEffect } from 'react';
import { activityService, SystemActivity, UserActivity } from '../services/activityService';

interface UseRecentActivitiesReturn {
    systemActivities: SystemActivity[];
    userActivities: UserActivity[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export const useRecentActivities = (limit: number = 10, skip: boolean = false): UseRecentActivitiesReturn => {
    const [systemActivities, setSystemActivities] = useState<SystemActivity[]>([]);
    const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await activityService.getRecentActivities(limit);

            setSystemActivities(data.systemActivities);
            setUserActivities(data.userActivities);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch activities');
            console.error('Error fetching activities:', err);
        } finally {
            setLoading(false);
        }
    };

    const refresh = async () => {
        await fetchActivities();
    };

    useEffect(() => {
        // Skip fetching if skip flag is true (e.g., for super admins)
        if (skip) {
            setLoading(false);
            return;
        }

        fetchActivities();
    }, [limit, skip]);

    return {
        systemActivities,
        userActivities,
        loading,
        error,
        refresh
    };
};