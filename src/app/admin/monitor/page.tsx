'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

type DailyWorkout = {
  id: string
  workout_date: string
  team_level: string
  title: string
  workout_data: {
    exercises: {
      name: string
      sets: {
        setNumber: number
        targetReps: number
      }[]
    }[]
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
  created_at?: string
}

export default function AdminMonitorPage() {
  const today = new Date().toISOString().split('T')[0]

  const [selectedDate, setSelectedDate] = useState(today)
  const [teamFilter, setTeamFilter] = useState('Varsity')

  const [players, setPlayers] = useState<Athlete[]>([])
  const [workout, setWorkout] = useState<DailyWorkout | null>(null)
  const [logs, setLogs] = useState<PlayerWorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadMonitorData()
  }, [selectedDate, teamFilter])

  useEffect(() => {
    const interval = setInterval(() => {
      loadMonitorData(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedDate, teamFilter])

  async function loadMonitorData(showLoading = true) {
    if (showLoading) setLoading(true)
    setMessage('')

    const [playersResult, workoutResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .eq('team_level', teamFilter)
        .order('last_name', { ascending: true }),

      supabase
        .from('daily_workouts')
        .select('*')
        .eq('workout_date', selectedDate)
        .eq('team_level', teamFilter)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (playersResult.error) {
      console.error(playersResult.error)
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
      if (showLoading) setLoading(false)
      return
    }

    setPlayers((playersResult.data as Athlete[]) || [])

    if (workoutResult.error) {
      console.error(workoutResult.error)
      setMessage(`Error loading workout: ${workoutResult.error.message}`)
      setWorkout(null)
      setLogs([])
      if (showLoading) setLoading(false)
      return
    }

    const foundWorkout = (workoutResult.data as DailyWorkout | null) || null
    setWorkout(foundWorkout)

    if (!foundWorkout) {
      setLogs([])
      if (showLoading) setLoading(false)
      return
    }

    const { data: logsData, error: logsError } = await supabase
      .from('player_workout_logs')
      .select('*')
      .eq('workout_date', selectedDate)
      .eq('workout_id', foundWorkout.id)
      .order('created_at', { ascending: false })

    if (logsError) {
      console.error(logsError)
      setMessage(`Error loading logs: ${logsError.message}`)
      setLogs([])
      if (showLoading) setLoading(false)
      return
    }

    setLogs((logsData as PlayerWorkoutLog[]) || [])

    if (showLoading) setLoading(false)
  }

  const totalAssignedSets = useMemo(() => {
    if (!workout?.workout_data?.exercises) return 0
    return workout.workout_data.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  }, [workout])

  const playerCards = useMemo(() => {
    return players.map((player) => {
      const playerLogs = logs.filter((log) => log.athlete_id === player.id)

      const uniqueCompletedSets = new Set(
        playerLogs.map((log) => `${log.exercise}__${log.set_number}`)
      )

      const latestEntries = playerLogs.slice(0, 5)

      const completionPercent =
        totalAssignedSets > 0
          ? Math.round((uniqueCompletedSets.size / totalAssignedSets) * 100)
          : 0

      return {
        player,
        playerLogs,
        completedSets: uniqueCompletedSets.size,
        completionPercent,
        latestEntries,
        hasStarted: uniqueCompletedSets.size > 0,
      }
    })
  }, [players, logs, totalAssignedSets])

  const startedCount = playerCards.filter((card) => card.hasStarted).length
  const completedCount = playerCards.filter(
    (card) => totalAssignedSets > 0 && card.completedSets >= totalAssignedSets
  ).length

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
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
          <h1 style={{ marginBottom: 8 }}>Coach Live Workout Monitor</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Track athlete workout submissions in real time.
          </p>
        </div>

        <a
          href="/admin"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #52525b',
            backgroundColor: '#18181b',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          Back to Admin
        </a>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Team" value={teamFilter} />
        <StatCard label="Players" value={String(players.length)} />
        <StatCard label="Started" value={String(startedCount)} />
        <StatCard label="Completed" value={String(completedCount)} />
        <StatCard label="Assigned Sets" value={String(totalAssignedSets)} />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Monitor Controls</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="Varsity">Varsity</option>
              <option value="JV">JV</option>
              <option value="Freshman">Freshman</option>
            </select>
          </div>
        </div>

        <button onClick={() => loadMonitorData()} style={buttonStyle}>
          Refresh Now
        </button>

        {message && (
          <p style={{ marginTop: 12, color: '#f87171' }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Today’s Workout</h2>

        {loading && <p>Loading...</p>}

        {!loading && !workout && (
          <p style={{ color: '#d4d4d8' }}>
            No workout assigned for {teamFilter} on {selectedDate}.
          </p>
        )}

        {!loading && workout && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{workout.title}</div>
              <div style={{ color: '#a1a1aa' }}>
                {workout.team_level} • {workout.workout_date}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {workout.workout_data?.exercises?.map((exercise, index) => (
                <div key={index} style={exercisePreviewStyle}>
                  <div style={{ fontWeight: 700 }}>{exercise.name}</div>
                  <div style={{ color: '#d4d4d8' }}>
                    {exercise.sets.map((set) => set.targetReps).join(' / ')} reps
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Player Progress</h2>

        {!loading && playerCards.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No players found.</p>
        )}

        {!loading && playerCards.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {playerCards.map((card) => (
              <div key={card.player.id} style={playerCardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {card.player.first_name} {card.player.last_name}
                    </div>
                    <div style={{ color: '#a1a1aa' }}>
                      {card.player.team_level || 'No team'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      backgroundColor: card.hasStarted ? '#166534' : '#3f3f46',
                      fontWeight: 700,
                    }}
                  >
                    {card.hasStarted ? 'Started' : 'Not Started'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <MiniStat label="Completed Sets" value={`${card.completedSets}/${totalAssignedSets}`} />
                  <MiniStat label="Progress" value={`${card.completionPercent}%`} />
                  <MiniStat label="Logs Entered" value={String(card.playerLogs.length)} />
                </div>

                <div style={{ marginBottom: 8, fontWeight: 700 }}>Latest Entries</div>

                {card.latestEntries.length === 0 ? (
                  <div style={{ color: '#d4d4d8' }}>No lift entries yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {card.latestEntries.map((log) => (
                      <div key={log.id} style={entryRowStyle}>
                        <div>
                          <strong>{log.exercise}</strong> — Set {log.set_number}
                        </div>
                        <div>
                          {log.weight ?? '—'} lbs × {log.reps_completed ?? '—'} reps
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const statCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#18181b',
}

const statLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 14,
  marginBottom: 8,
}

const statValueStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 24,
  fontWeight: 700,
}

const miniStatStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#27272a',
}

const playerCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
}

const exercisePreviewStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#27272a',
}

const entryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 10,
  backgroundColor: '#18181b',
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