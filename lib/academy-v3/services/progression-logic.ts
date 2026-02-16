export function getCompletedBlockIds(metadata: Record<string, unknown>): string[] {
  const raw = metadata.completedBlockIds
  if (!Array.isArray(raw)) return []

  return raw.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function computeProgressPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  const raw = (completedCount / totalCount) * 100
  return Number(Math.max(0, Math.min(100, raw)).toFixed(2))
}

export function getNextIncompleteBlockId(allBlockIds: string[], completedBlockIds: string[]): string | null {
  const completed = new Set(completedBlockIds)
  for (const blockId of allBlockIds) {
    if (!completed.has(blockId)) {
      return blockId
    }
  }

  return null
}
