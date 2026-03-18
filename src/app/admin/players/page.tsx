'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  grad_year: number | null
  positions: string[] | null
  team_level: string | null
  tags: string[] | null
  height: string | null
  weight: number | null
  forty_yard_dash: number | null
  pro_shuttle: number | null
}

type AttendanceLog = {
  id: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

type AttendanceStats = {
  present: number
  absent: number
  late: number
  total: number
  percentage: number
  todayStatus: 'PRESENT' | 'ABSENT' | 'LATE' | null
}

function formatTime(value: number | null) {
  if (value === null || value === undefined) return '—'
  return Number(value).toFixed(2)
}

export default function PlayersPage() {
  const router = useRouter()

  const [players, setPlayers] = useState<Athlete[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [positions, setPositions] = useState('')
  const [teamLevel, setTeamLevel] = useState('')
  const [tags, setTags] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [fortyYardDash, setFortyYardDash] = useState('')
  const [proShuttle, setProShuttle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editGradYear, setEditGradYear] = useState('')
  const [editPositions, setEditPositions] = useState('')
  const [editTeamLevel, setEditTeamLevel] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editHeight, setEditHeight] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editFortyYardDash, setEditFortyYardDash] = useState('')
  const [editProShuttle, setEditProShuttle] = useState('')
  const [editMessage, setEditMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setErrorMessage('')

    const [playersResult, attendanceResult] = await Promise.all([
      supabase
        .from('athletes')
        .select(
          'id, first_name, last_name, grad_year, positions, team_level, tags, height, weight, forty_yard_dash, pro_shuttle'
        )
        .order('last_name', { ascending: true }),

      supabase
        .from('player_attendance_logs')
        .select('id, athlete_id, attendance_date, status')
        .order('attendance_date', { ascending: false }),
    ])

    if (playersResult.error) {
      console.error(playersResult.error)
      setErrorMessage(playersResult.error.message)
      setPlayers([])
    } else {
      setPlayers(playersResult.data || [])
    }

    if (attendanceResult.error) {
      console.error(attendanceResult.error)
      setErrorMessage(attendanceResult.error.message)
      setAttendanceLogs([])
    } else {
      setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    }

    setLoading(false)
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    setSaveMessage('')

    if (!firstName.trim() || !lastName.trim()) {
      setSaveMessage('First name and last name are required.')
      return
    }

    setSaving(true)

    const parsedPositions = positions
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '')

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')

    const parsedGradYear = gradYear.trim() ? Number(gradYear) : null
    const parsedWeight = weight.trim() ? Number(weight) : null
    const parsedForty = fortyYardDash.trim() ? Number(fortyYardDash) : null
    const parsedShuttle = proShuttle.trim() ? Number(proShuttle) : null

    const { error } = await supabase.from('athletes').insert([
      {
        org_id: '11111111-1111-1111-1111-111111111111',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        grad_year: parsedGradYear,
        positions: parsedPositions,
        team_level: teamLevel.trim() || null,
        tags: parsedTags,
        height: height.trim() || null,
        weight: parsedWeight,
        forty_yard_dash: parsedForty,
        pro_shuttle: parsedShuttle,
      },
    ])

    if (error) {
      console.error(error)
      setSaveMessage(`Error: ${error.message}`)
    } else {
      setSaveMessage('Player added successfully.')
      setFirstName('')
      setLastName('')
      setGradYear('')
      setPositions('')
      setTeamLevel('')
      setTags('')
      setHeight('')
      setWeight('')
      setFortyYardDash('')
      setProShuttle('')
      await loadData()
    }

    setSaving(false)
  }

  function startEditPlayer(player: Athlete) {
    setEditingPlayerId(player.id)
    setEditFirstName(player.first_name || '')
    setEditLastName(player.last_name || '')
    setEditGradYear(player.grad_year ? String(player.grad_year) : '')
    setEditPositions(player.positions?.join(', ') || '')
    setEditTeamLevel(player.team_level || '')
    setEditTags(player.tags?.join(', ') || '')
    setEditHeight(player.height || '')
    setEditWeight(player.weight !== null && player.weight !== undefined ? String(player.weight) : '')
    setEditFortyYardDash(
      player.forty_yard_dash !== null && player.forty_yard_dash !== undefined
        ? String(player.forty_yard_dash)
        : ''
    )
    setEditProShuttle(
      player.pro_shuttle !== null && player.pro_shuttle !== undefined
        ? String(player.pro_shuttle)
        : ''
    )
    setEditMessage('')
  }

  function cancelEditPlayer() {
    setEditingPlayerId(null)
    setEditFirstName('')
    setEditLastName('')
    setEditGradYear('')
    setEditPositions('')
    setEditTeamLevel('')
    setEditTags('')
    setEditHeight('')
    setEditWeight('')
    setEditFortyYardDash('')
    setEditProShuttle('')
    setEditMessage('')
  }

  async function handleUpdatePlayer(playerId: string) {
    setEditMessage('')

    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditMessage('First name and last name are required.')
      return
    }

    const parsedPositions = editPositions
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '')

    const parsedTags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')

    const parsedGradYear = editGradYear.trim() ? Number(editGradYear) : null
    const parsedWeight = editWeight.trim() ? Number(editWeight) : null
    const parsedForty = editFortyYardDash.trim() ? Number(editFortyYardDash) : null
    const parsedShuttle = editProShuttle.trim() ? Number(editProShuttle) : null

    const { error } = await supabase
      .from('athletes')
      .update({
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        grad_year: parsedGradYear,
        positions: parsedPositions,
        team_level: editTeamLevel.trim() || null,
        tags: parsedTags,
        height: editHeight.trim() || null,
        weight: parsedWeight,
        forty_yard_dash: parsedForty,
        pro_shuttle: parsedShuttle,
      })
      .eq('id', playerId)

    if (error) {
      console.error(error)
      setEditMessage(`Error: ${error.message}`)
    } else {
      await loadData()
      cancelEditPlayer()
    }
  }

  async function handleDeletePlayer(playerId: string, playerName: string) {
    const confirmed = window.confirm(`Delete ${playerName}?`)
    if (!confirmed) return

    const { error } = await supabase.from('athletes').delete().eq('id', playerId)

    if (error) {
      console.error(error)
      alert(`Error deleting player: ${error.message}`)
    } else {
      await loadData()
    }
  }

  async function handleMarkAttendance(
    athleteId: string,
    status: 'PRESENT' | 'ABSENT' | 'LATE'
  ) {
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('player_attendance_logs').upsert(
      [
        {
          athlete_id: athleteId,
          attendance_date: today,
          status,
        },
      ],
      {
        onConflict: 'athlete_id,attendance_date',
      }
    )

    if (error) {
      console.error(error)
      alert(`Error saving attendance: ${error.message}`)
    } else {
      await loadData()
    }
  }

  function openPlayerProfile(athleteId: string) {
    router.push(`/admin/players/${athleteId}`)
  }

  const attendanceStatsMap = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const stats: Record<string, AttendanceStats> = {}

    for (const player of players) {
      stats[player.id] = {
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
        percentage: 0,
        todayStatus: null,
      }
    }

    for (const log of attendanceLogs) {
      if (!stats[log.athlete_id]) continue

      stats[log.athlete_id].total += 1

      if (log.status === 'PRESENT') stats[log.athlete_id].present += 1
      if (log.status === 'ABSENT') stats[log.athlete_id].absent += 1
      if (log.status === 'LATE') stats[log.athlete_id].late += 1

      if (log.attendance_date === today) {
        stats[log.athlete_id].todayStatus = log.status
      }
    }

    for (const athleteId of Object.keys(stats)) {
      const record = stats[athleteId]
      const attendedCount = record.present + record.late
      record.percentage =
        record.total > 0 ? Math.round((attendedCount / record.total) * 100) : 0
    }

    return stats
  }, [players, attendanceLogs])

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const fullName = `${player.first_name ?? ''} ${player.last_name ?? ''}`.toLowerCase()
      const positionsText = Array.isArray(player.positions)
        ? player.positions.join(' ').toLowerCase()
        : ''
      const team = (player.team_level ?? '').trim()
      const searchText = search.trim().toLowerCase()

      const matchesSearch =
        searchText === '' ||
        fullName.includes(searchText) ||
        positionsText.includes(searchText)

      const matchesTeam =
        teamFilter === 'All' ||
        team.toLowerCase() === teamFilter.toLowerCase()

      return matchesSearch && matchesTeam
    })
  }, [players, search, teamFilter])

  const teamOptions = Array.from(
    new Set(
      players
        .map((p) => (p.team_level ?? '').trim())
        .filter((value) => value !== '')
    )
  )

  const overallPresent = attendanceLogs.filter((l) => l.status === 'PRESENT').length
  const overallAbsent = attendanceLogs.filter((l) => l.status === 'ABSENT').length
  const overallLate = attendanceLogs.filter((l) => l.status === 'LATE').length
  const overallTotal = attendanceLogs.length
  const overallRate =
    overallTotal > 0 ? Math.round(((overallPresent + overallLate) / overallTotal) * 100) : 0

  const varsityCount = players.filter((p) => (p.team_level || '').toLowerCase() === 'varsity').length
  const jvCount = players.filter((p) => (p.team_level || '').toLowerCase() === 'jv').length
  const freshmanCount = players.filter((p) => (p.team_level || '').toLowerCase() === 'freshman').length

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <h1 style={{ marginBottom: 8 }}>Players</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
        View and manage athlete data and attendance.
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
          <div style={statLabelStyle}>Total Players</div>
          <div style={statValueStyle}>{players.length}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Overall Attendance Rate</div>
          <div style={statValueStyle}>{overallRate}%</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Present</div>
          <div style={statValueStyle}>{overallPresent}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Absent</div>
          <div style={statValueStyle}>{overallAbsent}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Late</div>
          <div style={statValueStyle}>{overallLate}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Varsity / JV / Freshman</div>
          <div style={{ ...statValueStyle, fontSize: 22 }}>
            {varsityCount} / {jvCount} / {freshmanCount}
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0, color: '#ffffff' }}>Add Player</h2>

        <form onSubmit={handleAddPlayer}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              placeholder="Grad year"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Team level (Varsity, JV, Freshman)"
              value={teamLevel}
              onChange={(e) => setTeamLevel(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder={`Height (example: 6'1")`}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.1"
              placeholder="Weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="40-yard dash"
              value={fortyYardDash}
              onChange={(e) => setFortyYardDash(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              step="0.01"
              placeholder="Pro shuttle"
              value={proShuttle}
              onChange={(e) => setProShuttle(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Positions (comma separated)"
              value={positions}
              onChange={(e) => setPositions(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={saving} style={buttonStyle}>
            {saving ? 'Saving...' : 'Add Player'}
          </button>
        </form>

        {saveMessage && (
          <p
            style={{
              marginTop: 12,
              color: saveMessage.startsWith('Error') ? '#f87171' : '#4ade80',
            }}
          >
            {saveMessage}
          </p>
        )}
      </div>

      <div style={controlsStyle}>
        <h3 style={{ marginTop: 0, color: '#ffffff' }}>Player Controls</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: '#d4d4d8' }}>Search</label>
          <input
            type="text"
            placeholder="Search by name or position"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: 400 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, color: '#d4d4d8' }}>Team Filter</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ ...inputStyle, maxWidth: 250 }}
          >
            <option value="All">All Teams</option>
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        <button onClick={loadData} style={secondaryButtonStyle}>
          Refresh Players
        </button>

        <p style={{ marginTop: 12, marginBottom: 0, color: '#d4d4d8' }}>
          <strong>Total loaded:</strong> {players.length} &nbsp; | &nbsp;
          <strong>Showing:</strong> {filteredPlayers.length}
        </p>
      </div>

      {loading && <p>Loading players...</p>}

      {!loading && errorMessage && (
        <p style={{ color: '#f87171' }}>Error: {errorMessage}</p>
      )}

      {!loading && !errorMessage && filteredPlayers.length === 0 && (
        <p style={{ color: '#d4d4d8' }}>No players found.</p>
      )}

      {!loading && !errorMessage && filteredPlayers.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredPlayers.map((player) => {
            const stats = attendanceStatsMap[player.id] || {
              present: 0,
              absent: 0,
              late: 0,
              total: 0,
              percentage: 0,
              todayStatus: null,
            }

            return (
              <div
                key={player.id}
                style={{
                  border: '1px solid #52525b',
                  borderRadius: 10,
                  padding: 16,
                  backgroundColor: '#3f3f46',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  color: '#ffffff',
                  cursor: editingPlayerId === player.id ? 'default' : 'pointer',
                }}
                onClick={() => {
                  if (editingPlayerId !== player.id) {
                    openPlayerProfile(player.id)
                  }
                }}
              >
                {editingPlayerId === player.id ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0 }}>Edit Player</h3>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="First name"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Last name"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="number"
                        placeholder="Grad year"
                        value={editGradYear}
                        onChange={(e) => setEditGradYear(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Team level"
                        value={editTeamLevel}
                        onChange={(e) => setEditTeamLevel(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder={`Height (example: 6'1")`}
                        value={editHeight}
                        onChange={(e) => setEditHeight(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="40-yard dash"
                        value={editFortyYardDash}
                        onChange={(e) => setEditFortyYardDash(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder="Pro shuttle"
                        value={editProShuttle}
                        onChange={(e) => setEditProShuttle(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Positions (comma separated)"
                        value={editPositions}
                        onChange={(e) => setEditPositions(e.target.value)}
                        style={inputStyle}
                      />

                      <input
                        type="text"
                        placeholder="Tags (comma separated)"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => handleUpdatePlayer(player.id)} style={buttonStyle}>
                        Save Changes
                      </button>

                      <button onClick={cancelEditPlayer} style={secondaryButtonStyle}>
                        Cancel
                      </button>
                    </div>

                    {editMessage && (
                      <p style={{ marginTop: 12, color: editMessage.startsWith('Error') ? '#f87171' : '#4ade80' }}>
                        {editMessage}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                        {player.first_name} {player.last_name}
                      </h3>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openPlayerProfile(player.id)
                        }}
                        style={viewProfileButtonStyle}
                      >
                        View Profile
                      </button>
                    </div>

                    <p style={{ margin: '4px 0' }}>
                      <strong>Team:</strong> {player.team_level || 'No team'}
                    </p>

                    <p style={{ margin: '4px 0' }}>
                      <strong>Grade:</strong> {player.grad_year ?? '-'}
                    </p>

                    <p style={{ margin: '4px 0' }}>
                      <strong>Height:</strong> {player.height || '—'} &nbsp; | &nbsp;
                      <strong>Weight:</strong> {player.weight ?? '—'} lbs
                    </p>

                    <p style={{ margin: '4px 0' }}>
                      <strong>40:</strong> {formatTime(player.forty_yard_dash)} &nbsp; | &nbsp;
                      <strong>Shuttle:</strong> {formatTime(player.pro_shuttle)}
                    </p>

                    <p style={{ margin: '4px 0' }}>
                      <strong>Positions:</strong>{' '}
                      {player.positions?.length ? player.positions.join(', ') : '—'}
                    </p>

                    <p style={{ margin: '4px 0 12px 0' }}>
                      <strong>Tags:</strong>{' '}
                      {player.tags?.length ? player.tags.join(', ') : '—'}
                    </p>

                    <div
                      style={{
                        border: '1px solid #52525b',
                        borderRadius: 10,
                        padding: 12,
                        backgroundColor: '#27272a',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Attendance</div>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Rate:</strong> {stats.percentage}%
                      </p>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Present:</strong> {stats.present} &nbsp; | &nbsp;
                        <strong>Absent:</strong> {stats.absent} &nbsp; | &nbsp;
                        <strong>Late:</strong> {stats.late}
                      </p>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Today:</strong> {stats.todayStatus || 'Not marked'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAttendance(player.id, 'PRESENT')
                        }}
                        style={attendancePresentButton}
                      >
                        Mark Present
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAttendance(player.id, 'LATE')
                        }}
                        style={attendanceLateButton}
                      >
                        Mark Late
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAttendance(player.id, 'ABSENT')
                        }}
                        style={attendanceAbsentButton}
                      >
                        Mark Absent
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditPlayer(player)
                        }}
                        style={buttonStyle}
                      >
                        Edit
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePlayer(player.id, `${player.first_name} ${player.last_name}`)
                        }}
                        style={deleteButtonStyle}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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

const controlsStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  backgroundColor: '#18181b',
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

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  cursor: 'pointer',
}

const deleteButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #7f1d1d',
  backgroundColor: '#7f1d1d',
  color: '#ffffff',
  cursor: 'pointer',
}

const attendancePresentButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}

const attendanceLateButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #a16207',
  backgroundColor: '#a16207',
  color: '#ffffff',
  cursor: 'pointer',
}

const attendanceAbsentButton: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}

const viewProfileButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
}