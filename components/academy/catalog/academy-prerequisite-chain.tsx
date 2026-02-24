'use client'

import { CheckCircle2 } from 'lucide-react'

export interface PrerequisiteModule {
  slug: string
  title: string
  progressPercent: number
}

interface PrerequisiteChainProps {
  modules: Array<PrerequisiteModule>
  currentModuleSlug?: string
}

type NodeState = 'completed' | 'current' | 'locked'

function getNodeState(
  module: PrerequisiteModule,
  currentModuleSlug: string | undefined
): NodeState {
  if (module.slug === currentModuleSlug) return 'current'
  if (module.progressPercent >= 100) return 'completed'
  return 'locked'
}

interface NodeDotProps {
  state: NodeState
  title: string
}

function NodeDot({ state, title }: NodeDotProps) {
  if (state === 'completed') {
    return (
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-500/20"
        title={`${title} — completed`}
        aria-label={`${title}: completed`}
        data-testid="prerequisite-node-completed"
      >
        <CheckCircle2
          className="h-4 w-4 text-emerald-400"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    )
  }

  if (state === 'current') {
    return (
      <div
        className="relative flex h-8 w-8 shrink-0 items-center justify-center"
        title={`${title} — current`}
        aria-label={`${title}: current module`}
        data-testid="prerequisite-node-current"
      >
        {/* Pulse ring */}
        <span
          className="absolute inset-0 animate-pulse rounded-full border-2 border-emerald-400/60 bg-emerald-500/15"
          aria-hidden
        />
        <span
          className="relative h-3 w-3 rounded-full bg-emerald-400"
          aria-hidden
        />
      </div>
    )
  }

  // locked
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/15 bg-white/5"
      title={`${title} — locked`}
      aria-label={`${title}: locked`}
      data-testid="prerequisite-node-locked"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" aria-hidden />
    </div>
  )
}

interface ConnectorLineProps {
  completed: boolean
}

function ConnectorLine({ completed }: ConnectorLineProps) {
  return (
    <div
      className="h-0.5 min-w-[32px] flex-1 shrink-0"
      aria-hidden
      data-testid="prerequisite-connector"
    >
      <div
        className={[
          'h-full w-full rounded-full transition-colors duration-500',
          completed ? 'bg-emerald-400/60' : 'bg-white/10',
        ].join(' ')}
      />
    </div>
  )
}

export function AcademyPrerequisiteChain({
  modules,
  currentModuleSlug,
}: PrerequisiteChainProps) {
  if (modules.length === 0) return null

  return (
    <div
      className="w-full overflow-x-auto"
      data-testid="academy-prerequisite-chain"
      aria-label="Module prerequisite chain"
    >
      <div className="flex min-w-max items-start gap-0 px-1 py-2">
        {modules.map((mod, idx) => {
          const state = getNodeState(mod, currentModuleSlug)
          const isLast = idx === modules.length - 1
          // The connector after this node is "complete" only if this AND next node are completed
          const nextMod = modules[idx + 1]
          const connectorCompleted =
            !isLast &&
            state === 'completed' &&
            nextMod !== undefined &&
            getNodeState(nextMod, currentModuleSlug) === 'completed'

          return (
            <div
              key={mod.slug}
              className="flex items-start"
              data-testid="prerequisite-chain-node"
            >
              {/* Node column: dot + label */}
              <div className="flex flex-col items-center gap-1.5">
                <NodeDot state={state} title={mod.title} />
                <p
                  className={[
                    'max-w-[72px] truncate text-center text-[10px] leading-tight',
                    state === 'completed'
                      ? 'text-emerald-300'
                      : state === 'current'
                        ? 'font-medium text-white'
                        : 'text-zinc-500',
                  ].join(' ')}
                  title={mod.title}
                >
                  {mod.title}
                </p>
                {state !== 'locked' && (
                  <p
                    className={[
                      'font-mono text-[9px]',
                      state === 'completed' ? 'text-emerald-400/70' : 'text-emerald-300/70',
                    ].join(' ')}
                    aria-hidden
                  >
                    {mod.progressPercent >= 100 ? '100%' : `${Math.round(mod.progressPercent)}%`}
                  </p>
                )}
              </div>

              {/* Connector line (not after the last node) */}
              {!isLast && (
                <div className="flex items-center" style={{ marginTop: 14 }}>
                  <ConnectorLine completed={connectorCompleted} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
