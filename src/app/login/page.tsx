'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
      .select('role, approval_status')
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
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      setMessage('Could not load your profile role.')
      setLoading(false)
      return
    }

  if (profile.approval_status === 'pending') {
  router.push('/pending-approval')
  return
}

if (profile.approval_status === 'rejected') {
  setMessage('Your account request was rejected.')
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
    <div style={pageStyle}>
      <div style={overlayStyle} />

      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={logoWrapStyle}>
            <Image
              src="/EAGLE WING LOGO.png"
              alt="Valley Christian Logo"
              width={400}
              height={400}
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>

          <h1 style={titleStyle}>EAGLE STRENGTH</h1>
          <p style={subtitleStyle}>
            Valley Christian Strength and Conditioning portal.
            Log in to access your stength and conditioning path. 
          </p>
        </div>

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
          <a href="/signup" style={linkStyle}>
                   Create Account
          </a>
        </div>

        {message && (
          <p style={{ marginTop: 16, color: '#f87171', textAlign: 'center' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(135deg, #020617 0%, #0f172a 45%, #172554 100%)',
  color: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
  position: 'relative',
  overflow: 'hidden',
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 35%)',
  pointerEvents: 'none',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 460,
  backgroundColor: 'rgba(24, 24, 27, 0.94)',
  border: '1px solid #334155',
  borderRadius: 20,
  padding: 28,
  boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
  position: 'relative',
  zIndex: 1,
}

const logoWrapStyle: React.CSSProperties = {
  width: 130,
  height: 130,
  margin: '0 auto 16px auto',
  borderRadius: 999,
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: 30,
  fontWeight: 800,
}

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#94a3b8',
  fontSize: 15,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#d4d4d8',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 13,
  borderRadius: 12,
  border: '1px solid #475569',
  backgroundColor: '#0f172a',
  color: '#ffffff',
  outline: 'none',
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid #1d4ed8',
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700,
}

const linkStyle: React.CSSProperties = {
  color: '#93c5fd',
  textDecoration: 'none',
  textAlign: 'center',
}