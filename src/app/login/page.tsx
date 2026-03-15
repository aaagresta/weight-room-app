'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'



export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
  checkExistingSession()
}, [])

async function checkExistingSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) return

  if (profile.role === 'admin' || profile.role === 'coach') {
    router.push('/admin')
    return
  }

  if (profile.role === 'athlete' || profile.role === 'player') {
    router.push('/player/workout')
    return
  }
}

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Login succeeded, but user could not be loaded.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      setMessage('Could not load your profile role.')
      setLoading(false)
      return
    }

    if (profile.role === 'admin' || profile.role === 'coach') {
      router.push('/admin')
      return
    }

   if (profile.role === 'athlete' || profile.role === 'player') {
  router.push('/player/workout')
  return
}

    setMessage('Your account does not have a valid role.')
    setLoading(false)
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
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Weight Room Login</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
          Log in to access your dashboard or workout.
        </p>

        <form onSubmit={handleLogin}>
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
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          <a href="/signup/player" style={linkStyle}>
            New player? Create player account
          </a>

          <a href="/signup/coach" style={linkStyle}>
            Coach / admin signup
          </a>
        </div>

        {message && (
          <p style={{ marginTop: 16, color: '#f87171' }}>
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

const linkStyle: React.CSSProperties = {
  color: '#93c5fd',
  textDecoration: 'none',
}