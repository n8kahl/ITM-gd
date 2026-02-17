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

const BLOCK_IMAGE_BY_TYPE: Record<LessonBlockLike['blockType'], string> = {
  hook: '/academy/illustrations/market-context.svg',
  concept_explanation: '/academy/illustrations/training-default.svg',
  worked_example: '/academy/illustrations/trade-management.svg',
  guided_practice: '/academy/illustrations/entry-validation.svg',
  independent_practice: '/academy/illustrations/risk-sizing.svg',
  reflection: '/academy/illustrations/review-reflection.svg',
}

const DEFAULT_MEDIA_IMAGE = '/academy/illustrations/training-default.svg'

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
  return DEFAULT_MEDIA_IMAGE
}

export function resolveModuleImage(moduleItem: ModuleLike): string {
  if (moduleItem.coverImageUrl) return moduleItem.coverImageUrl
  return inferImageFromText(`${moduleItem.slug} ${moduleItem.title}`)
}

export function resolveLessonImage(lesson: LessonLike): string {
  if (lesson.heroImageUrl) return lesson.heroImageUrl
  return inferImageFromText(`${lesson.slug} ${lesson.title}`)
}

export function resolveBlockImage(block: LessonBlockLike, lessonImageUrl: string): string {
  const explicitImage = block.contentJson.imageUrl ?? block.contentJson.image_url
  if (typeof explicitImage === 'string' && explicitImage.trim().length > 0) {
    return explicitImage
  }

  return BLOCK_IMAGE_BY_TYPE[block.blockType] || lessonImageUrl
}

export function getBlockMarkdown(contentJson: Record<string, unknown>): string {
  const markdown = contentJson.markdown
  if (typeof markdown === 'string' && markdown.trim().length > 0) {
    return markdown
  }

  const content = contentJson.content
  if (typeof content === 'string' && content.trim().length > 0) {
    return content
  }

  return '_No block content available for this lesson step yet._'
}
