/**
 * Slug Generation Utility Unit Tests
 * Tests slug generation, uniqueness checking, and validation functions
 * Requirements: 1.1, 2.8
 */

/// <reference types="jest" />

import mongoose from 'mongoose';
import {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
  updateSlugIfNeeded,
  generateUniqueSlugs,
} from '../../utils/slugify';

// Mock Mongoose model for testing
interface MockDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
}

const mockModel = {
  findOne: jest.fn(),
  exists: jest.fn(),
} as any;

describe('Slug Generation Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSlug', () => {
    it('should generate basic slug from title', () => {
      // Act & Assert
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('The Quick Brown Fox')).toBe('the-quick-brown-fox');
      expect(generateSlug('JavaScript is Awesome')).toBe('javascript-is-awesome');
    });

    it('should handle special characters', () => {
      // Act & Assert
      expect(generateSlug('Hello, World!')).toBe('hello-world');
      expect(generateSlug('C++ Programming & Design')).toBe('c-programming-design');
      expect(generateSlug('Node.js & Express.js Tutorial')).toBe('nodejs-expressjs-tutorial');
      expect(generateSlug('100% Success Rate')).toBe('100-success-rate');
    });

    it('should handle multiple spaces and separators', () => {
      // Act & Assert
      expect(generateSlug('Hello    World')).toBe('hello-world');
      expect(generateSlug('Hello---World')).toBe('hello-world');
      expect(generateSlug('Hello___World')).toBe('hello-world');
      expect(generateSlug('Hello - World - Test')).toBe('hello-world-test');
    });

    it('should trim leading and trailing separators', () => {
      // Act & Assert
      expect(generateSlug('  Hello World  ')).toBe('hello-world');
      expect(generateSlug('-Hello World-')).toBe('hello-world');
      expect(generateSlug('___Hello World___')).toBe('hello-world');
    });

    it('should handle empty or invalid input', () => {
      // Act & Assert
      expect(generateSlug('')).toBe('');
      expect(generateSlug('   ')).toBe('');
      expect(generateSlug(null as any)).toBe('');
      expect(generateSlug(undefined as any)).toBe('');
      expect(generateSlug(123 as any)).toBe('');
    });

    it('should respect maxLength option', () => {
      // Arrange
      const longTitle = 'This is a very long title that should be truncated to fit within the maximum length limit';
      
      // Act
      const slug = generateSlug(longTitle, { maxLength: 30 });
      
      // Assert
      expect(slug.length).toBeLessThanOrEqual(30);
      expect(slug).toBe('this-is-a-very-long-title');
    });

    it('should use custom separator', () => {
      // Act & Assert
      expect(generateSlug('Hello World', { separator: '_' })).toBe('hello_world');
      expect(generateSlug('Hello World', { separator: '.' })).toBe('hello.world');
    });

    it('should handle uppercase option', () => {
      // Act & Assert
      expect(generateSlug('Hello World', { lowercase: false })).toBe('Hello-World');
      expect(generateSlug('JavaScript Tutorial', { lowercase: false })).toBe('JavaScript-Tutorial');
    });

    it('should handle trim option', () => {
      // Act & Assert
      expect(generateSlug('-Hello World-', { trim: false })).toBe('-hello-world-');
      expect(generateSlug('  Hello World  ', { trim: false })).toBe('hello-world');
    });

    it('should handle Unicode characters', () => {
      // Act & Assert
      expect(generateSlug('Café & Restaurant')).toBe('caf-restaurant');
      expect(generateSlug('Naïve Approach')).toBe('nave-approach');
      expect(generateSlug('Résumé Template')).toBe('rsum-template');
    });

    it('should handle numbers correctly', () => {
      // Act & Assert
      expect(generateSlug('Top 10 Tips')).toBe('top-10-tips');
      expect(generateSlug('Version 2.0 Release')).toBe('version-20-release');
      expect(generateSlug('COVID-19 Updates')).toBe('covid-19-updates');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should return original slug if unique', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const slug = await generateUniqueSlug('Hello World', mockModel);
      
      // Assert
      expect(slug).toBe('hello-world');
      expect(mockModel.findOne).toHaveBeenCalledWith({ slug: 'hello-world' });
    });

    it('should append number if slug exists', async () => {
      // Arrange
      mockModel.findOne
        .mockResolvedValueOnce({ _id: 'existing1' }) // First slug exists
        .mockResolvedValueOnce({ _id: 'existing2' }) // Second slug exists
        .mockResolvedValueOnce(null); // Third slug is unique
      
      // Act
      const slug = await generateUniqueSlug('Hello World', mockModel);
      
      // Assert
      expect(slug).toBe('hello-world-2');
      expect(mockModel.findOne).toHaveBeenCalledTimes(3);
    });

    it('should exclude current document ID when updating', async () => {
      // Arrange
      const excludeId = new mongoose.Types.ObjectId();
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const slug = await generateUniqueSlug('Hello World', mockModel, 'slug', excludeId);
      
      // Assert
      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'hello-world',
        _id: { $ne: excludeId }
      });
    });

    it('should use custom field name', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const slug = await generateUniqueSlug('Hello World', mockModel, 'customSlug');
      
      // Assert
      expect(mockModel.findOne).toHaveBeenCalledWith({ customSlug: 'hello-world' });
    });

    it('should throw error for empty title', async () => {
      // Act & Assert
      await expect(generateUniqueSlug('', mockModel)).rejects.toThrow('Cannot generate slug from empty or invalid title');
      await expect(generateUniqueSlug('   ', mockModel)).rejects.toThrow('Cannot generate slug from empty or invalid title');
    });

    it('should throw error after max attempts', async () => {
      // Arrange
      mockModel.findOne.mockResolvedValue({ _id: 'existing' }); // Always return existing
      
      // Act & Assert
      await expect(generateUniqueSlug('Hello World', mockModel)).rejects.toThrow('Could not generate unique slug after 100 attempts');
    });

    it('should handle database errors', async () => {
      // Arrange
      mockModel.findOne.mockRejectedValue(new Error('Database connection failed'));
      
      // Act & Assert
      await expect(generateUniqueSlug('Hello World', mockModel)).rejects.toThrow('Error checking slug uniqueness');
    });

    it('should work with string exclude ID', async () => {
      // Arrange
      const excludeId = '507f1f77bcf86cd799439011';
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const slug = await generateUniqueSlug('Hello World', mockModel, 'slug', excludeId);
      
      // Assert
      expect(mockModel.findOne).toHaveBeenCalledWith({
        slug: 'hello-world',
        _id: { $ne: excludeId }
      });
    });
  });

  describe('isValidSlug', () => {
    it('should validate correct slug format', () => {
      // Act & Assert
      expect(isValidSlug('hello-world')).toBe(true);
      expect(isValidSlug('javascript-tutorial')).toBe(true);
      expect(isValidSlug('top-10-tips')).toBe(true);
      expect(isValidSlug('covid-19-updates')).toBe(true);
    });

    it('should reject invalid characters', () => {
      // Act & Assert
      expect(isValidSlug('hello world')).toBe(false); // Spaces
      expect(isValidSlug('hello_world')).toBe(false); // Underscores (default separator is -)
      expect(isValidSlug('hello.world')).toBe(false); // Dots
      expect(isValidSlug('hello@world')).toBe(false); // Special characters
      expect(isValidSlug('hello/world')).toBe(false); // Slashes
    });

    it('should reject uppercase letters by default', () => {
      // Act & Assert
      expect(isValidSlug('Hello-World')).toBe(false);
      expect(isValidSlug('JavaScript-Tutorial')).toBe(false);
    });

    it('should allow uppercase when specified', () => {
      // Act & Assert
      expect(isValidSlug('Hello-World', { allowUppercase: true })).toBe(true);
      expect(isValidSlug('JavaScript-Tutorial', { allowUppercase: true })).toBe(true);
    });

    it('should reject leading/trailing separators', () => {
      // Act & Assert
      expect(isValidSlug('-hello-world')).toBe(false);
      expect(isValidSlug('hello-world-')).toBe(false);
      expect(isValidSlug('-hello-world-')).toBe(false);
    });

    it('should reject consecutive separators', () => {
      // Act & Assert
      expect(isValidSlug('hello--world')).toBe(false);
      expect(isValidSlug('hello---world')).toBe(false);
    });

    it('should validate length constraints', () => {
      // Act & Assert
      expect(isValidSlug('', { minLength: 1 })).toBe(false);
      expect(isValidSlug('a', { minLength: 2 })).toBe(false);
      expect(isValidSlug('hello-world', { maxLength: 5 })).toBe(false);
      expect(isValidSlug('hello', { minLength: 3, maxLength: 10 })).toBe(true);
    });

    it('should handle custom separator', () => {
      // Act & Assert
      expect(isValidSlug('hello_world', { separator: '_' })).toBe(true);
      expect(isValidSlug('hello.world', { separator: '.' })).toBe(true);
      expect(isValidSlug('hello-world', { separator: '_' })).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      // Act & Assert
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug(null as any)).toBe(false);
      expect(isValidSlug(undefined as any)).toBe(false);
      expect(isValidSlug(123 as any)).toBe(false);
    });

    it('should handle special separator characters that need escaping', () => {
      // Act & Assert
      expect(isValidSlug('hello.world', { separator: '.' })).toBe(true);
      expect(isValidSlug('hello+world', { separator: '+' })).toBe(true);
      expect(isValidSlug('hello*world', { separator: '*' })).toBe(true);
    });
  });

  describe('updateSlugIfNeeded', () => {
    let mockDocument: any;

    beforeEach(() => {
      mockDocument = {
        _id: new mongoose.Types.ObjectId(),
        title: 'New Title',
        slug: 'old-slug',
        isModified: jest.fn(),
      };
    });

    it('should update slug when title is modified', async () => {
      // Arrange
      mockDocument.isModified.mockReturnValue(true);
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const newSlug = await updateSlugIfNeeded(mockDocument, mockModel);
      
      // Assert
      expect(newSlug).toBe('new-title');
      expect(mockDocument.slug).toBe('new-title');
    });

    it('should return null when title is not modified', async () => {
      // Arrange
      mockDocument.isModified.mockReturnValue(false);
      
      // Act
      const newSlug = await updateSlugIfNeeded(mockDocument, mockModel);
      
      // Assert
      expect(newSlug).toBeNull();
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it('should return null when document has no isModified method', async () => {
      // Arrange
      delete mockDocument.isModified;
      
      // Act
      const newSlug = await updateSlugIfNeeded(mockDocument, mockModel);
      
      // Assert
      expect(newSlug).toBeNull();
    });

    it('should return null when title is empty', async () => {
      // Arrange
      mockDocument.title = '';
      mockDocument.isModified.mockReturnValue(true);
      
      // Act
      const newSlug = await updateSlugIfNeeded(mockDocument, mockModel);
      
      // Assert
      expect(newSlug).toBeNull();
    });

    it('should use custom field names', async () => {
      // Arrange
      mockDocument.customTitle = 'Custom Title';
      mockDocument.customSlug = 'old-custom-slug';
      mockDocument.isModified.mockImplementation((field: string) => field === 'customTitle');
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const newSlug = await updateSlugIfNeeded(
        mockDocument,
        mockModel,
        'customTitle',
        'customSlug'
      );
      
      // Assert
      expect(newSlug).toBe('custom-title');
      expect(mockDocument.customSlug).toBe('custom-title');
    });

    it('should handle errors during slug generation', async () => {
      // Arrange
      mockDocument.isModified.mockReturnValue(true);
      mockModel.findOne.mockRejectedValue(new Error('Database error'));
      
      // Act & Assert
      await expect(updateSlugIfNeeded(mockDocument, mockModel)).rejects.toThrow('Failed to update slug');
    });
  });

  describe('generateUniqueSlugs', () => {
    it('should generate unique slugs for multiple titles', async () => {
      // Arrange
      const titles = ['Hello World', 'Hello World', 'JavaScript Tutorial'];
      mockModel.exists.mockResolvedValue(null); // No existing slugs
      
      // Act
      const slugs = await generateUniqueSlugs(titles, mockModel);
      
      // Assert
      expect(slugs).toEqual(['hello-world', 'hello-world-1', 'javascript-tutorial']);
    });

    it('should handle existing slugs in database', async () => {
      // Arrange
      const titles = ['Hello World', 'JavaScript Tutorial'];
      mockModel.exists
        .mockResolvedValueOnce({ _id: 'existing' }) // hello-world exists
        .mockResolvedValueOnce(null) // hello-world-1 doesn't exist
        .mockResolvedValueOnce(null); // javascript-tutorial doesn't exist
      
      // Act
      const slugs = await generateUniqueSlugs(titles, mockModel);
      
      // Assert
      expect(slugs).toEqual(['hello-world-1', 'javascript-tutorial']);
    });

    it('should use custom field name', async () => {
      // Arrange
      const titles = ['Hello World'];
      mockModel.exists.mockResolvedValue(null);
      
      // Act
      const slugs = await generateUniqueSlugs(titles, mockModel, 'customSlug');
      
      // Assert
      expect(mockModel.exists).toHaveBeenCalledWith({ customSlug: 'hello-world' });
      expect(slugs).toEqual(['hello-world']);
    });

    it('should handle empty titles array', async () => {
      // Act
      const slugs = await generateUniqueSlugs([], mockModel);
      
      // Assert
      expect(slugs).toEqual([]);
      expect(mockModel.exists).not.toHaveBeenCalled();
    });

    it('should pass options to slug generation', async () => {
      // Arrange
      const titles = ['Hello World'];
      mockModel.exists.mockResolvedValue(null);
      
      // Act
      const slugs = await generateUniqueSlugs(titles, mockModel, 'slug', { separator: '_' });
      
      // Assert
      expect(slugs).toEqual(['hello_world']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long titles gracefully', async () => {
      // Arrange
      const veryLongTitle = 'A'.repeat(1000);
      mockModel.findOne.mockResolvedValue(null);
      
      // Act
      const slug = await generateUniqueSlug(veryLongTitle, mockModel);
      
      // Assert
      expect(slug.length).toBeLessThanOrEqual(100); // Default max length
      expect(slug).toMatch(/^a+$/); // Should be all 'a's
    });

    it('should handle titles with only special characters', () => {
      // Act & Assert
      expect(generateSlug('!@#$%^&*()')).toBe('');
      expect(generateSlug('---')).toBe('');
      expect(generateSlug('...')).toBe('');
    });

    it('should handle mixed language characters', () => {
      // Act & Assert
      expect(generateSlug('Hello 世界')).toBe('hello');
      expect(generateSlug('Café & 咖啡')).toBe('caf');
    });

    it('should handle numeric-only titles', () => {
      // Act & Assert
      expect(generateSlug('123456')).toBe('123456');
      expect(generateSlug('2023-2024')).toBe('2023-2024');
    });

    it('should handle titles with HTML entities', () => {
      // Act & Assert
      expect(generateSlug('AT&amp;T Corporation')).toBe('atampt-corporation');
      expect(generateSlug('Less &lt; Greater &gt;')).toBe('less-lt-greater-gt');
    });
  });
});