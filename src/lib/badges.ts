import { supabase } from '@/lib/supabase'

type BadgeCode =
  | 'bench_pr'
  | 'squat_pr'
  | 'deadlift_pr'
  | 'hang_clean_pr'
  | 'first_pr'
  | 'three_prs'
  | 'five_prs'
  | 'perfect_week'
  | 'four_week_perfect'
  | 'attendance_dog'

export async function awardBadgeToAthlete(athleteId: string, badgeCode: BadgeCode, notes?: string) {
  const { data: badge, error: badgeError } = await supabase
    .from('badges')
    .select('id')
    .eq('code', badgeCode)
    .single()

  if (badgeError || !badge) {
    throw new Error(badgeError?.message || `Badge not found: ${badgeCode}`)
  }

  const { error } = await supabase.from('player_badges').upsert(
    [
      {
        athlete_id: athleteId,
        badge_id: badge.id,
        notes: notes || null,
      },
    ],
    {
      onConflict: 'athlete_id,badge_id',
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export function getPrBadgeCode(liftName: string): BadgeCode | null {
  const normalized = liftName.trim().toLowerCase()

  if (normalized === 'bench press') return 'bench_pr'
  if (normalized === 'back squat') return 'squat_pr'
  if (normalized === 'deadlift') return 'deadlift_pr'
  if (normalized === 'hang clean') return 'hang_clean_pr'

  return null
}

export async function awardPrMilestones(athleteId: string) {
  const { data, error } = await supabase
    .from('player_badges')
    .select('id, badges!inner(code)')
    .eq('athlete_id', athleteId)
    .in('badges.code', ['bench_pr', 'squat_pr', 'deadlift_pr', 'hang_clean_pr'])

  if (error) throw new Error(error.message)

  const prCount = data?.length || 0

  if (prCount >= 1) {
    await awardBadgeToAthlete(athleteId, 'first_pr')
  }
  if (prCount >= 3) {
    await awardBadgeToAthlete(athleteId, 'three_prs')
  }
  if (prCount >= 5) {
    await awardBadgeToAthlete(athleteId, 'five_prs')
  }
}