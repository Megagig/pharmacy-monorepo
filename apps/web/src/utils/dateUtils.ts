import { format, formatDistanceToNow } from 'date-fns';

/**
 * Safely parse various date formats including MongoDB ObjectId and Date objects
 */
export const parseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  try {
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    } else if (typeof dateValue === 'object' && dateValue !== null) {
      // Check if it's an empty object
      if (Object.keys(dateValue).length === 0) {
        return null;
      }
      
      if (dateValue.$date) {
        // MongoDB date object format
        return new Date(dateValue.$date);
      } else if (dateValue.toString && typeof dateValue.toString === 'function') {
        // ObjectId or other object with toString method
        const timestampStr = dateValue.toString();
        // Check if it's a valid ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(timestampStr)) {
          // Extract timestamp from ObjectId (first 4 bytes represent timestamp)
          const timestampFromId = parseInt(timestampStr.substring(0, 8), 16) * 1000;
          return new Date(timestampFromId);
        } else {
          return new Date(timestampStr);
        }
      } else {
        return new Date(dateValue);
      }
    } else {
      return new Date(dateValue);
    }
  } catch {
    return null;
  }
};

/**
 * Format timestamp for display in messages
 */
export const formatMessageTimestamp = (timestamp: any): string => {
  const dateValue = parseDate(timestamp);
  
  if (!dateValue || isNaN(dateValue.getTime())) {
    // If timestamp is invalid, try to use current time as fallback
    console.warn('Invalid timestamp received:', timestamp, typeof timestamp);
    return 'just now';
  }
  
  const now = new Date();
  const diffInHours = (now.getTime() - dateValue.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return formatDistanceToNow(dateValue, { addSuffix: true });
  }
  return format(dateValue, 'MMM d, yyyy h:mm a');
};

/**
 * Generate a safe React key from various ID formats
 */
export const generateSafeKey = (id: any, fallback?: string): string => {
  if (typeof id === 'string') {
    return id;
  } else if (id && typeof id === 'object' && id.toString) {
    return id.toString();
  } else {
    return fallback || `key-${Math.random().toString(36).substr(2, 9)}`;
  }
};