import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import logger from '../utils/logger';

// Enhanced file upload service with security features
export class FileUploadService {
    private static readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'clinical-notes');
    private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static readonly ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ];

    private static readonly DANGEROUS_EXTENSIONS = [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
        '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1', '.py', '.rb'
    ];

    /**
     * Initialize upload directory
     */
    static initializeUploadDirectory(): void {
        if (!fs.existsSync(this.UPLOAD_DIR)) {
            fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
            logger.info('Created upload directory', { path: this.UPLOAD_DIR });
        }
    }

    /**
     * Generate secure filename
     */
    private static generateSecureFilename(originalName: string): string {
        const ext = path.extname(originalName).toLowerCase();
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        return `${timestamp}-${randomBytes}${ext}`;
    }

    /**
     * Validate file type and security
     */
    private static validateFile(file: any): { isValid: boolean; error?: string } {
        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
            return {
                isValid: false,
                error: `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
            };
        }

        // Check MIME type
        if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return {
                isValid: false,
                error: `File type ${file.mimetype} is not allowed`
            };
        }

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (this.DANGEROUS_EXTENSIONS.includes(ext)) {
            return {
                isValid: false,
                error: `File extension ${ext} is not allowed for security reasons`
            };
        }

        // Additional security checks
        if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
            return {
                isValid: false,
                error: 'Invalid characters in filename'
            };
        }

        return { isValid: true };
    }

    /**
     * Scan file for malicious content (basic implementation)
     */
    private static async scanFileContent(filePath: string): Promise<{ isSafe: boolean; error?: string }> {
        try {
            // Read first few bytes to check for executable signatures
            const buffer = Buffer.alloc(512);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, 512, 0);
            fs.closeSync(fd);

            // Check for common executable signatures
            const signatures = [
                Buffer.from([0x4D, 0x5A]), // PE executable (MZ)
                Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
                Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O executable
                Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (could contain executables)
            ];

            for (const signature of signatures) {
                if (buffer.subarray(0, signature.length).equals(signature)) {
                    // Additional check for ZIP files (Office documents are ZIP-based)
                    if (signature.equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]))) {
                        // Allow if it's a known Office document
                        const filePath_lower = filePath.toLowerCase();
                        if (filePath_lower.endsWith('.docx') || filePath_lower.endsWith('.xlsx') ||
                            filePath_lower.endsWith('.pptx')) {
                            continue;
                        }
                    }

                    return {
                        isSafe: false,
                        error: 'File appears to contain executable content'
                    };
                }
            }

            return { isSafe: true };
        } catch (error) {
            logger.error('Error scanning file content', { filePath, error });
            return {
                isSafe: false,
                error: 'Unable to scan file content'
            };
        }
    }

    /**
     * Create multer storage configuration
     */
    static createStorage(): multer.StorageEngine {
        return multer.diskStorage({
            destination: (req: Request, file: any, cb) => {
                this.initializeUploadDirectory();
                cb(null, this.UPLOAD_DIR);
            },
            filename: (req: Request, file: any, cb) => {
                const secureFilename = this.generateSecureFilename(file.originalname);
                cb(null, secureFilename);
            }
        });
    }

    /**
     * Create file filter for multer
     */
    static createFileFilter(): multer.Options['fileFilter'] {
        return (req: Request, file: any, cb: multer.FileFilterCallback) => {
            const validation = this.validateFile(file);

            if (!validation.isValid) {
                cb(new Error(validation.error || 'Invalid file'));
                return;
            }

            cb(null, true);
        };
    }

    /**
     * Create configured multer instance
     */
    static createUploadMiddleware(): multer.Multer {
        return multer({
            storage: this.createStorage(),
            fileFilter: this.createFileFilter(),
            limits: {
                fileSize: this.MAX_FILE_SIZE,
                files: 5, // Maximum 5 files per upload
                fieldSize: 1024 * 1024, // 1MB field size limit
            }
        });
    }

    /**
     * Process uploaded file with security scanning
     */
    static async processUploadedFile(file: any): Promise<{
        success: boolean;
        fileData?: any;
        error?: string;
    }> {
        try {
            const filePath = file.path;

            // Perform content scanning
            const scanResult = await this.scanFileContent(filePath);
            if (!scanResult.isSafe) {
                // Delete the unsafe file
                await this.deleteFile(filePath);
                return {
                    success: false,
                    error: scanResult.error || 'File failed security scan'
                };
            }

            // Generate file URL
            const fileUrl = this.getFileUrl(file.filename);

            // Return file data
            return {
                success: true,
                fileData: {
                    fileName: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    url: fileUrl,
                    uploadedAt: new Date()
                }
            };
        } catch (error: any) {
            logger.error('Error processing uploaded file', {
                filename: file.filename,
                error: error.message
            });

            // Clean up file on error
            if (file.path && fs.existsSync(file.path)) {
                await this.deleteFile(file.path);
            }

            return {
                success: false,
                error: 'Failed to process uploaded file'
            };
        }
    }

    /**
     * Delete file from filesystem
     */
    static async deleteFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    logger.error('Error deleting file', { filePath, error: err.message });
                    reject(err);
                } else {
                    logger.info('File deleted successfully', { filePath });
                    resolve();
                }
            });
        });
    }

    /**
     * Generate file URL
     */
    static getFileUrl(filename: string): string {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        return `${baseUrl}/uploads/clinical-notes/${filename}`;
    }

    /**
     * Check if file exists
     */
    static fileExists(filename: string): boolean {
        const filePath = path.join(this.UPLOAD_DIR, filename);
        return fs.existsSync(filePath);
    }

    /**
     * Get file path
     */
    static getFilePath(filename: string): string {
        return path.join(this.UPLOAD_DIR, filename);
    }

    /**
     * Get file stats
     */
    static getFileStats(filename: string): fs.Stats | null {
        try {
            const filePath = this.getFilePath(filename);
            return fs.statSync(filePath);
        } catch (error) {
            return null;
        }
    }

    /**
     * Clean up old files (for maintenance)
     */
    static async cleanupOldFiles(daysOld: number = 30): Promise<number> {
        try {
            const files = fs.readdirSync(this.UPLOAD_DIR);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.UPLOAD_DIR, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime < cutoffDate) {
                    await this.deleteFile(filePath);
                    deletedCount++;
                }
            }

            logger.info('Cleanup completed', { deletedCount, daysOld });
            return deletedCount;
        } catch (error: any) {
            logger.error('Error during file cleanup', { error: error.message });
            throw error;
        }
    }

    /**
     * Get upload directory size
     */
    static getDirectorySize(): { size: number; fileCount: number } {
        try {
            const files = fs.readdirSync(this.UPLOAD_DIR);
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(this.UPLOAD_DIR, file);
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
            }

            return {
                size: totalSize,
                fileCount: files.length
            };
        } catch (error) {
            return { size: 0, fileCount: 0 };
        }
    }
}

// Export configured upload middleware
export const uploadMiddleware = FileUploadService.createUploadMiddleware();

// Export individual methods for backward compatibility
export const deleteFile = FileUploadService.deleteFile.bind(FileUploadService);
export const getFileUrl = FileUploadService.getFileUrl.bind(FileUploadService);
export const fileExists = FileUploadService.fileExists.bind(FileUploadService);

export default FileUploadService;