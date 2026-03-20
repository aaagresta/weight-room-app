'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
  forty_yard_dash: number | null
  pro_shuttle: number | null
}

type PlayerLiftMax = {
  athlete_id: string
  lift_name: string
  max_weight: number
}

type AttendanceLog = {
  athlete_id: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

type LeaderboardRow = {
  athlete_id: string
  name: string
  team: string
  value: number
}

const MAIN_LIFTS = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Hang Clean',
  'Front Squat',
]

export default function PlayerLeaderboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      router.push('/login')
      return
    }

    if (
      (profile.role !== 'player' && profile.role !== 'athlete') ||
      profile.approval_status !== 'approved'
    ) {
      router.push('/player/dashboard')
      return
    }

    const [athletesResult, maxesResult, attendanceResult] = await Promise.all([
      supabase
        .from('athletes')
        .select('id, first_name, last_name, team_level, forty_yard_dash, pro_shuttle')
        .order('last_name', { ascending: true }),

      supabase
        .from('player_lift_maxes')
        .select('athlete_id, lift_name, max_weight'),

      supabase
        .from('player_attendance_logs')
        .select('athlete_id, status'),
    ])

    if (athletesResult.error) {
      setMessage(`Could not load athletes: ${athletesResult.error.message}`)
      setLoading(false)
      return
    }

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

    setAthletes((athletesResult.data as Athlete[]) || [])
    setMaxes((maxesResult.data as PlayerLiftMax[]) || [])
    setAttendanceLogs((attendanceResult.data as AttendanceLog[]) || [])
    setLoading(false)
  }

  const athleteMap = useMemo(() => {
    const map = new Map<string, Athlete>()
    athletes.forEach((athlete) => map.set(athlete.id, athlete))
    return map
  }, [athletes])

  function getAthleteName(athleteId: string) {
    const athlete = athleteMap.get(athleteId)
    if (!athlete) return 'Unknown Player'
    return `${athlete.first_name} ${athlete.last_name}`
  }

  function getAthleteTeam(athleteId: string) {
    const athlete = athleteMap.get(athleteId)
    return athlete?.team_level || '—'
  }

  function buildLiftLeaderboard(liftName: string): LeaderboardRow[] {
    return maxes
      .filter((row) => row.lift_name === liftName)
      .map((row) => ({
        athlete_id: row.athlete_id,
        name: getAthleteName(row.athlete_id),
        team: getAthleteTeam(row.athlete_id),
        value: row.max_weight,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }

  const attendanceLeaderboard = useMemo(() => {
    const stats = new Map<
      string,
      { present: number; late: number; absent: number; total: number }
    >()

    attendanceLogs.forEach((log) => {
      const current = stats.get(log.athlete_id) || {
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }

      current.total += 1
      if (log.status === 'PRESENT') current.present += 1
      if (log.status === 'LATE') current.late += 1
      if (log.status === 'ABSENT') current.absent += 1

      stats.set(log.athlete_id, current)
    })

    return Array.from(stats.entries())
      .map(([athleteId, stat]) => {
        const attended = stat.present + stat.late
        const percentage = stat.total > 0 ? Math.round((attended / stat.total) * 100) : 0

        return {
          athlete_id: athleteId,
          name: getAthleteName(athleteId),
          team: getAthleteTeam(athleteId),
          value: percentage,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [attendanceLogs, athleteMap])

  const fortyLeaderboard = useMemo(() => {
    return athletes
      .filter((athlete) => athlete.forty_yard_dash !== null)
      .map((athlete) => ({
        athlete_id: athlete.id,
        name: `${athlete.first_name} ${athlete.last_name}`,
        team: athlete.team_level || '—',
        value: Number((athlete.forty_yard_dash ?? 0).toFixed(2)),
      }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 10)
  }, [athletes])

  const shuttleLeaderboard = useMemo(() => {
    return athletes
      .filter((athlete) => athlete.pro_shuttle !== null)
      .map((athlete) => ({
        athlete_id: athlete.id,
        name: `${athlete.first_name} ${athlete.last_name}`,
        team: athlete.team_level || '—',
        value: Number((athlete.pro_shuttle ?? 0).toFixed(2)),
      }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 10)
  }, [athletes])

  const leftSections = [
    { title: 'Bench Press', rows: buildLiftLeaderboard('Bench Press'), suffix: 'lbs' },
    { title: 'Back Squat', rows: buildLiftLeaderboard('Back Squat'), suffix: 'lbs' },
    { title: 'Deadlift', rows: buildLiftLeaderboard('Deadlift'), suffix: 'lbs' },
    { title: 'Hang Clean', rows: buildLiftLeaderboard('Hang Clean'), suffix: 'lbs' },
  ]

  const rightSections = [
    { title: 'Front Squat', rows: buildLiftLeaderboard('Front Squat'), suffix: 'lbs' },
    { title: 'Attendance %', rows: attendanceLeaderboard, suffix: '%' },
    { title: '40 Yard Dash', rows: fortyLeaderboard, suffix: 's' },
    { title: 'Pro Shuttle', rows: shuttleLeaderboard, suffix: 's' },
  ]

  if (loading) {
    return (
      <div style={pageStyle}>
        <p>Loading leaderboard...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 34 }}>Team Leaderboard</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Top 10 leaders across strength, attendance, and speed.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/player/dashboard" style={navLinkStyle}>
            Dashboard
          </Link>
          <Link href="/player/workout" style={navLinkStyle}>
            My Workout
          </Link>
        </div>
      </div>

      {message && <div style={messageStyle}>{message}</div>}

      <div style={contentGridStyle}>
        <div style={columnStyle}>
          {leftSections.map((section) => (
            <LeaderboardList
              key={section.title}
              title={section.title}
              rows={section.rows}
              suffix={section.suffix}
            />
          ))}
        </div>

        <div style={columnStyle}>
          {rightSections.map((section) => (
            <LeaderboardList
              key={section.title}
              title={section.title}
              rows={section.rows}
              suffix={section.suffix}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LeaderboardList({
  title,
  rows,
  suffix,
}: {
  title: string
  rows: LeaderboardRow[]
  suffix: string
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div style={emptyStyle}>No data yet.</div>
      ) : (
        <div style={listWrapStyle}>
          <div style={headerRowStyle}>
            <div>#</div>
            <div>Player</div>
            <div>Team</div>
            <div style={{ textAlign: 'right' }}>Value</div>
          </div>

          {rows.map((row, index) => (
            <div key={`${title}-${row.athlete_id}-${index}`} style={itemRowStyle}>
              <div style={rankCellStyle}>{index + 1}</div>
              <div style={nameCellStyle}>{row.name}</div>
              <div style={teamCellStyle}>{row.team}</div>
              <div style={valueCellStyle}>
                {row.value}
                {suffix}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(180deg, #020617 0%, #000000 220px, #000000 100%)',
  color: '#ffffff',
  padding: 24,
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #475569',
  backgroundColor: '#111827',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
}

const messageStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  color: '#f87171',
}

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  alignItems: 'start',
}

const columnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 16,
  backgroundColor: '#111827',
  overflow: 'hidden',
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #334155',
  background:
    'linear-gradient(135deg, rgba(30,41,59,1) 0%, rgba(15,23,42,1) 100%)',
}

const listWrapStyle: React.CSSProperties = {
  display: 'grid',
}

const headerRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px 1.6fr 0.8fr 0.8fr',
  gap: 10,
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 800,
  color: '#94a3b8',
  borderBottom: '1px solid #273449',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const itemRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px 1.6fr 0.8fr 0.8fr',
  gap: 10,
  padding: '12px 16px',
  borderBottom: '1px solid #1f2937',
  alignItems: 'center',
}

const rankCellStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: '#93c5fd',
}

const nameCellStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
}

const teamCellStyle: React.CSSProperties = {
  color: '#cbd5e1',
  fontSize: 14,
}

const valueCellStyle: React.CSSProperties = {
  textAlign: 'right',
  fontWeight: 900,
  fontSize: 16,
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#94a3b8',
}