"use server";

// Server Actions — the "server action or route handler" called for in the
// implementation plan (Section 6). Keeping the decision logic here means it
// can't be bypassed from the client; the browser only ever sees the result.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  decideReservation,
  rangesOverlap,
  type AvailabilityWindow,
  type DateRange,
  type Room,
} from "@/lib/reservations";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * POST /reservations from the plan: validate the range is free of conflicts,
 * apply the decision rule, and insert the reservation.
 */
export async function createReservation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, message: "Sign in to book a room." };

  const roomId = String(formData.get("roomId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!roomId || !startDate || !endDate) {
    return { ok: false, message: "Pick a room and both dates." };
  }
  if (startDate >= endDate) {
    return { ok: false, message: "Check-out must be after check-in." };
  }

  const range: DateRange = { start: startDate, end: endDate };

  const { data: roomRow, error: roomError } = await supabase
    .from("rooms")
    .select("id, type, primary_owner_id")
    .eq("id", roomId)
    .single();
  if (roomError || !roomRow) return { ok: false, message: "Room not found." };

  const room: Room = {
    id: roomRow.id,
    type: roomRow.type,
    primaryOwnerId: roomRow.primary_owner_id,
  };

  // Concurrency rule: an existing reserved OR tentative hold on this room
  // blocks a new request for an overlapping range. First hold wins.
  const { data: existing, error: existingError } = await supabase
    .from("reservations")
    .select("start_date, end_date")
    .eq("room_id", roomId)
    .in("state", ["reserved", "tentative"]);
  if (existingError) return { ok: false, message: existingError.message };

  const conflict = (existing ?? []).some((r) =>
    rangesOverlap(range, { start: r.start_date, end: r.end_date })
  );
  if (conflict) {
    return { ok: false, message: "Those dates are already reserved or held for this room." };
  }

  const { data: windowRows, error: windowsError } = await supabase
    .from("availability_windows")
    .select("start_date, end_date")
    .eq("room_id", roomId)
    .lt("start_date", endDate)
    .gt("end_date", startDate);
  if (windowsError) return { ok: false, message: windowsError.message };

  const freeWindows: AvailabilityWindow[] = (windowRows ?? []).map((w) => ({
    roomId,
    start: w.start_date,
    end: w.end_date,
  }));

  const decision = decideReservation({ room, requesterId: user.id, range, freeWindows });

  const { error: insertError } = await supabase.from("reservations").insert({
    room_id: roomId,
    booked_by: user.id,
    start_date: startDate,
    end_date: endDate,
    state: decision.state,
  });
  if (insertError) return { ok: false, message: insertError.message };

  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath("/my-bookings");

  return {
    ok: true,
    message:
      decision.state === "reserved"
        ? "Booked — confirmed immediately."
        : "Requested — waiting on the owner's approval.",
  };
}

/** All Free windows on a room, for the live outcome preview in the booking form. */
export async function getRoomFreeWindows(roomId: string): Promise<AvailabilityWindow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_windows")
    .select("start_date, end_date")
    .eq("room_id", roomId);
  if (error || !data) return [];
  return data.map((w) => ({ roomId, start: w.start_date, end: w.end_date }));
}

// approveReservation/denyReservation/cancelReservation are bound directly to
// <form action={...}> below (no client JS reads the result), so React's DOM
// types require them to return void rather than our ActionResult. Throwing
// on failure still surfaces a real error instead of failing silently.

/** POST /reservations/:id/approve — owner-only; RLS enforces ownership. */
export async function approveReservation(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in first.");

  const { data, error } = await supabase
    .from("reservations")
    .update({ state: "reserved", decided_by: userData.user.id })
    .eq("id", id)
    .eq("state", "tentative")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Nothing to approve (not found, already decided, or not yours).");
  }

  revalidatePath("/requests");
  revalidatePath("/");
}

/** POST /reservations/:id/deny — owner-only; RLS enforces ownership. */
export async function denyReservation(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in first.");

  const { data, error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", id)
    .eq("state", "tentative")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Nothing to deny (not found, already decided, or not yours).");
  }

  revalidatePath("/requests");
  revalidatePath("/");
}

/** DELETE /reservations/:id — booker or owner cancels; RLS enforces who. */
export async function cancelReservation(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in first.");

  const { data, error } = await supabase.from("reservations").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Nothing to cancel (not found, or not yours).");
  }

  revalidatePath("/my-bookings");
  revalidatePath("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

// --- Admin: rooms + members -------------------------------------------------
// Same story as the reservation actions above: these are bound directly to
// form action/formAction props, so they return void and throw on failure.

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in first.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Admins only.");
  }
}

export async function createRoom(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const primaryOwnerId = String(formData.get("primaryOwnerId") ?? "") || null;

  if (!name) throw new Error("Room needs a name.");
  if (type !== "bedroom" && type !== "shared") {
    throw new Error("Pick a room type.");
  }

  const capacity = capacityRaw ? Number(capacityRaw) : null;
  if (capacityRaw && (!Number.isFinite(capacity) || capacity! <= 0)) {
    throw new Error("Capacity must be a positive number.");
  }

  const { error } = await supabase.from("rooms").insert({
    name,
    type,
    capacity,
    primary_owner_id: type === "bedroom" ? primaryOwnerId : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/book");
}

export async function updateRoom(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const primaryOwnerId = String(formData.get("primaryOwnerId") ?? "") || null;

  if (!id) throw new Error("Missing room id.");
  if (!name) throw new Error("Room needs a name.");
  if (type !== "bedroom" && type !== "shared") {
    throw new Error("Pick a room type.");
  }

  const capacity = capacityRaw ? Number(capacityRaw) : null;
  if (capacityRaw && (!Number.isFinite(capacity) || capacity! <= 0)) {
    throw new Error("Capacity must be a positive number.");
  }

  const { error } = await supabase
    .from("rooms")
    .update({
      name,
      type,
      capacity,
      primary_owner_id: type === "bedroom" ? primaryOwnerId : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/book");
}

export async function deleteRoom(id: string): Promise<void> {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/book");
}

export async function setMemberRole(userId: string, role: "member" | "admin"): Promise<void> {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
