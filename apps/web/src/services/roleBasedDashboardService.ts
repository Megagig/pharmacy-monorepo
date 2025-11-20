import { apiClient } from './apiClient';

export interface DashboardData {
    stats: any;
    workspace: any;
    charts: any;
    activities: any[];
}

export interface SuperAdminDashboardData {
    systemStats: {
        totalPatients: number;
        totalClinicalNotes: number;
        totalMedications: number;
        totalMTRs: number;
        totalWorkspaces: number;
        totalUsers: number;
        activeSubscriptions: number;
    };
    workspaces: Array<{
        _id: string;
        name: string;
        ownerId: any;
        subscriptionStatus: string;
        createdAt: string;
        metrics: {
            patients: number;
            users: number;
            mtrs: number;
        };
    }>;
    userActivity: {
        usersByRole: Array<{ _id: string; count: number }>;
        activeUsers: number;
        newUsers: number;
        usersByWorkplaceRole: Array<{ _id: string; count: number }>;
    };
    subscriptions: {
        subscriptionsByStatus: Array<{ _id: string; count: number }>;
        subscriptionsByTier: Array<{ _id: string; count: number }>;
        monthlyRevenue: number;
        totalRevenue: number;
    };
    trends: {
        patientsTrend: Array<{ _id: { year: number; month: number }; count: number }>;
        usersTrend: Array<{ _id: { year: number; month: number }; count: number }>;
        clinicalNotesByType: Array<{ _id: string; count: number }>;
        mtrsByStatus: Array<{ _id: string; count: number }>;
    };
}

export interface WorkspaceDetails {
    workspace: any;
    stats: any;
    users: any[];
    activities: any[];
}

// New interfaces for Phase 2 enhancements
export interface SuperAdminClinicalInterventions {
    totalInterventions: number;
    activeInterventions: number;
    completedInterventions: number;
    successRate: number;
    costSavings: number;
    byWorkspace: Array<{
        workspaceId: string;
        workspaceName: string;
        total: number;
        active: number;
        completed: number;
    }>;
}

export interface SystemActivity {
    type: string;
    description: string;
    timestamp: Date | string;
    workspaceId?: string;
    workspaceName?: string;
}

export interface UserActivity {
    userId: string;
    userName: string;
    email: string;
    action: string;
    role: string;
    timestamp: Date | string;
    workspaceId?: string;
    workspaceName?: string;
}

export interface SuperAdminActivities {
    systemActivities: SystemActivity[];
    userActivities: UserActivity[];
}

export interface SuperAdminCommunications {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    recentMessages: number;
    unreadMessages: number;
    avgResponseTime: number;
    byWorkspace: Array<{
        workspaceId: string;
        workspaceName: string;
        conversations: number;
        activeConversations: number;
    }>;
}

export type UserRole =
    | 'pharmacist'
    | 'pharmacy_team'
    | 'pharmacy_outlet'
    | 'intern_pharmacist'
    | 'super_admin'
    | 'owner';

export type WorkplaceRole =
    | 'Owner'
    | 'Staff'
    | 'Pharmacist'
    | 'Cashier'
    | 'Technician'
    | 'Assistant';

class RoleBasedDashboardService {
    // Note: apiClient already has baseURL set to '/api', so we don't add it here
    // All paths should be relative to /api (e.g., '/super-admin/...' not '/api/super-admin/...')

    /**
     * Get dashboard data based on user role
     * Automatically routes to appropriate endpoints based on user permissions
     */
    async getDashboardData(userRole: UserRole, workplaceRole?: WorkplaceRole): Promise<DashboardData | SuperAdminDashboardData> {
        try {

            // Super admin gets system-wide dashboard
            if (userRole === 'super_admin') {
                return await this.getSuperAdminDashboard();
            }

            // All other roles get workspace-specific dashboard
            return await this.getWorkspaceDashboard();

        } catch (error) {
            console.error('❌ Error fetching role-based dashboard data:', error);
            throw error;
        }
    }

    /**
     * Get super admin system-wide dashboard
     */
    async getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
        try {
            const url = '/super-admin/dashboard/overview';

            const response = await apiClient.get(url);

            if (!response.data?.success) {
                console.error('❌ API returned unsuccessful response:', response.data);
                throw new Error(response.data?.message || 'Failed to fetch super admin dashboard');
            }

            if (!response.data?.data) {
                console.error('❌ API response missing data field');
                throw new Error('Invalid API response structure');
            }


            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching super admin dashboard:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText
            });

            // Return default data structure for super admin if API fails
            console.warn('⚠️ Returning default super admin data due to error');
            return this.getDefaultSuperAdminData();
        }
    }

    /**
     * Get workspace-specific dashboard (for owners, staff, etc.)
     */
    async getWorkspaceDashboard(): Promise<DashboardData> {
        try {

            const response = await apiClient.get('/dashboard/overview');

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to fetch workspace dashboard');
            }

            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching workspace dashboard:', error);

            // Return default data structure for workspace if API fails
            return this.getDefaultWorkspaceData();
        }
    }

    /**
     * Get detailed information for a specific workspace (super admin only)
     */
    async getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetails> {
        try {

            const response = await apiClient.get(`/super-admin/dashboard/workspace/${workspaceId}`);

            if (!response.data?.success) {
                throw new Error(response.data?.message || 'Failed to fetch workspace details');
            }

            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching workspace details:', error);
            throw error;
        }
    }

    /**
     * Check if user has super admin privileges
     * NOTE: Pass user role from AuthContext since user data is stored in React state, not localStorage
     */
    isSuperAdmin(userRole?: UserRole): boolean {
        // If userRole provided, use it; otherwise try to get from stored user data (fallback)
        const role = userRole || this.getCurrentUserRole();

        return role === 'super_admin';
    }

    /**
     * Get current user role from localStorage (fallback method)
     * NOTE: This is a fallback - prefer passing userRole from AuthContext
     */
    private getCurrentUserRole(): UserRole | null {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                return user.role || null;
            }
            return null;
        } catch (error) {
            console.error('Error getting user role:', error);
            return null;
        }
    }

    /**
     * Check if user is workspace owner
     */
    isWorkspaceOwner(userRole: UserRole, workplaceRole?: WorkplaceRole): boolean {
        return userRole === 'owner' || workplaceRole === 'Owner';
    }

    /**
     * Check if user can view system-wide metrics
     */
    canViewSystemMetrics(userRole: UserRole): boolean {
        return this.isSuperAdmin(userRole);
    }

    /**
     * Check if user can drill down into other workspaces
     */
    canViewOtherWorkspaces(userRole: UserRole): boolean {
        return this.isSuperAdmin(userRole);
    }

    /**
     * Get user's dashboard access level
     */
    getUserDashboardLevel(userRole: UserRole, workplaceRole?: WorkplaceRole): 'system' | 'workspace' | 'limited' {
        if (this.isSuperAdmin(userRole)) {
            return 'system';
        }

        if (this.isWorkspaceOwner(userRole, workplaceRole)) {
            return 'workspace';
        }

        return 'limited';
    }

    /**
     * Get available dashboard views for user
     */
    getAvailableDashboardViews(userRole: UserRole): string[] {
        const views = ['workspace']; // Everyone gets workspace view

        if (this.isSuperAdmin(userRole)) {
            views.unshift('system'); // Super admin gets system view as primary
            views.push('workspace-selector'); // Can switch between workspaces
        }

        return views;
    }

    /**
     * Get dashboard title based on role and view
     */
    getDashboardTitle(userRole: UserRole, workplaceRole?: WorkplaceRole, currentView?: string): string {
        if (currentView === 'system' && this.isSuperAdmin(userRole)) {
            return 'System Overview';
        }

        if (this.isWorkspaceOwner(userRole, workplaceRole)) {
            return 'Workspace Dashboard';
        }

        return 'Dashboard';
    }

    /**
     * Default super admin data when API fails
     */
    private getDefaultSuperAdminData(): SuperAdminDashboardData {
        return {
            systemStats: {
                totalPatients: 0,
                totalClinicalNotes: 0,
                totalMedications: 0,
                totalMTRs: 0,
                totalWorkspaces: 0,
                totalUsers: 0,
                activeSubscriptions: 0
            },
            workspaces: [],
            userActivity: {
                usersByRole: [],
                activeUsers: 0,
                newUsers: 0,
                usersByWorkplaceRole: []
            },
            subscriptions: {
                subscriptionsByStatus: [],
                subscriptionsByTier: [],
                monthlyRevenue: 0,
                totalRevenue: 0
            },
            trends: {
                patientsTrend: [],
                usersTrend: [],
                clinicalNotesByType: [],
                mtrsByStatus: []
            }
        };
    }

    /**
     * Default workspace data when API fails
     */
    private getDefaultWorkspaceData(): DashboardData {
        return {
            stats: {
                totalPatients: 0,
                totalClinicalNotes: 0,
                totalMedications: 0,
                totalMTRs: 0,
                totalDiagnostics: 0
            },
            workspace: null,
            charts: {
                patientsOverTime: [],
                notesOverTime: []
            },
            activities: []
        };
    }

    /**
     * Format large numbers with appropriate suffixes
     */
    formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }    /**
     * Calculate percentage change
     */
    calculatePercentageChange(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    /**
     * Get status color based on metric type and value
     */
    getMetricStatus(metricType: string, value: number): 'success' | 'warning' | 'error' | 'info' {
        switch (metricType) {
            case 'growth':
                return value > 0 ? 'success' : value < -10 ? 'error' : 'warning';
            case 'utilization':
                return value > 80 ? 'warning' : value > 95 ? 'error' : 'success';
            case 'completion':
                return value > 90 ? 'success' : value > 70 ? 'warning' : 'error';
            default:
                return 'info';
        }
    }

    /**
     * Get available workspaces for super admin to switch to
     */
    async getAvailableWorkspaces(): Promise<any[]> {
        try {
            const response = await apiClient.get('/super-admin/dashboard/workspaces');
            return response.data.workspaces || [];
        } catch (error) {
            console.error('Error fetching available workspaces:', error);
            return [];
        }
    }

    /**
     * Get system-wide clinical interventions metrics (Phase 2)
     * Aggregated across all workspaces
     */
    async getClinicalInterventionsSystemWide(): Promise<SuperAdminClinicalInterventions> {
        try {

            const response = await apiClient.get('/super-admin/dashboard/clinical-interventions');

            if (!response.data?.success) {
                console.error('❌ API returned unsuccessful response:', response.data);
                throw new Error(response.data?.message || 'Failed to fetch clinical interventions data');
            }

            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching clinical interventions data:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            // Return default data structure if API fails
            console.warn('⚠️ Returning default clinical interventions data due to error');
            return this.getDefaultClinicalInterventionsData();
        }
    }

    /**
     * Get system-wide recent activities (Phase 2)
     * Activities from all workspaces
     */
    async getActivitiesSystemWide(limit: number = 20): Promise<SuperAdminActivities> {
        try {

            const response = await apiClient.get('/super-admin/dashboard/activities', {
                params: { limit }
            });

            if (!response.data?.success) {
                console.error('❌ API returned unsuccessful response:', response.data);
                throw new Error(response.data?.message || 'Failed to fetch activities data');
            }

            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching activities data:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            // Return default data structure if API fails
            console.warn('⚠️ Returning default activities data due to error');
            return this.getDefaultActivitiesData();
        }
    }

    /**
     * Get system-wide communication metrics (Phase 2)
     * Aggregated across all workspaces
     */
    async getCommunicationsSystemWide(): Promise<SuperAdminCommunications> {
        try {

            const response = await apiClient.get('/super-admin/dashboard/communications');

            if (!response.data?.success) {
                console.error('❌ API returned unsuccessful response:', response.data);
                throw new Error(response.data?.message || 'Failed to fetch communications data');
            }

            return response.data.data;

        } catch (error: any) {
            console.error('❌ Error fetching communications data:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            // Return default data structure if API fails
            console.warn('⚠️ Returning default communications data due to error');
            return this.getDefaultCommunicationsData();
        }
    }

    /**
     * Default clinical interventions data when API fails
     */
    private getDefaultClinicalInterventionsData(): SuperAdminClinicalInterventions {
        return {
            totalInterventions: 0,
            activeInterventions: 0,
            completedInterventions: 0,
            successRate: 0,
            costSavings: 0,
            byWorkspace: []
        };
    }

    /**
     * Default activities data when API fails
     */
    private getDefaultActivitiesData(): SuperAdminActivities {
        return {
            systemActivities: [],
            userActivities: []
        };
    }

    /**
     * Default communications data when API fails
     */
    private getDefaultCommunicationsData(): SuperAdminCommunications {
        return {
            totalConversations: 0,
            activeConversations: 0,
            totalMessages: 0,
            recentMessages: 0,
            unreadMessages: 0,
            avgResponseTime: 0,
            byWorkspace: []
        };
    }
}

export const roleBasedDashboardService = new RoleBasedDashboardService();
export default roleBasedDashboardService;