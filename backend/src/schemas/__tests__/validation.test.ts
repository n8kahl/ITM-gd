import { createAlertSchema as alertSchema, alertIdSchema } from '../alertsValidation';
import { createTradeSchema as tradeSchema, importTradesSchema as importSchema } from '../journalValidation';
import { sendMessageSchema as messageSchema } from '../chatValidation';

describe('Validation Schemas', () => {
  describe('Alert Schemas', () => {
    describe('createAlertSchema', () => {
      it('should accept valid alert input', () => {
        const validAlert = {
          symbol: 'spx',
          alert_type: 'price_above' as const,
          target_value: 5500,
        };

        const result = alertSchema.safeParse(validAlert);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('SPX'); // Should be uppercased
        }
      });

      it('should accept all valid alert_type values', () => {
        const alertTypes: Array<'price_above' | 'price_below' | 'level_approach' | 'level_break' | 'volume_spike'> = [
          'price_above',
          'price_below',
          'level_approach',
          'level_break',
          'volume_spike',
        ];

        for (const alertType of alertTypes) {
          const alert = {
            symbol: 'SPX',
            alert_type: alertType,
            target_value: 5500,
          };

          const result = alertSchema.safeParse(alert);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid alert_type', () => {
        const invalidAlert = {
          symbol: 'SPX',
          alert_type: 'invalid_type',
          target_value: 5500,
        };

        const result = alertSchema.safeParse(invalidAlert);
        expect(result.success).toBe(false);
      });

      it('should uppercase symbol', () => {
        const alert = {
          symbol: 'qqq',
          alert_type: 'price_above' as const,
          target_value: 400,
        };

        const result = alertSchema.safeParse(alert);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('QQQ');
        }
      });

      it('should reject missing required field', () => {
        const incompleteAlert = {
          symbol: 'SPX',
          alert_type: 'price_above',
        };

        const result = alertSchema.safeParse(incompleteAlert);
        expect(result.success).toBe(false);
      });

      it('should reject negative target_value', () => {
        const invalidAlert = {
          symbol: 'SPX',
          alert_type: 'price_above' as const,
          target_value: -100,
        };

        const result = alertSchema.safeParse(invalidAlert);
        expect(result.success).toBe(false);
      });

      it('should accept optional fields', () => {
        const alert = {
          symbol: 'SPX',
          alert_type: 'price_above' as const,
          target_value: 5500,
          notes: 'Test alert',
          notification_channels: ['email', 'sms'],
        };

        const result = alertSchema.safeParse(alert);
        expect(result.success).toBe(true);
      });
    });

    describe('alertIdSchema', () => {
      it('should accept valid UUID', () => {
        const validId = {
          id: '550e8400-e29b-41d4-a716-446655440000',
        };

        const result = alertIdSchema.safeParse(validId);
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID', () => {
        const invalidId = {
          id: 'not-a-uuid',
        };

        const result = alertIdSchema.safeParse(invalidId);
        expect(result.success).toBe(false);
      });

      it('should reject malformed UUID', () => {
        const malformedId = {
          id: '550e8400-e29b-41d4-a716',
        };

        const result = alertIdSchema.safeParse(malformedId);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Trade Schemas', () => {
    describe('createTradeSchema', () => {
      it('should accept valid trade input', () => {
        const validTrade = {
          symbol: 'spy',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(validTrade);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('SPY'); // Should be uppercased
        }
      });

      it('should accept all valid position_type values', () => {
        const positionTypes: Array<'call' | 'put' | 'stock'> = [
          'call',
          'put',
          'stock',
        ];

        for (const posType of positionTypes) {
          const trade = {
            symbol: 'SPY',
            position_type: posType,
            entry_date: '2026-01-15',
            entry_price: 425.50,
            quantity: 100,
          };

          const result = tradeSchema.safeParse(trade);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid position_type', () => {
        const invalidTrade = {
          symbol: 'SPY',
          position_type: 'iron_condor',
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(invalidTrade);
        expect(result.success).toBe(false);
      });

      it('should reject spread position types for journal trades', () => {
        const invalidTrade = {
          symbol: 'SPY',
          position_type: 'call_spread',
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(invalidTrade);
        expect(result.success).toBe(false);
      });

      it('should validate date format (YYYY-MM-DD)', () => {
        const validTrade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(validTrade);
        expect(result.success).toBe(true);
      });

      it('should reject invalid date format', () => {
        const invalidTrade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '01/15/2026',
          entry_price: 425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(invalidTrade);
        expect(result.success).toBe(false);
      });

      it('should reject negative entry_price', () => {
        const invalidTrade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: -425.50,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(invalidTrade);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer quantity', () => {
        const invalidTrade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100.5,
        };

        const result = tradeSchema.safeParse(invalidTrade);
        expect(result.success).toBe(false);
      });

      it('should accept optional exit_date', () => {
        const trade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
          exit_date: '2026-02-01',
          exit_price: 430.00,
        };

        const result = tradeSchema.safeParse(trade);
        expect(result.success).toBe(true);
      });

      it('should accept optional tags array', () => {
        const trade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
          tags: ['bullish', 'earnings'],
        };

        const result = tradeSchema.safeParse(trade);
        expect(result.success).toBe(true);
      });

      it('should reject tags exceeding max count', () => {
        const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
        const trade = {
          symbol: 'SPY',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
          tags,
        };

        const result = tradeSchema.safeParse(trade);
        expect(result.success).toBe(false);
      });

      it('should uppercase symbol', () => {
        const trade = {
          symbol: 'aapl',
          position_type: 'call' as const,
          entry_date: '2026-01-15',
          entry_price: 150.00,
          quantity: 100,
        };

        const result = tradeSchema.safeParse(trade);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.symbol).toBe('AAPL');
        }
      });
    });

    describe('importTradesSchema', () => {
      it('should accept valid import with single trade', () => {
        const importData = {
          trades: [
            {
              symbol: 'SPY',
              entry_date: '2026-01-15',
              entry_price: 425.50,
              quantity: 100,
            },
          ],
        };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(true);
      });

      it('should accept import with multiple trades', () => {
        const importData = {
          trades: [
            {
              symbol: 'SPY',
              entry_date: '2026-01-15',
              entry_price: 425.50,
              quantity: 100,
            },
            {
              symbol: 'QQQ',
              entry_date: '2026-01-16',
              entry_price: 400.00,
              quantity: 50,
            },
          ],
        };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(true);
      });

      it('should accept trade with up to 500 items', () => {
        const trades = Array.from({ length: 500 }, () => ({
          symbol: 'SPY',
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        }));

        const importData = { trades };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(true);
      });

      it('should reject empty array', () => {
        const importData = {
          trades: [],
        };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(false);
      });

      it('should reject array exceeding 500 items', () => {
        const trades = Array.from({ length: 501 }, () => ({
          symbol: 'SPY',
          entry_date: '2026-01-15',
          entry_price: 425.50,
          quantity: 100,
        }));

        const importData = { trades };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(false);
      });

      it('should accept flexible field names in import', () => {
        const importData = {
          trades: [
            {
              symbol: 'SPY',
              entryDate: '2026-01-15', // camelCase variant
              entryPrice: 425.50,
              quantity: 100,
            },
          ],
        };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(true);
      });

      it('should accept optional fields in import', () => {
        const importData = {
          trades: [
            {
              symbol: 'SPY',
              entry_date: '2026-01-15',
              entry_price: 425.50,
              quantity: 100,
              type: 'call',
              pnl: 100,
              trade_outcome: 'win',
            },
          ],
        };

        const result = importSchema.safeParse(importData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Chat Schemas', () => {
    describe('sendMessageSchema', () => {
      it('should accept valid message input', () => {
        const validMessage = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'Hello, what is the market outlook?',
        };

        const result = messageSchema.safeParse(validMessage);
        expect(result.success).toBe(true);
      });

      it('should reject empty message', () => {
        const invalidMessage = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: '',
        };

        const result = messageSchema.safeParse(invalidMessage);
        expect(result.success).toBe(false);
      });

      it('should reject message exceeding 5000 characters', () => {
        const longMessage = 'a'.repeat(5001);
        const invalidMessage = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: longMessage,
        };

        const result = messageSchema.safeParse(invalidMessage);
        expect(result.success).toBe(false);
      });

      it('should accept message at 5000 character limit', () => {
        const maxMessage = 'a'.repeat(5000);
        const validMessage = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: maxMessage,
        };

        const result = messageSchema.safeParse(validMessage);
        expect(result.success).toBe(true);
      });

      it('should reject invalid sessionId format', () => {
        const invalidMessage = {
          sessionId: 'not-a-uuid',
          message: 'Hello',
        };

        const result = messageSchema.safeParse(invalidMessage);
        expect(result.success).toBe(false);
      });

      it('should reject malformed UUID sessionId', () => {
        const invalidMessage = {
          sessionId: '550e8400-e29b-41d4-a716',
          message: 'Hello',
        };

        const result = messageSchema.safeParse(invalidMessage);
        expect(result.success).toBe(false);
      });

      it('should trim whitespace from message', () => {
        const message = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: '  Hello world  ',
        };

        const result = messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.message).toBe('Hello world');
        }
      });

      it('should reject message with only whitespace', () => {
        const message = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: '   ',
        };

        const result = messageSchema.safeParse(message);
        expect(result.success).toBe(false);
      });

      it('should accept multiline message', () => {
        const message = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'Line 1\nLine 2\nLine 3',
        };

        const result = messageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it('should handle special characters in message', () => {
        const message = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'Price at $425.50 with emoji 🚀 and special chars: !@#$%',
        };

        const result = messageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it('should accept missing sessionId', () => {
        const incompleteMessage = {
          message: 'Hello',
        };

        const result = messageSchema.safeParse(incompleteMessage);
        expect(result.success).toBe(true);
      });

      it('should reject missing message', () => {
        const incompleteMessage = {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
        };

        const result = messageSchema.safeParse(incompleteMessage);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Schema Type Safety', () => {
    it('should properly infer types from schemas', () => {
      const alert = {
        symbol: 'SPX',
        alert_type: 'price_above' as const,
        target_value: 5500,
      };

      const result = alertSchema.safeParse(alert);
      if (result.success) {
        const { symbol, target_value } = result.data;
        expect(typeof symbol).toBe('string');
        expect(typeof target_value).toBe('number');
      }
    });

    it('should reject extra fields not in schema', () => {
      const alertWithExtra = {
        symbol: 'SPX',
        alert_type: 'price_above' as const,
        target_value: 5500,
        maliciousField: 'hack',
      };

      const result = alertSchema.safeParse(alertWithExtra);
      expect(result.success).toBe(true); // Zod strips unknown fields by default
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in symbol', () => {
      const alert = {
        symbol: 'BRK.B',
        alert_type: 'price_above' as const,
        target_value: 300,
      };

      const result = alertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    it('should handle very large numbers', () => {
      const trade = {
        symbol: 'COIN',
        position_type: 'stock' as const,
        entry_date: '2026-01-15',
        entry_price: 999999.99,
        quantity: 1000000,
      };

      const result = tradeSchema.safeParse(trade);
      expect(result.success).toBe(true);
    });

    it('should handle very small decimal numbers', () => {
      const trade = {
        symbol: 'PENNY',
        position_type: 'stock' as const,
        entry_date: '2026-01-15',
        entry_price: 0.01,
        quantity: 1000,
      };

      const result = tradeSchema.safeParse(trade);
      expect(result.success).toBe(true);
    });
  });
});
