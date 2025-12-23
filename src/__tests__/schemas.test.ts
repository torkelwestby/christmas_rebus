import { ideaSchema } from '@/lib/schemas';

describe('ideaSchema', () => {
  it('should validate a complete idea', () => {
    const validIdea = {
      title: 'Test Idé',
      description: 'Dette er en testbeskrivelse',
      type: 'Inspirasjon' as const,
      stage: 'Idégenerering' as const,
      submitter: 'Test Bruker',
      imageUrl: 'https://example.com/image.jpg',
    };

    const result = ideaSchema.safeParse(validIdea);
    expect(result.success).toBe(true);
  });

  it('should validate idea without optional fields', () => {
    const minimalIdea = {
      title: 'Minimal Idé',
      description: 'Beskrivelse',
      type: 'Inspirasjon' as const,
      submitter: 'Bruker',
    };

    const result = ideaSchema.safeParse(minimalIdea);
    expect(result.success).toBe(true);
  });

  it('should reject title shorter than 2 characters', () => {
    const invalidIdea = {
      title: 'A',
      description: 'Beskrivelse',
      type: 'Inspirasjon' as const,
      submitter: 'Bruker',
    };

    const result = ideaSchema.safeParse(invalidIdea);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalidIdea = {
      title: 'Test',
      // description missing
      type: 'Inspirasjon' as const,
      submitter: 'Bruker',
    };

    const result = ideaSchema.safeParse(invalidIdea);
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const invalidIdea = {
      title: 'Test Idé',
      description: 'Beskrivelse',
      type: 'UgyldigType',
      submitter: 'Bruker',
    };

    const result = ideaSchema.safeParse(invalidIdea);
    expect(result.success).toBe(false);
  });

  it('should reject invalid imageUrl', () => {
    const invalidIdea = {
      title: 'Test Idé',
      description: 'Beskrivelse',
      type: 'Inspirasjon' as const,
      submitter: 'Bruker',
      imageUrl: 'not-a-url',
    };

    const result = ideaSchema.safeParse(invalidIdea);
    expect(result.success).toBe(false);
  });
});