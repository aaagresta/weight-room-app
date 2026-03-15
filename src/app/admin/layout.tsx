"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requireAdmin } from "@/lib/admin";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await requireAdmin();
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      setReady(true);
    })().catch((e) => setError(e?.message ?? "Admin check failed"));
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!ready) {
    return (
      <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : <div>Checking admin access…</div>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Admin</div>
          <Image src="/logo.png" alt="VCS Logo" width={60} height={60} priority />
          <div style={{ fontSize: 22, fontWeight: 900 }}>Offseason Workout Manager</div>
        </div>
        <button onClick={signOut} style={{ padding: "8px 12px" }}>Sign out</button>
      </header>

      <nav style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <Link href="/admin" style={linkStyle}>Home</Link>
        <Link href="/admin/players" style={linkStyle}>Players</Link>
        <Link href="/admin/plans" style={linkStyle}>Plans</Link>
        <Link href="/admin/exercises" style={linkStyle}>Exercise Library</Link>
      </nav>

      <div style={{ marginTop: 18 }}>{children}</div>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 700,
};

