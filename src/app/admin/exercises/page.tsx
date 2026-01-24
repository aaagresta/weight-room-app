"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Ex = { id: string; name: string; category: string | null; default_unit: string | null };

export default function AdminExercisesPage() {
  const [items, setItems] = useState<Ex[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("lb");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from("exercise_library")
      .select("id, name, category, default_unit")
      .order("name", { ascending: true });

    if (error) setError(error.message);
    else setItems((data ?? []) as Ex[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function addExercise(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Exercise name required.");

    const { error } = await supabase.from("exercise_library").insert({
      name: name.trim(),
      category: category.trim() || null,
      default_unit: unit.trim() || null,
    });

    if (error) return setError(error.message);

    setName("");
    setCategory("");
    setUnit("lb");
    load();
  }

  async function remove(id: string) {
    setError(null);
    const { error } = await supabase.from("exercise_library").delete().eq("id", id);
    if (error) return setError(error.message);
    load();
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Exercise Library</h2>
      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      <form onSubmit={addExercise} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Add exercise</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="Name (ex: Back Squat)" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10 }} />
          <input placeholder="Category (ex: Lower / Upper / Accessory)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 10 }} />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ padding: 10, width: 140 }}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
            <option value="bodyweight">bodyweight</option>
          </select>
          <button style={{ padding: 10, fontWeight: 900 }}>Add</button>
        </div>
      </form>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {items.map((x) => (
          <div key={x.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900 }}>{x.name}</div>
              <div style={{ opacity: 0.8 }}>{x.category ?? "—"} • {x.default_unit ?? "—"}</div>
            </div>
            <button onClick={() => remove(x.id)} style={{ padding: "8px 12px" }}>Delete</button>
          </div>
        ))}
        {items.length === 0 && <div style={{ opacity: 0.7 }}>No exercises yet. Add common lifts first.</div>}
      </div>
    </section>
  );
}

