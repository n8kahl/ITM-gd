function sanitizeUuidForPostgrest(value: string): string {
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return match?.[0] ?? ''
}

export function buildFeedVisibilityFilter(currentUserId: string): string {
  const safeUserId = sanitizeUuidForPostgrest(currentUserId)
  return `visibility.in.(public,members),and(visibility.eq.private,user_id.eq.${safeUserId})`
}
