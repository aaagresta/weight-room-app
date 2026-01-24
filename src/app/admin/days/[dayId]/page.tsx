"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

type LibraryEx = { id: string; name: string };
type DayExercise = {
  id: string;
  sort_order: number;
  target_sets: number | null;
  target_reps: string | null;
  target_load: string | null;
  notes: string | null;
  exercise_id: string;
  exercise_name: string;
};

export default function AdminDayEditor() {
 const params = useParams();
const raw = (params as any).dayId;
const dayId = Array.isArray(raw) ? raw[0] : raw;

if (!dayId) {
  return <div style={{ padding: 16, color: "crimson" }}>Missing dayId in URL.</div>;
}


  const [dayTitle, setDayTitle] = useState("Day");
  const [library, setLibrary] = useState<LibraryEx[]>([]);
  const [items, setItems] = useState<DayExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("5");
  const [load, setLoad] = useState("70%");
  const [notes, setNotes] = useState("");

  async function loadAll() {
    setError(null);

    const { data: dRow } = await supabase.from("plan_days").select("title").eq("id", dayId).single();
    if (dRow?.title) setDayTitle(dRow.title);

    const { data: lib, error: lErr } = await supabase
      .from("exercise_library")
      .select("id, name")
      .order("name", { ascending: true });

    if (lErr) return setError(lErr.message);
    setLibrary((lib ?? []) as LibraryEx[]);
    if (!exerciseId && lib?.[0]?.id) setExerciseId(lib[0].id);

    const { data, error } = await supabase
      .from("day_exercises")
      .select("id, sort_order, target_sets, target_reps, target_load, notes, exercise_id, exercise_library(name)")
      .eq("plan_day_id", dayId)
      .order("sort_order", { ascending: true });

    if (error) return setError(error.message);

    const mapped: DayExercise[] = (data ?? []).map((x: any) => ({
      id: x.id,
      sort_order: x.sort_order ?? 0,
      target_sets: x.target_sets,
      target_reps: x.target_reps,
      target_load: x.target_load,
      notes: x.notes,
      exercise_id: x.exercise_id,
      exercise_name: x.exercise_library?.name ?? "Exercise",
    }));
    setItems(mapped);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  async function addExercise(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!exerciseId) return setError("Pick an exercise.");

    const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1;

    const { error } = await supabase.from("day_exercises").insert({
      plan_day_id: dayId,
      exercise_id: exerciseId,
      sort_order: nextOrder,
      target_sets: sets.trim() ? Number(sets) : null,
      target_reps: reps.trim() || null,
      target_load: load.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) return setError(error.message);

    setNotes("");
    loadAll();
  }

  async function updateField(id: string, patch: Partial<DayExercise>) {
    setError(null);
    const { error } = await supabase
      .from("day_exercises")
      .update({
        target_sets: patch.target_sets ?? undefined,
        target_reps: patch.target_reps ?? undefined,
        target_load: patch.target_load ?? undefined,
        notes: patch.notes ?? undefined,
      })
      .eq("id", id);

    if (error) setError(error.message);
    else loadAll();
  }

  async function move(id: string, direction: -1 | 1) {
    setError(null);
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;

    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx];
    const b = items[swapIdx];

    // swap sort_order
    const { error: e1 } = await supabase.from("day_exercises").update({ sort_order: b.sort_order }).eq("id", a.id);
    const { error: e2 } = await supabase.from("day_exercises").update({ sort_order: a.sort_order }).eq("id", b.id);

    if (e1 || e2) setError((e1 ?? e2)?.message ?? "Reorder failed");
    else loadAll();
  }

  async function remove(id: string) {
    setError(null);
    const { error } = await supabase.from("day_exercises").delete().eq("id", id);
    if (error) setError(error.message);
    else loadAll();
  }

  return (
    <section>
      <div style={{ opacity: 0.75, fontSize: 13 }}>Edit day</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{dayTitle}</h2>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      <form onSubmit={addExercise} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Add exercise to day</div>
        <div style={{ display: "grid", gap: 8 }}>
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} style={{ padding: 10 }}>
            {library.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={sets} onChange={(e) => setSets(e.target.value)} placeholder="Sets" style={{ padding: 10, width: 120 }} />
            <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Reps (ex: 5 or 8-10)" style={{ padding: 10, width: 220 }} />
            <input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="Load (ex: 70% / RPE 7 / 225)" style={{ padding: 10, width: 260 }} />
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ padding: 10, minHeight: 70 }} />

          <button style={{ padding: 10, fontWeight: 900 }}>Add</button>
        </div>
      </form>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {items.map((i) => (
          <div key={i.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900 }}>{i.exercise_name}</div>
                <div style={{ opacity: 0.85 }}>
                  Target: {i.target_sets ?? "—"} sets • reps {i.target_reps ?? "—"} • load {i.target_load ?? "—"}
                </div>
                {i.notes && <div style={{ opacity: 0.8, marginTop: 6 }}>{i.notes}</div>}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => move(i.id, -1)} style={{ padding: "8px 10px" }}>↑</button>
                <button onClick={() => move(i.id, 1)} style={{ padding: "8px 10px" }}>↓</button>
                <button onClick={() => remove(i.id)} style={{ padding: "8px 10px" }}>Delete</button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                defaultValue={i.target_sets ?? ""}
                placeholder="Sets"
                style={{ padding: 10, width: 120 }}
                onBlur={(e) => updateField(i.id, { target_sets: e.target.value ? Number(e.target.value) : null })}
              />
              <input
                defaultValue={i.target_reps ?? ""}
                placeholder="Reps"
                style={{ padding: 10, width: 200 }}
                onBlur={(e) => updateField(i.id, { target_reps: e.target.value || null })}
              />
              <input
                defaultValue={i.target_load ?? ""}
                placeholder="Load"
                style={{ padding: 10, width: 240 }}
                onBlur={(e) => updateField(i.id, { target_load: e.target.value || null })}
              />
              <input
                defaultValue={i.notes ?? ""}
                placeholder="Notes"
                style={{ padding: 10, minWidth: 260, flex: 1 }}
                onBlur={(e) => updateField(i.id, { notes: e.target.value || null })}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ opacity: 0.7 }}>No exercises on this day yet.</div>}
      </div>
    </section>
  );
}
