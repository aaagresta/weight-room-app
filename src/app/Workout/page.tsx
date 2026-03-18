"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";


type Row = {
  day_exercise_id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps: string | null;
  target_load: string | null;
  notes: string | null;
  exercise_name: string;
};

type LogCell = { reps: string; weight: string; rpe: string };

export default function WorkoutPage() {
  const router = useRouter();
  const params = useParams<{ planDayId: string }>();
  const planDayId = params.planDayId;

  const [title, setTitle] = useState<string>("Workout");
  const [rows, setRows] = useState<Row[]>([]);
  const [logs, setLogs] = useState<Record<string, LogCell[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialized = useMemo(() => Object.keys(logs).length > 0, [logs]);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push("/");
        return;
      }

      // Get plan day title
      const { data: day, error: dErr } = await supabase
        .from("plan_days")
        .select("title")
        .eq("id", planDayId)
        .single();

      if (!dErr) setTitle(day.title);

      // Fetch prescription
      const { data, error } = await supabase
        .from("day_exercises")
        .select("id, sort_order, target_sets, target_reps, target_load, notes, exercise_library(name)")
        .eq("plan_day_id", planDayId)
        .order("sort_order", { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      const mapped: Row[] =
        (data ?? []).map((x: any) => ({
          day_exercise_id: x.id,
          sort_order: x.sort_order ?? 0,
          target_sets: x.target_sets,
          target_reps: x.target_reps,
          target_load: x.target_load,
          notes: x.notes,
          exercise_name: x.exercise_library?.name ?? "Exercise",
        })) ?? [];

      setRows(mapped);

      // Initialize logs based on target_sets (default 3 if null)
      const init: Record<string, LogCell[]> = {};
      for (const r of mapped) {
        const sets = r.target_sets ?? 3;
        init[r.day_exercise_id] = Array.from({ length: sets }).map(() => ({
          reps: "",
          weight: "",
          rpe: "",
        }));
      }
      setLogs(init);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDayId]);

  function updateCell(dayExerciseId: string, setIdx: number, field: keyof LogCell, value: string) {
    setLogs((prev) => {
      const copy = { ...prev };
      const arr = [...(copy[dayExerciseId] ?? [])];
      const cell = { ...(arr[setIdx] ?? { reps: "", weight: "", rpe: "" }) };
      cell[field] = value;
      arr[setIdx] = cell;
      copy[dayExerciseId] = arr;
      return copy;
    });
  }

  async function saveWorkout() {
    setSaving(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push("/");
      return;
    }

    // Create a workout_session
    const { data: sessionRow, error: sErr } = await supabase
      .from("workout_sessions")
      .insert({
        player_id: user.id,
        plan_day_id: planDayId,
        performed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sErr) {
      setError(sErr.message);
      setSaving(false);
      return;
    }

    const workout_session_id = sessionRow.id as string;

    // Build set_logs
    const payload: any[] = [];
    for (const r of rows) {
      const setArr = logs[r.day_exercise_id] ?? [];
      setArr.forEach((cell, idx) => {
        const reps = cell.reps.trim() === "" ? null : Number(cell.reps);
        const weight = cell.weight.trim() === "" ? null : Number(cell.weight);
        const rpe = cell.rpe.trim() === "" ? null : Number(cell.rpe);

        // Skip completely empty rows
        if (reps === null && weight === null && rpe === null) return;

        payload.push({
          workout_session_id,
          day_exercise_id: r.day_exercise_id,
          set_number: idx + 1,
          reps,
          weight,
          rpe,
        });
      });
    }

    if (payload.length > 0) {
      const { error: lErr } = await supabase.from("set_logs").insert(payload);
      if (lErr) {
        setError(lErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Workout</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{title}</h1>
        </div>
        <button onClick={() => router.push("/dashboard")} style={{ padding: "8px 12px" }}>
          Back
        </button>
      </header>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      {!initialized && <div style={{ marginTop: 14 }}>Loading workout…</div>}

      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        {rows.map((r) => {
          const setArr = logs[r.day_exercise_id] ?? [];
          return (
            <section key={r.day_exercise_id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{r.exercise_name}</div>
                  <div style={{ opacity: 0.85 }}>
                    Target: {r.target_sets ?? "—"} sets • reps {r.target_reps ?? "—"} • load {r.target_load ?? "—"}
                  </div>
                  {r.notes && <div style={{ marginTop: 6, opacity: 0.8 }}>{r.notes}</div>}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {setArr.map((cell, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 1fr 1fr",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Set {idx + 1}</div>
                    <input
                      placeholder="Reps"
                      value={cell.reps}
                      onChange={(e) => updateCell(r.day_exercise_id, idx, "reps", e.target.value)}
                      style={{ padding: 10 }}
                      inputMode="numeric"
                    />
                    <input
                      placeholder="Weight"
                      value={cell.weight}
                      onChange={(e) => updateCell(r.day_exercise_id, idx, "weight", e.target.value)}
                      style={{ padding: 10 }}
                      inputMode="decimal"
                    />
                    <input
                      placeholder="RPE (optional)"
                      value={cell.rpe}
                      onChange={(e) => updateCell(r.day_exercise_id, idx, "rpe", e.target.value)}
                      style={{ padding: 10 }}
                      inputMode="decimal"
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={saveWorkout} disabled={saving} style={{ padding: "12px 14px", fontWeight: 800 }}>
          {saving ? "Saving…" : "Submit Workout"}
        </button>
      </div>
    </main>
  );
}
