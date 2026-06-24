"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { decideReservation, previewMessage, type AvailabilityWindow } from "@/lib/reservations";
import { createReservation, getRoomFreeWindows, type ActionResult } from "@/lib/actions";

interface RoomOption {
  id: string;
  name: string;
  type: "bedroom" | "shared";
  primary_owner_id: string | null;
}

export default function BookingForm({ rooms, userId }: { rooms: RoomOption[]; userId: string }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [freeWindows, setFreeWindows] = useState<AvailabilityWindow[]>([]);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    getRoomFreeWindows(roomId).then((windows) => {
      if (active) setFreeWindows(windows);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  const room = rooms.find((r) => r.id === roomId);

  const preview = useMemo(() => {
    if (!room || !startDate || !endDate || startDate >= endDate) return null;
    const decision = decideReservation({
      room: { id: room.id, type: room.type, primaryOwnerId: room.primary_owner_id },
      requesterId: userId,
      range: { start: startDate, end: endDate },
      freeWindows,
    });
    return previewMessage(decision);
  }, [room, startDate, endDate, freeWindows, userId]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createReservation(formData);
      setResult(res);
      if (res.ok) {
        setStartDate("");
        setEndDate("");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium">Room</label>
        <select
          name="roomId"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium">Check-in</label>
          <input
            type="date"
            name="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium">Check-out</label>
          <input
            type="date"
            name="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {preview && (
        <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{preview}</p>
      )}

      <button
        type="submit"
        disabled={pending || !startDate || !endDate}
        className="rounded bg-reserved px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Submitting..." : "Request booking"}
      </button>

      {result && (
        <p className={`text-sm ${result.ok ? "text-reserved" : "text-red-600"}`}>{result.message}</p>
      )}
    </form>
  );
}
