export default function AdminHome() {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Admin dashboard</div>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Use <b>Plans</b> to build workouts, <b>Players</b> to assign plans + start dates, and <b>Exercise Library</b> to manage lifts.
      </div>

      <ol style={{ marginTop: 12, lineHeight: 1.6 }}>
        <li>Create a plan</li>
        <li>Add weeks + days (Day 1–7)</li>
        <li>Add exercises to each day</li>
        <li>Assign plan to players with a start date (calendar anchor)</li>
      </ol>
    </section>
  );
}
