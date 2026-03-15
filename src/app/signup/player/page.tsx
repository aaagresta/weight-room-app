'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Athlete = {
  id: string
  first_name: string
  last_name: string
  team_level: string | null
}

export default function PlayerSignupPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthleteId, setSelectedAthleteId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAthletes()
  }, [])

  async function loadAthletes() {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, team_level')
      .order('last_name', { ascending: true })

    if (error) {
      console.error(error)
      setMessage(`Error loading athletes: ${error.message}`)
      setAthletes([])
    } else {
      setAthletes(data || [])
    }

    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!selectedAthleteId) {
      setMessage('Please select your name.')
      return
    }

    if (!email.trim() || !password.trim()) {
      setMessage('Email and password are required.')
      return
    }

    const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId)

    if (!selectedAthlete) {
      setMessage('Selected athlete not found.')
      return
    }

    const fullName = `${selectedAthlete.first_name} ${selectedAthlete.last_name}`

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      console.error(error)
      setMessage(`Signup error: ${error.message}`)
      return
    }

    if (!data.user) {
      setMessage('Signup completed, but no user was returned.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert([
      {
        id: data.user.id,
        email: email.trim(),
        full_name: fullName,
        role: 'player',
        athlete_id: selectedAthleteId,
      },
    ])

    if (profileError) {
      console.error(profileError)
      setMessage(`Account created, but profile link failed: ${profileError.message}`)
      return
    }

    setMessage('Account created successfully. Your profile is now linked.')
    setSelectedAthleteId('')
    setEmail('')
    setPassword('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Player Sign Up</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
          Choose your name from the roster and create your account.
        </p>

        {loading ? (
          <p>Loading roster...</p>
        ) : (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Select Your Name</label>
              <select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choose your name</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.first_name} {athlete.last_name}
                    {athlete.team_level ? ` (${athlete.team_level})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="Create a password"
              />
            </div>

            <button type="submit" style={buttonStyle}>
              Create Player Account
            </button>
          </form>
        )}

        {message && (
          <p style={{ marginTop: 16, color: message.startsWith('Signup error') || message.includes('failed') ? '#f87171' : '#4ade80' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
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

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}