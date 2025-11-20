/**
 * Read Time Calculator Utility Unit Tests
 * Tests reading time calculation for different content types
 * Requirements: 1.6, 2.8
 */

/// <reference types="jest" />

import {
  calculateReadTime,
  calculateReadTimeFromText,
  calculateReadTimeFromHTML,
  calculateReadTimeFromMarkdown,
  getReadingSpeedCategory,
  getRecommendedWPM,
  formatReadTime,
  batchCalculateReadTime,
} from '../../utils/readTimeCalculator';

describe('Read Time Calculator Utilities', () => {
  describe('calculateReadTimeFromText', () => {
    it('should calculate reading time for plain text', () => {
      // Arrange
      const text = 'This is a sample text with exactly twenty five words to test the reading time calculation functionality properly and accurately.';
      
      // Act
      const result = calculateReadTimeFromText(text);
      
      // Assert
      expect(result.wordCount).toBe(25);
      expect(result.minutes).toBe(1); // Minimum 1 minute
      expect(result.text).toBe('1 min read');
      expect(result.seconds).toBeGreaterThan(0);
    });

    it('should handle empty or invalid text', () => {
      // Act & Assert
      expect(calculateReadTimeFromText('')).toEqual({
        minutes: 1,
        wordCount: 0,
        text: '1 min read',
        seconds: 60,
      });
      
      expect(calculateReadTimeFromText(null as any)).toEqual({
        minutes: 1,
        wordCount: 0,
        text: '1 min read',
        seconds: 60,
      });
      
      expect(calculateReadTimeFromText(undefined as any)).toEqual({
        minutes: 1,
        wordCount: 0,
        text: '1 min read',
        seconds: 60,
      });
    });

    it('should calculate correct reading time for longer text', () => {
      // Arrange - Create text with approximately 450 words (2 minutes at 225 WPM)
      const words = Array(450).fill('word').join(' ');
      
      // Act
      const result = calculateReadTimeFromText(words);
      
      // Assert
      expect(result.wordCount).toBe(450);
      expect(result.minutes).toBe(2);
      expect(result.text).toBe('2 min read');
    });

    it('should respect custom words per minute', () => {
      // Arrange
      const text = Array(300).fill('word').join(' '); // 300 words
      
      // Act
      const result = calculateReadTimeFromText(text, { wordsPerMinute: 300 });
      
      // Assert
      expect(result.wordCount).toBe(300);
      expect(result.minutes).toBe(1); // 300 words at 300 WPM = 1 minute
    });

    it('should respect minimum reading time', () => {
      // Arrange
      const shortText = 'Short text';
      
      // Act
      const result = calculateReadTimeFromText(shortText, { minReadTime: 3 });
      
      // Assert
      expect(result.minutes).toBe(3);
      expect(result.text).toBe('3 min read');
    });

    it('should respect maximum reading time', () => {
      // Arrange
      const longText = Array(2250).fill('word').join(' '); // Should be ~10 minutes
      
      // Act
      const result = calculateReadTimeFromText(longText, { maxReadTime: 5 });
      
      // Assert
      expect(result.minutes).toBe(5);
      expect(result.text).toBe('5 min read');
    });

    it('should handle rounding options', () => {
      // Arrange
      const text = Array(337).fill('word').join(' '); // ~1.5 minutes at 225 WPM
      
      // Act
      const roundedUp = calculateReadTimeFromText(text, { roundUp: true });
      const rounded = calculateReadTimeFromText(text, { roundUp: false });
      
      // Assert
      expect(roundedUp.minutes).toBe(2); // Rounded up
      expect(rounded.minutes).toBe(1); // Rounded to nearest
    });

    it('should handle multiple spaces and special characters', () => {
      // Arrange
      const text = 'This   has    multiple     spaces and\nnewlines\tand\ttabs.';
      
      // Act
      const result = calculateReadTimeFromText(text);
      
      // Assert
      expect(result.wordCount).toBe(8); // Should count words correctly despite spacing
    });
  });

  describe('calculateReadTimeFromHTML', () => {
    it('should strip HTML tags and calculate reading time', () => {
      // Arrange
      const html = '<p>This is <strong>HTML</strong> content with <em>formatting</em> tags.</p>';
      
      // Act
      const result = calculateReadTimeFromHTML(html);
      
      // Assert
      expect(result.wordCount).toBe(8);
      expect(result.minutes).toBe(1);
      expect(result.imageCount).toBe(0);
    });

    it('should count images and add viewing time', () => {
      // Arrange
      const html = `
        <p>Article with images.</p>
        <img src="image1.jpg" alt="Image 1">
        <p>More content here.</p>
        <img src="image2.jpg" alt="Image 2">
      `;
      
      // Act
      const result = calculateReadTimeFromHTML(html);
      
      // Assert
      expect(result.imageCount).toBe(2);
      expect(result.seconds).toBeGreaterThan(24); // Should include 24 seconds for 2 images
    });

    it('should decode HTML entities', () => {
      // Arrange
      const html = '<p>AT&amp;T &lt;Corporation&gt; &quot;Test&quot; &#39;Quote&#39;</p>';
      
      // Act
      const result = calculateReadTimeFromHTML(html);
      
      // Assert
      expect(result.wordCount).toBe(4); // AT&T, Corporation, Test, Quote
    });

    it('should handle complex HTML structure', () => {
      // Arrange
      const html = `
        <article>
          <header>
            <h1>Article Title</h1>
            <p class="subtitle">Subtitle here</p>
          </header>
          <section>
            <p>First paragraph with <a href="#">link</a>.</p>
            <ul>
              <li>List item one</li>
              <li>List item two</li>
            </ul>
            <blockquote>Quote content here</blockquote>
          </section>
        </article>
      `;
      
      // Act
      const result = calculateReadTimeFromHTML(html);
      
      // Assert
      expect(result.wordCount).toBe(15);
      expect(result.minutes).toBe(1);
    });

    it('should handle images with includeImageTime disabled', () => {
      // Arrange
      const html = '<p>Text</p><img src="test.jpg"><p>More text</p>';
      
      // Act
      const result = calculateReadTimeFromHTML(html, { includeImageTime: false });
      
      // Assert
      expect(result.imageCount).toBe(0);
      expect(result.seconds).toBeLessThan(20); // Should not include image time
    });

    it('should handle custom seconds per image', () => {
      // Arrange
      const html = '<p>Text</p><img src="test.jpg">';
      
      // Act
      const result = calculateReadTimeFromHTML(html, { secondsPerImage: 30 });
      
      // Assert
      expect(result.imageCount).toBe(1);
      expect(result.seconds).toBeGreaterThan(30);
    });
  });

  describe('calculateReadTimeFromMarkdown', () => {
    it('should strip markdown syntax and calculate reading time', () => {
      // Arrange
      const markdown = `
# Heading
This is **bold** and *italic* text.
[Link text](http://example.com)
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(8); // Heading, This, is, bold, and, italic, text, Link, text
    });

    it('should handle code blocks', () => {
      // Arrange
      const markdown = `
Regular text here.
\`\`\`javascript
const code = 'this should be removed';
console.log(code);
\`\`\`
More regular text.
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(6); // Regular, text, here, More, regular, text
    });

    it('should handle inline code', () => {
      // Arrange
      const markdown = 'Use the `console.log()` function to debug.';
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(6); // Use, the, function, to, debug (inline code removed)
    });

    it('should count markdown images', () => {
      // Arrange
      const markdown = `
# Article
![Image 1](image1.jpg)
Some text here.
![Image 2](image2.jpg "Caption")
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.imageCount).toBe(2);
      expect(result.wordCount).toBe(4); // Article, Some, text, here
    });

    it('should handle lists', () => {
      // Arrange
      const markdown = `
- Item one
- Item two
* Item three
+ Item four

1. Numbered one
2. Numbered two
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(10); // All list items without markers
    });

    it('should handle blockquotes', () => {
      // Arrange
      const markdown = `
Regular text.
> This is a quote
> with multiple lines
Back to regular text.
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(12);
    });

    it('should handle tables', () => {
      // Arrange
      const markdown = `
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(8); // All table content without syntax
    });

    it('should handle reference links', () => {
      // Arrange
      const markdown = `
This is [link text][1] and [another link][ref].

[1]: http://example.com
[ref]: http://example.org
      `;
      
      // Act
      const result = calculateReadTimeFromMarkdown(markdown);
      
      // Assert
      expect(result.wordCount).toBe(6); // This, is, link, text, and, another, link
    });
  });

  describe('calculateReadTime (auto-detect)', () => {
    it('should detect HTML content', () => {
      // Arrange
      const content = '<p>This is HTML content</p>';
      
      // Act
      const result = calculateReadTime(content);
      
      // Assert
      expect(result.wordCount).toBe(4);
    });

    it('should detect Markdown content', () => {
      // Arrange
      const content = '# This is Markdown\n**Bold text** here.';
      
      // Act
      const result = calculateReadTime(content);
      
      // Assert
      expect(result.wordCount).toBe(6);
    });

    it('should treat as plain text when no markup detected', () => {
      // Arrange
      const content = 'This is plain text content.';
      
      // Act
      const result = calculateReadTime(content);
      
      // Assert
      expect(result.wordCount).toBe(5);
    });

    it('should handle mixed content (prefer HTML detection)', () => {
      // Arrange
      const content = '<p># This looks like both</p>';
      
      // Act
      const result = calculateReadTime(content);
      
      // Assert
      expect(result.wordCount).toBe(5); // Should be processed as HTML
    });
  });

  describe('getReadingSpeedCategory', () => {
    it('should categorize reading speeds correctly', () => {
      // Act & Assert
      expect(getReadingSpeedCategory(150)).toBe('slow');
      expect(getReadingSpeedCategory(200)).toBe('average');
      expect(getReadingSpeedCategory(225)).toBe('average');
      expect(getReadingSpeedCategory(250)).toBe('fast');
      expect(getReadingSpeedCategory(300)).toBe('very-fast');
      expect(getReadingSpeedCategory(350)).toBe('very-fast');
    });
  });

  describe('getRecommendedWPM', () => {
    it('should return appropriate WPM for content types', () => {
      // Act & Assert
      expect(getRecommendedWPM('technical')).toBe(200);
      expect(getRecommendedWPM('academic')).toBe(210);
      expect(getRecommendedWPM('casual')).toBe(250);
      expect(getRecommendedWPM('fiction')).toBe(275);
    });
  });

  describe('formatReadTime', () => {
    it('should format reading time in different formats', () => {
      // Act & Assert
      expect(formatReadTime(1, 'short')).toBe('1 min');
      expect(formatReadTime(5, 'short')).toBe('5 min');
      
      expect(formatReadTime(1, 'long')).toBe('1 minute read');
      expect(formatReadTime(5, 'long')).toBe('5 minutes read');
      
      expect(formatReadTime(1, 'detailed')).toBe('1 minute');
      expect(formatReadTime(5, 'detailed')).toBe('5 minutes');
      expect(formatReadTime(60, 'detailed')).toBe('1 hour');
      expect(formatReadTime(90, 'detailed')).toBe('1h 30m');
      expect(formatReadTime(120, 'detailed')).toBe('2 hours');
    });

    it('should handle less than 1 minute', () => {
      // Act & Assert
      expect(formatReadTime(0.5, 'short')).toBe('< 1 min');
      expect(formatReadTime(0.8, 'long')).toBe('Less than a minute');
    });
  });

  describe('batchCalculateReadTime', () => {
    it('should calculate reading time for multiple contents', () => {
      // Arrange
      const contents = [
        'Short text here.',
        '<p>HTML content with more words here.</p>',
        '# Markdown\n**Bold** content here.',
      ];
      
      // Act
      const results = batchCalculateReadTime(contents);
      
      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].wordCount).toBe(3);
      expect(results[1].wordCount).toBe(6);
      expect(results[2].wordCount).toBe(4);
    });

    it('should apply options to all contents', () => {
      // Arrange
      const contents = ['Short', 'Also short'];
      
      // Act
      const results = batchCalculateReadTime(contents, { minReadTime: 5 });
      
      // Assert
      expect(results[0].minutes).toBe(5);
      expect(results[1].minutes).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', () => {
      // Arrange
      const longContent = Array(10000).fill('word').join(' ');
      
      // Act
      const result = calculateReadTimeFromText(longContent);
      
      // Assert
      expect(result.wordCount).toBe(10000);
      expect(result.minutes).toBeGreaterThan(40); // Should be ~44 minutes at 225 WPM
    });

    it('should handle content with only punctuation', () => {
      // Arrange
      const punctuation = '!@#$%^&*().,;:"\'[]{}';
      
      // Act
      const result = calculateReadTimeFromText(punctuation);
      
      // Assert
      expect(result.wordCount).toBe(0);
      expect(result.minutes).toBe(1); // Minimum time
    });

    it('should handle content with numbers and symbols', () => {
      // Arrange
      const content = 'Price: $19.99 (20% off) - Save $5.00!';
      
      // Act
      const result = calculateReadTimeFromText(content);
      
      // Assert
      expect(result.wordCount).toBe(7); // Price, $19.99, (20%, off), Save, $5.00!
    });

    it('should handle malformed HTML', () => {
      // Arrange
      const malformedHTML = '<p>Unclosed paragraph <strong>bold text <em>italic';
      
      // Act
      const result = calculateReadTimeFromHTML(malformedHTML);
      
      // Assert
      expect(result.wordCount).toBe(4); // Should still extract text
    });

    it('should handle malformed Markdown', () => {
      // Arrange
      const malformedMarkdown = '# Heading\n**Unclosed bold\n*Unclosed italic';
      
      // Act
      const result = calculateReadTimeFromMarkdown(malformedMarkdown);
      
      // Assert
      expect(result.wordCount).toBe(4); // Should still process text
    });

    it('should handle mixed line endings', () => {
      // Arrange
      const mixedLineEndings = 'Line one\nLine two\r\nLine three\rLine four';
      
      // Act
      const result = calculateReadTimeFromText(mixedLineEndings);
      
      // Assert
      expect(result.wordCount).toBe(8);
    });

    it('should handle Unicode characters', () => {
      // Arrange
      const unicode = 'Café résumé naïve 中文 العربية русский';
      
      // Act
      const result = calculateReadTimeFromText(unicode);
      
      // Assert
      expect(result.wordCount).toBe(6);
    });
  });
});