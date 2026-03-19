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

type PlayerLiftMax = {
  id: string
  athlete_id: string
  lift_name: string
  max_weight: number
}

type AttendanceLog = {
  id: string
  athlete_id: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

type LiftLeaderboardEntry = {
  athlete_id: string
  player_name: string
  team_level: string | null
  max_weight: number
}

type AttendanceLeaderboardEntry = {
  athlete_id: string
  player_name: string
  team_level: string | null
  presentCount: number
  lateCount: number
  absentCount: number
  totalCount: number
  attendanceRate: number
}

const MAIN_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Hang Clean',
  'Front Squat',
  ]

export default function Page() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('All Teams')

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [maxes, setMaxes] = useState<PlayerLiftMax[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
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
      setMaxes([])
      setAttendanceLogs([])
      setLoading(false)
      return
    }

    const [athletesResult, maxesResult, attendanceResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level')
        .in('id', approvedAthleteIds),

      supabase
        .from('player_lift_maxes')
        .select('id, athlete_id, lift_name, max_weight')
        .in('athlete_id', approvedAthleteIds),

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

    if (maxesResult.error) {
      setMessage(`Could not load max leaderboard data: ${maxesResult.error.message}`)
      setLoading(false)
      return
    }

    if (attendanceResult.error) {
      setMessage(`Could not load attendance leaderboard data: ${attendanceResult.error.message}`)
      setLoading(false)
      return
    }

    setAthletes((athletesResult.data as Athlete[]) || [])
    setMaxes((maxesResult.data as PlayerLiftMax[]) || [])
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

  const filteredAthletes = useMemo(() => {
    if (selectedTeam === 'All Teams') return athletes
    return athletes.filter((athlete) => athlete.team_level === selectedTeam)
  }, [athletes, selectedTeam])

  const filteredAthleteIds = useMemo(() => {
    return new Set(filteredAthletes.map((a) => a.id))
  }, [filteredAthletes])

  const athleteMap = useMemo(() => {
    const map = new Map<string, Athlete>()
    athletes.forEach((athlete) => {
      map.set(athlete.id, athlete)
    })
    return map
  }, [athletes])

  const liftLeaderboards = useMemo(() => {
    const result: Record<string, LiftLeaderboardEntry[]> = {}

    for (const lift of MAIN_LIFTS) {
      result[lift] = maxes
        .filter(
          (max) =>
            max.lift_name === lift &&
            filteredAthleteIds.has(max.athlete_id) &&
            typeof max.max_weight === 'number'
        )
        .map((max) => {
          const athlete = athleteMap.get(max.athlete_id)
          return {
            athlete_id: max.athlete_id,
            player_name: athlete
              ? `${athlete.first_name} ${athlete.last_name}`
              : 'Unknown Player',
            team_level: athlete?.team_level ?? null,
            max_weight: max.max_weight,
          }
        })
        .sort((a, b) => b.max_weight - a.max_weight)
        .slice(0, 10)
    }

    return result
  }, [maxes, athleteMap, filteredAthleteIds])

  const attendanceLeaderboard = useMemo((): AttendanceLeaderboardEntry[] => {
    const grouped = new Map<
      string,
      {
        presentCount: number
        lateCount: number
        absentCount: number
        totalCount: number
      }
    >()

    attendanceLogs.forEach((log) => {
      if (!filteredAthleteIds.has(log.athlete_id)) return

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
        const attendanceRate =
          stats.totalCount > 0
            ? Math.round(((stats.presentCount + stats.lateCount) / stats.totalCount) * 100)
            : 0

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
          attendanceRate,
        }
      })
      .sort((a, b) => {
        if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate
        return b.totalCount - a.totalCount
      })
      .slice(0, 10)
  }, [attendanceLogs, athleteMap, filteredAthleteIds])

  if (loading) {
    return (
      <div style={pageStyle}>
        <h1 style={{ marginTop: 0 }}>Admin Leaderboard</h1>
        <p>Loading leaderboard...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div style={heroHeaderStyle}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: 34 }}>Admin Leaderboard</h1>
            <p style={{ color: '#cbd5e1', margin: 0, fontSize: 16 }}>
              Top 10 max lifts and top 10 attendance percentages
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/admin" style={navLinkStyle}>
              Admin Home
            </a>
            <a href="/admin/attendance-report" style={navLinkStyle}>
              Attendance Report
            </a>
          </div>
        </div>

        <div style={heroSubStyle}>
          Admin view of official maxes and player attendance performance.
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 6px 0' }}>Filters</h2>
            <div style={{ color: '#a1a1aa' }}>Filter leaderboard by team</div>
          </div>

          <div style={{ minWidth: 220 }}>
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
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Attendance Leaderboard</h2>

        {attendanceLeaderboard.length === 0 ? (
          <p style={{ color: '#d4d4d8' }}>No attendance data found.</p>
        ) : (
          <div style={leaderboardGridStyle}>
            {attendanceLeaderboard.map((entry, index) => (
              <div
  key={entry.athlete_id}
  style={{ ...leaderboardCardStyle, cursor: 'pointer' }}
  onClick={() => router.push(`/admin/players/${entry.athlete_id}`)}
>
                <div style={leaderboardTopRowStyle}>
                  <div style={smallRankStyle}>#{index + 1}</div>
                  <div style={teamPillStyle}>{entry.team_level || 'No Team'}</div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{entry.player_name}</div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={smallLabelStyle}>Attendance</div>
                  <div style={leaderboardValueStyle}>{entry.attendanceRate}%</div>
                </div>

                <div>
                  <div style={smallLabelStyle}>Record</div>
                  <div style={{ fontWeight: 700 }}>
                    {entry.presentCount + entry.lateCount}/{entry.totalCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {MAIN_LIFTS.map((lift) => {
        const entries = liftLeaderboards[lift] || []

        return (
          <div key={lift} style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>{lift}</h2>

            {entries.length === 0 ? (
              <p style={{ color: '#d4d4d8' }}>No max data found for this lift.</p>
            ) : (
              <div style={leaderboardGridStyle}>
                {entries.map((entry, index) => (
                  <div
  key={`${lift}-${entry.athlete_id}`}
  style={{ ...leaderboardCardStyle, cursor: 'pointer' }}
  onClick={() => router.push(`/admin/players/${entry.athlete_id}`)}
>
                    <div style={leaderboardTopRowStyle}>
                      <div style={smallRankStyle}>#{index + 1}</div>
                      <div style={teamPillStyle}>{entry.team_level || 'No Team'}</div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{entry.player_name}</div>
                    </div>

                    <div>
                      <div style={smallLabelStyle}>Max</div>
                      <div style={leaderboardValueStyle}>{entry.max_weight}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
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

const leaderboardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 260px))',
  gap: 12,
  alignItems: 'start',
}

const leaderboardCardStyle: React.CSSProperties = {
  border: '1px solid #52525b',
  borderRadius: 14,
  padding: 14,
  backgroundColor: '#27272a',
  minHeight: 150,
}

const leaderboardTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
}

const smallRankStyle: React.CSSProperties = {
  minWidth: 42,
  height: 42,
  borderRadius: 999,
  backgroundColor: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 15,
}

const teamPillStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  color: '#cbd5e1',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const leaderboardValueStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 24,
}