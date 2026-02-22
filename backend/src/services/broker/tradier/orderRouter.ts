import type { TradierOrderPayload } from './client';

export interface TradierEntryOrderInput {
  symbol: string;
  quantity: number;
  limitPrice: number;
  tag?: string;
}

export interface TradierScaleOrderInput {
  symbol: string;
  quantity: number;
  limitPrice: number;
  tag?: string;
}

export interface TradierStopOrderInput {
  symbol: string;
  quantity: number;
  stopPrice: number;
  limitPrice?: number;
  tag?: string;
}

export function buildTradierEntryOrder(input: TradierEntryOrderInput): TradierOrderPayload {
  return {
    class: 'option',
    symbol: input.symbol,
    side: 'buy_to_open',
    quantity: Math.max(1, Math.floor(input.quantity)),
    type: 'limit',
    duration: 'day',
    price: Number(input.limitPrice.toFixed(2)),
    tag: input.tag,
  };
}

export function buildTradierScaleOrder(input: TradierScaleOrderInput): TradierOrderPayload {
  return {
    class: 'option',
    symbol: input.symbol,
    side: 'sell_to_close',
    quantity: Math.max(1, Math.floor(input.quantity)),
    type: 'limit',
    duration: 'day',
    price: Number(input.limitPrice.toFixed(2)),
    tag: input.tag,
  };
}

export function buildTradierRunnerStopOrder(input: TradierStopOrderInput): TradierOrderPayload {
  const stop = Number(input.stopPrice.toFixed(2));
  if (typeof input.limitPrice === 'number' && Number.isFinite(input.limitPrice)) {
    return {
      class: 'option',
      symbol: input.symbol,
      side: 'sell_to_close',
      quantity: Math.max(1, Math.floor(input.quantity)),
      type: 'stop_limit',
      duration: 'day',
      stop,
      price: Number(input.limitPrice.toFixed(2)),
      tag: input.tag,
    };
  }

  return {
    class: 'option',
    symbol: input.symbol,
    side: 'sell_to_close',
    quantity: Math.max(1, Math.floor(input.quantity)),
    type: 'stop',
    duration: 'day',
    stop,
    tag: input.tag,
  };
}
