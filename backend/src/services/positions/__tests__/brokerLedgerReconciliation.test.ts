import type { TradierBrokerPosition } from '../../broker/tradier/client';
import { __brokerLedgerReconciliationTestUtils } from '../brokerLedgerReconciliation';

describe('positions/brokerLedgerReconciliation', () => {
  const {
    buildInternalPositionKey,
    buildBrokerPositionKey,
    buildBrokerPositionExposureMap,
    computeReconciliationActions,
    buildForceClosePatch,
  } = __brokerLedgerReconciliationTestUtils;

  it('normalizes internal and Tradier OCC symbols to the same key', () => {
    const internalKey = buildInternalPositionKey({
      id: 'p1',
      user_id: 'u1',
      symbol: 'SPX',
      position_type: 'call',
      strike: 6870,
      expiry: '2026-02-20',
      quantity: 2,
      entry_price: 2.15,
      current_price: 2.65,
      notes: null,
    });

    const brokerKey = buildBrokerPositionKey({
      symbol: 'SPXW260220C06870000',
      quantity: 2,
      costBasis: null,
      dateAcquired: null,
      raw: {},
    });

    expect(internalKey).toBe('SPX|2026-02-20|C|6870');
    expect(brokerKey).toBe('SPX|2026-02-20|C|6870');
  });

  it('builds aggregated broker exposure by normalized key', () => {
    const positions: TradierBrokerPosition[] = [
      {
        symbol: 'SPXW260220C06870000',
        quantity: 1,
        costBasis: null,
        dateAcquired: null,
        raw: {},
      },
      {
        symbol: 'SPXW260220C06870000',
        quantity: 2,
        costBasis: null,
        dateAcquired: null,
        raw: {},
      },
    ];

    const map = buildBrokerPositionExposureMap(positions);
    expect(map.get('SPX|2026-02-20|C|6870')).toBe(3);
  });

  it('returns force-close and quantity-sync actions when broker ledger diverges', () => {
    const nowIso = '2026-02-22T22:10:00.000Z';
    const actions = computeReconciliationActions([
      {
        id: 'close-me',
        user_id: 'u1',
        symbol: 'SPX',
        position_type: 'call',
        strike: 6870,
        expiry: '2026-02-20',
        quantity: 2,
        entry_price: 2.15,
        current_price: 2.65,
        notes: null,
      },
      {
        id: 'sync-me',
        user_id: 'u1',
        symbol: 'SPX',
        position_type: 'put',
        strike: 6865,
        expiry: '2026-02-20',
        quantity: 3,
        entry_price: 3.1,
        current_price: 2.75,
        notes: null,
      },
    ], new Map([
      ['SPX|2026-02-20|P|6865', 1],
    ]), nowIso);

    expect(actions).toHaveLength(2);
    expect(actions.find((item) => item.kind === 'force_close')?.positionId).toBe('close-me');
    expect(actions.find((item) => item.kind === 'quantity_sync')?.positionId).toBe('sync-me');
  });

  it('builds force-close patch with deterministic close fields and reconciliation note', () => {
    const patch = buildForceClosePatch({
      id: 'p1',
      user_id: 'u1',
      symbol: 'SPX',
      position_type: 'call',
      strike: 6870,
      expiry: '2026-02-20',
      quantity: 2,
      entry_price: 2.0,
      current_price: 3.5,
      notes: 'prior note',
    }, '2026-02-22T22:10:00.000Z');

    expect(patch).toMatchObject({
      status: 'closed',
      close_date: '2026-02-22',
      close_price: 3.5,
      current_price: 3.5,
      current_value: 700,
      pnl: 300,
      pnl_pct: 75,
    });
    expect(String(patch.notes || '')).toContain('Auto-closed by Tradier reconciliation');
  });
});
