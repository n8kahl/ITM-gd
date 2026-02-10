import { sanitizeUserMessage, validateImagePayload } from '../sanitize-input';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('sanitizeUserMessage', () => {
  it('removes control characters and collapses excessive whitespace', () => {
    const input = '  hello\u0000\u0001\t world  \n\n\n second\t\tline \u0007 ';
    const sanitized = sanitizeUserMessage(input);

    expect(sanitized).toBe('hello world\n\nsecond line');
  });

  it('enforces an 8000 character max length', () => {
    const input = 'a'.repeat(8_500);
    const sanitized = sanitizeUserMessage(input);

    expect(sanitized).toHaveLength(8_000);
  });
});

describe('validateImagePayload', () => {
  it('accepts valid PNG data URLs', () => {
    const payload = `data:image/png;base64,${PNG_SIGNATURE.toString('base64')}`;
    expect(validateImagePayload(payload)).toBe(true);
  });

  it('accepts valid raw base64 image payloads', () => {
    expect(validateImagePayload(PNG_SIGNATURE.toString('base64'))).toBe(true);
  });

  it('rejects unsupported MIME types', () => {
    const payload = `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`;
    expect(validateImagePayload(payload)).toBe(false);
  });

  it('rejects invalid base64 payloads', () => {
    expect(validateImagePayload('data:image/png;base64,not-base64!!')).toBe(false);
  });

  it('rejects payloads larger than 10MB', () => {
    const oversizedBuffer = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(10 * 1024 * 1024)]);
    const payload = `data:image/png;base64,${oversizedBuffer.toString('base64')}`;
    expect(validateImagePayload(payload)).toBe(false);
  });
});
