'use client'

import { useState } from 'react'
import { ChevronRight, Check, X, RotateCcw, GitBranch } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioNode {
  key: string
  label: string
  description: string
  children?: ScenarioNode[]
  isLeaf?: boolean
  outcome?: string
}

interface TradeScenarioTreeConfig {
  scenario: string
  context: string
  root: ScenarioNode
  instructions: string
}

interface TradeScenarioTreeProps {
  config: TradeScenarioTreeConfig
  onSubmit: (answer: string) => void
  disabled?: boolean
  result?: {
    score: number
    maxScore: number
    feedback: string
    isCorrect: boolean
  } | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcademyTradeScenarioTree({
  config,
  onSubmit,
  disabled = false,
  result = null,
}: TradeScenarioTreeProps) {
  const { scenario, context, root, instructions } = config
  const [path, setPath] = useState<string[]>([])
  const [selectedLeaf, setSelectedLeaf] = useState<string | null>(null)

  // Walk the tree to find the current node
  const getCurrentNode = (): ScenarioNode => {
    let node = root
    for (const key of path) {
      const child = node.children?.find((c) => c.key === key)
      if (!child) break
      node = child
    }
    return node
  }

  const currentNode = getCurrentNode()
  const hasChildren = currentNode.children && currentNode.children.length > 0

  const handleSelect = (key: string) => {
    if (disabled) return
    const child = currentNode.children?.find((c) => c.key === key)
    if (!child) return

    const newPath = [...path, key]
    setPath(newPath)

    if (child.isLeaf || !child.children?.length) {
      setSelectedLeaf(key)
    }
  }

  const handleBack = () => {
    if (path.length === 0) return
    const newPath = path.slice(0, -1)
    setPath(newPath)
    setSelectedLeaf(null)
  }

  const handleReset = () => {
    setPath([])
    setSelectedLeaf(null)
  }

  const handleSubmit = () => {
    if (selectedLeaf) {
      onSubmit(selectedLeaf)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-semibold text-white">Trade Scenario Tree</h3>
          <p className="text-sm text-white/50 mt-0.5">{scenario}</p>
        </div>
      </div>

      <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>

      {/* Context */}
      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4">
        <p className="text-sm text-white/60 leading-relaxed">{context}</p>
      </div>

      {/* Breadcrumb Path */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-white/40 overflow-x-auto">
          <button onClick={handleReset} className="hover:text-white/60 transition-colors shrink-0">
            Start
          </button>
          {path.map((key, i) => (
            <span key={key} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
              <button
                onClick={() => {
                  setPath(path.slice(0, i + 1))
                  setSelectedLeaf(i === path.length - 1 ? selectedLeaf : null)
                }}
                className="hover:text-white/60 transition-colors"
              >
                {key}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Current Node */}
      <div className="space-y-3">
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4">
          <p className="text-sm font-medium text-white">{currentNode.label}</p>
          <p className="text-sm text-white/60 mt-1">{currentNode.description}</p>
          {currentNode.outcome && (
            <p className="text-sm text-amber-300/80 mt-2 font-medium">
              Outcome: {currentNode.outcome}
            </p>
          )}
        </div>

        {/* Decision Options */}
        {hasChildren && !selectedLeaf && (
          <div className="space-y-2">
            <p className="text-xs text-white/50 font-medium uppercase tracking-wide">
              Choose your action:
            </p>
            {currentNode.children!.map((child) => (
              <button
                key={child.key}
                onClick={() => handleSelect(child.key)}
                disabled={disabled}
                className="w-full text-left rounded-lg bg-white/5 border border-white/10 p-4 transition-all hover:bg-white/10 hover:border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white group-hover:text-emerald-300 transition-colors">
                    {child.label}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 text-white/20 group-hover:text-emerald-400 transition-colors"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-xs text-white/50 mt-1">{child.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result Feedback */}
      {result && (
        <div
          className={`flex items-start gap-3 rounded-lg p-4 border ${
            result.isCorrect
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {result.isCorrect ? (
            <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
          )}
          <p className="text-sm">{result.feedback}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {selectedLeaf && (
          <button
            onClick={handleSubmit}
            disabled={disabled}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm Decision
          </button>
        )}
        {path.length > 0 && (
          <button
            onClick={handleBack}
            disabled={disabled}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
          >
            Go Back
          </button>
        )}
        <button
          onClick={handleReset}
          disabled={disabled || path.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm transition-all hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          Start Over
        </button>
      </div>
    </div>
  )
}
