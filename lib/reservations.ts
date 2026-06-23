// Core reservation decision logic — the heart of the app.
//
// When a member submits a booking, the server decides the resulting state.
// Keep this on the server so the rules cannot be bypassed from the client.

export type ReservationState = "reserved" | "tentative";

export interface DateRange {
  /** Inclusive check-in date (YYYY-MM-DD). */
  start: string;
  /** Exclusive check-out date (YYYY-MM-DD). Same-day back-to-back stays do not conflict. */
  end: string;
}

export interface Room {
  id: string;
  type: "bedroom" | "shared";
  primaryOwnerId: string | null;
}

export interface AvailabilityWindow {
  roomId: string;
  start: string; // inclusive
  end: string; // exclusive
}

/** Two ranges overlap if they share at least one night (end is exclusive). */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True if `inner` is fully contained within `outer`. */
export function rangeContains(outer: DateRange, inner: DateRange): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/**
 * Is the room marked Free across the ENTIRE requested range?
 * Only a full cover auto-confirms; a partial overlap falls back to a request.
 * (For v1 we require a single covering window. Merging adjacent windows can
 * come later if owners open Free ranges in pieces.)
 */
export function isRangeFullyFree(
  range: DateRange,
  windows: AvailabilityWindow[]
): boolean {
  return windows.some((w) => rangeContains(w, range));
}

export interface DecisionInput {
  room: Room;
  requesterId: string;
  range: DateRange;
  freeWindows: AvailabilityWindow[];
}

export interface Decision {
  state: ReservationState;
  /** Owner who must approve, if this becomes a tentative hold. */
  needsApprovalFrom: string | null;
  reason: "owner" | "shared" | "free-window" | "request";
}

/**
 * Decide the outcome of a booking request.
 *
 *   1. Requester owns the room               -> reserved
 *   2. Room is shared (no owner)             -> reserved
 *   3. Room is fully covered by a Free window -> reserved
 *   4. Otherwise                             -> tentative, needs owner approval
 *
 * Conflict checking (no overlap with existing confirmed reservations or active
 * tentative holds) must be done by the caller BEFORE applying this decision.
 */
export function decideReservation(input: DecisionInput): Decision {
  const { room, requesterId, range, freeWindows } = input;

  if (room.primaryOwnerId && room.primaryOwnerId === requesterId) {
    return { state: "reserved", needsApprovalFrom: null, reason: "owner" };
  }

  if (room.type === "shared" || room.primaryOwnerId === null) {
    return { state: "reserved", needsApprovalFrom: null, reason: "shared" };
  }

  if (isRangeFullyFree(range, freeWindows)) {
    return { state: "reserved", needsApprovalFrom: null, reason: "free-window" };
  }

  return {
    state: "tentative",
    needsApprovalFrom: room.primaryOwnerId,
    reason: "request",
  };
}

/** Human-readable preview shown in the booking dialog before submit. */
export function previewMessage(d: Decision, ownerName?: string): string {
  switch (d.reason) {
    case "owner":
      return "This is your room — it will be confirmed immediately.";
    case "shared":
      return "Shared space — it will be confirmed immediately.";
    case "free-window":
      return "This room is marked free for these dates — confirmed immediately.";
    case "request":
      return `This will request approval from ${ownerName ?? "the room's owner"}.`;
  }
}
