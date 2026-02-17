import { permanentRedirect } from 'next/navigation'

export default async function AcademyV3ModulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const moduleSlug = typeof params.module === 'string' ? params.module : null
  const lessonId = typeof params.lesson === 'string' ? params.lesson : null

  if (lessonId) {
    permanentRedirect(`/members/academy/lessons/${encodeURIComponent(lessonId)}`)
  }

  if (moduleSlug) {
    permanentRedirect(`/members/academy/modules/${encodeURIComponent(moduleSlug)}`)
  }

  permanentRedirect('/members/academy/modules')
}
