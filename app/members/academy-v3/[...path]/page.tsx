import { permanentRedirect } from 'next/navigation'

function toSearchParams(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      query.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item)
      }
    }
  }
  return query.toString()
}

export default async function AcademyV3CatchallPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { path } = await params
  const query = toSearchParams(await searchParams)
  const destinationPath = `/members/academy/${path.join('/')}`
  permanentRedirect(query ? `${destinationPath}?${query}` : destinationPath)
}
