import { AcademyLessonViewer } from '@/components/academy/academy-lesson-viewer'

export default async function AcademyLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams
  const resume = query.resume === '1'
  const preview = query.preview === 'true'

  return <AcademyLessonViewer lessonId={id} resume={resume} preview={preview} />
}
