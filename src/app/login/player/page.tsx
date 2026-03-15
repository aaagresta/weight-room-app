'use client'

import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function PlayerLogin() {

  const router = useRouter()

  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')

  async function login(e:any){
    e.preventDefault()

    const {error} = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if(error){
      setMessage(error.message)
      return
    }

    router.push('/player/workout')
  }

  return(

    <div style={{
      minHeight:'100vh',
      background:'#000',
      color:'#fff',
      display:'flex',
      justifyContent:'center',
      alignItems:'center'
    }}>

      <form onSubmit={login} style={{
        background:'#18181b',
        padding:30,
        borderRadius:10,
        width:350
      }}>

        <h2>Player Login</h2>

        <input
        placeholder="Email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
        style={input}
        />

        <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e=>setPassword(e.target.value)}
        style={input}
        />

        <button style={button}>
          Login
        </button>

        <p>{message}</p>

      </form>

    </div>

  )
}

const input = {
  width:'100%',
  padding:10,
  marginBottom:10,
  borderRadius:8,
  border:'1px solid #444',
  background:'#27272a',
  color:'#fff'
}

const button = {
  width:'100%',
  padding:12,
  borderRadius:8,
  border:'none',
  background:'#16a34a',
  color:'#fff',
  cursor:'pointer'
}
