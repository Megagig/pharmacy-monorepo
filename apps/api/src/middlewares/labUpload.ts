import multer from 'multer';
import { Request } from 'express';

/**
 * Lab Document Upload Middleware
 * Supports PDF and image uploads for laboratory results
 * Uses memory storage for Cloudinary-first approach with local fallback
 */

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// File filter for lab documents (PDF and images)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF and image files (JPEG, PNG, WebP, GIF) are allowed.'));
    }
};

// Multer upload configuration for lab documents
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB limit for lab documents
        files: 10, // Maximum 10 files per upload
    },
});

export default upload;

