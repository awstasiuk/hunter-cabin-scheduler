import { createClient } from "@/lib/supabase/server";
import { getCalendarData, cellState } from "@/lib/calendar-data";
import { addDays, datesInRange, formatDayLabel, fromISODate, toISODate, weekRange } from "@/lib/dates";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const anchor = params.from ? fromISODate(params.from) : new Date();
  const range = weekRange(anchor);
  const prevFrom = toISODate(addDays(fromISODate(range.start), -7));
  const nextFrom = toISODate(addDays(fromISODate(range.start), 7));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Calendar</h1>
        <p className="text-gray-600">Sign in to see the cabin calendar.</p>
      </section>
    );
  }

  const { data, error } = await getCalendarData(supabase, range);
  const days = datesInRange(range);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <nav className="flex gap-3 text-sm">
          <a href={`/?from=${prevFrom}`} className="hover:text-reserved">Prev week</a>
          <a href={`/?from=${toISODate(new Date())}`} className="hover:text-reserved">This week</a>
          <a href={`/?from=${nextFrom}`} className="hover:text-reserved">Next week</a>
        </nav>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Legend color="bg-reserved" label="Reserved" />
        <Legend color="bg-tentative" label="Tentative hold" />
        <Legend color="bg-free" label="Free (open to all)" />
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load the calendar: {error}
        </p>
      )}

      {!error && data.rooms.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No rooms yet. Add some in Supabase ({"supabase/seed.sql"}).
        </p>
      )}

      {data.rooms.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                  Room
                </th>
                {days.map((day) => (
                  <th key={day} className="px-3 py-2 text-left font-medium text-gray-600">
                    {formatDayLabel(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((room) => (
                <tr key={room.id} className="border-t border-gray-100">
                  <td className="sticky left-0 bg-white px-3 py-2 font-medium">
                    {room.name}
                    {room.primaryOwnerName && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({room.primaryOwnerName})
                      </span>
                    )}
                  </td>
                  {days.map((day) => {
                    const { state, reservation } = cellState(
                      room.id,
                      day,
                      data.reservations,
                      data.freeWindows
                    );
                    return (
                      <td key={day} className="px-1 py-1">
                        <Cell state={state} who={reservation?.bookedByName} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cell({ state, who }: { state: "reserved" | "tentative" | "free" | "empty"; who?: string }) {
  if (state === "empty") {
    return <div className="h-8 rounded bg-gray-50" />;
  }
  const styles: Record<string, string> = {
    reserved: "bg-reserved text-white",
    tentative: "bg-tentative text-white",
    free: "bg-free text-gray-700",
  };
  return (
    <div className={`h-8 rounded px-2 text-xs leading-8 ${styles[state]}`} title={who}>
      {state === "free" ? "Free" : who ?? state}
    </div>
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
