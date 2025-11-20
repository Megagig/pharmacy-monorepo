import { api } from '../lib/api';

export interface SystemActivity {
    id: string;
    type: 'patient_registration' | 'clinical_note' | 'medication_update' | 'mtr_session' | 'system_alert';
    title: string;
    description: string;
    userId?: string;
    userName?: string;
    patientId?: string;
    patientName?: string;
    createdAt: string;
    metadata?: Record<string, any>;
}

export interface UserActivity {
    id: string;
    type: 'login' | 'report_generated' | 'settings_updated' | 'security_change' | 'task_completed';
    title: string;
    description: string;
    userId: string;
    userName: string;
    createdAt: string;
    metadata?: Record<string, any>;
}

export interface ActivitiesResponse {
    systemActivities: SystemActivity[];
    userActivities: UserActivity[];
    total: number;
}

class ActivityService {
    async getRecentActivities(limit: number = 10): Promise<ActivitiesResponse> {
        try {
            // Fetch recent activities from multiple endpoints and combine them
            const [patientsResponse, notesResponse, medicationsResponse, mtrsResponse] = await Promise.allSettled([
                api.get('/patients', { params: { limit: 5, sort: '-createdAt' } }),
                api.get('/notes', { params: { limit: 5, sort: '-createdAt' } }),
                api.get('/medication-management/dashboard/recent-patients', {}),
                api.get('/mtr', { params: { page: 1, limit: 5, sort: '-createdAt' } }),
            ]);

            const systemActivities: SystemActivity[] = [];
            const userActivities: UserActivity[] = [];

            // Process patient registrations
            if (patientsResponse.status === 'fulfilled' && patientsResponse.value?.data) {
                const patientsArray = this.extractArrayFromResponse(patientsResponse.value.data);
                patientsArray.forEach((patient: any) => {
                    systemActivities.push({
                        id: `patient-${patient._id}`,
                        type: 'patient_registration',
                        title: 'New Patient Registration',
                        description: `${patient.firstName} ${patient.lastName} registered`,
                        patientId: patient._id,
                        patientName: `${patient.firstName} ${patient.lastName}`,
                        userId: patient.createdBy?._id,
                        userName: patient.createdBy ? `${patient.createdBy.firstName} ${patient.createdBy.lastName}` : 'System',
                        createdAt: patient.createdAt,
                        metadata: { patientAge: patient.age, gender: patient.gender }
                    });
                });
            }

            // Process clinical notes
            if (notesResponse.status === 'fulfilled' && notesResponse.value?.data) {
                const notesArray = this.extractArrayFromResponse(notesResponse.value.data);
                notesArray.forEach((note: any) => {
                    systemActivities.push({
                        id: `note-${note._id}`,
                        type: 'clinical_note',
                        title: 'Clinical Note Added',
                        description: `${note.type || 'Clinical'} note created for patient`,
                        patientId: note.patientId?._id,
                        patientName: note.patientId ? `${note.patientId.firstName} ${note.patientId.lastName}` : 'Unknown Patient',
                        userId: note.createdBy?._id,
                        userName: note.createdBy ? `${note.createdBy.firstName} ${note.createdBy.lastName}` : 'System',
                        createdAt: note.createdAt,
                        metadata: { noteType: note.type, category: note.category }
                    });
                });
            }

            // Process medication updates
            if (medicationsResponse.status === 'fulfilled' && medicationsResponse.value?.data) {
                const medicationsArray = this.extractArrayFromResponse(medicationsResponse.value.data, 'medications');
                medicationsArray.forEach((medication: any, index: number) => {
                    // Ensure we have a valid ID to prevent duplicate keys
                    const medicationId = medication._id || medication.id || `temp-${Date.now()}-${index}`;
                    systemActivities.push({
                        id: `medication-${medicationId}`,
                        type: 'medication_update',
                        title: 'Medication Update',
                        description: `${medication.name || 'Unknown Medication'} ${medication.status === 'active' ? 'prescribed' : medication.status || 'status unknown'}`,
                        patientId: medication.patientId?._id,
                        patientName: medication.patientId ? `${medication.patientId.firstName} ${medication.patientId.lastName}` : 'Unknown Patient',
                        userId: medication.prescribedBy?._id,
                        userName: medication.prescribedBy ? `${medication.prescribedBy.firstName} ${medication.prescribedBy.lastName}` : 'System',
                        createdAt: medication.updatedAt || medication.createdAt || new Date().toISOString(),
                        metadata: { medicationName: medication.name || 'Unknown', dosage: medication.dosage, status: medication.status }
                    });
                });
            }

            // Process MTR sessions
            if (mtrsResponse.status === 'fulfilled' && mtrsResponse.value?.data) {
                const mtrsArray = this.extractArrayFromResponse(mtrsResponse.value.data);
                mtrsArray.forEach((mtr: unknown) => {
                    systemActivities.push({
                        id: `mtr-${mtr._id}`,
                        type: 'mtr_session',
                        title: 'MTR Session Completed',
                        description: `Medication therapy review ${mtr.status === 'completed' ? 'completed' : 'scheduled'}`,
                        patientId: mtr.patientId?._id,
                        patientName: mtr.patientId ? `${mtr.patientId.firstName} ${mtr.patientId.lastName}` : 'Unknown Patient',
                        userId: mtr.pharmacistId?._id,
                        userName: mtr.pharmacistId ? `${mtr.pharmacistId.firstName} ${mtr.pharmacistId.lastName}` : 'System',
                        createdAt: mtr.createdAt,
                        metadata: { status: mtr.status, sessionType: mtr.sessionType }
                    });
                });
            }

            // Sort all activities by creation date (most recent first)
            systemActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Generate user activities based on system activities
            systemActivities.forEach((activity) => {
                if (activity.userId && activity.userName) {
                    // Create corresponding user activity
                    let userActivityType: UserActivity['type'] = 'task_completed';
                    let userTitle = 'Task Completed';
                    let userDescription = activity.description;

                    switch (activity.type) {
                        case 'patient_registration':
                            userActivityType = 'task_completed';
                            userTitle = 'Patient Registered';
                            userDescription = `Registered new patient: ${activity.patientName}`;
                            break;
                        case 'clinical_note':
                            userActivityType = 'task_completed';
                            userTitle = 'Clinical Note Created';
                            userDescription = `Created clinical note for ${activity.patientName}`;
                            break;
                        case 'medication_update':
                            userActivityType = 'task_completed';
                            userTitle = 'Medication Updated';
                            userDescription = `Updated medication for ${activity.patientName}`;
                            break;
                        case 'mtr_session':
                            userActivityType = 'task_completed';
                            userTitle = 'MTR Session';
                            userDescription = `Conducted MTR session for ${activity.patientName}`;
                            break;
                    }

                    userActivities.push({
                        id: `user-${activity.id}`,
                        type: userActivityType,
                        title: userTitle,
                        description: userDescription,
                        userId: activity.userId,
                        userName: activity.userName,
                        createdAt: activity.createdAt,
                        metadata: activity.metadata
                    });
                }
            });

            // Add some mock login activities (since we don't track these in the current system)
            const mockLoginActivities: UserActivity[] = [
                {
                    id: 'login-1',
                    type: 'login',
                    title: 'User Login',
                    description: 'User logged into the system',
                    userId: 'current-user',
                    userName: 'Current User',
                    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
                    metadata: { loginMethod: 'email' }
                },
                {
                    id: 'settings-1',
                    type: 'settings_updated',
                    title: 'Settings Updated',
                    description: 'Notification preferences changed',
                    userId: 'current-user',
                    userName: 'Current User',
                    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
                    metadata: { settingType: 'notifications' }
                }
            ];

            userActivities.push(...mockLoginActivities);

            // Sort user activities by creation date
            userActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return {
                systemActivities: systemActivities.slice(0, limit),
                userActivities: userActivities.slice(0, limit),
                total: systemActivities.length + userActivities.length
            };

        } catch (error) {
            console.error('Error fetching activities:', error);
            throw new Error('Failed to fetch recent activities');
        }
    }

    // Helper method to get activity icon based on type
    getActivityIcon(type: SystemActivity['type'] | UserActivity['type']): string {
        switch (type) {
            case 'patient_registration':
                return '👤';
            case 'clinical_note':
                return '📝';
            case 'medication_update':
                return '💊';
            case 'mtr_session':
                return '📋';
            case 'system_alert':
                return '⚠️';
            case 'login':
                return '🔐';
            case 'report_generated':
                return '📊';
            case 'settings_updated':
                return '⚙️';
            case 'security_change':
                return '🔒';
            case 'task_completed':
                return '✅';
            default:
                return '📌';
        }
    }

    // Helper method to extract array from different response structures
    private extractArrayFromResponse(responseData: unknown, arrayKey?: string): unknown[] {
        if (!responseData) return [];

        // Handle the specific API response structure: { success: true, data: { patients: [...] } }
        if (responseData.success && responseData.data) {
            // For patients endpoint
            if (responseData.data.patients && Array.isArray(responseData.data.patients)) {
                return responseData.data.patients;
            }
            // For medications endpoint
            if (responseData.data.medications && Array.isArray(responseData.data.medications)) {
                return responseData.data.medications;
            }
            // For notes endpoint
            if (responseData.data.notes && Array.isArray(responseData.data.notes)) {
                return responseData.data.notes;
            }
            // For MTR endpoint
            if (responseData.data.mtrs && Array.isArray(responseData.data.mtrs)) {
                return responseData.data.mtrs;
            }
            // If data itself is an array
            if (Array.isArray(responseData.data)) {
                return responseData.data;
            }
        }

        // If arrayKey is specified, try to get that specific array
        if (arrayKey && responseData[arrayKey] && Array.isArray(responseData[arrayKey])) {
            return responseData[arrayKey];
        }

        // Try common array keys
        const commonKeys = ['data', 'results', 'items', 'patients', 'medications', 'notes', 'mtrs'];
        for (const key of commonKeys) {
            if (responseData[key] && Array.isArray(responseData[key])) {
                return responseData[key];
            }
        }

        // If responseData itself is an array
        if (Array.isArray(responseData)) {
            return responseData;
        }

        // Return empty array if no valid array found
        return [];
    }

    // Helper method to format relative time
    formatRelativeTime(dateString: string): string {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return `${diffInSeconds} seconds ago`;
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }
}

export const activityService = new ActivityService();