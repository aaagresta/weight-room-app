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

type AttendanceLog = {
  id?: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0]

  const [players, setPlayers] = useState<Athlete[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [selectedDate, setSelectedDate] = useState(today)
  const [teamFilter, setTeamFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate])

  async function loadData(date: string) {
    setLoading(true)
    setMessage('')

    const [playersResult, attendanceResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, grad_year, positions, team_level')
        .order('last_name', { ascending: true }),

      supabase
        .from('player_attendance_logs')
        .select('id, athlete_id, attendance_date, status')
        .eq('attendance_date', date),
    ])

    if (playersResult.error) {
      console.error(playersResult.error)
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
    } else {
      setPlayers(playersResult.data || [])
    }

    if (attendanceResult.error) {
      console.error(attendanceResult.error)
      setMessage(`Error loading attendance: ${attendanceResult.error.message}`)
      setAttendanceLogs([])
    } else {
      setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    }

    setLoading(false)
  }

  function getPlayerStatus(playerId: string): 'PRESENT' | 'ABSENT' | 'LATE' | '' {
    const record = attendanceLogs.find((log) => log.athlete_id === playerId)
    return record?.status || ''
  }

  function setPlayerStatus(playerId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') {
    setAttendanceLogs((prev) => {
      const existing = prev.find((log) => log.athlete_id === playerId)

      if (existing) {
        return prev.map((log) =>
          log.athlete_id === playerId ? { ...log, status } : log
        )
      }

      return [
        ...prev,
        {
          athlete_id: playerId,
          attendance_date: selectedDate,
          status,
        },
      ]
    })
  }

  async function saveAttendance() {
    setSaving(true)
    setMessage('')

    if (attendanceLogs.length === 0) {
      setMessage('No attendance records to save.')
      setSaving(false)
      return
    }

    const payload = attendanceLogs.map((log) => ({
      athlete_id: log.athlete_id,
      attendance_date: selectedDate,
      status: log.status,
    }))

    const { error } = await supabase.from('player_attendance_logs').upsert(payload, {
      onConflict: 'athlete_id,attendance_date',
    })

    if (error) {
      console.error(error)
      setMessage(`Error saving attendance: ${error.message}`)
    } else {
      setMessage('Attendance saved successfully.')
      await loadData(selectedDate)
    }

    setSaving(false)
  }

  function markAllVisible(status: 'PRESENT' | 'ABSENT' | 'LATE') {
    const updatedLogs: AttendanceLog[] = filteredPlayers.map((player) => ({
      athlete_id: player.id,
      attendance_date: selectedDate,
      status,
    }))

    setAttendanceLogs((prev) => {
      const otherLogs = prev.filter(
        (log) => !filteredPlayers.some((player) => player.id === log.athlete_id)
      )
      return [...otherLogs, ...updatedLogs]
    })
  }

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      if (teamFilter === 'All') return true
      return (player.team_level || '').toLowerCase() === teamFilter.toLowerCase()
    })
  }, [players, teamFilter])

  const teamOptions = Array.from(
    new Set(
      players
        .map((p) => (p.team_level ?? '').trim())
        .filter((value) => value !== '')
    )
  )

  const summary = useMemo(() => {
    const visibleIds = new Set(filteredPlayers.map((p) => p.id))
    const visibleLogs = attendanceLogs.filter((log) => visibleIds.has(log.athlete_id))

    const present = visibleLogs.filter((l) => l.status === 'PRESENT').length
    const absent = visibleLogs.filter((l) => l.status === 'ABSENT').length
    const late = visibleLogs.filter((l) => l.status === 'LATE').length
    const marked = visibleLogs.length
    const total = filteredPlayers.length

    return { present, absent, late, marked, total }
  }, [filteredPlayers, attendanceLogs])

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <h1 style={{ marginBottom: 8 }}>Attendance</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
        Mark and track attendance for your team by date.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Players Shown</div>
          <div style={statValueStyle}>{summary.total}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Marked</div>
          <div style={statValueStyle}>{summary.marked}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Present</div>
          <div style={statValueStyle}>{summary.present}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Late</div>
          <div style={statValueStyle}>{summary.late}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Absent</div>
          <div style={statValueStyle}>{summary.absent}</div>
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Attendance Controls</h2>

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
            <label style={labelStyle}>Team Filter</label>
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
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => markAllVisible('PRESENT')} style={presentButton}>
            Mark All Visible Present
          </button>

          <button onClick={() => markAllVisible('LATE')} style={lateButton}>
            Mark All Visible Late
          </button>

          <button onClick={() => markAllVisible('ABSENT')} style={absentButton}>
            Mark All Visible Absent
          </button>

          <button onClick={saveAttendance} disabled={saving} style={buttonStyle}>
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>

        {message && (
          <p style={{ color: message.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Team Roster</h2>

        {loading && <p>Loading attendance...</p>}

        {!loading && filteredPlayers.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No players found for this team filter.</p>
        )}

        {!loading && filteredPlayers.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredPlayers.map((player) => {
              const status = getPlayerStatus(player.id)

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
                    <button
                      onClick={() => setPlayerStatus(player.id, 'PRESENT')}
                      style={presentButton}
                    >
                      Present
                    </button>

                    <button
                      onClick={() => setPlayerStatus(player.id, 'LATE')}
                      style={lateButton}
                    >
                      Late
                    </button>

                    <button
                      onClick={() => setPlayerStatus(player.id, 'ABSENT')}
                      style={absentButton}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  if (status === 'PRESENT') {
    return {
      backgroundColor: '#166534',
      color: '#ffffff',
      padding: '8px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-block',
    }
  }

  if (status === 'LATE') {
    return {
      backgroundColor: '#a16207',
      color: '#ffffff',
      padding: '8px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-block',
    }
  }

  if (status === 'ABSENT') {
    return {
      backgroundColor: '#991b1b',
      color: '#ffffff',
      padding: '8px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-block',
    }
  }

  return {
    backgroundColor: '#3f3f46',
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
  gridTemplateColumns: '1.5fr 1fr 0.8fr 1.8fr',
  gap: 12,
  alignItems: 'center',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
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