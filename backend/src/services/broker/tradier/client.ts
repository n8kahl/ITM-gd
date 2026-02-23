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
  option_symbol?: string;
  side: 'buy_to_open' | 'sell_to_close' | 'buy_to_close';
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
    if ((order.side as string) === 'sell_to_open') {
      throw new Error('Tradier execution rejected: sell_to_open is forbidden for SPX command center.');
    }

    const payload: Record<string, string | number> = {
      class: order.class,
      symbol: order.symbol,
      side: order.side,
      quantity: Math.max(1, Math.floor(order.quantity)),
      type: order.type,
      duration: order.duration || 'day',
    };
    if (order.option_symbol) payload.option_symbol = order.option_symbol;
    if (typeof order.price === 'number') payload.price = Number(order.price.toFixed(2));
    if (typeof order.stop === 'number') payload.stop = Number(order.stop.toFixed(2));
    if (order.tag) payload.tag = order.tag;

    const formBody = Object.entries(payload)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const response = await this.http.post(`/accounts/${this.accountId}/orders`, formBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  /**
   * S2: Get open/pending orders for the account, optionally filtered by tag prefix.
   */
  async getOpenOrders(tagPrefix?: string): Promise<Array<{ id: string; status: string; tag: string | null; symbol: string | null; raw: Record<string, unknown> }>> {
    const response = await this.http.get(`/accounts/${this.accountId}/orders`, {
      params: { includeTags: true },
    });
    const body = response.data as Record<string, unknown>;
    const ordersNode = (body as Record<string, unknown>)?.orders;
    const rawNode = ordersNode && typeof ordersNode === 'object'
      ? (ordersNode as Record<string, unknown>).order
      : null;
    const nodes = Array.isArray(rawNode)
      ? rawNode
      : rawNode && typeof rawNode === 'object'
        ? [rawNode]
        : [];

    const results: Array<{ id: string; status: string; tag: string | null; symbol: string | null; raw: Record<string, unknown> }> = [];
    for (const node of nodes) {
      const record = node && typeof node === 'object' ? (node as Record<string, unknown>) : null;
      if (!record) continue;

      const status = typeof record.status === 'string' ? record.status : '';
      if (status !== 'pending' && status !== 'open' && status !== 'partially_filled') continue;

      const id = String(record.id || '').trim();
      if (!id) continue;

      const tag = typeof record.tag === 'string' ? record.tag : null;
      if (tagPrefix && (!tag || !tag.startsWith(tagPrefix))) continue;

      const optionSymbol = typeof record.option_symbol === 'string' ? record.option_symbol : null;
      const symbol = typeof record.symbol === 'string' ? record.symbol : optionSymbol;

      results.push({ id, status, tag, symbol, raw: record });
    }

    return results;
  }

  /**
   * S3: Get the status of a specific order (for polling).
   */
  async getOrderStatus(orderId: string): Promise<{
    id: string;
    status: string;
    filledQuantity: number;
    avgFillPrice: number;
    remainingQuantity: number;
    raw: Record<string, unknown>;
  }> {
    const normalized = orderId.trim();
    if (!normalized) {
      throw new Error('Tradier order id is required for status check.');
    }

    const response = await this.http.get(`/accounts/${this.accountId}/orders/${normalized}`);
    const body = response.data as Record<string, unknown>;
    const orderNode = (body?.order || body) as Record<string, unknown>;

    const status = typeof orderNode.status === 'string' ? orderNode.status : 'unknown';
    const filledQuantity = toFiniteNumber(orderNode.last_fill_quantity ?? orderNode.exec_quantity) ?? 0;
    const avgFillPrice = toFiniteNumber(orderNode.avg_fill_price) ?? 0;
    const totalQuantity = toFiniteNumber(orderNode.quantity) ?? 0;
    const remainingQuantity = Math.max(0, totalQuantity - filledQuantity);

    return {
      id: normalized,
      status,
      filledQuantity,
      avgFillPrice,
      remainingQuantity,
      raw: orderNode,
    };
  }

  async replaceOrder(orderId: string, order: Partial<TradierOrderPayload>): Promise<TradierOrderResult> {
    const normalized = orderId.trim();
    if (!normalized) {
      throw new Error('Tradier order id is required for replace.');
    }

    const payload: Record<string, string | number> = {};
    if (order.type) payload.type = order.type;
    payload.duration = order.duration || 'day';
    if (typeof order.price === 'number') payload.price = Number(order.price.toFixed(2));
    if (typeof order.stop === 'number') payload.stop = Number(order.stop.toFixed(2));
    if (typeof order.quantity === 'number') payload.quantity = Math.max(1, Math.floor(order.quantity));

    const formBody = Object.entries(payload)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const response = await this.http.put(`/accounts/${this.accountId}/orders/${normalized}`, formBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
