import { createClient } from "@/lib/supabase/server";
import BookingForm from "./BookingForm";

export default async function BookPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Book a room</h1>
        <p className="text-gray-600">Sign in to book a room.</p>
      </section>
    );
  }

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, name, type, primary_owner_id")
    .order("name");

  if (error) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Book a room</h1>
        <p className="text-sm text-red-600">Could not load rooms: {error.message}</p>
      </section>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Book a room</h1>
        <p className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No rooms yet. Add some in Supabase ({"supabase/seed.sql"}).
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Book a room</h1>
      <BookingForm rooms={rooms} userId={userData.user.id} />
    </section>
  );
}
