/**
 * Academy Hero Image Placeholder Generator
 *
 * Generates placeholder hero/cover images for academy modules.
 * Uses SVG with the Emerald theme for dark-mode compatibility.
 *
 * Usage: npx tsx scripts/generate-academy-heroes.ts
 * Output: public/academy-media/heroes/*.svg
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, '..', 'public', 'academy-media', 'heroes');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface HeroDef {
  slug: string;
  title: string;
  subtitle: string;
  accentColor: string;
  bgGrad: [string, string];
  pattern: string;
}

const HEROES: HeroDef[] = [
  // Track 1: Foundations
  { slug: 'psychology-of-trading', title: 'Psychology of Trading', subtitle: 'Module 1.3', accentColor: '#10B981', bgGrad: ['#064E3B', '#022C22'], pattern: 'circles' },
  { slug: 'first-steps-in-trading', title: 'First Steps in Trading', subtitle: 'Module 1.4', accentColor: '#10B981', bgGrad: ['#065F46', '#064E3B'], pattern: 'dots' },
  // Track 2: Technical Analysis
  { slug: 'chart-reading-fundamentals', title: 'Chart Reading', subtitle: 'Module 2.1', accentColor: '#3B82F6', bgGrad: ['#1E3A5F', '#0F172A'], pattern: 'grid' },
  { slug: 'indicators-and-oscillators', title: 'Indicators & Oscillators', subtitle: 'Module 2.2', accentColor: '#3B82F6', bgGrad: ['#1D4ED8', '#1E3A5F'], pattern: 'waves' },
  { slug: 'price-action-patterns', title: 'Price Action Patterns', subtitle: 'Module 2.3', accentColor: '#3B82F6', bgGrad: ['#2563EB', '#1E40AF'], pattern: 'zigzag' },
  // Track 3: Options Mastery
  { slug: 'options-fundamentals', title: 'Options Fundamentals', subtitle: 'Module 3.1', accentColor: '#8B5CF6', bgGrad: ['#4C1D95', '#1E1B4B'], pattern: 'circles' },
  { slug: 'the-greeks', title: 'The Greeks', subtitle: 'Module 3.2', accentColor: '#8B5CF6', bgGrad: ['#5B21B6', '#4C1D95'], pattern: 'grid' },
  { slug: 'basic-options-strategies', title: 'Basic Strategies', subtitle: 'Module 3.3', accentColor: '#8B5CF6', bgGrad: ['#6D28D9', '#5B21B6'], pattern: 'dots' },
  // Track 4: SPX
  { slug: 'spx-market-structure', title: 'SPX Market Structure', subtitle: 'Module 4.1', accentColor: '#F59E0B', bgGrad: ['#78350F', '#451A03'], pattern: 'waves' },
  { slug: 'spx-trading-strategies', title: 'SPX Trading Strategies', subtitle: 'Module 4.2', accentColor: '#F59E0B', bgGrad: ['#92400E', '#78350F'], pattern: 'zigzag' },
  { slug: 'spx-risk-management', title: 'SPX Risk Management', subtitle: 'Module 4.3', accentColor: '#F59E0B', bgGrad: ['#B45309', '#92400E'], pattern: 'grid' },
  // Track 5: Advanced
  { slug: 'multi-leg-strategies', title: 'Multi-Leg Strategies', subtitle: 'Module 5.1', accentColor: '#EF4444', bgGrad: ['#7F1D1D', '#450A0A'], pattern: 'circles' },
  { slug: 'portfolio-level-thinking', title: 'Portfolio-Level Thinking', subtitle: 'Module 5.2', accentColor: '#EF4444', bgGrad: ['#991B1B', '#7F1D1D'], pattern: 'dots' },
  // Track 6: Psychology
  { slug: 'mental-game', title: 'Mental Game', subtitle: 'Module 6.1', accentColor: '#EC4899', bgGrad: ['#831843', '#500724'], pattern: 'waves' },
  { slug: 'performance-optimization', title: 'Performance Optimization', subtitle: 'Module 6.2', accentColor: '#EC4899', bgGrad: ['#9D174D', '#831843'], pattern: 'zigzag' },
];

function getPatternSvg(pattern: string, color: string): string {
  const c = color;
  switch (pattern) {
    case 'dots':
      return Array.from({ length: 20 }, (_, i) =>
        `<circle cx="${(i % 10) * 80 + 40}" cy="${Math.floor(i / 10) * 80 + 30}" r="2" fill="${c}" opacity="0.15"/>`
      ).join('');
    case 'grid':
      return Array.from({ length: 10 }, (_, i) =>
        `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="200" stroke="${c}" stroke-width="0.5" opacity="0.1"/>`
      ).join('') +
        Array.from({ length: 5 }, (_, i) =>
          `<line x1="0" y1="${i * 50}" x2="800" y2="${i * 50}" stroke="${c}" stroke-width="0.5" opacity="0.1"/>`
        ).join('');
    case 'circles':
      return `<circle cx="600" cy="100" r="120" fill="none" stroke="${c}" stroke-width="1" opacity="0.1"/>` +
        `<circle cx="600" cy="100" r="80" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.08"/>` +
        `<circle cx="600" cy="100" r="40" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.06"/>`;
    case 'waves':
      return `<path d="M0 150 Q100 120 200 150 Q300 180 400 150 Q500 120 600 150 Q700 180 800 150" fill="none" stroke="${c}" stroke-width="1" opacity="0.1"/>` +
        `<path d="M0 170 Q100 140 200 170 Q300 200 400 170 Q500 140 600 170 Q700 200 800 170" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.08"/>`;
    case 'zigzag':
      return `<polyline points="0,160 40,140 80,160 120,140 160,160 200,140 240,160 280,140 320,160 360,140 400,160 440,140 480,160 520,140 560,160 600,140 640,160 680,140 720,160 760,140 800,160" fill="none" stroke="${c}" stroke-width="1" opacity="0.1"/>`;
    default:
      return '';
  }
}

function generateHeroSvg(hero: HeroDef): string {
  const [g1, g2] = hero.bgGrad;
  const id = hero.slug.replace(/[^a-z0-9]/g, '_');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200">
  <defs>
    <linearGradient id="hg_${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="200" fill="url(#hg_${id})"/>
  ${getPatternSvg(hero.pattern, hero.accentColor)}
  <text x="40" y="80" font-family="system-ui, sans-serif" font-size="32" font-weight="700" fill="white" opacity="0.95">${escapeXml(hero.title)}</text>
  <text x="40" y="110" font-family="system-ui, sans-serif" font-size="14" fill="${hero.accentColor}" opacity="0.7">${escapeXml(hero.subtitle)}</text>
  <line x1="40" y1="130" x2="200" y2="130" stroke="${hero.accentColor}" stroke-width="2" opacity="0.4"/>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let count = 0;
for (const hero of HEROES) {
  const svg = generateHeroSvg(hero);
  const filepath = join(OUTPUT_DIR, `${hero.slug}.svg`);
  writeFileSync(filepath, svg, 'utf8');
  count++;
}

console.log(`Generated ${count} hero SVG files in ${OUTPUT_DIR}`);
