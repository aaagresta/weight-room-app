"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Week = { id: string; week_number: number };
type Day = { id: string; day_number: number; title: string; plan_week_id: string };

export default function PlanBuilderPage() {
 const params = useParams();
const raw = (params as any).planId;
const planId = Array.isArray(raw) ? raw[0] : raw;

if (!planId) {
  return <div style={{ padding: 16, color: "crimson" }}>Missing planId in URL.</div>;
}
  const [planName, setPlanName] = useState("Plan");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [daysByWeek, setDaysByWeek] = useState<Record<string, Day[]>>({});
  const [newWeekNumber, setNewWeekNumber] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    const { data: plan, error: pErr } = await supabase
      .from("plans")
      .select("name")
      .eq("id", planId)
      .single();

    if (!pErr) setPlanName(plan.name);

    const { data: wData, error: wErr } = await supabase
      .from("plan_weeks")
      .select("id, week_number")
      .eq("plan_id", planId)
      .order("week_number", { ascending: true });

    if (wErr) return setError(wErr.message);

    setWeeks((wData ?? []) as Week[]);

    const weekIds = (wData ?? []).map((w: any) => w.id);
    if (weekIds.length === 0) {
      setDaysByWeek({});
      return;
    }

    const { data: dData, error: dErr } = await supabase
      .from("plan_days")
      .select("id, day_number, title, plan_week_id")
      .in("plan_week_id", weekIds)
      .order("day_number", { ascending: true });

    if (dErr) return setError(dErr.message);

    const map: Record<string, Day[]> = {};
    (dData ?? []).forEach((d: any) => {
      map[d.plan_week_id] = map[d.plan_week_id] ?? [];
      map[d.plan_week_id].push(d);
    });
    setDaysByWeek(map);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function addWeek() {
    setError(null);
    const num = Number(newWeekNumber);
    if (!Number.isFinite(num) || num < 1) return setError("Week number must be a positive integer.");

    const { error } = await supabase.from("plan_weeks").insert({ plan_id: planId, week_number: num });
    if (error) return setError(error.message);

    load();
  }

  async function addDay(weekId: string, dayNumber: number, title: string) {
    setError(null);
    if (!title.trim()) return setError("Day title required.");
    const { error } = await supabase.from("plan_days").insert({
      plan_week_id: weekId,
      day_number: dayNumber,
      title: title.trim(),
    });
    if (error) return setError(error.message);
    load();
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Plan builder</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{planName}</h2>
        </div>
        <Link href="/admin/plans" style={btnLink}>Back to Plans</Link>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Add week</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={newWeekNumber} onChange={(e) => setNewWeekNumber(e.target.value)} placeholder="Week #" style={{ padding: 10, width: 120 }} />
          <button onClick={addWeek} style={{ padding: "10px 12px", fontWeight: 900 }}>Add week</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {weeks.map((w) => (
          <WeekCard
            key={w.id}
            week={w}
            days={daysByWeek[w.id] ?? []}
            onAddDay={addDay}
          />
        ))}
        {weeks.length === 0 && <div style={{ opacity: 0.7 }}>No weeks yet. Add Week 1 to start.</div>}
      </div>
    </section>
  );
}

function WeekCard({
  week,
  days,
  onAddDay,
}: {
  week: Week;
  days: Day[];
  onAddDay: (weekId: string, dayNumber: number, title: string) => void;
}) {
  const [dayNumber, setDayNumber] = useState("1");
  const [title, setTitle] = useState("");

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>Week {week.week_number}</div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {days.map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800 }}>Day {d.day_number}: {d.title}</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Edit exercises for this day</div>
            </div>
            <Link href={`/admin/days/${d.id}`} style={btnLink}>Edit day</Link>
          </div>
        ))}
        {days.length === 0 && <div style={{ opacity: 0.7 }}>No days in this week yet.</div>}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Add day</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} placeholder="Day # (1-7)" style={{ padding: 10, width: 140 }} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (ex: Lower A)" style={{ padding: 10, minWidth: 220, flex: 1 }} />
          <button
            onClick={() => onAddDay(week.id, Number(dayNumber), title)}
            style={{ padding: "10px 12px", fontWeight: 900 }}
          >
            Add day
          </button>
        </div>
      </div>
    </div>
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

