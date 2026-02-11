/**
 * File: components/academy/interactive/index.ts
 * Created: 2026-02-10
 * Purpose: Component registry for interactive lesson chunks.
 *          Lazy-loaded via dynamic imports for code splitting.
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

/* ── Lazy-loaded interactive components ────────────────────────── */

export const GreekVisualizer = dynamic(
  () => import('./greek-visualizer').then((m) => ({ default: m.GreekVisualizer })),
  { ssr: false }
)

export const OptionsChainTrainer = dynamic(
  () => import('./options-chain-trainer').then((m) => ({ default: m.OptionsChainTrainer })),
  { ssr: false }
)

export const PositionSizer = dynamic(
  () => import('./position-sizer').then((m) => ({ default: m.PositionSizer })),
  { ssr: false }
)

/* ── Registry map ─────────────────────────────────────────────── */

export type InteractiveComponentId =
  | 'greek-visualizer'
  | 'options-chain-trainer'
  | 'position-sizer'

export const INTERACTIVE_REGISTRY: Record<InteractiveComponentId, ComponentType> = {
  'greek-visualizer': GreekVisualizer,
  'options-chain-trainer': OptionsChainTrainer,
  'position-sizer': PositionSizer,
}

export function isInteractiveComponentId(id: string): id is InteractiveComponentId {
  return id in INTERACTIVE_REGISTRY
}
