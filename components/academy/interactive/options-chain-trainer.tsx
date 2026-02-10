'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Trophy,
  Target,
  HelpCircle,
  BarChart3,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrikeRow {
  strike: number
  callBid: number
  callAsk: number
  callVol: number
  callOI: number
  callIV: number
  putBid: number
  putAsk: number
  putVol: number
  putOI: number
  putIV: number
}

interface QuizQuestion {
  id: string
  type: 'selection' | 'number'
  question: string
  options?: string[]
  correctAnswer: string
  explanation: string
}

interface AnswerRecord {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string
  question: string
}

type QuizPhase = 'chain' | 'quiz' | 'results'

// ---------------------------------------------------------------------------
// Chain data generation
// ---------------------------------------------------------------------------

function generateChainData(underlyingPrice: number): StrikeRow[] {
  const rows: StrikeRow[] = []
  const strikeInterval = underlyingPrice > 1000 ? 25 : underlyingPrice > 100 ? 5 : 1
  const atmStrike = Math.round(underlyingPrice / strikeInterval) * strikeInterval

  // 11 strikes centered around ATM
  for (let i = -5; i <= 5; i++) {
    const strike = atmStrike + i * strikeInterval
    const distFromATM = Math.abs(strike - underlyingPrice)
    const normalizedDist = distFromATM / underlyingPrice

    // IV smile: higher IV OTM, lower ATM
    const baseIV = 0.20
    const ivSmile = baseIV + normalizedDist * 0.4 + Math.pow(normalizedDist, 2) * 0.8
    const callIV = parseFloat((ivSmile + (strike < underlyingPrice ? 0.02 : 0)).toFixed(4))
    const putIV = parseFloat((ivSmile + (strike > underlyingPrice ? 0.02 : 0)).toFixed(4))

    // Intrinsic values
    const callIntrinsic = Math.max(0, underlyingPrice - strike)
    const putIntrinsic = Math.max(0, strike - underlyingPrice)

    // Time value is higher ATM, lower deep ITM/OTM
    const timeValueMultiplier = Math.exp(-normalizedDist * 8) * underlyingPrice * 0.03
    const callTimeVal = timeValueMultiplier * (1 + callIV * 0.5)
    const putTimeVal = timeValueMultiplier * (1 + putIV * 0.5)

    const callMid = callIntrinsic + callTimeVal
    const putMid = putIntrinsic + putTimeVal

    // Spread: tighter ATM, wider OTM
    const spreadFactor = 0.02 + normalizedDist * 0.06
    const callSpread = Math.max(0.05, callMid * spreadFactor)
    const putSpread = Math.max(0.05, putMid * spreadFactor)

    const callBid = parseFloat(Math.max(0.01, callMid - callSpread / 2).toFixed(2))
    const callAsk = parseFloat(Math.max(callBid + 0.05, callMid + callSpread / 2).toFixed(2))
    const putBid = parseFloat(Math.max(0.01, putMid - putSpread / 2).toFixed(2))
    const putAsk = parseFloat(Math.max(putBid + 0.05, putMid + putSpread / 2).toFixed(2))

    // Volume: higher ATM, falls off OTM
    const baseVol = 5000
    const volMultiplier = Math.exp(-normalizedDist * 6)
    const callVol = Math.round(baseVol * volMultiplier * (0.8 + Math.random() * 0.4))
    const putVol = Math.round(baseVol * volMultiplier * (0.8 + Math.random() * 0.4))

    // OI: higher ATM, round-ish numbers
    const baseOI = 20000
    const oiMultiplier = Math.exp(-normalizedDist * 4)
    const callOI = Math.round((baseOI * oiMultiplier * (0.7 + Math.random() * 0.6)) / 100) * 100
    const putOI = Math.round((baseOI * oiMultiplier * (0.7 + Math.random() * 0.6)) / 100) * 100

    rows.push({
      strike,
      callBid,
      callAsk,
      callVol,
      callOI,
      callIV,
      putBid,
      putAsk,
      putVol,
      putOI,
      putIV,
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Quiz question generation
// ---------------------------------------------------------------------------

function generateQuestions(chain: StrikeRow[], underlying: number): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  const used = new Set<string>()

  // Helper: pick a random strike row
  const randomRow = () => chain[Math.floor(Math.random() * chain.length)]
  const atmRow = chain.find(
    (r) => Math.abs(r.strike - underlying) === Math.min(...chain.map((c) => Math.abs(c.strike - underlying))),
  )!

  // Type 1: Bid-Ask Spread
  {
    const row = randomRow()
    const side = Math.random() > 0.5 ? 'call' : 'put'
    const bid = side === 'call' ? row.callBid : row.putBid
    const ask = side === 'call' ? row.callAsk : row.putAsk
    const spread = parseFloat((ask - bid).toFixed(2))
    questions.push({
      id: 'bidask',
      type: 'number',
      question: `What is the bid-ask spread for the ${row.strike} ${side}? (Bid: $${bid.toFixed(2)}, Ask: $${ask.toFixed(2)})`,
      correctAnswer: spread.toFixed(2),
      explanation: `The bid-ask spread is Ask - Bid = $${ask.toFixed(2)} - $${bid.toFixed(2)} = $${spread.toFixed(2)}. Tighter spreads indicate more liquid strikes.`,
    })
    used.add('bidask')
  }

  // Type 2: Highest OI
  {
    const callOIs = chain.map((r) => ({ strike: r.strike, oi: r.callOI }))
    const maxCallOI = callOIs.reduce((max, c) => (c.oi > max.oi ? c : max), callOIs[0])
    const options = chain
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((r) => `${r.strike} (${r.callOI.toLocaleString()})`)
    // Ensure correct answer is in options
    const correctOption = `${maxCallOI.strike} (${maxCallOI.oi.toLocaleString()})`
    if (!options.includes(correctOption)) {
      options[0] = correctOption
    }
    // Sort options by strike for readability
    options.sort((a, b) => {
      const sa = parseInt(a)
      const sb = parseInt(b)
      return sa - sb
    })
    questions.push({
      id: 'highestoi',
      type: 'selection',
      question: 'Which call strike has the highest open interest?',
      options,
      correctAnswer: correctOption,
      explanation: `The ${maxCallOI.strike} strike has the highest call OI at ${maxCallOI.oi.toLocaleString()}. High OI often indicates key support/resistance levels that market makers hedge around.`,
    })
  }

  // Type 3: Intrinsic Value
  {
    const itmCalls = chain.filter((r) => r.strike < underlying)
    const itmPuts = chain.filter((r) => r.strike > underlying)
    if (itmCalls.length > 0) {
      const row = itmCalls[Math.floor(Math.random() * itmCalls.length)]
      const intrinsic = parseFloat((underlying - row.strike).toFixed(2))
      questions.push({
        id: 'intrinsic',
        type: 'number',
        question: `What is the intrinsic value of the ${row.strike} call with underlying at $${underlying.toFixed(0)}?`,
        correctAnswer: intrinsic.toFixed(2),
        explanation: `Call intrinsic value = Underlying - Strike = $${underlying.toFixed(0)} - $${row.strike} = $${intrinsic.toFixed(2)}. This is the "real" value if exercised immediately.`,
      })
    } else if (itmPuts.length > 0) {
      const row = itmPuts[Math.floor(Math.random() * itmPuts.length)]
      const intrinsic = parseFloat((row.strike - underlying).toFixed(2))
      questions.push({
        id: 'intrinsic',
        type: 'number',
        question: `What is the intrinsic value of the ${row.strike} put with underlying at $${underlying.toFixed(0)}?`,
        correctAnswer: intrinsic.toFixed(2),
        explanation: `Put intrinsic value = Strike - Underlying = $${row.strike} - $${underlying.toFixed(0)} = $${intrinsic.toFixed(2)}. This is the "real" value if exercised immediately.`,
      })
    }
  }

  // Type 4: ITM/OTM identification
  {
    const row = randomRow()
    const isCallITM = row.strike < underlying
    const isCallOTM = row.strike > underlying
    const isATM = row.strike === atmRow.strike

    const correctLabel = isATM ? 'ATM' : isCallITM ? 'ITM' : 'OTM'
    questions.push({
      id: 'itmotm',
      type: 'selection',
      question: `With the underlying at $${underlying.toFixed(0)}, is the ${row.strike} call In-The-Money (ITM), At-The-Money (ATM), or Out-of-The-Money (OTM)?`,
      options: ['ITM', 'ATM', 'OTM'],
      correctAnswer: correctLabel,
      explanation:
        correctLabel === 'ITM'
          ? `The ${row.strike} call is ITM because the underlying ($${underlying.toFixed(0)}) is above the strike ($${row.strike}). The option has intrinsic value.`
          : correctLabel === 'OTM'
            ? `The ${row.strike} call is OTM because the underlying ($${underlying.toFixed(0)}) is below the strike ($${row.strike}). The option has no intrinsic value.`
            : `The ${row.strike} call is ATM because the underlying ($${underlying.toFixed(0)}) is at or very near the strike ($${row.strike}).`,
    })
  }

  // Type 5: Profit/Loss calculation
  {
    const row = chain.find((r) => r.strike < underlying) || chain[0]
    const buyPrice = row.callAsk
    const targetUnderlying = row.strike + buyPrice + 5
    const profit = parseFloat((targetUnderlying - row.strike - buyPrice).toFixed(2))
    questions.push({
      id: 'pnl',
      type: 'number',
      question: `You buy the ${row.strike} call at $${buyPrice.toFixed(2)} (ask). If the underlying expires at $${targetUnderlying.toFixed(0)}, what is your profit per share?`,
      correctAnswer: profit.toFixed(2),
      explanation: `Profit = (Underlying at Expiry - Strike) - Premium Paid = ($${targetUnderlying.toFixed(0)} - $${row.strike}) - $${buyPrice.toFixed(2)} = $${profit.toFixed(2)} per share ($${(profit * 100).toFixed(0)} per contract).`,
    })
  }

  // Type 6: Highest IV
  {
    const ivPairs = chain.map((r) => ({
      strike: r.strike,
      callIV: r.callIV,
      putIV: r.putIV,
    }))
    const maxCallIV = ivPairs.reduce((max, c) => (c.callIV > max.callIV ? c : max), ivPairs[0])
    const options = chain
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((r) => `${r.strike} (${(r.callIV * 100).toFixed(1)}%)`)
    const correctOption = `${maxCallIV.strike} (${(maxCallIV.callIV * 100).toFixed(1)}%)`
    if (!options.includes(correctOption)) {
      options[0] = correctOption
    }
    options.sort((a, b) => parseInt(a) - parseInt(b))
    questions.push({
      id: 'highestiv',
      type: 'selection',
      question: 'Which call strike has the highest implied volatility?',
      options,
      correctAnswer: correctOption,
      explanation: `The ${maxCallIV.strike} strike has the highest call IV at ${(maxCallIV.callIV * 100).toFixed(1)}%. This is consistent with the "volatility smile" -- OTM options tend to have higher IV due to crash risk and demand for hedging.`,
    })
  }

  // Shuffle
  return questions.sort(() => Math.random() - 0.5)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChainTable({
  chain,
  underlyingPrice,
}: {
  chain: StrikeRow[]
  underlyingPrice: number
}) {
  const atmStrike = chain.reduce(
    (closest, row) =>
      Math.abs(row.strike - underlyingPrice) < Math.abs(closest.strike - underlyingPrice)
        ? row
        : closest,
    chain[0],
  ).strike

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs font-mono border-collapse min-w-[700px]">
        <thead>
          <tr>
            <th
              colSpan={6}
              className="text-center text-[#10B981] font-semibold py-2 border-b border-white/10"
            >
              CALLS
            </th>
            <th className="py-2 border-b border-white/10" />
            <th
              colSpan={4}
              className="text-center text-red-400 font-semibold py-2 border-b border-white/10"
            >
              PUTS
            </th>
          </tr>
          <tr className="text-white/40">
            <th className="py-2 px-2 text-right font-medium">Bid</th>
            <th className="py-2 px-2 text-right font-medium">Ask</th>
            <th className="py-2 px-2 text-right font-medium">Vol</th>
            <th className="py-2 px-2 text-right font-medium">OI</th>
            <th className="py-2 px-2 text-right font-medium">IV</th>
            <th className="py-2 px-1" />
            <th className="py-2 px-3 text-center font-medium text-white/60">Strike</th>
            <th className="py-2 px-1" />
            <th className="py-2 px-2 text-right font-medium">Bid</th>
            <th className="py-2 px-2 text-right font-medium">Ask</th>
          </tr>
        </thead>
        <tbody>
          {chain.map((row) => {
            const isATM = row.strike === atmStrike
            return (
              <tr
                key={row.strike}
                className={cn(
                  'border-b border-white/5 hover:bg-white/[0.02] transition-colors',
                  isATM && 'bg-[#10B981]/10',
                )}
              >
                <td className="py-2 px-2 text-right text-[#10B981]">
                  {row.callBid.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right text-[#10B981]">
                  {row.callAsk.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right text-white/50">
                  {row.callVol.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right text-white/50">
                  {row.callOI.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right text-[#F3E5AB]">
                  {(row.callIV * 100).toFixed(1)}%
                </td>
                <td className="py-2 px-1" />
                <td
                  className={cn(
                    'py-2 px-3 text-center font-semibold',
                    isATM ? 'text-[#10B981]' : 'text-white/80',
                  )}
                >
                  {row.strike}
                  {isATM && (
                    <span className="ml-1 text-[10px] text-[#10B981]/60 font-normal">
                      ATM
                    </span>
                  )}
                </td>
                <td className="py-2 px-1" />
                <td className="py-2 px-2 text-right text-red-400">
                  {row.putBid.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right text-red-400">
                  {row.putAsk.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProgressBar({
  current,
  total,
}: {
  current: number
  total: number
}) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          Question {current} of {total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#10B981] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OptionsChainTrainer() {
  const [underlyingPrice] = useState(4500)
  const [chain, setChain] = useState<StrikeRow[]>(() => generateChainData(underlyingPrice))
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    generateQuestions(chain, underlyingPrice),
  )
  const [phase, setPhase] = useState<QuizPhase>('chain')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [numberInput, setNumberInput] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [currentFeedback, setCurrentFeedback] = useState<{
    isCorrect: boolean
    explanation: string
  } | null>(null)

  // Current question
  const question = questions[currentQ] ?? null

  // Start quiz
  const handleStartQuiz = useCallback(() => {
    setPhase('quiz')
    setCurrentQ(0)
    setAnswers([])
    setSelectedOption(null)
    setNumberInput('')
    setShowFeedback(false)
    setCurrentFeedback(null)
  }, [])

  // Submit answer
  const handleSubmit = useCallback(() => {
    if (!question) return

    const userAnswer =
      question.type === 'selection' ? selectedOption ?? '' : numberInput.trim()

    let isCorrect = false
    if (question.type === 'selection') {
      isCorrect = userAnswer === question.correctAnswer
    } else {
      // For number answers, allow small tolerance
      const userNum = parseFloat(userAnswer)
      const correctNum = parseFloat(question.correctAnswer)
      if (!isNaN(userNum) && !isNaN(correctNum)) {
        isCorrect = Math.abs(userNum - correctNum) < 0.02
      }
    }

    const record: AnswerRecord = {
      questionId: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation,
      question: question.question,
    }

    setAnswers((prev) => [...prev, record])
    setCurrentFeedback({ isCorrect, explanation: question.explanation })
    setShowFeedback(true)
  }, [question, selectedOption, numberInput])

  // Next question
  const handleNext = useCallback(() => {
    if (currentQ + 1 >= questions.length) {
      setPhase('results')
    } else {
      setCurrentQ((prev) => prev + 1)
      setSelectedOption(null)
      setNumberInput('')
      setShowFeedback(false)
      setCurrentFeedback(null)
    }
  }, [currentQ, questions.length])

  // Try again
  const handleReset = useCallback(() => {
    const newChain = generateChainData(underlyingPrice)
    setChain(newChain)
    setQuestions(generateQuestions(newChain, underlyingPrice))
    setPhase('chain')
    setCurrentQ(0)
    setAnswers([])
    setSelectedOption(null)
    setNumberInput('')
    setShowFeedback(false)
    setCurrentFeedback(null)
  }, [underlyingPrice])

  // Score
  const score = useMemo(
    () => answers.filter((a) => a.isCorrect).length,
    [answers],
  )

  const canSubmit =
    question?.type === 'selection'
      ? selectedOption !== null
      : numberInput.trim() !== ''

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#10B981]" />
            Options Chain Trainer
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Read the chain, then answer questions to test your skills
          </p>
        </div>
        <div className="text-xs font-mono text-[#F3E5AB] bg-[#F3E5AB]/10 border border-[#F3E5AB]/20 rounded-lg px-3 py-1.5">
          Underlying: ${underlyingPrice.toLocaleString()}
        </div>
      </div>

      {/* Phase: Chain display */}
      {phase === 'chain' && (
        <>
          <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#10B981]" />
                Options Chain (30 DTE)
              </h3>
              <span className="text-[10px] text-white/30">
                Study the chain, then start the quiz
              </span>
            </div>
            <ChainTable chain={chain} underlyingPrice={underlyingPrice} />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleStartQuiz}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#10B981] text-white font-semibold text-sm
                hover:bg-[#059669] transition-all duration-300 shadow-lg shadow-[#10B981]/20 hover:-translate-y-0.5"
            >
              Start Quiz
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* Phase: Quiz */}
      {phase === 'quiz' && question && (
        <>
          {/* Chain reference (collapsed on mobile) */}
          <details className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl">
            <summary className="p-4 cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Options Chain (reference)
            </summary>
            <div className="px-5 pb-5">
              <ChainTable chain={chain} underlyingPrice={underlyingPrice} />
            </div>
          </details>

          {/* Progress */}
          <ProgressBar current={currentQ + 1} total={questions.length} />

          {/* Question card */}
          <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-[#10B981]" />
              </div>
              <p className="text-sm text-white leading-relaxed pt-1">
                {question.question}
              </p>
            </div>

            {/* Selection options */}
            {question.type === 'selection' && question.options && (
              <div className="space-y-2 pl-11">
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !showFeedback && setSelectedOption(opt)}
                    disabled={showFeedback}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-200',
                      showFeedback && opt === question.correctAnswer
                        ? 'border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981]'
                        : showFeedback && opt === selectedOption && opt !== question.correctAnswer
                          ? 'border-red-500/50 bg-red-500/10 text-red-400'
                          : selectedOption === opt
                            ? 'border-[#10B981]/30 bg-[#10B981]/5 text-white'
                            : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]',
                      showFeedback && 'cursor-default',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Number input */}
            {question.type === 'number' && (
              <div className="pl-11">
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={numberInput}
                    onChange={(e) => !showFeedback && setNumberInput(e.target.value)}
                    disabled={showFeedback}
                    placeholder="0.00"
                    className={cn(
                      'w-full h-11 rounded-lg border bg-white/5 pl-7 pr-3 text-sm text-white font-mono',
                      'focus:border-[#10B981] focus:outline-none focus:ring-0 transition-colors',
                      showFeedback
                        ? currentFeedback?.isCorrect
                          ? 'border-[#10B981]/50 bg-[#10B981]/5'
                          : 'border-red-500/50 bg-red-500/5'
                        : 'border-white/10',
                    )}
                  />
                </div>
                {showFeedback && !currentFeedback?.isCorrect && (
                  <p className="mt-2 text-xs text-red-400 font-mono">
                    Correct answer: ${question.correctAnswer}
                  </p>
                )}
              </div>
            )}

            {/* Feedback */}
            {showFeedback && currentFeedback && (
              <div
                className={cn(
                  'ml-11 rounded-lg border p-4 space-y-2',
                  currentFeedback.isCorrect
                    ? 'bg-[#10B981]/10 border-[#10B981]/20'
                    : 'bg-red-500/10 border-red-500/20',
                )}
              >
                <div className="flex items-center gap-2">
                  {currentFeedback.isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      currentFeedback.isCorrect ? 'text-[#10B981]' : 'text-red-400',
                    )}
                  >
                    {currentFeedback.isCorrect ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  {currentFeedback.explanation}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pl-11">
              {!showFeedback ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300',
                    canSubmit
                      ? 'bg-[#10B981] text-white hover:bg-[#059669] shadow-lg shadow-[#10B981]/20 hover:-translate-y-0.5'
                      : 'bg-white/10 text-white/30 cursor-not-allowed',
                  )}
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#10B981] text-white text-sm font-semibold
                    hover:bg-[#059669] transition-all duration-300 shadow-lg shadow-[#10B981]/20 hover:-translate-y-0.5"
                >
                  {currentQ + 1 >= questions.length ? 'View Results' : 'Next Question'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Phase: Results */}
      {phase === 'results' && (
        <div className="space-y-6">
          {/* Score card */}
          <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#10B981]/20 mb-2">
              <Trophy className="h-8 w-8 text-[#10B981]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Quiz Complete</h3>
              <p className="text-white/40 text-sm mt-1">
                Here&apos;s how you did reading the options chain
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="text-4xl font-bold font-mono text-[#10B981]">
                {score}
              </div>
              <div className="text-white/30 text-lg">/</div>
              <div className="text-4xl font-bold font-mono text-white/40">
                {questions.length}
              </div>
            </div>
            <p
              className={cn(
                'text-sm font-semibold',
                score === questions.length
                  ? 'text-[#10B981]'
                  : score >= questions.length / 2
                    ? 'text-[#F3E5AB]'
                    : 'text-red-400',
              )}
            >
              {score === questions.length
                ? 'Perfect Score! Outstanding chain reading skills.'
                : score >= questions.length / 2
                  ? 'Good job! Review the missed questions to improve.'
                  : 'Keep practicing. Options chain fluency is a critical skill.'}
            </p>
          </div>

          {/* Answer review */}
          <div className="bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#F3E5AB]" />
              Answer Review
            </h3>
            <div className="space-y-3">
              {answers.map((a, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border p-4 space-y-2',
                    a.isCorrect
                      ? 'border-[#10B981]/20 bg-[#10B981]/5'
                      : 'border-red-500/20 bg-red-500/5',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {a.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-white/80 leading-relaxed">
                        {a.question}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                        <span className="text-white/40">
                          Your answer:{' '}
                          <span
                            className={
                              a.isCorrect ? 'text-[#10B981]' : 'text-red-400'
                            }
                          >
                            {a.userAnswer || '(empty)'}
                          </span>
                        </span>
                        {!a.isCorrect && (
                          <span className="text-white/40">
                            Correct:{' '}
                            <span className="text-[#10B981]">
                              {a.correctAnswer}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        {a.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Try again */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#10B981] text-white font-semibold text-sm
                hover:bg-[#059669] transition-all duration-300 shadow-lg shadow-[#10B981]/20 hover:-translate-y-0.5"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
