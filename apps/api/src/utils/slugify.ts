import mongoose from 'mongoose';

/**
 * Utility for generating URL-friendly slugs from titles
 * Handles uniqueness by appending numbers if slug already exists
 */

export interface SlugifyOptions {
  /**
   * Maximum length of the generated slug
   * @default 100
   */
  maxLength?: number;
  
  /**
   * Whether to convert to lowercase
   * @default true
   */
  lowercase?: boolean;
  
  /**
   * Custom separator for words
   * @default '-'
   */
  separator?: string;
  
  /**
   * Whether to remove trailing separators
   * @default true
   */
  trim?: boolean;
}

/**
 * Generate a URL-friendly slug from a title
 * @param title - The title to convert to slug
 * @param options - Configuration options
 * @returns URL-friendly slug
 */
export function generateSlug(title: string, options: SlugifyOptions = {}): string {
  const {
    maxLength = 100,
    lowercase = true,
    separator = '-',
    trim = true,
  } = options;

  if (!title || typeof title !== 'string') {
    return '';
  }

  let slug = title;

  // Convert to lowercase if specified
  if (lowercase) {
    slug = slug.toLowerCase();
  }

  // Remove special characters and replace with separator
  slug = slug
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .replace(/[\s_-]+/g, separator) // Replace spaces, underscores, and multiple hyphens with separator
    .replace(new RegExp(`\\${separator}+`, 'g'), separator); // Replace multiple separators with single

  // Remove leading/trailing separators if trim is enabled
  if (trim) {
    const separatorRegex = new RegExp(`^\\${separator}+|\\${separator}+$`, 'g');
    slug = slug.replace(separatorRegex, '');
  }

  // Truncate to max length
  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    
    // Ensure we don't cut in the middle of a word
    const lastSeparatorIndex = slug.lastIndexOf(separator);
    if (lastSeparatorIndex > maxLength * 0.8) { // Only trim if separator is near the end
      slug = slug.substring(0, lastSeparatorIndex);
    }
    
    // Remove trailing separator after truncation
    if (trim) {
      const separatorRegex = new RegExp(`\\${separator}+$`, 'g');
      slug = slug.replace(separatorRegex, '');
    }
  }

  return slug;
}

/**
 * Generate a unique slug by checking against a MongoDB collection
 * @param title - The title to convert to slug
 * @param model - Mongoose model to check against
 * @param field - Field name to check for uniqueness (default: 'slug')
 * @param excludeId - Document ID to exclude from uniqueness check (for updates)
 * @param options - Slug generation options
 * @returns Promise resolving to unique slug
 */
export async function generateUniqueSlug<T extends mongoose.Document>(
  title: string,
  model: mongoose.Model<T>,
  field: string = 'slug',
  excludeId?: mongoose.Types.ObjectId | string,
  options: SlugifyOptions = {}
): Promise<string> {
  const baseSlug = generateSlug(title, options);
  
  if (!baseSlug) {
    throw new Error('Cannot generate slug from empty or invalid title');
  }

  let slug = baseSlug;
  let counter = 1;
  const maxAttempts = 100; // Prevent infinite loops

  while (counter <= maxAttempts) {
    // Build query to check if slug exists
    const query: any = { [field]: slug };
    
    // Exclude current document if updating
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    try {
      const existingDoc = await model.findOne(query);
      
      if (!existingDoc) {
        return slug; // Slug is unique
      }

      // Generate next variant
      slug = `${baseSlug}-${counter}`;
      counter++;
    } catch (error) {
      throw new Error(`Error checking slug uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error(`Could not generate unique slug after ${maxAttempts} attempts`);
}

/**
 * Validate if a string is a valid slug format
 * @param slug - The slug to validate
 * @param options - Validation options
 * @returns True if valid slug format
 */
export function isValidSlug(
  slug: string,
  options: { 
    allowUppercase?: boolean;
    separator?: string;
    minLength?: number;
    maxLength?: number;
  } = {}
): boolean {
  const {
    allowUppercase = false,
    separator = '-',
    minLength = 1,
    maxLength = 100,
  } = options;

  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Check length constraints
  if (slug.length < minLength || slug.length > maxLength) {
    return false;
  }

  // Build regex pattern based on options
  const casePattern = allowUppercase ? 'a-zA-Z' : 'a-z';
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^[${casePattern}0-9${escapedSeparator}]+$`);

  // Check if slug matches pattern
  if (!pattern.test(slug)) {
    return false;
  }

  // Check for leading/trailing separators
  const separatorRegex = new RegExp(`^\\${escapedSeparator}|\\${escapedSeparator}$`);
  if (separatorRegex.test(slug)) {
    return false;
  }

  // Check for consecutive separators
  const consecutiveSeparatorRegex = new RegExp(`${escapedSeparator}{2,}`);
  if (consecutiveSeparatorRegex.test(slug)) {
    return false;
  }

  return true;
}

/**
 * Update slug for an existing document if title changed
 * @param document - The document to update
 * @param model - Mongoose model
 * @param titleField - Field name containing the title (default: 'title')
 * @param slugField - Field name containing the slug (default: 'slug')
 * @param options - Slug generation options
 * @returns Promise resolving to updated slug or null if no update needed
 */
export async function updateSlugIfNeeded<T extends mongoose.Document>(
  document: T & { [key: string]: any },
  model: mongoose.Model<T>,
  titleField: string = 'title',
  slugField: string = 'slug',
  options: SlugifyOptions = {}
): Promise<string | null> {
  // Check if title field was modified
  if (!document.isModified || !document.isModified(titleField)) {
    return null;
  }

  const title = document[titleField];
  if (!title) {
    return null;
  }

  try {
    const newSlug = await generateUniqueSlug(
      title,
      model,
      slugField,
      document._id,
      options
    );

    // Update the document's slug field
    (document as any)[slugField] = newSlug;
    
    return newSlug;
  } catch (error) {
    throw new Error(`Failed to update slug: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch generate unique slugs for multiple titles
 * @param titles - Array of titles to convert
 * @param model - Mongoose model to check against
 * @param field - Field name to check for uniqueness
 * @param options - Slug generation options
 * @returns Promise resolving to array of unique slugs
 */
export async function generateUniqueSlugs<T extends mongoose.Document>(
  titles: string[],
  model: mongoose.Model<T>,
  field: string = 'slug',
  options: SlugifyOptions = {}
): Promise<string[]> {
  const slugs: string[] = [];
  const usedSlugs = new Set<string>();

  for (const title of titles) {
    let baseSlug = generateSlug(title, options);
    let slug = baseSlug;
    let counter = 1;

    // Check against database and already generated slugs
    const query: any = {};
    query[field] = slug;
    
    while (usedSlugs.has(slug) || await model.exists(query)) {
      slug = `${baseSlug}-${counter}`;
      query[field] = slug;
      counter++;
    }

    slugs.push(slug);
    usedSlugs.add(slug);
  }

  return slugs;
}

export default {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
  updateSlugIfNeeded,
  generateUniqueSlugs,
};