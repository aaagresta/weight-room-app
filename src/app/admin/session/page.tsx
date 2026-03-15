'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  grad_year: number | null
  positions: string[] | null
  team_level: string | null
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | ''

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
  attendance_map: Record<string, AttendanceStatus>
  current_block: string | null
  workout_id: string | null
}

export default function SessionPage() {
  const today = new Date().toISOString().split('T')[0]

  const [players, setPlayers] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [liveSessionId, setLiveSessionId] = useState<string | null>(null)

  const [teamFilter, setTeamFilter] = useState('All')
  const [selectedDate, setSelectedDate] = useState(today)
  const [rackCount, setRackCount] = useState(6)

  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [pods, setPods] = useState<Pod[]>([])

  const [minutes, setMinutes] = useState(3)
  const [secondsLeft, setSecondsLeft] = useState(180)
  const [timerRunning, setTimerRunning] = useState(false)

  const [availableWorkouts, setAvailableWorkouts] = useState<DailyWorkout[]>([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')

  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null)

  useEffect(() => {
    initializePage()
  }, [])

  useEffect(() => {
    loadAvailableWorkouts(selectedDate, teamFilter)
  }, [selectedDate, teamFilter])

  useEffect(() => {
    if (!timerRunning || !liveSessionId) return

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev <= 1 ? 0 : prev - 1
        if (next === 0) setTimerRunning(false)
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerRunning, liveSessionId])

  useEffect(() => {
    if (!liveSessionId) return
    saveLiveSession()
  }, [
    liveSessionId,
    selectedDate,
    teamFilter,
    rackCount,
    attendanceMap,
    pods,
    secondsLeft,
    timerRunning,
    selectedWorkoutId,
  ])

  async function initializePage() {
    setLoading(true)
    await loadPlayers()
    await loadOrCreateLiveSession()
    setLoading(false)
  }

  async function loadPlayers() {
    const [athletesResult, playersResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, grad_year, positions, team_level')
        .order('last_name', { ascending: true }),

      supabase
        .from('players')
        .select('id, first_name, last_name, grad_year, positions, team_level')
        .order('last_name', { ascending: true }),
    ])

    const athletesData = !athletesResult.error ? ((athletesResult.data as Athlete[]) || []) : []
    const playersData = !playersResult.error ? ((playersResult.data as Athlete[]) || []) : []

    const combined = [...athletesData, ...playersData]
    const uniqueMap = new Map<string, Athlete>()

    combined.forEach((player) => {
      const key = `${player.first_name}-${player.last_name}-${player.team_level || ''}`.toLowerCase()
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, player)
      }
    })

    const mergedPlayers = Array.from(uniqueMap.values()).sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    )

    if (athletesResult.error && playersResult.error) {
      console.error('athletes error:', athletesResult.error)
      console.error('players error:', playersResult.error)
      setMessage('Error loading roster from athletes and players tables.')
      setPlayers([])
      return
    }

    setPlayers(mergedPlayers)
  }

  async function refreshRoster() {
    await loadPlayers()
    setMessage('Roster refreshed from current player lists.')
  }

  async function loadOrCreateLiveSession() {
    const { data, error } = await supabase
      .from('live_room_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) {
      hydrateLiveSession(data as LiveRoomSession)
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('live_room_sessions')
      .insert([
        {
          session_date: today,
          team: 'All',
          rack_count: 6,
          timer_seconds: 180,
          timer_running: false,
          pods: [],
          attendance_map: {},
          current_block: 'Main Lift',
          workout_id: null,
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error(insertError)
      setMessage(`Error creating live session: ${insertError.message}`)
      return
    }

    hydrateLiveSession(inserted as LiveRoomSession)
  }

  function hydrateLiveSession(session: LiveRoomSession) {
    setLiveSessionId(session.id)
    setSelectedDate(session.session_date || today)
    setTeamFilter(session.team || 'All')
    setRackCount(session.rack_count || 6)
    setSecondsLeft(session.timer_seconds || 180)
    setMinutes(Math.max(1, Math.round((session.timer_seconds || 180) / 60)))
    setTimerRunning(session.timer_running || false)
    setPods((session.pods as Pod[]) || [])
    setAttendanceMap((session.attendance_map as Record<string, AttendanceStatus>) || {})
    setSelectedWorkoutId(session.workout_id || '')
  }

  async function saveLiveSession() {
    if (!liveSessionId) return

    const { error } = await supabase
      .from('live_room_sessions')
      .update({
        session_date: selectedDate,
        team: teamFilter,
        rack_count: rackCount,
        timer_seconds: secondsLeft,
        timer_running: timerRunning,
        pods,
        attendance_map: attendanceMap,
        workout_id: selectedWorkoutId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveSessionId)

    if (error) {
      console.error(error)
    }
  }

  async function loadAvailableWorkouts(dateValue: string, teamValue: string) {
    let query = supabase
      .from('daily_workouts')
      .select('*')
      .eq('workout_date', dateValue)
      .order('created_at', { ascending: false })

    if (teamValue !== 'All') {
      query = query.eq('team_level', teamValue)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      setAvailableWorkouts([])
      return
    }

    setAvailableWorkouts((data as DailyWorkout[]) || [])
  }

  function clearSessionBoard() {
    setAttendanceMap({})
    setPods([])
    setTimerRunning(false)
    setSecondsLeft(minutes * 60)
    setSelectedWorkoutId('')
    setDraggedPlayerId(null)
    setMessage('Session board cleared.')
  }

  const teamOptions = Array.from(
    new Set(
      players
        .map((p) => (p.team_level ?? '').trim())
        .filter((value) => value !== '')
    )
  )

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      if (teamFilter === 'All') return true
      return (player.team_level || '').toLowerCase() === teamFilter.toLowerCase()
    })
  }, [players, teamFilter])

  const presentPlayers = useMemo(() => {
    return filteredPlayers.filter((player) => {
      const status = attendanceMap[player.id]
      return status === 'PRESENT' || status === 'LATE'
    })
  }, [filteredPlayers, attendanceMap])

  const selectedWorkout = useMemo(() => {
    return availableWorkouts.find((w) => w.id === selectedWorkoutId) || null
  }, [availableWorkouts, selectedWorkoutId])

  const assignedPlayerIds = useMemo(() => {
    return new Set(
      pods.flatMap((pod) => pod.players.map((player) => player.id))
    )
  }, [pods])

  const unassignedPresentPlayers = useMemo(() => {
    return presentPlayers.filter((player) => !assignedPlayerIds.has(player.id))
  }, [presentPlayers, assignedPlayerIds])

  function setPlayerAttendance(playerId: string, status: AttendanceStatus) {
    setAttendanceMap((prev) => ({
      ...prev,
      [playerId]: status,
    }))
  }

  function markAllVisible(status: AttendanceStatus) {
    const updated: Record<string, AttendanceStatus> = {}
    filteredPlayers.forEach((player) => {
      updated[player.id] = status
    })

    setAttendanceMap((prev) => ({
      ...prev,
      ...updated,
    }))
  }

  async function saveAttendance() {
    setMessage('')

    const rows = Object.entries(attendanceMap)
      .filter(([, status]) => status === 'PRESENT' || status === 'ABSENT' || status === 'LATE')
      .map(([athlete_id, status]) => ({
        athlete_id,
        attendance_date: selectedDate,
        status,
      }))

    if (rows.length === 0) {
      setMessage('No attendance marked yet.')
      return
    }

    const { error } = await supabase.from('player_attendance_logs').upsert(rows, {
      onConflict: 'athlete_id,attendance_date',
    })

    if (error) {
      console.error(error)
      setMessage(`Error saving attendance: ${error.message}`)
    } else {
      setMessage('Attendance saved successfully.')
    }
  }

  function buildPods() {
    const numberOfPods = rackCount

    const newPods: Pod[] = Array.from({ length: numberOfPods }, (_, index) => ({
      podName: `Pod ${String.fromCharCode(65 + index)}`,
      rackName: `Rack ${index + 1}`,
      players: [],
    }))

    setPods(newPods)
    setMessage('Empty pods created. Drag players into pods or use auto assign.')
  }

 function autoAssignPods() {
  if (pods.length === 0) {
    setMessage('Create pods first.')
    return
  }

  const athletes: Athlete[] = [...presentPlayers]

  if (athletes.length === 0) {
    setMessage('Mark at least one player Present or Late before assigning pods.')
    return
  }

  const clearedPods: Pod[] = pods.map((pod) => ({
    ...pod,
    players: [] as Athlete[],
  }))

  athletes.forEach((athlete, index) => {
    const podIndex = index % clearedPods.length
    const pod = clearedPods[podIndex]

    if (pod) {
      pod.players.push(athlete)
    }
  })

  setPods(clearedPods)
  setMessage('Players auto assigned to pods.')
}
  function removePlayerFromPods(playerId: string) {
    setPods((prev) =>
      prev.map((pod) => ({
        ...pod,
        players: pod.players.filter((player) => player.id !== playerId),
      }))
    )
  }

  function assignPlayerToPod(playerId: string, podName: string) {
    const selectedAthlete = presentPlayers.find((player) => player.id === playerId)
    if (!selectedAthlete) return

    setPods((prev) => {
      const cleaned = prev.map((pod) => ({
        ...pod,
        players: pod.players.filter((player) => player.id !== playerId),
      }))

      return cleaned.map((pod) =>
        pod.podName === podName
          ? { ...pod, players: [...pod.players, selectedAthlete] }
          : pod
      )
    })
  }

  function handleDragStart(playerId: string) {
    setDraggedPlayerId(playerId)
  }

  function handleDropOnPod(podName: string) {
    if (!draggedPlayerId) return
    assignPlayerToPod(draggedPlayerId, podName)
    setDraggedPlayerId(null)
  }

  function handleDropToUnassigned() {
    if (!draggedPlayerId) return
    removePlayerFromPods(draggedPlayerId)
    setDraggedPlayerId(null)
  }

  function rotatePods() {
    if (pods.length <= 1) {
      setMessage('Create at least 2 pods to rotate.')
      return
    }

    const rotated = pods.map((pod, index) => {
      const nextRackIndex = (index + 1) % pods.length
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

    setPods(sorted)
    setSecondsLeft(minutes * 60)
    setTimerRunning(false)
    setMessage('Pods rotated and timer reset.')
  }

  function startTimer() {
    if (secondsLeft <= 0) {
      setSecondsLeft(minutes * 60)
    }
    setTimerRunning(true)
  }

  function pauseTimer() {
    setTimerRunning(false)
  }

  function resetTimer() {
    setTimerRunning(false)
    setSecondsLeft(minutes * 60)
  }

  function applyTimerMinutes(value: number) {
    setMinutes(value)
    setSecondsLeft(value * 60)
    setTimerRunning(false)
  }

  const formattedTime = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60
  ).padStart(2, '0')}`

  const presentCount = filteredPlayers.filter((p) => attendanceMap[p.id] === 'PRESENT').length
  const lateCount = filteredPlayers.filter((p) => attendanceMap[p.id] === 'LATE').length
  const absentCount = filteredPlayers.filter((p) => attendanceMap[p.id] === 'ABSENT').length
  const unmarkedCount = filteredPlayers.length - presentCount - lateCount - absentCount

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <h1 style={{ marginBottom: 8 }}>Start Lift Session</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
        Mark attendance, assign the workout, build pods, control the timer, and run the room.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Players Shown" value={String(filteredPlayers.length)} />
        <StatCard label="Present" value={String(presentCount)} />
        <StatCard label="Late" value={String(lateCount)} />
        <StatCard label="Absent" value={String(absentCount)} />
        <StatCard label="Unmarked" value={String(unmarkedCount)} />
        <StatCard label="Ready For Pods" value={String(presentPlayers.length)} />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Session Controls</h2>

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
              <option value="All">All Teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Racks In Use</label>
            <select
              value={rackCount}
              onChange={(e) => setRackCount(Number(e.target.value))}
              style={inputStyle}
            >
              <option value={5}>5</option>
              <option value={6}>6</option>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Assigned Workout</label>
            <select
              value={selectedWorkoutId}
              onChange={(e) => setSelectedWorkoutId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select saved workout</option>
              {availableWorkouts.map((workout) => (
                <option key={workout.id} value={workout.id}>
                  {workout.title} ({workout.team_level} • {workout.workout_date})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={refreshRoster} style={buttonStyle}>Refresh Roster</button>
          <button onClick={clearSessionBoard} style={secondaryButtonStyle}>Clear Session</button>
          <button onClick={() => markAllVisible('PRESENT')} style={presentButton}>Mark All Present</button>
          <button onClick={() => markAllVisible('LATE')} style={lateButton}>Mark All Late</button>
          <button onClick={() => markAllVisible('ABSENT')} style={absentButton}>Mark All Absent</button>
          <button onClick={saveAttendance} style={buttonStyle}>Save Attendance</button>
          <button onClick={buildPods} style={buttonStyle}>Create Empty Pods</button>
          <button onClick={autoAssignPods} style={buttonStyle}>Auto Assign Pods</button>
        </div>

        {message && (
          <p style={{ color: message.startsWith('Error') ? '#f87171' : '#4ade80', marginBottom: 0 }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Assigned Workout</h2>

        {!selectedWorkoutId && (
          <p style={{ color: '#d4d4d8' }}>No workout selected for this live session.</p>
        )}

        {selectedWorkoutId && !selectedWorkout && (
          <p style={{ color: '#d4d4d8' }}>Selected workout not found.</p>
        )}

        {selectedWorkout && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {selectedWorkout.title}
            </div>
            <div style={{ color: '#a1a1aa', marginBottom: 12 }}>
              {selectedWorkout.team_level} • {selectedWorkout.workout_date}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {selectedWorkout.workout_data?.exercises?.map((exercise, index) => (
                <div key={index} style={podCardStyle}>
                  <div style={{ fontWeight: 700 }}>{exercise.name}</div>
                  <div style={{ color: '#d4d4d8' }}>
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
        )}
      </div>

      <div style={timerPanelStyle}>
        <h2 style={{ marginTop: 0 }}>Live Lift Timer</h2>

        <div style={timerBoardStyle}>
          <div style={{ fontSize: 18, color: '#a1a1aa', marginBottom: 8 }}>Current Interval</div>
          <div style={timerTextStyle}>{formattedTime}</div>
          <div style={{ color: secondsLeft === 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>
            {secondsLeft === 0 ? 'Time is up — rotate racks' : timerRunning ? 'Timer running' : 'Timer paused'}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginTop: 16,
            marginBottom: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Timer Minutes</label>
            <select
              value={minutes}
              onChange={(e) => applyTimerMinutes(Number(e.target.value))}
              style={inputStyle}
            >
              <option value={1}>1 Minute</option>
              <option value={2}>2 Minutes</option>
              <option value={3}>3 Minutes</option>
              <option value={4}>4 Minutes</option>
              <option value={5}>5 Minutes</option>
              <option value={6}>6 Minutes</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={startTimer} style={presentButton}>Start</button>
          <button onClick={pauseTimer} style={lateButton}>Pause</button>
          <button onClick={resetTimer} style={buttonStyle}>Reset</button>
          <button onClick={rotatePods} style={absentButton}>Rotate Pods</button>
          <a href="/admin/session/tv" target="_blank" rel="noreferrer" style={tvLinkStyle}>
            Open TV View
          </a>
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Roster</h2>

        {loading && <p>Loading players...</p>}

        {!loading && filteredPlayers.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No players found for this filter.</p>
        )}

        {!loading && filteredPlayers.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredPlayers.map((player) => {
              const status = attendanceMap[player.id] || ''

              return (
                <div key={player.id} style={playerRowStyle}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {player.first_name} {player.last_name}
                    </div>
                    <div style={{ color: '#a1a1aa', fontSize: 14 }}>
                      {player.team_level || 'No team'} • Grade {player.grad_year ?? '-'}
                    </div>
                  </div>

                  <div style={{ color: '#d4d4d8' }}>
                    {player.positions?.length ? player.positions.join(', ') : '—'}
                  </div>

                  <div>
                    <span style={getStatusBadgeStyle(status)}>
                      {status || 'Not Marked'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setPlayerAttendance(player.id, 'PRESENT')} style={presentButton}>
                      Present
                    </button>
                    <button onClick={() => setPlayerAttendance(player.id, 'LATE')} style={lateButton}>
                      Late
                    </button>
                    <button onClick={() => setPlayerAttendance(player.id, 'ABSENT')} style={absentButton}>
                      Absent
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Drag & Drop Pod Assignment</h2>

        {pods.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>
            Create empty pods first. Then drag present players into pods.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '300px 1fr',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToUnassigned}
              style={{
                border: '2px dashed #52525b',
                borderRadius: 12,
                padding: 16,
                backgroundColor: '#18181b',
                minHeight: 220,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Unassigned Present Players</div>

              {unassignedPresentPlayers.length === 0 ? (
                <p style={{ color: '#a1a1aa', margin: 0 }}>No unassigned present players.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {unassignedPresentPlayers.map((player) => (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={() => handleDragStart(player.id)}
                      style={draggablePlayerStyle}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {player.first_name} {player.last_name}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: 13 }}>
                        {player.team_level || 'No team'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {pods.map((pod) => (
                <div
                  key={pod.podName}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnPod(pod.podName)}
                  style={dropPodStyle}
                >
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{pod.rackName}</div>
                  <div style={{ color: '#93c5fd', marginBottom: 12 }}>{pod.podName}</div>

                  {pod.players.length === 0 ? (
                    <p style={{ color: '#a1a1aa', margin: 0 }}>Drop players here</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {pod.players.map((player) => (
                        <div
                          key={player.id}
                          draggable
                          onDragStart={() => handleDragStart(player.id)}
                          style={draggablePlayerStyle}
                        >
                          <div style={{ fontWeight: 700 }}>
                            {player.first_name} {player.last_name}
                          </div>
                          <div style={{ color: '#a1a1aa', fontSize: 13 }}>
                            {player.team_level || 'No team'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Rack Assignments</h2>

        {pods.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>
            No pods built yet. Create empty pods first.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {pods.map((pod) => (
              <div key={pod.podName} style={podCardStyle}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{pod.rackName}</div>
                <div style={{ color: '#93c5fd', marginBottom: 12 }}>{pod.podName}</div>

                {pod.players.length === 0 ? (
                  <p style={{ color: '#d4d4d8', margin: 0 }}>No players assigned</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {pod.players.map((player) => (
                      <li key={player.id} style={{ marginBottom: 6 }}>
                        {player.first_name} {player.last_name}
                      </li>
                    ))}
                  </ul>
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

function getStatusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'PRESENT') return badge('#166534')
  if (status === 'LATE') return badge('#a16207')
  if (status === 'ABSENT') return badge('#991b1b')
  return badge('#3f3f46')
}

function badge(backgroundColor: string): React.CSSProperties {
  return {
    backgroundColor,
    color: '#ffffff',
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-block',
  }
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
  fontSize: 28,
  fontWeight: 700,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const timerPanelStyle: React.CSSProperties = {
  border: '1px solid #2563eb',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#111827',
}

const timerBoardStyle: React.CSSProperties = {
  border: '1px solid #374151',
  borderRadius: 12,
  padding: 24,
  backgroundColor: '#030712',
  textAlign: 'center',
}

const timerTextStyle: React.CSSProperties = {
  fontSize: 72,
  fontWeight: 800,
  letterSpacing: 2,
  marginBottom: 10,
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

const playerRowStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '1.4fr 1fr 0.9fr 1.8fr',
  gap: 12,
  alignItems: 'center',
}

const podCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  cursor: 'pointer',
}

const presentButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}

const lateButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #a16207',
  backgroundColor: '#a16207',
  color: '#ffffff',
  cursor: 'pointer',
}

const absentButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}

const tvLinkStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
}

const draggablePlayerStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 12,
  backgroundColor: '#27272a',
  cursor: 'grab',
}

const dropPodStyle: React.CSSProperties = {
  border: '2px dashed #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#18181b',
  minHeight: 220,
}
