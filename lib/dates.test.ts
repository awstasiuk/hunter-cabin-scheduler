import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, datesInRange, fromISODate, startOfWeek, toISODate, weekRange } from "./dates";

test("toISODate/fromISODate roundtrip", () => {
  const iso = "2026-07-04";
  assert.equal(toISODate(fromISODate(iso)), iso);
});

test("addDays moves forward and backward", () => {
  assert.equal(toISODate(addDays(fromISODate("2026-07-04"), 3)), "2026-07-07");
  assert.equal(toISODate(addDays(fromISODate("2026-07-04"), -3)), "2026-07-01");
});

test("startOfWeek: a Wednesday rolls back to Monday", () => {
  // 2026-06-24 is a Wednesday.
  assert.equal(toISODate(startOfWeek(fromISODate("2026-06-24"))), "2026-06-22");
});

test("startOfWeek: a Sunday rolls back to the prior Monday", () => {
  // 2026-06-28 is a Sunday.
  assert.equal(toISODate(startOfWeek(fromISODate("2026-06-28"))), "2026-06-22");
});

test("startOfWeek: a Monday stays put", () => {
  assert.equal(toISODate(startOfWeek(fromISODate("2026-06-22"))), "2026-06-22");
});

test("weekRange: 7-day exclusive-end range starting Monday", () => {
  const r = weekRange(fromISODate("2026-06-24"));
  assert.equal(r.start, "2026-06-22");
  assert.equal(r.end, "2026-06-29");
});

test("datesInRange: exclusive end, correct count and order", () => {
  const days = datesInRange({ start: "2026-06-22", end: "2026-06-29" });
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-06-22");
  assert.equal(days[6], "2026-06-28");
});

test("datesInRange: empty when start === end", () => {
  assert.deepEqual(datesInRange({ start: "2026-06-22", end: "2026-06-22" }), []);
});
