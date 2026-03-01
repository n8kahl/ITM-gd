export function isTradierSPXOptionSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return false;
  return normalized.startsWith('SPX') || normalized.startsWith('SPXW');
}

export function inferTradierUnderlyingFromOptionSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  const occMatch = /^([A-Z]{1,6})\d{6}[CP]\d{8}$/.exec(normalized);
  if (occMatch?.[1]) return occMatch[1];
  if (normalized.startsWith('SPXW')) return 'SPXW';
  return 'SPX';
}
