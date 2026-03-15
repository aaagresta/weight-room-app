'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  grad_year: number | null
  positions: string[] | null
  team_level: string | null
}

type Pod = {
  podName: string
  rackName: string
  players: Athlete[]
  exercise?: string
}

type LiveRoomSession = {
  id: string
  session_date: string
  team: string | null
  rack_count: number
  timer_seconds: number
  timer_running: boolean
  pods: Pod[]
  attendance_map: Record<string, string>
  current_block: string | null
}

export default function SessionTvPage() {
  const [session, setSession] = useState<LiveRoomSession | null>(null)

  useEffect(() => {
    loadSession()

    const interval = setInterval(() => {
      loadSession()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  async function loadSession() {
    const { data, error } = await supabase
      .from('live_room_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error(error)
      return
    }

    setSession(data as LiveRoomSession)
  }

  const seconds = session?.timer_seconds ?? 0
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60
  ).padStart(2, '0')}`

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#ffffff', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, color: '#93c5fd', marginBottom: 8 }}>
          Valley Christian Weight Room
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          {session?.team || 'Team'} Lift Session
        </div>

        <div style={{ fontSize: 18, color: '#a1a1aa', marginBottom: 16 }}>
          {session?.session_date || ''}
        </div>

        <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, letterSpacing: 4, marginBottom: 12 }}>
          {formattedTime}
        </div>

        <div
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            borderRadius: 999,
            backgroundColor: session?.timer_running ? '#166534' : '#3f3f46',
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {session?.timer_running ? 'TIMER RUNNING' : 'TIMER PAUSED'}
        </div>
      </div>

      {!session || session.pods.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#d4d4d8', fontSize: 24, marginTop: 60 }}>
          No session board data available yet.
          <br />
          Build pods on the session page first.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {session.pods.map((pod) => (
            <div
              key={`${pod.podName}-${pod.rackName}`}
              style={{
                border: '2px solid #1d4ed8',
                borderRadius: 18,
                padding: 20,
                backgroundColor: '#0f172a',
                minHeight: 280,
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>
                {pod.rackName}
              </div>

              <div style={{ fontSize: 24, color: '#93c5fd', marginBottom: 8 }}>
                {pod.podName}
              </div>

              <div style={{ fontSize: 20, color: '#facc15', marginBottom: 18 }}>
                {pod.exercise || 'Lift'}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {pod.players.length === 0 ? (
                  <div style={{ color: '#d4d4d8', fontSize: 20 }}>
                    No players assigned
                  </div>
                ) : (
                  pod.players.map((player) => (
                    <div
                      key={player.id}
                      style={{
                        backgroundColor: '#1e293b',
                        borderRadius: 12,
                        padding: '12px 14px',
                        fontSize: 24,
                        fontWeight: 600,
                      }}
                    >
                      {player.first_name} {player.last_name}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}