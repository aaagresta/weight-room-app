'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

type Profile = {
  id: string
  athlete_id: string | null
  role: string | null
  approval_status: string | null
}

type AttendanceLog = {
  id: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

type AttendanceRow = {
  athlete_id: string
  player_name: string
  team_level: string | null
  presentCount: number
  lateCount: number
  absentCount: number
  totalCount: number
  attendanceRate: number
}

export default function Page() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('All Teams')
  const [search, setSearch] = useState('')

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
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
      router.push('/login')
      return
    }

    const { data: approvedProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, athlete_id, role, approval_status')
      .eq('approval_status', 'approved')
      .in('role', ['player', 'athlete'])

    if (profilesError) {
      setMessage(`Could not load approved players: ${profilesError.message}`)
      setLoading(false)
      return
    }

    const approvedAthleteIds = ((approvedProfiles as Profile[]) || [])
      .map((p) => p.athlete_id)
      .filter((id): id is string => Boolean(id))

    if (approvedAthleteIds.length === 0) {
      setAthletes([])
      setAttendanceLogs([])
      setLoading(false)
      return
    }

    const [athletesResult, attendanceResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .in('id', approvedAthleteIds),

      supabase
        .from('player_attendance_logs')
        .select('id, athlete_id, attendance_date, status')
        .in('athlete_id', approvedAthleteIds),
    ])

    if (athletesResult.error) {
      setMessage(`Could not load athletes: ${athletesResult.error.message}`)
      setLoading(false)
      return
    }

    if (attendanceResult.error) {
      setMessage(`Could not load attendance report: ${attendanceResult.error.message}`)
      setLoading(false)
      return
    }

    setAthletes((athletesResult.data as Athlete[]) || [])
    setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    setLoading(false)
  }

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    athletes.forEach((athlete) => {
      if (athlete.team_level) set.add(athlete.team_level)
    })
    return ['All Teams', ...Array.from(set).sort()]
  }, [athletes])

  const attendanceRows = useMemo((): AttendanceRow[] => {
    const athleteMap = new Map<string, Athlete>()
    athletes.forEach((athlete) => {
      athleteMap.set(athlete.id, athlete)
    })

    const grouped = new Map<
      string,
      {
        presentCount: number
        lateCount: number
        absentCount: number
        totalCount: number
      }
    >()

    athletes.forEach((athlete) => {
      grouped.set(athlete.id, {
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        totalCount: 0,
      })
    })

    attendanceLogs.forEach((log) => {
      const current = grouped.get(log.athlete_id) || {
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        totalCount: 0,
      }

      current.totalCount += 1

      if (log.status === 'PRESENT') current.presentCount += 1
      if (log.status === 'LATE') current.lateCount += 1
      if (log.status === 'ABSENT') current.absentCount += 1

      grouped.set(log.athlete_id, current)
    })

    return Array.from(grouped.entries())
      .map(([athlete_id, stats]) => {
        const athlete = athleteMap.get(athlete_id)

        return {
          athlete_id,
          player_name: athlete
            ? `${athlete.first_name} ${athlete.last_name}`
            : 'Unknown Player',
          team_level: athlete?.team_level ?? null,
          presentCount: stats.presentCount,
          lateCount: stats.lateCount,
          absentCount: stats.absentCount,
          totalCount: stats.totalCount,
          attendanceRate:
            stats.totalCount > 0
              ? Math.round(((stats.presentCount + stats.lateCount) / stats.totalCount) * 100)
              : 0,
        }
      })
      .filter((row) => selectedTeam === 'All Teams' || row.team_level === selectedTeam)
      .filter((row) =>
        row.player_name.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => {
        if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate
        return b.totalCount - a.totalCount
      })
  }, [athletes, attendanceLogs, selectedTeam, search])

  if (loading) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginTop: 0 }}>Attendance Report</h1>
        <p>Loading attendance report...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroHeaderStyle}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: 34 }}>Attendance Report</h1>
            <p style={{ color: '#cbd5e1', margin: 0, fontSize: 16 }}>
              Current attendance for all players
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/admin" style={navLinkStyle}>
              Admin Home
            </a>
            <a href="/admin/leaderboard" style={navLinkStyle}>
              Leaderboard
            </a>
          </div>
        </div>

        <div style={heroSubStyle}>
          Present and late count as attended. Attendance rate uses total logged records.
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label style={smallLabelStyle}>Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={inputStyle}
            >
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={smallLabelStyle}>Search Player</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
              placeholder="Search by name"
            />
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Player Attendance</h2>

        {attendanceRows.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No attendance records found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {attendanceRows.map((row, index) => (
              <div key={row.athlete_id} style={reportRowStyle}>
                <div style={reportRankStyle}>#{index + 1}</div>

                <div style={{ minWidth: 180, flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{row.player_name}</div>
                  <div style={{ color: '#a1a1aa', fontSize: 13 }}>
                    {row.team_level || 'No Team'}
                  </div>
                </div>

                <div style={reportStatStyle}>
                  <div style={smallLabelStyle}>Attendance %</div>
                  <div style={reportValueStyle}>{row.attendanceRate}%</div>
                </div>

                <div style={reportStatStyle}>
                  <div style={smallLabelStyle}>Present</div>
                  <div style={{ fontWeight: 700 }}>{row.presentCount}</div>
                </div>

                <div style={reportStatStyle}>
                  <div style={smallLabelStyle}>Late</div>
                  <div style={{ fontWeight: 700 }}>{row.lateCount}</div>
                </div>

                <div style={reportStatStyle}>
                  <div style={smallLabelStyle}>Absent</div>
                  <div style={{ fontWeight: 700 }}>{row.absentCount}</div>
                </div>

                <div style={reportStatStyle}>
                  <div style={smallLabelStyle}>Total</div>
                  <div style={{ fontWeight: 700 }}>{row.totalCount}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 10,
  border: '1px solid #52525b',
  backgroundColor: '#27272a',
  color: '#ffffff',
}

const smallLabelStyle: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: 12,
  marginBottom: 4,
}

const reportRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  border: '1px solid #52525b',
  borderRadius: 12,
  padding: 14,
  backgroundColor: '#27272a',
}

const reportRankStyle: React.CSSProperties = {
  minWidth: 44,
  height: 44,
  borderRadius: 999,
  backgroundColor: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 15,
}

const reportStatStyle: React.CSSProperties = {
  minWidth: 90,
  textAlign: 'right',
}

const reportValueStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 24,
}