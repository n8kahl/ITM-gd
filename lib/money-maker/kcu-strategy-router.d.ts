import { ORBRegime } from './orb-calculator';
import { ConfluenceZone, KCUStrategyType } from './types';
export interface StrategyRouterContext {
    timestamp: number;
    orbRegime: ORBRegime;
    confluenceZone: ConfluenceZone;
    direction?: 'long' | 'short';
    isVwapCrossFromBelow?: boolean;
    isMorningTrend?: boolean;
    isPrevDayTrend?: boolean;
    isSteepTrend?: boolean;
}
export interface RouterResult {
    isValid: boolean;
    strategyType?: KCUStrategyType;
    strategyLabel?: string;
    reason?: string;
}
export declare function getETTimeStr(timestamp: number): string;
export declare function determineStrategy(context: StrategyRouterContext): RouterResult;
//# sourceMappingURL=kcu-strategy-router.d.ts.map