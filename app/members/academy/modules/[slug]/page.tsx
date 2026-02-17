import { AcademyModuleDetail } from '@/components/academy/academy-module-detail'

export default async function AcademyModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <AcademyModuleDetail slug={slug} />
}
