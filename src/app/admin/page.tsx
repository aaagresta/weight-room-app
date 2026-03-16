'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  async function checkAdminAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      router.push('/login')
      return
    }

    if (
      profile.role !== 'admin' &&
      profile.role !== 'coach'
    ) {
      router.push('/login')
      return
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          backgroundColor: '#000000',
          minHeight: '100vh',
          color: '#ffffff',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 40,
        backgroundColor: '#000000',
        minHeight: '100vh',
        color: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Weight Room Admin Dashboard</h1>
          <p style={{ margin: 0, color: '#a1a1aa' }}>
            Manage players, attendance, exercises, workouts, and lift sessions.
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #991b1b',
            backgroundColor: '#991b1b',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Log Out
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >

        <a href="/admin/monitor" style={cardStyle}>
  <h2 style={cardTitleStyle}>Live Monitor</h2>
  <p style={cardTextStyle}>See who is logging lifts and monitor progress live.</p>
</a> 

        <a href="/admin/assignments" style={cardStyle}>
  <h2 style={cardTitleStyle}>Workout Assignments</h2>
  <p style={cardTextStyle}>Choose which saved workouts are visible to teams or players.</p>
</a>

        <a href="/admin/players" style={cardStyle}>
          <h2 style={cardTitleStyle}>Players</h2>
          <p style={cardTextStyle}>View player data, attendance, and progress.</p>
        </a>

        <a href="/admin/attendance" style={cardStyle}>
          <h2 style={cardTitleStyle}>Attendance</h2>
          <p style={cardTextStyle}>Mark daily attendance for the whole team.</p>
        </a>
       
        <a href="/admin/maxes" style={cardStyle}>
          <h2 style={cardTitleStyle}>Player Maxes</h2>
          <p style={cardTextStyle}>Track PRs and training maxes for main lifts.</p>
        </a>

        <a href="/admin/exercises" style={cardStyle}>
          <h2 style={cardTitleStyle}>Exercises</h2>
          <p style={cardTextStyle}>Manage your exercise library and lift options.</p>
        </a>

        <a href="/admin/assign-workout" style={cardStyle}>
          <h2 style={cardTitleStyle}>Daily Workout Builder</h2>
          <p style={cardTextStyle}>Create custom daily workouts for each team.</p>
        </a>

        <a href="/admin/days" style={cardStyle}>
          <h2 style={cardTitleStyle}>Training Days</h2>
          <p style={cardTextStyle}>Build daily sessions and organize training flow.</p>
        </a>

        <a href="/admin/session" style={cardStyle}>
          <h2 style={cardTitleStyle}>Start Lift Session</h2>
          <p style={cardTextStyle}>Run today’s lift, track attendance, and control the room.</p>
        </a>

        <a href="/admin/lifts" style={cardStyle}>
          <h2 style={cardTitleStyle}>Lift Logs</h2>
          <p style={cardTextStyle}>Record and review player lift data.</p>
        </a>

        <a href="/admin/max-submissions" style={cardStyle}>
  <h2 style={cardTitleStyle}>Max Submissions</h2>
  <p style={cardTextStyle}>Approve or reject player-submitted max updates.</p>
</a>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  padding: '20px',
  border: '1px solid #52525b',
  borderRadius: '12px',
  textDecoration: 'none',
  color: '#ffffff',
  backgroundColor: '#18181b',
}

const cardTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  color: '#ffffff',
}

const cardTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#a1a1aa',
}