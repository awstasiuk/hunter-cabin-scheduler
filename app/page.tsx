export default function HomePage() {
  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Calendar</h1>
      <p className="mb-6 text-gray-600">
        The shared calendar will render here — one row per room, colored by
        reservation state. This is scaffolding; see the build roadmap for what
        comes next.
      </p>

      <div className="flex flex-wrap gap-4 text-sm">
        <Legend color="bg-reserved" label="Reserved" />
        <Legend color="bg-tentative" label="Tentative hold" />
        <Legend color="bg-free" label="Free (open to all)" />
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
        Calendar grid placeholder — wire up FullCalendar + Supabase in Phase 1.
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}
