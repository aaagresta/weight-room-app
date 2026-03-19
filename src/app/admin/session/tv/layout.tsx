'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isTvPage = pathname === '/admin/session/tv'

  if (isTvPage) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#000000',
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 24,
        }}
      >
        {/* KEEP YOUR EXISTING ADMIN HEADER / LOGO / NAV HERE */}
        {children}
      </div>
    </div>
  )
}