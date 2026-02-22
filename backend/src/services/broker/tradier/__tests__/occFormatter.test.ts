import {
  formatTradierOccSymbol,
  massiveTickerToTradierOcc,
  parseTradierOccSymbol,
  tradierOccToMassiveTicker,
} from '../occFormatter';

describe('tradier/occFormatter', () => {
  it('formats OCC symbols from contract inputs', () => {
    const occ = formatTradierOccSymbol({
      underlying: 'SPXW',
      expiry: '2026-02-20',
      optionType: 'call',
      strike: 6870,
    });

    expect(occ).toBe('SPXW260220C06870000');
  });

  it('parses OCC symbols to contract inputs', () => {
    const contract = parseTradierOccSymbol('SPXW260220P06865000');
    expect(contract).toEqual({
      underlying: 'SPXW',
      expiry: '2026-02-20',
      optionType: 'put',
      strike: 6865,
    });
  });

  it('converts between Massive and Tradier formats', () => {
    expect(massiveTickerToTradierOcc('O:SPXW260220C06870000')).toBe('SPXW260220C06870000');
    expect(tradierOccToMassiveTicker('SPXW260220C06870000')).toBe('O:SPXW260220C06870000');
  });

  it('rejects malformed symbols', () => {
    expect(() => parseTradierOccSymbol('SPX-BAD')).toThrow('Invalid OCC symbol');
    expect(() => massiveTickerToTradierOcc('SPX-BAD')).toThrow('Invalid Massive option ticker');
  });
});
