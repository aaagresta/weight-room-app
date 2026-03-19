'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  requested_role: string | null
  approval_status: string | null
  athlete_id: string | null
}

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

function getRequestedRole(profile: ProfileRow) {
  return (profile.requested_role || profile.role || '').toLowerCase()
}

export default function AccountApprovalsPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [selectedAthleteMap, setSelectedAthleteMap] = useState<Record<string, string>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [profilesResult, athletesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, requested_role, approval_status, athlete_id')
        .eq('approval_status', 'pending')
        .order('id', { ascending: true }),

      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .order('last_name', { ascending: true }),
    ])

    if (profilesResult.error) {
      setMessage(`Error loading profiles: ${profilesResult.error.message}`)
      setProfiles([])
    } else {
      setProfiles((profilesResult.data as ProfileRow[]) || [])
    }

    if (athletesResult.error) {
      setMessage(`Error loading athletes: ${athletesResult.error.message}`)
      setAthletes([])
    } else {
      setAthletes((athletesResult.data as Athlete[]) || [])
    }

    setLoading(false)
  }

  function splitName(fullName: string | null) {
    const raw = (fullName || '').trim()
    if (!raw) return { firstName: 'New', lastName: 'Player' }

    const parts = raw.split(/\s+/)
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: parts[0] }
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    }
  }

  async function approveProfile(profile: ProfileRow) {
    setMessage('')

    const requestedRole = getRequestedRole(profile)

   if (requestedRole === 'coach' || requestedRole === 'admin') {
  const { error } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      requested_role: 'coach',
      approval_status: 'approved',
    })
    .eq('id', profile.id)

  if (error) {
    setMessage(`Error approving coach: ${error.message}`)
    return
  }

  const { error: coachError } = await supabase
    .from('coaches')
    .upsert(
      {
        profile_id: profile.id,
        full_name: profile.full_name || 'Unnamed Coach',
      },
      { onConflict: 'profile_id' }
    )

  if (coachError) {
    setMessage(`Coach approved, but coach profile creation failed: ${coachError.message}`)
    return
  }

  setMessage('Coach approved.')
  await loadData()
  return
}
    if (requestedRole === 'player' || requestedRole === 'athlete') {
      const chosenAthleteId = selectedAthleteMap[profile.id]

      if (chosenAthleteId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            role: 'player',
            requested_role: 'player',
            approval_status: 'approved',
            athlete_id: chosenAthleteId,
          })
          .eq('id', profile.id)

        if (error) {
          setMessage(`Error linking player: ${error.message}`)
          return
        }

        setMessage('Player approved and linked to existing athlete.')
        await loadData()
        return
      }

      const nameParts = splitName(profile.full_name)
      const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111'

      const { data: newAthlete, error: athleteError } = await supabase
        .from('athletes')
        .insert([
          {
            first_name: nameParts.firstName,
            last_name: nameParts.lastName,
            team_level: 'Varsity',
            org_id: DEFAULT_ORG_ID,
          },
        ])
        .select()
        .single()

      if (athleteError || !newAthlete) {
        setMessage(`Error creating athlete: ${athleteError?.message || 'Unknown error'}`)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'player',
          requested_role: 'player',
          approval_status: 'approved',
          athlete_id: newAthlete.id,
        })
        .eq('id', profile.id)

      if (profileError) {
        setMessage(`Athlete created, but profile update failed: ${profileError.message}`)
        return
      }

      setMessage('Player approved and added to athletes automatically.')
      await loadData()
      return
    }

    setMessage(`Unknown requested role for ${profile.full_name || profile.email || 'user'}.`)
  }

  async function rejectProfile(profileId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'rejected',
      })
      .eq('id', profileId)

    if (error) {
      setMessage(`Error rejecting profile: ${error.message}`)
      return
    }

    setMessage('Profile rejected.')
    await loadData()
  }

  const pendingProfiles = useMemo(() => profiles, [profiles])

  const pendingCoachProfiles = useMemo(
    () => pendingProfiles.filter((profile) => {
      const requestedRole = getRequestedRole(profile)
      return requestedRole === 'coach' || requestedRole === 'admin'
    }),
    [pendingProfiles]
  )

  const pendingPlayerProfiles = useMemo(
    () => pendingProfiles.filter((profile) => {
      const requestedRole = getRequestedRole(profile)
      return requestedRole === 'player' || requestedRole === 'athlete'
    }),
    [pendingProfiles]
  )

  const unknownProfiles = useMemo(
    () => pendingProfiles.filter((profile) => {
      const requestedRole = getRequestedRole(profile)
      return !['coach', 'admin', 'player', 'athlete'].includes(requestedRole)
    }),
    [pendingProfiles]
  )

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Account Approvals</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            Approve new player and coach accounts.
          </p>
        </div>

        <a href="/admin" style={navLinkStyle}>
          Back to Admin
        </a>
      </div>

      {message && (
        <p style={{ color: message.startsWith('Error') ? '#f87171' : '#4ade80', marginBottom: 20 }}>
          {message}
        </p>
      )}

      {loading && <p>Loading...</p>}

      {!loading && pendingProfiles.length === 0 && (
        <div style={panelStyle}>
          <p style={{ color: '#d4d4d8', margin: 0 }}>No pending accounts.</p>
        </div>
      )}

      {!loading && pendingProfiles.length > 0 && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Coach Requests</h2>

            {pendingCoachProfiles.length === 0 ? (
              <p style={{ color: '#d4d4d8', margin: 0 }}>No pending coach requests.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {pendingCoachProfiles.map((profile) => (
                  <div key={profile.id} style={cardStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {profile.full_name || 'Unnamed User'}
                      </div>
                      <div style={{ color: '#a1a1aa', marginBottom: 8 }}>
                        {profile.email || 'No email'}
                      </div>
                      <div>
                        Requested Role:{' '}
                        <strong>{getRequestedRole(profile) || 'unknown'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => approveProfile(profile)} style={approveButtonStyle}>
                        Approve
                      </button>

                      <button onClick={() => rejectProfile(profile.id)} style={rejectButtonStyle}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Player Requests</h2>

            {pendingPlayerProfiles.length === 0 ? (
              <p style={{ color: '#d4d4d8', margin: 0 }}>No pending player requests.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {pendingPlayerProfiles.map((profile) => (
                  <div key={profile.id} style={cardStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {profile.full_name || 'Unnamed User'}
                      </div>
                      <div style={{ color: '#a1a1aa', marginBottom: 8 }}>
                        {profile.email || 'No email'}
                      </div>
                      <div>
                        Requested Role:{' '}
                        <strong>{getRequestedRole(profile) || 'unknown'}</strong>
                      </div>

                      <div style={{ marginTop: 12, maxWidth: 320 }}>
                        <label style={labelStyle}>Link to existing athlete (optional)</label>
                        <select
                          value={selectedAthleteMap[profile.id] || ''}
                          onChange={(e) =>
                            setSelectedAthleteMap((prev) => ({
                              ...prev,
                              [profile.id]: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        >
                          <option value="">Create new athlete automatically</option>
                          {athletes.map((athlete) => (
                            <option key={athlete.id} value={athlete.id}>
                              {athlete.first_name} {athlete.last_name}
                              {athlete.team_level ? ` (${athlete.team_level})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => approveProfile(profile)} style={approveButtonStyle}>
                        Approve
                      </button>

                      <button onClick={() => rejectProfile(profile.id)} style={rejectButtonStyle}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {unknownProfiles.length > 0 && (
            <div style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Unknown Requests</h2>

              <div style={{ display: 'grid', gap: 12 }}>
                {unknownProfiles.map((profile) => (
                  <div key={profile.id} style={cardStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {profile.full_name || 'Unnamed User'}
                      </div>
                      <div style={{ color: '#a1a1aa', marginBottom: 8 }}>
                        {profile.email || 'No email'}
                      </div>
                      <div>
                        Requested Role:{' '}
                        <strong>{getRequestedRole(profile) || 'unknown'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => rejectProfile(profile.id)} style={rejectButtonStyle}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
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
  backgroundColor: '#18181b',
  color: '#ffffff',
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