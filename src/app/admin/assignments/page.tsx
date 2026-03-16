'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

export default function WorkoutAssignmentsPage() {
    const searchParams = useSearchParams()
    const today = new Date().toISOString().split('T')[0]

  const [workouts, setWorkouts] = useState<DailyWorkout[]>([])
  const [players, setPlayers] = useState<Athlete[]>([])
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [assignedDate, setAssignedDate] = useState(today)
  const [assignMode, setAssignMode] = useState<'team' | 'player'>('team')
  const [selectedTeam, setSelectedTeam] = useState('Varsity')
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    loadData()
  }, [])
    useEffect(() => {
    const workoutIdFromUrl = searchParams.get('workoutId')
    if (workoutIdFromUrl) {
      setSelectedWorkoutId(workoutIdFromUrl)
    }
  }, [searchParams])
  async function loadData() {
    setLoading(true)
    setMessage('')

    const [workoutsResult, playersResult, assignmentsResult] = await Promise.all([
      supabase.from('daily_workouts').select('*').order('workout_date', { ascending: false }),
      supabase.from('athletes').select('id, first_name, last_name, team_level').order('last_name', { ascending: true }),
      supabase.from('workout_assignments').select('*').order('assigned_date', { ascending: false }),
    ])

    if (workoutsResult.error) {
      setMessage(`Error loading workouts: ${workoutsResult.error.message}`)
      setWorkouts([])
    } else {
      setWorkouts((workoutsResult.data as DailyWorkout[]) || [])
    }

    if (playersResult.error) {
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
    } else {
      setPlayers((playersResult.data as Athlete[]) || [])
    }

    if (assignmentsResult.error) {
      setMessage(`Error loading assignments: ${assignmentsResult.error.message}`)
      setAssignments([])
    } else {
      setAssignments((assignmentsResult.data as WorkoutAssignment[]) || [])
    }

    setLoading(false)
  }

  async function handleAssignWorkout(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!selectedWorkoutId) {
      setMessage('Please choose a workout.')
      return
    }

    if (assignMode === 'team' && !selectedTeam) {
      setMessage('Please choose a team.')
      return
    }

    if (assignMode === 'player' && !selectedAthleteId) {
      setMessage('Please choose a player.')
      return
    }

    const payload = {
      workout_id: selectedWorkoutId,
      assigned_date: assignedDate,
      team_level: assignMode === 'team' ? selectedTeam : null,
      athlete_id: assignMode === 'player' ? selectedAthleteId : null,
      is_visible: isVisible,
    }

    const { error } = await supabase.from('workout_assignments').insert([payload])

    if (error) {
      setMessage(`Error assigning workout: ${error.message}`)
      return
    }

    setMessage('Workout assigned successfully.')
    setSelectedWorkoutId('')
    setSelectedAthleteId('')
    await loadData()
  }

  async function toggleVisibility(id: string, currentValue: boolean) {
    const { error } = await supabase
      .from('workout_assignments')
      .update({ is_visible: !currentValue })
      .eq('id', id)

    if (error) {
      setMessage(`Error updating visibility: ${error.message}`)
      return
    }

    await loadData()
  }

  async function deleteAssignment(id: string) {
    const confirmed = window.confirm('Delete this assignment?')
    if (!confirmed) return

    const { error } = await supabase
      .from('workout_assignments')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(`Error deleting assignment: ${error.message}`)
      return
    }

    await loadData()
    setMessage('Assignment deleted.')
  }

  const teamOptions = Array.from(
    new Set(
      players
        .map((p) => (p.team_level ?? '').trim())
        .filter((v) => v !== '')
    )
  )

  const assignmentRows = useMemo(() => {
    return assignments.map((assignment) => {
      const workout = workouts.find((w) => w.id === assignment.workout_id)
      const athlete = players.find((p) => p.id === assignment.athlete_id)

      return {
        ...assignment,
        workoutTitle: workout?.title || 'Unknown Workout',
        athleteName: athlete ? `${athlete.first_name} ${athlete.last_name}` : null,
      }
    })
  }, [assignments, workouts, players])

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Workout Assignments</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Choose which saved workouts players can actually see.
          </p>
        </div>

        <a href="/admin" style={navLinkStyle}>
          Back to Admin
        </a>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Assign a Workout</h2>

        <form onSubmit={handleAssignWorkout}>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Workout</label>
              <select
                value={selectedWorkoutId}
                onChange={(e) => setSelectedWorkoutId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select workout</option>
                {workouts.map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.title} ({workout.team_level} • {workout.workout_date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Assigned Date</label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Assign By</label>
              <select
                value={assignMode}
                onChange={(e) => setAssignMode(e.target.value as 'team' | 'player')}
                style={inputStyle}
              >
                <option value="team">Team</option>
                <option value="player">Individual Player</option>
              </select>
            </div>

            {assignMode === 'team' ? (
              <div>
                <label style={labelStyle}>Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={inputStyle}
                >
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Player</label>
                <select
                  value={selectedAthleteId}
                  onChange={(e) => setSelectedAthleteId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select player</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.first_name} {player.last_name}
                      {player.team_level ? ` (${player.team_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Visible to Player?</label>
              <select
                value={isVisible ? 'yes' : 'no'}
                onChange={(e) => setIsVisible(e.target.value === 'yes')}
                style={inputStyle}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <button type="submit" style={buttonStyle}>
            Assign Workout
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, color: message.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Current Assignments</h2>

        {loading && <p>Loading...</p>}

        {!loading && assignmentRows.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No assignments yet.</p>
        )}

        {!loading && assignmentRows.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {assignmentRows.map((assignment) => (
              <div key={assignment.id} style={cardStyle}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{assignment.workoutTitle}</div>
                  <div style={{ color: '#a1a1aa' }}>
                    {assignment.assigned_date}
                    {assignment.team_level ? ` • Team: ${assignment.team_level}` : ''}
                    {assignment.athleteName ? ` • Player: ${assignment.athleteName}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => toggleVisibility(assignment.id, assignment.is_visible)}
                    style={buttonStyle}
                  >
                    {assignment.is_visible ? 'Hide' : 'Show'}
                  </button>

                  <button
                    onClick={() => deleteAssignment(assignment.id)}
                    style={deleteButtonStyle}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  backgroundColor: '#000000',
  minHeight: '100vh',
  color: '#ffffff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  marginBottom: 12,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#d4d4d8',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
}

const deleteButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  textDecoration: 'none',
}