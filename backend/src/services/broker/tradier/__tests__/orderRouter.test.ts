import {
  buildTradierEntryOrder,
  buildTradierMarketExitOrder,
  buildTradierRunnerStopOrder,
  buildTradierScaleOrder,
} from '../orderRouter';

describe('tradier/orderRouter', () => {
  it('builds buy-to-open entry limit payloads', () => {
    const payload = buildTradierEntryOrder({
      symbol: 'SPXW260220C06870000',
      quantity: 3.8,
      limitPrice: 2.347,
      tag: 'spx-entry',
    });

    expect(payload).toEqual({
      class: 'option',
      symbol: 'SPXW',
      option_symbol: 'SPXW260220C06870000',
      side: 'buy_to_open',
      quantity: 3,
      type: 'limit',
      duration: 'day',
      price: 2.35,
      tag: 'spx-entry',
    });
  });

  it('builds sell-to-close scale-out payloads', () => {
    const payload = buildTradierScaleOrder({
      symbol: 'SPXW260220C06870000',
      quantity: 2.1,
      limitPrice: 3.111,
    });

    expect(payload).toEqual({
      class: 'option',
      symbol: 'SPXW',
      option_symbol: 'SPXW260220C06870000',
      side: 'sell_to_close',
      quantity: 2,
      type: 'limit',
      duration: 'day',
      price: 3.11,
      tag: undefined,
    });
  });

  it('builds stop-limit runner payload when limit is provided', () => {
    const payload = buildTradierRunnerStopOrder({
      symbol: 'SPXW260220C06870000',
      quantity: 1.9,
      stopPrice: 1.123,
      limitPrice: 1.0,
      tag: 'spx-runner-stop',
    });

    expect(payload).toEqual({
      class: 'option',
      symbol: 'SPXW',
      option_symbol: 'SPXW260220C06870000',
      side: 'sell_to_close',
      quantity: 1,
      type: 'stop_limit',
      duration: 'day',
      stop: 1.12,
      price: 1.0,
      tag: 'spx-runner-stop',
    });
  });

  it('builds market sell-to-close exit payload', () => {
    const payload = buildTradierMarketExitOrder({
      symbol: 'SPXW260220C06870000',
      quantity: 2.7,
      tag: 'spx-terminal',
    });

    expect(payload).toEqual({
      class: 'option',
      symbol: 'SPXW',
      option_symbol: 'SPXW260220C06870000',
      side: 'sell_to_close',
      quantity: 2,
      type: 'market',
      duration: 'day',
      tag: 'spx-terminal',
    });
  });

  it('builds pure stop runner payload when limit is omitted', () => {
    const payload = buildTradierRunnerStopOrder({
      symbol: 'SPXW260220C06870000',
      quantity: 1,
      stopPrice: 0.667,
    });

    expect(payload).toEqual({
      class: 'option',
      symbol: 'SPXW',
      option_symbol: 'SPXW260220C06870000',
      side: 'sell_to_close',
      quantity: 1,
      type: 'stop',
      duration: 'day',
      stop: 0.67,
      tag: undefined,
    });
  });
});
