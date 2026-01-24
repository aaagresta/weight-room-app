"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  grad_year: number | null;
  position: string | null;
  role: "admin" | "player";
};

type Plan = { id: string; name: string; is_active: boolean };

type Assignment = {
  player_id: string;
  plan_id: string;
  start_date: string; // YYYY-MM-DD
  plan_name?: string;
};

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [error, setError] = useState<string | null>(null);

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, grad_year, position, role")
        .order("last_name", { ascending: true });

      if (pErr) return setError(pErr.message);
      setPlayers((pData ?? []).filter((p: any) => p.role === "player"));

      const { data: planData, error: planErr } = await supabase
        .from("plans")
        .select("id, name, is_active")
        .order("created_at", { ascending: false });

      if (planErr) return setError(planErr.message);
      setPlans(planData ?? []);

      const { data: aData, error: aErr } = await supabase
        .from("plan_assignments")
        .select("player_id, plan_id, start_date, plans(name)")
        .order("created_at", { ascending: false });

      if (aErr) return setError(aErr.message);

      const map: Record<string, Assignment> = {};
      (aData ?? []).forEach((a: any) => {
        // keep most recent assignment per player
        if (!map[a.player_id]) {
          map[a.player_id] = {
            player_id: a.player_id,
            plan_id: a.plan_id,
            start_date: a.start_date,
            plan_name: a.plans?.name ?? "Plan",
          };
        }
      });
      setAssignments(map);
    })();
  }, []);

  async function assignPlan(playerId: string, planId: string, startDate: string) {
    setError(null);

    const { error } = await supabase.from("plan_assignments").insert({
      player_id: playerId,
      plan_id: planId,
      start_date: startDate,
    });

    if (error) return setError(error.message);

    // refresh that player's latest assignment
    const { data: aData } = await supabase
      .from("plan_assignments")
      .select("player_id, plan_id, start_date, plans(name)")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest: any = aData?.[0];
    if (latest) {
      setAssignments((prev) => ({
        ...prev,
        [playerId]: {
          player_id: latest.player_id,
          plan_id: latest.plan_id,
          start_date: latest.start_date,
          plan_name: latest.plans?.name ?? "Plan",
        },
      }));
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Players</h2>
      <div style={{ opacity: 0.8, marginBottom: 12 }}>
        Assign each player a plan + start date. That start date is the <b>calendar anchor</b>.
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {players.map((p) => {
          const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed Player";
          const current = assignments[p.id];

          return (
            <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{name}</div>
                  <div style={{ opacity: 0.85 }}>
                    Grad: {p.grad_year ?? "—"} • Position: {p.position ?? "—"}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>
                    Current plan: <b>{current?.plan_name ?? "None"}</b>{" "}
                    {current?.start_date ? <span>(start {current.start_date})</span> : null}
                  </div>
                </div>

                <AssignForm
                  plans={plans}
                  defaultStartDate={todayISO}
                  onAssign={(planId, startDate) => assignPlan(p.id, planId, startDate)}
                />
              </div>
            </div>
          );
        })}
        {players.length === 0 && <div style={{ opacity: 0.7 }}>No players found yet (users become players when they sign up).</div>}
      </div>
    </section>
  );
}

function AssignForm({
  plans,
  defaultStartDate,
  onAssign,
}: {
  plans: Plan[];
  defaultStartDate: string;
  onAssign: (planId: string, startDate: string) => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(defaultStartDate);

  useEffect(() => {
    if (!planId && plans[0]?.id) setPlanId(plans[0].id);
  }, [plans, planId]);

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 260 }}>
      <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ padding: 10 }}>
        {plans.map((pl) => (
          <option key={pl.id} value={pl.id}>
            {pl.name}{pl.is_active ? "" : " (inactive)"}
          </option>
        ))}
      </select>

      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: 10 }} />

      <button
        onClick={() => planId && startDate && onAssign(planId, startDate)}
        style={{ padding: 10, fontWeight: 800 }}
        disabled={!planId || !startDate}
      >
        Assign
      </button>
    </div>
  );
}
