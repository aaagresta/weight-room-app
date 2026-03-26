"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requireAdmin } from "@/lib/admin";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTvPage = pathname === "/admin/session/tv";

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
    if (isTvPage) {
      return (
        <main
          style={{
            width: "100vw",
            height: "100vh",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            backgroundColor: "#000000",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {error ? <div style={{ color: "crimson" }}>{error}</div> : <div>Checking admin access…</div>}
        </main>
      );
    }

    return (
      <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : <div>Checking admin access…</div>}
      </main>
    );
  }

  if (isTvPage) {
    return (
      <main
        style={{
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          backgroundColor: "#000000",
        }}
      >
        {children}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "30px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ opacity: 0.75, fontSize: 17 }}>Admin Dashboard</div>
          <Image src="/logo.png" alt="VCS Logo" width={100} height={60} priority />
          <div style={{ fontSize: 22, fontWeight: 900 }}>Offseason Workout Manager</div>
        </div>
        <button onClick={signOut} style={{ padding: "8px 12px" }}>
          Sign out
        </button>
      </header>

      <nav style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <Link href="/admin" style={linkStyle}>
          Home
        </Link>
    
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