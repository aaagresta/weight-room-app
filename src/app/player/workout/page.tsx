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
  const [message, setMessage] = useState('')

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [workout, setWorkout] = useState<DailyWorkout | null>(null)
  const [logs, setLogs] = useState<PlayerWorkoutLog[]>([])
  const [maxes, setMaxes] = useState<PlayerLiftMax[]>([])

  const [formState, setFormState] = useState<
    Record<string, { weight: string; reps: string; notes: string }>
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

    const nextFormState: Record<string, { weight: string; reps: string; notes: string }> = {}

    savedLogs.forEach((log) => {
      const key = `${log.exercise}__${log.set_number}`
      nextFormState[key] = {
        weight: log.weight?.toString() || '',
        reps: log.reps_completed?.toString() || '',
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
    field: 'weight' | 'reps' | 'notes',
    value: string
  ) {
    const key = getSetKey(exerciseName, setNumber)

    setFormState((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight || '',
        reps: prev[key]?.reps || '',
        notes: prev[key]?.notes || '',
        [field]: value,
      },
    }))
  }

  function findLiftMax(liftName: string | null) {
    if (!liftName) return null
    return maxes.find(
      (max) => max.lift_name.trim().toLowerCase() === liftName.trim().toLowerCase()
    ) || null
  }

  function calculateTargetWeight(percent: number | null, liftName: string | null) {
    if (percent === null || !liftName) return null

    const liftMax = findLiftMax(liftName)
    if (!liftMax) return null

    const rawWeight = liftMax.max_weight * (percent / 100)
    const rounded = Math.round(rawWeight / 5) * 5
    return rounded
  }

  async function saveSet(
    exerciseName: string,
    setNumber: number,
    targetReps: number,
    percent: number | null,
    maxLift: string | null
  ) {
    if (!athlete || !workout) return

    const key = getSetKey(exerciseName, setNumber)
    const current = formState[key] || { weight: '', reps: '', notes: '' }

    const calculatedTargetWeight = calculateTargetWeight(percent, maxLift)
    const weightValue =
      current.weight.trim() !== ''
        ? Number(current.weight)
        : calculatedTargetWeight !== null
        ? calculatedTargetWeight
        : null

    const repsValue = current.reps.trim() ? Number(current.reps) : null
    const notesValue = current.notes.trim() || null

    const { error } = await supabase.from('player_workout_logs').upsert(
      [
        {
          athlete_id: athlete.id,
          workout_id: workout.id,
          workout_date: workout.workout_date,
          exercise: exerciseName,
          set_number: setNumber,
          target_reps: targetReps,
          reps_completed: repsValue,
          weight: weightValue,
          notes: notesValue,
        },
      ],
      {
        onConflict: 'athlete_id,workout_id,exercise,set_number',
      }
    )

    if (error) {
      setMessage(`Error saving set: ${error.message}`)
      return
    }

    setMessage(`Saved ${exerciseName} set ${setNumber}.`)
    await loadPlayerWorkout()
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
      <div
        style={{
          padding: 24,
          backgroundColor: '#000000',
          minHeight: '100vh',
          color: '#ffffff',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 24,
        backgroundColor: '#000000',
        minHeight: '100vh',
        color: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>My Workout</h1>

          {athlete && (
            <p style={{ color: '#a1a1aa', margin: 0 }}>
              {athlete.first_name} {athlete.last_name}
              {athlete.team_level ? ` • ${athlete.team_level}` : ''}
            </p>
          )}
        </div>
          <a href="/player/dashboard" style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #52525b',
              backgroundColor: '#18181b',
              color: '#ffffff',
              textDecoration: 'none',
          }}>
            Dashboard
</a>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #991b1b',
            backgroundColor: '#991b1b',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Log Out
        </button>
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
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            backgroundColor: '#18181b',
          }}
        >
          <h2 style={{ marginTop: 0 }}>No Workout Assigned</h2>
          <p style={{ color: '#d4d4d8' }}>
            There is no workout assigned for your team today.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <StatCard label="Workout" value={workout.title} />
            <StatCard label="Date" value={workout.workout_date} />
            <StatCard label="Completed Sets" value={`${completedSetCount}/${totalSetCount}`} />
          </div>

          <div
            style={{
              border: '1px solid #3f3f46',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              backgroundColor: '#18181b',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{workout.title}</h2>

            <div style={{ display: 'grid', gap: 16 }}>
              {workout.workout_data?.exercises?.map((exercise, exerciseIndex) => (
                <div
                  key={exerciseIndex}
                  style={{
                    border: '1px solid #52525b',
                    borderRadius: 12,
                    padding: 16,
                    backgroundColor: '#27272a',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                    {exercise.name}
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    {exercise.sets.map((set) => {
                      const key = getSetKey(exercise.name, set.setNumber)
                      const current = formState[key] || { weight: '', reps: '', notes: '' }
                      const calculatedWeight = calculateTargetWeight(set.percent, set.maxLift)

                      return (
                        <div
                          key={set.setNumber}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 160px 160px 1fr auto',
                            gap: 10,
                            alignItems: 'center',
                            border: '1px solid #3f3f46',
                            borderRadius: 10,
                            padding: 12,
                            backgroundColor: '#18181b',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>Set {set.setNumber}</div>
                            <div style={{ color: '#a1a1aa', fontSize: 14 }}>
                              Target: {set.targetReps} reps
                              {set.useMax && set.percent !== null
                                ? ` @ ${set.percent}%`
                                : ''}
                            </div>
                            {set.useMax && (
                              <div style={{ color: '#93c5fd', fontSize: 14, marginTop: 4 }}>
                                Target Weight:{' '}
                                {calculatedWeight !== null
                                  ? `${calculatedWeight} lbs`
                                  : 'No max found'}
                              </div>
                            )}
                          </div>

                          <input
                            type="number"
                            placeholder={calculatedWeight !== null ? `${calculatedWeight}` : 'Weight'}
                            value={current.weight}
                            onChange={(e) =>
                              updateSetField(exercise.name, set.setNumber, 'weight', e.target.value)
                            }
                            style={inputStyle}
                          />

                          <input
                            type="number"
                            placeholder="Actual reps"
                            value={current.reps}
                            onChange={(e) =>
                              updateSetField(exercise.name, set.setNumber, 'reps', e.target.value)
                            }
                            style={inputStyle}
                          />

                          <input
                            type="text"
                            placeholder="Notes"
                            value={current.notes}
                            onChange={(e) =>
                              updateSetField(exercise.name, set.setNumber, 'notes', e.target.value)
                            }
                            style={inputStyle}
                          />

                          <button
                            onClick={() =>
                              saveSet(
                                exercise.name,
                                set.setNumber,
                                set.targetReps,
                                set.percent,
                                set.maxLift
                              )
                            }
                            style={{
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: '1px solid #166534',
                              backgroundColor: '#166534',
                              color: '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            Save Set
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #52525b',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#18181b',
      }}
    >
      <div
        style={{
          color: '#a1a1aa',
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: '#ffffff',
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
}