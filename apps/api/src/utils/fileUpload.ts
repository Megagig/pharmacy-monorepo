import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create uploads directory if it doesn't exist (for backup/fallback)
const uploadsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (memory storage for Cloudinary)
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

// Multer upload configuration
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// Check if Cloudinary is configured
const isCloudinaryConfigured = (): boolean => {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

// Upload to Cloudinary
const uploadToCloudinary = async (file: Express.Multer.File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'avatars',
                resource_type: 'image',
                transformation: [
                    { width: 500, height: 500, crop: 'fill', gravity: 'face' },
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result!.secure_url);
                }
            }
        );

        // Convert buffer to stream and pipe to Cloudinary
        const bufferStream = require('stream').Readable.from(file.buffer);
        bufferStream.pipe(uploadStream);
    });
};

// Upload to local storage (fallback)
const uploadToLocal = async (file: Express.Multer.File): Promise<string> => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadsDir, uniqueName);
    
    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);
    
    const relativePath = `/uploads/avatars/${uniqueName}`;
    return relativePath;
};

// Upload profile picture and return URL
export const uploadProfilePicture = async (file: Express.Multer.File): Promise<string> => {
    try {
        // Try Cloudinary first if configured
        if (isCloudinaryConfigured()) {
            console.log('[Upload] Using Cloudinary for avatar upload');
            const cloudinaryUrl = await uploadToCloudinary(file);
            console.log('[Upload] Cloudinary upload successful:', cloudinaryUrl);
            return cloudinaryUrl;
        } else {
            console.log('[Upload] Cloudinary not configured, using local storage');
            const localUrl = await uploadToLocal(file);
            console.log('[Upload] Local upload successful:', localUrl);
            return localUrl;
        }
    } catch (error) {
        console.error('[Upload] Primary upload failed, trying fallback:', error);
        
        // Fallback to local storage if Cloudinary fails
        try {
            const localUrl = await uploadToLocal(file);
            console.log('[Upload] Fallback to local storage successful:', localUrl);
            return localUrl;
        } catch (fallbackError) {
            console.error('[Upload] Fallback upload also failed:', fallbackError);
            throw new Error('Failed to upload profile picture');
        }
    }
};

// Delete old profile picture
export const deleteProfilePicture = async (avatarUrl: string): Promise<void> => {
    try {
        // Delete from Cloudinary if it's a Cloudinary URL
        if (avatarUrl && avatarUrl.includes('cloudinary.com')) {
            const publicId = avatarUrl.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(`avatars/${publicId}`);
            console.log('[Delete] Deleted from Cloudinary:', publicId);
        }
        // Delete from local storage if it's a local URL
        else if (avatarUrl && avatarUrl.startsWith('/uploads/avatars/')) {
            const filePath = path.join(__dirname, '../..', avatarUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('[Delete] Deleted from local storage:', filePath);
            }
        }
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        // Don't throw error, just log it
    }
};
