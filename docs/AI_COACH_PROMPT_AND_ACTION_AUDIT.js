const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak
} = require('docx');

// ── Colors ──
const EMERALD = '10B981';
const DARK_BG = '111827';
const LIGHT_BG = 'F9FAFB';
const RED_BG = 'FEE2E2';
const RED_TEXT = 'DC2626';
const YELLOW_BG = 'FEF3C7';
const YELLOW_TEXT = '92400E';
const GREEN_BG = 'D1FAE5';
const GREEN_TEXT = '065F46';
const BLUE_BG = 'DBEAFE';
const BLUE_TEXT = '1E40AF';
const GRAY = '6B7280';
const BORDER_COLOR = 'D1D5DB';

// ── Helpers ──
const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const PAGE_WIDTH = 9360;

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, font: 'Arial' })] });
}

function para(runs, opts = {}) {
  return new Paragraph({ spacing: { after: 120, ...opts.spacing }, alignment: opts.alignment, ...opts.extra, children: Array.isArray(runs) ? runs : [runs] });
}

function bold(text, opts = {}) { return new TextRun({ text, bold: true, font: 'Arial', size: opts.size || 22, color: opts.color }); }
function normal(text, opts = {}) { return new TextRun({ text, font: 'Arial', size: opts.size || 22, color: opts.color }); }
function italic(text, opts = {}) { return new TextRun({ text, italics: true, font: 'Arial', size: opts.size || 22, color: opts.color }); }

function statusCell(text, bgColor, textColor) {
  return new TableCell({
    borders, width: { size: 1200, type: WidthType.DXA },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    margins: cellMargins, verticalAlign: 'center',
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(text, { size: 18, color: textColor })] })]
  });
}

function headerCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: DARK_BG, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [bold(text, { size: 20, color: 'FFFFFF' })] })]
  });
}

function dataCell(content, width, opts = {}) {
  const children = typeof content === 'string' ? [new Paragraph({ children: [normal(content, { size: 20 })] })] : content;
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children
  });
}

// ── Build Document ──
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: DARK_BG },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '1F2937' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '374151' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'findings', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        normal('TITM AI Coach ', { size: 16, color: GRAY }),
        bold('Prompt & Action Audit', { size: 16, color: EMERALD })
      ] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        normal('Page ', { size: 16, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: GRAY }),
        normal(' | Confidential', { size: 16, color: GRAY })
      ] })] })
    },
    children: [
      // ═══════ TITLE PAGE ═══════
      new Paragraph({ spacing: { before: 2400 } }),
      para(bold('TITM AI Coach', { size: 52, color: EMERALD }), { alignment: AlignmentType.CENTER }),
      para(bold('Prompt, Action & Data Audit', { size: 36, color: DARK_BG }), { alignment: AlignmentType.CENTER }),
      new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
        normal('System Prompt | 24 Functions | 17 Widgets | Massive.com Integration', { size: 22, color: GRAY })
      ] }),
      new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [
        normal('February 2026', { size: 22, color: GRAY })
      ] }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ EXECUTIVE SUMMARY ═══════
      heading('Executive Summary'),
      para(normal('This audit examines the AI Coach system across three dimensions: the system prompt that defines its personality and reasoning, the 24 function-calling actions that give it access to live data, and the 17 widget cards that render results. The goal is to identify gaps, redundancies, and opportunities to leverage the full Massive.com data platform.')),
      new Paragraph({ spacing: { before: 200 } }),

      // Scorecard table
      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({ children: [
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: GREEN_BG, type: ShadingType.CLEAR }, margins: cellMargins, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('System Prompt', { size: 20, color: GREEN_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('7.5 / 10', { size: 28, color: GREEN_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('Solid core, missing context layers', { size: 16, color: GREEN_TEXT })] })
            ] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: YELLOW_BG, type: ShadingType.CLEAR }, margins: cellMargins, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Actions / Functions', { size: 20, color: YELLOW_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('6.5 / 10', { size: 28, color: YELLOW_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('Good coverage, data gaps', { size: 16, color: YELLOW_TEXT })] })
            ] }),
            new TableCell({ borders, width: { size: 3120, type: WidthType.DXA }, shading: { fill: RED_BG, type: ShadingType.CLEAR }, margins: cellMargins, children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Data Utilization', { size: 20, color: RED_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('~15%', { size: 28, color: RED_TEXT })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('Major Massive.com APIs unused', { size: 16, color: RED_TEXT })] })
            ] })
          ] })
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 1: SYSTEM PROMPT AUDIT ═══════
      heading('1. System Prompt Audit'),

      heading('What It Does Well', HeadingLevel.HEADING_2),
      para([bold('Identity & Tone: '), normal('Clear professional persona. "Data-driven, concise, respects traders\u2019 time" is well-calibrated for the audience.')]),
      para([bold('Routing: '), normal('"Never refuse a ticker" rule prevents the common LLM failure of self-limiting to SPX/NDX. Good guardrail.')]),
      para([bold('Response Format: '), normal('Concrete good/bad examples enforce scannable output. The "don\u2019t parrot widgets" rule prevents redundant regurgitation.')]),
      para([bold('Technical Analysis Reasoning: '), normal('The 6-point checklist (specific prices, test behavior, confluence, ATR framing, invalidation, Fibonacci) is excellent for structured analysis.')]),
      para([bold('Setup Help Workflow: '), normal('Forces get_key_levels + show_chart for any setup discussion. Prevents lazy text-only responses.')]),
      para([bold('Journal Context Bridge: '), normal('Proactive journal lookup when performance context is relevant. Good personalization.')]),

      heading('What\u2019s Missing', HeadingLevel.HEADING_2),

      // Missing items table
      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [600, 2400, 3360, 1200, 1800],
        rows: [
          new TableRow({ children: [
            headerCell('#', 600), headerCell('Gap', 2400), headerCell('Impact', 3360), headerCell('Severity', 1200), headerCell('Fix Effort', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('1', 600), dataCell('No earnings context in prompt', 2400),
            dataCell('AI doesn\u2019t know if a symbol reports earnings tomorrow. Can\u2019t warn about IV crush risk proactively.', 3360),
            statusCell('HIGH', RED_BG, RED_TEXT), dataCell('2 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('2', 600), dataCell('No news awareness', 2400),
            dataCell('AI can\u2019t explain why a stock moved 8% today. Users ask "why is NVDA up?" and AI has no answer.', 3360),
            statusCell('HIGH', RED_BG, RED_TEXT), dataCell('4 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('3', 600), dataCell('No sector/fundamental context', 2400),
            dataCell('AI doesn\u2019t know PLTR is a data company or AAPL\u2019s market cap. Can\u2019t provide sector rotation context.', 3360),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('3 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('4', 600), dataCell('No dividend/split awareness', 2400),
            dataCell('Can\u2019t warn about early assignment risk on short calls before ex-dividend dates.', 3360),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('2 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('5', 600), dataCell('No multi-symbol comparison', 2400),
            dataCell('User says "compare AAPL vs MSFT" and AI has no workflow for side-by-side analysis.', 3360),
            statusCell('LOW', BLUE_BG, BLUE_TEXT), dataCell('3 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('6', 600), dataCell('No market breadth reasoning', 2400),
            dataCell('Can\u2019t say "SPX is up but breadth is narrow \u2014 only 40% of stocks advancing." No advance/decline data.', 3360),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('4 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('7', 600), dataCell('Stale market context injection', 2400),
            dataCell('promptContext.ts only injects SPX/NDX price + change%. No VIX, no DXY, no sector performance, no volume context.', 3360),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('2 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell('8', 600), dataCell('No time-of-day awareness', 2400),
            dataCell('Prompt doesn\u2019t know if it\u2019s 9:35 AM (opening volatility) or 3:50 PM (MOC imbalance window). 0DTE theta advice is time-blind.', 3360),
            statusCell('HIGH', RED_BG, RED_TEXT), dataCell('1 hour', 1800)
          ] }),
        ]
      }),

      heading('Prompt Enhancement Recommendations', HeadingLevel.HEADING_2),
      para([bold('P1: Enrich market context injection.'), normal(' Add VIX level + change, DXY, 10Y yield, and current ET time to the system prompt\u2019s CURRENT MARKET CONTEXT block. These are already available from Massive.com via index snapshots.')]),
      para([bold('P2: Add an earnings proximity block.'), normal(' Before each chat turn, check if any symbol in the user\u2019s recent conversation has earnings within 5 days. Inject: "[AAPL reports earnings in 2 days (AMC). IV is elevated. Factor this into any options analysis.]"')]),
      para([bold('P3: Add session time block.'), normal(' Inject current ET time + session phase (pre-market / first 30 min / mid-session / power hour / after-hours). Let the AI adjust 0DTE theta advice and volume context accordingly.')]),
      para([bold('P4: Add a news digest block.'), normal(' For the primary symbol being discussed, inject the 3 most recent headlines from /v2/reference/news. This lets the AI say "NVDA is up 6% on chip export news" instead of "I don\u2019t have access to news."')]),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 2: FUNCTION / ACTION AUDIT ═══════
      heading('2. Function / Action Audit'),
      para(normal('The AI Coach currently has 24 callable functions. Here\u2019s the full inventory with gap analysis.')),

      heading('Current Function Inventory (24)', HeadingLevel.HEADING_2),

      // Function inventory table
      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [3000, 1200, 2160, 1200, 1800],
        rows: [
          new TableRow({ children: [
            headerCell('Function', 3000), headerCell('Tier', 1200), headerCell('Data Source', 2160), headerCell('Widget?', 1200), headerCell('Status', 1800)
          ] }),
          ...([
            ['get_key_levels', 'Free', 'Massive aggregates', 'Yes', 'OK'],
            ['get_fibonacci_levels', 'Free', 'Massive aggregates', 'Yes', 'OK'],
            ['get_current_price', 'Free', 'Massive aggregates', 'Yes', 'ENHANCE'],
            ['get_market_status', 'Free', 'Hardcoded logic', 'Yes', 'REPLACE'],
            ['get_options_chain', 'Free', 'Massive snapshots', 'Yes', 'OK'],
            ['get_gamma_exposure', 'Pro', 'Massive snapshots', 'Yes', 'OK'],
            ['get_zero_dte_analysis', 'Pro', 'Massive options', 'Yes', 'OK'],
            ['get_iv_analysis', 'Pro', 'Massive snapshots', 'Yes', 'OK'],
            ['get_spx_game_plan', 'Free', 'Composite (5 calls)', 'Yes', 'ENHANCE'],
            ['get_earnings_calendar', 'Free', 'Benzinga/AV', 'Yes', 'OK'],
            ['get_earnings_analysis', 'Pro', 'Benzinga + options', 'Yes', 'ENHANCE'],
            ['analyze_position', 'Free', 'Supabase + options', 'Yes', 'OK'],
            ['get_position_advice', 'Free', 'Supabase', 'No', 'OK'],
            ['get_journal_insights', 'Free', 'Supabase', 'Yes', 'OK'],
            ['get_trade_history_for_symbol', 'Free', 'Supabase', 'Yes', 'OK'],
            ['set_alert', 'Free', 'Supabase', 'Yes', 'OK'],
            ['get_alerts', 'Free', 'Supabase', 'Yes', 'OK'],
            ['scan_opportunities', 'Free', 'Composite', 'Yes', 'ENHANCE'],
            ['show_chart', 'Free', 'Event dispatch', 'N/A', 'OK'],
            ['get_long_term_trend', 'Free', 'Massive aggregates', 'No', 'OK'],
            ['analyze_leaps_position', 'Free', 'Black-Scholes + Massive', 'No', 'OK'],
            ['analyze_swing_trade', 'Free', 'Massive aggregates', 'No', 'OK'],
            ['calculate_roll_decision', 'Free', 'Black-Scholes', 'No', 'OK'],
            ['get_macro_context', 'Free', 'Composite', 'Yes', 'ENHANCE'],
          ]).map(([fn, tier, source, widget, status]) => {
            const statusColor = status === 'OK' ? GREEN_BG : status === 'ENHANCE' ? YELLOW_BG : RED_BG;
            const statusText = status === 'OK' ? GREEN_TEXT : status === 'ENHANCE' ? YELLOW_TEXT : RED_TEXT;
            return new TableRow({ children: [
              dataCell([new Paragraph({ children: [new TextRun({ text: fn, font: 'Courier New', size: 18 })] })], 3000),
              dataCell(tier, 1200),
              dataCell(source, 2160),
              dataCell(widget, 1200),
              statusCell(status, statusColor, statusText)
            ] });
          })
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      heading('Functions That Need Enhancement', HeadingLevel.HEADING_2),

      para([bold('get_current_price: '), normal('Currently uses 1-minute aggregates with fallback to daily close. Should use getLastTrade() (already defined in massive.ts but not wired) for true real-time prices instead of candle closes.')]),
      para([bold('get_market_status: '), normal('Uses hardcoded EST market hours with a static holiday list (2025\u20132028). Should use Massive.com /v1/marketstatus/now endpoint for live status including early closes and half-days.')]),
      para([bold('get_spx_game_plan: '), normal('Excellent composite function but missing: (a) VIX context, (b) advance/decline breadth, (c) previous day\u2019s closing context, (d) earnings-heavy sectors today.')]),
      para([bold('get_earnings_analysis: '), normal('Good historical move analysis and IV crush projection. Missing: (a) actual EPS/revenue estimates from Massive.com Benzinga data, (b) revenue surprise history, (c) post-earnings drift statistics.')]),
      para([bold('scan_opportunities: '), normal('Currently scans a fixed watchlist. Should accept sector filters and integrate with unusual options activity (if available on Massive.com plan).')]),
      para([bold('get_macro_context: '), normal('Returns economic calendar and Fed context. Missing: (a) sector rotation data, (b) market breadth metrics, (c) yield curve context.')]),

      heading('Missing Functions (New)', HeadingLevel.HEADING_2),

      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [2600, 3760, 1200, 1800],
        rows: [
          new TableRow({ children: [
            headerCell('Proposed Function', 2600), headerCell('What It Does', 3760), headerCell('Priority', 1200), headerCell('Effort', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_ticker_news', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Returns 3\u20135 recent headlines for a symbol from /v2/reference/news. Lets AI explain price moves.', 3760),
            statusCell('HIGH', RED_BG, RED_TEXT), dataCell('4 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_company_profile', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Returns sector, market cap, description from /v3/reference/tickers/{ticker}. Provides fundamental context.', 3760),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('2 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_market_breadth', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Uses /v2/aggs/grouped to calculate advance/decline, new highs/lows, % above 20/50/200 SMA. Critical for SPX context.', 3760),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('6 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_dividend_info', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Returns upcoming ex-dates and yield from /v3/reference/dividends. Warns about early assignment risk on short calls.', 3760),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('2 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'compare_symbols', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Side-by-side comparison of 2\u20134 symbols: price, IV rank, technical setup, earnings proximity. Composites existing functions.', 3760),
            statusCell('LOW', BLUE_BG, BLUE_TEXT), dataCell('4 hours', 1800)
          ] }),
          new TableRow({ children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_unusual_activity', font: 'Courier New', size: 18 })] })], 2600),
            dataCell('Flags unusual options volume (vol > 3x avg OI) from existing snapshot data. No new API endpoint needed.', 3760),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT), dataCell('4 hours', 1800)
          ] }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 3: WIDGET AUDIT ═══════
      heading('3. Widget Card Audit'),
      para(normal('The AI Coach renders function call results as interactive widget cards. Currently 17 card types exist, with 1 (morning_brief) existing as a component but not as a widget card type.')),

      heading('Current 17 Widget Types', HeadingLevel.HEADING_2),
      para(normal('key_levels, position_summary, pnl_tracker, alert_status, market_overview, macro_context, options_chain, gex_profile, scan_results, current_price, spx_game_plan, zero_dte_analysis, iv_analysis, earnings_calendar, earnings_analysis, journal_insights, trade_history')),

      heading('New Widgets Needed', HeadingLevel.HEADING_2),

      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [2200, 2800, 2160, 2200],
        rows: [
          new TableRow({ children: [
            headerCell('Widget', 2200), headerCell('Triggers From', 2800), headerCell('Key Data', 2160), headerCell('Priority', 2200)
          ] }),
          new TableRow({ children: [
            dataCell('ticker_news', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_ticker_news()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('Headlines, source, timestamp, sentiment tag', 2160),
            statusCell('HIGH', RED_BG, RED_TEXT)
          ] }),
          new TableRow({ children: [
            dataCell('company_profile', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_company_profile()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('Sector, market cap, employees, description', 2160),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT)
          ] }),
          new TableRow({ children: [
            dataCell('market_breadth', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_market_breadth()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('A/D ratio, new highs/lows, % above MAs, breadth thrust', 2160),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT)
          ] }),
          new TableRow({ children: [
            dataCell('dividend_alert', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_dividend_info()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('Ex-date, amount, yield, assignment risk flag', 2160),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT)
          ] }),
          new TableRow({ children: [
            dataCell('unusual_activity', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'get_unusual_activity()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('Strike, volume, OI ratio, direction, premium', 2160),
            statusCell('MED', YELLOW_BG, YELLOW_TEXT)
          ] }),
          new TableRow({ children: [
            dataCell('symbol_comparison', 2200),
            dataCell([new Paragraph({ children: [new TextRun({ text: 'compare_symbols()', font: 'Courier New', size: 18 })] })], 2800),
            dataCell('Side-by-side price, IV, setup, earnings for 2\u20134 tickers', 2160),
            statusCell('LOW', BLUE_BG, BLUE_TEXT)
          ] }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 4: MASSIVE.COM DATA UTILIZATION ═══════
      heading('4. Massive.com Data Utilization'),
      para([normal('The platform currently uses approximately '), bold('15% of available Massive.com API endpoints'), normal('. The largest gaps are in market context, fundamentals, and news.')]),

      heading('API Coverage Map', HeadingLevel.HEADING_2),

      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [2800, 3960, 1200, 1400],
        rows: [
          new TableRow({ children: [
            headerCell('API Category', 2800), headerCell('Endpoints', 3960), headerCell('Status', 1200), headerCell('Impact', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Aggregates (OHLCV)', 2800), dataCell('/v2/aggs/ticker, /v2/aggs/grouped', 3960),
            statusCell('ACTIVE', GREEN_BG, GREEN_TEXT), dataCell('Core data', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Technical Indicators', 2800), dataCell('/v1/indicators/ema, sma, rsi, macd', 3960),
            statusCell('ACTIVE', GREEN_BG, GREEN_TEXT), dataCell('Chart overlays', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Options Snapshot', 2800), dataCell('/v3/snapshot/options, /v3/reference/options', 3960),
            statusCell('ACTIVE', GREEN_BG, GREEN_TEXT), dataCell('Chain + GEX', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Earnings (Benzinga)', 2800), dataCell('/v1/reference/earnings', 3960),
            statusCell('ACTIVE', GREEN_BG, GREEN_TEXT), dataCell('Calendar + analysis', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Last Trade / Quote', 2800), dataCell('/v2/last/trade, /v2/last/nbbo', 3960),
            statusCell('DEFINED', YELLOW_BG, YELLOW_TEXT), dataCell('Not wired to AI', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Market Status', 2800), dataCell('/v1/marketstatus/now, /upcoming', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('Hardcoded hours', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Stock Snapshots', 2800), dataCell('/v2/snapshot/.../tickers, gainers, losers', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No real-time dash', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('News', 2800), dataCell('/v2/reference/news', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No context for moves', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Ticker Details', 2800), dataCell('/v3/reference/tickers/{ticker}', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No company info', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Financials', 2800), dataCell('/vX/reference/financials', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No fundamentals', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Dividends', 2800), dataCell('/v3/reference/dividends', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No assignment risk', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Stock Splits', 2800), dataCell('/v3/reference/splits', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('Price adj gaps', 1400)
          ] }),
          new TableRow({ children: [
            dataCell('Grouped Daily', 2800), dataCell('/v2/aggs/grouped/locale/us/market/stocks', 3960),
            statusCell('MISSING', RED_BG, RED_TEXT), dataCell('No market breadth', 1400)
          ] }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 5: PRIORITIZED ROADMAP ═══════
      heading('5. Prioritized Enhancement Roadmap'),

      heading('Week 1\u20132: Quick Wins (Market Awareness)', HeadingLevel.HEADING_2),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 }, spacing: { after: 120 }, children: [bold('Wire getLastTrade() to AI functions'), normal(' \u2014 already defined in massive.ts, just needs handler + function definition. True real-time price instead of candle close. (30 min)')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 }, spacing: { after: 120 }, children: [bold('Enrich promptContext.ts market injection'), normal(' \u2014 add VIX, DXY, 10Y yield, current ET time + session phase. (2 hours)')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 }, spacing: { after: 120 }, children: [bold('Replace hardcoded market status'), normal(' \u2014 use /v1/marketstatus/now for live status including early closes. (2 hours)')] }),
      new Paragraph({ numbering: { reference: 'numbers', level: 0 }, spacing: { after: 120 }, children: [bold('Add earnings proximity to prompt context'), normal(' \u2014 inject "AAPL earnings in 2 days" warning when relevant. (2 hours)')] }),

      heading('Week 2\u20133: High Value (News + Context)', HeadingLevel.HEADING_2),
      new Paragraph({ numbering: { reference: 'findings', level: 0 }, spacing: { after: 120 }, children: [bold('Implement get_ticker_news()'), normal(' \u2014 new function + ticker_news widget card. /v2/reference/news endpoint. (4 hours)')] }),
      new Paragraph({ numbering: { reference: 'findings', level: 0 }, spacing: { after: 120 }, children: [bold('Implement get_company_profile()'), normal(' \u2014 new function + company_profile widget. /v3/reference/tickers/{ticker}. (2 hours)')] }),
      new Paragraph({ numbering: { reference: 'findings', level: 0 }, spacing: { after: 120 }, children: [bold('Add news digest to system prompt'), normal(' \u2014 for primary symbol, inject 3 headlines in context. (2 hours)')] }),
      new Paragraph({ numbering: { reference: 'findings', level: 0 }, spacing: { after: 120 }, children: [bold('Enhance get_earnings_analysis'), normal(' \u2014 add EPS/revenue estimate actuals from Benzinga data, post-earnings drift stats. (3 hours)')] }),

      heading('Week 3\u20134: Market Intelligence', HeadingLevel.HEADING_2),
      para([bold('9. '), normal('Implement get_market_breadth() \u2014 advance/decline, new highs/lows, breadth thrust detection. (6 hours)')]),
      para([bold('10. '), normal('Implement get_dividend_info() \u2014 ex-date warnings + early assignment risk. (2 hours)')]),
      para([bold('11. '), normal('Implement get_unusual_activity() \u2014 flag vol > 3x OI from existing snapshot data. (4 hours)')]),
      para([bold('12. '), normal('Enhance get_spx_game_plan() \u2014 add VIX context, breadth, earnings-heavy sectors. (3 hours)')]),

      heading('Deferred', HeadingLevel.HEADING_2),
      para([normal('compare_symbols() composite, fundamentals from /vX/reference/financials, historical trade/quote data for execution quality analysis, stock splits handling.')]),

      new Paragraph({ children: [new PageBreak()] }),

      // ═══════ SECTION 6: SUMMARY ═══════
      heading('6. Summary of Findings'),

      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [1400, 1400, 1400, 1400, 1400, 1960],
        rows: [
          new TableRow({ children: [
            headerCell('Area', 1400), headerCell('Current', 1400), headerCell('Target', 1400), headerCell('New Funcs', 1400), headerCell('New Widgets', 1400), headerCell('Est. Effort', 1960)
          ] }),
          new TableRow({ children: [
            dataCell('System Prompt', 1400), dataCell('7.5/10', 1400), dataCell('9.0/10', 1400),
            dataCell('\u2014', 1400), dataCell('\u2014', 1400), dataCell('~7 hours', 1960)
          ] }),
          new TableRow({ children: [
            dataCell('AI Functions', 1400), dataCell('24', 1400), dataCell('30', 1400),
            dataCell('+6', 1400), dataCell('\u2014', 1400), dataCell('~22 hours', 1960)
          ] }),
          new TableRow({ children: [
            dataCell('Widget Cards', 1400), dataCell('17', 1400), dataCell('23', 1400),
            dataCell('\u2014', 1400), dataCell('+6', 1400), dataCell('~18 hours', 1960)
          ] }),
          new TableRow({ children: [
            dataCell('API Utilization', 1400), dataCell('~15%', 1400), dataCell('~45%', 1400),
            dataCell('\u2014', 1400), dataCell('\u2014', 1400), dataCell('included above', 1960)
          ] }),
        ]
      }),

      new Paragraph({ spacing: { before: 400 } }),
      para([bold('Total estimated effort: ~47 engineer-hours'), normal(' across 4 weeks to triple Massive.com utilization, add 6 new AI functions, 6 new widget types, and significantly enrich the system prompt\u2019s contextual awareness.')]),
      new Paragraph({ spacing: { before: 200 } }),
      para([italic('Note: All enhancements are additive. No existing functions or widgets need to be removed. The Phase 14 widget optimization from the Codex spec should be implemented first, as the new tiered action model will apply to new widget types as well.', { color: GRAY })]),
    ]
  }]
});

// ── Write ──
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/focused-beautiful-dijkstra/mnt/ITM-gd/docs/AI_COACH_PROMPT_AND_ACTION_AUDIT.docx', buffer);
  console.log('DOCX written successfully');
});
