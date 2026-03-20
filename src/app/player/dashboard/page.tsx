'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
  profile_image_path: string | null
  height: string | null
  weight: number | null
  forty_yard_dash: number | null
  pro_shuttle: number | null
}

type PlayerLiftMax = {
  id: string
  athlete_id: string
  lift_name: string
  max_weight: number
  estimated_one_rm: number | null
  tested_on: string | null
  notes: string | null
}

type AttendanceLog = {
  id: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

type PlayerWorkoutLog = {
  id: string
  athlete_id: string
  workout_id: string | null
  workout_date: string
  exercise: string
  set_number: number
  target_reps: number | null
  reps_completed: number | null
  weight: number | null
  notes: string | null
  created_at?: string
}

type GroupedWorkout = {
  workout_date: string
  logs: PlayerWorkoutLog[]
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

type PlayerBadge = {
  id: string
  awarded_at: string
  notes: string | null
  badges:
    | {
        id: string
        code: string
        name: string
        description: string | null
        icon: string | null
        category: string
      }
    | {
        id: string
        code: string
        name: string
        description: string | null
        icon: string | null
        category: string
      }[]
}
const MAIN_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Hang Clean',
  'Front Squat',
  'Overhead Press',
]

export default function PlayerDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [maxes, setMaxes] = useState<PlayerLiftMax[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [workoutLogs, setWorkoutLogs] = useState<PlayerWorkoutLog[]>([])
  const [submissions, setSubmissions] = useState<MaxSubmission[]>([])
  const [playerBadges, setPlayerBadges] = useState<PlayerBadge[]>([])

  const [selectedLift, setSelectedLift] = useState(MAIN_LIFTS[0])
  const [submittedWeight, setSubmittedWeight] = useState('')
  const [testedOn, setTestedOn] = useState(new Date().toISOString().split('T')[0])
  const [submissionNotes, setSubmissionNotes] = useState('')

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadDashboard() {
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, athlete_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      router.push('/login')
      return
    }

    if (profile.role !== 'athlete' && profile.role !== 'player') {
      router.push('/login')
      return
    }

    if (!profile.athlete_id) {
      setMessage('Your account is not connected to a player profile yet.')
      setLoading(false)
      return
    }

    const { data: athleteData, error: athleteError } = await supabase
      .from('athletes')
      .select(
        'id, first_name, last_name, team_level, profile_image_path, height, weight, forty_yard_dash, pro_shuttle'
      )
      .eq('id', profile.athlete_id)
      .maybeSingle()

    if (athleteError) {
      setMessage(`Could not load your athlete profile: ${athleteError.message}`)
      setLoading(false)
      return
    }

    if (!athleteData) {
      setMessage('No athlete record was found for your account.')
      setLoading(false)
      return
    }

    setAthlete(athleteData as Athlete)

    const [
      maxesResult,
      attendanceResult,
      workoutLogsResult,
      submissionsResult,
      badgesResult,
    ] = await Promise.all([
      supabase
        .from('player_lift_maxes')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('lift_name', { ascending: true }),

      supabase
        .from('player_attendance_logs')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('attendance_date', { ascending: false }),

      supabase
        .from('player_workout_logs')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('player_max_submissions')
        .select('*')
        .eq('athlete_id', athleteData.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('player_badges')
        .select(`
          id,
          awarded_at,
          notes,
          badges (
            id,
            code,
            name,
            description,
            icon,
            category
          )
        `)
        .eq('athlete_id', athleteData.id)
        .order('awarded_at', { ascending: false }),
    ])

    if (maxesResult.error) {
      setMessage(`Could not load maxes: ${maxesResult.error.message}`)
      setLoading(false)
      return
    }

    if (attendanceResult.error) {
      setMessage(`Could not load attendance: ${attendanceResult.error.message}`)
      setLoading(false)
      return
    }

    if (workoutLogsResult.error) {
      setMessage(`Could not load workout history: ${workoutLogsResult.error.message}`)
      setLoading(false)
      return
    }

    if (submissionsResult.error) {
      setMessage(`Could not load max submissions: ${submissionsResult.error.message}`)
      setLoading(false)
      return
    }

    if (badgesResult.error) {
      setMessage(`Could not load badges: ${badgesResult.error.message}`)
      setLoading(false)
      return
    }

    setMaxes((maxesResult.data as PlayerLiftMax[]) || [])
    setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    setWorkoutLogs((workoutLogsResult.data as PlayerWorkoutLog[]) || [])
    setSubmissions((submissionsResult.data as MaxSubmission[]) || [])
    setPlayerBadges(((badgesResult.data ?? []) as unknown as PlayerBadge[]))

    await loadProfilePhoto(athleteData.profile_image_path)

    setLoading(false)
  }

  async function loadProfilePhoto(path: string | null) {
    if (!path) {
      setProfileImageUrl(null)
      return
    }

    const { data, error } = await supabase.storage
      .from('player-photos')
      .createSignedUrl(path, 60 * 60)

    if (error || !data?.signedUrl) {
      setProfileImageUrl(null)
      return
    }

    setProfileImageUrl(data.signedUrl)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !athlete) return

    setUploadingPhoto(true)
    setMessage('')

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${athlete.id}/profile.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('player-photos')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      setMessage(`Photo upload failed: ${uploadError.message}`)
      setUploadingPhoto(false)
      return
    }

    const { error: athleteError } = await supabase
      .from('athletes')
      .update({ profile_image_path: filePath })
      .eq('id', athlete.id)

    if (athleteError) {
      setMessage(`Photo saved, but athlete profile update failed: ${athleteError.message}`)
      setUploadingPhoto(false)
      return
    }

    setMessage('Profile photo updated.')
    await loadDashboard()
    setUploadingPhoto(false)
  }

  async function submitMaxEntry(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!athlete) {
      setMessage('Could not find your athlete profile.')
      return
    }

    if (!selectedLift) {
      setMessage('Please choose a lift.')
      return
    }

    if (!submittedWeight.trim()) {
      setMessage('Please enter a weight.')
      return
    }

    const parsedWeight = Number(submittedWeight)

    if (Number.isNaN(parsedWeight)) {
      setMessage('Weight must be a valid number.')
      return
    }

    const { error } = await supabase.from('player_max_submissions').insert([
      {
        athlete_id: athlete.id,
        lift_name: selectedLift,
        submitted_weight: parsedWeight,
        tested_on: testedOn || null,
        notes: submissionNotes.trim() || null,
        status: 'pending',
      },
    ])

    if (error) {
      setMessage(`Could not submit max: ${error.message}`)
      return
    }

    setMessage('Max submitted for coach approval.')
    setSubmittedWeight('')
    setSubmissionNotes('')
    await loadDashboard()
  }

  const attendanceStats = useMemo(() => {
    const total = attendanceLogs.length
    const present = attendanceLogs.filter((log) => log.status === 'PRESENT').length
    const absent = attendanceLogs.filter((log) => log.status === 'ABSENT').length
    const late = attendanceLogs.filter((log) => log.status === 'LATE').length
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    return { total, present, absent, late, rate }
  }, [attendanceLogs])

  const groupedWorkouts = useMemo(() => {
    const map = new Map<string, PlayerWorkoutLog[]>()

    workoutLogs.forEach((log) => {
      const existing = map.get(log.workout_date) || []
      existing.push(log)
      map.set(log.workout_date, existing)
    })

    return Array.from(map.entries())
      .map(([workout_date, logs]) => ({ workout_date, logs }))
      .sort((a, b) => b.workout_date.localeCompare(a.workout_date))
  }, [workoutLogs])

  const uniqueWorkoutDays = useMemo(() => {
    return new Set(workoutLogs.map((log) => log.workout_date)).size
  }, [workoutLogs])

  const recentLogs = useMemo(() => workoutLogs.slice(0, 12), [workoutLogs])

  const totalWeightLifted = useMemo(() => {
    return workoutLogs.reduce((sum, log) => {
      const weight = log.weight ?? 0
      const reps = log.reps_completed ?? 0
      return sum + weight * reps
    }, 0)
  }, [workoutLogs])

  const favoriteLift = useMemo(() => {
    if (workoutLogs.length === 0) return '—'

    const counts = new Map<string, number>()
    workoutLogs.forEach((log) => {
      counts.set(log.exercise, (counts.get(log.exercise) || 0) + 1)
    })

    let winner = '—'
    let maxCount = 0

    counts.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count
        winner = name
      }
    })

    return winner
  }, [workoutLogs])

  if (loading) {
    return (
      <div style={pageStyle}>
        <h1>Player Dashboard</h1>
        <p>Loading...</p>
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
                  alt="Player profile photo"
                  width={96}
                  height={96}
                  style={{ borderRadius: 999, objectFit: 'cover' }}
                  unoptimized
                />
              ) : (
                <div style={photoFallbackStyle}>
                  {athlete?.first_name?.[0] || 'P'}
                </div>
              )}
            </div>

            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: 34 }}>Player Dashboard</h1>
              {athlete && (
                <p style={{ color: '#cbd5e1', margin: 0, fontSize: 16 }}>
                  {athlete.first_name} {athlete.last_name}
                  {athlete.team_level ? ` • ${athlete.team_level}` : ''}
                  {athlete.height ? ` • ${athlete.height}` : ''}
                  {athlete.weight ? ` • ${athlete.weight} lbs` : ''}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/player/workout" style={navLinkStyle}>
              My Workout
            </a>

            <a href="/player/upcoming-workouts" style={navLinkStyle}>
              Upcoming Workouts
            </a>

            <a href="/player/leaderboard" style={navLinkStyle}>
              Leaderboard
            </a>

            <a href="/player/edit-profile" style={navLinkStyle}>
              Edit Profile
            </a>

            <button onClick={handleLogout} style={logoutButtonStyle}>
              Log Out
            </button>
          </div>
        </div>

        <div style={heroSubStyle}>
          Track your lifting progress, attendance, maxes, workout history, profile, and earned awards.
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Profile Photo</h2>
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
            Choose a clear headshot or athletic photo.
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Workout Days Logged" value={String(uniqueWorkoutDays)} />
        <StatCard label="Total Logged Sets" value={String(workoutLogs.length)} />
        <StatCard label="Attendance Rate" value={`${attendanceStats.rate}%`} />
        <StatCard label="Current Maxes" value={String(maxes.length)} />
        <StatCard label="Total Weight Lifted" value={String(totalWeightLifted)} />
        <StatCard label="Most Logged Lift" value={favoriteLift} />
        <StatCard
          label="40 Yard Dash"
          value={athlete?.forty_yard_dash !== null && athlete?.forty_yard_dash !== undefined ? athlete.forty_yard_dash.toFixed(2) : '—'}
        />
        <StatCard
          label="Pro Shuttle"
          value={athlete?.pro_shuttle !== null && athlete?.pro_shuttle !== undefined ? athlete.pro_shuttle.toFixed(2) : '—'}
        />
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Badges & Awards</h2>

        {playerBadges.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No badges earned yet.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {playerBadges.map((entry) => {
              const badge = Array.isArray(entry.badges) ? entry.badges[0] : entry.badges
              return (
                <div
                  key={entry.id}
                  style={{
                    border: '1px solid #52525b',
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: '#27272a',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{badge.icon || '🏅'}</div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{badge.name}</div>
                  <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
                    {badge.description || 'Award earned'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>
                    {new Date(entry.awarded_at).toLocaleDateString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Current Maxes</h2>
        {maxes.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No maxes saved yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {maxes.map((max) => (
              <div key={max.id} style={rowCardStyle}>
                <div>
                  <div style={smallLabelStyle}>Lift</div>
                  <div style={{ fontWeight: 700 }}>{max.lift_name}</div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Submit a New Max</h2>

        <form onSubmit={submitMaxEntry}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={smallLabelStyle}>Lift</label>
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
              <label style={smallLabelStyle}>Submitted Weight</label>
              <input
                type="number"
                value={submittedWeight}
                onChange={(e) => setSubmittedWeight(e.target.value)}
                style={inputStyle}
                placeholder="Example: 225"
              />
            </div>

            <div>
              <label style={smallLabelStyle}>Tested On</label>
              <input
                type="date"
                value={testedOn}
                onChange={(e) => setTestedOn(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={smallLabelStyle}>Notes</label>
            <input
              type="text"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              style={inputStyle}
              placeholder="Optional note"
            />
          </div>

          <button type="submit" style={navButtonStyle}>
            Submit for Approval
          </button>
        </form>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>My Max Submissions</h2>
        {submissions.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No submissions yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {submissions.map((submission) => (
              <div key={submission.id} style={entryRowStyle}>
                <div>
                  <strong>{submission.lift_name}</strong> — {submission.submitted_weight} lbs
                </div>
                <div style={{ textTransform: 'capitalize' }}>{submission.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Attendance</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MiniStat label="Present" value={String(attendanceStats.present)} />
          <MiniStat label="Late" value={String(attendanceStats.late)} />
          <MiniStat label="Absent" value={String(attendanceStats.absent)} />
          <MiniStat label="Total Records" value={String(attendanceStats.total)} />
        </div>

        {attendanceLogs.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No attendance records yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {attendanceLogs.slice(0, 10).map((log) => (
              <div key={log.id} style={entryRowStyle}>
                <div>{log.attendance_date}</div>
                <div style={{ fontWeight: 700 }}>{log.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Recent Lift Entries</h2>

        {recentLogs.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No lift logs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {recentLogs.map((log) => (
              <div key={log.id} style={entryRowStyle}>
                <div>
                  <strong>{log.workout_date}</strong> — {log.exercise} Set {log.set_number}
                </div>
                <div>
                  {log.weight ?? '—'} lbs × {log.reps_completed ?? '—'} reps
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Workout History</h2>

        {groupedWorkouts.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No workout history yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {groupedWorkouts.map((group: GroupedWorkout) => (
              <div key={group.workout_date} style={historyCardStyle}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{group.workout_date}</div>
                  <div style={{ color: '#a1a1aa' }}>{group.logs.length} logged sets</div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {group.logs.map((log) => (
                    <div key={log.id} style={entryRowStyle}>
                      <div>
                        {log.exercise} — Set {log.set_number}
                      </div>
                      <div>
                        {log.weight ?? '—'} lbs × {log.reps_completed ?? '—'} reps
                      </div>
                    </div>
                  ))}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={smallLabelStyle}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
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

const uploadLabelStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
  display: 'inline-block',
}

const messageStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  color: '#f87171',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 16,
  padding: 18,
  marginBottom: 20,
  backgroundColor: '#18181b',
}

const statCardStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 16,
  padding: 18,
  backgroundColor: '#111827',
}

const statLabelStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  marginBottom: 8,
}

const statValueStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: 24,
  fontWeight: 800,
}

const miniStatStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 12,
  backgroundColor: '#27272a',
}

const rowCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr',
  gap: 12,
  alignItems: 'center',
}

const historyCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 16,
  backgroundColor: '#27272a',
}

const entryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  border: '1px solid #3f3f46',
  borderRadius: 10,
  padding: 10,
  backgroundColor: '#18181b',
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

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #475569',
  backgroundColor: 'rgba(15,23,42,0.85)',
  color: '#ffffff',
  textDecoration: 'none',
}

const navButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
}

const logoutButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}