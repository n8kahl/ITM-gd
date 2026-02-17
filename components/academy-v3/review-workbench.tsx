'use client'

import { useEffect, useMemo, useState } from 'react'

import { AcademyPanel, AcademyV3Shell } from '@/components/academy-v3/academy-v3-shell'
import { fetchReviewQueue, submitReview } from '@/lib/academy-v3/client'
import { Analytics } from '@/lib/analytics'

type ReviewQueueData = Awaited<ReturnType<typeof fetchReviewQueue>>

export function ReviewWorkbench() {
  const [queue, setQueue] = useState<ReviewQueueData | null>(null)
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function loadQueue() {
    setLoading(true)
    setError(null)

    return fetchReviewQueue(20)
      .then((data) => {
        setQueue(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load review queue')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  const nextDueItem = useMemo(() => queue?.items[0] || null, [queue])

  async function handleSubmit(queueId: string) {
    const answer = draftAnswers[queueId]?.trim()
    if (!answer) {
      setNotice('Provide an answer before submitting.')
      return
    }

    setSubmittingId(queueId)
    setNotice(null)

    try {
      const result = await submitReview(queueId, {
        answer: { response: answer },
        confidenceRating: 3,
      })

      setNotice(result.isCorrect ? 'Marked correct and rescheduled.' : 'Not quite. Review item rescheduled for reinforcement.')
      setDraftAnswers((prev) => ({ ...prev, [queueId]: '' }))
      await loadQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review answer')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <AcademyV3Shell
      title="Review"
      description="Keep weak competencies fresh with short, due-now retrieval prompts."
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading review queue...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
          <AcademyPanel title="Queue Status">
            <p className="text-base text-white">{queue?.dueCount || 0} due items</p>
            <p className="mt-2 text-sm text-zinc-400">Items are prioritized by weak competency and due time.</p>
            {nextDueItem ? (
              <div className="mt-4 rounded-md border border-white/10 p-3">
                <p className="text-sm text-zinc-300">Next due</p>
                <p className="mt-1 text-sm text-white">{String(nextDueItem.prompt.prompt || 'Review prompt')}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-emerald-300">Queue clear. You are caught up for now.</p>
            )}
          </AcademyPanel>

          <AcademyPanel title="Due Items">
            {notice ? <p className="mb-3 text-xs text-emerald-300">{notice}</p> : null}
            {!queue?.items.length ? (
              <p className="text-sm text-zinc-400">No review items due.</p>
            ) : (
              <ul className="space-y-3">
                {queue.items.map((item) => (
                  <li key={item.queueId} className="rounded-md border border-white/10 p-3">
                    <p className="text-sm text-white">{String(item.prompt.prompt || 'Review prompt')}</p>
                    <p className="mt-1 text-xs text-zinc-400">Due: {new Date(item.dueAt).toLocaleString()}</p>

                    <textarea
                      value={draftAnswers[item.queueId] || ''}
                      onChange={(event) =>
                        setDraftAnswers((prev) => ({
                          ...prev,
                          [item.queueId]: event.target.value,
                        }))
                      }
                      className="mt-3 min-h-20 w-full rounded-md border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-zinc-200 outline-none ring-0 focus:border-emerald-500/40"
                      placeholder="Type your answer..."
                    />

                    <button
                      type="button"
                      onClick={() => {
                        Analytics.trackAcademyAction('submit_review_answer')
                        void handleSubmit(item.queueId)
                      }}
                      disabled={submittingId === item.queueId}
                      className="mt-3 rounded-md bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingId === item.queueId ? 'Submitting...' : 'Submit review answer'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AcademyPanel>
        </div>
      )}
    </AcademyV3Shell>
  )
}
