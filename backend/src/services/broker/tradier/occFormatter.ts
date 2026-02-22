export type TradierOptionType = 'call' | 'put';

export interface TradierOccContract {
  underlying: string;
  expiry: string; // YYYY-MM-DD
  optionType: TradierOptionType;
  strike: number;
}

const OCC_PATTERN = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

function normalizeUnderlying(underlying: string): string {
  return underlying.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function toCompactExpiry(expiry: string): string {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!parsed) {
    throw new Error(`Invalid expiry format "${expiry}". Expected YYYY-MM-DD.`);
  }
  return `${parsed[1].slice(2)}${parsed[2]}${parsed[3]}`;
}

function fromCompactExpiry(compact: string): string {
  if (!/^\d{6}$/.test(compact)) {
    throw new Error(`Invalid compact expiry "${compact}".`);
  }
  const yy = Number(compact.slice(0, 2));
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const mm = compact.slice(2, 4);
  const dd = compact.slice(4, 6);
  return `${year.toString().padStart(4, '0')}-${mm}-${dd}`;
}

function strikeToOcc(strike: number): string {
  if (!Number.isFinite(strike) || strike <= 0) {
    throw new Error(`Invalid strike "${strike}".`);
  }
  return Math.round(strike * 1000).toString().padStart(8, '0');
}

function strikeFromOcc(strikePart: string): number {
  if (!/^\d{8}$/.test(strikePart)) {
    throw new Error(`Invalid OCC strike "${strikePart}".`);
  }
  return Number(strikePart) / 1000;
}

export function formatTradierOccSymbol(input: TradierOccContract): string {
  const underlying = normalizeUnderlying(input.underlying);
  if (!underlying) {
    throw new Error('Underlying cannot be empty.');
  }
  const expiry = toCompactExpiry(input.expiry);
  const cp = input.optionType === 'call' ? 'C' : 'P';
  const strike = strikeToOcc(input.strike);
  return `${underlying}${expiry}${cp}${strike}`;
}

export function parseTradierOccSymbol(occSymbol: string): TradierOccContract {
  const normalized = occSymbol.trim().toUpperCase().replace(/^O:/, '');
  const match = OCC_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(`Invalid OCC symbol "${occSymbol}".`);
  }

  return {
    underlying: match[1],
    expiry: fromCompactExpiry(match[2]),
    optionType: match[3] === 'C' ? 'call' : 'put',
    strike: strikeFromOcc(match[4]),
  };
}

export function massiveTickerToTradierOcc(massiveTicker: string): string {
  const normalized = massiveTicker.trim().toUpperCase();
  const stripped = normalized.replace(/^O:/, '');
  if (!OCC_PATTERN.test(stripped)) {
    throw new Error(`Invalid Massive option ticker "${massiveTicker}".`);
  }
  return stripped;
}

export function tradierOccToMassiveTicker(occSymbol: string): string {
  const normalized = occSymbol.trim().toUpperCase().replace(/^O:/, '');
  if (!OCC_PATTERN.test(normalized)) {
    throw new Error(`Invalid OCC symbol "${occSymbol}".`);
  }
  return `O:${normalized}`;
}
