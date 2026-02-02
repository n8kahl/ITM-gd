import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_BASE_URL = 'https://api.polygon.io';

if (!MASSIVE_API_KEY) {
  throw new Error('Missing MASSIVE_API_KEY environment variable');
}

// Create Axios instance for Massive.com API (Polygon.io)
export const massiveClient: AxiosInstance = axios.create({
  baseURL: MASSIVE_BASE_URL,
  headers: {
    'Authorization': `Bearer ${MASSIVE_API_KEY}`
  },
  timeout: 30000
});

// Add request interceptor for logging
massiveClient.interceptors.request.use(
  (config) => {
    console.log(`Massive.com API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
massiveClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Massive.com API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Types for API responses
export interface MassiveAggregate {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // volume weighted average price
  t: number; // timestamp (milliseconds)
  n?: number; // number of transactions
}

export interface MassiveAggregatesResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  adjusted: boolean;
  results: MassiveAggregate[];
  status: string;
  request_id: string;
  count: number;
}

// API Methods
export async function getAggregates(
  ticker: string,
  multiplier: number,
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month',
  from: string,
  to: string
): Promise<MassiveAggregatesResponse> {
  try {
    const response = await massiveClient.get<MassiveAggregatesResponse>(
      `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`,
      {
        params: {
          adjusted: true,
          sort: 'asc',
          limit: 50000
        }
      }
    );
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch aggregates for ${ticker}:`, error.message);
    throw error;
  }
}

// Get daily aggregates for a date range (used for PDH, pivots, ATR)
export async function getDailyAggregates(
  ticker: string,
  from: string,
  to: string
): Promise<MassiveAggregate[]> {
  const response = await getAggregates(ticker, 1, 'day', from, to);
  return response.results || [];
}

// Get minute aggregates for a specific date (used for PMH/PML, VWAP)
export async function getMinuteAggregates(
  ticker: string,
  date: string
): Promise<MassiveAggregate[]> {
  const response = await getAggregates(ticker, 1, 'minute', date, date);
  return response.results || [];
}

// Test Massive.com API connection
export async function testMassiveConnection(): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Test with SPX
    await getDailyAggregates('I:SPX', yesterday, today);
    return true;
  } catch (error) {
    console.error('Massive.com API connection test failed:', error);
    return false;
  }
}
