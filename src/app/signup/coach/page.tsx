'use client'

import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function CoachSignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setMessage('Name, email, and password are required.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (!data.user) {
      setMessage('Account created, but no user was returned.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').upsert([
      {
        id: data.user.id,
        email: email.trim(),
        full_name: fullName.trim(),
        role: 'coach',
        athlete_id: null,
      },
    ])

    if (profileError) {
      setMessage(`Account created, but profile setup failed: ${profileError.message}`)
      return
    }

    setMessage('Coach/admin account created successfully.')
    setFullName('')
    setEmail('')
    setPassword('')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Coach / Admin Signup</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
          Create a staff account.
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              placeholder="Your name"
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
            Create Coach Account
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 16, color: message.includes('failed') || message.includes('required') ? '#f87171' : '#4ade80' }}>
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
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #166534',
  backgroundColor: '#166534',
  color: '#ffffff',
  cursor: 'pointer',
}