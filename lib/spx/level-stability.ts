export interface StabilizeLevelKeysInput {
  previousStableKeys: string[]
  previousStreakByKey: Record<string, number>
  candidateKeys: string[]
  targetCount: number
  minPromoteStreak: number
}

export interface StabilizeLevelKeysOutput {
  stableKeys: string[]
  streakByKey: Record<string, number>
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false
  }
  return true
}

export function stabilizeLevelKeys(input: StabilizeLevelKeysInput): StabilizeLevelKeysOutput {
  const {
    previousStableKeys,
    previousStreakByKey,
    candidateKeys,
    targetCount,
    minPromoteStreak,
  } = input

  const nextStreakByKey: Record<string, number> = {}
  for (const key of candidateKeys) {
    nextStreakByKey[key] = (previousStreakByKey[key] || 0) + 1
  }

  if (candidateKeys.length === 0 || targetCount <= 0) {
    return {
      stableKeys: [],
      streakByKey: nextStreakByKey,
    }
  }

  const maxCount = Math.min(targetCount, candidateKeys.length)
  const candidateSet = new Set(candidateKeys)
  const nextStableKeys: string[] = []

  for (const key of previousStableKeys) {
    if (!candidateSet.has(key)) continue
    if (nextStableKeys.includes(key)) continue
    nextStableKeys.push(key)
    if (nextStableKeys.length >= maxCount) {
      return {
        stableKeys: nextStableKeys,
        streakByKey: nextStreakByKey,
      }
    }
  }

  for (const key of candidateKeys) {
    if (nextStableKeys.includes(key)) continue
    const streak = nextStreakByKey[key] || 0
    if (streak >= minPromoteStreak) {
      nextStableKeys.push(key)
    }
    if (nextStableKeys.length >= maxCount) {
      return {
        stableKeys: nextStableKeys,
        streakByKey: nextStreakByKey,
      }
    }
  }

  for (const key of candidateKeys) {
    if (nextStableKeys.includes(key)) continue
    nextStableKeys.push(key)
    if (nextStableKeys.length >= maxCount) break
  }

  return {
    stableKeys: nextStableKeys,
    streakByKey: nextStreakByKey,
  }
}
