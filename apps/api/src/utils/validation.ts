import mongoose from 'mongoose';

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param id - The string to validate
 * @returns boolean - True if valid ObjectId, false otherwise
 */
export const validateObjectId = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates if multiple strings are valid MongoDB ObjectIds
 * @param ids - Array of strings to validate
 * @returns boolean - True if all are valid ObjectIds, false otherwise
 */
export const validateObjectIds = (ids: string[]): boolean => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return false;
  }
  return ids.every(id => validateObjectId(id));
};

/**
 * Validates email format
 * @param email - The email string to validate
 * @returns boolean - True if valid email format, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number format (basic validation)
 * @param phone - The phone string to validate
 * @returns boolean - True if valid phone format, false otherwise
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Basic phone validation - allows various formats
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Validates URL format
 * @param url - The URL string to validate
 * @returns boolean - True if valid URL format, false otherwise
 */
export const validateUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates if a string is not empty after trimming
 * @param str - The string to validate
 * @returns boolean - True if not empty, false otherwise
 */
export const validateNotEmpty = (str: string): boolean => {
  return typeof str === 'string' && str.trim().length > 0;
};

/**
 * Validates string length within bounds
 * @param str - The string to validate
 * @param min - Minimum length (inclusive)
 * @param max - Maximum length (inclusive)
 * @returns boolean - True if within bounds, false otherwise
 */
export const validateStringLength = (str: string, min: number, max: number): boolean => {
  if (typeof str !== 'string') {
    return false;
  }
  const length = str.trim().length;
  return length >= min && length <= max;
};

/**
 * Validates if a number is within bounds
 * @param num - The number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns boolean - True if within bounds, false otherwise
 */
export const validateNumberRange = (num: number, min: number, max: number): boolean => {
  return typeof num === 'number' && !isNaN(num) && num >= min && num <= max;
};

/**
 * Validates if a value is one of the allowed values
 * @param value - The value to validate
 * @param allowedValues - Array of allowed values
 * @returns boolean - True if value is in allowed values, false otherwise
 */
export const validateEnum = (value: any, allowedValues: any[]): boolean => {
  return allowedValues.includes(value);
};