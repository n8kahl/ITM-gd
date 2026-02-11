interface CourseImageInput {
  slug?: string | null
  title?: string | null
  path?: string | null
}

const ILLUSTRATION_MAP: Array<{ keywords: string[]; src: string }> = [
  // ── Course-specific matches (checked first, most specific) ──
  {
    keywords: ['alert'],
    src: '/academy/illustrations/trade-management.svg',
  },
  {
    keywords: ['spx', '0dte'],
    src: '/academy/illustrations/exit-discipline.svg',
  },
  {
    keywords: ['leaps', 'long-term positioning'],
    src: '/academy/illustrations/market-context.svg',
  },
  {
    keywords: ['psychology', 'mindset'],
    src: '/academy/illustrations/review-reflection.svg',
  },
  {
    keywords: ['titm', 'methodology'],
    src: '/academy/illustrations/entry-validation.svg',
  },
  {
    keywords: ['greek', 'decoded'],
    src: '/academy/illustrations/options-basics.svg',
  },
  // ── Broader topic matches (fallback for lessons/generic) ──
  {
    keywords: ['risk', 'sizing', 'capital', 'drawdown'],
    src: '/academy/illustrations/risk-sizing.svg',
  },
  {
    keywords: ['option', 'chain', 'premium', 'iv', 'volatility'],
    src: '/academy/illustrations/options-basics.svg',
  },
  {
    keywords: ['context', 'market', 'macro', 'framework'],
    src: '/academy/illustrations/market-context.svg',
  },
  {
    keywords: ['entry', 'setup', 'trigger', 'breakout', 'confirmation'],
    src: '/academy/illustrations/entry-validation.svg',
  },
  {
    keywords: ['manage', 'trade plan', 'adjust', 'active trade'],
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
