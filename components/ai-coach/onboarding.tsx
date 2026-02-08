'use client'

import { useState, useCallback } from 'react'
import {
  BrainCircuit,
  CandlestickChart,
  TableProperties,
  Calculator,
  Camera,
  BookOpen,
  Bell,
  Search,
  Clock,
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

interface OnboardingProps {
  onComplete: () => void
  onSkip: () => void
  onTryFeature?: (feature: string) => void
}

interface OnboardingStep {
  title: string
  subtitle: string
  description: string
  icon: typeof BrainCircuit
  features: Array<{
    icon: typeof CandlestickChart
    label: string
    description: string
    feature?: string
  }>
}

// ============================================
// STEPS
// ============================================

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to AI Coach',
    subtitle: 'Your intelligent trading companion',
    description: 'AI Coach combines real-time market data with advanced AI to give you institutional-grade analysis at your fingertips. Let\'s take a quick tour.',
    icon: BrainCircuit,
    features: [
      { icon: MessageSquare, label: 'Natural Language', description: 'Ask questions in plain English' },
      { icon: Sparkles, label: '15 AI Functions', description: 'Levels, options, scanning & more' },
      { icon: CandlestickChart, label: 'Live Data', description: 'Real-time market data from Massive.com' },
    ],
  },
  {
    title: 'Market Analysis',
    subtitle: 'Charts, levels & technical analysis',
    description: 'View interactive candlestick charts with AI-annotated support and resistance levels. Ask about PDH, PDL, VWAP, ATR, pivots, and pre-market levels.',
    icon: CandlestickChart,
    features: [
      { icon: CandlestickChart, label: 'Live Charts', description: 'Multi-timeframe candlestick charts', feature: 'chart' },
      { icon: Search, label: 'Opportunity Scanner', description: '7 technical scanning algorithms', feature: 'scanner' },
      { icon: Globe, label: 'Macro Context', description: 'Economic calendar & Fed policy', feature: 'macro' },
    ],
  },
  {
    title: 'Options & Positions',
    subtitle: 'Greeks, IV, and risk analysis',
    description: 'Browse full options chains with Greeks (Delta, Gamma, Theta, Vega), analyze multi-leg positions, and track your LEAPS with projections.',
    icon: TableProperties,
    features: [
      { icon: TableProperties, label: 'Options Chain', description: 'Full chain with Greeks & IV', feature: 'options' },
      { icon: Calculator, label: 'Position Analyzer', description: 'P&L, risk, and breakeven', feature: 'position' },
      { icon: Clock, label: 'LEAPS Dashboard', description: 'Long-term options tracking', feature: 'leaps' },
    ],
  },
  {
    title: 'Trading Tools',
    subtitle: 'Journal, alerts & screenshots',
    description: 'Log your trades with automatic P&L tracking, set price alerts that trigger in real-time, and upload broker screenshots for AI-powered position extraction.',
    icon: BookOpen,
    features: [
      { icon: BookOpen, label: 'Trade Journal', description: 'Log trades & track analytics', feature: 'journal' },
      { icon: Bell, label: 'Price Alerts', description: 'Real-time alert monitoring', feature: 'alerts' },
      { icon: Camera, label: 'Screenshot Analysis', description: 'AI extracts positions from screenshots', feature: 'screenshot' },
    ],
  },
]

const STORAGE_KEY = 'ai-coach-onboarding-complete'

// ============================================
// COMPONENT
// ============================================

export function Onboarding({ onComplete, onSkip, onTryFeature }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = ONBOARDING_STEPS[currentStep]
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1
  const StepIcon = step.icon

  const handleNext = useCallback(() => {
    if (isLastStep) {
      localStorage.setItem(STORAGE_KEY, 'true')
      onComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [isLastStep, onComplete])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    onSkip()
  }, [onSkip])

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {ONBOARDING_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                idx === currentStep
                  ? 'w-8 bg-emerald-500'
                  : idx < currentStep
                    ? 'bg-emerald-500/50'
                    : 'bg-white/10'
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <StepIcon className="w-8 h-8 text-emerald-500" />
          </div>

          <p className="text-xs text-emerald-500 font-medium tracking-wider uppercase mb-2">
            {step.subtitle}
          </p>
          <h3 className="text-xl font-semibold text-white mb-3">
            {step.title}
          </h3>
          <p className="text-sm text-white/50 leading-relaxed max-w-md mx-auto">
            {step.description}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-3 mb-8">
          {step.features.map((feature) => {
            const Icon = feature.icon
            return (
              <button
                key={feature.label}
                onClick={() => feature.feature && onTryFeature?.(feature.feature)}
                className={cn(
                  'glass-card-heavy border-emerald-500/10 rounded-xl p-4 text-left transition-all duration-300',
                  feature.feature
                    ? 'hover:border-emerald-500/30 hover:-translate-y-0.5 cursor-pointer'
                    : 'cursor-default'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{feature.label}</p>
                    <p className="text-xs text-white/40">{feature.description}</p>
                  </div>
                  {feature.feature && (
                    <ChevronRight className="w-4 h-4 text-emerald-500/40" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(
              'flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all',
              currentStep === 0
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/50 hover:text-white/80'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleSkip}
            className="text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Skip tour
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 text-sm px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
          >
            {isLastStep ? (
              <>
                <Check className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Check if the user has completed onboarding
 */
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

/**
 * Reset onboarding state (for testing or re-showing)
 */
export function resetOnboarding(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}
