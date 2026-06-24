import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideReservation,
  isRangeFullyFree,
  previewMessage,
  rangesOverlap,
  type AvailabilityWindow,
  type Room,
} from "./reservations";

const range = (start: string, end: string) => ({ start, end });

test("rangesOverlap: shares a night", () => {
  assert.equal(rangesOverlap(range("2026-07-01", "2026-07-05"), range("2026-07-04", "2026-07-08")), true);
});

test("rangesOverlap: back-to-back stays do not conflict (end is exclusive)", () => {
  assert.equal(rangesOverlap(range("2026-07-01", "2026-07-05"), range("2026-07-05", "2026-07-08")), false);
});

test("rangesOverlap: no overlap, gap between", () => {
  assert.equal(rangesOverlap(range("2026-07-01", "2026-07-05"), range("2026-07-10", "2026-07-12")), false);
});

test("isRangeFullyFree: true when one window fully covers the range", () => {
  const windows: AvailabilityWindow[] = [{ roomId: "r1", start: "2026-07-01", end: "2026-07-31" }];
  assert.equal(isRangeFullyFree(range("2026-07-10", "2026-07-15"), windows), true);
});

test("isRangeFullyFree: false on partial overlap (must fall back to a request)", () => {
  const windows: AvailabilityWindow[] = [{ roomId: "r1", start: "2026-07-01", end: "2026-07-12" }];
  assert.equal(isRangeFullyFree(range("2026-07-10", "2026-07-15"), windows), false);
});

test("isRangeFullyFree: false with no windows", () => {
  assert.equal(isRangeFullyFree(range("2026-07-10", "2026-07-15"), []), false);
});

const bedroom: Room = { id: "room-1", type: "bedroom", primaryOwnerId: "owner-1" };
const shared: Room = { id: "room-2", type: "shared", primaryOwnerId: null };

test("decideReservation: owner booking their own room -> reserved", () => {
  const d = decideReservation({
    room: bedroom,
    requesterId: "owner-1",
    range: range("2026-07-01", "2026-07-05"),
    freeWindows: [],
  });
  assert.deepEqual(d, { state: "reserved", needsApprovalFrom: null, reason: "owner" });
});

test("decideReservation: shared room with no owner -> reserved", () => {
  const d = decideReservation({
    room: shared,
    requesterId: "anyone",
    range: range("2026-07-01", "2026-07-05"),
    freeWindows: [],
  });
  assert.deepEqual(d, { state: "reserved", needsApprovalFrom: null, reason: "shared" });
});

test("decideReservation: non-owner, fully covered by a Free window -> reserved", () => {
  const d = decideReservation({
    room: bedroom,
    requesterId: "guest-1",
    range: range("2026-07-10", "2026-07-12"),
    freeWindows: [{ roomId: "room-1", start: "2026-07-01", end: "2026-07-31" }],
  });
  assert.deepEqual(d, { state: "reserved", needsApprovalFrom: null, reason: "free-window" });
});

test("decideReservation: non-owner, partial Free overlap -> tentative (falls back to a request)", () => {
  const d = decideReservation({
    room: bedroom,
    requesterId: "guest-1",
    range: range("2026-07-10", "2026-07-15"),
    freeWindows: [{ roomId: "room-1", start: "2026-07-01", end: "2026-07-12" }],
  });
  assert.deepEqual(d, { state: "tentative", needsApprovalFrom: "owner-1", reason: "request" });
});

test("decideReservation: non-owner, no Free window -> tentative, routed to owner", () => {
  const d = decideReservation({
    room: bedroom,
    requesterId: "guest-1",
    range: range("2026-07-01", "2026-07-05"),
    freeWindows: [],
  });
  assert.deepEqual(d, { state: "tentative", needsApprovalFrom: "owner-1", reason: "request" });
});

test("previewMessage: matches each decision reason", () => {
  assert.match(previewMessage({ state: "reserved", needsApprovalFrom: null, reason: "owner" }), /your room/i);
  assert.match(previewMessage({ state: "reserved", needsApprovalFrom: null, reason: "shared" }), /shared space/i);
  assert.match(
    previewMessage({ state: "reserved", needsApprovalFrom: null, reason: "free-window" }),
    /marked free/i
  );
  assert.match(
    previewMessage({ state: "tentative", needsApprovalFrom: "owner-1", reason: "request" }, "Andrew"),
    /approval from Andrew/
  );
});
