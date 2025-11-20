import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { emailService } from '../utils/emailService';
import { AuthRequest } from '../types/auth';
import { licenseUploadService, upload } from '../services/licenseUploadService';

// Export upload middleware from service
export { upload };

export class LicenseController {
  async uploadLicense(req: AuthRequest, res: Response): Promise<any> {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No license document uploaded',
        });
      }

      // Validate file
      const fileValidation = licenseUploadService.validateFile(req.file);
      if (!fileValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: fileValidation.error,
        });
      }

      const { licenseNumber, licenseExpirationDate, pharmacySchool, yearOfGraduation } = req.body;

      // Validate required fields
      const validationErrors = [];
      if (!licenseNumber) validationErrors.push('License number is required');
      if (!licenseExpirationDate) validationErrors.push('License expiration date is required');
      if (!pharmacySchool) validationErrors.push('Pharmacy school is required');

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors.join(', '),
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if license number is already used by another user
      const existingUser = await User.findOne({
        licenseNumber: licenseNumber,
        _id: { $ne: user._id },
        licenseStatus: { $in: ['pending', 'approved'] },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'This license number is already registered by another user',
        });
      }

      // Delete old license document from both Cloudinary and local storage if exists
      if (user.licenseDocument) {
        await licenseUploadService.deleteLicenseDocument(
          user.licenseDocument.cloudinaryPublicId,
          user.licenseDocument.filePath
        );
      }

      // Upload new document with Cloudinary-first approach and local backup
      const uploadResult = await licenseUploadService.uploadLicenseDocument(req.file, user._id.toString());

      // Update user with new license information
      user.licenseNumber = licenseNumber;
      user.licenseExpirationDate = new Date(licenseExpirationDate);
      user.pharmacySchool = pharmacySchool;
      if (yearOfGraduation) {
        user.yearOfGraduation = parseInt(yearOfGraduation);
      }

      user.licenseDocument = {
        fileName: req.file.originalname,
        cloudinaryUrl: uploadResult.cloudinaryUrl,
        cloudinaryPublicId: uploadResult.cloudinaryPublicId,
        filePath: uploadResult.localFilePath,
        uploadedAt: new Date(),
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        uploadMethod: uploadResult.uploadMethod
      };

      user.licenseStatus = 'pending';

      // If user was previously rejected, reset rejection reason
      if (user.licenseRejectionReason) {
        user.licenseRejectionReason = undefined;
      }

      await user.save();

      // Send notification to admins about new license submission
      await emailService.sendLicenseSubmissionNotification({
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        licenseNumber: licenseNumber,
        submittedAt: new Date(),
      });

      res.json({
        success: true,
        message: 'License document uploaded successfully',
        data: {
          licenseNumber: user.licenseNumber,
          status: user.licenseStatus,
          uploadedAt: user.licenseDocument.uploadedAt,
        },
      });
    } catch (error) {
      console.error('License upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading license document',
        error: (error as Error).message,
      });
    }
  }

  async getLicenseStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(req.user._id)
        .select(
          'licenseNumber licenseStatus licenseDocument licenseVerifiedAt licenseRejectionReason licenseExpirationDate pharmacySchool yearOfGraduation role'
        )
        .populate('licenseVerifiedBy', 'firstName lastName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const licenseInfo = {
        licenseNumber: user.licenseNumber,
        status: user.licenseStatus,
        hasDocument: !!user.licenseDocument,
        verifiedAt: user.licenseVerifiedAt,
        rejectionReason: user.licenseRejectionReason,
        expirationDate: user.licenseExpirationDate,
        pharmacySchool: user.pharmacySchool,
        yearOfGraduation: user.yearOfGraduation,
        requiresLicense: ['pharmacist', 'intern_pharmacist', 'owner'].includes(
          user.role
        ),
      };

      if (user.licenseDocument) {
        (licenseInfo as any)['documentInfo'] = {
          fileName: user.licenseDocument.fileName,
          uploadedAt: user.licenseDocument.uploadedAt,
          fileSize: user.licenseDocument.fileSize,
        };
      }

      res.json({
        success: true,
        data: licenseInfo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching license status',
        error: (error as Error).message,
      });
    }
  }

  async downloadLicenseDocument(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;

      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if current user is admin or the license owner
      if (
        req.user.role !== 'super_admin' &&
        req.user._id.toString() !== userId
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const user = await User.findById(userId);
      if (!user || !user.licenseDocument) {
        return res.status(404).json({
          success: false,
          message: 'License document not found',
        });
      }

      // If document is stored in Cloudinary, redirect to the URL
      if (user.licenseDocument.cloudinaryUrl) {
        return res.redirect(user.licenseDocument.cloudinaryUrl);
      }

      // Fallback to local file if exists (for backward compatibility)
      if (user.licenseDocument.filePath && require('fs').existsSync(user.licenseDocument.filePath)) {
        const fs = require('fs');
        res.setHeader('Content-Type', user.licenseDocument.mimeType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${user.licenseDocument.fileName}"`
        );
        const fileStream = fs.createReadStream(user.licenseDocument.filePath);
        fileStream.pipe(res);
        return;
      }

      return res.status(404).json({
        success: false,
        message: 'License file not found',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error downloading license document',
        error: (error as Error).message,
      });
    }
  }

  async deleteLicenseDocument(req: AuthRequest, res: Response): Promise<any> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(req.user._id);
      if (!user || !user.licenseDocument) {
        return res.status(404).json({
          success: false,
          message: 'No license document found',
        });
      }

      // Only allow deletion if status is rejected or pending
      if (!['rejected', 'pending'].includes(user.licenseStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete approved license document',
        });
      }

      // Delete from both Cloudinary and local storage
      await licenseUploadService.deleteLicenseDocument(
        user.licenseDocument.cloudinaryPublicId,
        user.licenseDocument.filePath
      );

      // Clear license information
      user.licenseDocument = undefined;
      user.licenseNumber = undefined;
      user.licenseStatus = 'not_required';
      user.licenseRejectionReason = undefined;

      await user.save();

      res.json({
        success: true,
        message: 'License document deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting license document',
        error: (error as Error).message,
      });
    }
  }

  async validateLicenseNumber(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { licenseNumber } = req.body;

      if (!licenseNumber) {
        return res.status(400).json({
          success: false,
          message: 'License number is required',
        });
      }

      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Check if license number is already registered
      const existingUser = await User.findOne({
        licenseNumber: licenseNumber,
        _id: { $ne: req.user._id },
        licenseStatus: { $in: ['pending', 'approved'] },
      });

      const isAvailable = !existingUser;

      res.json({
        success: true,
        data: {
          licenseNumber,
          isAvailable,
          message: isAvailable
            ? 'License number is available'
            : 'This license number is already registered',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validating license number',
        error: (error as Error).message,
      });
    }
  }

  // Admin-only method to bulk process licenses
  async bulkProcessLicenses(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { actions } = req.body; // Array of { userId, action: 'approve'|'reject', reason? }

      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Actions array is required',
        });
      }

      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const results = [];

      for (const action of actions) {
        try {
          const user = await User.findById(action.userId);
          if (!user) {
            results.push({
              userId: action.userId,
              success: false,
              message: 'User not found',
            });
            continue;
          }

          if (action.action === 'approve') {
            user.licenseStatus = 'approved';
            user.licenseVerifiedAt = new Date();
            user.licenseVerifiedBy = req.user._id;
            user.status = 'active';

            await user.save();

            // Send approval email
            await emailService.sendLicenseApprovalNotification(user.email, {
              firstName: user.firstName,
              licenseNumber: user.licenseNumber || '',
            });

            results.push({
              userId: action.userId,
              success: true,
              message: 'License approved',
            });
          } else if (action.action === 'reject') {
            if (!action.reason) {
              results.push({
                userId: action.userId,
                success: false,
                message: 'Rejection reason is required',
              });
              continue;
            }

            user.licenseStatus = 'rejected';
            user.licenseRejectionReason = action.reason;
            user.licenseVerifiedAt = new Date();
            user.licenseVerifiedBy = req.user._id;
            user.status = 'license_rejected';

            await user.save();

            // Send rejection email
            await emailService.sendLicenseRejectionNotification(user.email, {
              firstName: user.firstName,
              reason: action.reason,
            });

            results.push({
              userId: action.userId,
              success: true,
              message: 'License rejected',
            });
          }
        } catch (error) {
          results.push({
            userId: action.userId,
            success: false,
            message: (error as Error).message,
          });
        }
      }

      res.json({
        success: true,
        message: 'Bulk processing completed',
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing bulk license actions',
        error: (error as Error).message,
      });
    }
  }
}

export const licenseController = new LicenseController();