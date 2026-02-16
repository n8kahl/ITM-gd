import type { AcademyLearningEventRepository } from '@/lib/academy-v3/repositories'

export async function safeInsertLearningEvent(
  events: AcademyLearningEventRepository,
  input: Parameters<AcademyLearningEventRepository['insertEvent']>[0]
): Promise<void> {
  try {
    await events.insertEvent(input)
  } catch {
    // Event logging must not block user learning flows.
  }
}
