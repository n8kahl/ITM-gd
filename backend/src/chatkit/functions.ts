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
  }
];
