'use client'

import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'player' | 'coach'>('player')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setMessage('Name, email, and password are required.')
      setLoading(false)
      return
    }

    const cleanName = fullName.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setMessage('Account created, but no user was returned.')
      setLoading(false)
      return
    }

    const safeRoleForProfile = role === 'coach' ? 'admin' : 'player'

    const { error: profileError } = await supabase.from('profiles').upsert([
      {
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanName,
        requested_role: role,
        role: safeRoleForProfile,
        approval_status: 'pending',
        athlete_id: null,
      },
    ])

    if (profileError) {
      setMessage(`Account created, but profile setup failed: ${profileError.message}`)
      setLoading(false)
      return
    }

    setMessage('Account created. It is now waiting for admin approval.')
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('player')
    setLoading(false)
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Create Account</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
          Your account will be reviewed by an admin before access is granted.
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              placeholder="Your full name"
            />
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

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Create a password"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'player' | 'coach')}
              style={inputStyle}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
            </select>
          </div>

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <a href="/login" style={linkStyle}>Back to Login</a>
        </div>

        {message && (
          <p
            style={{
              marginTop: 16,
              color:
                message.includes('failed') ||
                message.includes('required') ||
                message.includes('Account created, but')
                  ? '#f87171'
                  : '#4ade80',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#000000',
  color: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 24,
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
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}

const linkStyle: React.CSSProperties = {
  color: '#93c5fd',
  textDecoration: 'none',
}