/**
 * Options Data Types
 * TypeScript interfaces for options chain, Greeks, and position analysis
 */

// Option contract details
export interface OptionContract {
  symbol: string;           // Underlying symbol (SPX, NDX)
  strike: number;           // Strike price
  expiry: string;           // Expiry date (YYYY-MM-DD)
  type: 'call' | 'put';     // Option type
  last: number;             // Last traded price
  bid: number;              // Bid price
  ask: number;              // Ask price
  volume: number;           // Volume traded today
  openInterest: number;     // Open interest
  impliedVolatility: number; // IV (as decimal, e.g., 0.25 = 25%)
  delta?: number;           // Delta
  gamma?: number;           // Gamma
  theta?: number;           // Theta ($ per day)
  vega?: number;            // Vega ($ per 1% IV change)
  rho?: number;             // Rho ($ per 1% interest rate change)
  inTheMoney: boolean;      // ITM flag
  intrinsicValue: number;   // Intrinsic value
  extrinsicValue: number;   // Time value
}

// Greeks for a position
export interface Greeks {
  delta: number;    // Directional exposure
  gamma: number;    // Delta sensitivity
  theta: number;    // Time decay ($ per day)
  vega: number;     // IV sensitivity ($ per 1% IV)
  rho?: number;     // Interest rate sensitivity
}

// Position (user's holding)
export interface Position {
  id?: string;
  symbol: string;
  type: 'call' | 'put' | 'call_spread' | 'put_spread' | 'iron_condor' | 'stock';
  strike?: number;          // For options
  strike2?: number;         // For spreads
  expiry?: string;          // For options
  quantity: number;         // Positive = long, negative = short
  entryPrice: number;       // Entry price per contract
  currentPrice?: number;    // Current market price
  entryDate: string;        // Entry date
  greeks?: Greeks;          // Current Greeks
}

// Position analysis result
export interface PositionAnalysis {
  position: Position;
  currentValue: number;      // Current position value
  costBasis: number;         // Original cost
  pnl: number;               // Profit/loss ($)
  pnlPct: number;            // Profit/loss (%)
  daysHeld: number;          // Days since entry
  daysToExpiry?: number;     // Days until expiration
  breakeven?: number;        // Breakeven price
  maxGain?: number | string; // Max potential gain (can be "unlimited")
  maxLoss?: number | string; // Max potential loss (can be "unlimited")
  riskRewardRatio?: number;  // Risk/reward ratio
  greeks?: Greeks;           // Current Greeks
}

// Portfolio analysis
export interface PortfolioAnalysis {
  positions: PositionAnalysis[];
  portfolio: {
    totalValue: number;
    totalCostBasis: number;
    totalPnl: number;
    totalPnlPct: number;
    portfolioGreeks: Greeks;
    risk: {
      maxLoss: number | string;  // Can be "unlimited"
      maxGain: number | string;   // Can be "unlimited"
      buyingPowerUsed: number;
    };
    riskAssessment: {
      overall: 'low' | 'moderate' | 'high' | 'extreme';
      warnings: string[];
    };
  };
}

// Options chain request
export interface OptionsChainRequest {
  symbol: string;
  expiry?: string;          // Specific expiry or nearest
  strikeRange?: number;     // Strikes above/below current price
}

// Options chain response
export interface OptionsChainResponse {
  symbol: string;
  currentPrice: number;
  expiry: string;
  daysToExpiry: number;
  ivRank?: number;          // IV percentile rank
  options: {
    calls: OptionContract[];
    puts: OptionContract[];
  };
}

export interface GEXStrikeData {
  strike: number;
  gexValue: number;
  callGamma: number;
  putGamma: number;
  callOI: number;
  putOI: number;
}

export interface GEXKeyLevel {
  strike: number;
  gexValue: number;
  type: 'support' | 'resistance' | 'magnet';
}

export interface GEXProfile {
  symbol: string;
  spotPrice: number;
  gexByStrike: GEXStrikeData[];
  flipPoint: number | null;
  maxGEXStrike: number | null;
  keyLevels: GEXKeyLevel[];
  regime: 'positive_gamma' | 'negative_gamma';
  implication: string;
  calculatedAt: string;
  expirationsAnalyzed: string[];
}

// Black-Scholes inputs
export interface BlackScholesInputs {
  spotPrice: number;        // Current underlying price
  strikePrice: number;      // Option strike price
  timeToExpiry: number;     // Time to expiry (years)
  riskFreeRate: number;     // Risk-free interest rate (decimal)
  volatility: number;       // Implied volatility (decimal)
  dividendYield?: number;   // Dividend yield (decimal, default 0)
  optionType: 'call' | 'put';
}

// Black-Scholes result
export interface BlackScholesResult {
  price: number;            // Theoretical option price
  greeks: {
    delta: number;
    gamma: number;
    theta: number;          // Per year, convert to per day by / 365
    vega: number;           // Per 1% volatility change
    rho: number;
  };
}
