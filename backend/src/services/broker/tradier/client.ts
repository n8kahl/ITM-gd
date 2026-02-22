import axios, { AxiosInstance } from 'axios';
import { logger } from '../../../lib/logger';

export interface TradierClientConfig {
  baseUrl?: string;
  accountId?: string;
  accessToken?: string;
  timeoutMs?: number;
  sandbox?: boolean;
}

export interface TradierBalanceSnapshot {
  totalEquity: number;
  dayTradeBuyingPower: number;
  realizedPnlDaily: number;
  raw: Record<string, unknown>;
}

export interface TradierOrderPayload {
  class: 'option';
  symbol: string;
  side: 'buy_to_open' | 'sell_to_open' | 'sell_to_close' | 'buy_to_close';
  quantity: number;
  type: 'limit' | 'market' | 'stop' | 'stop_limit';
  duration?: 'day' | 'gtc';
  price?: number;
  stop?: number;
  tag?: string;
}

export interface TradierOrderResult {
  id: string;
  status?: string;
  raw: Record<string, unknown>;
}

export interface TradierBrokerPosition {
  symbol: string;
  quantity: number;
  costBasis: number | null;
  dateAcquired: string | null;
  raw: Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function requireAccountId(value: string | undefined): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error('Tradier account id is required.');
  }
  return normalized;
}

function requireAccessToken(value: string | undefined): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error('Tradier access token is required.');
  }
  return normalized;
}

export class TradierClient {
  private readonly http: AxiosInstance;
  private readonly accountId: string;

  constructor(config?: TradierClientConfig) {
    const sandbox = config?.sandbox ?? String(process.env.TRADIER_SANDBOX || 'true').toLowerCase() !== 'false';
    const baseUrl = config?.baseUrl
      || process.env.TRADIER_BASE_URL
      || (sandbox ? 'https://sandbox.tradier.com/v1' : 'https://api.tradier.com/v1');
    const accessToken = requireAccessToken(config?.accessToken || process.env.TRADIER_ACCESS_TOKEN);
    this.accountId = requireAccountId(config?.accountId || process.env.TRADIER_ACCOUNT_ID);

    this.http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: Math.max(1000, config?.timeoutMs ?? 15_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  }

  getAccountId(): string {
    return this.accountId;
  }

  async getBalances(): Promise<TradierBalanceSnapshot> {
    const response = await this.http.get(`/accounts/${this.accountId}/balances`);
    const body = response.data as Record<string, any>;
    const balances = (body?.balances || {}) as Record<string, unknown>;

    const totalEquity = toFiniteNumber(balances.total_equity) ?? toFiniteNumber(balances.equity) ?? 0;
    const dayTradeBuyingPower = toFiniteNumber(balances.day_trading_buying_power) ?? 0;
    const realizedPnlDaily = toFiniteNumber(balances.realized_gain_loss) ?? 0;

    return {
      totalEquity,
      dayTradeBuyingPower,
      realizedPnlDaily,
      raw: body,
    };
  }

  async getPositions(): Promise<TradierBrokerPosition[]> {
    const response = await this.http.get(`/accounts/${this.accountId}/positions`);
    const body = response.data as Record<string, any>;
    const rawNode = body?.positions?.position;
    const nodes = Array.isArray(rawNode)
      ? rawNode
      : rawNode && typeof rawNode === 'object'
        ? [rawNode]
        : [];

    const positions: TradierBrokerPosition[] = [];
    for (const node of nodes) {
      const record = node && typeof node === 'object'
        ? (node as Record<string, unknown>)
        : null;
      if (!record) continue;

      const symbol = typeof record.symbol === 'string'
        ? record.symbol.trim().toUpperCase()
        : '';
      const quantity = toFiniteNumber(record.quantity) ?? 0;
      if (!symbol || !Number.isFinite(quantity) || quantity === 0) continue;

      positions.push({
        symbol,
        quantity,
        costBasis: toFiniteNumber(record.cost_basis),
        dateAcquired: typeof record.date_acquired === 'string' ? record.date_acquired : null,
        raw: record,
      });
    }

    return positions;
  }

  async placeOrder(order: TradierOrderPayload): Promise<TradierOrderResult> {
    const payload = {
      class: order.class,
      symbol: order.symbol,
      side: order.side,
      quantity: Math.max(1, Math.floor(order.quantity)),
      type: order.type,
      duration: order.duration || 'day',
      price: typeof order.price === 'number' ? Number(order.price.toFixed(2)) : undefined,
      stop: typeof order.stop === 'number' ? Number(order.stop.toFixed(2)) : undefined,
      tag: order.tag,
    };

    const response = await this.http.post(`/accounts/${this.accountId}/orders`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const body = response.data as Record<string, any>;
    const orderNode = (body?.order || {}) as Record<string, unknown>;
    const id = String(orderNode.id || body?.id || '').trim();
    if (!id) {
      logger.warn('Tradier placeOrder returned no order id', { response: body });
      throw new Error('Tradier order response missing id.');
    }

    return {
      id,
      status: typeof orderNode.status === 'string' ? orderNode.status : undefined,
      raw: body,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const normalized = orderId.trim();
    if (!normalized) return false;

    await this.http.delete(`/accounts/${this.accountId}/orders/${normalized}`);
    return true;
  }

  async replaceOrder(orderId: string, order: Partial<TradierOrderPayload>): Promise<TradierOrderResult> {
    const normalized = orderId.trim();
    if (!normalized) {
      throw new Error('Tradier order id is required for replace.');
    }

    const payload = {
      type: order.type,
      duration: order.duration || 'day',
      price: typeof order.price === 'number' ? Number(order.price.toFixed(2)) : undefined,
      stop: typeof order.stop === 'number' ? Number(order.stop.toFixed(2)) : undefined,
      quantity: typeof order.quantity === 'number' ? Math.max(1, Math.floor(order.quantity)) : undefined,
    };

    const response = await this.http.put(`/accounts/${this.accountId}/orders/${normalized}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    const body = response.data as Record<string, any>;
    const orderNode = (body?.order || {}) as Record<string, unknown>;
    const id = String(orderNode.id || body?.id || normalized).trim();

    return {
      id,
      status: typeof orderNode.status === 'string' ? orderNode.status : undefined,
      raw: body,
    };
  }
}
