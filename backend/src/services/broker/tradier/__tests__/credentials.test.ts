import { createCipheriv } from 'crypto';
import { decryptTradierAccessToken, isTradierProductionRuntimeEnabled } from '../credentials';

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('tradier/credentials', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('decrypts compact envelope credentials', () => {
    const key = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(12, 3);
    const token = 'tradier-token-123';

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    process.env.TRADIER_CREDENTIAL_ENVELOPE_KEY_B64 = key.toString('base64');
    process.env.NODE_ENV = 'production';
    const compact = `enc:v1:${toBase64Url(iv)}:${toBase64Url(ciphertext)}:${toBase64Url(tag)}`;

    expect(decryptTradierAccessToken(compact)).toBe(token);
  });

  it('blocks plaintext credentials in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRADIER_ALLOW_PLAINTEXT_CREDENTIALS;

    expect(() => decryptTradierAccessToken('plain-token')).toThrow('Plaintext Tradier credentials are not allowed in production.');
  });

  it('allows plaintext credentials in production when explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRADIER_ALLOW_PLAINTEXT_CREDENTIALS = 'true';

    expect(decryptTradierAccessToken('plain-token')).toBe('plain-token');
  });

  it('requires explicit production runtime enablement when base feature flag is enabled', () => {
    process.env.NODE_ENV = 'production';

    expect(isTradierProductionRuntimeEnabled({
      baseEnabled: true,
      productionEnableEnv: 'false',
    })).toEqual({
      enabled: false,
      reason: 'production_enable_flag_required',
    });

    expect(isTradierProductionRuntimeEnabled({
      baseEnabled: true,
      productionEnableEnv: 'true',
    })).toEqual({
      enabled: true,
      reason: null,
    });
  });
});
