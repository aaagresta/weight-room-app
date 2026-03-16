'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function PendingApprovalPage() {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Pending Approval</h1>
        <p style={{ color: '#d4d4d8', lineHeight: 1.6 }}>
          Your account has been created and is waiting for admin approval.
          Once a coach or admin approves your request, you will be able to log in normally.
        </p>

        <button onClick={handleLogout} style={buttonStyle}>
          Log Out
        </button>
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
  maxWidth: 500,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 24,
}

const buttonStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid #991b1b',
  backgroundColor: '#991b1b',
  color: '#ffffff',
  cursor: 'pointer',
}