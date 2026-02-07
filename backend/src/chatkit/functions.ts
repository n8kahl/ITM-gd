import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Function definitions for OpenAI function calling
 * These tell the AI what functions it can call and what parameters they accept
 */

export const AI_FUNCTIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_key_levels',
      description: 'Get support and resistance levels for a symbol (SPX or NDX). Returns PDH/PDL/PDC, PMH/PML, pivots, VWAP, and ATR.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            enum: ['SPX', 'NDX'],
            description: 'The symbol to get levels for (SPX or NDX)'
          },
          timeframe: {
            type: 'string',
            enum: ['intraday', 'daily', 'weekly'],
            description: 'The timeframe for level calculations',
            default: 'intraday'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_price',
      description: 'Get the current real-time price for a symbol.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            enum: ['SPX', 'NDX'],
            description: 'The symbol to get price for'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_status',
      description: 'Get current market status (pre-market, open, after-hours, closed) and time since market open.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_options_chain',
      description: 'Get options chain with calls and puts for a symbol. Returns strikes, prices, Greeks (delta, gamma, theta, vega), IV, and volume for options near current price.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            enum: ['SPX', 'NDX'],
            description: 'The underlying symbol'
          },
          expiry: {
            type: 'string',
            description: 'Specific expiry date (YYYY-MM-DD) or omit for nearest expiration'
          },
          strikeRange: {
            type: 'number',
            description: 'Number of strikes above/below current price to return (default: 10)',
            default: 10
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_position',
      description: 'Analyze an options position or portfolio. Calculates P&L, Greeks, max gain/loss, breakeven, and risk assessment. Use this when the user asks about their position performance or risk.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'object',
            description: 'Single position to analyze',
            properties: {
              symbol: {
                type: 'string',
                enum: ['SPX', 'NDX'],
                description: 'Underlying symbol'
              },
              type: {
                type: 'string',
                enum: ['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock'],
                description: 'Position type'
              },
              strike: {
                type: 'number',
                description: 'Strike price (for options)'
              },
              strike2: {
                type: 'number',
                description: 'Second strike for spreads'
              },
              expiry: {
                type: 'string',
                description: 'Expiry date YYYY-MM-DD (for options)'
              },
              quantity: {
                type: 'number',
                description: 'Quantity (positive = long, negative = short)'
              },
              entryPrice: {
                type: 'number',
                description: 'Entry price per contract'
              },
              entryDate: {
                type: 'string',
                description: 'Entry date YYYY-MM-DD'
              }
            },
            required: ['symbol', 'type', 'quantity', 'entryPrice', 'entryDate']
          },
          positions: {
            type: 'array',
            description: 'Array of positions for portfolio analysis',
            items: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                type: { type: 'string' },
                strike: { type: 'number' },
                strike2: { type: 'number' },
                expiry: { type: 'string' },
                quantity: { type: 'number' },
                entryPrice: { type: 'number' },
                entryDate: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_chart',
      description: 'Display a candlestick chart with key levels for a symbol in the center panel. Use this when the user asks to see a chart, visualize price action, or view levels on a chart.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            enum: ['SPX', 'NDX'],
            description: 'The symbol to chart'
          },
          timeframe: {
            type: 'string',
            enum: ['1m', '5m', '15m', '1h', '4h', '1D'],
            description: 'Chart timeframe (default: 1D for daily)',
            default: '1D'
          }
        },
        required: ['symbol']
      }
    }
  }
];
