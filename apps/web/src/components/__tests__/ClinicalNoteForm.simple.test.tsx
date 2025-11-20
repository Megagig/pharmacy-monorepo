import { describe, it, expect } from 'vitest';

describe('ClinicalNoteForm Import', () => {
  it('should import without errors', async () => {
    const { default: ClinicalNoteForm } = await import('../ClinicalNoteForm');
    expect(ClinicalNoteForm).toBeDefined();
  });
});
