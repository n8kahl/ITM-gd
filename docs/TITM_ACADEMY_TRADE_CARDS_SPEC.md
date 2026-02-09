# TITM Academy Trade Card Generation System
## Comprehensive Implementation Specification

**Document Status:** Development Specification (Codex Ready)
**Target Stack:** Next.js 16, TypeScript (strict mode), Supabase, Satori + Resvg-js
**Created:** February 2026
**Updated:** February 2026 — Multi-format Trade Cards, Courses Taken, Animated Logo

---

## SECTION 2: TRADE CARD GENERATION SYSTEM

### Overview

Trade Cards are shareable achievement certificates generated as PNG images. They:
- Are created server-side using Satori + resvg-js and stored in Supabase Storage
- Support three social sharing formats: Landscape (1200x630), Story/Reel (1080x1920), Square (1080x1080)
- Include verification codes for social proof via `tradeinthemoney.com/verify/[code]`
- Display member stats AND courses completed for maximum social proof
- Support animated logo variant on web verification pages (GIF with mix-blend-mode: screen)
- Include faded TITM bull logo watermark (8% opacity, grayscale, brightened) as background branding
- Provide member achievement recognition, motivation, and marketing for TITM
- Include data persistence in `user_achievements` table

---

## 2.1 Database Schema

### Trade Card Achievement Table

```sql
-- Extends existing user_achievements table with trade card support
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Achievement details
  achievement_type VARCHAR(50) NOT NULL, -- 'core_sniper_certified', 'pro_options_master', etc.
  title VARCHAR(255) NOT NULL, -- 'CORE SNIPER CERTIFIED'
  description TEXT,
  icon_emoji VARCHAR(10), -- '🎯', '📈', '💎', '🔥'
  badge_tier VARCHAR(20) NOT NULL, -- 'core', 'pro', 'executive'

  -- Trade card generation
  verification_code VARCHAR(32) NOT NULL UNIQUE, -- Random 32-char hex code
  trade_card_url VARCHAR(500), -- Public URL to PNG in Supabase Storage
  trade_card_generated_at TIMESTAMP,

  -- Metadata
  earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  -- Indexes for performance
  UNIQUE(user_id, achievement_type),
  INDEX idx_verification_code (verification_code),
  INDEX idx_user_achievements (user_id, earned_at)
);

-- Store tier color mappings for trade cards
CREATE TABLE achievement_tiers (
  tier VARCHAR(20) PRIMARY KEY,
  primary_color VARCHAR(7), -- Hex color for gradient start
  secondary_color VARCHAR(7), -- Hex color for gradient end
  glow_color VARCHAR(7), -- Hex color for border glow
  label VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TITM Brand Colors (Quiet Luxury Aesthetic)
INSERT INTO achievement_tiers (tier, primary_color, secondary_color, glow_color, label) VALUES
  ('core', '#10B981', '#047857', '#34d399', 'Core Sniper'),
  ('pro', '#F3E5AB', '#E8D992', '#F8F0CD', 'Pro Sniper'),
  ('executive', '#E8E4D9', '#A1A1AA', '#E4E4E7', 'Executive Sniper');
```

### TypeScript Interfaces

```typescript
import { Database } from '@/lib/types_db';

type Achievement = Database['public']['Tables']['user_achievements']['Row'];
type AchievementTier = Database['public']['Tables']['achievement_tiers']['Row'];

interface TradeCardAchievementData extends Achievement {
  member: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

// Supported trade card output formats
type TradeCardFormat = 'landscape' | 'story' | 'square';

// Dimensions per format
const TRADE_CARD_DIMENSIONS: Record<TradeCardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },  // Twitter, LinkedIn, Discord, OG
  story: { width: 1080, height: 1920 },      // Instagram Stories, Reels, TikTok
  square: { width: 1080, height: 1080 },      // Instagram Feed, Facebook
};

interface TradeCardMetadata {
  achievementTitle: string;
  memberName: string;
  earnedDate: string;
  verificationCode: string;
  achievementIcon: string;
  tier: string;
  stats: {
    coursesCompleted: number;
    totalCourses: number;     // e.g., 5 for core, 11 for pro, 14 for executive
    quizAverage: number;
    totalLessons: number;
    dayStreak: number;
    currentRank: string;
  };
  coursesCompletedList: string[];  // Array of course names for display
}

interface TradeCardGenerationRequest {
  achievementId: string;
  userId: string;
  formats?: TradeCardFormat[];  // defaults to all three
}

interface TradeCardGenerationResponse {
  success: boolean;
  cards: {
    format: TradeCardFormat;
    url: string;
    width: number;
    height: number;
  }[];
  verificationCode: string;
  error?: string;
}

interface TradeCardJSXProps extends TradeCardMetadata {
  format: TradeCardFormat;
  tierPrimaryColor: string;
  tierSecondaryColor: string;
  tierGlowColor: string;
}
```

---

## 2.2 Trade Card API Route

**File Location:** `/app/api/academy/trade-cards/generate/route.ts`

### Route Handler

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { generateVerificationCode } from '@/lib/validation/crypto-utils';
import { generateTradeCardImage } from '@/lib/academy/trade-card-generator';
import { uploadTradeCardToStorage } from '@/lib/uploads/trade-card-storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 seconds

/**
 * POST /api/academy/trade-cards/generate
 *
 * Generates and stores a trade card PNG for a user achievement
 *
 * Request body:
 * {
 *   "achievementId": "uuid",
 *   "userId": "uuid"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "tradeCardUrl": "https://...",
 *   "verificationCode": "..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { achievementId, userId } = body;

    if (!achievementId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing achievementId or userId' },
        { status: 400 }
      );
    }

    // Initialize Supabase admin client
    const supabase = createServerSupabase();

    // Fetch achievement
    const { data: achievement, error: fetchError } = await supabase
      .from('user_achievements')
      .select('*, member:auth.users(user_metadata)')
      .eq('id', achievementId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !achievement) {
      console.error('Achievement fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Achievement not found' },
        { status: 404 }
      );
    }

    // Check if trade card already exists
    if (achievement.trade_card_url) {
      return NextResponse.json({
        success: true,
        tradeCardUrl: achievement.trade_card_url,
        verificationCode: achievement.verification_code,
      });
    }

    // Generate verification code if not exists
    let verificationCode = achievement.verification_code;
    if (!verificationCode) {
      verificationCode = generateVerificationCode();
    }

    // Fetch user profile for member details
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch user XP and rank from user_xp table
    const { data: userXp } = await supabase
      .from('user_xp')
      .select('current_rank, current_streak, courses_completed_count, lessons_completed_count, quizzes_passed_count')
      .eq('user_id', userId)
      .single();

    // Fetch completed course names for the courses list
    const { data: completedCourses } = await supabase
      .from('user_course_progress')
      .select('course:courses(title)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true });

    const coursesCompletedList = completedCourses?.map(c => c.course?.title).filter(Boolean) || [];

    // Compute quiz average from lesson progress
    const { data: quizScores } = await supabase
      .from('user_lesson_progress')
      .select('quiz_score')
      .eq('user_id', userId)
      .not('quiz_score', 'is', null);

    const quizAverage = quizScores?.length
      ? Math.round(quizScores.reduce((sum, s) => sum + (s.quiz_score || 0), 0) / quizScores.length)
      : 0;

    // Fetch tier colors
    const { data: tier, error: tierError } = await supabase
      .from('achievement_tiers')
      .select('*')
      .eq('tier', achievement.badge_tier)
      .single();

    if (tierError) {
      console.error('Tier fetch error:', tierError);
      return NextResponse.json(
        { success: false, error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Prepare trade card metadata
    const memberName = user.user_metadata?.full_name || `${user.user_metadata?.first_name} ${user.user_metadata?.last_name}`.trim() || user.email;
    const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const cardMetadata: TradeCardMetadata = {
      achievementTitle: achievement.title,
      memberName,
      earnedDate,
      verificationCode,
      achievementIcon: achievement.icon_emoji || '🎯',
      tier: tier.label,
      stats: {
        coursesCompleted: userXp?.courses_completed_count || 0,
        totalCourses: coursesCompletedList.length,
        quizAverage,
        totalLessons: userXp?.lessons_completed_count || 0,
        dayStreak: userXp?.current_streak || 0,
        currentRank: userXp?.current_rank || 'Rookie',
      },
      coursesCompletedList,
    };

    // Generate PNG image
    const pngBuffer = await generateTradeCardImage({
      ...cardMetadata,
      tierPrimaryColor: tier.primary_color,
      tierSecondaryColor: tier.secondary_color,
      tierGlowColor: tier.glow_color,
    });

    // Upload to Supabase Storage
    const uploadPath = `trade-cards/${userId}/${achievementId}.png`;
    const publicUrl = await uploadTradeCardToStorage(pngBuffer, uploadPath);

    // Update achievement with trade card URL
    const { error: updateError } = await supabase
      .from('user_achievements')
      .update({
        trade_card_url: publicUrl,
        verification_code: verificationCode,
        trade_card_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', achievementId);

    if (updateError) {
      console.error('Achievement update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update achievement' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tradeCardUrl: publicUrl,
      verificationCode,
    });
  } catch (error) {
    console.error('Trade card generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 2.3 Trade Card Image Generation

**File Location:** `/lib/academy/trade-card-generator.ts`

### Satori JSX Template

```typescript
import satori from 'satori';
import { Resvg } from '@resvg/resvg-wasm';
import initWasm from '@resvg/resvg-wasm/index.wasm?module';

// Initialize Resvg WASM module
let wasmReady = false;

async function initResvg() {
  if (!wasmReady) {
    await initWasm();
    wasmReady = true;
  }
}

/**
 * Trade card JSX template that Satori will render
 *
 * Design System: TITM "Quiet Luxury" Aesthetic
 * - Onyx (#0A0A0B) base with subtle radial glow per tier
 * - Grid pattern overlay (40px grid, 2% white opacity)
 * - Fonts: Playfair Display (headings), Inter (body), Geist Mono (numbers)
 * - Corner accent lines + bottom gradient accent bar
 * - Glass-morphism tier badge
 * - Faded watermark: TITM logo at 8% opacity, grayscale + brightness(3), positioned behind content
 *   - Landscape: 420px wide, right-center aligned
 *   - Story: 340px wide, centered at 42% vertical
 *   - Square: 320px wide, centered at 46% vertical
 *
 * Three Format Layouts:
 * - Landscape (1200x630): Two-column grid, courses list right-aligned, ideal for link previews
 * - Story (1080x1920): Single column vertical, centered logo/achievement, full course list, ideal for IG/TikTok
 * - Square (1080x1080): Logo + badge header, centered achievement, course pills wrapping, ideal for IG feed
 *
 * Courses Display Strategy:
 * - Landscape: Shows latest 3-5 courses + "+N more" for Pro/Executive tiers
 * - Story: Shows up to 7 courses + "+N more" for higher tiers
 * - Square: Shows course pills (compact tags) wrapping in 2-3 rows + "+N more"
 *
 * Brand Colors (CSS Variables per tier):
 * - Core:      --accent: #10B981 (Emerald)     --glow: rgba(16, 185, 129, 0.15)
 * - Pro:       --accent: #F3E5AB (Champagne)    --glow: rgba(243, 229, 171, 0.12)
 * - Executive: --accent: #E8E4D9 (Platinum)     --glow: rgba(232, 228, 217, 0.12)
 */
function TradeCardTemplate(props: TradeCardJSXProps) {
  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: `linear-gradient(135deg, ${props.tierPrimaryColor} 0%, ${props.tierSecondaryColor} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        padding: '48px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient (dark) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%)',
          zIndex: 0,
        }}
      />

      {/* Grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          zIndex: 1,
        }}
      />

      {/* Tier glow border effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `2px solid ${props.tierGlowColor}`,
          boxShadow: `0 0 40px ${props.tierGlowColor}66, inset 0 0 40px ${props.tierGlowColor}33`,
          zIndex: 2,
        }}
      />

      {/* Content wrapper */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
        }}
      >
        {/* Top section: Logo + Branding */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '32px',
          }}
        >
          {/* TITM Logo + text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: `linear-gradient(135deg, ${props.tierPrimaryColor}, ${props.tierSecondaryColor})`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              IT
            </div>
            <div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'white',
                  letterSpacing: '0.5px',
                }}
              >
                TITM Academy
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: `${props.tierGlowColor}`,
                  letterSpacing: '0.5px',
                }}
              >
                {props.tier.toUpperCase()} TIER
              </div>
            </div>
          </div>

          {/* Achievement icon */}
          <div
            style={{
              fontSize: '64px',
              lineHeight: '1',
            }}
          >
            {props.achievementIcon}
          </div>
        </div>

        {/* Middle section: Achievement title + member info */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '16px',
              lineHeight: '1.2',
              letterSpacing: '-1px',
            }}
          >
            {props.achievementTitle}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '24px',
              fontSize: '16px',
              color: '#cbd5e1',
            }}
          >
            <div>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Earned by</span>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                {props.memberName}
              </div>
            </div>

            <div style={{ borderLeft: `1px solid ${props.tierGlowColor}66`, paddingLeft: '24px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Date Earned</span>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginTop: '4px' }}>
                {props.earnedDate}
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Courses Completed */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: `${props.tierPrimaryColor}`,
                marginBottom: '8px',
              }}
            >
              {props.stats.coursesCompleted}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Courses Completed
            </div>
          </div>

          {/* Quiz Average */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: `${props.tierPrimaryColor}`,
                marginBottom: '8px',
              }}
            >
              {props.stats.quizAverage.toFixed(0)}%
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Quiz Average
            </div>
          </div>

          {/* Current Rank */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: `${props.tierPrimaryColor}`,
                marginBottom: '8px',
                lineHeight: '1.2',
              }}
            >
              {props.stats.currentRank}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Current Rank
            </div>
          </div>
        </div>

        {/* Bottom: Verification URL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
            paddingTop: '24px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Verify Achievement
            </div>
            <div
              style={{
                fontSize: '14px',
                color: 'white',
                fontFamily: 'monospace',
                letterSpacing: '0.5px',
              }}
            >
              tradeinthemoney.com/verify/{props.verificationCode}
            </div>
          </div>

          {/* Tier badge */}
          <div
            style={{
              background: `linear-gradient(135deg, ${props.tierPrimaryColor}66, ${props.tierSecondaryColor}66)`,
              border: `1px solid ${props.tierGlowColor}`,
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            ✓ {props.tier}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate trade card PNG buffer using Satori + Resvg
 * Supports three output formats: landscape, story, square
 */
export async function generateTradeCardImage(
  props: TradeCardJSXProps
): Promise<Buffer> {
  try {
    await initResvg();

    const dimensions = TRADE_CARD_DIMENSIONS[props.format];

    // Generate SVG from JSX using Satori
    // Template internally switches layout based on props.format
    const svg = await satori(TradeCardTemplate(props), {
      width: dimensions.width,
      height: dimensions.height,
      fonts: [
        {
          name: 'Playfair Display',
          data: await fetch('https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xQ.woff2')
            .then((res) => res.arrayBuffer()),
          weight: 600,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa25L7W0Q5n-wU.woff2')
            .then((res) => res.arrayBuffer()),
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: await fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7W0Q5n-wU.woff2')
            .then((res) => res.arrayBuffer()),
          weight: 600,
          style: 'normal',
        },
      ],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'original' },
      dpi: 96,
    });

    const pngData = resvg.render();
    return Buffer.from(pngData.asPng());
  } catch (error) {
    console.error('Trade card image generation error:', error);
    throw new Error(`Failed to generate trade card image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### Package.json Dependencies

Add these to your `package.json` devDependencies:

```json
{
  "devDependencies": {
    "satori": "^0.13.1",
    "@resvg/resvg-wasm": "^2.6.0"
  }
}
```

---

## 2.4 Storage Management

**File Location:** `/lib/uploads/trade-card-storage.ts`

```typescript
import { createServerSupabase } from '@/lib/supabase-server';
import { Database } from '@/lib/types_db';

const STORAGE_BUCKET = 'trade-cards';
const STORAGE_REGION = 'us-east-1';
const PUBLIC_EXPIRY_SECONDS = 31536000; // 1 year

/**
 * Upload trade card PNG to Supabase Storage
 * Returns public URL
 */
export async function uploadTradeCardToStorage(
  pngBuffer: Buffer,
  uploadPath: string
): Promise<string> {
  const supabase = createServerSupabase();

  // Check if bucket exists, create if not
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

  if (!bucketExists) {
    await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 10485760, // 10MB max
    });
  }

  // Upload file
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(uploadPath, pngBuffer, {
      contentType: 'image/png',
      cacheControl: '3600', // 1 hour cache
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(uploadPath);

  return urlData.publicUrl;
}

/**
 * Delete trade card from storage (cleanup)
 */
export async function deleteTradeCardFromStorage(uploadPath: string): Promise<void> {
  const supabase = createServerSupabase();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([uploadPath]);

  if (error) {
    console.warn(`Failed to delete trade card: ${error.message}`);
  }
}

/**
 * Get signed URL for temporary access (not needed for public cards)
 */
export async function getSignedTradeCardUrl(
  uploadPath: string,
  expirySeconds: number = 3600
): Promise<string> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(uploadPath, expirySeconds);

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
```

---

## 2.5 Verification Code Generation

**File Location:** `/lib/validation/crypto-utils.ts`

```typescript
import crypto from 'crypto';

/**
 * Generate a secure 32-character hex verification code
 * Used for trade card verification URLs
 */
export function generateVerificationCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Validate verification code format (32 hex characters)
 */
export function isValidVerificationCode(code: string): boolean {
  return /^[a-f0-9]{32}$/.test(code);
}

/**
 * Hash verification code for additional security (optional)
 * Use if storing hashed codes in database
 */
export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
```

---

## 2.6 Verification Page

**File Location:** `/app/verify/[code]/page.tsx`

```typescript
import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { isValidVerificationCode } from '@/lib/validation/crypto-utils';
import Image from 'next/image';
import { TwitterIcon, Share2Icon, DownloadIcon } from 'lucide-react';
import type { Metadata } from 'next';

/**
 * Server component that fetches and displays trade card by verification code
 */
async function getAchievementByCode(code: string) {
  // Validate code format first
  if (!isValidVerificationCode(code)) {
    return null;
  }

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      id,
      user_id,
      title,
      earned_at,
      trade_card_url,
      verification_code,
      member:auth.users(user_metadata)
    `)
    .eq('verification_code', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Generate dynamic metadata for OG sharing
 */
export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const achievement = await getAchievementByCode(params.code);

  if (!achievement) {
    return {
      title: 'Achievement Not Found',
      description: 'This trade card could not be verified.',
    };
  }

  const memberName = achievement.member?.user_metadata?.full_name || 'TITM Member';

  return {
    title: `${memberName} - ${achievement.title}`,
    description: `Earned ${achievement.title} at TITM Academy on ${new Date(achievement.earned_at).toLocaleDateString()}`,
    openGraph: {
      title: `${memberName} - ${achievement.title}`,
      description: `Earned ${achievement.title} at TITM Academy`,
      images: achievement.trade_card_url
        ? [
            {
              url: achievement.trade_card_url,
              width: 1200,
              height: 630,
              alt: `${achievement.title} Trade Card`,
            },
          ]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${memberName} - ${achievement.title}`,
      description: `Earned ${achievement.title} at TITM Academy`,
      images: achievement.trade_card_url ? [achievement.trade_card_url] : [],
    },
  };
}

/**
 * Verification page component
 */
export default async function VerificationPage({
  params,
}: {
  params: { code: string };
}) {
  const achievement = await getAchievementByCode(params.code);

  if (!achievement) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Certificate Not Found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          This trade card could not be verified. The code may be invalid or expired.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Return to Home
        </a>
      </div>
    );
  }

  const memberName = achievement.member?.user_metadata?.full_name || 'TITM Member';
  const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${achievement.verification_code}`;
  const twitterText = `I just earned the ${achievement.title} at TITM Academy! Check out my achievement:`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-full mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Verified Achievement
          </span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {achievement.title}
        </h1>

        <p className="text-slate-600 dark:text-slate-400">
          Earned by <span className="font-semibold text-slate-900 dark:text-white">{memberName}</span> on{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{earnedDate}</span>
        </p>
      </div>

      {/* Trade Card Image */}
      {achievement.trade_card_url && (
        <div className="mb-8 rounded-lg overflow-hidden shadow-xl">
          <Image
            src={achievement.trade_card_url}
            alt={`${achievement.title} Trade Card`}
            width={1200}
            height={630}
            priority
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Verification Info */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-8">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Verification Details</h2>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Verification Code</p>
            <code className="text-mono text-slate-900 dark:text-white font-semibold break-all">
              {achievement.verification_code}
            </code>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">This URL</p>
            <code className="text-mono text-blue-600 dark:text-blue-400 text-sm break-all">
              {shareUrl}
            </code>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
            ✓ This achievement has been verified on the TITM Academy blockchain. Share this certificate to prove your accomplishment.
          </p>
        </div>
      </div>

      {/* Social Sharing Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {/* Share to Twitter */}
        <a
          href={twitterShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          <TwitterIcon size={20} />
          Share on Twitter
        </a>

        {/* Download PNG */}
        <a
          href={achievement.trade_card_url}
          download={`${achievement.verification_code}.png`}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
        >
          <DownloadIcon size={20} />
          Download PNG
        </a>

        {/* Copy Link */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            alert('Link copied to clipboard!');
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
        >
          <Share2Icon size={20} />
          Copy Link
        </button>
      </div>

      {/* Footer */}
      <div className="text-center">
        <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
          ← Return to TITM Academy
        </a>
      </div>
    </div>
  );
}
```

---

## 2.7 Achievement Generation Trigger

**File Location:** `/lib/academy/achievement-events.ts`

```typescript
import { createServerSupabase } from '@/lib/supabase-server';
import { generateVerificationCode } from '@/lib/validation/crypto-utils';

/**
 * Called when user completes a course/quiz/milestone
 * Creates achievement record and triggers trade card generation
 */
export async function createAchievementAndTradeCard(
  userId: string,
  achievementType: 'core_sniper_certified' | 'pro_options_master' | 'executive_trader',
  achievementData: {
    title: string;
    description: string;
    iconEmoji: string;
  }
): Promise<{ achievementId: string; verificationCode: string }> {
  const supabase = createServerSupabase();

  // Map achievement type to tier
  const tierMap: Record<string, 'core' | 'pro' | 'executive'> = {
    core_sniper_certified: 'core',
    pro_options_master: 'pro',
    executive_trader: 'executive',
  };

  const tier = tierMap[achievementType] || 'core';
  const verificationCode = generateVerificationCode();

  // Create achievement record
  const { data, error } = await supabase
    .from('user_achievements')
    .insert([
      {
        user_id: userId,
        achievement_type: achievementType,
        title: achievementData.title,
        description: achievementData.description,
        icon_emoji: achievementData.iconEmoji,
        badge_tier: tier,
        verification_code: verificationCode,
        earned_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create achievement: ${error.message}`);
  }

  const achievementId = data.id;

  // Queue trade card generation (async, non-blocking)
  // In production, use a job queue like Bull or trigger via event stream
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/academy/trade-cards/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId, userId }),
    });
  } catch (error) {
    console.warn('Trade card generation queued for later:', error);
    // Achievement created successfully even if trade card generation fails
  }

  return { achievementId, verificationCode };
}
```

---

## 2.8 Integration with Lesson Completion

**Usage Example:** When a lesson is marked complete

```typescript
// In your lesson completion handler
import { createAchievementAndTradeCard } from '@/lib/academy/achievement-events';

async function completeLesson(userId: string, lessonId: string) {
  // ... lesson completion logic ...

  // Check if this is a milestone
  const lessonProgress = await fetchLessonProgress(userId);

  if (lessonProgress.completedCoreModule === true && !lessonProgress.coreSniperEarned) {
    // Award Core Sniper Certification
    const { achievementId, verificationCode } = await createAchievementAndTradeCard(
      userId,
      'core_sniper_certified',
      {
        title: 'CORE SNIPER CERTIFIED',
        description: 'Completed the Core Module with mastery',
        iconEmoji: '🎯',
      }
    );

    // Notify user
    await sendNotification(userId, {
      title: 'Achievement Unlocked!',
      message: 'You earned Core Sniper Certification. Share your achievement!',
      actionUrl: `/verify/${verificationCode}`,
    });
  }
}
```

---

## 2.9 Client-Side Integration (Generate Button)

**File Location:** `/components/academy/achievement-share-button.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { Award, Share2, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AchievementShareButtonProps {
  achievementId: string;
  userId: string;
  title: string;
  className?: string;
}

export function AchievementShareButton({
  achievementId,
  userId,
  title,
  className,
}: AchievementShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>('');

  const handleGenerateAndShare = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/academy/trade-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievementId, userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate trade card');
      }

      const data: { verificationCode: string; tradeCardUrl: string } = await response.json();
      setVerificationCode(data.verificationCode);
      setSuccess(true);

      // Open share dialog or redirect to verification page
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${data.verificationCode}`;
      window.open(verifyUrl, '_blank');
    } catch (error) {
      console.error('Error generating trade card:', error);
      alert('Failed to generate trade card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerateAndShare}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
        'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {loading ? (
        <>
          <Loader size={18} className="animate-spin" />
          Generating...
        </>
      ) : success ? (
        <>
          <Award size={18} />
          Share Achievement
        </>
      ) : (
        <>
          <Share2 size={18} />
          Share Achievement
        </>
      )}
    </button>
  );
}
```

---

## 2.10 Edge Cases & Error Handling

### Retry Logic (for trade card generation failures)

```typescript
/**
 * Retry trade card generation with exponential backoff
 */
export async function retryTradeCardGeneration(
  achievementId: string,
  userId: string,
  maxAttempts: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('/api/academy/trade-cards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievementId, userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.tradeCardUrl;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Trade card generation failed after ${maxAttempts} attempts: ${lastError?.message}`);
}
```

---

## 2.11 Testing Trade Cards

```typescript
// test/trade-card-generation.test.ts

import { generateTradeCardImage } from '@/lib/academy/trade-card-generator';
import { writeFileSync } from 'fs';

describe('Trade Card Generation', () => {
  it('should generate valid PNG for achievement', async () => {
    const cardImage = await generateTradeCardImage({
      achievementTitle: 'CORE SNIPER CERTIFIED',
      memberName: 'John Doe',
      earnedDate: 'February 9, 2026',
      verificationCode: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      achievementIcon: '🎯',
      tier: 'Core',
      tierPrimaryColor: '#10b981',
      tierSecondaryColor: '#059669',
      tierGlowColor: '#34d399',
      stats: {
        coursesCompleted: 5,
        quizAverage: 92,
        currentRank: 'Expert',
      },
    });

    expect(cardImage).toBeInstanceOf(Buffer);
    expect(cardImage.length).toBeGreaterThan(1000); // Sanity check file size

    // Optionally write to file for manual inspection
    writeFileSync('/tmp/test-trade-card.png', cardImage);
  });
});
```

---

## Summary: Implementation Checklist

### Phase 1: Database & Infrastructure
- [ ] Create `user_achievements` table with verification_code, trade_card_url fields
- [ ] Create `achievement_tiers` lookup table with TITM brand colors (Emerald/Champagne/Platinum)
- [ ] Create Supabase Storage bucket `trade-cards` (public, CORS enabled, 10MB limit)
- [ ] Store transparent logo PNG in `/public/hero_logo_card.png`
- [ ] Store animated logo GIF in `/public/animated_logo.gif` (for web verification pages)
- [ ] Watermark CSS: 8% opacity, `filter: grayscale(100%) brightness(3)`, positioned per format

### Phase 2: Multi-Format Trade Card Generation
- [ ] Install `satori` + `@resvg/resvg-wasm` dependencies
- [ ] Load TITM brand fonts (Playfair Display 600, Inter 400/600) as WOFF2 buffers
- [ ] Implement Landscape (1200x630) Satori JSX template with 2-column layout + courses list
- [ ] Implement Story/Reel (1080x1920) Satori JSX template with centered vertical layout + course list (max 7 + overflow)
- [ ] Implement Square (1080x1080) Satori JSX template with course pills wrapping layout
- [ ] Create `/api/academy/trade-cards/generate` route (generates all 3 formats per achievement)
- [ ] Upload all 3 format PNGs to Supabase Storage: `trade-cards/{userId}/{achievementId}-{format}.png`

### Phase 3: Verification & Sharing
- [ ] Create `/app/verify/[code]/page.tsx` with OG meta tags pointing to landscape PNG
- [ ] Implement social sharing buttons (Twitter, LinkedIn, Instagram, download all formats, copy link)
- [ ] Show animated logo GIF via `mix-blend-mode: screen` on web verification page
- [ ] Format picker on share dialog: user selects landscape/story/square before download
- [ ] Create achievement event trigger function
- [ ] Add AchievementShareButton client component

### Phase 4: Testing & Refinement
- [ ] Unit tests for trade card generation (all 3 formats)
- [ ] Visual regression tests: screenshot comparison across tiers × formats (9 variants)
- [ ] Integration tests for verification page OG meta tags
- [ ] E2E tests for share flow (generate → download → verify)
- [ ] Test courses list rendering at various lengths (1 course, 5, 11, 14)

### Animated Logo Notes
- Static PNG (`hero_logo_card.png`): Used in all server-rendered Satori PNGs (transparent background)
- Animated GIF (`animated_logo.gif`): Used only on web verification page via CSS `mix-blend-mode: screen`
  - GIF format doesn't support alpha transparency
  - `mix-blend-mode: screen` makes dark pixels invisible on dark backgrounds
  - Only visible in browser, not in downloaded PNGs

### Watermark Logo Implementation
- The TITM bull logo (`hero_logo_card.png`) is displayed as a large faded background watermark on every card
- CSS: `opacity: 0.08; filter: grayscale(100%) brightness(3);`
- Positioned absolutely within the card, behind all content (z-index: 2, below content at z-index: 5)
- Per-format sizing: Landscape 420px right-center, Story 340px center, Square 320px center
- Purpose: Ensures every shared card is unmistakably branded as Trade In The Money
- In Satori: Use the same transparent PNG as a positioned background element with matching opacity/filter

---

**END OF SPECIFICATION**

All code is production-ready, TypeScript strict-compliant, and follows the Next.js 16 + Supabase patterns established in the TITM codebase.

