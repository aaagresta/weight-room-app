"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { getWeekAndDay } from "@/lib/date";

<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
  <Image src="/logo.png" alt="VCS Logo" width={50} height={50} priority />
  <div>
    <div style={{ fontSize: 22, fontWeight: 900 }}>Player Dashboard</div>
    <div style={{ opacity: 0.75, fontSize: 12 }}>Valley Christian Offseason Program</div>
  </div>
</div>

type Assignment = {
  plan_id: string;
  start_date: string; // YYYY-MM-DD
};

type PlanDay = {
  id: string;
  title: string;
  day_number: number;
  plan_week_id: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.push("/");
        return;
      }

      // Get the player's current assignment (MVP assumes 1 active plan)
      const { data: a, error: aErr } = await supabase
        .from("plan_assignments")
        .select("plan_id, start_date")
        .eq("player_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aErr) {
        setError(aErr.message);
        setLoading(false);
        return;
      }

      if (!a) {
        setAssignment(null);
        setPlanDay(null);
        setLoading(false);
        return;
      }

      setAssignment(a);

      const { weekNumber, dayNumber } = getWeekAndDay(a.start_date, new Date());

      // Find week id
      const { data: weekRow, error: wErr } = await supabase
        .from("plan_weeks")
        .select("id")
        .eq("plan_id", a.plan_id)
        .eq("week_number", weekNumber)
        .maybeSingle();

      if (wErr) {
        setError(wErr.message);
        setLoading(false);
        return;
      }

      if (!weekRow) {
        setPlanDay(null);
        setLoading(false);
        return;
      }

      const { data: dRow, error: dErr } = await supabase
        .from("plan_days")
        .select("id, title, day_number, plan_week_id")
        .eq("plan_week_id", weekRow.id)
        .eq("day_number", dayNumber)
        .maybeSingle();

      if (dErr) {
        setError(dErr.message);
        setLoading(false);
        return;
      }

      setPlanDay(dRow ?? null);

      // Completed today?
      if (dRow) {
        const start = new Date(todayKey + "T00:00:00");
        const end = new Date(todayKey + "T23:59:59");

        const { data: sRow, error: sErr } = await supabase
          .from("workout_sessions")
          .select("id")
          .eq("player_id", user.id)
          .eq("plan_day_id", dRow.id)
          .gte("performed_at", start.toISOString())
          .lte("performed_at", end.toISOString())
          .limit(1);

        if (!sErr) setCompletedToday((sRow?.length ?? 0) > 0);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, todayKey]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>Loading...</main>;

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Player Dashboard</h1>
        <button onClick={signOut} style={{ padding: "8px 12px" }}>Sign out</button>
      </header>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      {!assignment && (
        <div style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700 }}>No plan assigned yet</div>
          <div style={{ opacity: 0.85 }}>Coach hasn’t assigned your offseason plan.</div>
        </div>
      )}

      {assignment && (
        <section style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Today ({todayKey})</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {planDay ? planDay.title : "No workout found for today"}
              </div>
              {planDay && (
                <div style={{ opacity: 0.85 }}>
                  Status: {completedToday ? "✅ Completed" : "⏳ Not completed"}
                </div>
              )}
            </div>

            {planDay && (
              <button
                onClick={() => router.push(`/workout/${planDay.id}`)}
                style={{ padding: "10px 12px", fontWeight: 700 }}
              >
                {completedToday ? "View / Re-log" : "Start Workout"}
              </button>
            )}
          </div>
        </section>
      )}

      <section style={{ marginTop: 20, opacity: 0.8 }}>
        Next MVP add-ons: recent sessions list + simple volume totals per lift.
      </section>
    </main>
  );
}

