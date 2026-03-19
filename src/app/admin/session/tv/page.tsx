'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

  const [minutes, setMinutes] = useState(10)
  const [saving, setSaving] = useState(false)

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
    setMinutes(Math.min(60, Math.max(1, Math.ceil((typedSession.timer_seconds || 600) / 60))))

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

  async function updateSessionTimer(updates: Partial<LiveRoomSession>) {
    if (!session) return

    setSaving(true)

    const { data, error } = await supabase
      .from('live_room_sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single()

    if (error) {
      setMessage(`Could not update timer: ${error.message}`)
      setSaving(false)
      return
    }

    const typedSession = data as LiveRoomSession
    setSession(typedSession)
    setMinutes(Math.min(60, Math.max(1, Math.ceil((typedSession.timer_seconds || 600) / 60))))
    setSaving(false)
  }

  async function applyTimerMinutes(value: number) {
    if (!session) return
    const safeValue = Math.min(60, Math.max(1, value))
    await updateSessionTimer({
      timer_seconds: safeValue * 60,
      timer_running: false,
    })
  }

  async function adjustTimerMinutes(delta: number) {
    const nextMinutes = Math.min(60, Math.max(1, minutes + delta))
    await applyTimerMinutes(nextMinutes)
  }

  async function adjustTimerSeconds(delta: number) {
    if (!session) return
    const nextSeconds = Math.min(3600, Math.max(30, (session.timer_seconds || 0) + delta))
    await updateSessionTimer({
      timer_seconds: nextSeconds,
      timer_running: false,
    })
  }

  async function startTimer() {
    if (!session) return

    const nextSeconds =
      (session.timer_seconds || 0) <= 0 ? minutes * 60 : session.timer_seconds

    await updateSessionTimer({
      timer_seconds: nextSeconds,
      timer_running: true,
    })
  }

  async function pauseTimer() {
    if (!session) return
    await updateSessionTimer({
      timer_running: false,
    })
  }

  async function resetTimer() {
    if (!session) return
    await updateSessionTimer({
      timer_seconds: minutes * 60,
      timer_running: false,
    })
  }

  async function rotatePods() {
    if (!session) return

    if (!session.pods || session.pods.length <= 1) {
      setMessage('Create at least 2 pods to rotate.')
      return
    }

    const rotated = session.pods.map((pod, index) => {
      const nextRackIndex = (index + 1) % session.pods.length
      return {
        ...pod,
        rackName: `Rack ${nextRackIndex + 1}`,
      }
    })

    const sorted = [...rotated].sort((a, b) => {
      const aNum = Number(a.rackName.replace('Rack ', ''))
      const bNum = Number(b.rackName.replace('Rack ', ''))
      return aNum - bNum
    })

    await updateSessionTimer({
      pods: sorted,
      timer_seconds: minutes * 60,
      timer_running: false,
    })
  }

  const formattedTime = useMemo(() => {
    const totalSeconds = session?.timer_seconds ?? 0
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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
    <main style={screenStyle}>
      <div style={frameStyle}>
        <div style={topUtilityBarStyle}>
          <Link href="/admin/session" style={exitTvButtonStyle}>
            Exit TV Mode
          </Link>
        </div>

        <div style={contentGridStyle}>
          <div style={leftColumnStyle}>
            <section style={timerPanelStyle}>
              <div style={timerBoardStyle}>
                <div style={timerTextStyle}>{formattedTime}</div>

                <div
                  style={{
                    color: session.timer_seconds === 0 ? '#f87171' : '#4ade80',
                    fontWeight: 900,
                    fontSize: 28,
                    marginTop: 8,
                  }}
                >
                  {session.timer_seconds === 0
                    ? 'Rotate pods'
                    : session.timer_running
                    ? 'Running'
                    : 'Paused'}
                </div>
              </div>

              <div style={compactControlsWrapStyle}>
                <div style={presetRowStyle}>
                  {[1, 2, 3, 5, 10, 15, 20].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyTimerMinutes(preset)}
                      style={{
                        ...presetButtonStyle,
                        ...(minutes === preset ? presetButtonActiveStyle : {}),
                      }}
                      disabled={saving}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                <div style={controlsRowStyle}>
                  <div style={selectWrapStyle}>
                    <label style={labelStyle}>Minutes</label>
                    <select
                      value={minutes}
                      onChange={(e) => applyTimerMinutes(Number(e.target.value))}
                      style={inputStyle}
                      disabled={saving}
                    >
                      {Array.from({ length: 60 }, (_, i) => i + 1).map((minute) => (
                        <option key={minute} value={minute}>
                          {minute} min
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={quickRowStyle}>
                    <button
                      onClick={() => adjustTimerMinutes(-1)}
                      style={smallTimerButtonStyle}
                      disabled={saving || minutes <= 1}
                    >
                      -1m
                    </button>
                    <button
                      onClick={() => adjustTimerMinutes(1)}
                      style={smallTimerButtonStyle}
                      disabled={saving || minutes >= 60}
                    >
                      +1m
                    </button>
                    <button
                      onClick={() => adjustTimerSeconds(-30)}
                      style={smallTimerButtonStyle}
                      disabled={saving || (session.timer_seconds ?? 0) <= 30}
                    >
                      -30s
                    </button>
                    <button
                      onClick={() => adjustTimerSeconds(30)}
                      style={smallTimerButtonStyle}
                      disabled={saving || (session.timer_seconds ?? 0) >= 3600}
                    >
                      +30s
                    </button>
                  </div>
                </div>

                <div style={timerButtonRowStyle}>
                  <button onClick={startTimer} style={startButtonStyle} disabled={saving}>
                    Start
                  </button>
                  <button onClick={pauseTimer} style={pauseButtonStyle} disabled={saving}>
                    Pause
                  </button>
                  <button onClick={resetTimer} style={resetButtonStyle} disabled={saving}>
                    Reset
                  </button>
                  <button onClick={rotatePods} style={rotateButtonStyle} disabled={saving}>
                    Rotate
                  </button>
                </div>
              </div>
            </section>

            <section style={workoutPanelStyle}>
              <div style={workoutHeaderRowStyle}>
                <div style={panelTitleStyle}>Assigned Workout</div>
                {workout && (
                  <div style={workoutTitleMetaStyle}>
                    {workout.title} • {workout.team_level}
                  </div>
                )}
              </div>

              {!workout ? (
                <div style={emptyStateStyle}>No workout selected for this session.</div>
              ) : (
                <div style={exerciseListStyle}>
                  {workoutExercises.map((exercise, index) => (
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
            </section>
          </div>

          <section style={rightColumnStyle}>
            {session.pods.length === 0 ? (
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
                        {pod.players.slice(0, 10).map((player) => (
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
          </section>
        </div>

        {message && <div style={footerMessageStyle}>{message}</div>}
      </div>
    </main>
  )
}

const screenStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  background: '#000000',
  color: '#ffffff',
  padding: 0,
  margin: 0,
  boxSizing: 'border-box',
}

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '40px 1fr auto',
  gap: 0,
  minWidth: 0,
  margin: 0,
  padding: 0,
}

const topUtilityBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  padding: '4px 8px',
  backgroundColor: '#000000',
  boxSizing: 'border-box',
}

const exitTvButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #374151',
  backgroundColor: '#111827',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
}

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40% 60%',
  gap: 0,
  minHeight: 0,
  minWidth: 0,
  width: '100%',
  height: '100%',
}

const leftColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: '52% 48%',
  gap: 0,
  minHeight: 0,
  minWidth: 0,
  height: '100%',
}

const rightColumnStyle: React.CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  backgroundColor: '#0b1120',
  borderLeft: '2px solid #1f2937',
  padding: 8,
  boxSizing: 'border-box',
}

const timerPanelStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 8,
  backgroundColor: '#020617',
  borderBottom: '2px solid #1f2937',
  boxSizing: 'border-box',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto auto',
  gap: 8,
}

const workoutPanelStyle: React.CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  padding: 8,
  backgroundColor: '#111827',
  boxSizing: 'border-box',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
}

const timerBoardStyle: React.CSSProperties = {
  border: '2px solid #374151',
  borderRadius: 12,
  padding: 14,
  backgroundColor: '#000000',
  textAlign: 'center',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
}

const timerTextStyle: React.CSSProperties = {
  fontSize: 130,
  fontWeight: 900,
  letterSpacing: 2,
  lineHeight: 1,
}

const compactControlsWrapStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
}

const presetRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
}

const presetButtonStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 800,
  minWidth: 0,
}

const presetButtonActiveStyle: React.CSSProperties = {
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
}

const controlsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '130px 1fr',
  gap: 6,
  alignItems: 'end',
}

const selectWrapStyle: React.CSSProperties = {
  minWidth: 0,
}

const quickRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'end',
}

const timerButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
}

const workoutHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 8,
  marginBottom: 8,
  flexWrap: 'wrap',
}

const panelTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
}

const workoutTitleMetaStyle: React.CSSProperties = {
  color: '#93c5fd',
  fontSize: 11,
  fontWeight: 700,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: '#d4d4d8',
  fontSize: 12,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
}

const startButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
}

const pauseButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #a16207',
  backgroundColor: '#a16207',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
}

const resetButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
}

const rotateButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
}

const smallTimerButtonStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 800,
}


const exerciseListStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
  overflow: 'hidden',
  alignContent: 'start',
}

const exerciseRowStyle: React.CSSProperties = {
  border: '1px solid #475569',
  borderRadius: 10,
  padding: '6px 8px',
  backgroundColor: '#0b1120',
  minWidth: 0,
}

const exerciseNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 3,
  lineHeight: 1.1,
}

const exercisePrescriptionStyle: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.15,
}


const podsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 8,
  alignContent: 'start',
  overflow: 'hidden',
  minWidth: 0,
}

const podCardStyle: React.CSSProperties = {
  border: '1px solid #475569',
  borderRadius: 14,
  padding: 10,
  backgroundColor: '#111827',
  minHeight: 110,
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr',
  minWidth: 0,
}

const rackNameStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  marginBottom: 2,
}

const podNameStyle: React.CSSProperties = {
  color: '#93c5fd',
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 8,
}

const playerListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  alignContent: 'start',
}

const playerChipStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: '8px 10px',
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.2,
}

const podEmptyStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
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
  padding: '4px 8px',
  backgroundColor: '#000000',
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