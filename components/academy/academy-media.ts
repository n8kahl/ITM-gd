type ModuleLike = {
  slug: string
  title: string
  coverImageUrl: string | null
}

type LessonLike = {
  slug: string
  title: string
  heroImageUrl: string | null
}

type LessonBlockLike = {
  blockType: 'hook' | 'concept_explanation' | 'worked_example' | 'guided_practice' | 'independent_practice' | 'reflection'
  contentJson: Record<string, unknown>
}

const INVALID_IMAGE_SENTINELS = new Set(['null', 'undefined', 'none', 'n/a', 'na'])
const SAFE_REMOTE_IMAGE_HOSTS = new Set([
  'cdn.discordapp.com',
  'images.unsplash.com',
])
const SAFE_REMOTE_IMAGE_SUFFIXES = ['.supabase.co']

const BLOCK_IMAGE_BY_TYPE: Record<LessonBlockLike['blockType'], string> = {
  hook: '/academy/illustrations/market-context.svg',
  concept_explanation: '/academy/illustrations/training-default.svg',
  worked_example: '/academy/illustrations/trade-management.svg',
  guided_practice: '/academy/illustrations/entry-validation.svg',
  independent_practice: '/academy/illustrations/risk-sizing.svg',
  reflection: '/academy/illustrations/review-reflection.svg',
}

export const ACADEMY_DEFAULT_MEDIA_IMAGE = '/academy/illustrations/training-default.svg'

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.toLowerCase()
  if (INVALID_IMAGE_SENTINELS.has(normalized)) return null
  if (normalized.startsWith('javascript:') || normalized === 'about:blank') return null

  if (trimmed.startsWith('/')) return trimmed

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    const host = parsed.hostname.toLowerCase()
    if (SAFE_REMOTE_IMAGE_HOSTS.has(host)) return trimmed
    if (SAFE_REMOTE_IMAGE_SUFFIXES.some((suffix) => host.endsWith(suffix))) return trimmed

    return null
  } catch {
    return null
  }
}

function inferImageFromText(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized.includes('risk')) return '/academy/illustrations/risk-sizing.svg'
  if (normalized.includes('exit')) return '/academy/illustrations/exit-discipline.svg'
  if (normalized.includes('entry')) return '/academy/illustrations/entry-validation.svg'
  if (normalized.includes('market') || normalized.includes('alert')) return '/academy/illustrations/market-context.svg'
  if (normalized.includes('option') || normalized.includes('greek') || normalized.includes('leaps')) {
    return '/academy/illustrations/options-basics.svg'
  }
  if (normalized.includes('management')) return '/academy/illustrations/trade-management.svg'
  if (normalized.includes('review') || normalized.includes('psychology')) return '/academy/illustrations/review-reflection.svg'
  return ACADEMY_DEFAULT_MEDIA_IMAGE
}

export function resolveModuleImage(moduleItem: ModuleLike): string {
  const explicitImage = sanitizeImageUrl(moduleItem.coverImageUrl)
  if (explicitImage) return explicitImage
  return inferImageFromText(`${moduleItem.slug} ${moduleItem.title}`)
}

export function resolveLessonImage(lesson: LessonLike): string {
  const explicitImage = sanitizeImageUrl(lesson.heroImageUrl)
  if (explicitImage) return explicitImage
  return inferImageFromText(`${lesson.slug} ${lesson.title}`)
}

export function resolveBlockImage(block: LessonBlockLike, lessonImageUrl: string): string {
  const explicitImage = block.contentJson.imageUrl ?? block.contentJson.image_url
  const sanitizedExplicitImage = sanitizeImageUrl(explicitImage)
  if (sanitizedExplicitImage) return sanitizedExplicitImage

  return BLOCK_IMAGE_BY_TYPE[block.blockType] || lessonImageUrl
}

function normalizeScenarioDrillMarkdown(value: string): string {
  const scenarioMatches = value.match(/Scenario\s+\d+\s*:/gi) || []
  if (scenarioMatches.length < 2) return value

  const chunks = value
    .split(/(?=Scenario\s+\d+\s*:)/gi)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)

  if (chunks.length < 2) return value

  const normalizedChunks = chunks.map((chunk) => {
    const scenarioMatch = chunk.match(/^Scenario\s+(\d+)\s*:\s*([\s\S]*)$/i)
    if (!scenarioMatch?.[1]) return chunk

    const scenarioNumber = scenarioMatch[1]
    let body = scenarioMatch[2] || ''
    body = body.replace(/\s*Trader Goal\s*-\s*/i, '\n**Trader Goal:** ')
    body = body.replace(/\s+→\s*Path:\s*/gi, '\n**Path:** ')
    body = body.replace(/\s+→\s*Est\.\s*time:\s*/gi, '\n**Estimated time:** ')
    body = body.replace(/\s+Checkpoint:\s*/gi, '\n**Checkpoint:** ')

    return `### Scenario ${scenarioNumber}\n${body.trim()}`
  })

  return normalizedChunks.join('\n\n')
}

function normalizeMarkdownContent(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value
  return normalizeScenarioDrillMarkdown(trimmed)
}

function toMarkdownFromStructuredRecord(content: Record<string, unknown>): string | null {
  const title = typeof content.title === 'string' ? content.title.trim() : ''
  const description = typeof content.description === 'string' ? content.description.trim() : ''
  const componentId = typeof content.component_id === 'string' ? content.component_id.trim() : ''

  const lines: string[] = []

  if (title.length > 0) {
    lines.push(`### ${title}`)
  }

  if (description.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(description)
  }

  if (componentId.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`**Interactive component:** \`${componentId}\``)
  }

  const annotations = Array.isArray(content.annotations)
    ? content.annotations.filter(
        (item): item is { label?: unknown; value?: unknown } => typeof item === 'object' && item !== null
      )
    : []

  if (annotations.length > 0) {
    const annotationLines = annotations
      .map((annotation) => {
        const label = typeof annotation.label === 'string' ? annotation.label.trim() : ''
        if (!label) return null
        const value = typeof annotation.value === 'number' ? String(annotation.value) : null
        return value ? `- ${label}: ${value}` : `- ${label}`
      })
      .filter((line): line is string => Boolean(line))

    if (annotationLines.length > 0) {
      if (lines.length > 0) lines.push('')
      lines.push('**Key levels:**')
      lines.push(...annotationLines)
    }
  }

  return lines.length > 0 ? lines.join('\n') : '_Interactive content available for this block._'
}

function toMarkdownFromStructuredString(rawContent: string): string | null {
  const trimmed = rawContent.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  return toMarkdownFromStructuredRecord(parsed as Record<string, unknown>)
}

export function getBlockMarkdown(contentJson: Record<string, unknown>): string {
  const markdown = contentJson.markdown
  if (typeof markdown === 'string' && markdown.trim().length > 0) {
    return normalizeMarkdownContent(markdown)
  }

  const content = contentJson.content
  if (typeof content === 'string' && content.trim().length > 0) {
    const structuredContent = toMarkdownFromStructuredString(content)
    return normalizeMarkdownContent(structuredContent ?? content)
  }

  if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
    const structuredContent = toMarkdownFromStructuredRecord(content as Record<string, unknown>)
    if (structuredContent) return normalizeMarkdownContent(structuredContent)
  }

  return '_No block content available for this lesson step yet._'
}
