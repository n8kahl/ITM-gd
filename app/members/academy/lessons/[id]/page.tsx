import { AcademyLessonViewer } from '@/components/academy/academy-lesson-viewer'

export default async function AcademyLessonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AcademyLessonViewer lessonId={id} />
}
