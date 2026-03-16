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

type DailyWorkoutSet = {
  setNumber: number
  targetReps: number
  percent: number | null
  useMax: boolean
  maxLift: string | null
}

type DailyWorkoutExercise = {
  name: string
  sets: DailyWorkoutSet[]
}

type DailyWorkout = {
  id: string
  workout_date: string
  team_level: string
  title: string
  workout_data: {
    exercises: DailyWorkoutExercise[]
  }
}

type WorkoutAssignment = {
  id: string
  workout_id: string
  assigned_date: string
  team_level: string | null
  athlete_id: string | null
  is_visible: boolean
  created_at?: string
}

export default function UpcomingWorkoutsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([])
  const [workouts, setWorkouts] = useState<DailyWorkout[]>([])

  useEffect(() => {
    loadUpcomingWorkouts()
  }, [])

  async function loadUpcomingWorkouts() {
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

    if (profileError || !profile || !profile.athlete_id) {
      router.push('/login')
      return
    }

    if (profile.role !== 'athlete' && profile.role !== 'player') {
      router.push('/login')
      return
    }

    const { data: athleteData, error: athleteError } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, team_level')
      .eq('id', profile.athlete_id)
      .single()

    if (athleteError || !athleteData) {
      setMessage('Could not load player profile.')
      setLoading(false)
      return
    }

    setAthlete(athleteData as Athlete)

    const today = new Date().toISOString().split('T')[0]

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('workout_assignments')
      .select('*')
      .eq('is_visible', true)
      .gte('assigned_date', today)
      .order('assigned_date', { ascending: true })

    if (assignmentError) {
      setMessage(`Could not load assignments: ${assignmentError.message}`)
      setLoading(false)
      return
    }

    const allAssignments = (assignmentData as WorkoutAssignment[]) || []

    const visibleAssignments = allAssignments.filter((assignment) => {
      const matchesPlayer = assignment.athlete_id === athleteData.id

      const matchesTeam =
        !!assignment.team_level &&
        !!athleteData.team_level &&
        assignment.team_level.trim().toLowerCase() === athleteData.team_level.trim().toLowerCase()

      return matchesPlayer || matchesTeam
    })

    setAssignments(visibleAssignments)

    const workoutIds = [...new Set(visibleAssignments.map((a) => a.workout_id))]

    if (workoutIds.length === 0) {
      setWorkouts([])
      setLoading(false)
      return
    }

    const { data: workoutData, error: workoutError } = await supabase
      .from('daily_workouts')
      .select('*')
      .in('id', workoutIds)

    if (workoutError) {
      setMessage(`Could not load workouts: ${workoutError.message}`)
      setLoading(false)
      return
    }

    setWorkouts((workoutData as DailyWorkout[]) || [])
    setLoading(false)
  }

  const upcomingRows = useMemo(() => {
    return assignments
      .map((assignment) => {
        const workout = workouts.find((w) => w.id === assignment.workout_id)
        return {
          assignment,
          workout,
        }
      })
      .filter((row) => row.workout)
  }, [assignments, workouts])

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
          <h1 style={{ marginBottom: 8 }}>Upcoming Workouts</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Only workouts your coaches have assigned to you.
          </p>
        </div>

        <a
          href="/player/dashboard"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #52525b',
            backgroundColor: '#18181b',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Back to Dashboard
        </a>
      </div>

      {athlete && (
        <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
          {athlete.first_name} {athlete.last_name}
          {athlete.team_level ? ` • ${athlete.team_level}` : ''}
        </p>
      )}

      {message && (
        <p style={{ color: '#f87171', marginBottom: 20 }}>
          {message}
        </p>
      )}

      {loading && <p>Loading...</p>}

      {!loading && upcomingRows.length === 0 && (
        <div
          style={{
            border: '1px solid #3f3f46',
            borderRadius: 12,
            padding: 16,
            backgroundColor: '#18181b',
          }}
        >
          <p style={{ color: '#d4d4d8', margin: 0 }}>
            No upcoming workouts assigned yet.
          </p>
        </div>
      )}

      {!loading && upcomingRows.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {upcomingRows.map(({ assignment, workout }) => {
            if (!workout) return null

            return (
              <div
                key={assignment.id}
                style={{
                  border: '1px solid #3f3f46',
                  borderRadius: 12,
                  padding: 16,
                  backgroundColor: '#18181b',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{workout.title}</div>
                  <div style={{ color: '#a1a1aa' }}>
                    Assigned for {assignment.assigned_date}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {workout.workout_data?.exercises?.map((exercise, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #52525b',
                        borderRadius: 10,
                        padding: 12,
                        backgroundColor: '#27272a',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{exercise.name}</div>
                      <div>
                        {exercise.sets
                          .map((set) => {
                            if (set.useMax && set.percent !== null) {
                              return `${set.targetReps} reps @ ${set.percent}%`
                            }
                            return `${set.targetReps} reps`
                          })
                          .join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}