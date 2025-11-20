/**
 * Utility for calculating reading time based on word count
 * Handles different content types (text, HTML, markdown)
 * Uses average reading speed of 200-250 words per minute
 */

export interface ReadTimeOptions {
  /**
   * Words per minute reading speed
   * @default 225 (average between 200-250)
   */
  wordsPerMinute?: number;
  
  /**
   * Minimum reading time in minutes
   * @default 1
   */
  minReadTime?: number;
  
  /**
   * Maximum reading time in minutes (0 = no limit)
   * @default 0
   */
  maxReadTime?: number;
  
  /**
   * Whether to include image viewing time
   * @default true
   */
  includeImageTime?: boolean;
  
  /**
   * Seconds per image for viewing time
   * @default 12 (based on Medium's calculation)
   */
  secondsPerImage?: number;
  
  /**
   * Whether to round up to nearest minute
   * @default true
   */
  roundUp?: boolean;
}

export interface ReadTimeResult {
  /**
   * Estimated reading time in minutes
   */
  minutes: number;
  
  /**
   * Total word count
   */
  wordCount: number;
  
  /**
   * Number of images found (if applicable)
   */
  imageCount?: number;
  
  /**
   * Human-readable reading time string
   */
  text: string;
  
  /**
   * Reading time in seconds (for precise calculations)
   */
  seconds: number;
}

/**
 * Calculate reading time for plain text content
 * @param text - Plain text content
 * @param options - Calculation options
 * @returns Reading time result
 */
export function calculateReadTimeFromText(
  text: string,
  options: ReadTimeOptions = {}
): ReadTimeResult {
  const {
    wordsPerMinute = 225,
    minReadTime = 1,
    maxReadTime = 0,
    roundUp = true,
  } = options;

  if (!text || typeof text !== 'string') {
    return {
      minutes: minReadTime,
      wordCount: 0,
      text: `${minReadTime} min read`,
      seconds: minReadTime * 60,
    };
  }

  // Count words by splitting on whitespace and filtering empty strings
  const words = text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      minutes: minReadTime,
      wordCount: 0,
      text: `${minReadTime} min read`,
      seconds: minReadTime * 60,
    };
  }

  // Calculate reading time in seconds
  const readingTimeSeconds = (wordCount / wordsPerMinute) * 60;
  
  // Convert to minutes
  let readingTimeMinutes = readingTimeSeconds / 60;
  
  // Round up if specified
  if (roundUp) {
    readingTimeMinutes = Math.ceil(readingTimeMinutes);
  } else {
    readingTimeMinutes = Math.round(readingTimeMinutes);
  }
  
  // Apply min/max constraints
  readingTimeMinutes = Math.max(readingTimeMinutes, minReadTime);
  if (maxReadTime > 0) {
    readingTimeMinutes = Math.min(readingTimeMinutes, maxReadTime);
  }

  return {
    minutes: readingTimeMinutes,
    wordCount,
    text: `${readingTimeMinutes} min read`,
    seconds: Math.round(readingTimeSeconds),
  };
}

/**
 * Calculate reading time for HTML content
 * @param html - HTML content
 * @param options - Calculation options
 * @returns Reading time result
 */
export function calculateReadTimeFromHTML(
  html: string,
  options: ReadTimeOptions = {}
): ReadTimeResult {
  const {
    includeImageTime = true,
    secondsPerImage = 12,
  } = options;

  if (!html || typeof html !== 'string') {
    return calculateReadTimeFromText('', options);
  }

  // Remove HTML tags to get plain text
  let plainText = html.replace(/<[^>]*>/g, ' ');
  
  // Decode common HTML entities
  plainText = plainText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Calculate base reading time from text
  const textResult = calculateReadTimeFromText(plainText, options);

  // Count images if includeImageTime is enabled
  let imageCount = 0;
  let imageTimeSeconds = 0;

  if (includeImageTime) {
    // Count img tags
    const imgMatches = html.match(/<img[^>]*>/gi);
    imageCount = imgMatches ? imgMatches.length : 0;
    imageTimeSeconds = imageCount * secondsPerImage;
  }

  // Add image viewing time to total
  const totalSeconds = textResult.seconds + imageTimeSeconds;
  let totalMinutes = Math.ceil(totalSeconds / 60);
  
  // Apply min/max constraints
  const { minReadTime = 1, maxReadTime = 0 } = options;
  totalMinutes = Math.max(totalMinutes, minReadTime);
  if (maxReadTime > 0) {
    totalMinutes = Math.min(totalMinutes, maxReadTime);
  }

  return {
    minutes: totalMinutes,
    wordCount: textResult.wordCount,
    imageCount,
    text: `${totalMinutes} min read`,
    seconds: totalSeconds,
  };
}

/**
 * Calculate reading time for Markdown content
 * @param markdown - Markdown content
 * @param options - Calculation options
 * @returns Reading time result
 */
export function calculateReadTimeFromMarkdown(
  markdown: string,
  options: ReadTimeOptions = {}
): ReadTimeResult {
  const {
    includeImageTime = true,
    secondsPerImage = 12,
  } = options;

  if (!markdown || typeof markdown !== 'string') {
    return calculateReadTimeFromText('', options);
  }

  let content = markdown;

  // Remove code blocks (they read faster than regular text)
  content = content.replace(/```[\s\S]*?```/g, '');
  content = content.replace(/`[^`]*`/g, '');

  // Remove markdown syntax but keep the text
  content = content
    // Remove headers but keep text
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers but keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove reference links
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes markers but keep text
    .replace(/^>\s*/gm, '')
    // Remove list markers but keep text
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove table syntax
    .replace(/\|/g, ' ')
    .replace(/^[-:|\s]+$/gm, '');

  // Calculate base reading time from cleaned text
  const textResult = calculateReadTimeFromText(content, options);

  // Count images if includeImageTime is enabled
  let imageCount = 0;
  let imageTimeSeconds = 0;

  if (includeImageTime) {
    // Count markdown images: ![alt](url)
    const imgMatches = markdown.match(/!\[[^\]]*\]\([^)]+\)/g);
    imageCount = imgMatches ? imgMatches.length : 0;
    imageTimeSeconds = imageCount * secondsPerImage;
  }

  // Add image viewing time to total
  const totalSeconds = textResult.seconds + imageTimeSeconds;
  let totalMinutes = Math.ceil(totalSeconds / 60);
  
  // Apply min/max constraints
  const { minReadTime = 1, maxReadTime = 0 } = options;
  totalMinutes = Math.max(totalMinutes, minReadTime);
  if (maxReadTime > 0) {
    totalMinutes = Math.min(totalMinutes, maxReadTime);
  }

  return {
    minutes: totalMinutes,
    wordCount: textResult.wordCount,
    imageCount,
    text: `${totalMinutes} min read`,
    seconds: totalSeconds,
  };
}

/**
 * Auto-detect content type and calculate reading time
 * @param content - Content to analyze
 * @param options - Calculation options
 * @returns Reading time result
 */
export function calculateReadTime(
  content: string,
  options: ReadTimeOptions = {}
): ReadTimeResult {
  if (!content || typeof content !== 'string') {
    return calculateReadTimeFromText('', options);
  }

  // Detect content type based on patterns
  const hasHTMLTags = /<[^>]+>/g.test(content);
  const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^\*|^\[.*\]\(|^>\s|^[-*+]\s|^\d+\.\s/m.test(content);

  if (hasHTMLTags) {
    return calculateReadTimeFromHTML(content, options);
  } else if (hasMarkdownSyntax) {
    return calculateReadTimeFromMarkdown(content, options);
  } else {
    return calculateReadTimeFromText(content, options);
  }
}

/**
 * Get reading speed category based on words per minute
 * @param wordsPerMinute - Reading speed in WPM
 * @returns Speed category
 */
export function getReadingSpeedCategory(wordsPerMinute: number): string {
  if (wordsPerMinute < 200) return 'slow';
  if (wordsPerMinute < 250) return 'average';
  if (wordsPerMinute < 300) return 'fast';
  return 'very-fast';
}

/**
 * Get recommended words per minute based on content type
 * @param contentType - Type of content
 * @returns Recommended WPM
 */
export function getRecommendedWPM(contentType: 'technical' | 'casual' | 'academic' | 'fiction'): number {
  switch (contentType) {
    case 'technical':
      return 200; // Technical content is read slower
    case 'academic':
      return 210; // Academic content requires more focus
    case 'casual':
      return 250; // Blog posts, news articles
    case 'fiction':
      return 275; // Stories are read faster
    default:
      return 225; // Default average
  }
}

/**
 * Format reading time for display
 * @param minutes - Reading time in minutes
 * @param format - Display format
 * @returns Formatted string
 */
export function formatReadTime(
  minutes: number,
  format: 'short' | 'long' | 'detailed' = 'short'
): string {
  if (minutes < 1) {
    return format === 'long' ? 'Less than a minute' : '< 1 min';
  }

  switch (format) {
    case 'short':
      return `${minutes} min`;
    case 'long':
      return minutes === 1 ? '1 minute read' : `${minutes} minutes read`;
    case 'detailed':
      if (minutes < 60) {
        return minutes === 1 ? '1 minute' : `${minutes} minutes`;
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
          return hours === 1 ? '1 hour' : `${hours} hours`;
        } else {
          return `${hours}h ${remainingMinutes}m`;
        }
      }
    default:
      return `${minutes} min`;
  }
}

/**
 * Batch calculate reading times for multiple content pieces
 * @param contents - Array of content strings
 * @param options - Calculation options
 * @returns Array of reading time results
 */
export function batchCalculateReadTime(
  contents: string[],
  options: ReadTimeOptions = {}
): ReadTimeResult[] {
  return contents.map(content => calculateReadTime(content, options));
}

export default {
  calculateReadTime,
  calculateReadTimeFromText,
  calculateReadTimeFromHTML,
  calculateReadTimeFromMarkdown,
  getReadingSpeedCategory,
  getRecommendedWPM,
  formatReadTime,
  batchCalculateReadTime,
};