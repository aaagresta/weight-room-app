"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    router.push("/dashboard");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    setMsg("Account created. Now sign in.");
  }

  return (
    <main style={{ maxWidth: 420, margin: "70px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Team Workout App</h1>
      <p style={{ opacity: 0.8 }}>Sign in to continue</p>

      <form style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ padding: 10 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={{ padding: 10 }} />
        {msg && <div style={{ color: msg.includes("created") ? "green" : "crimson" }}>{msg}</div>}
        <button onClick={signIn} disabled={loading} style={{ padding: 10 }}>{loading ? "..." : "Sign In"}</button>
        <button onClick={signUp} disabled={loading} style={{ padding: 10 }}>{loading ? "..." : "Create Account"}</button>
      </form>
    </main>
  );
}