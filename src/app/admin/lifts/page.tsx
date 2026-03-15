'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
  positions: string[] | null
}

type LiftLog = {
  id: string
  athlete_id: string
  session_date: string
  exercise: string
  set_number: number
  weight: number | null
  reps: number | null
  notes: string | null
  created_at: string
}

export default function LiftsPage() {
  const today = new Date().toISOString().split('T')[0]

  const [players, setPlayers] = useState<Athlete[]>([])
  const [logs, setLogs] = useState<LiftLog[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [selectedDate, setSelectedDate] = useState(today)
  const [teamFilter, setTeamFilter] = useState('All')
  const [athleteId, setAthleteId] = useState('')
  const [exercise, setExercise] = useState('Bench Press')
  const [setNumber, setSetNumber] = useState('1')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedDate])

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [playersResult, logsResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level, positions')
        .order('last_name', { ascending: true }),
      supabase
        .from('player_lift_logs')
        .select('*')
        .eq('session_date', selectedDate)
        .order('created_at', { ascending: false }),
    ])

    if (playersResult.error) {
      console.error(playersResult.error)
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
    } else {
      setPlayers(playersResult.data || [])
    }

    if (logsResult.error) {
      console.error(logsResult.error)
      setMessage(`Error loading lift logs: ${logsResult.error.message}`)
      setLogs([])
    } else {
      setLogs((logsResult.data as LiftLog[]) || [])
    }

    setLoading(false)
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!athleteId) {
      setMessage('Please choose a player.')
      return
    }

    if (!exercise.trim()) {
      setMessage('Please enter an exercise.')
      return
    }

    const parsedSet = Number(setNumber)
    const parsedWeight = weight.trim() ? Number(weight) : null
    const parsedReps = reps.trim() ? Number(reps) : null

    const { error } = await supabase.from('player_lift_logs').insert([
      {
        athlete_id: athleteId,
        session_date: selectedDate,
        exercise: exercise.trim(),
        set_number: parsedSet,
        weight: parsedWeight,
        reps: parsedReps,
        notes: notes.trim() || null,
      },
    ])

    if (error) {
      console.error(error)
      setMessage(`Error saving lift log: ${error.message}`)
      return
    }

    setMessage('Lift log saved.')
    setSetNumber('1')
    setWeight('')
    setReps('')
    setNotes('')
    await loadData()
  }

  async function handleDeleteLog(id: string) {
    const confirmed = window.confirm('Delete this lift log?')
    if (!confirmed) return

    const { error } = await supabase.from('player_lift_logs').delete().eq('id', id)

    if (error) {
      console.error(error)
      setMessage(`Error deleting log: ${error.message}`)
      return
    }

    await loadData()
  }

  const teamOptions = Array.from(
    new Set(players.map((p) => (p.team_level ?? '').trim()).filter(Boolean))
  )

  const filteredPlayers = useMemo(() => {
    if (teamFilter === 'All') return players
    return players.filter(
      (player) => (player.team_level || '').toLowerCase() === teamFilter.toLowerCase()
    )
  }, [players, teamFilter])

  const logsWithNames = useMemo(() => {
    return logs
      .map((log) => {
        const player = players.find((p) => p.id === log.athlete_id)
        return {
          ...log,
          athleteName: player ? `${player.first_name} ${player.last_name}` : 'Unknown Player',
          team: player?.team_level || 'No team',
        }
      })
      .filter((log) => {
        if (teamFilter === 'All') return true
        return log.team.toLowerCase() === teamFilter.toLowerCase()
      })
  }, [logs, players, teamFilter])

  return (
    <div style={{ padding: 24, backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <h1 style={{ marginBottom: 8 }}>Lift Logging</h1>
      <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
        Record sets, weights, and reps for each athlete.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Players" value={String(filteredPlayers.length)} />
        <StatCard label="Logs Today" value={String(logsWithNames.length)} />
        <StatCard label="Selected Date" value={selectedDate} />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Log a Lift</h2>

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

        <form onSubmit={handleAddLog}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} style={inputStyle}>
              <option value="">Select Player</option>
              {filteredPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.first_name} {player.last_name}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              placeholder="Exercise"
              style={inputStyle}
            />

            <input
              type="number"
              value={setNumber}
              onChange={(e) => setSetNumber(e.target.value)}
              placeholder="Set #"
              style={inputStyle}
            />

            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight"
              style={inputStyle}
            />

            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="Reps"
              style={inputStyle}
            />

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={buttonStyle}>
            Save Lift Log
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 12, color: message.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Today’s Lift Logs</h2>

        {loading && <p>Loading logs...</p>}

        {!loading && logsWithNames.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No lift logs for this date yet.</p>
        )}

        {!loading && logsWithNames.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {logsWithNames.map((log) => (
              <div key={log.id} style={logCardStyle}>
                <div>
                  <div style={{ fontWeight: 700 }}>{log.athleteName}</div>
                  <div style={{ color: '#a1a1aa', fontSize: 14 }}>{log.team}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Exercise</div>
                  <div>{log.exercise}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Set</div>
                  <div>{log.set_number}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Weight</div>
                  <div>{log.weight ?? '—'}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Reps</div>
                  <div>{log.reps ?? '—'}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Notes</div>
                  <div>{log.notes || '—'}</div>
                </div>

                <div>
                  <button onClick={() => handleDeleteLog(log.id)} style={deleteButtonStyle}>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
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
  fontSize: 24,
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

const smallLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 12,
  marginBottom: 4,
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
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}

const logCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '1.3fr 1fr 0.7fr 0.7fr 0.7fr 1fr auto',
  gap: 12,
  alignItems: 'center',
}
