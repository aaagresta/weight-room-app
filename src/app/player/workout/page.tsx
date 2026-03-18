'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

type WorkoutSet = {
  setNumber: number
  targetReps: number
  percent: number | null
  useMax: boolean
  maxLift: string | null
}

type WorkoutExercise = {
  name: string
  sets: WorkoutSet[]
}

type DailyWorkout = {
  id: string
  workout_date: string
  team_level: string
  title: string
  workout_data: {
    exercises: WorkoutExercise[]
  }
}

type PlayerWorkoutLog = {
  id: string
  athlete_id: string
  workout_id: string | null
  workout_date: string
  exercise: string
  set_number: number
  target_reps: number | null
  reps_completed: number | null
  weight: number | null
  notes: string | null
}

type PlayerLiftMax = {
  id: string
  athlete_id: string
  lift_name: string
  max_weight: number
  estimated_one_rm: number | null
  tested_on: string | null
  notes: string | null
}

export default function PlayerWorkoutPage() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [workout, setWorkout] = useState<DailyWorkout | null>(null)
  const [logs, setLogs] = useState<PlayerWorkoutLog[]>([])
  const [maxes, setMaxes] = useState<PlayerLiftMax[]>([])

  const [formState, setFormState] = useState<
    Record<string, { weight: string; notes: string }>
  >({})

  useEffect(() => {
    loadPlayerWorkout()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadPlayerWorkout() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, athlete_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      router.push('/login')
      return
    }

    if (profile.role !== 'athlete' && profile.role !== 'player') {
      router.push('/login')
      return
    }

    if (!profile.athlete_id) {
      setMessage('Your account is not connected to a player profile yet.')
      setLoading(false)
      return
    }

    const { data: athleteData, error: athleteError } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, team_level')
      .eq('id', profile.athlete_id)
      .single()

    if (athleteError || !athleteData) {
      setMessage('Could not load your player profile.')
      setLoading(false)
      return
    }

    setAthlete(athleteData as Athlete)

    const { data: workoutData, error: workoutError } = await supabase
      .from('daily_workouts')
      .select('*')
      .eq('workout_date', today)
      .eq('team_level', athleteData.team_level || '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (workoutError) {
      setMessage(`Could not load today’s workout: ${workoutError.message}`)
      setLoading(false)
      return
    }

    if (!workoutData) {
      setWorkout(null)
      setLogs([])
      setMaxes([])
      setLoading(false)
      return
    }

    setWorkout(workoutData as DailyWorkout)

    const [logsResult, maxesResult] = await Promise.all([
      supabase
        .from('player_workout_logs')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .eq('workout_date', today)
        .eq('workout_id', workoutData.id),

      supabase
        .from('player_lift_maxes')
        .select('*')
        .eq('athlete_id', athleteData.id),
    ])

    if (logsResult.error) {
      setMessage(`Could not load saved sets: ${logsResult.error.message}`)
      setLoading(false)
      return
    }

    if (maxesResult.error) {
      setMessage(`Could not load lift maxes: ${maxesResult.error.message}`)
      setLoading(false)
      return
    }

    const savedLogs = (logsResult.data as PlayerWorkoutLog[]) || []
    const savedMaxes = (maxesResult.data as PlayerLiftMax[]) || []

    setLogs(savedLogs)
    setMaxes(savedMaxes)

    const nextFormState: Record<string, { weight: string; notes: string }> = {}

    savedLogs.forEach((log) => {
      const key = `${log.exercise}__${log.set_number}`
      nextFormState[key] = {
        weight: log.weight?.toString() || '',
        notes: log.notes || '',
      }
    })

    setFormState(nextFormState)
    setLoading(false)
  }

  function getSetKey(exerciseName: string, setNumber: number) {
    return `${exerciseName}__${setNumber}`
  }

  function updateSetField(
    exerciseName: string,
    setNumber: number,
    field: 'weight' | 'notes',
    value: string
  ) {
    const key = getSetKey(exerciseName, setNumber)

    setFormState((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight || '',
        notes: prev[key]?.notes || '',
        [field]: value,
      },
    }))
  }

  function findLiftMax(liftName: string | null) {
    if (!liftName) return null
    return (
      maxes.find(
        (max) => max.lift_name.trim().toLowerCase() === liftName.trim().toLowerCase()
      ) || null
    )
  }

  function calculateTargetWeight(percent: number | null, liftName: string | null) {
    if (percent === null || !liftName) return null

    const liftMax = findLiftMax(liftName)
    if (!liftMax) return null

    const rawWeight = liftMax.max_weight * (percent / 100)
    const rounded = Math.round(rawWeight / 5) * 5
    return rounded
  }

  async function submitWorkout() {
    if (!athlete || !workout) return

    setSubmitting(true)
    setMessage('')

    const payload: any[] = []

    for (const exercise of workout.workout_data?.exercises || []) {
      for (const set of exercise.sets || []) {
        const key = getSetKey(exercise.name, set.setNumber)
        const current = formState[key] || { weight: '', notes: '' }

        const calculatedTargetWeight = calculateTargetWeight(set.percent, set.maxLift)

        const weightValue =
          current.weight.trim() !== ''
            ? Number(current.weight)
            : calculatedTargetWeight !== null
            ? calculatedTargetWeight
            : null

        const notesValue = current.notes.trim() || null

        const hasAnyValue = weightValue !== null || notesValue !== null
        if (!hasAnyValue) continue

        payload.push({
          athlete_id: athlete.id,
          workout_id: workout.id,
          workout_date: workout.workout_date,
          exercise: exercise.name,
          set_number: set.setNumber,
          target_reps: set.targetReps,
          reps_completed: null,
          weight: weightValue,
          notes: notesValue,
        })
      }
    }

    if (payload.length === 0) {
      setMessage('Please enter at least one set before submitting.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('player_workout_logs').upsert(payload, {
      onConflict: 'athlete_id,workout_id,exercise,set_number',
    })

    if (error) {
      setMessage(`Error submitting workout: ${error.message}`)
      setSubmitting(false)
      return
    }

    setMessage('Workout submitted successfully.')
    await loadPlayerWorkout()
    setSubmitting(false)
  }

  const completedSetCount = useMemo(() => {
    return logs.filter((log) => log.weight !== null || log.reps_completed !== null).length
  }, [logs])

  const totalSetCount = useMemo(() => {
    if (!workout?.workout_data?.exercises) return 0
    return workout.workout_data.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  }, [workout])

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ marginBottom: 8 }}>My Workout</h1>

            {athlete && (
              <p style={{ color: '#a1a1aa', margin: 0 }}>
                {athlete.first_name} {athlete.last_name}
                {athlete.team_level ? ` • ${athlete.team_level}` : ''}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/player/dashboard" style={dashboardLinkStyle}>
              Dashboard
            </a>

            <button onClick={handleLogout} style={logoutButtonStyle}>
              Log Out
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              color:
                message.startsWith('Error') || message.startsWith('Could not')
                  ? '#f87171'
                  : '#4ade80',
            }}
          >
            {message}
          </div>
        )}

        {!workout ? (
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>No Workout Assigned</h2>
            <p style={{ color: '#d4d4d8' }}>
              There is no workout assigned for your team today.
            </p>
          </div>
        ) : (
          <>
            <div style={summaryBarStyle}>
              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Workout</div>
                <div style={summaryValueStyle}>{workout.title}</div>
              </div>

              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Date</div>
                <div style={summaryValueStyle}>{workout.workout_date}</div>
              </div>

              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Completed</div>
                <div style={summaryValueStyle}>
                  {completedSetCount}/{totalSetCount}
                </div>
              </div>
            </div>

            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>{workout.title}</h2>

              <div style={{ display: 'grid', gap: 14 }}>
                {workout.workout_data?.exercises?.map((exercise, exerciseIndex) => (
                  <div key={exerciseIndex} style={exerciseCardStyle}>
                    <div style={exerciseTitleStyle}>{exercise.name}</div>

                    <div style={setListStyle}>
                      {exercise.sets.map((set) => {
                        const key = getSetKey(exercise.name, set.setNumber)
                        const current = formState[key] || { weight: '', notes: '' }
                        const calculatedWeight = calculateTargetWeight(set.percent, set.maxLift)

                        return (
                          <div key={set.setNumber} style={setCardStyle}>
                            <div style={setHeaderStyle}>
                              <div style={setNumberStyle}>Set {set.setNumber}</div>

                              <div style={targetChipStyle}>
                                {set.targetReps} reps
                                {set.useMax && set.percent !== null ? ` @ ${set.percent}%` : ''}
                              </div>
                            </div>

                            {set.useMax && (
                              <div style={targetWeightStyle}>
                                Target Weight:{' '}
                                {calculatedWeight !== null
                                  ? `${calculatedWeight} lbs`
                                  : 'No max found'}
                              </div>
                            )}

                            <div style={mobileFieldStackStyle}>
                              <div>
                                <label style={labelStyle}>Weight</label>
                                <input
                                  type="number"
                                  placeholder={
                                    calculatedWeight !== null
                                      ? `${calculatedWeight}`
                                      : 'Enter weight'
                                  }
                                  value={current.weight}
                                  onChange={(e) =>
                                    updateSetField(
                                      exercise.name,
                                      set.setNumber,
                                      'weight',
                                      e.target.value
                                    )
                                  }
                                  style={inputStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>Notes</label>
                                <input
                                  type="text"
                                  placeholder="Optional notes"
                                  value={current.notes}
                                  onChange={(e) =>
                                    updateSetField(
                                      exercise.name,
                                      set.setNumber,
                                      'notes',
                                      e.target.value
                                    )
                                  }
                                  style={inputStyle}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={submitBarStyle}>
              <button
                onClick={submitWorkout}
                disabled={submitting}
                style={submitWorkoutButtonStyle}
              >
                {submitting ? 'Submitting...' : 'Submit Workout'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  backgroundColor: '#000000',
  minHeight: '100vh',
  color: '#ffffff',
}

const shellStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 14,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const summaryBarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 16,
}

const summaryItemStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 10,
  backgroundColor: '#111827',
  minWidth: 0,
}

const summaryLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 11,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const summaryValueStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
  wordBreak: 'break-word',
}

const exerciseCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 14,
  backgroundColor: '#27272a',
}

const exerciseTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 12,
}

const setListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
}

const setCardStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#18181b',
}

const setHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 8,
}

const setNumberStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
}

const targetChipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  backgroundColor: '#27272a',
  border: '1px solid #52525b',
  color: '#d4d4d8',
  fontSize: 13,
}

const targetWeightStyle: React.CSSProperties = {
  color: '#93c5fd',
  fontSize: 14,
  marginBottom: 10,
}

const mobileFieldStackStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#d4d4d8',
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  boxSizing: 'border-box',
}

const submitBarStyle: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 20,
}

const submitWorkoutButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 16,
}

const dashboardLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  textDecoration: 'none',
}

const logoutButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}