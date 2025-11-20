import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import userSettingsService, {
    UserProfile,
    UserPreferences,
    SecuritySettings,
    ChangePasswordData,
} from '../services/userSettingsService';
import { toast } from 'react-hot-toast';

// Query keys
export const userSettingsKeys = {
    profile: ['user', 'settings', 'profile'] as const,
    preferences: ['user', 'settings', 'preferences'] as const,
    security: ['user', 'settings', 'security'] as const,
};

// Profile queries
export const useUserProfile = () => {
    return useQuery({
        queryKey: userSettingsKeys.profile,
        queryFn: () => userSettingsService.getUserProfile(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useUpdateUserProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<UserProfile>) =>
            userSettingsService.updateUserProfile(data),
        onSuccess: (data) => {
            queryClient.setQueryData(userSettingsKeys.profile, data);
            // Also update the generic user profile query cache if it exists
            queryClient.setQueryData(['user', 'profile'], data);
            toast.success('Profile updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        },
    });
};

export const useUploadAvatar = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (file: File) => userSettingsService.uploadAvatar(file),
        onSuccess: (avatarUrl) => {
            // Update both query caches with new avatar
            queryClient.setQueryData(userSettingsKeys.profile, (old: UserProfile | undefined) => {
                if (old) {
                    return { ...old, avatar: avatarUrl };
                }
                return old;
            });
            
            // Also update the generic user profile query cache if it exists
            queryClient.setQueryData(['user', 'profile'], (old: any) => {
                if (old) {
                    return { ...old, avatar: avatarUrl };
                }
                return old;
            });
            
            // Invalidate queries to force a refetch and ensure UI updates
            queryClient.invalidateQueries({ queryKey: userSettingsKeys.profile });
            queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
            
            toast.success('Profile picture uploaded successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to upload profile picture');
        },
    });
};

// Preferences queries
export const useUserPreferences = () => {
    return useQuery({
        queryKey: userSettingsKeys.preferences,
        queryFn: () => userSettingsService.getUserPreferences(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useUpdateUserPreferences = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<UserPreferences>) =>
            userSettingsService.updateUserPreferences(data),
        onSuccess: (data) => {
            queryClient.setQueryData(userSettingsKeys.preferences, data);
            toast.success('Preferences updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update preferences');
        },
    });
};

// Security queries
export const useSecuritySettings = () => {
    return useQuery({
        queryKey: userSettingsKeys.security,
        queryFn: () => userSettingsService.getSecuritySettings(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useUpdateSecuritySettings = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<SecuritySettings>) =>
            userSettingsService.updateSecuritySettings(data),
        onSuccess: (data) => {
            queryClient.setQueryData(userSettingsKeys.security, data);
            toast.success('Security settings updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update security settings');
        },
    });
};

export const useChangePassword = () => {
    return useMutation({
        mutationFn: (data: ChangePasswordData) =>
            userSettingsService.changePassword(data),
        onSuccess: () => {
            toast.success('Password changed successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to change password');
        },
    });
};

// 2FA mutations
export const useEnable2FA = () => {
    return useMutation({
        mutationFn: () => userSettingsService.enable2FA(),
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to enable 2FA');
        },
    });
};

export const useVerify2FA = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (token: string) => userSettingsService.verify2FA(token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userSettingsKeys.security });
            toast.success('Two-factor authentication enabled successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to verify 2FA');
        },
    });
};

export const useDisable2FA = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (password: string) => userSettingsService.disable2FA(password),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userSettingsKeys.security });
            toast.success('Two-factor authentication disabled successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to disable 2FA');
        },
    });
};
