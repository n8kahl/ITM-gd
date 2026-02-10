'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  GraduationCap,
  Target,
  Clock,
  BarChart3,
  Building2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type Step = 'experience' | 'quiz' | 'goals' | 'time' | 'broker'

interface OnboardingData {
  experienceLevel: string
  quizAnswers: Record<string, string>
  goals: string[]
  weeklyHours: string
  hasBroker: string
  brokerName: string
}

interface OnboardingWizardProps {
  className?: string
}

// ============================================
// STEP DEFINITIONS
// ============================================

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'experience', label: 'Experience', icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'quiz', label: 'Knowledge', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'goals', label: 'Goals', icon: <Target className="w-4 h-4" /> },
  { key: 'time', label: 'Time', icon: <Clock className="w-4 h-4" /> },
  { key: 'broker', label: 'Broker', icon: <Building2 className="w-4 h-4" /> },
]

const EXPERIENCE_LEVELS = [
  { value: 'brand-new', label: 'Brand New', desc: 'Never traded before' },
  { value: 'beginner', label: 'Beginner', desc: 'Traded stocks a few times' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Understand options basics' },
  { value: 'advanced', label: 'Advanced', desc: 'Actively trading options' },
]

const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: 'What does "ITM" stand for?',
    options: ['In The Market', 'In The Money', 'Into The Momentum', 'Index Trading Method'],
    correct: 'In The Money',
  },
  {
    id: 'q2',
    question: 'What is a call option?',
    options: [
      'An obligation to buy stock',
      'The right to sell stock at a set price',
      'The right to buy stock at a set price',
      'A type of stock dividend',
    ],
    correct: 'The right to buy stock at a set price',
  },
  {
    id: 'q3',
    question: 'What happens when an option expires "out of the money"?',
    options: [
      'It automatically exercises',
      'It becomes worth more',
      'It expires worthless',
      'It converts to stock',
    ],
    correct: 'It expires worthless',
  },
]

const GOALS = [
  { value: 'income', label: 'Generate Income', desc: 'Consistent cash flow from trading' },
  { value: 'growth', label: 'Grow Portfolio', desc: 'Long-term capital appreciation' },
  { value: 'hedge', label: 'Hedge Positions', desc: 'Protect existing investments' },
  { value: 'learn', label: 'Learn Options', desc: 'Master options trading fundamentals' },
  { value: 'fulltime', label: 'Trade Full-Time', desc: 'Transition to full-time trading' },
  { value: 'community', label: 'Join Community', desc: 'Connect with other traders' },
]

const TIME_OPTIONS = [
  { value: '1-2', label: '1-2 hours/week', desc: 'Casual learner' },
  { value: '3-5', label: '3-5 hours/week', desc: 'Dedicated student' },
  { value: '5-10', label: '5-10 hours/week', desc: 'Serious commitment' },
  { value: '10+', label: '10+ hours/week', desc: 'Full immersion' },
]

const BROKER_OPTIONS = [
  { value: 'yes', label: 'Yes, I have a broker' },
  { value: 'no', label: 'No, not yet' },
  { value: 'paper', label: 'Paper trading only' },
]

// ============================================
// COMPONENT
// ============================================

export function OnboardingWizard({ className }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    experienceLevel: '',
    quizAnswers: {},
    goals: [],
    weeklyHours: '',
    hasBroker: '',
    brokerName: '',
  })

  const step = STEPS[currentStep]

  const canProceed = useCallback(() => {
    switch (step.key) {
      case 'experience':
        return !!data.experienceLevel
      case 'quiz':
        return Object.keys(data.quizAnswers).length === QUIZ_QUESTIONS.length
      case 'goals':
        return data.goals.length > 0
      case 'time':
        return !!data.weeklyHours
      case 'broker':
        return !!data.hasBroker
      default:
        return false
    }
  }, [step.key, data])

  const handleNext = useCallback(async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      // Submit onboarding
      setIsSubmitting(true)
      try {
        const experienceLevel =
          data.experienceLevel === 'brand-new'
            ? 'never'
            : data.experienceLevel

        const weeklyMinutes = (() => {
          switch (data.weeklyHours) {
            case '1-2':
              return 90
            case '3-5':
              return 240
            case '5-10':
              return 450
            case '10+':
              return 720
            default:
              return 120
          }
        })()

        const brokerStatus =
          data.hasBroker === 'yes'
            ? 'setup'
            : data.hasBroker === 'no' || data.hasBroker === 'paper'
              ? 'not_setup'
              : 'choosing'

        const response = await fetch('/api/academy/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experience_level: experienceLevel,
            learning_goals: data.goals,
            weekly_time_minutes: weeklyMinutes,
            broker_status: brokerStatus,
            preferred_lesson_type: 'video',
            onboarding_data: {
              quiz_answers: data.quizAnswers,
              broker_name: data.brokerName || null,
              raw: data,
            },
          }),
        })

        if (response.ok) {
          router.push('/members/academy')
        }
      } catch {
        // Error handled silently, user can retry
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [currentStep, data, router])

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <div className={cn('max-w-2xl mx-auto space-y-8', className)}>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                i < currentStep
                  ? 'bg-emerald-500 text-white'
                  : i === currentStep
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-white/5 text-white/30 border border-white/10'
              )}
            >
              {i < currentStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                s.icon
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  i < currentStep ? 'bg-emerald-500' : 'bg-white/10'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div
        className={cn(
          'rounded-xl p-6 lg:p-8',
          'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 1: Experience Level */}
            {step.key === 'experience' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    What is your trading experience?
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    This helps us personalize your learning path.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          experienceLevel: level.value,
                        }))
                      }
                      className={cn(
                        'text-left p-4 rounded-lg border transition-all',
                        data.experienceLevel === level.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      )}
                    >
                      <p className="text-sm font-medium text-white">
                        {level.label}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {level.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Knowledge Quiz */}
            {step.key === 'quiz' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Quick Knowledge Check
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    Don&apos;t worry -- there are no wrong answers. This helps us gauge your starting point.
                  </p>
                </div>
                <div className="space-y-5">
                  {QUIZ_QUESTIONS.map((q, qi) => (
                    <div key={q.id} className="space-y-2">
                      <p className="text-sm font-medium text-white">
                        {qi + 1}. {q.question}
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() =>
                              setData((prev) => ({
                                ...prev,
                                quizAnswers: {
                                  ...prev.quizAnswers,
                                  [q.id]: opt,
                                },
                              }))
                            }
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-lg text-sm border transition-all',
                              data.quizAnswers[q.id] === opt
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Goals */}
            {step.key === 'goals' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    What are your trading goals?
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    Select all that apply. We will tailor your curriculum.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GOALS.map((goal) => {
                    const isSelected = data.goals.includes(goal.value)
                    return (
                      <button
                        key={goal.value}
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            goals: isSelected
                              ? prev.goals.filter((g) => g !== goal.value)
                              : [...prev.goals, goal.value],
                          }))
                        }
                        className={cn(
                          'text-left p-4 rounded-lg border transition-all',
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">
                            {goal.label}
                          </p>
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {goal.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Time Commitment */}
            {step.key === 'time' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    How much time can you dedicate?
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    We will pace your curriculum accordingly.
                  </p>
                </div>
                <div className="space-y-3">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          weeklyHours: opt.value,
                        }))
                      }
                      className={cn(
                        'w-full text-left p-4 rounded-lg border transition-all',
                        data.weeklyHours === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {opt.label}
                          </p>
                          <p className="text-xs text-white/40 mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                        {data.weeklyHours === opt.value && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Broker Status */}
            {step.key === 'broker' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Do you have a brokerage account?
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    This helps us recommend practice exercises.
                  </p>
                </div>
                <div className="space-y-3">
                  {BROKER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          hasBroker: opt.value,
                        }))
                      }
                      className={cn(
                        'w-full text-left p-4 rounded-lg border transition-all',
                        data.hasBroker === opt.value
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          {opt.label}
                        </p>
                        {data.hasBroker === opt.value && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {data.hasBroker === 'yes' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="text-xs text-white/50">
                      Which broker do you use? (optional)
                    </label>
                    <input
                      type="text"
                      value={data.brokerName}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          brokerName: e.target.value,
                        }))
                      }
                      placeholder="e.g., TD Ameritrade, Robinhood, IBKR..."
                      className={cn(
                        'w-full px-3 py-2.5 rounded-lg text-sm text-white',
                        'bg-white/5 border border-white/10',
                        'placeholder:text-white/30',
                        'focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
                        'transition-colors'
                      )}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            currentStep === 0
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!canProceed() || isSubmitting}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
            canProceed() && !isSubmitting
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-white/5 text-white/20 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              Complete Setup
              <Check className="w-4 h-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
