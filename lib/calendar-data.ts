// Read-only data fetching for the calendar grid (Phase 1).
// Mirrors GET /calendar?from=&to= from the implementation plan: rooms,
// reservations, and free windows that touch the requested range.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvailabilityWindow, DateRange, Room } from "./reservations";

export interface RoomRow extends Room {
  name: string;
  primaryOwnerName: string | null;
}

export interface ReservationRow {
  id: string;
  roomId: string;
  bookedBy: string;
  bookedByName: string;
  start: string;
  end: string;
  state: "reserved" | "tentative";
}

export interface CalendarData {
  rooms: RoomRow[];
  reservations: ReservationRow[];
  freeWindows: AvailabilityWindow[];
}

const EMPTY: CalendarData = { rooms: [], reservations: [], freeWindows: [] };

/**
 * Fetch everything needed to render the calendar for `range`.
 * Returns empty data (rather than throwing) on a query error so the page can
 * still render — the caller is responsible for surfacing the error if it
 * wants to.
 */
export async function getCalendarData(
  supabase: SupabaseClient,
  range: DateRange
): Promise<{ data: CalendarData; error: string | null }> {
  const [roomsRes, reservationsRes, windowsRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, type, primary_owner_id, profiles:primary_owner_id(display_name)")
      .order("name"),
    supabase
      .from("reservations")
      .select("id, room_id, booked_by, start_date, end_date, state, profiles:booked_by(display_name)")
      .lt("start_date", range.end)
      .gt("end_date", range.start),
    supabase
      .from("availability_windows")
      .select("room_id, start_date, end_date")
      .lt("start_date", range.end)
      .gt("end_date", range.start),
  ]);

  const firstError = roomsRes.error || reservationsRes.error || windowsRes.error;
  if (firstError) {
    return { data: EMPTY, error: firstError.message };
  }

  const rooms: RoomRow[] = (roomsRes.data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    primaryOwnerId: r.primary_owner_id,
    primaryOwnerName: r.profiles?.display_name ?? null,
  }));

  const reservations: ReservationRow[] = (reservationsRes.data ?? []).map((r: any) => ({
    id: r.id,
    roomId: r.room_id,
    bookedBy: r.booked_by,
    bookedByName: r.profiles?.display_name ?? "Unknown",
    start: r.start_date,
    end: r.end_date,
    state: r.state,
  }));

  const freeWindows: AvailabilityWindow[] = (windowsRes.data ?? []).map((w: any) => ({
    roomId: w.room_id,
    start: w.start_date,
    end: w.end_date,
  }));

  return { data: { rooms, reservations, freeWindows }, error: null };
}

export type CellState = "reserved" | "tentative" | "free" | "empty";

/** What to show for one room on one day (YYYY-MM-DD). */
export function cellState(
  roomId: string,
  day: string,
  reservations: ReservationRow[],
  freeWindows: AvailabilityWindow[]
): { state: CellState; reservation?: ReservationRow } {
  const resv = reservations.find(
    (r) => r.roomId === roomId && r.start <= day && day < r.end
  );
  if (resv) return { state: resv.state, reservation: resv };

  const free = freeWindows.some(
    (w) => w.roomId === roomId && w.start <= day && day < w.end
  );
  if (free) return { state: "free" };

  return { state: "empty" };
}
