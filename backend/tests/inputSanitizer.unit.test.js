import { sanitizeInput } from '../src/utils/inputSanitizer.js';

describe('Unit Tests: Input Sanitizer & Data Validation Utility', () => {
  test('should sanitize string inputs by trimming whitespace', () => {
    const raw = {
      firstName: '  John  ',
      lastName: '  Doe  ',
      email: '   JOHN.DOE@EXAMPLE.COM   ',
    };
    const sanitized = sanitizeInput(raw);
    expect(sanitized.firstName).toBe('John');
    expect(sanitized.lastName).toBe('Doe');
    expect(sanitized.email).toBe('john.doe@example.com');
  });

  test('should format phone numbers by stripping non-digit characters', () => {
    const raw = {
      phone: '+63 (917) 123-4567',
      receptionistPhone: '0917-999-8888',
      emergencyContact: {
        name: 'Jane Doe',
        phone: '(02) 8123-4567',
      },
    };
    const sanitized = sanitizeInput(raw);
    expect(sanitized.phone).toBe('639171234567');
    expect(sanitized.receptionistPhone).toBe('09179998888');
    expect(sanitized.emergencyContact.phone).toBe('0281234567');
  });

  test('should preserve non-string values intact', () => {
    const raw = {
      age: 30,
      isInsured: true,
      tags: ['cardiology', 'general'],
    };
    const sanitized = sanitizeInput(raw);
    expect(sanitized.age).toBe(30);
    expect(sanitized.isInsured).toBe(true);
    expect(sanitized.tags).toEqual(['cardiology', 'general']);
  });

  test('should handle empty or null payload gracefully', () => {
    expect(sanitizeInput(null)).toEqual({});
    expect(sanitizeInput(undefined)).toEqual({});
    expect(sanitizeInput({})).toEqual({});
  });
});
