import { createClient } from '@supabase/supabase-js'
import { generateVerificationCode } from '@/lib/validation/crypto-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createAchievement(
  userId: string,
  achievementType: string,
  achievementKey: string,
  data: {
    title?: string
    description?: string
    xpEarned?: number
  }
): Promise<{ id: string; verificationCode: string } | null> {
  const supabase = getSupabaseAdmin()
  const verificationCode = generateVerificationCode()

  const { data: achievement, error } = await supabase
    .from('user_achievements')
    .upsert({
      user_id: userId,
      achievement_type: achievementType,
      achievement_key: achievementKey,
      achievement_data: data,
      xp_earned: data.xpEarned || 0,
      verification_code: verificationCode,
      earned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,achievement_key' })
    .select('id, verification_code')
    .single()

  if (error) {
    console.error('Failed to create achievement:', error)
    return null
  }

  return { id: achievement.id, verificationCode: achievement.verification_code }
}
