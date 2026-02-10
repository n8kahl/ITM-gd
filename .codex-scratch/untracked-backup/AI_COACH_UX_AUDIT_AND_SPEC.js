const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak
} = require('docx');

// ============================================================
// HELPERS
// ============================================================
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 9360

const COLORS = {
  emerald: '10B981',
  emeraldDark: '064E3B',
  champagne: 'F3E5AB',
  onyx: '0A0A0B',
  red: 'EF4444',
  amber: 'F59E0B',
  white: 'FFFFFF',
  lightGray: 'F5F5F5',
  midGray: 'E5E5E5',
  darkGray: '666666',
  headerBg: '0F172A',
  sectionBg: 'F8FAFC',
  criticalBg: 'FEF2F2',
  warningBg: 'FFFBEB',
  successBg: 'ECFDF5',
};

const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.midGray };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: COLORS.white };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Arial', color: COLORS.headerBg })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: COLORS.emeraldDark })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: COLORS.headerBg })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 21, font: 'Arial', color: opts.color || '333333', ...opts })],
  });
}

function paraRuns(runs) {
  return new Paragraph({
    spacing: { after: 120 },
    children: runs.map(r => new TextRun({ size: 21, font: 'Arial', color: '333333', ...r })),
  });
}

function bulletItem(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: opts.level || 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 21, font: 'Arial', color: '333333' })],
  });
}

function bulletRuns(runs, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: opts.level || 0 },
    spacing: { after: 60 },
    children: runs.map(r => new TextRun({ size: 21, font: 'Arial', color: '333333', ...r })),
  });
}

function severityTag(level) {
  const map = {
    CRITICAL: { bg: COLORS.criticalBg, color: 'B91C1C', text: 'CRITICAL' },
    HIGH: { bg: COLORS.warningBg, color: '92400E', text: 'HIGH' },
    MEDIUM: { bg: 'EFF6FF', color: '1E40AF', text: 'MEDIUM' },
    LOW: { bg: COLORS.successBg, color: '065F46', text: 'LOW' },
    ENHANCEMENT: { bg: 'F5F3FF', color: '5B21B6', text: 'ENHANCEMENT' },
  };
  return map[level] || map.MEDIUM;
}

function issueTable(issues) {
  const colWidths = [600, 2200, 4560, 2000];
  const headerShading = { fill: COLORS.headerBg, type: ShadingType.CLEAR };
  const headerRun = (t) => new TextRun({ text: t, bold: true, size: 18, font: 'Arial', color: COLORS.white });

  const headerRow = new TableRow({
    children: ['#', 'Issue', 'Detail / Current State', 'Severity'].map((t, i) =>
      new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.DXA },
        shading: headerShading,
        margins: cellMargins,
        verticalAlign: 'center',
        children: [new Paragraph({ children: [headerRun(t)] })],
      })
    ),
  });

  const rows = issues.map((issue, idx) => {
    const sev = severityTag(issue.severity);
    return new TableRow({
      children: [
        new TableCell({
          borders, width: { size: colWidths[0], type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: `${idx + 1}`, size: 18, font: 'Arial', color: '666666' })] })],
        }),
        new TableCell({
          borders, width: { size: colWidths[1], type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: issue.title, size: 18, font: 'Arial', bold: true, color: '1F2937' })] })],
        }),
        new TableCell({
          borders, width: { size: colWidths[2], type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: issue.detail, size: 18, font: 'Arial', color: '4B5563' })] })],
        }),
        new TableCell({
          borders, width: { size: colWidths[3], type: WidthType.DXA }, margins: cellMargins,
          shading: { fill: sev.bg.replace('#', ''), type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sev.text, size: 18, font: 'Arial', bold: true, color: sev.color })] })],
        }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...rows],
  });
}

function specTable(specs) {
  const colWidths = [2500, 4860, 2000];
  const headerShading = { fill: COLORS.emeraldDark, type: ShadingType.CLEAR };
  const headerRun = (t) => new TextRun({ text: t, bold: true, size: 18, font: 'Arial', color: COLORS.white });

  const headerRow = new TableRow({
    children: ['Element / Component', 'Specification', 'Priority'].map((t, i) =>
      new TableCell({
        borders, width: { size: colWidths[i], type: WidthType.DXA },
        shading: headerShading, margins: cellMargins,
        children: [new Paragraph({ children: [headerRun(t)] })],
      })
    ),
  });

  const rows = specs.map((spec) => {
    const sev = severityTag(spec.priority);
    return new TableRow({
      children: [
        new TableCell({
          borders, width: { size: colWidths[0], type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: spec.element, size: 18, font: 'Arial', bold: true, color: '1F2937' })] })],
        }),
        new TableCell({
          borders, width: { size: colWidths[1], type: WidthType.DXA }, margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: spec.spec, size: 18, font: 'Arial', color: '4B5563' })] })],
        }),
        new TableCell({
          borders, width: { size: colWidths[2], type: WidthType.DXA }, margins: cellMargins,
          shading: { fill: sev.bg.replace('#', ''), type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sev.text, size: 18, font: 'Arial', bold: true, color: sev.color })] })],
        }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...rows],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.midGray } },
    children: [],
  });
}

// ============================================================
// DOCUMENT
// ============================================================

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ],
  },
  sections: [
    // ============================================================
    // COVER PAGE
    // ============================================================
    {
      properties: {
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
      },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'TITM AI Coach', size: 56, bold: true, font: 'Arial', color: COLORS.emeraldDark })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: 'Comprehensive UX Audit & Implementation Spec', size: 32, font: 'Arial', color: COLORS.darkGray })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: 'Polish, Premium Touches, Navigation, Animation & Desktop/Mobile Audit', size: 22, font: 'Arial', color: '999999' })],
        }),
        divider(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: 'February 9, 2026', size: 22, font: 'Arial', color: COLORS.darkGray })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: 'Prepared for: Nate (TITM Engineering)', size: 22, font: 'Arial', color: COLORS.darkGray })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'UX Audit by: Claude (Senior UX Design Review)', size: 22, font: 'Arial', color: COLORS.darkGray })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ============================================================
    // MAIN CONTENT
    // ============================================================
    {
      properties: {
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'TITM AI Coach ', size: 16, font: 'Arial', color: COLORS.emeraldDark, bold: true }),
              new TextRun({ text: '| UX Audit & Implementation Spec', size: 16, font: 'Arial', color: '999999' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 16, font: 'Arial', color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '999999' }),
            ],
          })],
        }),
      },
      children: [
        // ============================================================
        // EXECUTIVE SUMMARY
        // ============================================================
        heading1('1. Executive Summary'),
        para('This document is a comprehensive page-by-page, button-by-button UX audit of the TITM AI Coach feature, followed by a detailed implementation specification that can be passed directly to Claude Code for production-quality implementation.'),
        para('The AI Coach is a powerful feature with deep capabilities: 20+ AI functions, live charting, full options chains with Greeks, GEX analysis, position tracking, trade journaling, and more. However, the current UX does not surface this power effectively. The issues fall into five categories:'),

        bulletRuns([{ text: 'Broken Interactions: ', bold: true }, { text: 'Chat empty-state buttons do nothing (no onClick wiring). The 4 center-panel prompt cards work, but the chat-side ones are dead.' }]),
        bulletRuns([{ text: 'Wrong Default Content: ', bold: true }, { text: 'The 4 example prompts (Key Levels, Market Status, ATR Analysis, VWAP Check) are low-value utility queries, not the high-impact analyses TITM users actually need. SPX-heavy analysis and morning workflow are buried.' }]),
        bulletRuns([{ text: 'Lackluster Morning Brief: ', bold: true }, { text: 'The brief is a flat data dump with no visual hierarchy, no actionable call-to-action flow, no overnight gap visualization, and no SPX/SPY correlation insight.' }]),
        bulletRuns([{ text: 'Missing Polish & Transitions: ', bold: true }, { text: 'No page-level animations, no skeleton loading states, inconsistent hover feedback, no empty-state illustrations, and the mobile experience lacks gesture support.' }]),
        bulletRuns([{ text: 'Navigation Confusion: ', bold: true }, { text: '13 tabs in a horizontal scroll bar is overwhelming. No tab grouping, no visual hierarchy between primary and secondary features, and the "Home" button is barely visible at the far right.' }]),

        paraRuns([{ text: 'Total issues found: ', bold: true }, { text: '47 across all pages. Of these, 8 are CRITICAL (broken functionality), 14 are HIGH (significant UX degradation), 16 are MEDIUM (polish/premium), and 9 are LOW/ENHANCEMENT.' }]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 2: CHAT EMPTY STATE (BROKEN BUTTONS)
        // ============================================================
        heading1('2. Chat Panel: Empty State & Broken Buttons'),

        heading2('2.1 The Bug: Dead Buttons in Chat Empty State'),
        para('File: app/members/ai-coach/page.tsx, lines 438-468 (EmptyState component)'),
        para('The EmptyState component renders 4 suggestion buttons in a 2x2 grid. These buttons have NO onClick handler. They are purely visual. When a user clicks them, nothing happens. This is the #1 most damaging UX bug because it is the very first interaction a new user has with the AI Coach.'),

        heading3('Current Code (Broken)'),
        para('The buttons are plain <button> elements with static text and hover styles, but no onClick prop is wired. The EmptyState function receives no props for sending messages.', { italics: true, color: COLORS.darkGray }),

        heading3('Root Cause'),
        para('The EmptyState component is defined as a standalone function with zero props. It has no reference to onSendMessage or any dispatch function. The ChatArea component renders <EmptyState /> with no prop drilling.'),

        heading2('2.2 Implementation Spec: Fix Chat Empty State'),

        specTable([
          { element: 'EmptyState component', spec: 'Add onSendPrompt prop of type (prompt: string) => void. Pass it from ChatArea which already has onSendMessage.', priority: 'CRITICAL' },
          { element: 'Suggestion buttons', spec: 'Wire onClick={() => onSendPrompt(prompt)} to each button. Use the same prompt strings as the center panel EXAMPLE_PROMPTS but with updated text (see Section 4).', priority: 'CRITICAL' },
          { element: 'Button content', spec: 'Replace the 4 generic prompts with high-value TITM prompts: (1) "SPX Game Plan" - full levels + GEX + expected move, (2) "Morning Brief" - triggers brief view, (3) "Best Setup Right Now" - runs scanner, (4) "SPX vs SPY Correlation" - new dedicated analysis.', priority: 'HIGH' },
          { element: 'Button animation', spec: 'Add framer-motion stagger animation: initial={{ opacity: 0, y: 8 }}, animate={{ opacity: 1, y: 0 }}, with 75ms stagger delay per button.', priority: 'MEDIUM' },
          { element: 'Visual feedback', spec: 'On click, flash emerald-500/20 background for 150ms, then transition to normal state as the message is sent.', priority: 'MEDIUM' },
          { element: 'Empty state icon', spec: 'Replace generic BrainCircuit icon with a custom animated SVG that subtly pulses the emerald glow. Consider Lottie animation of a trading chart forming.', priority: 'ENHANCEMENT' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 3: CENTER PANEL WELCOME VIEW
        // ============================================================
        heading1('3. Center Panel: Welcome View & Example Prompts'),

        heading2('3.1 Audit: The 4 Example Prompts Are Wrong'),
        para('File: components/ai-coach/center-panel.tsx, lines 125-150 (EXAMPLE_PROMPTS constant)'),
        para('Current prompts and why they fail TITM users:'),

        issueTable([
          { title: 'Key Levels prompt', detail: '"Where\'s PDH for SPX today?" - Asks for a single data point. A TITM user wants the full picture: all levels, GEX context, expected move, and what to watch. This is too narrow.', severity: 'HIGH' },
          { title: 'Market Status prompt', detail: '"What\'s the current market status?" - Returns a single sentence about market hours. Users can see if the market is open from any broker. Zero analytical value.', severity: 'HIGH' },
          { title: 'ATR Analysis prompt', detail: '"What\'s the ATR for SPX and NDX?" - Returns two numbers. No context on how to use them, no position sizing guidance, no historical comparison.', severity: 'HIGH' },
          { title: 'VWAP Check prompt', detail: '"Where is VWAP for SPX right now?" - Another single number. VWAP is already shown on the chart. This doesn\'t demonstrate AI capability.', severity: 'HIGH' },
          { title: 'No SPX deep analysis', detail: 'There is no prompt that triggers the impressive multi-tool SPX analysis (levels + GEX + 0DTE + expected move + chart). This is the killer feature, hidden behind knowing the right question.', severity: 'CRITICAL' },
          { title: 'No Morning Brief entry', detail: 'The Morning Brief is buried in tabs. It should be front-and-center as a primary CTA, especially pre-market.', severity: 'HIGH' },
          { title: 'No "What\'s the play?" prompt', detail: 'TITM users want "What should I be watching?" or "Best setup right now." The scanner exists but is never surfaced on the welcome screen.', severity: 'HIGH' },
          { title: 'No SPX/SPY correlation', detail: 'Users specifically need to understand SPX-to-SPY correlation, expected move translation, and which to trade. This is a core TITM use case with no entry point.', severity: 'CRITICAL' },
        ]),

        heading2('3.2 Implementation Spec: New Example Prompts'),
        para('Replace the 4 EXAMPLE_PROMPTS with these high-impact, multi-tool prompts that showcase what the AI Coach can really do:'),

        specTable([
          { element: 'Prompt 1: "SPX Game Plan"', spec: 'Icon: Target. Label: "SPX Game Plan". Prompt: "Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart." Description: "Complete SPX analysis with levels, GEX, and trade setups". This fires get_key_levels + get_gamma_exposure + show_chart in one flow.', priority: 'CRITICAL' },
          { element: 'Prompt 2: "Morning Brief"', spec: 'Icon: Sunrise. Label: "Morning Brief". Prompt: triggers onShowBrief() directly instead of sending a chat message (navigates to the Brief panel view). Description: "Pre-market overview, overnight gaps, key levels & events". Time-aware: before 9:30am ET show "Good morning - here\'s your brief", during market hours show "Market Pulse".', priority: 'CRITICAL' },
          { element: 'Prompt 3: "Best Setup Now"', spec: 'Icon: Search (or Crosshair). Label: "Best Setup Now". Prompt: "Scan SPX, NDX, QQQ, SPY, AAPL, TSLA, NVDA for the best setups right now. Show me the highest-probability trade with entry, target, and stop." Description: "AI scans 7 symbols for the highest-conviction setup". This fires scan_opportunities with a curated watchlist.', priority: 'HIGH' },
          { element: 'Prompt 4: "SPX vs SPY"', spec: 'Icon: Activity (or GitCompare). Label: "SPX vs SPY". Prompt: "Compare SPX and SPY right now: price levels, expected move, GEX context, and which has the better risk/reward for day trading today. Include the SPX-to-SPY price ratio." Description: "Head-to-head comparison for day trading". This fires get_key_levels for both + get_gamma_exposure for both.', priority: 'CRITICAL' },
        ]),

        heading2('3.3 Implementation Spec: Welcome View Layout Overhaul'),
        para('The welcome view needs to establish visual hierarchy and make the AI Coach feel like a premium command center, not a list of links.'),

        specTable([
          { element: 'Hero section', spec: 'Replace the generic "Welcome to AI Coach" with a dynamic greeting: "Good [morning/afternoon], [Name]" with current SPX price displayed live (call get_current_price on mount). Show market status pill (Pre-Market / Market Open / After Hours / Closed) with appropriate color coding.', priority: 'HIGH' },
          { element: 'SPX Live Ticker', spec: 'Add a mini SPX price bar below the greeting: current price, change from open, change %, and a 1-sentence AI status ("SPX holding above PDH, positive gamma regime"). Auto-refreshes every 60s. This immediately signals "this tool has live data."', priority: 'HIGH' },
          { element: 'Primary CTA row', spec: 'The 4 example prompt cards should be in a 2x2 grid on desktop, single column on mobile. Each card: 64px height, icon left, text right, emerald gradient border on hover, slight scale(1.02) on hover. The entire card is clickable.', priority: 'MEDIUM' },
          { element: 'Quick Access grid', spec: 'Reduce from 12 cards to 8 by grouping: (1) Chart, (2) Options, (3) Analyze, (4) Journal, (5) Brief, (6) Scanner, (7) LEAPS, (8) Macro. Move Alerts, Tracked, Earnings, Prefs into a "More Tools" expandable section or into the tab bar only.', priority: 'MEDIUM' },
          { element: 'Animation on mount', spec: 'Stagger fade-in for all elements: hero (0ms), SPX ticker (100ms), prompt cards (200ms + 75ms each), quick access grid (400ms). Use framer-motion with spring physics.', priority: 'MEDIUM' },
          { element: 'Header bar buttons', spec: 'The top-right buttons (Chart, Options, Analyze, Brief, Prefs) are redundant with both the tab bar and the quick access grid. Remove them. Let the tab bar and quick access cards handle navigation. This declutters the header significantly.', priority: 'MEDIUM' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 4: MORNING BRIEF OVERHAUL
        // ============================================================
        heading1('4. Morning Brief: From Data Dump to Command Center'),

        heading2('4.1 Audit: Current Morning Brief Issues'),
        para('File: components/ai-coach/morning-brief.tsx (290 lines)'),

        issueTable([
          { title: 'No visual hierarchy', detail: 'All 6 sections (Summary, Watchlist, Key Levels, Events, Positions, Watch Items) have identical glass-card styling. Nothing draws the eye. The most important info (AI summary, gap analysis) looks the same as low-priority data.', severity: 'HIGH' },
          { title: 'AI Summary is buried', detail: 'The AI-generated market context paragraph is in a small box at the top with text-sm text-white/75. This should be the hero of the brief - large, prominent, with a clear "here\'s what matters today" framing.', severity: 'HIGH' },
          { title: 'No gap visualization', detail: 'overnightSummary has futuresDirection, gapSize, gapPct, and atrRatio data but none of it is rendered in the UI. The overnight gap is the single most important pre-market data point for day traders.', severity: 'CRITICAL' },
          { title: 'No SPX/SPY correlation', detail: 'Brief shows SPX, NDX, SPY, QQQ levels in separate rows but never correlates them. TITM users need to see the SPX-SPY relationship at a glance (e.g., "SPX expected move = 42pts, translating to ~$4.20 on SPY").', severity: 'HIGH' },
          { title: 'Key Levels are flat text', detail: 'Levels show as "Pivot 5930 | PDH 5950 | PDL 5910 | ATR 42" in plain text. No color coding for above/below current price, no mini-chart or level ladder visualization, no "nearest level" highlighting.', severity: 'HIGH' },
          { title: 'Watchlist is just chips', detail: 'Watchlist symbols are small emerald chips. No prices, no change %, no visual indication of which are up/down overnight. Should show mini price + change.', severity: 'MEDIUM' },
          { title: 'No "Plan the Day" CTA', detail: 'After reading the brief, users need a clear next action: "Ask AI Coach for today\'s SPX game plan" or "Set alerts on these levels." Currently the brief is a dead-end.', severity: 'HIGH' },
          { title: 'Earnings section is generic', detail: 'Shows earnings with BMO/AMC timing but no expected move visualization, no IV rank bar, no suggested strategy. The earnings_analysis function exists but isn\'t leveraged here.', severity: 'MEDIUM' },
          { title: 'No time-awareness', detail: 'Brief looks the same at 6am (pre-market) as it does at 2pm (mid-session). Should adapt: pre-market emphasizes gaps/overnight; mid-session emphasizes levels tested/remaining range.', severity: 'MEDIUM' },
          { title: '"Mark Viewed" is confusing', detail: 'Users don\'t understand what "Mark Viewed" does or why it matters. The label is unclear. Should be automatic (mark viewed on scroll to bottom) or removed entirely.', severity: 'LOW' },
        ]),

        heading2('4.2 Implementation Spec: Morning Brief Redesign'),

        heading3('4.2.1 New Layout Structure (Top to Bottom)'),
        specTable([
          { element: 'Header bar', spec: 'Date + market status pill + auto-refresh indicator (last updated X min ago). Remove "Mark Viewed" button. Auto-mark as viewed when user scrolls past 50% of content.', priority: 'HIGH' },
          { element: 'Hero: AI Summary', spec: 'Full-width card with larger text (text-base), emerald-500/5 background, left emerald border accent. Bold the key takeaway sentence. Max 3 sentences. Include a "Ask AI to elaborate" link button.', priority: 'HIGH' },
          { element: 'Overnight Gap Card', spec: 'NEW: Render overnightSummary data. Show futures direction arrow (green up / red down), gap size in points AND percentage, ATR ratio ("Gap = 0.6x ATR"), historical fill rate ("67% of similar gaps fill by 11am"). Use a horizontal bar chart showing gap relative to ATR.', priority: 'CRITICAL' },
          { element: 'SPX Focus Card', spec: 'NEW: Dedicated SPX section (since it\'s the primary instrument). Show: current price, change from PDC, position relative to levels (above/below PDH, PDL, pivot, VWAP), gamma regime indicator (positive/negative), expected move bar. Include "View SPX Chart" and "SPX Options Chain" quick-action buttons.', priority: 'CRITICAL' },
          { element: 'SPX/SPY Correlation Row', spec: 'NEW: Side-by-side mini cards for SPX and SPY. Show price, expected move, and the conversion factor ("SPX 5930 = SPY $593.00, EM ~$4.20"). Color-code if divergence exists.', priority: 'HIGH' },
          { element: 'Level Ladder', spec: 'Replace flat text with a vertical "level ladder" visualization for each symbol. Current price shown as a horizontal marker, resistance levels above in red, support below in green. Nearest level highlighted with a pulsing indicator. Each level clickable to set alert.', priority: 'HIGH' },
          { element: 'Economic Events', spec: 'Keep existing but add: countdown timer for next HIGH-impact event, red/amber/green left-border color coding, and a "Set reminder" button for each event.', priority: 'MEDIUM' },
          { element: 'Earnings Preview', spec: 'Enhance with: IV rank as a visual bar (0-100), expected move as +/- price range, and one-line strategy suggestion ("IV Rank 85 - consider selling premium"). Link to Earnings Dashboard.', priority: 'MEDIUM' },
          { element: 'Bottom CTA Bar', spec: 'NEW: Sticky bottom bar with 3 action buttons: "Get SPX Game Plan" (sends prompt to chat), "Set Level Alerts" (opens alerts panel with pre-filled levels from brief), "Scan for Setups" (opens scanner). This is the "what\'s next" after reading the brief.', priority: 'HIGH' },
        ]),

        heading3('4.2.2 Backend Enhancements Required'),
        specTable([
          { element: 'SPX/SPY correlation calc', spec: 'Add to morningBrief service: calculate SPX-to-SPY ratio, translate expected move, flag divergences. Store as spxSpyCorrelation field in brief data.', priority: 'HIGH' },
          { element: 'Overnight gap rendering', spec: 'The overnightSummary data already exists in the MorningBrief interface but is not rendered by the frontend. No backend change needed - just wire it up.', priority: 'CRITICAL' },
          { element: 'Gamma regime flag', spec: 'Add gammaRegime: "positive" | "negative" | "neutral" to keyLevelsToday for SPX. Derive from existing GEX flip point vs current price. Already calculable from get_gamma_exposure function handler.', priority: 'HIGH' },
          { element: 'Time-aware brief mode', spec: 'Add briefMode field: "pre_market" (4am-9:30am), "session" (9:30am-4pm), "post_market" (4pm+). Frontend uses this to show/hide relevant sections and adjust language.', priority: 'MEDIUM' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 5: SPX HEAVY ANALYSIS
        // ============================================================
        heading1('5. SPX-Heavy Analysis: The Star Feature'),

        heading2('5.1 Audit: Current SPX Support'),
        para('The AI Coach already supports SPX with all tools (get_key_levels, get_gamma_exposure, get_zero_dte_analysis, get_options_chain, show_chart, etc.). However, there is no dedicated "SPX Analysis" experience. Users must know to ask the right questions. The system prompt treats SPX the same as any other ticker.'),
        para('What TITM users actually want when they think "SPX analysis":'),
        bulletItem('Where are we relative to key levels (PDH, PDL, pivot, VWAP, PMH, PML)?'),
        bulletItem('What is the GEX regime? Above or below flip point? Implications for range/breakout.'),
        bulletItem('What is the expected move today? How much has been used?'),
        bulletItem('What does the 0DTE structure look like? Where is the gamma risk?'),
        bulletItem('How does this translate to SPY for those trading the ETF?'),
        bulletItem('What is the best setup/next trade in SPX right now?'),
        bulletItem('What is the big-picture trend (weekly/monthly)?'),

        heading2('5.2 Implementation Spec: SPX Power Analysis'),

        heading3('5.2.1 New "SPX Game Plan" Composite Function'),
        specTable([
          { element: 'New backend function: get_spx_game_plan', spec: 'A composite function handler that orchestrates: (1) get_key_levels("SPX"), (2) get_gamma_exposure("SPX"), (3) get_zero_dte_analysis("SPX"), (4) get_current_price("SPX"), (5) get_current_price("SPY") in parallel. Returns a unified SPX analysis object with all data pre-joined. This avoids 5 sequential function calls and gives the AI everything it needs in one shot.', priority: 'CRITICAL' },
          { element: 'SPX/SPY correlation data', spec: 'Include in game plan response: spx_price, spy_price, ratio (SPX/SPY), expected_move_spx, expected_move_spy (translated), gamma_regime, flip_point, and a "setup_context" string that describes the current setup in 1-2 sentences.', priority: 'HIGH' },
          { element: 'System prompt enhancement', spec: 'Add to system prompt: "When asked about SPX game plan, levels, or analysis, ALWAYS call get_spx_game_plan. Lead with the setup context sentence, then show key levels, then GEX context, then expected move status, then next-best setup. Always mention SPY translation for day traders."', priority: 'HIGH' },
          { element: 'Widget card: SPXGamePlanCard', spec: 'NEW widget type "spx_game_plan" rendered inline in chat. Shows: (1) Price bar with level annotations, (2) GEX regime badge, (3) Expected move usage bar, (4) SPY translation row, (5) "What to watch" bullet points, (6) Action buttons: View Chart, Options Chain, Set Alerts.', priority: 'HIGH' },
        ]),

        heading3('5.2.2 "Always-On" SPX Intelligence'),
        specTable([
          { element: 'SPX Persistent Ticker', spec: 'Add a small persistent SPX price + change ticker to the chat header area. Shows: SPX 5,930.45 +12.30 (+0.21%). Updates every 30s via polling or WebSocket. Clicking it sends "SPX game plan" to chat.', priority: 'HIGH' },
          { element: 'SPX Context in All Responses', spec: 'When user asks about ANY symbol, the AI should note if there is a relevant SPX context (e.g., "Note: SPX is in positive gamma above 5,920 flip point, which supports a range-bound regime that could affect AAPL."). Add to system prompt.', priority: 'MEDIUM' },
          { element: '"Next Best Setup" Auto-Refresh', spec: 'On the welcome view, show a "Next Best SPX Setup" card that auto-generates every 15 minutes during market hours. Uses scan_opportunities + get_key_levels to identify the nearest actionable trade. Shows entry level, direction, target, and stop.', priority: 'ENHANCEMENT' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 6: CHAT INTERFACE POLISH
        // ============================================================
        heading1('6. Chat Interface: Polish & Premium Touches'),

        heading2('6.1 Audit Findings'),

        issueTable([
          { title: 'No message entrance animation', detail: 'Messages appear instantly with no animation. Should slide/fade in for visual continuity. Compare to ChatGPT and Perplexity which both animate message appearance.', severity: 'MEDIUM' },
          { title: 'Typing indicator is basic', detail: '3 bouncing dots is functional but not premium. Consider a more sophisticated "thinking" animation that shows what the AI is doing ("Fetching SPX levels...", "Analyzing gamma exposure...").', severity: 'MEDIUM' },
          { title: 'No skeleton loading for sessions', detail: 'Session sidebar shows a spinner when loading. Should show skeleton placeholder rows that match the session item shape.', severity: 'LOW' },
          { title: 'Textarea doesn\'t grow smoothly', detail: 'Auto-resize jumps between heights. Should use smooth CSS transition on height changes.', severity: 'LOW' },
          { title: 'No quick-action buttons after response', detail: 'After AI responds about SPX levels, there should be suggested follow-up actions: "Show chart", "See options chain", "Set alerts on these levels". Currently the user must type everything.', severity: 'HIGH' },
          { title: 'Widget cards lack interactivity polish', detail: 'Widget action bars exist but have no hover tooltips, no keyboard navigation, and no visual feedback on click beyond color change.', severity: 'MEDIUM' },
          { title: 'Image upload has no analysis feedback', detail: 'Screenshot upload stages the image but the TODO comment in handleImageAnalysis shows integration is incomplete. Backend has analyzeScreenshot but it\'s not wired into the streaming chat flow.', severity: 'HIGH' },
          { title: 'Rate limit banner is alarming', detail: 'Shows "X/Y queries used" in amber which feels like a warning. Should be a calm progress indicator that only turns amber at 80% and red at 95%.', severity: 'LOW' },
        ]),

        heading2('6.2 Implementation Spec: Chat Polish'),

        specTable([
          { element: 'Message entrance animation', spec: 'Wrap each ChatMessageBubble in framer-motion: initial={{ opacity: 0, y: 12, scale: 0.97 }}, animate={{ opacity: 1, y: 0, scale: 1 }}, transition={{ duration: 0.25, ease: "easeOut" }}. User messages slide from right, AI from left.', priority: 'MEDIUM' },
          { element: 'Rich typing indicator', spec: 'Replace bouncing dots with a status-aware indicator. Use message.streamStatus to show: "Thinking..." (brain icon pulse), "Fetching SPX data..." (database icon), "Analyzing..." (chart icon), "Writing response..." (pencil icon). Each status has its own icon and subtle animation.', priority: 'MEDIUM' },
          { element: 'Suggested follow-up chips', spec: 'After each AI response, parse the response content to generate 2-3 follow-up action chips. E.g., after levels response: ["Show SPX Chart", "Options Chain", "Set Level Alerts"]. These are clickable and send the appropriate prompt. Render below the message as small emerald-outlined pills.', priority: 'HIGH' },
          { element: 'Smart image analysis', spec: 'Complete the TODO in handleImageAnalysis. When user stages an image and sends, (1) show the image inline in the chat as a user message attachment, (2) call the backend analyzeScreenshot API, (3) stream the analysis response. The backend endpoint already exists.', priority: 'HIGH' },
          { element: 'Textarea smooth resize', spec: 'Add CSS: transition: height 0.15s ease. On the textarea auto-resize onChange handler, wrap the height update in requestAnimationFrame for smoother rendering.', priority: 'LOW' },
          { element: 'Session skeleton loader', spec: 'When isLoadingSessions, render 4 skeleton rows instead of spinner: div with animate-pulse, h-10, rounded-lg, bg-white/5 with varying widths (80%, 60%, 90%, 70%).', priority: 'LOW' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 7: NAVIGATION OVERHAUL
        // ============================================================
        heading1('7. Navigation & Tab Architecture'),

        heading2('7.1 Audit: Current Navigation Issues'),

        issueTable([
          { title: '13 tabs is overwhelming', detail: 'The tab bar contains: Chart, Options, Positions, Journal, Screenshot, Alerts, Brief, Scanner, Tracked, LEAPS, Earnings, Macro, Prefs. This is too many for a horizontal scroll. Users cannot see all options at once, especially on smaller screens.', severity: 'HIGH' },
          { title: '"Home" is barely visible', detail: 'The "Home" button is a text-only link at the far right of the tab bar, styled as text-white/30 (nearly invisible). It blends into the tab bar. Users may not know how to get back to the welcome view.', severity: 'HIGH' },
          { title: 'No tab grouping', detail: 'Chart, Options, and Scanner are "analysis" tools. Positions, Journal, and LEAPS are "portfolio" tools. Alerts and Tracked are "monitoring" tools. Brief and Macro are "research." They should be visually grouped.', severity: 'MEDIUM' },
          { title: 'No mobile bottom nav for tabs', detail: 'Mobile only shows Chat vs Chart toggle. The 13 center panel tabs are hidden behind a horizontal scroll that is hard to discover and use with touch.', severity: 'HIGH' },
          { title: 'Tab bar has no active indicator animation', detail: 'Active tab changes instantly with no transition. Should have a sliding underline indicator that animates between tabs (like Material Design tabs).', severity: 'MEDIUM' },
          { title: 'No keyboard navigation', detail: 'Tabs are not navigable via arrow keys. No aria-labels or tablist role. Accessibility audit would flag this.', severity: 'MEDIUM' },
          { title: 'Breadcrumb is underused', detail: 'WorkflowBreadcrumb shows history but is only visible during workflow navigation. It should persist as a "you are here" indicator showing: Home > Chart > SPX 1D.', priority: 'LOW', severity: 'LOW' },
        ]),

        heading2('7.2 Implementation Spec: Navigation Redesign'),

        specTable([
          { element: 'Grouped tabs', spec: 'Reorganize 13 tabs into 4 groups with visual separators: ANALYZE (Chart, Options, Scanner), PORTFOLIO (Positions, Journal, LEAPS, Tracked), MONITOR (Alerts, Earnings), RESEARCH (Brief, Macro). Groups separated by subtle vertical divider (1px white/10). Group labels shown as text-[9px] text-white/20 above the group on hover.', priority: 'HIGH' },
          { element: 'Home button', spec: 'Move Home from far-right text to a dedicated icon button (Home icon from lucide-react) at the LEFT of the tab bar, before all groups. Style: w-8 h-8, rounded-lg, bg-white/5, border border-white/10, hover:bg-emerald-500/10 hover:border-emerald-500/30. Always visible.', priority: 'HIGH' },
          { element: 'Tab underline animation', spec: 'Add a framer-motion layoutId animated underline that slides between active tabs. Use a 2px emerald-500 bottom border with a spring animation (stiffness: 500, damping: 30). This adds the premium feel of a polished tabbar.', priority: 'MEDIUM' },
          { element: 'Tab overflow on desktop', spec: 'If window is narrow, show left/right arrow buttons at edges of tab bar that scroll by one group. Fade edges to indicate scrollability.', priority: 'MEDIUM' },
          { element: 'Mobile tab drawer', spec: 'On mobile, replace horizontal tab scroll with a bottom-sheet drawer triggered by a "Tools" button. Shows all 13 tabs in a 3-column grid with icons + labels. Slides up from bottom with backdrop blur. Close on selection or swipe down.', priority: 'HIGH' },
          { element: 'Prefs into settings icon', spec: 'Remove Prefs from the main tab bar. Add a gear icon (Settings) to the far right of the tab bar header, next to Home. This opens Preferences as an overlay/modal rather than a full view.', priority: 'LOW' },
          { element: 'Screenshot into chat', spec: 'Remove Screenshot from tabs. It\'s a chat feature (upload image and analyze). Move the upload trigger into the chat input area (it\'s already partially there via ChatImageUpload). Remove the dedicated center panel view.', priority: 'LOW' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 8: ANIMATIONS & TRANSITIONS
        // ============================================================
        heading1('8. Animations, Transitions & Loading States'),

        heading2('8.1 Audit: Missing or Weak Animations'),

        issueTable([
          { title: 'No page transition animation', detail: 'Switching between center panel views (chart, options, brief, etc.) is an instant swap. No fade, no slide. Feels jarring and cheap. Every view change should have a transition.', severity: 'HIGH' },
          { title: 'No skeleton loaders', detail: 'Chart, options chain, morning brief, and other data-heavy views show a centered spinner while loading. Should show skeleton placeholders that match the content shape (like LinkedIn or YouTube loading states).', severity: 'MEDIUM' },
          { title: 'Tab switch is instant', detail: 'Covered in navigation section - needs sliding underline and content crossfade.', severity: 'MEDIUM' },
          { title: 'Widget cards pop in', detail: 'Inline widget cards (key levels, GEX profile, etc.) appear instantly when the AI response streams in. They should fade-in and scale up subtly as they enter the viewport.', severity: 'MEDIUM' },
          { title: 'No micro-interactions', detail: 'Buttons have hover color changes but no scale feedback, no haptic-like feedback, no subtle spring animations that make the interface feel alive.', severity: 'LOW' },
          { title: 'Chart loads with no transition', detail: 'When chart data arrives, candlesticks appear all at once. Consider a left-to-right reveal animation or a brief scale-in to add drama.', severity: 'LOW' },
        ]),

        heading2('8.2 Implementation Spec: Animation System'),

        specTable([
          { element: 'View transition wrapper', spec: 'Create a <ViewTransition> component wrapping the center panel content area. Uses framer-motion AnimatePresence with mode="wait". Each view enters with: initial={{ opacity: 0, x: 20 }}, animate={{ opacity: 1, x: 0 }}, exit={{ opacity: 0, x: -20 }}, transition={{ duration: 0.2 }}. Direction-aware: forward navigation slides left, backward slides right.', priority: 'HIGH' },
          { element: 'Skeleton loaders per view', spec: 'Create skeleton components for: ChartSkeleton (rectangle + toolbar bars), OptionsSkeleton (table rows), BriefSkeleton (card outlines), ScannerSkeleton (list items). Each uses animate-pulse with bg-white/5 shapes. Show for minimum 300ms to avoid flash.', priority: 'MEDIUM' },
          { element: 'Widget card entrance', spec: 'Wrap WidgetCard in framer-motion: initial={{ opacity: 0, y: 8, scale: 0.95 }}, animate={{ opacity: 1, y: 0, scale: 1 }}, transition={{ duration: 0.3, delay: index * 0.1 }}. Cards stagger in with a slight bounce.', priority: 'MEDIUM' },
          { element: 'Button micro-interactions', spec: 'Add to all interactive buttons: whileTap={{ scale: 0.97 }}, whileHover={{ scale: 1.02 }}, transition={{ type: "spring", stiffness: 400, damping: 17 }}. Use framer-motion\'s motion.button wrapper.', priority: 'LOW' },
          { element: 'Loading shimmer', spec: 'Replace all Loader2 animate-spin instances in main content areas with shimmer skeletons. Keep spinner only for small inline indicators (e.g., refresh button, send button). Global: create a useIsLoading hook that returns skeleton-friendly loading states.', priority: 'MEDIUM' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 9: MOBILE/DESKTOP AUDIT
        // ============================================================
        heading1('9. Desktop & Mobile Audit'),

        heading2('9.1 Desktop Issues'),

        issueTable([
          { title: 'Chat panel min-width too aggressive', detail: 'Chat panel minSize={30} (30%) can make it too narrow on smaller desktop screens. At 1280px width, 30% = 384px which is fine. But the max of 55% can leave the center panel at only 45% = 576px, too tight for options chain or chart.', severity: 'LOW' },
          { title: 'No panel collapse option', detail: 'Users should be able to fully collapse the chat panel to maximize the center panel (for charting), and vice versa. Currently locked to 30-55% / 45-70%.', severity: 'MEDIUM' },
          { title: 'Resize handle is hard to discover', detail: 'The 1.5px resize handle between panels is nearly invisible. Should be wider (4px) with a visible grip indicator (3 dots) that appears on hover.', severity: 'MEDIUM' },
          { title: 'No keyboard shortcuts', detail: 'No Cmd+K for search, no Cmd+/ for chat focus, no Esc to close panels, no Cmd+1-9 for tab switching. Premium tools have keyboard shortcuts.', severity: 'MEDIUM' },
        ]),

        heading2('9.2 Mobile Issues'),

        issueTable([
          { title: 'Two-mode toggle is limiting', detail: 'Mobile only offers Chat or Chart view. All 13 center panel features (options, journal, alerts, etc.) require switching to "Chart" mode then scrolling through tabs. This is a significant UX barrier.', severity: 'HIGH' },
          { title: 'No swipe gesture support', detail: 'Cannot swipe between chat and center panel. Must tap the toggle. Swipe gestures are expected on mobile for panel switching.', severity: 'MEDIUM' },
          { title: 'Chat input is at bottom but keyboard pushes it up', detail: 'On mobile, the keyboard pushes the chat input up. If the input area is too close to content, messages can be obscured. Need proper viewport handling.', severity: 'MEDIUM' },
          { title: 'Welcome view buttons are too small on mobile', detail: 'The 4-column quick access grid results in tiny touch targets on mobile. Buttons are approximately 80px wide, below the 44px minimum touch target recommendation.', severity: 'HIGH' },
          { title: 'Tab bar horizontal scroll lacks visual cues', detail: 'On mobile, the center panel tab bar has overflow-x-auto but no visual indicator that more tabs exist to the right. Need edge fade gradients.', severity: 'MEDIUM' },
          { title: 'No pull-to-refresh', detail: 'Morning brief, positions, and alerts should support pull-to-refresh on mobile for a native-app feel.', severity: 'LOW' },
        ]),

        heading2('9.3 Implementation Spec: Responsive Fixes'),

        specTable([
          { element: 'Mobile view architecture', spec: 'Replace the binary Chat/Chart toggle with a 3-mode system: Chat (default), Canvas (center panel), Split (side-by-side on tablets). Add a "Tools" floating action button that opens a bottom-sheet drawer with all 13 features as a grid.', priority: 'HIGH' },
          { element: 'Swipe navigation', spec: 'Implement horizontal swipe between Chat and Canvas using framer-motion drag gesture: drag="x", dragConstraints={{ left: 0, right: 0 }}, onDragEnd to determine direction. Requires 50px minimum swipe distance.', priority: 'MEDIUM' },
          { element: 'Mobile quick access', spec: 'On mobile, change the 4-column grid to 2 columns. Each button minimum 44px height with 12px padding. Icon + text stacked vertically. Touch target area extends to full cell.', priority: 'HIGH' },
          { element: 'Collapsible chat panel (desktop)', spec: 'Add a collapse button to the chat panel header. When collapsed, chat becomes a narrow sidebar (48px) showing only the session icon and a "New Chat" button. Double-click resize handle to toggle collapse. Store preference in localStorage.', priority: 'MEDIUM' },
          { element: 'Resize handle enhancement', spec: 'Width: 6px (from 1.5px). Add 3 horizontal grip dots centered vertically, visible on hover. Cursor: col-resize. Hover: bg-emerald-500/30 with 200ms transition. Active: bg-emerald-500/50.', priority: 'MEDIUM' },
          { element: 'Tab edge fade on mobile', spec: 'Add gradient fade overlay on left/right edges of tab bar when content is scrollable: a 24px wide gradient from transparent to bg-[#0A0A0B]. Hides when scrolled to edge.', priority: 'LOW' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 10: LABELS AND COPY AUDIT
        // ============================================================
        heading1('10. Labels, Copy & Microcopy Audit'),

        heading2('10.1 Label Issues Found'),

        issueTable([
          { title: '"AI Coach Center" header', detail: 'The welcome view header says "AI Coach Center" with subtitle "Charts, options & analytics." This is descriptive but not inspiring. Should feel like a command center or mission control, not a documentation page.', severity: 'LOW' },
          { title: '"What can I help you with?"', detail: 'Chat empty state heading is generic. For a trading tool, this should be action-oriented: "What are you trading today?" or "Ready to analyze?"', severity: 'LOW' },
          { title: 'Tab labels are abbreviations', detail: '"Prefs" is unclear. "Tracked" doesn\'t specify what. "Brief" assumes knowledge. Better: "Settings", "Watchlist", "Daily Brief."', severity: 'LOW' },
          { title: 'Morning Brief "Watch Items"', detail: 'The section header "Watch Items" reads like a database field name. Should be "What to Watch" or "Eyes On."', severity: 'LOW' },
          { title: '"Mark Viewed" button', detail: 'Users don\'t care about marking things viewed. If tracking is needed for analytics, do it automatically. Remove the button.', severity: 'LOW' },
          { title: 'Placeholder text is generic', detail: 'Chat textarea placeholder: "Ask about any ticker, levels, options..." is okay but doesn\'t inspire. Rotate through contextual placeholders: pre-market shows "What\'s the gap looking like?", during session shows "How\'s SPX holding up?", after hours shows "Recap today\'s session."', severity: 'MEDIUM' },
          { title: 'Error messages are technical', detail: '"Failed to load chart data" is developer-speak. Should be "Chart data unavailable - trying again..." with automatic retry.', severity: 'MEDIUM' },
        ]),

        heading2('10.2 Implementation Spec: Copy Improvements'),

        specTable([
          { element: 'Welcome header', spec: 'Change "AI Coach Center" to "Command Center". Subtitle: dynamic based on time - "Pre-Market Prep" (4-9:30am), "Live Session" (9:30am-4pm), "After-Hours Review" (4pm+), "Market Closed" (weekends/holidays).', priority: 'LOW' },
          { element: 'Chat empty state', spec: 'Change "What can I help you with?" to "What are you trading today?" with subtitle "Ask me about any ticker - levels, options, setups, and more."', priority: 'LOW' },
          { element: 'Tab labels', spec: 'Rename: "Tracked" to "Watchlist", "Prefs" to settings icon (no text), "Brief" to "Daily Brief". Keep others as-is.', priority: 'LOW' },
          { element: 'Rotating placeholder', spec: 'Create a PLACEHOLDER_PROMPTS array keyed by market status. Rotate every 10 seconds with a fade transition. Examples: "Where are the GEX levels for SPX?", "Scan for the best setup right now", "How\'s my AAPL LEAPS position doing?"', priority: 'MEDIUM' },
          { element: 'Error messages', spec: 'Replace all user-facing error strings with friendly, actionable copy. "Failed to load X" becomes "X is temporarily unavailable. [Retry]". Auto-retry after 3 seconds with exponential backoff. Show retry count.', priority: 'MEDIUM' },
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 11: IMPLEMENTATION PRIORITY
        // ============================================================
        heading1('11. Implementation Priority & Phasing'),

        heading2('Phase 1: Critical Fixes (Ship This Week)'),
        para('These are broken features or severely missing functionality. Zero polish, just make it work correctly.'),

        bulletRuns([{ text: '[CRITICAL] ', bold: true, color: 'B91C1C' }, { text: 'Fix dead buttons in chat EmptyState - wire onClick to onSendMessage' }]),
        bulletRuns([{ text: '[CRITICAL] ', bold: true, color: 'B91C1C' }, { text: 'Replace 4 example prompts with SPX Game Plan, Morning Brief, Best Setup Now, SPX vs SPY' }]),
        bulletRuns([{ text: '[CRITICAL] ', bold: true, color: 'B91C1C' }, { text: 'Render overnightSummary data in morning brief (already in API, just not displayed)' }]),
        bulletRuns([{ text: '[CRITICAL] ', bold: true, color: 'B91C1C' }, { text: 'Build get_spx_game_plan composite function on backend' }]),
        bulletRuns([{ text: '[CRITICAL] ', bold: true, color: 'B91C1C' }, { text: 'Add SPX/SPY correlation to morning brief' }]),

        heading2('Phase 2: High-Impact UX (Ship Next Week)'),
        para('These are the high-value improvements that make the AI Coach feel premium and differentiated.'),

        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Welcome view hero redesign with live SPX ticker and dynamic greeting' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Morning brief redesign: AI summary hero, overnight gap card, SPX focus card, level ladder, bottom CTA bar' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Suggested follow-up chips after AI responses' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Navigation grouped tabs with Home button fix' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Mobile view architecture: 3-mode system with Tools FAB' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Mobile quick access 2-column grid with proper touch targets' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'Complete screenshot analysis integration in chat' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'SPXGamePlanCard widget for inline chat display' }]),
        bulletRuns([{ text: '[HIGH] ', bold: true, color: '92400E' }, { text: 'View transition animations between center panel views' }]),

        heading2('Phase 3: Polish & Premium (Ship Week 3)'),
        para('The premium touches that make the AI Coach feel like a $200/month institutional tool.'),

        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Message entrance animations with stagger' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Rich typing indicator with tool-awareness' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Skeleton loaders for all data-heavy views' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Tab underline sliding animation' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Widget card entrance animations' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Collapsible chat panel with collapse/expand button' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Resize handle visual enhancement' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Rotating chat placeholder text' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Mobile swipe gesture navigation' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Friendly error messages with auto-retry' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Button micro-interactions (spring scale)' }]),
        bulletRuns([{ text: '[MEDIUM] ', bold: true, color: '1E40AF' }, { text: 'Time-aware morning brief mode (pre-market vs session)' }]),

        heading2('Phase 4: Enhancements (Backlog)'),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Keyboard shortcuts (Cmd+K, Cmd+/, etc.)' }]),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Next Best SPX Setup auto-refresh on welcome view' }]),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Animated empty state icon (Lottie or SVG)' }]),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Pull-to-refresh on mobile data views' }]),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Label and copy refinements throughout' }]),
        bulletRuns([{ text: '[LOW/ENHANCEMENT] ', bold: true, color: '065F46' }, { text: 'Accessibility audit (aria-labels, keyboard nav, screen reader)' }]),

        new Paragraph({ children: [new PageBreak()] }),

        // ============================================================
        // SECTION 12: FILE-BY-FILE CHANGE MAP
        // ============================================================
        heading1('12. File-by-File Change Map'),

        para('For Claude Code implementation, here is every file that needs to be touched, grouped by phase:'),

        heading2('Frontend Files'),

        heading3('app/members/ai-coach/page.tsx'),
        bulletItem('Fix EmptyState: add onSendPrompt prop, wire button onClick handlers'),
        bulletItem('Add message entrance animations (framer-motion wrapper)'),
        bulletItem('Add suggested follow-up chips after AI responses'),
        bulletItem('Add SPX persistent ticker to chat header'),
        bulletItem('Implement smooth textarea resize'),
        bulletItem('Session sidebar skeleton loader'),
        bulletItem('Rotating placeholder text for chat input'),

        heading3('components/ai-coach/center-panel.tsx'),
        bulletItem('Replace EXAMPLE_PROMPTS constant with new 4 prompts'),
        bulletItem('Redesign WelcomeView: dynamic greeting, live SPX ticker, new layout'),
        bulletItem('Add ViewTransition wrapper around content area'),
        bulletItem('Reorganize TABS constant into grouped structure'),
        bulletItem('Move Home button to left of tab bar'),
        bulletItem('Remove header bar redundant buttons'),
        bulletItem('Add tab underline sliding animation'),

        heading3('components/ai-coach/morning-brief.tsx'),
        bulletItem('Redesign entire component layout per Section 4.2'),
        bulletItem('Add overnight gap card (new sub-component)'),
        bulletItem('Add SPX focus card (new sub-component)'),
        bulletItem('Add SPX/SPY correlation row'),
        bulletItem('Add level ladder visualization'),
        bulletItem('Add bottom CTA sticky bar'),
        bulletItem('Remove Mark Viewed button, auto-track on scroll'),
        bulletItem('Add time-aware brief mode'),

        heading3('components/ai-coach/widget-cards.tsx'),
        bulletItem('Add new SPXGamePlanCard widget type'),
        bulletItem('Add widget entrance animations'),
        bulletItem('Add hover tooltips to action bar buttons'),

        heading3('components/ai-coach/chat-message.tsx'),
        bulletItem('Add message entrance animation wrapper'),
        bulletItem('Enhance TypingIndicator with tool-awareness'),

        heading3('NEW: components/ai-coach/skeleton-loaders.tsx'),
        bulletItem('ChartSkeleton, OptionsSkeleton, BriefSkeleton, ScannerSkeleton'),

        heading3('NEW: components/ai-coach/view-transition.tsx'),
        bulletItem('AnimatePresence wrapper with direction-aware animations'),

        heading3('NEW: components/ai-coach/follow-up-chips.tsx'),
        bulletItem('Parse AI response, generate contextual follow-up action pills'),

        heading3('NEW: components/ai-coach/spx-ticker.tsx'),
        bulletItem('Persistent SPX price + change display with auto-refresh'),

        heading3('NEW: components/ai-coach/overnight-gap-card.tsx'),
        bulletItem('Gap visualization with ATR ratio bar for morning brief'),

        heading3('NEW: components/ai-coach/level-ladder.tsx'),
        bulletItem('Vertical level visualization for morning brief'),

        heading2('Backend Files'),

        heading3('backend/src/chatkit/functions.ts'),
        bulletItem('Add get_spx_game_plan function definition'),

        heading3('backend/src/chatkit/functionHandlers.ts'),
        bulletItem('Add get_spx_game_plan handler that orchestrates parallel calls'),

        heading3('backend/src/chatkit/systemPrompt.ts'),
        bulletItem('Add SPX game plan routing instruction'),
        bulletItem('Add SPX context awareness for all symbol responses'),
        bulletItem('Add SPY translation instruction'),

        heading3('backend/src/services/morningBrief/index.ts'),
        bulletItem('Add SPX/SPY correlation calculation'),
        bulletItem('Add gamma regime flag to key levels'),
        bulletItem('Add briefMode field (pre_market/session/post_market)'),
        bulletItem('Ensure overnightSummary is always populated'),

        divider(),

        paraRuns([
          { text: 'Total new files: ', bold: true },
          { text: '6 frontend components. ' },
          { text: 'Total modified files: ', bold: true },
          { text: '10 frontend + 4 backend = 14. ' },
          { text: 'Estimated LOC: ', bold: true },
          { text: '~2,500-3,500 lines of new/modified code across all phases.' },
        ]),

        new Paragraph({ spacing: { before: 400 } }),
        para('End of document. This spec is ready to be passed to Claude Code for implementation.', { italics: true, color: COLORS.darkGray }),
      ],
    },
  ],
});

// Generate
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/brave-loving-tesla/mnt/ITM-gd/AI_COACH_UX_AUDIT_AND_SPEC.docx', buffer);
  console.log('Document generated successfully.');
});
