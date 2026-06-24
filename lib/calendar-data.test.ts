import { test } from "node:test";
import assert from "node:assert/strict";
import { cellState, type ReservationRow } from "./calendar-data";
import type { AvailabilityWindow } from "./reservations";

const reservations: ReservationRow[] = [
  {
    id: "res-1",
    roomId: "room-1",
    bookedBy: "user-1",
    bookedByName: "Andrew",
    start: "2026-07-01",
    end: "2026-07-05",
    state: "reserved",
  },
  {
    id: "res-2",
    roomId: "room-2",
    bookedBy: "user-2",
    bookedByName: "Sam",
    start: "2026-07-03",
    end: "2026-07-06",
    state: "tentative",
  },
];

const freeWindows: AvailabilityWindow[] = [{ roomId: "room-3", start: "2026-07-01", end: "2026-07-31" }];

test("cellState: a day inside a reserved reservation -> reserved", () => {
  const r = cellState("room-1", "2026-07-02", reservations, freeWindows);
  assert.equal(r.state, "reserved");
  assert.equal(r.reservation?.bookedByName, "Andrew");
});

test("cellState: a day inside a tentative hold -> tentative", () => {
  const r = cellState("room-2", "2026-07-04", reservations, freeWindows);
  assert.equal(r.state, "tentative");
  assert.equal(r.reservation?.bookedByName, "Sam");
});

test("cellState: the checkout day itself is not occupied (end is exclusive)", () => {
  const r = cellState("room-1", "2026-07-05", reservations, freeWindows);
  assert.equal(r.state, "empty");
});

test("cellState: a day inside a Free window with no reservation -> free", () => {
  const r = cellState("room-3", "2026-07-15", reservations, freeWindows);
  assert.equal(r.state, "free");
});

test("cellState: no reservation, no Free window -> empty", () => {
  const r = cellState("room-1", "2026-08-01", reservations, freeWindows);
  assert.equal(r.state, "empty");
});

test("cellState: a reservation takes priority over an overlapping Free window", () => {
  const resv: ReservationRow[] = [
    { id: "r", roomId: "room-3", bookedBy: "u", bookedByName: "Andrew", start: "2026-07-10", end: "2026-07-12", state: "reserved" },
  ];
  const r = cellState("room-3", "2026-07-11", resv, freeWindows);
  assert.equal(r.state, "reserved");
});
