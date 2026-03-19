'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../lib/supabase'

type CoachRow = {
  id: string
  profile_id: string
  full_name: string | null
  age: number | null
  coaching_position: string | null
  profile_image_path: string | null
  created_at?: string
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  approval_status: string | null
}

type CoachWithProfile = {
  id: string
  profile_id: string
  full_name: string | null
  age: number | null
  coaching_position: string | null
  profile_image_path: string | null
  email: string | null
}

export default function CoachesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [coaches, setCoaches] = useState<CoachWithProfile[]>([])
  const [coachImageUrls, setCoachImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    loadCoaches()
  }, [])

  async function loadCoaches() {
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

    const { data: myProfile, error: myProfileError } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (myProfileError || !myProfile) {
      router.push('/login')
      return
    }

    if (myProfile.role !== 'admin' || myProfile.approval_status !== 'approved') {
      router.push('/admin')
      return
    }

    const [profilesResult, coachesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, approval_status')
        .eq('role', 'admin')
        .eq('approval_status', 'approved')
        .order('full_name', { ascending: true }),

      supabase
        .from('coaches')
        .select('id, profile_id, full_name, age, coaching_position, profile_image_path, created_at'),
    ])

    if (profilesResult.error) {
      setMessage(`Could not load admin profiles: ${profilesResult.error.message}`)
      setLoading(false)
      return
    }

    if (coachesResult.error) {
      setMessage(`Could not load coach records: ${coachesResult.error.message}`)
      setLoading(false)
      return
    }

    const profiles = (profilesResult.data as ProfileRow[]) || []
    const coachRows = (coachesResult.data as CoachRow[]) || []

    const coachMap = new Map<string, CoachRow>()
    coachRows.forEach((coach) => {
      coachMap.set(coach.profile_id, coach)
    })

    const merged: CoachWithProfile[] = profiles.map((profile) => {
      const coach = coachMap.get(profile.id)

      return {
        id: coach?.id || profile.id,
        profile_id: profile.id,
        full_name:
          (coach?.full_name && coach.full_name.trim()) ||
          (profile.full_name && profile.full_name.trim()) ||
          'Unnamed Coach',
        age: coach?.age ?? null,
        coaching_position: coach?.coaching_position ?? null,
        profile_image_path: coach?.profile_image_path ?? null,
        email: (profile.email && profile.email.trim()) || null,
      }
    })

    setCoaches(merged)
    await loadCoachImages(merged)
    setLoading(false)
  }

  async function loadCoachImages(coachRows: CoachWithProfile[]) {
    const nextUrls: Record<string, string> = {}

    for (const coach of coachRows) {
      if (!coach.profile_image_path) continue

      const { data, error } = await supabase.storage
        .from('coach-photos')
        .createSignedUrl(coach.profile_image_path, 60 * 60)

      if (!error && data?.signedUrl) {
        nextUrls[coach.profile_id] = data.signedUrl
      }
    }

    setCoachImageUrls(nextUrls)
  }

  const filteredCoaches = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    return coaches.filter((coach) => {
      if (!searchText) return true

      const fullName = (coach.full_name || '').toLowerCase()
      const email = (coach.email || '').toLowerCase()
      const position = (coach.coaching_position || '').toLowerCase()

      return (
        fullName.includes(searchText) ||
        email.includes(searchText) ||
        position.includes(searchText)
      )
    })
  }, [coaches, search])

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: '0 0 8px 0' }}>Coaches</h1>
          <p style={{ color: '#a1a1aa', margin: 0 }}>
            All current admin accounts are shown as coaches.
          </p>
        </div>

        <a href="/admin" style={navLinkStyle}>Admin Home</a>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <label style={labelStyle}>Search Coaches</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or position"
          style={inputStyle}
        />
      </div>

      {loading && <p>Loading coaches...</p>}

      {!loading && filteredCoaches.length === 0 && (
        <div style={panelStyle}>
          <p style={{ margin: 0, color: '#d4d4d8' }}>No coaches found.</p>
        </div>
      )}

      {!loading && filteredCoaches.length > 0 && (
        <div style={gridStyle}>
          {filteredCoaches.map((coach) => {
            const imageUrl = coachImageUrls[coach.profile_id]

            return (
              <div
                key={coach.profile_id}
                style={coachCardStyle}
                onClick={() => router.push(`/admin/coaches/${coach.profile_id}`)}
              >
                <div style={avatarWrapStyle}>
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Coach profile photo"
                      width={72}
                      height={72}
                      style={{ borderRadius: 999, objectFit: 'cover' }}
                      unoptimized
                    />
                  ) : (
                    <div style={avatarStyle}>
                      {(coach.full_name || 'C').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                    {coach.full_name || 'Unnamed Coach'}
                  </div>

                  <div style={smallTextStyle}>
                    {coach.email || 'No email'}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={metaLabelStyle}>Age</div>
                    <div>{coach.age ?? '—'}</div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={metaLabelStyle}>Position</div>
                    <div>{coach.coaching_position || '—'}</div>
                  </div>
                </div>
              </div>
            )
          })}
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
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const messageStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  color: '#f87171',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#d4d4d8',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: 12,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#18181b',
  color: '#ffffff',
  textDecoration: 'none',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 14,
}

const coachCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 14,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '72px 1fr',
  gap: 14,
  alignItems: 'start',
  cursor: 'pointer',
}

const avatarWrapStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 999,
  overflow: 'hidden',
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
}

const avatarStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 999,
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 900,
}

const smallTextStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 14,
}

const metaLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 12,
  marginBottom: 4,
}