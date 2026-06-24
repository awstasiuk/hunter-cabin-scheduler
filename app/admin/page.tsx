import { createClient } from "@/lib/supabase/server";
import { createRoom, deleteRoom, setMemberRole, updateRoom } from "@/lib/actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <p className="text-gray-600">Sign in first.</p>
      </section>
    );
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (me?.role !== "admin") {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <p className="text-gray-600">Admins only.</p>
      </section>
    );
  }

  const [{ data: rooms, error: roomsError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("rooms").select("id, name, type, capacity, primary_owner_id").order("name"),
    supabase.from("profiles").select("id, email, display_name, role").order("display_name"),
  ]);

  const owners = members ?? []; // any member can own a room

  return (
    <section className="space-y-10">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <p className="text-gray-600">Manage rooms and member roles.</p>
      </div>

      {(roomsError || membersError) && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {roomsError?.message ?? membersError?.message}
        </p>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Rooms</h2>

        <div className="space-y-3">
          {(rooms ?? []).map((room) => (
            <form
              key={room.id}
              action={updateRoom}
              className="flex flex-wrap items-end gap-2 rounded border border-gray-200 p-3"
            >
              <input type="hidden" name="id" value={room.id} />
              <div>
                <label className="block text-xs text-gray-500">Name</label>
                <input
                  name="name"
                  defaultValue={room.name}
                  className="rounded border border-gray-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Type</label>
                <select
                  name="type"
                  defaultValue={room.type}
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  <option value="bedroom">Bedroom</option>
                  <option value="shared">Shared</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Capacity</label>
                <input
                  type="number"
                  min={1}
                  name="capacity"
                  defaultValue={room.capacity ?? ""}
                  className="w-20 rounded border border-gray-300 px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Owner</label>
                <select
                  name="primaryOwnerId"
                  defaultValue={room.primary_owner_id ?? ""}
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  <option value="">No owner (shared)</option>
                  {owners.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded bg-reserved px-3 py-1.5 text-sm font-medium text-white"
              >
                Save
              </button>
              <button
                type="submit"
                formAction={deleteRoom.bind(null, room.id)}
                className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700"
              >
                Remove
              </button>
            </form>
          ))}

          {(rooms ?? []).length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400">
              No rooms yet.
            </p>
          )}
        </div>

        <form
          action={createRoom}
          className="mt-4 flex flex-wrap items-end gap-2 rounded border border-dashed border-gray-300 p-3"
        >
          <div>
            <label className="block text-xs text-gray-500">Name</label>
            <input name="name" placeholder="Loft" className="rounded border border-gray-300 px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Type</label>
            <select name="type" defaultValue="bedroom" className="rounded border border-gray-300 px-2 py-1">
              <option value="bedroom">Bedroom</option>
              <option value="shared">Shared</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">Capacity</label>
            <input
              type="number"
              min={1}
              name="capacity"
              placeholder="2"
              className="w-20 rounded border border-gray-300 px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Owner</label>
            <select name="primaryOwnerId" defaultValue="" className="rounded border border-gray-300 px-2 py-1">
              <option value="">No owner (shared)</option>
              {owners.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded bg-reserved px-3 py-1.5 text-sm font-medium text-white">
            Add room
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        <div className="space-y-2">
          {(members ?? []).map((m) => (
            <form
              key={m.id}
              action={setMemberRole.bind(null, m.id, m.role === "admin" ? "member" : "admin")}
              className="flex items-center justify-between rounded border border-gray-200 p-3"
            >
              <div>
                <p className="font-medium">{m.display_name}</p>
                <p className="text-sm text-gray-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{m.role}</span>
                <button
                  type="submit"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:border-reserved hover:text-reserved"
                >
                  {m.role === "admin" ? "Make member" : "Make admin"}
                </button>
              </div>
            </form>
          ))}

          {(members ?? []).length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400">
              No members yet — they appear here after their first sign-in.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
