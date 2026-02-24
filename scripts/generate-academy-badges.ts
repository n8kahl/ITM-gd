/**
 * Academy Badge SVG Generator
 *
 * Generates 30 SVG badge files for the academy achievement system.
 * Each badge uses the Emerald design system with unique icons.
 *
 * Usage: npx tsx scripts/generate-academy-badges.ts
 * Output: public/academy-media/badges/*.svg
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, '..', 'public', 'academy-media', 'badges');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

interface BadgeDef {
  key: string;
  label: string;
  icon: string; // SVG path or element
  color: string; // Accent color
  bgGradient: [string, string];
}

const BADGES: BadgeDef[] = [
  // ── Completion (13) ──────────────────────────────────────
  { key: 'first_lesson', label: '1', icon: 'star', color: '#10B981', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'five_lessons', label: '5', icon: 'star', color: '#10B981', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'ten_lessons', label: '10', icon: 'star', color: '#10B981', bgGradient: ['#047857', '#065F46'] },
  { key: 'twenty_five_lessons', label: '25', icon: 'star', color: '#34D399', bgGradient: ['#047857', '#065F46'] },
  { key: 'fifty_lessons', label: '50', icon: 'star', color: '#6EE7B7', bgGradient: ['#059669', '#047857'] },
  { key: 'all_lessons', label: '80', icon: 'crown', color: '#F5EDCC', bgGradient: ['#059669', '#047857'] },
  { key: 'track_complete_1', label: 'T1', icon: 'flag', color: '#10B981', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'track_complete_2', label: 'T2', icon: 'flag', color: '#3B82F6', bgGradient: ['#1E3A5F', '#1E293B'] },
  { key: 'track_complete_3', label: 'T3', icon: 'flag', color: '#8B5CF6', bgGradient: ['#4C1D95', '#312E81'] },
  { key: 'track_complete_4', label: 'T4', icon: 'flag', color: '#F59E0B', bgGradient: ['#78350F', '#451A03'] },
  { key: 'track_complete_5', label: 'T5', icon: 'flag', color: '#EF4444', bgGradient: ['#7F1D1D', '#450A0A'] },
  { key: 'track_complete_6', label: 'T6', icon: 'flag', color: '#EC4899', bgGradient: ['#831843', '#500724'] },
  { key: 'full_program', label: 'ALL', icon: 'trophy', color: '#F5EDCC', bgGradient: ['#065F46', '#064E3B'] },

  // ── Streak (3) ──────────────────────────────────────────
  { key: 'streak_7', label: '7d', icon: 'flame', color: '#F59E0B', bgGradient: ['#78350F', '#451A03'] },
  { key: 'streak_30', label: '30d', icon: 'flame', color: '#F97316', bgGradient: ['#7C2D12', '#431407'] },
  { key: 'streak_100', label: '100d', icon: 'flame', color: '#EF4444', bgGradient: ['#7F1D1D', '#450A0A'] },

  // ── Mastery (11) ────────────────────────────────────────
  { key: 'competency_master_market_context', label: 'MC', icon: 'compass', color: '#3B82F6', bgGradient: ['#1E3A5F', '#1E293B'] },
  { key: 'competency_master_entry_validation', label: 'EV', icon: 'target', color: '#10B981', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'competency_master_trade_management', label: 'TM', icon: 'settings', color: '#8B5CF6', bgGradient: ['#4C1D95', '#312E81'] },
  { key: 'competency_master_position_sizing', label: 'PS', icon: 'scale', color: '#F59E0B', bgGradient: ['#78350F', '#451A03'] },
  { key: 'competency_master_exit_discipline', label: 'ED', icon: 'door', color: '#EF4444', bgGradient: ['#7F1D1D', '#450A0A'] },
  { key: 'competency_master_review_reflection', label: 'RR', icon: 'mirror', color: '#06B6D4', bgGradient: ['#164E63', '#0C4A6E'] },
  { key: 'competency_master_volatility_mechanics', label: 'VM', icon: 'wave', color: '#EC4899', bgGradient: ['#831843', '#500724'] },
  { key: 'competency_master_spx_specialization', label: 'SPX', icon: 'chart', color: '#F5EDCC', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'competency_master_portfolio_management', label: 'PM', icon: 'briefcase', color: '#10B981', bgGradient: ['#047857', '#065F46'] },
  { key: 'competency_master_trading_psychology', label: 'TP', icon: 'brain', color: '#8B5CF6', bgGradient: ['#4C1D95', '#312E81'] },
  { key: 'first_perfect', label: '100%', icon: 'checkCircle', color: '#F5EDCC', bgGradient: ['#059669', '#047857'] },

  // ── Activity (4) ────────────────────────────────────────
  { key: 'chain_reader', label: 'OCS', icon: 'chain', color: '#10B981', bgGradient: ['#065F46', '#064E3B'] },
  { key: 'diagram_builder', label: 'PDB', icon: 'pen', color: '#3B82F6', bgGradient: ['#1E3A5F', '#1E293B'] },
  { key: 'speed_demon', label: 'FAST', icon: 'lightning', color: '#F59E0B', bgGradient: ['#78350F', '#451A03'] },
  { key: 'perfect_week', label: '7/7', icon: 'calendar', color: '#10B981', bgGradient: ['#047857', '#065F46'] },
];

// ---------------------------------------------------------------------------
// SVG icon paths
// ---------------------------------------------------------------------------

function getIconSvg(icon: string, color: string): string {
  const c = color;
  switch (icon) {
    case 'star':
      return `<path d="M32 8l7.4 15 16.6 2.4-12 11.7 2.8 16.5L32 46l-14.8 7.6 2.8-16.5-12-11.7L24.6 23z" fill="${c}" opacity="0.9"/>`;
    case 'crown':
      return `<path d="M16 40h32l4-20-10 8-10-16-10 16-10-8z" fill="${c}" opacity="0.9"/><rect x="14" y="40" width="36" height="4" rx="1" fill="${c}" opacity="0.7"/>`;
    case 'trophy':
      return `<path d="M22 16h20v8c0 6.6-4.5 12-10 12s-10-5.4-10-12v-8z" fill="${c}" opacity="0.9"/><rect x="28" y="36" width="8" height="8" fill="${c}" opacity="0.7"/><rect x="24" y="44" width="16" height="4" rx="2" fill="${c}" opacity="0.6"/><path d="M22 16c-4 0-8 2-8 8s4 8 8 8" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/><path d="M42 16c4 0 8 2 8 8s-4 8-8 8" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`;
    case 'flag':
      return `<rect x="20" y="12" width="2" height="36" rx="1" fill="${c}" opacity="0.7"/><path d="M22 12h20l-4 10 4 10H22z" fill="${c}" opacity="0.9"/>`;
    case 'flame':
      return `<path d="M32 8c0 0 12 14 12 26s-5.4 14-12 14-12-2-12-14S32 8 32 8z" fill="${c}" opacity="0.85"/><path d="M32 28c0 0 5 6 5 12s-2.2 6-5 6-5-0-5-6S32 28 32 28z" fill="${c}" opacity="0.5"/>`;
    case 'compass':
      return `<circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/><polygon points="32,18 36,32 32,46 28,32" fill="${c}" opacity="0.85"/>`;
    case 'target':
      return `<circle cx="32" cy="32" r="16" fill="none" stroke="${c}" stroke-width="2" opacity="0.4"/><circle cx="32" cy="32" r="10" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/><circle cx="32" cy="32" r="4" fill="${c}" opacity="0.9"/>`;
    case 'settings':
      return `<circle cx="32" cy="32" r="8" fill="${c}" opacity="0.8"/><g fill="${c}" opacity="0.6">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="30" y="12" width="4" height="8" rx="2" transform="rotate(${a} 32 32)"/>`).join('')}</g>`;
    case 'scale':
      return `<rect x="30" y="12" width="4" height="30" rx="2" fill="${c}" opacity="0.7"/><path d="M16 26l16-6 16 6" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/><circle cx="16" cy="32" r="6" fill="${c}" opacity="0.5"/><circle cx="48" cy="32" r="6" fill="${c}" opacity="0.8"/>`;
    case 'door':
      return `<rect x="20" y="14" width="24" height="34" rx="3" fill="${c}" opacity="0.7"/><circle cx="40" cy="32" r="2" fill="${c}" opacity="0.9"/>`;
    case 'mirror':
      return `<ellipse cx="32" cy="28" rx="12" ry="16" fill="${c}" opacity="0.6"/><rect x="28" y="42" width="8" height="8" rx="1" fill="${c}" opacity="0.7"/>`;
    case 'wave':
      return `<path d="M8 32 Q16 16 24 32 Q32 48 40 32 Q48 16 56 32" fill="none" stroke="${c}" stroke-width="3" opacity="0.85"/>`;
    case 'chart':
      return `<polyline points="12,44 22,30 32,36 42,20 52,28" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity="0.85"/><circle cx="52" cy="28" r="3" fill="${c}" opacity="0.9"/>`;
    case 'briefcase':
      return `<rect x="14" y="24" width="36" height="22" rx="3" fill="${c}" opacity="0.8"/><path d="M24 24v-6a4 4 0 014-4h8a4 4 0 014 4v6" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/>`;
    case 'brain':
      return `<path d="M32 48v-8M24 14c-6 0-10 4-10 10s4 8 8 10c2 2 2 6 2 6h16s0-4 2-6c4-2 8-4 8-10s-4-10-10-10c-2-2-4-2-6-2s-4 0-6 2z" fill="${c}" opacity="0.8"/>`;
    case 'checkCircle':
      return `<circle cx="32" cy="32" r="16" fill="${c}" opacity="0.7"/><polyline points="24,32 30,38 40,26" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'chain':
      return `<ellipse cx="26" cy="28" rx="8" ry="10" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.8"/><ellipse cx="38" cy="36" rx="8" ry="10" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.8"/>`;
    case 'pen':
      return `<path d="M44 12l-24 24-4 12 12-4 24-24z" fill="${c}" opacity="0.8"/><path d="M36 20l8 8" fill="none" stroke="${c}" stroke-width="2"/>`;
    case 'lightning':
      return `<polygon points="36,8 20,36 30,36 28,56 44,28 34,28" fill="${c}" opacity="0.9"/>`;
    case 'calendar':
      return `<rect x="14" y="18" width="36" height="30" rx="3" fill="${c}" opacity="0.6"/><rect x="14" y="18" width="36" height="8" rx="3" fill="${c}" opacity="0.8"/><g fill="${c}" opacity="0.4">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${18 + i * 5}" cy="38" r="2"/>`).join('')}</g>`;
    default:
      return `<circle cx="32" cy="32" r="12" fill="${c}" opacity="0.8"/>`;
  }
}

// ---------------------------------------------------------------------------
// SVG template
// ---------------------------------------------------------------------------

function generateBadgeSvg(badge: BadgeDef): string {
  const [grad1, grad2] = badge.bgGradient;
  const id = badge.key.replace(/[^a-z0-9]/g, '_');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg_${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${grad1}"/>
      <stop offset="100%" stop-color="${grad2}"/>
    </linearGradient>
    <filter id="glow_${id}">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#bg_${id})" stroke="${badge.color}" stroke-width="1.5" stroke-opacity="0.4"/>
  <circle cx="32" cy="32" r="27" fill="none" stroke="${badge.color}" stroke-width="0.5" stroke-opacity="0.2" stroke-dasharray="2 3"/>
  <g filter="url(#glow_${id})">
    ${getIconSvg(badge.icon, badge.color)}
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Generate all badges
// ---------------------------------------------------------------------------

let count = 0;
for (const badge of BADGES) {
  const svg = generateBadgeSvg(badge);
  const filename = `${badge.key}.svg`;
  const filepath = join(OUTPUT_DIR, filename);
  writeFileSync(filepath, svg, 'utf8');
  count++;
}

console.log(`Generated ${count} badge SVG files in ${OUTPUT_DIR}`);
