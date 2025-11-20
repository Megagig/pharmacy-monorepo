// Utility functions for formatting data in the application

/**
 * Format currency values in Naira
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'NGN'
): string => {
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
};

/**
 * Format dates in a user-friendly format
 */
export const formatDate = (
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
};

/**
 * Format dates for short display
 */
export const formatDateShort = (date: string | Date): string => {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format date and time for display
 */
export const formatDateTime = (
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
};

/**
 * Format relative time (e.g., "2 days ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffInMs = now.getTime() - targetDate.getTime();

  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 7) {
    return formatDateShort(date);
  } else if (diffInDays >= 1) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours >= 1) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInMinutes >= 1) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Format billing interval display
 */
export const formatBillingInterval = (interval: string): string => {
  switch (interval.toLowerCase()) {
    case 'monthly':
      return 'Monthly';
    case 'yearly':
    case 'annual':
      return 'Yearly';
    case 'quarterly':
      return 'Quarterly';
    default:
      return interval;
  }
};

/**
 * Format subscription status for display
 */
export const formatSubscriptionStatus = (
  status: string
): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'default';
} => {
  switch (status.toLowerCase()) {
    case 'active':
      return { label: 'Active', color: 'success' };
    case 'expired':
      return { label: 'Expired', color: 'error' };
    case 'cancelled':
    case 'canceled':
      return { label: 'Cancelled', color: 'warning' };
    case 'pending':
      return { label: 'Pending', color: 'info' };
    case 'grace_period':
      return { label: 'Grace Period', color: 'warning' };
    case 'trial':
      return { label: 'Trial', color: 'info' };
    default:
      return { label: status, color: 'default' };
  }
};

/**
 * Format payment status for display
 */
export const formatPaymentStatus = (
  status: string
): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'default';
} => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'succeeded':
      return { label: 'Completed', color: 'success' };
    case 'pending':
      return { label: 'Pending', color: 'info' };
    case 'failed':
      return { label: 'Failed', color: 'error' };
    case 'refunded':
      return { label: 'Refunded', color: 'warning' };
    case 'processing':
      return { label: 'Processing', color: 'info' };
    default:
      return { label: status, color: 'default' };
  }
};

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format percentage
 */
export const formatPercentage = (
  value: number,
  decimalPlaces: number = 1
): string => {
  return `${(value * 100).toFixed(decimalPlaces)}%`;
};

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export const formatNumber = (num: number): string => {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  } else {
    return num.toString();
  }
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle Nigerian phone numbers
  if (cleaned.startsWith('234')) {
    const number = cleaned.substring(3);
    return `+234 ${number.substring(0, 3)} ${number.substring(
      3,
      6
    )} ${number.substring(6)}`;
  } else if (cleaned.startsWith('0')) {
    const number = cleaned.substring(1);
    return `0${number.substring(0, 3)} ${number.substring(
      3,
      6
    )} ${number.substring(6)}`;
  }

  return phone;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Capitalize first letter of each word
 */
export const capitalizeWords = (str: string): string => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

/**
 * Format duration in human-readable format
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

/**
 * Format card number for display (mask all but last 4 digits)
 */
export const formatCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\D/g, '');
  const last4 = cleaned.slice(-4);
  return `•••• •••• •••• ${last4}`;
};

/**
 * Format expiry date for display
 */
export const formatCardExpiry = (month: number, year: number): string => {
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
};

/**
 * Check if a date is in the past
 */
export const isDateInPast = (date: string | Date): boolean => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  return targetDate < new Date();
};

/**
 * Check if a date is within a certain number of days
 */
export const isDateWithinDays = (
  date: string | Date,
  days: number
): boolean => {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMs = targetDate.getTime() - now.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  return diffInDays <= days && diffInDays >= 0;
};
