"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setPlans((data ?? []) as Plan[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Plan name is required.");

    const { error } = await supabase.from("plans").insert({
      name: name.trim(),
      description: description.trim() || null,
      is_active: true,
    });

    if (error) return setError(error.message);

    setName("");
    setDescription("");
    load();
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Plans</h2>
      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gap: 14 }}>
        <form onSubmit={createPlan} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Create a new plan</div>
          <div style={{ display: "grid", gap: 8 }}>
            <input placeholder="Plan name (ex: Offseason 2026)" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10 }} />
            <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 10, minHeight: 80 }} />
            <button style={{ padding: 10, fontWeight: 900 }}>Create</button>
          </div>
        </form>

        <div style={{ display: "grid", gap: 10 }}>
          {plans.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{p.name}</div>
                  {p.description && <div style={{ opacity: 0.85, marginTop: 4 }}>{p.description}</div>}
                  <div style={{ opacity: 0.75, marginTop: 6 }}>
                    Status: {p.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
                <Link href={`/admin/plans/${p.id}`} style={{ ...btnLink, alignSelf: "center" }}>
                  Open builder
                </Link>
              </div>
            </div>
          ))}
          {plans.length === 0 && <div style={{ opacity: 0.7 }}>No plans yet.</div>}
        </div>
      </div>
    </section>
  );
}

const btnLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 12,
  textDecoration: "none",
  fontWeight: 900,
};

