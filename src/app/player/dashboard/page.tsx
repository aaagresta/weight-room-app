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

type PlayerLiftMax = {
  id: string
  athlete_id: string
  lift_name: string
  max_weight: number
  estimated_one_rm: number | null
  tested_on: string | null
  notes: string | null
}

type AttendanceLog = {
  id: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
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

type GroupedWorkout = {
  workout_date: string
  logs: PlayerWorkoutLog[]
}

export default function PlayerDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [maxes, setMaxes] = useState<PlayerLiftMax[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<PlayerWorkoutLog[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadDashboard() {
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
      setMessage('Could not load your athlete profile.')
      setLoading(false)
      return
    }

    setAthlete(athleteData as Athlete)

    const [maxesResult, attendanceResult, workoutLogsResult] = await Promise.all([
      supabase
        .from('player_lift_maxes')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('lift_name', { ascending: true }),

      supabase
        .from('player_attendance_logs')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('attendance_date', { ascending: false }),

      supabase
        .from('player_workout_logs')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    if (maxesResult.error) {
      setMessage(`Could not load maxes: ${maxesResult.error.message}`)
      setLoading(false)
      return
    }

    if (attendanceResult.error) {
      setMessage(`Could not load attendance: ${attendanceResult.error.message}`)
      setLoading(false)
      return
    }

    if (workoutLogsResult.error) {
      setMessage(`Could not load workout history: ${workoutLogsResult.error.message}`)
      setLoading(false)
      return
    }

    setMaxes((maxesResult.data as PlayerLiftMax[]) || [])
    setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    setWorkoutLogs((workoutLogsResult.data as PlayerWorkoutLog[]) || [])
    setLoading(false)
  }

  const attendanceStats = useMemo(() => {
    const total = attendanceLogs.length
    const present = attendanceLogs.filter((log) => log.status === 'PRESENT').length
    const absent = attendanceLogs.filter((log) => log.status === 'ABSENT').length
    const late = attendanceLogs.filter((log) => log.status === 'LATE').length
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    return { total, present, absent, late, rate }
  }, [attendanceLogs])

  const groupedWorkouts = useMemo(() => {
    const map = new Map<string, PlayerWorkoutLog[]>()

    workoutLogs.forEach((log) => {
      const existing = map.get(log.workout_date) || []
      existing.push(log)
      map.set(log.workout_date, existing)
    })

    return Array.from(map.entries())
      .map(([workout_date, logs]) => ({
        workout_date,
        logs,
      }))
      .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
  }, [workoutLogs])

  const uniqueWorkoutDays = useMemo(() => {
    return new Set(workoutLogs.map((log) => log.workout_date)).size
  }, [workoutLogs])

  const recentLogs = useMemo(() => workoutLogs.slice(0, 12), [workoutLogs])

  const totalWeightLifted = useMemo(() => {
    return workoutLogs.reduce((sum, log) => {
      const weight = log.weight ?? 0
      const reps = log.reps_completed ?? 0
      return sum + weight * reps
    }, 0)
  }, [workoutLogs])

  const favoriteLift = useMemo(() => {
    if (workoutLogs.length === 0) return '—'

    const counts = new Map<string, number>()
    workoutLogs.forEach((log) => {
      counts.set(log.exercise, (counts.get(log.exercise) || 0) + 1)
    })

    let winner = '—'
    let maxCount = 0

    counts.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count
        winner = name
      }
    })

    return winner
  }, [workoutLogs])

  if (loading) {
    return (
      <div style={pageStyle}>
        <h1>Player Dashboard</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
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
          <h1 style={{ marginBottom: 8 }}>Player Dashboard</h1>
          {athlete && (
            <p style={{ color: '#a1a1aa', margin: 0 }}>
              {athlete.first_name} {athlete.last_name}
              {athlete.team_level ? ` • ${athlete.team_level}` : ''}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/player/workout" style={navLinkStyle}>
            My Workout
          </a>

          <button onClick={handleLogout} style={logoutButtonStyle}>
            Log Out
          </button>
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Workout Days Logged" value={String(uniqueWorkoutDays)} />
        <StatCard label="Total Logged Sets" value={String(workoutLogs.length)} />
        <StatCard label="Attendance Rate" value={`${attendanceStats.rate}%`} />
        <StatCard label="Current Maxes" value={String(maxes.length)} />
        <StatCard label="Total Weight Lifted" value={String(totalWeightLifted)} />
        <StatCard label="Most Logged Lift" value={favoriteLift} />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Current Maxes</h2>

        {maxes.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No maxes saved yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {maxes.map((max) => (
              <div key={max.id} style={rowCardStyle}>
                <div>
                  <div style={smallLabelStyle}>Lift</div>
                  <div style={{ fontWeight: 700 }}>{max.lift_name}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Max</div>
                  <div>{max.max_weight}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Estimated 1RM</div>
                  <div>{max.estimated_one_rm ?? '—'}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Tested On</div>
                  <div>{max.tested_on || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Attendance</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MiniStat label="Present" value={String(attendanceStats.present)} />
          <MiniStat label="Late" value={String(attendanceStats.late)} />
          <MiniStat label="Absent" value={String(attendanceStats.absent)} />
          <MiniStat label="Total Records" value={String(attendanceStats.total)} />
        </div>

        {attendanceLogs.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No attendance records yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {attendanceLogs.slice(0, 10).map((log) => (
              <div key={log.id} style={entryRowStyle}>
                <div>{log.attendance_date}</div>
                <div style={{ fontWeight: 700 }}>{log.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Recent Lift Entries</h2>

        {recentLogs.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No lift logs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {recentLogs.map((log) => (
              <div key={log.id} style={entryRowStyle}>
                <div>
                  <strong>{log.workout_date}</strong> — {log.exercise} Set {log.set_number}
                </div>
                <div>
                  {log.weight ?? '—'} lbs × {log.reps_completed ?? '—'} reps
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Workout History</h2>

        {groupedWorkouts.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No workout history yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {groupedWorkouts.map((group: GroupedWorkout) => (
              <div key={group.workout_date} style={historyCardStyle}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{group.workout_date}</div>
                  <div style={{ color: '#a1a1aa' }}>
                    {group.logs.length} logged sets
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {group.logs.map((log) => (
                    <div key={log.id} style={entryRowStyle}>
                      <div>
                        {log.exercise} — Set {log.set_number}
                      </div>
                      <div>
                        {log.weight ?? '—'} lbs × {log.reps_completed ?? '—'} reps
                      </div>
                    </div>
                  ))}
                </div>
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
      <div style={smallLabelStyle}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  backgroundColor: '#000000',
  minHeight: '100vh',
  color: '#ffffff',
}

const messageStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  color: '#f87171',
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

const rowCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr',
  gap: 12,
  alignItems: 'center',
}

const historyCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
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

const smallLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 12,
  marginBottom: 4,
}

const navLinkStyle: React.CSSProperties = {
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