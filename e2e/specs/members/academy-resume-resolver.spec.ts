import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAcademyResumeTarget } from '../../../lib/academy/resume'

type TableRow = Record<string, unknown>
type TableMap = Record<string, TableRow[]>

class MockQueryBuilder<T extends TableRow>
  implements PromiseLike<{ data: T[]; error: null }> {
  private readonly filters: Array<(row: T) => boolean> = []
  private readonly orders: Array<{ field: string; ascending: boolean }> = []

  constructor(private readonly rows: T[]) {}

  select(_columns: string) {
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value)
    return this
  }

  in(field: string, values: unknown[]) {
    const allowedValues = new Set(values)
    this.filters.push((row) => allowedValues.has(row[field]))
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({
      field,
      ascending: options?.ascending !== false,
    })
    return this
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }

  private execute(): { data: T[]; error: null } {
    let result = [...this.rows]

    for (const predicate of this.filters) {
      result = result.filter(predicate)
    }

    // Apply last sort first so earlier order calls have higher precedence.
    for (let index = this.orders.length - 1; index >= 0; index -= 1) {
      const { field, ascending } = this.orders[index]
      result.sort((leftRow, rightRow) => {
        const left = leftRow[field]
        const right = rightRow[field]

        if (left === right) return 0
        if (left == null) return 1
        if (right == null) return -1

        if (left < right) return ascending ? -1 : 1
        return ascending ? 1 : -1
      })
    }

    return { data: result, error: null }
  }
}

class MockSupabase {
  constructor(private readonly tables: TableMap) {}

  from(table: string) {
    const rows = (this.tables[table] || []) as TableRow[]
    return {
      select: (_columns: string) => new MockQueryBuilder(rows),
    }
  }
}

function createSupabase(tables: TableMap): SupabaseClient {
  return new MockSupabase(tables) as unknown as SupabaseClient
}

test.describe('academy resume resolver contract', () => {
  test('returns most recent in-progress lesson when one exists', async () => {
    const supabase = createSupabase({
      courses: [
        { id: 'course-a', slug: 'alpha', title: 'Alpha', display_order: 1, is_published: true },
        { id: 'course-b', slug: 'beta', title: 'Beta', display_order: 2, is_published: true },
      ],
      lessons: [
        { id: 'lesson-a1', course_id: 'course-a', title: 'Alpha 1', display_order: 1 },
        { id: 'lesson-a2', course_id: 'course-a', title: 'Alpha 2', display_order: 2 },
        { id: 'lesson-b1', course_id: 'course-b', title: 'Beta 1', display_order: 1 },
      ],
      user_lesson_progress: [
        { user_id: 'user-1', course_id: 'course-a', lesson_id: 'lesson-a1', status: 'in_progress', started_at: '2026-02-01T10:00:00.000Z' },
        { user_id: 'user-1', course_id: 'course-b', lesson_id: 'lesson-b1', status: 'in_progress', started_at: '2026-02-02T10:00:00.000Z' },
        { user_id: 'user-1', course_id: 'course-a', lesson_id: 'lesson-a2', status: 'completed', started_at: '2026-01-01T09:00:00.000Z' },
      ],
    })

    const target = await resolveAcademyResumeTarget(supabase, {
      userId: 'user-1',
    })

    expect(target).not.toBeNull()
    expect(target?.lessonId).toBe('lesson-b1')
    expect(target?.source).toBe('in_progress')
    expect(target?.courseSlug).toBe('beta')
    expect(target?.resumeUrl).toBe('/members/academy/learn/lesson-b1')
  })

  test('falls back to first unlocked incomplete lesson when no in-progress lesson exists', async () => {
    const supabase = createSupabase({
      courses: [
        { id: 'course-a', slug: 'alpha', title: 'Alpha', display_order: 1, is_published: true },
      ],
      lessons: [
        { id: 'lesson-a1', course_id: 'course-a', title: 'Alpha 1', display_order: 1 },
        { id: 'lesson-a2', course_id: 'course-a', title: 'Alpha 2', display_order: 2 },
        { id: 'lesson-a3', course_id: 'course-a', title: 'Alpha 3', display_order: 3 },
      ],
      user_lesson_progress: [
        { user_id: 'user-1', course_id: 'course-a', lesson_id: 'lesson-a1', status: 'completed', started_at: '2026-02-01T10:00:00.000Z' },
      ],
    })

    const target = await resolveAcademyResumeTarget(supabase, {
      userId: 'user-1',
    })

    expect(target).not.toBeNull()
    expect(target?.lessonId).toBe('lesson-a2')
    expect(target?.source).toBe('next_unlocked')
    expect(target?.lessonNumber).toBe(2)
    expect(target?.totalLessons).toBe(3)
    expect(target?.completedLessons).toBe(1)
    expect(target?.courseProgressPercent).toBe(33)
  })

  test('respects course scope and does not leak global in-progress lessons', async () => {
    const supabase = createSupabase({
      courses: [
        { id: 'course-a', slug: 'alpha', title: 'Alpha', display_order: 1, is_published: true },
        { id: 'course-b', slug: 'beta', title: 'Beta', display_order: 2, is_published: true },
      ],
      lessons: [
        { id: 'lesson-a1', course_id: 'course-a', title: 'Alpha 1', display_order: 1 },
        { id: 'lesson-a2', course_id: 'course-a', title: 'Alpha 2', display_order: 2 },
        { id: 'lesson-b1', course_id: 'course-b', title: 'Beta 1', display_order: 1 },
      ],
      user_lesson_progress: [
        { user_id: 'user-1', course_id: 'course-a', lesson_id: 'lesson-a1', status: 'completed', started_at: '2026-02-01T10:00:00.000Z' },
        { user_id: 'user-1', course_id: 'course-b', lesson_id: 'lesson-b1', status: 'in_progress', started_at: '2026-02-03T10:00:00.000Z' },
      ],
    })

    const scopedTarget = await resolveAcademyResumeTarget(supabase, {
      userId: 'user-1',
      courseId: 'course-a',
    })

    expect(scopedTarget).not.toBeNull()
    expect(scopedTarget?.lessonId).toBe('lesson-a2')
    expect(scopedTarget?.courseId).toBe('course-a')
    expect(scopedTarget?.source).toBe('next_unlocked')
  })

  test('returns null when there are no published courses', async () => {
    const supabase = createSupabase({
      courses: [],
      lessons: [],
      user_lesson_progress: [],
    })

    const target = await resolveAcademyResumeTarget(supabase, {
      userId: 'user-1',
    })

    expect(target).toBeNull()
  })
})
