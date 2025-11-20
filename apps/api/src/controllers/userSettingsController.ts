import { Request, Response } from 'express';
import User from '../models/User';
// @ts-ignore - VS Code TypeScript server cache issue, file exists and builds successfully
import { uploadProfilePicture } from '../utils/fileUpload';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcryptjs';

// Extend Request type to include user and file
interface AuthRequest extends Request {
    user?: {
        userId: string;
        _id?: string;
    };
    file?: Express.Multer.File;
}

// Get user profile
export const getUserProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;

        const user = await User.findById(userId).select(
            '-passwordHash -resetToken -verificationToken -verificationCode -twoFactorSecret'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update user profile
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const {
            firstName,
            lastName,
            phone,
            bio,
            location,
            address,
            city,
            state,
            country,
            zipCode,
            organization,
            professionalTitle,
            specialization,
            licenseNumber,
            pharmacySchool,
            yearOfGraduation,
            operatingHours,
        } = req.body;

        // Validate inputs
        if (yearOfGraduation) {
            const currentYear = new Date().getFullYear();
            if (yearOfGraduation < 1900 || yearOfGraduation > currentYear + 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid year of graduation',
                });
            }
        }

        const updateData: any = {};

        // Only update provided fields
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phone !== undefined) updateData.phone = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (location !== undefined) updateData.location = location;
        if (address !== undefined) updateData.address = address;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (country !== undefined) updateData.country = country;
        if (zipCode !== undefined) updateData.zipCode = zipCode;
        if (organization !== undefined) updateData.organization = organization;
        if (professionalTitle !== undefined) updateData.professionalTitle = professionalTitle;
        if (specialization !== undefined) updateData.specialization = specialization;
        if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
        if (pharmacySchool !== undefined) updateData.pharmacySchool = pharmacySchool;
        if (yearOfGraduation !== undefined) updateData.yearOfGraduation = yearOfGraduation;
        if (operatingHours !== undefined) updateData.operatingHours = operatingHours;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-passwordHash -resetToken -verificationToken -verificationCode -twoFactorSecret');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user,
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user profile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Upload profile picture
export const uploadAvatar = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        // Upload file to storage (implementation depends on your storage solution)
        const avatarUrl = await uploadProfilePicture(req.file);

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { avatar: avatarUrl } },
            { new: true }
        ).select('-passwordHash -resetToken -verificationToken -verificationCode -twoFactorSecret');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: { avatar: avatarUrl },
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get user preferences
export const getUserPreferences = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;

        const user = await User.findById(userId).select(
            'themePreference language timezone dateFormat timeFormat notificationPreferences'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                themePreference: user.themePreference || 'system',
                language: user.language || 'en',
                timezone: user.timezone || 'UTC',
                dateFormat: user.dateFormat || 'DD/MM/YYYY',
                timeFormat: user.timeFormat || '12h',
                notificationPreferences: user.notificationPreferences || {
                    email: true,
                    sms: false,
                    push: true,
                    followUpReminders: true,
                    criticalAlerts: true,
                    dailyDigest: false,
                    weeklyReport: false,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user preferences',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update user preferences
export const updateUserPreferences = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const {
            themePreference,
            language,
            timezone,
            dateFormat,
            timeFormat,
            notificationPreferences,
        } = req.body;

        const updateData: any = {};

        if (themePreference) updateData.themePreference = themePreference;
        if (language) updateData.language = language;
        if (timezone) updateData.timezone = timezone;
        if (dateFormat) updateData.dateFormat = dateFormat;
        if (timeFormat) updateData.timeFormat = timeFormat;
        if (notificationPreferences) {
            updateData.notificationPreferences = notificationPreferences;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('themePreference language timezone dateFormat timeFormat notificationPreferences');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Preferences updated successfully',
            data: user,
        });
    } catch (error) {
        console.error('Error updating user preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user preferences',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get security settings
export const getSecuritySettings = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;

        const user = await User.findById(userId).select(
            'twoFactorEnabled sessionTimeout loginNotifications profileVisibility dataSharing'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                twoFactorEnabled: user.twoFactorEnabled || false,
                sessionTimeout: user.sessionTimeout || 30,
                loginNotifications: user.loginNotifications !== false,
                profileVisibility: user.profileVisibility || 'organization',
                dataSharing: user.dataSharing || false,
            },
        });
    } catch (error) {
        console.error('Error fetching security settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch security settings',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update security settings
export const updateSecuritySettings = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const {
            sessionTimeout,
            loginNotifications,
            profileVisibility,
            dataSharing,
        } = req.body;

        const updateData: any = {};

        if (sessionTimeout !== undefined) {
            if (sessionTimeout < 5 || sessionTimeout > 1440) {
                return res.status(400).json({
                    success: false,
                    message: 'Session timeout must be between 5 and 1440 minutes',
                });
            }
            updateData.sessionTimeout = sessionTimeout;
        }

        if (loginNotifications !== undefined) {
            updateData.loginNotifications = loginNotifications;
        }
        if (profileVisibility !== undefined) {
            updateData.profileVisibility = profileVisibility;
        }
        if (dataSharing !== undefined) {
            updateData.dataSharing = dataSharing;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('sessionTimeout loginNotifications profileVisibility dataSharing');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Security settings updated successfully',
            data: user,
        });
    } catch (error) {
        console.error('Error updating security settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update security settings',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Change password
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }

        // Update password
        user.passwordHash = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Enable 2FA - Generate secret and QR code
export const enable2FA = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Generate 2FA secret
        const secret = speakeasy.generateSecret({
            name: `PharmacyCopilot (${user.email})`,
            issuer: 'PharmacyCopilot',
        });

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

        // Save secret temporarily (will be confirmed when user verifies)
        user.twoFactorSecret = secret.base32;
        await user.save();

        res.status(200).json({
            success: true,
            message: '2FA secret generated',
            data: {
                secret: secret.base32,
                qrCode: qrCodeUrl,
            },
        });
    } catch (error) {
        console.error('Error enabling 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable 2FA',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Verify and activate 2FA
export const verify2FA = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required',
            });
        }

        const user = await User.findById(userId);

        if (!user || !user.twoFactorSecret) {
            return res.status(404).json({
                success: false,
                message: 'User not found or 2FA not initiated',
            });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 2,
        });

        if (!verified) {
            return res.status(401).json({
                success: false,
                message: 'Invalid verification token',
            });
        }

        // Enable 2FA
        user.twoFactorEnabled = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: '2FA enabled successfully',
        });
    } catch (error) {
        console.error('Error verifying 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Disable 2FA
export const disable2FA = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId || req.user!._id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to disable 2FA',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password',
            });
        }

        // Disable 2FA
        user.twoFactorEnabled = false;
        user.twoFactorSecret = '';
        await user.save();

        res.status(200).json({
            success: true,
            message: '2FA disabled successfully',
        });
    } catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable 2FA',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
