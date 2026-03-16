'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

type MaxSubmission = {
  id: string
  athlete_id: string
  lift_name: string
  submitted_weight: number
  tested_on: string | null
  notes: string | null
  status: string
  created_at?: string
}

export default function AdminMaxSubmissionsPage() {
  const [players, setPlayers] = useState<Athlete[]>([])
  const [submissions, setSubmissions] = useState<MaxSubmission[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [playersResult, submissionsResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .order('last_name', { ascending: true }),

      supabase
        .from('player_max_submissions')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (playersResult.error) {
      setMessage(`Error loading players: ${playersResult.error.message}`)
      setPlayers([])
    } else {
      setPlayers((playersResult.data as Athlete[]) || [])
    }

    if (submissionsResult.error) {
      setMessage(`Error loading submissions: ${submissionsResult.error.message}`)
      setSubmissions([])
    } else {
      setSubmissions((submissionsResult.data as MaxSubmission[]) || [])
    }

    setLoading(false)
  }

  async function approveSubmission(submission: MaxSubmission) {
    const { error: maxError } = await supabase.from('player_lift_maxes').upsert(
      [
        {
          athlete_id: submission.athlete_id,
          lift_name: submission.lift_name,
          max_weight: submission.submitted_weight,
          tested_on: submission.tested_on,
          notes: submission.notes,
        },
      ],
      {
        onConflict: 'athlete_id,lift_name',
      }
    )

    if (maxError) {
      setMessage(`Error approving submission: ${maxError.message}`)
      return
    }

    const { error: submissionError } = await supabase
      .from('player_max_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)

    if (submissionError) {
      setMessage(`Submission approved, but status update failed: ${submissionError.message}`)
      return
    }

    setMessage('Submission approved.')
    await loadData()
  }

  async function rejectSubmission(id: string) {
    const { error } = await supabase
      .from('player_max_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setMessage(`Error rejecting submission: ${error.message}`)
      return
    }

    setMessage('Submission rejected.')
    await loadData()
  }

  const pendingRows = useMemo(() => {
    return submissions
      .filter((s) => s.status === 'pending')
      .map((submission) => {
        const player = players.find((p) => p.id === submission.athlete_id)
        return {
          ...submission,
          athleteName: player ? `${player.first_name} ${player.last_name}` : 'Unknown Player',
          teamLevel: player?.team_level || 'No team',
        }
      })
  }, [submissions, players])

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Max Submissions</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Review player-submitted PRs and max updates.
          </p>
        </div>

        <a href="/admin" style={navLinkStyle}>
          Back to Admin
        </a>
      </div>

      {message && (
        <p style={{ color: message.startsWith('Error') ? '#f87171' : '#4ade80' }}>
          {message}
        </p>
      )}

      {loading && <p>Loading...</p>}

      {!loading && pendingRows.length === 0 && (
        <div style={panelStyle}>
          <p style={{ color: '#d4d4d8', margin: 0 }}>No pending submissions.</p>
        </div>
      )}

      {!loading && pendingRows.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {pendingRows.map((submission) => (
            <div key={submission.id} style={cardStyle}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{submission.athleteName}</div>
                <div style={{ color: '#a1a1aa', marginBottom: 8 }}>{submission.teamLevel}</div>
                <div><strong>{submission.lift_name}</strong> — {submission.submitted_weight} lbs</div>
                <div style={{ color: '#d4d4d8' }}>
                  Tested: {submission.tested_on || '—'}
                </div>
                <div style={{ color: '#d4d4d8' }}>
                  Notes: {submission.notes || '—'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => approveSubmission(submission)}
                  style={approveButtonStyle}
                >
                  Approve
                </button>

                <button
                  onClick={() => rejectSubmission(submission.id)}
                  style={rejectButtonStyle}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  backgroundColor: '#18181b',
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

const approveButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}

const rejectButtonStyle: React.CSSProperties = {
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