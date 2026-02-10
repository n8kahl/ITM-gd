import type {
  TradeCardMetadata,
  TradeCardFormat,
  TRADE_CARD_DIMENSIONS,
} from '@/lib/types/academy'

// Re-export the dimensions constant for convenience
export { TRADE_CARD_DIMENSIONS } from '@/lib/types/academy'

// ---------------------------------------------------------------------------
// Tier color palette
// ---------------------------------------------------------------------------
export interface TierColors {
  primary: string
  glow: string
  glowRgba: string
  badge: string
  badgeText: string
}

export const TIER_COLOR_MAP: Record<string, TierColors> = {
  core: {
    primary: '#10B981',
    glow: '#10B981',
    glowRgba: 'rgba(16, 185, 129, 0.35)',
    badge: '#065F46',
    badgeText: '#6EE7B7',
  },
  pro: {
    primary: '#3B82F6',
    glow: '#3B82F6',
    glowRgba: 'rgba(59, 130, 246, 0.35)',
    badge: '#1E3A5F',
    badgeText: '#93C5FD',
  },
  executive: {
    primary: '#F3E5AB',
    glow: '#F3E5AB',
    glowRgba: 'rgba(243, 229, 171, 0.30)',
    badge: '#4A3F2B',
    badgeText: '#F3E5AB',
  },
}

// ---------------------------------------------------------------------------
// Achievement icon map (Lucide icon names -> unicode-safe labels)
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, string> = {
  trophy: '\u{1F3C6}',
  award: '\u{1F3C5}',
  star: '\u2B50',
  zap: '\u26A1',
  target: '\u{1F3AF}',
  flame: '\u{1F525}',
  crown: '\u{1F451}',
  rocket: '\u{1F680}',
  graduation: '\u{1F393}',
  shield: '\u{1F6E1}',
  default: '\u{1F3C6}',
}

function getIconEmoji(iconName: string): string {
  return ICON_MAP[iconName] || ICON_MAP.default
}

// ---------------------------------------------------------------------------
// Font loader - fetches Inter from Google Fonts CDN
// ---------------------------------------------------------------------------
let fontCache: ArrayBuffer | null = null

async function loadInterFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache
  const res = await fetch(
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  )
  const css = await res.text()
  const fontUrlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
  if (!fontUrlMatch?.[1]) {
    throw new Error('Could not extract Inter font URL from Google Fonts CSS')
  }
  const fontRes = await fetch(fontUrlMatch[1])
  fontCache = await fontRes.arrayBuffer()
  return fontCache
}

// ---------------------------------------------------------------------------
// Dimensions helper
// ---------------------------------------------------------------------------
const DIMENSIONS: Record<TradeCardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

// ---------------------------------------------------------------------------
// Satori JSX template builder
// ---------------------------------------------------------------------------

function buildTradeCardJsx(
  meta: TradeCardMetadata,
  tierColors: TierColors,
  format: TradeCardFormat
) {
  const { width, height } = DIMENSIONS[format]
  const isLandscape = format === 'landscape'
  const isStory = format === 'story'
  const isSquare = format === 'square'
  const icon = getIconEmoji(meta.achievementIcon)

  // Responsive font sizes
  const titleSize = isLandscape ? 36 : isStory ? 44 : 40
  const nameSize = isLandscape ? 18 : 22
  const labelSize = isLandscape ? 12 : 14
  const statValueSize = isLandscape ? 22 : 26
  const statLabelSize = isLandscape ? 11 : 13
  const verifySize = isLandscape ? 10 : 12
  const maxCourses = isLandscape ? 5 : isStory ? 7 : 4

  const coursesToShow = meta.coursesCompletedList.slice(0, maxCourses)

  // Verification URL
  const verifyUrl = `tradeitm.com/verify/${meta.verificationCode}`

  // --- Build the JSX tree (Satori-compatible plain objects) ---
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width,
        height,
        backgroundColor: '#0A0A0B',
        fontFamily: 'Inter',
        color: '#F5F5F0',
        position: 'relative' as const,
        overflow: 'hidden',
      },
      children: [
        // --- Radial glow background ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `radial-gradient(ellipse at 50% 0%, ${tierColors.glowRgba} 0%, transparent 60%)`,
            },
          },
        },
        // --- Grid pattern overlay ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            },
          },
        },
        // --- Tier-colored glow border (top) ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${tierColors.primary}, transparent)`,
            },
          },
        },
        // --- Content container ---
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              flex: 1,
              padding: isLandscape ? '32px 40px' : '40px 36px',
              position: 'relative' as const,
              zIndex: 1,
              justifyContent: 'space-between',
            },
            children: [
              // --- TOP: Branding + Tier label ---
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isLandscape ? 16 : 24,
                  },
                  children: [
                    // TITM branding
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: 16,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: tierColors.primary,
                              },
                              children: 'TITM ACADEMY',
                            },
                          },
                        ],
                      },
                    },
                    // Tier label + icon
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: { fontSize: 20 },
                              children: icon,
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: labelSize,
                                fontWeight: 600,
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.1em',
                                color: tierColors.badgeText,
                                background: tierColors.badge,
                                padding: '4px 12px',
                                borderRadius: 6,
                              },
                              children: `${meta.tier.toUpperCase()} TIER`,
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },

              // --- MIDDLE: Achievement title + member info ---
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column' as const,
                    gap: isLandscape ? 8 : 16,
                    marginBottom: isLandscape ? 16 : 24,
                  },
                  children: [
                    // Achievement title
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: titleSize,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          letterSpacing: '-0.02em',
                          color: '#F5F5F0',
                        },
                        children: meta.achievementTitle,
                      },
                    },
                    // Member name + earned date
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: nameSize,
                                fontWeight: 500,
                                color: 'rgba(245, 245, 240, 0.9)',
                              },
                              children: meta.memberName,
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(255,255,255,0.3)',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: nameSize - 2,
                                color: 'rgba(245, 245, 240, 0.6)',
                              },
                              children: `Earned ${meta.earnedDate}`,
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },

              // --- STATS GRID ---
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: isLandscape ? 24 : 20,
                    marginBottom: isLandscape ? 16 : 24,
                    flexWrap: 'wrap' as const,
                  },
                  children: [
                    buildStatBox('Courses Completed', `${meta.stats.coursesCompleted}/${meta.stats.totalCourses}`, tierColors, statValueSize, statLabelSize),
                    buildStatBox('Quiz Average', `${meta.stats.quizAverage}%`, tierColors, statValueSize, statLabelSize),
                    buildStatBox('Current Rank', meta.stats.currentRank, tierColors, statValueSize, statLabelSize),
                  ],
                },
              },

              // --- COURSES COMPLETED LIST ---
              ...(coursesToShow.length > 0
                ? [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column' as const,
                          gap: 6,
                          marginBottom: isLandscape ? 12 : 20,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: statLabelSize,
                                fontWeight: 600,
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.08em',
                                color: 'rgba(245, 245, 240, 0.5)',
                                marginBottom: 4,
                              },
                              children: 'Courses Completed',
                            },
                          },
                          ...(isSquare
                            ? [
                                // Square: pill layout
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      flexWrap: 'wrap' as const,
                                      gap: 8,
                                    },
                                    children: coursesToShow.map((course: string) => ({
                                      type: 'div',
                                      props: {
                                        style: {
                                          fontSize: 12,
                                          color: tierColors.badgeText,
                                          background: 'rgba(255,255,255,0.06)',
                                          border: `1px solid rgba(255,255,255,0.1)`,
                                          borderRadius: 20,
                                          padding: '4px 12px',
                                        },
                                        children: course,
                                      },
                                    })),
                                  },
                                },
                              ]
                            : coursesToShow.map((course: string) => ({
                                type: 'div',
                                props: {
                                  style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  },
                                  children: [
                                    {
                                      type: 'div',
                                      props: {
                                        style: {
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          backgroundColor: tierColors.primary,
                                          flexShrink: 0,
                                        },
                                      },
                                    },
                                    {
                                      type: 'div',
                                      props: {
                                        style: {
                                          fontSize: isLandscape ? 13 : 15,
                                          color: 'rgba(245, 245, 240, 0.75)',
                                        },
                                        children: course,
                                      },
                                    },
                                  ],
                                },
                              }))),
                        ],
                      },
                    },
                  ]
                : []),

              // --- BOTTOM: Verification URL + tier badge ---
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: isLandscape ? 12 : 16,
                    marginTop: 'auto',
                  },
                  children: [
                    // Verification URL (monospace)
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: verifySize,
                          fontFamily: 'monospace',
                          color: 'rgba(245, 245, 240, 0.4)',
                          letterSpacing: '0.02em',
                        },
                        children: verifyUrl,
                      },
                    },
                    // Tier badge pill
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: verifySize,
                          fontWeight: 600,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.1em',
                          color: tierColors.badgeText,
                          background: tierColors.badge,
                          padding: '4px 14px',
                          borderRadius: 20,
                          border: `1px solid ${tierColors.primary}33`,
                        },
                        children: `${meta.tier.toUpperCase()} VERIFIED`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },

        // --- Tier-colored glow border (bottom) ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${tierColors.primary}, transparent)`,
            },
          },
        },

        // --- Left glow border ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, transparent, ${tierColors.primary}66, transparent)`,
            },
          },
        },

        // --- Right glow border ---
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute' as const,
              top: 0,
              right: 0,
              bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, transparent, ${tierColors.primary}66, transparent)`,
            },
          },
        },
      ],
    },
  }
}

function buildStatBox(
  label: string,
  value: string,
  tierColors: TierColors,
  valueSize: number,
  labelSize: number
) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '12px 20px',
        minWidth: 140,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: labelSize,
              fontWeight: 500,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              color: 'rgba(245, 245, 240, 0.5)',
              marginBottom: 4,
            },
            children: label,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: valueSize,
              fontWeight: 700,
              color: tierColors.primary,
              letterSpacing: '-0.01em',
            },
            children: value,
          },
        },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// PNG generation pipeline: Satori (JSX -> SVG) + Resvg (SVG -> PNG)
// ---------------------------------------------------------------------------

export async function generateTradeCardPNG(
  metadata: TradeCardMetadata,
  tierColors: TierColors,
  format: TradeCardFormat
): Promise<Buffer> {
  let satori: typeof import('satori').default
  let Resvg: typeof import('@resvg/resvg-js').Resvg

  try {
    const satoriModule = await import('satori')
    satori = satoriModule.default
  } catch {
    throw new Error(
      'satori is not installed. Run: npm install satori'
    )
  }

  try {
    const resvgModule = await import('@resvg/resvg-js')
    Resvg = resvgModule.Resvg
  } catch {
    throw new Error(
      '@resvg/resvg-js is not installed. Run: npm install @resvg/resvg-js'
    )
  }

  const { width, height } = DIMENSIONS[format]
  const fontData = await loadInterFont()

  const jsxTree = buildTradeCardJsx(metadata, tierColors, format)

  const svg = await satori(jsxTree as any, {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: fontData,
        weight: 400,
        style: 'normal' as const,
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width },
  })

  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}

// ---------------------------------------------------------------------------
// Generate all 3 formats at once
// ---------------------------------------------------------------------------

export async function generateAllTradeCards(
  metadata: TradeCardMetadata,
  tierColors: TierColors
): Promise<{ format: TradeCardFormat; buffer: Buffer }[]> {
  const formats: TradeCardFormat[] = ['landscape', 'story', 'square']

  const results = await Promise.all(
    formats.map(async (format) => {
      const buffer = await generateTradeCardPNG(metadata, tierColors, format)
      return { format, buffer }
    })
  )

  return results
}
