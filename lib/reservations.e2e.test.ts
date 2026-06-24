// End-to-end rule tests: simulate sequences of bookings against the pure
// decision + conflict logic, the same way lib/actions.ts composes them
// against the database. No Supabase needed — `existing` stands in for
// rows already in the `reservations` table.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideReservation,
  rangesOverlap,
  type AvailabilityWindow,
  type DateRange,
  type Decision,
  type Room,
} from "./reservations";

interface SimReservation extends DateRange {
  state: Decision["state"];
}

/** Mirrors the conflict check in lib/actions.ts:createReservation. */
function hasConflict(range: DateRange, existing: SimReservation[]): boolean {
  return existing.some((r) => rangesOverlap(range, r));
}

/** One step of the pipeline a real request goes through: conflict check, then decide. */
function request(
  room: Room,
  requesterId: string,
  range: DateRange,
  existing: SimReservation[],
  freeWindows: AvailabilityWindow[]
): { blocked: true } | { blocked: false; decision: Decision } {
  if (hasConflict(range, existing)) return { blocked: true };
  return { blocked: false, decision: decideReservation({ room, requesterId, range, freeWindows }) };
}

const room: Room = { id: "room-1", type: "bedroom", primaryOwnerId: "owner-1" };

test("e2e: a tentative hold blocks a second overlapping request from anyone (first hold wins)", () => {
  const existing: SimReservation[] = [];

  const first = request(room, "guest-1", { start: "2026-08-01", end: "2026-08-05" }, existing, []);
  assert.equal(first.blocked, false);
  if (first.blocked) throw new Error("unreachable");
  assert.equal(first.decision.state, "tentative");
  existing.push({ ...{ start: "2026-08-01", end: "2026-08-05" }, state: first.decision.state });

  const second = request(room, "guest-2", { start: "2026-08-03", end: "2026-08-06" }, existing, []);
  assert.equal(second.blocked, true);
});

test("e2e: back-to-back stays after a tentative hold are NOT blocked (exclusive end)", () => {
  const existing: SimReservation[] = [{ start: "2026-08-01", end: "2026-08-05", state: "tentative" }];

  const next = request(room, "guest-2", { start: "2026-08-05", end: "2026-08-08" }, existing, []);
  assert.equal(next.blocked, false);
});

test("e2e: owner books their own room despite an existing approved reservation elsewhere on the calendar", () => {
  const existing: SimReservation[] = [{ start: "2026-09-01", end: "2026-09-05", state: "reserved" }];

  const ownerBooking = request(room, "owner-1", { start: "2026-09-10", end: "2026-09-12" }, existing, []);
  assert.equal(ownerBooking.blocked, false);
  if (ownerBooking.blocked) throw new Error("unreachable");
  assert.deepEqual(ownerBooking.decision, { state: "reserved", needsApprovalFrom: null, reason: "owner" });
});

test("e2e: owner's own overlapping range is still blocked by an existing confirmed reservation (owner doesn't bypass conflict checks)", () => {
  const existing: SimReservation[] = [{ start: "2026-09-01", end: "2026-09-05", state: "reserved" }];

  const ownerBooking = request(room, "owner-1", { start: "2026-09-03", end: "2026-09-06" }, existing, []);
  assert.equal(ownerBooking.blocked, true);
});

test("e2e: request fully inside a Free window with no conflicts -> reserved immediately", () => {
  const existing: SimReservation[] = [];
  const freeWindows: AvailabilityWindow[] = [{ roomId: room.id, start: "2026-10-01", end: "2026-10-31" }];

  const r = request(room, "guest-1", { start: "2026-10-10", end: "2026-10-15" }, existing, freeWindows);
  assert.equal(r.blocked, false);
  if (r.blocked) throw new Error("unreachable");
  assert.equal(r.decision.reason, "free-window");
});

test("e2e: a guest's tentative hold inside a partial Free window blocks a later Free-window request for the same dates", () => {
  const existing: SimReservation[] = [];
  const freeWindows: AvailabilityWindow[] = [{ roomId: room.id, start: "2026-11-01", end: "2026-11-10" }];

  // Partial overlap with the Free window -> falls back to a request.
  const first = request(room, "guest-1", { start: "2026-11-05", end: "2026-11-20" }, existing, freeWindows);
  assert.equal(first.blocked, false);
  if (first.blocked) throw new Error("unreachable");
  assert.equal(first.decision.state, "tentative");
  existing.push({ start: "2026-11-05", end: "2026-11-20", state: "tentative" });

  // Even though this second request would have been fully covered by the
  // Free window, the existing tentative hold blocks it outright.
  const second = request(room, "guest-2", { start: "2026-11-06", end: "2026-11-09" }, existing, freeWindows);
  assert.equal(second.blocked, true);
});

test("e2e: a shared room never requires approval, even back-to-back for different guests", () => {
  const shared: Room = { id: "room-2", type: "shared", primaryOwnerId: null };
  const existing: SimReservation[] = [];

  const first = request(shared, "guest-1", { start: "2026-12-01", end: "2026-12-03" }, existing, []);
  assert.equal(first.blocked, false);
  if (first.blocked) throw new Error("unreachable");
  assert.equal(first.decision.state, "reserved");
  existing.push({ start: "2026-12-01", end: "2026-12-03", state: "reserved" });

  const second = request(shared, "guest-2", { start: "2026-12-03", end: "2026-12-05" }, existing, []);
  assert.equal(second.blocked, false);
  if (second.blocked) throw new Error("unreachable");
  assert.equal(second.decision.state, "reserved");
});

test("e2e: approving a tentative hold (simulated state flip) still blocks subsequent overlapping requests", () => {
  const existing: SimReservation[] = [{ start: "2027-01-01", end: "2027-01-05", state: "tentative" }];

  // Owner approves -> state flips to "reserved" (what approveReservation does in lib/actions.ts).
  existing[0].state = "reserved";

  const r = request(room, "guest-2", { start: "2027-01-02", end: "2027-01-04" }, existing, []);
  assert.equal(r.blocked, true);
});

test("e2e: denying a tentative hold (simulated removal) frees the dates for a new request", () => {
  let existing: SimReservation[] = [{ start: "2027-02-01", end: "2027-02-05", state: "tentative" }];

  // Owner denies -> denyReservation deletes the row.
  existing = existing.filter((r) => false);

  const r = request(room, "guest-2", { start: "2027-02-02", end: "2027-02-04" }, existing, []);
  assert.equal(r.blocked, false);
});
