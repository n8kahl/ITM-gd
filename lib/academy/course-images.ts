interface CourseImageInput {
  slug?: string | null
  title?: string | null
  path?: string | null
}

const ILLUSTRATION_MAP: Array<{ keywords: string[]; src: string }> = [
  {
    keywords: ['context', 'market', 'macro', 'framework'],
    src: '/academy/illustrations/market-context.svg',
  },
  {
    keywords: ['entry', 'setup', 'trigger', 'breakout', 'confirmation'],
    src: '/academy/illustrations/entry-validation.svg',
  },
  {
    keywords: ['risk', 'sizing', 'position', 'capital', 'drawdown'],
    src: '/academy/illustrations/risk-sizing.svg',
  },
  {
    keywords: ['manage', 'management', 'trade plan', 'adjust', 'active trade'],
    src: '/academy/illustrations/trade-management.svg',
  },
  {
    keywords: ['exit', 'profit', 'stop', 'close', 'discipline'],
    src: '/academy/illustrations/exit-discipline.svg',
  },
  {
    keywords: ['review', 'reflection', 'journal', 'debrief', 'mistake'],
    src: '/academy/illustrations/review-reflection.svg',
  },
  {
    keywords: ['option', 'greeks', 'chain', 'premium', 'iv', 'volatility'],
    src: '/academy/illustrations/options-basics.svg',
  },
]

const DEFAULT_COURSE_IMAGE = '/academy/illustrations/training-default.svg'

function normalizeText(value?: string | null): string {
  return (value || '').toLowerCase().trim()
}

export function getCourseIllustration(input: CourseImageInput): string {
  const haystack = `${normalizeText(input.slug)} ${normalizeText(input.title)} ${normalizeText(input.path)}`

  for (const candidate of ILLUSTRATION_MAP) {
    if (candidate.keywords.some((keyword) => haystack.includes(keyword))) {
      return candidate.src
    }
  }

  return DEFAULT_COURSE_IMAGE
}

export function resolveCourseImage(input: CourseImageInput & { thumbnailUrl?: string | null }): string {
  if (input.thumbnailUrl && input.thumbnailUrl.length > 0) {
    return input.thumbnailUrl
  }

  return getCourseIllustration(input)
}
