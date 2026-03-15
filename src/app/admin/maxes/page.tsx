'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

type LiftMax = {
  id: string
  athlete_id: string
  lift_name: string
  max_weight: number
  estimated_one_rm: number | null
  tested_on: string | null
  notes: string | null
  created_at?: string
}

const MAIN_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Hang Clean',
  'Front Squat',
  'Overhead Press',
]

export default function AdminMaxesPage() {
  const today = new Date().toISOString().split('T')[0]

  const [players, setPlayers] = useState<Athlete[]>([])
  const [maxes, setMaxes] = useState<LiftMax[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [teamFilter, setTeamFilter] = useState('All')
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [selectedLift, setSelectedLift] = useState(MAIN_LIFTS[0])
  const [maxWeight, setMaxWeight] = useState('')
  const [estimatedOneRm, setEstimatedOneRm] = useState('')
  const [testedOn, setTestedOn] = useState(today)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [playersResult, maxesResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .order('last_name', { ascending: true }),

      supabase
        .from('player_lift_maxes')
        .select('*')
        .order('lift_name', { ascending: true }),
    ])

    if (playersResult.error) {
      console.error(playersResult.error)
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
    } else {
      setPlayers((playersResult.data as Athlete[]) || [])
    }

    if (maxesResult.error) {
      console.error(maxesResult.error)
      setMessage(`Error loading maxes: ${maxesResult.error.message}`)
      setMaxes([])
    } else {
      setMaxes((maxesResult.data as LiftMax[]) || [])
    }

    setLoading(false)
  }

  async function handleSaveMax(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!selectedAthleteId) {
      setMessage('Please choose a player.')
      return
    }

    if (!selectedLift) {
      setMessage('Please choose a lift.')
      return
    }

    if (!maxWeight.trim()) {
      setMessage('Please enter a max weight.')
      return
    }

    const parsedMaxWeight = Number(maxWeight)
    const parsedEstimatedOneRm = estimatedOneRm.trim() ? Number(estimatedOneRm) : null

    if (Number.isNaN(parsedMaxWeight)) {
      setMessage('Max weight must be a valid number.')
      return
    }

    const { error } = await supabase.from('player_lift_maxes').upsert(
      [
        {
          athlete_id: selectedAthleteId,
          lift_name: selectedLift,
          max_weight: parsedMaxWeight,
          estimated_one_rm: parsedEstimatedOneRm,
          tested_on: testedOn || null,
          notes: notes.trim() || null,
        },
      ],
      {
        onConflict: 'athlete_id,lift_name',
      }
    )

    if (error) {
      console.error(error)
      setMessage(`Error saving max: ${error.message}`)
      return
    }

    setMessage('Lift max saved successfully.')
    setSelectedAthleteId('')
    setSelectedLift(MAIN_LIFTS[0])
    setMaxWeight('')
    setEstimatedOneRm('')
    setTestedOn(today)
    setNotes('')

    await loadData()
  }

  async function handleDeleteMax(id: string) {
    const confirmed = window.confirm('Delete this lift max?')
    if (!confirmed) return

    const { error } = await supabase
      .from('player_lift_maxes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error)
      setMessage(`Error deleting max: ${error.message}`)
      return
    }

    setMessage('Lift max deleted.')
    await loadData()
  }

  const teamOptions = Array.from(
    new Set(
      players
        .map((p) => (p.team_level ?? '').trim())
        .filter((value) => value !== '')
    )
  )

  const filteredPlayers = useMemo(() => {
    if (teamFilter === 'All') return players

    return players.filter(
      (player) => (player.team_level || '').toLowerCase() === teamFilter.toLowerCase()
    )
  }, [players, teamFilter])

  const maxesWithNames = useMemo(() => {
    return maxes
      .map((max) => {
        const player = players.find((p) => p.id === max.athlete_id)

        return {
          ...max,
          athleteName: player
            ? `${player.first_name} ${player.last_name}`
            : 'Unknown Player',
          teamLevel: player?.team_level || 'No team',
        }
      })
      .filter((max) => {
        if (teamFilter === 'All') return true
        return max.teamLevel.toLowerCase() === teamFilter.toLowerCase()
      })
      .sort((a, b) => {
        if (a.athleteName === b.athleteName) {
          return a.lift_name.localeCompare(b.lift_name)
        }
        return a.athleteName.localeCompare(b.athleteName)
      })
  }, [maxes, players, teamFilter])

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
          <h1 style={{ marginBottom: 8 }}>Player Maxes</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Track PRs and training maxes for your main lifts.
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
        <StatCard label="Players" value={String(filteredPlayers.length)} />
        <StatCard label="Tracked Maxes" value={String(maxesWithNames.length)} />
        <StatCard label="Main Lifts" value={String(MAIN_LIFTS.length)} />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Add or Update a Max</h2>

        <form onSubmit={handleSaveMax}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
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

            <div>
              <label style={labelStyle}>Player</label>
              <select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select Player</option>
                {filteredPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.first_name} {player.last_name}
                    {player.team_level ? ` (${player.team_level})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Lift</label>
              <select
                value={selectedLift}
                onChange={(e) => setSelectedLift(e.target.value)}
                style={inputStyle}
              >
                {MAIN_LIFTS.map((lift) => (
                  <option key={lift} value={lift}>
                    {lift}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Max Weight</label>
              <input
                type="number"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                style={inputStyle}
                placeholder="Example: 225"
              />
            </div>

            <div>
              <label style={labelStyle}>Estimated 1RM (optional)</label>
              <input
                type="number"
                value={estimatedOneRm}
                onChange={(e) => setEstimatedOneRm(e.target.value)}
                style={inputStyle}
                placeholder="Example: 245"
              />
            </div>

            <div>
              <label style={labelStyle}>Tested On</label>
              <input
                type="date"
                value={testedOn}
                onChange={(e) => setTestedOn(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={inputStyle}
              placeholder="Optional notes"
            />
          </div>

          <button type="submit" style={buttonStyle}>
            Save Max
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: 12,
              color: message.startsWith('Error') ? '#f87171' : '#4ade80',
            }}
          >
            {message}
          </p>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Current Maxes</h2>

        {loading && <p>Loading maxes...</p>}

        {!loading && maxesWithNames.length === 0 && (
          <p style={{ color: '#d4d4d8' }}>No maxes saved yet.</p>
        )}

        {!loading && maxesWithNames.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {maxesWithNames.map((max) => (
              <div key={max.id} style={maxCardStyle}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{max.athleteName}</div>
                  <div style={{ color: '#a1a1aa' }}>{max.teamLevel}</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Lift</div>
                  <div>{max.lift_name}</div>
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

                <div>
                  <div style={smallLabelStyle}>Notes</div>
                  <div>{max.notes || '—'}</div>
                </div>

                <div>
                  <button
                    onClick={() => handleDeleteMax(max.id)}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
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
  border: '1px solid #166534',
  backgroundColor: '#166534',
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

const maxCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 10,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 0.8fr 0.9fr 0.9fr 1fr auto',
  gap: 12,
  alignItems: 'center',
}
