'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  grad_year: number | null
  positions: string[] | null
  team_level: string | null
}

type Pod = {
  podName: string
  rackName: string
  players: Athlete[]
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

type LiveRoomSession = {
  id: string
  session_date: string
  team: string | null
  rack_count: number
  timer_seconds: number
  timer_running: boolean
  pods: Pod[]
  attendance_map: Record<string, string>
  current_block: string | null
  workout_id: string | null
}

export default function SessionTvPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [session, setSession] = useState<LiveRoomSession | null>(null)
  const [workout, setWorkout] = useState<DailyWorkout | null>(null)

  useEffect(() => {
    loadTvData()

    const interval = window.setInterval(() => {
      loadTvData(false)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [])

  async function loadTvData(showLoading = true) {
    if (showLoading) setLoading(true)

    const { data: sessionData, error: sessionError } = await supabase
      .from('live_room_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError) {
      setMessage(`Could not load live session: ${sessionError.message}`)
      setLoading(false)
      return
    }

    if (!sessionData) {
      setSession(null)
      setWorkout(null)
      setLoading(false)
      return
    }

    const typedSession = sessionData as LiveRoomSession
    setSession(typedSession)

    if (!typedSession.workout_id) {
      setWorkout(null)
      setLoading(false)
      return
    }

    const { data: workoutData, error: workoutError } = await supabase
      .from('daily_workouts')
      .select('*')
      .eq('id', typedSession.workout_id)
      .maybeSingle()

    if (workoutError) {
      setMessage(`Could not load workout: ${workoutError.message}`)
      setLoading(false)
      return
    }

    setWorkout((workoutData as DailyWorkout) || null)
    setLoading(false)
  }

  const formattedTime = useMemo(() => {
    const totalSeconds = session?.timer_seconds ?? 0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [session])

  const podCount = session?.pods?.length || 0
  const assignedPlayerCount = useMemo(() => {
    return (session?.pods || []).reduce((sum, pod) => sum + (pod.players?.length || 0), 0)
  }, [session])

  const workoutExercises = workout?.workout_data?.exercises || []

  if (loading) {
    return (
      <div style={screenStyle}>
        <div style={centerMessageStyle}>Loading presentation view...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={screenStyle}>
        <div style={centerMessageStyle}>No live session found.</div>
      </div>
    )
  }

  return (
    <div style={screenStyle}>
      <div style={frameStyle}>
        <div style={topBarStyle}>
          <div>
            <div style={titleStyle}>Lift Session Presentation</div>
            <div style={subTitleStyle}>
              {session.team || 'All Teams'} • {session.session_date}
            </div>
          </div>

          <div style={statusPillStyle(session.timer_running, session.timer_seconds)}>
            {session.timer_seconds === 0
              ? 'TIME IS UP'
              : session.timer_running
              ? 'TIMER RUNNING'
              : 'TIMER PAUSED'}
          </div>
        </div>

        <div style={contentGridStyle}>
          <div style={leftColumnStyle}>
            <div style={timerPanelStyle}>
              <div style={panelLabelStyle}>Current Interval</div>
              <div style={timerTextStyle}>{formattedTime}</div>

              <div style={timerMetaRowStyle}>
                <div style={miniMetricStyle}>
                  <div style={miniMetricLabelStyle}>Pods</div>
                  <div style={miniMetricValueStyle}>{podCount}</div>
                </div>

                <div style={miniMetricStyle}>
                  <div style={miniMetricLabelStyle}>Assigned</div>
                  <div style={miniMetricValueStyle}>{assignedPlayerCount}</div>
                </div>

                <div style={miniMetricStyle}>
                  <div style={miniMetricLabelStyle}>Block</div>
                  <div style={miniMetricValueStyle}>
                    {session.current_block || 'Main Lift'}
                  </div>
                </div>
              </div>
            </div>

            <div style={workoutPanelStyle}>
              <div style={panelHeaderRowStyle}>
                <div>
                  <div style={panelTitleStyle}>Assigned Workout</div>
                  <div style={panelSubTextStyle}>
                    {workout ? `${workout.title} • ${workout.team_level}` : 'No workout selected'}
                  </div>
                </div>
              </div>

              {!workout ? (
                <div style={emptyStateStyle}>No workout selected for this session.</div>
              ) : (
                <div style={exerciseListStyle}>
                  {workoutExercises.slice(0, 8).map((exercise, index) => (
                    <div key={index} style={exerciseRowStyle}>
                      <div style={exerciseNameStyle}>{exercise.name}</div>
                      <div style={exercisePrescriptionStyle}>
                        {exercise.sets
                          .map((set) => {
                            if (set.useMax && set.percent !== null) {
                              return `${set.targetReps} @ ${set.percent}%`
                            }
                            return `${set.targetReps}`
                          })
                          .join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={rightColumnStyle}>
            <div style={panelHeaderRowStyle}>
              <div>
                <div style={panelTitleStyle}>Rack / Pod Assignments</div>
                <div style={panelSubTextStyle}>
                  Drag-and-drop pods from the coach screen appear here automatically
                </div>
              </div>
            </div>

            {podCount === 0 ? (
              <div style={emptyStateStyle}>No pods built yet.</div>
            ) : (
              <div style={podsGridStyle}>
                {session.pods.map((pod) => (
                  <div key={pod.podName} style={podCardStyle}>
                    <div style={rackNameStyle}>{pod.rackName}</div>
                    <div style={podNameStyle}>{pod.podName}</div>

                    {pod.players.length === 0 ? (
                      <div style={podEmptyStyle}>No players assigned</div>
                    ) : (
                      <div style={playerListStyle}>
                        {pod.players.slice(0, 8).map((player) => (
                          <div key={player.id} style={playerChipStyle}>
                            {player.first_name} {player.last_name}
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

        {message && <div style={footerMessageStyle}>{message}</div>}
      </div>
    </div>
  )
}

function statusPillStyle(timerRunning: boolean, seconds: number): React.CSSProperties {
  if (seconds === 0) {
    return {
      ...statusPillBaseStyle,
      backgroundColor: '#991b1b',
      border: '1px solid #ef4444',
    }
  }

  if (timerRunning) {
    return {
      ...statusPillBaseStyle,
      backgroundColor: '#166534',
      border: '1px solid #22c55e',
    }
  }

  return {
    ...statusPillBaseStyle,
    backgroundColor: '#a16207',
    border: '1px solid #f59e0b',
  }
}

const screenStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top left, #1e293b 0%, #020617 45%, #000000 100%)',
  color: '#ffffff',
  padding: 16,
  boxSizing: 'border-box',
}

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 14,
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: '6px 4px 0 4px',
}

const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  lineHeight: 1,
}

const subTitleStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 18,
  color: '#cbd5e1',
}

const statusPillBaseStyle: React.CSSProperties = {
  color: '#ffffff',
  padding: '12px 18px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 18,
  letterSpacing: 0.5,
}

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.05fr 1.35fr',
  gap: 14,
  minHeight: 0,
}

const leftColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gap: 14,
  minHeight: 0,
}

const rightColumnStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 18,
  backgroundColor: 'rgba(15, 23, 42, 0.82)',
  padding: 16,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
}

const timerPanelStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 18,
  backgroundColor: 'rgba(15, 23, 42, 0.88)',
  padding: 18,
}

const workoutPanelStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 18,
  backgroundColor: 'rgba(15, 23, 42, 0.82)',
  padding: 16,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
}

const panelLabelStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 18,
  marginBottom: 8,
  fontWeight: 700,
}

const timerTextStyle: React.CSSProperties = {
  fontSize: 110,
  fontWeight: 900,
  letterSpacing: 3,
  lineHeight: 1,
  marginBottom: 16,
}

const timerMetaRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
}

const miniMetricStyle: React.CSSProperties = {
  border: '1px solid #475569',
  borderRadius: 14,
  padding: 12,
  backgroundColor: '#111827',
  minWidth: 0,
}

const miniMetricLabelStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 13,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const miniMetricValueStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 22,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const panelHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 12,
}

const panelTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
}

const panelSubTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#94a3b8',
  fontSize: 15,
}

const exerciseListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  overflow: 'hidden',
}

const exerciseRowStyle: React.CSSProperties = {
  border: '1px solid #475569',
  borderRadius: 12,
  padding: '10px 12px',
  backgroundColor: '#111827',
}

const exerciseNameStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 4,
}

const exercisePrescriptionStyle: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 15,
}

const podsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  alignContent: 'start',
  overflow: 'hidden',
}

const podCardStyle: React.CSSProperties = {
  border: '1px solid #475569',
  borderRadius: 14,
  padding: 14,
  backgroundColor: '#111827',
  minHeight: 140,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
}

const rackNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 2,
}

const podNameStyle: React.CSSProperties = {
  color: '#93c5fd',
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 10,
}

const playerListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  alignContent: 'start',
}

const playerChipStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: '8px 10px',
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.2,
}

const podEmptyStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 15,
}

const emptyStateStyle: React.CSSProperties = {
  border: '1px dashed #475569',
  borderRadius: 14,
  padding: 20,
  color: '#94a3b8',
  backgroundColor: '#111827',
}

const footerMessageStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 14,
}

const centerMessageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 32,
  fontWeight: 800,
}