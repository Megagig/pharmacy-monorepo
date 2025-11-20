/**
 * Utility functions for handling avatar URLs
 */

/**
 * Get the full avatar URL with proper backend URL and cache busting
 * @param avatarPath - The avatar path from the backend (e.g., /uploads/avatars/filename.jpg or Cloudinary URL)
 * @param cacheBust - Whether to add cache-busting timestamp (default: true for local, false for Cloudinary)
 * @returns Full avatar URL or undefined if no avatar path
 */
export const getAvatarUrl = (avatarPath?: string, cacheBust: boolean = true): string | undefined => {
    if (!avatarPath) return undefined;
    
    // If it's already a full URL (Cloudinary, S3, etc.), return as is
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
        // Cloudinary URLs don't need cache busting
        return avatarPath;
    }
    
    // For local uploads, construct full URL with backend
    const backendUrl = import.meta.env.MODE === 'development' 
        ? 'http://localhost:5000' 
        : '';
    
    // Add cache-busting timestamp only for local files
    const cacheBuster = cacheBust ? `?t=${Date.now()}` : '';
    
    return `${backendUrl}${avatarPath}${cacheBuster}`;
};

/**
 * Get avatar URL without cache busting (for stable URLs)
 * @param avatarPath - The avatar path from the backend
 * @returns Full avatar URL or undefined if no avatar path
 */
export const getStableAvatarUrl = (avatarPath?: string): string | undefined => {
    return getAvatarUrl(avatarPath, false);
};
