import { createDecipheriv } from 'crypto';

interface EnvelopeV1Payload {
  version?: string;
  v?: string;
  alg?: string;
  kid?: string;
  iv?: string;
  ciphertext?: string;
  ct?: string;
  tag?: string;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function decodeBase64Flexible(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4;
  const padded = padLength === 0
    ? normalized
    : `${normalized}${'='.repeat(4 - padLength)}`;
  return Buffer.from(padded, 'base64');
}

function parseEnvelopeFromJson(raw: string): EnvelopeV1Payload | null {
  if (!raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed as EnvelopeV1Payload;
  } catch {
    return null;
  }
}

function parseEnvelopeFromCompact(raw: string): EnvelopeV1Payload | null {
  if (!raw.startsWith('enc:v1:')) return null;
  const parts = raw.split(':');
  if (parts.length < 5) return null;
  return {
    version: 'v1',
    alg: 'aes-256-gcm',
    iv: parts[2],
    ciphertext: parts[3],
    tag: parts[4],
  };
}

function parseEnvelope(raw: string): EnvelopeV1Payload | null {
  return parseEnvelopeFromJson(raw) || parseEnvelopeFromCompact(raw);
}

function loadEnvelopeKey(): Buffer {
  const keyB64 = process.env.TRADIER_CREDENTIAL_ENVELOPE_KEY_B64
    || process.env.BROKER_CREDENTIAL_ENVELOPE_KEY_B64
    || '';
  const trimmed = keyB64.trim();
  if (!trimmed) {
    throw new Error('Tradier credential envelope key is not configured.');
  }
  const key = decodeBase64Flexible(trimmed);
  if (key.length !== 32) {
    throw new Error(`Tradier credential envelope key must be 32 bytes (received ${key.length}).`);
  }
  return key;
}

function decryptEnvelopeToken(envelope: EnvelopeV1Payload): string {
  const version = (envelope.version || envelope.v || '').trim().toLowerCase();
  if (version && version !== 'v1') {
    throw new Error(`Unsupported Tradier credential envelope version: ${version}`);
  }

  const algorithm = (envelope.alg || 'aes-256-gcm').trim().toLowerCase();
  if (algorithm !== 'aes-256-gcm') {
    throw new Error(`Unsupported Tradier credential algorithm: ${algorithm}`);
  }

  const ivEncoded = (envelope.iv || '').trim();
  const ciphertextEncoded = (envelope.ciphertext || envelope.ct || '').trim();
  const tagEncoded = (envelope.tag || '').trim();
  if (!ivEncoded || !ciphertextEncoded || !tagEncoded) {
    throw new Error('Tradier credential envelope is missing iv/ciphertext/tag.');
  }

  const key = loadEnvelopeKey();
  const iv = decodeBase64Flexible(ivEncoded);
  const ciphertext = decodeBase64Flexible(ciphertextEncoded);
  const tag = decodeBase64Flexible(tagEncoded);
  if (tag.length !== 16) {
    throw new Error(`Tradier credential envelope auth tag must be 16 bytes (received ${tag.length}).`);
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8').trim();

  if (!token) {
    throw new Error('Tradier credential envelope decrypted to an empty token.');
  }
  return token;
}

export function decryptTradierAccessToken(ciphertext: string): string {
  const raw = typeof ciphertext === 'string' ? ciphertext.trim() : '';
  if (!raw) {
    throw new Error('Tradier credential ciphertext is empty.');
  }

  const envelope = parseEnvelope(raw);
  if (envelope) {
    return decryptEnvelopeToken(envelope);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const allowPlaintextInProd = parseBooleanEnv(
    process.env.TRADIER_ALLOW_PLAINTEXT_CREDENTIALS,
    false,
  );
  if (isProduction && !allowPlaintextInProd) {
    throw new Error('Plaintext Tradier credentials are not allowed in production.');
  }

  return raw;
}

export function isTradierProductionRuntimeEnabled(input: {
  baseEnabled: boolean;
  productionEnableEnv: string | undefined;
}): { enabled: boolean; reason: string | null } {
  if (!input.baseEnabled) {
    return { enabled: false, reason: 'disabled_via_base_flag' };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return { enabled: true, reason: null };
  }

  const prodEnabled = parseBooleanEnv(input.productionEnableEnv, false);
  if (!prodEnabled) {
    return { enabled: false, reason: 'production_enable_flag_required' };
  }

  return { enabled: true, reason: null };
}

export const __tradierCredentialTestUtils = {
  parseEnvelopeFromCompact,
  parseEnvelopeFromJson,
  decryptEnvelopeToken,
};
