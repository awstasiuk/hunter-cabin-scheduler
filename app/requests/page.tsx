import { createClient } from "@/lib/supabase/server";
import { approveReservation, denyReservation } from "@/lib/actions";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Requests</h1>
        <p className="text-gray-600">Sign in to see requests on your rooms.</p>
      </section>
    );
  }

  const { data: rows, error } = await supabase
    .from("reservations")
    .select(
      "id, start_date, end_date, profiles:booked_by(display_name), rooms!inner(id, name, primary_owner_id)"
    )
    .eq("state", "tentative")
    .eq("rooms.primary_owner_id", userData.user.id)
    .order("start_date");

  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Requests</h1>
      <p className="mb-6 text-gray-600">Pending tentative holds on rooms you own.</p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load requests: {error.message}
        </p>
      )}

      {!error && (rows?.length ?? 0) === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No pending requests.
        </p>
      )}

      <ul className="space-y-3">
        {(rows ?? []).map((r: any) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded border border-gray-200 p-3"
          >
            <div>
              <p className="font-medium">{r.rooms.name}</p>
              <p className="text-sm text-gray-600">
                {r.start_date} to {r.end_date} — requested by {r.profiles?.display_name ?? "Unknown"}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={approveReservation.bind(null, r.id)}>
                <button
                  type="submit"
                  className="rounded bg-reserved px-3 py-1.5 text-sm font-medium text-white"
                >
                  Approve
                </button>
              </form>
              <form action={denyReservation.bind(null, r.id)}>
                <button
                  type="submit"
                  className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700"
                >
                  Deny
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
