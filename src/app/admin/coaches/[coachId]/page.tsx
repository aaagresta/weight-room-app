'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../../lib/supabase'

type Coach = {
  id: string
  profile_id: string
  full_name: string | null
  age: number | null
  coaching_position: string | null
  profile_image_path: string | null
}

type Profile = {
  id: string
  email: string | null
  role: string | null
  approval_status: string | null
}

export default function CoachDetailPage() {
  const router = useRouter()
  const params = useParams<{ coachId: string }>()
  const coachId = params.coachId

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [coach, setCoach] = useState<Coach | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [editFullName, setEditFullName] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editCoachingPosition, setEditCoachingPosition] = useState('')

  useEffect(() => {
    loadCoach()
  }, [coachId])

  async function loadCoach() {
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

    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('id, profile_id, full_name, age, coaching_position, profile_image_path')
      .eq('id', coachId)
      .maybeSingle()

    if (coachError) {
      setMessage(`Could not load coach: ${coachError.message}`)
      setLoading(false)
      return
    }

    if (!coachData) {
      setMessage('Coach profile not found.')
      setLoading(false)
      return
    }

    const typedCoach = coachData as Coach
    setCoach(typedCoach)
    setEditFullName(typedCoach.full_name || '')
    setEditAge(
      typedCoach.age !== null && typedCoach.age !== undefined ? String(typedCoach.age) : ''
    )
    setEditCoachingPosition(typedCoach.coaching_position || '')

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, approval_status')
      .eq('id', typedCoach.profile_id)
      .maybeSingle()

    if (profileError) {
      setMessage(`Could not load coach profile: ${profileError.message}`)
      setLoading(false)
      return
    }

    setProfile((profileData as Profile) || null)

    await loadProfilePhoto(typedCoach.profile_image_path)

    setLoading(false)
  }

  async function loadProfilePhoto(path: string | null) {
    if (!path) {
      setProfileImageUrl(null)
      return
    }

    const { data, error } = await supabase.storage
      .from('coach-photos')
      .createSignedUrl(path, 60 * 60)

    if (error || !data?.signedUrl) {
      setProfileImageUrl(null)
      return
    }

    setProfileImageUrl(data.signedUrl)
  }

  async function handleSaveCoachProfile() {
    if (!coach) return

    setSaving(true)
    setMessage('')

    const parsedAge = editAge.trim() ? Number(editAge) : null

    if (editAge.trim() && Number.isNaN(parsedAge)) {
      setMessage('Age must be a valid number.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('coaches')
      .update({
        full_name: editFullName.trim() || null,
        age: parsedAge,
        coaching_position: editCoachingPosition.trim() || null,
      })
      .eq('id', coach.id)

    if (error) {
      setMessage(`Could not save coach profile: ${error.message}`)
      setSaving(false)
      return
    }

    setMessage('Coach profile updated successfully.')
    setEditing(false)
    await loadCoach()
    setSaving(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !coach) return

    setUploadingPhoto(true)
    setMessage('')

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${coach.id}/profile.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('coach-photos')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      setMessage(`Photo upload failed: ${uploadError.message}`)
      setUploadingPhoto(false)
      return
    }

    const { error: coachError } = await supabase
      .from('coaches')
      .update({ profile_image_path: filePath })
      .eq('id', coach.id)

    if (coachError) {
      setMessage(`Photo uploaded, but coach update failed: ${coachError.message}`)
      setUploadingPhoto(false)
      return
    }

    setMessage('Coach photo updated successfully.')
    await loadCoach()
    setUploadingPhoto(false)
  }

  function resetEditFields() {
    if (!coach) return
    setEditFullName(coach.full_name || '')
    setEditAge(coach.age !== null && coach.age !== undefined ? String(coach.age) : '')
    setEditCoachingPosition(coach.coaching_position || '')
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <p>Loading coach profile...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={photoWrapStyle}>
              {profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt="Coach profile photo"
                  width={96}
                  height={96}
                  style={{ borderRadius: 999, objectFit: 'cover' }}
                  unoptimized
                />
              ) : (
                <div style={photoFallbackStyle}>
                  {(coach?.full_name || 'C').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: 34 }}>Coach Profile</h1>
              <p style={{ color: '#cbd5e1', margin: 0, fontSize: 16 }}>
                {coach?.full_name || 'Unnamed Coach'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/admin" style={navLinkStyle}>Admin Home</a>
            <a href="/admin/coaches" style={navLinkStyle}>Coaches</a>
          </div>
        </div>

        <div style={heroSubStyle}>
          View and edit coach information and profile details.
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <div style={panelHeaderRowStyle}>
          <h2 style={{ margin: 0 }}>Coach Info</h2>

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={smallEditButtonStyle}
            >
              Edit Coach Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleSaveCoachProfile}
                disabled={saving}
                style={saveButtonStyle}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              <button
                onClick={() => {
                  resetEditFields()
                  setEditing(false)
                }}
                style={cancelButtonStyle}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <div style={infoGridStyle}>
            <InfoCard label="Name" value={coach?.full_name || '—'} />
            <InfoCard label="Age" value={coach?.age?.toString() || '—'} />
            <InfoCard label="Coaching Position" value={coach?.coaching_position || '—'} />
            <InfoCard label="Email" value={profile?.email || '—'} />
            <InfoCard label="Role" value={profile?.role || '—'} />
            <InfoCard label="Approval Status" value={profile?.approval_status || '—'} />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                style={inputStyle}
                placeholder="Coach name"
              />
            </div>

            <div>
              <label style={labelStyle}>Age</label>
              <input
                type="number"
                value={editAge}
                onChange={(e) => setEditAge(e.target.value)}
                style={inputStyle}
                placeholder="Age"
              />
            </div>

            <div>
              <label style={labelStyle}>Coaching Position</label>
              <input
                type="text"
                value={editCoachingPosition}
                onChange={(e) => setEditCoachingPosition(e.target.value)}
                style={inputStyle}
                placeholder="Example: Offensive Line"
              />
            </div>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Coach Photo</h2>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={uploadLabelStyle}>
            {uploadingPhoto ? 'Uploading...' : 'Upload New Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
              disabled={uploadingPhoto}
            />
          </label>

          <span style={{ color: '#94a3b8' }}>
            Upload a clear coach profile photo.
          </span>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  background:
    'linear-gradient(180deg, #020617 0%, #000000 220px, #000000 100%)',
  minHeight: '100vh',
  color: '#ffffff',
}

const heroStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 20,
  padding: 24,
  marginBottom: 20,
  background:
    'linear-gradient(135deg, rgba(30,41,59,1) 0%, rgba(15,23,42,1) 45%, rgba(23,37,84,1) 100%)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
}

const heroHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 12,
}

const heroSubStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 15,
}

const photoWrapStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 999,
  backgroundColor: 'rgba(15,23,42,0.9)',
  border: '1px solid #475569',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}

const photoFallbackStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 36,
  fontWeight: 800,
  color: '#ffffff',
  backgroundColor: '#1e293b',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 16,
  padding: 18,
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

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #475569',
  backgroundColor: 'rgba(15,23,42,0.85)',
  color: '#ffffff',
  textDecoration: 'none',
}

const panelHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 14,
}

const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const infoCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
}

const infoLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 12,
  marginBottom: 6,
}

const infoValueStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 18,
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

const uploadLabelStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
  display: 'inline-block',
}

const smallEditButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
}

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
}