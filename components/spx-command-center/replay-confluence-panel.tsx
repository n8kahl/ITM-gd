'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ReplayConfluenceSnapshotRow = Record<string, unknown>

const NOT_CAPTURED_COPY = 'Not captured for this timestamp.'
const PARTIAL_CONTEXT_COPY = 'Partial context only; some fields were not captured for this timestamp.'

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function asCompactTimestamp(value: string | null): string {
  if (!value) return 'Unknown timestamp'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function asSignedFixed(value: number | null, digits = 2): string | null {
  if (value == null) return null
  const rounded = value.toFixed(digits)
  return `${value >= 0 ? '+' : ''}${rounded}`
}

function asFixed(value: number | null, digits = 2): string | null {
  if (value == null) return null
  return value.toFixed(digits)
}

function asCompactCount(value: number | null): string | null {
  if (value == null) return null
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

function asTrendLabel(value: unknown): string | null {
  const trend = toNullableString(value)
  if (!trend) return null
  return trend.replace(/_/g, ' ').toUpperCase()
}

function hasSnapshotValue(value: string | number | null): boolean {
  return value !== null
}

type SnapshotChoice = {
  key: string
  capturedAt: string | null
  snapshot: ReplayConfluenceSnapshotRow
}

type ReplayConfluencePanelProps = {
  snapshots: ReplayConfluenceSnapshotRow[]
  selectedSnapshotKey?: string | null
  onSelectedSnapshotKeyChange?: (snapshotKey: string | null) => void
}

function ConfluenceSection({
  title,
  rows,
  testId,
}: {
  title: string
  rows: Array<{ label: string; value: string | null }>
  testId: string
}) {
  const hasAny = rows.some((row) => hasSnapshotValue(row.value))
  const missingCount = rows.filter((row) => !hasSnapshotValue(row.value)).length

  return (
    <article className="rounded border border-white/12 bg-white/[0.02] px-2 py-1.5" data-testid={testId}>
      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">{title}</p>
      {hasAny ? (
        <>
          <div className="mt-1 space-y-0.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-white/55">{row.label}</span>
                <span className="font-mono text-white/85">{row.value ?? 'n/a'}</span>
              </div>
            ))}
          </div>
          {missingCount > 0 && (
            <p className="mt-1 text-[9px] text-white/52">{PARTIAL_CONTEXT_COPY}</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-[10px] text-white/55">{NOT_CAPTURED_COPY}</p>
      )}
    </article>
  )
}

export function ReplayConfluencePanel({
  snapshots,
  selectedSnapshotKey,
  onSelectedSnapshotKeyChange,
}: ReplayConfluencePanelProps) {
  const snapshotChoices = useMemo<SnapshotChoice[]>(() => {
    return snapshots
      .map((snapshot, index) => {
        const capturedAt = toNullableString(snapshot.captured_at)
        const id = toNullableString(snapshot.id)
        return {
          key: id ? `id:${id}` : (capturedAt ? `captured:${capturedAt}` : `index:${index}`),
          capturedAt,
          snapshot,
        }
      })
      .sort((left, right) => {
        const leftTime = left.capturedAt ? Date.parse(left.capturedAt) : NaN
        const rightTime = right.capturedAt ? Date.parse(right.capturedAt) : NaN
        const leftValid = Number.isFinite(leftTime)
        const rightValid = Number.isFinite(rightTime)
        if (leftValid && rightValid && leftTime !== rightTime) return leftTime - rightTime
        if (leftValid && !rightValid) return -1
        if (!leftValid && rightValid) return 1
        return left.key.localeCompare(right.key)
      })
  }, [snapshots])

  const [localSelectedSnapshotKeyPreference, setLocalSelectedSnapshotKeyPreference] = useState<string | null>(null)
  const selectedSnapshotKeyPreference = selectedSnapshotKey === undefined
    ? localSelectedSnapshotKeyPreference
    : selectedSnapshotKey
  const selectedSnapshotChoice = useMemo(() => {
    if (snapshotChoices.length === 0) return null
    if (!selectedSnapshotKeyPreference) return snapshotChoices[snapshotChoices.length - 1] ?? null
    return snapshotChoices.find((choice) => choice.key === selectedSnapshotKeyPreference)
      ?? snapshotChoices[snapshotChoices.length - 1]
  }, [selectedSnapshotKeyPreference, snapshotChoices])
  const selectedSnapshotChoiceKey = selectedSnapshotChoice?.key ?? null

  useEffect(() => {
    if (selectedSnapshotKey === undefined || !onSelectedSnapshotKeyChange) return
    if (selectedSnapshotKey !== selectedSnapshotChoiceKey) {
      onSelectedSnapshotKeyChange(selectedSnapshotChoiceKey)
    }
  }, [onSelectedSnapshotKeyChange, selectedSnapshotChoiceKey, selectedSnapshotKey])

  const selectedSnapshot = selectedSnapshotChoice?.snapshot ?? null

  if (!selectedSnapshotChoice || !selectedSnapshot || snapshotChoices.length === 0) {
    return (
      <section className="rounded border border-white/12 bg-black/15 px-2 py-2" data-testid="spx-replay-confluence-panel">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Confluence Snapshot</p>
        </div>
        <p className="text-[10px] text-white/55" data-testid="spx-replay-confluence-empty">
          No confluence snapshot was captured for this session.
        </p>
      </section>
    )
  }

  const rrRatio = asFixed(toFiniteNumber(selectedSnapshot.rr_ratio))
  const evR = asSignedFixed(toFiniteNumber(selectedSnapshot.ev_r))

  const mtf1h = asTrendLabel(selectedSnapshot.mtf_1h_trend)
  const mtf15m = asTrendLabel(selectedSnapshot.mtf_15m_trend)
  const mtf5m = asTrendLabel(selectedSnapshot.mtf_5m_trend)
  const mtf1m = asTrendLabel(selectedSnapshot.mtf_1m_trend)
  const mtfAligned = toBoolean(selectedSnapshot.mtf_aligned)
  const mtfComposite = asFixed(toFiniteNumber(selectedSnapshot.mtf_composite))

  const gexNetGamma = asCompactCount(toFiniteNumber(selectedSnapshot.gex_net_gamma))
  const gexCallWall = asFixed(toFiniteNumber(selectedSnapshot.gex_call_wall), 1)
  const gexPutWall = asFixed(toFiniteNumber(selectedSnapshot.gex_put_wall), 1)
  const gexFlipPoint = asFixed(toFiniteNumber(selectedSnapshot.gex_flip_point), 1)

  const flowBias5m = asTrendLabel(selectedSnapshot.flow_bias_5m)
  const flowBias15m = asTrendLabel(selectedSnapshot.flow_bias_15m)
  const flowBias30m = asTrendLabel(selectedSnapshot.flow_bias_30m)
  const flowCount = asCompactCount(toFiniteNumber(selectedSnapshot.flow_event_count))
  const flowSweeps = asCompactCount(toFiniteNumber(selectedSnapshot.flow_sweep_count))
  const flowBullishPremium = asCompactCount(toFiniteNumber(selectedSnapshot.flow_bullish_premium))
  const flowBearishPremium = asCompactCount(toFiniteNumber(selectedSnapshot.flow_bearish_premium))

  const regime = asTrendLabel(selectedSnapshot.regime)
  const regimeDirection = asTrendLabel(selectedSnapshot.regime_direction)
  const regimeProbability = asFixed(toFiniteNumber(selectedSnapshot.regime_probability))
  const regimeConfidence = asFixed(toFiniteNumber(selectedSnapshot.regime_confidence))
  const envGatePassed = toBoolean(selectedSnapshot.env_gate_passed)
  const envGateReasons = toStringList(selectedSnapshot.env_gate_reasons)
  const vixValue = asFixed(toFiniteNumber(selectedSnapshot.vix_value))
  const vixRegime = asTrendLabel(selectedSnapshot.vix_regime)

  const memorySetupType = asTrendLabel(selectedSnapshot.memory_setup_type)
  const memoryTestCount = asCompactCount(toFiniteNumber(selectedSnapshot.memory_test_count))
  const memoryWinRate = asFixed(toFiniteNumber(selectedSnapshot.memory_win_rate))
  const memoryHoldRate = asFixed(toFiniteNumber(selectedSnapshot.memory_hold_rate))
  const memoryConfidence = asFixed(toFiniteNumber(selectedSnapshot.memory_confidence))
  const memoryScore = asFixed(toFiniteNumber(selectedSnapshot.memory_score))

  return (
    <section className="rounded border border-white/12 bg-black/15 px-2 py-2" data-testid="spx-replay-confluence-panel">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Confluence Snapshot</p>
        <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-white/70">
          {asCompactTimestamp(selectedSnapshotChoice.capturedAt)}
        </span>
      </div>

      {snapshotChoices.length > 1 && (
        <div className="mb-2 flex max-w-full gap-1 overflow-auto pb-0.5">
          {snapshotChoices.map((choice, index) => {
            const isSelected = choice.key === selectedSnapshotChoice.key
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => {
                  if (selectedSnapshotKey === undefined) {
                    setLocalSelectedSnapshotKeyPreference(choice.key)
                  }
                  onSelectedSnapshotKeyChange?.(choice.key)
                }}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[9px] transition-colors',
                  isSelected
                    ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                    : 'border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/90',
                )}
                data-testid={`spx-replay-confluence-snapshot-option-${index}`}
              >
                {asCompactTimestamp(choice.capturedAt)}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-1.5">
        <ConfluenceSection
          title="R:R + EV"
          testId="spx-replay-confluence-section-rr-ev"
          rows={[
            { label: 'R:R', value: rrRatio },
            { label: 'EV (R)', value: evR },
          ]}
        />

        <ConfluenceSection
          title="Multi-TF Alignment"
          testId="spx-replay-confluence-section-mtf"
          rows={[
            { label: '1H', value: mtf1h },
            { label: '15m', value: mtf15m },
            { label: '5m', value: mtf5m },
            { label: '1m', value: mtf1m },
            { label: 'Aligned', value: mtfAligned == null ? null : (mtfAligned ? 'YES' : 'NO') },
            { label: 'Composite', value: mtfComposite },
          ]}
        />

        <ConfluenceSection
          title="GEX Context"
          testId="spx-replay-confluence-section-gex"
          rows={[
            { label: 'Net Gamma', value: gexNetGamma },
            { label: 'Call Wall', value: gexCallWall },
            { label: 'Put Wall', value: gexPutWall },
            { label: 'Flip', value: gexFlipPoint },
          ]}
        />

        <ConfluenceSection
          title="Flow Confirmation"
          testId="spx-replay-confluence-section-flow"
          rows={[
            { label: '5m Bias', value: flowBias5m },
            { label: '15m Bias', value: flowBias15m },
            { label: '30m Bias', value: flowBias30m },
            { label: 'Events', value: flowCount },
            { label: 'Sweeps', value: flowSweeps },
            { label: 'Bull Prem', value: flowBullishPremium },
            { label: 'Bear Prem', value: flowBearishPremium },
          ]}
        />

        <ConfluenceSection
          title="Regime + Environment"
          testId="spx-replay-confluence-section-regime-env"
          rows={[
            { label: 'Regime', value: regime },
            { label: 'Direction', value: regimeDirection },
            { label: 'Probability', value: regimeProbability },
            { label: 'Confidence', value: regimeConfidence },
            { label: 'Gate Passed', value: envGatePassed == null ? null : (envGatePassed ? 'YES' : 'NO') },
            { label: 'Gate Reasons', value: envGateReasons.length > 0 ? envGateReasons.join(', ') : null },
            { label: 'VIX', value: vixValue },
            { label: 'VIX Regime', value: vixRegime },
          ]}
        />

        <ConfluenceSection
          title="Memory Edge"
          testId="spx-replay-confluence-section-memory"
          rows={[
            { label: 'Setup Type', value: memorySetupType },
            { label: 'Tests', value: memoryTestCount },
            { label: 'Win Rate', value: memoryWinRate },
            { label: 'Hold Rate', value: memoryHoldRate },
            { label: 'Confidence', value: memoryConfidence },
            { label: 'Score', value: memoryScore },
          ]}
        />
      </div>

      <span className="sr-only" data-testid="spx-replay-confluence-rr-value">
        {rrRatio ?? 'not-captured'}
      </span>
    </section>
  )
}
