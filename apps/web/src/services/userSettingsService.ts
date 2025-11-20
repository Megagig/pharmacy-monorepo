import api from './api';

export interface UserProfile {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
    bio?: string;
    location?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    organization?: string;
    professionalTitle?: string;
    specialization?: string;
    role: string;
    licenseNumber?: string;
    pharmacySchool?: string;
    yearOfGraduation?: number;
    operatingHours?: {
        monday?: { open: string; close: string; closed?: boolean };
        tuesday?: { open: string; close: string; closed?: boolean };
        wednesday?: { open: string; close: string; closed?: boolean };
        thursday?: { open: string; close: string; closed?: boolean };
        friday?: { open: string; close: string; closed?: boolean };
        saturday?: { open: string; close: string; closed?: boolean };
        sunday?: { open: string; close: string; closed?: boolean };
    };
}

export interface UserPreferences {
    themePreference: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    notificationPreferences: {
        email: boolean;
        sms: boolean;
        push: boolean;
        followUpReminders: boolean;
        criticalAlerts: boolean;
        dailyDigest: boolean;
        weeklyReport: boolean;
    };
}

export interface SecuritySettings {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    loginNotifications: boolean;
    profileVisibility: 'public' | 'organization' | 'private';
    dataSharing: boolean;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

export interface TwoFactorSetup {
    secret: string;
    qrCode: string;
}

class UserSettingsService {
    // Profile endpoints
    async getUserProfile(): Promise<UserProfile> {
        const response = await api.get('/user/settings/profile');
        return response.data.data;
    }

    async updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
        const response = await api.put('/user/settings/profile', data);
        return response.data.data;
    }

    async uploadAvatar(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await api.post('/user/settings/profile/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        
        return response.data.data.avatar;
    }

    // Preferences endpoints
    async getUserPreferences(): Promise<UserPreferences> {
        const response = await api.get('/user/settings/preferences');
        return response.data.data;
    }

    async updateUserPreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
        const response = await api.put('/user/settings/preferences', data);
        return response.data.data;
    }

    // Security endpoints
    async getSecuritySettings(): Promise<SecuritySettings> {
        const response = await api.get('/user/settings/security');
        return response.data.data;
    }

    async updateSecuritySettings(data: Partial<SecuritySettings>): Promise<SecuritySettings> {
        const response = await api.put('/user/settings/security', data);
        return response.data.data;
    }

    async changePassword(data: ChangePasswordData): Promise<void> {
        await api.post('/user/settings/security/change-password', data);
    }

    // 2FA endpoints
    async enable2FA(): Promise<TwoFactorSetup> {
        const response = await api.post('/user/settings/security/2fa/enable');
        return response.data.data;
    }

    async verify2FA(token: string): Promise<void> {
        await api.post('/user/settings/security/2fa/verify', { token });
    }

    async disable2FA(password: string): Promise<void> {
        await api.post('/user/settings/security/2fa/disable', { password });
    }
}

export default new UserSettingsService();
